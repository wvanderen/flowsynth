import { BALANCE, CATEGORY_OF, CHARGE_RECEIVING_CATEGORIES, EPS, isSynthesizerType } from "./constants";
import { analyzeChords } from "./chords";
import { achievementBoostOf } from "./achievements";
import { adjacent, sameHex } from "./hex";
import { octaveRowOf, pitchOf } from "./lattice";
import type { Contribution, DeployedModule, GameState, Hex, ModuleInstance, MutatorFamily, MutatorInstance, Rarity, RateSnapshot } from "./types";

export function chargedFactor(strength: number): number {
  return 1 + strength / (1 + strength);
}

// A mutator's magnitude (ADR-0043, issue #198): the family's base scaled
// by the one geometric rarity rule — ×1/×2/×4 across the shared
// common/uncommon/rare tiers. The effect multiplies its term by
// (1 + magnitude).
export function mutatorMagnitude(family: MutatorFamily, rarity: Rarity): number {
  return BALANCE.mutatorMagnitudeBase[family] * BALANCE.mutatorRarityMultiplier[rarity];
}

// The cell's placed mutator, if any — the Mutator Grid mirrors the board
// cell for cell, and a slot modifies whatever module occupies the cell.
export function mutatorAt(state: GameState, pos: Hex | null): MutatorInstance | undefined {
  if (pos === null) return undefined;
  return state.mutators.find((m) => m.pos !== null && sameHex(m.pos, pos));
}

function familyMagnitudeAt(state: GameState, pos: Hex | null, family: MutatorFamily): number {
  const mutator = mutatorAt(state, pos);
  return mutator && mutator.family === family ? mutatorMagnitude(family, mutator.rarity) : 0;
}

function powerMagnitudeAt(state: GameState, pos: Hex | null): number {
  return familyMagnitudeAt(state, pos, "power");
}

function resonanceMagnitudeAt(state: GameState, pos: Hex | null): number {
  return familyMagnitudeAt(state, pos, "resonance");
}

function chargeMagnitudeAt(state: GameState, pos: Hex | null): number {
  return familyMagnitudeAt(state, pos, "charge");
}

// The host's effective power (ADR-0043): a placed power mutator multiplies
// its host module's power (× (1 + m)) everywhere power already appears —
// the synthesizer's final ν/s, the uplift an infusor grants, a generator's
// output strength, and Forge progress. A Mutator Forge boosting its own
// branch is intended, not a bug. A tray module or a vacant slot: ×1.
export function hostPower(state: GameState, module: ModuleInstance): number {
  return modulePower(module) * (1 + powerMagnitudeAt(state, module.pos));
}

export function levelCost(level: number): number {
  if (level < 0) throw new Error("level must be non-negative");
  const numerator = BigInt(BALANCE.upgradeFirstCost) * BALANCE.upgradeCostGrowthNumerator ** BigInt(level);
  const denominator = BALANCE.upgradeCostGrowthDenominator ** BigInt(level);
  return Number((numerator + denominator - 1n) / denominator);
}

// The bulk ladder's price (issue #195): k consecutive levels from `fromLevel`
// sum the one-level curve exactly — the bulk actions charge these same
// per-level prices one at a time, so preview and charge can never drift.
export function levelsCost(fromLevel: number, count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += levelCost(fromLevel + i);
  return total;
}

// How many whole-nous levels a budget buys from `fromLevel` — the MAX
// reading of the ladder. The growth curve outgrows any finite budget, so
// the count is naturally bounded; the cap only keeps a pathological bank
// from spinning the loop.
const AFFORDABLE_LEVEL_CAP = 500;

