"use client";
// Small motion helpers shared by server pages: page entrance, staggered lists,
// count-up numbers and a progress ring. All static under prefers-reduced-motion.
import { animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

const ease = [0.16, 1, 0.3, 1] as const;

export function PageIn({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
      {children}
    </motion.div>
  );
}

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease } },
};

export function Stagger({ children, className, as = "div", inView = false }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" | "section"; inView?: boolean }) {
  const reduce = useReducedMotion();
  const C = motion[as];
  if (reduce) return <C className={className}>{children}</C>;
  return (
    <C className={className} variants={list} initial="hidden" {...(inView ? { whileInView: "show", viewport: { once: true, amount: 0.15 } } : { animate: "show" })}>
      {children}
    </C>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" | "article" }) {
  const C = motion[as];
  return (
    <C className={className} variants={item}>
      {children}
    </C>
  );
}

export function CountUp({ value, className, duration = 1.1 }: { value: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!seen || reduce) {
      if (reduce) setN(value);
      return;
    }
    const c = animate(0, value, { duration, ease, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [seen, value, reduce, duration]);
  return (
    <span ref={ref} className={cx("tabular-nums", className)}>
      {n}
    </span>
  );
}

/** Circular progress with the brand gradient. value: 0..1 */
export function Ring({ value, size = 72, stroke = 7, children, className, track = "rgb(155 93 229 / 0.15)", label }: { value: number; size?: number; stroke?: number; children?: ReactNode; className?: string; track?: string; label?: string }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const id = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className={cx("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9b5de5" />
            <stop offset="100%" stopColor="#f15bb5" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - v) : c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(v, 0.02)) }}
          transition={{ duration: reduce ? 0 : 1.2, ease, delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
