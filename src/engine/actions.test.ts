import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import {
  buyCell,
  buyShelfModule,
  chooseRoll,
  dismissSummary,
  endSession,
  placeModule,
  recordSummaryReflection,
  reshapeCells,
  returnModule,
  startSession,
  upgradeModule,
} from "./actions";
import { cellCost, computeRates, wholeNous } from "./economy";
import { fresh, give, stubRng } from "./fixtures";
import { generateOffer } from "./rolls";
import { hex, isConnected, sameHex } from "./hex";
import { BALANCE, REFLECTION_SLIDER_NEUTRAL, SHELF_TYPES } from "./constants";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
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

    for (const type of ["infusor", "forge"] as ShelfType[]) {
      s.nous = BALANCE.shelfPrices[type];
      expect(buyShelfModule(s, type).ok).toBe(true);
    }
    // The shelf's "generator" offer is the focus-keyed generator (ADR-0018).
    expect(s.modules.filter((m) => m.type === "focusKeyed")).toHaveLength(1);
  });

  it("a rolled synthesizer chords with the opening synth out of the box", () => {
    const s = fresh();
    const rolled = give(s, "additive", null); // what a forge roll delivers
    expect(placeModule(s, rolled.id, hex(1, 0)).ok).toBe(true); // G4
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Fifth"]);
  });

  it("a rolled spacer wires: silent on its own cell, conducting between voices", () => {
    const s = fresh();
    s.cells.push(hex(2, 0));
    const spacer = give(s, "spacer", null);
    const synth = give(s, "additive", null);
    expect(placeModule(s, spacer.id, hex(1, 0)).ok).toBe(true); // the wire cell
    expect(placeModule(s, synth.id, hex(2, 0)).ok).toBe(true); // D5
    const snapshot = computeRates(s, true);
    // C4 and D5 connect through the wire and ring the flat seventh.
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Flat seventh"]);
    expect(snapshot.contributions.get(spacer.id)?.value).toBe(0);
  });

  it("every non-synthesizer category is reachable through the shelf; synths through rolls", () => {
    const s = fresh();
    s.nous = 1e6;
    for (const type of SHELF_TYPES) {
      expect(buyShelfModule(s, type).ok, type).toBe(true);
    }
    const types = new Set(s.modules.map((m) => m.type));
    expect(types.has("additive")).toBe(true); // the opening synth
    expect(types.has("focusKeyed")).toBe(true);
    expect(types.has("infusor")).toBe(true);
    expect(types.has("forge")).toBe(true);
    expect(types.has("spacer")).toBe(false); // roll-pool only (ADR-0022)
  });

  it("upgrades need only upgrade mode and whole nous", () => {
    const s = fresh();
    s.nous = 100;
    const opening = s.modules[0]!;
    expect(upgradeModule(s, opening.id).ok).toBe(true);
    expect(opening.level).toBe(1);
    expect(s.nous).toBeCloseTo(90, 6);
    expect(upgradeModule(s, opening.id).ok).toBe(true);
    expect(s.nous).toBeCloseTo(74, 6);
  });
});

