import "server-only";
// CODEHER MCP tools: Claude has the same control over courses, modules, lessons, exercises
// and slide decks as the key's owner has on the website (founders: everything; educators:
// what they created). Destructive tools require the item's slug as confirmation.
import { z } from "zod";
import { exerciseBundleSchema, slideDeckV1Schema, slideDeckWarnings, type Test } from "@codeher/core";
import type { Profile } from "../db/types";
import { AppError } from "../errors";
import * as S from "./store";
import { validateExercise } from "./validate";
import errorsEs from "@messages/es/errors.json";

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
const destroy = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false };
const uuid = z.string().uuid();
const STATUS = { type: "string", enum: ["draft", "review", "published", "archived"] };
const ids = (description: string) => ({ type: "array", items: { type: "string" }, description });

const GUIDE = `# Guía para crear contenido en CODEHER

Público: chicas y adolescentes de 12 a 18 años en comunidades semirrurales del Estado de México, muchas programando por primera vez.
Todo el texto visible va en español de México, con tuteo, cálido y claro. Nunca regañes: "todavía no, y luego sí".

## Estructura
Curso → módulos (en orden) → lecciones (en orden) → ejercicios y diapositivas. El orden de módulos y lecciones es el
camino que siguen las estudiantes: cada lección se desbloquea al terminar la anterior.
Flujo sugerido para un curso nuevo: create_course (crea también el primer módulo) → create_module para los demás →
create_lesson con module_id y visibility "program" → save_exercise / save_slide_deck → set_status.

## Publicar
Todo se crea como borrador. Para que las estudiantes lo vean: publica las lecciones (set_status entity "lesson"),
luego el módulo (necesita al menos una lección publicada) y al final el curso (necesita un módulo publicado).
Después alguien del equipo asigna el curso a un grupo desde la plataforma. Publicar una lección corre las mismas
revisiones que el editor; si algo falta recibes la lista de "blockers". Solo una fundadora publica lecciones públicas.
Pregunta a la persona antes de publicar o borrar, salvo que te lo haya pedido explícitamente.

## Borrar
delete_course, delete_module, delete_lesson, delete_exercise y delete_slide_deck son definitivos. delete_course y
delete_lesson piden el slug exacto como confirmación. Lo que ya tiene avance de estudiantes solo lo borra una fundadora;
para ocultarlo usa set_status "draft" o "archived".

## Lecciones
- content_md en Markdown. Frases cortas, un concepto por lección, ejemplos de la vida diaria (tienda, escuela, milpa, futbol).
- Bloques de código: \`\`\`pseudo run o \`\`\`python run para que sean ejecutables en la lección.
- visibility: "draft" (solo equipo), "program" (estudiantes inscritas; requiere module_id) o "public" (cualquiera en /probar).

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
  // ---------- Reading ----------
  {
    name: "get_authoring_guide",
    title: "Guía de autoría",
    description: "Reglas de estilo, estructura de cursos, cómo publicar y borrar, sintaxis del pseudocódigo y formato de pruebas y diapositivas. Léela antes de crear contenido.",
    inputSchema: obj({}),
    annotations: read,
    run: async () => GUIDE,
  },
  {
    name: "whoami",
    title: "Quién soy",
    description: "La persona dueña de esta clave (nombre y rol) y qué puede hacer.",
    inputSchema: obj({}),
    annotations: read,
    run: async (_a, c) => ({
      name: c.profile.display_name, role: c.profile.role,
      can: c.profile.role === "founder" ? "Todo: cualquier curso, módulo y lección." : "Los cursos y lecciones que esta persona creó, más crear contenido nuevo.",
      drafts_only: S.draftsOnly(),
    }),
  },
  {
    name: "list_courses",
    title: "Listar cursos",
    description: "Cursos con su estado, si puedes editarlos, cuántos grupos los usan y sus módulos (con id, estado y número de lecciones).",
    inputSchema: obj({}),
    annotations: read,
    run: async (_a, c) => S.listCourses(c.profile),
  },
  {
    name: "get_course",
    title: "Ver curso",
    description: "Un curso completo: módulos en orden y sus lecciones en orden (estado, lenguaje, ejercicios), y cuántos grupos y estudiantes lo usan.",
    inputSchema: obj({ course: str("id (uuid) o slug del curso") }, ["course"]),
    annotations: read,
    run: async (a, c) => S.getCourse(c.profile, z.object({ course: z.string().min(1) }).parse(a).course),
  },
  {
    name: "list_lessons",
    title: "Listar lecciones",
    description: "Lecciones que puedes ver, con su curso, módulo, estado y si puedes editarlas. unassigned=true muestra solo las que no están en ningún curso.",
    inputSchema: obj({ language: LANG, status: STATUS, unassigned: { type: "boolean" } }),
    annotations: read,
    run: async (a, c) => S.listLessons(c.profile, z.object({ language: z.enum(["python", "pseudocode_es"]).optional(), status: z.string().optional(), unassigned: z.boolean().optional() }).parse(a)),
  },
  {
    name: "get_lesson",
    title: "Ver lección",
    description: "Una lección completa: contenido, ejercicios con pruebas y pistas (y soluciones si puedes editarla), diapositivas y la revisión de publicación (blockers y warnings).",
    inputSchema: obj({ lesson: str("id (uuid) o slug de la lección") }, ["lesson"]),
    annotations: read,
    run: async (a, c) => S.getLesson(c.profile, z.object({ lesson: z.string().min(1) }).parse(a).lesson),
  },

  // ---------- Courses ----------
  {
    name: "create_course",
    title: "Crear curso",
    description: "Crea un curso nuevo (borrador) con su primer módulo. Devuelve el id del curso; usa get_course para ver el id del módulo.",
    inputSchema: obj(
      { title: str("Nombre del curso"), slug: str("Identificador único en minúsculas con guiones (ej. robotica-basica)"), description: str("Una o dos frases: qué aprenden y para quién es"), first_module: str("Nombre del primer módulo (por defecto «Módulo 1»)") },
      ["title", "slug"],
    ),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ title: z.string().trim().min(1).max(120), slug: z.string().trim().max(60), description: z.string().max(600).default(""), first_module: z.string().max(120).optional() }).parse(a);
      const id = await S.saveCourse(c.profile, c.keyId, { slug: i.slug, title: i.title, description: i.description, firstModule: i.first_module });
      return { id, status: "draft", course: await S.getCourse(c.profile, id) };
    },
  },
  {
    name: "update_course",
    title: "Editar curso",
    description: "Cambia el nombre, slug o descripción de un curso que puedes editar.",
    inputSchema: obj({ course_id: str("uuid del curso"), title: { type: "string" }, slug: { type: "string" }, description: { type: "string" } }, ["course_id"]),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ course_id: uuid, title: z.string().trim().min(1).max(120).optional(), slug: z.string().trim().max(60).optional(), description: z.string().max(600).optional() }).parse(a);
      const cur = (await S.getCourse(c.profile, i.course_id)).course as { slug: string; title: string; description: string };
      await S.saveCourse(c.profile, c.keyId, { id: i.course_id, slug: i.slug ?? cur.slug, title: i.title ?? cur.title, description: i.description ?? cur.description });
      return { saved: true };
    },
  },
  {
    name: "delete_course",
    title: "Eliminar curso",
    description: "Borra un curso para siempre y lo quita de todos los grupos. delete_lessons=true borra también sus lecciones; si es false quedan en la biblioteca como borradores sin curso. confirm_slug debe ser el slug exacto del curso.",
    inputSchema: obj({ course_id: str("uuid del curso"), confirm_slug: str("slug exacto del curso, como confirmación"), delete_lessons: { type: "boolean" } }, ["course_id", "confirm_slug"]),
    annotations: destroy,
    run: async (a, c) => {
      const i = z.object({ course_id: uuid, confirm_slug: z.string(), delete_lessons: z.boolean().default(false) }).parse(a);
      return { deleted: true, lessons: await S.deleteCourse(c.profile, c.keyId, i.course_id, i.confirm_slug, i.delete_lessons) };
    },
  },

  // ---------- Modules ----------
  {
    name: "create_module",
    title: "Crear módulo",
    description: "Agrega un módulo al final de un curso que puedes editar. Devuelve su id.",
    inputSchema: obj({ course_id: str("uuid del curso"), title: str("Nombre del módulo") }, ["course_id", "title"]),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ course_id: uuid, title: z.string().trim().min(1).max(120) }).parse(a);
      return { id: await S.saveModule(c.profile, c.keyId, { courseId: i.course_id, title: i.title }), status: "draft" };
    },
  },
  {
    name: "update_module",
    title: "Renombrar módulo",
    description: "Cambia el nombre de un módulo.",
    inputSchema: obj({ module_id: str("uuid del módulo"), title: str("Nombre nuevo") }, ["module_id", "title"]),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ module_id: uuid, title: z.string().trim().min(1).max(120) }).parse(a);
      await S.saveModule(c.profile, c.keyId, { id: i.module_id, courseId: "", title: i.title });
      return { saved: true };
    },
  },
  {
    name: "delete_module",
    title: "Eliminar módulo",
    description: "Borra un módulo. delete_lessons=true borra también sus lecciones; si es false quedan en la biblioteca como borradores sin curso.",
    inputSchema: obj({ module_id: str("uuid del módulo"), delete_lessons: { type: "boolean" } }, ["module_id"]),
    annotations: destroy,
    run: async (a, c) => {
      const i = z.object({ module_id: uuid, delete_lessons: z.boolean().default(false) }).parse(a);
      return { deleted: true, lessons: await S.deleteModule(c.profile, c.keyId, i.module_id, i.delete_lessons) };
    },
  },
  {
    name: "reorder_modules",
    title: "Ordenar módulos",
    description: "Cambia el orden de los módulos de un curso. module_ids debe incluir todos los módulos del curso, en el orden nuevo.",
    inputSchema: obj({ course_id: str("uuid del curso"), module_ids: ids("todos los uuid de módulos del curso, en orden") }, ["course_id", "module_ids"]),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ course_id: uuid, module_ids: z.array(uuid).min(1).max(200) }).parse(a);
      await S.reorder(c.profile, c.keyId, "modules", i.course_id, i.module_ids);
      return { saved: true };
    },
  },

  // ---------- Lessons ----------
  {
    name: "create_lesson",
    title: "Crear lección",
    description: "Crea una lección nueva como borrador, al final del módulo indicado. Devuelve su id para agregar ejercicios y diapositivas.",
    inputSchema: obj(
      {
        title: str("Título en español"),
        slug: str("Identificador en minúsculas con guiones, único (ej. ciclos-mientras)"),
        language: LANG,
        visibility: { type: "string", enum: ["draft", "program", "public"], description: "program = estudiantes inscritas (requiere module_id); public = cualquiera en /probar; draft = solo equipo" },
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
          title: z.string().min(1).max(160), slug: z.string(), language: z.enum(["python", "pseudocode_es"]), visibility: z.enum(["draft", "program", "public"]).optional(),
          module_id: uuid.nullable().optional(), summary: z.string().max(400).default(""), content_md: z.string().max(50000),
          estimated_minutes: z.number().int().min(1).max(240).default(15), xp_reward: z.number().int().min(0).max(1000).default(20),
        })
        .parse(a);
      const visibility = i.visibility ?? (i.module_id ? "program" : "draft");
      const id = await S.createLesson(c.profile, c.keyId, { ...i, visibility, module_id: i.module_id ?? null });
      return { id, status: "draft", next: "Agrega ejercicios con save_exercise y diapositivas con save_slide_deck; publica con set_status." };
    },
  },
  {
    name: "update_lesson",
    title: "Editar lección",
    description: "Cambia campos de una lección que puedes editar (también publicadas). Cambiar module_id la mueve al final de ese módulo.",
    inputSchema: obj(
      {
        lesson_id: str("uuid de la lección"),
        title: { type: "string" }, slug: { type: "string" }, summary: { type: "string" }, content_md: { type: "string" },
        language: LANG,
        visibility: { type: "string", enum: ["draft", "program", "public"] }, module_id: { type: ["string", "null"] },
        pair_lesson_id: { type: ["string", "null"], description: "uuid de la lección gemela en el otro lenguaje" },
        estimated_minutes: { type: "integer" }, xp_reward: { type: "integer" },
      },
      ["lesson_id"],
    ),
    annotations: write,
    run: async (a, c) => {
      const { lesson_id, ...patch } = z
        .object({
          lesson_id: uuid, title: z.string().min(1).max(160).optional(), slug: z.string().max(80).optional(), summary: z.string().max(400).optional(), content_md: z.string().max(50000).optional(),
          language: z.enum(["python", "pseudocode_es"]).optional(), visibility: z.enum(["draft", "program", "public"]).optional(), module_id: uuid.nullable().optional(), pair_lesson_id: uuid.nullable().optional(),
          estimated_minutes: z.number().int().min(1).max(240).optional(), xp_reward: z.number().int().min(0).max(1000).optional(),
        })
        .parse(a);
      return { version: await S.updateLesson(c.profile, c.keyId, lesson_id, patch) };
    },
  },
  {
    name: "move_lesson",
    title: "Mover lección",
    description: "Mueve una lección al final de otro módulo (de cualquier curso que puedas editar). module_id null la saca de todo curso (queda como borrador en la biblioteca).",
    inputSchema: obj({ lesson_id: str("uuid de la lección"), module_id: { type: ["string", "null"], description: "uuid del módulo destino, o null" } }, ["lesson_id", "module_id"]),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ lesson_id: uuid, module_id: uuid.nullable() }).parse(a);
      await S.moveLesson(c.profile, c.keyId, i.lesson_id, i.module_id);
      return { saved: true };
    },
  },
  {
    name: "reorder_lessons",
    title: "Ordenar lecciones",
    description: "Cambia el orden de las lecciones de un módulo. lesson_ids debe incluir todas las lecciones del módulo, en el orden nuevo.",
    inputSchema: obj({ module_id: str("uuid del módulo"), lesson_ids: ids("todos los uuid de lecciones del módulo, en orden") }, ["module_id", "lesson_ids"]),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ module_id: uuid, lesson_ids: z.array(uuid).min(1).max(500) }).parse(a);
      await S.reorder(c.profile, c.keyId, "lessons", i.module_id, i.lesson_ids);
      return { saved: true };
    },
  },
  {
    name: "duplicate_lesson",
    title: "Duplicar lección",
    description: "Copia una lección con sus ejercicios como borrador nuevo (útil para hacer la versión en el otro lenguaje).",
    inputSchema: obj({ lesson_id: str("uuid de la lección") }, ["lesson_id"]),
    annotations: write,
    run: async (a, c) => ({ id: await S.duplicateLesson(c.profile, c.keyId, z.object({ lesson_id: uuid }).parse(a).lesson_id), status: "draft" }),
  },
  {
    name: "delete_lesson",
    title: "Eliminar lección",
    description: "Borra para siempre una lección con sus ejercicios y diapositivas. confirm_slug debe ser el slug exacto de la lección.",
    inputSchema: obj({ lesson_id: str("uuid de la lección"), confirm_slug: str("slug exacto de la lección, como confirmación") }, ["lesson_id", "confirm_slug"]),
    annotations: destroy,
    run: async (a, c) => {
      const i = z.object({ lesson_id: uuid, confirm_slug: z.string() }).parse(a);
      await S.deleteLesson(c.profile, c.keyId, i.lesson_id, i.confirm_slug);
      return { deleted: true };
    },
  },

  // ---------- Publishing ----------
  {
    name: "set_status",
    title: "Publicar o despublicar",
    description: "Cambia el estado de un curso, módulo o lección: draft, review, published o archived. Publicar una lección corre las revisiones del editor; si hay blockers no se publica y los recibes.",
    inputSchema: obj({ entity: { type: "string", enum: ["course", "module", "lesson"] }, id: str("uuid del curso, módulo o lección"), status: STATUS }, ["entity", "id", "status"]),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ entity: z.enum(["course", "module", "lesson"]), id: uuid, status: z.enum(["draft", "review", "published", "archived"]) }).parse(a);
      return S.setStatus(c.profile, c.keyId, i.entity, i.id, i.status);
    },
  },
  {
    name: "submit_for_review",
    title: "Enviar a revisión",
    description: "Marca una lección como lista para que alguien del equipo la revise.",
    inputSchema: obj({ lesson_id: str("uuid de la lección") }, ["lesson_id"]),
    annotations: write,
    run: async (a, c) => S.setStatus(c.profile, c.keyId, "lesson", z.object({ lesson_id: uuid }).parse(a).lesson_id, "review"),
  },

  // ---------- Exercises ----------
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
    description: "Crea o actualiza (con id) un ejercicio de una lección. Los de código se validan primero; si la validación falla no se guarda y recibes el detalle.",
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
      const { lesson_id, id, exercise } = z.object({ lesson_id: uuid, id: uuid.optional(), exercise: exerciseInput }).parse(a);
      const lesson = await S.requireEditable(c.profile, lesson_id);
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
    name: "delete_exercise",
    title: "Eliminar ejercicio",
    description: "Borra un ejercicio de una lección. Los demás se reacomodan.",
    inputSchema: obj({ lesson_id: str("uuid de la lección"), exercise_id: str("uuid del ejercicio") }, ["lesson_id", "exercise_id"]),
    annotations: destroy,
    run: async (a, c) => {
      const i = z.object({ lesson_id: uuid, exercise_id: uuid }).parse(a);
      await S.deleteExercise(c.profile, c.keyId, i.lesson_id, i.exercise_id);
      return { deleted: true };
    },
  },
  {
    name: "reorder_exercises",
    title: "Ordenar ejercicios",
    description: "Cambia el orden de los ejercicios de una lección. exercise_ids debe incluirlos todos, en el orden nuevo.",
    inputSchema: obj({ lesson_id: str("uuid de la lección"), exercise_ids: ids("todos los uuid de ejercicios de la lección, en orden") }, ["lesson_id", "exercise_ids"]),
    annotations: write,
    run: async (a, c) => {
      const i = z.object({ lesson_id: uuid, exercise_ids: z.array(uuid).min(1).max(100) }).parse(a);
      await S.reorder(c.profile, c.keyId, "exercises", i.lesson_id, i.exercise_ids);
      return { saved: true };
    },
  },

  // ---------- Slides ----------
  {
    name: "save_slide_deck",
    title: "Guardar diapositivas",
    description: "Crea o reemplaza las diapositivas (SlideDeckV1) de una lección. status published las muestra a las estudiantes junto con la lección.",
    inputSchema: obj({ lesson_id: str("uuid de la lección"), title: { type: "string" }, deck: { type: "object", description: "{ schema_version: 1, slides: [...] }" }, status: { type: "string", enum: ["draft", "published"] } }, ["lesson_id", "deck"]),
    annotations: write,
    run: async (a, c) => {
      const { lesson_id, title, deck, status } = z.object({ lesson_id: uuid, title: z.string().max(160).optional(), deck: slideDeckV1Schema, status: z.enum(["draft", "published"]).default("draft") }).parse(a);
      const l = await S.requireEditable(c.profile, lesson_id);
      await S.saveDeck(c.profile, c.keyId, lesson_id, title ?? l.title, deck, status);
      return { saved: true, status: S.draftsOnly() ? "draft" : status, warnings: slideDeckWarnings(deck) };
    },
  },
  {
    name: "delete_slide_deck",
    title: "Eliminar diapositivas",
    description: "Borra las diapositivas de una lección.",
    inputSchema: obj({ lesson_id: str("uuid de la lección") }, ["lesson_id"]),
    annotations: destroy,
    run: async (a, c) => {
      await S.deleteDeck(c.profile, c.keyId, z.object({ lesson_id: uuid }).parse(a).lesson_id);
      return { deleted: true };
    },
  },
];

const ERRORS: Record<string, string> = {
  ...errorsEs,
  forbidden: "No tienes permiso: solo la autora (o quien creó el curso) o una fundadora puede cambiar esto.",
  lesson_not_draft: "Este servidor está en modo solo borradores (MCP_DRAFTS_ONLY): las lecciones publicadas se editan desde la plataforma.",
  drafts_only: "Este servidor está en modo solo borradores (MCP_DRAFTS_ONLY): solo puedes pasar a borrador o a revisión.",
  not_found: "No encontré ese elemento (revisa el id o el slug).",
  already_exists: "Ya existe algo con ese slug.",
  invalid_slug: "El slug debe ir en minúsculas con guiones (ej. ciclos-mientras).",
  program_needs_module: "Las lecciones del programa necesitan module_id (usa list_courses o get_course).",
  confirmation_required: "La confirmación no coincide: pasa el slug exacto en confirm_slug.",
};

export function describeError(e: unknown): string {
  if (e instanceof z.ZodError) return `Datos inválidos: ${e.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ")}`;
  if (e instanceof AppError) return ERRORS[e.code] ? `${ERRORS[e.code]} (${e.code})` : e.code;
  console.error("[codeher:mcp] tool error", e);
  return "Error inesperado del servidor.";
}
