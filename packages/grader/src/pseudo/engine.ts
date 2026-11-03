// CodeEngine implementation for Spanish pseudocode (tech spec 6.4 / 6.10):
// compile + lint, a resumable Session (run, step, interactive Leer) and grading.

import type { Diagnostic, RawError, RunReport, RunRequest, StepEvent, Test, TestResult, VariableSnapshot } from "@codeher/core";
import { PSEUDO_LIMITS } from "@codeher/core";
import { analyze } from "./analyzer";
import type { Program } from "./ast";
import { PSEUDO_ERRORS, fillTemplate } from "./errors_es";
import { Interpreter, PseudoError, formatScalar, toPlain, type Yielded } from "./interpreter";
import { normalizeWord } from "./keywords";
import { lex, type LexDiagnostic } from "./lexer";
import { parse } from "./parser";

export interface Compiled {
  program: Program;
  diagnostics: Diagnostic[];
  firstError: RawError | null;
}

export function messageFor(code: string, params: Record<string, string | number>): string {
  const t = PSEUDO_ERRORS[code];
  return t ? fillTemplate(t.message, params) : code;
}

function toDiagnostic(d: LexDiagnostic, lines: string[]): Diagnostic {
  let col = d.col;
  let endCol = d.endCol;
  const word = d.params.word;
  if (word && col <= 1) {
    const text = lines[d.line - 1] ?? "";
    const re = new RegExp(`(^|[^\\wáéíóúñ])(${String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![\\wáéíóúñ])`, "i");
    const m = re.exec(text);
    if (m) {
      col = m.index + m[1].length + 1;
      endCol = col + m[2].length;
    }
  }
  if (endCol <= col) {
    const text = lines[d.line - 1] ?? "";
    const firstNonSpace = text.search(/\S/);
    col = firstNonSpace >= 0 ? firstNonSpace + 1 : 1;
    endCol = Math.max(col + 1, text.length + 1);
  }
  return { line: d.line, column: col, endColumn: endCol, severity: "error", code: d.code, message: messageFor(d.code, d.params) };
}

export function compile(code: string): Compiled {
  const { tokens, diagnostics: lexDiags } = lex(code);
  const { program, diagnostics } = parse(tokens, lexDiags);
  const all = [...diagnostics];
  const parseErrorLines = new Set(all.map((d) => d.line));
  for (const d of analyze(program)) if (!parseErrorLines.has(d.line)) all.push(d);
  all.sort((a, b) => a.line - b.line || a.col - b.col);
  const lines = code.split("\n");
  const diags = all.map((d) => toDiagnostic(d, lines));
  const first = all[0];
  return {
    program,
    diagnostics: diags,
    firstError: first ? { type: first.code, message: messageFor(first.code, first.params), line: first.line, params: first.params } : null,
  };
}

/** Syntax and static checks without running (instant, used while typing). */
export function lint(code: string): Diagnostic[] {
  if (!code.trim()) return [];
  return compile(code).diagnostics;
}

export function toRawError(e: unknown): RawError {
  if (e instanceof PseudoError) return { type: e.code, message: messageFor(e.code, e.params), line: e.line, params: e.params };
  return { type: "HarnessError", message: String((e as Error)?.message ?? e), line: null };
}

export type SessionEvent =
  | { type: "step"; line: number; variables: VariableSnapshot; output: string }
  | { type: "needInput"; line: number; name: string; variables: VariableSnapshot; output: string }
  | { type: "done"; variables: VariableSnapshot; output: string; truncated: boolean }
  | { type: "error"; error: RawError; variables: VariableSnapshot; output: string; truncated: boolean }
  | { type: "paused"; line: number; output: string };

export interface SessionOptions {
  stdin?: string[];
  interactive?: boolean;
  seed?: number;
  maxSteps?: number;
}

/** A running pseudocode program that can be advanced in slices or one statement at a time. */
export class Session {
  readonly interp: Interpreter;
  private gen: Generator<Yielded, void, string | undefined>;
  private queue: string[];
  private send: string | undefined = undefined;
  private finished = false;
  private awaiting: { line: number; name: string } | null = null;
  readonly interactive: boolean;

  constructor(program: Program, opts: SessionOptions = {}) {
    this.interp = new Interpreter(program, { seed: opts.seed, maxSteps: opts.maxSteps });
    this.gen = this.interp.runMain();
    this.queue = [...(opts.stdin ?? [])];
    this.interactive = !!opts.interactive;
  }

  get done() {
    return this.finished;
  }
  get waitingForInput() {
    return this.awaiting;
  }

