import "server-only";
import { anonClient, fail, rpc } from "../../supabase";
import type { LogroCard } from "../local/public";

// Public reads go through the anon key; RLS limits them to published, public content.
type Row = Record<string, unknown>;

const LOGRO_COLS = "id,title,blurb,kind,tags,language,code,display_name,year,featured,is_sample,published_at,community:communities(name)";
function card(a: Row): LogroCard {
  const code = (a.code as string | null) ?? null;
  return {
    id: a.id as string,
    title: a.title as string,
    blurb: a.blurb as string,
    kind: a.kind as LogroCard["kind"],
    tags: (a.tags as string[]) ?? [],
    language: (a.language as LogroCard["language"]) ?? null,
    display_name: a.display_name as string,
    year: (a.year as number | null) ?? null,
    featured: !!a.featured,
    is_sample: !!a.is_sample,
    has_code: !!code,
    preview: code ? code.split("\n").slice(0, 10).join("\n") : null,
    community: ((a.community as { name?: string } | null)?.name as string | undefined) ?? null,
  };
}

async function publicSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await anonClient().from("app_settings").select("key,value");
  if (error) fail(error);
  return Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value]));
}

export async function logros(): Promise<LogroCard[]> {
  const { data, error } = await anonClient()
    .from("accomplishments")
    .select(LOGRO_COLS)
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("is_sample", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) fail(error);
  return (data ?? []).map((a) => card(a as Row));
}

export async function logro(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await anonClient().from("accomplishments").select(LOGRO_COLS).eq("id", id).eq("status", "published").maybeSingle();
  if (error) fail(error);
  return data ? { ...card(data as Row), code: ((data as Row).code as string | null) ?? null } : null;
}

export async function landing() {
  const [base, featured, settings] = await Promise.all([
    rpc<{ communities: unknown[]; totals: Record<string, number> }>(anonClient(), "public_landing"),
    logros(),
    publicSettings(),
  ]);
  return {
    communities: base.communities as { name: string; state: string; since_year: number | null; groups: number; students: number; years: number[] }[],
    totals: base.totals as { groups: number; students: number; communities: number; lessons_completed: number },
    featured: featured.slice(0, 3),
    team: (settings.team as { name: string; role: string; bio: string }[]) ?? [],
    contact_email: (settings.contact_email as string) ?? "hola@codeher.mx",
    social: (settings.social as { label: string; url: string }[]) ?? [],
  };
}

export async function publicLessons() {
  const { data, error } = await anonClient()
    .from("lessons")
    .select("id,slug,title,summary,language,estimated_minutes,position,exercises(count)")
    .order("position");
  if (error) fail(error);
  return (data ?? []).map((l: Row) => ({
    id: l.id as string,
    slug: l.slug as string,
    title: l.title as string,
    summary: l.summary as string,
    language: l.language as "python" | "pseudocode_es",
    minutes: l.estimated_minutes as number,
    exercises: ((l.exercises as { count: number }[] | undefined)?.[0]?.count as number) ?? 0,
  }));
}

export const LESSON_SELECT =
  "id,slug,title,summary,content_md,language,visibility,estimated_minutes,xp_reward," +
  "pair:lessons!pair_lesson_id(slug,title,language,status)," +
  "slide_decks(slides,status)," +
  "exercises(id,slug,position,type,title,instructions_md,starter_code,config,xp_reward,required,timeout_ms," +
  "exercise_tests(id,kind,description,spec,hidden,position),exercise_hints(content_md,position))";

/** Same shape as learning.lessonPayload (and SQL private.lesson_payload). */
export function toPayload(l: Row) {
  const pair = l.pair as Row | null;
  const deck = ((l.slide_decks as Row[] | null) ?? []).find((d) => d.status === "published");
  const exercises = ((l.exercises as Row[] | null) ?? []).sort((a, b) => (a.position as number) - (b.position as number));
  return {
    id: l.id as string,
    slug: l.slug as string,
    title: l.title as string,
    summary: l.summary as string,
    content_md: l.content_md as string,
    language: l.language as "python" | "pseudocode_es",
    visibility: l.visibility as "public" | "program" | "draft",
    minutes: l.estimated_minutes as number,
    xp: l.xp_reward as number,
    pair: pair && pair.status === "published" ? { slug: pair.slug as string, title: pair.title as string, language: pair.language as "python" | "pseudocode_es" } : null,
    deck: deck ? (deck.slides as unknown) : null,
    exercises: exercises.map((e) => ({
      id: e.id as string,
      slug: e.slug as string,
      position: e.position as number,
      type: e.type as "code" | "multiple_choice" | "short_answer",
      title: e.title as string,
      instructions_md: e.instructions_md as string,
      starter_code: e.starter_code as string,
      config: e.config as Record<string, unknown>,
      xp: e.xp_reward as number,
      required: e.required as boolean,
      timeout_ms: e.timeout_ms as number,
      tests: ((e.exercise_tests as Row[] | null) ?? [])
        .sort((a, b) => (a.position as number) - (b.position as number))
        .map((t) => ({ id: t.id as string, kind: t.kind as never, description: t.description as string, spec: t.spec as Record<string, unknown>, hidden: t.hidden as boolean })),
      hints: ((e.exercise_hints as Row[] | null) ?? []).sort((a, b) => (a.position as number) - (b.position as number)).map((h) => h.content_md as string),
      progress: null as null | { passed: boolean; attempts: number; hints_used: number; best_submission: string | null },
    })),
  };
}

export async function publicLesson(slug: string) {
  const { data, error } = await anonClient().from("lessons").select(LESSON_SELECT).eq("slug", slug).maybeSingle();
  if (error) fail(error);
  return data ? toPayload(data as unknown as Row) : null;
}

export async function checkPublicAnswer(exerciseId: string, answer: { choices?: number[]; text?: string }) {
  return rpc<{ passed: boolean; explanation_md: string | null }>(anonClient(), "public_check_answer", { p_exercise_id: exerciseId, p_answer: answer });
}

export async function errorCatalog() {
  const { data, error } = await anonClient().from("error_translations").select("id,language,error_type,pattern,message_es,explanation_es,suggestion_es,priority,enabled").eq("enabled", true);
  if (error) fail(error);
  return (data ?? []) as import("../../db/types").ErrorTranslation[];
}

export async function consentText() {
  return ((await publicSettings()).consent_text as string) ?? "";
}

export async function activeCommunities() {
  const { data, error } = await anonClient().from("communities").select("id,name").eq("active", true).order("position");
  if (error) fail(error);
  return (data ?? []) as { id: string; name: string }[];
}
