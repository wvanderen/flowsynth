import type { Category, ModuleType, MutatorFamily, Rarity, ShelfType } from "./types";

export interface Balance {
  // One unified oscillator base rate (ADR-0022): every oscillator shares
  // it, scaled by rarityPower^level. The carrier/harmonics split dies with
  // the distinction it served. Provisional tuning.
  synthRate: number;
  infusorBonus: number;
  // ── Harmony quality (ADR-0049): Q = clamp(1 + complexity − max(0,
  // tension − A), Qmin, cap) over the formation's deduplicated pitch
  // classes. All magnitudes provisional tuning per the map's standing note.
  // Pair-based symbolic tension by interval class: semitone 1.0, whole tone
  // 0.2, tritone 0.5; thirds and fifths weigh nothing.
  tensionWeights: Readonly<Record<number, number>>;
  // Linear complexity per distinct class past the first.
  complexityRate: number;
  // The tension allowance A forgiven to named formations before the clamp.
  tensionAllowance: number;
  // The floor — materially below neutral, so chromatic density is priced
  // down — and the cap above neutral.
  qualityFloor: number;
  qualityCap: number;
  // ── Roster tuning (ADR-0048): the silent-voice category trait is a
  // level-scaled uplift to every chord instance's bonus a silent voice
  // sings in, additive across silent voices, landing on all singing
  // members.
  silentVoiceUpliftPerLevel: number;
  // The Amplifier re-broadcasts received charge at received strength × a
  // level-scaled gain; a hop-depth cap guards relay cycles.
  amplifierGainPerLevel: number;
  amplifierHopCap: number;
  // RITUAL's amplification (ADR-0046, wave 4): each deployed RITUAL
  // receiving charge adds this much per level into the raw amplification
  // that scales the active habit's equipped build magnitudes — continuous
  // with received strength (the charged-empowerment curve), zero when
  // uncharged. Provisional tuning.
  ritualAmpPerLevel: number;
  // The Bend's selectable shift set grows with rarity only (±1 at launch;
  // ±2 joins at rare — each further step at the next rarity, tuning).
  bendShifts: Record<Rarity, readonly number[]>;
  // The Bend's mint default (the ♯, ADR-0048) and the load default for a
  // pre-roster module.
  bendDefaultShift: number;
  // ADR-0015's global achievement term: each unlocked feat adds this much
  // into the boost, additively (boost = 1 + feats × per-feat). Nous-rate
  // only. Provisional tuning (~+2% each).
  achievementBoostPerFeat: number;
  // The chord library's discovery bonus (#218, issue #230): each discovered
  // class adds this much into its own permanent global leg, riding every
  // oscillator's final value beside the achievements boost. Provisional
  // tuning (~+1% each).
  discoveryBonusPerClass: number;
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
  // The launch band (ADR-0022 as bounded by ADR-0040/0044, issue #197):
  // the octave rows the launch board opens — this many above and below the
  // start register, its own rows paid by the opening grant. The Row unlock
  // sells one further row per side at Arete; the board caps at six octave
  // rows this phase (count: tuning).
  launchRowsAbove: number;
  launchRowsBelow: number;
  // The Arete Catalog's Arete prices (ADR-0040 as amended by ADR-0044,
  // issue #197); the break's price is ADR-0042's (issue #200). Provisional
  // tuning.
  catalogEntryCost: number;
  rollPoolJoinCost: number;
  horizonBreakCost: number;
  // The broken claim's hard cap (ADR-0042, issue #200): one juiced era
  // banks no more than this, and past the ceiling resets bank it until
  // future work raises it. Pre-break the cap never bites. Provisional
  // tuning.
  horizonBreakClaimCap: number;
  // The Row unlock's escalating ladder (ADR-0044): the nth unlock costs
  // rowUnlockCosts[n], either order. Past the ladder's end the board is at
  // its six-row cap and nothing more unlocks.
  rowUnlockCosts: readonly number[];
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
  // Console long goals (ADR-0012 as amended by ADR-0034, issue #150): each
  // purchase adds one goal slot and reveals the next price, much steeper —
  // the price is the pacing, so successive purchases are fine when
  // affordable. Provisional tuning; goal capacity is the first named beat.
  longGoalFirstCost: number;
  longGoalGrowthNumerator: bigint;
  longGoalGrowthDenominator: bigint;
  goalBaseSlots: number;
  forgeInitialThreshold: number;
  forgeThresholdGrowth: number;
  // The Mutator Forge branch (ADR-0043, issue #198): ADR-0009's shared-meter
  // pattern on its own constants — growth ≈×2, steeper than the module
  // branch's ×1.5 — paced so the first mutator roll lands within the first
  // post-entry era. Charge-only; no practice leg (ADR-0041). Provisional
  // tuning.
  mutatorForgeInitialThreshold: number;
  mutatorForgeThresholdGrowth: number;
  // The mutator families' base magnitudes (ADR-0043): the effect multiplies
  // its term by (1 + magnitude), and rarity scales the base ×1/×2/×4 across
  // the shared common/uncommon/rare tiers. Provisional tuning.
  mutatorMagnitudeBase: Record<MutatorFamily, number>;
  mutatorRarityMultiplier: Record<Rarity, number>;
  // The slot ladder's base (ADR-0043): the nth unlock past the entry's
  // free first slot costs first + (n-1)n/2 Arete — the 2/3/5/8/12 shape,
  // unbounded. Provisional tuning.
  mutatorSlotFirstCost: number;
  // The flow meter (ADR-0041): credited practice seconds fill it directly —
  // the fill is measured in seconds, no rate leg. The opening threshold
  // crosses once fast so the opening still teaches the loop (≈ 3 minutes,
  // tuning 2–5), then every later crossing sits one flat cadence block out
  // — one module roll per ≈ 30 credited minutes, forever, never scaling.
  flowOpeningSeconds: number;
  flowCadenceSeconds: number;
  // The focus-keyed generator's bank ratio (§2.3): each session end banks a
  // charge window of fraction × live practice seconds. Provisional tuning.
  chargeWindowFraction: number;
}

