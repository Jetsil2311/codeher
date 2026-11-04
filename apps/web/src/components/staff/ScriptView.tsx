"use client";
// Guion de clase: a calm, full-viewport reader for teaching a lesson from a phone (or a
// desktop). One card at a time, big type, arrows / swipe / keyboard to move, fullscreen
// toggle, screen kept awake. Portrait stacks everything; landscape puts arrows on the
// sides so the card gets all the height.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import {
  ArrowLeft, ArrowRight, ArrowsIn, ArrowsOut, BookOpenText, CheckCircle, ChatCircleText, Clock, Lightbulb, ListBullets,
  MonitorPlay, Notepad, PresentationChart, Sparkle, Target, TextAa, X, ClipboardText, Question, FlagCheckered,
} from "@phosphor-icons/react/dist/ssr";
import { Sheet } from "@/components/motion/Sheet";
import { cx } from "@/components/ui";
import type { Block, ScriptStep } from "@/server/script";

type L = Record<string, string>;

function Inline({ text }: { text: string }) {
  // **bold** and `term` only; everything else is plain text (no HTML).
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? <strong key={i} className="font-bold text-white">{p.slice(2, -2)}</strong> : p.startsWith("`") ? <span key={i} className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em] text-[#d9c2fa]">{p.slice(1, -1)}</span> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function Blocks({ blocks, l }: { blocks: Block[]; l: L }) {
  return (
    <div className="space-y-[0.9em]">
      {blocks.map((b, i) => {
        if (b.t === "p") return <p key={i}><Inline text={b.text} /></p>;
        if (b.t === "h") return <h3 key={i} className="text-[1.15em] font-extrabold text-white">{b.text}</h3>;
        if (b.t === "quote") return <p key={i} className="rounded-2xl border-l-4 border-pink bg-pink/10 px-4 py-3"><Inline text={b.text} /></p>;
        if (b.t === "list")
          return (
            <ul key={i} className="space-y-[0.5em]">
              {b.items.map((it, k) => (
                <li key={k} className="flex gap-3"><span className="mt-[0.55em] size-2 shrink-0 rounded-full bg-grad" aria-hidden /><span><Inline text={it} /></span></li>
              ))}
            </ul>
          );
        if (b.t === "demo")
          return (
            <p key={i} className="flex items-center gap-3 rounded-2xl bg-sky/15 px-4 py-3 text-[0.9em] font-semibold text-sky ring-1 ring-sky/30">
              <MonitorPlay size={22} weight="fill" className="shrink-0" aria-hidden /> {l.demo}
            </p>
          );
        return (
          <div key={i} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
            <p className="flex items-center gap-2 text-[0.8em] font-bold uppercase tracking-wider text-sun"><Question size={16} weight="bold" aria-hidden /> {l.ask}</p>
            <p className="mt-1 font-bold text-white"><Inline text={b.prompt} /></p>
            <ol className="mt-2 space-y-1">
              {b.options.map((o, k) => (
                <li key={k} className={cx("flex items-center gap-2 rounded-xl px-3 py-1.5", k === b.answer ? "bg-mint/15 text-mint" : "text-[#d6cdea]")}>
                  <span className="font-mono text-[0.85em]">{String.fromCharCode(65 + k)}</span> <Inline text={o} /> {k === b.answer && <CheckCircle size={18} weight="fill" className="ml-auto shrink-0" aria-label={l.correct} />}
                </li>
              ))}
            </ol>
            {b.explanation && <p className="mt-2 text-[0.9em] text-[#b8acd6]"><Inline text={b.explanation} /></p>}
          </div>
        );
      })}
    </div>
  );
}

const KIND = {
  intro: { Icon: Target, tone: "from-violet to-pink" },
  explain: { Icon: ChatCircleText, tone: "from-[#7b3fd1] to-violet" },
  slide: { Icon: PresentationChart, tone: "from-pink to-[#ff9f6b]" },
  exercise: { Icon: ClipboardText, tone: "from-[#00bbf9] to-violet" },
  close: { Icon: FlagCheckered, tone: "from-[#00c9a7] to-[#00bbf9]" },
} as const;

function label(s: ScriptStep, l: L) {
  if (s.kind === "intro") return l.intro;
  if (s.kind === "explain") return s.title;
  if (s.kind === "slide") return `${l.slide} ${s.index} · ${s.title}`;
  if (s.kind === "exercise") return `${l.exercise} ${s.index} · ${s.title}`;
  return l.close;
}

