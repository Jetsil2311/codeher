// Hand-written recursive-descent parser for pseudocodigo-es v1 (tech spec Appendix D).
// It recovers at statement boundaries and reports at most one Spanish diagnostic per line.

import type { Expr, FuncDef, LValue, Param, Program, Stmt, BinOp } from "./ast";
import { BLOCKS, CLOSERS, RESERVED, TYPE_NAMES, closestWord, type VarType } from "./keywords";
import { isContextual, type LexDiagnostic, type Token } from "./lexer";

export type ParseDiagnostic = LexDiagnostic;

const CMP_OPS = new Set(["=", "<>", "<", ">", "<=", ">="]);

function markCalls(e: Expr): boolean {
  let c = false;
  switch (e.k) {
    case "call":
      e.args.forEach(markCalls);
      c = true;
      break;
    case "index":
      c = e.indices.map(markCalls).some(Boolean);
      break;
    case "un":
      c = markCalls(e.e);
      break;
    case "bin": {
      const a = markCalls(e.l);
      const b = markCalls(e.r);
      c = a || b;
      break;
    }
    default:
      c = false;
  }
  e.c = c;
  return c;
}

export class Parser {
  private p = 0;
  readonly diagnostics: ParseDiagnostic[] = [];
  private readonly errorLines = new Set<number>();
  readonly constructs = new Set<string>();

  constructor(private readonly toks: Token[], initial: ParseDiagnostic[] = []) {
    for (const d of initial) {
      this.diagnostics.push(d);
      this.errorLines.add(d.line);
    }
  }

  // ---------- token helpers ----------
  private peek(o = 0): Token {
    return this.toks[Math.min(this.p + o, this.toks.length - 1)];
  }
  private next(): Token {
    const t = this.peek();
    if (this.p < this.toks.length - 1) this.p++;
    return t;
  }
  private isKw(w: string, o = 0) {
    const t = this.peek(o);
    return t.t === "kw" && t.v === w;
  }
  private isOp(v: string, o = 0) {
    const t = this.peek(o);
    return t.t === "op" && t.v === v;
  }
  private isCtx(w: string, o = 0) {
    return isContextual(this.peek(o), w);
  }
  private atLineEnd(o = 0) {
    const t = this.peek(o);
    return t.t === "nl" || t.t === "eof" || (t.t === "op" && t.v === ";");
  }
  private skipSeparators() {
    while (this.peek().t === "nl" || this.isOp(";")) this.next();
  }
  private skipNewlinesOnly() {
    while (this.peek().t === "nl") this.next();
  }
  private syncLine() {
    while (!(this.peek().t === "nl" || this.peek().t === "eof")) this.next();
  }
  private error(code: string, tok: Token, params: Record<string, string | number> = {}) {
    if (this.errorLines.has(tok.line)) return;
    this.errorLines.add(tok.line);
    this.diagnostics.push({ code, line: tok.line, col: tok.col, endCol: tok.endCol, params: { line: tok.line, ...params } });
  }
  private describe(t: Token): string {
    if (t.t === "nl" || t.t === "eof") return "el final de la línea";
    if (t.t === "str") return `"${t.v}"`;
    return t.raw;
  }
  private isBlockEnd(): boolean {
    const t = this.peek();
    if (t.t !== "kw") return false;
    if (CLOSERS.has(t.v)) return true;
    if (t.v === "mientras" && this.isCtx("que", 1)) return true;
    return t.v === "proceso" || t.v === "algoritmo" || t.v === "funcion" || t.v === "subproceso";
  }
  private endStatement() {
    if (this.isOp(";")) {
      this.next();
      return;
    }
    const t = this.peek();
    if (t.t === "nl" || t.t === "eof") return;
    if (this.isBlockEnd()) return;
    this.error("SimboloInesperado", t, { simbolo: this.describe(t) });
    this.syncLine();
  }
  private expectId(): Token | null {
    const t = this.peek();
    if (t.t === "id") return this.next();
    if (t.t === "kw") this.error("SimboloInesperado", t, { simbolo: t.raw });
    else this.error("FaltaExpresion", t);
    return null;
  }

