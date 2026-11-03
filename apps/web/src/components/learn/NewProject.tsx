"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, TerminalWindow, TextAa, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { newBlankProjectAction } from "@/app/actions/student";
import { Sheet } from "@/components/motion/Sheet";
import { Field, inputClass, cx } from "@/components/ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="grad-edge inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-pink font-bold text-ink shadow-[var(--shadow-pop)] transition active:scale-[0.98] disabled:opacity-60">
      <Plus size={18} weight="bold" aria-hidden /> {label}
    </button>
  );
}

export function NewProject({ labels }: { labels: { open: string; title: string; name: string; placeholder: string; language: string; create: string; close: string; pseudo: string; python: string; pseudoBody: string; pythonBody: string } }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<"pseudocode_es" | "python">("pseudocode_es");
  const opts = [
    { v: "pseudocode_es" as const, l: labels.pseudo, b: labels.pseudoBody, Icon: TextAa, tone: "from-violet to-pink" },
    { v: "python" as const, l: labels.python, b: labels.pythonBody, Icon: TerminalWindow, tone: "from-[#00bbf9] to-violet" },
  ];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="group grad-edge inline-flex h-12 items-center gap-2 rounded-full bg-pink px-5 font-bold text-ink shadow-[var(--shadow-pop)] transition hover:-translate-y-0.5 active:scale-95">
        <Plus size={18} weight="bold" className="transition-transform duration-300 group-hover:rotate-90" aria-hidden /> {labels.open}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={labels.title} closeLabel={labels.close}>
        <form action={newBlankProjectAction} className="space-y-5 pb-2">
          <Field label={labels.name} htmlFor="np-name">
            <input id="np-name" name="name" data-autofocus placeholder={labels.placeholder} maxLength={80} className={inputClass} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{labels.language}</legend>
            <div className="grid grid-cols-2 gap-3">
              {opts.map(({ v, l, b, Icon, tone }) => (
                <label key={v} className={cx("relative flex cursor-pointer flex-col gap-2 rounded-[1.25rem] p-4 ring-2 transition duration-200", lang === v ? "bg-violet-50 ring-violet-700" : "bg-paper ring-transparent hover:ring-ink/10")}>
                  <input type="radio" name="language" value={v} checked={lang === v} onChange={() => setLang(v)} className="sr-only" />
                  <span className={cx("grid size-11 place-items-center rounded-2xl bg-gradient-to-br text-white", tone)}><Icon size={22} weight="bold" aria-hidden /></span>
                  <span className="font-bold">{l}</span>
                  <span className="text-xs text-ink-muted">{b}</span>
                  {lang === v && <CheckCircle size={22} weight="fill" className="absolute right-3 top-3 text-violet-700" aria-hidden />}
                </label>
              ))}
            </div>
          </fieldset>
          <Submit label={labels.create} />
        </form>
      </Sheet>
    </>
  );
}
