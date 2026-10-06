import { describe, expect, it } from "vitest";
import { ARETE_HORIZON } from "./accumulator";
import {
  capacityCeiling,
  capacityDiscountShare,
  nextCapacityPrice,
  nextCeilingPrice,
  nextDiscountPrice,
} from "./capacity";
import { BALANCE } from "./constants";
import {
  buyCapacity,
  buyCapacityCeiling,
  buyCapacityDiscount,
  buyShelfModule,
  endSession,
  placeModule,
  prestige,
  startSession,
} from "./actions";
import { allocateRates, setAllocationEnabled, voiceCapacityOf } from "./economy";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { deserialize, serialize } from "./save";
import type { GameState } from "./types";

// The harmonic-capacity ladder (issue #259, the confirmed design beside
// ADR-0050): global nous Catalog purchases raise every voice's whole-chord
// budget; the Arete offerings raise the ceiling and discount the rungs;
// prestige resets the purchases and returns the voices to one. Prices are
// centralized provisional tuning — these tests pin the ladder's shape and
// honesty, never the figures as settled balance.

function affordable(state: GameState, _rung?: number): void {
  state.nous = BALANCE.capacityPrices.reduce((sum, price) => sum + price, 0) * 2;
}

function allocationCapacityOf(state: GameState): number {
  return allocateRates(state, true).snapshot.allocation!.capacity;
}

describe("the nous capacity ladder (#259)", () => {
  it("spends the quoted price exactly and raises every current and future voice", () => {
    const state = fresh();
    setAllocationEnabled(state, true);
    // A current voice pair already on the board (the opening synth plus a
    // fifth) and a module that joins after the purchase.
    const existing = give(state, "additive", hex(1, 0));
    expect(placeModule(state, existing.id, hex(1, 0)).ok).toBe(true);
    affordable(state, 0);

    const price = nextCapacityPrice(state)!;
    expect(price).toBe(BALANCE.capacityPrices[0]);
    const before = state.nous;
    expect(buyCapacity(state).ok).toBe(true);
    expect(before - state.nous).toBe(price);
    expect(voiceCapacityOf(state)).toBe(2);
    expect(allocationCapacityOf(state)).toBe(2);

    // A future voice opens at the raised budget — no per-module purchase,
    // no re-grant.
    const latecomer = give(state, "additive", hex(0, 1));
    expect(placeModule(state, latecomer.id, hex(0, 1)).ok).toBe(true);
    expect(allocationCapacityOf(state)).toBe(2);
  });

  it("needs only nous and upgrade mode — no earnings gate, no per-module path", () => {
    const state = fresh();
    affordable(state, 0);
    // A fresh save: zero sessions, zero prestiges, and the purchase lands.
    expect(state.sessionsCompleted).toBe(0);
    expect(state.prestiges).toBe(0);
    expect(buyCapacity(state).ok).toBe(true);
    expect(state.capacityBought).toBe(1);
  });

  it("the first-era ladder sells two rungs — capacity two, then three — and then caps", () => {
    const state = fresh();
    affordable(state, 0);
    expect(buyCapacity(state).ok).toBe(true);
    affordable(state, 1);
    expect(nextCapacityPrice(state)).toBe(BALANCE.capacityPrices[1]);
    expect(buyCapacity(state).ok).toBe(true);
    expect(voiceCapacityOf(state)).toBe(3);
    expect(capacityCeiling(state)).toBe(3);
    // Capped: the refusal touches nothing, and no price is quoted.
    affordable(state, 2);
    const result = buyCapacity(state);
    expect(result.ok).toBe(false);
    expect(state.capacityBought).toBe(2);
    expect(voiceCapacityOf(state)).toBe(3);
    expect(nextCapacityPrice(state)).toBeNull();
  });

  it("refuses in flow mode without spending", () => {
    const state = fresh();
    affordable(state, 0);
    expect(startSession(state, null).ok).toBe(true);
    const before = state.nous;
    const result = buyCapacity(state);
    expect(result.ok).toBe(false);
    expect(state.nous).toBe(before);
    expect(state.capacityBought).toBe(0);
    endSession(state);
    expect(buyCapacity(state).ok).toBe(true);
  });
});

