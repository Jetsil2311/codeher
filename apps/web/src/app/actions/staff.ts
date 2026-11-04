"use server";
// Educator and founder server actions. Every action re-reads the staff session and the
// service layer enforces educator isolation (only assigned groups) and founder-only rules.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exerciseBundleSchema, parseNameList, slideDeckV1Schema } from "@codeher/core";
import { attempt } from "@/server/errors";
import { clearSession, requireFounder, requireStaff, setSessionCookie, STAFF_COOKIE } from "@/server/session";
import * as T from "@/server/services/staff";

export async function staffSignInAction(_prev: unknown, form: FormData): Promise<{ error?: string }> {
  const res = await T.staffSignIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!res.ok) return { error: res.error };
  // Supabase Auth already set its own cookies; local mode signs our own.
  if (res.token) await setSessionCookie(STAFF_COOKIE, res.token, 12);
  redirect("/equipo/panel");
}

export async function staffRegisterAction(_prev: unknown, form: FormData): Promise<{ error?: string; role?: string; confirm?: boolean }> {
  const res = await attempt(() => T.staffRegister(String(form.get("name") ?? ""), String(form.get("email") ?? ""), String(form.get("password") ?? "")));
  if (!res.ok) return { error: res.error };
  // Supabase Auth sends a confirmation email before the first sign-in.
  return { role: res.data.role, confirm: process.env.DATA_MODE === "supabase" };
}

export async function staffGoogleAction() {
  redirect(await T.googleSignInUrl());
}

export async function staffSignOutAction() {
  await clearSession(STAFF_COOKIE);
  redirect("/equipo");
}

// ---------- Groups ----------
const studentListSchema = z.array(z.object({ nickname: z.string().trim().min(1).max(40), pin: z.string().regex(/^\d{4}$/).optional() })).min(1).max(300);

export async function suggestGroupAction(year: number, month: number) {
  const p = await requireStaff();
  return await T.suggestGroup(p, year, month);
}

export async function previewGroupAction(input: { year: number; month: number; letter: string | null; names: string }) {
  await requireStaff();
  const names = parseNameList(input.names);
  return await T.previewCodes(input.year, input.month, input.letter ? input.letter.toUpperCase() : null, names);
}

export async function createGroupAction(input: { year: number; month: number; letter: string | null; communityId: string; endsOn: string | null; label: string; students: { nickname: string; pin?: string }[] }) {
  const p = await requireStaff();
  const res = await attempt(() => T.createGroup(p, { ...input, students: studentListSchema.parse(input.students) }));
  revalidatePath("/equipo", "layout");
  return res;
}

export async function addStudentsAction(groupId: string, names: string) {
  const p = await requireStaff();
  const list = parseNameList(names).map((nickname) => ({ nickname }));
  const res = await attempt(() => T.addStudents(p, groupId, studentListSchema.parse(list)));
  revalidatePath(`/equipo/grupos/${groupId}`);
  return res;
}

export async function resetPinAction(studentId: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.resetPin(p, studentId));
  revalidatePath("/equipo", "layout");
  return res;
}

export async function unlockStudentAction(studentId: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.unlockStudent(p, studentId));
  revalidatePath("/equipo", "layout");
  return res;
}

export async function setStudentsStatusAction(ids: string[], status: "active" | "inactive") {
  const p = await requireStaff();
  const res = await attempt(() => T.setStudentsStatus(p, z.array(z.string().uuid()).parse(ids), status));
  revalidatePath("/equipo", "layout");
  return res;
}

export async function setGroupStatusAction(groupId: string, status: "active" | "closed") {
  const p = await requireStaff();
  const res = await attempt(() => T.setGroupStatus(p, groupId, status));
  revalidatePath("/equipo", "layout");
  return res;
}

export async function updateGroupAction(groupId: string, label: string, endsOn: string | null) {
  const p = await requireStaff();
  const res = await attempt(() => T.updateGroup(p, groupId, label, endsOn));
  revalidatePath(`/equipo/grupos/${groupId}`);
  return res;
}

export async function assignCourseAction(groupId: string, courseId: string, assign: boolean) {
  const p = await requireStaff();
  const res = await attempt(() => T.assignCourse(p, groupId, courseId, assign));
  revalidatePath(`/equipo/grupos/${groupId}`);
  return res;
}

export async function recordConsentAction(studentId: string, consent: boolean, reference: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.recordConsent(p, studentId, consent, reference));
  revalidatePath(`/equipo/estudiantes/${studentId}`);
  return res;
}

export async function addNoteAction(studentId: string, body: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.addNote(p, studentId, body));
  revalidatePath(`/equipo/estudiantes/${studentId}`);
  return res;
}

