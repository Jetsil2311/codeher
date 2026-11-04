"use client";
// Interruptores: flip the switches so every lamp turns on. Each lamp is a logic
// expression written with the same words as pseudocode (Y, O, NO). Endless: puzzles are
// generated so they always have a solution and never start solved.
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";
import { SolvedCard, type GameProps } from "../GameShell";

export type Expr = { v: number } | { not: Expr } | { and: [Expr, Expr] } | { or: [Expr, Expr] };
export const evalExpr = (e: Expr, s: boolean[]): boolean =>
  "v" in e ? s[e.v] : "not" in e ? !evalExpr(e.not, s) : "and" in e ? evalExpr(e.and[0], s) && evalExpr(e.and[1], s) : evalExpr(e.or[0], s) || evalExpr(e.or[1], s);

const NAMES = ["A", "B", "C", "D"];
const COLORS = ["bg-violet text-white", "bg-pink text-ink", "bg-sky text-ink", "bg-mint text-ink"];

// Deterministic PRNG so a level number always gives the same puzzle.
function rng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePuzzle(level: number) {
  const rand = rng(level * 7919 + 13);
  const switches = level < 2 ? 2 : level < 5 ? 3 : 4;
  const lamps = level < 1 ? 1 : level < 3 ? 2 : 3;
  const depth = level < 3 ? 1 : 2;
  for (let attempt = 0; attempt < 200; attempt++) {
    const target = Array.from({ length: switches }, () => rand() < 0.5);
    if (target.every((x) => !x)) target[Math.floor(rand() * switches)] = true;
    const leaf = (): Expr => {
      const v = Math.floor(rand() * switches);
      return rand() < 0.35 ? { not: { v } } : { v };
    };
    const build = (d: number): Expr => {
      if (d === 0) return leaf();
      const a = build(d - 1), b = build(d - 1);
      const e: Expr = rand() < 0.5 ? { and: [a, b] } : { or: [a, b] };
      return d === 2 && rand() < 0.25 ? { not: e } : e;
    };
    const list: Expr[] = [];
    let guard = 0;
    while (list.length < lamps && guard++ < 400) {
      const e = build(depth);
      if (evalExpr(e, target) && !list.some((x) => JSON.stringify(x) === JSON.stringify(e))) list.push(e);
    }
    const start = Array(switches).fill(false);
    if (list.length === lamps && !list.every((e) => evalExpr(e, start))) return { switches, lamps: list };
  }
  return { switches: 2, lamps: [{ and: [{ v: 0 }, { not: { v: 1 } }] } as Expr] };
}

function Show({ e, top = true }: { e: Expr; top?: boolean }) {
  if ("v" in e) return <span className={cx("inline-grid size-7 place-items-center rounded-lg font-mono text-sm font-bold", COLORS[e.v])}>{NAMES[e.v]}</span>;
  if ("not" in e)
    return (
      <span className="inline-flex items-center gap-1">
        <span className="rounded-md bg-pink-100 px-1.5 py-0.5 font-mono text-xs font-bold text-pink-700">NO</span>
        <Show e={e.not} top={false} />
      </span>
    );
  const [a, b] = "and" in e ? e.and : e.or;
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-1", !top && "rounded-lg bg-ink/[0.05] px-1 py-0.5")}>
      {!top && <span className="font-mono text-ink-muted">(</span>}
      <Show e={a} top={false} />
      <span className={cx("rounded-md px-1.5 py-0.5 font-mono text-xs font-bold", "and" in e ? "bg-violet-100 text-violet-800" : "bg-[#e7f6fd] text-[#035f80]")}>{"and" in e ? "Y" : "O"}</span>
      <Show e={b} top={false} />
      {!top && <span className="font-mono text-ink-muted">)</span>}
    </span>
  );
}

export function Interruptores({ onSolve, active, labels }: GameProps & { labels: Record<string, string> }) {
  const [level, setLevel] = useState(0);
  const puzzle = useMemo(() => makePuzzle(level), [level]);
  const [state, setState] = useState<boolean[]>(() => Array(4).fill(false));
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const lit = puzzle.lamps.map((e) => evalExpr(e, state));

  const flip = (i: number) => {
    if (won || !active) return;
    const next = state.map((x, j) => (j === i ? !x : x));
    setState(next);
    setMoves((m) => m + 1);
    if (puzzle.lamps.every((e) => evalExpr(e, next))) {
      setWon(true);
      onSolve(1);
    }
  };
  const nextLevel = () => {
    setLevel((l) => l + 1);
    setState(Array(4).fill(false));
    setMoves(0);
    setWon(false);
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-sm font-bold text-ink-muted">
        <span>{labels.level} {level + 1}</span>
        <span>{labels.moves}: {moves}</span>
      </div>

      <div className="relative overflow-hidden rounded-[1.6rem] bg-midnight p-4 shadow-[var(--shadow-lift)] md:p-6">
        <div className="blueprint-dark absolute inset-0 opacity-50" aria-hidden />
        <ul className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {puzzle.lamps.map((e, i) => (
            <li key={i} className={cx("flex items-center gap-3 rounded-2xl p-3 transition-colors duration-300", lit[i] ? "bg-white" : "bg-white/[0.08] ring-1 ring-white/10")}>
              <motion.span animate={lit[i] ? { scale: [1, 1.25, 1] } : { scale: 1 }} transition={{ duration: 0.35 }} className={cx("relative grid size-12 shrink-0 place-items-center rounded-full transition-colors duration-300", lit[i] ? "bg-sun text-sun-700 shadow-[0_0_30px_6px_rgb(254_228_64/0.65)]" : "bg-white/10 text-[#8f84b0]")} aria-label={lit[i] ? labels.on : labels.off}>
                <Lightbulb size={26} weight={lit[i] ? "fill" : "regular"} aria-hidden />
              </motion.span>
              <span className={cx("min-w-0 text-sm", lit[i] ? "text-ink" : "text-paper [&_.text-ink-muted]:text-[#8f84b0]")}>
                <Show e={e} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: puzzle.switches }, (_, i) => (
          <button key={i} type="button" role="switch" aria-checked={state[i]} aria-label={`${labels.switch} ${NAMES[i]}`} onClick={() => flip(i)} disabled={!active} className="group flex flex-col items-center gap-2 rounded-[1.4rem] bg-white p-4 ring-1 ring-ink/[0.07] transition active:scale-95">
            <span className={cx("grid size-9 place-items-center rounded-xl font-mono text-lg font-bold", COLORS[i])}>{NAMES[i]}</span>
            <span className={cx("relative h-9 w-16 rounded-full transition-colors duration-300", state[i] ? "bg-mint-700" : "bg-ink/15")}>
              <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 32 }} className={cx("absolute top-1 size-7 rounded-full bg-white shadow", state[i] ? "right-1" : "left-1")} />
            </span>
            <span className="font-mono text-xs font-bold text-ink-muted">{state[i] ? "Verdadero" : "Falso"}</span>
          </button>
        ))}
      </div>

      {won && <SolvedCard title={labels.win} body={labels.winBody.replace("{n}", String(moves))} action={labels.next} onNext={nextLevel} />}
      <p className="text-xs text-ink-muted">{labels.tip}</p>
    </div>
  );
}
