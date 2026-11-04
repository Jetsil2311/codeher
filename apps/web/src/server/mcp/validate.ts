import "server-only";
// Server-side validation of exercises written by Claude, same rules as the lesson editor:
// the solution passes every test, the starter code does not, and each known wrong
// solution fails. Pseudocode runs on our own interpreter here. Python needs Pyodide, which
// runs in the browser: Python exercises are saved unvalidated and the editor's "Probar
// código" tab validates them (publishing stays blocked until then).
import { validationFingerprint, type CodeLanguage, type RunReport, type Test } from "@codeher/core";
import { grade, parses } from "@codeher/grader/pseudo";

export interface ValidationResult {
  ok: boolean;
  checked: boolean;
  steps: { check: string; ok: boolean; detail?: string }[];
  fingerprint: string | null;
}

function run(code: string, tests: Test[]): RunReport {
  return grade({ id: `mcp-${Date.now()}`, code, tests, timeoutMs: 5000 });
}

const why = (r: RunReport) =>
  r.error ? `${r.error.type}: ${r.error.message}` : r.tests.filter((t) => !t.passed).map((t) => `${t.testId}: ${t.messageEs ?? "falló"}`).join(" · ") || undefined;

export async function validateExercise(language: CodeLanguage, ex: { type: string; tests: Test[]; starter_code: string; solution_code: string; known_wrong_solutions: string[]; hints: string[] }): Promise<ValidationResult> {
  if (ex.type !== "code") return { ok: true, checked: false, steps: [], fingerprint: null };
  if (!ex.tests.length) return { ok: false, checked: true, steps: [{ check: "tests", ok: false, detail: "Un ejercicio de código necesita al menos una prueba." }], fingerprint: null };
  const steps: ValidationResult["steps"] = [];
  if (language === "python") {
    return { ok: true, checked: false, steps: [{ check: "python", ok: true, detail: "Los ejercicios de Python se validan en el editor (pestaña Probar código): se guarda sin validar." }], fingerprint: null };
  }
  const sol = run(ex.solution_code, ex.tests);
  steps.push({ check: "la solución pasa todas las pruebas", ok: sol.ok, detail: sol.ok ? undefined : why(sol) });
  const starter = run(ex.starter_code, ex.tests);
  steps.push({ check: "el código inicial NO pasa las pruebas", ok: !starter.ok });
  if (language === "pseudocode_es") steps.push({ check: "el código inicial se puede analizar", ok: parses(ex.starter_code) });
  ex.known_wrong_solutions.forEach((w, i) => {
    const r = run(w + "\n", ex.tests);
    steps.push({ check: `la solución incorrecta ${i + 1} NO pasa`, ok: !r.ok });
  });
  steps.push({ check: "al menos 2 pistas (recomendado)", ok: ex.hints.length >= 2 });
  const ok = steps.filter((s) => !s.check.startsWith("al menos")).every((s) => s.ok);
  return { ok, checked: true, steps, fingerprint: ok ? await validationFingerprint(ex.tests, ex.solution_code) : null };
}
