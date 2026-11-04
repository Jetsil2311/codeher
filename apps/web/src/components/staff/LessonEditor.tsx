"use client";
import Link from "next/link";
import { Segmented } from "@/components/motion/Segmented";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, CheckCircle, Copy, Eye, FloppyDisk, PencilSimple, Plus, PresentationChart, Trash, Warning, XCircle } from "@phosphor-icons/react/dist/ssr";
import { ChalkboardTeacher } from "@phosphor-icons/react/dist/ssr";
import { Sheet } from "@/components/motion/Sheet";
import { checkPublishable, PYTHON_CONSTRUCTS, testSchema, validationFingerprint, type CodeLanguage, type Test } from "@codeher/core";
import { parses } from "@codeher/grader/pseudo";
import { CodeEditor } from "@/components/code/CodeEditor";
import { gradeWith } from "@/components/code/engines";
import { Markdown } from "@/components/code/Markdown";
import { Playground } from "@/components/code/Playground";
import { SlideViewer } from "@/components/learn/SlideViewer";
import { deleteExerciseAction, deleteLessonAction, duplicateLessonAction, reorderExercisesAction, saveDeckAction, saveExerciseAction, setLessonStatusAction, updateLessonAction } from "@/app/actions/staff";
import { Field, LanguageBadge, Tag, inputClass, selectClass, textareaClass, cx } from "@/components/ui";
import type { Exercise, Lesson, SlideDeck } from "@/server/db/types";

interface Data {
  lesson: Lesson;
  editable: boolean;
  exercises: Exercise[];
  deck: SlideDeck | null;
  modules: { id: string; title: string; course: string }[];
  otherLessons: { id: string; title: string; language: CodeLanguage }[];
}

type Tab = "content" | "exercises" | "slides" | "try" | "publish";

const SEP = "\n---\n";

interface Draft {
  id?: string;
  slug: string;
  title: string;
  type: "code" | "multiple_choice" | "short_answer";
  instructions_md: string;
  starter_code: string;
  testsJson: string;
  hintsText: string;
  solution_code: string;
  wrongText: string;
  optionsText: string;
  answerJson: string;
  explanation: string;
  xp: number;
}

function toDraft(e?: Exercise, language: CodeLanguage = "python"): Draft {
  if (!e)
    return {
      slug: "",
      title: "",
      type: "code",
      instructions_md: "",
      starter_code: language === "python" ? "# Escribe tu código aquí\n" : "Proceso Ejercicio\n    // Escribe tu código aquí\nFinProceso\n",
      testsJson: JSON.stringify([{ kind: "stdout", description: "Escribe el resultado esperado", spec: { expected: "" } }], null, 2),
      hintsText: "",
      solution_code: "",
      wrongText: "",
      optionsText: "",
      answerJson: '{ "choices": [0] }',
      explanation: "",
      xp: 10,
    };
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    type: e.type,
    instructions_md: e.instructions_md,
    starter_code: e.starter_code,
    testsJson: JSON.stringify(e.tests.map(({ kind, description, spec, hidden }) => ({ kind, description, spec, ...(hidden ? { hidden } : {}) })), null, 2),
    hintsText: e.hints.join("\n"),
    solution_code: e.solution.solution_code,
    wrongText: e.solution.known_wrong_solutions.join(SEP),
    optionsText: ((e.config.options as string[] | undefined) ?? []).join("\n"),
    answerJson: e.solution.answer ? JSON.stringify(e.solution.answer) : '{ "choices": [0] }',
    explanation: e.solution.explanation_md,
    xp: e.xp_reward,
  };
}

interface Validation {
  ok: boolean;
  steps: { label: string; ok: boolean; detail?: string }[];
  fingerprint: string | null;
}

