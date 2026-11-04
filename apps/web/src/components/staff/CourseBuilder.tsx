"use client";
// Course builder: modules and lessons in the order students follow them. Drag a handle (or
// use ↑/↓ on it) to reorder, publish modules, add / move / remove lessons, edit and delete
// the course. Every change goes through a server action that re-checks permissions.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion, type DragControls } from "motion/react";
import { useTranslations } from "next-intl";
import {
  ArrowRight, ArrowsDownUp, ChalkboardTeacher, CheckCircle, Circle, DotsSixVertical, DotsThree, Eye, EyeSlash, FolderSimplePlus,
  PencilSimple, Plus, PlusCircle, SignOut, Trash, Warning,
} from "@phosphor-icons/react/dist/ssr";
import {
  createCourseLessonAction, deleteCourseAction, deleteLessonAction, deleteModuleAction, moveLessonAction, reorderLessonsAction,
  reorderModulesAction, saveCourseAction, saveModuleAction, setCourseStatusAction, setModuleStatusAction,
} from "@/app/actions/staff";
import { Sheet } from "@/components/motion/Sheet";
import { Segmented, softSpring } from "@/components/motion/Segmented";
import { Field, LanguageBadge, Tag, cx, inputClass, textareaClass } from "@/components/ui";
import type { CourseDetail } from "@/server/services/staff";

type Mod = CourseDetail["modules"][number];
type Les = Mod["lessons"][number];
type Status = "draft" | "review" | "published" | "archived";
type Result = { ok: true; data?: unknown } | { ok: false; error: string };

const statusTone = { draft: "line", review: "sun", published: "mint", archived: "ink" } as const;
const btn = "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-40";

