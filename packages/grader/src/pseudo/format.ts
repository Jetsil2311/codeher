// Pretty-printer for the "Dar formato" action: four-space indentation and canonical
// keyword capitalization. Strings and comments are never touched.

import { RESERVED, TYPE_DISPLAY, TYPE_NAMES, normalizeWord } from "./keywords";
import { lex, type Token } from "./lexer";

const OPENERS = new Set(["proceso", "algoritmo", "funcion", "subproceso", "si", "segun", "mientras", "para", "repetir"]);
const CLOSER_OF: Record<string, string> = {
  finproceso: "proceso",
  finalgoritmo: "algoritmo",
  finfuncion: "funcion",
  finsubproceso: "subproceso",
  finsi: "si",
  finsegun: "segun",
  finmientras: "mientras",
  finpara: "para",
};
const DISPLAY_CTX: Record<string, string> = {
  sin: "Sin",
  saltar: "Saltar",
  de: "De",
  otro: "Otro",
  modo: "Modo",
  que: "Que",
  con: "Con",
  paso: "Paso",
  por: "Por",
  referencia: "Referencia",
  valor: "Valor",
  caso: "Caso",
};

interface Entry {
  kind: string;
  level: number;
  inCase?: boolean;
}

function canonicalLine(line: string, toks: Token[]): string {
  const edits: { col: number; end: number; text: string }[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const prev = toks[i - 1];
    const next = toks[i + 1];
    if (t.t === "kw") {
      const display = RESERVED[t.v] ?? RESERVED[normalizeWord(t.raw)];
      if (display && display !== t.raw) edits.push({ col: t.col, end: t.endCol, text: display });
    } else if (t.t === "id") {
      const n = t.norm ?? "";
      const inCtx =
        (n === "que" && prev?.t === "kw" && (prev.v === "hasta" || prev.v === "mientras")) ||
        (n === "paso" && prev?.norm === "con") ||
        (n === "con" && next?.norm === "paso") ||
        (n === "sin" && next?.norm === "saltar") ||
        (n === "saltar" && prev?.norm === "sin") ||
        (n === "de" && next?.norm === "otro") ||
        (n === "otro" && prev?.norm === "de") ||
        (n === "modo" && prev?.norm === "otro") ||
        (n === "por" && (next?.norm === "referencia" || next?.norm === "valor")) ||
        ((n === "referencia" || n === "valor") && prev?.norm === "por");
      if (inCtx && DISPLAY_CTX[n] !== t.raw) edits.push({ col: t.col, end: t.endCol, text: DISPLAY_CTX[n] });
      else if (prev?.t === "kw" && prev.v === "como" && TYPE_NAMES[n]) {
        const disp = TYPE_DISPLAY[TYPE_NAMES[n]];
        if (disp !== t.raw) edits.push({ col: t.col, end: t.endCol, text: disp });
      }
    }
  }
  let out = line;
  for (const e of edits.sort((a, b) => b.col - a.col)) out = out.slice(0, e.col - 1) + e.text + out.slice(e.end - 1);
  return out;
}

export function format(code: string): string {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const stack: Entry[] = [];
  const out: string[] = [];
  const pad = (n: number) => "    ".repeat(Math.max(0, n));
  const level = () => {
    const top = stack[stack.length - 1];
    if (!top) return 0;
    if (top.kind === "segun") return top.level + (top.inCase ? 2 : 1);
    return top.level + 1;
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    const toks = lex(trimmed).tokens.filter((t) => t.t !== "nl" && t.t !== "eof");
    const text = canonicalLine(trimmed, toks);
    const first = toks[0];
    const second = toks[1];
    if (!first) {
      out.push(pad(level()) + text); // comment-only line
      continue;
    }
    const firstKw = first.t === "kw" ? first.v : null;

    // Closers
    const closesRepeat = firstKw === "hasta" || (firstKw === "mientras" && second?.norm === "que");
    if (closesRepeat) {
      const idx = stack.map((e) => e.kind).lastIndexOf("repetir");
      if (idx >= 0) {
        const e = stack[idx];
        stack.length = idx;
        out.push(pad(e.level) + text);
        continue;
      }
    }
    if (firstKw && CLOSER_OF[firstKw]) {
      const want = CLOSER_OF[firstKw];
      const idx = stack.map((e) => e.kind).lastIndexOf(want);
      if (idx >= 0) {
        const e = stack[idx];
        stack.length = idx;
        out.push(pad(e.level) + text);
        continue;
      }
    }
    if (firstKw === "sino") {
      const top = stack[stack.length - 1];
      if (top?.kind === "si") {
        out.push(pad(top.level) + text);
        continue;
      }
    }
    // Case labels inside Segun
    const top = stack[stack.length - 1];
    const isCaseLabel =
      top?.kind === "segun" &&
      (toks.some((t) => t.t === "op" && t.v === ":") ||
        (first.norm === "de" && second?.norm === "otro")) &&
      !(firstKw && OPENERS.has(firstKw));
    if (isCaseLabel && top) {
      top.inCase = true;
      out.push(pad(top.level + 1) + text);
      continue;
    }

    out.push(pad(level()) + text);
    if (firstKw && OPENERS.has(firstKw) && !(firstKw === "mientras" && second?.norm === "que")) {
      const closer = Object.entries(CLOSER_OF).find(([, o]) => o === firstKw)?.[0];
      const sameLineClose = toks.some((t, i) => i > 0 && t.t === "kw" && (t.v === closer || (firstKw === "repetir" && t.v === "hasta")));
      if (!sameLineClose) stack.push({ kind: firstKw, level: level() });
    }
  }
  return out.join("\n");
}
