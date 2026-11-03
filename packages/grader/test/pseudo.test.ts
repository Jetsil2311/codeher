import { describe, expect, it } from "vitest";
import { format, grade, lint, runPlayground, trace, createSession } from "../src/pseudo";

const P = (body: string, defs = "") => `Proceso Prueba\n${body}\nFinProceso\n${defs}`;
const run = (code: string, stdin: string[] = []) => runPlayground(code, stdin, 3000, 7);
const out = (code: string, stdin: string[] = []) => {
  const r = run(code, stdin);
  if (r.error) throw new Error(`${r.error.type}: ${r.error.message}`);
  return r.stdout;
};
const errOf = (code: string, stdin: string[] = []) => run(code, stdin).error;

// [name, program body, expected stdout, stdin?]
const OUTPUT_FIXTURES: Array<[string, string, string, string[]?]> = [
  ["escribir texto", `Escribir "Hola, mundo";`, "Hola, mundo\n"],
  ["escribir sin punto y coma", `Escribir "Hola"`, "Hola\n"],
  ["escribir varios elementos", `Escribir "a", 1, "b", 2.5;`, "a1b2.5\n"],
  ["escribir vacio", `Escribir;`, "\n"],
  ["escribir sin saltar", `Escribir Sin Saltar "a";\nEscribir "b";`, "ab\n"],
  ["imprimir como sinonimo", `Imprimir "x";`, "x\n"],
  ["mostrar como sinonimo", `Mostrar "y";`, "y\n"],
  ["mayusculas y minusculas en palabras clave", `ESCRIBIR "ok";\nescribir "ok2";`, "ok\nok2\n"],
  ["asignacion y suma", `Definir a, b Como Entero;\na <- 2;\nb <- 3;\nEscribir a + b;`, "5\n"],
  ["flecha unicode", `Definir a Como Entero;\na ← 4;\nEscribir a;`, "4\n"],
  ["division real", `Definir r Como Real;\nr <- 7 / 2;\nEscribir r;`, "3.5\n"],
  ["division periodica", `Escribir 10 / 3;`, "3.33333333333\n"],
  ["mod", `Escribir 10 MOD 3, " ", 10 % 4;`, "1 2\n"],
  ["potencia", `Escribir 2 ^ 10;`, "1024\n"],
  ["potencia antes que menos unario", `Escribir -2 ^ 2;`, "-4\n"],
  ["precedencia", `Escribir 2 + 3 * 4, " ", (2 + 3) * 4;`, "14 20\n"],
  ["concatenacion", `Definir n Como Caracter;\nn <- "Ana";\nEscribir "Hola, " + n + "!";`, "Hola, Ana!\n"],
  ["logicos", `Escribir 3 > 2 Y 2 > 1, " ", Falso O Verdadero, " ", NO Verdadero;`, "VerdaderoVerdadero Falso\n".replace("VerdaderoVerdadero", "Verdadero Verdadero")],
  ["simbolos logicos", `Escribir (1 < 2) & (2 < 3), " ", ~Falso, " ", Falso | Falso;`, "Verdadero Verdadero Falso\n"],
  ["comparaciones", `Escribir 1 = 1, " ", 1 <> 1, " ", 2 <= 2, " ", 3 >= 4;`, "Verdadero Falso Verdadero Falso\n"],
  ["comparar textos", `Escribir "ana" < "beto";`, "Verdadero\n"],
  ["si entonces", `Definir x Como Entero;\nx <- 5;\nSi x > 3 Entonces\n    Escribir "grande";\nFinSi`, "grande\n"],
  ["si sino", `Definir x Como Entero;\nx <- 1;\nSi x > 3 Entonces\n    Escribir "grande";\nSino\n    Escribir "chico";\nFinSi`, "chico\n"],
  ["si con entonces en otra linea", `Si 1 < 2\nEntonces\n    Escribir "ok";\nFinSi`, "ok\n"],
  ["fin si en dos palabras", `Si Verdadero Entonces\n    Escribir "ok";\nFin Si`, "ok\n"],
  ["si anidado", `Definir n Como Entero;\nn <- 15;\nSi n MOD 3 = 0 Entonces\n    Si n MOD 5 = 0 Entonces\n        Escribir "FizzBuzz";\n    FinSi\nFinSi`, "FizzBuzz\n"],
  ["segun", `Definir d Como Entero;\nd <- 2;\nSegun d Hacer\n    1:\n        Escribir "uno";\n    2, 3:\n        Escribir "dos o tres";\n    De Otro Modo:\n        Escribir "otro";\nFinSegun`, "dos o tres\n"],
  ["segun de otro modo", `Definir d Como Entero;\nd <- 9;\nSegun d Hacer\n    1: Escribir "uno";\n    De Otro Modo: Escribir "otro";\nFinSegun`, "otro\n"],
  ["segun con texto", `Definir c Como Caracter;\nc <- "b";\nSegun c Hacer\n    "a": Escribir "A";\n    "b": Escribir "B";\nFinSegun`, "B\n"],
  ["mientras", `Definir i Como Entero;\ni <- 1;\nMientras i <= 3 Hacer\n    Escribir i;\n    i <- i + 1;\nFinMientras`, "1\n2\n3\n"],
  ["mientras falso no entra", `Mientras Falso Hacer\n    Escribir "nunca";\nFinMientras\nEscribir "fin";`, "fin\n"],
  ["repetir hasta que", `Definir i Como Entero;\ni <- 0;\nRepetir\n    i <- i + 1;\nHasta Que i = 3\nEscribir i;`, "3\n"],
  ["repetir se ejecuta una vez", `Definir i Como Entero;\ni <- 10;\nRepetir\n    Escribir i;\nHasta Que Verdadero`, "10\n"],
  ["repetir mientras que", `Definir i Como Entero;\ni <- 0;\nRepetir\n    i <- i + 2;\nMientras Que i < 6\nEscribir i;`, "6\n"],
  ["para", `Definir i Como Entero;\nPara i <- 1 Hasta 3 Hacer\n    Escribir i;\nFinPara`, "1\n2\n3\n"],
  ["para con paso", `Definir i Como Entero;\nPara i <- 0 Hasta 10 Con Paso 5 Hacer\n    Escribir i;\nFinPara`, "0\n5\n10\n"],
  ["para con paso negativo", `Definir i Como Entero;\nPara i <- 3 Hasta 1 Con Paso -1 Hacer\n    Escribir i;\nFinPara`, "3\n2\n1\n"],
  ["para que no entra", `Definir i Como Entero;\nPara i <- 5 Hasta 1 Hacer\n    Escribir i;\nFinPara\nEscribir "x";`, "x\n"],
  ["acumulador", `Definir i, s Como Entero;\ns <- 0;\nPara i <- 1 Hasta 100 Hacer\n    s <- s + i;\nFinPara\nEscribir s;`, "5050\n"],
  ["arreglo base 1", `Dimension a[3];\na[1] <- 10;\na[3] <- 30;\nEscribir a[1] + a[3];`, "40\n"],
  ["arreglo con parentesis", `Dimension a(2);\na(1) <- 4;\na(2) <- 6;\nEscribir a(1) * a(2);`, "24\n"],
  ["arreglo tipado", `Definir notas Como Real;\nDimension notas[2];\nnotas[1] <- 9.5;\nnotas[2] <- 8;\nEscribir (notas[1] + notas[2]) / 2;`, "8.75\n"],
  ["matriz", `Definir i, j Como Entero;\nDimension m[2,2];\nPara i <- 1 Hasta 2 Hacer\n    Para j <- 1 Hasta 2 Hacer\n        m[i,j] <- i * 10 + j;\n    FinPara\nFinPara\nEscribir m[2,1];`, "21\n"],
  ["leer entero", `Definir e Como Entero;\nLeer e;\nEscribir e * 2;`, "84\n", ["42"]],
  ["leer varios", `Definir a, b Como Real;\nLeer a, b;\nEscribir a + b;`, "4\n", ["1.5", "2.5"]],
  ["leer con coma decimal", `Definir a Como Real;\nLeer a;\nEscribir a;`, "3.5\n", ["3,5"]],
  ["leer texto", `Definir n Como Caracter;\nLeer n;\nEscribir "Hola, ", n;`, "Hola, Luz\n", ["Luz"]],
  ["leer logico", `Definir b Como Logico;\nLeer b;\nEscribir NO b;`, "Falso\n", ["verdadero"]],
  ["leer en arreglo", `Definir i Como Entero;\nDimension n[2];\nPara i <- 1 Hasta 2 Hacer\n    Leer n[i];\nFinPara\nEscribir n[1] + n[2];`, "7\n", ["3", "4"]],
  ["comentarios", `// comentario\nEscribir "a"; // al final\n/* bloque\n   de varias lineas */\nEscribir "b";`, "a\nb\n"],
  ["varias instrucciones en una linea", `Definir a Como Entero; a <- 1; Escribir a;`, "1\n"],
  ["texto con comillas simples", `Escribir 'hola';`, "hola\n"],
  ["acentos en palabras clave", `Definir d Como Entero;\nd <- 1;\nSegún d Hacer\n    1: Escribir "uno";\nFinSegún`, "uno\n"],
  ["numero con decimales entero", `Escribir 6.0;`, "6\n"],
  ["booleanos", `Definir b Como Logico;\nb <- Verdadero;\nEscribir b;`, "Verdadero\n"],
  ["funcion con retorno", `Escribir Doble(21);`, "42\n"],
  ["subproceso", `Saludar("Mar");`, "Hola, Mar\n"],
  ["subproceso sin parentesis", `Linea;`, "---\n"],
  ["recursion", `Escribir Factorial(5);`, "120\n"],
  ["por referencia", `Definir x Como Entero;\nx <- 1;\nIncrementar(x);\nEscribir x;`, "2\n"],
  ["arreglo por referencia", `Dimension a[2];\na[1] <- 1;\na[2] <- 2;\nLlenar(a);\nEscribir a[1], a[2];`, "00\n"],
  ["funciones de texto", `Escribir Longitud("hola"), Mayusculas("ab"), Minusculas("CD"), Subcadena("pseudo", 1, 3), Concatenar("a", "b");`, "4ABcdpseab\n"],
  ["conversiones", `Escribir ConvertirANumero("12") + 1, ConvertirATexto(5) + "!";`, "135!\n"],
  ["matematicas", `Escribir RC(16), " ", RAIZ(9), " ", ABS(-3), " ", TRUNC(3.9), " ", REDON(2.5);`, "4 3 3 3 3\n"],
  ["algoritmo como sinonimo", "", ""],
  ["proceso de ejemplo D.8", "", "Nota 1:\nNota 2:\nNota 3:\nAprobaste con 8\n", ["7", "8", "9"]],
];

