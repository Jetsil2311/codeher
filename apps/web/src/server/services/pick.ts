import "server-only";
import { SUPABASE } from "../supabase";

/** One service entry point, two backends: the local JSON store or Supabase (DATA_MODE). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pick<F extends (...a: any[]) => any>(local: F, remote: (...a: Parameters<F>) => Promise<unknown>) {
  return async (...a: Parameters<F>): Promise<Awaited<ReturnType<F>>> =>
    (SUPABASE ? await remote(...a) : await local(...a)) as Awaited<ReturnType<F>>;
}
