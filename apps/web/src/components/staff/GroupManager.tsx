"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ticket, ArrowsClockwise, DownloadSimple, Key, LockSimpleOpen, Plus, Printer, CheckCircle, LockSimple, Warning } from "@phosphor-icons/react/dist/ssr";
import type { GroupDetail } from "@/server/services/staff";
import { setGroupRecreoAction, addStudentsAction, assignCourseAction, resetPinAction, setGroupStatusAction, setStudentsStatusAction, unlockStudentAction, updateGroupAction } from "@/app/actions/staff";
import { Field, LanguageBadge, Tag, inputClass, textareaClass, cx } from "@/components/ui";
import { AccessCards, type CardData } from "./AccessCards";
import { Panel, TableWrap, relTime, td, th } from "./StaffUi";

export function GroupManager({ g, never }: { g: GroupDetail; never: string }) {
  const t = useTranslations("staff.group");
  const tl = useTranslations("learn.language");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cards, setCards] = useState<CardData[] | null>(null);
  const [names, setNames] = useState("");
  const [label, setLabel] = useState(g.label);
  const [endsOn, setEndsOn] = useState(g.ends_on ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "unexpected");
      else setError(null);
      router.refresh();
    });
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = selected.size === g.roster.length && g.roster.length > 0;

  const csv = () => {
    const head = ["numero", "codigo", "apodo", "estado", "lecciones_completadas", "ejercicios_aprobados", "xp", "ultima_actividad"];
    const rows = g.roster.map((s) => [s.number, s.code, s.nickname, s.status, s.lessons_completed, s.exercises_passed, s.xp, s.last_active_at ?? ""]);
    const text = [head, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `grupo-${g.prefix}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (cards)
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-[#d9fbf5] p-4">
          <p className="flex items-center gap-2 font-semibold"><Warning size={20} weight="fill" className="text-pink-700" aria-hidden /> {t("pinsOnce")}</p>
          <button type="button" onClick={() => setCards(null)} className="h-10 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/10">{t("backToGroup")}</button>
        </div>
        <AccessCards cards={cards} community={g.community} prefix={g.prefix} />
      </div>
    );

  return (
    <div className="space-y-6" aria-busy={pending}>
      {error ? <p role="alert" className="rounded-2xl bg-pink-100 px-4 py-3 font-medium">{te(error as "unexpected")}</p> : null}

      <Panel
        title={t("roster")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!selected.size} onClick={() => run(() => setStudentsStatusAction([...selected], "active"))} className="h-10 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12 disabled:opacity-40">{t("activate", { n: selected.size })}</button>
            <button type="button" disabled={!selected.size} onClick={() => run(() => setStudentsStatusAction([...selected], "inactive"))} className="h-10 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12 disabled:opacity-40">{t("deactivate", { n: selected.size })}</button>
            <Link href={`/equipo/grupos/${g.id}/tarjetas`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12"><Printer size={16} aria-hidden /> {t("reprint")}</Link>
            <button type="button" onClick={csv} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12"><DownloadSimple size={16} aria-hidden /> CSV</button>
          </div>
        }
      >
        <TableWrap label={t("roster")}>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={th}><input type="checkbox" aria-label={t("selectAll")} checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(g.roster.map((s) => s.id)))} className="size-4 accent-[#8d55d0]" /></th>
              <th scope="col" className={th}>{t("code")}</th>
              <th scope="col" className={th}>{t("nickname")}</th>
              <th scope="col" className={th}>{t("status")}</th>
              <th scope="col" className={th}>{t("lastActivity")}</th>
              <th scope="col" className={th}>{t("progress")}</th>
              <th scope="col" className={th}><span className="sr-only">{t("actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {g.roster.map((s) => (
              <tr key={s.id} className={cx("border-b border-line/70 last:border-0", selected.has(s.id) && "bg-violet-50")}>
                <td className={td}><input type="checkbox" aria-label={t("select", { name: s.nickname })} checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[#8d55d0]" /></td>
                <td className={`${td} font-mono font-bold`}>{s.code}</td>
                <td className={td}><Link href={`/equipo/estudiantes/${s.id}`} className="font-semibold text-violet-700 hover:underline">{s.nickname}</Link></td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    {s.status === "active" ? <Tag tone="mint"><CheckCircle size={12} weight="fill" aria-hidden /> {t("active")}</Tag> : <Tag tone="line">{t("inactive")}</Tag>}
                    {s.locked ? <Tag tone="pink"><LockSimple size={12} weight="bold" aria-hidden /> {s.hard_locked ? t("hardLocked") : t("locked")}</Tag> : null}
                  </div>
                </td>
                <td className={`${td} text-ink-muted`}>{relTime(s.last_active_at, never)}</td>
                <td className={td}><span className="font-mono tabular-nums">{s.lessons_completed}/{g.lessons_total}</span> <span className="text-xs text-ink-muted">· {s.xp} XP</span></td>
                <td className={td}>
                  <div className="flex justify-end gap-1">
                    {s.locked && <button type="button" onClick={() => run(() => unlockStudentAction(s.id))} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-violet-700 hover:bg-violet-100"><LockSimpleOpen size={14} aria-hidden /> {t("unlock")}</button>}
                    <button type="button" onClick={() => start(async () => { const r = await resetPinAction(s.id); if (r.ok) setCards([{ nickname: r.data.nickname, code: r.data.code, pin: r.data.pin }]); else setError(r.error); router.refresh(); })} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-violet-700 hover:bg-violet-100"><Key size={14} aria-hidden /> {t("resetPin")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("addStudents")}>
          <form onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addStudentsAction(g.id, names); if (r.ok) { setCards(r.data.map((x) => ({ nickname: x.nickname, code: x.code, pin: x.pin }))); setNames(""); } else setError(r.error); router.refresh(); }); }} className="space-y-3">
            <Field label={t("names")} htmlFor="add-names" helper={t("namesHelp")}>
              <textarea id="add-names" value={names} onChange={(e) => setNames(e.target.value)} rows={4} className={cx(textareaClass, "font-mono")} />
            </Field>
            <button type="submit" disabled={!names.trim() || pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-violet-700 px-5 font-semibold text-white disabled:opacity-50"><Plus size={16} weight="bold" aria-hidden /> {t("add")}</button>
          </form>
        </Panel>
        <Panel title={t("courses")}>
          <ul className="space-y-2">
            {g.courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2">
                <span className="font-semibold">{c.title}</span>
                <button type="button" onClick={() => run(() => assignCourseAction(g.id, c.id, false))} className="text-sm font-semibold text-danger hover:underline">{t("unassign")}</button>
              </li>
            ))}
            {g.available_courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl px-3 py-2 ring-1 ring-line">
                <span>{c.title}</span>
                <button type="button" onClick={() => run(() => assignCourseAction(g.id, c.id, true))} className="text-sm font-semibold text-violet-700 hover:underline">{t("assign")}</button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title={t("report")}>
        {g.exercise_report.length === 0 ? <p className="text-ink-muted">{t("noReport")}</p> : (
          <TableWrap label={t("report")}>
            <thead><tr className="border-b border-line"><th scope="col" className={th}>{t("exercise")}</th><th scope="col" className={th}>{t("attempted")}</th><th scope="col" className={th}>{t("passed")}</th><th scope="col" className={th}>{t("avgAttempts")}</th><th scope="col" className={th}>{t("avgHints")}</th><th scope="col" className={th}>{t("topError")}</th></tr></thead>
            <tbody>
              {g.exercise_report.map((r) => {
                const hard = r.attempted >= 2 && (r.passed / r.attempted < 0.5 || (r.avg_attempts ?? 0) >= 5);
                return (
                  <tr key={r.exercise_id} className="border-b border-line/70 last:border-0">
                    <td className={td}><p className="font-semibold">{r.title}</p><p className="flex items-center gap-1.5 text-xs text-ink-muted"><LanguageBadge language={r.language} label={tl(r.language)} size="sm" /> {r.lesson}</p></td>
                    <td className={`${td} font-mono`}>{r.attempted}</td>
                    <td className={`${td} font-mono`}>{r.passed}</td>
                    <td className={`${td} font-mono`}>{r.avg_attempts ?? "·"}</td>
                    <td className={`${td} font-mono`}>{r.avg_hints ?? "·"}</td>
                    <td className={td}>{r.top_error ? <span className="font-mono text-xs">{r.top_error}</span> : "·"} {hard ? <Tag tone="pink" className="ml-1">{t("flagHard")}</Tag> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title={t("settings")}>
        <form onSubmit={(e) => { e.preventDefault(); run(() => updateGroupAction(g.id, label, endsOn || null)); }} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label={t("label")} htmlFor="glabel"><input id="glabel" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} className={inputClass} /></Field>
          <Field label={t("endsOn")} htmlFor="gends"><input id="gends" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={inputClass} /></Field>
          <button type="submit" className="h-12 rounded-full bg-violet-700 px-5 font-semibold text-white">{t("save")}</button>
        </form>
        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-paper p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sun to-pink text-ink"><Ticket size={22} weight="fill" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{t("recreoTitle")}</span>
            <span className="block text-sm text-ink-muted">{t("recreoBody")}</span>
          </span>
          <button type="button" role="switch" aria-checked={g.recreo_enabled !== false} aria-label={t("recreoTitle")} onClick={() => run(() => setGroupRecreoAction(g.id, g.recreo_enabled === false))} className={cx("relative h-8 w-14 shrink-0 rounded-full transition-colors", g.recreo_enabled !== false ? "bg-mint-700" : "bg-ink/20")}>
            <span className={cx("absolute top-1 size-6 rounded-full bg-white shadow transition-all", g.recreo_enabled !== false ? "left-7" : "left-1")} />
          </button>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          {g.status === "active" ? (
            confirmClose ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{t("closeConfirm")}</p>
                <button type="button" onClick={() => { run(() => setGroupStatusAction(g.id, "closed")); setConfirmClose(false); }} className="h-10 rounded-full bg-danger px-4 text-sm font-semibold text-white">{t("closeYes")}</button>
                <button type="button" onClick={() => setConfirmClose(false)} className="h-10 rounded-full px-4 text-sm font-semibold">{t("cancel")}</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmClose(true)} className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-danger ring-1 ring-danger/30">{t("close")}</button>
            )
          ) : (
            <button type="button" onClick={() => run(() => setGroupStatusAction(g.id, "active"))} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12"><ArrowsClockwise size={16} aria-hidden /> {t("reopen")}</button>
          )}
        </div>
      </Panel>
    </div>
  );
}
