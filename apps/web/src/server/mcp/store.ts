import "server-only";
// Data access for the MCP server, acting as the API key's owner. The MCP request has no
// browser session, so in Supabase mode reads use the server-only secret key with the same
// visibility rules as RLS, and writes go through the mcp_* SQL wrappers (0011), which
// impersonate the key owner and call the exact functions the website uses. Founders have
// full control; educators control the courses and lessons they created.
// MCP_DRAFTS_ONLY=true restores the old safety mode (Claude cannot touch published lessons
// or publish anything).
import { checkPublishable, PYTHON_CONSTRUCTS, type CodeLanguage } from "@codeher/core";
import { CONSTRUCT_NAMES, parses } from "@codeher/grader/pseudo";
import type { Exercise, Lesson, Profile } from "../db/types";
import { AppError } from "../errors";
import { SUPABASE, adminClient, fail } from "../supabase";
import * as Local from "../services/local/staff";
import { read, write } from "../db/store";

type Row = Record<string, unknown>;
type Status = Lesson["status"];
export const draftsOnly = () => process.env.MCP_DRAFTS_ONLY === "true";
const canEdit = (p: Profile, l: { created_by?: unknown }) => p.role === "founder" || l.created_by === p.id;
const canRead = (p: Profile, l: { created_by?: unknown; status?: unknown }) => p.role === "founder" || l.status === "published" || l.created_by === p.id;
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
function ok<T>(r: { data: T | null; error: { message?: string; code?: string } | null }): T {
  if (r.error) {
    if (/duplicate|unique/i.test(r.error.message ?? "") || r.error.code === "23505") throw new AppError("already_exists");
    fail(r.error);
  }
  return r.data as T;
}
async function audit(p: Profile, keyId: string, action: string, type: string, id: string | null, payload: Row = {}) {
  if (!SUPABASE) return;
  await adminClient().from("content_audit_log").insert({ actor_id: p.id, actor_kind: "mcp", api_key_id: keyId, action, entity_type: type, entity_id: id, payload });
}
/** Calls an mcp_* wrapper as the key owner (Supabase mode). */
async function act<T>(p: Profile, fn: string, args: Row): Promise<T> {
  const { data, error } = await adminClient().rpc(`mcp_${fn}`, { p_actor: p.id, ...args });
  if (error) fail(error);
  return data as T;
}

// ---------- Courses ----------
export async function listCourses(p: Profile) {
  if (!SUPABASE) {
    const cards = Local.courseList(p);
    return read((db) =>
      cards.map((c) => ({
        ...c,
        modules: db.modules.filter((m) => m.course_id === c.id).sort((a, b) => a.position - b.position)
          .map((m) => ({ id: m.id, slug: m.slug, title: m.title, status: m.status, lessons: db.lessons.filter((l) => l.module_id === m.id).length })),
      })),
    );
  }
  const rows = ok(await adminClient().from("courses").select("id,slug,title,description,status,position,created_by,modules(id,slug,title,status,position,lessons(count)),group_courses(count)").order("position")) as Row[];
  return rows.filter((c) => canRead(p, c)).map((c) => {
    const mods = ((c.modules as Row[]) ?? []).sort((a, b) => (a.position as number) - (b.position as number));
    return {
      id: c.id, slug: c.slug, title: c.title, description: c.description, status: c.status, editable: canEdit(p, c),
      groups: ((c.group_courses as { count: number }[] | undefined)?.[0]?.count) ?? 0,
      modules: mods.map((m) => ({ id: m.id, slug: m.slug, title: m.title, status: m.status, lessons: ((m.lessons as { count: number }[] | undefined)?.[0]?.count) ?? 0 })),
    };
  });
}

async function courseId(idOrSlug: string): Promise<string> {
  if (!SUPABASE) {
    const id = read((db) => db.courses.find((c) => c.id === idOrSlug || c.slug === idOrSlug)?.id);
    if (!id) throw new AppError("not_found");
    return id;
  }
  const r = ok(await adminClient().from("courses").select("id").eq(isUuid(idOrSlug) ? "id" : "slug", idOrSlug).maybeSingle()) as { id: string } | null;
  if (!r) throw new AppError("not_found");
  return r.id;
}

