"use client";
// Torres: the classic Tower of Hanoi (a public-domain mathematical puzzle from 1883).
// Move the whole tower to another peg, one disc at a time, never a big one on a small one.
// The minimum is 2ⁿ − 1 moves: matching it earns an extra star (recursion in disguise).
import { useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";
import { SolvedCard, type GameProps } from "../GameShell";

const DISC = ["from-violet to-pink", "from-pink to-[#ff9f6b]", "from-[#00bbf9] to-violet", "from-[#00c9a7] to-[#00bbf9]", "from-[#f7b500] to-pink", "from-[#7b3fd1] to-[#00bbf9]", "from-pink to-violet"];

export function Torres({ onSolve, active, labels }: GameProps & { labels: Record<string, string> }) {
  const [discs, setDiscs] = useState(3);
  const fresh = (n: number) => [Array.from({ length: n }, (_, i) => n - i), [], []] as number[][];
  const [pegs, setPegs] = useState<number[][]>(() => fresh(3));
  const [held, setHeld] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [bump, setBump] = useState<number | null>(null);
  const min = 2 ** discs - 1;

  const tapPeg = (i: number) => {
    if (won || !active) return;
    if (held === null) {
      if (pegs[i].length) setHeld(i);
      return;
    }
    if (held === i) return setHeld(null);
    const disc = pegs[held][pegs[held].length - 1];
    const top = pegs[i][pegs[i].length - 1];
    if (top !== undefined && top < disc) {
      setBump(i);
      setTimeout(() => setBump(null), 400);
      return setHeld(null);
    }
    const next = pegs.map((p) => [...p]);
    next[held].pop();
    next[i].push(disc);
    setPegs(next);
    setHeld(null);
    const m = moves + 1;
    setMoves(m);
    if (i !== 0 && next[i].length === discs) {
      setWon(true);
      onSolve(m === min ? 2 : 1);
    }
  };
  const nextLevel = () => {
    const n = Math.min(7, discs + 1);
    setDiscs(n);
    setPegs(fresh(n));
    setMoves(0);
    setWon(false);
  };
  const restart = () => {
    setPegs(fresh(discs));
    setMoves(0);
    setHeld(null);
    setWon(false);
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-sm font-bold text-ink-muted">
        <span>{labels.discs}: {discs}</span>
        <span>{labels.moves}: {moves} · {labels.min}: {min}</span>
      </div>
      <LayoutGroup>
        <div className="relative grid h-[min(60vh,22rem)] grid-cols-3 gap-2 overflow-hidden rounded-[1.6rem] bg-midnight p-3 pt-14 shadow-[var(--shadow-lift)] sm:gap-4 sm:p-5 sm:pt-16">
          <div className="blueprint-dark absolute inset-0 opacity-50" aria-hidden />
          {pegs.map((peg, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => tapPeg(i)}
              disabled={!active}
              animate={bump === i ? { x: [0, -8, 8, -5, 0] } : {}}
              aria-label={`${labels.peg} ${i + 1}${held === i ? `, ${labels.selected}` : ""}`}
              className={cx("relative flex flex-col-reverse items-center justify-start rounded-2xl pb-3 transition-colors", held === i ? "bg-white/[0.1]" : "hover:bg-white/[0.05]")}
            >
              <span className="absolute bottom-3 left-1/2 w-2 -translate-x-1/2 rounded-full bg-white/20" style={{ height: `${Math.min(90, 14 + discs * 11)}%` }} aria-hidden />
              <span className="relative z-10 mb-0 h-2.5 w-[92%] rounded-full bg-white/30" aria-hidden />
              {peg.map((d, k) => {
                const lifted = held === i && k === peg.length - 1;
                return (
                  <motion.span
                    key={d}
                    layoutId={`disc-${d}`}
                    animate={{ y: lifted ? -36 : 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    className={cx("relative z-10 mt-1 block h-7 rounded-full bg-gradient-to-r shadow-[inset_0_-4px_0_rgb(0_0_0/0.2),0_6px_12px_-6px_rgb(0_0_0/0.6)] sm:h-8", DISC[d - 1])}
                    style={{ width: `${30 + (d / discs) * 62}%` }}
                    aria-hidden
                  />
                );
              })}
            </motion.button>
          ))}
        </div>
      </LayoutGroup>
      <div className="flex gap-2">
        <button type="button" onClick={restart} className="h-11 rounded-full bg-white px-5 text-sm font-semibold ring-1 ring-ink/10">{labels.restart}</button>
        <p className="flex-1 self-center text-xs text-ink-muted">{labels.tip}</p>
      </div>
      {won && (
        <SolvedCard
          title={moves === min ? labels.perfect : labels.win}
          body={moves === min ? labels.perfectBody : labels.winBody.replace("{n}", String(moves)).replace("{min}", String(min))}
          action={discs >= 7 ? labels.again : labels.next}
          onNext={discs >= 7 ? restart : nextLevel}
        />
      )}
      {won && moves === min && (
        <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} className="pointer-events-none fixed right-6 top-28 z-20" aria-hidden>
          <Star size={56} weight="fill" className="text-sun drop-shadow-[0_0_20px_rgb(254_228_64/0.8)]" />
        </motion.span>
      )}
    </div>
  );
}