  // ---------- program ----------
  parseProgram(): Program {
    const funcs: Record<string, FuncDef> = {};
    let main: Program["main"] = null;
    let strayReported = false;
    this.skipSeparators();
    while (this.peek().t !== "eof") {
      const t = this.peek();
      if (t.t === "kw" && (t.v === "proceso" || t.v === "algoritmo")) {
        const m = this.parseMain();
        if (main) this.error("ProcesoDuplicado", t);
        else main = m;
      } else if (t.t === "kw" && (t.v === "funcion" || t.v === "subproceso")) {
        const f = this.parseFunc();
        if (f) funcs[f.name] = f;
      } else if (t.t === "kw" && CLOSERS.has(t.v)) {
        const opener = Object.entries(BLOCKS).find(([, b]) => b.closer.toLowerCase().replace(" ", "") === t.v);
        this.error("CierreSinApertura", t, { cierre: t.raw, apertura: opener ? opener[1].display : "bloque" });
        this.next();
      } else {
        if (!strayReported) {
          this.error("FaltaProceso", t);
          strayReported = true;
        }
        this.parseStatement();
      }
      this.skipSeparators();
    }
    return { main, funcs, constructs: this.constructs };
  }

  private parseMain(): NonNullable<Program["main"]> {
    const open = this.next();
    const nameTok = this.peek().t === "id" ? this.next() : null;
    if (!nameTok) this.error("FaltaExpresion", this.peek());
    this.syncLine();
    const body = this.parseBlock(new Set(["finproceso", "finalgoritmo"]));
    let endLine = this.peek().line;
    if (this.isKw("finproceso") || this.isKw("finalgoritmo")) {
      endLine = this.next().line;
      this.endStatement();
    } else {
      this.error("FaltaCierre", open, {
        cierre: open.v === "algoritmo" ? "FinAlgoritmo" : "FinProceso",
        apertura: open.v === "algoritmo" ? "Algoritmo" : "Proceso",
      });
    }
    return { name: nameTok?.raw ?? "Programa", body, line: open.line, endLine };
  }

  private parseFunc(): FuncDef | null {
    const open = this.next();
    const kind = open.v === "funcion" ? "funcion" : "subproceso";
    this.constructs.add(kind);
    const first = this.expectId();
    if (!first) {
      this.syncLine();
      this.parseBlock(new Set(["finfuncion", "finsubproceso"]));
      if (this.isKw("finfuncion") || this.isKw("finsubproceso")) this.next();
      return null;
    }
    let returnVar: FuncDef["returnVar"] = null;
    let nameTok: Token | null = first;
    if (this.isOp("<-") || this.isOp("=")) {
      this.next();
      returnVar = { name: first.v, display: first.raw };
      nameTok = this.expectId();
    }
    const params: Param[] = [];
    if (this.isOp("(")) {
      this.next();
      if (!this.isOp(")")) {
        for (;;) {
          const pid = this.expectId();
          if (!pid) break;
          let byRef = false;
          if (this.isCtx("por")) {
            this.next();
            if (this.isCtx("referencia")) {
              this.next();
              byRef = true;
            } else if (this.isCtx("valor")) this.next();
          }
          params.push({ name: pid.v, display: pid.raw, byRef });
          if (this.isOp(",")) {
            this.next();
            continue;
          }
          break;
        }
      }
      if (this.isOp(")")) this.next();
      else this.error("FaltaParentesis", this.peek(), { simbolo: ")" });
    }
    this.syncLine();
    const body = this.parseBlock(new Set(["finfuncion", "finsubproceso"]));
    let endLine = this.peek().line;
    if (this.isKw("finfuncion") || this.isKw("finsubproceso")) {
      endLine = this.next().line;
      this.endStatement();
    } else {
      this.error("FaltaCierre", open, {
        cierre: kind === "funcion" ? "FinFuncion" : "FinSubProceso",
        apertura: kind === "funcion" ? "Funcion" : "SubProceso",
      });
    }
    const name = nameTok ?? first;
    return { kind, name: name.v, display: name.raw, returnVar, params, body, line: open.line, endLine };
  }

  private parseBlock(terms: Set<string>, stop?: () => boolean): Stmt[] {
    const out: Stmt[] = [];
    for (;;) {
      this.skipSeparators();
      const t = this.peek();
      if (t.t === "eof") break;
      if (t.t === "kw" && terms.has(t.v)) break;
      if (stop && stop()) break;
      if (this.isBlockEnd()) break;
      const before = this.p;
      const s = this.parseStatement();
      if (s) out.push(s);
      if (this.p === before) this.next(); // never loop forever
    }
    return out;
  }

