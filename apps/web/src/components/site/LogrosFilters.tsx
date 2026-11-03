"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { FadersHorizontal, X } from "@phosphor-icons/react/dist/ssr";
import { LinkTabs } from "@/components/motion/LinkTabs";
import { Sheet } from "@/components/motion/Sheet";

export interface FilterGroup {
  key: string;
  label: string;
  items: { href: string; label: string; active: boolean }[];
}

export function LogrosFilters({ groups, labels, active }: { groups: FilterGroup[]; labels: { filters: string; clear: string; close: string; show: string }; active: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const sp = useSearchParams();
  useEffect(() => setOpen(false), [path, sp]);
  return (
    <div role="search" aria-label={labels.filters}>
      {/* Desktop: three rows of gliding pills */}
      <div className="hidden gap-x-8 gap-y-3 rounded-[1.6rem] bg-white/80 p-4 ring-1 ring-ink/[0.06] backdrop-blur md:flex md:flex-wrap md:items-center">
        {groups.map((g) => (
          <div key={g.key} className="flex min-w-0 items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">{g.label}</span>
            <LinkTabs label={g.label} items={g.items} tone="violet" size="sm" />
          </div>
        ))}
      </div>

      {/* Phones: one button + the active filters as removable chips */}
      <div className="flex items-center gap-2 md:hidden">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-4 text-sm font-bold text-paper shadow-[0_8px_20px_-10px_rgb(27_16_48/0.7)] active:scale-95">
          <FadersHorizontal size={18} weight="bold" aria-hidden /> {labels.filters}
          {active.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-pink text-[0.7rem] text-ink">{active.length}</span>}
        </button>
        <div className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none]">
          {active.map((a) => (
            <motion.span key={a.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex shrink-0">
              <Link href={a.href} scroll={false} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-violet-100 pl-3 pr-2 text-sm font-semibold text-violet-800">
                {a.label} <X size={14} weight="bold" aria-hidden />
              </Link>
            </motion.span>
          ))}
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={labels.filters} closeLabel={labels.close} footer={<Link href="/logros" scroll={false} className="mb-1 inline-flex h-11 w-full items-center justify-center rounded-full bg-paper text-sm font-semibold text-ink ring-1 ring-ink/10">{labels.clear}</Link>}>
        <div className="space-y-5 pb-2">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((it) => (
                  <Link key={it.href + it.label} href={it.href} scroll={false} aria-current={it.active ? "page" : undefined} className={it.active ? "inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-bold text-paper" : "inline-flex h-10 items-center rounded-full bg-paper px-4 text-sm font-semibold text-ink-soft ring-1 ring-ink/10"}>
                    {it.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
