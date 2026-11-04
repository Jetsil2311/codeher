"use client";
// Nonogramas: the numbers say how many cells in a row (or column) are filled, in order.
// Pure deduction; solving one reveals a little drawing in colour.
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { PaintBrush, X } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";
import { Segmented } from "@/components/motion/Segmented";
import { SolvedCard, type GameProps } from "../GameShell";

export const PICTURES: { name: string; color: string; rows: string[] }[] = [
  { name: "Corazón", color: "#f15bb5", rows: [".#.#.", "#####", "#####", ".###.", "..#.."] },
  { name: "Casa", color: "#9b5de5", rows: ["..#..", ".###.", "#####", "#.#.#", "###.#"] },
  { name: "Flecha", color: "#00bbf9", rows: ["..#..", ".###.", "#.#.#", "..#..", "..#.."] },
  { name: "Carita", color: "#e0b800", rows: ["#...#", ".....", "#...#", ".#.#.", "..#.."] },
  { name: "Cohete", color: "#f15bb5", rows: ["...#...", "..###..", "..#.#..", "..###..", ".#####.", "#.###.#", "..#.#.."] },
  { name: "Matraz", color: "#00c9a7", rows: ["..###..", "...#...", "...#...", "..#.#..", ".#...#.", "#######", "#######"] },
  { name: "Robot", color: "#9b5de5", rows: ["...#...", ".#####.", ".#.#.#.", ".#####.", "#######", ".#...#.", ".#...#."] },
  { name: "Árbol", color: "#00796b", rows: ["...#...", "..###..", ".#####.", "..###..", ".#####.", "#######", "...#..."] },
  { name: "Gato", color: "#ba468b", rows: ["#.....#", "##...##", "#######", "#.#.#.#", "#######", ".#####.", "..#.#.."] },
  { name: "Nota", color: "#00bbf9", rows: ["...####", "...#..#", "...#..#", "...#..#", ".###.##", "####.##", ".##...."] },
];

const clues = (line: boolean[]) => {
  const out: number[] = [];
  let run = 0;
  for (const x of line) {
    if (x) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
};

type Mark = 0 | 1 | 2; // empty, filled, crossed

export function Nonogramas({ onSolve, active, labels }: GameProps & { labels: Record<string, string> }) {
  const [idx, setIdx] = useState(0);
  const pic = PICTURES[idx % PICTURES.length];
  const n = pic.rows.length;
  const sol = useMemo(() => pic.rows.map((r) => [...r].map((c) => c === "#")), [pic]);
  const rowClues = useMemo(() => sol.map(clues), [sol]);
  const colClues = useMemo(() => sol[0].map((_, c) => clues(sol.map((r) => r[c]))), [sol]);
  const [grid, setGrid] = useState<Mark[][]>(() => Array.from({ length: 7 }, () => Array(7).fill(0)));
  const [mode, setMode] = useState<"fill" | "cross">("fill");
  const [won, setWon] = useState(false);

  const rowDone = (r: number) => JSON.stringify(clues(grid[r].slice(0, n).map((m) => m === 1))) === JSON.stringify(rowClues[r]);
  const colDone = (c: number) => JSON.stringify(clues(grid.slice(0, n).map((row) => row[c] === 1))) === JSON.stringify(colClues[c]);

  const tap = (r: number, c: number) => {
    if (won || !active) return;
    const next = grid.map((row) => [...row]) as Mark[][];
    const want: Mark = mode === "fill" ? 1 : 2;
    next[r][c] = next[r][c] === want ? 0 : want;
    setGrid(next);
    // Any filling that satisfies every clue counts (some pictures have more than one).
    const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
    const solved = rowClues.every((cl, i) => same(clues(next[i].slice(0, n).map((m) => m === 1)), cl)) && colClues.every((cl, j) => same(clues(next.slice(0, n).map((row) => row[j] === 1)), cl));
    if (solved) {
      setWon(true);
      onSolve(n >= 7 ? 2 : 1);
    }
  };
  const nextPic = () => {
    setIdx((i) => i + 1);
    setGrid(Array.from({ length: 7 }, () => Array(7).fill(0)));
    setWon(false);
  };

  const cellSize = n <= 5 ? "min(13vw, 3.4rem)" : "min(10vw, 2.6rem)";
  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-sm font-bold text-ink-muted">{labels.level} {idx + 1}/{PICTURES.length} · {n}×{n}</span>
        <Segmented
          size="sm"
          label={labels.mode}
          value={mode}
          onChange={setMode}
          options={[
            { value: "fill", label: labels.fill, icon: <PaintBrush size={14} weight="bold" aria-hidden /> },
            { value: "cross", label: labels.cross, icon: <X size={14} weight="bold" aria-hidden /> },
          ]}
        />
      </div>

      <div className="rounded-[1.6rem] bg-white p-3 shadow-[var(--shadow-tile)] ring-1 ring-ink/[0.06] sm:p-4">
        <div className="grid" style={{ gridTemplateColumns: `auto repeat(${n}, ${cellSize})`, gap: 3 }}>
          <span />
          {colClues.map((cl, c) => (
            <div key={c} className={cx("flex flex-col items-center justify-end gap-0.5 pb-1 font-mono text-[0.72rem] font-bold leading-none transition-colors", colDone(c) ? "text-mint-700" : "text-ink-soft")}>
              {cl.map((x, i) => <span key={i}>{x}</span>)}
            </div>
          ))}
          {sol.map((_, r) => (
            <div key={`r${r}`} className="contents">
              <div className={cx("flex items-center justify-end gap-1.5 pr-2 font-mono text-[0.72rem] font-bold transition-colors", rowDone(r) ? "text-mint-700" : "text-ink-soft")}>
                {rowClues[r].map((x, i) => <span key={i}>{x}</span>)}
              </div>
              {Array.from({ length: n }, (_, c) => {
                const m = grid[r][c];
                return (
                  <motion.button
                    key={c}
                    type="button"
                    onClick={() => tap(r, c)}
                    aria-label={`${labels.cell} ${r + 1}, ${c + 1}`}
                    aria-pressed={m === 1}
                    whileTap={{ scale: 0.85 }}
                    animate={won && m === 1 ? { scale: [1, 1.15, 1], transition: { delay: (r + c) * 0.04 } } : {}}
                    className={cx("relative grid aspect-square place-items-center rounded-lg transition-colors duration-200", m === 1 ? "" : "bg-paper ring-1 ring-ink/10", (c + 1) % 5 === 0 && c !== n - 1 && "mr-0.5")}
                    style={m === 1 ? { background: won ? pic.color : "#1b1030" } : undefined}
                  >
                    {m === 2 && <X size={14} weight="bold" className="text-ink-muted" aria-hidden />}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {won ? <div className="w-full"><SolvedCard title={labels.win.replace("{name}", pic.name)} body={labels.winBody} action={labels.next} onNext={nextPic} /></div> : <p className="w-full text-xs text-ink-muted">{labels.tip}</p>}
    </div>
  );
}
