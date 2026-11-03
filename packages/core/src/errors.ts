// Friendly error translation (tech spec 6.6).
// The catalog is data (error_translations rows). This module picks the best
// row for a raw error and fills its placeholders.

import type { CodeLanguage, ErrorTranslationRow, FriendlyError, RawError } from "./types";

function fill(template: string, values: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    return v === undefined || v === null ? `{${key}}` : String(v);
  });
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

export interface TranslateOptions {
  language: CodeLanguage;
  fallback: { title: string; explanation: string; suggestion: string };
}

export function translateError(
  raw: RawError,
  catalog: ErrorTranslationRow[],
  opts: TranslateOptions,
): FriendlyError {
  const candidates = catalog
    .filter((r) => r.enabled !== false)
    .filter((r) => r.language === null || r.language === opts.language)
    .filter((r) => r.error_type === raw.type || r.error_type === "*")
    .sort((a, b) => a.priority - b.priority);

  for (const row of candidates) {
    let groups: Record<string, string> = {};
    if (row.pattern) {
      const re = safeRegex(row.pattern);
      if (!re) continue;
      const m = re.exec(raw.message);
      if (!m) continue;
      groups = { ...(m.groups ?? {}) };
    }
    const values = {
      line: raw.line ?? "?",
      message: raw.message,
      ...(raw.params ?? {}),
      ...groups,
    };
    return {
      title: fill(row.message_es, values),
      explanation: fill(row.explanation_es, values),
      suggestion: fill(row.suggestion_es, values),
      original: raw.message,
      line: raw.line,
    };
  }

  const values = { line: raw.line ?? "?", message: raw.message, ...(raw.params ?? {}) };
  return {
    title: fill(opts.fallback.title, values),
    explanation: fill(opts.fallback.explanation, values),
    suggestion: fill(opts.fallback.suggestion, values),
    original: raw.message,
    line: raw.line,
  };
}

/** Test a single catalog pattern against a pasted raw error (catalog editor). */
export function testPattern(
  row: ErrorTranslationRow,
  raw: RawError,
): { matched: boolean; result?: FriendlyError } {
  const result = translateError(raw, [{ ...row, enabled: true, language: null }], {
    language: "python",
    fallback: { title: "", explanation: "", suggestion: "" },
  });
  return { matched: result.title !== "", result: result.title ? result : undefined };
}