export async function getCourse(p: Profile, idOrSlug: string) {
  const id = await courseId(idOrSlug);
  if (!SUPABASE) {
    const d = Local.courseDetail(p, id);
    if (!d) throw new AppError("not_found");
    return d;
  }
  const a = adminClient();
  const course = ok(await a.from("courses").select("id,slug,title,description,status,created_by").eq("id", id).maybeSingle()) as Row | null;
  if (!course || !canRead(p, course)) throw new AppError("not_found");
  const mods = ok(await a.from("modules").select("id,slug,title,status,position").eq("course_id", id).order("position")) as Row[];
  const lessons = mods.length
    ? (ok(await a.from("lessons").select("id,slug,title,language,visibility,status,created_by,position,module_id,exercises(count)").in("module_id", mods.map((m) => m.id as string)).order("position")) as Row[])
    : [];
  const editable = canEdit(p, course);
  return {
    course,
    editable,
    usage: editable ? await act<{ groups: number; students: number }>(p, "course_usage", { p_course: id }) : null,
    modules: mods.map((m) => ({
      ...m,
      lessons: lessons.filter((l) => l.module_id === m.id && canRead(p, l)).map(({ exercises, module_id: _m, created_by, ...l }) => ({
        ...l, exercises: ((exercises as { count: number }[] | undefined)?.[0]?.count) ?? 0, editable: p.role === "founder" || created_by === p.id,
      })),
    })),
  };
}

export async function saveCourse(p: Profile, keyId: string, input: { id?: string; slug: string; title: string; description: string; firstModule?: string }) {
  if (!SUPABASE) return Local.saveCourse(p, input);
  const id = await act<string>(p, "save_course", { p_id: input.id ?? null, p_slug: input.slug, p_title: input.title, p_description: input.description, p_first_module: input.firstModule ?? null });
  await audit(p, keyId, input.id ? "update" : "create", "course", id, { slug: input.slug });
  return id;
}

export async function deleteCourse(p: Profile, keyId: string, id: string, confirm: string, deleteLessons: boolean) {
  if (!SUPABASE) return Local.deleteCourse(p, id, confirm, deleteLessons);
  const r = await act<{ deleted: number; detached: number }>(p, "delete_course", { p_id: id, p_confirm: confirm, p_delete_lessons: deleteLessons });
  await audit(p, keyId, "delete", "course", id, r);
  return r;
}

// ---------- Modules ----------
export async function saveModule(p: Profile, keyId: string, input: { id?: string; courseId: string; title: string }) {
  if (!SUPABASE) return Local.saveModule(p, input);
  const id = await act<string>(p, "save_module", { p_id: input.id ?? null, p_course: input.courseId || null, p_title: input.title });
  await audit(p, keyId, input.id ? "update" : "create", "module", id);
  return id;
}

export async function deleteModule(p: Profile, keyId: string, id: string, deleteLessons: boolean) {
  if (!SUPABASE) return Local.deleteModule(p, id, deleteLessons);
  const r = await act<{ deleted: number; detached: number }>(p, "delete_module", { p_id: id, p_delete_lessons: deleteLessons });
  await audit(p, keyId, "delete", "module", id, r);
  return r;
}

export async function reorder(p: Profile, keyId: string, table: "modules" | "lessons" | "exercises", parent: string, ids: string[]) {
  if (table === "exercises") await requireEditable(p, parent);
  if (!SUPABASE) {
    if (table === "modules") return Local.reorderModules(p, parent, ids);
    if (table === "lessons") return Local.reorderLessons(p, parent, ids);
    return Local.reorderExercises(p, parent, ids);
  }
  await act<void>(p, "reorder", { p_table: table, p_parent: parent, p_ordered_ids: ids });
  await audit(p, keyId, "reorder", table, parent, { count: ids.length });
}

