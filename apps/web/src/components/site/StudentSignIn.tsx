"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";
import { signInAction } from "@/app/actions/student";
import { Field, inputClass, cx } from "@/components/ui";

export function StudentSignIn({ demo }: { demo?: { nickname: string; code: string; pin: string; avatar?: string }[] }) {
  const t = useTranslations("student.signIn");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(signInAction, {});
  const [pin, setPin] = useState(["", "", "", ""]);
  const [show, setShow] = useState(false);
  const [code, setCode] = useState("");
  const shake = useAnimationControls();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!state.error) return;
    if (!reduce) shake.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.45 } });
    setPin(["", "", "", ""]);
    refs[0].current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
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
    <motion.form animate={shake} action={action} className="tile relative space-y-5 overflow-hidden rounded-[1.75rem] p-6 md:p-8" noValidate>
      <span className="absolute inset-x-0 top-0 h-1.5 bg-grad" aria-hidden />
      <Field label={t("code")} htmlFor="code" helper={t("codeHelp")}>
        <input id="code" name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required autoComplete="username" autoCapitalize="characters" spellCheck={false} inputMode="text" placeholder="2809B07" className={`${inputClass} h-14 text-center font-mono text-2xl tracking-[0.2em] uppercase`} />
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
              className={cx("h-14 w-full min-w-0 rounded-2xl border text-center font-mono text-2xl transition-all duration-200 focus:border-violet-700 focus:outline-none focus:ring-4 focus:ring-violet/20", d ? "scale-[1.03] border-violet-700 bg-violet-50 shadow-[0_8px_18px_-10px_rgb(111_63_176/0.7)]" : "border-ink/15 bg-white")}
            />
          ))}
          <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t("hidePin") : t("showPin")} className="grid size-14 shrink-0 place-items-center rounded-2xl text-ink-soft hover:bg-violet-100">
            {show ? <EyeSlash size={22} aria-hidden /> : <Eye size={22} aria-hidden />}
          </button>
        </div>
        <input type="hidden" name="pin" value={pin.join("")} />
      </fieldset>
      {error ? (
        <motion.p initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert" className="rounded-2xl bg-pink-100 px-4 py-3 font-medium text-ink">
          {error}
        </motion.p>
      ) : null}
      <button type="submit" disabled={pending} className="grad-edge inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-pink text-lg font-bold text-ink shadow-[var(--shadow-pop)] transition active:scale-[0.98] disabled:opacity-60">
        {pending ? t("entering") : t("submit")} <ArrowRight size={20} weight="bold" aria-hidden />
      </button>
      <p className="text-center text-sm text-ink-muted">{t("noRecovery")}</p>
      {demo && demo.length > 0 && (
        <div className="-mx-6 -mb-6 border-t border-dashed border-violet/30 bg-violet-50/60 px-6 pb-6 pt-4 md:-mx-8 md:-mb-8 md:px-8">
          <p className="text-sm font-bold text-ink">{t("demoTitle")}</p>
          <p className="text-xs text-ink-muted">{t("demoTap")}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {demo.map((d) => (
              <button key={d.code} type="button" onClick={() => { setCode(d.code); setPin(d.pin.split("")); }} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-2.5 ring-1 ring-ink/[0.06] transition hover:-translate-y-0.5 hover:ring-violet/40 active:scale-95">
                <span className="grid size-9 place-items-center rounded-xl bg-grad text-sm font-extrabold text-white">{d.nickname.slice(0, 1)}</span>
                <span className="text-xs font-bold text-ink">{d.nickname}</span>
                <span className="font-mono text-[0.65rem] text-ink-muted">{d.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.form>
  );
}