  provideInput(value: string) {
    this.send = value;
    this.awaiting = null;
    this.interp.out += value + "\n"; // echo like a terminal
  }

  private advance(): IteratorResult<Yielded, void> {
    const r = this.gen.next(this.send);
    this.send = undefined;
    return r;
  }

  private handleInput(y: Extract<Yielded, { kind: "input" }>): SessionEvent | null {
    if (this.queue.length) {
      this.send = this.queue.shift();
      return null;
    }
    if (!this.interactive) {
      this.send = undefined;
      return null;
    }
    this.awaiting = { line: y.line, name: y.name };
    return { type: "needInput", line: y.line, name: y.name, variables: this.interp.snapshot(), output: this.interp.out };
  }

  private finish(): SessionEvent {
    this.finished = true;
    return { type: "done", variables: this.interp.snapshot(), output: this.interp.out, truncated: this.interp.truncated };
  }
  private fail(e: unknown): SessionEvent {
    this.finished = true;
    return { type: "error", error: toRawError(e), variables: this.interp.snapshot(), output: this.interp.out, truncated: this.interp.truncated };
  }

  /** Run until done, an error, a needed input, or the slice budget runs out. */
  run(sliceSteps = Infinity, deadline = Infinity): SessionEvent {
    if (this.finished) return this.finish();
    if (this.awaiting) return { type: "needInput", ...this.awaiting, variables: this.interp.snapshot(), output: this.interp.out };
    try {
      let n = 0;
      for (;;) {
        const r = this.advance();
        if (r.done) return this.finish();
        const y = r.value;
        if (y.kind === "input") {
          const ev = this.handleInput(y);
          if (ev) return ev;
          continue;
        }
        n++;
        if ((n & 1023) === 0 && Date.now() > deadline) throw new PseudoError("Timeout", { line: y.line }, y.line);
        if (n >= sliceSteps) return { type: "paused", line: y.line, output: this.interp.out };
      }
    } catch (e) {
      return this.fail(e);
    }
  }

  /** Advance exactly one statement (debug / Paso a paso). */
  step(): SessionEvent {
    if (this.finished) return this.finish();
    if (this.awaiting) return { type: "needInput", ...this.awaiting, variables: this.interp.snapshot(), output: this.interp.out };
    try {
      for (;;) {
        const r = this.advance();
        if (r.done) return this.finish();
        const y = r.value;
        if (y.kind === "input") {
          const ev = this.handleInput(y);
          if (ev) return ev;
          continue;
        }
        return { type: "step", line: y.line, variables: this.interp.snapshot(), output: this.interp.out };
      }
    } catch (e) {
      return this.fail(e);
    }
  }
}

/** Create a session from source; returns the first compile error instead when there is one. */
export function createSession(code: string, opts: SessionOptions = {}): { session: Session | null; error: RawError | null; compiled: Compiled } {
  const compiled = compile(code);
  if (compiled.firstError) return { session: null, error: compiled.firstError, compiled };
  if (!compiled.program.main) {
    return {
      session: null,
      error: { type: "FaltaProceso", message: messageFor("FaltaProceso", {}), line: 1, params: {} },
      compiled,
    };
  }
  return { session: new Session(compiled.program, opts), error: null, compiled };
}

/** Playground run (no tests). */
export function runPlayground(code: string, stdin: string[] = [], timeoutMs = 5000, seed?: number) {
  const t0 = Date.now();
  const { session, error } = createSession(code, { stdin, seed });
  if (!session) return { stdout: "", error, truncated: false, runtimeMs: Date.now() - t0, variables: {} as VariableSnapshot };
  const ev = session.run(Infinity, t0 + timeoutMs);
  return {
    stdout: ev.type === "done" || ev.type === "error" ? ev.output : "",
    error: ev.type === "error" ? ev.error : null,
    truncated: ev.type === "done" || ev.type === "error" ? ev.truncated : false,
    runtimeMs: Date.now() - t0,
    variables: ev.type === "done" || ev.type === "error" ? ev.variables : {},
  };
}

