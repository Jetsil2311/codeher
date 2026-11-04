import "server-only";
// Data access for the MCP server, acting as the API key's owner. The MCP request has no
// browser session, so in Supabase mode it uses the server-only secret key and enforces
// the same rules as RLS here: founders see everything; educators see published content
// and their own drafts and only edit their own lessons. Everything Claude writes stays a
// draft unless MCP_ALLOW_PUBLISH=true (tech spec 9).
import type { CodeLanguage } from "@codeher/core";
import type { Exercise, Lesson, Profile } from "../db/types";
import { AppError } from "../errors";
import { SUPABASE, adminClient } from "../supabase";
import * as Local from "../services/local/staff";
import { read } from "../db/store";

type Row = Record<string, unknown>;
export const allowPublish = () => process.env.MCP_ALLOW_PUBLISH === "true";
const canEdit = (p: Profile, l: { created_by: string | null }) => p.role === "founder" || l.created_by === p.id;
const canRead = (p: Profile, l: { created_by: string | null; status: string }) => p.role === "founder" || l.status === "published" || l.created_by === p.id;
function ok<T>(r: { data: T | null; error: { message?: string } | null }): T {
  if (r.error) {
    console.error("[codeher:mcp]", r.error);
    throw new AppError(/duplicate|unique/i.test(r.error.message ?? "") ? "already_exists" : "unexpected");
  }
  return r.data as T;
}
async function audit(p: Profile, keyId: string, action: string, type: string, id: string, payload: Row = {}) {
  if (!SUPABASE) return;
  await adminClient().from("content_audit_log").insert({ actor_id: p.id, actor_kind: "mcp", api_key_id: keyId, action, entity_type: type, entity_id: id, payload });
}

export async function listCourses() {
  if (!SUPABASE) return read((db) => db.courses.map((c) => ({ id: c.id, slug: c.slug, title: c.title, status: c.status, modules: db.modules.filter((m) => m.course_id === c.id).map((m) => ({ id: m.id, slug: m.slug, title: m.title })) })));
  const rows = ok(await adminClient().from("courses").select("id,slug,title,status,position,modules(id,slug,title,position)").order("position")) as Row[];
  return rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, status: c.status, modules: ((c.modules as Row[]) ?? []).sort((a, b) => (a.position as number) - (b.position as number)).map(({ position: _p, ...m }) => m) }));
}

export async function listLessons(p: Profile, f: { language?: CodeLanguage; status?: string }) {
  if (!SUPABASE) return (await Promise.resolve(Local.lessonLibrary(p))).lessons.filter((l) => (!f.language || l.language === f.language) && (!f.status || l.status === f.status));
  let q = adminClient().from("lessons").select("id,slug,title,language,visibility,status,created_by,updated_at,module:modules(title,course:courses(title)),exercises(count)").order("position");
  if (f.language) q = q.eq("language", f.language);
  if (f.status) q = q.eq("status", f.status);
  return (ok(await q) as Row[])
    .filter((l) => canRead(p, l as { created_by: string | null; status: string }))
    .map((l) => ({
      id: l.id, slug: l.slug, title: l.title, language: l.language, visibility: l.visibility, status: l.status, updated_at: l.updated_at,
      course: ((l.module as { course?: { title?: string } } | null)?.course?.title) ?? null,
      exercises: ((l.exercises as { count: number }[] | undefined)?.[0]?.count) ?? 0,
      editable: canEdit(p, l as { created_by: string | null }),
    }));
}

const EX = "id,slug,position,type,title,instructions_md,starter_code,config,xp_reward,timeout_ms,exercise_tests(kind,description,spec,hidden,position),exercise_hints(content_md,position),exercise_solutions(solution_code,answer,explanation_md,known_wrong_solutions,validated_fingerprint)";
async function lessonRow(idOrSlug: string): Promise<Lesson | null> {
  const col = /^[0-9a-f-]{36}$/i.test(idOrSlug) ? "id" : "slug";
  if (!SUPABASE) return read((db) => db.lessons.find((l) => (col === "id" ? l.id : l.slug) === idOrSlug) ?? null);
  return ok(await adminClient().from("lessons").select("id,module_id,slug,title,summary,content_md,language,visibility,pair_lesson_id,position,estimated_minutes,xp_reward,status,version,created_by,updated_at").eq(col, idOrSlug).maybeSingle()) as Lesson | null;
}