// ---------- Lessons ----------
export async function listLessons(p: Profile, f: { language?: CodeLanguage; status?: string; unassigned?: boolean }) {
  if (!SUPABASE) {
    const lib = Local.lessonLibrary(p).lessons;
    const free = new Set(read((db) => db.lessons.filter((l) => !l.module_id).map((l) => l.id)));
    return lib.filter((l) => (!f.language || l.language === f.language) && (!f.status || l.status === f.status) && (!f.unassigned || free.has(l.id)));
  }
  let q = adminClient().from("lessons").select("id,slug,title,language,visibility,status,created_by,updated_at,module_id,module:modules(title,course:courses(title)),exercises(count)").order("position");
  if (f.language) q = q.eq("language", f.language);
  if (f.status) q = q.eq("status", f.status);
  if (f.unassigned) q = q.is("module_id", null);
  return (ok(await q) as Row[])
    .filter((l) => canRead(p, l))
    .map((l) => ({
      id: l.id, slug: l.slug, title: l.title, language: l.language, visibility: l.visibility, status: l.status, updated_at: l.updated_at, module_id: l.module_id,
      course: ((l.module as { course?: { title?: string } } | null)?.course?.title) ?? null,
      module: ((l.module as { title?: string } | null)?.title) ?? null,
      exercises: ((l.exercises as { count: number }[] | undefined)?.[0]?.count) ?? 0,
      editable: canEdit(p, l),
    }));
}

const EX = "id,slug,position,type,title,instructions_md,starter_code,config,xp_reward,required,timeout_ms,exercise_tests(kind,description,spec,hidden,position),exercise_hints(content_md,position),exercise_solutions(solution_code,answer,explanation_md,known_wrong_solutions,validated_fingerprint)";
async function lessonRow(idOrSlug: string): Promise<Lesson | null> {
  const col = isUuid(idOrSlug) ? "id" : "slug";
  if (!SUPABASE) return read((db) => db.lessons.find((l) => (col === "id" ? l.id : l.slug) === idOrSlug) ?? null);
  return ok(await adminClient().from("lessons").select("id,module_id,slug,title,summary,content_md,language,visibility,pair_lesson_id,position,estimated_minutes,xp_reward,status,version,created_by,updated_at").eq(col, idOrSlug).maybeSingle()) as Lesson | null;
}

type FullExercise = { id: string; slug: string; position: number; type: Exercise["type"]; title: string; instructions_md: string; starter_code: string; config: unknown; xp_reward: number; required: boolean; timeout_ms: number; tests: { kind: string; description: string; spec: Record<string, unknown>; hidden: boolean }[]; hints: string[]; validated: boolean; solution: { solution_code: string; answer: unknown; explanation_md: string; known_wrong_solutions: string[] } | null };

async function exercisesOf(lessonId: string): Promise<FullExercise[]> {
  if (!SUPABASE) {
    return read((db) => db.exercises.filter((e) => e.lesson_id === lessonId).sort((a, b) => a.position - b.position)).map((e) => ({
      id: e.id, slug: e.slug, position: e.position, type: e.type, title: e.title, instructions_md: e.instructions_md, starter_code: e.starter_code, config: e.config,
      xp_reward: e.xp_reward, required: e.required, timeout_ms: e.timeout_ms, tests: e.tests.map(({ kind, description, spec, hidden }) => ({ kind, description, spec, hidden })), hints: e.hints,
      validated: !!e.solution.validated_fingerprint,
      solution: { solution_code: e.solution.solution_code, answer: e.solution.answer, explanation_md: e.solution.explanation_md, known_wrong_solutions: e.solution.known_wrong_solutions },
    }));
  }
  const by = (a: Row, b: Row) => (a.position as number) - (b.position as number);
  return (ok(await adminClient().from("exercises").select(EX).eq("lesson_id", lessonId).order("position")) as Row[]).map((e) => {
    const sol = (Array.isArray(e.exercise_solutions) ? (e.exercise_solutions as Row[])[0] : (e.exercise_solutions as Row | null)) ?? null;
    return {
      id: e.id as string, slug: e.slug as string, position: e.position as number, type: e.type as Exercise["type"], title: e.title as string, instructions_md: e.instructions_md as string,
      starter_code: e.starter_code as string, config: e.config, xp_reward: e.xp_reward as number, required: e.required as boolean, timeout_ms: e.timeout_ms as number,
      tests: ((e.exercise_tests as Row[]) ?? []).sort(by).map(({ position: _p, ...t }) => t as FullExercise["tests"][number]),
      hints: ((e.exercise_hints as Row[]) ?? []).sort(by).map((h) => h.content_md as string),
      validated: !!sol?.validated_fingerprint,
      solution: sol ? { solution_code: (sol.solution_code as string) ?? "", answer: sol.answer, explanation_md: (sol.explanation_md as string) ?? "", known_wrong_solutions: (sol.known_wrong_solutions as string[]) ?? [] } : null,
    };
  });
}
async function deckOf(lessonId: string): Promise<{ title: string; slides: unknown; status: string } | null> {
  if (!SUPABASE) return read((db) => { const d = db.decks.find((x) => x.lesson_id === lessonId); return d ? { title: d.title, slides: d.slides, status: d.status } : null; });
  return ok(await adminClient().from("slide_decks").select("title,slides,status").eq("lesson_id", lessonId).maybeSingle()) as { title: string; slides: unknown; status: string } | null;
}

