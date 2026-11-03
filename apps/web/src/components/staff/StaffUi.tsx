import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";

export function PageHead({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-8">
      {back ? (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline">
          <ArrowLeft size={16} weight="bold" aria-hidden /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-balance text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 max-w-[70ch] text-ink-soft">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, tone = "plain" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "plain" | "ink" | "violet" }) {
  return (
    <div className={cx("rounded-[1.25rem] p-5", tone === "ink" ? "bg-ink text-paper" : tone === "violet" ? "bg-violet-100" : "tile")}>
      <p className={cx("text-sm font-semibold", tone === "ink" ? "text-[#d6cdea]" : "text-ink-muted")}>{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{value}</p>
      {hint ? <p className={cx("mt-1 text-sm", tone === "ink" ? "text-[#b8acd6]" : "text-ink-muted")}>{hint}</p> : null}
    </div>
  );
}

export function Panel({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cx("tile p-5 md:p-6", className)}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-bold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function TableWrap({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="-mx-5 overflow-x-auto md:-mx-6" role="region" aria-label={label} tabIndex={0}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export const th = "px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-muted md:px-6";
export const td = "px-5 py-3 align-middle md:px-6";

export function relTime(iso: string | null, never: string) {
  if (!iso) return never;
  const diff = Date.now() - Date.parse(iso);
  const rtf = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });
  const m = Math.round(diff / 60000);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 48) return rtf.format(-h, "hour");
  return rtf.format(-Math.round(h / 24), "day");
}

/** Month name from the es-MX locale (no hard-coded strings). */
export function monthName(m: number) {
  return new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 15)));
}
