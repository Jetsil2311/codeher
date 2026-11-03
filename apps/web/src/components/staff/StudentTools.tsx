"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DownloadSimple, Trash, Trophy } from "@phosphor-icons/react/dist/ssr";
import { addNoteAction, deleteStudentAction, exportStudentAction, nominateAction, recordConsentAction } from "@/app/actions/staff";
import { Field, inputClass, selectClass, textareaClass } from "@/components/ui";
import { Panel } from "./StaffUi";

const KINDS = ["project", "first_program", "first_website", "community_presentation", "milestone"] as const;

export function StudentTools({ student, notes }: { student: { id: string; code: string; groupId: string; consent: { given: boolean; reference: string | null; recorded_at: string | null }; projects: { id: string; name: string }[] }; notes: { id: string; body: string; created_at: string; author: string }[] }) {
  const t = useTranslations("staff.student");
  const tk = useTranslations("landing.logros.kind");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [consent, setConsent] = useState(student.consent.given);
  const [ref, setRef] = useState(student.consent.reference ?? "");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [nom, setNom] = useState({ kind: "project", projectId: student.projects[0]?.id ?? "", title: "", blurb: "" });
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });
  const done = (r: { ok: boolean; error?: string }, ok: string) => { setMsg(r.ok ? ok : te((r.error ?? "unexpected") as "unexpected")); router.refresh(); };
  return (
    <div className="space-y-6" aria-busy={pending}>
      {msg ? <p role="status" className="rounded-2xl bg-violet-100 px-4 py-3 text-sm font-semibold">{msg}</p> : null}
      <Panel title={t("consent")}>
        <p className="mb-3 text-sm text-ink-muted">{t("consentHelp")}</p>
        <form onSubmit={(e) => { e.preventDefault(); start(async () => done(await recordConsentAction(student.id, consent, ref), t("saved"))); }} className="space-y-3">
          <label className="flex items-center gap-3 font-semibold"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="size-5 accent-[#8d55d0]" /> {t("consentGiven")}</label>
          <Field label={t("consentRef")} htmlFor="cref" helper={t("consentRefHelp")}><input id="cref" value={ref} onChange={(e) => setRef(e.target.value)} className={inputClass} /></Field>
          {student.consent.recorded_at ? <p className="text-xs text-ink-muted">{t("consentRecorded", { date: fmt.format(new Date(student.consent.recorded_at)) })}</p> : null}
          <button type="submit" className="h-10 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white">{t("save")}</button>
        </form>
      </Panel>
      <Panel title={<span className="inline-flex items-center gap-2"><Trophy size={18} weight="fill" aria-hidden /> {t("nominate")}</span>}>
        <form onSubmit={(e) => { e.preventDefault(); start(async () => done(await nominateAction({ studentId: student.id, projectId: nom.kind === "project" && nom.projectId ? nom.projectId : null, kind: nom.kind, title: nom.title, blurb: nom.blurb, tags: [] }), t("nominated"))); }} className="space-y-3">
          <Field label={t("kind")} htmlFor="nkind"><select id="nkind" value={nom.kind} onChange={(e) => setNom({ ...nom, kind: e.target.value })} className={selectClass}>{KINDS.map((k) => <option key={k} value={k}>{tk(k)}</option>)}</select></Field>
          {nom.kind === "project" && (
            <Field label={t("project")} htmlFor="nproj"><select id="nproj" value={nom.projectId} onChange={(e) => setNom({ ...nom, projectId: e.target.value })} className={selectClass}>{student.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          )}
          <Field label={t("title")} htmlFor="ntitle"><input id="ntitle" required value={nom.title} onChange={(e) => setNom({ ...nom, title: e.target.value })} maxLength={120} className={inputClass} /></Field>
          <Field label={t("blurb")} htmlFor="nblurb"><textarea id="nblurb" value={nom.blurb} onChange={(e) => setNom({ ...nom, blurb: e.target.value })} maxLength={600} rows={3} className={textareaClass} /></Field>
          <button type="submit" disabled={!nom.title.trim()} className="h-10 rounded-full bg-pink px-4 text-sm font-semibold text-ink disabled:opacity-50">{t("sendNomination")}</button>
        </form>
      </Panel>
      <Panel title={t("notes")}>
        <p className="mb-3 text-sm text-ink-muted">{t("notesHelp")}</p>
        <form onSubmit={(e) => { e.preventDefault(); start(async () => { done(await addNoteAction(student.id, note), t("saved")); setNote(""); }); }} className="space-y-2">
          <label htmlFor="note" className="sr-only">{t("notes")}</label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={textareaClass} />
          <button type="submit" disabled={!note.trim()} className="h-10 rounded-full bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{t("addNote")}</button>
        </form>
        <ul className="mt-4 space-y-3">{notes.map((n) => <li key={n.id} className="rounded-xl bg-violet-50 p-3 text-sm"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-xs text-ink-muted">{n.author} · {fmt.format(new Date(n.created_at))}</p></li>)}</ul>
      </Panel>
      <Panel title={t("data")}>
        <p className="mb-3 text-sm text-ink-muted">{t("dataHelp")}</p>
        <button type="button" onClick={() => start(async () => { const r = await exportStudentAction(student.id); if (r.ok) { const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" })); Object.assign(document.createElement("a"), { href: url, download: `datos-${student.code}.json` }).click(); URL.revokeObjectURL(url); } })} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12"><DownloadSimple size={16} aria-hidden /> {t("export")}</button>
        <div className="mt-5 border-t border-line pt-4">
          <Field label={t("deleteLabel", { code: student.code })} htmlFor="del"><input id="del" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className={`${inputClass} font-mono`} /></Field>
          <button type="button" disabled={confirm.trim().toUpperCase() !== student.code} onClick={() => start(async () => { const r = await deleteStudentAction(student.id, confirm, student.groupId); if (!r.ok) setMsg(te(r.error as "unexpected")); })} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-40"><Trash size={16} aria-hidden /> {t("delete")}</button>
        </div>
      </Panel>
    </div>
  );
}
