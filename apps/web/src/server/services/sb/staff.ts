import "server-only";
import { createHash } from "node:crypto";
import type { CodeLanguage } from "@codeher/core";
import type { AccomplishmentKind, ErrorTranslation, Exercise, Lesson, Profile, Role, Settings } from "../../db/types";
import { AppError } from "../../errors";
import { adminClient, fail, rpc, staffClient } from "../../supabase";
import type * as L from "../local/staff";

// Staff calls run as the signed-in Supabase Auth user: RLS policies and the
// SECURITY DEFINER functions check is_staff()/is_founder()/can_edit_lesson via auth.uid().
type R<F extends (...a: never[]) => unknown> = Awaited<ReturnType<F>>;
type Row = Record<string, unknown>;
const call = <T>(fn: string, args: Record<string, unknown> = {}) => rpc<T>(staffClient(), fn, args);
const db = async () => staffClient();
function ok<T>(res: { data: T | null; error: { message?: string; code?: string } | null }): T {
  if (res.error) fail(res.error);
  return res.data as T;
}

// ---------- Auth ----------
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3200";

export async function staffSignIn(email: string, password: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const c = await db();
  const { data, error } = await c.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) return { ok: false, error: error?.message?.toLowerCase().includes("confirm") ? "email_not_confirmed" : "invalid_credentials" };
  const { data: p } = await c.from("profiles").select("role,active").eq("id", data.user.id).maybeSingle();
  if (!p?.active) {
    await c.auth.signOut();
    return { ok: false, error: "staff_inactive" };
  }
  if (p.role === "pending") {
    await c.auth.signOut();
    return { ok: false, error: "staff_pending" };
  }
  return { ok: true, token: "" };
}

export async function staffRegister(name: string, email: string, password: string): Promise<{ role: Role }> {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new AppError("invalid_email");
  if (password.length < 10) throw new AppError("weak_password");
  const c = await db();
  const { error } = await c.auth.signUp({ email: e, password, options: { data: { full_name: name.trim().slice(0, 80) }, emailRedirectTo: `${SITE()}/auth/callback?next=/equipo/panel` } });
  if (error) throw new AppError(/registered|exists/i.test(error.message) ? "email_taken" : "unexpected");
  const { data } = await adminClient().from("staff_invites").select("role").eq("email", e).maybeSingle();
  return { role: ((data?.role as Role | undefined) ?? "pending") };
}

