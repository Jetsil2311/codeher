"use client";
// One code surface for lessons, exercises, projects, Logros and the Laboratorio.
// Inline: a calm editor frame with a single row of actions; results appear only when
// there is something to show. Fullscreen: code on top and the terminal as a bottom
// sheet that can be collapsed to a handle or closed (opens again on the next run).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ArrowsOut, Bug, CaretDown, CaretUp, MagicWand, Play, Stop, Terminal, TextAlignLeft, X } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage, RawError } from "@codeher/core";
import { format as formatPseudo } from "@codeher/grader/pseudo";
import { LanguageBadge, cx } from "@/components/ui";
import { CodeEditor } from "./CodeEditor";
import { ErrorCard, OutputConsole, PythonLoading, StepControls, VariableWatch } from "./RunParts";
import { useCodeRun } from "./useCodeRun";

export interface WorkspaceAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export interface CodeWorkspaceProps {
  language: CodeLanguage;
  code: string;
  onCodeChange?: (code: string) => void;
  readOnly?: boolean;
  title?: string;
  minHeight?: number;
  /** Data fed to Leer/input() when running (exercise test input). */
  stdin?: string[];
  /** Main action next to Ejecutar (Comprobar in exercises). */
  primary?: WorkspaceAction;
  /** Extra content for the results panel (test results, rewards). */
  results?: ReactNode;
  /** A grading error to highlight in the editor and show in results. */
  externalError?: RawError | null;
  /** Called before a free run so the parent can clear stale results. */
  onRunStart?: () => void;
  /** Extra buttons in the header (Guardar proyecto...). */
  headerExtra?: ReactNode;
  /** Opens results whenever this changes (e.g. after Comprobar). */
  resultsKey?: number;
  allowStep?: boolean;
  allowFullscreen?: boolean;
  /** Start in fullscreen (Laboratorio on phones). */
  fill?: boolean;
  /** Show the title in the editor header (exercise cards already show it). */
  showTitle?: boolean;
  className?: string;
}

type Sheet = "open" | "peek" | "closed";

