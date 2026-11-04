"use client";
// Robotina: program a little robot with step blocks to collect every star.
// Blocks: Avanza (with ×1–4), Gira izquierda, Gira derecha; the whole program can repeat
// ×1–4, so later levels only fit when you spot the pattern (a loop).
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowArcLeft, ArrowArcRight, ArrowUp, Backspace, Play, Repeat, Star, Trash } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";
import { Segmented } from "@/components/motion/Segmented";
import { SolvedCard, type GameProps } from "../GameShell";

type Cmd = { op: "F" | "L" | "R"; n: number };
type Dir = 0 | 1 | 2 | 3; // up, right, down, left
export interface RobotLevel {
  grid: string[]; // S start, * star, # wall, . floor
  dir: Dir;
  max: number;
  solution: { program: Cmd[]; loops: number };
}

const F = (n = 1): Cmd => ({ op: "F", n });
const L: Cmd = { op: "L", n: 1 };
const R: Cmd = { op: "R", n: 1 };
export const ROBOT_LEVELS: RobotLevel[] = [
  { grid: [".....", ".....", "S.*.*", ".....", "....."], dir: 1, max: 1, solution: { program: [F(4)], loops: 1 } },
  { grid: ["....*", ".....", "*....", ".....", "S...."], dir: 0, max: 3, solution: { program: [F(4), R, F(4)], loops: 1 } },
  { grid: ["S.#.*", "..#..", ".....", ".....", "....."], dir: 1, max: 6, solution: { program: [R, F(2), L, F(4), L, F(2)], loops: 1 } },
  { grid: ["*...*", ".....", ".....", ".....", "S...*"], dir: 0, max: 2, solution: { program: [F(4), R], loops: 3 } },
  { grid: ["....*", "...*.", "..*..", ".*...", "S...."], dir: 0, max: 4, solution: { program: [F(1), R, F(1), L], loops: 4 } },
  { grid: ["S.*.*", "*...#", ".*.*#", "*.*.#", ".*.*#"], dir: 2, max: 8, solution: { program: [F(4), L, F(1), L, F(4), R, F(1), R], loops: 2 } },
  { grid: ["S..#.", "##.#.", "*..#.", ".###.", "....*"], dir: 1, max: 9, solution: { program: [F(2), R, F(2), R, F(2), L, F(2), L, F(4)], loops: 1 } },
  { grid: [".....", ".....", "*.*..", ".....", "S.*.."], dir: 0, max: 2, solution: { program: [F(2), R], loops: 3 } },
];

const DELTA: Record<Dir, [number, number]> = { 0: [-1, 0], 1: [0, 1], 2: [1, 0], 3: [0, -1] };

export function parseLevel(lv: RobotLevel) {
  let start: [number, number] = [0, 0];
  const stars = new Set<string>();
  const walls = new Set<string>();
  lv.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === "S") start = [r, c];
    if (ch === "*") stars.add(`${r},${c}`);
    if (ch === "#") walls.add(`${r},${c}`);
  }));
  return { start, stars, walls, size: lv.grid.length };
}

/** Expands the program into single steps and simulates it (also used to verify levels). */
export function simulate(lv: RobotLevel, program: Cmd[], loops: number) {
  const { start, stars, walls, size } = parseLevel(lv);
  const frames: { r: number; c: number; dir: Dir; got: string[]; crash?: boolean }[] = [];
  let [r, c] = start;
  let dir = lv.dir;
  const got = new Set<string>();
  frames.push({ r, c, dir, got: [] });
  for (let k = 0; k < loops; k++)
    for (const cmd of program)
      for (let i = 0; i < cmd.n; i++) {
        if (cmd.op === "L") dir = ((dir + 3) % 4) as Dir;
        else if (cmd.op === "R") dir = ((dir + 1) % 4) as Dir;
        else {
          const [dr, dc] = DELTA[dir];
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= size || nc >= size || walls.has(`${nr},${nc}`)) {
            frames.push({ r, c, dir, got: [...got], crash: true });
            return { frames, won: false, crashed: true };
          }
          r = nr; c = nc;
          if (stars.has(`${r},${c}`)) got.add(`${r},${c}`);
        }
        frames.push({ r, c, dir, got: [...got] });
      }
  return { frames, won: got.size === stars.size, crashed: false };
}