export async function googleSignInUrl(next = "/equipo/panel"): Promise<string> {
  const c = await db();
  const { data, error } = await c.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${SITE()}/auth/callback?next=${encodeURIComponent(next)}` } });
  if (error || !data.url) fail(error);
  return data.url;
}

export async function staffSignOut() {
  await (await db()).auth.signOut();
}

/** The current staff profile, or null (also null for pending or inactive accounts). */
export async function currentProfile(): Promise<Profile | null> {
  const c = await db();
  const { data: u } = await c.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await c.from("profiles").select("id,display_name,email,role,active,created_at").eq("id", u.user.id).maybeSingle();
  if (!p || !p.active || p.role === "pending") return null;
  return { ...(p as Omit<Profile, "password_hash">), password_hash: "" };
}

// ---------- Groups and codes ----------
export const suggestGroup = async (_p: Profile, year: number, month: number) => call<R<typeof L.suggestGroup>>("staff_suggest_group", { p_year: year, p_month: month });
export const createGroup = async (_p: Profile, i: Parameters<typeof L.createGroup>[1]) =>
  call<R<typeof L.createGroup>>("staff_create_group", { p_year: i.year, p_month: i.month, p_letter: i.letter, p_community: i.communityId, p_students: i.students, p_ends_on: i.endsOn, p_label: i.label });
export const addStudents = async (_p: Profile, groupId: string, students: { nickname: string; pin?: string }[]) => call<R<typeof L.addStudents>>("staff_add_students", { p_group: groupId, p_students: students });
export const resetPin = async (_p: Profile, studentId: string) => call<R<typeof L.resetPin>>("staff_reset_pin", { p_student: studentId });
export const unlockStudent = async (_p: Profile, studentId: string) => call<R<typeof L.unlockStudent>>("staff_unlock_student", { p_student: studentId });
export const setStudentsStatus = async (_p: Profile, ids: string[], status: "active" | "inactive") => call<R<typeof L.setStudentsStatus>>("staff_set_students_status", { p_students: ids, p_status: status });
export const setGroupStatus = async (_p: Profile, groupId: string, status: "active" | "closed") => call<R<typeof L.setGroupStatus>>("staff_set_group_status", { p_group: groupId, p_status: status });
export const updateGroup = async (_p: Profile, groupId: string, label: string, endsOn: string | null) => call<R<typeof L.updateGroup>>("staff_update_group", { p_group: groupId, p_label: label, p_ends_on: endsOn });
export const assignCourse = async (_p: Profile, groupId: string, courseId: string, assign: boolean) => call<R<typeof L.assignCourse>>("staff_assign_course", { p_group: groupId, p_course: courseId, p_assign: assign });
export const recordConsent = async (_p: Profile, studentId: string, consent: boolean, reference: string) =>
  call<R<typeof L.recordConsent>>("staff_record_consent", { p_student: studentId, p_consent: consent, p_reference: reference });
export async function addNote(p: Profile, studentId: string, body: string) {
  if (!body.trim()) throw new AppError("invalid_note");
  ok(await (await db()).from("student_notes").insert({ student_id: studentId, author_id: p.id, body: body.trim().slice(0, 4000) }));
}

// ---------- Read models ----------
export const listGroups = async (_p: Profile) => call<R<typeof L.listGroups>>("staff_groups");
export const dashboard = async (_p: Profile) => call<R<typeof L.dashboard>>("staff_dashboard");
export const groupDetail = async (_p: Profile, groupId: string) => {
  try {
    return await call<R<typeof L.groupDetail>>("staff_group_detail", { p_group: groupId });
  } catch (e) {
    if (e instanceof AppError && ["forbidden", "not_found", "group_not_found"].includes(e.code)) return null;
    throw e;
  }
};
export const studentDetail = async (_p: Profile, studentId: string) => {
  try {
    return await call<R<typeof L.studentDetail>>("staff_student_detail", { p_student: studentId });
  } catch (e) {
    if (e instanceof AppError && ["forbidden", "not_found", "student_not_found"].includes(e.code)) return null;
    throw e;
  }
};
export const staffProject = async (_p: Profile, projectId: string) => {
  try {
    return await call<R<typeof L.staffProject>>("staff_project", { p_project: projectId });
  } catch (e) {
    if (e instanceof AppError) return null;
    throw e;
  }
};
export const exportStudent = async (_p: Profile, studentId: string) => call<R<typeof L.exportStudent>>("staff_export_student", { p_student: studentId });
export const deleteStudent = async (_p: Profile, studentId: string, confirm: string) => call<R<typeof L.deleteStudent>>("staff_delete_student", { p_student: studentId, p_confirm: confirm });

// ---------- Logros ----------
export const listLogros = async (_p: Profile) => call<R<typeof L.listLogros>>("staff_logros");
export const nominate = async (_p: Profile, i: { studentId: string; projectId: string | null; kind: AccomplishmentKind; title: string; blurb: string; tags: string[] }) =>
  call<R<typeof L.nominate>>("staff_nominate", { p_student: i.studentId, p_project: i.projectId, p_kind: i.kind, p_title: i.title, p_blurb: i.blurb, p_tags: i.tags });
export const updateNomination = async (_p: Profile, id: string, i: { title: string; blurb: string; tags: string[]; kind: AccomplishmentKind }) =>
  call<R<typeof L.updateNomination>>("staff_update_nomination", { p_id: id, p_title: i.title, p_blurb: i.blurb, p_tags: i.tags, p_kind: i.kind });
export const reviewLogro = async (_p: Profile, id: string, action: string) => call<R<typeof L.reviewLogro>>("founder_review_logro", { p_id: id, p_action: action });

// ---------- Founder ----------
export const staffDirectory = async (_p: Profile) => call<R<typeof L.staffDirectory>>("founder_staff");
export const invite = async (_p: Profile, email: string, role: "educator" | "founder") => call<R<typeof L.invite>>("founder_invite", { p_email: email.trim().toLowerCase(), p_role: role });
export const setStaff = async (_p: Profile, profileId: string, role: Role, active: boolean, confirm: string) =>
  call<R<typeof L.setStaff>>("founder_set_staff", { p_profile: profileId, p_role: role, p_active: active, p_confirm: confirm || null });
export const assignGroup = async (_p: Profile, educatorId: string, groupId: string, assign: boolean) => call<R<typeof L.assignGroup>>("founder_assign_group", { p_educator: educatorId, p_group: groupId, p_assign: assign });
export const reassignGroups = async (_p: Profile, from: string, to: string) => call<R<typeof L.reassignGroups>>("founder_reassign_groups", { p_from: from, p_to: to });
export const stats = async (_p: Profile) => call<R<typeof L.stats>>("founder_stats");
export const audit = async (_p: Profile, limit = 150) => call<R<typeof L.audit>>("founder_audit", { p_limit: limit });
export const search = async (_p: Profile, q: string) => call<R<typeof L.search>>("founder_search", { p_query: q });

export async function settings(p: Profile) {
  if (p.role !== "founder") throw new AppError("forbidden");
  const c = await db();
  const [rows, communities] = await Promise.all([c.from("app_settings").select("key,value"), c.from("communities").select("id,slug,name,state,since_year,position,active").order("position")]);
  const s = Object.fromEntries((ok(rows) ?? []).map((r: Row) => [r.key as string, r.value])) as unknown as Settings;
  return { settings: s, communities: ok(communities) as R<typeof L.settings>["communities"] };
}
export async function updateSettings(_p: Profile, patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) await call("founder_update_setting", { p_key: key, p_value: value });
}
export async function upsertCommunity(p: Profile, input: { id?: string; name: string; since_year: number | null; active: boolean }) {
  if (p.role !== "founder") throw new AppError("forbidden");
  const name = input.name.trim();
  if (!name) throw new AppError("invalid_name");
  const c = await db();
  if (input.id) {
    ok(await c.from("communities").update({ name, since_year: input.since_year, active: input.active }).eq("id", input.id));
  } else {
    const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { count } = await c.from("communities").select("id", { count: "exact", head: true });
    ok(await c.from("communities").insert({ slug, name, since_year: input.since_year, active: input.active, position: (count ?? 0) + 1 }));
  }
}

// ---------- Lessons ----------
const LESSON_COLS = "id,module_id,slug,title,summary,content_md,language,visibility,pair_lesson_id,position,estimated_minutes,xp_reward,status,version,created_by,updated_at";
const editable = (p: Profile, l: { created_by: string | null }) => p.role === "founder" || l.created_by === p.id;

export async function lessonLibrary(p: Profile) {
  const c = await db();
  const [courses, lessons] = await Promise.all([
    c.from("courses").select("id,slug,title,description,status,position,created_by,modules(id,course_id,slug,title,position,status)").order("position"),
    c.from("lessons").select("id,slug,title,language,visibility,status,updated_at,position,created_by,module:modules(course:courses(title)),pair:lessons!pair_lesson_id(title),exercises(count)").order("position"),
  ]);
  return {
    courses: (ok(courses) as Row[]).map((x) => ({ ...x, modules: ((x.modules as Row[]) ?? []).sort((a, b) => (a.position as number) - (b.position as number)) })) as unknown as R<typeof L.lessonLibrary>["courses"],
    lessons: (ok(lessons) as Row[]).map((l) => ({
      id: l.id as string, slug: l.slug as string, title: l.title as string, language: l.language as CodeLanguage,
      visibility: l.visibility as Lesson["visibility"], status: l.status as Lesson["status"], updated_at: l.updated_at as string,
      course: ((l.module as { course?: { title?: string } } | null)?.course?.title as string | undefined) ?? null,
      exercises: ((l.exercises as { count: number }[] | undefined)?.[0]?.count as number) ?? 0,
      pair: ((l.pair as { title?: string } | null)?.title as string | undefined) ?? null,
      editable: editable(p, l as { created_by: string | null }),
    })),
  };
}

const EX_COLS = "id,lesson_id,slug,position,type,title,instructions_md,starter_code,config,xp_reward,required,timeout_ms,version,exercise_tests(id,kind,description,spec,hidden,position),exercise_hints(content_md,position),exercise_solutions(solution_code,answer,explanation_md,known_wrong_solutions,validated_at,validated_fingerprint)";
function toExercise(e: Row): Exercise {
  const sol = (Array.isArray(e.exercise_solutions) ? (e.exercise_solutions as Row[])[0] : (e.exercise_solutions as Row | null)) ?? null;
  return {
    id: e.id as string, lesson_id: e.lesson_id as string, slug: e.slug as string, position: e.position as number, type: e.type as Exercise["type"], title: e.title as string,
    instructions_md: e.instructions_md as string, starter_code: e.starter_code as string, config: e.config as Record<string, unknown>, xp_reward: e.xp_reward as number,
    required: e.required as boolean, timeout_ms: e.timeout_ms as number, version: e.version as number,
    tests: ((e.exercise_tests as Row[]) ?? []).sort((a, b) => (a.position as number) - (b.position as number)).map((t) => ({ id: t.id as string, kind: t.kind as never, description: t.description as string, spec: t.spec as Record<string, unknown>, hidden: t.hidden as boolean })),
    hints: ((e.exercise_hints as Row[]) ?? []).sort((a, b) => (a.position as number) - (b.position as number)).map((h) => h.content_md as string),
    solution: {
      solution_code: (sol?.solution_code as string) ?? "", answer: sol?.answer ?? null, explanation_md: (sol?.explanation_md as string) ?? "",
      known_wrong_solutions: (sol?.known_wrong_solutions as string[]) ?? [], validated_at: (sol?.validated_at as string | null) ?? null, validated_fingerprint: (sol?.validated_fingerprint as string | null) ?? null,
    },
  };
}

export async function lessonForEdit(p: Profile, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const c = await db();
  const l = ok(await c.from("lessons").select(LESSON_COLS).eq("id", id).maybeSingle()) as Lesson | null;
  if (!l) return null;
  const [ex, deck, mods, others] = await Promise.all([
    c.from("exercises").select(EX_COLS).eq("lesson_id", id).order("position"),
    c.from("slide_decks").select("id,lesson_id,title,slides,status,version").eq("lesson_id", id).maybeSingle(),
    c.from("modules").select("id,title,course:courses(title)").order("position"),
    c.from("lessons").select("id,title,language").neq("id", id).neq("language", l.language),
  ]);
  return {
    lesson: l,
    editable: editable(p, l),
    exercises: (ok(ex) as Row[]).map(toExercise),
    deck: ok(deck) as NonNullable<R<typeof L.lessonForEdit>>["deck"],
    modules: (ok(mods) as Row[]).map((m) => ({ id: m.id as string, title: m.title as string, course: ((m.course as { title?: string } | null)?.title as string) ?? "" })),
    otherLessons: ok(others) as { id: string; title: string; language: CodeLanguage }[],
  };
}

export async function createLesson(p: Profile, input: { title: string; slug: string; language: CodeLanguage; visibility: "public" | "program" | "draft"; module_id: string | null }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new AppError("invalid_slug");
  if (input.visibility === "program" && !input.module_id) throw new AppError("program_needs_module");
  const c = await db();
  let q = c.from("lessons").select("position").order("position", { ascending: false }).limit(1);
  q = input.module_id ? q.eq("module_id", input.module_id) : q.is("module_id", null);
  const last = ok(await q) as { position: number }[];
  const { data, error } = await c
    .from("lessons")
    .insert({ module_id: input.module_id, slug: input.slug, title: input.title.trim().slice(0, 160), language: input.language, visibility: input.visibility, status: "draft", created_by: p.id, position: (last[0]?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new AppError("already_exists");
    fail(error);
  }
  return data.id as string;
}

export async function updateLesson(p: Profile, id: string, patch: Partial<Pick<Lesson, "title" | "summary" | "content_md" | "visibility" | "pair_lesson_id" | "estimated_minutes" | "xp_reward" | "module_id" | "language">>, expectedVersion?: number) {
  const c = await db();
  const l = ok(await c.from("lessons").select("id,language,visibility,status,version,created_by").eq("id", id).maybeSingle()) as Lesson | null;
  if (!l || !editable(p, l)) throw new AppError("forbidden");
  if (expectedVersion !== undefined && expectedVersion !== l.version) throw new AppError("version_conflict");
  if (patch.language && patch.language !== l.language) {
    const v = ok(await c.from("exercises").select("id,exercise_solutions!inner(validated_fingerprint)").eq("lesson_id", id).not("exercise_solutions.validated_fingerprint", "is", null).limit(1)) as Row[];
    if (v.length) throw new AppError("language_locked");
  }
  if ((patch.visibility ?? l.visibility) === "public" && l.status === "published" && p.role !== "founder") throw new AppError("founder_publishes_public");
  let q = c.from("lessons").update(patch).eq("id", id);
  if (expectedVersion !== undefined) q = q.eq("version", expectedVersion);
  const rows = ok(await q.select("version")) as { version: number }[];
  if (!rows.length) throw new AppError("version_conflict");
  return rows[0].version;
}

export const setLessonStatus = async (_p: Profile, id: string, status: Lesson["status"]) => call<void>("staff_set_status", { p_entity: "lesson", p_id: id, p_status: status });

export async function saveExercise(_p: Profile, lessonId: string, input: Parameters<typeof L.saveExercise>[2]) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new AppError("invalid_slug");
  const payload: Record<string, unknown> = {
    ...(input.id ? { id: input.id } : {}),
    lesson_id: lessonId, slug: input.slug, type: input.type, title: input.title, instructions_md: input.instructions_md, starter_code: input.starter_code,
    config: input.config, xp_reward: input.xp_reward, required: input.required, timeout_ms: input.timeout_ms,
    tests: input.tests.map((t) => ({ kind: t.kind, description: t.description, spec: t.spec, hidden: t.hidden })),
    hints: input.hints,
    solution: { solution_code: input.solution.solution_code, answer: input.solution.answer, explanation_md: input.solution.explanation_md },
    known_wrong_solutions: input.solution.known_wrong_solutions ?? [],
  };
  if (input.validated && input.fingerprint) payload.validated_fingerprint = input.fingerprint;
  try {
    const r = await call<{ id: string }>("staff_save_exercise_bundle", { p_payload: payload });
    return r.id;
  } catch (e) {
    if (e instanceof AppError && e.code === "unexpected") throw new AppError("already_exists");
    throw e;
  }
}
export const deleteExercise = async (_p: Profile, lessonId: string, exerciseId: string) => call<void>("staff_delete_exercise", { p_lesson: lessonId, p_exercise: exerciseId });
export const reorderExercises = async (_p: Profile, lessonId: string, ids: string[]) => call<void>("reorder_items", { p_table: "exercises", p_parent: lessonId, p_ordered_ids: ids });
export const duplicateLesson = async (_p: Profile, id: string) => call<string>("staff_duplicate_lesson", { p_lesson: id });

export async function saveDeck(p: Profile, lessonId: string, title: string, slides: unknown, status: "draft" | "published") {
  const c = await db();
  const existing = ok(await c.from("slide_decks").select("id").eq("lesson_id", lessonId).maybeSingle()) as { id: string } | null;
  if (existing) ok(await c.from("slide_decks").update({ title, slides, status }).eq("id", existing.id));
  else ok(await c.from("slide_decks").insert({ lesson_id: lessonId, title, slides, status, created_by: p.id }));
}

export async function exportCourse(courseId: string) {
  const c = await db();
  const course = ok(await c.from("courses").select("id,slug,title,description,status,position,created_by").eq("id", courseId).maybeSingle());
  if (!course) throw new AppError("not_found");
  const mods = ok(await c.from("modules").select("id,course_id,slug,title,position,status").eq("course_id", courseId).order("position")) as Row[];
  const out = [];
  for (const m of mods) {
    const lessons = ok(await c.from("lessons").select(LESSON_COLS).eq("module_id", m.id as string).order("position")) as Lesson[];
    const full = [];
    for (const l of lessons) {
      const ex = (ok(await c.from("exercises").select(EX_COLS).eq("lesson_id", l.id).order("position")) as Row[]).map(toExercise);
      const deck = ok(await c.from("slide_decks").select("id,lesson_id,title,slides,status,version").eq("lesson_id", l.id).maybeSingle());
      full.push({ ...l, exercises: ex, deck });
    }
    out.push({ ...m, lessons: full });
  }
  return { format: "codeher-course@1", course, modules: out };
}

// ---------- Friendly errors ----------
export async function errorCatalogAll() {
  return ok(await (await db()).from("error_translations").select("id,language,error_type,pattern,message_es,explanation_es,suggestion_es,priority,enabled").order("priority")) as ErrorTranslation[];
}
export async function saveErrorRow(_p: Profile, row: Parameters<typeof L.saveErrorRow>[1]) {
  if (row.pattern) {
    try {
      new RegExp(row.pattern);
    } catch {
      throw new AppError("invalid_pattern");
    }
  }
  const c = await db();
  const { id, ...rest } = row;
  if (id) ok(await c.from("error_translations").update(rest).eq("id", id));
  else ok(await c.from("error_translations").insert(rest));
}

// ---------- API keys for the MCP server ----------
export const createApiKey = async (_p: Profile, name: string) => call<{ id: string; token: string }>("staff_create_api_key", { p_name: name });
export const listApiKeys = async (p: Profile) =>
  (await call<(Omit<R<typeof L.listApiKeys>[number], "key_prefix" | "owner_id"> & { prefix: string })[]>("staff_api_keys")).map(({ prefix, ...k }) => ({ ...k, key_prefix: prefix, owner_id: p.id }));
export const revokeApiKey = async (_p: Profile, id: string) => call<void>("staff_revoke_api_key", { p_id: id });

/** MCP requests carry an API key, not a browser session, so this lookup uses the secret key. */
export async function profileFromApiKey(token: string): Promise<Profile | null> {
  const a = adminClient();
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: k } = await a.from("api_keys").select("id,owner_id,revoked_at,expires_at").eq("key_hash", hash).maybeSingle();
  if (!k || k.revoked_at || Date.parse(k.expires_at as string) < Date.now()) return null;
  const { data: p } = await a.from("profiles").select("id,display_name,email,role,active,created_at").eq("id", k.owner_id).maybeSingle();
  if (!p || !p.active || p.role === "pending") return null;
  await a.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);
  return { ...(p as Omit<Profile, "password_hash">), password_hash: "" };
}

export const setGroupRecreo = async (_p: Profile, groupId: string, enabled: boolean) => call<void>("staff_set_group_recreo", { p_group: groupId, p_enabled: enabled });
