"use client";
// Confetti burst on lesson completion (brief 2.4). Honors prefers-reduced-motion; < 600 ms.
export async function celebrate(big: boolean) {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#9b5de5", "#f15bb5", "#fee440", "#00f5d4", "#00bbf9"];
  confetti({ particleCount: big ? 140 : 50, spread: big ? 95 : 60, startVelocity: big ? 48 : 34, ticks: 140, origin: { y: 0.7 }, colors, disableForReducedMotion: true, scalar: 0.9 });
}
