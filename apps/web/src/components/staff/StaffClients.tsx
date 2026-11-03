"use client";
import { Segmented } from "@/components/motion/Segmented";
// Client widgets for the staff workspace: Logros queue, error catalog editor, API keys,
// educators management, settings, search.
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle, Copy, Key, MagnifyingGlass, Plus, Star, Trophy, Warning } from "@phosphor-icons/react/dist/ssr";
import { testPattern, type ErrorTranslationRow } from "@codeher/core";
import { assignGroupAction, createApiKeyAction, inviteAction, reassignGroupsAction, reviewLogroAction, revokeApiKeyAction, saveErrorRowAction, searchAction, setStaffAction, updateSettingsAction, upsertCommunityAction } from "@/app/actions/staff";
import { EmptyState, Field, LanguageBadge, Tag, inputClass, selectClass, textareaClass, cx } from "@/components/ui";
import type { Accomplishment, Community, ErrorTranslation, Settings } from "@/server/db/types";

function useRun() {
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: te((r.error ?? "unexpected") as "unexpected") });
      router.refresh();
    });
  const Msg = () => (msg ? <p role="status" className={cx("rounded-2xl px-4 py-3 text-sm font-semibold", msg.ok ? "bg-[#d9fbf5] text-mint-700" : "bg-pink-100")}>{msg.text}</p> : null);
  return { run, pending, Msg };
}

// ---------- Logros ----------
type LogroRow = Accomplishment & { community: string | null; student: { id: string; code: string; consent: boolean } | null };

