// Single keyword table for pseudocodigo-es v1 (tech spec Appendix D).
// Used by the lexer, the parser, the editor mode, the formatter and the docs.

/** Lowercase and strip accents (keywords accept Según/Segun, Función/Funcion...). */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ");
}

/** Reserved words: they can never be identifiers. Value = canonical spelling. */
export const RESERVED: Record<string, string> = {
  proceso: "Proceso",
  finproceso: "FinProceso",
  algoritmo: "Algoritmo",
  finalgoritmo: "FinAlgoritmo",
  funcion: "Funcion",
  finfuncion: "FinFuncion",
  subproceso: "SubProceso",
  finsubproceso: "FinSubProceso",
  definir: "Definir",
  como: "Como",
  dimension: "Dimension",
  escribir: "Escribir",
  imprimir: "Escribir",
  mostrar: "Escribir",
  leer: "Leer",
  si: "Si",
  entonces: "Entonces",
  sino: "Sino",
  finsi: "FinSi",
  segun: "Segun",
  hacer: "Hacer",
  finsegun: "FinSegun",
  mientras: "Mientras",
  finmientras: "FinMientras",
  repetir: "Repetir",
  hasta: "Hasta",
  para: "Para",
  finpara: "FinPara",
  verdadero: "Verdadero",
  falso: "Falso",
  y: "Y",
  o: "O",
  no: "NO",
  mod: "MOD",
};

/** Keywords that only matter in context (they stay valid variable names elsewhere). */
export const CONTEXTUAL: Record<string, string> = {
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

export type VarType = "entero" | "real" | "caracter" | "logico";

/** Type names after `Como`. */
export const TYPE_NAMES: Record<string, VarType> = {
  entero: "entero",
  real: "real",
  numero: "real",
  numerico: "real",
  caracter: "caracter",
  texto: "caracter",
  cadena: "caracter",
  logico: "logico",
  booleano: "logico",
};

export const TYPE_DISPLAY: Record<VarType, string> = {
  entero: "Entero",
  real: "Real",
  caracter: "Caracter",
  logico: "Logico",
};

/** Block openers and their closers (used by parser messages, formatter and editor). */
export const BLOCKS: Record<string, { closer: string; display: string }> = {
  proceso: { closer: "FinProceso", display: "Proceso" },
  algoritmo: { closer: "FinAlgoritmo", display: "Algoritmo" },
  funcion: { closer: "FinFuncion", display: "Funcion" },
  subproceso: { closer: "FinSubProceso", display: "SubProceso" },
  si: { closer: "FinSi", display: "Si" },
  segun: { closer: "FinSegun", display: "Segun" },
  mientras: { closer: "FinMientras", display: "Mientras" },
  para: { closer: "FinPara", display: "Para" },
  repetir: { closer: "Hasta Que", display: "Repetir" },
};

export const CLOSERS = new Set([
  "finproceso",
  "finalgoritmo",
  "finfuncion",
  "finsubproceso",
  "finsi",
  "sino",
  "finsegun",
  "finmientras",
  "finpara",
  "hasta",
]);

/** Words that may follow `Fin ` to form a closer written in two words ("Fin Si"). */
export const FIN_MERGE = new Set([
  "si",
  "mientras",
  "para",
  "segun",
  "proceso",
  "algoritmo",
  "funcion",
  "subproceso",
]);

/** Construct names accepted by construct_rule tests (Appendix D.4). */
export const CONSTRUCT_NAMES = [
  "Si",
  "Segun",
  "Mientras",
  "Repetir",
  "Para",
  "Funcion",
  "SubProceso",
  "Definir",
  "Dimension",
  "Leer",
  "Escribir",
];

export interface BuiltinInfo {
  name: string;
  arity: [number, number];
}

export const BUILTINS: Record<string, BuiltinInfo> = {
  rc: { name: "RC", arity: [1, 1] },
  raiz: { name: "RAIZ", arity: [1, 1] },
  abs: { name: "ABS", arity: [1, 1] },
  ln: { name: "LN", arity: [1, 1] },
  exp: { name: "EXP", arity: [1, 1] },
  sen: { name: "SEN", arity: [1, 1] },
  cos: { name: "COS", arity: [1, 1] },
  tan: { name: "TAN", arity: [1, 1] },
  atan: { name: "ATAN", arity: [1, 1] },
  trunc: { name: "TRUNC", arity: [1, 1] },
  redon: { name: "REDON", arity: [1, 1] },
  azar: { name: "AZAR", arity: [1, 1] },
  aleatorio: { name: "ALEATORIO", arity: [2, 2] },
  longitud: { name: "Longitud", arity: [1, 1] },
  subcadena: { name: "Subcadena", arity: [3, 3] },
  mayusculas: { name: "Mayusculas", arity: [1, 1] },
  minusculas: { name: "Minusculas", arity: [1, 1] },
  concatenar: { name: "Concatenar", arity: [2, 2] },
  convertiranumero: { name: "ConvertirANumero", arity: [1, 1] },
  convertiratexto: { name: "ConvertirATexto", arity: [1, 1] },
};

/** Words highlighted as keywords by the editor (canonical spellings, unique). */
export const EDITOR_KEYWORDS = Array.from(
  new Set([
    ...Object.values(RESERVED).filter((k) => !["Y", "O", "NO", "MOD", "Verdadero", "Falso"].includes(k)),
    "Sin Saltar",
    "De Otro Modo",
    "Con Paso",
    "Hasta Que",
    "Por Referencia",
  ]),
);

/** Spanish keywords a typo is most likely aiming at (for "¿Quisiste decir...?"). */
export const STATEMENT_WORDS = [
  "Escribir",
  "Leer",
  "Definir",
  "Dimension",
  "Si",
  "Sino",
  "FinSi",
  "Mientras",
  "FinMientras",
  "Para",
  "FinPara",
  "Repetir",
  "Segun",
  "FinSegun",
  "Proceso",
  "FinProceso",
  "Funcion",
  "FinFuncion",
  "SubProceso",
  "FinSubProceso",
];

export function closestWord(word: string, candidates = STATEMENT_WORDS): string | null {
  const w = normalizeWord(word);
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(w, normalizeWord(c));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD <= Math.max(1, Math.floor(w.length / 3)) ? best : null;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
