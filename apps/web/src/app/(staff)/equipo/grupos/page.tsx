import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { PageHead, Panel, TableWrap, monthName, td, th } from "@/components/staff/StaffUi";
import { ButtonLink, EmptyState, Progress, Tag } from "@/components/ui";
import { listGroups } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function Grupos() {
  const p = await requireStaff();
  const groups = listGroups(p);
  const t = await getTranslations("staff.groups");
  return (
    <>
      <PageHead title={t("title")} subtitle={p.role === "founder" ? t("subtitleFounder") : t("subtitle")} actions={<ButtonLink href="/equipo/grupos/nuevo" variant="violet"><Plus size={18} weight="bold" aria-hidden /> {t("new")}</ButtonLink>} />
      <Panel>
        {groups.length === 0 ? <EmptyState title={t("empty")} body={t("emptyBody")} /> : (
          <TableWrap label={t("title")}>
            <thead><tr className="border-b border-line"><th scope="col" className={th}>{t("prefix")}</th><th scope="col" className={th}>{t("date")}</th><th scope="col" className={th}>{t("community")}</th><th scope="col" className={th}>{t("students")}</th><th scope="col" className={th}>{t("progress")}</th><th scope="col" className={th}>{t("status")}</th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-line/70 last:border-0 hover:bg-violet-50/60">
                  <td className={td}><Link href={`/equipo/grupos/${g.id}`} className="font-mono text-base font-bold text-violet-700 hover:underline">{g.prefix}</Link>{g.label ? <span className="block text-xs text-ink-muted">{g.label}</span> : null}</td>
                  <td className={td}>{monthName(g.month)} {g.year}</td>
                  <td className={td}>{g.community}</td>
                  <td className={td}><span className="font-mono tabular-nums">{g.active_students}/{g.students}</span></td>
                  <td className={`${td} w-48`}><Progress value={g.lessons_total ? g.avg_completed / g.lessons_total : 0} label={t("progress")} /><span className="text-xs text-ink-muted">{t("avg", { avg: g.avg_completed, total: g.lessons_total })}</span></td>
                  <td className={td}>{g.status === "active" ? <Tag tone="mint">{t("active")}</Tag> : <Tag tone="line">{t("closed")}</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
