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

// Stateless tokens: kind~subject~expiry~secretVersion~nonce, HMAC-signed in the cookie.
// They work across server instances. The secret version is derived from the PIN or
// password hash, so a PIN reset ends every existing session of that student.
function secretVersion(db: Db, kind: "student" | "staff", subjectId: string): string | null {
  const h = kind === "student" ? db.students.find((x) => x.id === subjectId)?.pin_hash : db.profiles.find((x) => x.id === subjectId)?.password_hash;
  return h ? sha256(h).slice(0, 12) : null;
}

export function issueSession(db: Db, kind: "student" | "staff", subjectId: string, hours: number): string {
  const exp = Date.now() + hours * 3600_000;
  return [kind, subjectId, exp, secretVersion(db, kind, subjectId) ?? "x", randomToken(8)].join("~");
}

export async function setSessionCookie(name: string, token: string, hours: number) {
  const jar = await cookies();
  jar.set(name, sign(token), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: hours * 3600 });
}

export async function clearSession(name: string) {
  const jar = await cookies();
  const token = unsign(jar.get(name)?.value);
  if (token) {
    const [kind, subject] = token.split("~");
    write((db) => {
      db.sessions.push({ id: crypto.randomUUID(), kind: kind === "staff" ? "staff" : "student", subject_id: subject ?? "", token_hash: sha256(token), created_at: now(), expires_at: now(), revoked_at: now() });
      if (db.sessions.length > 500) db.sessions = db.sessions.slice(-500);
    });
  }
  jar.delete(name);
}

function findSession(db: Db, kind: "student" | "staff", token: string | null): { subject_id: string } | null {
  if (!token) return null;
  const [k, subject, exp, sv] = token.split("~");
  if (k !== kind || !subject || !(Number(exp) > Date.now())) return null;
  if (secretVersion(db, kind, subject) !== sv) return null;
  if (db.sessions.some((x) => x.revoked_at && x.token_hash === sha256(token))) return null;
  return { subject_id: subject };
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
