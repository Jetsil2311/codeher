import { getTranslations } from "next-intl/server";
import { Path as PathIcon } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/ui";
import { Ring } from "@/components/motion/Motion";
import { PathMap } from "@/components/learn/PathMap";
import { path } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export default async function Ruta() {
  const s = await requireStudent();
  const courses = path(s);
  const t = await getTranslations("student.path");
  const tl = await getTranslations("learn.language");
  const langLabels = { python: tl("python"), pseudocode_es: tl("pseudocode_es") };
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-8 md:pt-10">
      <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-[52ch] text-ink-soft">{t("subtitle")}</p>
      {courses.length === 0 ? (
        <div className="mt-8"><EmptyState title={t("empty")} body={t("emptyBody")} icon={<PathIcon size={28} weight="bold" />} /></div>
      ) : (
        courses.map((c, ci) => {
          const done = c.lessons.filter((l) => l.status === "completed").length;
          const pct = c.lessons.length ? done / c.lessons.length : 0;
          return (
            <section key={c.id} aria-labelledby={`curso-${c.slug}`} className="mt-8 md:mt-10">
              <div className="relative isolate overflow-hidden rounded-[1.6rem] bg-midnight p-5 text-paper shadow-[var(--shadow-lift)] md:p-6">
                <div className="blueprint-dark absolute inset-0 -z-10 opacity-50" aria-hidden />
                <div className={ci % 2 ? "absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-sky/30 blur-3xl" : "absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-pink/35 blur-3xl"} aria-hidden />
                <div className="flex items-center gap-4">
                  <Ring value={pct} size={68} stroke={6} track="rgb(255 255 255 / 0.12)" label={t("courseProgress", { title: c.title })}>
                    <span className="font-mono text-sm font-bold tabular-nums">{Math.round(pct * 100)}%</span>
                  </Ring>
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium uppercase tracking-wider text-pink">{t("unitLabel", { n: ci + 1 })}</p>
                    <h2 id={`curso-${c.slug}`} className="text-xl font-extrabold leading-tight md:text-2xl">{c.title}</h2>
                    <p className="mt-0.5 text-sm text-[#b8acd6]">{t("count", { done, total: c.lessons.length })}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#d6cdea]">{c.description}</p>
              </div>
              <div className="mt-14">
                <PathMap
                  lessons={c.lessons}
                  langLabels={langLabels}
                  labels={{
                    here: t("here"),
                    start: t("start"),
                    locked: t("stateLocked"),
                    done: t("stateDone"),
                    current: t("stateCurrent"),
                    node: t.raw("nodeLabel") as string,
                  }}
                />
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
