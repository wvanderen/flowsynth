import type { ModuleType, Rarity } from "../engine/types";

export const META: Record<ModuleType, { name: string; short: string; role: string }> = {
  carrier: { name: "Carrier", short: "Carrier", role: "The granted origin" },
  additive: { name: "Additive Synth", short: "Additive", role: "Harmonic term" },
  conditional: { name: "Conditional Synth", short: "Conditional", role: "Harmonic term" },
  generator: { name: "Generator", short: "Generator", role: "Produces charge" },
  focusKeyed: { name: "Focus-Keyed Generator", short: "Focus-Gen", role: "Charge from focus" },
  infusor: { name: "Infusor", short: "Infusor", role: "Neighbor bonuses" },
  forge: { name: "Forge", short: "Forge", role: "Rolls at threshold" },
};

export const RARITY_LABEL: Record<Rarity, string> = { common: "common", uncommon: "uncommon", rare: "rare" };

export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e9) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtWhole(n: number): string {
  return Math.floor(n + 1e-9).toLocaleString();
}

export const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: "10 minutes", value: 600 },
  { label: "15 minutes", value: 900 },
  { label: "20 minutes", value: 1200 },
  { label: "25 minutes", value: 1500 },
  { label: "30 minutes", value: 1800 },
  { label: "45 minutes", value: 2700 },
  { label: "1 hour", value: 3600 },
  { label: "Open-ended", value: null },
];
