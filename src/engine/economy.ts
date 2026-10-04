import { BALANCE, CATEGORY_OF, CHARGE_RECEIVING_CATEGORIES, EPS, isVoiceType } from "./constants";
import { analyzeChords, partitionVoices, type Singer } from "./chords";
import { achievementBoostOf } from "./achievements";
import { activeHabit } from "./habits";
import { baseBuildFactors, amplifyFactors } from "./builds";
import { discoveryBoostOf } from "./library";
import { adjacent, sameHex } from "./hex";
import { octaveRowOf } from "./lattice";
import type { Contribution, DeployedModule, GameState, Hex, ModuleInstance, MutatorFamily, MutatorInstance, Rarity, RateSnapshot } from "./types";

export function chargedFactor(strength: number): number {
  return 1 + strength / (1 + strength);
}

// The Blaster's conversion curve (ADR-0048): the charged-empowerment
// curve's delta promoted to the whole factor — ×0 uncharged (the uncharged
// Blaster sings in chords at zero output), ×1 at the asymptote. It
// replaces the charge factor entirely: no second empowerment pass.
export function blasterConversion(strength: number): number {
  return strength / (1 + strength);
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
// the oscillator's final ν/s, the uplift a booster grants, a generator's
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

// The deployed voices and conducting spacers — the formation's two parts
// (ADR-0048): oscillators and silent voices sing, each at its derived
// pitch; spacers conduct without singing. One partition for the
// achievements' chord read, so it filters exactly as the rate pass does.
export function deployedVoices(state: GameState): { singers: Singer[]; spacers: DeployedModule[] } {
  return partitionVoices(deployed(state).map((m) => ({ ...m, pos: m.pos! })));
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

// Raw generator output into one cell: the sum of adjacent deployed
// generators' output — generators never divide output among neighbors.
// The steady-conduit build node (ADR-0046) adds its flat +1 per emitting
// generator; the bonus threads through the relay net so every consumer of
// charge reads the same strengths.
function generatorStrengthAt(state: GameState, pos: Hex, flow: boolean, steadyBonus: number): number {
  let strength = 0;
  for (const generator of deployedGenerators(state)) {
    if (generator.pos !== null && adjacent(pos, generator.pos)) {
      strength += emittedStrength(state, generator, flow, steadyBonus);
    }
  }
  return strength;
}

// The amplifier relay net (ADR-0048): each amplifier receives from
// adjacent generators and from adjacent amplifiers of strictly lower hop
// depth, re-broadcasting at received × its level-scaled gain. The
// hop-depth cap bounds the chain — an amplifier beyond it relays nothing,
// which is what guards cycles (equal depths never feed each other).
interface RelayNet {
  // Amplifier id → generators + lower amplifiers' relays, with the
  // host's charge mutator applied.
  received: Map<string, number>;
  // Amplifier id → its re-broadcast strength (received × gain).
  relay: Map<string, number>;
}

function relayNet(state: GameState, flow: boolean, steadyBonus: number): RelayNet {
  const amplifiers = deployed(state).filter((m) => m.type === "amplifier");
  const received = new Map<string, number>();
  const relay = new Map<string, number>();
  const depth = new Map<string, number>();
  // Empty generators cannot anchor a relay depth: they must not cut off
  // charge arriving through an emitting generator's longer path.
  let frontier = amplifiers.filter((amp) =>
    deployedGenerators(state).some((g) => emittedStrength(state, g, flow, steadyBonus) > 0 && adjacent(amp.pos!, g.pos!)),
  );
  let level = 1;
  while (frontier.length > 0 && level <= BALANCE.amplifierHopCap) {
    const next: ModuleInstance[] = [];
    for (const amp of frontier) {
      depth.set(amp.id, level);
      let strength = generatorStrengthAt(state, amp.pos!, flow, steadyBonus);
      for (const other of amplifiers) {
        if (depth.get(other.id) === level - 1 && adjacent(amp.pos!, other.pos!)) {
          strength += relay.get(other.id) ?? 0;
        }
      }
      strength *= 1 + chargeMagnitudeAt(state, amp.pos);
      received.set(amp.id, strength);
      relay.set(amp.id, strength * (1 + BALANCE.amplifierGainPerLevel * amp.level));
    }
    for (const amp of amplifiers) {
      if (depth.has(amp.id)) continue;
      if (frontier.some((f) => adjacent(f.pos!, amp.pos!))) next.push(amp);
    }
    frontier = next;
    level++;
  }
  return { received, relay };
}

// One deployed RITUAL's own amplification contribution (ADR-0046): its
// level-scaled base through the charged-empowerment curve of the strength
// it receives — the face readout and the bloom's contribution line share
// this one read with the rate pass. Zero while uncharged.
export function ritualAmpOf(level: number, strength: number): number {
  return BALANCE.ritualAmpPerLevel * level * chargedFactor(strength);
}

// Read RITUAL against the base charge network once, then amplify delivery.
// This prevents Steady conduit feeding its own amplification recursively.
function ritualAmplificationFor(state: GameState, flow: boolean): number {
  const build = baseBuildFactors(activeHabit(state));
  const placed = deployed(state);
  const net = relayNet(state, flow, build.generatorStrength);
  let amplification = 0;
  for (const module of placed) {
    if (module.type === "ritual") {
      const strength = receivedOn(state, module, flow, placed, net, build.generatorStrength);
      if (strength > 0) amplification += ritualAmpOf(module.level, strength);
    }
  }
  return amplification * (1 + build.ritualAttunement);
}

export function activeBuildGeneratorStrength(state: GameState, flow = flowLive(state)): number {
  const base = baseBuildFactors(activeHabit(state)).generatorStrength;
  return base === 0 ? 0 : base * (1 + ritualAmplificationFor(state, flow));
}

// A generator's charge output: strength scales with its amplitude (level
// and rarity), plus the steady-conduit build node's flat +1 when the
// active habit equips it (ADR-0046 — output strength is the node's whole
// effect). Only generators produce charge (§2.3 boundary rule), and the
// family is the three keyed types (ADR-0047): the focus, note, and goal
// generators each spend their own banked reserve, emitting at full
// strength only while reserve seconds remain, spending a second of
// reserve per second of live flow (the remaining-duration vocabulary).
// Undeployed, it produces no output and the reserve holds. Level, rarity,
// and mutators scale this strength only — banked duration is flat, never
// double-counted.
// The `steadyBonus` default is the ambient active-build read — by
// construction the same amplified figure the rate pass threads through
// the relay net, so a UI caller
// omitting it can never disagree with the pass.
export function emittedStrength(state: GameState, module: ModuleInstance, flow: boolean, steadyBonus: number = activeBuildGeneratorStrength(state, flow)): number {
  if (!flow || CATEGORY_OF[module.type] !== "generator" || module.pos === null) return 0;
  if (module.reserve <= EPS) return 0;
  return hostPower(state, module) + steadyBonus;
}

// The charge a module receives, read off a relay net — the one shared read
// for the rate pass and the public seam below.
function receivedOn(
  state: GameState,
  module: ModuleInstance,
  flow: boolean,
  placed: ModuleInstance[],
  net: RelayNet,
  steadyBonus: number,
): number {
  if (module.pos === null || !CHARGE_RECEIVING_CATEGORIES.includes(CATEGORY_OF[module.type])) return 0;
  if (module.type === "amplifier") {
    // Its own received: what the relay pass credited it — generators plus
    // strictly-lower-depth relays — before its re-broadcast gain.
    return net.received.get(module.id) ?? 0;
  }
  let strength = generatorStrengthAt(state, module.pos, flow, steadyBonus);
  for (const amplifier of placed) {
    if (amplifier.type !== "amplifier") continue;
    const out = net.relay.get(amplifier.id);
    if (out !== undefined && adjacent(module.pos, amplifier.pos!)) strength += out;
  }
  return strength * (1 + chargeMagnitudeAt(state, module.pos));
}

// Received charge: adjacent generators' output plus every relaying
// amplifier's re-broadcast — relayed charge counts fully as receiving
// charge everywhere (empowerment, Forge thresholds, RITUAL, build
// effects). A charge mutator on the host's cell multiplies the strength it
// receives (× (1 + m)) before any curve — inert while uncharged, since
// zero strength stays zero. Generators never charge themselves or each
// other, amplifiers never feed generators, and only the receiving
// categories receive. The spacer receives nothing — it is silent wire.
export function receivedStrength(state: GameState, module: ModuleInstance, flow: boolean): number {
  const bonus = activeBuildGeneratorStrength(state, flow);
  return receivedOn(state, module, flow, deployed(state), relayNet(state, flow, bonus), bonus);
}

function infusorBonusAt(
  state: GameState,
  module: ModuleInstance,
  flow: boolean,
  placed: ModuleInstance[],
  net: RelayNet,
  steadyBonus: number,
): number {
  if (module.pos === null) return 0;
  let total = 0;
  for (const other of placed) {
    if (CATEGORY_OF[other.type] !== "booster" || other.pos === null) continue;
    if (!adjacent(module.pos, other.pos)) continue;
    total += BALANCE.infusorBonus * hostPower(state, other) * chargedFactor(receivedOn(state, other, flow, placed, net, steadyBonus));
  }
  return total;
}

// The unified rate (ADR-0021/0022 as amended by ADR-0036, ADR-0048, and
// ADR-0049; leg naming per ADR-0020): every effect lands on the producer
// it touches, and the board's rate is the sum of the modules' final
// figures:
//   value(s)  = synthRate·power·chordFactor·(1+infusor)·charge·achievementBoost·discoveryBoost
//   rate      = Σ value(s) = (synths + boosters) × empowerment × achievementBoost × discoveryBoost
// Every oscillator shares one base rate scaled by rarityPower^level — one
// unified leg, no carrier/harmonics split. Chords are local (ADR-0036):
// the formation's named instance product × its quality Q (ADR-0049) rides
// each member's own term, and the Blaster's charge conversion replaces its
// charge factor (no second empowerment pass — the conversion is the
// charge). Both legs stay uncharged so additive charge aggregates into the
// snapshot's empowerment leg and the breakdown multiplies out exactly; the
// Blaster's converted term rides the synths leg by construction. Silent
// voices, spacers, and conduits contribute nothing — the conduit routes
// charge onward, the silent voices sweeten the chords they sing in.
// Generators, the Forge meters, and cells are out of the formula, and
// there is no session stage: the board is the whole production (§4).
export function computeRates(state: GameState, flow: boolean = flowLive(state)): RateSnapshot {
  const contributions = new Map<string, Contribution>();
  const chargeStrength = new Map<string, number>();
  const build = baseBuildFactors(activeHabit(state));
  const rawAmplification = ritualAmplificationFor(state, flow);
  const factors = amplifyFactors(build, rawAmplification);
  const net = relayNet(state, flow, factors.generatorStrength);
  const placed = deployed(state) as DeployedModule[];
  const strengthOf = (module: ModuleInstance): number => receivedOn(state, module, flow, placed, net, factors.generatorStrength);

  const achievementBoost = achievementBoostOf(state) * (1 + factors.achievementBoost);
  const discoveryBoost = discoveryBoostOf(state);

  // The formation's partition — one derivation of every derived pitch,
  // shared by the contributions and the chord pass below.
  const { singers, spacers } = partitionVoices(placed);
  const pitchById = new Map(singers.map(({ module, pitch }) => [module.id, pitch]));

  // Pass one: per-module charge, local booster bonuses, and amplitude;
  // forge progress. Deployed voices and spacers are collected for the
  // chord pass, each voice with its derived pitch (ADR-0048).
  interface VoiceInfo {
    module: DeployedModule;
    power: number;
    chargeTerm: number;
    strength: number;
    localBonus: number;
    // The derived pitch the voice sings — null when it sings nothing (an
    // Echo with no adjacent voice).
    pitch: number | null;
  }
  const voices: VoiceInfo[] = [];
  let forgeRate = 0;
  let mutatorForgeRate = 0;

  for (const deployedModule of placed) {
    const pos = deployedModule.pos;
    if (pos === null) continue;
    const strength = strengthOf(deployedModule);
    chargeStrength.set(deployedModule.id, strength);
    const power = hostPower(state, deployedModule);
    const category = CATEGORY_OF[deployedModule.type];
    if (isVoiceType(deployedModule.type)) {
      // The steady-hand node (ADR-0046) scales the booster uplift the
      // oscillator reads — the active build's touch on the booster leg.
      const localBonus = category === "silentVoice" ? 0 : infusorBonusAt(state, deployedModule, flow, placed, net, factors.generatorStrength) * (1 + factors.boosterUplift);
      // The charge term each producer applies: the additive's charged
      // empowerment, or the Blaster's conversion — the curve that replaces
      // the charge factor (ADR-0048). The silent voice sings nothing of
      // its own, so it takes neither.
      const chargeTerm = category === "silentVoice" ? 1 : deployedModule.type === "blaster" ? blasterConversion(strength) : chargedFactor(strength);
      voices.push({
        module: { ...deployedModule, pos },
        power,
        chargeTerm,
        strength,
        localBonus,
        pitch: pitchById.get(deployedModule.id) ?? null,
      });
      continue;
    }
    let value = 0;
    if (category === "forge") {
      // The Forge family's two branches (ADR-0043): the Module Forge feeds
      // its shared meter, the Mutator Forge its own — same strength × power
      // shape, so a power mutator boosting a Mutator Forge boosts its own
      // branch, and a charge mutator rides the strength it receives. The
      // Forge-hand nodes (ADR-0046) scale the progress efficiency of both
      // branches — Forge progress is the family-wide meter's diet.
      value = strength * power * (1 + factors.forgeEfficiency);
      if (deployedModule.type === "mutatorForge") mutatorForgeRate += value;
      else forgeRate += value;
    }
    contributions.set(deployedModule.id, {
      moduleId: deployedModule.id,
      type: deployedModule.type,
      pitch: null,
      // Silent modules never sound into the amplitude: the spacer is wire,
      // the silent voices sing only into the chord pass, the conduit only
      // routes.
      amplitude: 0,
      value,
      chordTerms: 0,
      // The spacer and the conduit never chord — null, not 0, so no reader
      // mistakes them for a multiplied-out voice. The silent voices carry
      // their display factor from the chord pass below.
      chordFactor: null,
      formationQ: 1,
      infusorBonus: 0,
      chargeFactor: chargedFactor(strength),
      chargeStrength: strength,
    });
  }

  // Pass two: pitch-set chords over the connected formations — the spacer
  // conducts adjacency, never joins a pitch set; the silent voices sing
  // their derived pitches and count in the quality's read. The pitch-ear
  // and deep-practice nodes (ADR-0046) scale every named instance's bonus;
  // the formation quality and the silent-voice uplift are untouched — the
  // chord-touching levers stayed with the harmony contracts.
  const analysis = analyzeChords(singers, spacers, 1 + factors.namedChordBonus);

  // Pass three: the unified synths leg. Chords are local (ADR-0036): each
  // oscillator carries its own chordFactor — the formation's named product
  // × its quality Q (ADR-0049) — and the resonance mutator multiplies the
  // whole chord factor including Q (ADR-0043), inert on a chordless host.
  // The leg splits into the synths' base and the boosters' uplift so the
  // breakdown can name both; the split sums back to the full amplitude.
  // Each module's value is its final ν/s — charge and the achievement
  // boost included — so displayed figures sum to the rate.
  let synthsLeg = 0;
  let boosters = 0;
  let rate = 0;
  for (const { module, power, chargeTerm, strength, localBonus, pitch } of voices) {
    const silent = CATEGORY_OF[module.type] === "silentVoice";
    const chordTerms = analysis.participation.get(module.id) ?? 0;
    const rawChordFactor = analysis.voiceMultiplier.get(module.id) ?? 1;
    const formationQ = analysis.formationQ.get(module.id) ?? 1;
    const named = analysis.namedFormation.get(module.id) === true;
    // The resonance mutator multiplies the whole chord factor including Q
    // (ADR-0043 as carried by ADR-0049) — scaling with chord investment,
    // inert on a chordless host: no named formation, nothing to amplify.
    const chordFactor = named ? rawChordFactor * (1 + resonanceMagnitudeAt(state, module.pos)) : rawChordFactor;
    // The Weights nodes (ADR-0046) scale the synth term — the unified leg
    // every oscillator contributes, Blaster's conversion included.
    const base = BALANCE.synthRate * power * (silent ? 0 : chordFactor) * (1 + factors.synthTerm);
    // The silent voice sings nothing of its own: its factor is display
    // only — the muted participant's read. The producers' value carries
    // the whole chain.
    const value = silent ? 0 : base * (1 + localBonus) * chargeTerm * achievementBoost * discoveryBoost;
    if (!silent) {
      synthsLeg += base;
      boosters += base * localBonus;
      rate += value;
    }
    contributions.set(module.id, {
      moduleId: module.id,
      type: module.type,
      pitch,
      amplitude: silent ? 0 : power * (1 + localBonus),
      value,
      chordTerms,
      chordFactor: pitch === null ? null : chordFactor,
      formationQ,
      infusorBonus: localBonus,
      chargeFactor: chargeTerm,
      chargeStrength: strength,
    });
  }

  const amplitude = synthsLeg + boosters;
  // The boosts multiply every module's final value; the empowerment leg
  // divides them back out so the breakdown multiplies out exactly:
  // rate = (synths + boosters) × empowerment × achievementBoost ×
  // discoveryBoost. The Blaster's conversion rides inside its value, so a
  // converting Blaster reads as empowerment on its own terms — the leg
  // split stays exact.
  const empowerment = amplitude > EPS ? rate / (amplitude * achievementBoost * discoveryBoost) : 1;

  return {
    synths: synthsLeg,
    infusors: boosters,
    amplitude,
    namedChords: analysis.namedChords,
    empowerment,
    achievementBoost,
    discoveryBoost,
    ritualAmplification: rawAmplification,
    rate,
    forgeRate,
    mutatorForgeRate,
    contributions,
    chargeStrength,
  };
}
