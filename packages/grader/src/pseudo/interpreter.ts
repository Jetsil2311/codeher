// Resumable evaluator for pseudocodigo-es v1 (tech spec 6.10).
// A generator yields before each statement ({ kind: "step" }) and when Leer needs a value
// ({ kind: "input" }). A scheduler outside advances it, which gives run, pause, step,
// speed control and interactive input without threads.

import { PSEUDO_ARRAY_BASE, PSEUDO_LIMITS, type VariableSnapshot } from "@codeher/core";
import type { BinOp, Expr, FuncDef, LValue, Program, Stmt } from "./ast";
import { BUILTINS, TYPE_DISPLAY, type VarType } from "./keywords";

export type Scalar = number | string | boolean;
export interface ArrayVal {
  kind: "array";
  type: VarType | null;
  dims: number[];
  data: (Scalar | undefined)[];
}
export type Value = Scalar | ArrayVal;
export interface Cell {
  type: VarType | null;
  value: Value | undefined;
  display: string;
}
interface Frame {
  name: string;
  vars: Map<string, Cell>;
}

export type Yielded = { kind: "step"; line: number } | { kind: "input"; line: number; name: string };
type Gen<T> = Generator<Yielded, T, string | undefined>;

export class PseudoError extends Error {
  constructor(
    public code: string,
    public params: Record<string, string | number>,
    public line: number | null,
  ) {
    super(code);
  }
}

export interface InterpreterOptions {
  seed?: number;
  maxSteps?: number;
  maxOutput?: number;
  maxDepth?: number;
}

const isArr = (v: unknown): v is ArrayVal => typeof v === "object" && v !== null && (v as ArrayVal).kind === "array";

export function formatScalar(v: Scalar | undefined): string {
  if (v === undefined) return "";
  if (typeof v === "boolean") return v ? "Verdadero" : "Falso";
  if (typeof v === "number") {
    if (Object.is(v, -0)) return "0";
    if (Number.isInteger(v)) return String(v);
    if (!Number.isFinite(v)) return String(v);
    return String(parseFloat(v.toPrecision(12)));
  }
  return v;
}

