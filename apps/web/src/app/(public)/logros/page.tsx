import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LogroCard } from "@/components/site/LogroCard";
import { Suspense } from "react";
import { SectionTitle } from "@/components/ui";
import { LogrosFilters } from "@/components/site/LogrosFilters";
import { Stagger, StaggerItem } from "@/components/motion/Motion";
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
  const all = await logros();
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
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 md:px-6 md:pt-14">
      <SectionTitle as="h1" accent={t("titleAccent")} className="text-4xl md:text-6xl">
        {t("title")}
      </SectionTitle>
      <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">{t("subtitle")}</p>

      <div className="mt-8">
        <Suspense>
          <LogrosFilters
            labels={{ filters: t("filters"), clear: t("clear"), close: t("close"), show: t("results", { n: items.length }) }}
            active={[
              sp.anio ? { label: sp.anio, href: qs({ anio: undefined }) } : null,
              sp.comunidad ? { label: sp.comunidad, href: qs({ comunidad: undefined }) } : null,
              sp.tipo ? { label: tk(sp.tipo as "project"), href: qs({ tipo: undefined }) } : null,
            ].filter((x): x is { label: string; href: string } => !!x)}
            groups={[
              { key: "anio", label: t("year"), items: [{ href: qs({ anio: undefined }), label: t("all"), active: !sp.anio }, ...years.map((y) => ({ href: qs({ anio: String(y) }), label: String(y), active: sp.anio === String(y) }))] },
              { key: "comunidad", label: t("community"), items: [{ href: qs({ comunidad: undefined }), label: t("all"), active: !sp.comunidad }, ...communities.map((c) => ({ href: qs({ comunidad: c }), label: c, active: sp.comunidad === c }))] },
              { key: "tipo", label: t("type"), items: [{ href: qs({ tipo: undefined }), label: t("all"), active: !sp.tipo }, ...KINDS.map((k) => ({ href: qs({ tipo: k }), label: tk(k), active: sp.tipo === k }))] },
            ]}
          />
        </Suspense>
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
          <Stagger as="ul" inView className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((a) => (
              <StaggerItem as="li" key={a.id}>
                <LogroCard item={a} />
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </div>
  );
}
