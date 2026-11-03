import { describe, expect, it } from "vitest";
import { grade, parses } from "@codeher/grader/pseudo";
import { runPythonLocally } from "../../../../packages/grader/src/python/local-runner";
import type { RunReport, Test } from "@codeher/core";
import { LESSONS } from "./curriculum";

function run(language: string, code: string, tests: Test[]): RunReport {
  const req = { id: "v", code, tests, timeoutMs: 5000 };
  return language === "python" ? runPythonLocally(req) : grade(req);
}

describe("seed curriculum validates (tech spec 7.4)", () => {
  for (const lesson of LESSONS) {
    for (const ex of lesson.exercises.filter((e) => (e.type ?? "code") === "code")) {
      it(`${lesson.slug} / ${ex.slug}`, () => {
        const tests = (ex.tests ?? []).map((t, i) => ({ ...t, id: `t${i}` })) as Test[];
        expect(tests.length).toBeGreaterThan(0);
        expect(ex.hints.length).toBeGreaterThanOrEqual(2);
        const sol = run(lesson.language, ex.solution!, tests);
        expect(sol.error, JSON.stringify(sol.error)).toBeNull();
        expect(sol.tests.map((t) => t.passed)).toEqual(tests.map(() => true));
        const starter = run(lesson.language, ex.starter_code ?? "", tests);
        expect(starter.ok).toBe(false);
        if (lesson.language === "pseudocode_es") expect(parses(ex.starter_code ?? "")).toBe(true);
        for (const w of ex.wrong ?? []) expect(run(lesson.language, w, tests).ok).toBe(false);
      });
    }
  }
  it("twin lessons point at each other", () => {
    const bySlug = new Map(LESSONS.map((l) => [l.slug, l]));
    for (const l of LESSONS) if (l.pair) expect(bySlug.get(l.pair)?.language).not.toBe(l.language);
  });
});