export function typeWord(v: unknown): string {
  if (typeof v === "number") return "un número";
  if (typeof v === "string") return "un texto";
  if (typeof v === "boolean") return "un valor lógico";
  if (isArr(v)) return "un arreglo completo";
  return "un valor";
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toPlain(v: Value | undefined): unknown {
  if (!isArr(v)) return v;
  if (v.dims.length === 1) return v.data.slice();
  const [rows, cols] = v.dims;
  const out: unknown[] = [];
  for (let r = 0; r < rows; r++) out.push(v.data.slice(r * cols, r * cols + cols));
  return out;
}

export function fromPlain(x: unknown): Value {
  if (Array.isArray(x)) {
    if (x.length && Array.isArray(x[0])) {
      const rows = x.length;
      const cols = (x[0] as unknown[]).length;
      return { kind: "array", type: null, dims: [rows, cols], data: (x as unknown[][]).flat() as Scalar[] };
    }
    return { kind: "array", type: null, dims: [x.length], data: x as Scalar[] };
  }
  return x as Scalar;
}

export class Interpreter {
  out = "";
  truncated = false;
  steps = 0;
  readonly stack: Frame[] = [];
  mainFrame: Frame | null = null;
  currentLine = 0;
  private readonly rng: () => number;
  private readonly maxSteps: number;
  private readonly maxOutput: number;
  private readonly maxDepth: number;

  constructor(
    private readonly prog: Program,
    opts: InterpreterOptions = {},
  ) {
    this.rng = mulberry32(opts.seed ?? 20281);
    this.maxSteps = opts.maxSteps ?? PSEUDO_LIMITS.maxSteps;
    this.maxOutput = opts.maxOutput ?? PSEUDO_LIMITS.maxOutputChars;
    this.maxDepth = opts.maxDepth ?? PSEUDO_LIMITS.maxCallDepth;
  }

  private err(code: string, params: Record<string, string | number>, line: number | null): never {
    throw new PseudoError(code, { ...params, line: line ?? "?" }, line);
  }

  *runMain(): Gen<void> {
    if (!this.prog.main) this.err("FaltaProceso", {}, 1);
    const f: Frame = { name: this.prog.main.name, vars: new Map() };
    this.mainFrame = f;
    this.stack.push(f);
    yield* this.block(this.prog.main.body, f);
  }

  /** Call a Funcion/SubProceso by name with plain values (function_call tests). */
  *invoke(name: string, args: unknown[]): Gen<Value | undefined> {
    const def = this.prog.funcs[name.toLowerCase()];
    if (!def) this.err("FuncionNoExiste", { name }, null);
    if (def.params.length !== args.length)
      this.err("ArgumentosIncorrectos", { name: def.display, esperados: def.params.length, recibidos: args.length }, def.line);
    const values = args.map(fromPlain);
    return yield* this.enter(def, values.map((v) => ({ value: v })), def.line);
  }

  snapshot(): VariableSnapshot {
    const f = this.stack[this.stack.length - 1] ?? this.mainFrame;
    const snap: VariableSnapshot = {};
    if (!f) return snap;
    for (const cell of f.vars.values()) {
      const type = cell.type ? TYPE_DISPLAY[cell.type] : "";
      if (isArr(cell.value)) {
        const preview = cell.value.data.slice(0, PSEUDO_LIMITS.traceArrayPreview);
        snap[cell.display] = {
          type: `${type ? type + " " : ""}[${cell.value.dims.join(",")}]`,
          value: preview,
          truncated: cell.value.data.length > preview.length,
        };
      } else snap[cell.display] = { type, value: cell.value };
    }
    return snap;
  }

  // ---------- statements ----------
  private tick(line: number) {
    this.currentLine = line;
    if (++this.steps > this.maxSteps) this.err("LimiteDePasos", {}, line);
  }

  private *block(stmts: Stmt[], f: Frame): Gen<void> {
    for (const s of stmts) yield* this.stmt(s, f);
  }

  private *stmt(s: Stmt, f: Frame): Gen<void> {
    this.tick(s.line);
    yield { kind: "step", line: s.line };
    switch (s.k) {
      case "define":
        for (const n of s.names) {
          const existing = f.vars.get(n.name);
          if (existing) {
            existing.type = s.type;
            if (isArr(existing.value)) existing.value.type = s.type;
            else if (existing.value !== undefined) existing.value = this.coerce(s.type, existing.value, n.display, s.line);
          } else f.vars.set(n.name, { type: s.type, value: undefined, display: n.display });
        }
        return;
      case "dim":
        for (const a of s.arrays) {
          const dims: number[] = [];
          for (const d of a.dims) {
            const v = d.c ? yield* this.ev(d, f) : this.evs(d, f);
            if (typeof v !== "number" || !Number.isInteger(v) || v < 1)
              this.err("TipoIncompatible", { detalle: `El tamaño del arreglo ${a.display} debe ser un número entero mayor que 0.` }, s.line);
            dims.push(v);
          }
          const size = dims.reduce((x, y) => x * y, 1);
          if (size > PSEUDO_LIMITS.maxArraySize)
            this.err("ArregloDemasiadoGrande", { name: a.display, max: PSEUDO_LIMITS.maxArraySize }, s.line);
          const existing = f.vars.get(a.name);
          const type = existing && !isArr(existing.value) ? existing.type : existing && isArr(existing.value) ? existing.value.type : null;
          const arr: ArrayVal = { kind: "array", type, dims, data: new Array(size).fill(undefined) };
          f.vars.set(a.name, { type, value: arr, display: a.display });
        }
        return;
      case "assign": {
        const v = s.e.c ? yield* this.ev(s.e, f) : this.evs(s.e, f);
        yield* this.store(s.target, v, f, s.line);
        return;
      }
      case "write": {
        let text = "";
        for (const item of s.items) {
          const v = item.c ? yield* this.ev(item, f) : this.evs(item, f);
          if (isArr(v)) this.err("TipoIncompatible", { detalle: "Para escribir un arreglo, escribe sus posiciones una por una." }, s.line);
          text += formatScalar(v);
        }
        this.emit(s.newline ? text + "\n" : text, s.line);
        return;
      }
      case "read":
        for (const t of s.targets) {
          const label = t.display;
          const raw = yield { kind: "input", line: s.line, name: label };
          if (raw === undefined) this.err("EntradaAgotada", {}, s.line);
          const type = this.targetType(t, f);
          const v = this.convertInput(raw, type, label, s.line);
          yield* this.store(t, v, f, s.line);
        }
        return;
      case "if": {
        const c = yield* this.bool(s.cond, f, "Si");
        if (c) yield* this.block(s.then, f);
        else if (s.else) yield* this.block(s.else, f);
        return;
      }
      case "switch": {
        const v = s.e.c ? yield* this.ev(s.e, f) : this.evs(s.e, f);
        for (const c of s.cases) {
          for (const val of c.values) {
            const w = val.c ? yield* this.ev(val, f) : this.evs(val, f);
            if (v === w) {
              yield* this.block(c.body, f);
              return;
            }
          }
        }
        if (s.dflt) yield* this.block(s.dflt, f);
        return;
      }
      case "while":
        for (;;) {
          if (!(yield* this.bool(s.cond, f, "Mientras"))) return;
          yield* this.block(s.body, f);
          this.tick(s.line);
          yield { kind: "step", line: s.line };
        }
      case "repeat":
        for (;;) {
          yield* this.block(s.body, f);
          this.tick(s.condLine);
          yield { kind: "step", line: s.condLine };
          const c = yield* this.bool(s.cond, f, "Repetir");
          if (s.until ? c : !c) return;
        }
      case "for": {
        const from = yield* this.num(s.from, f, "Para");
        const to = yield* this.num(s.to, f, "Para");
        const step = s.step ? yield* this.num(s.step, f, "Para") : 1;
        if (step === 0) this.err("PasoCero", {}, s.line);
        const lv: LValue = { k: "var", name: s.v.name, display: s.v.display, line: s.line };
        yield* this.store(lv, from, f, s.line);
        for (;;) {
          const cell = f.vars.get(s.v.name);
          const cur = cell?.value as number;
          if (step > 0 ? cur > to : cur < to) return;
          yield* this.block(s.body, f);
          this.tick(s.line);
          yield { kind: "step", line: s.line };
          const now = f.vars.get(s.v.name)?.value as number;
          yield* this.store(lv, now + step, f, s.line);
        }
      }
      case "call": {
        const def = this.prog.funcs[s.name];
        if (def) {
          yield* this.callUser(def, s.args, f, s.line);
          return;
        }
        const b = BUILTINS[stripKey(s.name)];
        if (b) {
          const vals: Value[] = [];
          for (const a of s.args) vals.push(a.c ? yield* this.ev(a, f) : this.evs(a, f));
          this.builtin(stripKey(s.name), vals, s.line);
          return;
        }
        this.err("FuncionNoExiste", { name: s.display }, s.line);
      }
    }
  }

  private targetType(t: LValue, f: Frame): VarType | null {
    const cell = f.vars.get(t.name);
    if (!cell) this.err("VariableNoDefinida", { name: t.display }, t.line);
    if (t.k === "index" && isArr(cell.value)) return cell.value.type;
    return cell.type;
  }

  private emit(text: string, line: number) {
    if (this.out.length + text.length > this.maxOutput) {
      this.out += text.slice(0, Math.max(0, this.maxOutput - this.out.length));
      this.truncated = true;
      this.err("LimiteDeSalida", {}, line);
    }
    this.out += text;
  }

  private convertInput(raw: string, type: VarType | null, name: string, line: number): Scalar {
    const s = raw.trim();
    const numeric = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s);
    const asNum = () => Number(s.replace(",", "."));
    switch (type) {
      case "entero":
        if (/^[+-]?\d+$/.test(s)) return Number(s);
        return this.err("ConversionInvalida", { valor: raw, tipo: "un número entero" }, line);
      case "real":
        if (numeric) return asNum();
        return this.err("ConversionInvalida", { valor: raw, tipo: "un número" }, line);
      case "logico": {
        const w = s.toLowerCase();
        if (["verdadero", "v", "1", "si", "sí"].includes(w)) return true;
        if (["falso", "f", "0", "no"].includes(w)) return false;
        return this.err("ConversionInvalida", { valor: raw, tipo: "Verdadero o Falso" }, line);
      }
      case "caracter":
        return raw.replace(/\r?\n$/, "");
      default:
        void name;
        return numeric ? asNum() : raw;
    }
  }

  private coerce(type: VarType | null, v: Value, name: string, line: number): Value {
    if (type === null || isArr(v)) return v;
    const tname = TYPE_DISPLAY[type];
    switch (type) {
      case "entero":
        if (typeof v === "number" && Number.isInteger(v)) return v;
        if (typeof v === "number")
          this.err("TipoIncompatible", { detalle: `La variable ${name} es Entero y no puede guardar ${formatScalar(v)}. Usa Real si necesitas decimales.` }, line);
        break;
      case "real":
        if (typeof v === "number") return v;
        break;
      case "caracter":
        if (typeof v === "string") return v;
        break;
      case "logico":
        if (typeof v === "boolean") return v;
        break;
    }
    return this.err("TipoIncompatible", { detalle: `La variable ${name} es ${tname} y no puede guardar ${typeWord(v)}.` }, line);
  }

  private flatIndex(arr: ArrayVal, idx: Scalar[], name: string, line: number): number {
    if (idx.length !== arr.dims.length)
      this.err("TipoIncompatible", { detalle: `El arreglo ${name} tiene ${arr.dims.length} ${arr.dims.length === 1 ? "dimensión" : "dimensiones"}.` }, line);
    let flat = 0;
    for (let d = 0; d < arr.dims.length; d++) {
      const i = idx[d];
      if (typeof i !== "number" || !Number.isInteger(i))
        this.err("TipoIncompatible", { detalle: `Las posiciones de ${name} deben ser números enteros.` }, line);
      const pos = i - PSEUDO_ARRAY_BASE;
      if (pos < 0 || pos >= arr.dims[d])
        this.err(
          "IndiceFueraDeRango",
          { name, indice: idx.map((x) => formatScalar(x)).join(","), desde: PSEUDO_ARRAY_BASE, hasta: arr.dims[d] - 1 + PSEUDO_ARRAY_BASE },
          line,
        );
      flat = flat * arr.dims[d] + pos;
    }
    return flat;
  }

  private *store(t: LValue, v: Value, f: Frame, line: number): Gen<void> {
    const cell = f.vars.get(t.name);
    if (!cell) this.err("VariableNoDefinida", { name: t.display }, line);
    if (t.k === "var") {
      if (isArr(cell.value) || isArr(v))
        this.err("TipoIncompatible", { detalle: `No se puede guardar un arreglo completo en ${t.display}. Usa sus posiciones.` }, line);
      cell.value = this.coerce(cell.type, v, t.display, line);
      return;
    }
    const arr = cell.value;
    if (!isArr(arr)) this.err("ArregloSinDimension", { name: t.display }, line);
    const idx: Scalar[] = [];
    for (const e of t.indices) {
      const x = e.c ? yield* this.ev(e, f) : this.evs(e, f);
      idx.push(x as Scalar);
    }
    const flat = this.flatIndex(arr, idx, t.display, line);
    if (isArr(v)) this.err("TipoIncompatible", { detalle: "No se puede guardar un arreglo dentro de otro." }, line);
    arr.data[flat] = this.coerce(arr.type, v, `${t.display}[${idx.map((x) => formatScalar(x)).join(",")}]`, line) as Scalar;
  }

  // ---------- expressions ----------
  private *bool(e: Expr, f: Frame, where: string): Gen<boolean> {
    const v = e.c ? yield* this.ev(e, f) : this.evs(e, f);
    if (typeof v !== "boolean")
      this.err("TipoIncompatible", { detalle: `La condición del ${where} debe ser Verdadero o Falso, pero es ${typeWord(v)}.` }, e.line);
    return v;
  }
  private *num(e: Expr, f: Frame, where: string): Gen<number> {
    const v = e.c ? yield* this.ev(e, f) : this.evs(e, f);
    if (typeof v !== "number") this.err("TipoIncompatible", { detalle: `Los límites del ${where} deben ser números.` }, e.line);
    return v;
  }

  private readVar(name: string, display: string, f: Frame, line: number): Value {
    const cell = f.vars.get(name);
    if (!cell) this.err("VariableNoDefinida", { name: display }, line);
    if (cell.value === undefined) this.err("VariableSinValor", { name: display }, line);
    return cell.value;
  }

  private readIndex(name: string, display: string, idx: Scalar[], f: Frame, line: number): Scalar {
    const cell = f.vars.get(name);
    if (!cell) this.err("VariableNoDefinida", { name: display }, line);
    if (!isArr(cell.value)) this.err("ArregloSinDimension", { name: display }, line);
    const flat = this.flatIndex(cell.value, idx, display, line);
    const v = cell.value.data[flat];
    if (v === undefined) this.err("VariableSinValor", { name: `${display}[${idx.map((x) => formatScalar(x)).join(",")}]` }, line);
    return v;
  }

  /** Synchronous evaluation for expressions without calls. */
  private evs(e: Expr, f: Frame): Value {
    switch (e.k) {
      case "num":
      case "str":
      case "bool":
        return e.v;
      case "var":
        return this.readVar(e.name, e.display, f, e.line);
      case "index":
        return this.readIndex(e.name, e.display, e.indices.map((x) => this.evs(x, f) as Scalar), f, e.line);
      case "un":
        return this.unary(e.op, this.evs(e.e, f), e.line);
      case "bin": {
        if (e.op === "y" || e.op === "o") {
          const l = this.evs(e.l, f);
          this.logical(l, e.line);
          if (e.op === "y" && l === false) return false;
          if (e.op === "o" && l === true) return true;
          const r = this.evs(e.r, f);
          this.logical(r, e.line);
          return r;
        }
        return this.binop(e.op, this.evs(e.l, f), this.evs(e.r, f), e.line);
      }
      case "call":
        throw new Error("call in sync path");
    }
  }

  private *ev(e: Expr, f: Frame): Gen<Value> {
    if (!e.c) return this.evs(e, f);
    switch (e.k) {
      case "un": {
        const v = yield* this.ev(e.e, f);
        return this.unary(e.op, v, e.line);
      }
      case "bin": {
        if (e.op === "y" || e.op === "o") {
          const l = yield* this.ev(e.l, f);
          this.logical(l, e.line);
          if (e.op === "y" && l === false) return false;
          if (e.op === "o" && l === true) return true;
          const r = yield* this.ev(e.r, f);
          this.logical(r, e.line);
          return r;
        }
        const l = yield* this.ev(e.l, f);
        const r = yield* this.ev(e.r, f);
        return this.binop(e.op, l, r, e.line);
      }
      case "index": {
        const idx: Scalar[] = [];
        for (const x of e.indices) idx.push((yield* this.ev(x, f)) as Scalar);
        return this.readIndex(e.name, e.display, idx, f, e.line);
      }
      case "call": {
        const cell = f.vars.get(e.name);
        if (cell && isArr(cell.value)) {
          const idx: Scalar[] = [];
          for (const x of e.args) idx.push((yield* this.ev(x, f)) as Scalar);
          return this.readIndex(e.name, e.display, idx, f, e.line);
        }
        const def = this.prog.funcs[e.name];
        if (def) {
          if (!def.returnVar) this.err("SinValorDeRetorno", { name: def.display }, e.line);
          const r = yield* this.callUser(def, e.args, f, e.line);
          return r as Value;
        }
        const key = stripKey(e.name);
        if (BUILTINS[key]) {
          const vals: Value[] = [];
          for (const a of e.args) vals.push(yield* this.ev(a, f));
          return this.builtin(key, vals, e.line);
        }
        return this.err("FuncionNoExiste", { name: e.display }, e.line);
      }
      default:
        return this.evs(e, f);
    }
  }

  private logical(v: Value, line: number) {
    if (typeof v !== "boolean")
      this.err("TipoIncompatible", { detalle: "Y, O y NO solo funcionan con condiciones (Verdadero o Falso)." }, line);
  }

  private unary(op: "-" | "no", v: Value, line: number): Value {
    if (op === "-") {
      if (typeof v !== "number") this.err("TipoIncompatible", { detalle: `No se puede poner signo menos a ${typeWord(v)}.` }, line);
      return -v;
    }
    this.logical(v, line);
    return !v;
  }

  private binop(op: BinOp, a: Value, b: Value, line: number): Value {
    if (isArr(a) || isArr(b)) this.err("TipoIncompatible", { detalle: "No se puede operar con un arreglo completo. Usa sus posiciones." }, line);
    const bothNum = typeof a === "number" && typeof b === "number";
    const bothStr = typeof a === "string" && typeof b === "string";
    const words: Record<string, string> = { "-": "restar", "*": "multiplicar", "/": "dividir", "^": "elevar", mod: "sacar el residuo de" };
    switch (op) {
      case "+":
        if (bothNum) return (a as number) + (b as number);
        if (bothStr) return (a as string) + (b as string);
        if ((typeof a === "number" && typeof b === "string") || (typeof a === "string" && typeof b === "number"))
          this.err("TipoIncompatible", { detalle: "No se puede sumar un número con un texto." }, line);
        return this.err("TipoIncompatible", { detalle: `No se puede sumar ${typeWord(a)} con ${typeWord(b)}.` }, line);
      case "-":
      case "*":
      case "^":
      case "/":
      case "mod": {
        if (!bothNum) this.err("TipoIncompatible", { detalle: `Para ${words[op]} se necesitan dos números, no ${typeWord(typeof a === "number" ? b : a)}.` }, line);
        const x = a as number;
        const y = b as number;
        if (op === "-") return x - y;
        if (op === "*") return x * y;
        if (op === "^") return x ** y;
        if (y === 0) this.err("DivisionEntreCero", {}, line);
        if (op === "/") return x / y;
        return x % y;
      }
      case "=":
      case "<>": {
        if (typeof a !== typeof b) this.err("TipoIncompatible", { detalle: `No se puede comparar ${typeWord(a)} con ${typeWord(b)}.` }, line);
        return op === "=" ? a === b : a !== b;
      }
      case "<":
      case ">":
      case "<=":
      case ">=": {
        if (!bothNum && !bothStr) this.err("TipoIncompatible", { detalle: `No se puede comparar ${typeWord(a)} con ${typeWord(b)}.` }, line);
        if (op === "<") return a < b;
        if (op === ">") return a > b;
        if (op === "<=") return a <= b;
        return a >= b;
      }
      default:
        return this.err("SimboloInesperado", { simbolo: op }, line);
    }
  }

  private *callUser(def: FuncDef, args: Expr[], caller: Frame, line: number): Gen<Value | undefined> {
    if (args.length !== def.params.length)
      this.err("ArgumentosIncorrectos", { name: def.display, esperados: def.params.length, recibidos: args.length }, line);
    const bound: { value?: Value; cell?: Cell }[] = [];
    for (let i = 0; i < args.length; i++) {
      const p = def.params[i];
      const a = args[i];
      if (p.byRef && a.k === "var") {
        const cell = caller.vars.get(a.name);
        if (!cell) this.err("VariableNoDefinida", { name: a.display }, line);
        bound.push({ cell });
      } else {
        bound.push({ value: a.c ? yield* this.ev(a, caller) : this.evs(a, caller) });
      }
    }
    return yield* this.enter(def, bound, line);
  }

  private *enter(def: FuncDef, bound: { value?: Value; cell?: Cell }[], line: number): Gen<Value | undefined> {
    if (this.stack.length >= this.maxDepth) this.err("RecursionExcesiva", {}, line);
    const frame: Frame = { name: def.display, vars: new Map() };
    def.params.forEach((p, i) => {
      const b = bound[i];
      if (b.cell) frame.vars.set(p.name, b.cell);
      else frame.vars.set(p.name, { type: null, value: b.value, display: p.display });
    });
    if (def.returnVar && !frame.vars.has(def.returnVar.name))
      frame.vars.set(def.returnVar.name, { type: null, value: undefined, display: def.returnVar.display });
    this.stack.push(frame);
    try {
      yield* this.block(def.body, frame);
    } finally {
      this.stack.pop();
    }
    if (!def.returnVar) return undefined;
    const r = frame.vars.get(def.returnVar.name)?.value;
    if (r === undefined) this.err("VariableSinValor", { name: def.returnVar.display }, def.endLine);
    return r;
  }

  private builtin(key: string, vals: Value[], line: number): Value {
    const info = BUILTINS[key];
    if (vals.length < info.arity[0] || vals.length > info.arity[1])
      this.err("ArgumentosIncorrectos", { name: info.name, esperados: info.arity[0], recibidos: vals.length }, line);
    const num = (i: number) => {
      const v = vals[i];
      if (typeof v !== "number") this.err("TipoIncompatible", { detalle: `${info.name} necesita un número.` }, line);
      return v;
    };
    const str = (i: number) => {
      const v = vals[i];
      if (typeof v !== "string") this.err("TipoIncompatible", { detalle: `${info.name} necesita un texto.` }, line);
      return v;
    };
    switch (key) {
      case "rc":
      case "raiz": {
        const x = num(0);
        if (x < 0) this.err("RaizNegativa", { funcion: "la raíz cuadrada", valor: formatScalar(x) }, line);
        return Math.sqrt(x);
      }
      case "abs":
        return Math.abs(num(0));
      case "ln": {
        const x = num(0);
        if (x <= 0) this.err("RaizNegativa", { funcion: "el logaritmo", valor: formatScalar(x) }, line);
        return Math.log(x);
      }
      case "exp":
        return Math.exp(num(0));
      case "sen":
        return Math.sin(num(0));
      case "cos":
        return Math.cos(num(0));
      case "tan":
        return Math.tan(num(0));
      case "atan":
        return Math.atan(num(0));
      case "trunc":
        return Math.trunc(num(0));
      case "redon": {
        const x = num(0);
        return Math.sign(x) * Math.round(Math.abs(x));
      }
      case "azar": {
        const n = num(0);
        if (!Number.isInteger(n) || n < 1) this.err("TipoIncompatible", { detalle: "AZAR necesita un número entero mayor que 0." }, line);
        return Math.floor(this.rng() * n);
      }
      case "aleatorio": {
        const a = Math.ceil(Math.min(num(0), num(1)));
        const b = Math.floor(Math.max(num(0), num(1)));
        return a + Math.floor(this.rng() * (b - a + 1));
      }
      case "longitud":
        return str(0).length;
      case "subcadena": {
        const t = str(0);
        const desde = Math.max(PSEUDO_ARRAY_BASE, num(1));
        const hasta = Math.min(t.length - 1 + PSEUDO_ARRAY_BASE, num(2));
        if (hasta < desde) return "";
        return t.slice(desde - PSEUDO_ARRAY_BASE, hasta - PSEUDO_ARRAY_BASE + 1);
      }
      case "mayusculas":
        return str(0).toLocaleUpperCase("es-MX");
      case "minusculas":
        return str(0).toLocaleLowerCase("es-MX");
      case "concatenar":
        return str(0) + str(1);
      case "convertiranumero": {
        const t = str(0).trim().replace(",", ".");
        if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t)) this.err("ConversionInvalida", { valor: vals[0] as string, tipo: "un número" }, line);
        return Number(t);
      }
      case "convertiratexto":
        if (isArr(vals[0])) this.err("TipoIncompatible", { detalle: "ConvertirATexto necesita un solo valor." }, line);
        return formatScalar(vals[0] as Scalar);
      default:
        return this.err("FuncionNoExiste", { name: info.name }, line);
    }
  }
}

function stripKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