const DEFS = `
Funcion r <- Doble(n)
    r <- n * 2;
FinFuncion

SubProceso Saludar(nombre)
    Escribir "Hola, ", nombre;
FinSubProceso

SubProceso Linea
    Escribir "---";
FinSubProceso

Funcion f <- Factorial(n)
    Si n <= 1 Entonces
        f <- 1;
    Sino
        f <- n * Factorial(n - 1);
    FinSi
FinFuncion

SubProceso Incrementar(v Por Referencia)
    v <- v + 1;
FinSubProceso

SubProceso Llenar(arr)
    arr[1] <- 0;
    arr[2] <- 0;
FinSubProceso
`;

const D8 = `Proceso PromedioNotas
    Definir i Como Entero;
    Definir suma, promedio Como Real;
    Dimension notas[3];
    suma <- 0;
    Para i <- 1 Hasta 3 Hacer
        Escribir "Nota ", i, ":";
        Leer notas[i];
        suma <- suma + notas[i];
    FinPara
    promedio <- suma / 3;
    Si promedio >= 6 Entonces
        Escribir "Aprobaste con ", promedio;
    Sino
        Escribir "Todavía no, sigue practicando";
    FinSi
FinProceso
`;

describe("pseudocode output", () => {
  for (const [name, body, expected, stdin] of OUTPUT_FIXTURES) {
    it(name, () => {
      let code = P(body, DEFS);
      if (name === "algoritmo como sinonimo") {
        code = `Algoritmo X\n    Escribir "alg";\nFinAlgoritmo`;
        expect(out(code)).toBe("alg\n");
        return;
      }
      if (name === "proceso de ejemplo D.8") code = D8;
      expect(out(code, stdin ?? [])).toBe(expected);
    });
  }
});

