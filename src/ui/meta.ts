import type { ModuleType, Rarity } from "../engine/types";

export const META: Record<ModuleType, { name: string; short: string; role: string }> = {
  enter: { name: "Enter / Exit", short: "Flow", role: "Core production" },
  time: { name: "Time", short: "Time", role: "Session rhythm" },
  habit: { name: "Habit", short: "Habit", role: "Practice identity" },
  notes: { name: "Notes", short: "Notes", role: "Capture a thought" },
  goals: { name: "Goals", short: "Goals", role: "Practice conditions" },
  tasks: { name: "Tasks", short: "Tasks", role: "Small steps" },
  additive: { name: "Additive Synth", short: "Additive", role: "Base production" },
  conditional: { name: "Conditional Synth", short: "Multiplier", role: "Core adjacency" },
  infusor: { name: "Infusor", short: "Infusor", role: "Neighbor bonuses" },
  forge: { name: "Forge", short: "Forge", role: "New possibilities" },
  expander: { name: "Expander", short: "Expander", role: "Room to grow" },
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
