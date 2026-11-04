import "server-only";
import { generatePin, groupPrefix, isTrivialPin, buildStudentCode, nextGroupLetter, type CodeLanguage } from "@codeher/core";
import { hashSecret, randomToken, sha256, verifySecret } from "../../crypto";
import { now, read, write, nextSeq } from "../../db/store";
import type { AccomplishmentKind, Db, Exercise, Group, Lesson, Profile, Role, Settings, Student } from "../../db/types";
import { AppError } from "../../errors";
import { courseOrder, lessonStatus, totals } from "../../learning";
import { issueSession } from "../../session";
import { log } from "./student";

// ---------- Visibility (educator isolation; mirrors educator_can_see_group) ----------
export function canSeeGroup(db: Db, p: Profile, groupId: string) {
  if (!p.active) return false;
  if (p.role === "founder") return true;
  return db.educator_groups.some((eg) => eg.group_id === groupId && eg.educator_id === p.id);
}
function requireGroup(db: Db, p: Profile, groupId: string): Group {
  const g = db.groups.find((x) => x.id === groupId);
  if (!g || !canSeeGroup(db, p, g.id)) throw new AppError("forbidden");
  return g;
}
function requireStudent(db: Db, p: Profile, studentId: string): Student {
  const s = db.students.find((x) => x.id === studentId);
  if (!s || !canSeeGroup(db, p, s.group_id)) throw new AppError("forbidden");
  return s;
}
function founderOnly(p: Profile) {
  if (p.role !== "founder" || !p.active) throw new AppError("forbidden");
}
const staffLog = (db: Db, p: Profile, action: string, type: string, id: string | null, payload: Record<string, unknown> = {}) => log(db, "staff", p.id, action, type, id, payload);

// ---------- Staff sign-in (local mode; Supabase Auth in production) ----------
export function staffSignIn(email: string, password: string) {
  return write((db) => {
    const p = db.profiles.find((x) => x.email === email.trim().toLowerCase());
    if (!p || !verifySecret(password, p.password_hash)) return { ok: false as const, error: "invalid_credentials" };
    if (!p.active) return { ok: false as const, error: "staff_inactive" };
    if (p.role === "pending") return { ok: false as const, error: "staff_pending" };
    return { ok: true as const, token: issueSession(db, "staff", p.id, 12) };
  });
}

export function staffRegister(name: string, email: string, password: string) {
  return write((db) => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new AppError("invalid_email");
    if (password.length < 10) throw new AppError("weak_password");
    if (db.profiles.some((x) => x.email === e)) throw new AppError("email_taken");
    const invite = db.invites.find((i) => i.email === e);
    const role: Role = invite ? invite.role : "pending";
    if (invite) invite.accepted_at = now();
    const id = crypto.randomUUID();
    db.profiles.push({ id, display_name: name.trim().slice(0, 80) || e.split("@")[0], email: e, role, active: true, password_hash: hashSecret(password), created_at: now() });
    log(db, "system", id, "staff_signed_up", "profile", id, { role });
    return { role };
  });
}

// ---------- Groups and codes ----------
export function suggestGroup(p: Profile, year: number, month: number) {
  return read((db) => {
    const taken = db.groups.filter((g) => g.year === year && g.month === month).map((g) => g.letter);
    let letter: string | null;
    if (db.settings.group_letter_rule.first_without_letter) letter = nextGroupLetter(taken);
    else letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => !taken.includes(l)) ?? null;
    void p;
    return { letter, taken: taken.map((l) => l ?? ""), prefix: groupPrefix(year, month, letter) };
  });
}

export function previewCodes(year: number, month: number, letter: string | null, names: string[], startAt = 1) {
  return names.map((nickname, i) => ({ nickname, number: startAt + i, code: buildStudentCode({ year, month, letter, number: startAt + i }), pin: generatePin() }));
}

function insertStudents(db: Db, g: Group, students: { nickname: string; pin?: string }[]) {
  const out: { id: string; number: number; code: string; nickname: string; pin: string }[] = [];
  for (const s of students) {
    const nickname = s.nickname.trim().slice(0, 40);
    if (!nickname) continue;
    const pin = s.pin && !isTrivialPin(s.pin) ? s.pin : generatePin();
    const number = g.next_number;
    const code = buildStudentCode({ year: g.year, month: g.month, letter: g.letter, number });
    if (db.students.some((x) => x.code === code)) throw new AppError("code_conflict");
    const id = crypto.randomUUID();
    db.students.push({ id, group_id: g.id, number, code, nickname, avatar: "orbita", status: "active", pin_hash: hashSecret(pin), failed_attempts: 0, locked_until: null, hard_locked: false, guardian_consent: false, consent_reference: null, consent_recorded_at: null, last_active_at: null, created_at: now() });
    out.push({ id, number, code, nickname, pin });
    g.next_number += 1;
  }
  return out;
}

export function createGroup(p: Profile, input: { year: number; month: number; letter: string | null; communityId: string; endsOn: string | null; label: string; students: { nickname: string; pin?: string }[] }) {
  return write((db) => {
    const letter = input.letter ? input.letter.trim().toUpperCase() : null;
    if (letter && !/^[A-Z]$/.test(letter)) throw new AppError("invalid_letter");
    if (db.groups.some((g) => g.year === input.year && g.month === input.month && (g.letter ?? "") === (letter ?? ""))) throw new AppError("group_prefix_taken");
    if (!db.communities.some((c) => c.id === input.communityId)) throw new AppError("invalid_community");
    if (!input.students.length) throw new AppError("no_students");
    const g: Group = { id: crypto.randomUUID(), year: input.year, month: input.month, letter, community_id: input.communityId, label: input.label.slice(0, 80), status: "active", ends_on: input.endsOn || null, next_number: 1, created_by: p.id, created_at: now(), closed_at: null };
    db.groups.push(g);
    db.educator_groups.push({ educator_id: p.id, group_id: g.id, assigned_at: now() });
    db.courses.filter((c) => c.status === "published").forEach((c, i) => db.group_courses.push({ group_id: g.id, course_id: c.id, position: i }));
    const students = insertStudents(db, g, input.students);
    staffLog(db, p, "group_created", "group", g.id, { prefix: groupPrefix(g.year, g.month, g.letter), students: students.length });
    return { group_id: g.id, prefix: groupPrefix(g.year, g.month, g.letter), students };
  });
}

export function addStudents(p: Profile, groupId: string, students: { nickname: string; pin?: string }[]) {
  return write((db) => {
    const g = requireGroup(db, p, groupId);
    const out = insertStudents(db, g, students);
    staffLog(db, p, "students_added", "group", g.id, { count: out.length });
    return out;
  });
}

export function resetPin(p: Profile, studentId: string) {
  return write((db) => {
    const s = requireStudent(db, p, studentId);
    const pin = generatePin();
    Object.assign(s, { pin_hash: hashSecret(pin), failed_attempts: 0, locked_until: null, hard_locked: false });
    db.sessions.filter((x) => x.kind === "student" && x.subject_id === s.id && !x.revoked_at).forEach((x) => (x.revoked_at = now()));
    staffLog(db, p, "pin_reset", "student", s.id, { code: s.code });
    return { id: s.id, code: s.code, nickname: s.nickname, pin };
  });
}

export function unlockStudent(p: Profile, studentId: string) {
  return write((db) => {
    const s = requireStudent(db, p, studentId);
    Object.assign(s, { failed_attempts: 0, locked_until: null, hard_locked: false });
    staffLog(db, p, "student_unlocked", "student", s.id, { code: s.code });
  });
}

