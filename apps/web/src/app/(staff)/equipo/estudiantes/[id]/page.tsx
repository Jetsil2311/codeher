import { ArrowsClockwise, BookOpen, CheckCircle, Star } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StudentTools } from "@/components/staff/StudentTools";
import { PageHead, Panel, Stat, TableWrap, relTime, td, th } from "@/components/staff/StaffUi";
import { Avatar, LanguageBadge, LessonState, Tag } from "@/components/ui";
import { groupRecreo, studentDetail } from "@/server/services/staff";
import { RecreoLibre } from "@/components/staff/RecreoLibre";
import { requireStaff } from "@/server/session";

export default async function Estudiante({ params }: { params: Promise<{ id: string }> }) {
  const p = await requireStaff();
  const s = await studentDetail(p, (await params).id);
  if (!s) notFound();
  const t = await getTranslations("staff.student");
  const tl = await getTranslations("learn.language");
  const tp = await getTranslations("student.path");
  const tc = await getTranslations("common");
  const labels = { locked: tp("locked"), progress: tp("inProgress"), done: tp("completed"), new: tp("new") };
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
  const tr = await getTranslations("staff.recreoLibre");
  const recreoRow = (await groupRecreo(p, s.group.id)).filter((r) => r.id === s.id);
  return (
    <>
      <PageHead
        back={{ href: `/equipo/grupos/${s.group.id}`, label: s.group.prefix }}
        title={<span className="inline-flex items-center gap-3"><Avatar id={s.avatar} size={44} /> {s.nickname}</span>}
        subtitle={<><span className="font-mono font-bold">{s.code}</span> · {s.group.community} · {t("lastActivity", { when: relTime(s.last_active_at, tc("never")) })} {s.status === "inactive" ? <Tag tone="line" className="ml-2">{t("inactive")}</Tag> : null} {s.locked ? <Tag tone="pink" className="ml-1">{t("locked")}</Tag> : null}</>}
      />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat label={t("lessons")} value={s.stats.lessons_completed} tone="ink" icon={<BookOpen size={19} weight="fill" aria-hidden />} />
        <Stat label={t("exercises")} value={s.stats.exercises_passed} icon={<CheckCircle size={19} weight="fill" aria-hidden />} />
        <Stat label={t("attempts")} value={s.stats.attempts} icon={<ArrowsClockwise size={19} weight="fill" aria-hidden />} />
        <Stat label="XP" value={s.stats.xp} icon={<Star size={19} weight="fill" aria-hidden />} hint={t("streak", { n: s.stats.streak })} tone="violet" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {recreoRow.length > 0 && (
            <Panel title={tr("title")}>
              <p className="-mt-2 mb-3 text-sm text-ink-muted">{tr("body")}</p>
              <RecreoLibre single rows={recreoRow} labels={Object.fromEntries(["grant","grantFinished","grantAll","stop","stopAll","finished","lessons","freeLeft","playing","granted","stopped","error","empty"].map((k) => [k, (tr.raw as unknown as (k: string) => string)(k)]))} />
            </Panel>
          )}
          <Panel title={t("progress")}>
            <ul className="space-y-2">
              {s.lessons.map((l) => (
                <li key={l.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 ring-1 ring-line">
                  <span className="flex items-center gap-2"><LanguageBadge language={l.language} label={tl(l.language)} size="sm" /> {l.title}</span>
                  <LessonState status={l.status} unlocked labels={labels} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t("exercisesTitle")}>
            {s.exercises.length === 0 ? <p className="text-ink-muted">{t("noAttempts")}</p> : (
              <TableWrap label={t("exercisesTitle")}>
                <thead><tr className="border-b border-line"><th scope="col" className={th}>{t("exercise")}</th><th scope="col" className={th}>{t("state")}</th><th scope="col" className={th}>{t("attempts")}</th><th scope="col" className={th}>{t("hints")}</th><th scope="col" className={th}>{t("lastError")}</th></tr></thead>
                <tbody>{s.exercises.map((e) => (
                  <tr key={e.exercise_id} className="border-b border-line/70 last:border-0">
                    <td className={td}><p className="font-semibold">{e.title}</p><p className="text-xs text-ink-muted">{e.lesson}</p></td>
                    <td className={td}>{e.passed ? <Tag tone="mint">{t("passed")}</Tag> : <Tag tone="pink">{t("notYet")}</Tag>}</td>
                    <td className={`${td} font-mono`}>{e.attempts}</td>
                    <td className={`${td} font-mono`}>{e.hints_used}</td>
                    <td className={`${td} font-mono text-xs`}>{e.last_error ?? "·"}</td>
                  </tr>
                ))}</tbody>
              </TableWrap>
            )}
          </Panel>
          <Panel title={t("recentAttempts")}>
            {s.attempts.length === 0 ? <p className="text-ink-muted">{t("noAttempts")}</p> : (
              <ul className="space-y-2">
                {s.attempts.slice(0, 12).map((a) => (
                  <li key={a.id}>
                    <details className="rounded-xl ring-1 ring-line">
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span><span className="font-semibold">{a.exercise}</span> · {fmt.format(new Date(a.created_at))}</span>
                        {a.passed ? <Tag tone="mint">{t("passed")}</Tag> : <Tag tone="pink">{a.error_type ?? t("notYet")}</Tag>}
                      </summary>
                      <pre className="m-2 overflow-x-auto rounded-lg bg-midnight p-3 font-mono text-xs text-paper">{a.submission}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title={t("errors")}>
            {s.errors.length === 0 ? <p className="text-sm text-ink-muted">{t("noErrors")}</p> : (
              <ul className="space-y-1.5">{s.errors.map((e) => <li key={e.type} className="flex items-center justify-between font-mono text-sm"><span>{e.type}</span><span className="font-bold">{e.count}</span></li>)}</ul>
            )}
          </Panel>
          <Panel title={t("projects")}>
            {s.projects.length === 0 ? <p className="text-sm text-ink-muted">{t("noProjects")}</p> : (
              <ul className="space-y-2">{s.projects.map((pr) => (
                <li key={pr.id}><Link href={`/equipo/proyectos/${pr.id}`} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 ring-1 ring-line hover:bg-violet-50"><span className="font-semibold">{pr.name}</span><LanguageBadge language={pr.language} label={tl(pr.language)} size="sm" /></Link></li>
              ))}</ul>
            )}
          </Panel>
          <StudentTools student={{ id: s.id, code: s.code, groupId: s.group.id, consent: s.consent, projects: s.projects.map((x) => ({ id: x.id, name: x.name })) }} notes={s.notes} />
        </div>
      </div>
    </>
  );
}
