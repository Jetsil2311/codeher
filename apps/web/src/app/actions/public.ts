"use server";
import { z } from "zod";
import { attempt } from "@/server/errors";
import { checkPublicAnswer } from "@/server/services/public";

export async function checkPublicAnswerAction(exerciseId: string, answer: { choices?: number[]; text?: string }) {
  return attempt(() => ({ ...checkPublicAnswer(z.string().uuid().parse(exerciseId), answer), xp_awarded: 0, lesson_completed: false, lesson_xp: 0, xp: 0, streak: 0 }));
}

export async function contactAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const schema = z.object({
    name: z.string().trim().min(2).max(80),
    community: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(120),
    message: z.string().trim().min(10).max(1200),
  });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "contact_invalid" };
  // Local mode: requests are logged for the founders; production sends an email.
  const { write, now, nextSeq } = await import("@/server/db/store");
  write((db) => {
    db.access_log.push({ id: nextSeq(db), actor_kind: "system", actor_id: null, action: "contact_request", entity_type: "contact", entity_id: null, payload: parsed.data, created_at: now() });
  });
  return { ok: true };
}
