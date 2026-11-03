"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { changePinAction, updateProfileAction } from "@/app/actions/student";
import { Avatar, Field, inputClass, cx } from "@/components/ui";

export function ProfileForms({ nickname, avatar, code, avatars }: { nickname: string; avatar: string; code: string; avatars: string[] }) {
  const t = useTranslations("student.profile");
  const te = useTranslations("errors");
  const [p, profileAction, p1] = useActionState(updateProfileAction, {});
  const [pin, pinAction, p2] = useActionState(changePinAction, {});
  const [picked, setPicked] = useState(avatar);
  return (
    <div className="mt-6 space-y-6">
      <form action={profileAction} className="tile space-y-5 p-6">
        <h2 className="text-lg font-bold">{t("aboutYou")}</h2>
        <Field label={t("nickname")} htmlFor="nickname" helper={t("nicknameHelp")}>
          <input id="nickname" name="nickname" defaultValue={nickname} maxLength={40} required className={inputClass} />
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold">{t("avatar")}</legend>
          <div className="mt-2 grid grid-cols-4 gap-3 sm:grid-cols-8">
            {avatars.map((a) => (
              <label key={a} className={cx("grid cursor-pointer place-items-center rounded-2xl p-1.5 ring-2 transition", picked === a ? "ring-violet-700" : "ring-transparent hover:ring-violet/30")}>
                <input type="radio" name="avatar" value={a} checked={picked === a} onChange={() => setPicked(a)} className="sr-only" />
                <Avatar id={a} size={52} />
                <span className="sr-only">{t("avatarOption", { name: a })}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={p1} className="h-11 rounded-full bg-violet-700 px-5 font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{t("save")}</button>
          {p.ok ? <p role="status" className="text-sm font-semibold text-mint-700">{t("saved")}</p> : null}
          {p.error ? <p role="alert" className="text-sm font-semibold text-danger">{te(p.error as "invalid_name")}</p> : null}
        </div>
      </form>
      <section className="tile p-6">
        <h2 className="text-lg font-bold">{t("yourCode")}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t("codeHelp")}</p>
        <p className="mt-3 inline-block rounded-2xl bg-midnight px-5 py-3 font-mono text-2xl font-bold tracking-[0.15em] text-paper">{code}</p>
      </section>
      <form action={pinAction} className="tile space-y-4 p-6">
        <h2 className="text-lg font-bold">{t("changePin")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("currentPin")} htmlFor="current"><input id="current" name="current" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} required autoComplete="current-password" className={`${inputClass} font-mono`} /></Field>
          <Field label={t("newPin")} htmlFor="next"><input id="next" name="next" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} required autoComplete="new-password" className={`${inputClass} font-mono`} /></Field>
          <Field label={t("confirmPin")} htmlFor="confirm"><input id="confirm" name="confirm" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} required autoComplete="new-password" className={`${inputClass} font-mono`} /></Field>
        </div>
        <p className="text-sm text-ink-muted">{t("pinHelp")}</p>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={p2} className="h-11 rounded-full bg-violet-700 px-5 font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{t("updatePin")}</button>
          {pin.ok ? <p role="status" className="text-sm font-semibold text-mint-700">{t("pinChanged")}</p> : null}
          {pin.error ? <p role="alert" className="text-sm font-semibold text-danger">{te(pin.error as "wrong_pin")}</p> : null}
        </div>
      </form>
    </div>
  );
}
