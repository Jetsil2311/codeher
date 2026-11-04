"use client";
// Frame around every Recreo game: countdown to the server's end time, live score,
// score reporting after each solved puzzle, and the friendly "time's up" screen.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, BookOpenText, Star, Trophy } from "@phosphor-icons/react/dist/ssr";
import { recreoScoreAction, recreoStatusAction } from "@/app/actions/student";
import { celebrate } from "@/components/code/celebrate";
import { Ring } from "@/components/motion/Motion";
import type { GameId } from "@/server/db/types";

export interface GameProps {
  /** Call when a puzzle is solved. */
  onSolve: (points?: number) => void;
  /** False once the break is over: games stop accepting moves. */
  active: boolean;
}

export interface ShellLabels {
  back: string;
  score: string;
  best: string;
  timeLeft: string;
  overTitle: string;
  overBody: string;
  backToLearn: string;
  moreGames: string;
  solved: string;
}

export function GameShell({ game, title, endsAt, minutes, best: initialBest, initialScore, labels, children }: { game: GameId; title: string; endsAt: string; minutes: number; best: number; initialScore: number; labels: ShellLabels; children: (p: GameProps) => ReactNode }) {
  const reduce = useReducedMotion();
  const [end, setEnd] = useState(() => Date.parse(endsAt));
  // Staff can end (or extend) a free break at any time: re-check the server regularly.
  useEffect(() => {
    const id = setInterval(async () => {
      const r = await recreoStatusAction();
      if (!r.ok) return;
      const a = r.data.active;
      setEnd(a ? Date.parse(a.ends_at) : Date.now());
    }, 15_000);
    return () => clearInterval(id);
  }, []);
  // Clock starts after mount so the server and browser render the same markup.
  const [now, setNow] = useState<number | null>(null);
  const [score, setScore] = useState(initialScore);
  const [best, setBest] = useState(initialBest);
  const [toast, setToast] = useState(0);
  const [gain, setGain] = useState(1);
  const scoreRef = useRef(initialScore);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = now === null ? minutes * 60_000 : Math.max(0, end - now);
  const over = now !== null && left <= 0;
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);

  const onSolve = useCallback(
    (points = 1) => {
      if (Date.now() > end) return;
      scoreRef.current += points;
      setScore(scoreRef.current);
      setGain(points);
      setToast((t) => t + 1);
      celebrate(false);
      void recreoScoreAction(game, scoreRef.current).then((r) => r.ok && setBest(r.data.best));
    },
    [end, game],
  );

  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col px-4 pb-6 pt-3 md:px-6 lg:min-h-dvh lg:pt-6">
      <header className="flex items-center gap-3">
        <Link href="/app/recreo" aria-label={labels.back} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink ring-1 ring-ink/[0.07] transition active:scale-90">
          <ArrowLeft size={20} weight="bold" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight md:text-2xl">{title}</h1>
        <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#fff8c7] px-3.5 text-sm font-bold text-sun-700" aria-label={`${labels.score}: ${score}`}>
          <Star size={16} weight="fill" className="text-[#e0b800]" aria-hidden />
          <motion.span key={score} initial={reduce ? false : { scale: 1.6 }} animate={{ scale: 1 }} className="tabular-nums">{score}</motion.span>
        </span>
        <div role="timer" aria-label={`${labels.timeLeft}: ${mm}:${String(ss).padStart(2, "0")}`} className="shrink-0">
          <Ring value={left / (minutes * 60_000)} size={52} stroke={5}>
            <span className={`font-mono text-[0.72rem] font-bold tabular-nums ${left < 30_000 ? "text-pink-700" : ""}`}>
              {now === null ? "--:--" : `${mm}:${String(ss).padStart(2, "0")}`}
            </span>
          </Ring>
        </div>
      </header>

      <div className="relative mt-4 flex flex-1 flex-col">{children({ onSolve, active: !over })}</div>

      <AnimatePresence>
        {toast > 0 && !over && (
          <motion.div key={toast} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 400, damping: 24 }} onAnimationComplete={() => setTimeout(() => setToast(0), 900)} className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper shadow-[var(--shadow-lift)]" role="status">
            {labels.solved.replace("{n}", String(gain))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {over && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[70] grid place-items-center bg-midnight/60 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="recreo-over">
            <motion.div initial={reduce ? false : { scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white p-6 text-center shadow-[var(--shadow-lift)]">
              <div className="absolute -right-12 -top-12 size-40 rounded-full bg-pink-100" aria-hidden />
              <div className="absolute -bottom-14 -left-10 size-40 rounded-full bg-violet-100" aria-hidden />
              <div className="relative">
                <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-grad text-white shadow-[var(--shadow-pop)]"><Trophy size={32} weight="fill" aria-hidden /></span>
                <h2 id="recreo-over" className="mt-4 text-2xl font-extrabold tracking-tight">{labels.overTitle}</h2>
                <p className="mt-1 text-ink-muted">{labels.overBody}</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-paper p-3"><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{labels.score}</p><p className="text-3xl font-extrabold tabular-nums">{score}</p></div>
                  <div className="rounded-2xl bg-paper p-3"><p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{labels.best}</p><p className="text-3xl font-extrabold tabular-nums">{Math.max(best, score)}</p></div>
                </div>
                <Link href="/app/ruta" className="grad-edge mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-pink font-bold text-ink shadow-[var(--shadow-pop)]">
                  <BookOpenText size={18} weight="bold" aria-hidden /> {labels.backToLearn}
                </Link>
                <Link href="/app/recreo" className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-ink-soft hover:bg-paper">{labels.moreGames}</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small "level solved" card used inside games. */
export function SolvedCard({ title, body, action, onNext }: { title: string; body?: string; action: string; onNext: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 26 }} className="flex items-center gap-3 rounded-[1.4rem] bg-midnight p-3 pl-4 text-paper shadow-[var(--shadow-lift)]">
      <div className="min-w-0 flex-1">
        <p className="font-accent text-lg italic text-pink">{title}</p>
        {body ? <p className="text-sm text-[#d6cdea]">{body}</p> : null}
      </div>
      <button type="button" onClick={onNext} autoFocus className="inline-flex h-11 shrink-0 items-center rounded-full bg-pink px-5 font-bold text-ink active:scale-95">
        {action}
      </button>
    </motion.div>
  );
}