// Provisional tuning throughout; the redesign spec's numbers are not final
// until the tuning fronts land.
export const BALANCE: Balance = {
  synthRate: 0.1,
  infusorBonus: 0.2,
  tensionWeights: { 1: 1.0, 2: 0.2, 3: 0, 4: 0, 5: 0, 6: 0.5 },
  complexityRate: 0.06,
  tensionAllowance: 0.7,
  qualityFloor: 0.05,
  qualityCap: 1.25,
  silentVoiceUpliftPerLevel: 0.05,
  amplifierGainPerLevel: 0.2,
  amplifierHopCap: 4,
  ritualAmpPerLevel: 0.1,
  bendShifts: { common: [-1, 1], uncommon: [-1, 1], rare: [-2, -1, 1, 2] },
  bendDefaultShift: 1,
  achievementBoostPerFeat: 0.02,
  discoveryBonusPerClass: 0.01,
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
  launchRowsAbove: 2,
  launchRowsBelow: 1,
  catalogEntryCost: 1,
  rollPoolJoinCost: 5,
  horizonBreakCost: 10,
  horizonBreakClaimCap: 25,
  rowUnlockCosts: [1, 2],
  fifthsColumns: 12,
  openingGrant: 12,
  ladderFirstCost: 25,
  ladderGrowthNumerator: 5n,
  ladderGrowthDenominator: 2n,
  longGoalFirstCost: 500,
  longGoalGrowthNumerator: 5n,
  longGoalGrowthDenominator: 1n,
  goalBaseSlots: 2,
  forgeInitialThreshold: 60,
  forgeThresholdGrowth: 1.5,
  mutatorForgeInitialThreshold: 240,
  mutatorForgeThresholdGrowth: 2,
  mutatorMagnitudeBase: { power: 0.5, resonance: 0.5, charge: 0.5 },
  mutatorRarityMultiplier: { common: 1, uncommon: 2, rare: 4 },
  mutatorSlotFirstCost: 2,
  flowOpeningSeconds: 180,
  flowCadenceSeconds: 1800,
  chargeWindowFraction: 0.1,
};

// The chord vocabulary (#218's eleven classes, ADR-0021/0022 as extended by
// ADR-0048/0049): register-free pitch sets — interval classes above the
// root, mod 12, with multiplicity (the Octave is two voices of the same
// class). Recognition is by pitch content over a connected formation: any
// voicing, any octave. Bonus tiers track the wire ladder's construction
// cost — a ♭7 costs one wire cell, m3/M6 two, M3/m6 three — and the six
// new classes ride the tuning table's tiers (all magnitudes: tuning).
// Bend ±1 content landing in these recipes earns named value; anything
// outside bears tension only.
export interface NamedChordDef {
  name: string;
  intervals: number[];
  bonus: number;
}

