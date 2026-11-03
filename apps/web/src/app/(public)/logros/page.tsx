import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LogroCard } from "@/components/site/LogroCard";
import { SectionTitle, cx } from "@/components/ui";
import { logros } from "@/server/services/public";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.logrosPage");
  return { title: t("title"), description: t("subtitle"), alternates: { canonical: "/logros" } };
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
    <Link href={href} aria-current={active ? "true" : undefined} className={cx("inline-flex h-10 shrink-0 snap-start items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ring-1 transition", active ? "bg-violet-700 text-white ring-violet-700" : "bg-paper text-ink-soft ring-ink/10 hover:ring-violet/50")}>
      {children}
    </Link>
  );
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <SectionTitle as="h1" accent={t("titleAccent")} className="text-4xl md:text-5xl">
        {t("title")}
      </SectionTitle>
      <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">{t("subtitle")}</p>

      <div role="search" aria-label={t("filters")} className="mt-8 grid gap-4 rounded-[1.5rem] bg-white p-4 ring-1 ring-ink/[0.06] md:grid-cols-3 md:p-5">
        {[
          { label: t("year"), key: "anio", all: !sp.anio, opts: years.map((y) => ({ v: String(y), l: String(y) })) },
          { label: t("community"), key: "comunidad", all: !sp.comunidad, opts: communities.map((c) => ({ v: c, l: c })) },
          { label: t("type"), key: "tipo", all: !sp.tipo, opts: KINDS.map((k) => ({ v: k, l: tk(k) })) },
        ].map((f) => (
          <div key={f.key} className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{f.label}</p>
            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              <Chip href={qs({ [f.key]: undefined })} active={f.all}>{t("all")}</Chip>
              {f.opts.map((o) => (
                <Chip key={o.v} href={qs({ [f.key]: o.v })} active={(sp as Record<string, string | undefined>)[f.key] === o.v}>{o.l}</Chip>
              ))}
            </div>
          </div>
        ))}
      </div>
      {items.length > 0 ? <p className="mt-4 text-sm font-semibold text-ink-muted" aria-live="polite">{t("results", { n: items.length })}</p> : null}

      {items.length === 0 ? (
        <div className="mt-10 rounded-[1.5rem] border border-dashed border-violet/35 bg-white/60 px-6 py-12 text-center" aria-live="polite">
          <p className="text-lg font-semibold text-ink">{t("empty")}</p>
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
