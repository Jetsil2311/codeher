"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, List, X } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/Wordmark";

export function MobileMenu({ links, label, closeLabel, cta, secondary }: { links: { href: string; label: string }[]; label: string; closeLabel: string; cta: { href: string; label: string }; secondary: { href: string; label: string } }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
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
  return (
    <div className="lg:hidden">
      <button type="button" aria-expanded={open} aria-controls="menu-movil" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full bg-paper text-ink ring-1 ring-ink/10 transition active:scale-95" aria-label={label}>
        <List size={20} weight="bold" aria-hidden />
      </button>
      {open && (
        <div id="menu-movil" role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 flex flex-col bg-paper motion-safe:animate-rise">
          <div className="flex h-16 items-center justify-between border-b border-ink/[0.06] bg-white px-4">
            <Wordmark size={23} />
            <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full bg-paper ring-1 ring-ink/10" aria-label={closeLabel}>
              <X size={20} weight="bold" aria-hidden />
            </button>
          </div>
          <nav aria-label={label} className="dot-grid flex-1 overflow-y-auto px-4 py-6">
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-lg font-bold text-ink ring-1 ring-ink/[0.06] transition active:scale-[0.99]">
                    {l.label} <ArrowRight size={18} weight="bold" className="text-violet-700" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid gap-2 border-t border-ink/[0.06] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Link href={cta.href} onClick={() => setOpen(false)} className="grad-edge inline-flex h-13 items-center justify-center rounded-full bg-pink text-base font-bold text-ink">
              {cta.label}
            </Link>
            <Link href={secondary.href} onClick={() => setOpen(false)} className="inline-flex h-12 items-center justify-center rounded-full bg-paper text-base font-semibold text-ink ring-1 ring-ink/10">
              {secondary.label}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
