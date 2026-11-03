// Seed curriculum (tech spec Appendix A style guide + Appendix B shapes).
// Also the import/export format: every exercise carries tests, hints, a reference
// solution and known wrong solutions, and is validated by src/content/curriculum.test.ts.
import type { CodeLanguage, TestInput } from "@codeher/core";

export interface SeedExercise {
  slug: string;
  title: string;
  type?: "code" | "multiple_choice" | "short_answer";
  instructions_md: string;
  starter_code?: string;
  tests?: TestInput[];
  hints: string[];
  solution?: string;
  wrong?: string[];
  config?: { options?: string[]; multiple?: boolean };
  answer?: unknown;
  explanation_md?: string;
  xp?: number;
}
export interface SeedLesson {
  slug: string;
  title: string;
  summary: string;
  language: CodeLanguage;
  visibility: "public" | "program";
  course?: string;
  position: number;
  minutes: number;
  xp?: number;
  pair?: string;
  content_md: string;
  exercises: SeedExercise[];
  deck?: unknown;
}
export interface SeedCourse {
  slug: string;
  title: string;
  description: string;
  position: number;
  module: { slug: string; title: string };
}

export const COURSES: SeedCourse[] = [
  {
    slug: "logica-con-pseudocodigo",
    title: "Lógica con pseudocódigo",
    description: "Aprende a pensar como programadora con palabras en español: datos, decisiones, ciclos y arreglos.",
    position: 1,
    module: { slug: "primeros-pasos", title: "Primeros pasos" },
  },
  {
    slug: "python-desde-cero",
    title: "Python desde cero",
    description: "Las mismas ideas, ahora con un lenguaje que se usa en el mundo real.",
    position: 2,
    module: { slug: "fundamentos", title: "Fundamentos" },
  },
];

const P = (name: string, body: string) => `Proceso ${name}\n${body}\nFinProceso\n`;

