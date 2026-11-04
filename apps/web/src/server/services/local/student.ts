import "server-only";
import { isTrivialPin, normalizeCode, type CodeLanguage } from "@codeher/core";
import { hashSecret, verifySecret } from "../../crypto";
import { now, read, write, nextSeq } from "../../db/store";
import { GAMES, type Db, type GameId, type RecreoSession, type Student } from "../../db/types";
import { AppError } from "../../errors";
import { applyAttempt, canRead, courseOrder, gradeAnswer, isUnlocked, lessonPayload, lessonStatus, nextInCourse, nextLesson, previousLesson, totals, tryCompleteLesson, touchStreak } from "../../learning";
import { issueSession } from "../../session";

// ---------- Sign-in (port of student_sign_in) ----------
export type SignInResult = { ok: true; token: string; hours: number; nickname: string } | { ok: false; error: "invalid" | "locked" | "inactive" };

export function signIn(rawCode: string, pin: string, ip: string | null): SignInResult {
  return write((db) => {
    const code = normalizeCode(rawCode ?? "");
    const { soft_after, soft_minutes, hard_after } = db.settings.lockout;
    const at = now();
    const fail = (error: "invalid" | "locked" | "inactive"): SignInResult => {
      db.login_attempts.push({ code_norm: code, ip, success: false, created_at: at });
      return { ok: false, error };
    };
    const window = Date.now() - 15 * 60_000;
    if (ip && db.login_attempts.filter((a) => a.ip === ip && !a.success && Date.parse(a.created_at) > window).length >= 30) return fail("locked");

    const s = db.students.find((x) => x.code === code);
    if (!s) {
      // Unknown codes behave like real ones: no way to learn whether a code exists.
      const lastOk = db.login_attempts.filter((a) => a.code_norm === code && a.success).map((a) => Date.parse(a.created_at)).sort().pop() ?? 0;
      const fails = db.login_attempts.filter((a) => a.code_norm === code && !a.success && Date.parse(a.created_at) > lastOk);
      const recent = fails.filter((a) => Date.parse(a.created_at) > Date.now() - soft_minutes * 60_000).length + 1;
      return fail(fails.length + 1 >= hard_after || recent >= soft_after ? "locked" : "invalid");
    }
    if (s.hard_locked || (s.locked_until && Date.parse(s.locked_until) > Date.now())) return fail("locked");
    if (!verifySecret(pin ?? "", s.pin_hash)) {
      s.failed_attempts += 1;
      if (s.failed_attempts >= hard_after) {
        s.hard_locked = true;
        s.locked_until = null;
        log(db, "system", null, "student_hard_locked", "student", s.id, { failures: s.failed_attempts });
        return fail("locked");
      }
      if (s.failed_attempts % soft_after === 0) {
        s.locked_until = new Date(Date.now() + soft_minutes * 60_000).toISOString();
        log(db, "system", null, "student_soft_locked", "student", s.id, { failures: s.failed_attempts });
        return fail("locked");
      }
      return fail("invalid");
    }
    const g = db.groups.find((x) => x.id === s.group_id);
    if (s.status !== "active" || !g || g.status !== "active" || (g.ends_on && g.ends_on < at.slice(0, 10))) return fail("inactive");
    s.failed_attempts = 0;
    s.locked_until = null;
    s.last_active_at = at;
    db.login_attempts.push({ code_norm: code, ip, success: true, created_at: at });
    const hours = db.settings.session_hours;
    return { ok: true, token: issueSession(db, "student", s.id, hours), hours, nickname: s.nickname };
  });
}

export function log(db: Db, kind: "staff" | "student" | "system" | "mcp", actor: string | null, action: string, entityType: string, entityId: string | null, payload: Record<string, unknown> = {}) {
  db.access_log.push({ id: nextSeq(db), actor_kind: kind, actor_id: actor, action, entity_type: entityType, entity_id: entityId, payload, created_at: now() });
}

