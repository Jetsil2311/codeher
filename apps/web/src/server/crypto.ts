import "server-only";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** scrypt hash for PINs and local staff passwords (Postgres uses bcrypt via pgcrypto). */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(secret, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$${salt}$${key}`;
}

export function verifySecret(secret: string, stored: string): boolean {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const candidate = scryptSync(secret, salt, 32, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(key, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ chars)");
    return "codeher-local-development-session-secret-not-for-production";
  }
  return s;
}

/** Signed cookie value: token.signature (HMAC-SHA256). */
export function sign(value: string): string {
  const sig = createHmac("sha256", secret()).update(value).digest("base64url");
  return `${value}.${sig}`;
}

export function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value).slice(i + 1));
  const got = Buffer.from(signed.slice(i + 1));
  return expected.length === got.length && timingSafeEqual(expected, got) ? value : null;
}
