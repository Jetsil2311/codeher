"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Bug, CheckCircle, CircleDashed, Lightbulb, MagicWand, Play, Sparkle, Star, Stop, Target } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage, RawError, RunReport, Test } from "@codeher/core";
import { format as formatPseudo } from "@codeher/grader/pseudo";
import { cx, Tag } from "@/components/ui";
import { CodeEditor } from "./CodeEditor";
import { gradeWith } from "./engines";
import { Markdown } from "./Markdown";
import { ErrorCard, OutputConsole, PythonLoading, StepControls, VariableWatch } from "./RunParts";
import { useCodeRun } from "./useCodeRun";
import { celebrate } from "./celebrate";

export interface ExercisePayload {
  id: string;
  slug: string;
  position: number;
  type: "code" | "multiple_choice" | "short_answer";
  title: string;
  instructions_md: string;
  starter_code: string;
  config: { options?: string[]; multiple?: boolean };
  xp: number;
  timeout_ms: number;
  tests: Test[];
  hints: string[];
  progress: { passed: boolean; attempts: number; hints_used: number; best_submission: string | null } | null;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  data?: { passed: boolean; xp_awarded: number; lesson_completed: boolean; lesson_xp: number; xp: number; streak: number; explanation_md?: string | null };
}

export interface ExerciseCardProps {
  exercise: ExercisePayload;
  language: CodeLanguage;
  locked?: boolean;
  onSubmitCode?: (input: { exerciseId: string; submission: string; passed: boolean; results: unknown; runtimeMs: number | null; hintsUsed: number; errorType: string | null }) => Promise<SubmitResult>;
  onSubmitAnswer?: (exerciseId: string, answer: { choices?: number[]; text?: string }, hintsUsed: number) => Promise<SubmitResult>;
  onCompleted?: (r: NonNullable<SubmitResult["data"]>) => void;
  onSaveProject?: (code: string) => Promise<boolean>;
  saveLabel?: string;
  noSaveLabel?: string;
}

