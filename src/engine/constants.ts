import type { Category, ModuleType, Rarity, ShelfType } from "./types";

export interface Balance {
  carrierRate: number;
  additiveRate: number;
  conditionalRate: number;
  infusorBonus: number;
  upgradeFirstCost: number;
  upgradeCostGrowthNumerator: bigint;
  upgradeCostGrowthDenominator: bigint;
  rarityPower: Record<Rarity, number>;
  rarityProbability: Record<Rarity, number>;
  shelfPrices: Record<ShelfType, number>;
  goalBaseSlots: number;
  forgeInitialThreshold: number;
  forgeThresholdGrowth: number;
}

// Provisional tuning throughout; the redesign spec's numbers are not final
// until the tuning fronts land.
export const BALANCE: Balance = {
  carrierRate: 0.1,
  additiveRate: 0.05,
  conditionalRate: 0.05,
  infusorBonus: 0.2,
  upgradeFirstCost: 10,
  upgradeCostGrowthNumerator: 8n,
  upgradeCostGrowthDenominator: 5n,
  rarityPower: { common: 1.2, uncommon: 1.25, rare: 1.3 },
  rarityProbability: { common: 0.99, uncommon: 0.009, rare: 0.001 },
  shelfPrices: { generator: 40, infusor: 40, forge: 80 },
  goalBaseSlots: 2,
  forgeInitialThreshold: 60,
  forgeThresholdGrowth: 1.5,
};

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
