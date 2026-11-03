import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock } from "@phosphor-icons/react/dist/ssr";
import { LanguageBadge, SectionTitle, cx } from "@/components/ui";
import { publicLessons } from "@/server/services/public";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.probarPage");
  return { title: t("title") + " " + t("titleAccent"), description: t("subtitle"), alternates: { canonical: "/probar" } };
}

export default async function Probar({ searchParams }: { searchParams: Promise<{ lenguaje?: string }> }) {
  const t = await getTranslations("landing.probarPage");
  const tl = await getTranslations("learn.language");
  const { lenguaje } = await searchParams;
  const filter = lenguaje === "python" || lenguaje === "pseudocodigo" ? lenguaje : "todas";
  const all = publicLessons();
  const lessons = all.filter((l) => filter === "todas" || (filter === "python" ? l.language === "python" : l.language === "pseudocode_es"));
  const tabs = [
    { key: "todas", label: t("all"), href: "/probar" },
    { key: "python", label: tl("python"), href: "/probar?lenguaje=python" },
    { key: "pseudocodigo", label: tl("pseudocode_es"), href: "/probar?lenguaje=pseudocodigo" },
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <SectionTitle as="h1" accent={t("titleAccent")} className="text-4xl md:text-5xl">
        {t("title")}
      </SectionTitle>
      <p className="mt-3 max-w-[56ch] text-lg text-ink-soft">{t("subtitle")}</p>
      <nav aria-label={t("filter")} className="mt-8 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link key={tab.key} href={tab.href} aria-current={filter === tab.key ? "page" : undefined} className={cx("inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold ring-1 transition", filter === tab.key ? "bg-ink text-paper ring-ink" : "bg-white text-ink-soft ring-line hover:ring-violet/50")}>
            {tab.label}
          </Link>
        ))}
      </nav>
      {lessons.length === 0 ? (
        <p className="mt-10 text-ink-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l, i) => (
            <li key={l.id}>
              <Link href={`/probar/${l.slug}`} className="tile group relative flex h-full flex-col overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <div className={cx("absolute -right-12 -top-12 size-36 rounded-full opacity-90 transition group-hover:scale-110", i % 3 === 0 ? "bg-violet-100" : i % 3 === 1 ? "bg-pink-100" : "bg-[#e7f6fd]")} aria-hidden />
                <div className="relative flex items-center gap-2">
                  <LanguageBadge language={l.language} label={tl(l.language)} />
                </div>
                <h2 className="relative mt-4 text-xl font-extrabold tracking-tight">{l.title}</h2>
                <p className="relative mt-1.5 text-ink-soft">{l.summary}</p>
                <div className="relative mt-auto flex items-center justify-between pt-6 text-sm text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} weight="bold" aria-hidden /> {t("minutes", { n: l.minutes })} · {t("exercises", { n: l.exercises })}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-violet-700">
                    {t("start")} <ArrowRight size={15} weight="bold" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
