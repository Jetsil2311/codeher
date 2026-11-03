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
import { ButtonLink, LanguageBadge, Tag } from "@/components/ui";

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

      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <LanguageBadge language={lesson.language} label={tl(`language.${lesson.language}`)} />
          <Tag tone="line">
            <Clock size={13} weight="bold" aria-hidden /> {t("minutes", { n: lesson.minutes })}
          </Tag>
          {mode === "student" && (
            <Tag tone="sun">
              <Star size={13} weight="fill" aria-hidden /> {t("xp", { n: lesson.xp })}
            </Tag>
          )}
          {completed && (
            <Tag tone="mint">
              <CheckCircle size={14} weight="fill" aria-hidden /> {t("completed")}
            </Tag>
          )}
        </div>
        <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{lesson.title}</h1>
        {lesson.summary ? <p className="mt-2 text-lg text-ink-soft">{lesson.summary}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {lesson.pair && (
            <ButtonLink href={`${base}/${lesson.pair.slug}`} variant="ghost" size="sm">
              <ArrowsLeftRight size={16} weight="bold" aria-hidden />
              {otherLang === "python" ? t("twinPython") : t("twinPseudo")}
            </ButtonLink>
          )}
          {lesson.deck ? (
            <button type="button" onClick={() => setDeckOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink ring-1 ring-ink/12 hover:bg-violet-50">
              <PresentationChart size={16} weight="bold" aria-hidden /> {t("slides")}
            </button>
          ) : null}
        </div>
      </header>

      {locked && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-line" role="note">
          <LockSimple size={22} weight="bold" className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
          <p>{lesson.unlock_after ? t("lockedAfter", { title: lesson.unlock_after }) : t("locked")}</p>
        </div>
      )}

      <section aria-label={t("content")} className="tile p-5 md:p-8">
        <Markdown source={lesson.content_md} language={lesson.language} />
      </section>

      {lesson.exercises.length > 0 && (
        <section aria-labelledby="ejercicios" className="mt-10">
          <h2 id="ejercicios" className="mb-4 text-2xl font-extrabold tracking-tight">
            {t("exercises")}
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
        <div className="mt-10 overflow-hidden rounded-[var(--radius-tile)] bg-ink p-6 text-paper md:p-8">
          <p className="font-accent text-2xl italic text-pink">{t("wellDone")}</p>
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
        </div>
      )}

      {deckOpen && lesson.deck ? <SlideViewer deck={lesson.deck} title={lesson.title} onClose={() => setDeckOpen(false)} /> : null}
    </div>
  );
}
