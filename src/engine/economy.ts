import { BALANCE, CATEGORY_OF, CHARGE_RECEIVING_CATEGORIES, EPS } from "./constants";
import { analyzeChords } from "./chords";
import { achievementBoostOf } from "./achievements";
import { adjacent } from "./hex";
import { octaveRowOf, pitchOf } from "./lattice";
import type { Contribution, DeployedModule, GameState, ModuleInstance, ModuleType, RateSnapshot } from "./types";

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

// The octave-row gate premium (ADR-0022): a one-time cost on the first
// purchase into each new octave row, escalating with the row's distance
// from the start register. Charged on top of the cell price; it never
// advances the purchase scaler, and reshaping between rows never meets it.
export function rowGateCost(row: number): number {
  const distance = Math.abs(row);
  if (distance < 1) return 0;
  return geometricCeilCost(BALANCE.rowGateFirstCost, BALANCE.rowGateGrowthNumerator, BALANCE.rowGateGrowthDenominator, distance - 1);
}

// Whether a purchase into `row` still owes its one-time gate: the ledger
// holds every row whose premium is paid — the opening's rows by grant, the
// rest by purchase. Movement never consults this (ADR-0022: gates tax
// acquisition only), which is exactly why the ledger, not the board's
// current shape, is the truth.
export function rowGateOwed(state: GameState, row: number): boolean {
  return !state.gatedRows.includes(row);
}

