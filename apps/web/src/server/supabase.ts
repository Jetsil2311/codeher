import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "./errors";

// DATA_MODE=supabase: three clients, each with the least privilege it needs.
// - staffClient: the signed-in staff member (Supabase Auth cookies). RLS and auth.uid() apply.
// - anonClient: no user. Public reads and the student functions, which authenticate
//   with the student session token (SECURITY DEFINER, tech spec 5).
// - adminClient: the secret key. Server-only, for the few tasks no user can do
//   (API key lookups for the MCP server, system jobs). Never sent to the browser.
export const SUPABASE = process.env.DATA_MODE === "supabase";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishable = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export async function staffClient(): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(url(), publishable(), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

let anon: SupabaseClient | null = null;
export function anonClient(): SupabaseClient {
  return (anon ??= createClient(url(), publishable(), { auth: { persistSession: false, autoRefreshToken: false } }));
}

let admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return (admin ??= createClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

/** Postgres raises stable English codes (raise exception 'forbidden'); surface them as AppError. */
const KNOWN = /^[a-z][a-z0-9_]{2,60}$/;
export function fail(error: { message?: string; code?: string } | null): never {
  const msg = error?.message ?? "unexpected";
  if (KNOWN.test(msg)) throw new AppError(msg);
  if (error?.code === "42501") throw new AppError("forbidden");
  console.error("[codeher] supabase error", error);
  throw new AppError("unexpected");
}

export async function rpc<T = unknown>(client: SupabaseClient | Promise<SupabaseClient>, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const c = await client;
  const { data, error } = await c.rpc(fn, args);
  if (error) fail(error);
  return data as T;
}
