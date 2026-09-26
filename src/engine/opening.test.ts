import { describe, expect, it } from "vitest";
import {
  buyActivation,
  buyCell,
  buyGoalCapacity,
  buyShelfModule,
  endSession,
  pauseSession,
  placeModule,
  reshapeCells,
  returnModule,
  startSession,
  upgradeModule,
} from "./actions";
import { BALANCE, MODULE_TYPES, SAVE_VERSION, SHELF_TYPES } from "./constants";
import { nextRungCost } from "./apps";
import { cellCost, computeRates, levelCost, longGoalCost, rowGateCost, rungCost } from "./economy";
import { fresh } from "./fixtures";
import { adjacent, hex } from "./hex";
import { cellNoteOf } from "./lattice";
import { serialize, deserialize } from "./save";
import type { ShelfType } from "./types";

// The opening (board-redesign spec §8, ADR-0022): one plain synthesizer
// pre-placed at C4 on the retained three-cell footprint, an empty tray, and
// a nous grant that affords the first upgrade. No Carrier exists — as a
// type, a module, or a save field.

describe("the opening grant (ADR-0022)", () => {
  it("affords, but does not exactly equal, the first upgrade", () => {
    const s = fresh();
    expect(s.nous).toBe(BALANCE.openingGrant);
    expect(s.nous).toBeGreaterThanOrEqual(levelCost(0));
    expect(s.nous).not.toBe(levelCost(0));
    const opening = s.modules[0]!;
    expect(levelCost(opening.level)).toBeLessThanOrEqual(s.nous);
  });

  it("prices the first upgrade below the shelf floor, so the grant is pre-affordable", () => {
    const shelfFloor = Math.min(...Object.values(BALANCE.shelfPrices));
    expect(levelCost(0)).toBeLessThan(shelfFloor);
    const s = fresh();
    expect(s.nous).toBeGreaterThanOrEqual(levelCost(s.modules[0]!.level));
  });

  it("is a grant, not earnings: the accumulator starts empty", () => {
    const s = fresh();
    expect(s.totalEarned).toBe(0);
  });
});

describe("the carrierless opening board", () => {
  it("one pre-placed synthesizer at C4, an empty tray, and no Carrier anywhere", () => {
    const s = fresh();
    expect(s.modules).toHaveLength(1);
    const opening = s.modules[0]!;
    expect(opening.type).toBe("additive");
    expect(opening.pos).toEqual(hex(0, 0));
    expect(cellNoteOf(hex(0, 0))).toBe("C4");
    // No Carrier as a type, a category member, or a state field.
    expect(MODULE_TYPES.includes("carrier" as never)).toBe(false);
    expect(s.modules.some((m) => (m.type as string) === "carrier")).toBe(false);
    expect("welcomeAcked" in s).toBe(false);
  });

  it("retains the three-cell opening footprint: every cell touches the others", () => {
    const s = fresh();
    expect(s.cells).toHaveLength(3);
    for (const a of s.cells) {
      for (const b of s.cells) {
        if (a === b) continue;
        expect(adjacent(a, b), `${a.q},${a.r} ↔ ${b.q},${b.r}`).toBe(true);
      }
    }
    // The footprint reads as C4 · G4 · C5 on the lattice.
    expect(s.cells.map((c) => cellNoteOf(c)).sort()).toEqual(["C4", "C5", "G4"]);
  });

  it("the shelf's generator charges an adjacent Forge without buying a cell", () => {
    const s = fresh();
    s.nous = 1e6;
    expect(buyShelfModule(s, "generator").ok).toBe(true);
    expect(buyShelfModule(s, "forge").ok).toBe(true);
    const generator = s.modules.find((m) => m.type === "focusKeyed")!;
    const forge = s.modules.find((m) => m.type === "forge")!;
    expect(placeModule(s, generator.id, hex(1, 0)).ok).toBe(true);
    expect(placeModule(s, forge.id, hex(0, 1)).ok).toBe(true);
    s.chargeWindow = 60;
    const snapshot = computeRates(s, true);
    expect(snapshot.chargeStrength.get(forge.id)).toBe(1);
    expect(snapshot.forgeRate).toBe(1);
  });

  it("beat one — the first upgrade bumps the synth term and spends the grant", () => {
    const s = fresh();
    const opening = s.modules[0]!;
    const before = computeRates(s, true);
    expect(upgradeModule(s, opening.id).ok).toBe(true);
    const after = computeRates(s, true);
    expect(opening.level).toBe(1);
    expect(after.synths).toBeGreaterThan(before.synths);
    expect(s.nous).toBeCloseTo(BALANCE.openingGrant - levelCost(0), 9);
    expect(s.totalEarned).toBe(0);
  });

  it("the grant and the opening survive a save round-trip", () => {
    const s = fresh();
    const restored = deserialize(serialize(s, 1_000)).state!;
    expect(restored.modules).toHaveLength(1);
    expect(restored.modules[0]!.pos).toEqual(hex(0, 0));
    expect(restored.nous).toBe(BALANCE.openingGrant);
    expect(SAVE_VERSION).toBe(6);
  });
});