// [name, code, expected error code, expected line?, stdin?]
const ERROR_FIXTURES: Array<[string, string, string, number?, string[]?]> = [
  ["falta FinSi", "Proceso A\n    Si 1 < 2 Entonces\n        Escribir 1;\nFinProceso", "FaltaCierre", 2],
  ["falta FinMientras", "Proceso A\n    Mientras Verdadero Hacer\n        Escribir 1;\nFinProceso", "FaltaCierre", 2],
  ["falta FinPara", "Proceso A\n    Definir i Como Entero;\n    Para i <- 1 Hasta 2 Hacer\n        Escribir i;\nFinProceso", "FaltaCierre", 3],
  ["falta FinProceso", "Proceso A\n    Escribir 1;", "FaltaCierre", 1],
  ["falta FinSegun", "Proceso A\n    Segun 1 Hacer\n        1: Escribir 1;\nFinProceso", "FaltaCierre", 2],
  ["falta Hasta Que", "Proceso A\n    Repetir\n        Escribir 1;\nFinProceso", "FaltaCierre", 2],
  ["falta Entonces", "Proceso A\n    Si 1 < 2\n        Escribir 1;\n    FinSi\nFinProceso", "FaltaEntonces", 2],
  ["falta Hacer en Mientras", "Proceso A\n    Mientras Falso\n        Escribir 1;\n    FinMientras\nFinProceso", "FaltaHacer", 2],
  ["falta Hacer en Para", "Proceso A\n    Definir i Como Entero;\n    Para i <- 1 Hasta 2\n        Escribir i;\n    FinPara\nFinProceso", "FaltaHacer", 3],
  ["cierre sin apertura", "Proceso A\nFinProceso\nFinSi", "CierreSinApertura", 3],
  ["asignacion con igual", "Proceso A\n    Definir x Como Entero;\n    x = 5;\nFinProceso", "AsignacionConIgual", 3],
  ["variable no definida", "Proceso A\n    edad <- 5;\nFinProceso", "VariableNoDefinida", 2],
  ["variable no definida en expresion", "Proceso A\n    Escribir total;\nFinProceso", "VariableNoDefinida", 2],
  ["variable sin valor", "Proceso A\n    Definir t Como Entero;\n    Escribir t;\nFinProceso", "VariableSinValor", 3],
  ["sumar numero y texto", 'Proceso A\n    Escribir 1 + "a";\nFinProceso', "TipoIncompatible", 2],
  ["entero recibe decimal", "Proceso A\n    Definir e Como Entero;\n    e <- 2.5;\nFinProceso", "TipoIncompatible", 3],
  ["caracter recibe numero", "Proceso A\n    Definir c Como Caracter;\n    c <- 3;\nFinProceso", "TipoIncompatible", 3],
  ["condicion no logica", "Proceso A\n    Si 3 Entonces\n        Escribir 1;\n    FinSi\nFinProceso", "TipoIncompatible", 2],
  ["division entre cero", "Proceso A\n    Escribir 1 / 0;\nFinProceso", "DivisionEntreCero", 2],
  ["mod entre cero", "Proceso A\n    Escribir 1 MOD 0;\nFinProceso", "DivisionEntreCero", 2],
  ["indice fuera de rango", "Proceso A\n    Dimension notas[5];\n    notas[6] <- 1;\nFinProceso", "IndiceFueraDeRango", 3],
  ["indice cero", "Proceso A\n    Dimension notas[5];\n    notas[0] <- 1;\nFinProceso", "IndiceFueraDeRango", 3],
  ["arreglo sin dimension", "Proceso A\n    Definir n Como Entero;\n    n[1] <- 2;\nFinProceso", "ArregloSinDimension", 3],
  ["funcion no existe", "Proceso A\n    Escribir Triple(2);\nFinProceso", "FuncionNoExiste", 2],
  ["argumentos incorrectos", "Proceso A\n    Escribir Area(2);\nFinProceso\nFuncion r <- Area(b, h)\n    r <- b * h;\nFinFuncion", "ArgumentosIncorrectos", 2],
  ["subproceso usado como valor", "Proceso A\n    Escribir Hola();\nFinProceso\nSubProceso Hola()\n    Escribir 1;\nFinSubProceso", "SinValorDeRetorno", 2],
  ["conversion invalida", "Proceso A\n    Definir e Como Entero;\n    Leer e;\nFinProceso", "ConversionInvalida", 3, ["hola"]],
  ["entrada agotada", "Proceso A\n    Definir e Como Entero;\n    Leer e;\nFinProceso", "EntradaAgotada", 3, []],
  ["limite de pasos", "Proceso A\n    Mientras Verdadero Hacer\n    FinMientras\nFinProceso", "LimiteDePasos", 2],
  ["recursion excesiva", "Proceso A\n    Escribir F(1);\nFinProceso\nFuncion r <- F(n)\n    r <- F(n + 1);\nFinFuncion", "RecursionExcesiva"],
  ["limite de salida", 'Proceso A\n    Mientras Verdadero Hacer\n        Escribir "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";\n    FinMientras\nFinProceso', "LimiteDeSalida", 3],
  ["sin proceso", 'Escribir "hola";', "FaltaProceso", 1],
  ["proceso duplicado", "Proceso A\nFinProceso\nProceso B\nFinProceso", "ProcesoDuplicado", 3],
  ["instruccion desconocida", 'Proceso A\n    Escribri "hola";\nFinProceso', "InstruccionDesconocida", 2],
  ["texto sin cerrar", 'Proceso A\n    Escribir "hola;\nFinProceso', "TextoSinCerrar", 2],
  ["simbolo inesperado", "Proceso A\n    Escribir 1 $ 2;\nFinProceso", "SimboloInesperado", 2],
  ["falta expresion", "Proceso A\n    Definir x Como Entero;\n    x <- ;\nFinProceso", "FaltaExpresion", 3],
  ["falta parentesis", "Proceso A\n    Escribir (1 + 2;\nFinProceso", "FaltaParentesis", 2],
  ["falta como", "Proceso A\n    Definir x;\nFinProceso", "FaltaComo", 2],
  ["tipo desconocido", "Proceso A\n    Definir x Como Numerazo;\nFinProceso", "TipoDesconocido", 2],
  ["paso cero", "Proceso A\n    Definir i Como Entero;\n    Para i <- 1 Hasta 3 Con Paso 0 Hacer\n    FinPara\nFinProceso", "PasoCero", 3],
  ["raiz negativa", "Proceso A\n    Escribir RC(-1);\nFinProceso", "RaizNegativa", 2],
  ["comparar numero y texto", 'Proceso A\n    Escribir 1 < "a";\nFinProceso', "TipoIncompatible", 2],
];

