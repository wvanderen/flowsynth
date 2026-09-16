import type { FocusApp, ModuleType, Rarity, ShelfType } from "../engine/types";

export const META: Record<ModuleType, { name: string; short: string; role: string }> = {
  carrier: { name: "Carrier", short: "Carrier", role: "The granted origin" },
  additive: { name: "Additive Synth", short: "Additive", role: "Harmonic term" },
  conditional: { name: "Conditional Synth", short: "Conditional", role: "Amplitude + chord bonus" },
  focusKeyed: { name: "Focus-Keyed Generator", short: "Focus-Gen", role: "Charge from focus" },
  infusor: { name: "Infusor", short: "Infusor", role: "Neighbor bonuses" },
  forge: { name: "Forge", short: "Forge", role: "Rolls at threshold" },
};

// Shelf rows speak through the module they grant (ADR-0018: the generator
// offer is the focus-keyed generator; the additive synth is shelved).
export const SHELF_MODULE: Record<ShelfType, ModuleType> = {
  additive: "additive",
  generator: "focusKeyed",
  infusor: "infusor",
  forge: "forge",
};

// The shelf's one permanent hint (§5.8): the guaranteed generator row names
// what charge is for, since nothing else on the board explains it. Every
// other row speaks for itself.
export const SHELF_HINTS: Partial<Record<ShelfType, string>> = {
  generator: "produces charge — feeds the Forge.",
};

export const RARITY_LABEL: Record<Rarity, string> = { common: "common", uncommon: "uncommon", rare: "rare" };

// Focus-app display names, shared by the console tiles and purchase surfaces.
export const APP_LABELS: Record<FocusApp, string> = { habit: "Habit", time: "Time", notes: "Notes", goals: "Goals" };

// The one-line pitch each ladder row carries in the catalog (spec §2.2's
// launch function column).
export const APP_ROLES: Record<FocusApp, string> = {
  habit: "Select the active habit.",
  time: "Planned targets and timing tools.",
  notes: "Capture what you notice.",
  goals: "Track practice conditions.",
};

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
