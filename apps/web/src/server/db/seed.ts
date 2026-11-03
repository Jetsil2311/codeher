import "server-only";
import { createHash } from "node:crypto";
import { stableStringify } from "@codeher/core";
import { COURSES, LESSONS, SAMPLE_LOGROS } from "@/content/curriculum";
import { hashSecret } from "../crypto";
import type { Db, ErrorTranslation, Exercise, Lesson } from "./types";

const iso = () => new Date().toISOString();
const id = () => crypto.randomUUID();

/** Local demo accounts (DATA_MODE=local only). Shown on the sign-in pages in local mode. */
export const DEMO = {
  founder: { email: "fundadora@codeher.local", password: "Fundadora-2026", name: "Fundadora (demo)" },
  educator: { email: "educadora@codeher.local", password: "Educadora-2026", name: "Educadora (demo)" },
  students: [
    { nickname: "Itzel", pin: "4827" },
    { nickname: "Mariana", pin: "7391" },
    { nickname: "Fer", pin: "5064" },
  ],
  group: { year: 2026, month: 11 },
};

function fingerprint(tests: Exercise["tests"], solution: string): string {
  const canonical = tests.map((t) => ({ kind: t.kind, description: t.description, spec: t.spec, hidden: !!t.hidden }));
  return createHash("sha256").update(stableStringify({ tests: canonical, solutionCode: solution })).digest("hex");
}