describe("pseudocode errors", () => {
  for (const [name, code, expected, line, stdin] of ERROR_FIXTURES) {
    it(name, () => {
      const e = errOf(code, stdin ?? []);
      expect(e?.type).toBe(expected);
      if (line !== undefined) expect(e?.line).toBe(line);
      expect(e?.message).toBeTruthy();
      expect(e?.message).not.toMatch(/undefined|\{\w+\}/);
    });
  }

  it("FaltaCierre names the closer and opener in Spanish", () => {
    const e = errOf("Proceso A\n    Si 1 < 2 Entonces\n        Escribir 1;\nFinProceso");
    expect(e?.message).toContain("Falta FinSi para cerrar el Si de la línea 2");
  });
  it("IndiceFueraDeRango states the valid range", () => {
    const e = errOf("Proceso A\n    Dimension notas[5];\n    notas[6] <- 1;\nFinProceso");
    expect(e?.message).toBe("notas[6] no existe: el arreglo tiene posiciones de 1 a 5.");
  });
  it("suggests the closest keyword on typos", () => {
    const e = errOf('Proceso A\n    Escribri "hola";\nFinProceso');
    expect(e?.message).toContain("¿Quisiste decir Escribir?");
  });
  it("lint returns several diagnostics with columns", () => {
    const d = lint("Proceso A\n    edad <- 5;\n    Escribir total;\nFinProceso");
    expect(d.length).toBe(2);
    expect(d[0].code).toBe("VariableNoDefinida");
    expect(d[0].column).toBe(5);
    expect(d[1].line).toBe(3);
  });
  it("lint is empty for valid code", () => {
    expect(lint(P(`Escribir "ok";`))).toEqual([]);
  });
});