  // ---------- statements ----------
  private parseStatement(): Stmt | null {
    const t = this.peek();
    if (t.t === "kw") {
      switch (t.v) {
        case "definir":
          return this.parseDefine();
        case "dimension":
          return this.parseDim();
        case "escribir":
          return this.parseWrite();
        case "leer":
          return this.parseRead();
        case "si":
          return this.parseIf();
        case "segun":
          return this.parseSwitch();
        case "mientras":
          return this.parseWhile();
        case "repetir":
          return this.parseRepeat();
        case "para":
          return this.parseFor();
        default:
          this.error("SimboloInesperado", t, { simbolo: t.raw });
          this.syncLine();
          return null;
      }
    }
    if (t.t === "id") return this.parseAssignOrCall();
    this.error("SimboloInesperado", t, { simbolo: this.describe(t) });
    this.syncLine();
    return null;
  }

  private parseDefine(): Stmt | null {
    const kw = this.next();
    this.constructs.add("definir");
    const names: { name: string; display: string }[] = [];
    for (;;) {
      const id = this.expectId();
      if (!id) break;
      names.push({ name: id.v, display: id.raw });
      if (this.isOp(",")) {
        this.next();
        continue;
      }
      break;
    }
    let type: VarType = "real";
    if (this.isKw("como")) {
      this.next();
      const tt = this.peek();
      const ty = tt.t === "id" ? TYPE_NAMES[tt.norm ?? ""] : undefined;
      if (ty) {
        this.next();
        type = ty;
      } else {
        this.error("TipoDesconocido", tt, { tipo: this.describe(tt) });
        this.syncLine();
        return null;
      }
    } else if (names.length) {
      this.error("FaltaComo", this.peek().t === "nl" ? kw : this.peek(), { name: names[0].display });
      this.syncLine();
      return null;
    }
    this.endStatement();
    return names.length ? { k: "define", names, type, line: kw.line } : null;
  }

  private parseDim(): Stmt | null {
    const kw = this.next();
    this.constructs.add("dimension");
    const arrays: { name: string; display: string; dims: Expr[] }[] = [];
    for (;;) {
      const id = this.expectId();
      if (!id) break;
      let dims: Expr[] = [];
      if (this.isOp("[") || this.isOp("(")) {
        const close = this.next().v === "[" ? "]" : ")";
        dims = this.parseExprList();
        if (this.isOp(close)) this.next();
        else this.error("FaltaParentesis", this.peek(), { simbolo: close });
      } else {
        this.error("FaltaExpresion", this.peek());
      }
      arrays.push({ name: id.v, display: id.raw, dims });
      if (this.isOp(",")) {
        this.next();
        continue;
      }
      break;
    }
    this.endStatement();
    return { k: "dim", arrays, line: kw.line };
  }

  private parseWrite(): Stmt {
    const kw = this.next();
    this.constructs.add("escribir");
    let newline = true;
    if (this.isCtx("sin") && this.isCtx("saltar", 1)) {
      this.next();
      this.next();
      newline = false;
    }
    const items = this.atLineEnd() || this.isBlockEnd() ? [] : this.parseExprList();
    if (this.isCtx("sin") && this.isCtx("saltar", 1)) {
      this.next();
      this.next();
      newline = false;
    }
    this.endStatement();
    return { k: "write", items, newline, line: kw.line };
  }

  private parseRead(): Stmt {
    const kw = this.next();
    this.constructs.add("leer");
    const targets: LValue[] = [];
    for (;;) {
      const lv = this.parseLValue();
      if (!lv) break;
      targets.push(lv);
      if (this.isOp(",")) {
        this.next();
        continue;
      }
      break;
    }
    if (!targets.length) this.error("FaltaExpresion", this.peek());
    this.endStatement();
    return { k: "read", targets, line: kw.line };
  }

  private parseLValue(): LValue | null {
    const id = this.expectId();
    if (!id) return null;
    if (this.isOp("[") || this.isOp("(")) {
      const close = this.next().v === "[" ? "]" : ")";
      const indices = this.parseExprList();
      if (this.isOp(close)) this.next();
      else this.error("FaltaParentesis", this.peek(), { simbolo: close });
      return { k: "index", name: id.v, display: id.raw, indices, line: id.line };
    }
    return { k: "var", name: id.v, display: id.raw, line: id.line };
  }

