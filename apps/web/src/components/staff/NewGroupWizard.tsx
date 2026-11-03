"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Eye, Warning } from "@phosphor-icons/react/dist/ssr";
import { groupPrefix, parseNameList } from "@codeher/core";
import { createGroupAction, previewGroupAction, suggestGroupAction } from "@/app/actions/staff";
import { Field, inputClass, selectClass, textareaClass, cx } from "@/components/ui";
import { monthName } from "./StaffUi";
import { AccessCards } from "./AccessCards";

type Row = { nickname: string; number: number; code: string; pin: string };

export function NewGroupWizard({ communities, defaultYear, defaultMonth }: { communities: { id: string; name: string }[]; defaultYear: number; defaultMonth: number }) {
  const t = useTranslations("staff.newGroup");
  const te = useTranslations("errors");
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [letter, setLetter] = useState<string>("");
  const [suggested, setSuggested] = useState<string | null>(null);
  const [taken, setTaken] = useState<string[]>([]);
  const [override, setOverride] = useState(false);
  const [community, setCommunity] = useState(communities[0]?.id ?? "");
  const [endsOn, setEndsOn] = useState("");
  const [label, setLabel] = useState("");
  const [names, setNames] = useState("");
  const [preview, setPreview] = useState<Row[] | null>(null);
  const [created, setCreated] = useState<{ group_id: string; prefix: string; students: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    suggestGroupAction(year, month).then((s) => {
      if (!live) return;
      setSuggested(s.letter);
      setTaken(s.taken);
      if (!override) setLetter(s.letter ?? "");
    });
    return () => {
      live = false;
    };
  }, [year, month, override]);

  const count = parseNameList(names).length;
  const prefix = groupPrefix(year, month, letter || null);
  const letterTaken = taken.includes(letter);

  if (created) {
    const communityName = communities.find((c) => c.id === community)?.name ?? "";
    return (
      <div className="space-y-6">
        <div className="no-print rounded-[1.25rem] bg-[#d9fbf5] p-5" role="status">
          <p className="flex items-center gap-2 text-lg font-bold text-mint-700"><Check size={22} weight="bold" aria-hidden /> {t("created", { prefix: created.prefix, n: created.students.length })}</p>
          <p className="mt-1 flex items-start gap-2 text-ink"><Warning size={20} weight="fill" className="mt-0.5 shrink-0 text-pink-700" aria-hidden /> {t("pinsOnce")}</p>
          <Link href={`/equipo/grupos/${created.group_id}`} className="mt-3 inline-block font-semibold text-violet-700 underline">{t("goGroup")}</Link>
        </div>
        <AccessCards cards={created.students} community={communityName} prefix={created.prefix} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <form
        className="tile space-y-5 p-5 md:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => setPreview(await previewGroupAction({ year, month, letter: letter || null, names })));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("year")} htmlFor="year">
            <input id="year" type="number" min={2020} max={2099} value={year} onChange={(e) => { setYear(Number(e.target.value)); setPreview(null); }} className={inputClass} />
          </Field>
          <Field label={t("month")} htmlFor="month">
            <select id="month" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPreview(null); }} className={selectClass}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i + 1)}</option>)}
            </select>
          </Field>
        </div>
        <Field label={t("letter")} htmlFor="letter" helper={suggested ? t("letterSuggested", { letter: suggested }) : t("letterFirst")} error={letterTaken ? te("group_prefix_taken") : null}>
          <div className="flex items-center gap-3">
            <input id="letter" value={letter} onChange={(e) => { setLetter(e.target.value.toUpperCase().slice(0, 1)); setOverride(true); setPreview(null); }} disabled={!override} maxLength={1} placeholder="—" className={cx(inputClass, "w-20 text-center font-mono text-lg uppercase")} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="size-5 accent-[#8d55d0]" /> {t("override")}
            </label>
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("community")} htmlFor="community">
            <select id="community" value={community} onChange={(e) => setCommunity(e.target.value)} className={selectClass}>
              {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t("endsOn")} htmlFor="ends" helper={t("endsOnHelp")}>
            <input id="ends" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label={t("label")} htmlFor="label" helper={t("labelHelp")}>
          <input id="label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} className={inputClass} />
        </Field>
        <Field label={t("names")} htmlFor="names" helper={t("namesHelp", { n: count })}>
          <textarea id="names" value={names} onChange={(e) => { setNames(e.target.value); setPreview(null); }} rows={10} placeholder={"Itzel\nMariana\nFer"} className={cx(textareaClass, "font-mono")} />
        </Field>
        <div className="rounded-2xl bg-midnight px-4 py-3 font-mono text-paper">
          <span className="text-xs text-[#b8acd6]">{t("codesWillBe")} </span>
          <span className="font-bold">{prefix}01</span>
          {count > 1 ? <> <span className="text-[#b8acd6]">…</span> <span className="font-bold">{prefix}{String(count).padStart(count > 99 ? 3 : 2, "0")}</span></> : null}
        </div>
        <button type="submit" disabled={pending || count === 0 || letterTaken} className="inline-flex h-12 items-center gap-2 rounded-full bg-violet-700 px-6 font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
          <Eye size={18} weight="bold" aria-hidden /> {t("preview")}
        </button>
      </form>

      <div className="tile p-5 md:p-6">
        <h2 className="text-lg font-bold">{t("previewTitle")}</h2>
        {!preview ? (
          <p className="mt-2 text-ink-muted">{t("previewEmpty")}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-muted">{t("previewHelp")}</p>
            <div className="mt-4 max-h-[28rem] overflow-auto rounded-2xl ring-1 ring-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white"><tr className="border-b border-line"><th scope="col" className="px-4 py-2">#</th><th scope="col" className="px-4 py-2">{t("nickname")}</th><th scope="col" className="px-4 py-2">{t("code")}</th><th scope="col" className="px-4 py-2">PIN</th></tr></thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.code} className="border-b border-line/60 last:border-0">
                      <td className="px-4 py-2 font-mono text-ink-muted">{r.number}</td>
                      <td className="px-4 py-2 font-semibold">{r.nickname}</td>
                      <td className="px-4 py-2 font-mono font-bold">{r.code}</td>
                      <td className="px-4 py-2 font-mono tracking-widest">{r.pin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error ? <p role="alert" className="mt-3 rounded-xl bg-pink-100 px-4 py-2 text-sm font-medium">{te(error as "unexpected")}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await createGroupAction({ year, month, letter: letter || null, communityId: community, endsOn: endsOn || null, label, students: preview.map((r) => ({ nickname: r.nickname, pin: r.pin })) });
                    if (res.ok) setCreated(res.data);
                    else setError(res.error);
                  })
                }
                className="grad-edge inline-flex h-12 items-center gap-2 rounded-full bg-pink px-6 font-semibold text-ink disabled:opacity-50"
              >
                <Check size={18} weight="bold" aria-hidden /> {t("confirm")}
              </button>
              <button type="button" onClick={() => setPreview(null)} className="inline-flex h-12 items-center gap-2 rounded-full px-4 font-semibold">
                <ArrowLeft size={18} aria-hidden /> {t("edit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
