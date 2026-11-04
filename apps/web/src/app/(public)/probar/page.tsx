import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock, Lightning, TerminalWindow, TextAa } from "@phosphor-icons/react/dist/ssr";
import { LanguageBadge, SectionTitle, cx } from "@/components/ui";
import { LinkTabs } from "@/components/motion/LinkTabs";
import { Stagger, StaggerItem } from "@/components/motion/Motion";
import { publicLessons } from "@/server/services/public";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.probarPage");
  return { title: t("title") + " " + t("titleAccent"), description: t("subtitle"), alternates: { canonical: "/probar" } };
}

const ART = [
  { bg: "from-violet to-pink", w: ["w-3/5", "w-4/5", "w-2/5"] },
  { bg: "from-[#00bbf9] to-violet", w: ["w-2/3", "w-1/2", "w-3/4"] },
  { bg: "from-pink to-[#ff9f6b]", w: ["w-1/2", "w-3/4", "w-3/5"] },
];

export default async function Probar({ searchParams }: { searchParams: Promise<{ lenguaje?: string }> }) {
  const t = await getTranslations("landing.probarPage");
  const tl = await getTranslations("learn.language");
  const { lenguaje } = await searchParams;
  const filter = lenguaje === "python" || lenguaje === "pseudocodigo" ? lenguaje : "todas";
  const all = await publicLessons();
  const lessons = all.filter((l) => filter === "todas" || (filter === "python" ? l.language === "python" : l.language === "pseudocode_es"));
  const count = (k: string) => all.filter((l) => k === "todas" || (k === "python" ? l.language === "python" : l.language === "pseudocode_es")).length;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 md:px-6 md:pt-14">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <SectionTitle as="h1" accent={t("titleAccent")} className="text-4xl md:text-6xl">
            {t("title")}
          </SectionTitle>
          <p className="mt-3 max-w-[56ch] text-lg text-ink-soft">{t("subtitle")}</p>
        </div>
        <LinkTabs
          label={t("filter")}
          items={[
            { href: "/probar", label: t("all"), active: filter === "todas", count: count("todas") },
            { href: "/probar?lenguaje=pseudocodigo", label: tl("pseudocode_es"), active: filter === "pseudocodigo", icon: <TextAa size={15} weight="bold" aria-hidden />, count: count("pseudocodigo") },
            { href: "/probar?lenguaje=python", label: tl("python"), active: filter === "python", icon: <TerminalWindow size={15} weight="bold" aria-hidden />, count: count("python") },
          ]}
        />
      </div>
      {lessons.length === 0 ? (
        <p className="mt-10 text-ink-muted">{t("empty")}</p>
      ) : (
        <Stagger as="ul" key={filter} className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l, i) => {
            const art = ART[i % ART.length];
            const py = l.language === "python";
            return (
              <StaggerItem as="li" key={l.id}>
                <Link href={`/probar/${l.slug}`} className="group tile relative flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]">
                  <span className={cx("relative block h-36 overflow-hidden bg-gradient-to-br", art.bg)} aria-hidden>
                    <span className="blueprint-dark absolute inset-0 opacity-40" />
                    <span className="absolute left-5 top-4 font-mono text-5xl font-bold text-white/25">{String(i + 1).padStart(2, "0")}</span>
                    <span className="absolute -bottom-3 right-5 w-[62%] rounded-t-2xl bg-midnight/90 p-3 shadow-2xl ring-1 ring-white/10 transition-transform duration-500 group-hover:-translate-y-2 group-hover:-rotate-2">
                      <span className="mb-2 flex gap-1">
                        <span className="size-1.5 rounded-full bg-pink" /><span className="size-1.5 rounded-full bg-sun" /><span className="size-1.5 rounded-full bg-mint" />
                      </span>
                      {art.w.map((w, k) => (
                        <span key={k} className={cx("mt-1.5 block h-1.5 rounded-full", w, k === 0 ? (py ? "bg-sky/70" : "bg-violet-300") : k === 1 ? "bg-white/25" : "bg-mint/60")} />
                      ))}
                    </span>
                  </span>
                  <span className="flex flex-1 flex-col p-5 md:p-6">
                    <span className="flex items-center gap-2">
                      <LanguageBadge language={l.language} label={tl(l.language)} size="sm" />
                    </span>
                    <span className="mt-3 text-xl font-extrabold tracking-tight">{l.title}</span>
                    <span className="mt-1.5 text-ink-soft">{l.summary}</span>
                    <span className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm text-ink-muted">
                      <span className="inline-flex items-center gap-3">
                        <span className="inline-flex items-center gap-1"><Clock size={15} weight="bold" aria-hidden /> {t("minutes", { n: l.minutes })}</span>
                        <span className="inline-flex items-center gap-1"><Lightning size={15} weight="bold" aria-hidden /> {t("exercises", { n: l.exercises })}</span>
                      </span>
                      <span className="inline-flex h-9 items-center gap-1 rounded-full bg-violet-100 px-3 font-bold text-violet-800 transition-all duration-300 group-hover:bg-ink group-hover:text-paper">
                        {t("start")} <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