export function CourseBuilder({ data }: { data: CourseDetail }) {
  const t = useTranslations("staff.courses");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; text: string; id: number } | null>(null);
  const [mods, setMods] = useState(data.modules);
  const order = useRef(mods);
  order.current = mods;
  useEffect(() => setMods(data.modules), [data.modules]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(id);
  }, [toast]);

  const [lessonMenu, setLessonMenu] = useState<{ lesson: Les; moduleId: string } | null>(null);
  const [modMenu, setModMenu] = useState<Mod | null>(null);
  const [addTo, setAddTo] = useState<Mod | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const c = data.course;
  const can = data.editable;

  /** Runs an action, shows the result and refreshes the server data. */
  const run = (fn: () => Promise<Result | void>, okText: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r && !r.ok) setToast({ ok: false, text: te(r.error as "unexpected"), id: Date.now() });
      else {
        setToast({ ok: true, text: okText, id: Date.now() });
        after?.();
      }
      router.refresh();
    });

  const saveModuleOrder = () => run(() => reorderModulesAction(c.id, order.current.map((m) => m.id)), t("reordered"));
  const nudgeModule = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= mods.length) return;
    const next = [...mods];
    [next[i], next[j]] = [next[j], next[i]];
    setMods(next);
    order.current = next;
    saveModuleOrder();
  };

  const checks = [
    { ok: mods.some((m) => m.status === "published"), label: t("check1") },
    { ok: mods.some((m) => m.status === "published" && m.lessons.some((l) => l.status === "published")), label: t("check2") },
    { ok: c.status === "published", label: t("check3") },
    { ok: data.usage.groups > 0, label: t("check4"), help: t("check4Help") },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start" aria-busy={pending}>
      {/* Side column first in the DOM so phones see publishing before the long module list. */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
        <section className="relative isolate overflow-hidden rounded-[1.6rem] bg-midnight p-5 text-paper shadow-[var(--shadow-lift)]">
          <div className="blueprint-dark absolute inset-0 -z-10 opacity-40" aria-hidden />
          <span className="absolute -right-12 -top-14 -z-10 size-40 rounded-full bg-pink/25 blur-3xl" aria-hidden />
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#d6cdea]">{t("publishTitle")}</h2>
            <StatusPill status={c.status} label={t(`st.${c.status}`)} dark />
          </div>
          <p className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{t("visible", { n: data.studentLessons })}</p>
          <ul className="mt-4 space-y-2.5">
            {checks.map((k, i) => (
              <motion.li key={i} initial={false} animate={{ opacity: k.ok ? 1 : 0.75 }} className="flex gap-2.5 text-sm">
                <motion.span key={String(k.ok)} initial={{ scale: 0.4, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={softSpring} className="mt-px shrink-0">
                  {k.ok ? <CheckCircle size={20} weight="fill" className="text-[#5ef2d6]" aria-hidden /> : <Circle size={20} weight="bold" className="text-white/35" aria-hidden />}
                </motion.span>
                <span>
                  <span className={cx("font-semibold", k.ok ? "text-paper" : "text-[#d6cdea]")}>{k.label}</span>
                  {!k.ok && k.help ? <span className="block text-xs text-[#b8acd6]">{k.help}</span> : null}
                </span>
              </motion.li>
            ))}
          </ul>
          {can && (
            <div className="mt-5 flex flex-wrap gap-2">
              {c.status === "published" ? (
                <button type="button" disabled={pending} onClick={() => run(() => setCourseStatusAction(c.id, "draft"), t("unpublished"))} className={cx(btn, "flex-1 bg-white/10 text-paper ring-1 ring-white/15 hover:bg-white/15")}>
                  <EyeSlash size={17} weight="bold" aria-hidden /> {t("unpublish")}
                </button>
              ) : (
                <button type="button" disabled={pending || !checks[0].ok} onClick={() => run(() => setCourseStatusAction(c.id, "published"), t("published"))} className={cx(btn, "flex-1 bg-gradient-to-r from-sun to-pink font-bold text-ink shadow-[var(--shadow-pop)]")}>
                  <Eye size={17} weight="bold" aria-hidden /> {t("publish")}
                </button>
              )}
              {c.status !== "archived" && (
                <button type="button" disabled={pending} onClick={() => run(() => setCourseStatusAction(c.id, "archived"), t("archived"))} className={cx(btn, "px-4 text-[#d6cdea] hover:bg-white/10")}>{t("archive")}</button>
              )}
            </div>
          )}
        </section>

        <section className="tile rounded-[1.5rem] p-5">
          <p className="text-sm text-ink-soft">{c.description || <span className="italic text-ink-muted">—</span>}</p>
          <p className="mt-3 font-mono text-xs text-ink-muted">{c.slug}</p>
          {can && (
            <button type="button" onClick={() => setEditing(true)} className={cx(btn, "mt-4 h-10 w-full bg-white ring-1 ring-ink/12 hover:bg-violet-50")}>
              <PencilSimple size={16} weight="bold" aria-hidden /> {t("edit")}
            </button>
          )}
        </section>
      </aside>

      <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">{t("modules")}</h2>
            {can && mods.length > 1 ? <p className="text-sm text-ink-muted">{t("modulesHelp")}</p> : null}
          </div>
        </div>

        <Reorder.Group axis="y" values={mods} onReorder={setMods} className="space-y-4">
          <AnimatePresence initial={false}>
            {mods.map((m, i) => (
              <ModuleCard
                key={m.id}
                m={m}
                index={i}
                can={can}
                courseId={c.id}
                pending={pending}
                onDragEnd={saveModuleOrder}
                onNudge={(d) => nudgeModule(i, d)}
                onMenu={() => setModMenu(m)}
                onLessonMenu={(lesson) => setLessonMenu({ lesson, moduleId: m.id })}
                onAddExisting={() => setAddTo(m)}
                run={run}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {can && <NewModule courseId={c.id} next={mods.length + 1} run={run} pending={pending} />}

        {can && (
          <section className="mt-8 rounded-[1.5rem] border border-danger/25 bg-white p-5">
            <h2 className="flex items-center gap-2 font-bold text-danger"><Warning size={18} weight="fill" aria-hidden /> {t("danger")}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t("dangerBody")}</p>
            <button type="button" onClick={() => setDeleting(true)} className={cx(btn, "mt-4 bg-danger/10 text-danger hover:bg-danger/15")}>
              <Trash size={16} weight="bold" aria-hidden /> {t("deleteCourse")}
            </button>
          </section>
        )}
      </div>

      <LessonSheet menu={lessonMenu} onClose={() => setLessonMenu(null)} mods={mods} can={can} courseId={c.id} run={run} pending={pending} />
      <ModuleSheet m={modMenu} onClose={() => setModMenu(null)} courseId={c.id} run={run} pending={pending} />
      <AddExistingSheet m={addTo} onClose={() => setAddTo(null)} lessons={data.unassigned} courseId={c.id} run={run} pending={pending} />
      <CourseSheet open={editing} onClose={() => setEditing(false)} course={c} run={run} pending={pending} />
      <DeleteCourseSheet open={deleting} onClose={() => setDeleting(false)} course={c} usage={data.usage} lessons={mods.reduce((n, m) => n + m.lessons.length, 0)} />

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 lg:bottom-8">
        <AnimatePresence>
          {toast && (
            <motion.p
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={softSpring}
              className={cx("pointer-events-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-[var(--shadow-lift)]", toast.ok ? "bg-midnight text-paper" : "bg-pink-100 text-ink ring-1 ring-pink/40")}
            >
              {toast.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatusPill({ status, label, dark }: { status: Status; label: string; dark?: boolean }) {
  const on = status === "published";
  return (
    <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold", dark ? (on ? "bg-[#5ef2d6]/15 text-[#5ef2d6]" : "bg-white/10 text-[#d6cdea]") : on ? "bg-[#d9fbf5] text-mint-700" : "bg-paper text-ink-soft ring-1 ring-ink/[0.08]")}>
      <span className={cx("size-1.5 rounded-full", on ? "bg-current shadow-[0_0_8px_currentColor]" : "bg-current opacity-60")} aria-hidden />
      {label}
    </span>
  );
}

/** Drag handle: pointer drags via the item's controls, keyboard moves with ↑/↓. */
function Handle({ controls, label, onNudge, disabled, dark }: { controls: DragControls; label: string; onNudge: (d: number) => void; disabled?: boolean; dark?: boolean }) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") { e.preventDefault(); onNudge(-1); }
    if (e.key === "ArrowDown") { e.preventDefault(); onNudge(1); }
  };
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onKeyDown={onKey}
      onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
      className={cx("grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-xl transition active:cursor-grabbing disabled:opacity-30", dark ? "text-white/50 hover:bg-white/10 hover:text-white" : "text-ink-muted hover:bg-violet-100 hover:text-violet-700")}
    >
      <DotsSixVertical size={20} weight="bold" aria-hidden />
    </button>
  );
}

function ModuleCard({
  m, index, can, courseId, pending, onDragEnd, onNudge, onMenu, onLessonMenu, onAddExisting, run,
}: {
  m: Mod; index: number; can: boolean; courseId: string; pending: boolean;
  onDragEnd: () => void; onNudge: (d: number) => void; onMenu: () => void; onLessonMenu: (l: Les) => void; onAddExisting: () => void;
  run: (fn: () => Promise<Result | void>, ok: string, after?: () => void) => void;
}) {
  const t = useTranslations("staff.courses");
  const controls = useDragControls();
  const reduce = useReducedMotion();
  const [lessons, setLessons] = useState(m.lessons);
  const order = useRef(lessons);
  order.current = lessons;
  useEffect(() => setLessons(m.lessons), [m.lessons]);
  const saveOrder = () => run(() => reorderLessonsAction(courseId, m.id, order.current.map((l) => l.id)), t("reordered"));
  const nudge = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= lessons.length) return;
    const next = [...lessons];
    [next[i], next[j]] = [next[j], next[i]];
    setLessons(next);
    order.current = next;
    saveOrder();
  };
  const on = m.status === "published";

  return (
    <Reorder.Item
      value={m}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileDrag={{ scale: 1.015, boxShadow: "0 30px 60px -24px rgb(27 16 48 / 0.45)" }}
      className="tile relative list-none overflow-hidden rounded-[1.6rem]"
    >
      <span className={cx("absolute inset-y-0 left-0 w-1.5", on ? "bg-gradient-to-b from-violet to-pink" : "bg-ink/[0.08]")} aria-hidden />
      <header className="flex items-center gap-2 border-b border-line/80 py-3 pl-3 pr-3 sm:gap-3 sm:pl-4">
        {can && <Handle controls={controls} label={t("dragHandle", { title: m.title })} onNudge={onNudge} disabled={pending} />}
        <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold", on ? "bg-grad text-white" : "bg-paper text-ink-soft ring-1 ring-ink/[0.06]")}>{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold leading-tight">{m.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            <span>{t("lessonsCount", { n: m.lessons.length })}</span>
            <span className="sm:hidden">· {t(`mst.${m.status}`)}</span>
          </p>
        </div>
        {can ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setModuleStatusAction(courseId, m.id, on ? "draft" : "published"), on ? t("moduleUnpublished") : t("modulePublished"))}
            title={on ? t("unpublishModule") : t("publishModule")}
            className="hidden sm:block"
          >
            <StatusPill status={m.status} label={t(`mst.${m.status}`)} />
          </button>
        ) : (
          <span className="hidden sm:block"><StatusPill status={m.status} label={t(`mst.${m.status}`)} /></span>
        )}
        {can && (
          <button type="button" onClick={onMenu} aria-label={`${t("rename")} · ${m.title}`} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-violet-100 hover:text-ink active:scale-95">
            <DotsThree size={22} weight="bold" aria-hidden />
          </button>
        )}
      </header>

      {lessons.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-ink-muted">{t("noLessons")}</p>
      ) : (
        <Reorder.Group axis="y" values={lessons} onReorder={setLessons} className="divide-y divide-line/70">
          {lessons.map((l, i) => (
            <LessonRow key={l.id} l={l} can={can} pending={pending} onDragEnd={saveOrder} onNudge={(d) => nudge(i, d)} onMenu={() => onLessonMenu(l)} />
          ))}
        </Reorder.Group>
      )}

      {can && <NewLesson courseId={courseId} moduleId={m.id} run={run} pending={pending} onAddExisting={onAddExisting} />}
    </Reorder.Item>
  );
}

function LessonRow({ l, can, pending, onDragEnd, onNudge, onMenu }: { l: Les; can: boolean; pending: boolean; onDragEnd: () => void; onNudge: (d: number) => void; onMenu: () => void }) {
  const t = useTranslations("staff.courses");
  const tl = useTranslations("learn.language");
  const tlib = useTranslations("staff.library");
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={l}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, backgroundColor: "rgb(255 255 255)", boxShadow: "0 18px 40px -18px rgb(27 16 48 / 0.4)", zIndex: 5 }}
      className="relative flex list-none items-center gap-2 bg-white py-2.5 pl-3 pr-2 sm:gap-3 sm:pl-4"
    >
      {can && <Handle controls={controls} label={t("dragHandle", { title: l.title })} onNudge={onNudge} disabled={pending} />}
      <div className="min-w-0 flex-1">
        <Link href={`/equipo/lecciones/${l.id}`} className="block truncate font-semibold text-ink hover:text-violet-700 hover:underline">{l.title}</Link>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
          <LanguageBadge language={l.language} label={tl(l.language)} size="sm" />
          <Tag tone={statusTone[l.status]}>{tlib(`st.${l.status}`)}</Tag>
          <span className="whitespace-nowrap">{t("exercises", { n: l.exercises })}</span>
        </p>
      </div>
      <button type="button" onClick={onMenu} aria-label={t("lessonMenu", { title: l.title })} className="grid size-10 shrink-0 place-items-center rounded-full text-ink-soft transition hover:bg-violet-100 hover:text-ink active:scale-95">
        <DotsThree size={22} weight="bold" aria-hidden />
      </button>
    </Reorder.Item>
  );
}