export async function exportStudentAction(studentId: string) {
  const p = await requireStaff();
  return attempt(() => T.exportStudent(p, studentId));
}

export async function deleteStudentAction(studentId: string, confirm: string, groupId: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.deleteStudent(p, studentId, confirm));
  if (res.ok) {
    revalidatePath("/equipo", "layout");
    redirect(`/equipo/grupos/${groupId}`);
  }
  return res;
}

// ---------- Logros ----------
const kindSchema = z.enum(["project", "first_program", "first_website", "community_presentation", "milestone"]);

export async function nominateAction(input: { studentId: string; projectId: string | null; kind: string; title: string; blurb: string; tags: string[] }) {
  const p = await requireStaff();
  const res = await attempt(() => T.nominate(p, { ...input, kind: kindSchema.parse(input.kind) }));
  revalidatePath("/equipo", "layout");
  return res;
}

export async function updateNominationAction(id: string, input: { title: string; blurb: string; tags: string[]; kind: string }) {
  const p = await requireStaff();
  const res = await attempt(() => T.updateNomination(p, id, { ...input, kind: kindSchema.parse(input.kind) }));
  revalidatePath("/equipo", "layout");
  return res;
}

export async function reviewLogroAction(id: string, action: "approve" | "publish" | "unpublish" | "reject" | "feature" | "unfeature" | "delete") {
  const p = await requireFounder();
  const res = await attempt(() => T.reviewLogro(p, id, action));
  revalidatePath("/", "layout");
  return res;
}

// ---------- Founders ----------
export async function inviteAction(email: string, role: "educator" | "founder") {
  const p = await requireFounder();
  const res = await attempt(() => T.invite(p, email, role));
  revalidatePath("/equipo/global/educadores");
  return res;
}

export async function setStaffAction(profileId: string, role: "pending" | "educator" | "founder", active: boolean, confirm = "") {
  const p = await requireFounder();
  const res = await attempt(() => T.setStaff(p, profileId, role, active, confirm));
  revalidatePath("/equipo/global/educadores");
  return res;
}

export async function assignGroupAction(educatorId: string, groupId: string, assign: boolean) {
  const p = await requireFounder();
  const res = await attempt(() => T.assignGroup(p, educatorId, groupId, assign));
  revalidatePath("/equipo", "layout");
  return res;
}

export async function reassignGroupsAction(from: string, to: string) {
  const p = await requireFounder();
  const res = await attempt(() => T.reassignGroups(p, from, to));
  revalidatePath("/equipo", "layout");
  return res;
}

const settingsSchema = z.object({
  session_hours: z.number().int().min(1).max(72),
  lockout: z.object({ soft_after: z.number().int().min(2).max(20), soft_minutes: z.number().int().min(1).max(240), hard_after: z.number().int().min(3).max(50) }),
  group_letter_rule: z.object({ first_without_letter: z.boolean() }),
  consent_text: z.string().min(10).max(4000),
  contact_email: z.string().email(),
  team: z.array(z.object({ name: z.string().min(1).max(80), role: z.string().max(80), bio: z.string().max(400) })).max(12),
  social: z.array(z.object({ label: z.string().max(40), url: z.string().url() })).max(8),
});

export async function updateSettingsAction(patch: unknown) {
  const p = await requireFounder();
  const res = await attempt(() => T.updateSettings(p, settingsSchema.partial().parse(patch)));
  revalidatePath("/", "layout");
  return res;
}

export async function upsertCommunityAction(input: { id?: string; name: string; since_year: number | null; active: boolean }) {
  const p = await requireFounder();
  const res = await attempt(() => T.upsertCommunity(p, input));
  revalidatePath("/", "layout");
  return res;
}

export async function searchAction(q: string) {
  const p = await requireFounder();
  return await T.search(p, q);
}

// ---------- Authoring ----------
export async function createLessonAction(input: { title: string; slug: string; language: "python" | "pseudocode_es"; visibility: "public" | "program" | "draft"; module_id: string | null }) {
  const p = await requireStaff();
  const res = await attempt(() => T.createLesson(p, input));
  if (res.ok) redirect(`/equipo/lecciones/${res.data}`);
  return res;
}

