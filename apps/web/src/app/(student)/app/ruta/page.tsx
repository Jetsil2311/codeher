import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CheckCircle, LockSimple, Play } from "@phosphor-icons/react/dist/ssr";
import { EmptyState, LanguageBadge, LessonState, Progress, cx } from "@/components/ui";
import { path } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export default async function Ruta() {
  const s = await requireStudent();
  const courses = path(s);
  const t = await getTranslations("student.path");
  const tl = await getTranslations("learn.language");
  const labels = { locked: t("locked"), progress: t("inProgress"), done: t("completed"), new: t("new") };
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("title")}</h1>
      <p className="mt-2 text-ink-soft">{t("subtitle")}</p>
      {courses.length === 0 ? (
        <div className="mt-8"><EmptyState title={t("empty")} body={t("emptyBody")} /></div>
      ) : (
        courses.map((c) => {
          const done = c.lessons.filter((l) => l.status === "completed").length;
          return (
            <section key={c.id} aria-labelledby={`curso-${c.slug}`} className="mt-10">
              <div className="tile p-5 md:p-6">
                <h2 id={`curso-${c.slug}`} className="text-xl font-extrabold md:text-2xl">{c.title}</h2>
                <p className="mt-1 text-ink-soft">{c.description}</p>
                <Progress value={c.lessons.length ? done / c.lessons.length : 0} label={t("courseProgress", { title: c.title })} className="mt-4" />
                <p className="mt-2 text-sm text-ink-muted">{t("count", { done, total: c.lessons.length })}</p>
              </div>
              <ol className="relative mt-6 space-y-4 pl-8">
                <span className="absolute bottom-6 left-[15px] top-6 w-0.5 bg-gradient-to-b from-violet via-pink to-line" aria-hidden />
                {c.lessons.map((l) => {
                  const Icon = l.status === "completed" ? CheckCircle : l.unlocked ? Play : LockSimple;
                  return (
                    <li key={l.id} className="relative">
                      <span className={cx("absolute -left-8 top-5 grid size-8 place-items-center rounded-full ring-4 ring-paper", l.status === "completed" ? "bg-mint-700 text-white" : l.unlocked ? "bg-pink text-ink" : "bg-line text-ink-muted")} aria-hidden>
                        <Icon size={16} weight="fill" />
                      </span>
                      <Link href={`/app/leccion/${l.slug}`} className={cx("tile flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]", !l.unlocked && "opacity-80")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-ink-muted">{t("lessonN", { n: l.seq })}</span>
                          <LanguageBadge language={l.language} label={tl(l.language)} size="sm" />
                          <LessonState status={l.status} unlocked={l.unlocked} labels={labels} />
                        </div>
                        <p className="text-lg font-bold">{l.title}</p>
                        <p className="text-sm text-ink-soft">{l.summary}</p>
                        {!l.unlocked && l.unlock_after ? <p className="text-sm font-medium text-ink-muted">{t("unlockAfter", { title: l.unlock_after })}</p> : null}
                        <span className="mt-1 inline-flex items-center gap-1 self-start text-sm font-semibold text-violet-700">
                          {l.status === "completed" ? t("review") : l.unlocked ? t("open") : t("read")} <ArrowRight size={14} weight="bold" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })
      )}
    </div>
  );
}
