"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClockCounterClockwise, PlayCircle } from "@phosphor-icons/react/dist/ssr";
import { Stagger, StaggerItem } from "@/components/motion/Motion";
import { LanguageBadge, Tag } from "@/components/ui";
import type { CodeLanguage } from "@codeher/core";

interface Item { id: string; title: string; language: CodeLanguage; exercises: number; draft: boolean; languageLabel: string }

export function ScriptPicker({ groups, labels }: { groups: { course: string; lessons: Item[] }[]; labels: Record<string, string> }) {
  const [last, setLast] = useState<{ id: string; title: string; step: number } | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("codeher.guion") ?? "{}");
      const hit = groups.flatMap((g) => g.lessons).find((l) => l.id === saved.lesson);
      if (hit) setLast({ id: hit.id, title: hit.title, step: (saved.step ?? 0) + 1 });
    } catch {
      /* private mode */
    }
  }, [groups]);
  if (!groups.length) return <p className="text-ink-muted">{labels.empty}</p>;
  return (
    <div className="space-y-8">
      {last && (
        <Link href={`/equipo/guion/${last.id}`} className="group flex items-center gap-4 rounded-[1.5rem] bg-midnight p-4 text-paper shadow-[var(--shadow-lift)] transition hover:-translate-y-0.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-grad"><ClockCounterClockwise size={24} weight="bold" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-pink">{labels.continue}</span>
            <span className="block truncate text-lg font-bold">{last.title} <span className="font-mono text-sm text-[#b8acd6]">· {last.step}</span></span>
          </span>
          <ArrowRight size={22} weight="bold" className="transition-transform group-hover:translate-x-1" aria-hidden />
        </Link>
      )}
      {groups.map((g) => (
        <section key={g.course}>
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">{g.course}</h2>
          <Stagger as="ul" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.lessons.map((l, i) => (
              <StaggerItem as="li" key={l.id}>
                <Link href={`/equipo/guion/${l.id}`} className="group tile flex h-full items-center gap-4 p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-midnight font-mono text-lg font-bold text-paper transition group-hover:bg-grad">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{l.title}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      <LanguageBadge language={l.language} label={l.languageLabel} size="sm" />
                      {labels.exercisesN.replace("{n}", String(l.exercises))}
                      {l.draft && <Tag tone="line">{labels.draft}</Tag>}
                    </span>
                  </span>
                  <PlayCircle size={30} weight="fill" className="shrink-0 text-violet-700 transition-transform group-hover:scale-110" aria-hidden />
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ))}
    </div>
  );
}
