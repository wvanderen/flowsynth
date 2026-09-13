import { BALANCE, ROLL_POOL } from "./constants";
import { newModuleId } from "./state";
import type { Candidate, GameState, ModuleType, RollOffer } from "./types";

export type Rng = () => number;

function rollRarity(rng: Rng): Candidate["rarity"] {
  const roll = rng();
  if (roll < BALANCE.rarityProbability.common) return "common";
  if (roll < BALANCE.rarityProbability.common + BALANCE.rarityProbability.uncommon) return "uncommon";
  return "rare";
}

export function generateOffer(state: GameState, rng: Rng): RollOffer {
  const pool: ModuleType[] = [...ROLL_POOL];
  const candidates: Candidate[] = [];
  for (let i = 0; i < 3; i++) {
    const index = Math.floor(rng() * pool.length);
    const [type] = pool.splice(index, 1);
    candidates.push({ id: newModuleId(state), type, rarity: rollRarity(rng) });
  }
  return { id: newModuleId(state), candidates: [candidates[0]!, candidates[1]!, candidates[2]!] };
}

export function forgeThreshold(earned: number): number {
  return BALANCE.forgeInitialThreshold * BALANCE.forgeThresholdGrowth ** earned;
}

export function expansionThreshold(earned: number): number {
  return BALANCE.expansionInitialThreshold * BALANCE.expansionThresholdGrowth ** earned;
}

export function addForgeProgress(state: GameState, amount: number, rng: Rng = Math.random): number {
  state.forge.progress += amount;
  let rolls = 0;
  while (state.forge.progress + 1e-9 >= forgeThreshold(state.forge.earned)) {
    state.forge.progress = Math.max(0, state.forge.progress - forgeThreshold(state.forge.earned));
    state.forge.earned++;
    state.bankedRolls.push(generateOffer(state, rng));
    rolls++;
  }
  return rolls;
}

export function addExpansionProgress(state: GameState, amount: number): number {
  state.expansion.progress += amount;
  let cells = 0;
  while (state.expansion.progress + 1e-9 >= expansionThreshold(state.expansion.earned)) {
    state.expansion.progress = Math.max(0, state.expansion.progress - expansionThreshold(state.expansion.earned));
    state.expansion.earned++;
    state.cellTokens++;
    cells++;
  }
  return cells;
}