describe("purchase windows — all nous spending is upgrade-mode-only (§3)", () => {
  it("live sessions are read-only on every purchase surface", () => {
    const s = fresh();
    s.nous = 1e6;
    startSession(s, 600);
    for (const type of SHELF_TYPES) {
      expect(buyShelfModule(s, type).ok).toBe(false);
    }
    expect(buyCell(s, hex(2, 0)).ok).toBe(false);
    expect(buyActivation(s, "notes").ok).toBe(false);
    expect(buyGoalCapacity(s).ok).toBe(false);
    const opening = s.modules[0]!;
    expect(upgradeModule(s, opening.id).ok).toBe(false);
    expect(s.purchased.forge).toBe(false);
    expect(s.cellsBought).toBe(0);
    expect(s.activatedApps).toHaveLength(0);
    expect(s.goalCapacityBought).toBe(0);
    expect(opening.level).toBe(0);
    endSession(s);
    // Back in upgrade mode the same purchases go through — except the
    // ladder, which sells nothing at launch (ADR-0019): the apps were
    // already free.
    expect(buyShelfModule(s, "forge").ok).toBe(true);
    expect(buyCell(s, hex(2, 0)).ok).toBe(true);
    expect(buyActivation(s, "notes").ok).toBe(false);
    expect(upgradeModule(s, opening.id).ok).toBe(true);
  });

  it("paused sessions are no window either", () => {
    const s = fresh();
    s.nous = 1e6;
    startSession(s, 600);
    pauseSession(s);
    expect(buyShelfModule(s, "generator").ok).toBe(false);
    expect(buyCell(s, hex(2, 0)).ok).toBe(false);
    expect(upgradeModule(s, s.modules[0]!.id).ok).toBe(false);
  });
});

