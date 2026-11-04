// Turns a lesson into a teaching script ("guion de clase"): an ordered list of cards a
// teacher reads from a phone or a desktop. Code is never shown; code examples become a
// "show it on screen" cue. Pure function, shared by local and Supabase modes.
import type { CodeLanguage } from "@codeher/core";

export type Block =
  | { t: "p"; text: string }
  | { t: "h"; text: string }
  | { t: "list"; items: string[]; ordered?: boolean }
  | { t: "quote"; text: string }
  | { t: "demo" }
  | { t: "check"; prompt: string; options: string[]; answer: number; explanation: string };

export type ScriptStep =
  | { kind: "intro"; title: string; goal: string | null; summary: string; minutes: number; exercises: number; slides: number; language: CodeLanguage }
  | { kind: "explain"; title: string; blocks: Block[]; demo: boolean }
  | { kind: "slide"; index: number; title: string; blocks: Block[]; notes: string }
  | {
      kind: "exercise";
      index: number;
      title: string;
      type: "code" | "multiple_choice" | "short_answer";
      instructions: Block[];
      checks: string[];
      hints: string[];
      explanation: Block[];
      options: string[];
      answer: number[] | string | null;
      pitfalls: number;
      xp: number;
    }
  | { kind: "close"; recap: string | null; next: { id: string; title: string } | null };

/** Minimal Markdown to blocks (no HTML, no code). */
export function toBlocks(md: string): Block[] {
  const out: Block[] = [];
  const lines = (md ?? "").replace(/\r/g, "").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ t: "p", text: para.join(" ").trim() });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      while (i + 1 < lines.length && !/^\s*```/.test(lines[i + 1])) i++;
      i++;
      out.push({ t: "demo" });
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      out.push({ t: "h", text: line.replace(/^#{1,6}\s+/, "") });
      continue;
    }
    const li = /^\s*(?:[-*]|(\d+)\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const ordered = !!li[1];
      const last = out[out.length - 1];
      if (last && last.t === "list" && !!last.ordered === ordered) last.items.push(li[2]);
      else out.push({ t: "list", items: [li[2]], ordered });
      continue;
    }
    if (/^\s*>/.test(line)) {
      flush();
      out.push({ t: "quote", text: line.replace(/^\s*>\s?/, "") });
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line.trim());
  }
  flush();
  return out;
}

const strip = (s: string) => {
  const t = s.replace(/\*\*/g, "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const GOAL = /^\*\*(Meta|Objetivo):\*\*\s*/i;
const RECAP = /^\*\*(En resumen|Resumen):\*\*\s*/i;

interface LessonInput {
  title: string;
  summary: string;
  content_md: string;
  language: CodeLanguage;
  estimated_minutes: number;
}
interface ExerciseInput {
  title: string;
  type: "code" | "multiple_choice" | "short_answer";
  instructions_md: string;
  config: Record<string, unknown>;
  xp_reward: number;
  tests: { description: string; hidden?: boolean }[];
  hints: string[];
  solution: { answer: unknown; explanation_md: string; known_wrong_solutions?: string[] };
}
interface DeckInput {
  slides?: { title: string; blocks: { type: string; markdown?: string; items?: string[]; prompt?: string; options?: string[]; answer_index?: number; explanation?: string; kind?: string; alt?: string }[]; notes?: string }[];
}

export function buildScript(lesson: LessonInput, exercises: ExerciseInput[], deck: unknown, next: { id: string; title: string } | null, labels: { explain: string; part: string }): ScriptStep[] {
  const steps: ScriptStep[] = [];
  let goal: string | null = null;
  let recap: string | null = null;
  const blocks: Block[] = [];
  for (const b of toBlocks(lesson.content_md)) {
    if (b.t === "p" && GOAL.test(b.text)) goal = strip(b.text.replace(GOAL, ""));
    else if (b.t === "p" && RECAP.test(b.text)) recap = strip(b.text.replace(RECAP, ""));
    else blocks.push(b);
  }
  const slides = ((deck as DeckInput | null)?.slides ?? []).filter((s) => s && s.title);
  steps.push({ kind: "intro", title: lesson.title, goal, summary: lesson.summary, minutes: lesson.estimated_minutes, exercises: exercises.length, slides: slides.length, language: lesson.language });

  // Explanation cards: a new card after every code example, or at each heading.
  let cur: Block[] = [];
  let title = labels.explain;
  let n = 0;
  const push = (demo: boolean) => {
    if (!cur.length && !demo) return;
    n++;
    steps.push({ kind: "explain", title: title === labels.explain && n > 1 ? `${labels.part} ${n}` : title, blocks: cur, demo });
    cur = [];
    title = labels.explain;
  };
  for (const b of blocks) {
    if (b.t === "h") {
      push(false);
      title = b.text;
    } else if (b.t === "demo") {
      cur.push(b);
      push(true);
    } else cur.push(b);
  }
  push(false);

  slides.forEach((s, i) => {
    const sb: Block[] = [];
    for (const b of s.blocks ?? []) {
      if (b.type === "text" && b.markdown) sb.push(...toBlocks(b.markdown));
      else if (b.type === "bullets" && b.items) sb.push({ t: "list", items: b.items });
      else if (b.type === "callout" && b.markdown) sb.push({ t: "quote", text: b.markdown });
      else if (b.type === "code") sb.push({ t: "demo" });
      else if (b.type === "check_question" && b.prompt) sb.push({ t: "check", prompt: b.prompt, options: b.options ?? [], answer: b.answer_index ?? 0, explanation: b.explanation ?? "" });
      else if (b.type === "image" && b.alt) sb.push({ t: "p", text: `🖼 ${b.alt}` });
    }
    steps.push({ kind: "slide", index: i + 1, title: s.title, blocks: sb, notes: s.notes ?? "" });
  });

  exercises.forEach((e, i) => {
    const ans = e.solution.answer as { choices?: number[]; text?: string } | null;
    steps.push({
      kind: "exercise",
      index: i + 1,
      title: e.title,
      type: e.type,
      instructions: toBlocks(e.instructions_md),
      checks: e.tests.map((t) => t.description).filter(Boolean),
      hints: e.hints,
      explanation: toBlocks(e.solution.explanation_md ?? ""),
      options: ((e.config?.options as string[] | undefined) ?? []).slice(0, 8),
      answer: ans?.choices ?? ans?.text ?? null,
      pitfalls: e.solution.known_wrong_solutions?.length ?? 0,
      xp: e.xp_reward,
    });
  });

  steps.push({ kind: "close", recap, next });
  return steps;
}
