"use client";
// Recreo hub: tickets, progress to the next one, and the five game cards.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Sparkle, Brain, Lightbulb, Lock, Path, Play, Robot, SquaresFour, Ticket, Timer, Drop, ArrowRight, CircleNotch } from "@phosphor-icons/react/dist/ssr";
import { startRecreoAction } from "@/app/actions/student";
import { Sheet } from "@/components/motion/Sheet";
import { Stagger, StaggerItem } from "@/components/motion/Motion";
import { cx } from "@/components/ui";
import type { GameId } from "@/server/db/types";

export interface RecreoStatus {
  enabled: boolean;
  tickets: number;
  max_tickets: number;
  lessons_per_ticket: number;
  minutes: number;
  toward_next: number;
  free_until: string | null;
  active: { game: GameId; ends_at: string; score: number; started_at?: string; free?: boolean } | null;
  best: Partial<Record<GameId, number>>;
}

const ART: Record<GameId, { Icon: typeof Robot; bg: string; glow: string; pattern: string }> = {
  robotina: { Icon: Robot, bg: "from-violet to-pink", glow: "bg-pink/50", pattern: "grid" },
  interruptores: { Icon: Lightbulb, bg: "from-[#f7b500] to-pink", glow: "bg-sun/60", pattern: "dots" },
  nonogramas: { Icon: SquaresFour, bg: "from-[#00c9a7] to-[#00bbf9]", glow: "bg-mint/50", pattern: "pixels" },
  torres: { Icon: Brain, bg: "from-pink to-[#ff9f6b]", glow: "bg-pink/50", pattern: "bars" },
  flujo: { Icon: Drop, bg: "from-[#00bbf9] to-violet", glow: "bg-sky/50", pattern: "pipes" },
};

function Pattern({ kind }: { kind: string }) {
  if (kind === "pixels")
    return (
      <span className="absolute bottom-3 right-3 grid grid-cols-5 gap-1 opacity-90" aria-hidden>
        {"0110111111111110111000100".split("").map((x, i) => <span key={i} className={cx("size-3 rounded-[3px]", x === "1" ? "bg-white" : "bg-white/20")} />)}
      </span>
    );
  if (kind === "bars")
    return (
      <span className="absolute bottom-3 right-4 flex flex-col items-center gap-1" aria-hidden>
        {[40, 56, 72, 88].map((w) => <span key={w} className="h-3 rounded-full bg-white/90" style={{ width: w }} />)}
      </span>
    );
  if (kind === "dots")
    return (
      <span className="absolute bottom-4 right-4 flex gap-2" aria-hidden>
        {[1, 0, 1].map((on, i) => <span key={i} className={cx("size-7 rounded-full", on ? "bg-white shadow-[0_0_18px_white]" : "bg-white/25")} />)}
      </span>
    );
  if (kind === "pipes")
    return (
      <svg className="absolute bottom-2 right-2 h-20 w-28 opacity-90" viewBox="0 0 112 80" aria-hidden>
        <path d="M8 60 H44 V20 H80 V60 H104" stroke="white" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <span className="absolute bottom-3 right-3 grid grid-cols-4 gap-1" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => <span key={i} className={cx("size-4 rounded-md", i === 9 ? "bg-white" : i === 2 ? "bg-sun" : "bg-white/20")} />)}
    </span>
  );
}

