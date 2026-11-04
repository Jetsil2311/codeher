"use server";
// Student server actions. Students never reach data directly: every call reads the
// signed session cookie, then goes through the service layer (brief section 8).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attempt } from "@/server/errors";
import { clientIp, clearSession, requireStudent, setSessionCookie, STUDENT_COOKIE } from "@/server/session";
import * as S from "@/server/services/student";

export async function signInAction(_prev: unknown, form: FormData): Promise<{ error?: string }> {
  const code = String(form.get("code") ?? "");
  const pin = String(form.get("pin") ?? "");
  if (!code.trim() || !/^\d{4}$/.test(pin)) return { error: "invalid" };
  const res = await S.signIn(code, pin, await clientIp());
  if (!res.ok) return { error: res.error };
  await setSessionCookie(STUDENT_COOKIE, res.token, res.hours);
  redirect("/app");
}

export async function signOutAction() {
  await clearSession(STUDENT_COOKIE);
  redirect("/entrar?salida=1");
}

const submitSchema = z.object({
  exerciseId: z.string().uuid(),
  submission: z.string().max(20000),
  passed: z.boolean(),
  results: z.unknown(),
  runtimeMs: z.number().int().nullable(),
  hintsUsed: z.number().int().min(0).max(50),
  errorType: z.string().max(80).nullable(),
});

export async function submitCodeAction(input: z.infer<typeof submitSchema>) {
  const s = await requireStudent();
  const data = submitSchema.parse(input);
  const res = await attempt(() => S.submitCode(s, data));
  revalidatePath("/app", "layout");
  return res;
}

export async function submitAnswerAction(exerciseId: string, answer: { choices?: number[]; text?: string }, hintsUsed: number) {
  const s = await requireStudent();
  const res = await attempt(() => S.submitAnswer(s, z.string().uuid().parse(exerciseId), answer, hintsUsed));
  revalidatePath("/app", "layout");
  return res;
}

export async function completeLessonAction(lessonId: string) {
  const s = await requireStudent();
  const res = await attempt(() => S.completeLesson(s, lessonId));
  revalidatePath("/app", "layout");
  return res;
}

export async function createProjectAction(input: { name: string; language: "python" | "pseudocode_es"; code: string; sourceLessonId: string | null }) {
  const s = await requireStudent();
  const res = await attempt(() => S.createProject(s, input.name, z.enum(["python", "pseudocode_es"]).parse(input.language), input.code ?? "", input.sourceLessonId));
  revalidatePath("/app/proyectos");
  return res;
}

export async function newBlankProjectAction(form: FormData) {
  const s = await requireStudent();
  const language = z.enum(["python", "pseudocode_es"]).parse(form.get("language"));
  const name = String(form.get("name") ?? "").trim() || "Mi proyecto";
  const starter = language === "python" ? "# Escribe tu programa aquí\nprint(\"¡Hola!\")\n" : 'Proceso MiProyecto\n    Escribir "¡Hola!";\nFinProceso\n';
  const id = await S.createProject(s, name, language, starter, null);
  redirect(`/app/proyectos/${id}`);
}

export async function saveProjectAction(id: string, code: string, snapshot: boolean) {
  const s = await requireStudent();
  return attempt(() => S.saveProject(s, id, code, snapshot));
}

export async function renameProjectAction(id: string, name: string) {
  const s = await requireStudent();
  const res = await attempt(() => S.renameProject(s, id, name));
  revalidatePath("/app/proyectos");
  return res;
}

export async function duplicateProjectAction(id: string) {
  const s = await requireStudent();
  const res = await attempt(() => S.duplicateProject(s, id));
  revalidatePath("/app/proyectos");
  return res;
}

export async function deleteProjectAction(id: string) {
  const s = await requireStudent();
  const res = await attempt(() => S.deleteProject(s, id));
  revalidatePath("/app/proyectos");
  return res;
}

export async function projectVersionAction(id: string, versionId: number) {
  const s = await requireStudent();
  return attempt(() => S.projectVersion(s, id, versionId));
}

export async function nominateProjectAction(id: string, title: string, blurb: string) {
  const s = await requireStudent();
  const res = await attempt(() => S.nominateProject(s, id, title, blurb));
  revalidatePath(`/app/proyectos/${id}`);
  return res;
}

export async function updateProfileAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireStudent();
  const res = await attempt(() => S.updateProfile(s, String(form.get("nickname") ?? ""), String(form.get("avatar") ?? "")));
  revalidatePath("/app", "layout");
  return res.ok ? { ok: true } : { error: res.error };
}

export async function changePinAction(_prev: unknown, form: FormData): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireStudent();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { error: "pin_mismatch" };
  if (!/^\d{4}$/.test(next)) return { error: "pin_format" };
  const res = await S.changePin(s, current, next);
  return res.ok ? { ok: true } : { error: res.error };
}
