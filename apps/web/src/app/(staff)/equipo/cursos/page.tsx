import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Stack, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { ContentTabs } from "@/components/staff/ContentTabs";
import { NewCourseCard } from "@/components/staff/CourseBuilder";
import { PageHead } from "@/components/staff/StaffUi";
import { Stagger, StaggerItem } from "@/components/motion/Motion";
import { LanguageBadge, cx } from "@/components/ui";
import { courseList, lessonLibrary } from "@/server/services/staff";
import { requireStaff } from "@/server/session";

export default async function Cursos() {
  const p = await requireStaff();
  const [courses, lib] = await Promise.all([courseList(p), lessonLibrary(p)]);
  const t = await getTranslations("staff.courses");
  const tl = await getTranslations("learn.language");
  return (
    <>
      <PageHead title={t("title")} subtitle={p.role === "founder" ? t("subtitleFounder") : t("subtitle")} />
      <ContentTabs active="courses" lessons={lib.lessons.length} courses={courses.length} />
      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c, i) => {
          const pct = c.lessons ? Math.round((c.published / c.lessons) * 100) : 0;
          const on = c.status === "published";
          return (
            <StaggerItem key={c.id}>
              <Link href={`/equipo/cursos/${c.id}`} className="group tile flex h-full flex-col overflow-hidden rounded-[1.6rem] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <div className="relative isolate h-28 overflow-hidden bg-midnight p-4 text-paper">
                  <div className="blueprint-dark absolute inset-0 -z-10 opacity-50" aria-hidden />
                  <span className={cx("absolute -bottom-10 -right-6 -z-10 size-36 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125", i % 3 === 0 ? "bg-pink/40" : i % 3 === 1 ? "bg-violet/50" : "bg-[#00bbf9]/35")} aria-hidden />
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-12 place-items-center rounded-2xl bg-grad text-xl font-extrabold shadow-[var(--shadow-pop)]">{c.title.slice(0, 1)}</span>
                    <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold", on ? "bg-[#5ef2d6]/15 text-[#5ef2d6]" : "bg-white/10 text-[#d6cdea]")}>
                      <span className={cx("size-1.5 rounded-full bg-current", on && "shadow-[0_0_8px_currentColor]")} aria-hidden />
                      {t(`st.${c.status}`)}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-4 flex gap-1.5">
                    {c.languages.map((l) => <LanguageBadge key={l} language={l} label={tl(l)} size="sm" tone="dark" />)}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-extrabold leading-tight tracking-tight group-hover:text-violet-700">{c.title}</h2>
                  {c.description ? <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{c.description}</p> : null}
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-ink-soft"><Stack size={16} weight="bold" aria-hidden /> {t("stats", { modules: c.modules, lessons: c.lessons })}</p>
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-gradient-to-r from-violet to-pink" style={{ width: `${pct}%` }} /></div>
                    <p className="mt-1.5 text-xs text-ink-muted">{t("visible", { n: c.published })}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-4 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-ink-muted"><UsersThree size={16} weight="bold" aria-hidden /> {t("groups", { n: c.groups })}</span>
                    <span className="inline-flex items-center gap-1 font-bold text-violet-700">{t("manage")} <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-1" aria-hidden /></span>
                  </div>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
        <StaggerItem><NewCourseCard /></StaggerItem>
      </Stagger>
    </>
  );
}