describe("the opening economy", () => {
  it("the grant reaches nothing but the first upgrade", () => {
    const s = fresh();
    const grant = s.nous;
    for (const type of SHELF_TYPES) {
      expect(grant, type).toBeLessThan(BALANCE.shelfPrices[type]);
      expect(buyShelfModule(s, type).ok).toBe(false);
    }
    // The ladder sells nothing, whatever the balance (ADR-0019).
    expect(buyActivation(s, "notes").ok).toBe(false);
    expect(buyActivation(s, "goals").ok).toBe(false);
    expect(cellCost(0)).toBeGreaterThan(grant);
    expect(buyCell(s, hex(2, 0)).ok).toBe(false);
    expect(longGoalCost(0)).toBeGreaterThan(grant);
    expect(buyGoalCapacity(s).ok).toBe(false);
    expect(s.nous).toBe(grant);
  });

  it("the shelf sells the non-synthesizer landscape only — no additive, no spacer", () => {
    expect(SHELF_TYPES).toEqual(["generator", "infusor", "forge"]);
    const s = fresh();
    s.nous = 1e6;
    for (const type of SHELF_TYPES) {
      expect(buyShelfModule(s, type).ok, type).toBe(true);
    }
    const types = new Set(s.modules.map((m) => m.type));
    expect(types.has("focusKeyed")).toBe(true);
    expect(types.has("infusor")).toBe(true);
    expect(types.has("forge")).toBe(true);
    // The shelf-sold additive is retired (ADR-0022): synthesizers come only
    // from the opening grant and forge rolls; the spacer never shelves.
    expect(buyShelfModule(s, "additive" as ShelfType).ok).toBe(false);
    expect(buyShelfModule(s, "spacer" as ShelfType).ok).toBe(false);
  });

  it("each scaler counts only its own purchases", () => {
    const s = fresh();
    s.nous = 1e6;
    buyCell(s, hex(2, 0));
    buyCell(s, hex(1, 1));
    buyShelfModule(s, "generator");
    // Cells ride the cell scaler…
    expect(cellCost(s.cellsBought)).toBe(cellCost(2));
    // …the ladder's rung never moves while it rests empty…
    expect(nextRungCost(s)).toBe(rungCost(1));
    // …and the shelf hides exactly what was acquired.
    expect(SHELF_TYPES.filter((type) => !s.purchased[type])).toEqual(["infusor", "forge"]);
  });
});