export function setStudentsStatus(p: Profile, ids: string[], status: "active" | "inactive") {
  return write((db) => {
    let n = 0;
    for (const id of ids) {
      const s = requireStudent(db, p, id);
      if (s.status === status) continue;
      s.status = status;
      n++;
      if (status === "inactive") db.sessions.filter((x) => x.kind === "student" && x.subject_id === s.id && !x.revoked_at).forEach((x) => (x.revoked_at = now()));
      staffLog(db, p, status === "active" ? "code_activated" : "code_deactivated", "student", s.id, { code: s.code });
    }
    return n;
  });
}

export function setGroupStatus(p: Profile, groupId: string, status: "active" | "closed") {
  return write((db) => {
    const g = requireGroup(db, p, groupId);
    g.status = status;
    g.closed_at = status === "closed" ? now() : null;
    for (const s of db.students.filter((x) => x.group_id === g.id)) {
      s.status = status === "closed" ? "inactive" : "active";
      if (status === "closed") db.sessions.filter((x) => x.kind === "student" && x.subject_id === s.id && !x.revoked_at).forEach((x) => (x.revoked_at = now()));
    }
    staffLog(db, p, status === "closed" ? "group_closed" : "group_reopened", "group", g.id);
  });
}

export function updateGroup(p: Profile, groupId: string, label: string, endsOn: string | null) {
  return write((db) => {
    const g = requireGroup(db, p, groupId);
    g.label = label.slice(0, 80);
    g.ends_on = endsOn || null;
    staffLog(db, p, "group_updated", "group", g.id, { ends_on: g.ends_on });
  });
}

export function assignCourse(p: Profile, groupId: string, courseId: string, assign: boolean) {
  return write((db) => {
    const g = requireGroup(db, p, groupId);
    if (assign) {
      if (!db.group_courses.some((x) => x.group_id === g.id && x.course_id === courseId))
        db.group_courses.push({ group_id: g.id, course_id: courseId, position: db.group_courses.filter((x) => x.group_id === g.id).length });
    } else db.group_courses = db.group_courses.filter((x) => !(x.group_id === g.id && x.course_id === courseId));
    staffLog(db, p, assign ? "course_assigned" : "course_unassigned", "group", g.id, { course_id: courseId });
  });
}

export function recordConsent(p: Profile, studentId: string, consent: boolean, reference: string) {
  return write((db) => {
    const s = requireStudent(db, p, studentId);
    Object.assign(s, { guardian_consent: consent, consent_reference: reference.trim() || null, consent_recorded_at: now() });
    staffLog(db, p, "consent_recorded", "student", s.id, { consent });
  });
}

export function addNote(p: Profile, studentId: string, body: string) {
  if (!body.trim()) throw new AppError("invalid_note");
  return write((db) => {
    const s = requireStudent(db, p, studentId);
    db.notes.push({ id: crypto.randomUUID(), student_id: s.id, author_id: p.id, body: body.trim().slice(0, 4000), created_at: now() });
  });
}

// ---------- Read models ----------
function studentStats(db: Db, id: string) {
  return {
    lessons_completed: db.lesson_progress.filter((x) => x.student_id === id && x.status === "completed").length,
    exercises_passed: db.exercise_progress.filter((x) => x.student_id === id && x.passed).length,
    attempts: db.attempts.filter((x) => x.student_id === id).length,
    ...totals(db, id),
  };
}

export function groupSummary(db: Db, g: Group) {
  const students = db.students.filter((s) => s.group_id === g.id);
  const lessonsTotal = db.group_courses.filter((gc) => gc.group_id === g.id).reduce((a, gc) => a + courseOrder(db, gc.course_id).length, 0);
  const avg = students.length ? students.reduce((a, s) => a + db.lesson_progress.filter((x) => x.student_id === s.id && x.status === "completed").length, 0) / students.length : 0;
  return {
    id: g.id,
    prefix: groupPrefix(g.year, g.month, g.letter),
    year: g.year,
    month: g.month,
    letter: g.letter,
    label: g.label,
    status: g.status,
    ends_on: g.ends_on,
    created_at: g.created_at,
    community: db.communities.find((c) => c.id === g.community_id)?.name ?? "",
    community_id: g.community_id,
    recreo_enabled: g.recreo_enabled !== false,
    students: students.length,
    active_students: students.filter((s) => s.status === "active").length,
    lessons_total: lessonsTotal,
    avg_completed: Math.round(avg * 10) / 10,
    educators: db.educator_groups.filter((eg) => eg.group_id === g.id).map((eg) => ({ id: eg.educator_id, name: db.profiles.find((x) => x.id === eg.educator_id)?.display_name ?? "" })),
  };
}
export type GroupSummary = ReturnType<typeof groupSummary>;

export function listGroups(p: Profile) {
  return read((db) => db.groups.filter((g) => canSeeGroup(db, p, g.id)).sort((a, b) => b.year - a.year || b.month - a.month || (a.letter ?? "").localeCompare(b.letter ?? "")).map((g) => groupSummary(db, g)));
}

