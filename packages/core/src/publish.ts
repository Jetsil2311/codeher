// checkPublishable (tech spec 6.2). Pure: the caller supplies the data and the
// grader results, so the same rules run in the app and in the MCP server.

import type { CodeLanguage, TestKind } from "./types";
import { looksSpanish } from "./spanish";
import { slideDeckV1Schema, slideDeckWarnings, type QualityIssue } from "./schemas";

export const ALLOWED_TEST_KINDS: Record<CodeLanguage, TestKind[]> = {
  python: ["stdout", "function_call", "assert_code", "construct_rule", "final_variable"],
  pseudocode_es: ["stdout", "function_call", "construct_rule", "final_variable"],
};

export const PYTHON_CONSTRUCTS = [
  "For", "While", "If", "Return", "FunctionDef", "Call", "Assign", "AugAssign", "List", "Dict",
  "ListComp", "Compare", "BoolOp", "BinOp", "Import", "Try", "Break", "Continue", "Lambda", "With",
];

export interface PublishLessonInput {
  title: string;
  content_md: string;
  language: CodeLanguage;
  exercises: Array<{
    slug: string;
    type: "code" | "multiple_choice" | "short_answer";
    required: boolean;
    hints: string[];
    tests: Array<{ kind: TestKind; description: string; spec: Record<string, unknown> }>;
    hasSolution: boolean;
    validationMatches: boolean;
    starterParses: boolean;
    solutionParses: boolean;
    wrongSolutionsParse: boolean;
    hasAnswer: boolean;
  }>;
  runnableFencesOk: boolean;
  constructNames: string[];
  slideDeck?: unknown;
}

export function checkPublishable(input: PublishLessonInput): { blockers: QualityIssue[]; warnings: QualityIssue[] } {
  const blockers: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];
  const B = (path: string, issue: string) => blockers.push({ path, issue, severity: "blocker" });
  const W = (path: string, issue: string) => warnings.push({ path, issue, severity: "warning" });

  if (!input.title.trim()) B("title", "La lección necesita un título.");
  if (!input.content_md.trim()) B("content_md", "La lección necesita contenido.");
  if (!input.runnableFencesOk) B("content_md", "Un bloque ejecutable del contenido produce un error.");
  if (input.exercises.length === 0) W("exercises", "La lección no tiene ejercicios.");

  const allowed = new Set(ALLOWED_TEST_KINDS[input.language]);
  const vocab = new Set(input.constructNames.map((c) => c.toLowerCase()));

  input.exercises.forEach((ex, i) => {
    const p = `exercises[${i}] (${ex.slug})`;
    if (ex.type === "code" && ex.required) {
      if (ex.tests.length === 0) B(p, "El ejercicio necesita al menos una prueba.");
      if (!ex.hasSolution) B(p, "El ejercicio necesita una solución de referencia.");
      if (!ex.validationMatches) B(p, "Valida el ejercicio otra vez: cambió desde la última validación.");
      if (!ex.starterParses) B(p, "El código inicial no se puede leer en el lenguaje de la lección.");
    }
    if (ex.type === "code") {
      if (!ex.solutionParses) B(p, "La solución no se puede leer en el lenguaje de la lección.");
      if (!ex.wrongSolutionsParse) B(p, "Una solución incorrecta conocida no se puede leer en el lenguaje de la lección.");
    } else if (!ex.hasAnswer) {
      B(p, "Falta la respuesta correcta.");
    }
    ex.tests.forEach((t, j) => {
      if (!t.description.trim()) B(`${p}.tests[${j}]`, "Cada prueba necesita una descripción en español.");
      if (!allowed.has(t.kind)) B(`${p}.tests[${j}]`, `El tipo de prueba ${t.kind} no está permitido en este lenguaje.`);
      if (t.kind === "construct_rule") {
        const names = [
          ...(((t.spec.must_contain as string[]) ?? [])),
          ...(((t.spec.must_not_contain as string[]) ?? [])),
        ];
        for (const n of names) if (!vocab.has(n.toLowerCase())) B(`${p}.tests[${j}]`, `La construcción ${n} no existe en este lenguaje.`);
      }
      if (t.description && !looksSpanish(t.description).spanish) W(`${p}.tests[${j}]`, "La descripción no parece estar en español.");
    });
    if (ex.hints.length < 2) W(p, "Agrega al menos dos pistas.");
  });

  if (input.slideDeck !== undefined && input.slideDeck !== null) {
    const parsed = slideDeckV1Schema.safeParse(input.slideDeck);
    if (!parsed.success) B("slide_deck", "La presentación no cumple el esquema SlideDeckV1.");
    else for (const w of slideDeckWarnings(parsed.data)) (w.severity === "blocker" ? blockers : warnings).push(w);
  }

  if (!looksSpanish(input.content_md).spanish) W("content_md", "El contenido no parece estar en español.");
  const newConcepts = (input.content_md.match(/^##\s/gm) ?? []).length;
  if (newConcepts > 5) W("content_md", "La lección parece tener más de cinco conceptos nuevos.");

  return { blockers, warnings };
}

/** JSON with sorted keys, so jsonb key reordering never changes a fingerprint. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Hash of tests plus solution used as the validation fingerprint. */
export async function validationFingerprint(
  tests: Array<{ kind: string; description: string; spec: unknown; hidden?: boolean }>,
  solutionCode: string,
): Promise<string> {
  const canonical = tests.map((t) => ({ kind: t.kind, description: t.description, spec: t.spec, hidden: !!t.hidden }));
  const data = new TextEncoder().encode(stableStringify({ tests: canonical, solutionCode }));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