const ICON = { F: ArrowUp, L: ArrowArcLeft, R: ArrowArcRight };

export function Robotina({ onSolve, active, labels }: GameProps & { labels: Record<string, string> }) {
  const [level, setLevel] = useState(0);
  const lv = ROBOT_LEVELS[level % ROBOT_LEVELS.length];
  const info = useMemo(() => parseLevel(lv), [lv]);
  const [program, setProgram] = useState<Cmd[]>([]);
  const [loops, setLoops] = useState(1);
  const [frame, setFrame] = useState<null | { r: number; c: number; dir: Dir; got: string[]; crash?: boolean }>(null);
  const [state, setState] = useState<"edit" | "running" | "won" | "fail">("edit");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const reset = (next = level) => {
    if (timer.current) clearTimeout(timer.current);
    setLevel(next);
    setProgram([]);
    setLoops(1);
    setFrame(null);
    setState("edit");
    setMsg("");
  };

  const add = (op: Cmd["op"]) => {
    if (state !== "edit" || !active) return;
    setProgram((p) => {
      const last = p[p.length - 1];
      if (op === "F" && last?.op === "F" && last.n < 4) return [...p.slice(0, -1), { op: "F", n: last.n + 1 }];
      return p.length >= lv.max ? p : [...p, { op, n: 1 }];
    });
  };

  const run = () => {
    if (!program.length || !active) return;
    const sim = simulate(lv, program, loops);
    setState("running");
    let i = 0;
    const tick = () => {
      setFrame(sim.frames[i]);
      i++;
      if (i < sim.frames.length) timer.current = setTimeout(tick, 280);
      else if (sim.won) {
        setState("won");
        onSolve(1);
      } else {
        setState("fail");
        setMsg(sim.crashed ? labels.crash : labels.missing);
      }
    };
    tick();
  };

  const pos = frame ?? { r: info.start[0], c: info.start[1], dir: lv.dir, got: [] as string[] };
  const cell = 100 / info.size;

  return (
    <div className="flex flex-1 flex-col gap-4 md:grid md:grid-cols-[1fr_17rem] md:items-start">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm font-bold text-ink-muted">
          <span>{labels.level} {level + 1}/{ROBOT_LEVELS.length}</span>
          <span>{labels.blocks}: {program.length}/{lv.max}</span>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-[1.6rem] bg-midnight p-2 shadow-[var(--shadow-lift)]">
          <div className="blueprint-dark absolute inset-0 opacity-60" aria-hidden />
          <div className="relative grid h-full w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${info.size}, 1fr)` }}>
            {lv.grid.flatMap((row, r) =>
              [...row].map((ch, c) => {
                const k = `${r},${c}`;
                const got = pos.got.includes(k);
                return (
                  <div key={k} className={cx("relative grid place-items-center rounded-xl", ch === "#" ? "bg-gradient-to-br from-[#3b2c6e] to-[#2a1f52] shadow-[inset_0_-4px_0_rgb(0_0_0/0.3)]" : "bg-white/[0.06] ring-1 ring-white/[0.06]")}>
                    {ch === "*" && (
                      <motion.span animate={got ? { scale: [1, 1.6, 0], rotate: 90, opacity: [1, 1, 0] } : { scale: [1, 1.12, 1] }} transition={got ? { duration: 0.45 } : { duration: 1.8, repeat: Infinity }}>
                        <Star size={26} weight="fill" className="text-sun drop-shadow-[0_0_10px_rgb(254_228_64/0.7)]" aria-hidden />
                      </motion.span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
          {/* robot */}
          <motion.div
            className="absolute grid place-items-center"
            style={{ width: `calc(${cell}% - 0.4rem)`, height: `calc(${cell}% - 0.4rem)`, left: "0.5rem", top: "0.5rem" }}
            animate={{ x: `calc(${pos.c * 100}% + ${pos.c * 0.375}rem)`, y: `calc(${pos.r * 100}% + ${pos.r * 0.375}rem)`, rotate: pos.dir * 90 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            aria-label={labels.robot}
          >
            <motion.div animate={frame?.crash ? { x: [0, -6, 6, -4, 0] } : {}} className="relative grid size-[78%] place-items-center rounded-[30%] bg-gradient-to-br from-pink to-violet shadow-[0_8px_20px_-6px_rgb(241_91_181/0.9)]">
              <span className="absolute top-[18%] flex gap-[18%]"><span className="size-1.5 rounded-full bg-white" /><span className="size-1.5 rounded-full bg-white" /></span>
              <ArrowUp size={16} weight="bold" className="absolute -top-0.5 text-white" aria-hidden />
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="min-h-[4.5rem] rounded-[1.4rem] bg-white p-2.5 ring-1 ring-ink/[0.07]" aria-label={labels.program}>
          {program.length === 0 ? (
            <p className="p-2 text-sm text-ink-muted">{labels.empty}</p>
          ) : (
            <ol className="flex flex-wrap gap-1.5">
              <AnimatePresence initial={false}>
                {program.map((cmd, i) => {
                  const Icon = ICON[cmd.op];
                  return (
                    <motion.li key={`${i}-${cmd.op}`} layout initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                      <button
                        type="button"
                        disabled={state !== "edit"}
                        onClick={() => cmd.op === "F" && setProgram((p) => p.map((x, j) => (j === i ? { ...x, n: (x.n % 4) + 1 } : x)))}
                        className={cx("relative inline-flex h-12 items-center gap-1 rounded-xl px-3 font-bold text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.18)]", cmd.op === "F" ? "bg-violet-700" : "bg-pink-700")}
                        aria-label={`${labels[cmd.op]}${cmd.n > 1 ? ` ×${cmd.n}` : ""}`}
                      >
                        <Icon size={20} weight="bold" aria-hidden />
                        {cmd.op === "F" && <span className="font-mono text-sm">×{cmd.n}</span>}
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["F", "L", "R"] as const).map((op) => {
            const Icon = ICON[op];
            return (
              <button key={op} type="button" onClick={() => add(op)} disabled={state !== "edit" || !active} className={cx("flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold text-white transition active:scale-95 disabled:opacity-40", op === "F" ? "bg-violet-700" : "bg-pink-700")}>
                <Icon size={24} weight="bold" aria-hidden /> {labels[op]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Repeat size={20} weight="bold" className="shrink-0 text-violet-700" aria-hidden />
          <Segmented size="sm" tone="violet" label={labels.loops} value={String(loops)} onChange={(v) => state === "edit" && setLoops(Number(v))} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}×` }))} />
          <span className="text-xs font-semibold text-ink-muted">{labels.loops}</span>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={run} disabled={!program.length || state !== "edit" || !active} className="grad-edge inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-pink font-bold text-ink shadow-[var(--shadow-pop)] transition active:scale-95 disabled:opacity-40">
            <Play size={18} weight="fill" aria-hidden /> {labels.run}
          </button>
          <button type="button" onClick={() => setProgram((p) => p.slice(0, -1))} disabled={!program.length || state !== "edit"} aria-label={labels.undo} className="grid size-12 place-items-center rounded-full bg-white ring-1 ring-ink/10 disabled:opacity-40">
            <Backspace size={20} weight="bold" aria-hidden />
          </button>
          <button type="button" onClick={() => reset()} aria-label={labels.clear} className="grid size-12 place-items-center rounded-full bg-white ring-1 ring-ink/10">
            <Trash size={20} weight="bold" aria-hidden />
          </button>
        </div>

        {state === "fail" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-2 rounded-2xl bg-pink-100 px-4 py-3 text-sm font-semibold">
            {msg}
            <button type="button" onClick={() => { setFrame(null); setState("edit"); }} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-paper">{labels.retry}</button>
          </motion.div>
        )}
        {state === "won" && <SolvedCard title={labels.win} body={labels.winBody} action={labels.next} onNext={() => reset(level + 1 >= ROBOT_LEVELS.length ? 0 : level + 1)} />}
        <p className="text-xs text-ink-muted">{labels.tip}</p>
      </div>
    </div>
  );
}
