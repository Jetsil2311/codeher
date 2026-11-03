"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { staffRegisterAction, staffSignInAction } from "@/app/actions/staff";
import { Field, inputClass } from "@/components/ui";

export function StaffSignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations("staff.auth");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(staffSignInAction, {});
  return (
    <div className="tile space-y-5 p-6 md:p-8">
      <button type="button" disabled={!googleEnabled} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-ink ring-1 ring-ink/15 transition hover:bg-violet-50 disabled:opacity-50" aria-describedby={googleEnabled ? undefined : "google-note"}>
        <GoogleLogo size={20} weight="bold" aria-hidden /> {t("google")}
      </button>
      {!googleEnabled && <p id="google-note" className="-mt-3 text-center text-xs text-ink-muted">{t("googleLocal")}</p>}
      <div className="flex items-center gap-3 text-xs font-semibold text-ink-muted">
        <span className="h-px flex-1 bg-line" /> {t("or")} <span className="h-px flex-1 bg-line" />
      </div>
      <form action={action} className="space-y-4">
        <Field label={t("email")} htmlFor="email">
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label={t("password")} htmlFor="password">
          <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
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
