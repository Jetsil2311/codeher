// Single source of truth for limits and product rules (tech spec 6.10, design brief 4.4).

export const PSEUDO_LIMITS = {
  maxSteps: 1_000_000,
  maxCallDepth: 200,
  maxArraySize: 100_000,
  maxOutputChars: 20_000,
  maxTraceEvents: 10_000,
  traceArrayPreview: 100,
} as const;

/** Decision 8 (brief) / 12 (spec): pseudocode arrays start at position 1. */
export const PSEUDO_ARRAY_BASE = 1;

export const PYTHON_LIMITS = {
  maxOutputChars: 20_000,
} as const;

/** Pinned Pyodide version, loaded lazily from the CDN only for Python lessons. */
export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export const SUBMISSION_MAX_CHARS = 20_000;
export const CONTENT_MD_MAX_CHARS = 50_000;
export const MAX_TESTS_PER_EXERCISE = 30;
export const MAX_SLIDES_PER_DECK = 40;

export const DEFAULT_EXERCISE_XP = 10;
export const DEFAULT_LESSON_XP = 20;

/** Student access rules (brief 4.4). Mirrored in the database functions. */
export const LOCKOUT = {
  softLockAfter: 5,
  softLockMinutes: 15,
  hardLockAfter: 10,
} as const;

export const DEFAULT_SESSION_HOURS = 12;
export const PROJECT_VERSIONS_KEPT = 10;
export const TIME_ZONE = "America/Mexico_City";
export const LOCALE = "es-MX";
