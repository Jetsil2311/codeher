"use client";
// Link-based tabs/filters (URL is the source of truth) with the same gliding pill
// as <Segmented>. Scrolls horizontally on narrow screens and keeps the active tab in view.
import Link from "next/link";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { spring } from "./Segmented";

export function LinkTabs({ items, label, tone = "light", className, size = "md" }: { items: { href: string; label: ReactNode; active: boolean; icon?: ReactNode; count?: number }[]; label: string; tone?: "light" | "violet"; className?: string; size?: "sm" | "md" }) {
  const id = useId();
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('[aria-current="page"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" as ScrollBehavior });
  }, []);
  return (
    <LayoutGroup id={id}>
      <nav aria-label={label} className={cx("max-w-full", className)}>
        <div ref={box} className={cx("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1 [scrollbar-width:none]", tone === "light" ? "bg-white shadow-[0_1px_2px_rgb(27_16_48/0.05)] ring-1 ring-ink/[0.07]" : "bg-violet-100/80 ring-1 ring-violet/15")}>
          {items.map((it, i) => (
            <Link
              key={i}
              href={it.href}
              scroll={false}
              aria-current={it.active ? "page" : undefined}
              className={cx(
                "relative isolate inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors duration-200",
                size === "sm" ? "h-8 px-3 text-[0.8rem]" : "h-10 px-4 text-sm",
                it.active ? (tone === "light" ? "text-paper" : "text-violet-800") : "text-ink-soft hover:text-ink",
              )}
            >
              {it.active && <motion.span layoutId="link-pill" transition={reduce ? { duration: 0 } : spring} className={cx("absolute inset-0 -z-10 rounded-full", tone === "light" ? "bg-ink shadow-[0_6px_16px_-6px_rgb(27_16_48/0.55)]" : "bg-white shadow-[0_4px_14px_-4px_rgb(111_63_176/0.45)]")} aria-hidden />}
              {it.icon}
              {it.label}
              {it.count !== undefined && <span className={cx("max-[420px]:hidden min-w-5 rounded-full px-1.5 text-center text-[0.7rem] font-bold tabular-nums leading-5", it.active ? "bg-white/20" : "bg-ink/[0.06]")}>{it.count}</span>}
            </Link>
          ))}
        </div>
      </nav>
    </LayoutGroup>
  );
}
