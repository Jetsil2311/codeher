// Lexer for pseudocodigo-es v1: tokens with line/column, case-insensitive keywords,
// accented and unaccented spellings, Spanish diagnostics for stray characters.

import { CONTEXTUAL, FIN_MERGE, RESERVED, normalizeWord } from "./keywords";

export type TokType = "num" | "str" | "id" | "kw" | "op" | "nl" | "eof";

export interface Token {
  t: TokType;
  /** kw: normalized keyword; op: operator; id: lowercase key; num/str: raw text */
  v: string;
  raw: string;
  line: number;
  col: number;
  endCol: number;
  num?: number;
  /** normalized form for contextual keyword checks (ids only) */
  norm?: string;
}

export interface LexDiagnostic {
  code: string;
  line: number;
  col: number;
  endCol: number;
  params: Record<string, string | number>;
}

const OPS = ["<-", "<=", ">=", "<>", "!=", "==", "**", "=", "<", ">", "+", "-", "*", "/", "^", "%", "(", ")", "[", "]", ",", ";", ":", "&", "|", "~", "←"];

const isIdStart = (c: string) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_]/.test(c);
const isIdPart = (c: string) => /[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ_]/.test(c);

export function lex(src: string): { tokens: Token[]; diagnostics: LexDiagnostic[] } {
  const tokens: Token[] = [];
  const diagnostics: LexDiagnostic[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const n = src.length;

  const push = (tok: Token) => tokens.push(tok);

  while (i < n) {
    const c = src[i];

    if (c === "\n") {
      push({ t: "nl", v: "\n", raw: "\n", line, col, endCol: col + 1 });
      i++;
      line++;
      col = 1;
      continue;
    }
    if (c === "\r" || c === " " || c === "\t" || c === " ") {
      i++;
      col++;
      continue;
    }
    // Comments: // line and /* block */
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") {
        i++;
        col++;
      }
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      col += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") {
          push({ t: "nl", v: "\n", raw: "\n", line, col, endCol: col + 1 });
          line++;
          col = 1;
        } else col++;
        i++;
      }
      i += 2;
      col += 2;
      continue;
    }
    // Strings
    if (c === '"' || c === "'" || c === "“" || c === "”" || c === "‘" || c === "’") {
      const close = c === "“" ? "”" : c === "‘" ? "’" : c;
      const startCol = col;
      let j = i + 1;
      let text = "";
      while (j < n && src[j] !== "\n" && src[j] !== close && !(close === "”" && src[j] === '"')) {
        text += src[j];
        j++;
      }
      if (j >= n || src[j] === "\n") {
        diagnostics.push({ code: "TextoSinCerrar", line, col: startCol, endCol: startCol + (j - i), params: { line } });
        push({ t: "str", v: text, raw: src.slice(i, j), line, col: startCol, endCol: startCol + (j - i) });
        col += j - i;
        i = j;
        continue;
      }
      push({ t: "str", v: text, raw: src.slice(i, j + 1), line, col: startCol, endCol: startCol + (j + 1 - i) });
      col += j + 1 - i;
      i = j + 1;
      continue;
    }
    // Numbers (decimal point; a trailing dot is not part of the number)
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9]/.test(src[j])) j++;
      if (src[j] === "." && /[0-9]/.test(src[j + 1] ?? "")) {
        j++;
        while (j < n && /[0-9]/.test(src[j])) j++;
      }
      const raw = src.slice(i, j);
      push({ t: "num", v: raw, raw, line, col, endCol: col + raw.length, num: Number(raw) });
      col += raw.length;
      i = j;
      continue;
    }
    // Identifiers and keywords
    if (isIdStart(c)) {
      let j = i;
      while (j < n && isIdPart(src[j])) j++;
      const raw = src.slice(i, j);
      const norm = normalizeWord(raw);
      // "Fin Si" written as two words: merge into one closer.
      if (norm === "fin") {
        let k = j;
        while (k < n && (src[k] === " " || src[k] === "\t")) k++;
        let m = k;
        while (m < n && isIdPart(src[m])) m++;
        const next = normalizeWord(src.slice(k, m));
        if (k > j && FIN_MERGE.has(next)) {
          const full = "fin" + next;
          push({ t: "kw", v: full, raw: src.slice(i, m), line, col, endCol: col + (m - i) });
          col += m - i;
          i = m;
          continue;
        }
      }
      if (RESERVED[norm] !== undefined) {
        // Synonyms collapse to the canonical keyword (Imprimir/Mostrar -> escribir).
        const canonical = normalizeWord(RESERVED[norm]);
        push({ t: "kw", v: canonical, raw, line, col, endCol: col + raw.length });
      } else {
        push({ t: "id", v: raw.toLowerCase(), raw, line, col, endCol: col + raw.length, norm });
      }
      col += raw.length;
      i = j;
      continue;
    }
    // Operators
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      const v = op === "←" ? "<-" : op === "!=" ? "<>" : op === "==" ? "=" : op === "**" ? "^" : op;
      push({ t: "op", v, raw: op, line, col, endCol: col + op.length });
      i += op.length;
      col += op.length;
      continue;
    }
    diagnostics.push({ code: "SimboloInesperado", line, col, endCol: col + 1, params: { simbolo: c, line } });
    i++;
    col++;
  }
  push({ t: "eof", v: "", raw: "", line, col, endCol: col });
  return { tokens, diagnostics };
}

export function isContextual(tok: Token | undefined, word: string): boolean {
  return !!tok && tok.t === "id" && tok.norm === word && CONTEXTUAL[word] !== undefined;
}
