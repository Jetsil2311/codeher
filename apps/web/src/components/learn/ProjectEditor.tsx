"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ClockCounterClockwise, FloppyDisk, Trophy, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";
import { Playground } from "@/components/code/Playground";
import { nominateProjectAction, projectVersionAction, renameProjectAction, saveProjectAction } from "@/app/actions/student";
import { Field, Tag, inputClass, textareaClass } from "@/components/ui";

interface P { id: string; name: string; language: CodeLanguage; code: string; updated_at: string; lesson: { slug: string; title: string } | null; nomination: { status: string; title: string } | null; versions: { id: number; created_at: string }[] }

export function ProjectEditor({ project }: { project: P }) {
  const t = useTranslations("student.projects");
  const router = useRouter();
  const [code, setCode] = useState(project.code);
  const [editorKey, setEditorKey] = useState(0);
  const [status, setStatus] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [name, setName] = useState(project.name);
  const [showNominate, setShowNominate] = useState(false);
  const [nominated, setNominated] = useState(project.nomination?.status ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(code);
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

  const save = async (snapshot: boolean) => {
    setStatus("saving");
    const res = await saveProjectAction(project.id, latest.current, snapshot);
    setStatus(res.ok ? "saved" : "error");
    if (res.ok && res.data.versioned) router.refresh();
  };
  const onChange = (v: string) => {
    latest.current = v;
    setCode(v);
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(false), 1500);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-8">
      <Link href="/app/proyectos" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline"><ArrowLeft size={16} weight="bold" aria-hidden /> {t("title")}</Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={(e) => { e.preventDefault(); renameProjectAction(project.id, name).then(() => router.refresh()); }} className="flex min-w-0 flex-1 items-center gap-2">
          <label htmlFor="pname" className="sr-only">{t("rename")}</label>
          <input id="pname" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== project.name && renameProjectAction(project.id, name)} maxLength={80} className="h-12 min-w-0 flex-1 rounded-2xl bg-transparent px-2 text-2xl font-extrabold tracking-tight hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet/30 md:text-3xl" />
        </form>
        <div className="flex items-center gap-2">
          <span role="status" className="text-sm font-semibold text-ink-muted">{t(`status.${status}`)}</span>
          <button type="button" onClick={() => save(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12 hover:bg-violet-50"><FloppyDisk size={16} aria-hidden /> {t("saveVersion")}</button>
          {nominated ? (
            <Tag tone="sun"><Trophy size={13} weight="fill" aria-hidden /> {t(`nomination.${nominated}` as "nomination.nominated")}</Tag>
          ) : (
            <button type="button" onClick={() => setShowNominate(true)} className="grad-edge inline-flex h-10 items-center gap-1.5 rounded-full bg-pink px-4 text-sm font-semibold text-ink"><Trophy size={16} weight="fill" aria-hidden /> {t("showOff")}</button>
          )}
        </div>
      </div>
      {project.lesson ? <p className="mt-1 text-sm text-ink-muted">{t("fromLesson", { title: project.lesson.title })}</p> : null}

      {showNominate && (
        <NominateForm onClose={() => setShowNominate(false)} onDone={() => { setNominated("nominated"); setShowNominate(false); }} projectId={project.id} defaultTitle={name} />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="tile p-4 md:p-5">
          <Playground key={editorKey} language={project.language} code={code} onCodeChange={onChange} minHeight={360} />
        </div>
        <aside aria-labelledby="versiones" className="tile h-fit p-5">
          <h2 id="versiones" className="flex items-center gap-2 font-bold"><ClockCounterClockwise size={18} weight="bold" aria-hidden /> {t("versions")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("versionsHelp")}</p>
          <ul className="mt-3 space-y-1">
            {project.versions.map((v, i) => (
              <li key={v.id}>
                <button type="button" onClick={async () => { const r = await projectVersionAction(project.id, v.id); if (r.ok && r.data !== null) { latest.current = r.data; setCode(r.data); setEditorKey((k) => k + 1); setStatus("dirty"); save(true); } }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-violet-100">
                  <span>{fmt.format(new Date(v.created_at))}</span>
                  {i === 0 ? <span className="text-xs font-semibold text-mint-700">{t("latest")}</span> : <span className="text-xs font-semibold text-violet-700">{t("restore")}</span>}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function NominateForm({ projectId, defaultTitle, onClose, onDone }: { projectId: string; defaultTitle: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("student.projects");
  const [title, setTitle] = useState(defaultTitle);
  const [blurb, setBlurb] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <p role="status" className="mt-4 flex items-center gap-2 rounded-2xl bg-[#d9fbf5] p-4 font-semibold text-mint-700"><CheckCircle size={20} weight="fill" aria-hidden /> {t("nominatedOk")}</p>;
  return (
    <form className="tile mt-4 space-y-4 p-5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); const r = await nominateProjectAction(projectId, title, blurb); setBusy(false); if (r.ok) { setDone(true); onDone(); } }}>
      <p className="font-bold">{t("nominateTitle")}</p>
      <p className="text-sm text-ink-muted">{t("nominateHelp")}</p>
      <Field label={t("nominateName")} htmlFor="nt"><input id="nt" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={inputClass} /></Field>
      <Field label={t("nominateBlurb")} htmlFor="nb" helper={t("nominateBlurbHelp")}><textarea id="nb" value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={600} rows={3} className={textareaClass} /></Field>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="h-11 rounded-full bg-pink px-5 font-semibold text-ink disabled:opacity-50">{t("send")}</button>
        <button type="button" onClick={onClose} className="h-11 rounded-full px-4 font-semibold">{t("cancel")}</button>
      </div>
    </form>
  );
}