/** Debug trace (capped) for tests and the MCP check_pseudocode tool. */
export function* trace(code: string, stdin: string[] = []): Generator<StepEvent> {
  const { session, error } = createSession(code, { stdin });
  if (!session) {
    yield { line: error?.line ?? 1, kind: "error", variables: {}, output: "", error };
    return;
  }
  for (let i = 0; i < PSEUDO_LIMITS.maxTraceEvents; i++) {
    const ev = session.step();
    if (ev.type === "step") yield { line: ev.line, kind: "step", variables: ev.variables, output: ev.output };
    else if (ev.type === "done") {
      yield { line: 0, kind: "done", variables: ev.variables, output: ev.output };
      return;
    } else if (ev.type === "error") {
      yield { line: ev.error.line ?? 0, kind: "error", variables: ev.variables, output: ev.output, error: ev.error };
      return;
    } else if (ev.type === "needInput") {
      yield { line: ev.line, kind: "error", variables: ev.variables, output: ev.output, error: { type: "EntradaAgotada", message: messageFor("EntradaAgotada", {}), line: ev.line } };
      return;
    }
  }
  yield { line: 0, kind: "done", variables: {}, output: "", traceTruncated: true };
}

// ---------- grading ----------

function sameValue(a: unknown, b: unknown, approx: boolean, tol: number): boolean {
  if (typeof a === "number" && typeof b === "number") return approx ? Math.abs(a - b) <= tol : a === b;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameValue(x, b[i], approx, tol));
  return a === b;
}

