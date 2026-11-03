import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ArrowUpRight, BookOpenText, CheckCircle, Code, Fire, Flask, FolderSimple, LockSimple, Medal, Plus, Star, Trophy, Lightning, Rocket, Translate, Heart, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { levelProgress, xpToNextLevel } from "@codeher/core";
import { LanguageBadge, cx } from "@/components/ui";
import { CountUp, Ring, Stagger, StaggerItem } from "@/components/motion/Motion";
import { home } from "@/server/services/student";
import { requireStudent } from "@/server/session";

const BADGE_ICONS: Record<string, typeof Medal> = {
  first_program: Code,
  first_lesson: BookOpenText,
  five_lessons: Lightning,
  streak_3: Fire,
  streak_7: Fire,
  first_project: Rocket,
  bilingual: Translate,
  level_5: Star,
  logro: Trophy,
};
const BADGE_TONES = ["from-violet to-pink", "from-pink to-[#ff9f6b]", "from-[#00bbf9] to-violet", "from-[#00c9a7] to-[#00bbf9]", "from-[#f7b500] to-pink"];

export default async function Inicio() {
  const s = await requireStudent();
  const h = home(s);
  const t = await getTranslations("student.home");
  const tl = await getTranslations("learn.language");
  const tb = await getTranslations("student.badges");
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });
  const lessonsPct = h.lessons_total ? h.lessons_completed / h.lessons_total : 0;
  const earned = h.badges.filter((b) => b.earned).length;
  const hour = Number(new Intl.DateTimeFormat("es-MX", { hour: "numeric", hour12: false, timeZone: "America/Mexico_City" }).format(new Date()));
  const greet = hour < 12 ? t("morning") : hour < 19 ? t("afternoon") : t("evening");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 md:px-8 md:pt-8">
      <Stagger className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:gap-5">
        {/* ---------- Hero / continue ---------- */}
        <StaggerItem className="relative isolate overflow-hidden rounded-[1.75rem] bg-midnight p-5 text-paper shadow-[var(--shadow-lift)] md:p-8 lg:row-span-2">
          <div className="blueprint-dark absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="absolute -right-20 -top-24 -z-10 size-72 rounded-full bg-violet/45 blur-3xl" aria-hidden />
          <div className="absolute -bottom-28 left-10 -z-10 size-64 rounded-full bg-pink/35 blur-3xl" aria-hidden />
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-[#d6cdea] ring-1 ring-white/10">
            <Sparkle size={13} weight="fill" className="text-sun" aria-hidden /> {greet} · {h.group.community}
          </p>
          <h1 className="mt-4 text-[2.1rem] font-extrabold leading-[1.05] tracking-tight md:text-5xl">
            {t("hello", { name: h.nickname })}
          </h1>
          <p className="mt-2 max-w-[40ch] text-[#d6cdea]">{h.next ? t("heroBody") : t("allDoneBody")}</p>

          {h.next ? (
            <Link href={`/app/leccion/${h.next.slug}`} className="group mt-6 flex items-center gap-4 rounded-[1.4rem] bg-white p-4 text-ink shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)] transition duration-300 hover:-translate-y-1 md:mt-8 md:p-5">
              <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-grad text-white md:size-16">
                <span className="absolute inset-0 rounded-2xl bg-pink/50 motion-safe:animate-[pulse-ring_2.2s_ease-out_infinite]" aria-hidden />
                <BookOpenText size={28} weight="fill" className="relative" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide text-pink-700">{h.next.status === "in_progress" ? t("continueLabel") : t("nextLabel")}</span>
                <span className="mt-0.5 block text-lg font-extrabold leading-tight md:text-xl">{h.next.title}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <LanguageBadge language={h.next.language} label={tl(h.next.language)} size="sm" />
                  <span className="truncate">{h.next.course}</span>
                </span>
              </span>
              <span className="hidden h-12 shrink-0 items-center gap-2 rounded-full bg-pink px-5 font-bold text-ink shadow-[var(--shadow-pop)] transition group-hover:gap-3 sm:inline-flex">
                {t("continue")} <ArrowRight size={18} weight="bold" aria-hidden />
              </span>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-pink text-ink sm:hidden" aria-hidden>
                <ArrowRight size={20} weight="bold" />
              </span>
            </Link>
          ) : (
            <Link href="/app/proyectos" className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-pink px-6 font-bold text-ink">
              {t("goProjects")} <ArrowRight size={18} weight="bold" aria-hidden />
            </Link>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 md:mt-6 md:gap-3">
            <Link href="/app/laboratorio" className="group flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.12]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint/15 text-mint"><Flask size={20} weight="duotone" aria-hidden /></span>
              <span className="min-w-0 text-sm font-bold leading-tight">{t("quickLab")}<span className="block text-xs font-medium text-[#b8acd6]">{t("quickLabBody")}</span></span>
            </Link>
            <Link href="/app/ruta" className="group flex items-center gap-3 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.12]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sun/15 text-sun"><Trophy size={20} weight="duotone" aria-hidden /></span>
              <span className="min-w-0 text-sm font-bold leading-tight">{t("quickPath")}<span className="block text-xs font-medium text-[#b8acd6]">{t("lessons", { done: h.lessons_completed, total: h.lessons_total })}</span></span>
            </Link>
          </div>
        </StaggerItem>

        {/* ---------- Level ---------- */}
        <StaggerItem className="tile relative flex flex-col justify-center overflow-hidden p-5 md:p-6">
          <div className="flex items-center gap-5">
            <Ring value={levelProgress(h.xp)} size={96} stroke={9} label={t("levelProgress")}>
              <span className="text-center leading-none">
                <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-ink-muted">{t("level")}</span>
                <span className="block text-3xl font-extrabold tabular-nums"><CountUp value={h.level} /></span>
              </span>
            </Ring>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-2xl font-extrabold tabular-nums">
                <Star size={22} weight="fill" className="text-[#e0b800]" aria-hidden /> <CountUp value={h.xp} /> <span className="text-base font-bold text-ink-muted">XP</span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">{t("toNext", { n: xpToNextLevel(h.xp) })}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-violet-100">
                <div className="h-full rounded-full bg-grad" style={{ width: `${Math.max(4, Math.round(lessonsPct * 100))}%` }} />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-ink-muted">{t("lessons", { done: h.lessons_completed, total: h.lessons_total })}</p>
            </div>
          </div>
        </StaggerItem>

        {/* ---------- Streak ---------- */}
        <StaggerItem className="relative flex flex-col justify-center overflow-hidden rounded-[var(--radius-tile)] bg-gradient-to-br from-pink-100 via-white to-violet-100 p-5 ring-1 ring-pink/20 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-pink-700">{t("streak")}</p>
              <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight">{t("days", { n: h.streak })}</p>
              <p className="mt-1 text-sm text-ink-muted">{t("longest", { n: h.longest_streak })}</p>
            </div>
            <span className="relative grid size-20 shrink-0 place-items-center">
              <span className="absolute inset-2 rounded-full bg-pink/25 blur-xl" aria-hidden />
              <Fire size={64} weight="fill" className="relative text-pink drop-shadow-[0_8px_14px_rgb(241_91_181/0.5)] motion-safe:animate-[flicker_2.4s_ease-in-out_infinite]" aria-hidden />
            </span>
          </div>
          <ol className="mt-4 flex gap-1.5" aria-label={t("streakDots")}>
            {Array.from({ length: 7 }, (_, i) => (
              <li key={i} className={cx("h-2 flex-1 rounded-full", i < Math.min(7, h.streak) ? "bg-grad" : "bg-ink/[0.08]")} />
            ))}
          </ol>
          <p className="mt-2 text-xs font-semibold text-ink-muted">{h.streak >= 7 ? t("streakWeek") : t("streakGoal", { n: 7 - Math.min(7, h.streak) })}</p>
        </StaggerItem>
      </Stagger>

      {/* ---------- Projects ---------- */}
      <section aria-labelledby="proyectos-recientes" className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 id="proyectos-recientes" className="text-xl font-extrabold tracking-tight md:text-2xl">{t("recent")}</h2>
          <Link href="/app/proyectos" className="inline-flex items-center gap-1 text-sm font-bold text-violet-700 hover:underline">{t("seeAll")} <ArrowUpRight size={14} weight="bold" aria-hidden /></Link>
        </div>
        <Stagger as="ul" inView className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {h.recent_projects.map((p, i) => (
            <StaggerItem as="li" key={p.id}>
              <Link href={`/app/proyectos/${p.id}`} className="group tile flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <span className={cx("relative block h-24 overflow-hidden bg-gradient-to-br p-3", BADGE_TONES[i % BADGE_TONES.length])} aria-hidden>
                  <span className="block w-3/4 rounded-lg bg-midnight/85 p-2 font-mono text-[0.6rem] leading-relaxed text-[#d9c2fa] shadow-lg transition-transform duration-500 group-hover:-rotate-2 group-hover:scale-105">
                    <span className="block w-4/5 rounded bg-pink/60">&nbsp;</span>
                    <span className="mt-1 block w-3/5 rounded bg-white/20">&nbsp;</span>
                    <span className="mt-1 block w-2/3 rounded bg-mint/40">&nbsp;</span>
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-2 p-4">
                  <span className="font-bold leading-snug">{p.name}</span>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <LanguageBadge language={p.language} label={tl(p.language)} size="sm" />
                    <span className="text-xs text-ink-muted">{fmt.format(new Date(p.updated_at))}</span>
                  </span>
                </span>
              </Link>
            </StaggerItem>
          ))}
          <StaggerItem as="li">
            <Link href="/app/proyectos" className="group flex h-full min-h-40 flex-col items-center justify-center gap-3 rounded-[var(--radius-tile)] border-2 border-dashed border-violet/30 bg-white/50 p-5 text-center transition hover:border-violet/60 hover:bg-white">
              <span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700 transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110"><Plus size={24} weight="bold" aria-hidden /></span>
              <span className="font-bold">{h.recent_projects.length ? t("newProject") : t("noProjects")}</span>
              {!h.recent_projects.length && <span className="max-w-[30ch] text-sm text-ink-muted">{t("noProjectsBody")}</span>}
            </Link>
          </StaggerItem>
        </Stagger>
      </section>

      {/* ---------- Badges ---------- */}
      <section aria-labelledby="insignias" className="mt-10 pb-4">
        <div className="flex items-end justify-between gap-3">
          <h2 id="insignias" className="text-xl font-extrabold tracking-tight md:text-2xl">{t("badges")}</h2>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold ring-1 ring-ink/[0.06]">
            <span className="text-gradient">{earned}</span> / {h.badges.length}
          </span>
        </div>
        <Stagger as="ul" inView className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
          {h.badges.map((b, i) => {
            const Icon = BADGE_ICONS[b.id] ?? Medal;
            return (
              <StaggerItem as="li" key={b.id} className="w-40 shrink-0 snap-start sm:w-auto">
                <div className={cx("group relative h-full overflow-hidden rounded-[1.4rem] p-4 transition duration-300", b.earned ? "bg-white shadow-[var(--shadow-tile)] ring-1 ring-violet/20 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]" : "bg-white/50 ring-1 ring-dashed ring-ink/10")}>
                  {b.earned && <span className="pointer-events-none absolute -inset-x-10 -top-10 h-10 rotate-12 bg-white/70 blur-md transition-transform duration-700 group-hover:translate-y-48" aria-hidden />}
                  <span className={cx("relative grid size-14 place-items-center rounded-2xl", b.earned ? cx("bg-gradient-to-br text-white shadow-[0_10px_22px_-10px_rgb(155_93_229/0.9)]", BADGE_TONES[i % BADGE_TONES.length]) : "bg-ink/[0.05] text-ink-muted")}>
                    <Icon size={28} weight={b.earned ? "fill" : "duotone"} aria-hidden />
                    {!b.earned && (
                      <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-white text-ink-muted ring-2 ring-paper">
                        <LockSimple size={12} weight="bold" aria-hidden />
                      </span>
                    )}
                  </span>
                  <p className={cx("mt-3 text-sm font-extrabold", !b.earned && "text-ink-soft")}>{tb(`${b.id}.title` as "first_program.title")}</p>
                  <p className="mt-0.5 text-xs leading-snug text-ink-muted">{tb(`${b.id}.body` as "first_program.body")}</p>
                  <p className={cx("mt-2 inline-flex items-center gap-1 text-xs font-bold", b.earned ? "text-mint-700" : "text-ink-muted")}>
                    {b.earned ? <><CheckCircle size={14} weight="fill" aria-hidden /> {t("earned")}</> : <><Heart size={13} weight="bold" aria-hidden /> {t("pending")}</>}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>
    </div>
  );
}
