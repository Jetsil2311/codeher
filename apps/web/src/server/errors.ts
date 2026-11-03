// Stable English machine codes (tech spec section 2). The client maps each to Spanish
// through messages/es/errors.json. Raw English never reaches users.
export class AppError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function attempt<T>(fn: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.code };
    console.error("[codeher] unexpected error", e);
    return { ok: false, error: "unexpected" };
  }
}
