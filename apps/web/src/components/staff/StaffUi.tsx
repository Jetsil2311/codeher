import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";
import { ResponsiveTable } from "./ResponsiveTable";
import { CountUp } from "@/components/motion/Motion";

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

export function Stat({ label, value, hint, tone = "plain", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "plain" | "ink" | "violet"; icon?: ReactNode }) {
  return (
    <div className={cx("group relative isolate overflow-hidden rounded-[1.4rem] p-4 transition md:p-5 duration-300 hover:-translate-y-0.5", tone === "ink" ? "bg-midnight text-paper shadow-[var(--shadow-lift)]" : tone === "violet" ? "bg-gradient-to-br from-violet-100 to-pink-100 ring-1 ring-violet/15" : "tile hover:shadow-[var(--shadow-lift)]")}>
      {tone === "ink" && <span className="absolute -right-10 -top-12 -z-10 size-36 rounded-full bg-pink/30 blur-2xl" aria-hidden />}
      <div className="flex items-start justify-between gap-3">
        <p className={cx("text-[0.8rem] font-semibold leading-snug md:text-sm", tone === "ink" ? "text-[#d6cdea]" : "text-ink-muted")}>{label}</p>
        {icon ? <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110", tone === "ink" ? "bg-white/10 text-pink" : tone === "violet" ? "bg-white text-violet-700" : "bg-violet-100 text-violet-700")}>{icon}</span> : null}
      </div>
      <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight md:text-4xl">{typeof value === "number" ? <CountUp value={value} /> : value}</p>
      {hint ? <p className={cx("mt-1 text-xs md:text-sm", tone === "ink" ? "text-[#b8acd6]" : "text-ink-muted")}>{hint}</p> : null}
    </div>
  );
}

export function Panel({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cx("tile rounded-[1.5rem] p-5 md:p-6", className)}>
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
  return <ResponsiveTable label={label}>{children}</ResponsiveTable>;
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
