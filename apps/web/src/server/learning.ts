import "server-only";
// Progression, attempts, XP and streaks: a faithful port of
// supabase/migrations/0003_student_learning.sql for the local adapter.
import { levelFromXp } from "@codeher/core";
import type { Db, Exercise, Lesson, Student } from "./db/types";
import { now } from "./db/store";
import { AppError } from "./errors";

export function todayMx(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function dayBefore(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Linear order of published lessons per course (view course_lesson_order). */
export function courseOrder(db: Db, courseId: string): Lesson[] {
  const course = db.courses.find((c) => c.id === courseId);
  if (!course || course.status !== "published") return [];
  const mods = db.modules.filter((m) => m.course_id === courseId && m.status === "published").sort((a, b) => a.position - b.position);
  return mods.flatMap((m) =>
    db.lessons.filter((l) => l.module_id === m.id && l.status === "published" && l.visibility !== "draft").sort((a, b) => a.position - b.position),
  );
}

export function lessonCourse(db: Db, lesson: Lesson): string | null {
  return lesson.module_id ? (db.modules.find((m) => m.id === lesson.module_id)?.course_id ?? null) : null;
}

function groupCourseIds(db: Db, s: Student): string[] {
  return db.group_courses.filter((gc) => gc.group_id === s.group_id).sort((a, b) => a.position - b.position).map((gc) => gc.course_id);
}

export function canRead(db: Db, s: Student, lesson: Lesson): boolean {
  if (lesson.status !== "published") return false;
  if (lesson.visibility === "public") return true;
  const cid = lessonCourse(db, lesson);
  return !!cid && groupCourseIds(db, s).includes(cid) && courseOrder(db, cid).some((l) => l.id === lesson.id);
}

export function lessonStatus(db: Db, studentId: string, lessonId: string) {
  return db.lesson_progress.find((p) => p.student_id === studentId && p.lesson_id === lessonId)?.status ?? "not_started";
}

export function isUnlocked(db: Db, s: Student, lesson: Lesson): boolean {
  if (lesson.status === "published" && lesson.visibility === "public") return true;
  const cid = lessonCourse(db, lesson);
  if (!cid || !groupCourseIds(db, s).includes(cid)) return false;
  const order = courseOrder(db, cid);
  const i = order.findIndex((l) => l.id === lesson.id);
  if (i < 0) return false;
  return i === 0 || lessonStatus(db, s.id, order[i - 1].id) === "completed";
}

export function previousLesson(db: Db, lesson: Lesson): Lesson | null {
  const cid = lessonCourse(db, lesson);
  if (!cid) return null;
  const order = courseOrder(db, cid);
  const i = order.findIndex((l) => l.id === lesson.id);
  return i > 0 ? order[i - 1] : null;
}
export function nextInCourse(db: Db, lesson: Lesson): Lesson | null {
  const cid = lessonCourse(db, lesson);
  if (!cid) return null;
  const order = courseOrder(db, cid);
  const i = order.findIndex((l) => l.id === lesson.id);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}

export function totals(db: Db, studentId: string) {
  const xp = db.xp_events.filter((x) => x.student_id === studentId).reduce((a, x) => a + x.amount, 0);
  const st = db.streaks.find((x) => x.student_id === studentId);
  const today = todayMx();
  const streak = st && st.last_activity_date && st.last_activity_date >= dayBefore(today) ? st.current_streak : 0;
  return { xp, level: levelFromXp(xp), streak, longest_streak: st?.longest_streak ?? 0 };
}

export function touchStreak(db: Db, studentId: string) {
  const today = todayMx();
  let st = db.streaks.find((x) => x.student_id === studentId);
  if (!st) {
    st = { student_id: studentId, current_streak: 1, longest_streak: 1, last_activity_date: today };
    db.streaks.push(st);
    return;
  }
  if (st.last_activity_date === today) return;
  st.current_streak = st.last_activity_date === dayBefore(today) ? st.current_streak + 1 : 1;
  st.longest_streak = Math.max(st.longest_streak, st.current_streak);
  st.last_activity_date = today;
}

function awardXp(db: Db, studentId: string, sourceType: "exercise" | "lesson", sourceId: string, amount: number): boolean {
  if (db.xp_events.some((x) => x.student_id === studentId && x.source_type === sourceType && x.source_id === sourceId)) return false;
  db.xp_events.push({ student_id: studentId, source_type: sourceType, source_id: sourceId, amount, created_at: now() });
  return true;
}

export function tryCompleteLesson(db: Db, studentId: string, lesson: Lesson): boolean {
  const required = db.exercises.filter((e) => e.lesson_id === lesson.id && e.required);
  const remaining = required.filter((e) => !db.exercise_progress.find((p) => p.student_id === studentId && p.exercise_id === e.id)?.passed);
  let lp = db.lesson_progress.find((p) => p.student_id === studentId && p.lesson_id === lesson.id);
  if (remaining.length > 0) {
    if (!lp) db.lesson_progress.push({ student_id: studentId, lesson_id: lesson.id, status: "in_progress", started_at: now(), completed_at: null, updated_at: now() });
    return false;
  }
  if (!lp) {
    lp = { student_id: studentId, lesson_id: lesson.id, status: "completed", started_at: now(), completed_at: now(), updated_at: now() };
    db.lesson_progress.push(lp);
  } else {
    lp.status = "completed";
    lp.completed_at ??= now();
    lp.updated_at = now();
  }
  awardXp(db, studentId, "lesson", lesson.id, lesson.xp_reward);
  return true;
}

export function applyAttempt(
  db: Db,
  s: Student,
  exercise: Exercise,
  input: { passed: boolean; submission: string; results: unknown; runtimeMs: number | null; hintsUsed: number; errorType: string | null },
) {
  const lesson = db.lessons.find((l) => l.id === exercise.lesson_id);
  if (!lesson || !canRead(db, s, lesson)) throw new AppError("exercise_not_found");
  if (!isUnlocked(db, s, lesson)) throw new AppError("lesson_locked");
  const minuteAgo = Date.now() - 60_000;
  if (db.attempts.filter((a) => a.student_id === s.id && Date.parse(a.created_at) > minuteAgo).length >= 60) throw new AppError("rate_limited");

  let ep = db.exercise_progress.find((p) => p.student_id === s.id && p.exercise_id === exercise.id);
  const firstPass = input.passed && !ep?.passed;
  const submission = input.submission.slice(0, 20000);
  db.attempts.push({ id: crypto.randomUUID(), student_id: s.id, exercise_id: exercise.id, submission, passed: input.passed, test_results: input.results ?? [], error_type: input.errorType?.slice(0, 80) ?? null, runtime_ms: input.runtimeMs, created_at: now() });
  if (!ep) {
    ep = { student_id: s.id, exercise_id: exercise.id, passed: false, attempts: 0, hints_used: 0, first_passed_at: null, best_submission: null, updated_at: now() };
    db.exercise_progress.push(ep);
  }
  ep.attempts += 1;
  ep.hints_used = Math.max(ep.hints_used, input.hintsUsed || 0);
  if (input.passed) {
    ep.passed = true;
    ep.first_passed_at ??= now();
    ep.best_submission = submission;
  }
  ep.updated_at = now();
  if (firstPass) awardXp(db, s.id, "exercise", exercise.id, exercise.xp_reward);
  touchStreak(db, s.id);
  const completed = tryCompleteLesson(db, s.id, lesson);
  return {
    passed: input.passed,
    first_pass: firstPass,
    xp_awarded: firstPass ? exercise.xp_reward : 0,
    lesson_completed: completed,
    lesson_xp: completed ? lesson.xp_reward : 0,
    ...totals(db, s.id),
  };
}

export function nextLesson(db: Db, s: Student) {
  for (const cid of groupCourseIds(db, s)) {
    const course = db.courses.find((c) => c.id === cid);
    for (const l of courseOrder(db, cid)) {
      const status = lessonStatus(db, s.id, l.id);
      if (status !== "completed" && isUnlocked(db, s, l)) return { slug: l.slug, title: l.title, language: l.language, course: course?.title ?? "", status };
    }
  }
  return null;
}

export function lessonPayload(db: Db, lesson: Lesson, student: Student | null) {
  const pair = lesson.pair_lesson_id ? db.lessons.find((l) => l.id === lesson.pair_lesson_id) : null;
  const pairVisible = pair && pair.status === "published" && (student ? canRead(db, student, pair) : pair.visibility === "public");
  const deck = db.decks.find((d) => d.lesson_id === lesson.id && d.status === "published");
  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    content_md: lesson.content_md,
    language: lesson.language,
    visibility: lesson.visibility,
    minutes: lesson.estimated_minutes,
    xp: lesson.xp_reward,
    pair: pairVisible ? { slug: pair.slug, title: pair.title, language: pair.language } : null,
    deck: deck ? (deck.slides as unknown) : null,
    exercises: db.exercises
      .filter((e) => e.lesson_id === lesson.id)
      .sort((a, b) => a.position - b.position)
      .map((e) => {
        const p = student ? db.exercise_progress.find((x) => x.student_id === student.id && x.exercise_id === e.id) : null;
        return {
          id: e.id,
          slug: e.slug,
          position: e.position,
          type: e.type,
          title: e.title,
          instructions_md: e.instructions_md,
          starter_code: e.starter_code,
          config: e.config,
          xp: e.xp_reward,
          required: e.required,
          timeout_ms: e.timeout_ms,
          tests: e.tests,
          hints: e.hints,
          progress: p ? { passed: p.passed, attempts: p.attempts, hints_used: p.hints_used, best_submission: p.best_submission } : null,
        };
      }),
  };
}
export type LessonPayload = ReturnType<typeof lessonPayload>;

export function gradeAnswer(exercise: Exercise, answer: { choices?: number[]; text?: string }): boolean {
  const expected = exercise.solution.answer as { choices?: number[]; accepted?: string[] } | null;
  if (!expected) throw new AppError("exercise_not_configured");
  if (exercise.type === "multiple_choice") {
    const a = [...(answer.choices ?? [])].sort();
    const b = [...(expected.choices ?? [])].sort();
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  const text = (answer.text ?? "").trim().toLowerCase();
  return (expected.accepted ?? []).some((x) => x.trim().toLowerCase() === text);
}
