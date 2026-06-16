/** Display helpers — kept pure so they can be unit-tested in isolation. */

export const nf = new Intl.NumberFormat('en-US');

export const fmtSteps = (n: number | null | undefined) => nf.format(n ?? 0);

export const fmtCompact = (n: number | null | undefined) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0);

export const rankSuffix = (rank: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = rank % 100;
  return rank + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

/** Movement indicator from previous vs current rank. */
export type Movement = 'up' | 'down' | 'same' | 'new';
export const movement = (rank: number, previous: number | null): Movement => {
  if (previous == null) return 'new';
  if (rank < previous) return 'up';
  if (rank > previous) return 'down';
  return 'same';
};

export const movementIcon: Record<Movement, string> = {
  up: '⬆',
  down: '⬇',
  same: '➡',
  new: '✨',
};

export const pct = (value: number, total: number) =>
  total <= 0 ? 0 : Math.min(100, Math.round((value / total) * 100));
