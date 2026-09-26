// The one shared formatter for every live value (§7): exact comma-grouped
// numbers below 1,000,000, the short-scale suffix ladder at four significant
// digits above, scientific notation from 1e33, integer quantities always
// exact, and practice-minute countdowns phrased as `in ~3:40 of practice`.

// The full short-scale ladder from the redesign spec (§7); the exact range
// begins at 1e6, so the leading "k" rung stands for completeness only.
const LADDER = ["k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"] as const;

// Tier boundaries: the ladder takes over at 1e6, science at 1e33.
const EXACT_LIMIT = 1e6;
const SCIENTIFIC_LIMIT = 1e33;
const SIGNIFICANT_DIGITS = 4;

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= SCIENTIFIC_LIMIT) return sign + scientific(abs);
  if (abs >= EXACT_LIMIT) return sign + laddered(abs);
  return sign + exact(abs);
}

// Integer quantities (prices, counts) never compress: "1,234,567" stays
// itself instead of "1.235M".
export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.floor(n + 1e-9).toLocaleString("en-US");
}

function exact(abs: number): string {
  return (Math.round(abs * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function laddered(abs: number): string {
  const tier = Math.floor(Math.log10(abs) / 3);
  const scale = 10 ** (tier * 3);
  const mantissa = parseFloat((abs / scale).toPrecision(SIGNIFICANT_DIGITS));
  // Rounding can carry across a rung boundary (999,999,999 → "1000M",
  // 999.9No → 1e33): re-dispatch from the top so a carried value lands on
  // the next rung — or in scientific notation past the ladder's ceiling.
  if (mantissa >= 1000) return formatNumber(mantissa * scale);
  return `${mantissa}${LADDER[tier - 1]}`;
}

function scientific(abs: number): string {
  const exponent = Math.floor(Math.log10(abs));
  let mantissa = parseFloat((abs / 10 ** exponent).toPrecision(SIGNIFICANT_DIGITS));
  let normalized = exponent;
  if (mantissa >= 10) {
    mantissa /= 10;
    normalized += 1;
  }
  return `${mantissa}e${normalized}`;
}

// The countdown vocabulary: m:ss below an hour, `1h 20m` past it.
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 3600) {
    const m = Math.floor(total / 60);
    return `${m}:${String(total % 60).padStart(2, "0")}`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// The credited-minute figure both §8 surfaces share (the summary's practice
// row and the factual event lines, later the history list): whole minutes,
// floored — never rounded up, so partial credit never reads as a full minute.
export function secondsToMinutes(seconds: number): number {
  return Math.max(0, Math.floor(seconds / 60));
}

// The credited practice minutes (§3, §8): the history list's format —
// planned sessions as "X / Y min", open-ended as "X min". The summary and
// the history surfaces share it so neither contradicts the practice log.
export function formatPracticeMinutes(creditedSeconds: number, plannedTargetSeconds: number | null): string {
  return plannedTargetSeconds === null
    ? `${secondsToMinutes(creditedSeconds)} min`
    : `${secondsToMinutes(creditedSeconds)} / ${secondsToMinutes(plannedTargetSeconds)} min`;
}

// The date stamp the history surfaces share (§9): "Sep 19" for list rows,
// with the year in the drill-down. Zero stamps (lenient defaults) render
// as an em dash rather than 1970.
export function formatDate(ms: number, withYear = false): string {
  if (!(ms > 0)) return "—";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

// The upgrade-mode purchase countdown (§7): how much practice until the
// price is reachable at the board's projected rate. Hidden when the purchase
// is already affordable or no rate exists.
export function practiceCountdown(cost: number, nous: number, rate: number): string | null {
  if (cost <= nous) return null;
  if (!(rate > 0)) return null;
  return `in ~${formatCountdown((cost - nous) / rate)} of practice`;
}

// The chord-term label every chord surface shares — the board's hull chips
// and the formula chip's breakdown: "Fifth ×1.3", with the instance count
// appended when a term stacks more than one ("Octave ×1.15 ×3").
export function chordTermLabel(chord: { name: string; bonus: number; instances: number }): string {
  const term = `${chord.name} ×${formatNumber(1 + chord.bonus)}`;
  return chord.instances > 1 ? `${term} ×${chord.instances}` : term;
}
