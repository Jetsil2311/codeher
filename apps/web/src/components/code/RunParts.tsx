"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { ArrowClockwise, CaretRight, Pause, Play, SkipForward, WarningCircle, ArrowBendDownLeft } from "@phosphor-icons/react/dist/ssr";
import { translateError, type CodeLanguage, type ErrorTranslationRow, type RawError, type VariableSnapshot } from "@codeher/core";
import { pseudoCatalogDefaults } from "@codeher/grader/pseudo";
import type { PythonStatus } from "@codeher/grader/python";
import { cx } from "@/components/ui";

// ---------- Error catalog (tech spec 6.6) ----------
const CatalogCtx = createContext<ErrorTranslationRow[]>([]);
export function ErrorCatalogProvider({ rows, children }: { rows: ErrorTranslationRow[]; children: ReactNode }) {
  const all = useMemo(() => [...rows, ...pseudoCatalogDefaults()], [rows]);
  return <CatalogCtx.Provider value={all}>{children}</CatalogCtx.Provider>;
}

export function ErrorCard({ error, language }: { error: RawError; language: CodeLanguage }) {
  const t = useTranslations("learn.errors");
  const catalog = useContext(CatalogCtx);
  const [showOriginal, setShowOriginal] = useState(false);
  const friendly = translateError(error, catalog.length ? catalog : pseudoCatalogDefaults(), {
    language,
    fallback: { title: t("fallbackTitle"), explanation: t("fallbackExplanation"), suggestion: t("fallbackSuggestion") },
  });
  const isPythonOriginal = language === "python" && !["Timeout", "WorkerCrashed", "HarnessError", "OutputTooLarge"].includes(error.type);
  return (
    <div role="alert" className="rounded-2xl border border-pink/40 bg-pink-100/70 p-4 text-ink">
      <div className="flex items-start gap-3">
        <WarningCircle size={24} weight="fill" className="mt-0.5 shrink-0 text-pink-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">{friendly.title}</p>
          {friendly.line ? <p className="mt-1 font-mono text-xs font-medium text-pink-700">{t("where", { line: friendly.line })}</p> : null}
          {friendly.explanation ? <p className="mt-2 text-[0.95rem] text-ink-soft">{friendly.explanation}</p> : null}
          {friendly.suggestion ? (
            <p className="mt-2 text-[0.95rem]">
              <span className="font-semibold">{t("howToFix")} </span>
              {friendly.suggestion}
            </p>
          ) : null}
          {isPythonOriginal && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowOriginal((v) => !v)} className="text-sm font-semibold text-violet-700 underline underline-offset-4">
                {showOriginal ? t("hideOriginal") : t("showOriginal")}
              </button>
              {showOriginal && (
                <pre className="mt-2 overflow-x-auto rounded-xl bg-midnight p-3 font-mono text-xs text-paper">
                  {error.type}: {error.message}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Output console with interactive input (Leer) ----------
export function OutputConsole({ output, waitingFor, onInput, empty, running, className }: { output: string; waitingFor: string | null; onInput: (v: string) => void; empty?: string; running?: boolean; className?: string }) {
  const t = useTranslations("learn.console");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (waitingFor) inputRef.current?.focus();
  }, [waitingFor]);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [output]);
  return (
    <div className={cx("flex flex-col overflow-hidden rounded-2xl bg-[#120a28] ring-1 ring-white/8", className)}>
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2">
        <span className="font-mono text-xs font-medium uppercase tracking-wide text-[#b8acd6]">{t("title")}</span>
        {running ? <span className="font-mono text-xs text-mint">{t("running")}</span> : null}
      </div>
      <div ref={boxRef} aria-live="polite" className="max-h-72 min-h-24 flex-1 overflow-auto px-4 py-3 font-mono text-sm leading-relaxed text-paper">
        {output ? <pre className="whitespace-pre-wrap break-words">{output}</pre> : <p className="text-[#8f84b0]">{empty ?? t("empty")}</p>}
        {waitingFor !== null && (
          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onInput(value);
              setValue("");
            }}
          >
            <label htmlFor="console-input" className="sr-only">
              {t("inputLabel", { name: waitingFor })}
            </label>
            <CaretRight size={16} weight="bold" className="text-pink" aria-hidden />
            <input
              id="console-input"
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t("inputPlaceholder", { name: waitingFor })}
              className="h-10 min-w-0 flex-1 rounded-lg bg-white/8 px-3 text-paper placeholder:text-[#8f84b0] focus:outline-none focus:ring-2 focus:ring-pink"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              enterKeyHint="send"
            />
            <button type="submit" className="inline-flex h-10 items-center gap-1 rounded-lg bg-pink px-3 text-sm font-bold text-ink active:scale-95">
              <ArrowBendDownLeft size={16} weight="bold" aria-hidden /> {t("send")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------- Variable watch (Paso a paso) ----------
function show(v: unknown): string {
  if (v === undefined) return "·";
  if (typeof v === "boolean") return v ? "Verdadero" : "Falso";
  if (typeof v === "string") return `"${v}"`;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(parseFloat(v.toPrecision(10)));
  if (Array.isArray(v)) return `[${v.slice(0, 8).map(show).join(", ")}${v.length > 8 ? ", …" : ""}]`;
  return String(v);
}

export function VariableWatch({ variables, line }: { variables: VariableSnapshot; line: number | null }) {
  const t = useTranslations("learn.step");
  const reduce = useReducedMotion();
  const entries = Object.entries(variables);
  return (
    <div className="rounded-2xl bg-midnight-2 p-4 text-paper ring-1 ring-white/8">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold">{t("variables")}</h4>
        {line ? <span className="rounded-full bg-pink/20 px-2 py-0.5 font-mono text-xs text-pink">{t("line", { line })}</span> : null}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-[#b8acd6]">{t("noVariables")}</p>
      ) : (
        <table className="w-full text-left font-mono text-sm">
          <caption className="sr-only">{t("variables")}</caption>
          <thead>
            <tr className="text-xs text-[#b8acd6]">
              <th scope="col" className="py-1 pr-2 font-medium">{t("name")}</th>
              <th scope="col" className="py-1 pr-2 font-medium">{t("type")}</th>
              <th scope="col" className="py-1 font-medium">{t("value")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([name, v]) => (
              <tr key={name} className="border-t border-white/6">
                <td className="py-1.5 pr-2 text-[#d9c2fa]">{name}</td>
                <td className="py-1.5 pr-2 text-xs text-[#b8acd6]">{v.type}</td>
                <td className="py-1.5">
                  <motion.span key={show(v.value)} initial={reduce ? false : { backgroundColor: "rgba(254,228,64,0.35)" }} animate={{ backgroundColor: "rgba(254,228,64,0)" }} transition={{ duration: 0.5 }} className="rounded px-1 text-sun">
                    {show(v.value)}
                  </motion.span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function StepControls({ playing, onPlay, onPause, onStep, onRestart, speed, onSpeed, disabled }: { playing: boolean; onPlay: () => void; onPause: () => void; onStep: () => void; onRestart: () => void; speed: number; onSpeed: (n: number) => void; disabled?: boolean }) {
  const t = useTranslations("learn.step");
  const btn = "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition active:scale-95 disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("controls")}>
      {playing ? (
        <button type="button" onClick={onPause} disabled={disabled} className={cx(btn, "bg-white/12 text-paper")}>
          <Pause size={16} weight="fill" aria-hidden /> {t("pause")}
        </button>
      ) : (
        <button type="button" onClick={onPlay} disabled={disabled} className={cx(btn, "bg-pink text-ink")}>
          <Play size={16} weight="fill" aria-hidden /> {t("play")}
        </button>
      )}
      <button type="button" onClick={onStep} disabled={disabled || playing} className={cx(btn, "bg-white/12 text-paper")}>
        <SkipForward size={16} weight="fill" aria-hidden /> {t("next")}
      </button>
      <button type="button" onClick={onRestart} className={cx(btn, "bg-white/12 text-paper")}>
        <ArrowClockwise size={16} weight="bold" aria-hidden /> {t("restart")}
      </button>
      <label className="ml-auto flex items-center gap-2 text-xs text-[#b8acd6]">
        {t("speed")}
        <input type="range" min={1} max={10} value={speed} onChange={(e) => onSpeed(Number(e.target.value))} className="w-24 accent-[#f15bb5]" aria-valuetext={t("speedValue", { n: speed })} />
      </label>
    </div>
  );
}

export function PythonLoading({ status }: { status: PythonStatus }) {
  const t = useTranslations("learn.python");
  const [pct, setPct] = useState(8);
  useEffect(() => {
    if (status !== "loading") return;
    const id = setInterval(() => setPct((p) => Math.min(92, p + (92 - p) * 0.08)), 250);
    return () => clearInterval(id);
  }, [status]);
  if (status !== "loading" && status !== "crashed") return null;
  return (
    <div role="status" className="rounded-2xl bg-midnight-2 p-4 text-paper ring-1 ring-white/8">
      {status === "loading" ? (
        <>
          <p className="text-sm font-semibold">{t("preparing")}</p>
          <p className="mt-0.5 text-xs text-[#b8acd6]">{t("preparingHint")}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-grad transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <p className="text-sm">{t("crashed")}</p>
      )}
    </div>
  );
}