export function dashboard(p: Profile) {
  return read((db) => {
    // Founders see every group (tech spec 4.2); educators only their assignments.
    const mine = db.groups.filter((g) => canSeeGroup(db, p, g.id));
    const mineIds = new Set(mine.map((g) => g.id));
    const students = db.students.filter((s) => mineIds.has(s.group_id));
    const sid = new Set(students.map((s) => s.id));
    const weekAgo = Date.now() - 7 * 86400_000;
    const twoWeeks = Date.now() - 14 * 86400_000;
    const nick = (id: string) => db.students.find((s) => s.id === id)?.nickname ?? "";
    const recent = [
      ...db.lesson_progress.filter((x) => sid.has(x.student_id) && x.status === "completed" && x.completed_at && Date.parse(x.completed_at) > twoWeeks)
        .map((x) => ({ kind: "lesson_completed", student_id: x.student_id, nickname: nick(x.student_id), title: db.lessons.find((l) => l.id === x.lesson_id)?.title ?? "", at: x.completed_at! })),
      ...db.projects.filter((x) => sid.has(x.student_id) && Date.parse(x.created_at) > twoWeeks)
        .map((x) => ({ kind: "project_created", student_id: x.student_id, nickname: nick(x.student_id), title: x.name, at: x.created_at })),
      ...db.accomplishments.filter((x) => x.student_id && sid.has(x.student_id) && x.status === "nominated")
        .map((x) => ({ kind: "nomination", student_id: x.student_id!, nickname: nick(x.student_id!), title: x.title, at: x.nominated_at })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
    return {
      groups: mine.filter((g) => g.status === "active").map((g) => groupSummary(db, g)),
      inactive: students.filter((s) => s.status === "active" && (!s.last_active_at || Date.parse(s.last_active_at) < weekAgo)).slice(0, 12)
        .map((s) => { const g = db.groups.find((x) => x.id === s.group_id)!; return { id: s.id, nickname: s.nickname, code: s.code, last_active_at: s.last_active_at, prefix: groupPrefix(g.year, g.month, g.letter) }; }),
      locked: students.filter((s) => s.hard_locked || (s.locked_until && Date.parse(s.locked_until) > Date.now())).map((s) => ({ id: s.id, nickname: s.nickname, code: s.code, hard_locked: s.hard_locked })),
      recent,
      totals: { students: students.length, active_week: students.filter((s) => s.last_active_at && Date.parse(s.last_active_at) > weekAgo).length },
    };
  });
}

export function groupDetail(p: Profile, groupId: string) {
  return read((db) => {
    const g = db.groups.find((x) => x.id === groupId);
    if (!g || !canSeeGroup(db, p, g.id)) return null;
    const students = db.students.filter((s) => s.group_id === g.id).sort((a, b) => a.number - b.number);
    const sids = new Set(students.map((s) => s.id));
    const courses = db.group_courses.filter((gc) => gc.group_id === g.id).sort((a, b) => a.position - b.position).map((gc) => db.courses.find((c) => c.id === gc.course_id)!).filter(Boolean);
    const report = courses.flatMap((c) =>
      courseOrder(db, c.id).flatMap((l) =>
        db.exercises.filter((e) => e.lesson_id === l.id).sort((a, b) => a.position - b.position).map((e) => {
          const ep = db.exercise_progress.filter((x) => x.exercise_id === e.id && sids.has(x.student_id) && x.attempts > 0);
          const errs = new Map<string, number>();
          db.attempts.filter((a) => a.exercise_id === e.id && sids.has(a.student_id) && a.error_type).forEach((a) => errs.set(a.error_type!, (errs.get(a.error_type!) ?? 0) + 1));
          const top = [...errs.entries()].sort((a, b) => b[1] - a[1])[0];
          return {
            exercise_id: e.id, title: e.title, lesson: l.title, language: l.language,
            attempted: ep.length, passed: ep.filter((x) => x.passed).length,
            avg_attempts: ep.length ? Math.round((ep.reduce((a, x) => a + x.attempts, 0) / ep.length) * 10) / 10 : null,
            avg_hints: ep.length ? Math.round((ep.reduce((a, x) => a + x.hints_used, 0) / ep.length) * 10) / 10 : null,
            top_error: top?.[0] ?? null,
          };
        }),
      ),
    );
    return {
      ...groupSummary(db, g),
      roster: students.map((s) => ({
        id: s.id, number: s.number, code: s.code, nickname: s.nickname, status: s.status, last_active_at: s.last_active_at, failed_attempts: s.failed_attempts,
        locked: s.hard_locked || (!!s.locked_until && Date.parse(s.locked_until) > Date.now()), hard_locked: s.hard_locked, consent: s.guardian_consent, ...studentStats(db, s.id),
      })),
      courses: courses.map((c) => ({ id: c.id, title: c.title, slug: c.slug })),
      available_courses: db.courses.filter((c) => c.status === "published" && !courses.some((x) => x.id === c.id)).map((c) => ({ id: c.id, title: c.title, slug: c.slug })),
      exercise_report: report,
    };
  });
}
export type GroupDetail = NonNullable<ReturnType<typeof groupDetail>>;

export function studentDetail(p: Profile, studentId: string) {
  return write((db) => {
    const s = db.students.find((x) => x.id === studentId);
    if (!s || !canSeeGroup(db, p, s.group_id)) return null;
    const g = db.groups.find((x) => x.id === s.group_id)!;
    if (p.role === "founder" && !db.educator_groups.some((eg) => eg.group_id === g.id && eg.educator_id === p.id)) staffLog(db, p, "founder_viewed_student", "student", s.id, { code: s.code });
    const courses = db.group_courses.filter((gc) => gc.group_id === g.id).sort((a, b) => a.position - b.position);
    const errs = new Map<string, number>();
    db.attempts.filter((a) => a.student_id === s.id && a.error_type).forEach((a) => errs.set(a.error_type!, (errs.get(a.error_type!) ?? 0) + 1));
    return {
      id: s.id, code: s.code, nickname: s.nickname, avatar: s.avatar, status: s.status, number: s.number, last_active_at: s.last_active_at, created_at: s.created_at,
      locked: s.hard_locked || (!!s.locked_until && Date.parse(s.locked_until) > Date.now()), hard_locked: s.hard_locked,
      consent: { given: s.guardian_consent, reference: s.consent_reference, recorded_at: s.consent_recorded_at },
      group: groupSummary(db, g),
      stats: studentStats(db, s.id),
      lessons: courses.flatMap((gc) => courseOrder(db, gc.course_id).map((l) => ({ slug: l.slug, title: l.title, language: l.language, status: lessonStatus(db, s.id, l.id) }))),
      exercises: db.exercise_progress.filter((x) => x.student_id === s.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((x) => {
        const e = db.exercises.find((y) => y.id === x.exercise_id);
        const last = db.attempts.filter((a) => a.student_id === s.id && a.exercise_id === x.exercise_id && a.error_type).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        return { exercise_id: x.exercise_id, title: e?.title ?? "", lesson: db.lessons.find((l) => l.id === e?.lesson_id)?.title ?? "", passed: x.passed, attempts: x.attempts, hints_used: x.hints_used, last_error: last?.error_type ?? null };
      }),
      attempts: db.attempts.filter((a) => a.student_id === s.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30)
        .map((a) => ({ id: a.id, created_at: a.created_at, passed: a.passed, error_type: a.error_type, exercise: db.exercises.find((e) => e.id === a.exercise_id)?.title ?? "", submission: a.submission })),
      errors: [...errs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([type, count]) => ({ type, count })),
      projects: db.projects.filter((x) => x.student_id === s.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((x) => ({ id: x.id, name: x.name, language: x.language, updated_at: x.updated_at })),
      notes: db.notes.filter((n) => n.student_id === s.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((n) => ({ id: n.id, body: n.body, created_at: n.created_at, author: db.profiles.find((x) => x.id === n.author_id)?.display_name ?? "" })),
    };
  });
}
export type StudentDetail = NonNullable<ReturnType<typeof studentDetail>>;

export function staffProject(p: Profile, projectId: string) {
  return write((db) => {
    const pr = db.projects.find((x) => x.id === projectId);
    if (!pr) return null;
    const s = db.students.find((x) => x.id === pr.student_id);
    if (!s || !canSeeGroup(db, p, s.group_id)) return null;
    if (p.role === "founder" && !db.educator_groups.some((eg) => eg.group_id === s.group_id && eg.educator_id === p.id)) staffLog(db, p, "founder_viewed_project", "project", pr.id);
    const nom = db.accomplishments.find((a) => a.project_id === pr.id);
    return { ...pr, student: { id: s.id, nickname: s.nickname, code: s.code }, nomination: nom ? { id: nom.id, status: nom.status } : null };
  });
}

export function exportStudent(p: Profile, studentId: string) {
  return write((db) => {
    const s = requireStudent(db, p, studentId);
    staffLog(db, p, "student_exported", "student", s.id, { code: s.code });
    const strip = <T extends { student_id?: string }>(rows: T[]) => rows.filter((r) => r.student_id === s.id).map(({ student_id: _omit, ...rest }) => rest);
    return {
      student: { code: s.code, nickname: s.nickname, avatar: s.avatar, status: s.status, created_at: s.created_at, guardian_consent: s.guardian_consent },
      progress: strip(db.lesson_progress), exercises: strip(db.exercise_progress), attempts: strip(db.attempts), xp: strip(db.xp_events),
      projects: strip(db.projects), accomplishments: db.accomplishments.filter((a) => a.student_id === s.id),
    };
  });
}

export function deleteStudent(p: Profile, studentId: string, confirm: string) {
  return write((db) => {
    const s = requireStudent(db, p, studentId);
    if (confirm.trim().toUpperCase() !== s.code) throw new AppError("confirmation_required");
    const projects = new Set(db.projects.filter((x) => x.student_id === s.id).map((x) => x.id));
    for (const key of ["lesson_progress", "exercise_progress", "attempts", "xp_events", "streaks", "projects", "notes"] as const)
      (db[key] as { student_id: string }[]) = (db[key] as { student_id: string }[]).filter((r) => r.student_id !== s.id);
    db.project_versions = db.project_versions.filter((v) => !projects.has(v.project_id));
    db.accomplishments = db.accomplishments.filter((a) => a.student_id !== s.id);
    db.sessions = db.sessions.filter((x) => !(x.kind === "student" && x.subject_id === s.id));
    db.students = db.students.filter((x) => x.id !== s.id);
    staffLog(db, p, "student_deleted", "student", s.id, { code: s.code });
  });
}

// ---------- Logros ----------
export function listLogros(p: Profile) {
  return read((db) =>
    db.accomplishments
      .filter((a) => p.role === "founder" || (a.student_id && canSeeGroup(db, p, db.students.find((s) => s.id === a.student_id)?.group_id ?? "")))
      .sort((a, b) => b.nominated_at.localeCompare(a.nominated_at))
      .map((a) => {
        const s = a.student_id ? db.students.find((x) => x.id === a.student_id) : null;
        return { ...a, community: db.communities.find((c) => c.id === a.community_id)?.name ?? null, student: s ? { id: s.id, code: s.code, consent: s.guardian_consent } : null };
      }),
  );
}

export function nominate(p: Profile, input: { studentId: string; projectId: string | null; kind: AccomplishmentKind; title: string; blurb: string; tags: string[] }) {
  return write((db) => {
    const s = requireStudent(db, p, input.studentId);
    const g = db.groups.find((x) => x.id === s.group_id)!;
    const pr = input.projectId ? db.projects.find((x) => x.id === input.projectId && x.student_id === s.id) : null;
    if (input.projectId && !pr) throw new AppError("project_not_found");
    if (!input.title.trim()) throw new AppError("invalid_name");
    const id = crypto.randomUUID();
    db.accomplishments.push({
      id, student_id: s.id, project_id: pr?.id ?? null, kind: input.kind, title: input.title.trim().slice(0, 120), blurb: input.blurb.slice(0, 600), tags: input.tags.slice(0, 6),
      language: (pr?.language ?? null) as CodeLanguage | null, code: pr?.code ?? null, display_name: s.nickname, community_id: g.community_id, year: g.year, status: "nominated",
      featured: false, is_sample: false, nominated_by_student: false, nominated_by: p.id, nominated_at: now(), reviewed_at: null, published_at: null,
    });
    staffLog(db, p, "logro_nominated", "accomplishment", id);
    return id;
  });
}

export function updateNomination(p: Profile, id: string, input: { title: string; blurb: string; tags: string[]; kind: AccomplishmentKind }) {
  return write((db) => {
    const a = db.accomplishments.find((x) => x.id === id);
    if (!a) throw new AppError("not_found");
    const s = a.student_id ? db.students.find((x) => x.id === a.student_id) : null;
    if (p.role !== "founder" && !(s && canSeeGroup(db, p, s.group_id))) throw new AppError("forbidden");
    Object.assign(a, { title: input.title.trim().slice(0, 120) || a.title, blurb: input.blurb.slice(0, 600), tags: input.tags.slice(0, 6), kind: input.kind });
  });
}

export function reviewLogro(p: Profile, id: string, action: "approve" | "publish" | "unpublish" | "reject" | "feature" | "unfeature" | "delete") {
  return write((db) => {
    founderOnly(p);
    const a = db.accomplishments.find((x) => x.id === id);
    if (!a) throw new AppError("not_found");
    const consent = a.student_id ? db.students.find((s) => s.id === a.student_id)?.guardian_consent : false;
    switch (action) {
      case "approve": a.status = "approved"; a.reviewed_at = now(); break;
      case "publish":
        if (!a.is_sample && !consent) throw new AppError("consent_required");
        a.status = "published"; a.published_at ??= now(); a.reviewed_at = now(); break;
      case "unpublish": a.status = "unpublished"; a.featured = false; break;
      case "reject": a.status = "rejected"; a.featured = false; break;
      case "feature": if (a.status !== "published") throw new AppError("not_published"); db.accomplishments.forEach((x) => (x.featured = false)); a.featured = true; break;
      case "unfeature": a.featured = false; break;
      case "delete": db.accomplishments = db.accomplishments.filter((x) => x.id !== id); break;
    }
    staffLog(db, p, `logro_${action}`, "accomplishment", id, { title: a.title });
  });
}

// ---------- Founders ----------
export function staffDirectory(p: Profile) {
  return read((db) => {
    founderOnly(p);
    return {
      staff: db.profiles.map((x) => ({ id: x.id, name: x.display_name, email: x.email, role: x.role, active: x.active, created_at: x.created_at,
        groups: db.educator_groups.filter((eg) => eg.educator_id === x.id).map((eg) => { const g = db.groups.find((y) => y.id === eg.group_id)!; return { id: g.id, prefix: groupPrefix(g.year, g.month, g.letter) }; }) })),
      invites: db.invites,
      groups: db.groups.map((g) => ({ id: g.id, prefix: groupPrefix(g.year, g.month, g.letter), status: g.status })),
    };
  });
}

export function invite(p: Profile, email: string, role: "educator" | "founder") {
  return write((db) => {
    founderOnly(p);
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new AppError("invalid_email");
    const existing = db.invites.find((i) => i.email === e);
    if (existing) Object.assign(existing, { role, invited_by: p.id });
    else db.invites.push({ email: e, role, invited_by: p.id, created_at: now(), accepted_at: null });
    const prof = db.profiles.find((x) => x.email === e && x.role === "pending");
    if (prof) prof.role = role;
    staffLog(db, p, "staff_invited", "invite", null, { email: e, role });
  });
}

export function setStaff(p: Profile, profileId: string, role: Role, active: boolean, confirm: string) {
  return write((db) => {
    founderOnly(p);
    const x = db.profiles.find((y) => y.id === profileId);
    if (!x) throw new AppError("not_found");
    if (role === "founder" && x.role !== "founder" && confirm !== "CONFIRMAR") throw new AppError("confirmation_required");
    if (x.role === "founder" && x.active && (role !== "founder" || !active) && db.profiles.filter((y) => y.role === "founder" && y.active && y.id !== x.id).length === 0) throw new AppError("last_founder");
    staffLog(db, p, "staff_changed", "profile", x.id, { from_role: x.role, to_role: role, from_active: x.active, to_active: active });
    x.role = role;
    x.active = active;
    if (!active) db.sessions.filter((s) => s.kind === "staff" && s.subject_id === x.id && !s.revoked_at).forEach((s) => (s.revoked_at = now()));
  });
}

export function assignGroup(p: Profile, educatorId: string, groupId: string, assign: boolean) {
  return write((db) => {
    founderOnly(p);
    if (assign && !db.educator_groups.some((eg) => eg.educator_id === educatorId && eg.group_id === groupId)) db.educator_groups.push({ educator_id: educatorId, group_id: groupId, assigned_at: now() });
    if (!assign) db.educator_groups = db.educator_groups.filter((eg) => !(eg.educator_id === educatorId && eg.group_id === groupId));
    staffLog(db, p, assign ? "group_assigned" : "group_unassigned", "group", groupId, { educator: educatorId });
  });
}

export function reassignGroups(p: Profile, from: string, to: string) {
  return write((db) => {
    founderOnly(p);
    const moving = db.educator_groups.filter((eg) => eg.educator_id === from);
    for (const eg of moving) if (!db.educator_groups.some((x) => x.educator_id === to && x.group_id === eg.group_id)) db.educator_groups.push({ educator_id: to, group_id: eg.group_id, assigned_at: now() });
    db.educator_groups = db.educator_groups.filter((eg) => eg.educator_id !== from);
    staffLog(db, p, "groups_reassigned", "profile", from, { to, count: moving.length });
    return moving.length;
  });
}

export function settings(p: Profile) {
  return read((db) => {
    founderOnly(p);
    return { settings: db.settings, communities: db.communities };
  });
}

export function updateSettings(p: Profile, patch: Partial<Settings>) {
  return write((db) => {
    founderOnly(p);
    db.settings = { ...db.settings, ...patch };
    staffLog(db, p, "setting_changed", "setting", null, { keys: Object.keys(patch) });
  });
}

export function upsertCommunity(p: Profile, input: { id?: string; name: string; since_year: number | null; active: boolean }) {
  return write((db) => {
    founderOnly(p);
    const name = input.name.trim();
    if (!name) throw new AppError("invalid_name");
    const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const existing = input.id ? db.communities.find((c) => c.id === input.id) : null;
    if (existing) Object.assign(existing, { name, since_year: input.since_year, active: input.active });
    else db.communities.push({ id: crypto.randomUUID(), slug, name, state: "Estado de México", since_year: input.since_year, position: db.communities.length + 1, active: input.active });
    staffLog(db, p, "community_saved", "community", existing?.id ?? null, { name });
  });
}

export function stats(p: Profile) {
  return read((db) => {
    founderOnly(p);
    const week = Date.now() - 7 * 86400_000;
    const byLang: Record<string, number> = {};
    db.lesson_progress.filter((x) => x.status === "completed").forEach((x) => { const l = db.lessons.find((y) => y.id === x.lesson_id); if (l) byLang[l.language] = (byLang[l.language] ?? 0) + 1; });
    return {
      students: db.students.length, active_students: db.students.filter((s) => s.status === "active").length,
      active_week: db.students.filter((s) => s.last_active_at && Date.parse(s.last_active_at) > week).length,
      groups: db.groups.length, active_groups: db.groups.filter((g) => g.status === "active").length,
      educators: db.profiles.filter((x) => x.active && x.role !== "pending").length,
      lessons_completed: db.lesson_progress.filter((x) => x.status === "completed").length,
      exercises_passed: db.exercise_progress.filter((x) => x.passed).length, projects: db.projects.length,
      logros_published: db.accomplishments.filter((a) => a.status === "published" && !a.is_sample).length,
      nominations_pending: db.accomplishments.filter((a) => a.status === "nominated" || a.status === "approved").length,
      by_community: db.communities.map((c) => { const gs = db.groups.filter((g) => g.community_id === c.id); return { name: c.name, groups: gs.length, students: db.students.filter((s) => gs.some((g) => g.id === s.group_id)).length }; }),
      by_language: byLang,
    };
  });
}

export function audit(p: Profile, limit = 150) {
  return read((db) => {
    founderOnly(p);
    const name = (id: string | null) => (id ? db.profiles.find((x) => x.id === id)?.display_name ?? db.students.find((s) => s.id === id)?.nickname ?? null : null);
    return [...db.access_log.map((a) => ({ ...a, source: "access" })), ...db.content_audit_log.map((a) => ({ ...a, source: "content" }))]
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map((a) => ({ ...a, actor: name(a.actor_id) }));
  });
}

export function search(p: Profile, q: string) {
  return read((db) => {
    founderOnly(p);
    const t = q.trim().toLowerCase();
    if (!t) return { students: [], projects: [], lessons: [] };
    return {
      students: db.students.filter((s) => s.code.toLowerCase().includes(t) || s.nickname.toLowerCase().includes(t)).slice(0, 20).map((s) => ({ id: s.id, code: s.code, nickname: s.nickname })),
      projects: db.projects.filter((x) => x.name.toLowerCase().includes(t)).slice(0, 20).map((x) => ({ id: x.id, name: x.name, language: x.language, student: db.students.find((s) => s.id === x.student_id)?.nickname ?? "" })),
      lessons: db.lessons.filter((l) => l.title.toLowerCase().includes(t) || l.slug.includes(t)).slice(0, 20).map((l) => ({ id: l.id, slug: l.slug, title: l.title, status: l.status, visibility: l.visibility, language: l.language })),
    };
  });
}

// ---------- Content authoring ----------
export function canEditLesson(p: Profile, l: Lesson) {
  return p.role === "founder" || l.created_by === p.id;
}

export function lessonLibrary(p: Profile) {
  return read((db) => ({
    courses: db.courses.map((c) => ({ ...c, modules: db.modules.filter((m) => m.course_id === c.id) })),
    lessons: db.lessons
      .filter((l) => p.role === "founder" || l.status === "published" || l.created_by === p.id)
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        id: l.id, slug: l.slug, title: l.title, language: l.language, visibility: l.visibility, status: l.status, updated_at: l.updated_at,
        course: l.module_id ? db.courses.find((c) => c.id === db.modules.find((m) => m.id === l.module_id)?.course_id)?.title ?? null : null,
        exercises: db.exercises.filter((e) => e.lesson_id === l.id).length,
        pair: l.pair_lesson_id ? db.lessons.find((x) => x.id === l.pair_lesson_id)?.title ?? null : null,
        editable: canEditLesson(p, l),
      })),
  }));
}

export function lessonForEdit(p: Profile, id: string) {
  return read((db) => {
    const l = db.lessons.find((x) => x.id === id);
    if (!l || !(p.role === "founder" || l.status === "published" || l.created_by === p.id)) return null;
    return {
      lesson: l,
      editable: canEditLesson(p, l),
      exercises: db.exercises.filter((e) => e.lesson_id === l.id).sort((a, b) => a.position - b.position),
      deck: db.decks.find((d) => d.lesson_id === l.id) ?? null,
      modules: db.modules.map((m) => ({ id: m.id, title: m.title, course: db.courses.find((c) => c.id === m.course_id)?.title ?? "" })),
      otherLessons: db.lessons.filter((x) => x.id !== l.id && x.language !== l.language).map((x) => ({ id: x.id, title: x.title, language: x.language })),
    };
  });
}

function contentLog(db: Db, p: Profile, action: string, type: string, id: string, payload: Record<string, unknown> = {}) {
  db.content_audit_log.push({ id: nextSeq(db), actor_kind: "staff", actor_id: p.id, action, entity_type: type, entity_id: id, payload, created_at: now() });
}

export function createLesson(p: Profile, input: { title: string; slug: string; language: CodeLanguage; visibility: "public" | "program" | "draft"; module_id: string | null }) {
  return write((db) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new AppError("invalid_slug");
    if (db.lessons.some((l) => l.slug === input.slug)) throw new AppError("already_exists");
    if (input.visibility === "program" && !input.module_id) throw new AppError("program_needs_module");
    const id = crypto.randomUUID();
    db.lessons.push({
      id, module_id: input.module_id, slug: input.slug, title: input.title.trim().slice(0, 160), summary: "", content_md: "", language: input.language, visibility: input.visibility,
      pair_lesson_id: null, position: db.lessons.filter((l) => l.module_id === input.module_id).length + 1, estimated_minutes: 15, xp_reward: 20, status: "draft", version: 1, created_by: p.id, updated_at: now(),
    });
    contentLog(db, p, "create", "lesson", id, { slug: input.slug });
    return id;
  });
}

export function updateLesson(p: Profile, id: string, patch: Partial<Pick<Lesson, "title" | "summary" | "content_md" | "visibility" | "pair_lesson_id" | "estimated_minutes" | "xp_reward" | "module_id" | "language">>, expectedVersion?: number) {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === id);
    if (!l || !canEditLesson(p, l)) throw new AppError("forbidden");
    if (expectedVersion !== undefined && expectedVersion !== l.version) throw new AppError("version_conflict");
    if (patch.language && patch.language !== l.language && db.exercises.some((e) => e.lesson_id === l.id && e.solution.validated_fingerprint)) throw new AppError("language_locked");
    if ((patch.visibility ?? l.visibility) === "public" && l.status === "published" && p.role !== "founder") throw new AppError("founder_publishes_public");
    if (patch.module_id !== undefined && patch.module_id !== l.module_id) moveLessonIn(db, p, l.id, patch.module_id);
    const { module_id: _m, ...rest } = patch;
    Object.assign(l, rest);
    l.version += 1;
    l.updated_at = now();
    contentLog(db, p, "update", "lesson", id, { fields: Object.keys(patch) });
    return l.version;
  });
}

