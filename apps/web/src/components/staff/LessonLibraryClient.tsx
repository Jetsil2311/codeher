"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { createLessonAction, exportCourseAction } from "@/app/actions/staff";
import { Field, inputClass, selectClass } from "@/components/ui";

export function NewLessonForm({ modules, founder }: { modules: { id: string; label: string }[]; founder: boolean }) {
  const t = useTranslations("staff.library");
  const tl = useTranslations("learn.language");
  const te = useTranslations("errors");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [language, setLanguage] = useState<"python" | "pseudocode_es">("pseudocode_es");
  const [visibility, setVisibility] = useState<"public" | "program" | "draft">("program");
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const auto = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await createLessonAction({ title, slug, language, visibility, module_id: visibility === "program" ? moduleId : null }); if (r && !r.ok) setError(r.error); }); }}>
      <Field label={t("titleField")} htmlFor="nl-title"><input id="nl-title" required value={title} onChange={(e) => { setTitle(e.target.value); if (!touched) setSlug(auto(e.target.value)); }} className={inputClass} /></Field>
      <Field label={t("slug")} htmlFor="nl-slug" helper={t("slugHelp")}><input id="nl-slug" required value={slug} onChange={(e) => { setSlug(e.target.value); setTouched(true); }} className={`${inputClass} font-mono`} /></Field>
      <Field label={t("language")} htmlFor="nl-lang"><select id="nl-lang" value={language} onChange={(e) => setLanguage(e.target.value as "python")} className={selectClass}><option value="pseudocode_es">{tl("pseudocode_es")}</option><option value="python">{tl("python")}</option></select></Field>
      <Field label={t("visibility")} htmlFor="nl-vis" helper={!founder ? t("visHelp") : undefined}><select id="nl-vis" value={visibility} onChange={(e) => setVisibility(e.target.value as "program")} className={selectClass}><option value="program">{t("vis.program")}</option><option value="public">{t("vis.public")}</option><option value="draft">{t("vis.draft")}</option></select></Field>
      {visibility === "program" && <Field label={t("course")} htmlFor="nl-mod"><select id="nl-mod" value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={selectClass}>{modules.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>}
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{te(error as "unexpected")}</p> : null}
      <button type="submit" disabled={pending} className="h-11 w-full rounded-full bg-violet-700 font-semibold text-white disabled:opacity-50">{t("create")}</button>
    </form>
  );
}

export function ExportCourseButton({ courseId, slug }: { courseId: string; slug: string }) {
  const t = useTranslations("staff.library");
  return (
    <button type="button" onClick={async () => { const r = await exportCourseAction(courseId); if (r.ok) { const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" })); Object.assign(document.createElement("a"), { href: url, download: `${slug}.json` }).click(); URL.revokeObjectURL(url); } }} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-violet-700 hover:bg-violet-100">
      <DownloadSimple size={14} aria-hidden /> {t("export")}
    </button>
  );
}
