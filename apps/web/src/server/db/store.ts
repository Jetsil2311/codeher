import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Db } from "./types";
import { buildSeed } from "./seed";

// Local data adapter (DATA_MODE=local): one JSON file, read once, written atomically.
// Same shapes as the Postgres tables, so the Supabase adapter is a drop-in later.
const FILE = process.env.CODEHER_DATA_FILE ?? join(process.cwd(), ".data", "codeher.json");
const DB_VERSION = 1;

type Holder = { db: Db | null };
const g = globalThis as unknown as { __codeherDb?: Holder };
const holder: Holder = (g.__codeherDb ??= { db: null });

function load(): Db {
  if (holder.db) return holder.db;
  if (existsSync(FILE)) {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Db;
    if (parsed.version === DB_VERSION) {
      holder.db = parsed;
      return parsed;
    }
  }
  const fresh = buildSeed();
  fresh.version = DB_VERSION;
  holder.db = fresh;
  persist();
  return fresh;
}

function persist() {
  if (!holder.db) return;
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(holder.db));
  renameSync(tmp, FILE);
}

/** Read-only access. */
export function read<T>(fn: (db: Db) => T): T {
  return fn(load());
}

/** Mutation: runs synchronously (single process), then persists. Throwing rolls back. */
export function write<T>(fn: (db: Db) => T): T {
  const db = load();
  const snapshot = JSON.stringify(db);
  try {
    const out = fn(db);
    persist();
    return out;
  } catch (e) {
    holder.db = JSON.parse(snapshot) as Db;
    throw e;
  }
}

export function nextSeq(db: Db): number {
  db.seq += 1;
  return db.seq;
}

export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();
