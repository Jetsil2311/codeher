// Static checks before running (tech spec 6.10): declarations, undefined variables,
// arity and array usage. Exposed to the editor through lint().

import type { Expr, FuncDef, LValue, Program, Stmt } from "./ast";
import { BUILTINS } from "./keywords";
import type { LexDiagnostic } from "./lexer";

interface Sym {
  isArray: boolean;
}

export function analyze(program: Program): LexDiagnostic[] {
  const out: LexDiagnostic[] = [];
  const seenLines = new Set<number>();
  const report = (code: string, line: number, params: Record<string, string | number>) => {
    if (seenLines.has(line)) return;
    seenLines.add(line);
    out.push({ code, line, col: 1, endCol: 1, params: { line, ...params } });
  };

  const checkBlock = (stmts: Stmt[], scope: Map<string, Sym>) => {
    for (const s of stmts) checkStmt(s, scope);
  };

  const useVar = (name: string, display: string, line: number, scope: Map<string, Sym>) => {
    if (!scope.has(name)) report("VariableNoDefinida", line, { name: display, word: display });
  };

  const checkExpr = (e: Expr, scope: Map<string, Sym>) => {
    switch (e.k) {
      case "var":
        useVar(e.name, e.display, e.line, scope);
        break;
      case "index": {
        const sym = scope.get(e.name);
        if (!sym) report("VariableNoDefinida", e.line, { name: e.display, word: e.display });
        else if (!sym.isArray) report("ArregloSinDimension", e.line, { name: e.display, word: e.display });
        e.indices.forEach((x) => checkExpr(x, scope));
        break;
      }
      case "call": {
        e.args.forEach((x) => checkExpr(x, scope));
        const sym = scope.get(e.name);
        if (sym?.isArray) break; // notas(i): paren index
        checkCall(e.name, e.display, e.args.length, e.line, true);
        break;
      }
      case "un":
        checkExpr(e.e, scope);
        break;
      case "bin":
        checkExpr(e.l, scope);
        checkExpr(e.r, scope);
        break;
      default:
        break;
    }
  };

  const checkCall = (name: string, display: string, argc: number, line: number, asValue: boolean) => {
    const f = program.funcs[name];
    if (f) {
      if (f.params.length !== argc)
        report("ArgumentosIncorrectos", line, { name: f.display, esperados: f.params.length, recibidos: argc, word: display });
      else if (asValue && !f.returnVar) report("SinValorDeRetorno", line, { name: f.display, word: display });
      return;
    }
    const b = BUILTINS[name.normalize("NFD").replace(/[̀-ͯ]/g, "")];
    if (b) {
      if (argc < b.arity[0] || argc > b.arity[1])
        report("ArgumentosIncorrectos", line, { name: b.name, esperados: b.arity[0], recibidos: argc, word: display });
      return;
    }
    report("FuncionNoExiste", line, { name: display, word: display });
  };

  const checkTarget = (lv: LValue, scope: Map<string, Sym>) => {
    const sym = scope.get(lv.name);
    if (!sym) {
      report("VariableNoDefinida", lv.line, { name: lv.display, word: lv.display });
      return;
    }
    if (lv.k === "index") {
      if (!sym.isArray) report("ArregloSinDimension", lv.line, { name: lv.display, word: lv.display });
      lv.indices.forEach((x) => checkExpr(x, scope));
    }
  };

  const checkStmt = (s: Stmt, scope: Map<string, Sym>) => {
    switch (s.k) {
      case "define":
        for (const n of s.names) if (!scope.has(n.name)) scope.set(n.name, { isArray: false });
        break;
      case "dim":
        for (const a of s.arrays) {
          a.dims.forEach((d) => checkExpr(d, scope));
          scope.set(a.name, { isArray: true });
        }
        break;
      case "assign":
        checkExpr(s.e, scope);
        checkTarget(s.target, scope);
        break;
      case "write":
        s.items.forEach((x) => checkExpr(x, scope));
        break;
      case "read":
        s.targets.forEach((t) => checkTarget(t, scope));
        break;
      case "if":
        checkExpr(s.cond, scope);
        checkBlock(s.then, scope);
        if (s.else) checkBlock(s.else, scope);
        break;
      case "switch":
        checkExpr(s.e, scope);
        for (const c of s.cases) {
          c.values.forEach((v) => checkExpr(v, scope));
          checkBlock(c.body, scope);
        }
        if (s.dflt) checkBlock(s.dflt, scope);
        break;
      case "while":
        checkExpr(s.cond, scope);
        checkBlock(s.body, scope);
        break;
      case "repeat":
        checkBlock(s.body, scope);
        checkExpr(s.cond, scope);
        break;
      case "for":
        if (!scope.has(s.v.name)) report("VariableNoDefinida", s.line, { name: s.v.display, word: s.v.display });
        checkExpr(s.from, scope);
        checkExpr(s.to, scope);
        if (s.step) checkExpr(s.step, scope);
        checkBlock(s.body, scope);
        break;
      case "call":
        s.args.forEach((x) => checkExpr(x, scope));
        if (!scope.get(s.name)?.isArray) checkCall(s.name, s.display, s.args.length, s.line, false);
        break;
    }
  };

  if (program.main) checkBlock(program.main.body, new Map());
  for (const f of Object.values(program.funcs) as FuncDef[]) {
    const scope = new Map<string, Sym>();
    for (const p of f.params) scope.set(p.name, { isArray: false });
    if (f.returnVar) scope.set(f.returnVar.name, { isArray: false });
    // Arrays passed as parameters are indexable inside the function.
    const markParamArrays = (stmts: Stmt[]) => {
      const visit = (e: Expr) => {
        if ((e.k === "index" || e.k === "call") && f.params.some((p) => p.name === e.name)) scope.set(e.name, { isArray: true });
        if (e.k === "index") e.indices.forEach(visit);
        if (e.k === "call") e.args.forEach(visit);
        if (e.k === "un") visit(e.e);
        if (e.k === "bin") {
          visit(e.l);
          visit(e.r);
        }
      };
      const walk = (ss: Stmt[]) =>
        ss.forEach((s) => {
          if (s.k === "assign") {
            visit(s.e);
            if (s.target.k === "index" && f.params.some((p) => p.name === s.target.name)) scope.set(s.target.name, { isArray: true });
          }
          if (s.k === "write") s.items.forEach(visit);
          if (s.k === "read") s.targets.forEach((t) => t.k === "index" && f.params.some((p) => p.name === t.name) && scope.set(t.name, { isArray: true }));
          if (s.k === "if") {
            visit(s.cond);
            walk(s.then);
            if (s.else) walk(s.else);
          }
          if (s.k === "while") {
            visit(s.cond);
            walk(s.body);
          }
          if (s.k === "repeat") {
            walk(s.body);
            visit(s.cond);
          }
          if (s.k === "for") {
            visit(s.from);
            visit(s.to);
            walk(s.body);
          }
          if (s.k === "switch") {
            visit(s.e);
            s.cases.forEach((c) => walk(c.body));
            if (s.dflt) walk(s.dflt);
          }
        });
      walk(stmts);
    };
    markParamArrays(f.body);
    checkBlock(f.body, scope);
  }
  return out;
}
