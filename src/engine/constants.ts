import type { Category, ModuleType, Rarity, ShelfType } from "./types";

export interface Balance {
  // One unified synthesizer base rate (ADR-0022): every synthesizer shares
  // it, scaled by rarityPower^level. The carrier/harmonics split dies with
  // the distinction it served. Provisional tuning.
  synthRate: number;
  // The Conditional's bonus (ADR-0022): +10% per named-chord instance it
  // belongs to (constant: tuning).
  conditionalChordBonus: number;
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
  // Cells (ADR-0013): direct nous purchases on a geometric scaler over
  // total cells bought. Provisional tuning.
  cellFirstCost: number;
  cellCostGrowthNumerator: bigint;
  cellCostGrowthDenominator: bigint;
  // The octave-row gate (ADR-0022): a one-time premium on the first
  // purchase into each new octave row, escalating with row distance from
  // the start register. The fifths axis is ungated, gate spend never
  // advances the cell scaler, and moving owned cells between rows is free.
  // Provisional tuning.
  rowGateFirstCost: number;
  rowGateGrowthNumerator: bigint;
  rowGateGrowthDenominator: bigint;
  // How many octave rows sit above and below the start register: rows are
  // finite, generous, and symmetric around it (count: tuning).
  octaveRows: number;
  // How many columns the board spans: the fifths axis walks a twelve-note
  // circle, and the pitch kernel repeats every twelve columns — bounding
  // them keeps each note appearing exactly once per octave row. The axis
  // stays ungated; only the cell scaler prices it.
  fifthsColumns: number;
  // The opening grant (ADR-0022): affords — but no longer exactly equals —
  // the first upgrade of the pre-placed synthesizer. Provisional tuning.
  openingGrant: number;
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
  synthRate: 0.1,
  conditionalChordBonus: 0.1,
  infusorBonus: 0.2,
  achievementBoostPerFeat: 0.02,
  upgradeFirstCost: 10,
  upgradeCostGrowthNumerator: 8n,
  upgradeCostGrowthDenominator: 5n,
  rarityPower: { common: 1.2, uncommon: 1.25, rare: 1.3 },
  rarityProbability: { common: 0.99, uncommon: 0.009, rare: 0.001 },
  shelfPrices: { generator: 40, infusor: 40, forge: 80 },
  cellFirstCost: 30,
  cellCostGrowthNumerator: 5n,
  cellCostGrowthDenominator: 2n,
  rowGateFirstCost: 60,
  rowGateGrowthNumerator: 2n,
  rowGateGrowthDenominator: 1n,
  octaveRows: 4,
  fifthsColumns: 12,
  openingGrant: 12,
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

// The launch chord vocabulary (ADR-0021/0022): register-free pitch sets —
// interval classes above the root, mod 12, with multiplicity (the Octave is
// two voices of the same class). Recognition is by pitch content over a
// connected cluster: any voicing, any octave. Bonus tiers track the spacer
// ladder's construction cost — a ♭7 costs one wire cell, m3/M6 two, M3/m6
// three — so harder chords cost more board and earn bigger multipliers
// (tiers: tuning).
export interface NamedChordDef {
  name: string;
  intervals: number[];
  bonus: number;
}

export const NAMED_CHORDS: readonly NamedChordDef[] = [
  { name: "Octave", intervals: [0, 0], bonus: 0.15 },
  { name: "Fifth", intervals: [0, 7], bonus: 0.3 },
  { name: "Flat seventh", intervals: [0, 10], bonus: 0.45 },
  { name: "Minor triad", intervals: [0, 3, 7], bonus: 0.6 },
  { name: "Major triad", intervals: [0, 4, 7], bonus: 0.75 },
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
  additive: "synthesizer",
  conditional: "synthesizer",
  spacer: "spacer",
  focusKeyed: "generator",
  infusor: "infusor",
  forge: "forge",
};

// Chargeable is a supertype family above the category level (ADR-0012): its
// members accumulate received charge toward a threshold. The Forge is the
// sole launch instance. Continuous-charge categories use received charge as
// continuous empowerment instead. Membership is decided per category —
// never per type. The spacer receives nothing: it is silent wire.
export const CHARGEABLE_CATEGORIES: readonly Category[] = ["forge"];

export const CONTINUOUS_CHARGE_CATEGORIES: readonly Category[] = ["synthesizer", "infusor"];

// The union of the two families: the categories that receive charge at all.
export const CHARGE_RECEIVING_CATEGORIES: readonly Category[] = [
  ...CHARGEABLE_CATEGORIES,
  ...CONTINUOUS_CHARGE_CATEGORIES,
];

export const MODULE_TYPES: readonly ModuleType[] = [
  "additive",
  "conditional",
  "spacer",
  "focusKeyed",
  "infusor",
  "forge",
];

// The forge roll pool (ADR-0022): every module type rolls — no module is
// granted or privileged anymore, and the spacer ships through rolls only,
// never the shelf.
export const ROLL_POOL: readonly ModuleType[] = MODULE_TYPES;

// The starter shelf (ADR-0022): one-time offers completing the
// non-synthesizer landscape — the generator, one infusor, and the Forge.
// Synthesizers come only from the opening grant and forge rolls.
export const SHELF_TYPES: readonly ShelfType[] = ["generator", "infusor", "forge"];

// What module a shelf offer grants: the "generator" key predates the basic
// generator's retirement (ADR-0018) and stays the save's shelf key.
export const SHELF_MODULE: Record<ShelfType, ModuleType> = {
  generator: "focusKeyed",
  infusor: "infusor",
  forge: "forge",
};

export const NEXT_RARITY: Record<Rarity, Rarity | null> = { common: "uncommon", uncommon: "rare", rare: null };

export const EPS = 1e-9;

// The dual-clock drift noise floor (focus-tool spec §1): Date.now() reads
// whole milliseconds while performance.now() reads finer, so the measured
// drift jitters by a millisecond or two across every boundary even when
// both clocks run true, while real sleeps and rollbacks move the drift by
// seconds. The floor sits an order of magnitude above the jitter and far
// below any real sleep or rollback: a step inside it is measurement noise,
// not drift — its boundary credits its wall gap whole and sizes no sleep.
export const DRIFT_NOISE_SECONDS = 0.05;

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

// ADR-0023: SAVE_VERSION 6 — the carrierless board. V5 saves convert once
// inside deserialize (hybrid migration: the life record carries over, the
// board resets to the new opening); anything older, and any future version,
// hard-rejects with the start-fresh message (ADR-0017's gate stands).
export const SAVE_VERSION = 6;
