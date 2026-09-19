import type { Category, ModuleType, Rarity, ShelfType } from "./types";

export interface Balance {
  carrierRate: number;
  additiveRate: number;
  conditionalRate: number;
  conditionalPairBonus: number;
  pairBonus: number;
  infusorBonus: number;
  // ADR-0015's global achievement term: each unlocked feat adds this much
  // into the boost, additively (boost = 1 + feats × per-feat). Nous-rate
  // only. Provisional tuning (~+2% each).
  achievementBoostPerFeat: number;
  upgradeFirstCost: number;
  upgradeCostGrowthNumerator: bigint;
  upgradeCostGrowthDenominator: bigint;
  rarityPower: Record<Rarity, number>;
  rarityProbability: Record<Rarity, number>;
  shelfPrices: Record<ShelfType, number>;
  // Cells (ADR-0013): direct nous purchases on a steep geometric scaler over
  // total cells bought. Provisional tuning.
  cellFirstCost: number;
  cellCostGrowthNumerator: bigint;
  cellCostGrowthDenominator: bigint;
  // The activation ladder (ADR-0013): rung one below the shelf floor, each
  // later rung costs more — counted globally regardless of which app it
  // opens. Provisional tuning.
  ladderFirstCost: number;
  ladderGrowthNumerator: bigint;
  ladderGrowthDenominator: bigint;
  // Console long goals (ADR-0012): hand-paced, one at a time, priced past
  // the current build-out so they never grind back-to-back. Provisional
  // tuning; goal capacity is the first named beat.
  longGoalFirstCost: number;
  longGoalGrowthNumerator: bigint;
  longGoalGrowthDenominator: bigint;
  goalSlotsPerLongGoal: number;
  goalBaseSlots: number;
  forgeInitialThreshold: number;
  forgeThresholdGrowth: number;
  // The focus-keyed generator's bank ratio (§2.3): each session end banks a
  // charge window of fraction × live practice seconds. Provisional tuning.
  chargeWindowFraction: number;
}

// Provisional tuning throughout; the redesign spec's numbers are not final
// until the tuning fronts land.
export const BALANCE: Balance = {
  carrierRate: 0.1,
  additiveRate: 0.05,
  conditionalRate: 0.05,
  conditionalPairBonus: 0.1,
  pairBonus: 0.1,
  infusorBonus: 0.2,
  achievementBoostPerFeat: 0.02,
  upgradeFirstCost: 10,
  upgradeCostGrowthNumerator: 8n,
  upgradeCostGrowthDenominator: 5n,
  rarityPower: { common: 1.2, uncommon: 1.25, rare: 1.3 },
  rarityProbability: { common: 0.99, uncommon: 0.009, rare: 0.001 },
  shelfPrices: { generator: 40, additive: 40, infusor: 40, forge: 80 },
  cellFirstCost: 30,
  cellCostGrowthNumerator: 5n,
  cellCostGrowthDenominator: 2n,
  ladderFirstCost: 25,
  ladderGrowthNumerator: 5n,
  ladderGrowthDenominator: 2n,
  longGoalFirstCost: 500,
  longGoalGrowthNumerator: 5n,
  longGoalGrowthDenominator: 1n,
  goalSlotsPerLongGoal: 2,
  goalBaseSlots: 2,
  forgeInitialThreshold: 60,
  forgeThresholdGrowth: 1.5,
  chargeWindowFraction: 0.1,
};

// The launch chord vocabulary (§4, issue #29): consecutive-pitch runs,
// recognized over free-floating connected clusters. A named chord's term
// replaces its member pairs' bonuses; overlapping named chords (a 4·5·6·7
// run) stack multiplicatively. The consecutive-run law makes the textbook
// minor triad 10:12:15 geometrically impossible; 5:6:7 is the minor-ish run.
export interface NamedChordDef {
  name: string;
  pitches: number[];
  bonus: number;
}

