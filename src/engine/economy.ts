import { BALANCE, CATEGORY_OF, CHARGE_RECEIVING_CATEGORIES, EPS } from "./constants";
import { analyzeChords, pitchOf } from "./chords";
import { achievementBoostOf } from "./achievements";
import { adjacent } from "./hex";
import type { Contribution, DeployedModule, GameState, ModuleInstance, ModuleType, RateSnapshot, SynthesizerType } from "./types";

export function chargedFactor(strength: number): number {
  return 1 + strength / (1 + strength);
}

export function levelCost(level: number): number {
  if (level < 0) throw new Error("level must be non-negative");
  const numerator = BigInt(BALANCE.upgradeFirstCost) * BALANCE.upgradeCostGrowthNumerator ** BigInt(level);
  const denominator = BALANCE.upgradeCostGrowthDenominator ** BigInt(level);
  return Number((numerator + denominator - 1n) / denominator);
}

// The shared pricing shape (ADR-0013): a geometric scaler charged in whole
// nous, ceiling-exact like level costs — the cell scaler, the activation
// ladder, and the console long goals all ride this one curve.
function geometricCeilCost(firstCost: number, numerator: bigint, denominator: bigint, steps: number): number {
  const n = BigInt(steps);
  const num = BigInt(firstCost) * numerator ** n;
  const den = denominator ** n;
  return Number((num + den - 1n) / den);
}

// The cell price (ADR-0013): a steep geometric scaler over total cells
// bought — always charged in whole nous, ceiling-exact like level costs.
export function cellCost(cellsBought: number): number {
  if (cellsBought < 0) throw new Error("cellsBought must be non-negative");
  return geometricCeilCost(BALANCE.cellFirstCost, BALANCE.cellCostGrowthNumerator, BALANCE.cellCostGrowthDenominator, cellsBought);
}

// The activation ladder (ADR-0013): a shared geometric scaler over rungs
// bought — each later rung costs more no matter which app it opens. The
// ladder rests empty at launch (ADR-0019): the scaler's shape stands, and
// its pricing is decided with the ladder's first tenant.
export function rungCost(rung: number): number {
  if (rung < 1) throw new Error("rung must be positive");
  return geometricCeilCost(BALANCE.ladderFirstCost, BALANCE.ladderGrowthNumerator, BALANCE.ladderGrowthDenominator, rung - 1);
}

// Console long goals (ADR-0012): each purchase of a named beat prices the
// next one past the current build-out, so the beat stays hand-paced and
// never grinds back-to-back. Ceiling-exact whole nous, like every price.
export function longGoalCost(bought: number): number {
  if (bought < 0) throw new Error("bought must be non-negative");
  return geometricCeilCost(BALANCE.longGoalFirstCost, BALANCE.longGoalGrowthNumerator, BALANCE.longGoalGrowthDenominator, bought);
}

export function investment(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += levelCost(i);
  return total;
}

// The facts a magnitude question needs — a deployed module, an inventory
// tile, and a forge-roll candidate all carry them.
export type ModuleSpec = Pick<ModuleInstance, "type" | "rarity" | "level">;

export function modulePower(module: Pick<ModuleInstance, "rarity" | "level">): number {
  return BALANCE.rarityPower[module.rarity] ** module.level;
}

export function deployed(state: GameState): ModuleInstance[] {
  return state.modules.filter((m) => m.pos !== null);
}

// The sole charge-source category (ADR-0012): only generators emit charge.
export function isSource(module: Pick<ModuleInstance, "type">): boolean {
  return CATEGORY_OF[module.type] === "generator";
}

export function deployedGenerators(state: GameState): ModuleInstance[] {
  return deployed(state).filter(isSource);
}

export function findModule(state: GameState, id: string): ModuleInstance | undefined {
  return state.modules.find((m) => m.id === id);
}

export function deployedAt(state: GameState, pos: { q: number; r: number }): ModuleInstance | undefined {
  return state.modules.find((m) => m.pos !== null && m.pos.q === pos.q && m.pos.r === pos.r);
}

