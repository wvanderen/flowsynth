import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import {
  buyCell,
  buyShelfModule,
  chooseRoll,
  endSession,
  placeModule,
  reshapeCells,
  returnModule,
  startSession,
  upgradeModule,
} from "./actions";
import { cellCost, computeRates, wholeNous } from "./economy";
import { fresh, give, stubRng } from "./fixtures";
import { generateOffer } from "./rolls";
import { hex, isConnected, sameHex } from "./hex";
import { BALANCE } from "./constants";
import type { ShelfType } from "./types";

describe("starter shelf", () => {
  it("sells each shelf offer once for whole nous, in upgrade mode only", () => {
    const s = fresh();
    startSession(s, 600);
    s.nous = 100;
    expect(buyShelfModule(s, "generator").ok).toBe(false); // flow is read-only
    endSession(s);
    expect(s.mode).toBe("upgrade");
    s.nous = 40.9;
    expect(buyShelfModule(s, "generator").ok).toBe(true);
    expect(s.nous).toBeCloseTo(0.9, 6);
    expect(buyShelfModule(s, "generator").ok).toBe(false);

    s.nous = 39.9;
    expect(buyShelfModule(s, "infusor").ok).toBe(false);

    for (const type of ["additive", "infusor", "forge"] as ShelfType[]) {
      s.nous = BALANCE.shelfPrices[type];
      expect(buyShelfModule(s, type).ok).toBe(true);
    }
    // The shelf's "generator" offer is the focus-keyed generator (ADR-0018).
    expect(s.modules.filter((m) => m.type === "focusKeyed")).toHaveLength(1);
  });

  it("the shelf's additive synth chords with the Carrier out of the box", () => {
    const s = fresh();
    s.nous = BALANCE.shelfPrices.additive;
    expect(buyShelfModule(s, "additive").ok).toBe(true);
    const additive = s.modules[s.modules.length - 1]!;
    expect(additive.type).toBe("additive");
    expect(placeModule(s, additive.id, hex(1, 0)).ok).toBe(true);
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Octave"]);
  });

  it("every launch category is reachable through shelf plus rolls", () => {
    const s = fresh();
    for (const type of ["additive", "generator", "infusor", "forge"] as ShelfType[]) {
      s.nous = BALANCE.shelfPrices[type];
      expect(buyShelfModule(s, type).ok).toBe(true);
    }
    const types = new Set(s.modules.map((m) => m.type));
    expect(types.has("additive")).toBe(true);
    expect(types.has("focusKeyed")).toBe(true);
    expect(types.has("infusor")).toBe(true);
    expect(types.has("forge")).toBe(true);
    expect(types.has("carrier")).toBe(true);
  });

  it("upgrades need only upgrade mode and whole nous", () => {
    const s = fresh();
    s.nous = 100;
    const carrier = s.modules.find((m) => m.type === "carrier")!;
    expect(upgradeModule(s, carrier.id).ok).toBe(true);
    expect(carrier.level).toBe(1);
    expect(s.nous).toBeCloseTo(90, 6);
    expect(upgradeModule(s, carrier.id).ok).toBe(true);
    expect(s.nous).toBeCloseTo(74, 6);
  });
});

describe("placement and board rules", () => {
  it("the Carrier is pinned: immovable and unsellable", () => {
    const s = fresh();
    const carrier = s.modules.find((m) => m.type === "carrier")!;
    expect(carrier.pos).toEqual(hex(0, 0));
    expect(placeModule(s, carrier.id, hex(1, 0)).ok).toBe(false);
    expect(returnModule(s, carrier.id).ok).toBe(false);
    expect(carrier.pos).toEqual(hex(0, 0));
  });

  it("gameplay modules swap positions and store to inventory", () => {
    const s = fresh();
    const additive = give(s, "additive", hex(1, 0));
    const forge = give(s, "forge", hex(0, 1));
    expect(placeModule(s, additive.id, hex(0, 1)).ok).toBe(true);
    expect(additive.pos).toEqual(hex(0, 1));
    expect(forge.pos).toEqual(hex(1, 0));
    expect(returnModule(s, forge.id).ok).toBe(true);
    expect(forge.pos).toBeNull();
  });

  it("nothing can displace the Carrier and placed modules stay off its cell", () => {
    const s = fresh();
    const additive = give(s, "additive", null);
    expect(placeModule(s, additive.id, hex(0, 0)).ok).toBe(false);
    expect(placeModule(s, additive.id, hex(1, 0)).ok).toBe(true);
  });

  it("locks the grid during flow", () => {
    const s = fresh();
    const additive = give(s, "additive", null);
    startSession(s, 600);
    expect(placeModule(s, additive.id, hex(1, 0)).ok).toBe(false);
    expect(returnModule(s, additive.id).ok).toBe(false);
    expect(reshapeCells(s, s.cells).ok).toBe(false);
  });

  it("reshapes preserve count, connectivity, and deployed positions", () => {
    const s = fresh();
    const next = [hex(0, 0), hex(1, 0), hex(1, -1)];
    expect(reshapeCells(s, next).ok).toBe(true);
    expect(s.cells).toHaveLength(3);
    expect(isConnected(next)).toBe(true);

    // The Carrier pins its cell: any shape that drops (0,0) is invalid.
    const withoutOrigin = [hex(1, 0), hex(1, -1), hex(2, 0)];
    expect(reshapeCells(s, withoutOrigin).ok).toBe(false);

    expect(reshapeCells(s, [hex(0, 0)]).ok).toBe(false);
    expect(reshapeCells(s, [hex(0, 0), hex(1, 0), hex(3, 0)]).ok).toBe(false);
  });
});

