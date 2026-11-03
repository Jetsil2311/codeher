import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, LockSimple, Moon, Pulse } from "@phosphor-icons/react/dist/ssr";
import { PageHead, Panel, Stat, relTime, monthName } from "@/components/staff/StaffUi";
import { ButtonLink, EmptyState, Progress, Tag } from "@/components/ui";
import { dashboard } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function PanelPage() {
  const p = await requireStaff();
  const d = dashboard(p);
  const t = await getTranslations("staff.panel");
  const tc = await getTranslations("common");
  return (
    <>
      <PageHead title={t("title", { name: p.display_name.split(" ")[0] })} subtitle={t("subtitle")} actions={<ButtonLink href="/equipo/grupos/nuevo" variant="violet"><Plus size={18} weight="bold" aria-hidden /> {t("newGroup")}</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("activeGroups")} value={d.groups.length} tone="ink" />
        <Stat label={t("students")} value={d.totals.students} />
        <Stat label={t("activeWeek")} value={d.totals.active_week} hint={t("activeWeekHint")} tone="violet" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title={t("myGroups")}>
          {d.groups.length === 0 ? (
            <EmptyState title={t("noGroups")} body={t("noGroupsBody")} action={<ButtonLink href="/equipo/grupos/nuevo" variant="violet">{t("newGroup")}</ButtonLink>} />
          ) : (
            <ul className="space-y-3">
              {d.groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/equipo/grupos/${g.id}`} className="block rounded-2xl p-4 ring-1 ring-line transition hover:bg-violet-50 hover:ring-violet/40">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-lg font-bold">{g.prefix}</p>
                      <Tag tone="line">{g.community}</Tag>
                    </div>
                    <p className="text-sm text-ink-muted">{monthName(g.month)} {g.year}{g.label ? ` · ${g.label}` : ""} · {t("studentsCount", { n: g.students })}</p>
                    <Progress value={g.lessons_total ? g.avg_completed / g.lessons_total : 0} label={t("progress")} className="mt-3" />
                    <p className="mt-1 text-xs text-ink-muted">{t("avg", { avg: g.avg_completed, total: g.lessons_total })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title={<span className="inline-flex items-center gap-2"><LockSimple size={18} weight="bold" aria-hidden /> {t("locked")}</span>}>
            {d.locked.length === 0 ? <p className="text-sm text-ink-muted">{t("noLocked")}</p> : (
              <ul className="space-y-2">
                {d.locked.map((s) => (
                  <li key={s.id}><Link href={`/equipo/estudiantes/${s.id}`} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-violet-50"><span className="font-semibold">{s.nickname}</span><span className="font-mono text-sm">{s.code}</span></Link></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={<span className="inline-flex items-center gap-2"><Moon size={18} weight="bold" aria-hidden /> {t("inactive")}</span>}>
            {d.inactive.length === 0 ? <p className="text-sm text-ink-muted">{t("noInactive")}</p> : (
              <ul className="space-y-1">
                {d.inactive.map((s) => (
                  <li key={s.id}><Link href={`/equipo/estudiantes/${s.id}`} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 hover:bg-violet-50"><span><span className="font-semibold">{s.nickname}</span> <span className="font-mono text-xs text-ink-muted">{s.code}</span></span><span className="text-xs text-ink-muted">{relTime(s.last_active_at, tc("never"))}</span></Link></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={<span className="inline-flex items-center gap-2"><Pulse size={18} weight="bold" aria-hidden /> {t("recent")}</span>}>
            {d.recent.length === 0 ? <p className="text-sm text-ink-muted">{t("noRecent")}</p> : (
              <ul className="space-y-2">
                {d.recent.map((r, i) => (
                  <li key={i} className="text-sm">
                    <Link href={`/equipo/estudiantes/${r.student_id}`} className="font-semibold hover:underline">{r.nickname}</Link>{" "}
                    {t(`event.${r.kind}` as "event.lesson_completed", { title: r.title })}
                    <span className="block text-xs text-ink-muted">{relTime(r.at, tc("never"))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
