"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react/dist/ssr";

export function MobileMenu({ links, label, closeLabel }: { links: { href: string; label: string }[]; label: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
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
      <button type="button" aria-expanded={open} aria-controls="menu-movil" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full bg-white ring-1 ring-ink/10" aria-label={label}>
        <List size={22} weight="bold" aria-hidden />
      </button>
      {open && (
        <div id="menu-movil" className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <nav aria-label={label} onClick={(e) => e.stopPropagation()} className="absolute inset-x-3 top-3 rounded-[1.5rem] bg-paper p-3 shadow-[var(--shadow-lift)] motion-safe:animate-rise">
            <div className="flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full hover:bg-violet-100" aria-label={closeLabel}>
                <X size={22} weight="bold" aria-hidden />
              </button>
            </div>
            <ul className="pb-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3.5 text-lg font-semibold hover:bg-violet-100">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
