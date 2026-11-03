"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Table that turns each row into a labelled card on phones (labels come from the header cells). */
export function ResponsiveTable({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const apply = () => {
      const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
      table.querySelectorAll("tbody tr").forEach((tr) => {
        [...tr.children].forEach((td, i) => {
          if (heads[i] && !td.hasAttribute("data-label")) td.setAttribute("data-label", heads[i]);
        });
      });
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(table, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return (
    <div className="-mx-5 overflow-x-auto md:-mx-6" role="region" aria-label={label} tabIndex={0}>
      <table ref={ref} className="rtable w-full text-left text-sm md:min-w-[640px]">{children}</table>
    </div>
  );
}