  private parseIf(): Stmt {
    const open = this.next();
    this.constructs.add("si");
    const cond = this.parseExpr();
    const save = this.p;
    this.skipNewlinesOnly();
    if (this.isKw("entonces")) this.next();
    else {
      this.p = save;
      this.error("FaltaEntonces", open);
    }
    const then = this.parseBlock(new Set(["sino", "finsi"]));
    let els: Stmt[] | null = null;
    if (this.isKw("sino")) {
      this.next();
      els = this.parseBlock(new Set(["finsi"]));
    }
    let endLine = this.peek().line;
    if (this.isKw("finsi")) {
      endLine = this.next().line;
      this.endStatement();
    } else this.error("FaltaCierre", open, { cierre: "FinSi", apertura: "Si" });
    return { k: "if", cond, then, else: els, line: open.line, endLine };
  }

  private isDefaultLabel(): boolean {
    if (this.isCtx("de") && this.isCtx("otro", 1) && this.isCtx("modo", 2)) return true;
    return this.isKw("sino") && this.isOp(":", 1);
  }
  private isCaseLabelAhead(): boolean {
    const t = this.peek();
    if (t.t === "kw" && !["verdadero", "falso"].includes(t.v)) return false;
    for (let o = 0; ; o++) {
      const k = this.peek(o);
      if (k.t === "nl" || k.t === "eof" || (k.t === "op" && k.v === ";")) return false;
      if (k.t === "op" && k.v === ":") return true;
    }
  }

  private parseSwitch(): Stmt {
    const open = this.next();
    this.constructs.add("segun");
    const e = this.parseExpr();
    if (this.isKw("hacer")) this.next();
    else this.error("FaltaHacer", open, { apertura: "el Segun" });
    const cases: { values: Expr[]; body: Stmt[]; line: number }[] = [];
    let dflt: Stmt[] | null = null;
    const stopCase = () => this.isDefaultLabel() || this.isCaseLabelAhead();
    let endLine = open.line;
    for (;;) {
      this.skipSeparators();
      if (this.isKw("finsegun")) {
        endLine = this.next().line;
        this.endStatement();
        break;
      }
      if (this.peek().t === "eof" || (this.isBlockEnd() && !this.isDefaultLabel())) {
        this.error("FaltaCierre", open, { cierre: "FinSegun", apertura: "Segun" });
        break;
      }
      if (this.isDefaultLabel()) {
        const lt = this.peek();
        if (this.isKw("sino")) this.next();
        else {
          this.next();
          this.next();
          this.next();
        }
        if (this.isOp(":")) this.next();
        dflt = this.parseBlock(new Set(["finsegun"]), stopCase);
        void lt;
        continue;
      }
      if (this.isCaseLabelAhead()) {
        const lt = this.peek();
        if (this.isCtx("caso")) this.next();
        const values = this.parseExprList();
        if (this.isOp(":")) this.next();
        else this.error("SimboloInesperado", this.peek(), { simbolo: this.describe(this.peek()) });
        const body = this.parseBlock(new Set(["finsegun"]), stopCase);
        cases.push({ values, body, line: lt.line });
        continue;
      }
      const bad = this.peek();
      this.error("SimboloInesperado", bad, { simbolo: this.describe(bad) });
      this.syncLine();
    }
    return { k: "switch", e, cases, dflt, line: open.line, endLine };
  }

  private parseWhile(): Stmt {
    const open = this.next();
    this.constructs.add("mientras");
    const cond = this.parseExpr();
    const save = this.p;
    this.skipNewlinesOnly();
    if (this.isKw("hacer")) this.next();
    else {
      this.p = save;
      this.error("FaltaHacer", open, { apertura: "la condición del Mientras" });
    }
    const body = this.parseBlock(new Set(["finmientras"]));
    let endLine = this.peek().line;
    if (this.isKw("finmientras")) {
      endLine = this.next().line;
      this.endStatement();
    } else this.error("FaltaCierre", open, { cierre: "FinMientras", apertura: "Mientras" });
    return { k: "while", cond, body, line: open.line, endLine };
  }