function Card({ s, l, lang }: { s: ScriptStep; l: L; lang: string }) {
  const { Icon, tone } = KIND[s.kind];
  const Section = ({ icon: I, title, children, accent = "text-pink" }: { icon: typeof Icon; title: string; children: React.ReactNode; accent?: string }) => (
    <section className="mt-[1.4em]">
      <h3 className={cx("mb-[0.5em] flex items-center gap-2 text-[0.75em] font-bold uppercase tracking-[0.12em]", accent)}><I size={18} weight="bold" aria-hidden /> {title}</h3>
      {children}
    </section>
  );
  return (
    <article className="text-[#e9e3f5]">
      <p className="mb-3 inline-flex items-center gap-2">
        <span className={cx("grid size-9 place-items-center rounded-xl bg-gradient-to-br text-white", tone)}><Icon size={20} weight="fill" aria-hidden /></span>
        <span className="text-[0.75em] font-bold uppercase tracking-[0.14em] text-[#b8acd6]">{s.kind === "intro" ? lang : s.kind === "slide" ? `${l.slide} ${s.index}` : s.kind === "exercise" ? `${l.exercise} ${s.index}` : s.kind === "close" ? l.close : l.explainKicker}</span>
      </p>

      {s.kind === "intro" && (
        <>
          <h2 className="text-balance text-[1.9em] font-extrabold leading-[1.1] tracking-tight text-white">{s.title}</h2>
          <p className="mt-3 text-[1.05em] text-[#d6cdea]">{s.summary}</p>
          {s.goal && (
            <Section icon={Target} title={l.goal}><p className="text-[1.15em] font-semibold text-white">{s.goal}</p></Section>
          )}
          <div className="mt-[1.4em] flex flex-wrap gap-2 text-[0.85em]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Clock size={16} weight="bold" aria-hidden /> {l.minutes.replace("{n}", String(s.minutes))}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><ClipboardText size={16} weight="bold" aria-hidden /> {l.exercisesN.replace("{n}", String(s.exercises))}</span>
            {s.slides > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><PresentationChart size={16} weight="bold" aria-hidden /> {l.slidesN.replace("{n}", String(s.slides))}</span>}
          </div>
          <Section icon={Lightbulb} title={l.tip} accent="text-sun"><p>{l.introTip}</p></Section>
        </>
      )}

      {s.kind === "explain" && (
        <>
          <h2 className="mb-4 text-[1.5em] font-extrabold leading-tight tracking-tight text-white">{s.title}</h2>
          <div className="text-[1.15em] leading-relaxed"><Blocks blocks={s.blocks} l={l} /></div>
        </>
      )}

      {s.kind === "slide" && (
        <>
          <h2 className="mb-4 text-[1.5em] font-extrabold leading-tight tracking-tight text-white">{s.title}</h2>
          <div className="text-[1.1em] leading-relaxed"><Blocks blocks={s.blocks} l={l} /></div>
          {s.notes && (
            <Section icon={Notepad} title={l.notes} accent="text-sun">
              <p className="rounded-2xl bg-sun/10 px-4 py-3 text-[1.05em] text-[#fff6c2] ring-1 ring-sun/25"><Inline text={s.notes} /></p>
            </Section>
          )}
        </>
      )}

      {s.kind === "exercise" && (
        <>
          <h2 className="text-[1.5em] font-extrabold leading-tight tracking-tight text-white">{s.title}</h2>
          <p className="mt-1 text-[0.85em] font-semibold text-[#b8acd6]">{l[`type_${s.type}`]} · +{s.xp} XP</p>
          <Section icon={BookOpenText} title={l.say}><div className="text-[1.1em] leading-relaxed"><Blocks blocks={s.instructions} l={l} /></div></Section>
          {s.checks.length > 0 && (
            <Section icon={CheckCircle} title={l.checks} accent="text-mint">
              <ul className="space-y-[0.4em]">{s.checks.map((c, i) => <li key={i} className="flex gap-2"><CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-mint" aria-hidden /> {c}</li>)}</ul>
            </Section>
          )}
          {s.options.length > 0 && (
            <Section icon={ListBullets} title={l.options} accent="text-mint">
              <ol className="space-y-1">
                {s.options.map((o, i) => {
                  const ok = Array.isArray(s.answer) && s.answer.includes(i);
                  return <li key={i} className={cx("flex items-center gap-2 rounded-xl px-3 py-1.5", ok ? "bg-mint/15 text-mint" : "")}><span className="font-mono text-[0.85em]">{String.fromCharCode(65 + i)}</span> {o} {ok && <CheckCircle size={18} weight="fill" className="ml-auto" aria-label={l.correct} />}</li>;
                })}
              </ol>
            </Section>
          )}
          {typeof s.answer === "string" && <Section icon={CheckCircle} title={l.answer} accent="text-mint"><p className="font-bold text-white">{s.answer}</p></Section>}
          {s.hints.length > 0 && (
            <Section icon={Lightbulb} title={l.hints} accent="text-sun">
              <ol className="space-y-[0.5em]">{s.hints.map((h, i) => <li key={i} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-sun/20 font-mono text-[0.8em] font-bold text-sun">{i + 1}</span><span><Inline text={h} /></span></li>)}</ol>
            </Section>
          )}
          {s.explanation.length > 0 && <Section icon={Sparkle} title={l.why}><div className="leading-relaxed"><Blocks blocks={s.explanation} l={l} /></div></Section>}
        </>
      )}

      {s.kind === "close" && (
        <>
          <h2 className="text-[1.9em] font-extrabold leading-tight tracking-tight text-white">{l.closeTitle}</h2>
          {s.recap && <Section icon={Sparkle} title={l.recap}><p className="text-[1.2em] font-semibold text-white"><Inline text={s.recap} /></p></Section>}
          <Section icon={ChatCircleText} title={l.askClass} accent="text-sun">
            <ul className="space-y-[0.5em] text-[1.05em]">{[l.q1, l.q2, l.q3].map((q, i) => <li key={i} className="flex gap-3"><span className="mt-[0.55em] size-2 shrink-0 rounded-full bg-sun" aria-hidden />{q}</li>)}</ul>
          </Section>
          {s.next && <Section icon={ArrowRight} title={l.nextLesson}><p className="text-[1.1em] font-bold text-white">{s.next.title}</p></Section>}
        </>
      )}
    </article>
  );
}

const SIZES = [15, 17, 19, 22];

export function ScriptView({ lessonId, title, steps, prev, next, labels: l }: { lessonId: string; title: string; steps: ScriptStep[]; prev: { id: string; title: string } | null; next: { id: string; title: string } | null; labels: L }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [size, setSize] = useState(1);
  const [full, setFull] = useState(false);
  const [index, setIndex] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // Remember position and text size per lesson (a convenience only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("codeher.guion") ?? "{}");
      if (saved.lesson === lessonId && typeof saved.step === "number") setI(Math.min(saved.step, steps.length - 1));
      if (typeof saved.size === "number") setSize(saved.size);
    } catch {
      /* private mode */
    }
  }, [lessonId, steps.length]);
  useEffect(() => {
    try {
      localStorage.setItem("codeher.guion", JSON.stringify({ lesson: lessonId, step: i, size }));
    } catch {
      /* private mode */
    }
    scroller.current?.scrollTo({ top: 0 });
  }, [i, size, lessonId]);

  const go = useCallback((d: number) => {
    setI((cur) => {
      const n = Math.max(0, Math.min(steps.length - 1, cur + d));
      if (n !== cur) setDir(d);
      return n;
    });
  }, [steps.length]);

  // Keep the screen awake while teaching (where supported).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const get = () => nav.wakeLock?.request("screen").then((x) => (lock = x)).catch(() => undefined);
    void get();
    const onVis = () => document.visibilityState === "visible" && void get();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  const toggleFull = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* iOS Safari: the view is already full-viewport */
    }
  }, []);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (index) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      if (e.key.toLowerCase() === "f") void toggleFull();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFull, index]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };

  const step = steps[i];
  const atEnd = i === steps.length - 1;
  const atStart = i === 0;
  const arrow = "grid shrink-0 place-items-center rounded-full transition active:scale-90 disabled:opacity-25";

  const prevBtn = atStart && prev ? (
    <Link href={`/equipo/guion/${prev.id}`} aria-label={`${l.prevLesson}: ${prev.title}`} className={cx(arrow, "size-14 bg-white/10 text-paper ring-1 ring-white/15 landscape:max-lg:size-12")}><ArrowLeft size={24} weight="bold" aria-hidden /></Link>
  ) : (
    <button type="button" onClick={() => go(-1)} disabled={atStart} aria-label={l.prev} className={cx(arrow, "size-14 bg-white/10 text-paper ring-1 ring-white/15 landscape:max-lg:size-12")}><ArrowLeft size={24} weight="bold" aria-hidden /></button>
  );
  const nextBtn = atEnd && next ? (
    <Link href={`/equipo/guion/${next.id}`} aria-label={`${l.nextLesson}: ${next.title}`} className="inline-flex h-14 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-pink px-5 font-bold text-ink shadow-[var(--shadow-pop)] transition active:scale-90 landscape:max-lg:h-12">
      <span className="hidden text-sm sm:inline">{l.nextLesson}</span><ArrowRight size={24} weight="bold" aria-hidden />
    </Link>
  ) : (
    <button type="button" onClick={() => go(1)} disabled={atEnd} aria-label={l.next} className={cx(arrow, "size-14 bg-pink text-ink shadow-[var(--shadow-pop)] landscape:max-lg:size-12")}><ArrowRight size={24} weight="bold" aria-hidden /></button>
  );

  return (
    <div ref={root} className="fixed inset-0 z-[75] flex flex-col bg-midnight text-paper" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="blueprint-dark pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet/25 blur-3xl" aria-hidden />

      {/* Top bar */}
      <header className="relative flex h-14 shrink-0 items-center gap-2 px-3 landscape:max-lg:h-11 md:px-5">
        <Link href="/equipo/guion" aria-label={l.exit} className="grid size-10 place-items-center rounded-full text-[#d6cdea] hover:bg-white/10"><X size={20} weight="bold" aria-hidden /></Link>
        <button type="button" onClick={() => setIndex(true)} className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-2 py-1 text-left text-sm font-semibold text-[#d6cdea] hover:bg-white/5" aria-label={l.index}>
          <span className="truncate">{title}</span>
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 font-mono text-xs text-paper">{i + 1}/{steps.length}</span>
        </button>
        <button type="button" onClick={() => setSize((v) => (v + 1) % SIZES.length)} aria-label={l.textSize} className="grid size-10 place-items-center rounded-full text-[#d6cdea] hover:bg-white/10"><TextAa size={20} weight="bold" aria-hidden /></button>
        <button type="button" onClick={() => setIndex(true)} aria-label={l.index} className="grid size-10 place-items-center rounded-full text-[#d6cdea] hover:bg-white/10"><ListBullets size={20} weight="bold" aria-hidden /></button>
        <button type="button" onClick={toggleFull} aria-label={full ? l.exitFull : l.full} className="grid size-10 place-items-center rounded-full text-[#d6cdea] hover:bg-white/10">{full ? <ArrowsIn size={20} weight="bold" aria-hidden /> : <ArrowsOut size={20} weight="bold" aria-hidden />}</button>
      </header>

      {/* Progress */}
      <div className="relative flex shrink-0 gap-1 px-4 md:px-6" aria-hidden>
        {steps.map((s, k) => <span key={k} className={cx("h-1 flex-1 rounded-full transition-colors duration-300", k < i ? "bg-pink/70" : k === i ? "bg-grad" : "bg-white/10")} />)}
      </div>

      {/* Card + side arrows (landscape) */}
      <div className="relative flex min-h-0 flex-1 items-stretch gap-3 px-3 py-3 md:px-6 landscape:items-center">
        <div className="hidden landscape:flex">{prevBtn}</div>
        <div className="relative mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={i}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { x: dir * 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { x: dir * -60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              drag={reduce ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.25}
              onDragEnd={onDragEnd}
              className="absolute inset-0 flex touch-pan-y flex-col"
            >
              <div ref={scroller} className="h-full overflow-y-auto overscroll-contain rounded-[1.75rem] bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-8" style={{ fontSize: SIZES[size] }}>
                <Card s={step} l={l} lang={step.kind === "intro" ? l[`lang_${step.language}`] : ""} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="hidden landscape:flex">{nextBtn}</div>
      </div>

      {/* Bottom bar (portrait) */}
      <footer className="relative flex shrink-0 items-center gap-3 px-4 pb-3 landscape:hidden md:px-6">
        {prevBtn}
        <p className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-[#8f84b0]">
          {atEnd ? (next ? `${l.upNext}: ${next.title}` : l.lastStep) : `${l.upNext}: ${label(steps[i + 1], l)}`}
        </p>
        {nextBtn}
      </footer>

      <Sheet open={index} onClose={() => setIndex(false)} title={l.index} closeLabel={l.close}>
        <ol className="space-y-1 pb-2">
          {steps.map((s, k) => {
            const { Icon } = KIND[s.kind];
            return (
              <li key={k}>
                <button type="button" onClick={() => { setDir(k > i ? 1 : -1); setI(k); setIndex(false); }} className={cx("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition", k === i ? "bg-ink text-paper" : "hover:bg-paper")}>
                  <span className="font-mono text-xs text-ink-muted">{k + 1}</span>
                  <Icon size={18} weight="fill" className={k === i ? "text-pink" : "text-violet-700"} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label(s, l)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </Sheet>
    </div>
  );
}
