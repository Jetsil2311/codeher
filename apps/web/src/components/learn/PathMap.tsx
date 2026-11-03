"use client";
// "Mi ruta" as a circuit board: each lesson is a chip on a winding trace. The trace
// lights up (brand gradient) up to the current lesson; the current chip pulses and
// carries a floating "Aquí vas" tag. Locked chips stay readable and tappable.
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { Check, LockSimple, Play, Star } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";
import { LanguageBadge, cx } from "@/components/ui";

export interface PathLesson {
  id: string;
  slug: string;
  title: string;
  summary: string;
  language: CodeLanguage;
  seq: number;
  status: "not_started" | "in_progress" | "completed";
  unlocked: boolean;
}

const X = [50, 72, 80, 66, 44, 26, 20, 34]; // % positions along the snake
const ROW = 132;

export function PathMap({ lessons, labels, langLabels }: { lessons: PathLesson[]; labels: { here: string; start: string; locked: string; done: string; current: string; node: string }; langLabels: Record<CodeLanguage, string> }) {
  const reduce = useReducedMotion();
  const gid = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const currentIdx = lessons.findIndex((l) => l.unlocked && l.status !== "completed");
  const litUntil = currentIdx === -1 ? lessons.length - 1 : currentIdx;
  const pts = lessons.map((_, i) => ({ x: X[i % X.length], y: i * ROW + 48 }));
  const H = Math.max(1, lessons.length) * ROW;
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }) => `M ${a.x} ${a.y} C ${a.x} ${a.y + ROW * 0.55}, ${b.x} ${b.y - ROW * 0.55}, ${b.x} ${b.y}`;

  return (
    <ol className="relative mx-auto w-full max-w-xl" style={{ height: H }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9b5de5" />
            <stop offset="100%" stopColor="#f15bb5" />
          </linearGradient>
        </defs>
        {pts.slice(1).map((b, i) => {
          const a = pts[i];
          const lit = i + 1 <= litUntil;
          return (
            <g key={i}>
              <path d={seg(a, b)} fill="none" stroke="rgb(27 16 48 / 0.08)" strokeWidth={10} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {lit ? (
                <motion.path d={seg(a, b)} fill="none" stroke={`url(#${gid})`} strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.18, ease: "easeOut" }} />
              ) : (
                <path d={seg(a, b)} fill="none" stroke="rgb(27 16 48 / 0.18)" strokeWidth={2.5} strokeDasharray="2 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              )}
            </g>
          );
        })}
      </svg>

      {lessons.map((l, i) => {
        const p = pts[i];
        const done = l.status === "completed";
        const current = i === currentIdx;
        const locked = !l.unlocked;
        const right = p.x < 50; // label goes to the right of the chip
        const state = done ? labels.done : current ? labels.current : locked ? labels.locked : "";
        return (
          <motion.li
            key={l.id}
            className="absolute inset-x-0"
            style={{ top: p.y - 36 }}
            initial={reduce ? false : { opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24, delay: 0.1 + i * 0.08 }}
          >
            <Link href={`/app/leccion/${l.slug}`} aria-label={labels.node.replace("{n}", String(l.seq)).replace("{title}", l.title).replace("{state}", state)} className="group absolute block" style={{ left: `calc(${p.x}% - 36px)` }}>
              {current && (
                <>
                  <span className="absolute inset-0 rounded-[1.6rem] bg-pink/40 motion-safe:animate-[pulse-ring_1.8s_ease-out_infinite]" aria-hidden />
                  <span className="absolute -top-10 left-1/2 z-10 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper shadow-lg motion-safe:animate-[bob_2.2s_ease-in-out_infinite]" style={{ transform: "translateX(-50%)" }} aria-hidden>
                    {labels.here}
                    <span className="absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-ink" />
                  </span>
                </>
              )}
              <span
                className={cx(
                  "relative grid size-[72px] place-items-center rounded-[1.6rem] transition-transform duration-300 group-hover:scale-105 group-active:scale-95",
                  done && "bg-gradient-to-br from-[#00c9a7] to-mint-700 text-white shadow-[0_10px_0_-2px_#00594f,0_18px_30px_-12px_rgb(0_121_107/0.7)]",
                  current && "bg-gradient-to-br from-violet to-pink text-white shadow-[0_10px_0_-2px_#8a3a8f,0_22px_40px_-14px_rgb(241_91_181/0.9)]",
                  !done && !current && (locked ? "bg-[#ece8f3] text-ink-muted shadow-[0_8px_0_-2px_#d6d0e2]" : "bg-white text-violet-700 shadow-[0_8px_0_-2px_#ddd3ef] ring-2 ring-violet/25"),
                )}
                aria-hidden
              >
                {/* chip pins */}
                <span className="absolute -left-1.5 top-1/2 flex -translate-y-1/2 flex-col gap-1.5">
                  {[0, 1].map((k) => <span key={k} className={cx("h-1 w-1.5 rounded-full", done || current ? "bg-white/70" : "bg-ink/15")} />)}
                </span>
                <span className="absolute -right-1.5 top-1/2 flex -translate-y-1/2 flex-col gap-1.5">
                  {[0, 1].map((k) => <span key={k} className={cx("h-1 w-1.5 rounded-full", done || current ? "bg-white/70" : "bg-ink/15")} />)}
                </span>
                {done ? <Check size={30} weight="bold" /> : current ? <Play size={28} weight="fill" /> : locked ? <LockSimple size={24} weight="bold" /> : <Star size={26} weight="fill" />}
                <span className={cx("absolute -bottom-2 -right-2 grid size-7 place-items-center rounded-full font-mono text-xs font-bold ring-[3px] ring-paper", done || current ? "bg-ink text-paper" : "bg-white text-ink-soft")}>{l.seq}</span>
              </span>
            </Link>
            <div
              className={cx("absolute top-1 w-[calc(50%-3rem)] max-w-56", right ? "text-left" : "text-right")}
              style={right ? { left: `calc(${p.x}% + 52px)` } : { right: `calc(${100 - p.x}% + 52px)` }}
              aria-hidden
            >
              <p className={cx("text-[0.95rem] font-extrabold leading-tight", locked && !current ? "text-ink-soft" : "text-ink")}>{l.title}</p>
              <div className={cx("mt-1.5 flex flex-wrap items-center gap-1.5", right ? "justify-start" : "justify-end")}>
                <LanguageBadge language={l.language} label={langLabels[l.language]} size="sm" />
                {current && <span className="rounded-full bg-pink px-2 py-0.5 text-[0.7rem] font-bold text-ink">{labels.start}</span>}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
