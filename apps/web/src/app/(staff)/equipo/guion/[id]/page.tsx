import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScriptView } from "@/components/staff/ScriptView";
import { buildScript } from "@/server/script";
import { lessonForEdit, lessonLibrary } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export async function generateMetadata() {
  return { title: (await getTranslations("staff.script"))("title") };
}

const KEYS = ["intro", "explainKicker", "slide", "exercise", "close", "goal", "minutes", "exercisesN", "slidesN", "tip", "introTip", "notes", "say", "checks", "options", "answer", "hints", "why", "closeTitle", "recap", "askClass", "q1", "q2", "q3", "nextLesson", "prevLesson", "demo", "ask", "correct", "type_code", "type_multiple_choice", "type_short_answer", "lang_python", "lang_pseudocode_es", "exit", "index", "textSize", "full", "exitFull", "prev", "next", "upNext", "lastStep"];

export default async function Guion({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireStaff();
  const { id } = await params;
  const [data, lib] = await Promise.all([lessonForEdit(p, id), lessonLibrary(p)]);
  if (!data) notFound();
  const t = await getTranslations("staff.script");
  const raw = t.raw as unknown as (k: string) => string;
  // Neighbours inside the same course (or among public lessons), in course order.
  const siblings = lib.lessons.filter((l) => l.course === (lib.lessons.find((x) => x.id === id)?.course ?? null) && (l.status === "published" || l.editable));
  const at = siblings.findIndex((l) => l.id === id);
  const prev = at > 0 ? { id: siblings[at - 1].id, title: siblings[at - 1].title } : null;
  const next = at >= 0 && at < siblings.length - 1 ? { id: siblings[at + 1].id, title: siblings[at + 1].title } : null;
  const steps = buildScript(
    { title: data.lesson.title, summary: data.lesson.summary, content_md: data.lesson.content_md, language: data.lesson.language, estimated_minutes: data.lesson.estimated_minutes },
    data.exercises,
    data.deck?.slides ?? null,
    next,
    { explain: raw("explain"), part: raw("part") },
  );
  return <ScriptView lessonId={id} title={data.lesson.title} steps={steps} prev={prev} next={next} labels={Object.fromEntries(KEYS.map((k) => [k, raw(k)]))} />;
}
