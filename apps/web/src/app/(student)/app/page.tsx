import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Fire, FolderSimple, Medal, Star, CheckCircle, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { levelProgress, xpToNextLevel } from "@codeher/core";
import { Avatar, ButtonLink, EmptyState, LanguageBadge, Progress, Tile, cx } from "@/components/ui";
import { home } from "@/server/services/student";
import { requireStudent } from "@/server/session";

export default async function Inicio() {
  const s = await requireStudent();
  const h = home(s);
  const t = await getTranslations("student.home");
  const tl = await getTranslations("learn.language");
  const tb = await getTranslations("student.badges");
  const fmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-10">
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Tile className="relative overflow-hidden p-6 md:p-8">
          <div className="absolute -right-16 -top-16 size-56 rounded-full bg-violet-100" aria-hidden />
          <div className="absolute -bottom-20 right-24 size-40 rounded-full bg-pink-100" aria-hidden />
          <div className="relative flex items-center gap-4">
            <Avatar id={h.avatar} size={56} />
            <div>
              <p className="text-sm font-semibold text-ink-muted">{h.group.community}</p>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                {t("hello", { name: h.nickname })}
              </h1>
            </div>
          </div>
          {h.next ? (
            <div className="relative mt-8 rounded-[1.25rem] bg-ink p-5 text-paper md:p-6">
              <p className="text-sm font-semibold text-[#d6cdea]">{h.next.status === "in_progress" ? t("continueLabel") : t("nextLabel")}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold md:text-2xl">{h.next.title}</p>
                <LanguageBadge language={h.next.language} label={tl(h.next.language)} tone="dark" size="sm" />
              </div>
              <p className="text-sm text-[#b8acd6]">{h.next.course}</p>
              <ButtonLink href={`/app/leccion/${h.next.slug}`} size="lg" className="mt-5">
                {t("continue")} <ArrowRight size={18} weight="bold" aria-hidden />
              </ButtonLink>
            </div>
          ) : (
            <div className="relative mt-8 rounded-[1.25rem] bg-ink p-6 text-paper">
              <p className="font-accent text-2xl italic text-pink">{t("allDone")}</p>
              <p className="mt-1 text-[#d6cdea]">{t("allDoneBody")}</p>
              <ButtonLink href="/app/proyectos" className="mt-4">{t("goProjects")}</ButtonLink>
            </div>
          )}
        </Tile>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 lg:gap-5">
          <Tile className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink-muted">{t("level")}</h2>
              <Star size={22} weight="fill" className="text-[#e0b800]" aria-hidden />
            </div>
            <p className="mt-1 text-3xl font-extrabold tabular-nums sm:text-4xl">{h.level}</p>
            <Progress value={levelProgress(h.xp)} label={t("levelProgress")} className="mt-3" />
            <p className="mt-2 text-sm text-ink-muted">{t("xpLine", { xp: h.xp, next: xpToNextLevel(h.xp) })}</p>
          </Tile>
          <Tile className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink-muted">{t("streak")}</h2>
              <Fire size={24} weight="fill" className="text-pink" aria-hidden />
            </div>
            <p className="mt-1 text-3xl font-extrabold tabular-nums sm:text-4xl">{t("days", { n: h.streak })}</p>
            <p className="mt-2 text-sm text-ink-muted">{t("longest", { n: h.longest_streak })}</p>
            <p className="mt-3 text-sm text-ink-muted">{t("lessons", { done: h.lessons_completed, total: h.lessons_total })}</p>
          </Tile>
        </div>
      </section>

      <section aria-labelledby="proyectos-recientes" className="mt-10">
        <div className="flex items-end justify-between">
          <h2 id="proyectos-recientes" className="text-xl font-extrabold">{t("recent")}</h2>
          <Link href="/app/proyectos" className="text-sm font-semibold text-violet-700 hover:underline">{t("seeAll")}</Link>
        </div>
        {h.recent_projects.length ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {h.recent_projects.map((p) => (
              <li key={p.id}>
                <Link href={`/app/proyectos/${p.id}`} className="tile flex h-full flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
                  <FolderSimple size={26} weight="duotone" className="text-violet-700" aria-hidden />
                  <p className="font-bold">{p.name}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <LanguageBadge language={p.language} label={tl(p.language)} size="sm" />
                    <span className="text-xs text-ink-muted">{fmt.format(new Date(p.updated_at))}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title={t("noProjects")} body={t("noProjectsBody")} icon={<FolderSimple size={28} weight="bold" />} action={<ButtonLink href="/app/proyectos" variant="violet">{t("newProject")}</ButtonLink>} />
          </div>
        )}
      </section>

      <section aria-labelledby="insignias" className="mt-10 pb-6">
        <h2 id="insignias" className="text-xl font-extrabold">{t("badges")}</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {h.badges.map((b) => (
            <li key={b.id} className={cx("rounded-[1.25rem] p-4 ring-1", b.earned ? "bg-white ring-violet/30 shadow-[var(--shadow-tile)]" : "bg-paper ring-line")}>
              <div className={cx("grid size-11 place-items-center rounded-2xl", b.earned ? "bg-grad text-white" : "bg-line text-ink-muted")}>
                {b.earned ? <Medal size={24} weight="fill" aria-hidden /> : <LockSimple size={20} weight="bold" aria-hidden />}
              </div>
              <p className={cx("mt-3 text-sm font-bold", !b.earned && "text-ink-muted")}>{tb(`${b.id}.title` as "first_program.title")}</p>
              <p className="text-xs text-ink-muted">{tb(`${b.id}.body` as "first_program.body")}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold">
                {b.earned ? <><CheckCircle size={14} weight="fill" className="text-mint-700" aria-hidden /> {t("earned")}</> : t("pending")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