export const LESSONS: SeedLesson[] = [
  // ---------------- Public lessons (Probar) ----------------
  {
    slug: "tu-primer-programa",
    title: "Tu primer programa",
    summary: "Haz que la computadora te salude con Escribir.",
    language: "pseudocode_es",
    visibility: "public",
    position: 1,
    minutes: 10,
    pair: "hola-python",
    content_md: `**Meta:** escribir un mensaje en la pantalla.

Un programa es una lista de instrucciones que la computadora sigue en orden, como una receta. En pseudocódigo, todo programa vive entre \`Proceso\` y \`FinProceso\`.

La instrucción \`Escribir\` muestra un texto. El texto va entre comillas:

\`\`\`pseudo run
Proceso Saludo
    Escribir "¡Hola! Soy un programa.";
FinProceso
\`\`\`

Presiona **Ejecutar** y mira el resultado. Después resuelve los ejercicios.

**En resumen:** \`Escribir\` muestra lo que pongas entre comillas.`,
    exercises: [
      {
        slug: "saluda-al-mundo",
        title: "Saluda al mundo",
        instructions_md: "Escribe exactamente `¡Hola, mundo!` en la pantalla.",
        starter_code: P("HolaMundo", "    // Escribe tu código aquí"),
        tests: [{ kind: "stdout", description: "Escribe ¡Hola, mundo!", spec: { expected: "¡Hola, mundo!" } }],
        hints: ["Usa la instrucción `Escribir` seguida de un texto entre comillas.", 'Prueba con `Escribir "¡Hola, mundo!";`'],
        solution: P("HolaMundo", '    Escribir "¡Hola, mundo!";'),
        wrong: [P("HolaMundo", '    Escribir "Hola mundo";')],
      },
      {
        slug: "dos-lineas",
        title: "Dos líneas",
        instructions_md: "Escribe dos líneas: primero `Programar es para mí` y después `Y lo estoy logrando`.",
        starter_code: P("DosLineas", '    Escribir "Programar es para mí";\n    // Agrega la segunda línea'),
        tests: [
          { kind: "stdout", description: "Escribe las dos frases en orden", spec: { expected: "Programar es para mí\nY lo estoy logrando" } },
          { kind: "construct_rule", description: "Usa Escribir", spec: { must_contain: ["Escribir"], message_es: "Usa Escribir para mostrar cada frase." } },
        ],
        hints: ["Cada `Escribir` muestra una línea nueva.", 'Agrega `Escribir "Y lo estoy logrando";` debajo de la primera.'],
        solution: P("DosLineas", '    Escribir "Programar es para mí";\n    Escribir "Y lo estoy logrando";'),
        wrong: [P("DosLineas", '    Escribir "Y lo estoy logrando";\n    Escribir "Programar es para mí";')],
      },
    ],
  },
  {
    slug: "hola-python",
    title: "Hola, Python",
    summary: "Tu primera línea de Python con print.",
    language: "python",
    visibility: "public",
    position: 2,
    minutes: 10,
    pair: "tu-primer-programa",
    content_md: `**Meta:** mostrar mensajes y resultados con \`print\`.

Python es un lenguaje que se usa para ciencia, páginas web, videojuegos y más. Sus instrucciones están en inglés: \`print\` significa "imprimir", es decir, mostrar.

\`\`\`python run
print("¡Hola! Soy Python.")
print(2 + 3)
\`\`\`

Los textos van entre comillas. Los números no: Python los calcula.

**En resumen:** \`print(...)\` muestra textos y resultados de operaciones.`,
    exercises: [
      {
        slug: "hola-mundo-python",
        title: "Saluda al mundo",
        instructions_md: "Muestra exactamente `¡Hola, mundo!`.",
        starter_code: "# Escribe tu código aquí\n",
        tests: [{ kind: "stdout", description: "Muestra ¡Hola, mundo!", spec: { expected: "¡Hola, mundo!" } }],
        hints: ["Usa `print` con el texto entre comillas.", 'Prueba con `print("¡Hola, mundo!")`.'],
        solution: 'print("¡Hola, mundo!")\n',
        wrong: ['print("Hola mundo")\n'],
      },
      {
        slug: "horas-del-anio",
        title: "Horas en un año",
        instructions_md: "Muestra cuántas horas tiene un año de 365 días. Deja que Python haga la cuenta con `365 * 24`.",
        starter_code: "# Usa print con una multiplicación\n",
        tests: [{ kind: "stdout", description: "Muestra 8760", spec: { expected: "8760" } }],
        hints: ["El símbolo `*` multiplica.", "Prueba con `print(365 * 24)`."],
        solution: "print(365 * 24)\n",
        wrong: ['print("365 * 24")\n'],
      },
    ],
  },
  {
    slug: "adivina-el-numero",
    title: "Adivina el número",
    summary: "Pide un número y decide con Si y Sino.",
    language: "pseudocode_es",
    visibility: "public",
    position: 3,
    minutes: 15,
    content_md: `**Meta:** tomar una decisión con lo que escribe la persona usuaria.

\`Leer\` espera a que alguien escriba un dato y lo guarda en una variable. \`Si ... Entonces ... Sino ... FinSi\` elige qué hacer según una condición.

\`\`\`pseudo run
Proceso Adivina
    Definir intento Como Entero;
    Escribir "Pensé un número del 1 al 10. ¿Cuál es?";
    Leer intento;
    Si intento = 7 Entonces
        Escribir "¡Adivinaste!";
    Sino
        Escribir "Todavía no. Era el 7.";
    FinSi
FinProceso
\`\`\`

**En resumen:** \`Leer\` recibe datos y \`Si\` decide qué camino seguir.`,
    exercises: [
      {
        slug: "adivina-siete",
        title: "¿Es el 7?",
        instructions_md: "Lee un número. Si es 7, escribe `¡Adivinaste!`. Si no, escribe `Todavía no`.",
        starter_code: P("Adivina", "    Definir intento Como Entero;\n    Leer intento;\n    // Decide aquí con Si y Sino"),
        tests: [
          { kind: "stdout", description: "Con 7 escribe ¡Adivinaste!", spec: { stdin: ["7"], expected: "¡Adivinaste!" } },
          { kind: "stdout", description: "Con 3 escribe Todavía no", spec: { stdin: ["3"], expected: "Todavía no" } },
          { kind: "construct_rule", description: "Usa Si", spec: { must_contain: ["Si"], message_es: "Usa Si para comparar el número." } },
        ],
        hints: ["Compara con `Si intento = 7 Entonces`.", 'Dentro escribe `Escribir "¡Adivinaste!";` y en el `Sino` escribe `Escribir "Todavía no";`. No olvides `FinSi`.'],
        solution: P("Adivina", '    Definir intento Como Entero;\n    Leer intento;\n    Si intento = 7 Entonces\n        Escribir "¡Adivinaste!";\n    Sino\n        Escribir "Todavía no";\n    FinSi'),
        wrong: [P("Adivina", '    Definir intento Como Entero;\n    Leer intento;\n    Escribir "¡Adivinaste!";')],
      },
      {
        slug: "cierre-del-si",
        title: "¿Cómo se cierra?",
        type: "multiple_choice",
        instructions_md: "¿Qué palabra cierra un bloque `Si`?",
        config: { options: ["FinSi", "FinMientras", "Entonces"], multiple: false },
        answer: { choices: [0] },
        explanation_md: "Cada bloque tiene su propia palabra de cierre: `Si` termina con `FinSi`.",
        hints: ["Las palabras de cierre empiezan con `Fin`.", "Busca la que combina `Fin` con el nombre del bloque."],
      },
    ],
  },
  {
    slug: "tabla-de-multiplicar",
    title: "Tu tabla de multiplicar",
    summary: "Repite instrucciones con for en Python.",
    language: "python",
    visibility: "public",
    position: 4,
    minutes: 15,
    content_md: `**Meta:** repetir una instrucción sin escribirla muchas veces.

\`for\` repite un bloque. \`range(1, 4)\` produce 1, 2 y 3 (el último número no se incluye). Lo que va dentro del ciclo lleva cuatro espacios de sangría.

\`\`\`python run
for i in range(1, 4):
    print("Vuelta", i)
\`\`\`

**En resumen:** \`for i in range(a, b)\` repite con \`i\` desde \`a\` hasta \`b - 1\`.`,
    exercises: [
      {
        slug: "tabla-del-numero",
        title: "La tabla de un número",
        instructions_md: "Lee un número con `int(input())` y muestra su tabla del 1 al 5 con el formato `3 x 1 = 3`.",
        starter_code: "n = int(input())\n# Escribe el ciclo aquí\n",
        tests: [
          { kind: "stdout", description: "Con 3 muestra la tabla del 3", spec: { stdin: ["3"], expected: "3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15" } },
          { kind: "construct_rule", description: "Usa un ciclo for", spec: { must_contain: ["For"], message_es: "Usa for para no repetir cinco veces el mismo print." } },
        ],
        hints: ["Usa `for i in range(1, 6):`.", 'Dentro del ciclo: `print(n, "x", i, "=", n * i)`.'],
        solution: 'n = int(input())\nfor i in range(1, 6):\n    print(n, "x", i, "=", n * i)\n',
        wrong: ['n = int(input())\nfor i in range(1, 5):\n    print(n, "x", i, "=", n * i)\n'],
      },
      {
        slug: "suma-hasta",
        title: "Suma hasta n",
        instructions_md: "Completa la función `suma_hasta(n)` para que regrese la suma de 1 hasta `n`. Por ejemplo, `suma_hasta(4)` regresa 10.",
        starter_code: "def suma_hasta(n):\n    total = 0\n    # Suma aquí con un ciclo\n    return total\n",
        tests: [
          { kind: "function_call", description: "suma_hasta(4) regresa 10", spec: { function: "suma_hasta", args: [4], expected: 10 } },
          { kind: "function_call", description: "suma_hasta(100) regresa 5050", spec: { function: "suma_hasta", args: [100], expected: 5050 } },
          { kind: "function_call", description: "suma_hasta(1) regresa 1", spec: { function: "suma_hasta", args: [1], expected: 1 } },
        ],
        hints: ["Recorre los números con `for i in range(1, n + 1):`.", "Dentro del ciclo acumula: `total = total + i`."],
        solution: "def suma_hasta(n):\n    total = 0\n    for i in range(1, n + 1):\n        total = total + i\n    return total\n",
        wrong: ["def suma_hasta(n):\n    total = 0\n    for i in range(1, n):\n        total = total + i\n    return total\n"],
      },
    ],
  },

  // ---------------- Course: Lógica con pseudocódigo ----------------
  {
    slug: "variables-pseudocodigo",
    title: "Variables: cajitas con nombre",
    summary: "Guarda datos con Definir y <-.",
    language: "pseudocode_es",
    visibility: "program",
    course: "logica-con-pseudocodigo",
    position: 1,
    minutes: 15,
    pair: "variables-python",
    content_md: `**Meta:** guardar datos para usarlos después.

Una **variable** es como una cajita con nombre. Primero dices qué tipo de dato guarda con \`Definir\`, y luego le das un valor con la flecha \`<-\`.

\`\`\`pseudo run
Proceso Cajitas
    Definir edad Como Entero;
    edad <- 14;
    Escribir "Tengo ", edad, " años";
FinProceso
\`\`\`

## Tipos de datos

- \`Entero\`: números sin decimales, como 14.
- \`Real\`: números con decimales, como 25.5.
- \`Caracter\`: textos, como "Apaxco".
- \`Logico\`: \`Verdadero\` o \`Falso\`.

**En resumen:** \`Definir\` crea la cajita y \`<-\` guarda algo dentro.`,
    exercises: [
      {
        slug: "edad-en-meses",
        title: "Tu edad en meses",
        instructions_md: "La variable `edad` vale 14. Calcula cuántos meses son, guárdalo en `meses` y escríbelo.",
        starter_code: P("EdadEnMeses", "    Definir edad, meses Como Entero;\n    edad <- 14;\n    // Calcula meses y escríbelo"),
        tests: [
          { kind: "final_variable", description: "meses vale 168", spec: { variables: { meses: 168 }, message_es: "Guarda el resultado en meses." } },
          { kind: "stdout", description: "Escribe 168", spec: { expected: "168" } },
        ],
        hints: ["Un año tiene 12 meses: multiplica con `*`.", "Escribe `meses <- edad * 12;` y luego `Escribir meses;`."],
        solution: P("EdadEnMeses", "    Definir edad, meses Como Entero;\n    edad <- 14;\n    meses <- edad * 12;\n    Escribir meses;"),
        wrong: [P("EdadEnMeses", "    Definir edad, meses Como Entero;\n    edad <- 14;\n    meses <- edad + 12;\n    Escribir meses;")],
      },
      {
        slug: "precio-total",
        title: "Cuenta de la papelería",
        instructions_md: "Cada cuaderno cuesta 25.5 pesos y compras 4. Guarda el total en `total` (es `Real`) y escríbelo.",
        starter_code: P("Papeleria", "    Definir precio, total Como Real;\n    Definir cantidad Como Entero;\n    precio <- 25.5;\n    cantidad <- 4;\n    // Calcula total"),
        tests: [
          { kind: "final_variable", description: "total vale 102", spec: { variables: { total: 102 } } },
          { kind: "stdout", description: "Escribe 102", spec: { expected: "102" } },
        ],
        hints: ["El total es el precio por la cantidad.", "Prueba `total <- precio * cantidad;` y después `Escribir total;`."],
        solution: P("Papeleria", "    Definir precio, total Como Real;\n    Definir cantidad Como Entero;\n    precio <- 25.5;\n    cantidad <- 4;\n    total <- precio * cantidad;\n    Escribir total;"),
        wrong: [P("Papeleria", "    Definir precio, total Como Real;\n    Definir cantidad Como Entero;\n    precio <- 25.5;\n    cantidad <- 4;\n    total <- precio + cantidad;\n    Escribir total;")],
      },
    ],
    deck: {
      schema_version: 1,
      slides: [
        { id: "s1", title: "Variables: cajitas con nombre", blocks: [{ type: "text", markdown: "Una variable guarda un dato para usarlo después." }, { type: "bullets", items: ["Tiene un nombre", "Guarda un valor", "Puede cambiar"] }], notes: "Pide ejemplos de cosas que guardamos en cajas con etiqueta." },
        { id: "s2", title: "Definir y la flecha", blocks: [{ type: "code", language: "pseudocode_es", code: "Definir edad Como Entero;\nedad <- 14;\nEscribir edad;" }, { type: "callout", kind: "tip", markdown: "La flecha `<-` se lee \"recibe\": edad recibe 14." }], notes: "Hagan juntas la lectura en voz alta de cada línea." },
        { id: "s3", title: "Revisemos", blocks: [{ type: "check_question", prompt: "¿Qué escribe Escribir edad?", options: ["edad", "14", "Error"], answer_index: 1, explanation: "Escribir muestra el valor guardado en la variable." }], notes: "" },
      ],
    },
  },
  {
    slug: "leer-datos-pseudocodigo",
    title: "Pedir datos con Leer",
    summary: "Haz programas que conversan con quien los usa.",
    language: "pseudocode_es",
    visibility: "program",
    course: "logica-con-pseudocodigo",
    position: 2,
    minutes: 15,
    pair: "entrada-python",
    content_md: `**Meta:** recibir datos mientras el programa corre.

\`Leer\` detiene el programa hasta que alguien escribe un dato. Ese dato se guarda en la variable que indiques.

\`\`\`pseudo run
Proceso Saludo
    Definir nombre Como Caracter;
    Escribir "¿Cómo te llamas?";
    Leer nombre;
    Escribir "¡Hola, ", nombre, "!";
FinProceso
\`\`\`

Puedes leer varios datos a la vez: \`Leer a, b;\`

**En resumen:** \`Leer\` convierte tu programa en una conversación.`,
    exercises: [
      {
        slug: "saludo-personal",
        title: "Saludo personal",
        instructions_md: "Lee un nombre y escribe `Hola, ` seguido del nombre. Con `Xóchitl` debe escribir `Hola, Xóchitl`.",
        starter_code: P("Saludo", "    Definir nombre Como Caracter;\n    // Lee el nombre y saluda"),
        tests: [
          { kind: "stdout", description: "Con Xóchitl escribe Hola, Xóchitl", spec: { stdin: ["Xóchitl"], expected: "Hola, Xóchitl" } },
          { kind: "stdout", description: "Con Ana escribe Hola, Ana", spec: { stdin: ["Ana"], expected: "Hola, Ana" } },
        ],
        hints: ["Primero `Leer nombre;`.", 'Después `Escribir "Hola, ", nombre;`.'],
        solution: P("Saludo", '    Definir nombre Como Caracter;\n    Leer nombre;\n    Escribir "Hola, ", nombre;'),
        wrong: [P("Saludo", '    Definir nombre Como Caracter;\n    Leer nombre;\n    Escribir "Hola, nombre";')],
      },
      {
        slug: "suma-de-dos",
        title: "Suma de dos números",
        instructions_md: "Lee dos números enteros y escribe su suma.",
        starter_code: P("Suma", "    Definir a, b Como Entero;\n    // Lee a y b, escribe la suma"),
        tests: [
          { kind: "stdout", description: "Con 4 y 9 escribe 13", spec: { stdin: ["4", "9"], expected: "13" } },
          { kind: "stdout", description: "Con -2 y 2 escribe 0", spec: { stdin: ["-2", "2"], expected: "0" } },
        ],
        hints: ["Puedes leer los dos con `Leer a, b;`.", "Escribe `Escribir a + b;`."],
        solution: P("Suma", "    Definir a, b Como Entero;\n    Leer a, b;\n    Escribir a + b;"),
        wrong: [P("Suma", "    Definir a, b Como Entero;\n    Leer a, b;\n    Escribir a * b;")],
      },
    ],
  },
  {
    slug: "decisiones-pseudocodigo",
    title: "Decisiones con Si",
    summary: "Elige caminos con condiciones.",
    language: "pseudocode_es",
    visibility: "program",
    course: "logica-con-pseudocodigo",
    position: 3,
    minutes: 20,
    pair: "decisiones-python",
    content_md: `**Meta:** que tu programa tome decisiones.

Una **condición** es una pregunta que se responde con \`Verdadero\` o \`Falso\`: \`edad >= 15\`, \`n MOD 2 = 0\`.

\`\`\`pseudo run
Proceso Clima
    Definir grados Como Entero;
    grados <- 31;
    Si grados > 28 Entonces
        Escribir "Lleva agua y gorra";
    Sino
        Escribir "Lleva suéter";
    FinSi
FinProceso
\`\`\`

## Comparaciones

\`=\` igual, \`<>\` distinto, \`<\` \`>\` \`<=\` \`>=\`. Y para unir condiciones: \`Y\`, \`O\`, \`NO\`.

**En resumen:** \`Si condición Entonces ... Sino ... FinSi\`.`,
    exercises: [
      {
        slug: "taller-por-edad",
        title: "¿Qué taller te toca?",
        instructions_md: "Lee una edad. Si es 15 o más, escribe `Taller de Python`. Si no, escribe `Taller de lógica`.",
        starter_code: P("Taller", "    Definir edad Como Entero;\n    Leer edad;\n    // Decide con Si"),
        tests: [
          { kind: "stdout", description: "Con 16 escribe Taller de Python", spec: { stdin: ["16"], expected: "Taller de Python" } },
          { kind: "stdout", description: "Con 15 escribe Taller de Python", spec: { stdin: ["15"], expected: "Taller de Python" } },
          { kind: "stdout", description: "Con 12 escribe Taller de lógica", spec: { stdin: ["12"], expected: "Taller de lógica" } },
        ],
        hints: ["Usa `>=` para incluir el 15.", 'Escribe `Si edad >= 15 Entonces` y en el `Sino` escribe `"Taller de lógica"`.'],
        solution: P("Taller", '    Definir edad Como Entero;\n    Leer edad;\n    Si edad >= 15 Entonces\n        Escribir "Taller de Python";\n    Sino\n        Escribir "Taller de lógica";\n    FinSi'),
        wrong: [P("Taller", '    Definir edad Como Entero;\n    Leer edad;\n    Si edad > 15 Entonces\n        Escribir "Taller de Python";\n    Sino\n        Escribir "Taller de lógica";\n    FinSi')],
      },
      {
        slug: "par-o-impar",
        title: "Par o impar",
        instructions_md: "Lee un número entero y escribe `par` o `impar`. Pista: `MOD` da el residuo de una división.",
        starter_code: P("ParImpar", "    Definir n Como Entero;\n    Leer n;\n    // Usa n MOD 2"),
        tests: [
          { kind: "stdout", description: "Con 8 escribe par", spec: { stdin: ["8"], expected: "par" } },
          { kind: "stdout", description: "Con 7 escribe impar", spec: { stdin: ["7"], expected: "impar" } },
          { kind: "stdout", description: "Con 0 escribe par", spec: { stdin: ["0"], expected: "par" } },
        ],
        hints: ["Un número es par si `n MOD 2 = 0`.", 'Escribe `Si n MOD 2 = 0 Entonces Escribir "par"; Sino Escribir "impar"; FinSi` en varias líneas.'],
        solution: P("ParImpar", '    Definir n Como Entero;\n    Leer n;\n    Si n MOD 2 = 0 Entonces\n        Escribir "par";\n    Sino\n        Escribir "impar";\n    FinSi'),
        wrong: [P("ParImpar", '    Definir n Como Entero;\n    Leer n;\n    Si n MOD 2 = 1 Entonces\n        Escribir "par";\n    Sino\n        Escribir "impar";\n    FinSi')],
      },
    ],
  },
  {
    slug: "ciclos-pseudocodigo",
    title: "Repetir con Para y Mientras",
    summary: "Ciclos que trabajan por ti.",
    language: "pseudocode_es",
    visibility: "program",
    course: "logica-con-pseudocodigo",
    position: 4,
    minutes: 20,
    pair: "ciclos-python",
    content_md: `**Meta:** repetir instrucciones.

\`Para\` repite un número conocido de veces. \`Mientras\` repite mientras una condición sea verdadera.

\`\`\`pseudo run
Proceso Cuenta
    Definir i Como Entero;
    Para i <- 1 Hasta 3 Hacer
        Escribir "Vuelta ", i;
    FinPara
FinProceso
\`\`\`

Usa **Paso a paso** para ver cómo cambia \`i\` en cada vuelta.

**En resumen:** \`Para\` cuando sabes cuántas veces; \`Mientras\` cuando depende de una condición.`,
    exercises: [
      {
        slug: "del-uno-al-cinco",
        title: "Del 1 al 5",
        instructions_md: "Escribe los números del 1 al 5, uno por línea, usando `Para`.",
        starter_code: P("UnoAlCinco", "    Definir i Como Entero;\n    // Escribe el ciclo Para"),
        tests: [
          { kind: "stdout", description: "Escribe del 1 al 5", spec: { expected: "1\n2\n3\n4\n5" } },
          { kind: "construct_rule", description: "Usa Para", spec: { must_contain: ["Para"], message_es: "Resuélvelo con un ciclo Para." } },
        ],
        hints: ["`Para i <- 1 Hasta 5 Hacer` ... `FinPara`.", "Dentro del ciclo escribe `Escribir i;`."],
        solution: P("UnoAlCinco", "    Definir i Como Entero;\n    Para i <- 1 Hasta 5 Hacer\n        Escribir i;\n    FinPara"),
        wrong: [P("UnoAlCinco", "    Definir i Como Entero;\n    Para i <- 1 Hasta 4 Hacer\n        Escribir i;\n    FinPara")],
      },
      {
        slug: "suma-hasta-cero",
        title: "Suma hasta el cero",
        instructions_md: "Lee números uno por uno y súmalos. Cuando llegue un 0, deja de leer y escribe la suma.",
        starter_code: P("SumaHastaCero", "    Definir n, suma Como Entero;\n    suma <- 0;\n    Leer n;\n    // Repite mientras n sea distinto de 0"),
        tests: [
          { kind: "stdout", description: "Con 5, 3, 2 y 0 escribe 10", spec: { stdin: ["5", "3", "2", "0"], expected: "10" } },
          { kind: "stdout", description: "Con 0 escribe 0", spec: { stdin: ["0"], expected: "0" } },
          { kind: "construct_rule", description: "Usa Mientras", spec: { must_contain: ["Mientras"], message_es: "Usa Mientras para repetir hasta el 0." } },
        ],
        hints: ["`Mientras n <> 0 Hacer` ... `FinMientras`.", "Dentro: `suma <- suma + n;` y vuelve a `Leer n;`. Al final `Escribir suma;`."],
        solution: P("SumaHastaCero", "    Definir n, suma Como Entero;\n    suma <- 0;\n    Leer n;\n    Mientras n <> 0 Hacer\n        suma <- suma + n;\n        Leer n;\n    FinMientras\n    Escribir suma;"),
        wrong: [P("SumaHastaCero", "    Definir n, suma Como Entero;\n    suma <- 0;\n    Leer n;\n    suma <- suma + n;\n    Escribir suma;")],
      },
    ],
  },
  {
    slug: "arreglos-pseudocodigo",
    title: "Arreglos: muchas cajitas",
    summary: "Guarda listas de datos con Dimension.",
    language: "pseudocode_es",
    visibility: "program",
    course: "logica-con-pseudocodigo",
    position: 5,
    minutes: 20,
    pair: "listas-python",
    content_md: `**Meta:** guardar varios datos con un solo nombre.

Un **arreglo** es una fila de cajitas numeradas. Se crea con \`Dimension\` y las posiciones empiezan en **1**.

\`\`\`pseudo run
Proceso Notas
    Definir i Como Entero;
    Dimension notas[3];
    notas[1] <- 9;
    notas[2] <- 7;
    notas[3] <- 10;
    Para i <- 1 Hasta 3 Hacer
        Escribir "Nota ", i, ": ", notas[i];
    FinPara
FinProceso
\`\`\`

**En resumen:** \`Dimension notas[3]\` crea las posiciones 1, 2 y 3.`,
    exercises: [
      {
        slug: "promedio-de-notas",
        title: "Promedio de notas",
        instructions_md: "El arreglo `notas` tiene 8, 9 y 10. Calcula el promedio, guárdalo en `promedio` y escríbelo.",
        starter_code: P("Promedio", "    Definir i Como Entero;\n    Definir suma, promedio Como Real;\n    Dimension notas[3];\n    notas[1] <- 8;\n    notas[2] <- 9;\n    notas[3] <- 10;\n    suma <- 0;\n    // Suma las notas con un Para y calcula el promedio"),
        tests: [
          { kind: "final_variable", description: "promedio vale 9", spec: { variables: { promedio: 9 } } },
          { kind: "stdout", description: "Escribe 9", spec: { expected: "9" } },
        ],
        hints: ["Recorre con `Para i <- 1 Hasta 3 Hacer` y acumula `suma <- suma + notas[i];`.", "Al final: `promedio <- suma / 3;` y `Escribir promedio;`."],
        solution: P("Promedio", "    Definir i Como Entero;\n    Definir suma, promedio Como Real;\n    Dimension notas[3];\n    notas[1] <- 8;\n    notas[2] <- 9;\n    notas[3] <- 10;\n    suma <- 0;\n    Para i <- 1 Hasta 3 Hacer\n        suma <- suma + notas[i];\n    FinPara\n    promedio <- suma / 3;\n    Escribir promedio;"),
        wrong: [P("Promedio", "    Definir i Como Entero;\n    Definir suma, promedio Como Real;\n    Dimension notas[3];\n    notas[1] <- 8;\n    notas[2] <- 9;\n    notas[3] <- 10;\n    suma <- 0;\n    Para i <- 1 Hasta 2 Hacer\n        suma <- suma + notas[i];\n    FinPara\n    promedio <- suma / 3;\n    Escribir promedio;")],
      },
      {
        slug: "el-mayor",
        title: "El número mayor",
        instructions_md: "Lee 5 números en un arreglo y escribe el mayor.",
        starter_code: P("Mayor", "    Definir i, mayor Como Entero;\n    Dimension n[5];\n    Para i <- 1 Hasta 5 Hacer\n        Leer n[i];\n    FinPara\n    // Encuentra el mayor"),
        tests: [
          { kind: "stdout", description: "Con 4, 18, 7, 2, 11 escribe 18", spec: { stdin: ["4", "18", "7", "2", "11"], expected: "18" } },
          { kind: "stdout", description: "Con negativos escribe -1", spec: { stdin: ["-5", "-1", "-9", "-3", "-7"], expected: "-1" } },
        ],
        hints: ["Empieza suponiendo que el mayor es `n[1]`.", "Recorre de la posición 2 a la 5: si `n[i] > mayor`, entonces `mayor <- n[i]`."],
        solution: P("Mayor", "    Definir i, mayor Como Entero;\n    Dimension n[5];\n    Para i <- 1 Hasta 5 Hacer\n        Leer n[i];\n    FinPara\n    mayor <- n[1];\n    Para i <- 2 Hasta 5 Hacer\n        Si n[i] > mayor Entonces\n            mayor <- n[i];\n        FinSi\n    FinPara\n    Escribir mayor;"),
        wrong: [P("Mayor", "    Definir i, mayor Como Entero;\n    Dimension n[5];\n    Para i <- 1 Hasta 5 Hacer\n        Leer n[i];\n    FinPara\n    mayor <- 0;\n    Para i <- 1 Hasta 5 Hacer\n        Si n[i] > mayor Entonces\n            mayor <- n[i];\n        FinSi\n    FinPara\n    Escribir mayor;")],
      },
    ],
  },

  // ---------------- Course: Python desde cero ----------------
  {
    slug: "variables-python",
    title: "Variables en Python",
    summary: "Las mismas cajitas, sin Definir.",
    language: "python",
    visibility: "program",
    course: "python-desde-cero",
    position: 1,
    minutes: 15,
    pair: "variables-pseudocodigo",
    content_md: `**Meta:** guardar datos en variables de Python.

En Python no se usa \`Definir\`: la variable nace cuando le das un valor con \`=\`.

\`\`\`python run
edad = 14
print("Tengo", edad, "años")
\`\`\`

Python adivina el tipo: \`14\` es entero (\`int\`), \`25.5\` es decimal (\`float\`) y \`"Apaxco"\` es texto (\`str\`).

**En resumen:** \`nombre = valor\` crea o cambia una variable.`,
    exercises: [
      {
        slug: "edad-en-meses-py",
        title: "Tu edad en meses",
        instructions_md: "`edad` vale 14. Guarda en `meses` cuántos meses son y muéstralo con `print`.",
        starter_code: "edad = 14\n# Calcula meses\n",
        tests: [
          { kind: "final_variable", description: "meses vale 168", spec: { variables: { meses: 168 } } },
          { kind: "stdout", description: "Muestra 168", spec: { expected: "168" } },
        ],
        hints: ["Multiplica por 12.", "`meses = edad * 12` y luego `print(meses)`."],
        solution: "edad = 14\nmeses = edad * 12\nprint(meses)\n",
        wrong: ["edad = 14\nmeses = edad + 12\nprint(meses)\n"],
      },
      {
        slug: "precio-total-py",
        title: "Cuenta de la papelería",
        instructions_md: "Cada cuaderno cuesta 25.5 y compras 4. Guarda el total en `total`.",
        starter_code: "precio = 25.5\ncantidad = 4\n# Calcula total\n",
        tests: [{ kind: "final_variable", description: "total vale 102", spec: { variables: { total: 102 }, compare: "approx" } }],
        hints: ["El total es precio por cantidad.", "`total = precio * cantidad`."],
        solution: "precio = 25.5\ncantidad = 4\ntotal = precio * cantidad\n",
        wrong: ["precio = 25.5\ncantidad = 4\ntotal = precio + cantidad\n"],
      },
    ],
    deck: {
      schema_version: 1,
      slides: [
        { id: "s1", title: "Variables en Python", blocks: [{ type: "bullets", items: ["Se crean con =", "No necesitan Definir", "Python reconoce el tipo"] }], notes: "Compara con la lección de pseudocódigo." },
        { id: "s2", title: "Del pseudocódigo a Python", blocks: [{ type: "code", language: "pseudocode_es", code: "Definir edad Como Entero;\nedad <- 14;" }, { type: "code", language: "python", code: "edad = 14" }], notes: "Pide que identifiquen qué cambió." },
        { id: "s3", title: "Resumen", blocks: [{ type: "callout", kind: "note", markdown: "`nombre = valor` crea o cambia una variable." }], notes: "" },
      ],
    },
  },
  {
    slug: "entrada-python",
    title: "Pedir datos con input",
    summary: "input() y la conversión a número.",
    language: "python",
    visibility: "program",
    course: "python-desde-cero",
    position: 2,
    minutes: 15,
    pair: "leer-datos-pseudocodigo",
    content_md: `**Meta:** recibir datos de quien usa el programa.

\`input()\` siempre regresa **texto**. Para hacer cuentas conviértelo con \`int()\` (enteros) o \`float()\` (decimales).

\`\`\`python
nombre = input()
edad = int(input())
print("Hola,", nombre)
\`\`\`

Escribe los datos de prueba en el campo **Entradas**, uno por línea.

**En resumen:** \`input()\` lee texto; \`int(input())\` lee un número entero.`,
    exercises: [
      {
        slug: "saludo-personal-py",
        title: "Saludo personal",
        instructions_md: "Lee un nombre y muestra `Hola, ` seguido del nombre.",
        starter_code: "nombre = input()\n# Saluda\n",
        tests: [
          { kind: "stdout", description: "Con Xóchitl muestra Hola, Xóchitl", spec: { stdin: ["Xóchitl"], expected: "Hola, Xóchitl" } },
          { kind: "stdout", description: "Con Ana muestra Hola, Ana", spec: { stdin: ["Ana"], expected: "Hola, Ana" } },
        ],
        hints: ["Puedes unir textos con `+`.", '`print("Hola, " + nombre)`.'],
        solution: 'nombre = input()\nprint("Hola, " + nombre)\n',
        wrong: ['nombre = input()\nprint("Hola, nombre")\n'],
      },
      {
        slug: "suma-de-dos-py",
        title: "Suma de dos números",
        instructions_md: "Lee dos enteros (uno por línea) y muestra su suma.",
        starter_code: "a = int(input())\n# Lee b y muestra la suma\n",
        tests: [
          { kind: "stdout", description: "Con 4 y 9 muestra 13", spec: { stdin: ["4", "9"], expected: "13" } },
          { kind: "stdout", description: "Con -2 y 2 muestra 0", spec: { stdin: ["-2", "2"], expected: "0" } },
        ],
        hints: ["Lee `b` igual que `a`.", "`print(a + b)`. Sin `int()` Python juntaría los textos."],
        solution: "a = int(input())\nb = int(input())\nprint(a + b)\n",
        wrong: ["a = input()\nb = input()\nprint(a + b)\n"],
      },
    ],
  },
  {
    slug: "decisiones-python",
    title: "Decisiones con if",
    summary: "if, else y la sangría.",
    language: "python",
    visibility: "program",
    course: "python-desde-cero",
    position: 3,
    minutes: 20,
    pair: "decisiones-pseudocodigo",
    content_md: `**Meta:** decidir en Python.

\`if\` es el \`Si\` de Python y \`else\` es el \`Sino\`. No hay \`FinSi\`: Python usa la **sangría** (cuatro espacios) para saber qué va dentro. Al final de la condición van dos puntos \`:\`.

\`\`\`python run
grados = 31
if grados > 28:
    print("Lleva agua y gorra")
else:
    print("Lleva suéter")
\`\`\`

**En resumen:** \`if condición:\` y bloques con sangría.`,
    exercises: [
      {
        slug: "taller-por-edad-py",
        title: "¿Qué taller te toca?",
        instructions_md: "Lee una edad. Si es 15 o más, muestra `Taller de Python`; si no, `Taller de lógica`.",
        starter_code: "edad = int(input())\n# Decide con if\n",
        tests: [
          { kind: "stdout", description: "Con 16 muestra Taller de Python", spec: { stdin: ["16"], expected: "Taller de Python" } },
          { kind: "stdout", description: "Con 15 muestra Taller de Python", spec: { stdin: ["15"], expected: "Taller de Python" } },
          { kind: "stdout", description: "Con 12 muestra Taller de lógica", spec: { stdin: ["12"], expected: "Taller de lógica" } },
        ],
        hints: ["`>=` incluye el 15.", "`if edad >= 15:` y en el `else:` el otro taller. Cuida la sangría."],
        solution: 'edad = int(input())\nif edad >= 15:\n    print("Taller de Python")\nelse:\n    print("Taller de lógica")\n',
        wrong: ['edad = int(input())\nif edad > 15:\n    print("Taller de Python")\nelse:\n    print("Taller de lógica")\n'],
      },
      {
        slug: "par-o-impar-py",
        title: "Par o impar",
        instructions_md: "Completa `es_par(n)` para que regrese `True` si `n` es par y `False` si no. En Python el residuo se calcula con `%`.",
        starter_code: "def es_par(n):\n    # Regresa True o False\n    pass\n",
        tests: [
          { kind: "function_call", description: "es_par(8) regresa True", spec: { function: "es_par", args: [8], expected: true } },
          { kind: "function_call", description: "es_par(7) regresa False", spec: { function: "es_par", args: [7], expected: false } },
          { kind: "function_call", description: "es_par(0) regresa True", spec: { function: "es_par", args: [0], expected: true } },
        ],
        hints: ["`n % 2` es 0 cuando el número es par.", "Puedes escribir `return n % 2 == 0`."],
        solution: "def es_par(n):\n    return n % 2 == 0\n",
        wrong: ["def es_par(n):\n    return n % 2 == 1\n"],
      },
    ],
  },
  {
    slug: "ciclos-python",
    title: "Ciclos con for y while",
    summary: "Repite con range y con condiciones.",
    language: "python",
    visibility: "program",
    course: "python-desde-cero",
    position: 4,
    minutes: 20,
    pair: "ciclos-pseudocodigo",
    content_md: `**Meta:** repetir en Python.

\`for\` es como \`Para\`, y \`while\` es como \`Mientras\`.

\`\`\`python run
for i in range(1, 4):
    print("Vuelta", i)

n = 3
while n > 0:
    print(n)
    n = n - 1
\`\`\`

**En resumen:** \`range(1, 6)\` da 1, 2, 3, 4 y 5.`,
    exercises: [
      {
        slug: "del-uno-al-cinco-py",
        title: "Del 1 al 5",
        instructions_md: "Muestra los números del 1 al 5, uno por línea, con `for`.",
        starter_code: "# Escribe el ciclo\n",
        tests: [
          { kind: "stdout", description: "Muestra del 1 al 5", spec: { expected: "1\n2\n3\n4\n5" } },
          { kind: "construct_rule", description: "Usa for", spec: { must_contain: ["For"], message_es: "Resuélvelo con for." } },
        ],
        hints: ["`range(1, 6)` llega hasta el 5.", "`for i in range(1, 6):` y dentro `print(i)`."],
        solution: "for i in range(1, 6):\n    print(i)\n",
        wrong: ["for i in range(1, 5):\n    print(i)\n"],
      },
      {
        slug: "suma-hasta-cero-py",
        title: "Suma hasta el cero",
        instructions_md: "Lee enteros hasta que llegue un 0 y muestra la suma.",
        starter_code: "suma = 0\nn = int(input())\n# Repite mientras n no sea 0\n",
        tests: [
          { kind: "stdout", description: "Con 5, 3, 2 y 0 muestra 10", spec: { stdin: ["5", "3", "2", "0"], expected: "10" } },
          { kind: "stdout", description: "Con 0 muestra 0", spec: { stdin: ["0"], expected: "0" } },
          { kind: "construct_rule", description: "Usa while", spec: { must_contain: ["While"], message_es: "Usa while para repetir hasta el 0." } },
        ],
        hints: ["`while n != 0:`", "Dentro: `suma = suma + n` y `n = int(input())`. Al final `print(suma)`."],
        solution: "suma = 0\nn = int(input())\nwhile n != 0:\n    suma = suma + n\n    n = int(input())\nprint(suma)\n",
        wrong: ["suma = 0\nn = int(input())\nsuma = suma + n\nprint(suma)\n"],
      },
    ],
  },
  {
    slug: "listas-python",
    title: "Listas",
    summary: "Muchos datos en una variable.",
    language: "python",
    visibility: "program",
    course: "python-desde-cero",
    position: 5,
    minutes: 20,
    pair: "arreglos-pseudocodigo",
    content_md: `**Meta:** trabajar con listas.

Una lista se escribe entre corchetes. Ojo: en Python las posiciones empiezan en **0**, no en 1 como en el pseudocódigo.

\`\`\`python run
notas = [9, 7, 10]
print(notas[0])
print(len(notas))
for nota in notas:
    print("Nota:", nota)
\`\`\`

**En resumen:** \`lista[0]\` es el primer elemento y \`len(lista)\` dice cuántos hay.`,
    exercises: [
      {
        slug: "promedio-de-notas-py",
        title: "Promedio de notas",
        instructions_md: "Guarda en `promedio` el promedio de la lista `notas`.",
        starter_code: "notas = [8, 9, 10]\n# Calcula el promedio\n",
        tests: [{ kind: "final_variable", description: "promedio vale 9", spec: { variables: { promedio: 9 }, compare: "approx" } }],
        hints: ["`sum(notas)` suma toda la lista.", "`promedio = sum(notas) / len(notas)`."],
        solution: "notas = [8, 9, 10]\npromedio = sum(notas) / len(notas)\n",
        wrong: ["notas = [8, 9, 10]\npromedio = sum(notas) / 2\n"],
      },
      {
        slug: "el-mayor-py",
        title: "El número mayor",
        instructions_md: "Completa `mayor(numeros)` para que regrese el número más grande de la lista, sin usar `max`.",
        starter_code: "def mayor(numeros):\n    resultado = numeros[0]\n    # Recorre la lista\n    return resultado\n",
        tests: [
          { kind: "function_call", description: "mayor([4, 18, 7]) regresa 18", spec: { function: "mayor", args: [[4, 18, 7]], expected: 18 } },
          { kind: "function_call", description: "Funciona con negativos", spec: { function: "mayor", args: [[-5, -1, -9]], expected: -1 } },
          { kind: "construct_rule", description: "Usa un ciclo", spec: { must_contain: ["For"], message_es: "Recorre la lista con for." } },
        ],
        hints: ["`for n in numeros:` recorre cada número.", "Si `n > resultado`, guarda `resultado = n`."],
        solution: "def mayor(numeros):\n    resultado = numeros[0]\n    for n in numeros:\n        if n > resultado:\n            resultado = n\n    return resultado\n",
        wrong: ["def mayor(numeros):\n    resultado = 0\n    for n in numeros:\n        if n > resultado:\n            resultado = n\n    return resultado\n"],
      },
    ],
  },
  {
    slug: "funciones-python",
    title: "Tus propias funciones",
    summary: "def, parámetros y return.",
    language: "python",
    visibility: "program",
    course: "python-desde-cero",
    position: 6,
    minutes: 20,
    content_md: `**Meta:** crear funciones reutilizables.

Una **función** es una receta con nombre. Recibe datos (parámetros) y regresa un resultado con \`return\`.

\`\`\`python run
def doble(n):
    return n * 2

print(doble(21))
\`\`\`

**En resumen:** \`def nombre(parametros):\` y \`return\` para regresar el resultado.`,
    exercises: [
      {
        slug: "area-triangulo-py",
        title: "Área de un triángulo",
        instructions_md: "Escribe `area_triangulo(base, altura)` que regrese base por altura entre 2.",
        starter_code: "def area_triangulo(base, altura):\n    # Escribe tu código aquí\n    pass\n",
        tests: [
          { kind: "function_call", description: "area_triangulo(4, 3) regresa 6", spec: { function: "area_triangulo", args: [4, 3], expected: 6, compare: "approx" } },
          { kind: "function_call", description: "area_triangulo(5, 2) regresa 5", spec: { function: "area_triangulo", args: [5, 2], expected: 5, compare: "approx" } },
          { kind: "construct_rule", description: "Usa return", spec: { must_contain: ["Return"], message_es: "Recuerda usar return para regresar el resultado." } },
        ],
        hints: ["La fórmula es `base * altura / 2`.", "`return base * altura / 2`."],
        solution: "def area_triangulo(base, altura):\n    return base * altura / 2\n",
        wrong: ["def area_triangulo(base, altura):\n    return base * altura\n", "def area_triangulo(base, altura):\n    print(base * altura / 2)\n"],
      },
      {
        slug: "saludo-funcion-py",
        title: "Función que saluda",
        instructions_md: 'Escribe `saludo(nombre)` que regrese el texto `"¡Hola, " + nombre + "!"`.',
        starter_code: "def saludo(nombre):\n    pass\n",
        tests: [
          { kind: "function_call", description: 'saludo("Itzel") regresa ¡Hola, Itzel!', spec: { function: "saludo", args: ["Itzel"], expected: "¡Hola, Itzel!" } },
          { kind: "assert_code", description: "Regresa un texto", spec: { code: "assert isinstance(saludo('Ana'), str)", message_es: "La función debe regresar un texto con return." } },
        ],
        hints: ["Une textos con `+`.", 'Escribe `return "¡Hola, " + nombre + "!"`.'],
        solution: 'def saludo(nombre):\n    return "¡Hola, " + nombre + "!"\n',
        wrong: ['def saludo(nombre):\n    print("¡Hola, " + nombre + "!")\n'],
      },
    ],
  },
];