export function ExerciseCard({ exercise, language, locked, onSubmitCode, onSubmitAnswer, onCompleted, onSaveProject, saveLabel, noSaveLabel }: ExerciseCardProps) {
  const [saving, setSaving] = useState(false);
  const t = useTranslations("learn");
  const [code, setCode] = useState(exercise.progress?.best_submission ?? exercise.starter_code);
  const [report, setReport] = useState<RunReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [hintsShown, setHintsShown] = useState(exercise.progress?.hints_used ?? 0);
  const [passed, setPassed] = useState(!!exercise.progress?.passed);
  const [reward, setReward] = useState<{ xp: number; lesson: boolean } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [choice, setChoice] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [answerState, setAnswerState] = useState<"idle" | "right" | "notyet">(exercise.progress?.passed ? "right" : "idle");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const r = useCodeRun(language);
  const reduce = useReducedMotion();
  const isPseudo = language === "pseudocode_es";
  const debugging = r.mode === "debug" && (r.snap.state === "stepping" || r.snap.state === "waiting");
  const firstStdin = (exercise.tests.find((x) => (x.spec as { stdin?: string[] }).stdin)?.spec as { stdin?: string[] } | undefined)?.stdin ?? [];

  const after = (res: SubmitResult) => {
    if (!res.ok || !res.data) {
      setServerError(res.error ?? "unexpected");
      return;
    }
    setServerError(null);
    if (res.data.passed) {
      setReward({ xp: res.data.xp_awarded + res.data.lesson_xp, lesson: res.data.lesson_completed });
      if (res.data.lesson_completed) celebrate(true);
      else if (res.data.xp_awarded > 0) celebrate(false);
      onCompleted?.(res.data);
    }
  };

  const check = async () => {
    setChecking(true);
    setServerError(null);
    r.reset();
    const rep = await gradeWith(language, { id: `${exercise.id}-${Date.now()}`, code, tests: exercise.tests, timeoutMs: exercise.timeout_ms });
    setReport(rep);
    setChecking(false);
    if (rep.ok) setPassed(true);
    if (onSubmitCode) {
      startTransition(async () => {
        const res = await onSubmitCode({
          exerciseId: exercise.id,
          submission: code,
          passed: rep.ok,
          results: rep.tests.map((x) => ({ testId: x.testId, passed: x.passed, skipped: x.skipped ?? false })),
          runtimeMs: rep.runtimeMs,
          hintsUsed: hintsShown,
          errorType: rep.error?.type ?? null,
        });
        after(res);
      });
    } else if (rep.ok) celebrate(false);
  };

  const checkAnswer = () => {
    if (!onSubmitAnswer) return;
    startTransition(async () => {
      const res = await onSubmitAnswer(exercise.id, exercise.type === "multiple_choice" ? { choices: [...choice].sort() } : { text }, hintsShown);
      if (!res.ok || !res.data) {
        setServerError(res.error ?? "unexpected");
        return;
      }
      setAnswerState(res.data.passed ? "right" : "notyet");
      setExplanation(res.data.explanation_md ?? null);
      if (res.data.passed) {
        setPassed(true);
        after(res);
      }
    });
  };

  const err: RawError | null = report?.error ?? (r.snap.state === "error" ? r.snap.error : null);

  return (
    <article id={`ejercicio-${exercise.slug}`} className="tile scroll-mt-24 overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4 md:px-6">
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium text-violet-700">{t("exercise.number", { n: exercise.position })}</p>
          <h3 className="mt-0.5 text-lg font-bold text-ink md:text-xl">{exercise.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {passed ? (
            <Tag tone="mint">
              <CheckCircle size={14} weight="fill" aria-hidden /> {t("exercise.done")}
            </Tag>
          ) : (
            <Tag tone="sun">
              <Star size={13} weight="fill" aria-hidden /> +{exercise.xp} XP
            </Tag>
          )}
        </div>
      </header>
      <div className="space-y-4 px-5 py-5 md:px-6">
        <Markdown source={exercise.instructions_md} language={language} />

        {exercise.type === "code" ? (
          <>
            <CodeEditor value={code} onChange={setCode} language={language} stepLine={debugging ? r.snap.line : null} errorLine={err?.line ?? null} minHeight={180} label={t("editor.labelFor", { title: exercise.title })} onRun={() => r.run(code, firstStdin)} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={locked || checking || pending} onClick={check} className="grad-edge inline-flex h-11 items-center gap-2 rounded-full bg-pink px-5 font-semibold text-ink shadow-[var(--shadow-pop)] transition active:scale-95 disabled:opacity-50">
                <Target size={18} weight="bold" aria-hidden /> {checking || pending ? t("actions.checking") : t("actions.check")}
              </button>
              {r.mode === "run" && (r.snap.state === "running" || r.snap.state === "waiting") ? (
                <button type="button" onClick={r.stop} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 font-semibold text-paper active:scale-95">
                  <Stop size={18} weight="fill" aria-hidden /> {t("actions.stop")}
                </button>
              ) : (
                <button type="button" onClick={() => { setReport(null); r.run(code, []); }} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold text-ink ring-1 ring-ink/12 transition hover:bg-violet-50 active:scale-95">
                  <Play size={18} weight="fill" aria-hidden /> {t("actions.run")}
                </button>
              )}
              {isPseudo && (
                <>
                  <button type="button" onClick={() => { setReport(null); r.debug(code, firstStdin); }} className="inline-flex h-11 items-center gap-2 rounded-full px-3 font-semibold text-violet-700 transition hover:bg-violet-100 active:scale-95">
                    <Bug size={18} weight="bold" aria-hidden /> {t("actions.step")}
                  </button>
                  <button type="button" onClick={() => setCode(formatPseudo(code))} className="inline-flex h-11 items-center gap-2 rounded-full px-3 font-semibold text-violet-700 transition hover:bg-violet-100 active:scale-95">
                    <MagicWand size={18} weight="bold" aria-hidden /> {t("actions.format")}
                  </button>
                </>
              )}
              <span className="ml-auto">
                {onSaveProject ? (
                  <button type="button" disabled={saving} onClick={async () => { setSaving(true); await onSaveProject(code); setSaving(false); }} className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                    {saveLabel}
                  </button>
                ) : noSaveLabel ? (
                  <span className="text-xs text-ink-muted">{noSaveLabel}</span>
                ) : null}
              </span>
            </div>
            {!isPseudo && <PythonLoading status={r.pyStatus} />}
            {debugging && (
              <div className="space-y-3 rounded-[1.25rem] bg-midnight p-3">
                <StepControls playing={r.playing} onPlay={r.play} onPause={r.pause} onStep={r.step} onRestart={() => r.debug(code, firstStdin)} speed={r.speed} onSpeed={r.setSpeed} disabled={r.snap.state === "waiting"} />
                <VariableWatch variables={r.snap.variables} line={r.snap.line} />
              </div>
            )}
            {(r.snap.state !== "idle" || report) && (
              <OutputConsole output={report ? report.stdout : r.snap.output} waitingFor={report ? null : r.snap.inputPrompt} onInput={r.provideInput} running={r.snap.state === "running"} />
            )}
            {err ? <ErrorCard error={err} language={language} /> : null}
            {report && report.tests.length > 0 && <TestResults report={report} tests={exercise.tests} />}
          </>
        ) : (
          <fieldset className="space-y-2" disabled={locked || pending}>
            <legend className="sr-only">{exercise.title}</legend>
            {exercise.type === "multiple_choice" ? (
              (exercise.config.options ?? []).map((opt, i) => {
                const selected = choice.includes(i);
                return (
                  <label key={i} className={cx("flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition", selected ? "bg-violet-100 ring-violet-700" : "bg-white ring-line hover:ring-violet/50")}>
                    <input type={exercise.config.multiple ? "checkbox" : "radio"} name={`mc-${exercise.id}`} checked={selected} onChange={() => setChoice(exercise.config.multiple ? (selected ? choice.filter((x) => x !== i) : [...choice, i]) : [i])} className="size-5 accent-[#8d55d0]" />
                    <span className="font-medium">{opt}</span>
                  </label>
                );
              })
            ) : (
              <input value={text} onChange={(e) => setText(e.target.value)} aria-label={t("exercise.answer")} className="h-12 w-full rounded-2xl border border-ink/15 px-4" />
            )}
            <button type="button" onClick={checkAnswer} disabled={!onSubmitAnswer || pending || (exercise.type === "multiple_choice" ? choice.length === 0 : !text.trim())} className="grad-edge mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-pink px-5 font-semibold text-ink transition active:scale-95 disabled:opacity-50">
              <Target size={18} weight="bold" aria-hidden /> {t("actions.check")}
            </button>
            {answerState === "right" && (
              <div className="rounded-2xl bg-[#d9fbf5] p-4 text-ink">
                <p className="flex items-center gap-2 font-bold text-mint-700">
                  <CheckCircle size={20} weight="fill" aria-hidden /> {t("feedback.right")}
                </p>
                {explanation ? <Markdown source={explanation} language={language} className="mt-2" /> : null}
              </div>
            )}
            {answerState === "notyet" && <p className="rounded-2xl bg-pink-100 p-4 font-semibold text-ink">{t("feedback.notYet")}</p>}
          </fieldset>
        )}

        {serverError ? <p role="alert" className="rounded-xl bg-pink-100 px-4 py-2 text-sm font-medium">{t(`serverErrors.${serverError in SERVER_ERRORS ? serverError : "unexpected"}` as "serverErrors.unexpected")}</p> : null}

        <AnimatePresence>
          {reward && (
            <motion.div initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 24 }} className="flex items-center gap-3 rounded-2xl bg-ink p-4 text-paper" role="status">
              <Sparkle size={26} weight="fill" className="text-sun" aria-hidden />
              <div>
                <p className="font-bold">{reward.lesson ? t("feedback.lessonDone") : t("feedback.passed")}</p>
                {reward.xp > 0 ? <p className="text-sm text-[#d9c2fa]">{t("feedback.xp", { xp: reward.xp })}</p> : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {exercise.hints.length > 0 && !passed && (
          <div className="rounded-2xl bg-violet-50 p-4 ring-1 ring-violet/20">
            <ol className="space-y-2">
              {exercise.hints.slice(0, hintsShown).map((h, i) => (
                <li key={i} className="flex gap-2">
                  <Lightbulb size={20} weight="fill" className="mt-0.5 shrink-0 text-violet-700" aria-hidden />
                  <Markdown source={h} language={language} />
                </li>
              ))}
            </ol>
            {hintsShown < exercise.hints.length ? (
              <button type="button" onClick={() => setHintsShown((n) => n + 1)} className={cx("inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 underline-offset-4 hover:underline", hintsShown > 0 && "mt-3")}>
                <Lightbulb size={16} weight="bold" aria-hidden />
                {t("hints.show", { n: hintsShown + 1, total: exercise.hints.length })}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

const SERVER_ERRORS = { lesson_locked: 1, rate_limited: 1, not_authenticated: 1, exercise_not_found: 1, unexpected: 1 };

function TestResults({ report, tests }: { report: RunReport; tests: Test[] }) {
  const t = useTranslations("learn.tests");
  const allOk = report.ok;
  return (
    <div className={cx("rounded-2xl p-4 ring-1", allOk ? "bg-[#d9fbf5] ring-mint/50" : "bg-white ring-line")}>
      <p className={cx("flex items-center gap-2 font-bold", allOk ? "text-mint-700" : "text-ink")}>
        {allOk ? <CheckCircle size={20} weight="fill" aria-hidden /> : <CircleDashed size={20} weight="bold" className="text-pink-700" aria-hidden />}
        {allOk ? t("allPassed") : t("notYet")}
      </p>
      <ul className="mt-3 space-y-2">
        {report.tests.map((r) => {
          const test = tests.find((x) => x.id === r.testId);
          return (
            <li key={r.testId} className="rounded-xl bg-white/70 px-3 py-2">
              <div className="flex items-start gap-2">
                {r.passed ? <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-mint-700" aria-label={t("passed")} /> : <CircleDashed size={18} weight="bold" className="mt-0.5 shrink-0 text-pink-700" aria-label={r.skipped ? t("skipped") : t("notYetShort")} />}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-ink">{test?.hidden ? t("hidden") : test?.description}</p>
                  {!r.passed && r.skipped ? <p className="text-ink-muted">{t("skippedHint")}</p> : null}
                  {!r.passed && !r.skipped && r.messageEs ? <p className="text-ink-soft">{r.messageEs}</p> : null}
                  {!r.passed && !r.skipped && !test?.hidden && r.kind === "stdout" && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-ink-muted">{t("expected")}</p>
                        <pre className="mt-1 overflow-x-auto rounded-lg bg-midnight px-2.5 py-1.5 font-mono text-xs text-mint">{String(r.expected ?? "")}</pre>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-ink-muted">{t("actual")}</p>
                        <pre className="mt-1 overflow-x-auto rounded-lg bg-midnight px-2.5 py-1.5 font-mono text-xs text-paper">{String(r.actual ?? "") || t("nothing")}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
