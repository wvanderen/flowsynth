// The Arete Catalog (ADR-0040 as amended by ADR-0044, issue #197): the
// sheet purchases that no board affordance carries — the Mutator tree's
// entry and roll-pool join — plus the Row unlock's pricing ladder. The
// surface-bought ladders (row unlock banners, the Mutators layer's slot
// ladder) never appear as sheet rows; the sheet holds only its own
// purchases, and stays locked until the first prestige banks the first
// Arete. Every Arete purchase survives prestige.
import { BALANCE } from "./constants";
import type { GameState } from "./types";

// Whether any Arete surface may exist: the Catalog unlocks with the first
// Arete reset (ADR-0044) — the prestige count is the lock, never the
// balance, so spending down to zero does not re-lock a surface that has
// opened. Arete arrives only through the prestige action, so this is false
// for every pre-prestige save, permanently.
export function catalogOpen(state: GameState): boolean {
  return state.prestiges > 0;
}

// The rows one Row unlock can still open: the octave row just above the
// launch band and the one just below, neither yet unlocked. At most one
// above and one below by construction — the ladder holds exactly two
// entries, and past them the board sits at its six-row cap.
export function unlockableRows(state: GameState): number[] {
  const above = BALANCE.launchRowsAbove + 1;
  const below = -BALANCE.launchRowsBelow - 1;
  const rows: number[] = [];
  if (!state.unlockedRows.includes(above)) rows.push(above);
  if (!state.unlockedRows.includes(below)) rows.push(below);
  return rows;
}

// The next Row unlock's Arete price, either order (the first unlock 1, the
// second 2); null at the cap — nothing left to price.
export function rowUnlockCost(state: GameState): number | null {
  return BALANCE.rowUnlockCosts[state.unlockedRows.length] ?? null;
}

// The owned rungs, clamped into the ladder's range: the one bound both
// reads below share, so a corrupt count can never price a rung the cap
// read does not count (and vice versa).
function ownedMergeCapRungs(state: GameState): number {
  return Math.min(Math.max(state.mergeCapPurchases, 0), BALANCE.mergeCapCosts.length);
}

// The unlocked merge cap (issue #380, ADR-0058's finite cap): the base cap
// plus one tier per owned Warp Beam rung, clamped at the ladder's end so a
// corrupt count can never promise a tier the power ladder cannot price.
// The one read every consumer uses — merge eligibility, the drafts' tier
// draws, the loom's and the tier product's availability, the cap feat — so
// no surface can disagree about where the ladder ends.
export function unlockedMergeCap(state: GameState): number {
  return BALANCE.mergeCap + ownedMergeCapRungs(state);
}

// The next Warp Beam rung's Arete price (issue #380); null at the ladder's
// end — the cap is at its ceiling and nothing more is sold.
export function mergeCapIncreaseCost(state: GameState): number | null {
  const owned = ownedMergeCapRungs(state);
  return owned < BALANCE.mergeCapCosts.length ? BALANCE.mergeCapCosts[owned]! : null;
}
