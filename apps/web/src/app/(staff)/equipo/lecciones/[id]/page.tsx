import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LessonEditor } from "@/components/staff/LessonEditor";
import { PageHead } from "@/components/staff/StaffUi";
import { CONSTRUCT_NAMES } from "@codeher/grader/pseudo";
import { lessonForEdit } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function EditarLeccion({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireStaff();
  const data = await lessonForEdit(p, (await params).id);
  if (!data) notFound();
  const t = await getTranslations("staff.editor");
  return (
    <>
      <PageHead back={{ href: "/equipo/lecciones", label: t("back") }} title={data.lesson.title} subtitle={<span className="font-mono">{data.lesson.slug}</span>} />
      <LessonEditor data={JSON.parse(JSON.stringify(data))} founder={p.role === "founder"} pseudoConstructs={CONSTRUCT_NAMES} />
    </>
  );
}