// ---------- Read models ----------
function me(db: Db, s: Student) {
  const g = db.groups.find((x) => x.id === s.group_id)!;
  const c = db.communities.find((x) => x.id === g.community_id);
  return { id: s.id, code: s.code, nickname: s.nickname, avatar: s.avatar, group: { year: g.year, month: g.month, letter: g.letter, community: c?.name ?? "" }, ...totals(db, s.id) };
}

export function home(s: Student) {
  return read((db) => {
    const completed = db.lesson_progress.filter((p) => p.student_id === s.id && p.status === "completed");
    const courseIds = db.group_courses.filter((gc) => gc.group_id === s.group_id).map((gc) => gc.course_id);
    const total = courseIds.reduce((a, cid) => a + courseOrder(db, cid).length, 0);
    const t = totals(db, s.id);
    const langs = new Set(completed.map((p) => db.lessons.find((l) => l.id === p.lesson_id)?.language));
    const badges = [
      { id: "first_program", earned: db.exercise_progress.some((p) => p.student_id === s.id && p.passed) },
      { id: "first_lesson", earned: completed.length >= 1 },
      { id: "five_lessons", earned: completed.length >= 5 },
      { id: "streak_3", earned: t.longest_streak >= 3 },
      { id: "streak_7", earned: t.longest_streak >= 7 },
      { id: "first_project", earned: db.projects.some((p) => p.student_id === s.id) },
      { id: "bilingual", earned: langs.has("python") && langs.has("pseudocode_es") },
      { id: "level_5", earned: t.xp >= 800 },
      { id: "logro", earned: db.accomplishments.some((a) => a.student_id === s.id && a.status === "published") },
    ];
    const recent = db.projects.filter((p) => p.student_id === s.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 3)
      .map((p) => ({ id: p.id, name: p.name, language: p.language, updated_at: p.updated_at }));
    return { ...me(db, s), next: nextLesson(db, s), lessons_completed: completed.length, lessons_total: total, badges, recent_projects: recent };
  });
}

export function path(s: Student) {
  return read((db) =>
    db.group_courses
      .filter((gc) => gc.group_id === s.group_id)
      .sort((a, b) => a.position - b.position)
      .map((gc) => db.courses.find((c) => c.id === gc.course_id)!)
      .filter((c) => c && c.status === "published")
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        lessons: courseOrder(db, c.id).map((l, i) => ({
          id: l.id,
          slug: l.slug,
          title: l.title,
          summary: l.summary,
          language: l.language,
          minutes: l.estimated_minutes,
          xp: l.xp_reward,
          seq: i + 1,
          status: lessonStatus(db, s.id, l.id),
          unlocked: isUnlocked(db, s, l),
          unlock_after: previousLesson(db, l)?.title ?? null,
        })),
      })),
  );
}

export function lesson(s: Student, slug: string) {
  return read((db) => {
    const l = db.lessons.find((x) => x.slug === slug && x.status === "published");
    if (!l || !canRead(db, s, l)) return null;
    const course = l.module_id ? db.courses.find((c) => c.id === db.modules.find((m) => m.id === l.module_id)?.course_id) : null;
    const next = nextInCourse(db, l);
    return {
      ...lessonPayload(db, l, s),
      status: lessonStatus(db, s.id, l.id),
      unlocked: isUnlocked(db, s, l),
      unlock_after: previousLesson(db, l)?.title ?? null,
      course: course ? { slug: course.slug, title: course.title } : null,
      next: next ? { slug: next.slug, title: next.title, language: next.language } : null,
    };
  });
}

// ---------- Submissions ----------
export function submitCode(s: Student, input: { exerciseId: string; submission: string; passed: boolean; results: unknown; runtimeMs: number | null; hintsUsed: number; errorType: string | null }) {
  return write((db) => {
    const ex = db.exercises.find((e) => e.id === input.exerciseId);
    if (!ex || ex.type !== "code") throw new AppError("wrong_exercise_type");
    const st = db.students.find((x) => x.id === s.id)!;
    return applyAttempt(db, st, ex, input);
  });
}

