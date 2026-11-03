import type { VarType } from "./keywords";

export type Expr =
  | { k: "num"; v: number; line: number; c?: boolean }
  | { k: "str"; v: string; line: number; c?: boolean }
  | { k: "bool"; v: boolean; line: number; c?: boolean }
  | { k: "var"; name: string; display: string; line: number; c?: boolean }
  | { k: "index"; name: string; display: string; indices: Expr[]; line: number; c?: boolean }
  | { k: "call"; name: string; display: string; args: Expr[]; line: number; c?: boolean }
  | { k: "un"; op: "-" | "no"; e: Expr; line: number; c?: boolean }
  | { k: "bin"; op: BinOp; l: Expr; r: Expr; line: number; c?: boolean };

export type BinOp = "+" | "-" | "*" | "/" | "^" | "mod" | "=" | "<>" | "<" | ">" | "<=" | ">=" | "y" | "o";

export type LValue =
  | { k: "var"; name: string; display: string; line: number }
  | { k: "index"; name: string; display: string; indices: Expr[]; line: number };

export type Stmt =
  | { k: "define"; names: { name: string; display: string }[]; type: VarType; line: number }
  | { k: "dim"; arrays: { name: string; display: string; dims: Expr[] }[]; line: number }
  | { k: "assign"; target: LValue; e: Expr; line: number }
  | { k: "write"; items: Expr[]; newline: boolean; line: number }
  | { k: "read"; targets: LValue[]; line: number }
  | { k: "if"; cond: Expr; then: Stmt[]; else: Stmt[] | null; line: number; endLine: number }
  | {
      k: "switch";
      e: Expr;
      cases: { values: Expr[]; body: Stmt[]; line: number }[];
      dflt: Stmt[] | null;
      line: number;
      endLine: number;
    }
  | { k: "while"; cond: Expr; body: Stmt[]; line: number; endLine: number }
  | { k: "repeat"; body: Stmt[]; cond: Expr; until: boolean; line: number; condLine: number }
  | {
      k: "for";
      v: { name: string; display: string };
      from: Expr;
      to: Expr;
      step: Expr | null;
      body: Stmt[];
      line: number;
      endLine: number;
    }
  | { k: "call"; name: string; display: string; args: Expr[]; line: number };

export interface Param {
  name: string;
  display: string;
  byRef: boolean;
}

export interface FuncDef {
  kind: "funcion" | "subproceso";
  name: string;
  display: string;
  returnVar: { name: string; display: string } | null;
  params: Param[];
  body: Stmt[];
  line: number;
  endLine: number;
}

export interface Program {
  main: { name: string; body: Stmt[]; line: number; endLine: number } | null;
  funcs: Record<string, FuncDef>;
  constructs: Set<string>;
}
