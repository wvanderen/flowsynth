import { describe, expect, it } from "vitest";
import { ARETE_HORIZON, horizonReached } from "./accumulator";
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
  buyCatalogEntry,
  buyShelfModule,
  endSession,
  placeModule,
  prestige,
  startSession,
} from "./actions";
import { allocateRates, voiceCapacityOf } from "./economy";
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

function affordable(state: GameState): void {
  state.nous = BALANCE.capacityPrices.reduce((sum, price) => sum + price, 0) * 2;
}

// The offerings' playable path: the Catalog entry is their mandatory
// prerequisite, so every offering purchase in these tests pays it first —
// the harness and the UI buy through the same door.
function enterCatalog(state: GameState): void {
  if (!state.catalogEntryOwned) {
    state.arete = Math.max(state.arete, BALANCE.catalogEntryCost);
    expect(buyCatalogEntry(state).ok).toBe(true);
  }
}

function allocationCapacityOf(state: GameState): number {
  return allocateRates(state, true).snapshot.allocation!.capacity;
}

describe("the nous capacity ladder (#259)", () => {
  it("spends the quoted price exactly and raises every current and future voice", () => {
    const state = fresh();
    // A current voice pair already on the board (the opening synth plus a
    // fifth) and a module that joins after the purchase.
    const existing = give(state, "additive", hex(1, 0));
    expect(placeModule(state, existing.id, hex(1, 0)).ok).toBe(true);
    affordable(state);

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
    affordable(state);
    // A fresh save: zero sessions, zero prestiges, and the purchase lands.
    expect(state.sessionsCompleted).toBe(0);
    expect(state.prestiges).toBe(0);
    expect(buyCapacity(state).ok).toBe(true);
    expect(state.capacityBought).toBe(1);
  });

  it("the first-era ladder sells two rungs — capacity two, then three — and then caps", () => {
    const state = fresh();
    affordable(state);
    expect(buyCapacity(state).ok).toBe(true);
    affordable(state);
    expect(nextCapacityPrice(state)).toBe(BALANCE.capacityPrices[1]);
    expect(buyCapacity(state).ok).toBe(true);
    expect(voiceCapacityOf(state)).toBe(3);
    expect(capacityCeiling(state)).toBe(3);
    // Capped: the refusal touches nothing, and no price is quoted.
    affordable(state);
    const result = buyCapacity(state);
    expect(result.ok).toBe(false);
    expect(state.capacityBought).toBe(2);
    expect(voiceCapacityOf(state)).toBe(3);
    expect(nextCapacityPrice(state)).toBeNull();
  });

  it("refuses in flow mode without spending", () => {
    const state = fresh();
    affordable(state);
    expect(startSession(state, null).ok).toBe(true);
    const before = state.nous;
    const result = buyCapacity(state);
    expect(result.ok).toBe(false);
    expect(state.nous).toBe(before);
    expect(state.capacityBought).toBe(0);
    endSession(state);
    expect(buyCapacity(state).ok).toBe(true);
  });

  it("refuses when the bank cannot cover the quoted price — no partial spend", () => {
    const state = fresh();
    const price = nextCapacityPrice(state)!;
    state.nous = price - 1;
    const result = buyCapacity(state);
    expect(result.ok).toBe(false);
    expect(state.nous).toBe(price - 1);
    expect(state.capacityBought).toBe(0);
    // One nous short at the discounted rung refuses the same way.
    enterCatalog(state);
    state.arete = BALANCE.capacityDiscountCosts[0]!;
    expect(buyCapacityDiscount(state).ok).toBe(true);
    const discounted = nextCapacityPrice(state)!;
    expect(discounted).toBeLessThan(price);
    state.nous = discounted - 1;
    expect(buyCapacity(state).ok).toBe(false);
    expect(state.nous).toBe(discounted - 1);
  });
});

