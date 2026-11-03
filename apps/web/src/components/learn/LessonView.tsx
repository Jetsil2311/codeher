"use client";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, ArrowsLeftRight, Clock, Info, LockSimple, PresentationChart, Star, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";
import { ExerciseCard, type ExercisePayload, type SubmitResult } from "@/components/code/ExerciseCard";
import { Markdown } from "@/components/code/Markdown";
import { SlideViewer } from "@/components/learn/SlideViewer";
import { celebrate } from "@/components/code/celebrate";
import { ButtonLink, LanguageBadge, cx } from "@/components/ui";
import { motion } from "motion/react";

export interface LessonViewData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content_md: string;
  language: CodeLanguage;
  minutes: number;
  xp: number;
  pair: { slug: string; title: string; language: CodeLanguage } | null;
  deck: unknown;
  exercises: ExercisePayload[];
  status?: "not_started" | "in_progress" | "completed";
  unlocked?: boolean;
  unlock_after?: string | null;
  course?: { slug: string; title: string } | null;
  next?: { slug: string; title: string; language: CodeLanguage } | null;
}

export interface LessonActions {
  submitCode?: Parameters<typeof ExerciseCard>[0]["onSubmitCode"];
  submitAnswer?: Parameters<typeof ExerciseCard>[0]["onSubmitAnswer"];
  completeLesson?: (lessonId: string) => Promise<SubmitResult | { ok: boolean; error?: string }>;
  saveProject?: (code: string, exerciseTitle: string) => Promise<{ ok: boolean; error?: string; data?: string }>;
}

