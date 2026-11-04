import "server-only";
import { levelFromXp, type CodeLanguage } from "@codeher/core";
import type { Student } from "../../db/types";
import { anonClient, rpc } from "../../supabase";
import type * as L from "../local/student";

// Student calls: SECURITY DEFINER functions authenticated by the session token that
// student_sign_in issued (stored hashed in student_sessions). The anon key is enough.
type R<F extends (...a: never[]) => unknown> = Awaited<ReturnType<F>>;
export type StudentSession = Student & { token: string };
const tok = (s: Student) => (s as StudentSession).token;
const call = <T>(fn: string, args: Record<string, unknown>) => rpc<T>(anonClient(), fn, args);

export async function signIn(code: string, pin: string, ip: string | null): Promise<R<typeof L.signIn>> {
  const r = await call<{ ok: boolean; token?: string; expires_at?: string; nickname?: string; error?: "invalid" | "locked" | "inactive" }>("student_sign_in", {
    p_gate: process.env.STUDENT_GATE_SECRET ?? "",
    p_code: code,
    p_pin: pin,
    p_ip: ip,
  });
  if (!r.ok || !r.token) return { ok: false, error: r.error ?? "invalid" };
  const hours = Math.max(1, Math.round((Date.parse(r.expires_at ?? "") - Date.now()) / 3600_000)) || 12;
  return { ok: true, token: r.token, hours, nickname: r.nickname ?? "" };
}

export async function signOut(token: string) {
  await call("student_sign_out", { p_token: token });
}

/** Resolves a session token to the student (null when expired, revoked or inactive). */
export async function me(token: string): Promise<StudentSession | null> {
  try {
    const m = await call<{ id: string; code: string; nickname: string; avatar: string; group: { id: string } } | null>("student_me", { p_token: token });
    if (!m?.id) return null;
    return {
      id: m.id, code: m.code, nickname: m.nickname, avatar: m.avatar, group_id: m.group?.id ?? "", token,
      number: 0, status: "active", pin_hash: "", failed_attempts: 0, locked_until: null, hard_locked: false,
      guardian_consent: false, consent_reference: null, consent_recorded_at: null, last_active_at: null, created_at: "",
    };
  } catch {
    return null;
  }
}

export const home = async (s: Student) => {
  const h = await call<R<typeof L.home>>("student_home", { p_token: tok(s) });
  return { ...h, level: levelFromXp(h.xp) }; // the SQL totals carry XP; level is derived (tech spec 6.7)
};
export const path = async (s: Student) => call<R<typeof L.path>>("student_path", { p_token: tok(s) });
export const lesson = async (s: Student, slug: string) => call<R<typeof L.lesson>>("student_lesson", { p_token: tok(s), p_slug: slug });

export const submitCode = async (s: Student, i: Parameters<typeof L.submitCode>[1]) =>
  call<R<typeof L.submitCode>>("student_submit_code", {
    p_token: tok(s), p_exercise_id: i.exerciseId, p_submission: i.submission, p_passed: i.passed,
    p_results: i.results ?? [], p_runtime_ms: i.runtimeMs, p_hints_used: i.hintsUsed, p_error_type: i.errorType,
  });
export const submitAnswer = async (s: Student, exerciseId: string, answer: { choices?: number[]; text?: string }, hintsUsed: number) =>
  call<R<typeof L.submitAnswer>>("student_submit_answer", { p_token: tok(s), p_exercise_id: exerciseId, p_answer: answer, p_hints_used: hintsUsed });
export const completeLesson = async (s: Student, lessonId: string) => call<R<typeof L.completeLesson>>("student_complete_lesson", { p_token: tok(s), p_lesson_id: lessonId });

export const listProjects = async (s: Student) => call<R<typeof L.listProjects>>("student_projects", { p_token: tok(s) });
export const getProject = async (s: Student, id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return await call<R<typeof L.getProject>>("student_project_get", { p_token: tok(s), p_project: id });
  } catch {
    return null;
  }
};
export const createProject = async (s: Student, name: string, language: CodeLanguage, code: string, sourceLessonId: string | null) =>
  call<string>("student_project_create", { p_token: tok(s), p_name: name, p_language: language, p_code: code, p_source_lesson: sourceLessonId });
export const saveProject = async (s: Student, id: string, code: string, snapshot: boolean) =>
  call<R<typeof L.saveProject>>("student_project_save", { p_token: tok(s), p_project: id, p_code: code, p_snapshot: snapshot });
export const renameProject = async (s: Student, id: string, name: string) => call<R<typeof L.renameProject>>("student_project_rename", { p_token: tok(s), p_project: id, p_name: name });
export const duplicateProject = async (s: Student, id: string) => call<string>("student_project_duplicate", { p_token: tok(s), p_project: id });
export const deleteProject = async (s: Student, id: string) => call<R<typeof L.deleteProject>>("student_project_delete", { p_token: tok(s), p_project: id });
export const projectVersion = async (s: Student, id: string, versionId: number) => call<string | null>("student_project_version", { p_token: tok(s), p_project: id, p_version: versionId });
export const nominateProject = async (s: Student, id: string, title: string, blurb: string) =>
  call<string>("student_nominate_project", { p_token: tok(s), p_project: id, p_title: title, p_blurb: blurb });
export const updateProfile = async (s: Student, nickname: string, avatar: string) => call<R<typeof L.updateProfile>>("student_update_profile", { p_token: tok(s), p_nickname: nickname, p_avatar: avatar });
export const changePin = async (s: Student, current: string, next: string) => call<R<typeof L.changePin>>("student_change_pin", { p_token: tok(s), p_current: current, p_new: next });