const PY_ERRORS: Array<Omit<ErrorTranslation, "id" | "enabled">> = [
  { language: "python", error_type: "NameError", pattern: "^name '(?<name>.+)' is not defined$", message_es: "No encontré ninguna variable o función llamada '{name}'.", explanation_es: "Python solo conoce los nombres que ya creaste antes de usarlos.", suggestion_es: "Revisa que '{name}' esté escrito igual (las mayúsculas importan) y que lo hayas creado antes de esta línea.", priority: 10 },
  { language: "python", error_type: "TypeError", pattern: "unsupported operand type\\(s\\) for \\+: 'int' and 'str'|can only concatenate str \\(not \"int\"\\) to str", message_es: "No se puede sumar un número con un texto.", explanation_es: "Python no mezcla números y texto con el signo +.", suggestion_es: "Convierte uno de los dos: por ejemplo int('5') + 3 o str(5) + '3'.", priority: 10 },
  { language: "python", error_type: "TypeError", pattern: "missing (?<n>\\d+) required positional argument", message_es: "A la función le faltan valores (línea {line}).", explanation_es: "Cuando llamas una función tienes que darle todos los datos que pide entre paréntesis.", suggestion_es: "Revisa cuántos parámetros tiene la función y cuántos le estás pasando.", priority: 20 },
  { language: "python", error_type: "TypeError", pattern: "object is not callable", message_es: "Intentaste usar algo como función, pero no lo es (línea {line}).", explanation_es: "Los paréntesis después de un nombre significan \"ejecuta esta función\".", suggestion_es: "Revisa si usaste el mismo nombre para una variable y para una función.", priority: 20 },
  { language: "python", error_type: "TypeError", pattern: "object is not subscriptable", message_es: "Usaste corchetes [ ] con algo que no es una lista ni un texto (línea {line}).", explanation_es: "Solo las listas, los textos y los diccionarios tienen posiciones.", suggestion_es: "Revisa que la variable sea una lista antes de usar [ ].", priority: 20 },
  { language: "python", error_type: "TypeError", pattern: null, message_es: "Hay datos de tipos que no combinan en la línea {line}.", explanation_es: "Algunas operaciones solo funcionan con ciertos tipos de datos.", suggestion_es: "Revisa si estás mezclando números, textos o listas.", priority: 100 },
  { language: "python", error_type: "ValueError", pattern: "invalid literal for int\\(\\) with base 10: '(?<value>.*)'", message_es: "No pude convertir '{value}' en un número entero.", explanation_es: "int() solo funciona con texto que sea un número, como '42'.", suggestion_es: "Revisa que el texto no tenga letras, espacios ni puntos decimales.", priority: 10 },
  { language: "python", error_type: "IndexError", pattern: "list index out of range", message_es: "Intentaste usar una posición que no existe en la lista.", explanation_es: "Las posiciones empiezan en 0 y la última es len(lista) - 1.", suggestion_es: "Revisa el número que usas entre corchetes o el rango de tu ciclo.", priority: 10 },
  { language: "python", error_type: "KeyError", pattern: null, message_es: "Esa llave no existe en el diccionario (línea {line}).", explanation_es: "Un diccionario solo tiene las llaves que le agregaste.", suggestion_es: "Revisa cómo está escrita la llave, o usa .get() si puede faltar.", priority: 100 },
  { language: "python", error_type: "AttributeError", pattern: null, message_es: "Ese dato no tiene la función o propiedad que buscas (línea {line}).", explanation_es: "Cada tipo de dato tiene sus propias funciones: los textos tienen .upper(), las listas .append().", suggestion_es: "Revisa el tipo de la variable y cómo escribiste el nombre después del punto.", priority: 100 },
  { language: "python", error_type: "ZeroDivisionError", pattern: null, message_es: "No se puede dividir entre cero.", explanation_es: "En matemáticas y en Python, dividir entre 0 no tiene resultado.", suggestion_es: "Revisa el valor por el que estás dividiendo en la línea {line}.", priority: 100 },
  { language: "python", error_type: "IndentationError", pattern: null, message_es: "La sangría (los espacios al inicio) de la línea {line} no es correcta.", explanation_es: "Python usa la sangría para saber qué líneas van dentro de un if, for, while o def.", suggestion_es: "Usa siempre la misma cantidad de espacios (4 es lo habitual) dentro de cada bloque.", priority: 100 },
  { language: "python", error_type: "TabError", pattern: null, message_es: "Mezclaste tabuladores y espacios en la línea {line}.", explanation_es: "Python necesita que la sangría sea siempre del mismo tipo.", suggestion_es: "Usa solo espacios: cuatro por nivel.", priority: 100 },
  { language: "python", error_type: "SyntaxError", pattern: "expected ':'", message_es: "Faltan los dos puntos (:) en la línea {line}.", explanation_es: "if, for, while y def terminan con dos puntos.", suggestion_es: "Agrega : al final de la línea {line}.", priority: 20 },
  { language: "python", error_type: "SyntaxError", pattern: null, message_es: "Hay un error de escritura cerca de la línea {line}.", explanation_es: "Python no pudo entender esa línea porque falta algo o sobra un símbolo.", suggestion_es: "Revisa paréntesis, comillas y los dos puntos (:) al final de if, for, while y def.", priority: 100 },
  { language: "python", error_type: "UnboundLocalError", pattern: null, message_es: "Usaste una variable dentro de la función antes de darle valor (línea {line}).", explanation_es: "Dentro de una función, una variable que cambias se vuelve local.", suggestion_es: "Dale un valor inicial dentro de la función o recíbela como parámetro.", priority: 100 },
  { language: "python", error_type: "ModuleNotFoundError", pattern: null, message_es: "Ese módulo no está disponible aquí.", explanation_es: "En CODEHER solo usamos la biblioteca estándar de Python.", suggestion_es: "Quita el import o usa una alternativa de la biblioteca estándar.", priority: 100 },
  { language: "python", error_type: "RecursionError", pattern: null, message_es: "Una función se llamó a sí misma demasiadas veces.", explanation_es: "Una función recursiva necesita un caso en el que se detenga.", suggestion_es: "Agrega una condición de salida.", priority: 100 },
  { language: "python", error_type: "EOFError", pattern: null, message_es: "Tu programa pidió un dato con input() y no había más.", explanation_es: "Cada input() necesita una línea en el campo Entradas.", suggestion_es: "Agrega los datos en Entradas, uno por línea.", priority: 100 },
  { language: null, error_type: "Timeout", pattern: null, message_es: "Tu programa tardó demasiado y lo detuve.", explanation_es: "Seguramente hay un ciclo que nunca termina.", suggestion_es: "Revisa que la condición de tus ciclos cambie en algún momento.", priority: 100 },
  { language: null, error_type: "OutputTooLarge", pattern: null, message_es: "Tu programa escribió demasiado texto.", explanation_es: "La salida tiene un límite para que tu dispositivo no se trabe.", suggestion_es: "Revisa si hay un print dentro de un ciclo que se repite muchas veces.", priority: 100 },
  { language: null, error_type: "WorkerCrashed", pattern: null, message_es: "El motor se reinició.", explanation_es: "A veces pasa si el programa usa mucha memoria o el dispositivo tiene poca.", suggestion_es: "Intenta de nuevo. Si se repite, simplifica el programa.", priority: 100 },
  { language: null, error_type: "HarnessError", pattern: null, message_es: "Algo falló de nuestro lado, no en tu código.", explanation_es: "El sistema de revisión tuvo un problema.", suggestion_es: "Intenta de nuevo en un momento.", priority: 100 },
];

