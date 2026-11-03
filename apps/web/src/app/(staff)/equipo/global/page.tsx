import { BookOpen, FolderSimple, Student, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHead, Panel, Stat, TableWrap, monthName, td, th } from "@/components/staff/StaffUi";
import { Progress, Tag, cx } from "@/components/ui";
import { listGroups, stats } from "@/server/services/staff";
import { requireFounder } from "@/server/session";

export default async function Global({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string; comunidad?: string; educadora?: string }> }) {
  const p = await requireFounder();
  const s = stats(p);
  const t = await getTranslations("staff.global");
  const tl = await getTranslations("learn.language");
  const sp = await searchParams;
  const all = listGroups(p);
  const groups = all.filter((g) => (!sp.anio || String(g.year) === sp.anio) && (!sp.mes || String(g.month) === sp.mes) && (!sp.comunidad || g.community === sp.comunidad) && (!sp.educadora || g.educators.some((e) => e.id === sp.educadora)));
  const years = [...new Set(all.map((g) => g.year))].sort();
  const months = [...new Set(all.map((g) => g.month))].sort((a, b) => a - b);
  const comms = [...new Set(all.map((g) => g.community))];
  const educators = [...new Map(all.flatMap((g) => g.educators).map((e) => [e.id, e])).values()];
  const href = (k: string, v?: string) => { const q = new URLSearchParams(Object.entries({ ...sp, [k]: v }).filter(([, x]) => x) as [string, string][]).toString(); return q ? `/equipo/global?${q}` : "/equipo/global"; };
  const chip = (active: boolean) => cx("inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold ring-1", active ? "bg-ink text-paper ring-ink" : "bg-white ring-line");
  return (
    <>
      <PageHead title={t("title")} subtitle={t("subtitle")} />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat label={t("students")} value={s.students} icon={<Student size={19} weight="fill" aria-hidden />} hint={t("activeWeek", { n: s.active_week })} tone="ink" />
        <Stat label={t("groups")} value={s.groups} icon={<UsersThree size={19} weight="fill" aria-hidden />} hint={t("activeGroups", { n: s.active_groups })} />
        <Stat label={t("lessonsCompleted")} value={s.lessons_completed} icon={<BookOpen size={19} weight="fill" aria-hidden />} hint={`${tl("pseudocode_es")}: ${s.by_language.pseudocode_es ?? 0} · Python: ${s.by_language.python ?? 0}`} />
        <Stat label={t("projects")} value={s.projects} icon={<FolderSimple size={19} weight="fill" aria-hidden />} hint={t("logros", { published: s.logros_published, pending: s.nominations_pending })} tone="violet" />
      </div>
      <Panel title={t("byCommunity")} className="mt-6">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {s.by_community.map((c) => <li key={c.name} className="rounded-2xl bg-violet-50 p-4"><p className="font-bold">{c.name}</p><p className="font-mono text-sm">{t("communityLine", { groups: c.groups, students: c.students })}</p></li>)}
        </ul>
      </Panel>
      <Panel title={t("allGroups")} className="mt-6">
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-24 text-xs font-bold">{t("year")}</span><Link className={chip(!sp.anio)} href={href("anio")}>{t("all")}</Link>{years.map((y) => <Link key={y} className={chip(sp.anio === String(y))} href={href("anio", String(y))}>{y}</Link>)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-24 text-xs font-bold">{t("month")}</span><Link className={chip(!sp.mes)} href={href("mes")}>{t("all")}</Link>{months.map((m) => <Link key={m} className={chip(sp.mes === String(m))} href={href("mes", String(m))}>{monthName(m)}</Link>)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-24 text-xs font-bold">{t("community")}</span><Link className={chip(!sp.comunidad)} href={href("comunidad")}>{t("all")}</Link>{comms.map((c) => <Link key={c} className={chip(sp.comunidad === c)} href={href("comunidad", c)}>{c}</Link>)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><span className="w-24 text-xs font-bold">{t("educator")}</span><Link className={chip(!sp.educadora)} href={href("educadora")}>{t("all")}</Link>{educators.map((e) => <Link key={e.id} className={chip(sp.educadora === e.id)} href={href("educadora", e.id)}>{e.name}</Link>)}</div>
        </div>
        <TableWrap label={t("allGroups")}>
          <thead><tr className="border-b border-line"><th scope="col" className={th}>{t("prefix")}</th><th scope="col" className={th}>{t("community")}</th><th scope="col" className={th}>{t("educators")}</th><th scope="col" className={th}>{t("students")}</th><th scope="col" className={th}>{t("progress")}</th><th scope="col" className={th}>{t("status")}</th></tr></thead>
          <tbody>{groups.map((g) => (
            <tr key={g.id} className="border-b border-line/70 last:border-0">
              <td className={td}><Link href={`/equipo/grupos/${g.id}`} className="font-mono font-bold text-violet-700 hover:underline">{g.prefix}</Link><span className="block text-xs text-ink-muted">{monthName(g.month)} {g.year}</span></td>
              <td className={td}>{g.community}</td>
              <td className={td}>{g.educators.map((e) => e.name).join(", ") || "·"}</td>
              <td className={`${td} font-mono`}>{g.students}</td>
              <td className={`${td} w-40`}><Progress value={g.lessons_total ? g.avg_completed / g.lessons_total : 0} label={t("progress")} /></td>
              <td className={td}><Tag tone={g.status === "active" ? "mint" : "line"}>{g.status === "active" ? t("active") : t("closed")}</Tag></td>
            </tr>
          ))}</tbody>
        </TableWrap>
      </Panel>
    </>
  );
}