export const NAMED_CHORDS: readonly NamedChordDef[] = [
  { name: "Octave", pitches: [1, 2], bonus: 0.15 },
  { name: "Fifth", pitches: [2, 3], bonus: 0.3 },
  { name: "Major triad", pitches: [4, 5, 6], bonus: 0.5 },
  { name: "Blues triad", pitches: [5, 6, 7], bonus: 0.75 },
];

// The target chime (focus-tool spec §4–5): one synthesized just-intonation
// two-note motif — the chord vocabulary's Fifth (2:3) — with each note
// carrying a quiet 3× partial from the same ratio ladder. Fixed quiet gain,
// no volume setting. All numbers are tuning, not spec.
export const CHIME = {
  // The just-intonation interval between the motif's two notes (the Fifth).
  fifthRatio: 3 / 2,
  // The root note's frequency (C5).
  rootHz: 523.25,
  // Fixed quiet gain; the partial sits beneath it.
  gain: 0.12,
  partialGain: 0.04,
  // Per-note envelope: attack, decay length, and the gap before note two.
  attackSeconds: 0.02,
  noteSeconds: 1.1,
  onsetGapSeconds: 0.28,
  // Hidden re-fires (§4): at most once per wall-clock minute, capped at
  // three chimes total per overrun.
  refireSeconds: 60,
  maxChimes: 3,
};

export const CATEGORY_OF: Record<ModuleType, Category> = {
  carrier: "synthesizer",
  additive: "synthesizer",
  conditional: "synthesizer",
  focusKeyed: "generator",
  infusor: "infusor",
  forge: "forge",
};

// Chargeable is a supertype family above the category level (ADR-0012): its
// members accumulate received charge toward a threshold. The Forge is the
// sole launch instance. Continuous-charge categories use received charge as
// continuous empowerment instead. Membership is decided per category —
// never per type.
export const CHARGEABLE_CATEGORIES: readonly Category[] = ["forge"];

export const CONTINUOUS_CHARGE_CATEGORIES: readonly Category[] = ["synthesizer", "infusor"];

// The union of the two families: the categories that receive charge at all.
export const CHARGE_RECEIVING_CATEGORIES: readonly Category[] = [
  ...CHARGEABLE_CATEGORIES,
  ...CONTINUOUS_CHARGE_CATEGORIES,
];

export const MODULE_TYPES: readonly ModuleType[] = [
  "carrier",
  "additive",
  "conditional",
  "focusKeyed",
  "infusor",
  "forge",
];

// The Carrier is granted, never rolled (§2.1); everything else can come from
// the Forge.
export const ROLL_POOL: readonly ModuleType[] = MODULE_TYPES.filter((type) => type !== "carrier");

// The starter shelf (§3, ADR-0018): one-time offers completing the category
// landscape — plus the additive synth, so chord play exists before the first
// roll. The shelf's "generator" offer is the focus-keyed generator.
export const SHELF_TYPES: readonly ShelfType[] = ["generator", "additive", "infusor", "forge"];

// What module a shelf offer grants: the "generator" key predates the basic
// generator's retirement (ADR-0018) and stays the save's shelf key.
export const SHELF_MODULE: Record<ShelfType, ModuleType> = {
  additive: "additive",
  generator: "focusKeyed",
  infusor: "infusor",
  forge: "forge",
};

export const NEXT_RARITY: Record<Rarity, Rarity | null> = { common: "uncommon", uncommon: "rare", rare: null };

export const EPS = 1e-9;

// The reconciliation floor (focus-tool spec §1): absences below it
// auto-credit silently on both modes — nous banks, time credits, no report,
// never joins the pool. Provisional tuning (~3 minutes). Supersedes the
// retired 120 s confirm-or-discard threshold (ADR-0019).
export const RECONCILIATION_FLOOR_SECONDS = 180;

// The summary reflection's slider (focus-tool spec §8): five positions,
// rough ↔ great, the middle neutral and the default. Decided shape, not
// tuning; the render reads both so the range and its default stay paired.
export const REFLECTION_SLIDER_POSITIONS = 5;
export const REFLECTION_SLIDER_NEUTRAL = 3;

export const SAVE_VERSION = 5;