async function validate(language: CodeLanguage, d: Draft, tests: Test[], labels: Record<string, string>): Promise<Validation> {
  const steps: Validation["steps"] = [];
  const timeoutMs = 5000;
  const sol = await gradeWith(language, { id: `v-sol-${Date.now()}`, code: d.solution_code, tests, timeoutMs });
  steps.push({ label: labels.solution, ok: sol.ok, detail: sol.error ? `${sol.error.type}: ${sol.error.message}` : sol.tests.filter((t) => !t.passed).map((t) => t.messageEs ?? t.testId).join(" · ") || undefined });
  const starter = await gradeWith(language, { id: `v-st-${Date.now()}`, code: d.starter_code, tests, timeoutMs });
  steps.push({ label: labels.starter, ok: !starter.ok });
  if (language === "pseudocode_es") steps.push({ label: labels.starterParses, ok: parses(d.starter_code) });
  const wrongs = d.wrongText.split(SEP).map((w) => w.trim()).filter(Boolean);
  for (const [i, w] of wrongs.entries()) {
    const r = await gradeWith(language, { id: `v-w${i}-${Date.now()}`, code: w + "\n", tests, timeoutMs });
    steps.push({ label: `${labels.wrong} ${i + 1}`, ok: !r.ok });
  }
  const hints = d.hintsText.split("\n").filter((h) => h.trim());
  steps.push({ label: labels.hints, ok: hints.length >= 2 });
  const ok = steps.filter((s) => s.label !== labels.hints).every((s) => s.ok);
  return { ok, steps, fingerprint: ok ? await validationFingerprint(tests, d.solution_code) : null };
}

