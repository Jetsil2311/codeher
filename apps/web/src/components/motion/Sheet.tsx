"use client";
// Bottom sheet (phones) / side drawer, with backdrop blur, spring entrance,
// drag-to-dismiss on the bottom variant, focus trap-lite and Escape to close.
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/components/ui";

export function Sheet({
  open,
  onClose,
  title,
  children,
  side = "bottom",
  closeLabel = "Cerrar",
  className,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  side?: "bottom" | "left" | "right";
  closeLabel?: string;
  className?: string;
  footer?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);
  // Callers often pass an inline onClose; keep it in a ref so the focus/scroll effect
  // only runs when the sheet opens or closes (not on every keystroke inside it).
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current)?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;
  const bottom = side === "bottom";
  const from = bottom ? { y: "100%" } : side === "left" ? { x: "-100%" } : { x: "100%" };
  const to = bottom ? { y: 0 } : { x: 0 };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]" role="presentation">
          <motion.div
            className="absolute inset-0 bg-midnight/45 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-label={typeof title === "string" ? title : undefined}
            initial={reduce ? { opacity: 0 } : from}
            animate={reduce ? { opacity: 1 } : to}
            exit={reduce ? { opacity: 0 } : from}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag={bottom && !reduce ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className={cx(
              "absolute flex flex-col bg-white text-ink outline-none shadow-[0_-20px_60px_-20px_rgb(27_16_48/0.45)]",
              bottom
                ? "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-[1.75rem] pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-1/2 sm:w-[min(36rem,calc(100%-2rem))] sm:-translate-x-1/2"
                : cx("inset-y-0 w-[min(22rem,calc(100%-3rem))] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]", side === "left" ? "left-0 rounded-r-[1.75rem]" : "right-0 rounded-l-[1.75rem]"),
              className,
            )}
          >
            {bottom && <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 cursor-grab rounded-full bg-ink/15 active:cursor-grabbing" aria-hidden />}
            {title !== undefined && (
              <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-3">
                <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
                <button type="button" onClick={onClose} aria-label={closeLabel} className="grid size-10 place-items-center rounded-full bg-paper text-ink-soft transition hover:bg-violet-100 hover:text-ink active:scale-95">
                  <X size={18} weight="bold" aria-hidden />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">{children}</div>
            {footer ? <div className="shrink-0 border-t border-line px-5 pt-3">{footer}</div> : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
