import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GroupManager } from "@/components/staff/GroupManager";
import { PageHead, Stat, monthName } from "@/components/staff/StaffUi";
import { Tag } from "@/components/ui";
import { groupDetail } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function Grupo({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireStaff();
  const g = groupDetail(p, (await params).id);
  if (!g) notFound();
  const t = await getTranslations("staff.group");
  const tc = await getTranslations("common");
  return (
    <>
      <PageHead
        back={{ href: "/equipo/grupos", label: t("back") }}
        title={<span className="font-mono">{g.prefix}</span>}
        subtitle={<>{monthName(g.month)} {g.year} · {g.community}{g.label ? ` · ${g.label}` : ""} {g.status === "closed" ? <Tag tone="line" className="ml-2">{t("closedTag")}</Tag> : null}</>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label={t("students")} value={g.students} tone="ink" />
        <Stat label={t("activeStudents")} value={g.active_students} />
        <Stat label={t("lessons")} value={g.lessons_total} />
        <Stat label={t("avgCompleted")} value={g.avg_completed} tone="violet" />
      </div>
      <p className="mb-4 text-sm text-ink-muted">{t("educators")}: {g.educators.map((e) => e.name).join(", ") || "·"}</p>
      <GroupManager g={g} never={tc("never")} />
    </>
  );
}
