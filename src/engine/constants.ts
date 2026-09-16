import type { Category, ModuleType, Rarity, ShelfType } from "./types";

export interface Balance {
  carrierRate: number;
  additiveRate: number;
  conditionalRate: number;
  conditionalPairBonus: number;
  pairBonus: number;
  infusorBonus: number;
  achievementBoost: number;
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
  // ADR-0015's global achievement term: unity until achievements land.
  achievementBoost: 1,
  upgradeFirstCost: 10,
  upgradeCostGrowthNumerator: 8n,
  upgradeCostGrowthDenominator: 5n,
  rarityPower: { common: 1.2, uncommon: 1.25, rare: 1.3 },
  rarityProbability: { common: 0.99, uncommon: 0.009, rare: 0.001 },
  shelfPrices: { generator: 40, infusor: 40, forge: 80 },
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

export const CATEGORY_OF: Record<ModuleType, Category> = {
  carrier: "synthesizer",
  additive: "synthesizer",
  conditional: "synthesizer",
  generator: "generator",
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
  "generator",
  "focusKeyed",
  "infusor",
  "forge",
];

// The Carrier is granted, never rolled (§2.1); everything else can come from
// the Forge.
export const ROLL_POOL: readonly ModuleType[] = MODULE_TYPES.filter((type) => type !== "carrier");

// The starter shelf (§3): one-time offers completing the category landscape.
export const SHELF_TYPES: readonly ShelfType[] = ["forge", "generator", "infusor"];

export const NEXT_RARITY: Record<Rarity, Rarity | null> = { common: "uncommon", uncommon: "rare", rare: null };

export const EPS = 1e-9;

export const RECONCILIATION_THRESHOLD_SECONDS = 120;

export const SAVE_VERSION = 5;