export function submitAnswer(s: Student, exerciseId: string, answer: { choices?: number[]; text?: string }, hintsUsed: number) {
  return write((db) => {
    const ex = db.exercises.find((e) => e.id === exerciseId);
    if (!ex || ex.type === "code") throw new AppError("wrong_exercise_type");
    const passed = gradeAnswer(ex, answer);
    const st = db.students.find((x) => x.id === s.id)!;
    const res = applyAttempt(db, st, ex, { passed, submission: JSON.stringify(answer), results: [], runtimeMs: null, hintsUsed, errorType: null });
    return { ...res, explanation_md: passed ? ex.solution.explanation_md : null };
  });
}

export function completeLesson(s: Student, lessonId: string) {
  return write((db) => {
    const l = db.lessons.find((x) => x.id === lessonId);
    if (!l || !canRead(db, s, l)) throw new AppError("lesson_not_found");
    if (!isUnlocked(db, s, l)) throw new AppError("lesson_locked");
    touchStreak(db, s.id);
    return { lesson_completed: tryCompleteLesson(db, s.id, l), ...totals(db, s.id) };
  });
}

// ---------- Projects ----------
function ownProject(db: Db, s: Student, id: string) {
  const p = db.projects.find((x) => x.id === id && x.student_id === s.id);
  if (!p) throw new AppError("project_not_found");
  return p;
}
function addVersion(db: Db, projectId: string, code: string) {
  db.project_versions.push({ id: nextSeq(db), project_id: projectId, code, created_at: now() });
  const mine = db.project_versions.filter((v) => v.project_id === projectId).sort((a, b) => b.id - a.id);
  const keep = new Set(mine.slice(0, 10).map((v) => v.id));
  db.project_versions = db.project_versions.filter((v) => v.project_id !== projectId || keep.has(v.id));
}

