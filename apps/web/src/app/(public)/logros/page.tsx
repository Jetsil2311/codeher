import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LogroCard } from "@/components/site/LogroCard";
import { SectionTitle, cx } from "@/components/ui";
import { logros } from "@/server/services/public";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("landing.logrosPage"))("title") };
}

const KINDS = ["project", "first_program", "first_website", "community_presentation", "milestone"] as const;

export default async function Logros({ searchParams }: { searchParams: Promise<{ anio?: string; comunidad?: string; tipo?: string }> }) {
  const t = await getTranslations("landing.logrosPage");
  const tk = await getTranslations("landing.logros.kind");
  const sp = await searchParams;
  const all = logros();
  const years = Array.from(new Set(all.map((a) => a.year).filter(Boolean))).sort() as number[];
  const communities = Array.from(new Set(all.map((a) => a.community).filter(Boolean))) as string[];
  const items = all.filter((a) => (!sp.anio || String(a.year) === sp.anio) && (!sp.comunidad || a.community === sp.comunidad) && (!sp.tipo || a.kind === sp.tipo));
  const featured = items.find((a) => a.featured) ?? null;
  const rest = items.filter((a) => a !== featured);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/logros?${s}` : "/logros";
  };
  const Chip = ({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) => (
    <Link href={href} aria-current={active ? "true" : undefined} className={cx("inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold ring-1 transition", active ? "bg-ink text-paper ring-ink" : "bg-white text-ink-soft ring-line hover:ring-violet/50")}>
      {children}
    </Link>
  );
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <SectionTitle as="h1" accent={t("titleAccent")} className="text-4xl md:text-5xl">
        {t("title")}
      </SectionTitle>
      <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">{t("subtitle")}</p>

      <div role="search" aria-label={t("filters")} className="mt-8 space-y-3 rounded-[var(--radius-tile)] bg-white p-4 ring-1 ring-line md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-sm font-bold">{t("year")}</span>
          <Chip href={qs({ anio: undefined })} active={!sp.anio}>{t("all")}</Chip>
          {years.map((y) => <Chip key={y} href={qs({ anio: String(y) })} active={sp.anio === String(y)}>{y}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-sm font-bold">{t("community")}</span>
          <Chip href={qs({ comunidad: undefined })} active={!sp.comunidad}>{t("all")}</Chip>
          {communities.map((c) => <Chip key={c} href={qs({ comunidad: c })} active={sp.comunidad === c}>{c}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-sm font-bold">{t("type")}</span>
          <Chip href={qs({ tipo: undefined })} active={!sp.tipo}>{t("all")}</Chip>
          {KINDS.map((k) => <Chip key={k} href={qs({ tipo: k })} active={sp.tipo === k}>{tk(k)}</Chip>)}
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-ink-muted" aria-live="polite">{t("results", { n: items.length })}</p>

      {items.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-ink-muted">{t("empty")}</p>
          <Link href="/logros" className="mt-3 inline-block font-semibold text-violet-700 underline">{t("clear")}</Link>
        </div>
      ) : (
        <>
          {featured && (
            <section aria-label={t("featured")} className="mt-8">
              <p className="mb-3 font-accent text-xl italic text-pink-700">{t("featured")}</p>
              <LogroCard item={featured} size="lg" />
            </section>
          )}
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <li key={a.id}>
                <LogroCard item={a} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