export function LogrosQueue({ items, founder }: { items: LogroRow[]; founder: boolean }) {
  const t = useTranslations("staff.logros");
  const tk = useTranslations("landing.logros.kind");
  const tl = useTranslations("learn.language");
  const { run, pending, Msg } = useRun();
  const [filter, setFilter] = useState<string>("pending");
  const shown = items.filter((a) => (filter === "pending" ? a.status === "nominated" || a.status === "approved" : filter === "all" ? true : a.status === filter));
  const tone = { nominated: "sun", approved: "violet", published: "mint", unpublished: "line", rejected: "line" } as const;
  return (
    <div className="space-y-4" aria-busy={pending}>
      <Msg />
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        <Segmented
          label={t("filter.all")}
          value={filter}
          onChange={setFilter}
          options={["pending", "published", "unpublished", "rejected", "all"].map((f) => ({ value: f, label: t(`filter.${f}` as "filter.all"), count: f === "pending" ? items.filter((a) => a.status === "nominated" || a.status === "approved").length : f === "all" ? items.length : items.filter((a) => a.status === f).length }))}
        />
      </div>
      {shown.length === 0 ? <EmptyState title={t("empty")} body={t("emptyBody")} icon={<Trophy size={28} weight="duotone" aria-hidden />} /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((a) => (
            <li key={a.id} className="tile flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={tone[a.status]}>{t(`status.${a.status}`)}</Tag>
                <Tag tone="line">{tk(a.kind)}</Tag>
                {a.language ? <LanguageBadge language={a.language} label={tl(a.language)} size="sm" /> : null}
                {a.featured ? <Tag tone="sun"><Star size={12} weight="fill" aria-hidden /> {t("featured")}</Tag> : null}
                {a.is_sample ? <Tag tone="ink">{t("sample")}</Tag> : null}
              </div>
              <p className="text-lg font-bold">{a.title}</p>
              <p className="text-sm text-ink-soft">{a.blurb}</p>
              <p className="text-sm text-ink-muted">{a.display_name}{a.community ? ` · ${a.community}` : ""}{a.year ? ` · ${a.year}` : ""}{a.nominated_by_student ? ` · ${t("byStudent")}` : ""}</p>
              {!a.is_sample && (
                <p className={cx("flex items-center gap-1.5 text-sm font-semibold", a.student?.consent ? "text-mint-700" : "text-pink-700")}>
                  {a.student?.consent ? <CheckCircle size={16} weight="fill" aria-hidden /> : <Warning size={16} weight="fill" aria-hidden />}
                  {a.student?.consent ? t("consentYes") : t("consentNo")}
                  {a.student ? <Link href={`/equipo/estudiantes/${a.student.id}`} className="ml-1 font-semibold text-violet-700 underline">{a.student.code}</Link> : null}
                </p>
              )}
              {founder && (
                <div className="mt-auto flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {a.status === "nominated" && <button type="button" onClick={() => run(() => reviewLogroAction(a.id, "approve"), t("done"))} className="h-9 rounded-full bg-white px-3 text-sm font-semibold ring-1 ring-ink/12">{t("approve")}</button>}
                  {a.status !== "published" && <button type="button" disabled={!a.is_sample && !a.student?.consent} onClick={() => run(() => reviewLogroAction(a.id, "publish"), t("done"))} className="h-9 rounded-full bg-violet-700 px-3 text-sm font-semibold text-white disabled:opacity-40">{t("publish")}</button>}
                  {a.status === "published" && <button type="button" onClick={() => run(() => reviewLogroAction(a.id, a.featured ? "unfeature" : "feature"), t("done"))} className="h-9 rounded-full bg-white px-3 text-sm font-semibold ring-1 ring-ink/12">{a.featured ? t("unfeature") : t("feature")}</button>}
                  {a.status === "published" && <button type="button" onClick={() => run(() => reviewLogroAction(a.id, "unpublish"), t("done"))} className="h-9 rounded-full bg-white px-3 text-sm font-semibold ring-1 ring-ink/12">{t("unpublish")}</button>}
                  {(a.status === "nominated" || a.status === "approved") && <button type="button" onClick={() => run(() => reviewLogroAction(a.id, "reject"), t("done"))} className="h-9 rounded-full px-3 text-sm font-semibold text-danger">{t("reject")}</button>}
                  {a.is_sample && <button type="button" onClick={() => run(() => reviewLogroAction(a.id, "delete"), t("done"))} className="h-9 rounded-full px-3 text-sm font-semibold text-danger">{t("delete")}</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Error catalog ----------
export function ErrorCatalogEditor({ rows }: { rows: ErrorTranslation[] }) {
  const t = useTranslations("staff.errorsPage");
  const { run, pending, Msg } = useRun();
  const empty: ErrorTranslation = { id: "", language: "python", error_type: "", pattern: null, message_es: "", explanation_es: "", suggestion_es: "", priority: 50, enabled: true };
  const [edit, setEdit] = useState<ErrorTranslation | null>(null);
  const [raw, setRaw] = useState({ type: "NameError", message: "name 'edad' is not defined", line: "3" });
  const result = edit ? testPattern(edit as ErrorTranslationRow, { type: raw.type, message: raw.message, line: Number(raw.line) || null }) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]" aria-busy={pending}>
      <div className="tile p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t("rows", { n: rows.length })}</h2>
          <button type="button" onClick={() => setEdit(empty)} className="inline-flex h-9 items-center gap-1 rounded-full bg-violet-700 px-3 text-sm font-semibold text-white"><Plus size={14} weight="bold" aria-hidden /> {t("new")}</button>
        </div>
        <p className="mb-3 text-sm text-ink-muted">{t("help")}</p>
        <ul className="divide-y divide-line">
          {rows.sort((a, b) => a.error_type.localeCompare(b.error_type) || a.priority - b.priority).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setEdit(r)} className="w-full px-1 py-2.5 text-left hover:bg-violet-50">
                <p className="flex items-center gap-2 font-mono text-sm font-bold">{r.error_type} <span className="text-xs font-normal text-ink-muted">p{r.priority}</span> {!r.enabled ? <Tag tone="line">{t("disabled")}</Tag> : null}</p>
                <p className="text-sm text-ink-soft">{r.message_es}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {edit && (
        <form className="tile h-fit space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); run(() => saveErrorRowAction({ ...edit, id: edit.id || undefined }), t("saved")); }}>
          <Msg />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("type")} htmlFor="er-type"><input id="er-type" value={edit.error_type} onChange={(e) => setEdit({ ...edit, error_type: e.target.value })} required className={`${inputClass} font-mono`} /></Field>
            <Field label={t("language")} htmlFor="er-lang"><select id="er-lang" value={edit.language ?? ""} onChange={(e) => setEdit({ ...edit, language: (e.target.value || null) as ErrorTranslation["language"] })} className={selectClass}><option value="python">Python</option><option value="pseudocode_es">Pseudocódigo</option><option value="">{t("any")}</option></select></Field>
          </div>
          <Field label={t("pattern")} htmlFor="er-pat" helper={t("patternHelp")}><input id="er-pat" value={edit.pattern ?? ""} onChange={(e) => setEdit({ ...edit, pattern: e.target.value || null })} className={`${inputClass} font-mono text-sm`} /></Field>
          <Field label={t("message")} htmlFor="er-msg"><input id="er-msg" value={edit.message_es} onChange={(e) => setEdit({ ...edit, message_es: e.target.value })} required className={inputClass} /></Field>
          <Field label={t("explanation")} htmlFor="er-exp"><textarea id="er-exp" value={edit.explanation_es} onChange={(e) => setEdit({ ...edit, explanation_es: e.target.value })} rows={2} className={textareaClass} /></Field>
          <Field label={t("suggestion")} htmlFor="er-sug"><textarea id="er-sug" value={edit.suggestion_es} onChange={(e) => setEdit({ ...edit, suggestion_es: e.target.value })} rows={2} className={textareaClass} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("priority")} htmlFor="er-pri"><input id="er-pri" type="number" value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: Number(e.target.value) })} className={inputClass} /></Field>
            <label className="flex items-end gap-2 pb-3 text-sm font-semibold"><input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} className="size-5 accent-[#8d55d0]" /> {t("enabled")}</label>
          </div>
          <fieldset className="rounded-2xl bg-violet-50 p-4">
            <legend className="px-1 text-sm font-bold">{t("tryTitle")}</legend>
            <div className="grid grid-cols-[1fr_70px] gap-2">
              <label className="sr-only" htmlFor="raw-type">{t("type")}</label>
              <input id="raw-type" value={raw.type} onChange={(e) => setRaw({ ...raw, type: e.target.value })} className={`${inputClass} h-10 font-mono text-sm`} />
              <label className="sr-only" htmlFor="raw-line">{t("line")}</label>
              <input id="raw-line" value={raw.line} onChange={(e) => setRaw({ ...raw, line: e.target.value })} className={`${inputClass} h-10 font-mono text-sm`} />
            </div>
            <label className="sr-only" htmlFor="raw-msg">{t("rawMessage")}</label>
            <input id="raw-msg" value={raw.message} onChange={(e) => setRaw({ ...raw, message: e.target.value })} placeholder={t("rawMessage")} className={`${inputClass} mt-2 h-10 font-mono text-sm`} />
            <div className="mt-3 rounded-xl bg-white p-3 text-sm">
              {result?.matched && result.result ? (<><p className="font-bold">{result.result.title}</p><p className="text-ink-soft">{result.result.explanation}</p><p>{result.result.suggestion}</p></>) : <p className="text-ink-muted">{t("noMatch")}</p>}
            </div>
          </fieldset>
          <div className="flex gap-2"><button type="submit" className="h-11 rounded-full bg-violet-700 px-5 font-semibold text-white">{t("save")}</button><button type="button" onClick={() => setEdit(null)} className="h-11 rounded-full px-4 font-semibold">{t("close")}</button></div>
        </form>
      )}
    </div>
  );
}

