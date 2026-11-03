"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, PencilSimple, Trash, Trophy } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";
import { deleteProjectAction, duplicateProjectAction, renameProjectAction } from "@/app/actions/student";
import { LanguageBadge, Tag, cx } from "@/components/ui";

const TONES = ["from-violet to-pink", "from-[#00bbf9] to-violet", "from-pink to-[#ff9f6b]", "from-[#00c9a7] to-[#00bbf9]"];

interface Item { id: string; name: string; language: CodeLanguage; updated_at: string; lesson: { slug: string; title: string } | null; nomination: string | null }

export function ProjectList({ items }: { items: Item[] }) {
  const t = useTranslations("student.projects");
  const tl = useTranslations("learn.language");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={pending}>
      {items.map((p, i) => (
        <li key={p.id} className="group tile flex flex-col gap-3 overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
          <Link href={`/app/proyectos/${p.id}`} tabIndex={-1} aria-hidden className={cx("relative block h-24 overflow-hidden bg-gradient-to-br", TONES[i % TONES.length])}>
            <span className="blueprint-dark absolute inset-0 opacity-40" />
            <span className="absolute -bottom-2 left-4 right-10 rounded-t-xl bg-midnight/90 p-2.5 transition-transform duration-500 group-hover:-translate-y-1.5 group-hover:-rotate-1">
              <span className="block h-1.5 w-3/5 rounded-full bg-pink/70" />
              <span className="mt-1.5 block h-1.5 w-4/5 rounded-full bg-white/25" />
              <span className="mt-1.5 block h-1.5 w-1/2 rounded-full bg-mint/60" />
            </span>
          </Link>
          <div className="flex flex-1 flex-col gap-3 px-5 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <LanguageBadge language={p.language} label={tl(p.language)} size="sm" />
            {p.nomination ? <Tag tone="sun"><Trophy size={13} weight="fill" aria-hidden /> {t(`nomination.${p.nomination}` as "nomination.nominated")}</Tag> : null}
          </div>
          {editing === p.id ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { await renameProjectAction(p.id, name); setEditing(null); router.refresh(); }); }}>
              <label htmlFor={`rn-${p.id}`} className="sr-only">{t("rename")}</label>
              <input id={`rn-${p.id}`} autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="h-10 min-w-0 flex-1 rounded-xl border border-ink/15 px-3" />
              <button type="submit" className="h-10 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white">{t("save")}</button>
            </form>
          ) : (
            <Link href={`/app/proyectos/${p.id}`} className="text-lg font-bold hover:text-violet-700">{p.name}</Link>
          )}
          <p className="text-sm text-ink-muted">
            {t("updated", { date: fmt.format(new Date(p.updated_at)) })}
            {p.lesson ? ` · ${t("fromLesson", { title: p.lesson.title })}` : ""}
          </p>
          <div className="-mx-2 mt-auto flex flex-wrap gap-0.5 border-t border-line pt-2">
            <button type="button" onClick={() => { setEditing(p.id); setName(p.name); }} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-violet-100"><PencilSimple size={16} aria-hidden /> {t("rename")}</button>
            <button type="button" onClick={() => start(async () => { await duplicateProjectAction(p.id); router.refresh(); })} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-violet-100"><Copy size={16} aria-hidden /> {t("duplicate")}</button>
            {confirming === p.id ? (
              <span className="inline-flex items-center gap-1">
                <button type="button" onClick={() => start(async () => { await deleteProjectAction(p.id); setConfirming(null); router.refresh(); })} className="inline-flex h-10 items-center rounded-full bg-danger px-3 text-sm font-semibold text-white">{t("confirmDelete")}</button>
                <button type="button" onClick={() => setConfirming(null)} className="h-10 rounded-full px-3 text-sm font-semibold">{t("cancel")}</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(p.id)} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-danger hover:bg-danger/5"><Trash size={16} aria-hidden /> {t("delete")}</button>
            )}
          </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