export function LessonView({ lesson, mode, actions }: { lesson: LessonViewData; mode: "visitor" | "student"; actions: LessonActions }) {
  const t = useTranslations("learn.lesson");
  const tl = useTranslations("learn");
  const [passed, setPassed] = useState<Set<string>>(new Set(lesson.exercises.filter((e) => e.progress?.passed).map((e) => e.id)));
  const [completed, setCompleted] = useState(lesson.status === "completed");
  const [deckOpen, setDeckOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const base = mode === "visitor" ? "/probar" : "/app/leccion";
  const locked = mode === "student" && lesson.unlocked === false;
  const allPassed = lesson.exercises.length > 0 && lesson.exercises.every((e) => passed.has(e.id));
  const otherLang = lesson.language === "python" ? "pseudocode_es" : "python";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 md:pt-10">
      <nav aria-label={t("breadcrumb")} className="mb-4">
        <Link href={mode === "visitor" ? "/probar" : "/app/ruta"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline">
          <ArrowLeft size={16} weight="bold" aria-hidden />
          {mode === "visitor" ? t("backToLibrary") : lesson.course?.title ?? t("backToPath")}
        </Link>
      </nav>

      {mode === "visitor" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-violet-100 p-4 text-ink" role="note">
          <Info size={22} weight="fill" className="mt-0.5 shrink-0 text-violet-700" aria-hidden />
          <p className="text-[0.95rem]">
            {t("visitorBanner")}{" "}
            <Link href="/entrar" className="font-bold text-violet-700 underline underline-offset-4">
              {t("visitorBannerCta")}
            </Link>
          </p>
        </div>
      )}

      <header className="relative isolate mb-6 overflow-hidden rounded-[1.75rem] bg-midnight p-5 text-paper shadow-[var(--shadow-lift)] md:p-8">
        <div className="blueprint-dark absolute inset-0 -z-10 opacity-50" aria-hidden />
        <div className={cx("absolute -right-16 -top-20 -z-10 size-64 rounded-full blur-3xl", lesson.language === "python" ? "bg-sky/35" : "bg-violet/50")} aria-hidden />
        <div className="absolute -bottom-24 left-1/3 -z-10 size-56 rounded-full bg-pink/30 blur-3xl" aria-hidden />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <LanguageBadge language={lesson.language} label={tl(`language.${lesson.language}`)} tone="dark" />
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-white/10 px-2.5 text-xs font-semibold text-[#d6cdea] ring-1 ring-white/10">
            <Clock size={13} weight="bold" aria-hidden /> {t("minutes", { n: lesson.minutes })}
          </span>
          {mode === "student" && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-sun/15 px-2.5 text-xs font-bold text-sun ring-1 ring-sun/30">
              <Star size={13} weight="fill" aria-hidden /> {t("xp", { n: lesson.xp })}
            </span>
          )}
          {completed && (
            <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex h-7 items-center gap-1 rounded-full bg-mint/15 px-2.5 text-xs font-bold text-mint ring-1 ring-mint/30">
              <CheckCircle size={14} weight="fill" aria-hidden /> {t("completed")}
            </motion.span>
          )}
        </div>
        <h1 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight md:text-[2.6rem]">{lesson.title}</h1>
        {lesson.summary ? <p className="mt-2 max-w-[56ch] text-lg text-[#d6cdea]">{lesson.summary}</p> : null}
        {(!!lesson.pair || !!lesson.deck) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {lesson.pair && (
              <Link href={`${base}/${lesson.pair.slug}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-paper ring-1 ring-white/15 transition hover:bg-white/15">
                <ArrowsLeftRight size={16} weight="bold" aria-hidden />
                {otherLang === "python" ? t("twinPython") : t("twinPseudo")}
              </Link>
            )}
            {lesson.deck ? (
              <button type="button" onClick={() => setDeckOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-paper px-4 text-sm font-bold text-ink transition hover:bg-white">
                <PresentationChart size={16} weight="bold" aria-hidden /> {t("slides")}
              </button>
            ) : null}
          </div>
        )}
      </header>

      {lesson.exercises.length > 0 && !locked && (
        <div className={cx("sticky z-30 mb-6", mode === "visitor" ? "top-[4.75rem] md:top-[5.5rem]" : "top-16 lg:top-4")}>
          <div className="mx-auto flex w-fit items-center gap-3 rounded-full bg-white/90 py-1.5 pl-2 pr-4 shadow-[var(--shadow-tile)] ring-1 ring-ink/[0.06] backdrop-blur-xl">
            <span className="flex gap-1" aria-hidden>
              {lesson.exercises.map((e) => (
                <motion.span key={e.id} animate={{ scale: passed.has(e.id) ? [1, 1.35, 1] : 1 }} className={cx("grid size-7 place-items-center rounded-full text-xs font-bold", passed.has(e.id) ? "bg-mint-700 text-white" : "bg-ink/[0.06] text-ink-muted")}>
                  {passed.has(e.id) ? <CheckCircle size={16} weight="fill" /> : lesson.exercises.indexOf(e) + 1}
                </motion.span>
              ))}
            </span>
            <span className="text-sm font-bold tabular-nums">{t("progressPill", { done: passed.size, total: lesson.exercises.length })}</span>
          </div>
        </div>
      )}

      {locked && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-line" role="note">
          <LockSimple size={22} weight="bold" className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
          <p>{lesson.unlock_after ? t("lockedAfter", { title: lesson.unlock_after }) : t("locked")}</p>
        </div>
      )}

      <section aria-label={t("content")} className="tile rounded-[1.75rem] p-5 md:p-8">
        <Markdown source={lesson.content_md} language={lesson.language} />
      </section>

      {lesson.exercises.length > 0 && (
        <section aria-labelledby="ejercicios" className="mt-10">
          <h2 id="ejercicios" className="mb-4 flex items-center gap-3 text-2xl font-extrabold tracking-tight">
            {t("exercises")}
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-sm font-bold text-violet-800">{lesson.exercises.length}</span>
          </h2>
          <div className="space-y-6">
            {lesson.exercises.map((ex) => (
              <div key={ex.id}>
                <ExerciseCard
                  exercise={ex}
                  language={lesson.language}
                  locked={locked}
                  onSubmitCode={actions.submitCode}
                  onSubmitAnswer={actions.submitAnswer}
                  onCompleted={(r) => {
                    setPassed((s) => new Set(s).add(ex.id));
                    if (r.lesson_completed) setCompleted(true);
                  }}
                  saveLabel={t("saveProject")}
                  noSaveLabel={mode === "visitor" ? t("visitorNoSave") : undefined}
                  onSaveProject={
                    actions.saveProject
                      ? async (code) => {
                          const res = await actions.saveProject!(code, ex.title);
                          if (res.ok && res.data) setSaved(res.data);
                          return res.ok;
                        }
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {saved && (
        <p role="status" className="mt-4 rounded-2xl bg-[#d9fbf5] px-4 py-3 font-semibold text-mint-700">
          {t("projectSaved")}{" "}
          <Link href={`/app/proyectos/${saved}`} className="text-violet-700 underline underline-offset-4">
            {t("openProject")}
          </Link>
        </p>
      )}

      {mode === "student" && lesson.exercises.length === 0 && !completed && actions.completeLesson && !locked && (
        <div className="mt-8">
          <button
            type="button"
            onClick={async () => {
              const r = await actions.completeLesson!(lesson.id);
              if (r.ok) {
                setCompleted(true);
                celebrate(true);
              }
            }}
            className="grad-edge inline-flex h-12 items-center gap-2 rounded-full bg-pink px-6 font-semibold text-ink"
          >
            <CheckCircle size={20} weight="bold" aria-hidden /> {t("markDone")}
          </button>
        </div>
      )}

      {(allPassed || completed) && (
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="relative isolate mt-10 overflow-hidden rounded-[1.75rem] bg-midnight p-6 text-paper shadow-[var(--shadow-lift)] md:p-8">
          <div className="absolute -right-12 -top-16 -z-10 size-56 rounded-full bg-pink/40 blur-3xl" aria-hidden />
          <div className="absolute -bottom-16 left-10 -z-10 size-48 rounded-full bg-violet/40 blur-3xl" aria-hidden />
          <p className="font-accent text-3xl italic text-pink">{t("wellDone")}</p>
          <p className="mt-1 text-lg font-bold">{mode === "visitor" ? t("visitorDone") : t("studentDone")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {lesson.next && mode === "student" ? (
              <ButtonLink href={`${base}/${lesson.next.slug}`} size="lg">
                {t("nextLesson", { title: lesson.next.title })} <ArrowRight size={18} weight="bold" aria-hidden />
              </ButtonLink>
            ) : (
              <ButtonLink href={mode === "visitor" ? "/probar" : "/app/ruta"} size="lg">
                {mode === "visitor" ? t("moreLessons") : t("backToPath")} <ArrowRight size={18} weight="bold" aria-hidden />
              </ButtonLink>
            )}
            {mode === "visitor" && (
              <ButtonLink href="/entrar" variant="dark" size="lg">
                {t("visitorBannerCta")}
              </ButtonLink>
            )}
          </div>
        </motion.div>
      )}

      {deckOpen && lesson.deck ? <SlideViewer deck={lesson.deck} title={lesson.title} onClose={() => setDeckOpen(false)} /> : null}
    </div>
  );
}