function NewLesson({ courseId, moduleId, run, pending, onAddExisting }: { courseId: string; moduleId: string; run: (fn: () => Promise<Result | void>, ok: string, after?: () => void) => void; pending: boolean; onAddExisting: () => void }) {
  const t = useTranslations("staff.courses");
  const tl = useTranslations("learn.language");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState<"pseudocode_es" | "python">("pseudocode_es");
  return (
    <div className="border-t border-line/80 bg-paper/60 px-3 py-3 sm:px-4">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={softSpring}
            className="overflow-hidden"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              run(() => createCourseLessonAction(courseId, moduleId, title, lang), t("lessonAdded"), () => { setTitle(""); setOpen(false); });
            }}
          >
            <div className="space-y-2.5 p-0.5">
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("newLessonPlaceholder")} aria-label={t("newLessonPlaceholder")} maxLength={160} className={cx(inputClass, "h-11")} />
              <div className="flex flex-wrap items-center gap-2">
                <Segmented size="sm" role="radiogroup" label={t("languages")} value={lang} onChange={setLang} options={[{ value: "pseudocode_es", label: tl("pseudocode_es") }, { value: "python", label: tl("python") }]} />
                <span className="ml-auto flex gap-1.5">
                  <button type="button" onClick={() => setOpen(false)} className={cx(btn, "h-10 px-4 text-ink-soft hover:bg-white")}>{t("cancel")}</button>
                  <button type="submit" disabled={pending || !title.trim()} className={cx(btn, "h-10 bg-violet-700 px-4 text-white")}>{t("addLesson")}</button>
                </span>
              </div>
            </div>
          </motion.form>
        ) : (
          <motion.div key="buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setOpen(true)} className={cx(btn, "h-10 px-3 sm:px-4 text-violet-700 hover:bg-violet-100")}>
              <PlusCircle size={18} weight="fill" aria-hidden /> {t("newLesson")}
            </button>
            <button type="button" onClick={onAddExisting} className={cx(btn, "h-10 px-3 sm:px-4 text-ink-soft hover:bg-white")}>
              <ArrowsDownUp size={16} weight="bold" aria-hidden /> {t("addExisting")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NewModule({ courseId, next, run, pending }: { courseId: string; next: number; run: (fn: () => Promise<Result | void>, ok: string, after?: () => void) => void; pending: boolean }) {
  const t = useTranslations("staff.courses");
  const [title, setTitle] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const name = title.trim() || t("module", { n: next });
        run(() => saveModuleAction(courseId, { title: name }), t("moduleAdded"), () => setTitle(""));
      }}
      className="group flex flex-col gap-2 rounded-[1.6rem] border-2 border-dashed border-violet/30 bg-white/50 p-3 transition focus-within:border-violet/60 focus-within:bg-white sm:flex-row sm:items-center sm:p-4"
    >
      <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 transition group-focus-within:rotate-6 sm:grid"><FolderSimplePlus size={20} weight="fill" aria-hidden /></span>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("module", { n: next })} aria-label={t("newModulePlaceholder")} maxLength={120} className={cx(inputClass, "h-11 flex-1 border-transparent bg-transparent focus:bg-white")} />
      <button type="submit" disabled={pending} className={cx(btn, "bg-ink text-paper")}>
        <Plus size={16} weight="bold" aria-hidden /> {t("addModule")}
      </button>
    </form>
  );
}