export function RecreoHub({ status, games, labels }: { status: RecreoStatus; games: { id: GameId; title: string; tagline: string; skill: string }[]; labels: Record<string, string> }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pick, setPick] = useState<GameId | null>(null);
  const [busy, setBusy] = useState<GameId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!status.active && !status.free_until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status.active]);
  const left = status.active ? Math.max(0, Date.parse(status.active.ends_at) - (now ?? Date.parse(status.active.ends_at) - 1)) : 0;
  const activeNow = !!status.active && left > 0;
  const time = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;

  const go = async (game: GameId) => {
    setBusy(game);
    setError(null);
    const r = await startRecreoAction(game);
    if (r.ok) router.push(`/app/recreo/${game}`);
    else {
      setBusy(null);
      setError(labels[`err_${r.error}`] ?? labels.err_unexpected);
    }
  };
  const choose = (game: GameId) => {
    if (free || activeNow) return go(game);
    if (!status.enabled) return;
    if (status.tickets > 0) return setPick(game);
  };
  const freeLeft = status.free_until ? Math.max(0, Date.parse(status.free_until) - (now ?? Date.parse(status.free_until) - 1)) : 0;
  const free = freeLeft > 0;
  const freeTime = `${Math.floor(freeLeft / 60000)}:${String(Math.floor((freeLeft % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* Tickets */}
      <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-midnight p-5 text-paper shadow-[var(--shadow-lift)] md:p-7">
        <div className="blueprint-dark absolute inset-0 -z-10 opacity-50" aria-hidden />
        <div className="absolute -right-16 -top-20 -z-10 size-64 rounded-full bg-pink/35 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 left-10 -z-10 size-56 rounded-full bg-violet/40 blur-3xl" aria-hidden />
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex gap-2" aria-label={`${labels.tickets}: ${status.tickets}/${status.max_tickets}`}>
            {Array.from({ length: status.max_tickets }, (_, i) => {
              const has = i < status.tickets;
              return (
                <motion.span key={i} initial={reduce ? false : { rotate: -12, scale: 0.6, opacity: 0 }} animate={{ rotate: i % 2 ? 6 : -6, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 + i * 0.12 }} className={cx("relative grid h-20 w-16 place-items-center rounded-2xl", has ? "bg-gradient-to-br from-sun to-pink text-ink shadow-[0_14px_30px_-10px_rgb(241_91_181/0.9)]" : "border-2 border-dashed border-white/25 text-white/30")}>
                  <Ticket size={34} weight={has ? "fill" : "regular"} aria-hidden />
                  {has && <span className="absolute -inset-1 rounded-[1.1rem] bg-sun/30 motion-safe:animate-[pulse-ring_2.4s_ease-out_infinite]" aria-hidden />}
                </motion.span>
              );
            })}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-wider text-pink">{labels.tickets}</p>
            <p className="text-3xl font-extrabold tracking-tight">{labels.ticketsOf}</p>
            <p className="mt-1 text-sm text-[#d6cdea]">{status.tickets >= status.max_tickets ? labels.full : labels.progress}</p>
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {Array.from({ length: status.lessons_per_ticket }, (_, i) => <span key={i} className={cx("h-2 flex-1 rounded-full", i < status.toward_next || status.tickets >= status.max_tickets ? "bg-grad" : "bg-white/15")} />)}
            </div>
          </div>
        </div>
        {!status.enabled && !free && <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">{labels.disabled}</p>}
        {activeNow && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-ink">
            <Timer size={24} weight="fill" className="shrink-0 text-pink-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sm"><span className="font-bold">{labels.active}</span> · {labels.activeBody.replace("{time}", now === null ? "…" : time)}</p>
            <button type="button" onClick={() => go(status.active!.game)} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-ink px-4 text-sm font-bold text-paper">{labels.play} <ArrowRight size={14} weight="bold" aria-hidden /></button>
          </div>
        )}
        {!activeNow && !free && status.tickets === 0 && status.enabled && (
          <Link href="/app/ruta" className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-pink px-5 text-sm font-bold text-ink"><Path size={18} weight="bold" aria-hidden /> {labels.goLearn}</Link>
        )}
        {error && <p role="alert" className="mt-3 rounded-2xl bg-pink-100 px-4 py-3 text-sm font-semibold text-ink">{error}</p>}
      </section>

      {free && (
        <motion.section initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-sun via-pink to-violet p-5 text-ink shadow-[var(--shadow-pop)] md:p-6">
          <div className="dot-grid absolute inset-0 -z-10 opacity-30 mix-blend-overlay" aria-hidden />
          <div className="flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/90 text-pink-700 shadow-lg"><Sparkle size={30} weight="fill" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold tracking-tight md:text-2xl">{labels.freeTitle}</p>
              <p className="text-sm font-semibold text-ink/80">{labels.freeBody.replace("{time}", now === null ? "…" : freeTime)}</p>
            </div>
          </div>
        </motion.section>
      )}

      {/* Games */}
      <Stagger as="ul" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => {
          const a = ART[g.id];
          const can = free || activeNow || (status.enabled && status.tickets > 0);
          const best = status.best[g.id];
          return (
            <StaggerItem as="li" key={g.id}>
              <button type="button" onClick={() => choose(g.id)} disabled={!can || busy !== null} className={cx("group tile relative flex h-full w-full flex-col overflow-hidden text-left transition duration-300", can ? "hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]" : "cursor-not-allowed")}>
                <span className={cx("relative block h-36 overflow-hidden bg-gradient-to-br", a.bg, !can && "grayscale-[0.6]")}>
                  <span className="blueprint-dark absolute inset-0 opacity-40" aria-hidden />
                  <span className={cx("absolute -left-6 -top-8 size-32 rounded-full blur-2xl", a.glow)} aria-hidden />
                  <span className="absolute left-4 top-4 grid size-14 place-items-center rounded-2xl bg-white/20 text-white backdrop-blur-sm transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                    <a.Icon size={30} weight="fill" aria-hidden />
                  </span>
                  <span className="transition-transform duration-500 group-hover:scale-105"><Pattern kind={a.pattern} /></span>
                  <span className="absolute left-4 bottom-3 rounded-full bg-ink/50 px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-white backdrop-blur">{labels.skills}: {g.skill}</span>
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="text-xl font-extrabold tracking-tight">{g.title}</span>
                  <span className="mt-1 text-sm text-ink-soft">{g.tagline}</span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-5">
                    <span className="text-xs font-bold text-ink-muted">{best ? labels.best.replace("{n}", String(best)) : labels.noBest}</span>
                    <span className={cx("inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition", can ? "bg-ink text-paper group-hover:bg-pink group-hover:text-ink" : "bg-ink/[0.06] text-ink-muted")}>
                      {busy === g.id ? <CircleNotch size={16} className="animate-spin" aria-hidden /> : can ? <Play size={14} weight="fill" aria-hidden /> : <Lock size={14} weight="bold" aria-hidden />}
                      {busy === g.id ? labels.starting : can ? (activeNow || free ? labels.play : labels.useTicket) : labels.locked}
                    </span>
                  </span>
                </span>
              </button>
            </StaggerItem>
          );
        })}
      </Stagger>
      <p className="text-center text-sm text-ink-muted">{labels.maxNote}</p>

      <Sheet open={pick !== null} onClose={() => setPick(null)} title={labels.confirmTitle} closeLabel={labels.close}>
        {pick && (
          <div className="pb-2">
            <div className={cx("relative mb-4 h-28 overflow-hidden rounded-[1.25rem] bg-gradient-to-br", ART[pick].bg)}>
              <Pattern kind={ART[pick].pattern} />
              <span className="absolute left-4 top-4 text-2xl font-extrabold text-white">{games.find((g) => g.id === pick)?.title}</span>
            </div>
            <p className="text-ink-soft">{labels.confirmBody}</p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={() => go(pick)} disabled={busy !== null} className="grad-edge inline-flex h-13 items-center justify-center gap-2 rounded-full bg-pink font-bold text-ink shadow-[var(--shadow-pop)] disabled:opacity-60">
                {busy ? <CircleNotch size={18} className="animate-spin" aria-hidden /> : <Ticket size={20} weight="fill" aria-hidden />} {labels.confirm}
              </button>
              <button type="button" onClick={() => setPick(null)} className="h-11 rounded-full text-sm font-semibold text-ink-soft">{labels.cancel}</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
