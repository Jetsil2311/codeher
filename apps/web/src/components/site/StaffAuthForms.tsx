"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Eye, EyeSlash, GoogleLogo, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { staffGoogleAction, staffRegisterAction, staffSignInAction } from "@/app/actions/staff";
import { Field, inputClass } from "@/components/ui";

export function StaffSignInForm({ googleEnabled, demo, authError }: { googleEnabled: boolean; demo?: { label: string; email: string; password: string }[]; authError?: boolean }) {
  const t = useTranslations("staff.auth");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(staffSignInAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  return (
    <>
    <div className="tile relative space-y-5 overflow-hidden rounded-[1.75rem] p-6 md:p-8">
      <span className="absolute inset-x-0 top-0 h-1.5 bg-grad" aria-hidden />
      {authError ? <p role="alert" className="rounded-2xl bg-pink-100 px-4 py-3 text-sm font-medium">{te("auth_failed")}</p> : null}
      <form action={staffGoogleAction}>
        <button type="submit" disabled={!googleEnabled} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-ink ring-1 ring-ink/15 transition hover:bg-violet-50 disabled:opacity-50" aria-describedby={googleEnabled ? undefined : "google-note"}>
          <GoogleLogo size={20} weight="bold" aria-hidden /> {t("google")}
        </button>
      </form>
      {!googleEnabled && <p id="google-note" className="-mt-3 text-center text-xs text-ink-muted">{t("googleLocal")}</p>}
      <div className="flex items-center gap-3 text-xs font-semibold text-ink-muted">
        <span className="h-px flex-1 bg-line" /> {t("or")} <span className="h-px flex-1 bg-line" />
      </div>
      <form action={action} className="space-y-4">
        <Field label={t("email")} htmlFor="email">
          <input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputClass} />
        </Field>
        <Field label={t("password")} htmlFor="password">
          <div className="relative">
            <input id="password" name="password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className={`${inputClass} pr-14`} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? t("hidePassword") : t("showPassword")} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-xl text-ink-muted hover:bg-violet-100 hover:text-ink">
              {show ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
            </button>
          </div>
        </Field>
        {state.error ? <p role="alert" className="rounded-2xl bg-pink-100 px-4 py-3 text-sm font-medium">{te(state.error as "invalid_credentials")}</p> : null}
        <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-violet-700 font-semibold text-white transition hover:bg-violet-800 active:scale-[0.98] disabled:opacity-60">
          {pending ? t("signingIn") : t("signIn")} <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
      </form>
      <p className="text-center text-sm text-ink-muted">
        {t("invited")}{" "}
        <Link href="/equipo/registro" className="font-semibold text-violet-700 underline underline-offset-4">
          {t("createAccount")}
        </Link>
      </p>
    </div>
    {demo && demo.length > 0 && (
      <aside className="mt-4 rounded-[1.4rem] border border-dashed border-violet/40 bg-white/80 p-4 text-sm text-ink-soft backdrop-blur">
        <p className="font-bold text-ink">{t("demoTitle")}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{t("demoTap")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {demo.map((d) => (
            <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword(d.password); }} className="flex items-center gap-2.5 rounded-2xl bg-paper p-2.5 text-left ring-1 ring-ink/[0.06] transition hover:bg-violet-50 hover:ring-violet/30 active:scale-[0.98]">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-grad text-white"><UserCircle size={20} weight="fill" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block font-bold text-ink">{d.label}</span>
                <span className="block truncate font-mono text-[0.7rem]">{d.email}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>
    )}
    </>
  );
}

export function StaffRegisterForm() {
  const t = useTranslations("staff.auth");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(staffRegisterAction, {});
  if (state.role)
    return (
      <div role="status" className="tile p-8 text-center">
        <p className="text-xl font-bold">{state.role === "pending" ? t("registeredPending") : t("registered")}</p>
        {state.confirm ? <p className="mt-2 text-ink-soft">{t("registeredConfirm")}</p> : null}
        <Link href="/equipo" className="mt-4 inline-block font-semibold text-violet-700 underline">{t("goSignIn")}</Link>
      </div>
    );
  return (
    <form action={action} className="tile space-y-4 p-6 md:p-8">
      <Field label={t("name")} htmlFor="name">
        <input id="name" name="name" required autoComplete="name" className={inputClass} />
      </Field>
      <Field label={t("email")} htmlFor="email" helper={t("emailInvited")}>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label={t("password")} htmlFor="password" helper={t("passwordHelp")}>
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      {state.error ? <p role="alert" className="rounded-2xl bg-pink-100 px-4 py-3 text-sm font-medium">{te(state.error as "invalid_email")}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-violet-700 font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}
