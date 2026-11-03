// Zod schemas shared by the web app, the MCP server and import/export (tech spec Appendix B).
import { z } from "zod";
import { MAX_SLIDES_PER_DECK, MAX_TESTS_PER_EXERCISE, CONTENT_MD_MAX_CHARS, SUBMISSION_MAX_CHARS } from "./constants";

export const codeLanguageSchema = z.enum(["python", "pseudocode_es"]);
export const contentStatusSchema = z.enum(["draft", "review", "published", "archived"]);
export const visibilitySchema = z.enum(["public", "program", "draft"]);
export const exerciseTypeSchema = z.enum(["code", "multiple_choice", "short_answer"]);

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase ASCII kebab-case");

const compare = z.enum(["equal", "approx"]).optional();

export const stdoutSpecSchema = z.object({
  stdin: z.array(z.string()).optional(),
  expected: z.string(),
  match: z.enum(["exact", "trimmed", "regex"]).optional(),
});
export const functionCallSpecSchema = z.object({
  function: z.string().min(1),
  args: z.array(z.unknown()),
  kwargs: z.record(z.string(), z.unknown()).optional(),
  expected: z.unknown(),
  compare,
  tolerance: z.number().optional(),
});
export const assertCodeSpecSchema = z.object({ code: z.string().min(1), message_es: z.string().min(1) });
export const constructRuleSpecSchema = z.object({
  must_contain: z.array(z.string()).optional(),
  must_not_contain: z.array(z.string()).optional(),
  message_es: z.string().min(1),
});
export const finalVariableSpecSchema = z.object({
  variables: z.record(z.string(), z.unknown()),
  compare,
  tolerance: z.number().optional(),
  message_es: z.string().optional(),
  stdin: z.array(z.string()).optional(),
});

export const testSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stdout"), description: z.string().min(1), spec: stdoutSpecSchema, hidden: z.boolean().optional() }),
  z.object({ kind: z.literal("function_call"), description: z.string().min(1), spec: functionCallSpecSchema, hidden: z.boolean().optional() }),
  z.object({ kind: z.literal("assert_code"), description: z.string().min(1), spec: assertCodeSpecSchema, hidden: z.boolean().optional() }),
  z.object({ kind: z.literal("construct_rule"), description: z.string().min(1), spec: constructRuleSpecSchema, hidden: z.boolean().optional() }),
  z.object({ kind: z.literal("final_variable"), description: z.string().min(1), spec: finalVariableSpecSchema, hidden: z.boolean().optional() }),
]);
export type TestInput = z.infer<typeof testSchema>;

export const exerciseBundleSchema = z.object({
  lesson_id: z.string().uuid(),
  slug: slugSchema,
  type: exerciseTypeSchema.default("code"),
  title: z.string().min(1).max(160),
  instructions_md: z.string().max(CONTENT_MD_MAX_CHARS).default(""),
  starter_code: z.string().max(SUBMISSION_MAX_CHARS).default(""),
  config: z
    .object({ options: z.array(z.string()).optional(), multiple: z.boolean().optional() })
    .passthrough()
    .default({}),
  xp_reward: z.number().int().min(0).max(1000).optional(),
  required: z.boolean().optional(),
  timeout_ms: z.number().int().min(500).max(30000).optional(),
  tests: z.array(testSchema).max(MAX_TESTS_PER_EXERCISE).default([]),
  hints: z.array(z.string().min(1)).default([]),
  solution: z
    .object({
      solution_code: z.string().max(SUBMISSION_MAX_CHARS).default(""),
      answer: z.unknown().optional(),
      explanation_md: z.string().optional(),
    })
    .optional(),
  known_wrong_solutions: z.array(z.string().max(SUBMISSION_MAX_CHARS)).default([]),
});
export type ExerciseBundle = z.infer<typeof exerciseBundleSchema>;

export const lessonInputSchema = z.object({
  module_id: z.string().uuid().nullable().optional(),
  slug: slugSchema,
  title: z.string().min(1).max(160),
  summary: z.string().max(400).default(""),
  content_md: z.string().max(CONTENT_MD_MAX_CHARS).default(""),
  language: codeLanguageSchema.default("python"),
  visibility: visibilitySchema.default("draft"),
  pair_lesson_id: z.string().uuid().nullable().optional(),
  estimated_minutes: z.number().int().positive().max(240).default(15),
  xp_reward: z.number().int().min(0).max(1000).default(20),
});
export type LessonInput = z.infer<typeof lessonInputSchema>;

// Slide decks (tech spec 6.9, Appendix B: SlideDeckV1)
export const slideBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), markdown: z.string().min(1) }),
  z.object({ type: z.literal("bullets"), items: z.array(z.string().min(1)).min(1) }),
  z.object({
    type: z.literal("code"),
    language: codeLanguageSchema,
    code: z.string().min(1),
    runnable: z.boolean().optional(),
  }),
  z.object({ type: z.literal("callout"), kind: z.enum(["tip", "warning", "note"]), markdown: z.string().min(1) }),
  z.object({
    type: z.literal("check_question"),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answer_index: z.number().int().min(0),
    explanation: z.string().default(""),
  }),
  z.object({ type: z.literal("image"), url: z.string().url(), alt: z.string().min(1) }),
]);
export type SlideBlock = z.infer<typeof slideBlockSchema>;

export const slideSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  blocks: z.array(slideBlockSchema),
  notes: z.string().default(""),
});
export type Slide = z.infer<typeof slideSchema>;

export const slideDeckV1Schema = z.object({
  schema_version: z.literal(1).default(1),
  slides: z.array(slideSchema).min(1).max(MAX_SLIDES_PER_DECK),
});
export type SlideDeckV1 = z.infer<typeof slideDeckV1Schema>;

export interface QualityIssue {
  path: string;
  issue: string;
  severity: "blocker" | "warning";
}

/** Quality rules for decks produce warnings (tech spec 6.9). */
export function slideDeckWarnings(deck: SlideDeckV1): QualityIssue[] {
  const out: QualityIssue[] = [];
  deck.slides.forEach((s, i) => {
    s.blocks.forEach((b, j) => {
      if (b.type === "bullets") {
        if (b.items.length > 6) out.push({ path: `slides[${i}].blocks[${j}]`, issue: "Más de 6 viñetas en una diapositiva.", severity: "warning" });
        b.items.forEach((it, k) => {
          if (it.trim().split(/\s+/).length > 15)
            out.push({ path: `slides[${i}].blocks[${j}].items[${k}]`, issue: "Viñeta de más de 15 palabras.", severity: "warning" });
        });
      }
      if (b.type === "code" && b.code.split("\n").length > 12)
        out.push({ path: `slides[${i}].blocks[${j}]`, issue: "Bloque de código de más de 12 líneas.", severity: "warning" });
      if (b.type === "check_question" && b.answer_index >= b.options.length)
        out.push({ path: `slides[${i}].blocks[${j}]`, issue: "answer_index fuera de rango.", severity: "blocker" });
    });
  });
  if (deck.slides.length > 1) {
    const last = deck.slides[deck.slides.length - 1];
    if (!/resumen|repaso|recap|revisemos|cierre/i.test(last.title))
      out.push({ path: `slides[${deck.slides.length - 1}]`, issue: "La última diapositiva debería ser un resumen.", severity: "warning" });
  }
  return out;
}
