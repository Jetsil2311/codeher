import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomToken, sha256, sign, unsign } from "./crypto";
import { read, write, now } from "./db/store";
import type { Db, Profile, Student } from "./db/types";

// Signed, httpOnly session cookies with limited lifetime (brief 4.4). Tokens are stored
// hashed, so revoking a session or deactivating a code ends it immediately.
export const STUDENT_COOKIE = "ch_student";
export const STAFF_COOKIE = "ch_staff";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export function issueSession(db: Db, kind: "student" | "staff", subjectId: string, hours: number): string {
  const token = randomToken();
  db.sessions.push({ id: crypto.randomUUID(), kind, subject_id: subjectId, token_hash: sha256(token), created_at: now(), expires_at: new Date(Date.now() + hours * 3600_000).toISOString(), revoked_at: null });
  return token;
}

export async function setSessionCookie(name: string, token: string, hours: number) {
  const jar = await cookies();
  jar.set(name, sign(token), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: hours * 3600 });
}

export async function clearSession(name: string) {
  const jar = await cookies();
  const token = unsign(jar.get(name)?.value);
  if (token) {
    const h = sha256(token);
    write((db) => {
      const s = db.sessions.find((x) => x.token_hash === h);
      if (s) s.revoked_at = now();
    });
  }
  jar.delete(name);
}

function findSession(db: Db, kind: "student" | "staff", token: string | null) {
  if (!token) return null;
  const h = sha256(token);
  const s = db.sessions.find((x) => x.token_hash === h && x.kind === kind && !x.revoked_at);
  if (!s || Date.parse(s.expires_at) < Date.now()) return null;
  return s;
}

function studentActive(db: Db, st: Student): boolean {
  const g = db.groups.find((x) => x.id === st.group_id);
  if (!g || st.status !== "active" || g.status !== "active") return false;
  if (g.ends_on && g.ends_on < new Date().toISOString().slice(0, 10)) return false;
  return true;
}

export async function currentStudent(): Promise<Student | null> {
  const jar = await cookies();
  const token = unsign(jar.get(STUDENT_COOKIE)?.value);
  const found = read((db) => {
    const s = findSession(db, "student", token);
    if (!s) return null;
    const st = db.students.find((x) => x.id === s.subject_id);
    return st && studentActive(db, st) ? st : null;
  });
  if (found && (!found.last_active_at || Date.parse(found.last_active_at) < Date.now() - 5 * 60_000)) {
    write((db) => {
      const st = db.students.find((x) => x.id === found.id);
      if (st) st.last_active_at = now();
    });
  }
  return found;
}

export async function requireStudent(): Promise<Student> {
  const s = await currentStudent();
  if (!s) redirect("/entrar");
  return s;
}

export async function currentStaff(): Promise<Profile | null> {
  const jar = await cookies();
  const token = unsign(jar.get(STAFF_COOKIE)?.value);
  return read((db) => {
    const s = findSession(db, "staff", token);
    if (!s) return null;
    const p = db.profiles.find((x) => x.id === s.subject_id);
    return p && p.active && p.role !== "pending" ? p : null;
  });
}

export async function requireStaff(): Promise<Profile> {
  const p = await currentStaff();
  if (!p) redirect("/equipo");
  return p;
}

export async function requireFounder(): Promise<Profile> {
  const p = await requireStaff();
  if (p.role !== "founder") redirect("/equipo/panel");
  return p;
}