export function setLessonStatus(p: Profile, id: string, status: Lesson["status"]) {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === id);
    if (!l || !canEditLesson(p, l)) throw new AppError("forbidden");
    if (status === "published" && l.visibility === "public" && p.role !== "founder") throw new AppError("founder_publishes_public");
    l.status = status;
    l.version += 1;
    l.updated_at = now();
    contentLog(db, p, "set_status", "lesson", id, { status });
    if (status === "published") staffLog(db, p, "content_published", "lesson", id);
  });
}

export function saveExercise(p: Profile, lessonId: string, input: Omit<Exercise, "id" | "lesson_id" | "position" | "version"> & { id?: string; validated: boolean; fingerprint: string | null }) {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === lessonId);
    if (!l || !canEditLesson(p, l)) throw new AppError("forbidden");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new AppError("invalid_slug");
    let ex = input.id ? db.exercises.find((e) => e.id === input.id && e.lesson_id === lessonId) : undefined;
    const solution = { ...input.solution, validated_at: input.validated ? now() : null, validated_fingerprint: input.validated ? input.fingerprint : null };
    if (!ex) {
      if (db.exercises.some((e) => e.lesson_id === lessonId && e.slug === input.slug)) throw new AppError("already_exists");
      ex = { ...input, id: crypto.randomUUID(), lesson_id: lessonId, position: db.exercises.filter((e) => e.lesson_id === lessonId).length + 1, version: 1, solution };
      db.exercises.push(ex);
      contentLog(db, p, "create", "exercise", ex.id, { slug: input.slug });
    } else {
      Object.assign(ex, { ...input, id: ex.id, lesson_id: lessonId, position: ex.position, version: ex.version + 1, solution });
      contentLog(db, p, "update", "exercise", ex.id, { slug: input.slug });
    }
    l.version += 1;
    l.updated_at = now();
    return ex.id;
  });
}

