// Stable pseudocode error codes with complete Spanish defaults (tech spec Appendix D.7).
// The same rows feed the friendly-error catalog, so an empty catalog never shows English.

import type { ErrorTranslationRow } from "@codeher/core";

export interface PseudoErrorTemplate {
  message: string;
  explanation: string;
  suggestion: string;
}

export const PSEUDO_ERRORS: Record<string, PseudoErrorTemplate> = {
  FaltaCierre: {
    message: "Falta {cierre} para cerrar el {apertura} de la línea {line}.",
    explanation: "Cada Si, Mientras, Para, Segun, Repetir y Funcion termina con su propia palabra de cierre.",
    suggestion: "Escribe {cierre} al final del bloque y revisa que cada parte quede bien alineada.",
  },
  CierreSinApertura: {
    message: "Encontré {cierre} en la línea {line}, pero no hay ningún {apertura} abierto.",
    explanation: "Las palabras de cierre solo pueden ir después de su bloque.",
    suggestion: "Borra {cierre} o agrega el {apertura} que le corresponde.",
  },
  FaltaEntonces: {
    message: "Después de la condición del Si falta Entonces (línea {line}).",
    explanation: "Un Si se escribe así: Si condición Entonces.",
    suggestion: "Agrega la palabra Entonces al final de la línea {line}.",
  },
  FaltaHacer: {
    message: "Después de {apertura} falta Hacer (línea {line}).",
    explanation: "Mientras, Para y Segun necesitan la palabra Hacer antes de su bloque.",
    suggestion: "Agrega la palabra Hacer al final de la línea {line}.",
  },
  FaltaQue: {
    message: "Después de Hasta falta Que (línea {line}).",
    explanation: "Un Repetir termina con Hasta Que y una condición.",
    suggestion: "Escribe Hasta Que seguido de la condición.",
  },
  FaltaComo: {
    message: "Después de Definir {name} falta Como y el tipo (línea {line}).",
    explanation: "Definir dice qué tipo de dato va a guardar cada variable.",
    suggestion: "Por ejemplo: Definir {name} Como Entero;",
  },
  TipoDesconocido: {
    message: "No conozco el tipo {tipo} (línea {line}).",
    explanation: "Los tipos de este pseudocódigo son Entero, Real, Caracter y Logico.",
    suggestion: "Cambia {tipo} por Entero, Real, Caracter o Logico.",
  },
  SimboloInesperado: {
    message: "No esperaba {simbolo} en la línea {line}.",
    explanation: "Hay un símbolo o una palabra que no va en ese lugar.",
    suggestion: "Revisa la línea {line}: quizá sobra algo o falta una coma.",
  },
  InstruccionDesconocida: {
    message: "No conozco la instrucción {name} (línea {line}).{sugerencia}",
    explanation: "Cada línea empieza con una instrucción como Escribir, Leer o Si, o con una variable que recibe un valor.",
    suggestion: "Revisa cómo está escrita la primera palabra de la línea {line}.",
  },
  TextoSinCerrar: {
    message: "Falta cerrar las comillas del texto en la línea {line}.",
    explanation: "Todo texto empieza y termina con comillas.",
    suggestion: "Agrega las comillas que faltan al final del texto.",
  },
  FaltaExpresion: {
    message: "Falta un valor o una condición en la línea {line}.",
    explanation: "Después de esa palabra o símbolo tiene que venir un número, un texto, una variable o una operación.",
    suggestion: "Completa la línea {line}.",
  },
  FaltaParentesis: {
    message: "Falta cerrar {simbolo} en la línea {line}.",
    explanation: "Cada paréntesis o corchete que abres se tiene que cerrar.",
    suggestion: "Agrega {simbolo} donde termina la operación.",
  },
  AsignacionConIgual: {
    message: "Para guardar un valor usa <-: {name} <- {valor}",
    explanation: "En pseudocódigo el signo = sirve para comparar, y <- sirve para guardar un valor.",
    suggestion: "Cambia = por <- en la línea {line}.",
  },
  VariableNoDefinida: {
    message: "La variable {name} no está definida. Agrega Definir {name} Como Entero;",
    explanation: "En pseudocódigo, cada variable se declara antes de usarla.",
    suggestion: "Agrega Definir {name} Como Entero; (o el tipo que necesites) al inicio del proceso.",
  },
  VariableSinValor: {
    message: "La variable {name} todavía no tiene valor.",
    explanation: "Antes de usar una variable hay que guardarle algo con <- o con Leer.",
    suggestion: "Asigna un valor a {name} antes de la línea {line}.",
  },
  TipoIncompatible: {
    message: "{detalle}",
    explanation: "Cada operación funciona con ciertos tipos de datos: números con números, textos con textos.",
    suggestion: "Revisa los tipos de las variables de la línea {line}.",
  },
  DivisionEntreCero: {
    message: "No se puede dividir entre cero (línea {line}).",
    explanation: "En matemáticas, dividir entre 0 no tiene resultado.",
    suggestion: "Revisa el valor por el que divides en la línea {line}.",
  },
  IndiceFueraDeRango: {
    message: "{name}[{indice}] no existe: el arreglo tiene posiciones de {desde} a {hasta}.",
    explanation: "En este pseudocódigo las posiciones de un arreglo empiezan en 1.",
    suggestion: "Usa una posición entre {desde} y {hasta}.",
  },
  ArregloSinDimension: {
    message: "Primero declara el arreglo {name} con Dimension.",
    explanation: "Un arreglo necesita saber cuántas posiciones tiene antes de usarse.",
    suggestion: "Agrega Dimension {name}[5]; (con el tamaño que necesites) antes de la línea {line}.",
  },
  ArregloDemasiadoGrande: {
    message: "El arreglo {name} es demasiado grande (máximo {max} posiciones).",
    explanation: "Para cuidar tu dispositivo, los arreglos tienen un tamaño máximo.",
    suggestion: "Usa un tamaño más pequeño.",
  },
  FuncionNoExiste: {
    message: "No conozco ninguna función llamada {name} (línea {line}).",
    explanation: "Solo puedes usar las funciones que vienen incluidas o las que escribes con Funcion o SubProceso.",
    suggestion: "Revisa que {name} esté bien escrita.",
  },
  ArgumentosIncorrectos: {
    message: "{name} espera {esperados} valores y recibió {recibidos}.",
    explanation: "Una función necesita exactamente los valores que pide entre paréntesis.",
    suggestion: "Revisa cuántos valores le pasas a {name} en la línea {line}.",
  },
  SinValorDeRetorno: {
    message: "{name} no regresa ningún valor, así que no se puede usar en una operación.",
    explanation: "Un SubProceso hace algo pero no regresa un resultado.",
    suggestion: "Llama a {name} en su propia línea, o conviértelo en Funcion r <- {name}(...).",
  },
  ConversionInvalida: {
    message: "No pude convertir {valor} en {tipo}.",
    explanation: "El dato que llegó no se puede guardar en una variable de ese tipo.",
    suggestion: "Escribe un dato del tipo correcto, por ejemplo un número para una variable Entero.",
  },
  EntradaAgotada: {
    message: "El programa pidió más datos de los que se dieron.",
    explanation: "Cada Leer necesita un dato.",
    suggestion: "Revisa cuántas veces usas Leer, o agrega más datos de entrada.",
  },
  LimiteDePasos: {
    message: "Tu programa se ejecutó demasiado tiempo. ¿Un ciclo que nunca termina?",
    explanation: "Si la condición de un ciclo nunca cambia, el ciclo se repite para siempre.",
    suggestion: "Revisa que la variable de la condición cambie dentro del ciclo.",
  },
  RecursionExcesiva: {
    message: "Una función se llamó a sí misma demasiadas veces.",
    explanation: "Una función que se llama a sí misma necesita un caso en el que se detenga.",
    suggestion: "Agrega una condición de salida en la función.",
  },
  LimiteDeSalida: {
    message: "Tu programa escribió demasiado texto.",
    explanation: "La salida tiene un límite para que tu dispositivo no se trabe.",
    suggestion: "Revisa si un Escribir está dentro de un ciclo que se repite muchas veces.",
  },
  FaltaProceso: {
    message: "Tu programa necesita Proceso y FinProceso.",
    explanation: "Todo programa empieza con Proceso Nombre y termina con FinProceso.",
    suggestion: "Escribe Proceso MiPrograma en la primera línea y FinProceso en la última.",
  },
  ProcesoDuplicado: {
    message: "Solo puede haber un Proceso por programa (línea {line}).",
    explanation: "El Proceso es el lugar donde empieza tu programa, y solo hay uno.",
    suggestion: "Junta tus instrucciones en un solo Proceso, o convierte el otro en SubProceso.",
  },
  PasoCero: {
    message: "El Con Paso del Para no puede ser 0 (línea {line}).",
    explanation: "Con paso 0 la variable nunca cambia y el ciclo no termina.",
    suggestion: "Usa un paso como 1, 2 o -1.",
  },
  RaizNegativa: {
    message: "No se puede sacar {funcion} de {valor} (línea {line}).",
    explanation: "Esa operación no tiene resultado con ese número.",
    suggestion: "Revisa el valor que le pasas a {funcion}.",
  },
  Timeout: {
    message: "Tu programa tardó demasiado y lo detuve.",
    explanation: "Seguramente hay un ciclo que nunca termina.",
    suggestion: "Revisa la condición de tus ciclos.",
  },
};

export function fillTemplate(tpl: string, params: Record<string, string | number | undefined>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] === undefined ? "" : String(params[k])));
}

/** Default catalog rows for every pseudocode code (priority 500 so DB rows win). */
export function pseudoCatalogDefaults(): ErrorTranslationRow[] {
  return Object.entries(PSEUDO_ERRORS).map(([code, t]) => ({
    language: "pseudocode_es",
    error_type: code,
    pattern: null,
    message_es: t.message,
    explanation_es: t.explanation,
    suggestion_es: t.suggestion,
    priority: 500,
    enabled: true,
  }));
}
