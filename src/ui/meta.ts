import type { FocusApp, ModuleType, Rarity } from "../engine/types";

export const META: Record<ModuleType, { name: string; short: string; role: string }> = {
  carrier: { name: "Carrier", short: "Carrier", role: "The granted origin" },
  additive: { name: "Additive Synth", short: "Additive", role: "Harmonic term" },
  conditional: { name: "Conditional Synth", short: "Conditional", role: "Amplitude + chord bonus" },
  generator: { name: "Generator", short: "Generator", role: "Produces charge" },
  focusKeyed: { name: "Focus-Keyed Generator", short: "Focus-Gen", role: "Charge from focus" },
  infusor: { name: "Infusor", short: "Infusor", role: "Neighbor bonuses" },
  forge: { name: "Forge", short: "Forge", role: "Rolls at threshold" },
};

export const RARITY_LABEL: Record<Rarity, string> = { common: "common", uncommon: "uncommon", rare: "rare" };

// Focus-app display names, shared by the console tiles and purchase surfaces.
export const APP_LABELS: Record<FocusApp, string> = { habit: "Habit", time: "Time", goals: "Goals", notes: "Notes" };

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
