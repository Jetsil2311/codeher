"use client";
// Printable access cards (brief 4.2): CODEHER branding, nickname, code and PIN per student.
// Print to PDF from the browser; the print stylesheet lays out 8 cards per A4/carta page.
import { useTranslations } from "next-intl";
import { Printer } from "@phosphor-icons/react/dist/ssr";

export interface CardData {
  nickname: string;
  code: string;
  pin: string | null;
}

export function AccessCards({ cards, community, prefix }: { cards: CardData[]; community: string; prefix: string }) {
  const t = useTranslations("staff.cards");
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t("hint")}</p>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-full bg-violet-700 px-5 font-semibold text-white hover:bg-violet-800">
          <Printer size={18} weight="bold" aria-hidden /> {t("print")}
        </button>
      </div>
      <div className="print-cards grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <article key={c.code} className="relative overflow-hidden rounded-[1.25rem] border border-ink/10 bg-white p-5 [break-inside:avoid]">
            <div className="absolute -right-10 -top-10 size-28 rounded-full bg-violet" aria-hidden />
            <div className="absolute -right-2 top-10 size-10 rounded-full bg-pink" aria-hidden />
            <p className="relative text-xl font-extrabold leading-none tracking-tight">
              <span className="text-violet">CODE</span>
              <span className="text-pink">HER</span>
            </p>
            <p className="relative mt-3 text-lg font-bold">{t("hello", { name: c.nickname })}</p>
            <dl className="relative mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
              <dt className="text-xs font-semibold text-ink-muted">{t("code")}</dt>
              <dd className="font-mono text-2xl font-bold tracking-[0.12em]">{c.code}</dd>
              <dt className="text-xs font-semibold text-ink-muted">{t("pin")}</dt>
              <dd className="font-mono text-2xl font-bold tracking-[0.3em]">{c.pin ?? "____"}</dd>
            </dl>
            <p className="relative mt-3 border-t border-dashed border-line pt-2 text-xs text-ink-muted">
              {t("footer", { community, prefix })}
            </p>
          </article>
        ))}
      </div>
      <style>{`@media print { @page { margin: 12mm; } body * { visibility: hidden; } .print-cards, .print-cards * { visibility: visible; } .print-cards { position: absolute; left: 0; top: 0; width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; } }`}</style>
    </div>
  );
}
