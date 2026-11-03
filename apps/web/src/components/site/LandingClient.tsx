"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import type { CodeLanguage } from "@codeher/core";
import { Playground } from "@/components/code/Playground";
import { contactAction } from "@/app/actions/public";
import { Field, inputClass, textareaClass, cx } from "@/components/ui";

const TEASER: Record<CodeLanguage, string> = {
  pseudocode_es: `Proceso Saludo
    Definir nombre Como Caracter;
    Escribir "¿Cómo te llamas?";
    Leer nombre;
    Escribir "¡Hola, ", nombre, "! Ya estás programando.";
FinProceso
`,
  python: `nombre = "Xóchitl"
for i in range(3):
    print("¡Hola,", nombre + "!")
print("Ya estás programando.")
`,
};

export function TeaserEditor() {
  const t = useTranslations("landing.teaser");
  const tl = useTranslations("learn.language");
  const [lang, setLang] = useState<CodeLanguage>("pseudocode_es");
  return (
    <div>
      <div role="tablist" aria-label={t("tabs")} className="mb-3 inline-flex rounded-full bg-white/8 p-1 ring-1 ring-white/10">
        {(["pseudocode_es", "python"] as const).map((l) => (
          <button key={l} role="tab" aria-selected={lang === l} type="button" onClick={() => setLang(l)} className={cx("h-9 rounded-full px-4 text-sm font-semibold transition", lang === l ? "bg-paper text-ink" : "text-[#d6cdea] hover:text-paper")}>
            {tl(l)}
          </button>
        ))}
      </div>
      <Playground key={lang} language={lang} code={TEASER[lang]} minHeight={190} compact className="[&>div:first-child]:shadow-[0_30px_60px_-30px_rgb(0_0_0/0.7)] [&>div:first-child]:ring-white/10" />
    </div>
  );
}

export function BringForm() {
  const t = useTranslations("landing.bring");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(contactAction, {});
  if (state.ok)
    return (
      <div role="status" className="rounded-[1.5rem] bg-white p-8 text-center text-ink shadow-[var(--shadow-lift)]">
        <CheckCircle size={44} weight="fill" className="mx-auto text-mint-700" aria-hidden />
        <p className="mt-3 text-xl font-bold">{t("thanks")}</p>
        <p className="mt-1 text-ink-muted">{t("thanksBody")}</p>
      </div>
    );
  return (
    <form action={action} className="grid gap-4 rounded-[1.5rem] bg-white p-5 text-ink shadow-[var(--shadow-lift)] md:grid-cols-2 md:p-7">
      <Field label={t("name")} htmlFor="c-name">
        <input id="c-name" name="name" required minLength={2} autoComplete="name" className={inputClass} />
      </Field>
      <Field label={t("community")} htmlFor="c-community" helper={t("communityHelp")}>
        <input id="c-community" name="community" required minLength={2} className={inputClass} />
      </Field>
      <Field label={t("email")} htmlFor="c-email" className="md:col-span-2">
        <input id="c-email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label={t("message")} htmlFor="c-message" className="md:col-span-2" error={state.error ? te(state.error as "contact_invalid") : null}>
        <textarea id="c-message" name="message" required minLength={10} rows={4} className={textareaClass} />
      </Field>
      <div className="md:col-span-2">
        <button type="submit" disabled={pending} className="grad-edge inline-flex h-12 items-center gap-2 rounded-full bg-pink px-6 font-semibold text-ink transition active:scale-95 disabled:opacity-50">
          <PaperPlaneTilt size={18} weight="bold" aria-hidden /> {pending ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}
