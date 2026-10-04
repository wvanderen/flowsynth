import { BALANCE, isOscillatorType, MUTATOR_FAMILIES, POOL_JOIN_TYPE, ROLL_POOL } from "./constants";
import { newModuleId } from "./state";
import type { Candidate, GameState, Meter, ModuleType, MutatorRollOffer, RollOffer, RollSources } from "./types";

export type Rng = () => number;

function rollRarity(rng: Rng): Candidate["rarity"] {
  const roll = rng();
  if (roll < BALANCE.rarityProbability.common) return "common";
  if (roll < BALANCE.rarityProbability.common + BALANCE.rarityProbability.uncommon) return "uncommon";
  return "rare";
}

// The opening's first roll (board-redesign spec §8) yields a synthesizer
// candidate — the arc's beat is "the forge offers the synth it made", so a
// pool draw without a synthesizer is re-rigged to carry one. Whether the
// rig re-rolls a slot or guarantees the type is tuning, not spec. One
// queue, two sources (ADR-0041): the rig reads the total earned, so the
// first roll is the rigged one whichever meter minted it — in the opening
// that is always the flow meter.
function firstRollRigged(state: GameState): boolean {
  return state.forge.earned + state.flow.earned === 1;
}

export function generateOffer(state: GameState, rng: Rng): RollOffer {
  // The Mutator Forge type joins as one uniform, unweighted entry once the
  // roll-pool purchase owns membership (ADR-0043) — the purchase buys
  // membership, nothing else.
  const pool: ModuleType[] = state.rollPoolJoined ? [...ROLL_POOL, POOL_JOIN_TYPE] : [...ROLL_POOL];
  const candidates: Candidate[] = [];
  for (let i = 0; i < 3; i++) {
    const index = Math.floor(rng() * pool.length);
    const [type] = pool.splice(index, 1);
    candidates.push({ id: newModuleId(state), type, rarity: rollRarity(rng) });
  }
  // The rig can only ever land on the last slot: the guard means neither
  // earlier candidate sings, so the replacement can't duplicate a type. It
  // changes what the slot is, not how good — the slot keeps its rolled rarity.
  if (firstRollRigged(state) && !candidates.some((c) => isOscillatorType(c.type))) {
    candidates[candidates.length - 1]!.type = "additive";
  }
  return { id: newModuleId(state), candidates: [candidates[0]!, candidates[1]!, candidates[2]!] };
}

// The mutator roll (ADR-0043, issue #198): two candidates — three families
// cannot fill three meaningful slots — family uniform over the launch
// families, the shared rarity table, and no first-roll rig (the rig reads
// the module meters' earned counts only, so a Mutator Forge crossing can
// never trip it). Unchosen candidates vanish without consolation.
export function generateMutatorOffer(state: GameState, rng: Rng): MutatorRollOffer {
  const candidates = [0, 1].map(() => ({
    id: newModuleId(state),
    family: MUTATOR_FAMILIES[Math.floor(rng() * MUTATOR_FAMILIES.length)]!,
    rarity: rollRarity(rng),
  }));
  return { id: newModuleId(state), candidates: [candidates[0]!, candidates[1]!] };
}

export function forgeThreshold(earned: number): number {
  return BALANCE.forgeInitialThreshold * BALANCE.forgeThresholdGrowth ** earned;
}

// The Mutator Forge branch's own threshold (ADR-0043): ADR-0009's shared
// scaling with its own constants — growth ≈×2, steeper than the module
// branch's ×1.5 — paced so the first mutator roll lands within the first
// post-entry era.
export function mutatorForgeThreshold(earned: number): number {
  return BALANCE.mutatorForgeInitialThreshold * BALANCE.mutatorForgeThresholdGrowth ** earned;
}

// The flow meter's fixed cadence (ADR-0041): a one-time fast opening fill
// that teaches the loop, then one flat block of credited practice per roll
// — forever, never scaling. The fill is measured in credited seconds
// directly, so the threshold is a duration.
export function flowThreshold(earned: number): number {
  return earned === 0 ? BALANCE.flowOpeningSeconds : BALANCE.flowCadenceSeconds;
}

// The shared crossing loop (ADR-0009): add progress, and while the branch's
// globally scaling threshold is met, subtract it, count the crossing, mint
// an offer into the branch's queue, and carry the excess forward. One queue
// per branch; the module branches (ADR-0041) push interchangeably into one
// queue, the Mutator Forge into the Mutator tray's own (issue #198).
function bankRolls<O>(
  meter: Meter,
  source: keyof RollSources,
  amount: number,
  threshold: (earned: number) => number,
  state: GameState,
  rng: Rng,
  queue: O[],
  generate: (state: GameState, rng: Rng) => O,
): number {
  meter.progress += amount;
  let rolls = 0;
  while (meter.progress + 1e-9 >= threshold(meter.earned)) {
    meter.progress = Math.max(0, meter.progress - threshold(meter.earned));
    meter.earned++;
    queue.push(generate(state, rng));
    // A live session attributes each crossing to its minting source for
    // the summary's rolls line.
    if (state.session) state.session.rolls[source] += 1;
    rolls++;
  }
  return rolls;
}

export function addForgeProgress(state: GameState, amount: number, rng: Rng = Math.random): number {
  return bankRolls(state.forge, "forge", amount, forgeThreshold, state, rng, state.bankedRolls, generateOffer);
}

export function addFlowProgress(state: GameState, seconds: number, rng: Rng = Math.random): number {
  return bankRolls(state.flow, "flow", seconds, flowThreshold, state, rng, state.bankedRolls, generateOffer);
}

// The Mutator Forge branch's crossings (ADR-0043, issue #198): charge-only
// — practice never feeds this branch (ADR-0041).
export function addMutatorForgeProgress(state: GameState, amount: number, rng: Rng = Math.random): number {
  return bankRolls(state.mutatorForge, "mutator", amount, mutatorForgeThreshold, state, rng, state.bankedMutatorRolls, generateMutatorOffer);
}