  private parseRepeat(): Stmt {
    const open = this.next();
    this.constructs.add("repetir");
    const body = this.parseBlock(new Set(["hasta"]), () => this.isKw("mientras") && this.isCtx("que", 1));
    if (this.isKw("hasta")) {
      const h = this.next();
      if (this.isCtx("que")) this.next();
      else this.error("FaltaQue", h);
      const cond = this.parseExpr();
      this.endStatement();
      return { k: "repeat", body, cond, until: true, line: open.line, condLine: h.line };
    }
    if (this.isKw("mientras") && this.isCtx("que", 1)) {
      const m = this.next();
      this.next();
      const cond = this.parseExpr();
      this.endStatement();
      return { k: "repeat", body, cond, until: false, line: open.line, condLine: m.line };
    }
    this.error("FaltaCierre", open, { cierre: "Hasta Que", apertura: "Repetir" });
    return { k: "repeat", body, cond: { k: "bool", v: true, line: open.line }, until: true, line: open.line, condLine: open.line };
  }

  private parseFor(): Stmt | null {
    const open = this.next();
    this.constructs.add("para");
    const id = this.expectId();
    if (!id) {
      this.syncLine();
      return null;
    }
    if (this.isOp("<-")) this.next();
    else if (this.isOp("=")) {
      this.error("AsignacionConIgual", this.peek(), { name: id.raw, valor: "1" });
      this.next();
    } else this.error("SimboloInesperado", this.peek(), { simbolo: this.describe(this.peek()) });
    const from = this.parseExpr();
    if (this.isKw("hasta")) this.next();
    else this.error("SimboloInesperado", this.peek(), { simbolo: this.describe(this.peek()) });
    const to = this.parseExpr();
    let step: Expr | null = null;
    if (this.isCtx("con") && this.isCtx("paso", 1)) {
      this.next();
      this.next();
      step = this.parseExpr();
    }
    const save = this.p;
    this.skipNewlinesOnly();
    if (this.isKw("hacer")) this.next();
    else {
      this.p = save;
      this.error("FaltaHacer", open, { apertura: "el Para" });
    }
    const body = this.parseBlock(new Set(["finpara"]));
    let endLine = this.peek().line;
    if (this.isKw("finpara")) {
      endLine = this.next().line;
      this.endStatement();
    } else this.error("FaltaCierre", open, { cierre: "FinPara", apertura: "Para" });
    return { k: "for", v: { name: id.v, display: id.raw }, from, to, step, body, line: open.line, endLine };
  }

  private parseAssignOrCall(): Stmt | null {
    const id = this.peek();
    if (this.isOp("[", 1)) {
      const lv = this.parseLValue();
      return lv ? this.finishAssign(lv, id) : null;
    }
    if (this.isOp("(", 1)) {
      this.next();
      this.next();
      const args = this.isOp(")") ? [] : this.parseExprList();
      if (this.isOp(")")) this.next();
      else this.error("FaltaParentesis", this.peek(), { simbolo: ")" });
      if (this.isOp("<-") || this.isOp("=")) {
        return this.finishAssign({ k: "index", name: id.v, display: id.raw, indices: args, line: id.line }, id);
      }
      args.forEach(markCalls);
      this.endStatement();
      return { k: "call", name: id.v, display: id.raw, args, line: id.line };
    }
    if (this.isOp("<-", 1) || this.isOp("=", 1)) {
      this.next();
      return this.finishAssign({ k: "var", name: id.v, display: id.raw, line: id.line }, id);
    }
    if (this.atLineEnd(1) || this.isBlockEnd()) {
      this.next();
      this.endStatement();
      return { k: "call", name: id.v, display: id.raw, args: [], line: id.line };
    }
    const guess = closestWord(id.raw);
    this.error("InstruccionDesconocida", id, {
      name: id.raw,
      sugerencia: guess ? ` ¿Quisiste decir ${guess}?` : "",
    });
    this.syncLine();
    return null;
  }

  private finishAssign(target: LValue, idTok: Token): Stmt | null {
    if (this.isOp("=")) {
      const eq = this.next();
      const rest: string[] = [];
      for (let o = 0; !this.atLineEnd(o); o++) rest.push(this.peek(o).raw);
      this.error("AsignacionConIgual", eq, { name: idTok.raw, valor: rest.join(" ") || "valor" });
      this.syncLine();
      return null;
    }
    if (!this.isOp("<-")) {
      this.error("SimboloInesperado", this.peek(), { simbolo: this.describe(this.peek()) });
      this.syncLine();
      return null;
    }
    this.next();
    const e = this.parseExpr();
    this.endStatement();
    return { k: "assign", target, e, line: idTok.line };
  }