export function listProjects(s: Student) {
  return read((db) =>
    db.projects
      .filter((p) => p.student_id === s.id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((p) => {
        const l = p.source_lesson_id ? db.lessons.find((x) => x.id === p.source_lesson_id) : null;
        const nom = db.accomplishments.filter((a) => a.project_id === p.id).sort((a, b) => b.nominated_at.localeCompare(a.nominated_at))[0];
        return { id: p.id, name: p.name, language: p.language, updated_at: p.updated_at, lesson: l ? { slug: l.slug, title: l.title } : null, nomination: nom?.status ?? null };
      }),
  );
}

export function getProject(s: Student, id: string) {
  return read((db) => {
    const p = db.projects.find((x) => x.id === id && x.student_id === s.id);
    if (!p) return null;
    const l = p.source_lesson_id ? db.lessons.find((x) => x.id === p.source_lesson_id) : null;
    const nom = db.accomplishments.filter((a) => a.project_id === p.id).sort((a, b) => b.nominated_at.localeCompare(a.nominated_at))[0];
    return {
      ...p,
      lesson: l ? { slug: l.slug, title: l.title } : null,
      nomination: nom ? { status: nom.status, title: nom.title } : null,
      versions: db.project_versions.filter((v) => v.project_id === p.id).sort((a, b) => b.id - a.id).map((v) => ({ id: v.id, created_at: v.created_at })),
    };
  });
}

export function createProject(s: Student, name: string, language: CodeLanguage, code: string, sourceLessonId: string | null) {
  return write((db) => {
    if (db.projects.filter((p) => p.student_id === s.id).length >= 200) throw new AppError("too_many_projects");
    const lesson = sourceLessonId ? db.lessons.find((l) => l.id === sourceLessonId) : null;
    const st = db.students.find((x) => x.id === s.id)!;
    const id = crypto.randomUUID();
    db.projects.push({ id, student_id: s.id, name: (name.trim() || "Mi proyecto").slice(0, 80), language, code: code.slice(0, 20000), source_lesson_id: lesson && canRead(db, st, lesson) ? lesson.id : null, created_at: now(), updated_at: now() });
    addVersion(db, id, code.slice(0, 20000));
    return id;
  });
}

export function saveProject(s: Student, id: string, code: string, snapshot: boolean) {
  return write((db) => {
    const p = ownProject(db, s, id);
    p.code = code.slice(0, 20000);
    p.updated_at = now();
    const last = db.project_versions.filter((v) => v.project_id === id).sort((a, b) => b.id - a.id)[0];
    let versioned = false;
    if (!last || (last.code !== p.code && (snapshot || Date.parse(last.created_at) < Date.now() - 2 * 60_000))) {
      addVersion(db, id, p.code);
      versioned = true;
    }
    return { saved_at: p.updated_at, versioned };
  });
}

export function renameProject(s: Student, id: string, name: string) {
  if (!name.trim()) throw new AppError("invalid_name");
  return write((db) => {
    const p = ownProject(db, s, id);
    p.name = name.trim().slice(0, 80);
    p.updated_at = now();
  });
}

export function duplicateProject(s: Student, id: string) {
  const p = read((db) => ownProject(db, s, id));
  return createProject(s, `${p.name} (copia)`.slice(0, 80), p.language, p.code, p.source_lesson_id);
}

export function deleteProject(s: Student, id: string) {
  return write((db) => {
    ownProject(db, s, id);
    db.projects = db.projects.filter((p) => p.id !== id);
    db.project_versions = db.project_versions.filter((v) => v.project_id !== id);
    for (const a of db.accomplishments) if (a.project_id === id) a.project_id = null;
  });
}

export function projectVersion(s: Student, id: string, versionId: number) {
  return read((db) => {
    ownProject(db, s, id);
    return db.project_versions.find((v) => v.id === versionId && v.project_id === id)?.code ?? null;
  });
}

export function nominateProject(s: Student, id: string, title: string, blurb: string) {
  return write((db) => {
    const p = ownProject(db, s, id);
    const g = db.groups.find((x) => x.id === s.group_id)!;
    const existing = db.accomplishments.find((a) => a.project_id === id && (a.status === "nominated" || a.status === "approved"));
    if (existing) {
      Object.assign(existing, { title: (title.trim() || p.name).slice(0, 120), blurb: blurb.slice(0, 600), code: p.code, language: p.language });
      return existing.id;
    }
    const aid = crypto.randomUUID();
    db.accomplishments.push({
      id: aid, student_id: s.id, project_id: p.id, kind: "project", title: (title.trim() || p.name).slice(0, 120), blurb: blurb.slice(0, 600), tags: [p.language === "python" ? "Python" : "Pseudocódigo"],
      language: p.language, code: p.code, display_name: s.nickname, community_id: g.community_id, year: g.year, status: "nominated", featured: false, is_sample: false,
      nominated_by_student: true, nominated_by: null, nominated_at: now(), reviewed_at: null, published_at: null,
    });
    return aid;
  });
}

// ---------- Profile ----------
export const AVATARS = ["orbita", "cometa", "chispa", "nebula", "pixel", "prisma", "eco", "nodo"] as const;

export function updateProfile(s: Student, nickname: string, avatar: string) {
  if (!nickname.trim()) throw new AppError("invalid_name");
  if (!(AVATARS as readonly string[]).includes(avatar)) throw new AppError("invalid_avatar");
  return write((db) => {
    const st = db.students.find((x) => x.id === s.id)!;
    st.nickname = nickname.trim().slice(0, 40);
    st.avatar = avatar;
  });
}

export function changePin(s: Student, current: string, next: string): { ok: boolean; error?: "wrong_pin" | "trivial_pin" } {
  return write((db) => {
    const st = db.students.find((x) => x.id === s.id)!;
    if (!verifySecret(current, st.pin_hash)) return { ok: false, error: "wrong_pin" as const };
    if (isTrivialPin(next)) return { ok: false, error: "trivial_pin" as const };
    st.pin_hash = hashSecret(next);
    log(db, "student", st.id, "student_changed_pin", "student", st.id);
    return { ok: true };
  });
}

// ---------- Recreo (port of 0008_recreo.sql) ----------
export const RECREO = { maxTickets: 2, lessonsPerTicket: 2, minutes: 5 } as const;

function recreoSync(db: Db, s: Student) {
  db.recreo ??= [];
  let r = db.recreo.find((x) => x.student_id === s.id);
  if (!r) db.recreo.push((r = { student_id: s.id, tickets: 0, lessons_credited: 0 }));
  const done = db.lesson_progress.filter((p) => p.student_id === s.id && p.status === "completed").length;
  const add = Math.max(0, Math.floor((done - r.lessons_credited) / RECREO.lessonsPerTicket));
  if (add) {
    r.tickets = Math.min(RECREO.maxTickets, r.tickets + add);
    r.lessons_credited += add * RECREO.lessonsPerTicket;
  }
  return { r, done };
}

export function recreo(s: Student) {
  return write((db) => {
    const { r, done } = recreoSync(db, s);
    const active = (db.recreo_sessions ?? []).filter((x) => x.student_id === s.id && Date.parse(x.ends_at) > Date.now()).sort((a, b) => b.ends_at.localeCompare(a.ends_at))[0];
    return {
      enabled: db.groups.find((g) => g.id === s.group_id)?.recreo_enabled !== false,
      tickets: r.tickets, max_tickets: RECREO.maxTickets, lessons_per_ticket: RECREO.lessonsPerTicket, minutes: RECREO.minutes,
      toward_next: Math.min(1, Math.max(0, done - r.lessons_credited)),
      free_until: r.free_until && Date.parse(r.free_until) > Date.now() ? r.free_until : null,
      active: active ? { game: active.game, ends_at: active.ends_at, started_at: active.started_at, score: active.score, free: !!active.free } : null,
      best: Object.fromEntries((db.game_scores ?? []).filter((g) => g.student_id === s.id).map((g) => [g.game, g.best])) as Partial<Record<GameId, number>>,
    };
  });
}

export function recreoStart(s: Student, game: GameId) {
  return write((db) => {
    if (!(GAMES as readonly string[]).includes(game)) throw new AppError("invalid_game");
    const { r } = recreoSync(db, s);
    const free = !!r.free_until && Date.parse(r.free_until) > Date.now();
    if (!free && db.groups.find((g) => g.id === s.group_id)?.recreo_enabled === false) throw new AppError("recreo_disabled");
    db.recreo_sessions ??= [];
    const active = db.recreo_sessions.find((x) => x.student_id === s.id && Date.parse(x.ends_at) > Date.now());
    if (active) {
      if (free && r.free_until! > active.ends_at) Object.assign(active, { ends_at: r.free_until, free: true });
      active.game = game;
      return { game, ends_at: active.ends_at, score: active.score, new: false };
    }
    if (!free) {
      if (r.tickets < 1) throw new AppError("no_tickets");
      r.tickets -= 1;
    }
    const x: RecreoSession = { id: crypto.randomUUID(), student_id: s.id, game, started_at: now(), ends_at: free ? r.free_until! : new Date(Date.now() + RECREO.minutes * 60_000).toISOString(), score: 0, free };
    db.recreo_sessions.push(x);
    log(db, "student", s.id, "recreo_started", "student", s.id, { game });
    return { game, ends_at: x.ends_at, score: 0, new: true };
  });
}

export function recreoScore(s: Student, game: GameId, score: number) {
  return write((db) => {
    const a = (db.recreo_sessions ?? []).find((x) => x.student_id === s.id && x.game === game && Date.parse(x.ends_at) > Date.now() - 60_000);
    if (!a) throw new AppError("no_active_recreo");
    const v = Math.max(0, Math.min(1000, Math.floor(score || 0)));
    a.score = Math.max(a.score, v);
    db.game_scores ??= [];
    let g = db.game_scores.find((x) => x.student_id === s.id && x.game === game);
    if (!g) db.game_scores.push((g = { student_id: s.id, game, best: 0, plays: 0 }));
    g.best = Math.max(g.best, v);
    g.plays += 1;
    return { best: g.best };
  });
}
