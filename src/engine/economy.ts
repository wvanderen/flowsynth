import { BALANCE, CATEGORY_OF, CHARGE_RECEIVING_CATEGORIES, EPS } from "./constants";
import { analyzeChords, pitchOf } from "./chords";
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

export function investment(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += levelCost(i);
  return total;
}

export function modulePower(module: ModuleInstance): number {
  return BALANCE.rarityPower[module.rarity] ** module.level;
}

export function deployed(state: GameState): ModuleInstance[] {
  return state.modules.filter((m) => m.pos !== null);
}

export function deployedGenerators(state: GameState): ModuleInstance[] {
  return deployed(state).filter((m) => CATEGORY_OF[m.type] === "generator");
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

// Charge exists only while flow is live: board production is session-bound.
export function flowLive(state: GameState): boolean {
  return state.mode === "flow";
}

// A generator's charge output: strength scales with its amplitude (level and
// rarity). Only generators produce charge (§2.3 boundary rule).
export function emittedStrength(module: ModuleInstance, flow: boolean): number {
  if (!flow || CATEGORY_OF[module.type] !== "generator" || module.pos === null) return 0;
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
      strength += emittedStrength(generator, flow);
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

  const achievementBoost = BALANCE.achievementBoost;
  const amplitude = carrier + harmonics;
  const composite = amplitude * analysis.multiplier;
  const rate = chargedSum * analysis.multiplier;
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
