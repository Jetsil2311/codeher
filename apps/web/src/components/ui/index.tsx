// UI primitives built on the brand tokens (brief section 2). Server-safe (no hooks).
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CheckCircle, Fire, LockSimple, Lightning, Star, TerminalWindow, TextAa, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

// ---------- Buttons ----------
// Buttons: Ink text on Pink, or white text on Violet 700. Never white on brand Pink.
type Variant = "primary" | "violet" | "ghost" | "quiet" | "danger" | "dark";
const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition-[transform,background-color,box-shadow,color] duration-200 ease-[var(--ease-spring)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-45 cursor-pointer touch-manipulation";
const variants: Record<Variant, string> = {
  primary: "bg-pink text-ink shadow-[var(--shadow-pop)] hover:-translate-y-0.5 hover:bg-[#f36cbd] grad-edge",
  violet: "bg-violet-700 text-white hover:bg-violet-800 hover:-translate-y-0.5 shadow-[0_14px_30px_-14px_rgb(111_63_176/0.8)]",
  ghost: "bg-white text-ink ring-1 ring-ink/12 hover:ring-violet-700/40 hover:bg-violet-50",
  quiet: "text-violet-700 hover:bg-violet-100",
  danger: "bg-white text-danger ring-1 ring-danger/30 hover:bg-danger/5",
  dark: "bg-white/10 text-paper ring-1 ring-white/15 hover:bg-white/16",
};
const sizes = { sm: "h-9 px-4 text-sm", md: "h-10 px-5 text-[0.95rem]", lg: "h-12 px-7 text-base" } as const;

export function Button({ variant = "primary", size = "md", className, loading, children, ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes; loading?: boolean }) {
  return (
    <button {...rest} aria-busy={loading || undefined} className={cx(base, variants[variant], sizes[size], className)}>
      {loading ? <CircleNotch className="animate-spin" size={18} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", className, children, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return (
    <Link {...rest} className={cx(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

// ---------- Language badge: shape plus text, never color alone (brief 5B) ----------
export function LanguageBadge({ language, label, size = "md", tone = "light" }: { language: CodeLanguage; label: string; size?: "sm" | "md"; tone?: "light" | "dark" }) {
  const py = language === "python";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 font-mono font-medium",
        size === "sm" ? "h-6 px-2 text-[0.72rem]" : "h-7 px-2.5 text-xs",
        py ? "rounded-md" : "rounded-full",
        tone === "light"
          ? py ? "bg-[#e7f6fd] text-[#035f80] ring-1 ring-[#00bbf9]/40" : "bg-violet-100 text-violet-800 ring-1 ring-violet/40"
          : py ? "bg-sky/15 text-sky ring-1 ring-sky/40" : "bg-violet/20 text-[#d9c2fa] ring-1 ring-violet/50",
      )}
    >
      {py ? <TerminalWindow size={size === "sm" ? 13 : 15} weight="bold" aria-hidden /> : <TextAa size={size === "sm" ? 13 : 15} weight="bold" aria-hidden />}
      {label}
    </span>
  );
}

// ---------- Tags / chips ----------
export function Tag({ children, tone = "violet", className }: { children: ReactNode; tone?: "violet" | "pink" | "mint" | "sun" | "ink" | "line"; className?: string }) {
  const tones = {
    violet: "bg-violet-100 text-violet-800",
    pink: "bg-pink-100 text-pink-700",
    mint: "bg-[#d9fbf5] text-mint-700",
    sun: "bg-[#fff8c7] text-sun-700",
    ink: "bg-ink text-paper",
    line: "bg-white text-ink-soft ring-1 ring-line",
  };
  return <span className={cx("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

// ---------- Status (icon + word) ----------
export function LessonState({ status, unlocked, labels }: { status: "not_started" | "in_progress" | "completed"; unlocked: boolean; labels: { locked: string; progress: string; done: string; new: string } }) {
  if (!unlocked)
    return (
      <Tag tone="line">
        <LockSimple size={13} weight="bold" aria-hidden /> {labels.locked}
      </Tag>
    );
  if (status === "completed")
    return (
      <Tag tone="mint">
        <CheckCircle size={14} weight="fill" aria-hidden /> {labels.done}
      </Tag>
    );
  if (status === "in_progress")
    return (
      <Tag tone="pink">
        <Lightning size={13} weight="fill" aria-hidden /> {labels.progress}
      </Tag>
    );
  return <Tag tone="violet">{labels.new}</Tag>;
}

// ---------- Tiles ----------
export function Tile({ className, children, as: As = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" | "li" } & Record<string, unknown>) {
  return (
    <As {...rest} className={cx("tile", className)}>
      {children}
    </As>
  );
}

// ---------- Progress with the signature gradient ----------
export function Progress({ value, label, className, tone = "light" }: { value: number; label: string; className?: string; tone?: "light" | "dark" }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className={cx("h-2.5 overflow-hidden rounded-full", tone === "light" ? "bg-violet-100" : "bg-white/12", className)}>
      <div className="h-full rounded-full bg-grad transition-[width] duration-500 ease-[var(--ease-out-soft)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- Reward pills: XP in Sun, streak with flame, completed in Mint ----------
export function XpPill({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff8c7] px-3 py-1 text-sm font-bold text-sun-700">
      <Star size={16} weight="fill" className="text-[#e0b800]" aria-hidden /> {value} <span className="font-semibold">{label}</span>
    </span>
  );
}
export function StreakPill({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-3 py-1 text-sm font-bold text-pink-700">
      <Fire size={16} weight="fill" className="text-pink" aria-hidden /> {value} <span className="font-semibold">{label}</span>
    </span>
  );
}

// ---------- Forms: label above input, helper and error below ----------
export function Field({ label, htmlFor, helper, error, children, className }: { label: string; htmlFor: string; helper?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : helper ? (
        <p className="text-sm text-ink-muted">{helper}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base text-ink placeholder:text-ink-muted/80 transition focus:border-violet-700 focus:outline-none focus:ring-4 focus:ring-violet/20 disabled:bg-paper";
export const textareaClass =
  "w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-base text-ink placeholder:text-ink-muted/80 transition focus:border-violet-700 focus:outline-none focus:ring-4 focus:ring-violet/20";
export const selectClass = inputClass + " appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10";

// ---------- Empty state ----------
export function EmptyState({ title, body, action, icon }: { title: string; body: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-tile)] border border-dashed border-violet/35 bg-white/60 px-6 py-12 text-center">
      {icon ? <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-700">{icon}</div> : null}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 max-w-[42ch] text-ink-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, accent, className, as: As = "h2" }: { children: ReactNode; accent?: ReactNode; className?: string; as?: "h1" | "h2" | "h3" }) {
  return (
    <As className={cx("text-balance font-extrabold tracking-tight text-ink", As === "h1" ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl", className)}>
      {children}
      {accent ? (
        <>
          {" "}
          <span className="font-accent font-semibold italic text-pink-700">{accent}</span>
        </>
      ) : null}
    </As>
  );
}

/** Decorative floating code glyphs at low opacity (brief 2.4). */
export function CodeGlyphs({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const glyphs = [
    { g: "{ }", c: "left-[6%] top-[14%] text-5xl", r: "-8deg", d: "0s" },
    { g: "</>", c: "right-[8%] top-[10%] text-4xl", r: "6deg", d: "1.2s" },
    { g: "( )", c: "left-[12%] bottom-[12%] text-4xl", r: "4deg", d: "2.1s" },
    { g: "<-", c: "right-[14%] bottom-[18%] text-3xl", r: "-5deg", d: "0.6s" },
  ];
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {glyphs.map((x) => (
        <span
          key={x.g}
          className={cx("absolute font-mono font-bold motion-safe:animate-float", x.c, tone === "light" ? "text-violet/15" : "text-violet-300/20")}
          style={{ ["--r" as string]: x.r, animationDelay: x.d }}
        >
          {x.g}
        </span>
      ))}
    </div>
  );
}

export function Avatar({ id, size = 44, className }: { id: string; size?: number; className?: string }) {
  // Preset geometric avatars (no photos of minors).
  const presets: Record<string, [string, string, string]> = {
    orbita: ["#9b5de5", "#f15bb5", "circle"],
    cometa: ["#f15bb5", "#fee440", "tri"],
    chispa: ["#00bbf9", "#9b5de5", "diamond"],
    nebula: ["#1a1036", "#f15bb5", "ring"],
    pixel: ["#00f5d4", "#1a1036", "grid"],
    prisma: ["#fee440", "#9b5de5", "tri"],
    eco: ["#8d55d0", "#00f5d4", "ring"],
    nodo: ["#ba468b", "#00bbf9", "grid"],
  };
  const [a, b, shape] = presets[id] ?? presets.orbita;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={cx("shrink-0 rounded-2xl", className)} aria-hidden>
      <rect width="48" height="48" rx="14" fill={a} />
      {shape === "circle" && <circle cx="30" cy="18" r="12" fill={b} />}
      {shape === "tri" && <path d="M8 40 L24 10 L40 40 Z" fill={b} />}
      {shape === "diamond" && <path d="M24 6 L42 24 L24 42 L6 24 Z" fill={b} />}
      {shape === "ring" && <circle cx="24" cy="24" r="12" fill="none" stroke={b} strokeWidth="6" />}
      {shape === "grid" && (
        <g fill={b}>
          <rect x="10" y="10" width="10" height="10" rx="3" />
          <rect x="28" y="10" width="10" height="10" rx="3" />
          <rect x="10" y="28" width="10" height="10" rx="3" />
          <rect x="28" y="28" width="10" height="10" rx="3" />
        </g>
      )}
    </svg>
  );
}
