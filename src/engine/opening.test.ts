import { describe, expect, it } from "vitest";
import {
  acknowledgeWelcome,
  buyActivation,
  buyCell,
  buyGoalCapacity,
  buyShelfModule,
  endSession,
  pauseSession,
  placeModule,
  startSession,
  upgradeModule,
} from "./actions";
import { SHELF_TYPES, BALANCE, SAVE_VERSION } from "./constants";
import { nextRungCost } from "./apps";
import { cellCost, computeRates, levelCost, longGoalCost, rungCost } from "./economy";
import { fresh } from "./fixtures";
import { adjacent, hex } from "./hex";
import { isCarrier } from "./state";
import { serialize, deserialize } from "./save";
import type { ShelfType } from "./types";

describe("the opening grant (ADR-0013)", () => {
  it("equals exactly the Carrier's first upgrade price", () => {
    const s = fresh();
    expect(s.nous).toBe(levelCost(0));
    const carrier = s.modules.find(isCarrier)!;
    expect(levelCost(carrier.level)).toBe(s.nous);
  });

  it("prices the Carrier's first upgrade below the shelf floor, so the grant is pre-affordable", () => {
    const shelfFloor = Math.min(...Object.values(BALANCE.shelfPrices));
    expect(levelCost(0)).toBeLessThan(shelfFloor);
    const s = fresh();
    const carrier = s.modules.find(isCarrier)!;
    expect(s.nous).toBeGreaterThanOrEqual(levelCost(carrier.level));
  });

  it("is a grant, not earnings: the accumulator starts empty", () => {
    const s = fresh();
    expect(s.totalEarned).toBe(0);
  });
});

describe("beat one — the first upgrade", () => {
  it("bumps the carrier term and returns the balance to zero", () => {
    const s = fresh();
    const carrier = s.modules.find(isCarrier)!;
    const before = computeRates(s, true);
    expect(upgradeModule(s, carrier.id).ok).toBe(true);
    const after = computeRates(s, true);
    expect(carrier.level).toBe(1);
    expect(after.carrier).toBeGreaterThan(before.carrier);
    expect(s.nous).toBe(0);
    expect(s.totalEarned).toBe(0);
  });

  it("the welcome card is acknowledged once and never returns", () => {
    const s = fresh();
    expect(s.welcomeAcked).toBe(false);
    expect(acknowledgeWelcome(s).ok).toBe(true);
    expect(s.welcomeAcked).toBe(true);
  });

  it("the grant and the welcome ack survive a save round-trip", () => {
    const s = fresh();
    acknowledgeWelcome(s);
    const restored = deserialize(serialize(s, 1_000)).state!;
    expect(restored.welcomeAcked).toBe(true);
    expect(restored.nous).toBe(levelCost(0));
    expect(SAVE_VERSION).toBe(5);
  });
});

describe("purchase windows — all nous spending is upgrade-mode-only (§3)", () => {
  it("live sessions are read-only on every purchase surface", () => {
    const s = fresh();
    s.nous = 1e6;
    startSession(s, 600);
    expect(buyShelfModule(s, "forge").ok).toBe(false);
    expect(buyCell(s, hex(2, 0)).ok).toBe(false);
    expect(buyActivation(s, "notes").ok).toBe(false);
    expect(buyGoalCapacity(s).ok).toBe(false);
    const carrier = s.modules.find(isCarrier)!;
    expect(upgradeModule(s, carrier.id).ok).toBe(false);
    expect(s.purchased.forge).toBe(false);
    expect(s.cellsBought).toBe(0);
    expect(s.activatedApps).toHaveLength(0);
    expect(s.goalCapacityBought).toBe(0);
    expect(carrier.level).toBe(0);
    endSession(s);
    // Back in upgrade mode the same purchases go through — except the
    // ladder, which sells nothing at launch (ADR-0019): the apps were
    // already free.
    expect(buyShelfModule(s, "forge").ok).toBe(true);
    expect(buyCell(s, hex(2, 0)).ok).toBe(true);
    expect(buyActivation(s, "notes").ok).toBe(false);
    expect(upgradeModule(s, carrier.id).ok).toBe(true);
  });

  it("paused sessions are no window either", () => {
    const s = fresh();
    s.nous = 1e6;
    startSession(s, 600);
    pauseSession(s);
    expect(buyShelfModule(s, "generator").ok).toBe(false);
    expect(buyCell(s, hex(2, 0)).ok).toBe(false);
    expect(upgradeModule(s, s.modules.find(isCarrier)!.id).ok).toBe(false);
  });
});

describe("scaler interactions at the opening", () => {
  it("the grant reaches nothing but the Carrier's first upgrade", () => {
    const s = fresh();
    const grant = s.nous;
    for (const type of Object.keys(BALANCE.shelfPrices) as ShelfType[]) {
      expect(grant).toBeLessThan(BALANCE.shelfPrices[type]);
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

  it("each scaler counts only its own purchases", () => {
    const s = fresh();
    s.nous = 1e6;
    buyCell(s, hex(2, 0));
    buyCell(s, hex(3, 0));
    buyShelfModule(s, "generator");
    // Cells ride the cell scaler…
    expect(cellCost(s.cellsBought)).toBe(cellCost(2));
    // …the ladder's rung never moves while it rests empty…
    expect(nextRungCost(s)).toBe(rungCost(1));
    // …and the shelf hides exactly what was acquired.
    expect(SHELF_TYPES.filter((type) => !s.purchased[type])).toEqual(["additive", "infusor", "forge"]);
  });
});

describe("the opening board (ADR-0018)", () => {
  it("opens on a triangle: every cell touches the Carrier and each other", () => {
    const s = fresh();
    expect(s.cells).toHaveLength(3);
    for (const a of s.cells) {
      for (const b of s.cells) {
        if (a === b) continue;
        expect(adjacent(a, b), `${a.q},${a.r} ↔ ${b.q},${b.r}`).toBe(true);
      }
    }
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
});
