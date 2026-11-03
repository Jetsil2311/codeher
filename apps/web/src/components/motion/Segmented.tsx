"use client";
// Segmented control / tab strip with a spring "pill" that slides between options
// (shared layout animation). Used for every language switch, filter and tab set.
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cx } from "@/components/ui";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Optional count bubble. */
  count?: number;
}

export const spring = { type: "spring", stiffness: 520, damping: 38, mass: 0.9 } as const;
export const softSpring = { type: "spring", stiffness: 300, damping: 30 } as const;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = "light",
  size = "md",
  className,
  stretch,
  role = "tablist",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  tone?: "light" | "dark" | "violet";
  size?: "sm" | "md";
  className?: string;
  /** Options share the full width. */
  stretch?: boolean;
  role?: "tablist" | "radiogroup";
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const track = {
    light: "bg-white ring-1 ring-ink/[0.07] shadow-[0_1px_2px_rgb(27_16_48/0.05)]",
    dark: "bg-white/[0.07] ring-1 ring-white/10",
    violet: "bg-violet-100/80 ring-1 ring-violet/15",
  }[tone];
  const pill = {
    light: "bg-ink shadow-[0_6px_16px_-6px_rgb(27_16_48/0.55)]",
    dark: "bg-paper shadow-[0_6px_18px_-6px_rgb(0_0_0/0.6)]",
    violet: "bg-white shadow-[0_4px_14px_-4px_rgb(111_63_176/0.45)]",
  }[tone];
  const on = { light: "text-paper", dark: "text-ink", violet: "text-violet-800" }[tone];
  const off = {
    light: "text-ink-soft hover:text-ink",
    dark: "text-[#d6cdea] hover:text-paper",
    violet: "text-ink-soft hover:text-ink",
  }[tone];
  const h = size === "sm" ? "h-8 px-3 text-[0.8rem]" : "h-10 px-4 text-sm";
  const itemRole = role === "tablist" ? "tab" : "radio";
  return (
    <LayoutGroup id={id}>
      <div role={role} aria-label={label} className={cx("relative inline-flex max-w-full items-center gap-0.5 rounded-full p-1", track, stretch && "flex w-full", className)}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role={itemRole}
              aria-selected={itemRole === "tab" ? active : undefined}
              aria-checked={itemRole === "radio" ? active : undefined}
              onClick={() => onChange(o.value)}
              className={cx(
                "relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors duration-200 touch-manipulation",
                h,
                stretch && "flex-1",
                active ? on : off,
              )}
            >
              {active && <motion.span layoutId="seg-pill" transition={reduce ? { duration: 0 } : spring} className={cx("absolute inset-0 -z-10 rounded-full", pill)} aria-hidden />}
              {o.icon}
              <span>{o.label}</span>
              {o.count !== undefined && (
                <span className={cx("min-w-5 rounded-full px-1.5 text-[0.7rem] font-bold tabular-nums leading-5", active ? (tone === "dark" ? "bg-ink/10" : "bg-white/20") : "bg-ink/[0.06]")}>{o.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
