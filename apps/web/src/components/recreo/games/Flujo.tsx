"use client";
// Flujo: rotate the pipe tiles so water from the well reaches every plant of the milpa.
// Each board is a random spanning tree (every tile is needed), so there is always a
// solution; the water spreads live as connections are made (graphs and paths).
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Drop, Plant, Flower } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";
import { SolvedCard, type GameProps } from "../GameShell";

const N = 1, E = 2, S = 4, W = 8;
const DIRS = [
  { bit: N, dr: -1, dc: 0, opp: S },
  { bit: E, dr: 0, dc: 1, opp: W },
  { bit: S, dr: 1, dc: 0, opp: N },
  { bit: W, dr: 0, dc: -1, opp: E },
];
const rot = (m: number, k: number) => {
  let x = m;
  for (let i = 0; i < k; i++) x = ((x << 1) | (x >> 3)) & 15;
  return x;
};

function rng(seed: number) {
  let t = seed + 0x9e3779b9;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeBoard(level: number) {
  const size = Math.min(7, 4 + Math.floor(level / 2));
  const rand = rng(level * 104729 + 7);
  const conn = Array.from({ length: size }, () => Array(size).fill(0));
  const seen = Array.from({ length: size }, () => Array(size).fill(false));
  const src: [number, number] = [Math.floor(size / 2), 0];
  const stack: [number, number][] = [src];
  seen[src[0]][src[1]] = true;
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const opts = DIRS.filter((d) => {
      const nr = r + d.dr, nc = c + d.dc;
      return nr >= 0 && nc >= 0 && nr < size && nc < size && !seen[nr][nc];
    });
    if (!opts.length) {
      stack.pop();
      continue;
    }
    const d = opts[Math.floor(rand() * opts.length)];
    const nr = r + d.dr, nc = c + d.dc;
    conn[r][c] |= d.bit;
    conn[nr][nc] |= d.opp;
    seen[nr][nc] = true;
    stack.push([nr, nc]);
  }
  // Scramble, making sure the board does not start solved.
  const turns = conn.map((row) => row.map(() => Math.floor(rand() * 4)));
  turns[src[0]][src[1]] = (turns[src[0]][src[1]] + 1) % 4 || 1;
  return { size, solved: conn, turns, src };
}

function watered(size: number, tiles: number[][], src: [number, number]) {
  const wet = Array.from({ length: size }, () => Array(size).fill(false));
  const q = [src];
  wet[src[0]][src[1]] = true;
  while (q.length) {
    const [r, c] = q.shift()!;
    for (const d of DIRS) {
      if (!(tiles[r][c] & d.bit)) continue;
      const nr = r + d.dr, nc = c + d.dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size || wet[nr][nc] || !(tiles[nr][nc] & d.opp)) continue;
      wet[nr][nc] = true;
      q.push([nr, nc]);
    }
  }
  return wet;
}

function Pipe({ mask, wet }: { mask: number; wet: boolean }) {
  const color = wet ? "#00bbf9" : "#4a3d78";
  const seg = (bit: number, d: string) => (mask & bit ? <path d={d} stroke={color} strokeWidth="22" strokeLinecap="round" /> : null);
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      {seg(N, "M50 50 V0")}
      {seg(E, "M50 50 H100")}
      {seg(S, "M50 50 V100")}
      {seg(W, "M50 50 H0")}
      <circle cx="50" cy="50" r="13" fill={color} />
      {wet && <circle cx="50" cy="50" r="6" fill="#ffffff" opacity="0.6" />}
    </svg>
  );
}

export function Flujo({ onSolve, active, labels }: GameProps & { labels: Record<string, string> }) {
  const [level, setLevel] = useState(0);
  const board = useMemo(() => makeBoard(level), [level]);
  const [turns, setTurns] = useState<number[][]>(board.turns);
  const [spin, setSpin] = useState<number[][]>(() => board.turns.map((r) => r.map((t) => t * 90)));
  const [won, setWon] = useState(false);
  const tiles = board.solved.map((row, r) => row.map((m, c) => rot(m, turns[r]?.[c] ?? 0)));
  const wet = watered(board.size, tiles, board.src);
  const degree = (m: number) => [N, E, S, W].filter((b) => m & b).length;
  const plants = board.solved.flatMap((row, r) => row.map((m, c) => ({ r, c, leaf: degree(m) === 1 && !(r === board.src[0] && c === board.src[1]) }))).filter((x) => x.leaf);
  const bloomed = plants.filter((p) => wet[p.r][p.c]).length;

  const turn = (r: number, c: number) => {
    if (won || !active) return;
    const next = turns.map((row) => [...row]);
    next[r][c] = (next[r][c] + 1) % 4;
    setTurns(next);
    setSpin((s) => s.map((row, i) => row.map((v, j) => (i === r && j === c ? v + 90 : v))));
    const t = board.solved.map((row, i) => row.map((m, j) => rot(m, next[i][j])));
    const w = watered(board.size, t, board.src);
    if (w.every((row) => row.every(Boolean))) {
      setWon(true);
      onSolve(board.size >= 6 ? 2 : 1);
    }
  };
  const nextLevel = () => {
    const nb = makeBoard(level + 1);
    setLevel(level + 1);
    setTurns(nb.turns);
    setSpin(nb.turns.map((r) => r.map((t) => t * 90)));
    setWon(false);
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm font-bold text-ink-muted">
        <span>{labels.level} {level + 1} · {board.size}×{board.size}</span>
        <span className="inline-flex items-center gap-1"><Flower size={16} weight="fill" className="text-pink" aria-hidden /> {bloomed}/{plants.length}</span>
      </div>
      <div className="relative w-full max-w-md overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-[#1e1540] to-midnight p-2.5 shadow-[var(--shadow-lift)]">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)` }}>
          {board.solved.map((row, r) =>
            row.map((m, c) => {
              const isSrc = r === board.src[0] && c === board.src[1];
              const plant = plants.some((p) => p.r === r && p.c === c);
              return (
                <button key={`${r}-${c}`} type="button" onClick={() => turn(r, c)} disabled={!active} aria-label={`${labels.tile} ${r + 1}, ${c + 1}`} className={cx("relative aspect-square overflow-hidden rounded-xl transition-colors duration-300", wet[r][c] ? "bg-[#163a5c]" : "bg-white/[0.05]")}>
                  <motion.div className="absolute inset-0" animate={{ rotate: spin[r][c] }} transition={{ type: "spring", stiffness: 320, damping: 22 }}>
                    <Pipe mask={m} wet={wet[r][c]} />
                  </motion.div>
                  {isSrc && <span className="absolute inset-[22%] grid place-items-center rounded-full bg-sky text-white shadow-[0_0_16px_rgb(0_187_249/0.8)]"><Drop size={18} weight="fill" aria-hidden /></span>}
                  {plant && (
                    <motion.span animate={wet[r][c] ? { scale: [0.6, 1.25, 1] } : { scale: 1 }} className={cx("absolute inset-[18%] grid place-items-center rounded-full", wet[r][c] ? "bg-pink text-white shadow-[0_0_16px_rgb(241_91_181/0.8)]" : "bg-[#3a2f63] text-[#9c8fc7]")}>
                      {wet[r][c] ? <Flower size={18} weight="fill" aria-hidden /> : <Plant size={18} weight="fill" aria-hidden />}
                    </motion.span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
      {won ? <div className="w-full"><SolvedCard title={labels.win} body={labels.winBody} action={labels.next} onNext={nextLevel} /></div> : <p className="w-full text-xs text-ink-muted">{labels.tip}</p>}
    </div>
  );
}