export function LessonEditor({ data, founder, pseudoConstructs }: { data: Data; founder: boolean; pseudoConstructs: string[] }) {
  const t = useTranslations("staff.editor");
  const tl = useTranslations("learn.language");
  const te = useTranslations("errors");
  const tlib = useTranslations("staff.library");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Tab>("content");
  const l = data.lesson;
  const [meta, setMeta] = useState({ title: l.title, summary: l.summary, content_md: l.content_md, visibility: l.visibility, pair_lesson_id: l.pair_lesson_id, estimated_minutes: l.estimated_minutes, xp_reward: l.xp_reward, module_id: l.module_id });
  const [previewMd, setPreviewMd] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [deckJson, setDeckJson] = useState(data.deck ? JSON.stringify(data.deck.slides, null, 2) : JSON.stringify({ schema_version: 1, slides: [{ id: "s1", title: l.title, blocks: [{ type: "text", markdown: "Escribe aquí el contenido." }], notes: "" }] }, null, 2));
  const [showDeck, setShowDeck] = useState(false);
  const [fingerprints, setFingerprints] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);
  const ro = !data.editable;

  const report = (r: { ok: boolean; error?: string }, okText: string) => {
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: te((r.error ?? "unexpected") as "unexpected") });
    router.refresh();
  };

  // Publish checks run client-side with the shared checkPublishable (same code as MCP).
  const checks = useMemo(() => {
    return checkPublishable({
      title: meta.title,
      content_md: meta.content_md,
      language: l.language,
      exercises: data.exercises.map((e) => ({
        slug: e.slug,
        type: e.type,
        required: e.required,
        hints: e.hints,
        tests: e.tests.map((x) => ({ kind: x.kind, description: x.description, spec: x.spec })),
        hasSolution: e.type === "code" ? !!e.solution.solution_code.trim() : !!e.solution.answer,
        validationMatches: e.type !== "code" || (fingerprints[e.id] ?? !!e.solution.validated_fingerprint),
        starterParses: l.language === "pseudocode_es" ? parses(e.starter_code) : true,
        solutionParses: l.language === "pseudocode_es" ? parses(e.solution.solution_code) : true,
        wrongSolutionsParse: l.language === "pseudocode_es" ? e.solution.known_wrong_solutions.every(parses) : true,
        hasAnswer: !!e.solution.answer,
      })),
      runnableFencesOk: true,
      constructNames: l.language === "pseudocode_es" ? pseudoConstructs : PYTHON_CONSTRUCTS,
      slideDeck: data.deck?.slides,
    });
  }, [meta, data, l.language, fingerprints, pseudoConstructs]);

  // Recompute fingerprints so a stale validation is visible.
  useEffect(() => {
    data.exercises.forEach(async (e) => {
      if (e.type !== "code" || !e.solution.validated_fingerprint) return;
      const fp = await validationFingerprint(e.tests, e.solution.solution_code);
      setFingerprints((f) => (f[e.id] === (fp === e.solution.validated_fingerprint) ? f : { ...f, [e.id]: fp === e.solution.validated_fingerprint }));
    });
  }, [data.exercises]);

  const tabs: { k: Tab; label: string }[] = [
    { k: "content", label: t("tabs.content") },
    { k: "exercises", label: t("tabs.exercises", { n: data.exercises.length }) },
    { k: "slides", label: t("tabs.slides") },
    { k: "try", label: t("tabs.try") },
    { k: "publish", label: t("tabs.publish") },
  ];

  const saveDraft = async () => {
    if (!draft) return;
    setValidation(null);
    let tests: Test[] = [];
    try {
      const parsed = JSON.parse(draft.testsJson || "[]");
      tests = (Array.isArray(parsed) ? parsed : []).map((x, i) => ({ ...testSchema.parse(x), id: `t${i}` }));
    } catch (e) {
      setMsg({ ok: false, text: t("testsInvalid", { detail: String((e as Error).message).slice(0, 160) }) });
      return;
    }
    let v: Validation = { ok: true, steps: [], fingerprint: null };
    if (draft.type === "code") {
      v = await validate(l.language, draft, tests, { solution: t("val.solution"), starter: t("val.starter"), starterParses: t("val.starterParses"), wrong: t("val.wrong"), hints: t("val.hints") });
      setValidation(v);
    }
    let answer: unknown = null;
    if (draft.type !== "code") {
      try { answer = JSON.parse(draft.answerJson); } catch { setMsg({ ok: false, text: t("answerInvalid") }); return; }
    }
    const bundle = {
      slug: draft.slug,
      type: draft.type,
      title: draft.title,
      instructions_md: draft.instructions_md,
      starter_code: draft.type === "code" ? draft.starter_code : "",
      config: draft.type === "multiple_choice" ? { options: draft.optionsText.split("\n").map((o) => o.trim()).filter(Boolean), multiple: false } : {},
      xp_reward: draft.xp,
      tests: draft.type === "code" ? tests.map(({ id: _id, ...rest }) => rest) : [],
      hints: draft.hintsText.split("\n").map((h) => h.trim()).filter(Boolean),
      solution: { solution_code: draft.solution_code, answer, explanation_md: draft.explanation },
      known_wrong_solutions: draft.wrongText.split(SEP).map((w) => w.trim()).filter(Boolean).map((w) => w + "\n"),
    };
    start(async () => {
      const r = await saveExerciseAction(l.id, bundle, { ok: draft.type !== "code" || v.ok, fingerprint: v.fingerprint }, draft.id);
      report(r, v.ok ? t("savedValidated") : t("savedNotValidated"));
      if (r.ok) setDraft((d) => (d ? { ...d, id: r.data } : d));
    });
  };

  const move = (i: number, d: number) => {
    const ids = data.exercises.map((e) => e.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    start(async () => report(await reorderExercisesAction(l.id, ids), t("reordered")));
  };

  return (
    <div className="space-y-6" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <LanguageBadge language={l.language} label={tl(l.language)} />
        <Tag tone={l.status === "published" ? "mint" : l.status === "review" ? "sun" : "line"}>{tlib(`st.${l.status}`)}</Tag>
        <Tag tone={l.visibility === "public" ? "pink" : "violet"}>{tlib(`vis.${l.visibility}`)}</Tag>
        {ro ? <Tag tone="ink">{t("readOnly")}</Tag> : null}
        <span className="ml-auto flex gap-2">
          <a href={l.visibility === "public" ? `/probar/${l.slug}` : `/app/leccion/${l.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12"><Eye size={16} aria-hidden /> {t("viewAsStudent")}</a>
          <Link href={`/equipo/guion/${l.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-midnight px-4 text-sm font-semibold text-paper"><ChalkboardTeacher size={16} weight="fill" aria-hidden /> {t("script")}</Link>
          <button type="button" onClick={() => start(async () => { await duplicateLessonAction(l.id); })} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12"><Copy size={16} aria-hidden /> {t("duplicate")}</button>
          {!ro && <button type="button" onClick={() => setDeleting(true)} aria-label={t("deleteLesson")} title={t("deleteLesson")} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold text-danger ring-1 ring-danger/25 hover:bg-danger/10"><Trash size={16} weight="bold" aria-hidden /><span className="max-sm:hidden">{t("deleteLesson")}</span></button>}
        </span>
      </div>
      {!ro && <DeleteLesson open={deleting} onClose={() => setDeleting(false)} id={l.id} slug={l.slug} />}

      {msg ? <p role="status" className={cx("rounded-2xl px-4 py-3 text-sm font-semibold", msg.ok ? "bg-[#d9fbf5] text-mint-700" : "bg-pink-100 text-ink")}>{msg.text}</p> : null}

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        <Segmented label={t("sections")} value={tab} onChange={(v) => setTab(v as typeof tab)} options={tabs.map((x) => ({ value: x.k, label: x.label }))} />
      </div>

      {tab === "content" && (
        <form className="tile space-y-5 p-5 md:p-6" onSubmit={(e) => { e.preventDefault(); start(async () => report(await updateLessonAction(l.id, meta, l.version), t("saved"))); }}>
          <fieldset disabled={ro} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("title")} htmlFor="ltitle"><input id="ltitle" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} required className={inputClass} /></Field>
              <Field label={t("summary")} htmlFor="lsum"><input id="lsum" value={meta.summary} onChange={(e) => setMeta({ ...meta, summary: e.target.value })} maxLength={400} className={inputClass} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label={t("visibility")} htmlFor="lvis" helper={!founder ? tlib("visHelp") : undefined}>
                <select id="lvis" value={meta.visibility} onChange={(e) => setMeta({ ...meta, visibility: e.target.value as Lesson["visibility"] })} className={selectClass}>
                  <option value="program">{tlib("vis.program")}</option><option value="public">{tlib("vis.public")}</option><option value="draft">{tlib("vis.draft")}</option>
                </select>
              </Field>
              <Field label={t("module")} htmlFor="lmod">
                <select id="lmod" value={meta.module_id ?? ""} onChange={(e) => setMeta({ ...meta, module_id: e.target.value || null })} className={selectClass}>
                  <option value="">{t("noModule")}</option>
                  {data.modules.map((m) => <option key={m.id} value={m.id}>{m.course} · {m.title}</option>)}
                </select>
              </Field>
              <Field label={t("minutes")} htmlFor="lmin"><input id="lmin" type="number" min={1} max={240} value={meta.estimated_minutes} onChange={(e) => setMeta({ ...meta, estimated_minutes: Number(e.target.value) })} className={inputClass} /></Field>
              <Field label="XP" htmlFor="lxp"><input id="lxp" type="number" min={0} max={1000} value={meta.xp_reward} onChange={(e) => setMeta({ ...meta, xp_reward: Number(e.target.value) })} className={inputClass} /></Field>
            </div>
            <Field label={t("twin")} htmlFor="lpair" helper={t("twinHelp")}>
              <select id="lpair" value={meta.pair_lesson_id ?? ""} onChange={(e) => setMeta({ ...meta, pair_lesson_id: e.target.value || null })} className={selectClass}>
                <option value="">{t("noTwin")}</option>
                {data.otherLessons.map((o) => <option key={o.id} value={o.id}>{o.title} ({tl(o.language)})</option>)}
              </select>
            </Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="lmd" className="text-sm font-semibold">{t("content")}</label>
                <button type="button" onClick={() => setPreviewMd((v) => !v)} className="text-sm font-semibold text-violet-700">{previewMd ? t("edit") : t("preview")}</button>
              </div>
              {previewMd ? (
                <div className="rounded-2xl bg-paper p-5 ring-1 ring-line"><Markdown source={meta.content_md} language={l.language} /></div>
              ) : (
                <textarea id="lmd" value={meta.content_md} onChange={(e) => setMeta({ ...meta, content_md: e.target.value })} rows={18} className={cx(textareaClass, "font-mono text-sm")} />
              )}
              <p className="mt-1.5 text-xs text-ink-muted">{t("contentHelp", { lang: l.language === "python" ? "python" : "pseudo" })}</p>
            </div>
            <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full bg-violet-700 px-5 font-semibold text-white"><FloppyDisk size={18} aria-hidden /> {t("save")}</button>
          </fieldset>
        </form>
      )}

      {tab === "exercises" && (
        <div className="space-y-4">
          <ul className="space-y-2">
            {data.exercises.map((e, i) => (
              <li key={e.id} className="tile flex flex-wrap items-center gap-3 p-4">
                <span className="font-mono text-sm text-ink-muted">{e.position}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.title}</p>
                  <p className="font-mono text-xs text-ink-muted">{e.slug} · {e.type} · {t("testsCount", { n: e.tests.length })}</p>
                </div>
                {e.type === "code" ? (e.solution.validated_fingerprint && fingerprints[e.id] !== false ? <Tag tone="mint"><CheckCircle size={13} weight="fill" aria-hidden /> {t("validated")}</Tag> : <Tag tone="pink"><Warning size={13} weight="fill" aria-hidden /> {t("notValidated")}</Tag>) : null}
                {!ro && (
                  <span className="flex gap-1">
                    <button type="button" aria-label={t("moveUp")} onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-full hover:bg-violet-100"><ArrowUp size={16} aria-hidden /></button>
                    <button type="button" aria-label={t("moveDown")} onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-full hover:bg-violet-100"><ArrowDown size={16} aria-hidden /></button>
                    <button type="button" onClick={() => { setDraft(toDraft(e, l.language)); setValidation(null); }} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"><PencilSimple size={15} aria-hidden /> {t("edit")}</button>
                    <button type="button" onClick={() => start(async () => report(await deleteExerciseAction(l.id, e.id), t("deleted")))} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-danger hover:bg-danger/5"><Trash size={15} aria-hidden /> {t("delete")}</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!ro && !draft && <button type="button" onClick={() => { setDraft(toDraft(undefined, l.language)); setValidation(null); }} className="inline-flex h-11 items-center gap-2 rounded-full bg-violet-700 px-5 font-semibold text-white"><Plus size={18} weight="bold" aria-hidden /> {t("newExercise")}</button>}

          {draft && (
            <div className="tile space-y-5 p-5 md:p-6">
              <h2 className="text-lg font-bold">{draft.id ? t("editExercise") : t("newExercise")}</h2>
              <div className="grid gap-4 md:grid-cols-4">
                <Field label={t("title")} htmlFor="et" className="md:col-span-2"><input id="et" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} /></Field>
                <Field label={tlib("slug")} htmlFor="es"><input id="es" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} className={`${inputClass} font-mono`} /></Field>
                <Field label={t("type")} htmlFor="ety"><select id="ety" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft["type"] })} className={selectClass}><option value="code">{t("types.code")}</option><option value="multiple_choice">{t("types.multiple_choice")}</option><option value="short_answer">{t("types.short_answer")}</option></select></Field>
              </div>
              <Field label={t("instructions")} htmlFor="ei"><textarea id="ei" value={draft.instructions_md} onChange={(e) => setDraft({ ...draft, instructions_md: e.target.value })} rows={3} className={textareaClass} /></Field>
              {draft.type === "code" ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div><p className="mb-1.5 text-sm font-semibold">{t("starter")}</p><CodeEditor value={draft.starter_code} onChange={(v) => setDraft((d) => d && { ...d, starter_code: v })} language={l.language} minHeight={180} label={t("starter")} /></div>
                    <div><p className="mb-1.5 text-sm font-semibold">{t("solution")}</p><CodeEditor value={draft.solution_code} onChange={(v) => setDraft((d) => d && { ...d, solution_code: v })} language={l.language} minHeight={180} label={t("solution")} /></div>
                  </div>
                  <Field label={t("tests")} htmlFor="etj" helper={t("testsHelp")}><textarea id="etj" value={draft.testsJson} onChange={(e) => setDraft({ ...draft, testsJson: e.target.value })} rows={10} className={cx(textareaClass, "font-mono text-sm")} /></Field>
                  <Field label={t("wrong")} htmlFor="ew" helper={t("wrongHelp")}><textarea id="ew" value={draft.wrongText} onChange={(e) => setDraft({ ...draft, wrongText: e.target.value })} rows={6} className={cx(textareaClass, "font-mono text-sm")} /></Field>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {draft.type === "multiple_choice" && <Field label={t("options")} htmlFor="eo" helper={t("optionsHelp")}><textarea id="eo" value={draft.optionsText} onChange={(e) => setDraft({ ...draft, optionsText: e.target.value })} rows={4} className={textareaClass} /></Field>}
                  <Field label={t("answer")} htmlFor="ea" helper={draft.type === "multiple_choice" ? '{ "choices": [0] }' : '{ "accepted": ["10", "diez"] }'}><input id="ea" value={draft.answerJson} onChange={(e) => setDraft({ ...draft, answerJson: e.target.value })} className={`${inputClass} font-mono`} /></Field>
                  <Field label={t("explanation")} htmlFor="eex" className="md:col-span-2"><textarea id="eex" value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} rows={2} className={textareaClass} /></Field>
                </div>
              )}
              <Field label={t("hints")} htmlFor="eh" helper={t("hintsHelp")}><textarea id="eh" value={draft.hintsText} onChange={(e) => setDraft({ ...draft, hintsText: e.target.value })} rows={3} className={textareaClass} /></Field>
              {validation && (
                <div className={cx("rounded-2xl p-4", validation.ok ? "bg-[#d9fbf5]" : "bg-pink-100")} role="status">
                  <p className="font-bold">{validation.ok ? t("val.ok") : t("val.notOk")}</p>
                  <ul className="mt-2 space-y-1 text-sm">{validation.steps.map((s, i) => <li key={i} className="flex items-start gap-2">{s.ok ? <CheckCircle size={16} weight="fill" className="mt-0.5 text-mint-700" aria-hidden /> : <XCircle size={16} weight="fill" className="mt-0.5 text-pink-700" aria-hidden />}<span>{s.label}{s.detail ? <span className="block text-xs text-ink-muted">{s.detail}</span> : null}</span></li>)}</ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveDraft} disabled={pending || !draft.slug || !draft.title} className="grad-edge inline-flex h-11 items-center gap-2 rounded-full bg-pink px-5 font-semibold text-ink disabled:opacity-50"><CheckCircle size={18} weight="bold" aria-hidden /> {draft.type === "code" ? t("validateAndSave") : t("save")}</button>
                <button type="button" onClick={() => setDraft(null)} className="h-11 rounded-full px-4 font-semibold">{t("close")}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "slides" && (
        <div className="tile space-y-4 p-5 md:p-6">
          <p className="text-sm text-ink-muted">{t("slidesHelp")}</p>
          <label htmlFor="deck" className="sr-only">{t("tabs.slides")}</label>
          <textarea id="deck" value={deckJson} onChange={(e) => setDeckJson(e.target.value)} rows={18} disabled={ro} className={cx(textareaClass, "font-mono text-sm")} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowDeck(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 font-semibold ring-1 ring-ink/12"><PresentationChart size={18} aria-hidden /> {t("previewDeck")}</button>
            {!ro && (["draft", "published"] as const).map((s) => (
              <button key={s} type="button" onClick={() => start(async () => report(await saveDeckAction(l.id, meta.title, deckJson, s), t("deckSaved")))} className={cx("h-11 rounded-full px-5 font-semibold", s === "published" ? "bg-violet-700 text-white" : "bg-white ring-1 ring-ink/12")}>{s === "published" ? t("publishDeck") : t("saveDeckDraft")}</button>
            ))}
          </div>
          {showDeck && (() => { try { return <SlideViewer deck={JSON.parse(deckJson)} title={meta.title} onClose={() => setShowDeck(false)} />; } catch { return <p role="alert" className="text-sm text-danger">{t("deckInvalid")}</p>; } })()}
        </div>
      )}

      {tab === "try" && (
        <div className="tile p-5 md:p-6">
          <p className="mb-4 text-sm text-ink-muted">{t("tryHelp")}</p>
          <Playground language={l.language} code={l.language === "python" ? 'print("Hola")\n' : 'Proceso Prueba\n    Escribir "Hola";\nFinProceso\n'} minHeight={240} />
        </div>
      )}

      {tab === "publish" && (
        <div className="tile space-y-5 p-5 md:p-6">
          <div>
            <h2 className="text-lg font-bold">{t("checks")}</h2>
            {checks.blockers.length === 0 ? <p className="mt-2 flex items-center gap-2 font-semibold text-mint-700"><CheckCircle size={20} weight="fill" aria-hidden /> {t("noBlockers")}</p> : (
              <ul className="mt-2 space-y-1.5">{checks.blockers.map((b, i) => <li key={i} className="flex gap-2 text-sm"><XCircle size={18} weight="fill" className="shrink-0 text-pink-700" aria-hidden /><span><span className="font-mono text-xs text-ink-muted">{b.path}</span> {b.issue}</span></li>)}</ul>
            )}
            {checks.warnings.length > 0 && (
              <ul className="mt-3 space-y-1.5">{checks.warnings.map((w, i) => <li key={i} className="flex gap-2 text-sm"><Warning size={18} weight="fill" className="shrink-0 text-sun-700" aria-hidden /><span><span className="font-mono text-xs text-ink-muted">{w.path}</span> {w.issue}</span></li>)}</ul>
            )}
          </div>
          {!ro && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-5">
              <button type="button" disabled={checks.blockers.length > 0 || (l.visibility === "public" && !founder)} onClick={() => start(async () => report(await setLessonStatusAction(l.id, "published"), t("published")))} className="grad-edge h-11 rounded-full bg-pink px-5 font-semibold text-ink disabled:opacity-40">{t("publish")}</button>
              <button type="button" onClick={() => start(async () => report(await setLessonStatusAction(l.id, "review"), t("sentReview")))} className="h-11 rounded-full bg-white px-5 font-semibold ring-1 ring-ink/12">{t("toReview")}</button>
              <button type="button" onClick={() => start(async () => report(await setLessonStatusAction(l.id, "draft"), t("backToDraft")))} className="h-11 rounded-full bg-white px-5 font-semibold ring-1 ring-ink/12">{t("toDraft")}</button>
              <button type="button" onClick={() => start(async () => report(await setLessonStatusAction(l.id, "archived"), t("archived")))} className="h-11 rounded-full px-5 font-semibold text-danger">{t("archive")}</button>
              {l.visibility === "public" && !founder ? <p className="w-full text-sm text-ink-muted">{te("founder_publishes_public")}</p> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeleteLesson({ open, onClose, id, slug }: { open: boolean; onClose: () => void; id: string; slug: string }) {
  const t = useTranslations("staff.editor");
  const te = useTranslations("errors");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => { if (open) { setTyped(""); setErr(null); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={t("deleteTitle")} closeLabel={t("deleteCancel")}>
      <form
        className="space-y-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await deleteLessonAction(id, typed.trim());
            if (r && !r.ok) setErr(te(r.error as "unexpected"));
          });
        }}
      >
        <p className="text-sm text-ink-soft">{t("deleteBody")}</p>
        <Field label={t("deleteConfirm", { slug })} htmlFor="del-l" error={err}>
          <input id="del-l" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className={cx(inputClass, "font-mono")} />
        </Field>
        <button type="submit" disabled={busy || typed.trim() !== slug} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-danger font-semibold text-white disabled:opacity-40">
          <Trash size={16} weight="bold" aria-hidden /> {t("deleteLesson")}
        </button>
      </form>
    </Sheet>
  );
}
