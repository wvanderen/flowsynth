// Clock formatting only: gap accounting lives in trust.ts, which classifies
// whole wall-clock gaps at boundaries — the retired tick planner's job
// (ADR-0010's confirm-or-discard dialog) is gone (ADR-0019).

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return s === 0 ? `${m} min` : `${m} min ${s}s`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}
