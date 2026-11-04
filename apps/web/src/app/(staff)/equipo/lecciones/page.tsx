import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NewLessonForm } from "@/components/staff/LessonLibraryClient";
import { ContentTabs } from "@/components/staff/ContentTabs";
import { PageHead, Panel, TableWrap, td, th } from "@/components/staff/StaffUi";
import { LanguageBadge, Tag, cx } from "@/components/ui";
import { lessonLibrary } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function Lecciones({ searchParams }: { searchParams: Promise<{ lenguaje?: string }> }) {
  const p = await requireStaff();
  const lib = await lessonLibrary(p);
  const t = await getTranslations("staff.library");
  const tl = await getTranslations("learn.language");
  const { lenguaje } = await searchParams;
  const lessons = lib.lessons.filter((l) => !lenguaje || l.language === lenguaje);
  const modules = lib.courses.flatMap((c) => c.modules.map((m) => ({ id: m.id, label: `${c.title} · ${m.title}` })));
  const statusTone = { draft: "line", review: "sun", published: "mint", archived: "ink" } as const;
  return (
    <>
      <PageHead title={t("title")} subtitle={p.role === "founder" ? t("subtitleFounder") : t("subtitle")} />
      <ContentTabs active="lessons" lessons={lib.lessons.length} courses={lib.courses.length} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel
          title={t("lessons")}
          actions={
            <nav aria-label={t("filter")} className="flex gap-1">
              {[{ k: "", l: t("all") }, { k: "python", l: tl("python") }, { k: "pseudocode_es", l: tl("pseudocode_es") }].map((f) => (
                <Link key={f.k} href={f.k ? `/equipo/lecciones?lenguaje=${f.k}` : "/equipo/lecciones"} aria-current={(lenguaje ?? "") === f.k ? "page" : undefined} className={cx("inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold", (lenguaje ?? "") === f.k ? "bg-ink text-paper" : "text-ink-soft hover:bg-violet-100")}>{f.l}</Link>
              ))}
            </nav>
          }
        >
          <TableWrap label={t("lessons")}>
            <thead><tr className="border-b border-line"><th scope="col" className={th}>{t("lesson")}</th><th scope="col" className={th}>{t("language")}</th><th scope="col" className={th}>{t("visibility")}</th><th scope="col" className={th}>{t("status")}</th><th scope="col" className={th}>{t("exercises")}</th></tr></thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id} className="border-b border-line/70 last:border-0 hover:bg-violet-50/50">
                  <td className={td}><Link href={`/equipo/lecciones/${l.id}`} className="font-semibold text-violet-700 hover:underline">{l.title}</Link><p className="font-mono text-xs text-ink-muted">{l.slug}{l.course ? ` · ${l.course}` : ""}</p>{l.pair ? <p className="text-xs text-ink-muted">{t("twin", { title: l.pair })}</p> : null}</td>
                  <td className={td}><LanguageBadge language={l.language} label={tl(l.language)} size="sm" /></td>
                  <td className={td}><Tag tone={l.visibility === "public" ? "pink" : l.visibility === "program" ? "violet" : "line"}>{t(`vis.${l.visibility}`)}</Tag></td>
                  <td className={td}><Tag tone={statusTone[l.status]}>{t(`st.${l.status}`)}</Tag></td>
                  <td className={`${td} font-mono`}>{l.exercises}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
        <div className="space-y-6">
          <Panel title={t("newLesson")}><NewLessonForm modules={modules} founder={p.role === "founder"} /></Panel>
        </div>
      </div>
    </>
  );
}
