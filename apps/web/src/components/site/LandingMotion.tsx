"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";

/** Gradient rail that draws itself when it scrolls into view. */
export function DrawLine({ className, vertical }: { className?: string; vertical?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className={cx("bg-grad", className)}
      style={{ originX: 0, originY: 0 }}
      initial={reduce ? false : vertical ? { scaleY: 0 } : { scaleX: 0 }}
      whileInView={vertical ? { scaleY: 1 } : { scaleX: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}

/** Accessible accordion with a smooth height animation (one open at a time). */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();
  return (
    <div className="space-y-3">
      {items.map((f, i) => {
        const on = open === i;
        return (
          <div key={i} className={cx("overflow-hidden rounded-[1.4rem] bg-white ring-1 transition-shadow duration-300", on ? "shadow-[var(--shadow-lift)] ring-violet/25" : "shadow-[var(--shadow-tile)] ring-ink/[0.06]")}>
            <h3>
              <button type="button" aria-expanded={on} aria-controls={`faq-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(on ? null : i)} className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[1.05rem] font-bold text-ink md:px-6 md:text-lg">
                {f.q}
                <motion.span animate={{ rotate: on ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className={cx("grid size-9 shrink-0 place-items-center rounded-full transition-colors", on ? "bg-ink text-paper" : "bg-violet-100 text-violet-700")}>
                  <Plus size={16} weight="bold" aria-hidden />
                </motion.span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div id={`faq-${i}`} role="region" aria-labelledby={`faq-q-${i}`} initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
                  <p className="px-5 pb-5 text-ink-soft md:px-6">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/** Endless strip of code fragments (pauses under reduced motion). */
export function CodeMarquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-ink/[0.06] bg-white py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]" aria-hidden>
      <div className="flex w-max gap-3 motion-safe:animate-[marquee_38s_linear_infinite]">
        {row.map((s, i) => (
          <span key={i} className={cx("inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 font-mono text-sm font-medium", i % 4 === 0 ? "bg-midnight text-mint" : i % 4 === 1 ? "bg-violet-100 text-violet-800" : i % 4 === 2 ? "bg-pink-100 text-pink-700" : "bg-[#e7f6fd] text-[#035f80]")}>
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
