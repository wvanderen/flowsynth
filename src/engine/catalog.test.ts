import { describe, expect, it } from "vitest";
import { buyCell, buyRowUnlock, prestige } from "./actions";
import { ARETE_HORIZON } from "./accumulator";
import { BALANCE } from "./constants";
import { catalogOpen, rowUnlockCost, unlockableRows } from "./catalog";
import { cellCost, cellPurchasePrice, rowGateOwed } from "./economy";
import { fresh } from "./fixtures";
import { hex } from "./hex";
import { octaveRowOf, positionInRange } from "./lattice";

// The Arete Catalog and the Row unlock (ADR-0040 as amended by ADR-0044,
// issue #197): the sheet purchases debit Arete and survive prestige; the
// banner's purchase stands in the row gate; the board caps at six rows;
// nothing of Arete acts outside upgrade mode.

const LAUNCH_TOP = BALANCE.launchRowsAbove;
const LAUNCH_BOTTOM = -BALANCE.launchRowsBelow;
const UNLOCK_ABOVE = LAUNCH_TOP + 1;
const UNLOCK_BELOW = LAUNCH_BOTTOM - 1;

// A fresh state standing just past its first prestige: the Catalog's lock
// is the first Arete reset, so every Arete question starts here. The era
// jumps to the World entry (issue #425) — the first claim banks two Arete
// and grants the starter weapon; a bare-horizon reset would be zero-claim.
function banked(): ReturnType<typeof fresh> {
  const s = fresh();
  s.eraEarned = BALANCE.world.entryNous;
  prestige(s);
  return s;
}

// The opening board grown to the unlock boundary: a cell in row 2 above and
// one in row −1 below, so each frontier reaches its side's unlock row —
// the frontier-adjacency the banner's click and the engine's gate share.
function atBoundary(s: ReturnType<typeof fresh>): ReturnType<typeof fresh> {
  s.cells.push(hex(0, LAUNCH_TOP), hex(0, LAUNCH_BOTTOM));
  return s;
}

describe("the catalog's lock", () => {
  it("opens with the first banked Arete and never before", () => {
    const s = fresh();
    expect(catalogOpen(s)).toBe(false);
    expect(s.arete).toBe(0);
    // The crossing banks nothing; the reset action is the only source.
    s.eraEarned = ARETE_HORIZON;
    expect(prestige(s).ok).toBe(true);
    expect(catalogOpen(s)).toBe(true);
  });
});

// Retired Mutator purchase/action contracts are replaced by the refusal
// and no-side-effect cases in retirement.test.ts (#530).

// The Horizon break's purchase retired with the frontier claim curve
// (issue #425) — its World-side successor's purchases carry their own
// suites in world.test.ts.

describe("the Row unlock", () => {
  it("offers exactly one row above and one below the launch band, reached by the board", () => {
    const s = atBoundary(banked());
    expect(unlockableRows(s)).toEqual([UNLOCK_ABOVE, UNLOCK_BELOW]);
    // Either order: unlocking the below row first leaves only the above.
    expect(buyRowUnlock(s, UNLOCK_BELOW).ok).toBe(true);
    expect(unlockableRows(s)).toEqual([UNLOCK_ABOVE]);
    s.arete = 2;
    expect(buyRowUnlock(s, UNLOCK_ABOVE).ok).toBe(true);
    expect(unlockableRows(s)).toEqual([]);
  });

  it("refuses a row the board does not touch — no banner, no other path", () => {
    const s = banked();
    expect(buyRowUnlock(s, UNLOCK_ABOVE).ok).toBe(false);
    expect(s.unlockedRows).toEqual([]);
  });

  it("escalates 1 then 2, either order", () => {
    const s = atBoundary(banked());
    expect(rowUnlockCost(s)).toBe(1);
    expect(buyRowUnlock(s, UNLOCK_ABOVE).ok).toBe(true);
    expect(s.arete).toBe(1); // the entry grant's second Arete (issue #425)
    expect(rowUnlockCost(s)).toBe(2);
    s.arete = 2;
    expect(buyRowUnlock(s, UNLOCK_BELOW).ok).toBe(true);
    expect(s.arete).toBe(0);
    // At the cap there is no price and no unlockable row.
    expect(rowUnlockCost(s)).toBeNull();
    expect(buyRowUnlock(s, UNLOCK_ABOVE + 1).ok).toBe(false);
  });

  it("refuses rows the ladder does not sell and unaffordable purchases", () => {
    const s = atBoundary(banked());
    expect(buyRowUnlock(s, LAUNCH_TOP).ok).toBe(false);
    expect(buyRowUnlock(s, UNLOCK_BELOW - 1).ok).toBe(false);
    s.arete = 0;
    expect(buyRowUnlock(s, UNLOCK_ABOVE).ok).toBe(false);
    expect(s.unlockedRows).toEqual([]);
  });

  it("is inert outside upgrade mode", () => {
    const s = atBoundary(banked());
    s.mode = "flow";
    expect(buyRowUnlock(s, UNLOCK_ABOVE).ok).toBe(false);
    expect(s.unlockedRows).toEqual([]);
  });

  it("the purchase stands in the row gate: cells inside buy with nous as usual", () => {
    const s = atBoundary(banked());
    buyRowUnlock(s, UNLOCK_ABOVE);
    expect(rowGateOwed(s, UNLOCK_ABOVE)).toBe(false);
    expect(s.gatedRows).toContain(UNLOCK_ABOVE);
    // The unlocked row is in range, and its first cell prices at the bare
    // scaler — no gate premium on top.
    expect(positionInRange(s, hex(0, UNLOCK_ABOVE))).toBe(true);
    expect(cellPurchasePrice(s, hex(0, UNLOCK_ABOVE))).toBe(cellCost(s.cellsBought));
    // And the buy lands with nous alone.
    s.nous = cellCost(s.cellsBought);
    expect(buyCell(s, hex(0, UNLOCK_ABOVE)).ok).toBe(true);
    expect(octaveRowOf(s.cells.at(-1)!)).toBe(UNLOCK_ABOVE);
  });

  it("a row beyond the cap is unpurchasable at any spend", () => {
    const s = atBoundary(banked());
    s.arete = 100;
    buyRowUnlock(s, UNLOCK_ABOVE);
    buyRowUnlock(s, UNLOCK_BELOW);
    // Six rows stand; nothing past them is in range, so no cell buy —
    // whatever the nous — can land there.
    expect(positionInRange(s, hex(0, UNLOCK_ABOVE + 1))).toBe(false);
    expect(positionInRange(s, hex(0, UNLOCK_BELOW - 1))).toBe(false);
    s.nous = 1e9;
    expect(buyCell(s, hex(0, UNLOCK_ABOVE + 1)).ok).toBe(false);
  });

  it("unlocked rows persist through prestige", () => {
    const s = atBoundary(banked());
    buyRowUnlock(s, UNLOCK_ABOVE);
    s.eraEarned = ARETE_HORIZON;
    prestige(s);
    expect(s.unlockedRows).toEqual([UNLOCK_ABOVE]);
    expect(s.gatedRows).toContain(UNLOCK_ABOVE);
    expect(positionInRange(s, hex(0, UNLOCK_ABOVE))).toBe(true);
  });
});