describe("the Arete offerings (#259)", () => {
  it("ceiling unlocks open rungs three and four — prototype maximums four and five", () => {
    const state = fresh();
    state.capacityBought = 2;
    expect(nextCapacityPrice(state)).toBeNull();
    state.arete = 100;
    expect(buyCapacityCeiling(state).ok).toBe(true);
    expect(capacityCeiling(state)).toBe(4);
    expect(nextCapacityPrice(state)).toBe(BALANCE.capacityPrices[2]);
    expect(buyCapacityCeiling(state).ok).toBe(true);
    expect(capacityCeiling(state)).toBe(5);
    // Both owned: the ladder is complete and priced at its last rung.
    const result = buyCapacityCeiling(state);
    expect(result.ok).toBe(false);
    expect(nextCeilingPrice(state)).toBeNull();
    expect(state.arete).toBe(100 - BALANCE.capacityCeilingCosts[0]! - BALANCE.capacityCeilingCosts[1]!);
  });

  it("discounts take 20%, then 40% off the original prices, and cost less than their ceilings", () => {
    // The agreed shape: every ceiling more expensive than the discount
    // standing beside it; the shares replace, never stack past, 40%.
    expect(BALANCE.capacityCeilingCosts[0]).toBeGreaterThan(BALANCE.capacityDiscountCosts[0]!);
    expect(BALANCE.capacityCeilingCosts[1]).toBeGreaterThan(BALANCE.capacityDiscountCosts[1]!);
    const state = fresh();
    expect(capacityDiscountShare(state)).toBe(0);
    state.arete = 100;
    expect(buyCapacityDiscount(state).ok).toBe(true);
    expect(capacityDiscountShare(state)).toBeCloseTo(0.2, 9);
    expect(buyCapacityDiscount(state).ok).toBe(true);
    expect(capacityDiscountShare(state)).toBeCloseTo(0.4, 9);
    expect(buyCapacityDiscount(state).ok).toBe(false);
    expect(nextDiscountPrice(state)).toBeNull();
    // The quoted price folds the share in and never undercharges whole nous.
    expect(nextCapacityPrice(state)).toBe(Math.ceil(BALANCE.capacityPrices[0]! * 0.6));
  });

  it("the offerings are Arete-paid and refuse in flow mode", () => {
    const state = fresh();
    state.arete = 1;
    expect(startSession(state, null).ok).toBe(true);
    expect(buyCapacityCeiling(state).ok).toBe(false);
    expect(buyCapacityDiscount(state).ok).toBe(false);
    expect(state.arete).toBe(1);
    endSession(state);
    state.arete = BALANCE.capacityDiscountCosts[0]!;
    expect(buyCapacityDiscount(state).ok).toBe(true);
    expect(buyCapacityCeiling(state).ok).toBe(false);
  });

  it("the nous ladder keeps its own upgrade-mode gate beside the offerings", () => {
    const state = fresh();
    state.arete = 100;
    affordable(state, 0);
    // Purchases ride the ordinary boundary check like every feat-bearing
    // action — unlocks ride home through the same door.
    const result = buyCapacity(state);
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.unlocked)).toBe(true);
  });
});