export async function getLesson(p: Profile, idOrSlug: string) {
  const l = await lessonRow(idOrSlug);
  if (!l || !canRead(p, l)) throw new AppError("not_found");
  const editable = canEdit(p, l);
  if (!SUPABASE) {
    const ex = read((db) => db.exercises.filter((e) => e.lesson_id === l.id).sort((a, b) => a.position - b.position));
    return { lesson: l, editable, exercises: ex.map((e) => ({ ...e, solution: editable ? e.solution : undefined })), deck: read((db) => db.decks.find((d) => d.lesson_id === l.id)?.slides ?? null) };
  }
  const [ex, deck] = await Promise.all([
    adminClient().from("exercises").select(EX).eq("lesson_id", l.id).order("position"),
    adminClient().from("slide_decks").select("slides,status").eq("lesson_id", l.id).maybeSingle(),
  ]);
  const by = (a: Row, b: Row) => (a.position as number) - (b.position as number);
  return {
    lesson: l,
    editable,
    exercises: (ok(ex) as Row[]).map((e) => {
      const sol = (Array.isArray(e.exercise_solutions) ? (e.exercise_solutions as Row[])[0] : (e.exercise_solutions as Row | null)) ?? null;
      return {
        id: e.id, slug: e.slug, position: e.position, type: e.type, title: e.title, instructions_md: e.instructions_md, starter_code: e.starter_code,
        config: e.config, xp_reward: e.xp_reward, timeout_ms: e.timeout_ms,
        tests: ((e.exercise_tests as Row[]) ?? []).sort(by).map(({ position: _p, ...t }) => t),
        hints: ((e.exercise_hints as Row[]) ?? []).sort(by).map((h) => h.content_md),
        validated: !!sol?.validated_fingerprint,
        solution: editable && sol ? { solution_code: sol.solution_code, answer: sol.answer, explanation_md: sol.explanation_md, known_wrong_solutions: sol.known_wrong_solutions } : undefined,
      };
    }),
    deck: (ok(deck) as Row | null)?.slides ?? null,
  };
}

/** The lesson must be editable by the key owner and still a draft (or in review). */
export async function requireDraft(p: Profile, lessonId: string): Promise<Lesson> {
  const l = await lessonRow(lessonId);
  if (!l || !canEdit(p, l)) throw new AppError("forbidden");
  if ((l.status === "published" || l.status === "archived") && !allowPublish()) throw new AppError("lesson_not_draft");
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
  let q = a.from("lessons").select("position").order("position", { ascending: false }).limit(1);
  q = input.module_id ? q.eq("module_id", input.module_id) : q.is("module_id", null);
  const last = ok(await q) as { position: number }[];
  const row = ok(
    await a
      .from("lessons")
      .insert({ ...input, status: "draft", created_by: p.id, position: (last[0]?.position ?? 0) + 1 })
      .select("id")
      .single(),
  ) as { id: string };
  await audit(p, keyId, "create", "lesson", row.id, { slug: input.slug });
  return row.id;
}

export async function updateLesson(p: Profile, keyId: string, id: string, patch: Partial<Pick<Lesson, "title" | "summary" | "content_md" | "visibility" | "estimated_minutes" | "xp_reward" | "module_id" | "pair_lesson_id">>) {
  await requireDraft(p, id);
  if (!SUPABASE) return Local.updateLesson(p, id, patch);
  const r = ok(await adminClient().from("lessons").update(patch).eq("id", id).select("version").single()) as { version: number };
  await audit(p, keyId, "update", "lesson", id, { fields: Object.keys(patch) });
  return r.version;
}

export async function saveExercise(p: Profile, keyId: string, lessonId: string, bundle: Omit<Exercise, "id" | "lesson_id" | "position" | "version"> & { id?: string }, fingerprint: string | null) {
  await requireDraft(p, lessonId);
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

export async function saveDeck(p: Profile, keyId: string, lessonId: string, title: string, slides: unknown) {
  await requireDraft(p, lessonId);
  if (!SUPABASE) return Local.saveDeck(p, lessonId, title, slides, "draft");
  const a = adminClient();
  const existing = ok(await a.from("slide_decks").select("id").eq("lesson_id", lessonId).maybeSingle()) as { id: string } | null;
  if (existing) ok(await a.from("slide_decks").update({ title, slides, status: "draft" }).eq("id", existing.id));
  else ok(await a.from("slide_decks").insert({ lesson_id: lessonId, title, slides, status: "draft", created_by: p.id }));
  await audit(p, keyId, "save_deck", "slide_deck", lessonId);
}

export async function submitForReview(p: Profile, keyId: string, lessonId: string) {
  await requireDraft(p, lessonId);
  if (!SUPABASE) return Local.setLessonStatus(p, lessonId, "review");
  ok(await adminClient().from("lessons").update({ status: "review" }).eq("id", lessonId));
  await audit(p, keyId, "set_status", "lesson", lessonId, { status: "review" });
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