export async function getLesson(p: Profile, idOrSlug: string) {
  const l = await lessonRow(idOrSlug);
  if (!l || !canRead(p, l)) throw new AppError("not_found");
  const editable = canEdit(p, l);
  const [exercises, deck] = await Promise.all([exercisesOf(l.id), deckOf(l.id)]);
  return {
    lesson: l,
    editable,
    exercises: exercises.map((e) => ({ ...e, solution: editable ? e.solution : undefined })),
    deck,
    publish_check: editable ? publishCheck(l, exercises, deck) : undefined,
  };
}

/** Same checks as the editor's "Publicar" tab. */
function publishCheck(l: Lesson, ex: FullExercise[], deck: { slides: unknown } | null) {
  const pseudo = l.language === "pseudocode_es";
  return checkPublishable({
    title: l.title,
    content_md: l.content_md,
    language: l.language,
    exercises: ex.map((e) => ({
      slug: e.slug, type: e.type, required: e.required, hints: e.hints,
      tests: e.tests.map((t) => ({ kind: t.kind as never, description: t.description, spec: t.spec })),
      hasSolution: e.type === "code" ? !!e.solution?.solution_code.trim() : !!e.solution?.answer,
      validationMatches: e.type !== "code" || e.validated,
      starterParses: pseudo ? parses(e.starter_code) : true,
      solutionParses: pseudo ? parses(e.solution?.solution_code ?? "") : true,
      wrongSolutionsParse: pseudo ? (e.solution?.known_wrong_solutions ?? []).every(parses) : true,
      hasAnswer: !!e.solution?.answer,
    })),
    runnableFencesOk: true,
    constructNames: pseudo ? CONSTRUCT_NAMES : PYTHON_CONSTRUCTS,
    slideDeck: deck?.slides,
  });
}

/** The key owner must be able to edit the lesson (and, in drafts-only mode, it must be a draft). */
export async function requireEditable(p: Profile, lessonId: string): Promise<Lesson> {
  const l = await lessonRow(lessonId);
  if (!l) throw new AppError("not_found");
  if (!canEdit(p, l)) throw new AppError("forbidden");
  if (draftsOnly() && (l.status === "published" || l.status === "archived")) throw new AppError("lesson_not_draft");
  return l;
}

export async function createLesson(p: Profile, keyId: string, input: { title: string; slug: string; language: CodeLanguage; visibility: "public" | "program" | "draft"; module_id: string | null; summary: string; content_md: string; estimated_minutes: number; xp_reward: number }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new AppError("invalid_slug");
  if (input.visibility === "program" && !input.module_id) throw new AppError("program_needs_module");
  if (!SUPABASE) {
    const id = Local.createLesson(p, input);
    Local.updateLesson(p, id, { summary: input.summary, content_md: input.content_md, estimated_minutes: input.estimated_minutes, xp_reward: input.xp_reward });
    return id;
  }
  const a = adminClient();
  if (input.module_id && !(ok(await a.from("modules").select("id").eq("id", input.module_id).maybeSingle()))) throw new AppError("not_found");
  let q = a.from("lessons").select("position").order("position", { ascending: false }).limit(1);
  q = input.module_id ? q.eq("module_id", input.module_id) : q.is("module_id", null);
  const last = ok(await q) as { position: number }[];
  const row = ok(await a.from("lessons").insert({ ...input, status: "draft", created_by: p.id, position: (last[0]?.position ?? 0) + 1 }).select("id").single()) as { id: string };
  await audit(p, keyId, "create", "lesson", row.id, { slug: input.slug });
  return row.id;
}

