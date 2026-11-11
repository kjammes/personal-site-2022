/** Whole years elapsed since an ISO date, evaluated at build time. */
export function yearsSince(iso: string, now = new Date()): number {
  const start = new Date(iso);
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, Math.floor(months / 12));
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