export function buildSeed(): Db {
  const t = iso();
  const founderId = id();
  const educatorId = id();
  const db: Db = {
    version: 1,
    seq: 0,
    profiles: [
      { id: founderId, display_name: DEMO.founder.name, email: DEMO.founder.email, role: "founder", active: true, password_hash: hashSecret(DEMO.founder.password), created_at: t },
      { id: educatorId, display_name: DEMO.educator.name, email: DEMO.educator.email, role: "educator", active: true, password_hash: hashSecret(DEMO.educator.password), created_at: t },
    ],
    invites: [{ email: "jjclaudegpt@gmail.com", role: "founder", invited_by: null, created_at: t, accepted_at: null }],
    communities: [
      { id: id(), slug: "tequixquiac", name: "Tequixquiac", state: "Estado de México", since_year: null, position: 1, active: true },
      { id: id(), slug: "apaxco", name: "Apaxco", state: "Estado de México", since_year: null, position: 2, active: true },
    ],
    settings: {
      session_hours: 12,
      lockout: { soft_after: 5, soft_minutes: 15, hard_after: 10 },
      group_letter_rule: { first_without_letter: true },
      consent_text:
        "Autorizo que el proyecto de mi hija, hijo o persona a mi cargo aparezca en el muro de Logros de CODEHER, mostrando solo su nombre o apodo, su comunidad y el año. Puedo pedir que se retire en cualquier momento.",
      contact_email: "hola@codeher.mx",
      social: [],
      team: [],
    },
    groups: [],
    educator_groups: [],
    students: [],
    notes: [],
    sessions: [],
    login_attempts: [],
    courses: [],
    modules: [],
    lessons: [],
    exercises: [],
    decks: [],
    group_courses: [],
    lesson_progress: [],
    attempts: [],
    exercise_progress: [],
    xp_events: [],
    streaks: [],
    projects: [],
    project_versions: [],
    accomplishments: [],
    error_translations: PY_ERRORS.map((e) => ({ ...e, id: id(), enabled: true })),
    api_keys: [],
    access_log: [],
    content_audit_log: [],
  };

  const moduleByCourse = new Map<string, string>();
  for (const c of COURSES) {
    const cid = id();
    const mid = id();
    db.courses.push({ id: cid, slug: c.slug, title: c.title, description: c.description, status: "published", position: c.position, created_by: founderId });
    db.modules.push({ id: mid, course_id: cid, slug: c.module.slug, title: c.module.title, position: 1, status: "published" });
    moduleByCourse.set(c.slug, mid);
  }

  const lessonIds = new Map<string, string>();
  for (const l of LESSONS) {
    const lid = id();
    lessonIds.set(l.slug, lid);
    const lesson: Lesson = {
      id: lid,
      module_id: l.course ? moduleByCourse.get(l.course)! : null,
      slug: l.slug,
      title: l.title,
      summary: l.summary,
      content_md: l.content_md,
      language: l.language,
      visibility: l.visibility,
      pair_lesson_id: null,
      position: l.position,
      estimated_minutes: l.minutes,
      xp_reward: l.xp ?? 20,
      status: "published",
      version: 1,
      created_by: founderId,
      updated_at: t,
    };
    db.lessons.push(lesson);
    l.exercises.forEach((e, i) => {
      const tests = (e.tests ?? []).map((tt) => ({ id: id(), kind: tt.kind, description: tt.description, spec: tt.spec as Record<string, unknown>, hidden: !!tt.hidden }));
      const solution = e.solution ?? "";
      db.exercises.push({
        id: id(),
        lesson_id: lid,
        slug: e.slug,
        position: i + 1,
        type: e.type ?? "code",
        title: e.title,
        instructions_md: e.instructions_md,
        starter_code: e.starter_code ?? "",
        config: (e.config ?? {}) as Record<string, unknown>,
        xp_reward: e.xp ?? 10,
        required: true,
        timeout_ms: 5000,
        version: 1,
        tests,
        hints: e.hints,
        solution: {
          solution_code: solution,
          answer: e.answer ?? null,
          explanation_md: e.explanation_md ?? "",
          known_wrong_solutions: e.wrong ?? [],
          validated_at: (e.type ?? "code") === "code" ? t : null,
          validated_fingerprint: (e.type ?? "code") === "code" ? fingerprint(tests, solution) : null,
        },
      });
    });
    if (l.deck) db.decks.push({ id: id(), lesson_id: lid, title: l.title, slides: l.deck, status: "published", version: 1 });
  }
  for (const l of LESSONS) if (l.pair) db.lessons.find((x) => x.slug === l.slug)!.pair_lesson_id = lessonIds.get(l.pair) ?? null;

  // Demo group for local testing: 2611 (November 2026), Tequixquiac, both courses assigned.
  const gid = id();
  const community = db.communities[0];
  db.groups.push({ id: gid, year: DEMO.group.year, month: DEMO.group.month, letter: null, community_id: community.id, label: "Grupo demo", status: "active", ends_on: null, next_number: DEMO.students.length + 1, created_by: educatorId, created_at: t, closed_at: null });
  db.educator_groups.push({ educator_id: educatorId, group_id: gid, assigned_at: t });
  db.courses.forEach((c, i) => db.group_courses.push({ group_id: gid, course_id: c.id, position: i }));
  DEMO.students.forEach((s, i) => {
    const n = i + 1;
    db.students.push({
      id: id(), group_id: gid, number: n, code: `2611${String(n).padStart(2, "0")}`, nickname: s.nickname, avatar: ["orbita", "cometa", "chispa"][i] ?? "orbita",
      status: "active", pin_hash: hashSecret(s.pin), failed_attempts: 0, locked_until: null, hard_locked: false,
      guardian_consent: false, consent_reference: null, consent_recorded_at: null, last_active_at: null, created_at: t,
    });
  });

  for (const s of SAMPLE_LOGROS) {
    db.accomplishments.push({
      id: id(), student_id: null, project_id: null, kind: s.kind, title: s.title, blurb: s.blurb, tags: s.tags, language: s.language, code: s.code,
      display_name: "Ejemplo", community_id: db.communities.find((c) => c.slug === s.community)?.id ?? null, year: 2026,
      status: "published", featured: s.featured, is_sample: true, nominated_by_student: false, nominated_by: null,
      nominated_at: t, reviewed_at: t, published_at: t,
    });
  }
  return db;
}