describe("the Arete offerings (#259)", () => {
  it("ceiling unlocks open rungs three and four — prototype maximums four and five", () => {
    const state = fresh();
    state.capacityBought = 2;
    expect(nextCapacityPrice(state)).toBeNull();
    state.arete = 100;
    enterCatalog(state);
    expect(buyCapacityCeiling(state).ok).toBe(true);
    expect(capacityCeiling(state)).toBe(4);
    expect(nextCapacityPrice(state)).toBe(BALANCE.capacityPrices[2]);
    expect(buyCapacityCeiling(state).ok).toBe(true);
    expect(capacityCeiling(state)).toBe(5);
    // Both owned: the ladder is complete and priced at its last rung.
    const result = buyCapacityCeiling(state);
    expect(result.ok).toBe(false);
    expect(nextCeilingPrice(state)).toBeNull();
    expect(state.arete).toBe(100 - BALANCE.capacityCeilingCosts[0]! - BALANCE.capacityCeilingCosts[1]! - BALANCE.catalogEntryCost);
  });

  it("discounts take 20%, then 40% off the original prices, and cost less than their ceilings", () => {
    // The agreed shape: every ceiling more expensive than the discount
    // standing beside it; the shares replace, never stack past, 40%.
    expect(BALANCE.capacityCeilingCosts[0]).toBeGreaterThan(BALANCE.capacityDiscountCosts[0]!);
    expect(BALANCE.capacityCeilingCosts[1]).toBeGreaterThan(BALANCE.capacityDiscountCosts[1]!);
    const state = fresh();
    expect(capacityDiscountShare(state)).toBe(0);
    state.arete = 100;
    enterCatalog(state);
    expect(buyCapacityDiscount(state).ok).toBe(true);
    expect(capacityDiscountShare(state)).toBeCloseTo(0.2, 9);
    expect(buyCapacityDiscount(state).ok).toBe(true);
    expect(capacityDiscountShare(state)).toBeCloseTo(0.4, 9);
    expect(buyCapacityDiscount(state).ok).toBe(false);
    expect(nextDiscountPrice(state)).toBeNull();
    // The quoted price folds the share in and never undercharges whole nous.
    expect(nextCapacityPrice(state)).toBe(Math.ceil(BALANCE.capacityPrices[0]! * 0.6));
  });

  it("the offerings stand behind the Catalog entry (issue #262 rerun gate)", () => {
    // The Arete face is a lock screen until the entry is bought: the
    // capacity offerings render only past it, so the engine refuses them
    // on the same terms. The reviewed harness bought discounts without
    // entry — claims 1+2 (three Arete) cannot pay entry (1) plus the
    // first discount (3); this pins the playable order.
    const state = fresh();
    state.arete = BALANCE.capacityDiscountCosts[0]!;
    const refused = buyCapacityDiscount(state);
    expect(refused.ok).toBe(false);
    expect(state.arete).toBe(BALANCE.capacityDiscountCosts[0]!);
    expect(state.capacityDiscounts).toBe(0);
    expect(buyCapacityCeiling(state).ok).toBe(false);
    // Entry first, then the discount still waits for its full price.
    expect(buyCatalogEntry(state).ok).toBe(true);
    expect(state.arete).toBe(BALANCE.capacityDiscountCosts[0]! - BALANCE.catalogEntryCost);
    expect(buyCapacityDiscount(state).ok).toBe(false);
    state.arete += 1; // the next claim arrives
    expect(buyCapacityDiscount(state).ok).toBe(true);
  });

  it("the offerings are Arete-paid and refuse in flow mode", () => {
    const state = fresh();
    state.arete = 1;
    expect(buyCatalogEntry(state).ok).toBe(true);
    expect(startSession(state, null).ok).toBe(true);
    expect(buyCapacityCeiling(state).ok).toBe(false);
    expect(buyCapacityDiscount(state).ok).toBe(false);
    expect(state.arete).toBe(0);
    endSession(state);
    state.arete = BALANCE.capacityDiscountCosts[0]!;
    expect(buyCapacityDiscount(state).ok).toBe(true);
    expect(buyCapacityCeiling(state).ok).toBe(false);
  });

  it("the nous ladder keeps its own upgrade-mode gate beside the offerings", () => {
    const state = fresh();
    state.arete = 100;
    affordable(state);
    enterCatalog(state);
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
    state.arete = 100;
    affordable(state);
    enterCatalog(state);
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
    affordable(state);
    enterCatalog(state);
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
    affordable(state);
    enterCatalog(state);
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
    affordable(state);
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

  it("a pre-calibration bank survives the rebased horizon with its board and record, door open (#262)", () => {
    // The rebased horizon (issue #262) moves the crossing from 1e23 to
    // 7e6. A save banked under the old figure — an ordinary save that
    // practiced for tens of hours, or a development save — carries an
    // eraEarned far past the new line: the door stands open at first
    // load. The documented consequence is that crossing, never a wipe:
    // the board, its inventory, the tray, and the life record all
    // survive into the next era, and — the save never having bought the
    // horizon break — the claim banks exactly the linear base.
    const state = fresh();
    affordable(state);
    state.eraEarned = 1e23;
    state.totalEarned = 1e23;
    const file = JSON.parse(serialize(state));
    const loaded = deserialize(JSON.stringify(file)).state!;
    expect(horizonReached(loaded)).toBe(true);
    expect(loaded.horizonBroken).toBe(false);
    const sessionsBefore = loaded.sessionsCompleted;
    const cellsBefore = loaded.cells.length;
    expect(prestige(loaded).ok).toBe(true);
    expect(loaded.arete).toBe(1);
    expect(loaded.eraEarned).toBe(0);
    expect(horizonReached(loaded)).toBe(false);
    expect(loaded.cells.length).toBe(cellsBefore);
    expect(loaded.sessionsCompleted).toBe(sessionsBefore);
    expect(loaded.totalEarned).toBe(1e23);
  });

  it("a broken-horizon bank claims the logarithmic overfill, capped at the windfall limit (#262)", () => {
    // The other migration mode: a save that owns the horizon break and
    // carries overfill past the rebased line reads ADR-0042's scaling
    // claim, not the linear base — potentially the capped windfall. The
    // board, tray and life record survive exactly as in the linear mode;
    // only the payout differs. Documented in the tuning record rather
    // than promised as universally linear.
    const build = (prestiges: number, eraEarned: number) => {
      const state = fresh();
      state.prestiges = prestiges;
      state.horizonBroken = true;
      state.eraEarned = eraEarned;
      state.totalEarned = eraEarned;
      state.achievements["first-light"] = 1;
      state.cells.push(hex(5, 0));
      give(state, "additive", hex(5, 0));
      return deserialize(serialize(state)).state!;
    };
    // A decade of overfill: R = 1000, so n=1 claims 1 + log10(1000) = 4.
    const decade = build(0, 7e9);
    expect(horizonReached(decade)).toBe(true);
    expect(prestige(decade).ok).toBe(true);
    expect(decade.arete).toBe(4);
    expect(decade.horizonBroken).toBe(true);
    expect(decade.eraEarned).toBe(0);
    expect(decade.cells.some((c) => c.q === 5 && c.r === 0)).toBe(true);
    expect(decade.modules.some((m) => m.type === "additive" && m.pos !== null)).toBe(true);
    expect(decade.achievements["first-light"]).toBe(1);
    // The old 1e23 bank under the break: R ≈ 1.43e16, so n=1 claims 17.
    const legacy = build(0, 1e23);
    expect(prestige(legacy).ok).toBe(true);
    expect(legacy.arete).toBe(17);
    // The windfall cap: a late-game count (n=25) at extreme overfill
    // lands exactly on the 25-Arete limit, never past it.
    const capped = build(24, 1e23);
    expect(prestige(capped).ok).toBe(true);
    expect(capped.arete).toBe(BALANCE.horizonBreakClaimCap);
  });

  it("corrupt counts degrade to zero, over-purchased rungs clamp at the ceiling, and over-owned offerings clamp at the ladder", () => {
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
    // An implausible offering count clamps at its ladder's end, so the
    // owned read can never disagree with the prices and shares quoted.
    const hoard = fresh();
    hoard.capacityCeilings = 99;
    hoard.capacityDiscounts = 99;
    const reloaded = deserialize(serialize(hoard)).state!;
    expect(reloaded.capacityCeilings).toBe(BALANCE.capacityCeilingCosts.length);
    expect(reloaded.capacityDiscounts).toBe(BALANCE.capacityDiscountCosts.length);
    expect(capacityDiscountShare(reloaded)).toBeCloseTo(0.4, 9);
    expect(nextCeilingPrice(reloaded)).toBeNull();
  });
});
