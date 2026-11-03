"use client";
// Staff console chrome. Desktop: grouped sidebar with a gliding active card.
// Phones/tablets: slim top bar, a floating dock with the four daily destinations
// and a "Más" drawer holding everything else (founder tools included).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";
import { BookOpen, Bug, ChartBar, ClipboardText, DotsThreeOutline, Gear, Globe, Key, MagnifyingGlass, SignOut, SquaresFour, Trophy, Users, UsersThree, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/Wordmark";
import { cx } from "@/components/ui";
import { Sheet } from "@/components/motion/Sheet";
import { spring } from "@/components/motion/Segmented";
import { staffSignOutAction } from "@/app/actions/staff";

const ICONS = { panel: SquaresFour, groups: UsersThree, lessons: BookOpen, logros: Trophy, errors: Bug, keys: Key, global: Globe, search: MagnifyingGlass, educators: Users, curation: ChartBar, audit: ClipboardText, settings: Gear };
export type StaffKey = keyof typeof ICONS;
export interface StaffLink { href: string; key: StaffKey; label: string; exact?: boolean }

export function StaffShell({ sections, dock, user, labels, children }: { sections: { title: string; links: StaffLink[] }[]; dock: StaffLink[]; user: { name: string; email: string; role: string }; labels: { nav: string; signOut: string; more: string; close: string }; children: ReactNode }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [drawer, setDrawer] = useState(false);
  const all = sections.flatMap((s) => s.links);
  const alias = path.startsWith("/equipo/estudiantes") || path.startsWith("/equipo/proyectos") ? "/equipo/grupos" : path;
  const isOn = (l: StaffLink) => (l.exact ? alias === l.href : alias === l.href || alias.startsWith(`${l.href}/`));
  // The most specific match wins (/equipo/global vs /equipo/global/buscar).
  const current = all.filter(isOn).sort((a, b) => b.href.length - a.href.length)[0];
  const initials = user.name.split(/\s+/).map((w) => w.match(/\p{L}/u)?.[0] ?? "").filter(Boolean).slice(0, 2).join("").toUpperCase();
  const inDock = dock.some((d) => d.href === current?.href);

  const navList = (group: string, onPick?: () => void) => (
    <LayoutGroup id={group}>
      <nav aria-label={labels.nav} className="flex flex-col gap-5">
        {sections.map((s) => (
          <div key={s.title}>
            <p className="px-3 pb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-muted">{s.title}</p>
            <div className="flex flex-col gap-0.5">
              {s.links.map((l) => {
                const Icon = ICONS[l.key];
                const on = current?.href === l.href;
                return (
                  <Link key={l.href} href={l.href} onClick={onPick} aria-current={on ? "page" : undefined} className={cx("group relative flex h-11 items-center gap-3 rounded-2xl px-2 text-[0.92rem] font-semibold transition-colors", on ? "text-ink" : "text-ink-soft hover:text-ink")}>
                    {on && <motion.span layoutId="staff-active" transition={reduce ? { duration: 0 } : spring} className="absolute inset-0 -z-10 rounded-2xl bg-white shadow-[var(--shadow-tile)] ring-1 ring-ink/[0.06]" aria-hidden />}
                    <span className={cx("grid size-8 place-items-center rounded-xl transition-all duration-300", on ? "bg-grad text-white shadow-[0_8px_18px_-8px_rgb(241_91_181/0.9)]" : "bg-ink/[0.04] text-ink-soft group-hover:bg-violet-100 group-hover:text-violet-800")}>
                      <Icon size={17} weight={on ? "fill" : "bold"} aria-hidden />
                    </span>
                    <span className="truncate">{l.label}</span>
                    {on && <CaretRight size={13} weight="bold" className="ml-auto mr-1 shrink-0 text-violet-700" aria-hidden />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </LayoutGroup>
  );

  const userCard = (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-ink/[0.06]">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-midnight font-bold text-paper">
        <span className="text-gradient text-sm">{initials}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{user.name}</span>
        <span className="block truncate text-xs text-ink-muted">{user.role}</span>
      </span>
      <form action={staffSignOutAction}>
        <button type="submit" title={labels.signOut} aria-label={labels.signOut} className="grid size-9 place-items-center rounded-xl text-ink-muted transition hover:bg-pink-100 hover:text-pink-700">
          <SignOut size={18} weight="bold" aria-hidden />
        </button>
      </form>
    </div>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[16.5rem_1fr]">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:border-r lg:border-ink/[0.06] lg:bg-white/60 lg:px-3 lg:py-5 lg:backdrop-blur-xl">
        <div className="flex items-center justify-between px-3">
          <Wordmark size={21} href="/equipo/panel" />
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-violet-800">{user.role}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{navList("staff-side")}</div>
        {userCard}
      </aside>

      <header className="sticky top-0 z-40 border-b border-ink/[0.05] bg-paper/80 backdrop-blur-xl backdrop-saturate-150 lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Wordmark size={20} href="/equipo/panel" />
          <motion.span key={current?.href} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 truncate rounded-full bg-white px-3 py-1 text-sm font-bold text-ink ring-1 ring-ink/[0.06]">
            {current?.label}
          </motion.span>
        </div>
      </header>

      <main id="contenido" className="min-w-0 pb-32 lg:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>

      <LayoutGroup id="staff-dock">
        <nav aria-label={labels.nav} className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-[1.6rem] bg-midnight/[0.94] p-1.5 shadow-[0_18px_40px_-12px_rgb(27_16_48/0.6)] ring-1 ring-white/10 backdrop-blur-xl">
            {dock.map((l) => {
              const Icon = ICONS[l.key];
              const on = current?.href === l.href;
              return (
                <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} aria-label={l.label} className={cx("relative flex h-12 items-center justify-center gap-2 rounded-[1.2rem] px-3 text-sm font-bold transition-colors touch-manipulation", on ? "flex-[1.8] text-ink" : "flex-1 text-[#b8acd6]")}>
                  {on && <motion.span layoutId="staff-dock-active" transition={reduce ? { duration: 0 } : spring} className="absolute inset-0 rounded-[1.2rem] bg-gradient-to-br from-[#ffd1ec] via-pink to-[#c77dff] shadow-[0_8px_22px_-8px_rgb(241_91_181/0.9)]" aria-hidden />}
                  <Icon size={22} weight={on ? "fill" : "bold"} className="relative" aria-hidden />
                  {on && <motion.span initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="relative truncate" aria-hidden>{l.label}</motion.span>}
                </Link>
              );
            })}
            <button type="button" onClick={() => setDrawer(true)} aria-label={labels.more} aria-expanded={drawer} className={cx("relative flex h-12 flex-1 items-center justify-center gap-2 rounded-[1.2rem] px-3 text-sm font-bold transition-colors", !inDock ? "flex-[1.8] text-ink" : "text-[#b8acd6]")}>
              {!inDock && <motion.span layoutId="staff-dock-active" transition={reduce ? { duration: 0 } : spring} className="absolute inset-0 rounded-[1.2rem] bg-gradient-to-br from-[#ffd1ec] via-pink to-[#c77dff]" aria-hidden />}
              <DotsThreeOutline size={22} weight="fill" className="relative" aria-hidden />
              {!inDock && <span className="relative" aria-hidden>{labels.more}</span>}
            </button>
          </div>
        </nav>
      </LayoutGroup>

      <Sheet open={drawer} onClose={() => setDrawer(false)} side="left" title={<Wordmark size={21} href={null} />} closeLabel={labels.close} footer={<div className="pb-2">{userCard}</div>}>
        <div className="pt-2">{navList("staff-drawer", () => setDrawer(false))}</div>
      </Sheet>
    </div>
  );
}
