import { BookOpen, ChartLineUp, Lightning, Student } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GroupManager } from "@/components/staff/GroupManager";
import { PageHead, Stat, monthName } from "@/components/staff/StaffUi";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Tag } from "@/components/ui";
import { groupDetail, groupRecreo } from "@/server/services/staff";
import { RecreoLibre } from "@/components/staff/RecreoLibre";
import { Panel } from "@/components/staff/StaffUi";
import { requireStaff } from "@/server/session";

export default async function Grupo({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireStaff();
  const g = await groupDetail(p, (await params).id);
  if (!g) notFound();
  const t = await getTranslations("staff.group");
  const tc = await getTranslations("common");
  const tr = await getTranslations("staff.recreoLibre");
  const recreoRows = await groupRecreo(p, g.id);
  return (
    <>
      <PageHead
        back={{ href: "/equipo/grupos", label: t("back") }}
        title={<span className="font-mono">{g.prefix}</span>}
        subtitle={<>{monthName(g.month)} {g.year} · {g.community}{g.label ? ` · ${g.label}` : ""} {g.status === "closed" ? <Tag tone="line" className="ml-2">{t("closedTag")}</Tag> : null}</>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat label={t("students")} value={g.students} tone="ink" icon={<Student size={19} weight="fill" aria-hidden />} />
        <Stat label={t("activeStudents")} value={g.active_students} icon={<Lightning size={19} weight="fill" aria-hidden />} />
        <Stat label={t("lessons")} value={g.lessons_total} icon={<BookOpen size={19} weight="fill" aria-hidden />} />
        <Stat label={t("avgCompleted")} value={g.avg_completed} tone="violet" icon={<ChartLineUp size={19} weight="fill" aria-hidden />} />
      </div>
      <p className="mb-4 text-sm text-ink-muted">{t("educators")}: {g.educators.map((e) => e.name).join(", ") || "·"}</p>
      <Panel className="mb-6" title={<span className="inline-flex items-center gap-2"><Sparkle size={20} weight="fill" className="text-pink-700" aria-hidden /> {tr("title")}</span>}>
        <p className="-mt-2 mb-4 text-sm text-ink-muted">{tr("body")}</p>
        <RecreoLibre rows={recreoRows} labels={Object.fromEntries(["grant","grantFinished","grantAll","stop","stopAll","finished","lessons","freeLeft","playing","granted","stopped","error","empty"].map((k) => [k, (tr.raw as unknown as (k: string) => string)(k)]))} />
      </Panel>
      <GroupManager g={g} never={tc("never")} />
    </>
  );
}
