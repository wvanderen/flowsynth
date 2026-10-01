import { BALANCE, isSynthesizerType, ROLL_POOL } from "./constants";
import { newModuleId } from "./state";
import type { Candidate, GameState, Meter, ModuleType, RollOffer } from "./types";

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
  const pool: ModuleType[] = [...ROLL_POOL];
  const candidates: Candidate[] = [];
  for (let i = 0; i < 3; i++) {
    const index = Math.floor(rng() * pool.length);
    const [type] = pool.splice(index, 1);
    candidates.push({ id: newModuleId(state), type, rarity: rollRarity(rng) });
  }
  // The rig can only ever land on the last slot: the guard means neither
  // earlier candidate sings, so the replacement can't duplicate a type. It
  // changes what the slot is, not how good — the slot keeps its rolled rarity.
  if (firstRollRigged(state) && !candidates.some((c) => isSynthesizerType(c.type))) {
    candidates[candidates.length - 1]!.type = "additive";
  }
  return { id: newModuleId(state), candidates: [candidates[0]!, candidates[1]!, candidates[2]!] };
}

export function forgeThreshold(earned: number): number {
  return BALANCE.forgeInitialThreshold * BALANCE.forgeThresholdGrowth ** earned;
}

// The flow meter's fixed cadence (ADR-0041): a one-time fast opening fill
// that teaches the loop, then one flat block of credited practice per roll
// — forever, never scaling. The fill is measured in credited seconds
// directly, so the threshold is a duration.
export function flowThreshold(earned: number): number {
  return earned === 0 ? BALANCE.flowOpeningSeconds : BALANCE.flowCadenceSeconds;
}

function bankRolls(
  meter: Meter,
  source: "flow" | "forge",
  amount: number,
  threshold: (earned: number) => number,
  state: GameState,
  rng: Rng,
): number {
  meter.progress += amount;
  let rolls = 0;
  while (meter.progress + 1e-9 >= threshold(meter.earned)) {
    meter.progress = Math.max(0, meter.progress - threshold(meter.earned));
    meter.earned++;
    state.bankedRolls.push(generateOffer(state, rng));
    // One banked-roll queue (ADR-0041): both sources push interchangeably;
    // a live session attributes each crossing to its minting source for
    // the summary's rolls line.
    if (state.session) state.session.rolls[source] += 1;
    rolls++;
  }
  return rolls;
}

export function addForgeProgress(state: GameState, amount: number, rng: Rng = Math.random): number {
  return bankRolls(state.forge, "forge", amount, forgeThreshold, state, rng);
}

export function addFlowProgress(state: GameState, seconds: number, rng: Rng = Math.random): number {
  return bankRolls(state.flow, "flow", seconds, flowThreshold, state, rng);
}
