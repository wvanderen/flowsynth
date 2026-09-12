import type { CoreType, ModuleType, Rarity, StarterType } from "./types";

export interface Balance {
  baseRate: number;
  timeBonus: number;
  additiveRate: number;
  conditionalBonusPerActiveCore: number;
  infusorBonus: number;
  chargeSecondsPerPracticeSecond: number;
  upgradeFirstCost: number;
  upgradeCostGrowthNumerator: bigint;
  upgradeCostGrowthDenominator: bigint;
  rarityPower: Record<Rarity, number>;
  rarityProbability: Record<Rarity, number>;
  starterPrices: Record<StarterType, number>;
  forgeInitialThreshold: number;
  forgeThresholdGrowth: number;
  expansionInitialThreshold: number;
  expansionThresholdGrowth: number;
}

export const BALANCE: Balance = {
  baseRate: 0.1,
  timeBonus: 0.2,
  additiveRate: 0.05,
  conditionalBonusPerActiveCore: 0.1,
  infusorBonus: 0.2,
  chargeSecondsPerPracticeSecond: 0.1,
  upgradeFirstCost: 10,
  upgradeCostGrowthNumerator: 8n,
  upgradeCostGrowthDenominator: 5n,
  rarityPower: { common: 1.2, uncommon: 1.25, rare: 1.3 },
  rarityProbability: { common: 0.99, uncommon: 0.009, rare: 0.001 },
  starterPrices: { additive: 40, conditional: 60, infusor: 40, forge: 80, expander: 80 },
  forgeInitialThreshold: 60,
  forgeThresholdGrowth: 1.5,
  expansionInitialThreshold: 60,
  expansionThresholdGrowth: 2,
};

export const CORE_TYPES: readonly CoreType[] = ["enter", "time", "habit", "notes", "goals", "tasks"];

export const GAMEPLAY_TYPES: readonly StarterType[] = ["additive", "conditional", "infusor", "forge", "expander"];

export const ROLL_POOL: readonly ModuleType[] = ["enter", "time", "additive", "conditional", "infusor", "forge", "expander"];

export const NEXT_RARITY: Record<Rarity, Rarity | null> = { common: "uncommon", uncommon: "rare", rare: null };

export const EPS = 1e-9;

export const RECONCILIATION_THRESHOLD_SECONDS = 120;

export const SAVE_VERSION = 1;
