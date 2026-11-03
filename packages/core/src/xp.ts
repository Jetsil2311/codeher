// Level math (tech spec 6.7): level = floor(sqrt(total_xp / 50)) + 1,
// so level n starts at 50 * (n - 1)^2 XP.

export function levelFromXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

export function levelStartXp(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return 50 * (n - 1) ** 2;
}

/** XP still needed to reach the next level. */
export function xpToNextLevel(totalXp: number): number {
  const level = levelFromXp(totalXp);
  return levelStartXp(level + 1) - Math.max(0, Math.floor(totalXp || 0));
}

/** Progress inside the current level, from 0 to 1. */
export function levelProgress(totalXp: number): number {
  const level = levelFromXp(totalXp);
  const start = levelStartXp(level);
  const end = levelStartXp(level + 1);
  return Math.min(1, Math.max(0, (totalXp - start) / (end - start)));
}