export async function updateLessonAction(id: string, patch: Record<string, unknown>, expectedVersion?: number) {
  const p = await requireStaff();
  const schema = z.object({
    title: z.string().min(1).max(160),
    summary: z.string().max(400),
    content_md: z.string().max(50000),
    visibility: z.enum(["public", "program", "draft"]),
    pair_lesson_id: z.string().uuid().nullable(),
    estimated_minutes: z.number().int().min(1).max(240),
    xp_reward: z.number().int().min(0).max(1000),
    module_id: z.string().uuid().nullable(),
    language: z.enum(["python", "pseudocode_es"]),
  }).partial();
  const res = await attempt(() => T.updateLesson(p, id, schema.parse(patch), expectedVersion));
  revalidatePath(`/equipo/lecciones/${id}`);
  return res;
}

export async function setLessonStatusAction(id: string, status: "draft" | "review" | "published" | "archived") {
  const p = await requireStaff();
  const res = await attempt(() => T.setLessonStatus(p, id, status));
  revalidatePath("/", "layout");
  return res;
}

export async function saveExerciseAction(lessonId: string, bundle: unknown, validated: { ok: boolean; fingerprint: string | null }, id?: string) {
  const p = await requireStaff();
  const parsed = exerciseBundleSchema.parse({ ...(bundle as object), lesson_id: lessonId });
  const res = await attempt(() =>
    T.saveExercise(p, lessonId, {
      id,
      slug: parsed.slug,
      type: parsed.type,
      title: parsed.title,
      instructions_md: parsed.instructions_md,
      starter_code: parsed.starter_code,
      config: parsed.config,
      xp_reward: parsed.xp_reward ?? 10,
      required: parsed.required ?? true,
      timeout_ms: parsed.timeout_ms ?? 5000,
      tests: parsed.tests.map((t) => ({ id: crypto.randomUUID(), kind: t.kind, description: t.description, spec: t.spec as Record<string, unknown>, hidden: !!t.hidden })),
      hints: parsed.hints,
      solution: { solution_code: parsed.solution?.solution_code ?? "", answer: parsed.solution?.answer ?? null, explanation_md: parsed.solution?.explanation_md ?? "", known_wrong_solutions: parsed.known_wrong_solutions, validated_at: null, validated_fingerprint: null },
      validated: validated.ok,
      fingerprint: validated.fingerprint,
    }),
  );
  revalidatePath(`/equipo/lecciones/${lessonId}`);
  return res;
}

export async function deleteExerciseAction(lessonId: string, exerciseId: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.deleteExercise(p, lessonId, exerciseId));
  revalidatePath(`/equipo/lecciones/${lessonId}`);
  return res;
}

export async function reorderExercisesAction(lessonId: string, ids: string[]) {
  const p = await requireStaff();
  const res = await attempt(() => T.reorderExercises(p, lessonId, ids));
  revalidatePath(`/equipo/lecciones/${lessonId}`);
  return res;
}

export async function duplicateLessonAction(id: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.duplicateLesson(p, id));
  if (res.ok) redirect(`/equipo/lecciones/${res.data}`);
  return res;
}

export async function saveDeckAction(lessonId: string, title: string, json: string, status: "draft" | "published") {
  const p = await requireStaff();
  return attempt(async () => {
    const deck = slideDeckV1Schema.parse(JSON.parse(json));
    await T.saveDeck(p, lessonId, title, deck, status);
    revalidatePath(`/equipo/lecciones/${lessonId}`);
  });
}

export async function exportCourseAction(courseId: string) {
  await requireStaff();
  return attempt(() => T.exportCourse(courseId));
}

export async function saveErrorRowAction(row: { id?: string; language: "python" | "pseudocode_es" | null; error_type: string; pattern: string | null; message_es: string; explanation_es: string; suggestion_es: string; priority: number; enabled: boolean }) {
  const p = await requireStaff();
  const res = await attempt(() => T.saveErrorRow(p, row));
  revalidatePath("/equipo/errores");
  return res;
}

export async function createApiKeyAction(name: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.createApiKey(p, name));
  revalidatePath("/equipo/claves");
  return res;
}

export async function revokeApiKeyAction(id: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.revokeApiKey(p, id));
  revalidatePath("/equipo/claves");
  return res;
}

export async function setGroupRecreoAction(groupId: string, enabled: boolean) {
  const p = await requireStaff();
  const res = await attempt(() => T.setGroupRecreo(p, z.string().uuid().parse(groupId), enabled));
  revalidatePath(`/equipo/grupos/${groupId}`);
  return res;
}

export async function recreoFreeAction(studentIds: string[], minutes: number, path?: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.recreoFree(p, z.array(z.string().uuid()).min(1).max(300).parse(studentIds), z.number().int().min(0).max(120).parse(minutes)));
  if (path) revalidatePath(path);
  return res;
}

