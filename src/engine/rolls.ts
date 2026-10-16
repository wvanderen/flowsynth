import { BALANCE, CATEGORY_OF, isOscillatorType, MUTATOR_FAMILIES, POOL_JOIN_TYPE, ROLL_POOL, TYPE_RARITY } from "./constants";
import { newModuleId } from "./state";
import type { Candidate, Category, GameState, Meter, ModuleType, MutatorRollOffer, Rarity, RollOffer, RollSources } from "./types";

export type Rng = () => number;

// The shared rarity-band draw: the one table both roll families read —
// module slots draw the band before their type (ADR-0058), mutator
// candidates keep it per candidate (ADR-0043).
function rollRarity(rng: Rng): Rarity {
  const roll = rng();
  if (roll < BALANCE.rarityProbability.common) return "common";
  if (roll < BALANCE.rarityProbability.common + BALANCE.rarityProbability.uncommon) return "uncommon";
  return "rare";
}

// The category draw (issue #378, parent #366): one weighted pick over the
// categories still present in the slot's pool. A present category's mass
// is its authored weight alone — never its type count — so the oscillator
// roster can grow without crowding the support categories out of drafts
// (user story 15). The walk reads the weights in their authored order and
// skips absent categories, whose mass redistributes; a draw at 1−ε still
// lands on the last present category.
function drawDraftCategory(bandPool: ModuleType[], rng: Rng): Category {
  const present = new Set(bandPool.map((type) => CATEGORY_OF[type]));
  const entries = (Object.entries(BALANCE.draftCategoryWeights) as [Category, number][]).filter(
    ([category]) => present.has(category),
  );
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [category, weight] of entries) {
    if (roll < weight) return category;
    roll -= weight;
  }
  return entries[entries.length - 1]![0]!;
}

// The Draft Loom's reads (issue #378, parent #366): the owned rungs'
// tier-bonus chance and the next rung's scrap price — one read each for
// the draw, the purchase action, and the Forge row. Past the ladder's end
// the price reads null and the chance sits at its ceiling.
export function draftTierChanceOf(owned: number): number {
  if (owned < 1) return 0;
  return BALANCE.tierBonusChance[Math.min(owned, BALANCE.tierBonusChance.length) - 1]!;
}

export function nextDraftUpgradePrice(owned: number): number | null {
  return owned < BALANCE.tierBonusCosts.length ? BALANCE.tierBonusCosts[owned]! : null;
}

// The tier draw (issue #378): a fresh candidate mints one merge tier
// higher with its owned rung's chance, clamped to the unlocked cap —
// offered tiers never exceed it. The draw spends an rng value only while
// rungs are owned: with none, the stream stays the bare three draws per
// slot.
function drawCandidateTier(state: GameState, rng: Rng): number {
  const chance = draftTierChanceOf(state.draftTierBonus);
  if (chance <= 0) return 0;
  return rng() < chance ? Math.min(1, BALANCE.mergeCap) : 0;
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
  // membership, nothing else. Its draws ride its category's authored
  // weight like every type's.
  const pool: ModuleType[] = state.rollPoolJoined ? [...ROLL_POOL, POOL_JOIN_TYPE] : [...ROLL_POOL];
  const candidates: Candidate[] = [];
  for (let i = 0; i < 3; i++) {
    // Fixed type rarity drives the band draw (ADR-0058): the slot draws
    // its rarity band first, then — issue #378's composition — a category
    // among the not-yet-drawn types whose authored rarity matches, by the
    // authored category weights alone, and then a type uniformly inside
    // that category. Commons duplicate more readily, rarer designs are
    // scarcer, and the support categories hold their share whatever the
    // roster does. A band with no remaining types falls back to the whole
    // remaining pool, spending no extra draw. Each pick leaves the shared
    // pool exactly once, by identity — the distinct-candidate offer stands.
    const band = rollRarity(rng);
    const matched = pool.filter((type) => TYPE_RARITY[type] === band);
    const bandPool = matched.length > 0 ? matched : pool;
    const category = drawDraftCategory(bandPool, rng);
    const inCategory = bandPool.filter((type) => CATEGORY_OF[type] === category);
    const type = inCategory[Math.floor(rng() * inCategory.length)]!;
    pool.splice(pool.indexOf(type), 1);
    candidates.push({ id: newModuleId(state), type, tier: drawCandidateTier(state, rng) });
  }
  // The rig can only ever land on the last slot: the guard means neither
  // earlier candidate sings, so the replacement can't duplicate a type. It
  // changes what the slot is, not how good — the slot keeps its draw.
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