export function deleteExercise(p: Profile, lessonId: string, exerciseId: string) {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === lessonId);
    if (!l || !canEditLesson(p, l)) throw new AppError("forbidden");
    db.exercises = db.exercises.filter((e) => e.id !== exerciseId);
    db.exercises.filter((e) => e.lesson_id === lessonId).sort((a, b) => a.position - b.position).forEach((e, i) => (e.position = i + 1));
    contentLog(db, p, "archive", "exercise", exerciseId);
  });
}

export function reorderExercises(p: Profile, lessonId: string, ids: string[]) {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === lessonId);
    if (!l || !canEditLesson(p, l)) throw new AppError("forbidden");
    const mine = db.exercises.filter((e) => e.lesson_id === lessonId);
    if (mine.length !== ids.length || !mine.every((e) => ids.includes(e.id))) throw new AppError("ids_mismatch");
    ids.forEach((id, i) => (mine.find((e) => e.id === id)!.position = i + 1));
  });
}

export function duplicateLesson(p: Profile, id: string) {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === id);
    if (!l) throw new AppError("not_found");
    let slug = `${l.slug}-copia`;
    for (let i = 2; db.lessons.some((x) => x.slug === slug); i++) slug = `${l.slug}-copia-${i}`;
    const nid = crypto.randomUUID();
    db.lessons.push({ ...l, id: nid, slug, title: `${l.title} (copia)`, status: "draft", visibility: l.visibility === "public" ? "draft" : l.visibility, version: 1, created_by: p.id, pair_lesson_id: null, updated_at: now() });
    for (const e of db.exercises.filter((x) => x.lesson_id === id)) db.exercises.push({ ...structuredClone(e), id: crypto.randomUUID(), lesson_id: nid, version: 1 });
    contentLog(db, p, "duplicate", "lesson", nid, { from: id });
    return nid;
  });
}