export async function updateLesson(p: Profile, keyId: string, id: string, patch: Partial<Pick<Lesson, "title" | "slug" | "summary" | "content_md" | "visibility" | "estimated_minutes" | "xp_reward" | "module_id" | "pair_lesson_id" | "language">>) {
  const l = await requireEditable(p, id);
  if (patch.slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(patch.slug)) throw new AppError("invalid_slug");
  if ((patch.visibility ?? l.visibility) === "public" && l.status === "published" && p.role !== "founder") throw new AppError("founder_publishes_public");
  if (patch.language && patch.language !== l.language && (await exercisesOf(id)).some((e) => e.validated)) throw new AppError("language_locked");
  if (!SUPABASE) {
    const { slug, ...rest } = patch;
    const v = Local.updateLesson(p, id, rest);
    if (slug !== undefined && slug !== l.slug) {
      write((db) => {
        if (db.lessons.some((x) => x.slug === slug && x.id !== id)) throw new AppError("already_exists");
        db.lessons.find((x) => x.id === id)!.slug = slug;
      });
    }
    return v;
  }
  const { module_id: moveTo, ...rest } = patch;
  if (moveTo !== undefined && moveTo !== l.module_id) await act<void>(p, "move_lesson", { p_lesson: id, p_module: moveTo });
  let version = l.version;
  if (Object.keys(rest).length) version = (ok(await adminClient().from("lessons").update(rest).eq("id", id).select("version").single()) as { version: number }).version;
  await audit(p, keyId, "update", "lesson", id, { fields: Object.keys(patch) });
  return version;
}

export async function moveLesson(p: Profile, keyId: string, lessonId: string, moduleId: string | null) {
  if (!SUPABASE) return Local.moveLesson(p, lessonId, moduleId);
  await act<void>(p, "move_lesson", { p_lesson: lessonId, p_module: moduleId });
  await audit(p, keyId, "move", "lesson", lessonId, { to: moduleId });
}

export async function duplicateLesson(p: Profile, keyId: string, lessonId: string) {
  if (!SUPABASE) return Local.duplicateLesson(p, lessonId);
  const id = await act<string>(p, "duplicate_lesson", { p_lesson: lessonId });
  await audit(p, keyId, "duplicate", "lesson", id, { from: lessonId });
  return id;
}

export async function deleteLesson(p: Profile, keyId: string, lessonId: string, confirm: string) {
  await requireEditable(p, lessonId);
  if (!SUPABASE) return Local.deleteLesson(p, lessonId, confirm);
  await act<void>(p, "delete_lesson", { p_id: lessonId, p_confirm: confirm });
  await audit(p, keyId, "delete", "lesson", lessonId, { slug: confirm });
}

// ---------- Status (publish / unpublish / archive) ----------
export async function setStatus(p: Profile, keyId: string, entity: "course" | "module" | "lesson", id: string, status: Status) {
  if (draftsOnly() && status !== "review" && status !== "draft") throw new AppError("drafts_only");
  if (entity === "lesson") {
    const l = await requireEditable(p, id);
    if (status === "published") {
      const check = publishCheck(l, await exercisesOf(id), await deckOf(id));
      if (check.blockers.length) return { ok: false as const, blockers: check.blockers, warnings: check.warnings };
    }
  }
  if (!SUPABASE) {
    if (entity === "lesson") Local.setLessonStatus(p, id, status);
    else if (entity === "module") Local.setModuleStatus(p, id, status);
    else Local.setCourseStatus(p, id, status);
  } else {
    await act<void>(p, "set_status", { p_entity: entity, p_id: id, p_status: status });
    await audit(p, keyId, "set_status", entity, id, { status });
  }
  return { ok: true as const, status };
}