export function affordableLevels(nous: number, fromLevel: number): number {
  let count = 0;
  let spent = 0;
  while (count < AFFORDABLE_LEVEL_CAP) {
    const next = levelCost(fromLevel + count);
    if (spent + next > nous) break;
    spent += next;
    count++;
  }
  return count;
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

// The Mutator slot ladder (ADR-0043, issue #198): unbounded, per-item
// priced — each unlock costs the count already unlocked's rung on the
// 2/3/5/8/12 shape, continuing +1,+2,+3,… forever: first + (n-1)n/2 Arete.
// The entry's own first slot never meets this price — it rides the entry.
export function mutatorSlotCost(unlocked: number): number {
  if (unlocked < 1) throw new Error("unlocked must be positive");
  return BALANCE.mutatorSlotFirstCost + ((unlocked - 1) * unlocked) / 2;
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
    if (isSynthesizerType(module.type)) synths.push({ ...module, pos });
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
  return hostPower(state, module);
}

// Received charge: the sum of adjacent deployed generators' output. A
// charge mutator on the host's cell multiplies the strength it receives
// (× (1 + m)) before the diminishing charge curve — inert while uncharged,
// since zero strength stays zero. Generators never charge themselves or
// each other; only the chargeable and continuous-charge categories
// receive. The spacer receives nothing — it is silent wire.
export function receivedStrength(state: GameState, module: ModuleInstance, flow: boolean): number {
  if (!CHARGE_RECEIVING_CATEGORIES.includes(CATEGORY_OF[module.type]) || module.pos === null) return 0;
  let strength = 0;
  for (const generator of deployedGenerators(state)) {
    if (generator.pos !== null && adjacent(module.pos, generator.pos)) {
      strength += emittedStrength(state, generator, flow);
    }
  }
  return strength * (1 + chargeMagnitudeAt(state, module.pos));
}

function infusorBonusAt(state: GameState, module: ModuleInstance, flow: boolean): number {
  if (module.pos === null) return 0;
  let total = 0;
  for (const other of deployed(state)) {
    if (CATEGORY_OF[other.type] !== "infusor" || other.pos === null) continue;
    if (!adjacent(module.pos, other.pos)) continue;
    const strength = receivedStrength(state, other, flow);
    total += BALANCE.infusorBonus * hostPower(state, other) * chargedFactor(strength);
  }
  return total;
}

// The unified rate (ADR-0021/0022 as amended by ADR-0036; leg naming per
// ADR-0020): every effect lands on the synthesizer it touches, and the
// board's rate is the sum of the modules' final figures:
//   value(s)  = synthRate·power·chordAmp·chordFactor·(1+infusor)·chargeFactor·achievementBoost
//   rate      = Σ value(s) = (synths + infusors) × empowerment × achievementBoost
// Every synthesizer shares one base rate scaled by rarityPower^level — one
// unified leg, no carrier/harmonics split. Chords are local (ADR-0036):
// each instance multiplies only its member voices, so chordFactor rides the
// synthesizer's own term and the synths/infusor legs carry it. Both legs
// stay uncharged so charge aggregates into the snapshot's empowerment leg
// and the breakdown multiplies out exactly. A Conditional keeps its own
// per-chord-instance bonus (ADR-0022) on top of the local chord factor; the
// spacer contributes nothing and never sounds. Generators, the Forge meter,
// and cells are out of the formula, and there is no session stage: the
// board is the whole production (§4).
export function computeRates(state: GameState, flow: boolean = flowLive(state)): RateSnapshot {
  const contributions = new Map<string, Contribution>();
  const chargeStrength = new Map<string, number>();
  const achievementBoost = achievementBoostOf(state);

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
  let mutatorForgeRate = 0;

  for (const deployedModule of deployed(state)) {
    const strength = receivedStrength(state, deployedModule, flow);
    chargeStrength.set(deployedModule.id, strength);
    const localBonus = infusorBonusAt(state, deployedModule, flow);
    const chargeFactor = chargedFactor(strength);
    const power = hostPower(state, deployedModule);
    const amplitude = power * (1 + localBonus);
    if (isSynthesizerType(deployedModule.type) && deployedModule.pos !== null) {
      const pos = deployedModule.pos;
      synths.push({ module: { ...deployedModule, pos }, power, chargeFactor, strength, localBonus });
      continue;
    }
    if (deployedModule.type === "spacer" && deployedModule.pos !== null) {
      spacers.push({ ...deployedModule, pos: deployedModule.pos });
    }
    let value = 0;
    if (CATEGORY_OF[deployedModule.type] === "forge") {
      // The Forge family's two branches (ADR-0043): the Module Forge feeds
      // its shared meter, the Mutator Forge its own — same strength × power
      // shape, so a power mutator boosting a Mutator Forge boosts its own
      // branch, and a charge mutator rides the strength it receives.
      value = strength * power;
      if (deployedModule.type === "mutatorForge") mutatorForgeRate += value;
      else forgeRate += value;
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
      // Non-synthesizers never chord: no terms, no local factor — null,
      // not 0, so no reader mistakes them for a multiplied-out voice.
      chordFactor: null,
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

  // Pass three: the unified synths leg. Chords are local (ADR-0036): each
  // synthesizer carries its own chordFactor — the product of every chord
  // instance it sings in — and a Conditional adds its per-instance bonus
  // (ADR-0022) on top. The leg splits into the synths' base and the
  // infusors' uplift so the breakdown can name both; the split sums back to
  // the full amplitude. Each module's value is its final ν/s — charge and
  // the achievement boost included — so displayed figures sum to the rate.
  let synthsLeg = 0;
  let infusors = 0;
  let rate = 0;
  for (const { module, power, chargeFactor, strength, localBonus } of synths) {
    const pitch = pitchOf(module.pos);
    const chordTerms = analysis.participation.get(module.id) ?? 0;
    // The resonance mutator multiplies its host's chord factor (× (1 + m),
    // ADR-0043) — scaling with chord investment, inert on a chordless host:
    // no instances, nothing to amplify. The Conditional's per-instance
    // bonus (ADR-0022) is untouched — chordAmp stays outside the fold.
    const rawChordFactor = analysis.voiceMultiplier.get(module.id) ?? 1;
    const chordFactor = chordTerms > 0 ? rawChordFactor * (1 + resonanceMagnitudeAt(state, module.pos)) : rawChordFactor;
    const chordAmp = module.type === "conditional" ? 1 + BALANCE.conditionalChordBonus * chordTerms : 1;
    const base = BALANCE.synthRate * power * chordAmp * chordFactor;
    const value = base * (1 + localBonus) * chargeFactor * achievementBoost;
    synthsLeg += base;
    infusors += base * localBonus;
    rate += value;
    contributions.set(module.id, {
      moduleId: module.id,
      type: module.type,
      pitch,
      amplitude: power * (1 + localBonus),
      value,
      chordTerms,
      chordFactor,
      infusorBonus: localBonus,
      chargeFactor,
      chargeStrength: strength,
    });
  }

  const amplitude = synthsLeg + infusors;
  // The boost multiplies every module's final value; the empowerment leg
  // divides it back out so the breakdown multiplies out exactly:
  // rate = (synths + infusors) × empowerment × achievementBoost.
  const empowerment = amplitude > EPS ? rate / (amplitude * achievementBoost) : 1;

  return {
    synths: synthsLeg,
    infusors,
    amplitude,
    namedChords: analysis.namedChords,
    empowerment,
    achievementBoost,
    rate,
    forgeRate,
    mutatorForgeRate,
    contributions,
    chargeStrength,
  };
}