describe("randomness", () => {
  it("AZAR and ALEATORIO are seeded and in range", () => {
    const code = P(`Definir i Como Entero;\nPara i <- 1 Hasta 50 Hacer\n    Escribir AZAR(6), " ", ALEATORIO(3, 4);\nFinPara`);
    const a = out(code);
    const b = out(code);
    expect(a).toBe(b);
    for (const line of a.trim().split("\n")) {
      const [x, y] = line.split(" ").map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(5);
      expect([3, 4]).toContain(y);
    }
  });
});

describe("step mode and interactive input", () => {
  it("trace yields one event per statement with variables", () => {
    const events = Array.from(trace(P(`Definir x Como Entero;\nx <- 1;\nx <- x + 1;`)));
    const steps = events.filter((e) => e.kind === "step");
    expect(steps.map((e) => e.line)).toEqual([2, 3, 4]);
    const done = events[events.length - 1];
    expect(done.kind).toBe("done");
    expect(done.variables.x.value).toBe(2);
  });
  it("interactive Leer pauses and resumes", () => {
    const { session } = createSession(P(`Definir n Como Caracter;\nEscribir "¿Nombre?";\nLeer n;\nEscribir "Hola, ", n;`), { interactive: true });
    const ev = session!.run();
    expect(ev.type).toBe("needInput");
    session!.provideInput("Itzel");
    const ev2 = session!.run();
    expect(ev2.type).toBe("done");
    if (ev2.type === "done") expect(ev2.output).toBe("¿Nombre?\nItzel\nHola, Itzel\n");
  });
  it("loops yield at the header so empty loops are steppable", () => {
    const { session } = createSession(P(`Mientras Verdadero Hacer\nFinMientras`), { maxSteps: 50 });
    const ev = session!.run();
    expect(ev.type).toBe("error");
  });
});

