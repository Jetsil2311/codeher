"use client";
// Student app chrome. Desktop: a sticky sidebar with a profile card (level ring,
// XP, streak) and a nav whose active card glides between items. Phones/tablets:
// a slim top bar plus a floating dock whose active item expands into a pill.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import { Fire, Flask, FolderSimple, House, Path, SignOut, Star, UserCircle, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/Wordmark";
import { Avatar, cx } from "@/components/ui";
import { Ring } from "@/components/motion/Motion";
import { Sheet } from "@/components/motion/Sheet";
import { spring } from "@/components/motion/Segmented";
import { signOutAction } from "@/app/actions/student";

const ICONS = { home: House, path: Path, lab: Flask, projects: FolderSimple, profile: UserCircle };
type Key = keyof typeof ICONS;

export interface StudentShellProps {
  links: { href: string; key: Key; label: string; short: string; exact?: boolean }[];
  me: { nickname: string; avatar: string; xp: number; level: number; progress: number; toNext: number; streak: number; community: string };
  labels: { nav: string; signOut: string; level: string; streak: string; xpToNext: string; account: string; days: string; close: string };
  children: ReactNode;
}

export function StudentShell({ links, me, labels, children }: StudentShellProps) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [menu, setMenu] = useState(false);
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`) || (href === "/app/ruta" && path.startsWith("/app/leccion")));
  const focus = path.startsWith("/app/laboratorio") || path.startsWith("/app/leccion");

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[17.5rem_1fr]">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="relative hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-5 lg:overflow-y-auto lg:border-r lg:border-ink/[0.06] lg:bg-white/70 lg:px-4 lg:py-5 lg:backdrop-blur-xl">
        <div className="px-2">
          <Wordmark size={22} href="/app" />
        </div>
        <Link href="/app/perfil" className="group relative overflow-hidden rounded-[1.4rem] bg-midnight p-4 text-paper shadow-[var(--shadow-lift)]">
          <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-violet/40 blur-2xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-14 left-6 size-28 rounded-full bg-pink/30 blur-2xl" aria-hidden />
          <div className="relative flex items-center gap-3">
            <Ring value={me.progress} size={58} stroke={5} track="rgb(255 255 255 / 0.12)" label={`${labels.level} ${me.level}`}>
              <Avatar id={me.avatar} size={40} className="rounded-xl" />
            </Ring>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{me.nickname}</p>
              <p className="truncate text-xs text-[#b8acd6]">{me.community}</p>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
              <p className="flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-[#b8acd6]">
                <Star size={12} weight="fill" className="text-sun" aria-hidden /> {labels.level}
              </p>
              <p className="font-mono text-lg font-bold tabular-nums">{me.level}</p>
            </div>
            <div className="rounded-xl bg-white/[0.07] px-3 py-2 ring-1 ring-white/10">
              <p className="flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-wide text-[#b8acd6]">
                <Fire size={12} weight="fill" className="text-pink" aria-hidden /> {labels.streak}
              </p>
              <p className="font-mono text-lg font-bold tabular-nums">{me.streak}</p>
            </div>
          </div>
          <p className="relative mt-3 text-xs text-[#b8acd6]">{labels.xpToNext}</p>
        </Link>

        <LayoutGroup id="student-side">
          <nav aria-label={labels.nav} className="flex flex-col gap-1">
            {links.map((l) => {
              const Icon = ICONS[l.key];
              const on = active(l.href, l.exact);
              return (
                <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={cx("group relative flex h-12 items-center gap-3 rounded-2xl px-2 text-[0.95rem] font-semibold transition-colors", on ? "text-ink" : "text-ink-soft hover:text-ink")}>
                  {on && <motion.span layoutId="side-active" transition={reduce ? { duration: 0 } : spring} className="absolute inset-0 -z-10 rounded-2xl bg-white shadow-[var(--shadow-tile)] ring-1 ring-ink/[0.06]" aria-hidden />}
                  <span className={cx("grid size-9 place-items-center rounded-xl transition-all duration-300", on ? "bg-grad text-white shadow-[0_8px_18px_-8px_rgb(241_91_181/0.9)]" : "bg-ink/[0.04] text-ink-soft group-hover:bg-violet-100 group-hover:text-violet-800")}>
                    <Icon size={19} weight={on ? "fill" : "bold"} aria-hidden />
                  </span>
                  {l.label}
                  {on && <CaretRight size={14} weight="bold" className="ml-auto mr-1 text-violet-700" aria-hidden />}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>

        <form action={signOutAction} className="mt-auto">
          <button type="submit" className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-ink-muted transition hover:bg-pink-100 hover:text-pink-700">
            <SignOut size={18} weight="bold" aria-hidden /> {labels.signOut}
          </button>
        </form>
      </aside>

      {/* ---------- Phone / tablet top bar ---------- */}
      <header className="sticky top-0 z-40 border-b border-ink/[0.05] bg-paper/80 backdrop-blur-xl backdrop-saturate-150 lg:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Wordmark size={20} href="/app" />
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-ink ring-1 ring-ink/[0.06]" title={labels.streak}>
              <motion.span animate={reduce ? undefined : { scale: [1, 1.18, 1], rotate: [0, -6, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }} className="inline-flex">
                <Fire size={17} weight="fill" className="text-pink" aria-hidden />
              </motion.span>
              <span className="tabular-nums">{me.streak}</span>
              <span className="sr-only">{labels.days}</span>
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-sun-700 ring-1 ring-ink/[0.06]">
              <Star size={16} weight="fill" className="text-[#e0b800]" aria-hidden /> <span className="tabular-nums">{me.xp}</span>
              <span className="sr-only">XP</span>
            </span>
            <button type="button" onClick={() => setMenu(true)} aria-label={labels.account} className="rounded-[0.9rem] transition active:scale-90">
              <Ring value={me.progress} size={40} stroke={3}>
                <Avatar id={me.avatar} size={30} className="rounded-[0.6rem]" />
              </Ring>
            </button>
          </div>
        </div>
      </header>

      <main id="contenido" className={cx("min-w-0", focus ? "pb-28 lg:pb-8" : "pb-32 lg:pb-12")}>{children}</main>

      {/* ---------- Floating dock ---------- */}
      <LayoutGroup id="student-dock">
        <nav aria-label={labels.nav} className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-[1.6rem] bg-midnight/[0.94] p-1.5 shadow-[0_18px_40px_-12px_rgb(27_16_48/0.6)] ring-1 ring-white/10 backdrop-blur-xl">
            {links.map((l) => {
              const Icon = ICONS[l.key];
              const on = active(l.href, l.exact);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={on ? "page" : undefined}
                  aria-label={l.label}
                  className={cx("relative flex h-12 items-center justify-center gap-2 rounded-[1.2rem] px-3.5 text-sm font-bold transition-colors touch-manipulation", on ? "flex-[1.6] text-ink" : "flex-1 text-[#b8acd6] active:text-paper")}
                >
                  {on && <motion.span layoutId="dock-active" transition={reduce ? { duration: 0 } : spring} className="absolute inset-0 -z-0 rounded-[1.2rem] bg-gradient-to-br from-[#ffd1ec] via-pink to-[#c77dff] shadow-[0_8px_22px_-8px_rgb(241_91_181/0.9)]" aria-hidden />}
                  <motion.span className="relative inline-flex" animate={on && !reduce ? { y: [0, -3, 0] } : { y: 0 }} transition={{ duration: 0.35 }}>
                    <Icon size={22} weight={on ? "fill" : "bold"} aria-hidden />
                  </motion.span>
                  {on && (
                    <motion.span initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }} className="relative truncate" aria-hidden>
                      {l.short}
                    </motion.span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </LayoutGroup>

      <Sheet open={menu} onClose={() => setMenu(false)} title={labels.account} closeLabel={labels.close}>
        <div className="flex items-center gap-4 rounded-[1.4rem] bg-midnight p-4 text-paper">
          <Ring value={me.progress} size={64} stroke={5} track="rgb(255 255 255 / 0.12)">
            <Avatar id={me.avatar} size={44} className="rounded-xl" />
          </Ring>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{me.nickname}</p>
            <p className="text-sm text-[#b8acd6]">
              {labels.level} {me.level} · {me.xp} XP
            </p>
            <p className="text-xs text-[#b8acd6]">{labels.xpToNext}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2">
          <Link href="/app/perfil" onClick={() => setMenu(false)} className="flex h-13 items-center gap-3 rounded-2xl bg-paper px-4 font-semibold ring-1 ring-ink/[0.05]">
            <UserCircle size={22} weight="duotone" className="text-violet-700" aria-hidden /> {links.find((l) => l.key === "profile")?.label}
            <CaretRight size={16} weight="bold" className="ml-auto text-ink-muted" aria-hidden />
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="flex h-13 w-full items-center gap-3 rounded-2xl bg-pink-100 px-4 font-semibold text-pink-700">
              <SignOut size={20} weight="bold" aria-hidden /> {labels.signOut}
            </button>
          </form>
        </div>
      </Sheet>
    </div>
  );
}