// The one price for a new cell at `pos` (ADR-0013 + ADR-0022): the scaler
// price plus the row's one-time gate premium when still owed. The single
// seam — the buy action charges exactly this and the board's frontier hexes
// quote exactly this, so the displayed price cannot drift from the charged
// one.
export function cellPurchasePrice(state: GameState, pos: { q: number; r: number }): number {
  const row = octaveRowOf(pos);
  const gate = rowGateOwed(state, row) ? rowGateCost(row) : 0;
  return cellCost(state.cellsBought) + gate;
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

// The deployed synthesizers and spacers — the two categories that conduct
// chords (ADR-0021). One partition for the achievements' chord read, so it
// filters exactly as the rate pass does.
export function deployedConductors(state: GameState): { synths: DeployedModule[]; spacers: DeployedModule[] } {
  const synths: DeployedModule[] = [];
  const spacers: DeployedModule[] = [];
  for (const module of deployed(state)) {
    if (module.pos === null) continue;
    const pos = module.pos;
    if (isSynthesizer(module.type)) synths.push({ ...module, pos });
    else if (module.type === "spacer") spacers.push({ ...module, pos });
  }
  return { synths, spacers };
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
  if (!flow || CATEGORY_OF[module.type] !== "generator" || module.pos === null) return 0;
  if (!chargeWindowActive(state)) return 0;
  return modulePower(module);
}

// Received charge: the sum of adjacent deployed generators' output.
// Generators never charge themselves or each other; only the chargeable and
// continuous-charge categories receive. The spacer receives nothing — it is
// silent wire.
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

function isSynthesizer(type: ModuleType): boolean {
  return CATEGORY_OF[type] === "synthesizer";
}

// The unified rate (ADR-0021/0022; leg naming per ADR-0020 as amended by
// ADR-0022):
//   rate      = (synths + infusor uplift) × Π chord terms × empowerment × achievementBoost
//   composite = (synths + infusor uplift) × Π chord terms
// Every synthesizer shares one base rate scaled by rarityPower^level — one
// unified leg, no carrier/harmonics split — with the infusor uplift split
// into its own additive leg so the breakdown names it. Both stay uncharged
// so charge aggregates into the snapshot's empowerment leg and the
// breakdown multiplies out exactly. A Conditional rides its own term with a
// bonus per chord instance it belongs to; the spacer contributes nothing
// and never sounds. Generators, the Forge meter, and cells are out of the
// formula, and there is no session stage: the board is the whole production
// (§4).
export function computeRates(state: GameState, flow: boolean = flowLive(state)): RateSnapshot {
  const contributions = new Map<string, Contribution>();
  const chargeStrength = new Map<string, number>();

  // Pass one: per-module charge, local infusor bonuses, and amplitude; forge
  // progress. Deployed synthesizers and spacers are collected for the chord
  // pass.
  interface SynthInfo {
    module: DeployedModule;
    power: number;
    chargeFactor: number;
    strength: number;
    localBonus: number;
  }
  const synths: SynthInfo[] = [];
  const spacers: DeployedModule[] = [];
  let forgeRate = 0;

  for (const deployedModule of deployed(state)) {
    const strength = receivedStrength(state, deployedModule, flow);
    chargeStrength.set(deployedModule.id, strength);
    const localBonus = infusorBonusAt(state, deployedModule, flow);
    const chargeFactor = chargedFactor(strength);
    const amplitude = modulePower(deployedModule) * (1 + localBonus);
    if (isSynthesizer(deployedModule.type) && deployedModule.pos !== null) {
      const pos = deployedModule.pos;
      synths.push({ module: { ...deployedModule, pos }, power: modulePower(deployedModule), chargeFactor, strength, localBonus });
      continue;
    }
    if (deployedModule.type === "spacer" && deployedModule.pos !== null) {
      spacers.push({ ...deployedModule, pos: deployedModule.pos });
    }
    let value = 0;
    if (deployedModule.type === "forge") {
      value = strength * modulePower(deployedModule);
      forgeRate += value;
    }
    contributions.set(deployedModule.id, {
      moduleId: deployedModule.id,
      type: deployedModule.type,
      pitch: null,
      // The spacer never sounds: no amplitude, no value — only the wire it
      // conducts in the chord pass.
      amplitude: deployedModule.type === "spacer" ? 0 : amplitude,
      value,
      chordTerms: 0,
      infusorBonus: deployedModule.type === "spacer" ? 0 : localBonus,
      chargeFactor,
      chargeStrength: strength,
    });
  }

  // Pass two: pitch-set chords over the connected synthesizer-and-spacer
  // clusters — the spacer conducts adjacency, never joins a pitch set. The
  // partitions come straight from pass one's walk: one filter, never two
  // that can drift.
  const analysis = analyzeChords(synths.map(({ module }) => module), spacers);

  // Pass three: the unified synths leg. A Conditional is its base term plus
  // a bonus for every chord instance it belongs to; every other
  // synthesizer is the plain term. The leg splits into the synths' base and
  // the infusors' uplift so the breakdown can name both; the split sums
  // back to the full amplitude.
  let synthsLeg = 0;
  let infusors = 0;
  let chargedSum = 0;
  for (const { module, power, chargeFactor, strength, localBonus } of synths) {
    const pitch = pitchOf(module.pos);
    const chordTerms = analysis.participation.get(module.id) ?? 0;
    const chordAmp = module.type === "conditional" ? 1 + BALANCE.conditionalChordBonus * chordTerms : 1;
    const base = BALANCE.synthRate * power * chordAmp;
    const uncharged = base * (1 + localBonus);
    const charged = uncharged * chargeFactor;
    synthsLeg += base;
    infusors += base * localBonus;
    chargedSum += charged;
    contributions.set(module.id, {
      moduleId: module.id,
      type: module.type,
      pitch,
      amplitude: power * (1 + localBonus),
      value: charged,
      chordTerms,
      infusorBonus: localBonus,
      chargeFactor,
      chargeStrength: strength,
    });
  }

  const achievementBoost = achievementBoostOf(state);
  const amplitude = synthsLeg + infusors;
  const composite = amplitude * analysis.multiplier;
  // The boost multiplies the rate on top of charge empowerment; the
  // empowerment leg divides it back out so the breakdown multiplies out
  // exactly: rate = composite × empowerment × achievementBoost.
  const rate = chargedSum * analysis.multiplier * achievementBoost;
  const empowerment = composite > EPS ? rate / (composite * achievementBoost) : 1;

  return {
    synths: synthsLeg,
    infusors,
    amplitude,
    chordMultiplier: analysis.multiplier,
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