// ---------- Courses and modules ----------
const statusSchema = z.enum(["draft", "review", "published", "archived"]);
const uuid = z.string().uuid();
const refreshCourses = (courseId?: string) => {
  revalidatePath("/equipo", "layout");
  if (courseId) revalidatePath(`/equipo/cursos/${courseId}`);
};

export async function saveCourseAction(input: { id?: string; slug: string; title: string; description: string; firstModule?: string }) {
  const p = await requireStaff();
  const data = z.object({ id: uuid.optional(), slug: z.string().trim().max(60), title: z.string().trim().max(120), description: z.string().max(600), firstModule: z.string().max(120).optional() }).parse(input);
  const res = await attempt(() => T.saveCourse(p, data));
  refreshCourses(data.id);
  if (res.ok && !data.id) redirect(`/equipo/cursos/${res.data}`);
  return res;
}

export async function setCourseStatusAction(id: string, status: "draft" | "review" | "published" | "archived") {
  const p = await requireStaff();
  const res = await attempt(() => T.setCourseStatus(p, uuid.parse(id), statusSchema.parse(status)));
  revalidatePath("/", "layout");
  return res;
}

export async function setModuleStatusAction(courseId: string, id: string, status: "draft" | "review" | "published" | "archived") {
  const p = await requireStaff();
  const res = await attempt(() => T.setModuleStatus(p, uuid.parse(id), statusSchema.parse(status)));
  revalidatePath("/", "layout");
  refreshCourses(courseId);
  return res;
}

export async function deleteCourseAction(id: string, confirm: string, deleteLessons: boolean) {
  const p = await requireStaff();
  const res = await attempt(() => T.deleteCourse(p, uuid.parse(id), confirm, !!deleteLessons));
  revalidatePath("/", "layout");
  if (res.ok) redirect("/equipo/cursos");
  return res;
}

export async function saveModuleAction(courseId: string, input: { id?: string; title: string }) {
  const p = await requireStaff();
  const res = await attempt(() => T.saveModule(p, { id: input.id ? uuid.parse(input.id) : undefined, courseId: uuid.parse(courseId), title: z.string().max(120).parse(input.title) }));
  refreshCourses(courseId);
  return res;
}

export async function deleteModuleAction(courseId: string, id: string, deleteLessons: boolean) {
  const p = await requireStaff();
  const res = await attempt(() => T.deleteModule(p, uuid.parse(id), !!deleteLessons));
  revalidatePath("/", "layout");
  refreshCourses(courseId);
  return res;
}

export async function reorderModulesAction(courseId: string, ids: string[]) {
  const p = await requireStaff();
  const res = await attempt(() => T.reorderModules(p, uuid.parse(courseId), z.array(uuid).max(200).parse(ids)));
  revalidatePath("/", "layout");
  return res;
}

export async function reorderLessonsAction(courseId: string, moduleId: string, ids: string[]) {
  const p = await requireStaff();
  const res = await attempt(() => T.reorderLessons(p, uuid.parse(moduleId), z.array(uuid).max(500).parse(ids)));
  revalidatePath("/", "layout");
  refreshCourses(courseId);
  return res;
}

export async function moveLessonAction(courseId: string, lessonId: string, moduleId: string | null) {
  const p = await requireStaff();
  const res = await attempt(() => T.moveLesson(p, uuid.parse(lessonId), moduleId ? uuid.parse(moduleId) : null));
  revalidatePath("/", "layout");
  refreshCourses(courseId);
  return res;
}

/** Quick lesson from the course builder: stays on the course page (no redirect). */
export async function createCourseLessonAction(courseId: string, moduleId: string, title: string, language: "python" | "pseudocode_es") {
  const p = await requireStaff();
  const name = z.string().trim().min(1).max(160).parse(title);
  const base = T.slugify(name) || "leccion";
  let res = await attempt(() => T.createLesson(p, { title: name, slug: base, language: z.enum(["python", "pseudocode_es"]).parse(language), visibility: "program", module_id: uuid.parse(moduleId) }));
  for (let i = 2; !res.ok && res.error === "already_exists" && i < 12; i++) {
    const slug = `${base.slice(0, 55)}-${i}`;
    res = await attempt(() => T.createLesson(p, { title: name, slug, language, visibility: "program", module_id: moduleId }));
  }
  refreshCourses(courseId);
  return res;
}

export async function deleteLessonAction(id: string, confirm: string, back?: string) {
  const p = await requireStaff();
  const res = await attempt(() => T.deleteLesson(p, uuid.parse(id), confirm));
  revalidatePath("/", "layout");
  if (res.ok) redirect(back && /^\/equipo\/[a-z0-9/-]+$/.test(back) ? back : "/equipo/lecciones");
  return res;
}