/** Sample Logros shown until founders publish real, consented student work. */
export const SAMPLE_LOGROS = [
  {
    title: "Calculadora de propinas",
    blurb: "Pide el total de la cuenta y el porcentaje, y reparte entre las personas de la mesa.",
    kind: "project" as const,
    tags: ["Python", "Operaciones"],
    language: "python" as const,
    community: "tequixquiac",
    featured: true,
    code: 'total = float(input("Total de la cuenta: "))\nporcentaje = float(input("Propina (%): "))\npersonas = int(input("Personas: "))\npropina = total * porcentaje / 100\nprint("Propina:", round(propina, 2))\nprint("Cada quien paga:", round((total + propina) / personas, 2))\n',
  },
  {
    title: "Semáforo de hábitos",
    blurb: "Pregunta cuántos vasos de agua tomaste y responde en verde, amarillo o rojo.",
    kind: "first_program" as const,
    tags: ["Pseudocódigo", "Decisiones"],
    language: "pseudocode_es" as const,
    community: "apaxco",
    featured: false,
    code: 'Proceso Semaforo\n    Definir vasos Como Entero;\n    Escribir "¿Cuántos vasos de agua tomaste hoy?";\n    Leer vasos;\n    Si vasos >= 8 Entonces\n        Escribir "Verde: ¡vas muy bien!";\n    Sino\n        Si vasos >= 4 Entonces\n            Escribir "Amarillo: un vaso más";\n        Sino\n            Escribir "Rojo: hora de hidratarte";\n        FinSi\n    FinSi\nFinProceso\n',
  },
  {
    title: "Juego de la tabla del 7",
    blurb: "Un minijuego que pregunta multiplicaciones al azar y lleva el puntaje.",
    kind: "project" as const,
    tags: ["Pseudocódigo", "Ciclos", "Azar"],
    language: "pseudocode_es" as const,
    community: "tequixquiac",
    featured: false,
    code: 'Proceso TablaDel7\n    Definir i, n, respuesta, puntos Como Entero;\n    puntos <- 0;\n    Para i <- 1 Hasta 3 Hacer\n        n <- ALEATORIO(1, 10);\n        Escribir "¿Cuánto es 7 x ", n, "?";\n        Leer respuesta;\n        Si respuesta = 7 * n Entonces\n            puntos <- puntos + 1;\n            Escribir "¡Bien!";\n        Sino\n            Escribir "Era ", 7 * n;\n        FinSi\n    FinPara\n    Escribir "Puntos: ", puntos, " de 3";\nFinProceso\n',
  },
];