describe("placement and board rules", () => {
  it("nothing is pinned: every module moves, swaps, and stores freely (ADR-0021)", () => {
    const s = fresh();
    const opening = s.modules[0]!;
    expect(opening.pos).toEqual(hex(0, 0));
    const additive = give(s, "additive", hex(1, 0));
    const forge = give(s, "forge", hex(0, 1));
    // Swap onto the opening's own cell — a swap, never a refusal.
    expect(placeModule(s, additive.id, hex(0, 0)).ok).toBe(true);
    expect(additive.pos).toEqual(hex(0, 0));
    expect(opening.pos).toEqual(hex(1, 0));
    expect(placeModule(s, forge.id, hex(1, 0)).ok).toBe(true);
    expect(forge.pos).toEqual(hex(1, 0));
    expect(opening.pos).toEqual(hex(0, 1));
    // And the opening synth itself returns to the tray like anything else.
    expect(returnModule(s, opening.id).ok).toBe(true);
    expect(opening.pos).toBeNull();
  });

  it("a swap of identical synthesizers never breaks a chord — pitch lives in the cell", () => {
    const s = fresh();
    const rolled = give(s, "additive", null);
    placeModule(s, rolled.id, hex(1, 0)); // C4 · G4 fifth
    const before = computeRates(s, true);
    // Drag the opening synth off the board into the tray: the chord breaks
    // by leaving, never by swapping.
    expect(returnModule(s, s.modules[0]!.id).ok).toBe(true);
    expect(computeRates(s, true).chordMultiplier).toBe(1);
    placeModule(s, s.modules[0]!.id, hex(0, 0));
    expect(computeRates(s, true).chordMultiplier).toBeCloseTo(before.chordMultiplier, 9);
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

  it("locks the grid during flow", () => {
    const s = fresh();
    const additive = give(s, "additive", null);
    startSession(s, 600);
    expect(placeModule(s, additive.id, hex(1, 0)).ok).toBe(false);
    expect(returnModule(s, additive.id).ok).toBe(false);
    expect(reshapeCells(s, s.cells).ok).toBe(false);
  });

  it("reshapes preserve count, connectivity, deployed positions, and the row band", () => {
    const s = fresh();
    const next = [hex(0, 0), hex(1, 0), hex(1, -1)];
    expect(reshapeCells(s, next).ok).toBe(true);
    expect(s.cells).toHaveLength(3);
    expect(isConnected(next)).toBe(true);

    // Deployed modules keep their cells: any shape that drops (0,0) —
    // where the opening synth sits — is invalid.
    const withoutOrigin = [hex(1, 0), hex(1, -1), hex(2, 0)];
    expect(reshapeCells(s, withoutOrigin).ok).toBe(false);

    expect(reshapeCells(s, [hex(0, 0)]).ok).toBe(false);
    expect(reshapeCells(s, [hex(0, 0), hex(1, 0), hex(3, 0)]).ok).toBe(false);
    // The board lives inside the finite octave-row band.
    expect(reshapeCells(s, [hex(0, 0), hex(1, 0), hex(0, 9)]).ok).toBe(false);
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
    // (2,0), (3,0) stay in octave row 1 (already on the board); (1,1) is
    // row 1 too — no gates muddy the scaler read.
    for (const pos of [hex(2, 0), hex(3, 0), hex(1, 1)]) {
      const price = cellCost(s.cellsBought);
      const before = s.nous;
      expect(buyCell(s, pos).ok, `${pos.q},${pos.r}`).toBe(true);
      expect(before - s.nous).toBe(price);
      spent += price;
    }
    expect(s.cells).toHaveLength(6);
    expect(s.cellsBought).toBe(3);
    expect(spent).toBe(cellCost(0) + cellCost(1) + cellCost(2));
    // Reshaping never changes the count, so the scaler never rewinds.
    const next = [hex(0, 0), hex(1, 0), hex(0, -1), hex(2, 0), hex(3, 0), hex(-1, 1)];
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
    s.cells.push(hex(2, 0));
    s.chargeWindow = 1200;
    // The opening grant (issue #43) sits in the balance before anything is
    // earned; conservation reads earned = (final − starting) + spent.
    const startingNous = s.nous;
    startSession(s, 600);
    advance(s, 600, rng);
    endSession(s);

    const earnedTotal = s.totalEarned;
    let spent = 0;
    for (const type of SHELF_TYPES) {
      if (wholeNous(s) >= BALANCE.shelfPrices[type]) {
        const before = s.nous;
        buyShelfModule(s, type);
        spent += before - s.nous;
      }
    }
    const opening = s.modules[0]!;
    while (wholeNous(s) >= 10) {
      const before = s.nous;
      const result = upgradeModule(s, opening.id);
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

describe("the summary's final numbers and reflection (§8)", () => {
  it("captures the plan and the settled honesty events; the reflection starts absent", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    // 300 s provisional past the plan, settled as a miss: the summary must
    // carry the event so the dropped bucket's drop stays visible.
    applyGap(s, 300, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "missed");
    endSession(s, 5_000);
    expect(s.summary!.plannedTarget).toBe(600);
    expect(s.summary!.honestyEvents).toEqual([{ awaySeconds: 300, outcome: "missed" }]);
    expect(s.summary!.reflection).toBeNull();
  });

  it("an open-ended session's summary carries a null plan and its own events", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 600);
    applyGap(s, 300, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "full");
    endSession(s, 5_000);
    expect(s.summary!.plannedTarget).toBeNull();
    expect(s.summary!.honestyEvents).toEqual([{ awaySeconds: 300, outcome: "full" }]);
  });

  it("a summary with no honesty events carries an empty list, not undefined", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 60);
    endSession(s, 5_000);
    expect(s.summary!.honestyEvents).toEqual([]);
    expect(s.summary!.plannedTarget).toBeNull();
  });

  it("the reflection records as either field is touched; the untouched field keeps its neutral default", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 60);
    endSession(s, 5_000);
    // Slider first: the text stays at its neutral empty default.
    expect(recordSummaryReflection(s, { slider: 5 }).ok).toBe(true);
    expect(s.summary!.reflection).toEqual({ text: "", slider: 5 });
    // Then text: the slider keeps its recorded position.
    recordSummaryReflection(s, { text: "loose but honest" });
    expect(s.summary!.reflection).toEqual({ text: "loose but honest", slider: 5 });
    // The neutral middle is the default for a first slider touch.
    const t = fresh();
    startSession(t, 600);
    advance(t, 60);
    endSession(t, 5_000);
    recordSummaryReflection(t, { text: "tight" });
    expect(t.summary!.reflection).toEqual({ text: "tight", slider: REFLECTION_SLIDER_NEUTRAL });
  });

  it("recording needs a summary; neither field touched leaves the reflection absent", () => {
    const s = fresh();
    expect(recordSummaryReflection(s, { text: "ghost" }).ok).toBe(false);
    startSession(s, 600);
    advance(s, 60);
    endSession(s, 5_000);
    expect(s.summary!.reflection).toBeNull();
  });

  it("every dismissal logs the same: the recorded reflection stays, absent stays absent", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 60);
    endSession(s, 5_000);
    expect(dismissSummary(s).ok).toBe(true);
    expect(s.summary!.seen).toBe(true);
    expect(s.summary!.reflection).toBeNull();
    const t = fresh();
    startSession(t, 600);
    advance(t, 60);
    endSession(t, 5_000);
    recordSummaryReflection(t, { slider: 2 });
    dismissSummary(t);
    expect(t.summary!.seen).toBe(true);
    expect(t.summary!.reflection).toEqual({ text: "", slider: 2 });
  });
});