  // ---------- expressions ----------
  parseExprList(): Expr[] {
    const list = [this.parseExpr()];
    while (this.isOp(",")) {
      this.next();
      list.push(this.parseExpr());
    }
    return list;
  }

  parseExpr(): Expr {
    const e = this.parseOr();
    markCalls(e);
    return e;
  }
  private bin(op: BinOp, l: Expr, r: Expr, line: number): Expr {
    return { k: "bin", op, l, r, line };
  }
  private parseOr(): Expr {
    let l = this.parseAnd();
    while (this.isKw("o") || this.isOp("|")) {
      const t = this.next();
      l = this.bin("o", l, this.parseAnd(), t.line);
    }
    return l;
  }
  private parseAnd(): Expr {
    let l = this.parseCmp();
    while (this.isKw("y") || this.isOp("&")) {
      const t = this.next();
      l = this.bin("y", l, this.parseCmp(), t.line);
    }
    return l;
  }
  private parseCmp(): Expr {
    let l = this.parseAdd();
    while (this.peek().t === "op" && CMP_OPS.has(this.peek().v)) {
      const t = this.next();
      l = this.bin(t.v as BinOp, l, this.parseAdd(), t.line);
    }
    return l;
  }
  private parseAdd(): Expr {
    let l = this.parseMul();
    while (this.isOp("+") || this.isOp("-")) {
      const t = this.next();
      l = this.bin(t.v as BinOp, l, this.parseMul(), t.line);
    }
    return l;
  }
  private parseMul(): Expr {
    let l = this.parseUnary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%") || this.isKw("mod")) {
      const t = this.next();
      const op: BinOp = t.v === "%" || t.v === "mod" ? "mod" : (t.v as BinOp);
      l = this.bin(op, l, this.parseUnary(), t.line);
    }
    return l;
  }
  private parseUnary(): Expr {
    if (this.isOp("-")) {
      const t = this.next();
      return { k: "un", op: "-", e: this.parseUnary(), line: t.line };
    }
    if (this.isOp("+")) {
      this.next();
      return this.parseUnary();
    }
    if (this.isKw("no") || this.isOp("~")) {
      const t = this.next();
      return { k: "un", op: "no", e: this.parseUnary(), line: t.line };
    }
    return this.parsePow();
  }
  private parsePow(): Expr {
    const base = this.parsePrimary();
    if (this.isOp("^")) {
      const t = this.next();
      return this.bin("^", base, this.parseUnary(), t.line);
    }
    return base;
  }
  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.t === "num") {
      this.next();
      return { k: "num", v: t.num ?? 0, line: t.line };
    }
    if (t.t === "str") {
      this.next();
      return { k: "str", v: t.v, line: t.line };
    }
    if (t.t === "kw" && (t.v === "verdadero" || t.v === "falso")) {
      this.next();
      return { k: "bool", v: t.v === "verdadero", line: t.line };
    }
    if (this.isOp("(")) {
      this.next();
      const e = this.parseOr();
      if (this.isOp(")")) this.next();
      else this.error("FaltaParentesis", this.peek(), { simbolo: ")" });
      return e;
    }
    if (t.t === "id") {
      this.next();
      if (this.isOp("[")) {
        this.next();
        const indices = this.parseExprList();
        if (this.isOp("]")) this.next();
        else this.error("FaltaParentesis", this.peek(), { simbolo: "]" });
        return { k: "index", name: t.v, display: t.raw, indices, line: t.line };
      }
      if (this.isOp("(")) {
        this.next();
        const args = this.isOp(")") ? [] : this.parseExprList();
        if (this.isOp(")")) this.next();
        else this.error("FaltaParentesis", this.peek(), { simbolo: ")" });
        return { k: "call", name: t.v, display: t.raw, args, line: t.line };
      }
      return { k: "var", name: t.v, display: t.raw, line: t.line };
    }
    if (t.t === "kw" && RESERVED[t.v] && !CLOSERS.has(t.v) && !["entonces", "hacer", "hasta"].includes(t.v)) {
      this.error("SimboloInesperado", t, { simbolo: t.raw });
      this.next();
    } else this.error("FaltaExpresion", t);
    return { k: "num", v: 0, line: t.line };
  }
}

export function parse(tokens: Token[], lexDiagnostics: LexDiagnostic[] = []) {
  const parser = new Parser(tokens, lexDiagnostics);
  const program = parser.parseProgram();
  return { program, diagnostics: parser.diagnostics };
}