// ---------- Exercises and slides ----------
export async function saveExercise(p: Profile, keyId: string, lessonId: string, bundle: Omit<Exercise, "id" | "lesson_id" | "position" | "version"> & { id?: string }, fingerprint: string | null) {
  await requireEditable(p, lessonId);
  if (!SUPABASE) return Local.saveExercise(p, lessonId, { ...bundle, validated: !!fingerprint, fingerprint });
  const payload: Row = {
    ...(bundle.id ? { id: bundle.id } : {}),
    lesson_id: lessonId, slug: bundle.slug, type: bundle.type, title: bundle.title, instructions_md: bundle.instructions_md, starter_code: bundle.starter_code,
    config: bundle.config, xp_reward: bundle.xp_reward, required: bundle.required, timeout_ms: bundle.timeout_ms,
    tests: bundle.tests.map((t) => ({ kind: t.kind, description: t.description, spec: t.spec, hidden: t.hidden })),
    hints: bundle.hints,
    solution: { solution_code: bundle.solution.solution_code, answer: bundle.solution.answer, explanation_md: bundle.solution.explanation_md },
    known_wrong_solutions: bundle.solution.known_wrong_solutions,
    api_key_id: keyId,
    ...(fingerprint ? { validated_fingerprint: fingerprint } : {}),
  };
  const { data, error } = await adminClient().rpc("upsert_exercise_bundle", { p_payload: payload, p_actor: p.id });
  if (error) throw new AppError(/duplicate|unique/i.test(error.message) ? "already_exists" : /^[a-z_]+$/.test(error.message) ? error.message : "unexpected");
  return (data as { id: string }).id;
}

export async function deleteExercise(p: Profile, keyId: string, lessonId: string, exerciseId: string) {
  await requireEditable(p, lessonId);
  if (!SUPABASE) return Local.deleteExercise(p, lessonId, exerciseId);
  await act<void>(p, "delete_exercise", { p_lesson: lessonId, p_exercise: exerciseId });
  await audit(p, keyId, "delete", "exercise", exerciseId, { lesson_id: lessonId });
}

export async function saveDeck(p: Profile, keyId: string, lessonId: string, title: string, slides: unknown, status: "draft" | "published") {
  await requireEditable(p, lessonId);
  const st = draftsOnly() ? "draft" : status;
  if (!SUPABASE) return Local.saveDeck(p, lessonId, title, slides, st);
  const a = adminClient();
  const existing = ok(await a.from("slide_decks").select("id").eq("lesson_id", lessonId).maybeSingle()) as { id: string } | null;
  if (existing) ok(await a.from("slide_decks").update({ title, slides, status: st }).eq("id", existing.id));
  else ok(await a.from("slide_decks").insert({ lesson_id: lessonId, title, slides, status: st, created_by: p.id }));
  await audit(p, keyId, "save_deck", "slide_deck", lessonId, { status: st });
}

export async function deleteDeck(p: Profile, keyId: string, lessonId: string) {
  await requireEditable(p, lessonId);
  if (!SUPABASE) return write((db) => { db.decks = db.decks.filter((d) => d.lesson_id !== lessonId); });
  ok(await adminClient().from("slide_decks").delete().eq("lesson_id", lessonId));
  await audit(p, keyId, "delete", "slide_deck", lessonId);
}

/** Resolves a bearer token to the key's owner and key id. */
export async function ownerOf(token: string): Promise<{ profile: Profile; keyId: string } | null> {
  if (!token.startsWith("chk_")) return null;
  if (!SUPABASE) {
    const p = Local.profileFromApiKey(token);
    return p ? { profile: p, keyId: "local" } : null;
  }
  const { createHash } = await import("node:crypto");
  const a = adminClient();
  const { data: k } = await a.from("api_keys").select("id,owner_id,revoked_at,expires_at").eq("key_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
  if (!k || k.revoked_at || Date.parse(k.expires_at as string) < Date.now()) return null;
  const { data: p } = await a.from("profiles").select("id,display_name,email,role,active,created_at").eq("id", k.owner_id).maybeSingle();
  if (!p || !p.active || p.role === "pending") return null;
  await a.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);
  return { profile: { ...(p as Omit<Profile, "password_hash">), password_hash: "" }, keyId: k.id as string };
}
