"use client";
// Public header: a bar that condenses into a floating glass island on scroll.
// Desktop links share a hover pill and an active dot that glide between items.
// Phones get a morphing menu button and a full-screen menu revealed from the button.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpenText, Flask, HandHeart, Path, Trophy, Lock } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/Wordmark";
import { cx } from "@/components/ui";
import { spring } from "@/components/motion/Segmented";

export interface PublicLink {
  href: string;
  label: string;
  desc: string;
  icon: "probar" | "lab" | "logros" | "how" | "bring";
}

const ICONS = { probar: BookOpenText, lab: Flask, logros: Trophy, how: Path, bring: HandHeart };
const TONES = {
  probar: "bg-violet-100 text-violet-800",
  lab: "bg-midnight text-mint",
  logros: "bg-[#fff8c7] text-sun-700",
  how: "bg-pink-100 text-pink-700",
  bring: "bg-[#e7f6fd] text-[#035f80]",
};

export function PublicNav({ links, labels }: { links: PublicLink[]; labels: { main: string; menu: string; close: string; entrar: string; probar: string; staff: string; tagline: string } }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 16));
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  const isActive = (href: string) => !href.includes("#") && (path === href || path.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-50 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-5">
      <motion.div
        initial={false}
        animate={scrolled || open ? { maxWidth: 1180, borderRadius: 999, y: 4 } : { maxWidth: 1400, borderRadius: 24, y: 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 32 }}
        className={cx(
          "relative z-[61] mx-auto flex h-14 items-center justify-between gap-3 pl-4 pr-2 transition-[background-color,box-shadow,backdrop-filter] duration-300 md:h-16 md:pl-6",
          scrolled || open ? "bg-white/80 shadow-[0_10px_40px_-14px_rgb(91_49_160/0.35),0_0_0_1px_rgb(27_16_48/0.06)] backdrop-blur-xl backdrop-saturate-150" : "bg-transparent",
        )}
      >
        <Wordmark size={22} />
        <LayoutGroup id="public-nav">
          <nav aria-label={labels.main} className="hidden items-center lg:flex" onMouseLeave={() => setHover(null)}>
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  onMouseEnter={() => setHover(l.href)}
                  onFocus={() => setHover(l.href)}
                  className={cx("relative inline-flex h-10 items-center rounded-full px-4 text-[0.93rem] font-semibold transition-colors", active ? "text-violet-800" : "text-ink-soft hover:text-ink")}
                >
                  {hover === l.href && <motion.span layoutId="hover" transition={spring} className="absolute inset-0 -z-10 rounded-full bg-violet-100/80" aria-hidden />}
                  <span className="relative">{l.label}</span>
                  {active && <motion.span layoutId="active-dot" transition={spring} className="absolute bottom-1 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-grad" aria-hidden />}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
        <div className="flex items-center gap-1.5">
          <Link href="/entrar" className="group grad-edge relative inline-flex h-10 items-center gap-1.5 overflow-hidden rounded-full bg-pink pl-5 pr-4 text-[0.95rem] font-bold text-ink shadow-[var(--shadow-pop)] transition active:scale-95">
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
            <span className="relative">{labels.entrar}</span>
            <ArrowRight size={16} weight="bold" className="relative transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? labels.close : labels.menu}
            className="relative grid size-10 place-items-center rounded-full bg-ink text-paper transition active:scale-90 lg:hidden"
          >
            <span className="sr-only">{open ? labels.close : labels.menu}</span>
            <motion.span className="absolute h-[2px] w-[18px] rounded-full bg-current" animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -4 }} transition={spring} aria-hidden />
            <motion.span className="absolute h-[2px] rounded-full bg-current" animate={open ? { rotate: -45, y: 0, width: 18 } : { rotate: 0, y: 4, width: 12, x: 3 }} transition={spring} aria-hidden />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-movil"
            role="dialog"
            aria-modal="true"
            aria-label={labels.menu}
            initial={reduce ? { opacity: 0 } : { clipPath: "circle(0% at calc(100% - 2.6rem) 2.2rem)" }}
            animate={reduce ? { opacity: 1 } : { clipPath: "circle(150% at calc(100% - 2.6rem) 2.2rem)" }}
            exit={reduce ? { opacity: 0 } : { clipPath: "circle(0% at calc(100% - 2.6rem) 2.2rem)", transition: { duration: 0.35, ease: [0.7, 0, 0.84, 0] } }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-paper lg:hidden"
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              <div className="dot-grid absolute inset-0 opacity-70" />
              <div className="absolute -right-24 -top-24 size-72 rounded-full bg-violet/25 blur-3xl" />
              <div className="absolute -bottom-24 -left-20 size-72 rounded-full bg-pink/25 blur-3xl" />
            </div>
            <nav aria-label={labels.main} className="relative flex-1 px-4 pb-6 pt-24">
              <motion.ul initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } }} className="space-y-2.5">
                {links.map((l, i) => {
                  const Icon = ICONS[l.icon];
                  const active = isActive(l.href);
                  return (
                    <motion.li key={l.href} variants={{ hidden: { opacity: 0, y: 24, rotate: -1.5 }, show: { opacity: 1, y: 0, rotate: 0, transition: { type: "spring", stiffness: 300, damping: 26 } } }}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cx("group flex items-center gap-4 rounded-[1.4rem] bg-white/90 p-3 pr-4 ring-1 backdrop-blur transition active:scale-[0.98]", active ? "ring-violet/50 shadow-[var(--shadow-tile)]" : "ring-ink/[0.06]")}
                      >
                        <span className={cx("grid size-12 shrink-0 place-items-center rounded-2xl", TONES[l.icon])}>
                          <Icon size={24} weight="duotone" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="font-mono text-[0.7rem] font-medium text-ink-muted">0{i + 1}</span>
                            <span className="text-xl font-extrabold tracking-tight text-ink">{l.label}</span>
                          </span>
                          <span className="block truncate text-sm text-ink-muted">{l.desc}</span>
                        </span>
                        <ArrowUpRight size={20} weight="bold" className="shrink-0 text-violet-700 transition-transform group-active:translate-x-0.5 group-active:-translate-y-0.5" aria-hidden />
                      </Link>
                    </motion.li>
                  );
                })}
              </motion.ul>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.45 } }} className="mt-6 px-2 font-accent text-lg italic text-pink-700">
                {labels.tagline}
              </motion.p>
            </nav>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3, type: "spring", stiffness: 260, damping: 26 } }} className="relative grid gap-2 border-t border-ink/[0.06] bg-white/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
              <Link href="/entrar" onClick={() => setOpen(false)} className="grad-edge inline-flex h-13 items-center justify-center gap-2 rounded-full bg-pink text-base font-bold text-ink shadow-[var(--shadow-pop)]">
                {labels.entrar} <ArrowRight size={18} weight="bold" aria-hidden />
              </Link>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/probar" onClick={() => setOpen(false)} className="inline-flex h-12 items-center justify-center rounded-full bg-paper text-sm font-semibold text-ink ring-1 ring-ink/10">
                  {labels.probar}
                </Link>
                <Link href="/equipo" onClick={() => setOpen(false)} className="inline-flex h-12 items-center justify-center gap-1.5 rounded-full bg-paper text-sm font-semibold text-ink-soft ring-1 ring-ink/10">
                  <Lock size={15} weight="bold" aria-hidden /> {labels.staff}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