describe("prestige and the ladder (#259)", () => {
  it("resets purchased capacity to one and keeps the permanent offerings", () => {
    const state = fresh();
    setAllocationEnabled(state, true);
    state.arete = 100;
    affordable(state, 0);
    expect(buyCapacity(state).ok).toBe(true);
    expect(buyCapacity(state).ok).toBe(true);
    expect(buyCapacityCeiling(state).ok).toBe(true);
    expect(buyCapacityDiscount(state).ok).toBe(true);
    expect(voiceCapacityOf(state)).toBe(3);
    // The board keeps its shape through the reset: an owned shelf module
    // stays owned, placed where it was.
    state.nous += BALANCE.shelfPrices.infusor;
    expect(buyShelfModule(state, "infusor").ok).toBe(true);
    const infusor = state.modules.find((m) => m.type === "infusor")!;
    expect(placeModule(state, infusor.id, hex(1, 0)).ok).toBe(true);
    const sessionsBefore = state.sessionsCompleted;
    state.eraEarned = ARETE_HORIZON;
    expect(prestige(state).ok).toBe(true);
    expect(state.capacityBought).toBe(0);
    expect(voiceCapacityOf(state)).toBe(1);
    expect(allocationCapacityOf(state)).toBe(1);
    // The permanent ladders survive: ceilings and discounts stay owned, and
    // the ceiling they raised still stands.
    expect(state.capacityCeilings).toBe(1);
    expect(state.capacityDiscounts).toBe(1);
    expect(capacityCeiling(state)).toBe(4);
    expect(capacityDiscountShare(state)).toBeCloseTo(0.2, 9);
    // The board, its placement, and the life record persist.
    expect(state.modules.some((m) => m.type === "infusor" && m.pos !== null)).toBe(true);
    expect(state.sessionsCompleted).toBe(sessionsBefore);
  });

  it("the reset era repurchases through the discounted, ceiling-raised ladder", () => {
    const state = fresh();
    state.arete = 100;
    affordable(state, 0);
    buyCapacity(state);
    buyCapacity(state);
    buyCapacityCeiling(state);
    buyCapacityDiscount(state);
    state.eraEarned = ARETE_HORIZON;
    prestige(state);
    // One purchase after the reset: the ladder starts over at its first
    // rung, discounted by the owned 20% offering.
    affordable(state);
    const quoted = nextCapacityPrice(state)!;
    expect(quoted).toBe(Math.ceil(BALANCE.capacityPrices[0]! * 0.8));
    const before = state.nous;
    expect(buyCapacity(state).ok).toBe(true);
    expect(before - state.nous).toBe(quoted);
    expect(voiceCapacityOf(state)).toBe(2);
  });
});

describe("the ladder on the save surface (#259)", () => {
  it("upgrade ownership survives save and reload", () => {
    const state = fresh();
    state.arete = 100;
    affordable(state, 0);
    buyCapacity(state);
    buyCapacity(state);
    buyCapacityCeiling(state);
    buyCapacityDiscount(state);
    const loaded = deserialize(serialize(state)).state!;
    expect(loaded.capacityBought).toBe(2);
    expect(loaded.capacityCeilings).toBe(1);
    expect(loaded.capacityDiscounts).toBe(1);
    expect(voiceCapacityOf(loaded)).toBe(3);
    expect(capacityDiscountShare(loaded)).toBeCloseTo(0.2, 9);
  });

  it("older saves default to zero without resetting unrelated resources", () => {
    const state = fresh();
    affordable(state, 0);
    buyCapacity(state);
    state.nous = 4321;
    // Strip the ladder's fields exactly as a pre-ladder save would lack
    // them, then load.
    const file = JSON.parse(serialize(state));
    delete file.state.capacityBought;
    delete file.state.capacityCeilings;
    delete file.state.capacityDiscounts;
    const loaded = deserialize(JSON.stringify(file)).state!;
    expect(loaded.capacityBought).toBe(0);
    expect(loaded.capacityCeilings).toBe(0);
    expect(loaded.capacityDiscounts).toBe(0);
    expect(loaded.nous).toBe(4321);
    expect(voiceCapacityOf(loaded)).toBe(1);
  });

  it("corrupt counts degrade to zero, and an over-purchased save clamps at the ceiling", () => {
    const file = JSON.parse(serialize(fresh()));
    file.state.capacityBought = "many";
    file.state.capacityCeilings = -3;
    file.state.capacityDiscounts = Number.NaN;
    const loaded = deserialize(JSON.stringify(file)).state!;
    expect(loaded.capacityBought).toBe(0);
    expect(loaded.capacityCeilings).toBe(0);
    expect(loaded.capacityDiscounts).toBe(0);
    const wild = fresh();
    wild.capacityBought = 99;
    expect(voiceCapacityOf(wild)).toBe(capacityCeiling(wild));
  });
});
