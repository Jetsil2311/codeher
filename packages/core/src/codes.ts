// Student codes and PINs (design brief section 4).
// Format: YYMM + optional group letter + two-digit student number (three when > 99).
// Example: 2809B07 = student 7 of the second group of September 2028.

export interface CodeParts {
  year: number; // full year, e.g. 2028
  month: number; // 1-12
  letter: string | null; // null for the first group of the month
  number: number;
}

export function groupPrefix(year: number, month: number, letter: string | null): string {
  const yy = String(year % 100).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${yy}${mm}${letter ? letter.toUpperCase() : ""}`;
}

export function buildStudentCode(parts: CodeParts): string {
  const width = parts.number > 99 ? 3 : 2;
  return `${groupPrefix(parts.year, parts.month, parts.letter)}${String(parts.number).padStart(width, "0")}`;
}

/** Codes are case-insensitive: normalize before any comparison or lookup. */
export function normalizeCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

const CODE_RE = /^(\d{2})(\d{2})([A-Z]?)(\d{2,3})$/;

export function parseStudentCode(raw: string, century = 2000): CodeParts | null {
  const m = CODE_RE.exec(normalizeCode(raw));
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return {
    year: century + Number(m[1]),
    month,
    letter: m[3] || null,
    number: Number(m[4]),
  };
}

export function looksLikeStudentCode(raw: string): boolean {
  return parseStudentCode(raw) !== null;
}

/**
 * Group letter rule (decision 1): the first group of a month has no letter,
 * the next gets B, then C... `taken` holds letters already used that month,
 * with "" standing for the letterless first group.
 */
export function nextGroupLetter(taken: Array<string | null>): string | null {
  const used = new Set(taken.map((l) => (l ?? "").toUpperCase()));
  if (!used.has("")) return null;
  for (let c = "B".charCodeAt(0); c <= "Z".charCodeAt(0); c++) {
    const letter = String.fromCharCode(c);
    if (!used.has(letter)) return letter;
  }
  throw new Error("group_letters_exhausted");
}

/** Trivial PINs: all equal digits, ascending or descending runs, and a few classics. */
export function isTrivialPin(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return true;
  const d = pin.split("").map(Number);
  if (d.every((x) => x === d[0])) return true;
  const asc = d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10);
  const desc = d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10);
  if (asc || desc) return true;
  // Pairs like 1212, 2020 and the very common birthday-ish 1990-2029 years.
  if (pin.slice(0, 2) === pin.slice(2)) return true;
  if (d[0] === d[1] && d[2] === d[3]) return true;
  const n = Number(pin);
  if (n >= 1950 && n <= 2035) return true;
  return false;
}

function randomInt(max: number): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % max;
}

export function generatePin(): string {
  for (;;) {
    const pin = String(randomInt(10_000)).padStart(4, "0");
    if (!isTrivialPin(pin)) return pin;
  }
}

/** Split a pasted list into clean nicknames (one per line), dropping empties. */
export function parseNameList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0)
    .map((s) => s.slice(0, 40));
}