describe("cells as direct nous purchases", () => {
  it("prices cells on a steep geometric scaler over total cells bought", () => {
    expect(cellCost(0)).toBe(BALANCE.cellFirstCost);
    expect(cellCost(1)).toBeGreaterThan(cellCost(0));
    expect(cellCost(2)).toBeGreaterThan(cellCost(1));
    // Geometric: each price is the previous scaled by the growth ratio.
    const ratio = cellCost(4) / cellCost(3);
    expect(ratio).toBeCloseTo(
      Number(BALANCE.cellCostGrowthNumerator) / Number(BALANCE.cellCostGrowthDenominator),
      0,
    );
  });

  it("sells frontier cells for whole nous in upgrade mode only", () => {
    const s = fresh();
    startSession(s, 600);
    s.nous = 1000;
    expect(buyCell(s, hex(2, 0)).ok).toBe(false); // flow is read-only
    endSession(s);

    const price0 = cellCost(s.cellsBought);
    s.nous = price0 - 0.1;
    expect(buyCell(s, hex(2, 0)).ok).toBe(false); // needs whole nous
    s.nous = price0 + 0.9;
    expect(buyCell(s, hex(2, 0)).ok).toBe(true);
    expect(s.nous).toBeCloseTo(0.9, 6);
    expect(s.cellsBought).toBe(1);
    expect(s.cells.some((c) => sameHex(c, hex(2, 0)))).toBe(true);
  });

  it("grows the board only through the connected frontier", () => {
    const s = fresh();
    s.nous = 1e6;
    expect(buyCell(s, hex(5, 0)).ok).toBe(false); // not adjacent to the board
    expect(buyCell(s, hex(1, 0)).ok).toBe(false); // already a cell
    expect(buyCell(s, hex(2, 0)).ok).toBe(true);
    expect(buyCell(s, hex(4, 0)).ok).toBe(false); // two rings out, not adjacent
    expect(buyCell(s, hex(3, 0)).ok).toBe(true); // adjacent to the new cell
    expect(buyCell(s, hex(4, 0)).ok).toBe(true);
    expect(isConnected(s.cells)).toBe(true);
    expect(s.cellsBought).toBe(3);
  });

  it("counts every purchase ever made, not the current cell count", () => {
    const s = fresh();
    s.nous = 1e6;
    let spent = 0;
    for (let i = 0; i < 3; i++) {
      const price = cellCost(s.cellsBought);
      const before = s.nous;
      expect(buyCell(s, hex(2 + i, 0)).ok).toBe(true);
      expect(before - s.nous).toBe(price);
      spent += price;
    }
    expect(s.cells).toHaveLength(6);
    expect(s.cellsBought).toBe(3);
    expect(spent).toBe(cellCost(0) + cellCost(1) + cellCost(2));
    // Reshaping never changes the count, so the scaler never rewinds.
    const next = [hex(0, 0), hex(1, 0), hex(0, -1), hex(2, 0), hex(3, 0), hex(-1, 0)];
    expect(reshapeCells(s, next).ok).toBe(true);
    expect(cellCost(s.cellsBought)).toBe(cellCost(3));
  });

  it("the board grows past the opening footprint and modules place on bought cells", () => {
    const s = fresh();
    s.nous = 1e6;
    expect(buyCell(s, hex(2, 0)).ok).toBe(true);
    const additive = give(s, "additive", null);
    expect(placeModule(s, additive.id, hex(2, 0)).ok).toBe(true);
    expect(additive.pos).toEqual(hex(2, 0));
    // The first acquired module is placeable without buying a cell first.
    const s2 = fresh();
    const conditional = give(s2, "conditional", null);
    expect(placeModule(s2, conditional.id, hex(1, 0)).ok).toBe(true);
  });
});

describe("conservation", () => {
  it("never spends more than earned whole nous", () => {
    const s = fresh();
    const rng = stubRng(new Array(64).fill(0.5));
    give(s, "additive", hex(1, 0));
    give(s, "forge", hex(0, 1));
    give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 1200;
    // The opening grant (issue #43) sits in the balance before anything is
    // earned; conservation reads earned = (final − starting) + spent.
    const startingNous = s.nous;
    startSession(s, 600);
    advance(s, 600, rng);
    endSession(s);

    const earnedTotal = s.totalEarned;
    let spent = 0;
    for (const type of ["additive", "generator", "infusor", "forge"] as ShelfType[]) {
      if (wholeNous(s) >= BALANCE.shelfPrices[type]) {
        const before = s.nous;
        buyShelfModule(s, type);
        spent += before - s.nous;
      }
    }
    const carrier = s.modules.find((m) => m.type === "carrier")!;
    while (wholeNous(s) >= 10) {
      const before = s.nous;
      const result = upgradeModule(s, carrier.id);
      if (!result.ok) break;
      spent += before - s.nous;
    }
    expect(s.nous).toBeGreaterThanOrEqual(0);
    expect(earnedTotal).toBeCloseTo(s.nous - startingNous + spent, 6);
  });
});

describe("chooseRoll", () => {
  it("adds the chosen candidate and consumes the offer", () => {
    const s = fresh();
    const offer = generateOffer(s, stubRng([0.1, 0.5, 0.2, 0.5, 0.3, 0.5]));
    s.bankedRolls.push(offer);
    startSession(s, 600);
    advance(s, 10);
    endSession(s);
    const candidate = offer.candidates[1]!;
    expect(chooseRoll(s, offer.id, candidate.id).ok).toBe(true);
    expect(s.bankedRolls).toHaveLength(0);
    const added = s.modules[s.modules.length - 1]!;
    expect(added.type).toBe(candidate.type);
    expect(added.rarity).toBe(candidate.rarity);
    expect(added.pos).toBeNull();
    expect(chooseRoll(s, offer.id, candidate.id).ok).toBe(false);
  });
});