function SheetAction({ icon, children, onClick, href, tone = "plain", disabled }: { icon: ReactNode; children: ReactNode; onClick?: () => void; href?: string; tone?: "plain" | "danger"; disabled?: boolean }) {
  const cls = cx("flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left font-semibold transition active:scale-[0.99] disabled:opacity-40", tone === "danger" ? "text-danger hover:bg-danger/10" : "hover:bg-violet-50");
  const inner = (
    <>
      <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", tone === "danger" ? "bg-danger/10" : "bg-paper text-violet-700")}>{icon}</span>
      <span className="flex-1">{children}</span>
    </>
  );
  return href ? <Link href={href} className={cls}>{inner}</Link> : <button type="button" disabled={disabled} onClick={onClick} className={cls}>{inner}</button>;
}

function LessonSheet({ menu, onClose, mods, can, courseId, run, pending }: { menu: { lesson: Les; moduleId: string } | null; onClose: () => void; mods: Mod[]; can: boolean; courseId: string; run: (fn: () => Promise<Result | void>, ok: string, after?: () => void) => void; pending: boolean }) {
  const t = useTranslations("staff.courses");
  const te2 = useTranslations("staff.editor");
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const te = useTranslations("errors");
  const [busy, start] = useTransition();
  useEffect(() => { setConfirming(false); setTyped(""); setErr(null); }, [menu]);
  const l = menu?.lesson;
  const others = mods.filter((m) => m.id !== menu?.moduleId);
  return (
    <Sheet open={!!menu} onClose={onClose} title={l?.title} closeLabel={t("cancel")}>
      {l && (
        <div className="space-y-1 pb-2">
          <SheetAction icon={<PencilSimple size={18} weight="bold" aria-hidden />} href={`/equipo/lecciones/${l.id}`}>{t("openEditor")}</SheetAction>
          <SheetAction icon={<ChalkboardTeacher size={18} weight="fill" aria-hidden />} href={`/equipo/guion/${l.id}`}>{te2("script")}</SheetAction>
          {can && others.length > 0 && (
            <div className="pt-3">
              <p className="px-3 pb-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">{t("moveTo")}</p>
              <div className="flex flex-wrap gap-1.5 px-1">
                {others.map((m) => (
                  <button key={m.id} type="button" disabled={pending} onClick={() => { run(() => moveLessonAction(courseId, l.id, m.id), t("moved")); onClose(); }} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-paper px-3.5 text-sm font-semibold ring-1 ring-ink/[0.08] transition hover:bg-violet-100 active:scale-95">
                    <ArrowRight size={14} weight="bold" aria-hidden /> {m.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          {can && (
            <div className="pt-3">
              <SheetAction icon={<SignOut size={18} weight="bold" aria-hidden />} disabled={pending} onClick={() => { run(() => moveLessonAction(courseId, l.id, null), t("removed")); onClose(); }}>{t("removeFromCourse")}</SheetAction>
            </div>
          )}
          {l.editable && (
            <div className="pt-1">
              {!confirming ? (
                <SheetAction tone="danger" icon={<Trash size={18} weight="bold" aria-hidden />} onClick={() => setConfirming(true)}>{t("deleteLesson")}</SheetAction>
              ) : (
                <motion.form
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(async () => {
                      const r = await deleteLessonAction(l.id, typed.trim(), `/equipo/cursos/${courseId}`);
                      if (r && !r.ok) setErr(te(r.error as "unexpected"));
                    });
                  }}
                  className="space-y-3 rounded-2xl bg-danger/[0.06] p-4 ring-1 ring-danger/20"
                >
                  <p className="text-sm text-ink-soft">{te2("deleteBody")}</p>
                  <Field label={t("typeToConfirm", { slug: l.slug })} htmlFor="del-lesson" error={err}>
                    <input id="del-lesson" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className={cx(inputClass, "font-mono")} />
                  </Field>
                  <button type="submit" disabled={busy || typed.trim() !== l.slug} className={cx(btn, "w-full bg-danger text-white")}>
                    <Trash size={16} weight="bold" aria-hidden /> {t("deleteForever")}
                  </button>
                </motion.form>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function ModuleSheet({ m, onClose, courseId, run, pending }: { m: Mod | null; onClose: () => void; courseId: string; run: (fn: () => Promise<Result | void>, ok: string, after?: () => void) => void; pending: boolean }) {
  const t = useTranslations("staff.courses");
  const [title, setTitle] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [withLessons, setWithLessons] = useState(false);
  useEffect(() => { setTitle(m?.title ?? ""); setConfirming(false); setWithLessons(false); }, [m]);
  if (!m) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const on = m.status === "published";
  return (
    <Sheet open onClose={onClose} title={m.title} closeLabel={t("cancel")}>
      <div className="space-y-4 pb-2">
        <form
          onSubmit={(e) => { e.preventDefault(); if (title.trim()) { run(() => saveModuleAction(courseId, { id: m.id, title }), t("renamed")); onClose(); } }}
          className="flex gap-2"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t("rename")} maxLength={120} className={cx(inputClass, "h-11 flex-1")} />
          <button type="submit" disabled={pending || !title.trim() || title.trim() === m.title} className={cx(btn, "bg-violet-700 text-white")}>{t("save")}</button>
        </form>
        <SheetAction icon={on ? <EyeSlash size={18} weight="bold" aria-hidden /> : <Eye size={18} weight="bold" aria-hidden />} disabled={pending} onClick={() => { run(() => setModuleStatusAction(courseId, m.id, on ? "draft" : "published"), on ? t("moduleUnpublished") : t("modulePublished")); onClose(); }}>
          {on ? t("unpublishModule") : t("publishModule")}
        </SheetAction>
        {!confirming ? (
          <SheetAction tone="danger" icon={<Trash size={18} weight="bold" aria-hidden />} onClick={() => setConfirming(true)}>{t("deleteModule")}</SheetAction>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 rounded-2xl bg-danger/[0.06] p-4 ring-1 ring-danger/20">
            <p className="font-bold">{t("deleteModuleTitle", { title: m.title })}</p>
            <p className="text-sm text-ink-soft">{t("deleteModuleBody", { n: m.lessons.length })}</p>
            {m.lessons.length > 0 && (
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={withLessons} onChange={(e) => setWithLessons(e.target.checked)} className="mt-0.5 size-5 accent-[var(--color-danger,#d1345b)]" />
                <span><span className="font-semibold">{t("deleteLessonsToo")}</span><span className="block text-ink-muted">{t("deleteLessonsModuleHelp")}</span></span>
              </label>
            )}
            <button type="button" disabled={pending} onClick={() => { run(() => deleteModuleAction(courseId, m.id, withLessons), t("moduleDeleted")); onClose(); }} className={cx(btn, "w-full bg-danger text-white")}>
              <Trash size={16} weight="bold" aria-hidden /> {t("deleteModule")}
            </button>
          </motion.div>
        )}
      </div>
    </Sheet>
  );
}

function AddExistingSheet({ m, onClose, lessons, courseId, run, pending }: { m: Mod | null; onClose: () => void; lessons: CourseDetail["unassigned"]; courseId: string; run: (fn: () => Promise<Result | void>, ok: string, after?: () => void) => void; pending: boolean }) {
  const t = useTranslations("staff.courses");
  const tl = useTranslations("learn.language");
  return (
    <Sheet open={!!m} onClose={onClose} title={t("addExistingTitle")} closeLabel={t("cancel")}>
      <p className="mb-3 text-sm text-ink-soft">{t("addExistingBody")}</p>
      {lessons.length === 0 ? (
        <p className="rounded-2xl bg-paper px-4 py-8 text-center text-sm text-ink-muted">{t("addExistingEmpty")}</p>
      ) : (
        <ul className="space-y-1.5 pb-2">
          {lessons.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-paper p-2.5 pl-3.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{l.title}</span>
                <span className="mt-1 flex items-center gap-1.5"><LanguageBadge language={l.language} label={tl(l.language)} size="sm" /><span className="truncate font-mono text-xs text-ink-muted">{l.slug}</span></span>
              </span>
              <button type="button" disabled={pending || !m} onClick={() => m && run(() => moveLessonAction(courseId, l.id, m.id), t("added"))} className={cx(btn, "h-10 shrink-0 bg-ink px-4 text-paper")}>
                <Plus size={14} weight="bold" aria-hidden /> {t("add")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export function CourseFields({ value, onChange, withModule, idPrefix }: { value: { title: string; slug: string; description: string; firstModule?: string }; onChange: (v: { title: string; slug: string; description: string; firstModule?: string }) => void; withModule?: boolean; idPrefix: string }) {
  const t = useTranslations("staff.courses");
  const [touched, setTouched] = useState(!!value.slug);
  const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
  return (
    <div className="space-y-4">
      <Field label={t("fTitle")} htmlFor={`${idPrefix}-title`}>
        <input id={`${idPrefix}-title`} data-autofocus required maxLength={120} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value, slug: touched ? value.slug : slugify(e.target.value) })} className={inputClass} />
      </Field>
      <Field label={t("fSlug")} htmlFor={`${idPrefix}-slug`} helper={t("fSlugHelp")}>
        <input id={`${idPrefix}-slug`} required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={value.slug} onChange={(e) => { setTouched(true); onChange({ ...value, slug: e.target.value }); }} spellCheck={false} autoComplete="off" className={cx(inputClass, "font-mono")} />
      </Field>
      <Field label={t("fDescription")} htmlFor={`${idPrefix}-desc`} helper={t("fDescriptionHelp")}>
        <textarea id={`${idPrefix}-desc`} rows={3} maxLength={600} value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} className={textareaClass} />
      </Field>
      {withModule && (
        <Field label={t("fFirstModule")} htmlFor={`${idPrefix}-mod`} helper={t("fFirstModuleHelp")}>
          <input id={`${idPrefix}-mod`} maxLength={120} placeholder={t("fFirstModuleDefault")} value={value.firstModule ?? ""} onChange={(e) => onChange({ ...value, firstModule: e.target.value })} className={inputClass} />
        </Field>
      )}
    </div>
  );
}

function CourseSheet({ open, onClose, course, run, pending }: { open: boolean; onClose: () => void; course: CourseDetail["course"]; run: (fn: () => Promise<Result | void>, ok: string, after?: () => void) => void; pending: boolean }) {
  const t = useTranslations("staff.courses");
  const [v, setV] = useState({ title: course.title, slug: course.slug, description: course.description });
  useEffect(() => { if (open) setV({ title: course.title, slug: course.slug, description: course.description }); }, [open, course]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("editTitle")}
      closeLabel={t("cancel")}
      footer={
        <button type="submit" form="course-edit" disabled={pending || !v.title.trim()} className={cx(btn, "mb-1 w-full bg-violet-700 text-white")}>{t("save")}</button>
      }
    >
      <form id="course-edit" onSubmit={(e) => { e.preventDefault(); run(() => saveCourseAction({ id: course.id, ...v }), t("saved"), onClose); }} className="pb-2">
        <CourseFields value={v} onChange={(x) => setV({ title: x.title, slug: x.slug, description: x.description })} idPrefix="ce" />
      </form>
    </Sheet>
  );
}

function DeleteCourseSheet({ open, onClose, course, usage, lessons }: { open: boolean; onClose: () => void; course: CourseDetail["course"]; usage: CourseDetail["usage"]; lessons: number }) {
  const t = useTranslations("staff.courses");
  const te = useTranslations("errors");
  const [typed, setTyped] = useState("");
  const [withLessons, setWithLessons] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  useEffect(() => { if (open) { setTyped(""); setWithLessons(false); setErr(null); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={t("deleteCourseTitle", { title: course.title })} closeLabel={t("cancel")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await deleteCourseAction(course.id, typed.trim(), withLessons);
            if (r && !r.ok) setErr(te(r.error as "unexpected"));
          });
        }}
        className="space-y-4 pb-2"
      >
        <p className="rounded-2xl bg-sun/25 px-4 py-3 text-sm font-semibold text-ink">{t("deleteCourseUsage", { groups: usage.groups, students: usage.students })}</p>
        {lessons > 0 && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={withLessons} onChange={(e) => setWithLessons(e.target.checked)} className="mt-0.5 size-5" />
            <span><span className="font-semibold">{t("deleteLessonsToo")}</span><span className="block text-ink-muted">{t("deleteLessonsHelp")}</span></span>
          </label>
        )}
        <Field label={t("typeToConfirm", { slug: course.slug })} htmlFor="del-course" error={err}>
          <input id="del-course" data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className={cx(inputClass, "font-mono")} />
        </Field>
        <button type="submit" disabled={busy || typed.trim() !== course.slug} className={cx(btn, "w-full bg-danger text-white")}>
          <Trash size={16} weight="bold" aria-hidden /> {t("deleteForever")}
        </button>
      </form>
    </Sheet>
  );
}

/** Dashed "new course" card + creation sheet (used on the courses index). */
export function NewCourseCard() {
  const t = useTranslations("staff.courses");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: "", slug: "", description: "", firstModule: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <motion.button
        type="button"
        onClick={() => { setV({ title: "", slug: "", description: "", firstModule: "" }); setErr(null); setOpen(true); }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        className="group flex h-full min-h-[15rem] w-full flex-col items-center justify-center gap-3 rounded-[1.6rem] border-2 border-dashed border-violet/35 bg-white/50 p-6 text-center transition-colors hover:border-violet/60 hover:bg-white"
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-grad text-white shadow-[var(--shadow-pop)] transition-transform duration-300 group-hover:rotate-90"><Plus size={26} weight="bold" aria-hidden /></span>
        <span className="text-lg font-extrabold tracking-tight">{t("new")}</span>
        <span className="max-w-[28ch] text-sm text-ink-muted">{t("newBody")}</span>
      </motion.button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("new")}
        closeLabel={t("cancel")}
        footer={
          <div className="mb-1 space-y-2">
            {err ? <p role="alert" className="text-sm font-semibold text-danger">{err}</p> : null}
            <button type="submit" form="course-new" disabled={busy || !v.title.trim() || !v.slug} className={cx(btn, "w-full bg-violet-700 text-white")}>{t("create")}</button>
          </div>
        }
      >
        <form
          id="course-new"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            start(async () => {
              const r = await saveCourseAction(v);
              if (r && !r.ok) setErr(te(r.error as "unexpected"));
            });
          }}
          className="pb-2"
        >
          <p className="mb-4 text-sm text-ink-soft">{t("newBody")}</p>
          <CourseFields value={v} onChange={(x) => setV({ ...v, ...x })} withModule idPrefix="cn" />
        </form>
      </Sheet>
    </>
  );
}
