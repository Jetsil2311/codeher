import "server-only";
// CODEHER MCP tools (tech spec 9): Claude reads the curriculum and writes lessons,
// exercises and slide decks as drafts for an educator or founder to review and publish.
import { z } from "zod";
import { exerciseBundleSchema, slideDeckV1Schema, slideDeckWarnings, type Test } from "@codeher/core";
import type { Profile } from "../db/types";
import { AppError } from "../errors";
import * as S from "./store";
import { validateExercise } from "./validate";

export interface ToolCtx {
  profile: Profile;
  keyId: string;
}
interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const LANG = { type: "string", enum: ["pseudocode_es", "python"], description: "pseudocode_es (pseudocódigo en español, estilo PSeInt) o python" };
const read = { readOnlyHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

const GUIDE = `# Guía para crear contenido en CODEHER

Público: chicas y adolescentes de 12 a 18 años en comunidades semirrurales del Estado de México, muchas programando por primera vez.
Todo el texto visible va en español de México, con tuteo, cálido y claro. Nunca regañes: "todavía no, y luego sí".

## Lecciones
- content_md en Markdown. Frases cortas, un concepto por lección, ejemplos de la vida diaria (tienda, escuela, milpa, futbol).
- Bloques de código: \`\`\`pseudo run o \`\`\`python run para que sean ejecutables en la lección.
- visibility: "draft" (solo equipo), "program" (estudiantes inscritas; requiere module_id) o "public" (cualquiera en /probar).
- Todo lo que crees queda como BORRADOR. Una persona del equipo lo revisa y lo publica.

## Pseudocódigo (pseudocode_es)
Proceso Nombre … FinProceso · Definir x Como Entero|Real|Caracter|Logico; · x <- 5; · Escribir "Hola", x; · Leer x;
Si … Entonces … Sino … FinSi · Mientras … Hacer … FinMientras · Para i <- 1 Hasta 10 Hacer … FinPara · Repetir … Hasta Que …
Operadores: + - * / MOD, = <> < > <= >=, Y O NO. Funciones: ALEATORIO(a,b), AZAR(n), RAIZ, ABS, TRUNC, REDON.

## Ejercicios (save_exercise)
type "code" necesita tests, solution.solution_code, starter_code y al menos 2 hints. Se valida en el servidor:
la solución debe pasar todas las pruebas, el código inicial NO debe pasarlas y cada known_wrong_solutions debe fallar.
Tipos de prueba (tests[].kind):
- stdout: { "expected": "texto", "stdin": ["7"], "match": "trimmed"|"exact"|"regex" }
- final_variable: { "variables": { "total": 102 }, "compare": "equal"|"approx", "tolerance": 0.01 }
- function_call (solo Python): { "function": "doble", "args": [4], "expected": 8 }
- assert_code (solo Python): { "code": "assert doble(2) == 4", "message_es": "doble(2) debe ser 4" }
- construct_rule: { "must_contain": ["Mientras"], "must_not_contain": ["Para"], "message_es": "Usa un ciclo Mientras." }
Cada prueba tiene "description" en español, que la estudiante ve.
type "multiple_choice": config.options (lista) y solution.answer { "choices": [índice] }. type "short_answer": solution.answer { "text": "respuesta" }.

## Diapositivas (save_slide_deck)
{ "schema_version": 1, "slides": [ { "id": "s1", "title": "…", "blocks": [ … ], "notes": "" } ] }
Bloques: text {markdown}, bullets {items}, code {language, code, runnable}, callout {kind: tip|warning|note, markdown},
check_question {prompt, options, answer_index, explanation}, image {url, alt}. Máximo 40 diapositivas.`;

const exerciseInput = exerciseBundleSchema.omit({ lesson_id: true });

export const TOOLS: Tool[] = [
  {
    name: "get_authoring_guide",
    title: "Guía de autoría",
    description: "Reglas de estilo, sintaxis del pseudocódigo y formato de pruebas y diapositivas de CODEHER. Léela antes de crear contenido.",
    inputSchema: obj({}),
    annotations: read,
    run: async () => GUIDE,
  },
  {
    name: "list_courses",
    title: "Listar cursos",
    description: "Cursos y módulos de CODEHER (los module_id sirven para crear lecciones del programa).",
    inputSchema: obj({}),
    annotations: read,
    run: async () => S.listCourses(),
  },
  {
    name: "list_lessons",
    title: "Listar lecciones",
    description: "Lecciones que puedes ver, con su estado y si puedes editarlas.",
    inputSchema: obj({ language: LANG, status: { type: "string", enum: ["draft", "review", "published", "archived"] } }),
    annotations: read,
    run: async (a, c) => S.listLessons(c.profile, z.object({ language: z.enum(["python", "pseudocode_es"]).optional(), status: z.string().optional() }).parse(a)),
  },
  {
    name: "get_lesson",
    title: "Ver lección",
    description: "Una lección completa: contenido, ejercicios con sus pruebas y pistas (y soluciones si puedes editarla) y diapositivas.",
    inputSchema: obj({ lesson: str("id (uuid) o slug de la lección") }, ["lesson"]),
    annotations: read,
    run: async (a, c) => S.getLesson(c.profile, z.object({ lesson: z.string().min(1) }).parse(a).lesson),
  },
  {
    name: "create_lesson",
    title: "Crear lección (borrador)",
    description: "Crea una lección nueva como borrador. Devuelve su id para agregar ejercicios y diapositivas.",
    inputSchema: obj(
      {
        title: str("Título en español"),
        slug: str("Identificador en minúsculas con guiones, único (ej. ciclos-mientras)"),
        language: LANG,
        visibility: { type: "string", enum: ["draft", "program", "public"], description: "Quién la verá cuando se publique" },
        module_id: str("uuid del módulo (obligatorio para visibility=program)"),
        summary: str("Resumen de una frase"),
        content_md: str("Contenido en Markdown"),
        estimated_minutes: { type: "integer", minimum: 1, maximum: 240 },
        xp_reward: { type: "integer", minimum: 0, maximum: 1000 },
      },
      ["title", "slug", "language", "content_md"],
    ),
    annotations: write,
    run: async (a, c) => {
      const i = z
        .object({
          title: z.string().min(1).max(160), slug: z.string(), language: z.enum(["python", "pseudocode_es"]), visibility: z.enum(["draft", "program", "public"]).default("draft"),
          module_id: z.string().uuid().nullable().optional(), summary: z.string().max(400).default(""), content_md: z.string().max(50000),
          estimated_minutes: z.number().int().min(1).max(240).default(15), xp_reward: z.number().int().min(0).max(1000).default(20),
        })
        .parse(a);
      const id = await S.createLesson(c.profile, c.keyId, { ...i, module_id: i.module_id ?? null });
      return { id, status: "draft", next: "Agrega ejercicios con save_exercise y, si quieres, diapositivas con save_slide_deck." };
    },
  },
  {
    name: "update_lesson",
    title: "Editar lección (borrador)",
    description: "Cambia campos de una lección en borrador o en revisión. Las lecciones publicadas solo se editan desde la plataforma.",
    inputSchema: obj(
      {
        lesson_id: str("uuid de la lección"),
        title: { type: "string" }, summary: { type: "string" }, content_md: { type: "string" },
        visibility: { type: "string", enum: ["draft", "program", "public"] }, module_id: { type: "string" },
        pair_lesson_id: str("uuid de la lección gemela en el otro lenguaje"),
        estimated_minutes: { type: "integer" }, xp_reward: { type: "integer" },
      },
      ["lesson_id"],
    ),
    annotations: write,
    run: async (a, c) => {
      const { lesson_id, ...patch } = z
        .object({
          lesson_id: z.string().uuid(), title: z.string().min(1).max(160).optional(), summary: z.string().max(400).optional(), content_md: z.string().max(50000).optional(),
          visibility: z.enum(["draft", "program", "public"]).optional(), module_id: z.string().uuid().optional(), pair_lesson_id: z.string().uuid().optional(),
          estimated_minutes: z.number().int().min(1).max(240).optional(), xp_reward: z.number().int().min(0).max(1000).optional(),
        })
        .parse(a);
      return { version: await S.updateLesson(c.profile, c.keyId, lesson_id, patch) };
    },
  },
  {
    name: "validate_exercise",
    title: "Probar ejercicio",
    description: "Ejecuta la solución, el código inicial y las soluciones incorrectas contra las pruebas sin guardar nada. Úsalo para iterar.",
    inputSchema: obj({ language: LANG, exercise: { type: "object", description: "Mismo formato que save_exercise.exercise" } }, ["language", "exercise"]),
    annotations: read,
    run: async (a) => {
      const { language, exercise } = z.object({ language: z.enum(["python", "pseudocode_es"]), exercise: exerciseInput }).parse(a);
      return validateExercise(language, { type: exercise.type, tests: exercise.tests as unknown as Test[], starter_code: exercise.starter_code, solution_code: exercise.solution?.solution_code ?? "", known_wrong_solutions: exercise.known_wrong_solutions, hints: exercise.hints });
    },
  },
  {
    name: "save_exercise",
    title: "Guardar ejercicio",
    description: "Crea o actualiza (con id) un ejercicio de una lección en borrador. Los de código se validan primero; si la validación falla no se guarda y recibes el detalle.",
    inputSchema: obj(
      {
        lesson_id: str("uuid de la lección"),
        id: str("uuid del ejercicio para actualizarlo (omite para crear)"),
        exercise: {
          type: "object",
          description: "slug, type (code|multiple_choice|short_answer), title, instructions_md, starter_code, tests[], hints[], solution {solution_code, answer, explanation_md}, known_wrong_solutions[], config, xp_reward",
        },
      },
      ["lesson_id", "exercise"],
    ),
    annotations: write,
    run: async (a, c) => {
      const { lesson_id, id, exercise } = z.object({ lesson_id: z.string().uuid(), id: z.string().uuid().optional(), exercise: exerciseInput }).parse(a);
      const lesson = await S.requireDraft(c.profile, lesson_id);
      const v = await validateExercise(lesson.language, { type: exercise.type, tests: exercise.tests as unknown as Test[], starter_code: exercise.starter_code, solution_code: exercise.solution?.solution_code ?? "", known_wrong_solutions: exercise.known_wrong_solutions, hints: exercise.hints });
      if (!v.ok) return { saved: false, validation: v };
      const savedId = await S.saveExercise(
        c.profile,
        c.keyId,
        lesson_id,
        {
          id, slug: exercise.slug, type: exercise.type, title: exercise.title, instructions_md: exercise.instructions_md, starter_code: exercise.starter_code,
          config: exercise.config as Record<string, unknown>, xp_reward: exercise.xp_reward ?? 10, required: exercise.required ?? true, timeout_ms: exercise.timeout_ms ?? 5000,
          tests: exercise.tests.map((t, i) => ({ id: `t${i}`, kind: t.kind, description: t.description, spec: t.spec as Record<string, unknown>, hidden: !!t.hidden })),
          hints: exercise.hints,
          solution: { solution_code: exercise.solution?.solution_code ?? "", answer: exercise.solution?.answer ?? null, explanation_md: exercise.solution?.explanation_md ?? "", known_wrong_solutions: exercise.known_wrong_solutions, validated_at: null, validated_fingerprint: null },
        },
        v.fingerprint,
      );
      return { saved: true, id: savedId, validated: !!v.fingerprint, validation: v };
    },
  },
  {
    name: "save_slide_deck",
    title: "Guardar diapositivas",
    description: "Crea o reemplaza las diapositivas (SlideDeckV1) de una lección en borrador. Quedan como borrador.",
    inputSchema: obj({ lesson_id: str("uuid de la lección"), title: { type: "string" }, deck: { type: "object", description: "{ schema_version: 1, slides: [...] }" } }, ["lesson_id", "deck"]),
    annotations: write,
    run: async (a, c) => {
      const { lesson_id, title, deck } = z.object({ lesson_id: z.string().uuid(), title: z.string().max(160).optional(), deck: slideDeckV1Schema }).parse(a);
      const l = await S.requireDraft(c.profile, lesson_id);
      await S.saveDeck(c.profile, c.keyId, lesson_id, title ?? l.title, deck);
      return { saved: true, warnings: slideDeckWarnings(deck) };
    },
  },
  {
    name: "submit_for_review",
    title: "Enviar a revisión",
    description: "Marca una lección en borrador como lista para revisión. Una persona del equipo la publica.",
    inputSchema: obj({ lesson_id: str("uuid de la lección") }, ["lesson_id"]),
    annotations: write,
    run: async (a, c) => {
      await S.submitForReview(c.profile, c.keyId, z.object({ lesson_id: z.string().uuid() }).parse(a).lesson_id);
      return { status: "review" };
    },
  },
];

export function describeError(e: unknown): string {
  if (e instanceof z.ZodError) return `Datos inválidos: ${e.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ")}`;
  if (e instanceof AppError) {
    const msg: Record<string, string> = {
      forbidden: "No puedes editar esta lección (solo la autora o una fundadora).",
      lesson_not_draft: "La lección ya está publicada: edítala desde la plataforma.",
      not_found: "No encontré esa lección.",
      already_exists: "Ya existe algo con ese slug.",
      invalid_slug: "El slug debe ir en minúsculas con guiones (ej. ciclos-mientras).",
      program_needs_module: "Las lecciones del programa necesitan module_id (usa list_courses).",
    };
    return msg[e.code] ?? e.code;
  }
  console.error("[codeher:mcp] tool error", e);
  return "Error inesperado del servidor.";
}