export function wholeNous(state: GameState): number {
  return Math.floor(state.nous + EPS);
}

// Whether any module is actually receiving charge in this snapshot — the
// Spark trigger and the popover's read of it. Charge exists only live in
// flow, so a flow-gated snapshot answers for itself.
export function chargeDelivered(snapshot: RateSnapshot): boolean {
  for (const strength of snapshot.chargeStrength.values()) {
    if (strength > 0) return true;
  }
  return false;
}

// Charge exists only while flow is live: board production is session-bound.
export function flowLive(state: GameState): boolean {
  return state.mode === "flow";
}

// The charge window is live while banked time remains (§2.3, ADR-0012): the
// focus-keyed generator emits and the window drains only under this rule.
export function chargeWindowActive(state: GameState): boolean {
  return state.chargeWindow > 0;
}

// A generator's charge output: strength scales with its amplitude (level and
// rarity). Only generators produce charge (§2.3 boundary rule), and the
// launch generator is the focus-keyed one (ADR-0018): it spends the banked
// charge window, emitting at full strength only while window time remains,
// spending a second of window per second of live flow (the
// remaining-duration vocabulary).
export function emittedStrength(state: GameState, module: ModuleInstance, flow: boolean): number {
  if (!flow || !isSource(module) || module.pos === null) return 0;
  if (!chargeWindowActive(state)) return 0;
  return modulePower(module);
}

// Received charge: the sum of adjacent deployed generators' output.
// Generators never charge themselves or each other; only the chargeable and
// continuous-charge categories receive.
export function receivedStrength(state: GameState, module: ModuleInstance, flow: boolean): number {
  if (!CHARGE_RECEIVING_CATEGORIES.includes(CATEGORY_OF[module.type]) || module.pos === null) return 0;
  let strength = 0;
  for (const generator of deployedGenerators(state)) {
    if (generator.pos !== null && adjacent(module.pos, generator.pos)) {
      strength += emittedStrength(state, generator, flow);
    }
  }
  return strength;
}

function infusorBonusAt(state: GameState, module: ModuleInstance, flow: boolean): number {
  if (module.pos === null) return 0;
  let total = 0;
  for (const other of deployed(state)) {
    if (CATEGORY_OF[other.type] !== "infusor" || other.pos === null) continue;
    if (!adjacent(module.pos, other.pos)) continue;
    const strength = receivedStrength(state, other, flow);
    total += BALANCE.infusorBonus * modulePower(other) * chargedFactor(strength);
  }
  return total;
}

function isSynthesizer(type: ModuleType): type is SynthesizerType {
  return CATEGORY_OF[type] === "synthesizer";
}

const SYNTH_BASE_RATE: Record<SynthesizerType, number> = {
  carrier: BALANCE.carrierRate,
  additive: BALANCE.additiveRate,
  conditional: BALANCE.conditionalRate,
};

// What one module of this type contributes at its power, in the type's own
// units (ADR-0004's readable roles): synthesizers their harmonic ν/s, the
// generator its output strength, an infusor its bonus fraction, the Forge
// its progress-per-received-strength. Charge empowers receivers
// (synthesizers, infusors) through the same chargedFactor the live snapshot
// uses; sources and the Forge ride modulePower alone. The UI's module
// lexicon takes every per-type magnitude it shows from this one place.
export function nominalContribution(module: ModuleSpec, strength = 0): number {
  const power = modulePower(module);
  switch (module.type) {
    case "carrier":
    case "additive":
    case "conditional":
      return SYNTH_BASE_RATE[module.type] * power * chargedFactor(strength);
    case "infusor":
      return BALANCE.infusorBonus * power * chargedFactor(strength);
    case "focusKeyed":
    case "forge":
      return power;
    default:
      return 0;
  }
}

