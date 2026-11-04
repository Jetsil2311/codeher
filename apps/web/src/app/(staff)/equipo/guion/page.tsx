import { getTranslations } from "next-intl/server";
import { ChalkboardTeacher, DeviceMobile, HandSwipeRight, SunDim } from "@phosphor-icons/react/dist/ssr";
import { PageHead } from "@/components/staff/StaffUi";
import { ScriptPicker } from "@/components/staff/ScriptPicker";
import { lessonLibrary } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export async function generateMetadata() {
  return { title: (await getTranslations("staff.script"))("title") };
}

export default async function GuionIndex() {
  const p = await requireStaff();
  const lib = await lessonLibrary(p);
  const t = await getTranslations("staff.script");
  const tl = await getTranslations("learn.language");
  const visible = lib.lessons.filter((l) => l.status === "published" || l.editable);
  const order = [...new Set(visible.map((l) => l.course ?? ""))];
  const groups = order.map((course) => ({ course: course || t("public"), lessons: visible.filter((l) => (l.course ?? "") === course).map((l) => ({ id: l.id, title: l.title, language: l.language, exercises: l.exercises, draft: l.status !== "published", languageLabel: tl(l.language) })) }));
  return (
    <>
      <PageHead title={<span className="inline-flex items-center gap-3"><ChalkboardTeacher size={34} weight="duotone" className="text-violet-700" aria-hidden /> {t("title")}</span>} subtitle={t("subtitle")} />
      <ul className="mb-8 grid gap-2 sm:grid-cols-3">
        {[{ Icon: HandSwipeRight, text: t("how1") }, { Icon: DeviceMobile, text: t("how2") }, { Icon: SunDim, text: t("how3") }].map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-ink/[0.06]">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Icon size={20} weight="duotone" aria-hidden /></span> {text}
          </li>
        ))}
      </ul>
      <ScriptPicker groups={groups} labels={{ continue: t("continue"), open: t("open"), draft: t("draft"), empty: t("empty"), lessonN: t.raw("lessonN") as string, exercisesN: t.raw("exercisesN") as string }} />
    </>
  );
}