describe("grading", () => {
  const areaTests = [
    { id: "t1", kind: "stdout" as const, description: "Con base 4 y altura 3 escribe 6", spec: { stdin: ["4", "3"], expected: "6", match: "trimmed" as const } },
    { id: "t2", kind: "final_variable" as const, description: "La variable area guarda el resultado", spec: { variables: { area: 6 }, stdin: ["4", "3"], message_es: "Guarda el resultado en area." } },
    { id: "t3", kind: "construct_rule" as const, description: "Usa Leer para pedir los datos", spec: { must_contain: ["Leer"], message_es: "Pide la base y la altura con Leer." } },
  ];
  const solution = `Proceso AreaTriangulo
    Definir base, altura, area Como Real;
    Leer base, altura;
    area <- base * altura / 2;
    Escribir area;
FinProceso
`;
  const wrong = solution.replace("/ 2", "");
  const starter = `Proceso AreaTriangulo
    Definir base, altura, area Como Real;
    // Tu código aquí
FinProceso
`;
  it("reference solution passes every test", () => {
    const r = grade({ id: "x", code: solution, tests: areaTests, timeoutMs: 3000 });
    expect(r.tests.map((t) => t.passed)).toEqual([true, true, true]);
    expect(r.ok).toBe(true);
  });
  it("known wrong solution fails at least one test", () => {
    const r = grade({ id: "x", code: wrong, tests: areaTests, timeoutMs: 3000 });
    expect(r.ok).toBe(false);
    expect(r.tests[0].passed).toBe(false);
  });
  it("starter code fails", () => {
    const r = grade({ id: "x", code: starter, tests: areaTests, timeoutMs: 3000 });
    expect(r.ok).toBe(false);
  });
  it("function_call on a functions-only file", () => {
    const code = `Funcion r <- Suma(a, b)\n    r <- a + b;\nFinFuncion\n`;
    const r = grade({
      id: "x",
      code,
      timeoutMs: 3000,
      tests: [
        { id: "f1", kind: "function_call", description: "Con Suma(2, 3) regresa 5", spec: { function: "Suma", args: [2, 3], expected: 5 } },
        { id: "f2", kind: "function_call", description: "Con negativos", spec: { function: "suma", args: [-1, 1], expected: 0 } },
      ],
    });
    expect(r.ok).toBe(true);
  });
  it("function_call failure message is Spanish", () => {
    const code = `Funcion r <- Suma(a, b)\n    r <- a - b;\nFinFuncion\n`;
    const r = grade({ id: "x", code, timeoutMs: 3000, tests: [{ id: "f1", kind: "function_call", description: "d", spec: { function: "Suma", args: [2, 3], expected: 5 } }] });
    expect(r.tests[0].messageEs).toBe("Con Suma(2, 3) esperaba 5 pero obtuve -1.");
  });
  it("missing function is reported in Spanish", () => {
    const r = grade({ id: "x", code: P(""), timeoutMs: 3000, tests: [{ id: "f1", kind: "function_call", description: "d", spec: { function: "Suma", args: [], expected: 1 } }] });
    expect(r.tests[0].messageEs).toMatch(/No encontré la función Suma/);
  });
  it("runtime error at top level skips shared tests", () => {
    const r = grade({
      id: "x",
      code: P("Escribir 1 / 0;"),
      timeoutMs: 3000,
      tests: [
        { id: "v", kind: "final_variable", description: "d", spec: { variables: { x: 1 } } },
        { id: "c", kind: "construct_rule", description: "d", spec: { must_contain: ["Escribir"], message_es: "m" } },
      ],
    });
    expect(r.tests[0].skipped).toBe(true);
    expect(r.tests[1].passed).toBe(true);
    expect(r.error?.type).toBe("DivisionEntreCero");
  });
  it("compile error marks every test skipped", () => {
    const r = grade({ id: "x", code: "Proceso A\n    Si Verdadero Entonces\nFinProceso", tests: areaTests, timeoutMs: 3000 });
    expect(r.error?.type).toBe("FaltaCierre");
    expect(r.tests.every((t) => t.skipped)).toBe(true);
  });
  it("must_not_contain works", () => {
    const r = grade({
      id: "x",
      code: P(`Definir i Como Entero;\nPara i <- 1 Hasta 2 Hacer\nFinPara`),
      timeoutMs: 3000,
      tests: [{ id: "c", kind: "construct_rule", description: "d", spec: { must_not_contain: ["Para"], message_es: "Hazlo con Mientras." } }],
    });
    expect(r.tests[0].passed).toBe(false);
    expect(r.tests[0].messageEs).toBe("Hazlo con Mientras.");
  });
  it("stdout regex and exact modes", () => {
    const code = P(`Escribir "Total: 42";`);
    const r = grade({
      id: "x",
      code,
      timeoutMs: 3000,
      tests: [
        { id: "a", kind: "stdout", description: "d", spec: { expected: "Total: \\d+", match: "regex" } },
        { id: "b", kind: "stdout", description: "d", spec: { expected: "Total: 42\n", match: "exact" } },
      ],
    });
    expect(r.tests.map((t) => t.passed)).toEqual([true, true]);
  });
  it("Unicode output", () => {
    expect(out(P(`Escribir "¡Año nuevo, señora! ¿Qué tal?";`))).toBe("¡Año nuevo, señora! ¿Qué tal?\n");
  });
});

