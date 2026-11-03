"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

export function NavLink({ href, children, exact, variant = "side" }: { href: string; children: ReactNode; exact?: boolean; variant?: "side" | "bottom" | "pill" }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  const styles = {
    side: cx("flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-[0.95rem] font-semibold transition", active ? "bg-ink text-paper" : "text-ink-soft hover:bg-violet-100 hover:text-ink"),
    bottom: cx("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.72rem] font-semibold transition", active ? "text-violet-700" : "text-ink-muted"),
    pill: cx("inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition", active ? "bg-ink text-paper" : "text-ink-soft hover:bg-violet-100"),
  };
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={styles[variant]}>
      {children}
    </Link>
  );
}