export const NAMED_CHORDS: readonly NamedChordDef[] = [
  { name: "Octave", intervals: [0, 0], bonus: 0.15 },
  { name: "Fifth", intervals: [0, 7], bonus: 0.3 },
  { name: "Flat seventh", intervals: [0, 10], bonus: 0.45 },
  { name: "Suspended fourth", intervals: [0, 5, 7], bonus: 0.55 },
  { name: "Minor triad", intervals: [0, 3, 7], bonus: 0.6 },
  { name: "Diminished triad", intervals: [0, 3, 6], bonus: 0.65 },
  { name: "Augmented triad", intervals: [0, 4, 8], bonus: 0.65 },
  { name: "Major triad", intervals: [0, 4, 7], bonus: 0.75 },
  { name: "Minor seventh", intervals: [0, 3, 7, 10], bonus: 0.9 },
  { name: "Dominant seventh", intervals: [0, 4, 7, 10], bonus: 0.95 },
  { name: "Major seventh", intervals: [0, 4, 7, 11], bonus: 1.05 },
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

// The category of every module type (ADR-0048's roster on ADR-0012's
// landscape): oscillators and the Blaster sing; the Harmonizer, Echo, and
// Bend are the silent voices; the Amplifier founds the charge conduit;
// RITUAL is the habit-keyed category of one (ADR-0046) — the chargeable
// family's continuous-empowerment member, wearing the switch vermillion.
export const CATEGORY_OF: Record<ModuleType, Category> = {
  additive: "oscillator",
  blaster: "oscillator",
  harmonizer: "silentVoice",
  echo: "silentVoice",
  bend: "silentVoice",
  amplifier: "conduit",
  ritual: "ritual",
  spacer: "spacer",
  focusKeyed: "generator",
  infusor: "booster",
  forge: "forge",
  // The Mutator Forge is the Forge family's second branch (ADR-0043): the
  // same chargeable category, its own meter. Membership is decided per
  // category, never per type.
  mutatorForge: "forge",
};

// The one oscillator test, shared by the rate pass, the roll rig, and the
// arc's acquisition count — one predicate, never three that can drift.
export function isOscillatorType(type: ModuleType): boolean {
  return CATEGORY_OF[type] === "oscillator";
}

// The one singer test (ADR-0048): oscillators and silent voices sing into
// formations — every other category never joins a pitch set. One predicate
// for the rate pass, the partition, and the UI's conductor checks.
export function isVoiceType(type: ModuleType): boolean {
  const category = CATEGORY_OF[type];
  return category === "oscillator" || category === "silentVoice";
}

// Chargeable is a supertype family above the category level (ADR-0012): its
// members accumulate received charge toward a threshold. The Forge is the
// launch instance. Continuous-charge categories use received charge as
// continuous empowerment instead. Membership is decided per category —
// never per type. The spacer receives nothing: it is silent wire; the
// silent voices sing unamplified — their uplift keys off level alone; the
// conduit routes what it receives rather than spending it on itself; and
// RITUAL (ADR-0046) is the habit-keyed continuous member — its received
// charge never fills a threshold, it scales the active build's
// amplification.
export const CHARGEABLE_CATEGORIES: readonly Category[] = ["forge"];

export const CONTINUOUS_CHARGE_CATEGORIES: readonly Category[] = ["oscillator", "booster", "ritual"];

// The union of the two families plus the conduit: the categories that
// receive charge at all.
export const CHARGE_RECEIVING_CATEGORIES: readonly Category[] = [
  ...CHARGEABLE_CATEGORIES,
  ...CONTINUOUS_CHARGE_CATEGORIES,
  "conduit",
];

export const MODULE_TYPES: readonly ModuleType[] = [
  "additive",
  "blaster",
  "harmonizer",
  "echo",
  "bend",
  "amplifier",
  "ritual",
  "spacer",
  "focusKeyed",
  "infusor",
  "forge",
];

// The forge roll pool (ADR-0022): every module type rolls — no module is
// granted or privileged anymore, and the spacer ships through rolls only,
// never the shelf. The Mutator Forge type stands outside it until the
// Mutator tree's roll-pool purchase appends it (ADR-0043) — one uniform,
// unweighted entry, read per state in rolls.ts.
export const ROLL_POOL: readonly ModuleType[] = MODULE_TYPES;

// The Mutator Forge type's pool entry, appended when the roll-pool join is
// owned (ADR-0043): the purchase buys membership, nothing else.
export const POOL_JOIN_TYPE: ModuleType = "mutatorForge";

// The launch mutator families (ADR-0043), uniform in mutator rolls.
export const MUTATOR_FAMILIES: readonly MutatorFamily[] = ["power", "resonance", "charge"];

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

// ADR-0017's pattern at the v8 boundary (issue #229, the iteration's one
// migration): SAVE_VERSION 8 — the roster cut. V7 saves migrate in place
// (the Conditional becomes its Harmonizer, the charge window generalizes to
// per-module reserves, the chord discovery ledger defaults empty, and the
// build-node unlocks derive from habit.seconds — waves 3–5 build on these
// surfaces with no further bump); anything older rejects with the
// start-fresh message, and there is no migration chain past one step.
export const SAVE_VERSION = 8;
