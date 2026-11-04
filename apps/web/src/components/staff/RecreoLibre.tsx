"use client";
// Staff panel: grant 30 minutes of free play (no tickets) to students, typically the
// ones who finished every lesson, and stop it at any moment.
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, GameController, Sparkle, Stop, Ticket, Timer } from "@phosphor-icons/react/dist/ssr";
import { recreoFreeAction } from "@/app/actions/staff";
import { cx } from "@/components/ui";

export interface RecreoRow {
  id: string;
  code: string;
  nickname: string;
  tickets: number;
  free_until: string | null;
  playing: boolean;
  lessons_completed: number;
  lessons_total: number;
}

const MINUTES = 30;

export function RecreoLibre({ rows, labels, single }: { rows: RecreoRow[]; labels: Record<string, string>; single?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Refresh the list now and then so expired windows disappear on their own.
  useEffect(() => {
    if (!rows.some((r) => r.free_until)) return;
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [rows, router]);

  const finished = (r: RecreoRow) => r.lessons_total > 0 && r.lessons_completed >= r.lessons_total;
  const left = (r: RecreoRow) => (r.free_until && now !== null ? Math.max(0, Date.parse(r.free_until) - now) : 0);
  const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
  const act = (ids: string[], minutes: number, okText: string) =>
    start(async () => {
      if (!ids.length) return;
      const r = await recreoFreeAction(ids, minutes);
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: labels.error });
      router.refresh();
    });

  const done = rows.filter(finished);
  const active = rows.filter((r) => r.free_until && left(r) > 0);

  return (
    <div className="space-y-4" aria-busy={pending}>
      {!single && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending || !done.length} onClick={() => act(done.map((r) => r.id), MINUTES, labels.granted)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-sun to-pink px-4 text-sm font-bold text-ink shadow-[var(--shadow-pop)] transition active:scale-95 disabled:opacity-40">
            <Sparkle size={16} weight="fill" aria-hidden /> {labels.grantFinished.replace("{n}", String(done.length))}
          </button>
          <button type="button" disabled={pending || !rows.length} onClick={() => act(rows.map((r) => r.id), MINUTES, labels.granted)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12 transition active:scale-95 disabled:opacity-40">
            <GameController size={16} weight="bold" aria-hidden /> {labels.grantAll}
          </button>
          {active.length > 0 && (
            <button type="button" disabled={pending} onClick={() => act(active.map((r) => r.id), 0, labels.stopped)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-danger ring-1 ring-danger/30 transition active:scale-95">
              <Stop size={16} weight="fill" aria-hidden /> {labels.stopAll.replace("{n}", String(active.length))}
            </button>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{labels.empty}</p>
      ) : (
        <ul className={cx("grid gap-2", !single && "sm:grid-cols-2")}>
          {rows.map((r) => {
            const ms = left(r);
            const on = ms > 0;
            return (
              <li key={r.id} className={cx("flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors", on ? "bg-gradient-to-r from-[#fff8c7] to-pink-100 ring-pink/30" : "bg-paper ring-ink/[0.05]")}>
                <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl font-extrabold", on ? "bg-grad text-white" : "bg-white text-ink-soft ring-1 ring-ink/[0.06]")}>{r.nickname.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-bold">{r.nickname}</span>
                    <span className="font-mono text-xs text-ink-muted">{r.code}</span>
                    {finished(r) && <span className="inline-flex items-center gap-1 rounded-full bg-[#d9fbf5] px-2 py-0.5 text-[0.7rem] font-bold text-mint-700"><CheckCircle size={12} weight="fill" aria-hidden /> {labels.finished}</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <span>{labels.lessons.replace("{done}", String(r.lessons_completed)).replace("{total}", String(r.lessons_total))}</span>
                    <span className="inline-flex items-center gap-0.5"><Ticket size={12} weight="fill" aria-hidden /> {r.tickets}</span>
                    <AnimatePresence>
                      {on && (
                        <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-1 font-bold text-pink-700">
                          <Timer size={12} weight="fill" aria-hidden /> {labels.freeLeft.replace("{time}", clock(ms))}
                          {r.playing ? ` · ${labels.playing}` : ""}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </span>
                {on ? (
                  <button type="button" disabled={pending} onClick={() => act([r.id], 0, labels.stopped)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-sm font-semibold text-danger ring-1 ring-danger/30 active:scale-95">
                    <Stop size={14} weight="fill" aria-hidden /> {labels.stop}
                  </button>
                ) : (
                  <button type="button" disabled={pending} onClick={() => act([r.id], MINUTES, labels.granted)} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-ink px-3 text-sm font-bold text-paper active:scale-95">
                    <Sparkle size={14} weight="fill" aria-hidden /> {labels.grant}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {msg && <p role="status" className={cx("rounded-2xl px-4 py-3 text-sm font-semibold", msg.ok ? "bg-[#d9fbf5] text-mint-700" : "bg-pink-100 text-ink")}>{msg.text}</p>}
    </div>
  );
}
