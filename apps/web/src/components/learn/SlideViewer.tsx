"use client";
// Slide viewer rendered straight from SlideDeckV1 JSON (tech spec 6.9): keyboard
// navigation, fullscreen, speaker-notes mode and print to PDF (one slide per page).
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CornersOut, Notepad, Printer, X, Lightbulb, Warning, Info, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { slideDeckV1Schema, type Slide, type SlideBlock } from "@codeher/core";
import { Markdown } from "@/components/code/Markdown";
import { LanguageBadge, cx } from "@/components/ui";

function Block({ b }: { b: SlideBlock }) {
  const t = useTranslations("learn");
  const [picked, setPicked] = useState<number | null>(null);
  switch (b.type) {
    case "text":
      return <Markdown source={b.markdown} language="python" runnable={false} className="text-xl md:text-2xl" />;
    case "bullets":
      return (
        <ul className="space-y-3 text-xl md:text-2xl">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-3 size-2.5 shrink-0 rounded-full bg-grad" aria-hidden />
              {it}
            </li>
          ))}
        </ul>
      );
    case "code":
      return (
        <div>
          <LanguageBadge language={b.language} label={t(`language.${b.language}`)} tone="dark" />
          <pre className="mt-2 overflow-x-auto rounded-2xl bg-midnight p-5 font-mono text-base text-paper md:text-lg">{b.code}</pre>
        </div>
      );
    case "callout": {
      const Icon = b.kind === "tip" ? Lightbulb : b.kind === "warning" ? Warning : Info;
      return (
        <div className={cx("flex gap-3 rounded-2xl p-4 text-lg", b.kind === "warning" ? "bg-pink-100" : "bg-violet-100")}>
          <Icon size={26} weight="fill" className="shrink-0 text-violet-700" aria-hidden />
          <Markdown source={b.markdown} language="python" runnable={false} />
        </div>
      );
    }
    case "check_question":
      return (
        <div>
          <p className="text-xl font-bold md:text-2xl">{b.prompt}</p>
          <div className="mt-4 grid gap-2">
            {b.options.map((o, i) => (
              <button key={i} type="button" onClick={() => setPicked(i)} className={cx("rounded-2xl px-4 py-3 text-left text-lg ring-1 transition", picked === i ? (i === b.answer_index ? "bg-[#d9fbf5] ring-mint" : "bg-pink-100 ring-pink") : "bg-white ring-line hover:ring-violet")}>
                {o}
              </button>
            ))}
          </div>
          {picked !== null && (
            <p className="mt-3 flex items-center gap-2 text-lg">
              {picked === b.answer_index ? <CheckCircle size={22} weight="fill" className="text-mint-700" aria-hidden /> : null}
              {picked === b.answer_index ? b.explanation : t("feedback.notYet")}
            </p>
          )}
        </div>
      );
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={b.url} alt={b.alt} className="max-h-[50vh] rounded-2xl" />;
  }
}

export function SlideViewer({ deck, title, onClose }: { deck: unknown; title: string; onClose: () => void }) {
  const t = useTranslations("learn.slides");
  const parsed = slideDeckV1Schema.safeParse(deck);
  const slides: Slide[] = parsed.success ? parsed.data.slides : [];
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(slides.length - 1, x + d))), [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else if (e.key === "Escape") onClose();
      else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    root.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!slides.length) return null;
  const s = slides[i];
  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("dialog", { title })} className="fixed inset-0 z-[80] flex flex-col bg-paper outline-none">
      <div className="no-print flex items-center justify-between gap-2 border-b border-line bg-white px-4 py-2">
        <p className="truncate text-sm font-semibold">{title}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setNotes((v) => !v)} aria-pressed={notes} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-violet-100">
            <Notepad size={18} aria-hidden /> <span className="hidden sm:inline">{t("notes")}</span>
          </button>
          <button type="button" onClick={() => root.current?.requestFullscreen?.()} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-violet-100">
            <CornersOut size={18} aria-hidden /> <span className="hidden sm:inline">{t("fullscreen")}</span>
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-violet-100">
            <Printer size={18} aria-hidden /> <span className="hidden sm:inline">{t("print")}</span>
          </button>
          <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-10 place-items-center rounded-full hover:bg-violet-100">
            <X size={20} weight="bold" aria-hidden />
          </button>
        </div>
      </div>
      <div className="no-print flex flex-1 overflow-hidden">
        <section className="dot-grid flex flex-1 items-center justify-center overflow-auto p-4 md:p-10" aria-live="polite">
          <div className="tile w-full max-w-4xl p-6 md:p-12">
            <p className="font-mono text-xs text-violet-700">{t("counter", { n: i + 1, total: slides.length })}</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">{s.title}</h2>
            <div className="mt-6 space-y-6">
              {s.blocks.map((b, k) => (
                <Block key={k} b={b} />
              ))}
            </div>
          </div>
        </section>
        {notes && (
          <aside className="hidden w-80 shrink-0 border-l border-line bg-white p-5 md:block" aria-label={t("notes")}>
            <h3 className="text-sm font-bold">{t("notes")}</h3>
            <p className="mt-2 whitespace-pre-wrap text-ink-soft">{s.notes || t("noNotes")}</p>
          </aside>
        )}
      </div>
      <div className="no-print flex items-center justify-between border-t border-line bg-white px-4 py-3">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-semibold ring-1 ring-ink/12 disabled:opacity-40">
          <ArrowLeft size={18} weight="bold" aria-hidden /> {t("prev")}
        </button>
        <button type="button" onClick={() => go(1)} disabled={i === slides.length - 1} className="inline-flex h-11 items-center gap-2 rounded-full bg-pink px-5 font-semibold text-ink disabled:opacity-40">
          {t("next")} <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
      </div>
      {/* Print: one slide per page */}
      <div className="hidden print:block">
        {slides.map((sl) => (
          <div key={sl.id} style={{ breakAfter: "page" }} className="p-10">
            <h2 className="text-4xl font-extrabold">{sl.title}</h2>
            <div className="mt-6 space-y-4">
              {sl.blocks.map((b, k) => (
                <Block key={k} b={b} />
              ))}
            </div>
            {sl.notes ? <p className="mt-8 border-t pt-4 text-sm text-ink-muted">{sl.notes}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