export function saveDeck(p: Profile, lessonId: string, title: string, slides: unknown, status: "draft" | "published") {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === lessonId);
    if (!l || !canEditLesson(p, l)) throw new AppError("forbidden");
    const d = db.decks.find((x) => x.lesson_id === lessonId);
    if (d) Object.assign(d, { title, slides, status, version: d.version + 1 });
    else db.decks.push({ id: crypto.randomUUID(), lesson_id: lessonId, title, slides, status, version: 1 });
    contentLog(db, p, "save_deck", "slide_deck", lessonId);
  });
}

export function exportCourse(courseId: string) {
  return read((db) => {
    const c = db.courses.find((x) => x.id === courseId);
    if (!c) throw new AppError("not_found");
    const mods = db.modules.filter((m) => m.course_id === c.id);
    return {
      format: "codeher-course@1",
      course: c,
      modules: mods.map((m) => ({ ...m, lessons: db.lessons.filter((l) => l.module_id === m.id).map((l) => ({ ...l, exercises: db.exercises.filter((e) => e.lesson_id === l.id), deck: db.decks.find((d) => d.lesson_id === l.id) ?? null })) })),
    };
  });
}

export function errorCatalogAll() {
  return read((db) => db.error_translations);
}
export function saveErrorRow(p: Profile, row: { id?: string; language: CodeLanguage | null; error_type: string; pattern: string | null; message_es: string; explanation_es: string; suggestion_es: string; priority: number; enabled: boolean }) {
  return write((db) => {
    if (row.pattern) {
      try { new RegExp(row.pattern); } catch { throw new AppError("invalid_pattern"); }
    }
    const existing = row.id ? db.error_translations.find((e) => e.id === row.id) : null;
    if (existing) Object.assign(existing, row);
    else db.error_translations.push({ ...row, id: crypto.randomUUID() });
    contentLog(db, p, "save", "error_translation", existing?.id ?? "new", { error_type: row.error_type });
  });
}

// ---------- API keys for the MCP server ----------
export function createApiKey(p: Profile, name: string) {
  return write((db) => {
    const token = `chk_${randomToken(24)}`;
    const id = crypto.randomUUID();
    db.api_keys.push({ id, owner_id: p.id, name: name.trim().slice(0, 60) || "Claude", key_prefix: token.slice(0, 12), key_hash: sha256(token), created_at: now(), last_used_at: null, expires_at: new Date(Date.now() + 90 * 86400_000).toISOString(), revoked_at: null });
    staffLog(db, p, "api_key_created", "api_key", id);
    return { id, token };
  });
}
export function listApiKeys(p: Profile) {
  return read((db) => db.api_keys.filter((k) => k.owner_id === p.id).map(({ key_hash: _h, ...k }) => k));
}
export function revokeApiKey(p: Profile, id: string) {
  return write((db) => {
    const k = db.api_keys.find((x) => x.id === id && x.owner_id === p.id);
    if (k && !k.revoked_at) k.revoked_at = now();
    staffLog(db, p, "api_key_revoked", "api_key", id);
  });
}

export function profileFromApiKey(token: string): Profile | null {
  return write((db) => {
    const k = db.api_keys.find((x) => x.key_hash === sha256(token));
    if (!k || k.revoked_at || Date.parse(k.expires_at) < Date.now()) return null;
    const p = db.profiles.find((x) => x.id === k.owner_id && x.active && x.role !== "pending");
    if (!p) return null;
    k.last_used_at = now();
    return p;
  });
}

export function setGroupRecreo(p: Profile, groupId: string, enabled: boolean) {
  return write((db) => {
    const g = requireGroup(db, p, groupId);
    g.recreo_enabled = enabled;
    staffLog(db, p, "recreo_toggled", "group", g.id, { enabled });
  });
}

// ---------- Recreo libre (port of 0009_recreo_libre.sql) ----------
export function recreoFree(p: Profile, studentIds: string[], minutes: number) {
  return write((db) => {
    const until = minutes > 0 ? new Date(Date.now() + Math.min(minutes, 120) * 60_000).toISOString() : null;
    db.recreo ??= [];
    for (const id of studentIds) {
      const s = requireStudent(db, p, id);
      let r = db.recreo.find((x) => x.student_id === s.id);
      if (!r) db.recreo.push((r = { student_id: s.id, tickets: 0, lessons_credited: 0 }));
      r.free_until = until;
      r.free_by = p.id;
      if (!until) (db.recreo_sessions ?? []).filter((x) => x.student_id === s.id && x.free && Date.parse(x.ends_at) > Date.now()).forEach((x) => (x.ends_at = now()));
    }
    staffLog(db, p, until ? "recreo_free_granted" : "recreo_free_stopped", "student", null, { students: studentIds.length, minutes });
    return studentIds.length;
  });
}

