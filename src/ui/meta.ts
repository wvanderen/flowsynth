import type { FocusApp, ModuleType, Rarity, ShelfType } from "../engine/types";

export const META: Record<ModuleType, { name: string; short: string; role: string }> = {
  carrier: { name: "Carrier", short: "Carrier", role: "The granted origin" },
  additive: { name: "Additive Synth", short: "Additive", role: "Harmonic term" },
  conditional: { name: "Conditional Synth", short: "Conditional", role: "Amplitude + chord bonus" },
  focusKeyed: { name: "Focus-Keyed Generator", short: "Focus-Gen", role: "Charge from focus" },
  infusor: { name: "Infusor", short: "Infusor", role: "Neighbor bonuses" },
  forge: { name: "Forge", short: "Forge", role: "Rolls at threshold" },
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

// The planned target's free-entry range (§6): whole minutes, 1–90.
export const PLAN_MIN_MINUTES = 1;
export const PLAN_MAX_MINUTES = 90;

// The planned-target preset chips (§6): quick picks, the set gained 90.
// Open-ended is its own mode — never a duration choice. Values are minutes.
export const PLAN_PRESET_MINUTES: readonly number[] = [10, 15, 20, 25, 30, 45, 60, 90];
