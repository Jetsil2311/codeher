"use client";
// CodeMirror StreamLanguage mode for pseudocodigo-es, generated from the same keyword
// table as the interpreter (packages/grader/src/pseudo/keywords.ts).
import { StreamLanguage, type StreamParser } from "@codemirror/language";
import { snippetCompletion, type Completion, type CompletionContext } from "@codemirror/autocomplete";
import { BUILTINS, CONTEXTUAL, RESERVED, normalizeWord } from "@codeher/grader/pseudo";

const OPENERS = new Set(["proceso", "algoritmo", "funcion", "subproceso", "si", "segun", "mientras", "para", "repetir"]);
const CLOSERS = new Set(["finproceso", "finalgoritmo", "finfuncion", "finsubproceso", "finsi", "finsegun", "finmientras", "finpara", "hasta"]);
const ATOMS = new Set(["verdadero", "falso"]);
const OPWORDS = new Set(["y", "o", "no", "mod"]);
const TYPES = new Set(["entero", "real", "numero", "caracter", "texto", "cadena", "logico"]);

interface State {
  depth: number;
  inComment: boolean;
  lineStart: boolean;
  firstWord: string | null;
  sawSecond: boolean;
}

const parser: StreamParser<State> = {
  name: "pseudocodigo",
  startState: () => ({ depth: 0, inComment: false, lineStart: true, firstWord: null, sawSecond: false }),
  copyState: (s) => ({ ...s }),
  token(stream, state) {
    if (stream.sol()) {
      state.lineStart = true;
      state.firstWord = null;
      state.sawSecond = false;
    }
    if (state.inComment) {
      if (stream.skipTo("*/")) {
        stream.match("*/");
        state.inComment = false;
      } else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.inComment = true;
      return "comment";
    }
    const ch = stream.peek();
    if (ch === '"' || ch === "'") {
      stream.next();
      while (!stream.eol()) {
        if (stream.next() === ch) break;
      }
      state.lineStart = false;
      return "string";
    }
    if (stream.match(/^\d+(\.\d+)?/)) {
      state.lineStart = false;
      return "number";
    }
    if (stream.match(/^(<-|←|<=|>=|<>|[=<>+\-*/^%&|~])/)) {
      state.lineStart = false;
      return "operator";
    }
    if (stream.match(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ_][\wÁÉÍÓÚÜÑáéíóúüñ]*/)) {
      const word = normalizeWord(stream.current());
      const first = state.lineStart;
      state.lineStart = false;
      if (first) state.firstWord = word;
      else if (!state.sawSecond) {
        state.sawSecond = true;
        // "Mientras Que" closes a Repetir instead of opening a loop.
        if (state.firstWord === "mientras" && word === "que") state.depth = Math.max(0, state.depth - 2);
      }
      if (first && OPENERS.has(word)) state.depth++;
      if (first && CLOSERS.has(word)) state.depth = Math.max(0, state.depth - 1);
      if (ATOMS.has(word)) return "atom";
      if (OPWORDS.has(word)) return "operatorKeyword";
      if (RESERVED[word] !== undefined || CONTEXTUAL[word] !== undefined) return "keyword";
      if (TYPES.has(word)) return "typeName";
      if (BUILTINS[word]) return "function";
      return "variableName";
    }
    stream.next();
    state.lineStart = false;
    return null;
  },
  indent(state, textAfter, cx) {
    const w = normalizeWord(textAfter.trim().split(/\s+/)[0] ?? "");
    let depth = state.depth;
    if (CLOSERS.has(w) || w === "sino") depth -= 1;
    return Math.max(0, depth) * cx.unit;
  },
  languageData: {
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    indentOnInput: /^\s*(FinSi|Sino|FinMientras|FinPara|FinSegun|FinProceso|FinFuncion|FinSubProceso|Hasta)$/i,
  },
};

export const pseudoLanguage = StreamLanguage.define(parser);

const SNIPPETS: Completion[] = [
  snippetCompletion("Si ${condicion} Entonces\n\t${}\nSino\n\t\nFinSi", { label: "Si", detail: "Si ... Entonces ... Sino ... FinSi", type: "keyword", boost: 10 }),
  snippetCompletion("Mientras ${condicion} Hacer\n\t${}\nFinMientras", { label: "Mientras", detail: "Mientras ... Hacer ... FinMientras", type: "keyword", boost: 9 }),
  snippetCompletion("Para ${i} <- 1 Hasta ${10} Hacer\n\t${}\nFinPara", { label: "Para", detail: "Para ... Hasta ... Hacer ... FinPara", type: "keyword", boost: 9 }),
  snippetCompletion("Repetir\n\t${}\nHasta Que ${condicion}", { label: "Repetir", detail: "Repetir ... Hasta Que", type: "keyword" }),
  snippetCompletion("Segun ${variable} Hacer\n\t1:\n\t\t${}\n\tDe Otro Modo:\n\t\t\nFinSegun", { label: "Segun", detail: "Segun ... Hacer ... FinSegun", type: "keyword" }),
  snippetCompletion("Proceso ${MiPrograma}\n\t${}\nFinProceso", { label: "Proceso", detail: "Proceso ... FinProceso", type: "keyword" }),
  snippetCompletion("Funcion ${resultado} <- ${Nombre}(${a})\n\t${}\nFinFuncion", { label: "Funcion", detail: "Funcion r <- Nombre(...)", type: "keyword" }),
  snippetCompletion("Definir ${nombre} Como ${Entero};", { label: "Definir", detail: "Definir x Como Tipo;", type: "keyword", boost: 8 }),
  snippetCompletion('Escribir "${}";', { label: "Escribir", detail: "Muestra un texto", type: "keyword", boost: 8 }),
  snippetCompletion("Leer ${variable};", { label: "Leer", detail: "Pide un dato", type: "keyword", boost: 7 }),
  snippetCompletion("Dimension ${arreglo}[${5}];", { label: "Dimension", detail: "Crea un arreglo", type: "keyword" }),
  ...["Entero", "Real", "Caracter", "Logico", "Verdadero", "Falso", "Entonces", "Hacer", "FinSi", "FinMientras", "FinPara", "FinSegun", "FinProceso", "MOD"].map((label) => ({ label, type: "keyword" })),
  ...Object.values(BUILTINS).map((b) => snippetCompletion(`${b.name}(\${})`, { label: b.name, type: "function", detail: "función" })),
];

/** Keywords, snippets and the variables declared in the current program. */
export function pseudoCompletions(ctx: CompletionContext) {
  const word = ctx.matchBefore(/[\wÁÉÍÓÚÜÑáéíóúüñ]+/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  const text = ctx.state.doc.toString();
  const declared = new Set<string>();
  for (const m of text.matchAll(/Definir\s+([^;\n]+?)\s+Como/gi)) m[1].split(",").forEach((n) => declared.add(n.trim()));
  for (const m of text.matchAll(/Dimension\s+([\wñ]+)/gi)) declared.add(m[1]);
  const vars: Completion[] = [...declared].filter(Boolean).map((label) => ({ label, type: "variable", boost: 12 }));
  return { from: word.from, options: [...vars, ...SNIPPETS], validFor: /^[\wÁÉÍÓÚÜÑáéíóúüñ]*$/ };
}