describe("the octave-row gate (ADR-0022)", () => {
  it("the opening's rows are gate-paid by the same grant that places the cells", () => {
    const s = fresh();
    expect(s.gatedRows).toEqual([0, 1]);
    s.nous = 1e6;
    // (1,1) is G5 — octave row 1, an opening row: cell price only.
    expect(buyCell(s, hex(1, 1)).ok).toBe(true);
    expect(s.nous).toBeCloseTo(1e6 - cellCost(0), 6);
    expect(s.gatedRows).toEqual([0, 1]);
  });

  it("the first purchase into each new octave row pays a one-time premium on top", () => {
    const s = fresh();
    s.nous = 1e6;
    // (0,2) is C6 — row 2, a new register: cell price plus the row-2 gate.
    const price = cellCost(0) + rowGateCost(2);
    expect(buyCell(s, hex(0, 2)).ok).toBe(true);
    expect(s.nous).toBeCloseTo(1e6 - price, 6);
    expect(s.gatedRows).toEqual([0, 1, 2]);
  });

  it("the gate is one-time per row: later purchases in a paid row pay cell price only", () => {
    const s = fresh();
    s.nous = 1e6;
    buyCell(s, hex(0, 2)); // row 2 — gate paid
    buyCell(s, hex(1, 2)); // row 2 again — no gate
    expect(s.nous).toBeCloseTo(1e6 - cellCost(0) - rowGateCost(2) - cellCost(1), 6);
    expect(s.gatedRows).toEqual([0, 1, 2]);
  });

  it("gate spend never advances the cell purchase scaler", () => {
    const gated = fresh();
    gated.nous = 1e6;
    buyCell(gated, hex(0, 2)); // row 2: gate + cell
    const plain = fresh();
    plain.nous = 1e6;
    buyCell(plain, hex(1, 1)); // row 1: cell only
    // The scaler counts purchases, not nous: both boards sit on rung 1.
    expect(cellCost(gated.cellsBought)).toBe(cellCost(plain.cellsBought));
    expect(gated.cellsBought).toBe(1);
  });

  it("the gate keys on the ledger, not the board's shape — reshaping cannot waive it", () => {
    const s = fresh();
    s.nous = 1e6;
    // Move the whole opening up first (free, ungated): row 2 now sits on
    // the board without ever being paid for…
    expect(returnModule(s, s.modules[0]!.id).ok).toBe(true);
    expect(reshapeCells(s, [hex(0, 2), hex(1, 2), hex(0, 3)]).ok).toBe(true);
    // …but acquisition is what gates: the first purchase into row 3 pays
    // its premium however the board is shaped.
    expect(buyCell(s, hex(1, 3)).ok).toBe(true);
    expect(s.nous).toBeCloseTo(1e6 - cellCost(0) - rowGateCost(3), 6);
    expect(s.gatedRows).toEqual([0, 1, 3]);
  });

  it("moving owned cells between rows is free and ungated — even past every gate", () => {
    const s = fresh();
    s.nous = 1e6;
    buyCell(s, hex(0, 2)); // row 2 exists on the board now
    // Nothing is pinned (ADR-0021): the opening synth returns to the tray
    // so the reshape owns every cell it keeps.
    expect(returnModule(s, s.modules[0]!.id).ok).toBe(true);
    // Reshape the whole board up into rows 2–3: no gate, no charge —
    // gates tax acquisition only, never movement.
    const next = [hex(0, 2), hex(1, 2), hex(0, 3), hex(1, 1)];
    const nousBefore = s.nous;
    expect(s.cells.length).toBe(next.length);
    expect(reshapeCells(s, next).ok).toBe(true);
    expect(s.nous).toBe(nousBefore);
    expect(s.gatedRows).toEqual([0, 1, 2]); // unchanged — nothing new was gated
  });

  it("rows are finite: purchases beyond the band are refused", () => {
    const s = fresh();
    s.nous = 1e9;
    for (const pos of [hex(0, 2), hex(0, 3), hex(0, 4)]) {
      expect(buyCell(s, pos).ok, `${pos.q},${pos.r}`).toBe(true);
    }
    expect(buyCell(s, hex(0, 5)).ok).toBe(false); // row 5 — beyond ±4
    // Columns stop at the circle of fifths too: twelve names, no aliases.
    for (const pos of [hex(2, 0), hex(3, 0), hex(4, 0), hex(5, 0), hex(6, 0)]) {
      expect(buyCell(s, pos).ok, `${pos.q},${pos.r}`).toBe(true);
    }
    expect(buyCell(s, hex(7, -4)).ok).toBe(false); // column 7 — past F♯
  });

  it("the fifths axis is ungated: reached-row columns walk free, however far", () => {
    const s = fresh();
    s.nous = 1e6;
    // Walk left along the row-0 band: F4, B♭4, E♭4, A♭4 — new pitch
    // classes every step, implicit chord-vocabulary access, and no gate
    // ever (the register never changes).
    for (const pos of [hex(-1, 1), hex(-2, 2), hex(-3, 2), hex(-4, 3)]) {
      expect(buyCell(s, pos).ok, `${pos.q},${pos.r}`).toBe(true);
    }
    expect(s.gatedRows).toEqual([0, 1]);
    expect(s.nous).toBeCloseTo(1e6 - cellCost(0) - cellCost(1) - cellCost(2) - cellCost(3), 6);
    // Climbing into a new register is what gates — never the column walk
    // itself: row 2's gate applies wherever its cell sits.
    expect(buyCell(s, hex(0, 2)).ok).toBe(true);
    expect(s.gatedRows).toEqual([0, 1, 2]);
  });

  it("gatedRows persists across a save round-trip and lenient-defaults", () => {
    const s = fresh();
    s.nous = 1e6;
    buyCell(s, hex(0, 2));
    const restored = deserialize(serialize(s, 1_000)).state!;
    expect(restored.gatedRows).toEqual([0, 1, 2]);
    // Absent on a v6 save, the opening's granted rows ride the fresh
    // defaults; a corrupt value lenient-defaults to the empty ledger.
    const file = JSON.parse(serialize(fresh()));
    delete file.state.gatedRows;
    const absent = deserialize(JSON.stringify(file)).state!;
    expect(absent.gatedRows).toEqual([0, 1]);
    file.state.gatedRows = null;
    const corrupt = deserialize(JSON.stringify(file)).state!;
    expect(corrupt.gatedRows).toEqual([]);
  });
});
