// The scrap valuation (issue #377, ADR-0066): one read for every surface
// that quotes a copy's recovery value — the scrap action's payout, the
// skip control's offer, and the tests' conservation reads. The schedule
// is BALANCE's: `scrapValue[fixed type rarity]` scaled by
// `scrapTierFactor` per merge tier, with the factor exactly 2 so merging
// conserves collection value (two tier-t copies scrap for what their
// tier-(t+1) product scraps for) and a directly drafted higher tier is
// worth its constituent copies. Levels and invested nous price no scrap:
// the schedule values the collection, never the upgrade spend.
import { BALANCE, typeRarityOf } from "./constants";
import type { ModuleInstance, ModuleType, RollOffer } from "./types";

// One copy's recovery value, read from the named type's fixed rarity and
// the copy's own merge tier.
export function scrapValueOf(type: ModuleType, tier: number): number {
  return BALANCE.scrapValue[typeRarityOf(type)] * BALANCE.scrapTierFactor ** tier;
}

export function moduleScrapValue(module: ModuleInstance): number {
  return scrapValueOf(module.type, module.tier);
}

// The skip payout (the draft action's own): the greatest scrap value
// among the offer's candidates. Taking that candidate and immediately
// scrapping it mints the same type at the same tier, so the two paths
// pay identically by construction — the equivalence the tests read.
export function skipPayoutOf(offer: RollOffer): number {
  return Math.max(...offer.candidates.map((candidate) => scrapValueOf(candidate.type, candidate.tier)));
}