export function CodeWorkspace(props: CodeWorkspaceProps) {
  const { language, code: initial, onCodeChange, readOnly, title, minHeight = 200, stdin = [], primary, results, externalError, onRunStart, headerExtra, resultsKey, allowStep = true, allowFullscreen = true, fill, className, showTitle = true } = props;
  const t = useTranslations("learn");
  const [code, setCode] = useState(initial);
  const [full, setFull] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("closed");
  const [showInputs, setShowInputs] = useState(false);
  const [stdinText, setStdinText] = useState("");
  const [mounted, setMounted] = useState(false);
  const r = useCodeRun(language);
  const isPseudo = language === "pseudocode_es";
  const debugging = r.mode === "debug" && (r.snap.state === "stepping" || r.snap.state === "waiting");
  const running = r.mode === "run" && (r.snap.state === "running" || r.snap.state === "waiting");
  const runError = r.snap.state === "error" ? r.snap.error : null;
  const error = externalError ?? runError;
  const hasOutput = r.snap.state !== "idle" || !!results || !!externalError;

  useEffect(() => setMounted(true), []);
  useEffect(() => setCode(initial), [initial]);
  useEffect(() => {
    if (resultsKey !== undefined && resultsKey > 0) setSheet("open");
  }, [resultsKey]);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [full]);

  const change = (v: string) => {
    setCode(v);
    onCodeChange?.(v);
  };
  const lines = () => (stdinText ? stdinText.split("\n") : stdin);
  const run = useCallback(() => {
    onRunStart?.();
    setSheet("open");
    r.run(code, lines());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, stdinText, stdin, r.run, onRunStart]);
  const step = () => {
    onRunStart?.();
    setSheet("open");
    r.debug(code, lines());
  };

  const iconBtn = "grid size-10 place-items-center rounded-xl text-[#d6cdea] transition hover:bg-white/10 hover:text-paper active:scale-95";

  const header = (
    <div className="flex items-center gap-2 border-b border-white/8 bg-midnight-2 px-3 py-2">
      <LanguageBadge language={language} label={t(`language.${language}`)} tone="dark" size="sm" />
      {title && (showTitle || full) ? <span className="min-w-0 truncate text-sm font-semibold text-paper">{title}</span> : null}
      <span className="ml-auto flex items-center gap-0.5">
        {headerExtra}
        {!isPseudo && !readOnly && (
          <button type="button" onClick={() => setShowInputs((v) => !v)} aria-pressed={showInputs} title={t("console.inputsTitle")} aria-label={t("console.inputsTitle")} className={cx(iconBtn, showInputs && "bg-white/12 text-paper")}>
            <TextAlignLeft size={19} weight="bold" aria-hidden />
          </button>
        )}
        {isPseudo && !readOnly && (
          <button type="button" onClick={() => change(formatPseudo(code))} title={t("actions.format")} aria-label={t("actions.format")} className={iconBtn}>
            <MagicWand size={19} weight="bold" aria-hidden />
          </button>
        )}
        {allowFullscreen && !full && (
          <button type="button" onClick={() => { setFull(true); if (hasOutput) setSheet("peek"); }} title={t("workspace.full")} aria-label={t("workspace.full")} className={iconBtn}>
            <ArrowsOut size={19} weight="bold" aria-hidden />
          </button>
        )}
        {full && (
          <button type="button" onClick={() => setFull(false)} aria-label={t("workspace.exitFull")} title={t("workspace.exitFull")} className={iconBtn}>
            <X size={19} weight="bold" aria-hidden />
          </button>
        )}
      </span>
    </div>
  );

  const inputs = !isPseudo && showInputs && (
    <div className="border-b border-white/8 bg-midnight-2 px-3 pb-3">
      <label htmlFor="ws-stdin" className="mb-1 block text-xs font-semibold text-[#b8acd6]">
        {t("console.inputsTitle")}
      </label>
      <textarea id="ws-stdin" value={stdinText} onChange={(e) => setStdinText(e.target.value)} rows={2} placeholder={t("console.inputsPlaceholder")} className="w-full rounded-xl bg-white/8 px-3 py-2 font-mono text-sm text-paper placeholder:text-[#8f84b0] focus:outline-none focus:ring-2 focus:ring-pink" />
    </div>
  );

  // With a primary action (Comprobar) the secondary ones become compact icons on phones.
  const compact = !!primary;
  const label = (text: string) => <span className={compact ? "sr-only sm:not-sr-only" : undefined}>{text}</span>;
  const actions = (
    <div className="flex items-center gap-2">
      {running ? (
        <button type="button" onClick={r.stop} title={t("actions.stop")} className={cx("inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-paper font-semibold text-ink active:scale-95", compact ? "w-11 sm:w-auto sm:px-5" : "px-5")}>
          <Stop size={18} weight="fill" aria-hidden /> {label(t("actions.stop"))}
        </button>
      ) : (
        <button type="button" onClick={run} title={t("actions.run")} className={cx("inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition active:scale-95", compact ? "w-11 bg-white/10 text-paper ring-1 ring-white/15 hover:bg-white/15 sm:w-auto sm:px-5" : "bg-pink px-5 text-ink shadow-[var(--shadow-pop)]")}>
          <Play size={18} weight="fill" aria-hidden /> {label(t("actions.run"))}
        </button>
      )}
      {primary && (
        <button type="button" onClick={() => { setSheet("open"); primary.onClick(); }} disabled={primary.disabled || primary.loading} className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-pink px-5 font-semibold text-ink shadow-[var(--shadow-pop)] transition active:scale-95 disabled:opacity-50 sm:flex-none">
          {primary.icon} <span className="truncate">{primary.loading ? t("actions.checking") : primary.label}</span>
        </button>
      )}
      {isPseudo && allowStep && (
        <button type="button" onClick={step} title={t("actions.step")} className={cx("inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full font-semibold text-[#d9c2fa] transition hover:bg-white/10 active:scale-95", compact ? "w-11 sm:w-auto sm:px-3" : "px-3")}>
          <Bug size={18} weight="bold" aria-hidden /> {label(t("actions.step"))}
        </button>
      )}
    </div>
  );

  const resultsBody = (
    <div className="space-y-3">
      {!isPseudo && <PythonLoading status={r.pyStatus} />}
      {debugging && (
        <div className="space-y-3">
          <StepControls playing={r.playing} onPlay={r.play} onPause={r.pause} onStep={r.step} onRestart={step} speed={r.speed} onSpeed={r.setSpeed} disabled={r.snap.state === "waiting"} />
          <VariableWatch variables={r.snap.variables} line={r.snap.line} />
        </div>
      )}
      {r.snap.state !== "idle" && <OutputConsole output={r.snap.output} waitingFor={r.snap.inputPrompt} onInput={r.provideInput} running={r.snap.state === "running"} />}
      {error ? <ErrorCard error={error} language={language} /> : null}
      {results}
    </div>
  );

  const editor = (h: number | undefined, grow: boolean) => (
    <CodeEditor
      value={code}
      onChange={change}
      language={language}
      readOnly={readOnly}
      stepLine={debugging ? r.snap.line : null}
      errorLine={error?.line ?? null}
      minHeight={h}
      label={title ? t("editor.labelFor", { title }) : t("editor.label")}
      onRun={run}
      className={cx("rounded-none ring-0", grow && "h-full [&_.cm-editor]:h-full")}
      fill={grow}
    />
  );

  // ---------- Split view: code on top, results below (collapsible), actions always visible ----------
  const split = (
    <>
      {header}
      {inputs}
      <div className="relative min-h-0 flex-1 overflow-hidden">{editor(undefined, true)}</div>
      {hasOutput && sheet !== "closed" && (
        <section aria-label={t("workspace.results")} className={cx("flex shrink-0 flex-col border-t border-white/10 bg-[#140c2e] transition-[height] duration-300 ease-[var(--ease-out-soft)]", sheet === "open" ? "h-[46%]" : "h-14")}>
          <div className="flex h-14 shrink-0 items-center gap-2 pl-4 pr-2">
            <button type="button" onClick={() => setSheet(sheet === "open" ? "peek" : "open")} aria-expanded={sheet === "open"} className="flex h-full flex-1 items-center gap-2 text-left">
              <Terminal size={18} weight="bold" className="text-pink" aria-hidden />
              <span className="text-sm font-bold">{t("workspace.results")}</span>
              {running ? <span className="text-xs text-mint">{t("console.running")}</span> : null}
              {sheet === "open" ? <CaretDown size={16} weight="bold" className="text-[#b8acd6]" aria-hidden /> : <CaretUp size={16} weight="bold" className="text-[#b8acd6]" aria-hidden />}
            </button>
            <button type="button" onClick={() => setSheet("closed")} aria-label={t("workspace.closeResults")} className="grid size-10 place-items-center rounded-xl text-[#d6cdea] hover:bg-white/10">
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
          {sheet === "open" && <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 text-ink">{resultsBody}</div>}
        </section>
      )}
      <div className="flex shrink-0 items-center gap-2 border-t border-white/8 bg-midnight-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">{actions}</div>
        {hasOutput && sheet === "closed" && (
          <button type="button" onClick={() => setSheet("open")} aria-label={t("workspace.showOutput")} title={t("workspace.showOutput")} className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-paper ring-1 ring-white/15">
            <Terminal size={19} weight="bold" aria-hidden />
          </button>
        )}
      </div>
    </>
  );

  const fullscreen = full && mounted
    ? createPortal(
        <div role="dialog" aria-modal="true" aria-label={title ?? t("workspace.full")} className="fixed inset-0 z-[90] flex flex-col bg-midnight pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-paper">
          {split}
        </div>,
        document.body,
      )
    : null;

  if (fill) {
    return (
      <div className={cx("relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.5rem] bg-midnight text-paper ring-1 ring-ink/10", className)}>
        {full ? <div className="grid flex-1 place-items-center text-sm text-[#b8acd6]">{t("workspace.full")}</div> : split}
        {fullscreen}
      </div>
    );
  }

  // ---------- Inline ----------
  return (
    <div className={cx("w-full min-w-0 max-w-full", className)}>
      <div className="overflow-hidden rounded-[1.25rem] bg-midnight ring-1 ring-ink/10">
        {header}
        {inputs}
        {editor(minHeight, false)}
        <div className="border-t border-white/8 bg-midnight-2 px-3 py-2.5">{actions}</div>
      </div>
      {hasOutput && sheet !== "closed" && (
        <div className="mt-3 rounded-[1.25rem] bg-white p-3 ring-1 ring-line">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <Terminal size={17} weight="bold" className="text-violet-700" aria-hidden /> {t("workspace.results")}
            </span>
            <button type="button" onClick={() => setSheet("closed")} aria-label={t("workspace.closeResults")} className="grid size-9 place-items-center rounded-xl text-ink-muted hover:bg-violet-100">
              <X size={16} weight="bold" aria-hidden />
            </button>
          </div>
          {resultsBody}
        </div>
      )}
      {hasOutput && sheet === "closed" && (
        <button type="button" onClick={() => setSheet("open")} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline">
          <Terminal size={16} weight="bold" aria-hidden /> {t("workspace.showOutput")}
        </button>
      )}
      {fullscreen}
    </div>
  );
}
