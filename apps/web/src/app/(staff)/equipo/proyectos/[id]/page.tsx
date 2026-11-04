import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Playground } from "@/components/code/Playground";
import { PageHead, Panel } from "@/components/staff/StaffUi";
import { staffProject } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function StaffProyecto({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireStaff();
  const pr = await staffProject(p, (await params).id);
  if (!pr) notFound();
  const t = await getTranslations("staff.student");
  return (
    <>
      <PageHead back={{ href: `/equipo/estudiantes/${pr.student.id}`, label: pr.student.nickname }} title={pr.name} subtitle={t("readOnlyProject")} />
      <Panel><Playground language={pr.language} code={pr.code} readOnly minHeight={320} /></Panel>
    </>
  );
}
