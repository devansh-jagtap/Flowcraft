import type { FreeUsage } from '../api/ai';

/** "in 3 h" / "in 12 min" until the free generations come back. */
export function resetsIn(resetsAt: string | null) {
  if (!resetsAt) return '';
  const minutes = Math.max(1, Math.round((new Date(resetsAt).getTime() - Date.now()) / 60_000));
  return minutes >= 60 ? `in ${Math.round(minutes / 60)} h` : `in ${minutes} min`;
}

export function freeSummary(free: FreeUsage) {
  if (free.limit === 0) return 'No free generations on this site';
  if (free.remaining > 0) return `${free.remaining} of ${free.limit} free generation${free.limit === 1 ? '' : 's'} left`;
  const reset = resetsIn(free.resetsAt);
  return `Free generations used up${reset ? `, more ${reset}` : ''}`;
}
