"use client";
import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";
import { signInAction } from "@/app/actions/student";
import { Field, inputClass } from "@/components/ui";

export function StudentSignIn() {
  const t = useTranslations("student.signIn");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(signInAction, {});
  const [pin, setPin] = useState(["", "", "", ""]);
  const [show, setShow] = useState(false);
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const setDigit = (i: number, v: string) => {
    const digits = v.replace(/\D/g, "");
    if (digits.length > 1) {
      const next = [...pin];
      digits.slice(0, 4 - i).split("").forEach((d, k) => (next[i + k] = d));
      setPin(next);
      refs[Math.min(3, i + digits.length)].current?.focus();
      return;
    }
    const next = [...pin];
    next[i] = digits;
    setPin(next);
    if (digits && i < 3) refs[i + 1].current?.focus();
  };
  const error = state.error ? te(state.error as "invalid") : null;
  return (
    <form action={action} className="tile space-y-5 p-6 md:p-8" noValidate>
      <Field label={t("code")} htmlFor="code" helper={t("codeHelp")}>
        <input id="code" name="code" required autoComplete="username" autoCapitalize="characters" spellCheck={false} inputMode="text" placeholder="2809B07" className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.2em] uppercase`} />
      </Field>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">{t("pin")}</legend>
        <div className="mt-1.5 flex items-center gap-2">
          {pin.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              aria-label={t("pinDigit", { n: i + 1 })}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => e.key === "Backspace" && !pin[i] && i > 0 && refs[i - 1].current?.focus()}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              type={show ? "text" : "password"}
              maxLength={4}
              className="h-14 w-full min-w-0 rounded-2xl border border-ink/15 bg-white text-center font-mono text-2xl focus:border-violet-700 focus:outline-none focus:ring-4 focus:ring-violet/20"
            />
          ))}
          <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t("hidePin") : t("showPin")} className="grid size-14 shrink-0 place-items-center rounded-2xl text-ink-soft hover:bg-violet-100">
            {show ? <EyeSlash size={22} aria-hidden /> : <Eye size={22} aria-hidden />}
          </button>
        </div>
        <input type="hidden" name="pin" value={pin.join("")} />
      </fieldset>
      {error ? (
        <p role="alert" className="rounded-2xl bg-pink-100 px-4 py-3 font-medium text-ink">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="grad-edge inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pink text-lg font-bold text-ink shadow-[var(--shadow-pop)] transition active:scale-[0.98] disabled:opacity-60">
        {pending ? t("entering") : t("submit")} <ArrowRight size={20} weight="bold" aria-hidden />
      </button>
      <p className="text-center text-sm text-ink-muted">{t("noRecovery")}</p>
    </form>
  );
}