describe("format", () => {
  it("indents blocks and capitalizes keywords", () => {
    const src = `proceso suma\ndefinir a como entero\nsi a > 1 entonces\nescribir "hola"\nsino\nescribir "adios"\nfinsi\nmientras a < 3 hacer\na <- a + 1\nfinmientras\nfinproceso`;
    expect(format(src)).toBe(
      `Proceso suma\n    Definir a Como Entero\n    Si a > 1 Entonces\n        Escribir "hola"\n    Sino\n        Escribir "adios"\n    FinSi\n    Mientras a < 3 Hacer\n        a <- a + 1\n    FinMientras\nFinProceso`,
    );
  });
  it("formats Segun and Repetir", () => {
    const src = `Proceso X\nsegun d hacer\n1:\nescribir "a"\nde otro modo:\nescribir "b"\nfinsegun\nrepetir\nd <- d + 1\nhasta que d > 2\nFinProceso`;
    expect(format(src)).toBe(
      `Proceso X\n    Segun d Hacer\n        1:\n            Escribir "a"\n        De Otro Modo:\n            Escribir "b"\n    FinSegun\n    Repetir\n        d <- d + 1\n    Hasta Que d > 2\nFinProceso`,
    );
  });
  it("keeps strings and comments untouched", () => {
    expect(format(`Proceso X\nescribir "si entonces" // si sino\nFinProceso`)).toBe(`Proceso X\n    Escribir "si entonces" // si sino\nFinProceso`);
  });
});