export function groupRecreo(p: Profile, groupId: string) {
  return read((db) => {
    const g = requireGroup(db, p, groupId);
    const lessonIds = new Set(db.group_courses.filter((gc) => gc.group_id === g.id).flatMap((gc) => courseOrder(db, gc.course_id).map((l) => l.id)));
    return db.students
      .filter((s) => s.group_id === g.id && s.status === "active")
      .sort((a, b) => a.number - b.number)
      .map((s) => {
        const r = (db.recreo ?? []).find((x) => x.student_id === s.id);
        return {
          id: s.id, code: s.code, nickname: s.nickname, tickets: r?.tickets ?? 0,
          free_until: r?.free_until && Date.parse(r.free_until) > Date.now() ? r.free_until : null,
          playing: (db.recreo_sessions ?? []).some((x) => x.student_id === s.id && Date.parse(x.ends_at) > Date.now()),
          lessons_completed: db.lesson_progress.filter((x) => x.student_id === s.id && x.status === "completed" && lessonIds.has(x.lesson_id)).length,
          lessons_total: lessonIds.size,
        };
      });
  });
}

// ---------- Course authoring (mirrors 0010_course_authoring.sql) ----------
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}
export function canEditCourse(p: Profile, c: { created_by: string | null }) {
  return p.role === "founder" || c.created_by === p.id;
}
function lessonHasProgress(db: Db, lessonId: string) {
  const ex = new Set(db.exercises.filter((e) => e.lesson_id === lessonId).map((e) => e.id));
  return db.lesson_progress.some((x) => x.lesson_id === lessonId) || db.exercise_progress.some((x) => ex.has(x.exercise_id));
}
function renumberLessons(db: Db, moduleId: string) {
  db.lessons.filter((l) => l.module_id === moduleId).sort((a, b) => a.position - b.position).forEach((l, i) => (l.position = i + 1));
}
function renumberModules(db: Db, courseId: string) {
  db.modules.filter((m) => m.course_id === courseId).sort((a, b) => a.position - b.position).forEach((m, i) => (m.position = i + 1));
}
function purgeLesson(db: Db, id: string) {
  const ex = new Set(db.exercises.filter((e) => e.lesson_id === id).map((e) => e.id));
  db.lessons = db.lessons.filter((l) => l.id !== id);
  db.exercises = db.exercises.filter((e) => e.lesson_id !== id);
  db.decks = db.decks.filter((d) => d.lesson_id !== id);
  db.lesson_progress = db.lesson_progress.filter((x) => x.lesson_id !== id);
  db.exercise_progress = db.exercise_progress.filter((x) => !ex.has(x.exercise_id));
  db.attempts = db.attempts.filter((x) => !ex.has(x.exercise_id));
  for (const l of db.lessons) if (l.pair_lesson_id === id) l.pair_lesson_id = null;
  for (const pr of db.projects) if (pr.source_lesson_id === id) pr.source_lesson_id = null;
}
function releaseLessons(db: Db, p: Profile, moduleId: string, del: boolean) {
  let deleted = 0;
  let detached = 0;
  for (const l of db.lessons.filter((x) => x.module_id === moduleId)) {
    if (del && canEditLesson(p, l) && (p.role === "founder" || !lessonHasProgress(db, l.id))) {
      purgeLesson(db, l.id);
      contentLog(db, p, "delete", "lesson", l.id);
      deleted++;
    } else {
      if (l.visibility === "program") Object.assign(l, { visibility: "draft", status: "draft" });
      l.module_id = null;
      contentLog(db, p, "detach", "lesson", l.id, { module_id: moduleId });
      detached++;
    }
  }
  return { deleted, detached };
}
function courseOf(db: Db, id: string) {
  const c = db.courses.find((x) => x.id === id);
  if (!c) throw new AppError("not_found");
  return c;
}

export function courseList(p: Profile) {
  return read((db) =>
    db.courses
      .filter((c) => p.role === "founder" || c.status === "published" || c.created_by === p.id)
      .sort((a, b) => a.position - b.position)
      .map((c) => {
        const mods = db.modules.filter((m) => m.course_id === c.id);
        const lessons = db.lessons.filter((l) => mods.some((m) => m.id === l.module_id));
        return {
          id: c.id, slug: c.slug, title: c.title, description: c.description, status: c.status, editable: canEditCourse(p, c),
          modules: mods.length, lessons: lessons.length, published: courseOrder(db, c.id).length,
          languages: [...new Set(lessons.map((l) => l.language))],
          groups: db.group_courses.filter((g) => g.course_id === c.id).length,
        };
      }),
  );
}
export type CourseCard = ReturnType<typeof courseList>[number];

export function courseDetail(p: Profile, id: string) {
  return read((db) => {
    const c = db.courses.find((x) => x.id === id);
    if (!c || !(p.role === "founder" || c.status === "published" || c.created_by === p.id)) return null;
    const editable = canEditCourse(p, c);
    const visible = (l: Lesson) => p.role === "founder" || l.status === "published" || l.created_by === p.id;
    const mods = db.modules.filter((m) => m.course_id === c.id).sort((a, b) => a.position - b.position);
    const lessonIds = new Set(mods.flatMap((m) => db.lessons.filter((l) => l.module_id === m.id).map((l) => l.id)));
    return {
      course: { id: c.id, slug: c.slug, title: c.title, description: c.description, status: c.status, created_by: c.created_by },
      editable,
      usage: {
        groups: db.group_courses.filter((g) => g.course_id === c.id).length,
        students: new Set(db.lesson_progress.filter((x) => lessonIds.has(x.lesson_id)).map((x) => x.student_id)).size,
      },
      studentLessons: courseOrder(db, c.id).length,
      modules: mods.map((m) => ({
        id: m.id, slug: m.slug, title: m.title, status: m.status, position: m.position,
        lessons: db.lessons
          .filter((l) => l.module_id === m.id && visible(l))
          .sort((a, b) => a.position - b.position)
          .map((l) => ({ id: l.id, slug: l.slug, title: l.title, language: l.language, visibility: l.visibility, status: l.status, exercises: db.exercises.filter((e) => e.lesson_id === l.id).length, editable: canEditLesson(p, l) })),
      })),
      unassigned: db.lessons
        .filter((l) => !l.module_id && canEditLesson(p, l))
        .map((l) => ({ id: l.id, slug: l.slug, title: l.title, language: l.language, visibility: l.visibility, status: l.status })),
    };
  });
}
export type CourseDetail = NonNullable<ReturnType<typeof courseDetail>>;

export function saveCourse(p: Profile, input: { id?: string; slug: string; title: string; description: string; firstModule?: string }) {
  return write((db) => {
    const title = input.title.trim().slice(0, 120);
    if (!title) throw new AppError("invalid_name");
    if (!SLUG.test(input.slug) || input.slug.length > 60) throw new AppError("invalid_slug");
    if (db.courses.some((c) => c.slug === input.slug && c.id !== input.id)) throw new AppError("already_exists");
    if (!input.id) {
      const id = crypto.randomUUID();
      const mod = (input.firstModule ?? "").trim().slice(0, 120) || "Módulo 1";
      db.courses.push({ id, slug: input.slug, title, description: input.description.slice(0, 600), status: "draft", position: Math.max(0, ...db.courses.map((c) => c.position)) + 1, created_by: p.id });
      db.modules.push({ id: crypto.randomUUID(), course_id: id, slug: slugify(mod) || "modulo-1", title: mod, position: 1, status: "draft" });
      contentLog(db, p, "create", "course", id, { slug: input.slug });
      return id;
    }
    const c = courseOf(db, input.id);
    if (!canEditCourse(p, c)) throw new AppError("forbidden");
    Object.assign(c, { slug: input.slug, title, description: input.description.slice(0, 600) });
    contentLog(db, p, "update", "course", c.id);
    return c.id;
  });
}

