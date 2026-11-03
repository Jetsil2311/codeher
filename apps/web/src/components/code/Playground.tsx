"use client";
// Runnable editor without tests: lesson snippets, projects, Logros viewer, landing teaser
// and the educators' "probar código" panel.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bug, MagicWand, Play, Stop } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";
import { format as formatPseudo } from "@codeher/grader/pseudo";
import { cx, LanguageBadge } from "@/components/ui";
import { CodeEditor } from "./CodeEditor";
import { ErrorCard, OutputConsole, PythonLoading, StepControls, VariableWatch } from "./RunParts";
import { useCodeRun } from "./useCodeRun";

export interface PlaygroundProps {
  language: CodeLanguage;
  code: string;
  onCodeChange?: (code: string) => void;
  readOnly?: boolean;
  minHeight?: number;
  compact?: boolean;
  title?: string;
  className?: string;
  allowStep?: boolean;
}

export function Playground({ language, code: initial, onCodeChange, readOnly, minHeight = 200, compact, title, className, allowStep = true }: PlaygroundProps) {
  const t = useTranslations("learn");
  const [code, setCode] = useState(initial);
  const [stdinText, setStdinText] = useState("");
  const r = useCodeRun(language);
  const isPseudo = language === "pseudocode_es";
  const stepping = r.mode === "debug" && (r.snap.state === "stepping" || r.snap.state === "waiting");
  const busy = r.mode === "run" && (r.snap.state === "running" || r.snap.state === "waiting");
  const stdin = stdinText.split("\n").filter((x, i, a) => x !== "" || i < a.length - 1);

  const change = (v: string) => {
    setCode(v);
    onCodeChange?.(v);
  };

  return (
    <div className={cx("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <LanguageBadge language={language} label={t(`language.${language}`)} />
        {title ? <span className="text-sm font-semibold text-ink">{title}</span> : null}
      </div>
      <CodeEditor value={code} onChange={change} language={language} readOnly={readOnly} stepLine={stepping ? r.snap.line : null} errorLine={r.snap.state === "error" ? r.snap.error?.line ?? null : null} minHeight={minHeight} label={t("editor.label")} onRun={() => r.run(code, stdin)} />
      <div className="flex flex-wrap items-center gap-2">
        {busy ? (
          <button type="button" onClick={r.stop} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-paper active:scale-95">
            <Stop size={18} weight="fill" aria-hidden /> {t("actions.stop")}
          </button>
        ) : (
          <button type="button" onClick={() => r.run(code, stdin)} className="inline-flex h-11 items-center gap-2 rounded-full bg-pink px-5 font-semibold text-ink shadow-[var(--shadow-pop)] transition active:scale-95">
            <Play size={18} weight="fill" aria-hidden /> {t("actions.run")}
          </button>
        )}
        {isPseudo && allowStep && (
          <button type="button" onClick={() => r.debug(code, stdin)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-violet-700 ring-1 ring-violet/30 transition hover:bg-violet-50 active:scale-95">
            <Bug size={18} weight="bold" aria-hidden /> {t("actions.step")}
          </button>
        )}
        {isPseudo && !readOnly && (
          <button type="button" onClick={() => change(formatPseudo(code))} className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-semibold text-violet-700 transition hover:bg-violet-100 active:scale-95">
            <MagicWand size={18} weight="bold" aria-hidden /> {t("actions.format")}
          </button>
        )}
      </div>
      {!isPseudo && (
        <details className="rounded-2xl bg-white ring-1 ring-line" open={stdinText !== ""}>
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-ink">{t("console.inputsTitle")}</summary>
          <div className="px-4 pb-3">
            <label htmlFor="stdin" className="sr-only">
              {t("console.inputsTitle")}
            </label>
            <textarea id="stdin" value={stdinText} onChange={(e) => setStdinText(e.target.value)} rows={3} placeholder={t("console.inputsPlaceholder")} className="w-full rounded-xl border border-ink/12 px-3 py-2 font-mono text-sm focus:border-violet-700 focus:outline-none" />
          </div>
        </details>
      )}
      {!isPseudo && <PythonLoading status={r.pyStatus} />}
      {stepping && isPseudo && (
        <div className="space-y-3 rounded-[1.25rem] bg-midnight p-3">
          <StepControls playing={r.playing} onPlay={r.play} onPause={r.pause} onStep={r.step} onRestart={() => r.debug(code, stdin)} speed={r.speed} onSpeed={r.setSpeed} disabled={r.snap.state === "waiting"} />
          <VariableWatch variables={r.snap.variables} line={r.snap.line} />
        </div>
      )}
      <div className={cx("grid gap-3", !compact && "md:grid-cols-1")}>
        <OutputConsole output={r.snap.output} waitingFor={r.snap.inputPrompt} onInput={r.provideInput} running={r.snap.state === "running"} />
        {r.snap.state === "error" && r.snap.error ? <ErrorCard error={r.snap.error} language={language} /> : null}
        {r.snap.state === "done" && (Object.keys(r.snap.variables).length > 0 && isPseudo) ? (
          <details className="rounded-2xl bg-white px-4 py-2 ring-1 ring-line">
            <summary className="cursor-pointer text-sm font-semibold">{t("step.finalVariables")}</summary>
            <div className="mt-2">
              <VariableWatch variables={r.snap.variables} line={null} />
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