// ---------- API keys ----------
export function ApiKeys({ keys, origin }: { keys: { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; expires_at: string; revoked_at: string | null }[]; origin: string }) {
  const t = useTranslations("staff.keys");
  const { run, pending, Msg } = useRun();
  const [name, setName] = useState("Claude");
  const [token, setToken] = useState<string | null>(null);
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });
  const cmd = token ? `claude mcp add --transport http codeher ${origin}/api/mcp --header "Authorization: Bearer ${token}"` : "";
  return (
    <div className="space-y-6" aria-busy={pending}>
      <Msg />
      <form onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createApiKeyAction(name); if (r.ok) setToken(r.data.token); return r; }, t("created")); }} className="tile flex flex-wrap items-end gap-3 p-5">
        <Field label={t("name")} htmlFor="kname" className="min-w-56 flex-1"><input id="kname" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
        <button type="submit" className="inline-flex h-12 items-center gap-2 rounded-full bg-violet-700 px-5 font-semibold text-white"><Key size={18} aria-hidden /> {t("create")}</button>
      </form>
      {token && (
        <div className="tile space-y-3 border-2 border-pink p-5" role="status">
          <p className="flex items-center gap-2 font-bold"><Warning size={20} weight="fill" className="text-pink-700" aria-hidden /> {t("once")}</p>
          <p className="break-all rounded-xl bg-midnight p-3 font-mono text-sm text-paper">{token}</p>
          <p className="text-sm font-semibold">{t("claudeCode")}</p>
          <p className="break-all rounded-xl bg-midnight p-3 font-mono text-xs text-mint">{cmd}</p>
          <button type="button" onClick={() => navigator.clipboard.writeText(cmd)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12"><Copy size={16} aria-hidden /> {t("copy")}</button>
        </div>
      )}
      <ul className="space-y-2">
        {keys.map((k) => (
          <li key={k.id} className="tile flex flex-wrap items-center gap-3 p-4">
            <span className="font-mono text-sm font-bold">{k.key_prefix}…</span>
            <span className="font-semibold">{k.name}</span>
            <span className="text-sm text-ink-muted">{t("meta", { created: fmt.format(new Date(k.created_at)), expires: fmt.format(new Date(k.expires_at)) })}</span>
            {k.revoked_at ? <Tag tone="line">{t("revoked")}</Tag> : <button type="button" onClick={() => run(() => revokeApiKeyAction(k.id), t("revokedOk"))} className="ml-auto h-9 rounded-full px-3 text-sm font-semibold text-danger">{t("revoke")}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Educators (founder) ----------
interface StaffDir { staff: { id: string; name: string; email: string; role: string; active: boolean; groups: { id: string; prefix: string }[] }[]; invites: { email: string; role: string; accepted_at: string | null }[]; groups: { id: string; prefix: string; status: string }[] }

export function EducatorsManager({ dir, selfId }: { dir: StaffDir; selfId: string }) {
  const t = useTranslations("staff.educators");
  const { run, pending, Msg } = useRun();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"educator" | "founder">("educator");
  const [groupPick, setGroupPick] = useState<Record<string, string>>({});
  const [promote, setPromote] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <div className="space-y-6" aria-busy={pending}>
      <Msg />
      <form onSubmit={(e) => { e.preventDefault(); run(() => inviteAction(email, role), t("invited")); setEmail(""); }} className="tile grid gap-3 p-5 md:grid-cols-[1fr_200px_auto] md:items-end">
        <Field label={t("inviteEmail")} htmlFor="inv"><input id="inv" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
        <Field label={t("role")} htmlFor="invr"><select id="invr" value={role} onChange={(e) => setRole(e.target.value as "educator")} className={selectClass}><option value="educator">{t("roles.educator")}</option><option value="founder">{t("roles.founder")}</option></select></Field>
        <button type="submit" className="h-12 rounded-full bg-violet-700 px-5 font-semibold text-white">{t("invite")}</button>
      </form>
      <ul className="grid gap-4 md:grid-cols-2">
        {dir.staff.map((s) => (
          <li key={s.id} className="tile space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold">{s.name}</p>
              <Tag tone={s.role === "founder" ? "pink" : s.role === "educator" ? "violet" : "line"}>{t(`roles.${s.role}` as "roles.educator")}</Tag>
              {!s.active ? <Tag tone="line">{t("inactive")}</Tag> : null}
            </div>
            <p className="text-sm text-ink-muted">{s.email}</p>
            <div className="flex flex-wrap gap-1.5">
              {s.groups.map((g) => (
                <span key={g.id} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-mono text-xs font-bold text-violet-800">
                  {g.prefix}
                  <button type="button" aria-label={t("unassign", { prefix: g.prefix })} onClick={() => run(() => assignGroupAction(s.id, g.id, false), t("saved"))} className="ml-0.5 text-violet-700">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <label htmlFor={`gp-${s.id}`} className="sr-only">{t("assignGroup")}</label>
              <select id={`gp-${s.id}`} value={groupPick[s.id] ?? ""} onChange={(e) => setGroupPick({ ...groupPick, [s.id]: e.target.value })} className={`${selectClass} h-10 text-sm`}>
                <option value="">{t("assignGroup")}</option>
                {dir.groups.filter((g) => !s.groups.some((x) => x.id === g.id)).map((g) => <option key={g.id} value={g.id}>{g.prefix}</option>)}
              </select>
              <button type="button" disabled={!groupPick[s.id]} onClick={() => run(() => assignGroupAction(s.id, groupPick[s.id], true), t("saved"))} className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-ink/12 disabled:opacity-40">{t("assign")}</button>
            </div>
            {s.id !== selfId && (
              <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                {s.role !== "founder" && (promote === s.id ? (
                  <span className="flex w-full flex-wrap items-center gap-2">
                    <label htmlFor={`cf-${s.id}`} className="text-sm">{t("confirmFounder")}</label>
                    <input id={`cf-${s.id}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${inputClass} h-10 w-36 font-mono`} />
                    <button type="button" disabled={confirm !== "CONFIRMAR"} onClick={() => { run(() => setStaffAction(s.id, "founder", true, confirm), t("saved")); setPromote(null); setConfirm(""); }} className="h-10 rounded-full bg-pink px-3 text-sm font-semibold text-ink disabled:opacity-40">{t("grant")}</button>
                  </span>
                ) : <button type="button" onClick={() => setPromote(s.id)} className="h-9 rounded-full bg-white px-3 text-sm font-semibold ring-1 ring-ink/12">{t("makeFounder")}</button>)}
                {s.role === "pending" && <button type="button" onClick={() => run(() => setStaffAction(s.id, "educator", true), t("saved"))} className="h-9 rounded-full bg-violet-700 px-3 text-sm font-semibold text-white">{t("approveEducator")}</button>}
                {s.role === "founder" && <button type="button" onClick={() => run(() => setStaffAction(s.id, "educator", s.active), t("saved"))} className="h-9 rounded-full bg-white px-3 text-sm font-semibold ring-1 ring-ink/12">{t("removeFounder")}</button>}
                <button type="button" onClick={() => run(() => setStaffAction(s.id, s.role as "educator", !s.active), t("saved"))} className="h-9 rounded-full px-3 text-sm font-semibold text-danger">{s.active ? t("deactivate") : t("activate")}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="tile space-y-3 p-5">
        <h2 className="font-bold">{t("reassignTitle")}</h2>
        <p className="text-sm text-ink-muted">{t("reassignHelp")}</p>
        <div className="flex flex-wrap gap-2">
          <label htmlFor="rf" className="sr-only">{t("from")}</label>
          <select id="rf" value={from} onChange={(e) => setFrom(e.target.value)} className={`${selectClass} h-11 w-56`}><option value="">{t("from")}</option>{dir.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <label htmlFor="rt" className="sr-only">{t("to")}</label>
          <select id="rt" value={to} onChange={(e) => setTo(e.target.value)} className={`${selectClass} h-11 w-56`}><option value="">{t("to")}</option>{dir.staff.filter((s) => s.active && s.role !== "pending").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <button type="button" disabled={!from || !to || from === to} onClick={() => run(() => reassignGroupsAction(from, to), t("saved"))} className="h-11 rounded-full bg-violet-700 px-5 font-semibold text-white disabled:opacity-40">{t("reassign")}</button>
        </div>
      </div>
      {dir.invites.length > 0 && (
        <div className="tile p-5">
          <h2 className="font-bold">{t("invites")}</h2>
          <ul className="mt-2 space-y-1 text-sm">{dir.invites.map((i) => <li key={i.email} className="flex justify-between gap-2"><span className="font-mono">{i.email}</span><span>{t(`roles.${i.role}` as "roles.educator")} · {i.accepted_at ? t("accepted") : t("pendingInvite")}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ---------- Settings (founder) ----------
export function SettingsForm({ settings, communities }: { settings: Settings; communities: Community[] }) {
  const t = useTranslations("staff.settings");
  const { run, pending, Msg } = useRun();
  const [s, setS] = useState(settings);
  const [teamText, setTeamText] = useState(settings.team.map((m) => `${m.name} | ${m.role} | ${m.bio}`).join("\n"));
  const [newCommunity, setNewCommunity] = useState("");
  const save = () => {
    const team = teamText.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]).map(([name, role = "", bio = ""]) => ({ name, role, bio }));
    run(() => updateSettingsAction({ ...s, team }), t("saved"));
  };
  return (
    <div className="space-y-6" aria-busy={pending}>
      <Msg />
      <section className="tile space-y-4 p-5">
        <h2 className="font-bold">{t("access")}</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t("sessionHours")} htmlFor="sh"><input id="sh" type="number" min={1} max={72} value={s.session_hours} onChange={(e) => setS({ ...s, session_hours: Number(e.target.value) })} className={inputClass} /></Field>
          <Field label={t("softAfter")} htmlFor="sa"><input id="sa" type="number" min={2} max={20} value={s.lockout.soft_after} onChange={(e) => setS({ ...s, lockout: { ...s.lockout, soft_after: Number(e.target.value) } })} className={inputClass} /></Field>
          <Field label={t("softMinutes")} htmlFor="sm"><input id="sm" type="number" min={1} max={240} value={s.lockout.soft_minutes} onChange={(e) => setS({ ...s, lockout: { ...s.lockout, soft_minutes: Number(e.target.value) } })} className={inputClass} /></Field>
          <Field label={t("hardAfter")} htmlFor="ha"><input id="ha" type="number" min={3} max={50} value={s.lockout.hard_after} onChange={(e) => setS({ ...s, lockout: { ...s.lockout, hard_after: Number(e.target.value) } })} className={inputClass} /></Field>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={s.group_letter_rule.first_without_letter} onChange={(e) => setS({ ...s, group_letter_rule: { first_without_letter: e.target.checked } })} className="size-5 accent-[#8d55d0]" /> {t("letterRule")}</label>
      </section>
      <section className="tile space-y-4 p-5">
        <h2 className="font-bold">{t("public")}</h2>
        <Field label={t("contactEmail")} htmlFor="ce"><input id="ce" type="email" value={s.contact_email} onChange={(e) => setS({ ...s, contact_email: e.target.value })} className={inputClass} /></Field>
        <Field label={t("consentText")} htmlFor="ct"><textarea id="ct" value={s.consent_text} onChange={(e) => setS({ ...s, consent_text: e.target.value })} rows={4} className={textareaClass} /></Field>
        <Field label={t("team")} htmlFor="tm" helper={t("teamHelp")}><textarea id="tm" value={teamText} onChange={(e) => setTeamText(e.target.value)} rows={4} className={cx(textareaClass, "font-mono text-sm")} /></Field>
      </section>
      <button type="button" onClick={save} className="h-12 rounded-full bg-violet-700 px-6 font-semibold text-white">{t("save")}</button>
      <section className="tile space-y-3 p-5">
        <h2 className="font-bold">{t("communities")}</h2>
        <ul className="space-y-2">
          {communities.map((c) => <CommunityRow key={c.id} c={c} onSave={(v) => run(() => upsertCommunityAction(v), t("saved"))} />)}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); run(() => upsertCommunityAction({ name: newCommunity, since_year: null, active: true }), t("saved")); setNewCommunity(""); }} className="flex gap-2">
          <label htmlFor="nc" className="sr-only">{t("newCommunity")}</label>
          <input id="nc" value={newCommunity} onChange={(e) => setNewCommunity(e.target.value)} placeholder={t("newCommunity")} className={`${inputClass} h-11`} />
          <button type="submit" disabled={!newCommunity.trim()} className="h-11 shrink-0 rounded-full bg-white px-4 font-semibold ring-1 ring-ink/12 disabled:opacity-40">{t("add")}</button>
        </form>
      </section>
    </div>
  );
}

function CommunityRow({ c, onSave }: { c: Community; onSave: (v: { id: string; name: string; since_year: number | null; active: boolean }) => void }) {
  const t = useTranslations("staff.settings");
  const [name, setName] = useState(c.name);
  const [since, setSince] = useState(c.since_year ? String(c.since_year) : "");
  const [active, setActive] = useState(c.active);
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl p-2 ring-1 ring-line">
      <label className="sr-only" htmlFor={`cn-${c.id}`}>{t("communityName")}</label>
      <input id={`cn-${c.id}`} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} h-10 w-48`} />
      <label className="sr-only" htmlFor={`cy-${c.id}`}>{t("since")}</label>
      <input id={`cy-${c.id}`} value={since} onChange={(e) => setSince(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("since")} className={`${inputClass} h-10 w-28`} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[#8d55d0]" /> {t("activeC")}</label>
      <button type="button" onClick={() => onSave({ id: c.id, name, since_year: since ? Number(since) : null, active })} className="ml-auto h-9 rounded-full bg-white px-3 text-sm font-semibold ring-1 ring-ink/12">{t("save")}</button>
    </li>
  );
}

// ---------- Founder search ----------
export function FounderSearch() {
  const t = useTranslations("staff.search");
  const tl = useTranslations("learn.language");
  const tlib = useTranslations("staff.library");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Awaited<ReturnType<typeof searchAction>> | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); start(async () => setRes(await searchAction(q))); }} className="tile flex gap-2 p-4" role="search">
        <label htmlFor="q" className="sr-only">{t("label")}</label>
        <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("placeholder")} className={inputClass} />
        <button type="submit" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-violet-700 px-5 font-semibold text-white"><MagnifyingGlass size={18} aria-hidden /> {t("search")}</button>
      </form>
      {pending ? <p className="text-ink-muted">{t("searching")}</p> : null}
      {res && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="tile p-5"><h2 className="font-bold">{t("students")}</h2><ul className="mt-2 space-y-1">{res.students.map((s) => <li key={s.id}><Link className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-violet-50" href={`/equipo/estudiantes/${s.id}`}><span className="font-semibold">{s.nickname}</span><span className="font-mono text-sm">{s.code}</span></Link></li>)}</ul>{res.students.length === 0 && <p className="text-sm text-ink-muted">{t("none")}</p>}</section>
          <section className="tile p-5"><h2 className="font-bold">{t("projects")}</h2><ul className="mt-2 space-y-1">{res.projects.map((p) => <li key={p.id}><Link className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-violet-50" href={`/equipo/proyectos/${p.id}`}><span className="font-semibold">{p.name} <span className="text-xs font-normal text-ink-muted">{p.student}</span></span><LanguageBadge language={p.language} label={tl(p.language)} size="sm" /></Link></li>)}</ul>{res.projects.length === 0 && <p className="text-sm text-ink-muted">{t("none")}</p>}</section>
          <section className="tile p-5"><h2 className="font-bold">{t("lessons")}</h2><ul className="mt-2 space-y-1">{res.lessons.map((l) => <li key={l.id}><Link className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-violet-50" href={`/equipo/lecciones/${l.id}`}><span className="font-semibold">{l.title}</span><Tag tone="line">{tlib(`st.${l.status}` as "st.draft")}</Tag></Link></li>)}</ul>{res.lessons.length === 0 && <p className="text-sm text-ink-muted">{t("none")}</p>}</section>
        </div>
      )}
    </div>
  );
}