export function setCourseStatus(p: Profile, id: string, status: Lesson["status"]) {
  return write((db) => {
    const c = courseOf(db, id);
    if (!canEditCourse(p, c)) throw new AppError("forbidden");
    if (status === "published" && !db.modules.some((m) => m.course_id === id && m.status === "published")) throw new AppError("course_needs_module");
    c.status = status;
    contentLog(db, p, "set_status", "course", id, { status });
    if (status === "published") staffLog(db, p, "content_published", "course", id);
  });
}

export function setModuleStatus(p: Profile, id: string, status: Lesson["status"]) {
  return write((db) => {
    const m = db.modules.find((x) => x.id === id);
    if (!m) throw new AppError("not_found");
    if (!canEditCourse(p, courseOf(db, m.course_id))) throw new AppError("forbidden");
    if (status === "published" && !db.lessons.some((l) => l.module_id === id && l.status === "published")) throw new AppError("module_needs_lesson");
    m.status = status;
    contentLog(db, p, "set_status", "module", id, { status });
  });
}

export function deleteCourse(p: Profile, id: string, confirm: string, deleteLessons: boolean) {
  return write((db) => {
    const c = courseOf(db, id);
    if (!canEditCourse(p, c)) throw new AppError("forbidden");
    if (confirm !== c.slug) throw new AppError("confirmation_required");
    const mods = db.modules.filter((m) => m.course_id === id);
    if (p.role !== "founder" && db.lessons.some((l) => mods.some((m) => m.id === l.module_id) && db.lesson_progress.some((x) => x.lesson_id === l.id))) throw new AppError("course_in_use");
    const out = { deleted: 0, detached: 0 };
    for (const m of mods) {
      const r = releaseLessons(db, p, m.id, deleteLessons);
      out.deleted += r.deleted;
      out.detached += r.detached;
    }
    db.modules = db.modules.filter((m) => m.course_id !== id);
    db.group_courses = db.group_courses.filter((g) => g.course_id !== id);
    db.courses = db.courses.filter((x) => x.id !== id);
    contentLog(db, p, "delete", "course", id, { slug: c.slug, ...out });
    staffLog(db, p, "course_deleted", "course", id, { slug: c.slug });
    return out;
  });
}

export function saveModule(p: Profile, input: { id?: string; courseId: string; title: string }) {
  return write((db) => {
    const title = input.title.trim().slice(0, 120);
    if (!title) throw new AppError("invalid_name");
    const existing = input.id ? db.modules.find((m) => m.id === input.id) : undefined;
    if (input.id && !existing) throw new AppError("not_found");
    const c = courseOf(db, existing?.course_id ?? input.courseId);
    if (!canEditCourse(p, c)) throw new AppError("forbidden");
    if (existing) {
      existing.title = title;
      contentLog(db, p, "update", "module", existing.id);
      return existing.id;
    }
    const base = slugify(title) || "modulo";
    let slug = base;
    for (let i = 2; db.modules.some((m) => m.course_id === c.id && m.slug === slug); i++) slug = `${base}-${i}`;
    const id = crypto.randomUUID();
    db.modules.push({ id, course_id: c.id, slug, title, position: Math.max(0, ...db.modules.filter((m) => m.course_id === c.id).map((m) => m.position)) + 1, status: "draft" });
    contentLog(db, p, "create", "module", id, { course_id: c.id });
    return id;
  });
}

export function deleteModule(p: Profile, id: string, deleteLessons: boolean) {
  return write((db) => {
    const m = db.modules.find((x) => x.id === id);
    if (!m) throw new AppError("not_found");
    if (!canEditCourse(p, courseOf(db, m.course_id))) throw new AppError("forbidden");
    if (p.role !== "founder" && deleteLessons && db.lessons.some((l) => l.module_id === id && lessonHasProgress(db, l.id))) throw new AppError("module_in_use");
    const out = releaseLessons(db, p, id, deleteLessons);
    db.modules = db.modules.filter((x) => x.id !== id);
    renumberModules(db, m.course_id);
    contentLog(db, p, "delete", "module", id, out);
    return out;
  });
}

export function reorderModules(p: Profile, courseId: string, ids: string[]) {
  return write((db) => {
    if (!canEditCourse(p, courseOf(db, courseId))) throw new AppError("forbidden");
    const mine = db.modules.filter((m) => m.course_id === courseId);
    if (mine.length !== ids.length || new Set(ids).size !== ids.length || !mine.every((m) => ids.includes(m.id))) throw new AppError("ids_mismatch");
    ids.forEach((id, i) => (mine.find((m) => m.id === id)!.position = i + 1));
  });
}

export function reorderLessons(p: Profile, moduleId: string, ids: string[]) {
  return write((db) => {
    const m = db.modules.find((x) => x.id === moduleId);
    if (!m) throw new AppError("not_found");
    if (!canEditCourse(p, courseOf(db, m.course_id))) throw new AppError("forbidden");
    const mine = db.lessons.filter((l) => l.module_id === moduleId);
    if (mine.length !== ids.length || new Set(ids).size !== ids.length || !mine.every((l) => ids.includes(l.id))) throw new AppError("ids_mismatch");
    ids.forEach((id, i) => (mine.find((l) => l.id === id)!.position = i + 1));
  });
}

function moveLessonIn(db: Db, p: Profile, lessonId: string, moduleId: string | null) {
  const l = db.lessons.find((x) => x.id === lessonId);
  if (!l) throw new AppError("not_found");
  if (l.module_id === moduleId) return;
  const from = l.module_id ? db.modules.find((m) => m.id === l.module_id) : undefined;
  const to = moduleId ? db.modules.find((m) => m.id === moduleId) : undefined;
  if (moduleId && !to) throw new AppError("not_found");
  const owns = (m?: { course_id: string }) => !m || canEditCourse(p, courseOf(db, m.course_id));
  if (!(canEditLesson(p, l) || (owns(from) && owns(to)))) throw new AppError("forbidden");
  const prev = l.module_id;
  l.module_id = moduleId;
  l.position = Math.max(0, ...db.lessons.filter((x) => x.id !== l.id && x.module_id === moduleId).map((x) => x.position)) + 1;
  if (!moduleId && l.visibility === "program") l.visibility = "draft";
  else if (moduleId && l.visibility === "draft") l.visibility = "program";
  if (prev) renumberLessons(db, prev);
  contentLog(db, p, "move", "lesson", l.id, { from: prev, to: moduleId });
}

export function moveLesson(p: Profile, lessonId: string, moduleId: string | null) {
  return write((db) => moveLessonIn(db, p, lessonId, moduleId));
}

export function deleteLesson(p: Profile, id: string, confirm: string) {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === id);
    if (!l) throw new AppError("not_found");
    if (!canEditLesson(p, l)) throw new AppError("forbidden");
    if (confirm !== l.slug) throw new AppError("confirmation_required");
    if (p.role !== "founder" && lessonHasProgress(db, id)) throw new AppError("lesson_in_use");
    purgeLesson(db, id);
    if (l.module_id) renumberLessons(db, l.module_id);
    contentLog(db, p, "delete", "lesson", id, { slug: l.slug, title: l.title });
    staffLog(db, p, "lesson_deleted", "lesson", id, { slug: l.slug });
  });
}