export function displayValue(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(displayValue).join(", ")}]`;
  if (typeof v === "string") return `"${v}"`;
  if (v === undefined) return "(sin valor)";
  if (v === null) return "(nada)";
  return formatScalar(v as number | boolean);
}

function normalizeOutput(s: string, mode: "exact" | "trimmed" | "regex"): string {
  if (mode === "exact") return s;
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export function stdoutMatches(actual: string, expected: string, mode: "exact" | "trimmed" | "regex" = "trimmed"): boolean {
  if (mode === "regex") {
    try {
      return new RegExp(expected).test(actual);
    } catch {
      return false;
    }
  }
  return normalizeOutput(actual, mode) === normalizeOutput(expected, mode);
}

export function grade(req: RunRequest): RunReport {
  const t0 = Date.now();
  const deadline = t0 + req.timeoutMs;
  const compiled = compile(req.code);
  const base: Omit<RunReport, "ok" | "tests" | "runtimeMs"> = { stdout: "", truncated: false, error: null, language: "pseudocode_es" };

  if (compiled.firstError) {
    return {
      ...base,
      ok: false,
      error: compiled.firstError,
      tests: req.tests.map((t) => ({ testId: t.id, kind: t.kind, passed: false, skipped: true })),
      runtimeMs: Date.now() - t0,
    };
  }
  const program = compiled.program;
  const results: TestResult[] = [];
  let firstError: RawError | null = null;
  let stdout = "";
  let truncated = false;

  // construct_rule is static (parse tree only), so it never needs or waits for an execution.
  const sharedKinds = new Set(["function_call", "final_variable"]);
  const needsShared = req.tests.some((t) => sharedKinds.has(t.kind));
  let shared: { interp: Interpreter | null; error: RawError | null } = { interp: null, error: null };
  if (needsShared) {
    const fv = req.tests.find((t) => t.kind === "final_variable") as Test | undefined;
    const stdin = ((fv?.spec as { stdin?: string[] })?.stdin ?? req.stdin ?? []) as string[];
    const needsMain = req.tests.some((t) => t.kind === "final_variable");
    if (program.main) {
      const s = new Session(program, { stdin, seed: req.seed });
      const ev = s.run(Infinity, deadline);
      shared = { interp: s.interp, error: ev.type === "error" ? ev.error : null };
      stdout = s.interp.out;
      truncated = s.interp.truncated;
    } else if (needsMain) {
      shared = { interp: null, error: { type: "FaltaProceso", message: messageFor("FaltaProceso", {}), line: 1 } };
    } else {
      shared = { interp: new Interpreter(program, { seed: req.seed }), error: null };
    }
    if (shared.error) firstError = shared.error;
  }

  for (const t of req.tests) {
    const spec = t.spec as unknown as Record<string, unknown>;
    if (t.kind === "stdout") {
      const { session, error } = createSession(req.code, { stdin: (spec.stdin as string[]) ?? [], seed: req.seed });
      if (!session) {
        firstError ??= error;
        results.push({ testId: t.id, kind: t.kind, passed: false, messageEs: error?.message });
        continue;
      }
      const ev = session.run(Infinity, deadline);
      const out = ev.type === "done" || ev.type === "error" ? ev.output : "";
      if (!stdout) {
        stdout = out;
        truncated = session.interp.truncated;
      }
      if (ev.type === "error") {
        firstError ??= ev.error;
        results.push({ testId: t.id, kind: t.kind, passed: false, messageEs: ev.error.message, expected: spec.expected, actual: out });
        continue;
      }
      const passed = stdoutMatches(out, String(spec.expected ?? ""), (spec.match as "exact" | "trimmed" | "regex") ?? "trimmed");
      results.push({
        testId: t.id,
        kind: t.kind,
        passed,
        messageEs: passed ? undefined : "Lo que escribió tu programa no es lo que se esperaba.",
        expected: spec.expected,
        actual: out,
      });
      continue;
    }
    if (t.kind === "assert_code") {
      results.push({ testId: t.id, kind: t.kind, passed: false, skipped: true, messageEs: "Esta prueba solo existe para Python." });
      continue;
    }
    if (t.kind !== "construct_rule" && shared.error) {
      results.push({ testId: t.id, kind: t.kind, passed: false, skipped: true });
      continue;
    }
    if (t.kind === "construct_rule") {
      const must = ((spec.must_contain as string[]) ?? []).map(normalizeWord);
      const mustNot = ((spec.must_not_contain as string[]) ?? []).map(normalizeWord);
      const used = program.constructs;
      const passed = must.every((c) => used.has(c)) && mustNot.every((c) => !used.has(c));
      results.push({ testId: t.id, kind: t.kind, passed, messageEs: passed ? undefined : String(spec.message_es ?? "") });
      continue;
    }
    if (t.kind === "final_variable") {
      const vars = (spec.variables as Record<string, unknown>) ?? {};
      const approx = spec.compare === "approx";
      const tol = (spec.tolerance as number) ?? 1e-6;
      let passed = true;
      let msg: string | undefined;
      const actual: Record<string, unknown> = {};
      for (const [name, expected] of Object.entries(vars)) {
        const cell = shared.interp?.mainFrame?.vars.get(name.toLowerCase());
        const value = cell ? toPlain(cell.value) : undefined;
        actual[name] = value;
        if (!cell) {
          passed = false;
          msg ??= `No encontré la variable ${name}.`;
        } else if (value === undefined) {
          passed = false;
          msg ??= `La variable ${name} terminó sin valor.`;
        } else if (!sameValue(value, expected, approx, tol)) {
          passed = false;
          msg ??= `Esperaba que ${name} valiera ${displayValue(expected)} pero vale ${displayValue(value)}.`;
        }
      }
      if (!passed && spec.message_es) msg = `${spec.message_es as string} ${msg ?? ""}`.trim();
      results.push({ testId: t.id, kind: t.kind, passed, messageEs: msg, expected: vars, actual });
      continue;
    }
    if (t.kind === "function_call") {
      const fname = String(spec.function ?? "");
      const args = (spec.args as unknown[]) ?? [];
      const approx = spec.compare === "approx";
      const tol = (spec.tolerance as number) ?? 1e-6;
      if (!program.funcs[fname.toLowerCase()]) {
        results.push({ testId: t.id, kind: t.kind, passed: false, messageEs: `No encontré la función ${fname}. Revisa que se llame exactamente así.` });
        continue;
      }
      try {
        const g = shared.interp!.invoke(fname, args);
        let r = g.next();
        let guard = 0;
        while (!r.done) {
          if (r.value.kind === "input") throw new PseudoError("EntradaAgotada", {}, r.value.line);
          if ((++guard & 1023) === 0 && Date.now() > deadline) throw new PseudoError("Timeout", {}, null);
          r = g.next();
        }
        const value = toPlain(r.value);
        const passed = sameValue(value, spec.expected, approx, tol);
        const call = `${fname}(${args.map(displayValue).join(", ")})`;
        results.push({
          testId: t.id,
          kind: t.kind,
          passed,
          messageEs: passed ? undefined : `Con ${call} esperaba ${displayValue(spec.expected)} pero obtuve ${displayValue(value)}.`,
          expected: spec.expected,
          actual: value,
        });
      } catch (e) {
        const err = toRawError(e);
        firstError ??= err;
        results.push({ testId: t.id, kind: t.kind, passed: false, messageEs: err.message });
      }
      continue;
    }
  }

  return {
    ...base,
    ok: !firstError && results.every((r) => r.passed),
    stdout,
    truncated,
    error: firstError,
    tests: results,
    runtimeMs: Date.now() - t0,
  };
}

/** Constructs used by a program (for authoring checks). */
export function constructsOf(code: string): string[] {
  return Array.from(compile(code).program.constructs);
}

/** Does the code parse? (publish checks) */
export function parses(code: string): boolean {
  return compile(code).firstError === null;
}