// The additive-synthesis rate (ADR-0014):
//   rate      = composite × empowerment × achievementBoost
//   composite = (carrier + Σ harmonic terms) × Π chord terms
// Amplitude inputs are unchanged: level and rarity set amplitude, infusors
// add local bonuses, charge empowers per-module with the diminishing-returns
// curve, and a Conditional's per-pair bonus rides in its own harmonic term.
// The carrier and harmonic legs stay uncharged so charge aggregates into the
// snapshot's empowerment leg and the breakdown multiplies out exactly.
// Generators, the Forge meter, and cells are out of the formula, and there
// is no session stage: the board is the whole production (§4).
export function computeRates(state: GameState, flow: boolean = flowLive(state)): RateSnapshot {
  const contributions = new Map<string, Contribution>();
  const chargeStrength = new Map<string, number>();

  // Pass one: per-module charge, local infusor bonuses, and amplitude; forge
  // progress. Deployed synthesizers are collected for the chord pass.
  interface SynthInfo {
    module: DeployedModule;
    kind: SynthesizerType;
    amplitude: number;
    chargeFactor: number;
    strength: number;
    localBonus: number;
  }
  const synths: SynthInfo[] = [];
  let forgeRate = 0;

  for (const module of deployed(state)) {
    const strength = receivedStrength(state, module, flow);
    chargeStrength.set(module.id, strength);
    const localBonus = infusorBonusAt(state, module, flow);
    const chargeFactor = chargedFactor(strength);
    const amplitude = modulePower(module) * (1 + localBonus);
    if (isSynthesizer(module.type) && module.pos !== null) {
      synths.push({ module: { ...module, pos: module.pos }, kind: module.type, amplitude, chargeFactor, strength, localBonus });
      continue;
    }
    let value = 0;
    if (module.type === "forge") {
      value = strength * modulePower(module);
      forgeRate += value;
    }
    contributions.set(module.id, {
      moduleId: module.id,
      type: module.type,
      pitch: null,
      amplitude,
      value,
      chordTerms: 0,
      infusorBonus: localBonus,
      chargeFactor,
      chargeStrength: strength,
    });
  }

  // Pass two: chord pairs and named chords over the deployed synthesizers.
  const analysis = analyzeChords(synths.map(({ module }) => module));

  // Pass three: harmonic terms. A Conditional is amplitude plus a bonus per
  // chord pair it participates in; an Additive is the plain harmonic term.
  let carrier = 0;
  let harmonics = 0;
  let chargedSum = 0;
  for (const { module, kind, amplitude, chargeFactor, strength, localBonus } of synths) {
    const pitch = pitchOf(module.pos);
    const chordTerms = analysis.participation.get(module.id) ?? 0;
    const chordAmp = kind === "conditional" ? 1 + BALANCE.conditionalPairBonus * chordTerms : 1;
    const uncharged = SYNTH_BASE_RATE[kind] * amplitude * chordAmp;
    const charged = uncharged * chargeFactor;
    if (kind === "carrier") carrier += uncharged;
    else harmonics += uncharged;
    chargedSum += charged;
    contributions.set(module.id, {
      moduleId: module.id,
      type: kind,
      pitch,
      amplitude,
      value: charged,
      chordTerms,
      infusorBonus: localBonus,
      chargeFactor,
      chargeStrength: strength,
    });
  }

  const achievementBoost = achievementBoostOf(state);
  const amplitude = carrier + harmonics;
  const composite = amplitude * analysis.multiplier;
  // The boost multiplies the rate on top of charge empowerment; the
  // empowerment leg divides it back out so the breakdown multiplies out
  // exactly: rate = composite × empowerment × achievementBoost.
  const rate = chargedSum * analysis.multiplier * achievementBoost;
  const empowerment = composite > EPS ? rate / (composite * achievementBoost) : 1;

  return {
    carrier,
    harmonics,
    amplitude,
    chordMultiplier: analysis.multiplier,
    pairs: analysis.pairs,
    namedChords: analysis.namedChords,
    composite,
    empowerment,
    achievementBoost,
    rate,
    forgeRate,
    contributions,
    chargeStrength,
  };
}
