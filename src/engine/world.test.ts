import { describe, expect, it } from "vitest";
import {
  advanceWorldCharge,
  attackPowerOf,
  columnCost,
  combatBoundaryOf,
  eligibleTargetsOf,
  enemyDefAt,
  honeCostOf,
  splitColumnSupply,
  syncWorldDiscoveries,
  worldFactorOf,
} from "./world";
import { bankableClaimOf, frontierEntitlement, pendingClaimOf, ARETE_HORIZON } from "./accumulator";
import { buyChargeColumn, buyHoneRank, placeWorldOccupant, prestige, retrieveWorldOccupant, setWeaponTargetPriority, startSession } from "./actions";
import { advance, advanceBreather } from "./advance";
import { BALANCE, WORLD_ENEMIES } from "./constants";
import { createInitialState, createWeapon } from "./state";
import { fresh, give } from "./fixtures";
import { serialize, deserialize } from "./save";
import { adjacent, hex } from "./hex";
import { octaveRowOf } from "./lattice";
import { resolveHonestyReport } from "./trust";
import type { GameState, Hex, WeaponCopy } from "./types";

// The World engine and economy (issue #425, ADR-0074): the frontier Arete
// contract, the authored encounters, the automatic combat on trusted time,
// and the conserved Column lift.

// A flow session over the bare opening board — the one constant-rate
// producer, no generators, no temporal profiles, no goals — so the walk's
// only boundaries are the World's own. The Octave the opening pair forms
// pre-seeds its discovery-ledger entry, so the library's per-class boost
// stands from tick zero instead of landing at the first span's boundary:
// exactness tests measure a settled rate.
function flowing(state: GameState = fresh()): GameState {
  state.chordDiscovery["Octave"] = { formed: true, firstFormedAt: 0, rootsHeard: 1, roots: [0] };
  startSession(state, null);
  return state;
}

// A weapon copy, placed and stocked — the rig for combat tests.
function grantWeapon(state: GameState, pos: Hex | null, store = BALANCE.world.storageCap): WeaponCopy {
  const weapon = createWeapon(state, "chargeBlade");
  weapon.pos = pos;
  weapon.store = store;
  state.world.weapons.push(weapon);
  return weapon;
}

// Reveals an authored enemy and scars it to the given HP.
function reveal(state: GameState, key: string, hp?: number): void {
  const live = state.world.enemies[key]!;
  live.discovered = true;
  if (hp !== undefined) live.hp = hp;
}

describe("the frontier entitlement curve (issue #425)", () => {
  it("pays nothing below the 1T entry and jumps to the starter grant at it", () => {
    expect(frontierEntitlement(BALANCE.world.entryNous - 1)).toBe(0);
    expect(frontierEntitlement(BALANCE.world.entryNous)).toBe(2);
    expect(frontierEntitlement(0)).toBe(0);
  });

  it("pays its slope per decade past the entry, fractionally valued", () => {
    expect(frontierEntitlement(BALANCE.world.entryNous * 10)).toBe(4);
    expect(frontierEntitlement(BALANCE.world.entryNous * 1e8)).toBe(18);
    expect(frontierEntitlement(BALANCE.world.entryNous * Math.sqrt(10))).toBeCloseTo(3, 10);
  });

  it("is increasing with diminishing marginal reward per nous", () => {
    // The log curve's per-decade step is flat by shape; its marginal
    // reward per unit of earned nous is what diminishes.
    const marginal = (x: number) => frontierEntitlement(x + BALANCE.world.entryNous) - frontierEntitlement(x);
    expect(marginal(BALANCE.world.entryNous)).toBeGreaterThan(marginal(BALANCE.world.entryNous * 10));
    expect(marginal(BALANCE.world.entryNous * 10)).toBeGreaterThan(marginal(BALANCE.world.entryNous * 100));
  });

  it("constructs the entry grant to cover the Charge Column's price", () => {
    expect(frontierEntitlement(BALANCE.world.entryNous)).toBeGreaterThanOrEqual(columnCost(0));
  });

  it("the horizon line stays the prestige gate and is never rescaled by the World work", () => {
    // findings.md's provenance gate: the 7e6 line is capacity-calibrated
    // evidence, and the World experiment must not scale it.
    expect(ARETE_HORIZON).toBe(7e6);
  });
});

describe("the pending claim and its banking (issue #425)", () => {
  it("reads the entitlement difference against the claimed frontier, never negative", () => {
    const s = fresh();
    expect(pendingClaimOf(s)).toBe(0);
    s.eraEarned = BALANCE.world.entryNous * 10;
    expect(pendingClaimOf(s)).toBe(4);
    s.world.frontier = 5;
    expect(pendingClaimOf(s)).toBe(0);
  });

  it("banks whole Arete on prestige and advances the frontier by exactly the banked step", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.eraEarned = BALANCE.world.entryNous * Math.sqrt(10); // E = 3
    s.eraEarned = Math.max(s.eraEarned, ARETE_HORIZON);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(3);
    expect(s.world.frontier).toBe(3);
  });

  it("partition independence: arbitrary prestige splittings telescope to the single-climb total, within 1e-10", () => {
    // One climb from the entry to depth 8, claimed in one prestige.
    const once = fresh();
    once.mode = "upgrade";
    once.eraEarned = BALANCE.world.entryNous * 1e8;
    const singleTotal = bankableClaimOf(once);
    // The same climb split at every prefix, and at a scattered sample of
    // splittings, must land the same total: claims telescope because the
    // frontier advances by whole banked steps.
    const depths = [1, 2, 3, 5, 6.5, 7.25, 8];
    for (const cut of depths) {
      const split = fresh();
      split.mode = "upgrade";
      for (const depth of depths.filter((d) => d <= cut)) {
        split.eraEarned = BALANCE.world.entryNous * 10 ** Math.min(depth, 8);
        expect(prestige(split).ok).toBe(true);
      }
      split.eraEarned = BALANCE.world.entryNous * 1e8;
      expect(prestige(split).ok).toBe(true);
      expect(Math.abs(split.arete - singleTotal)).toBeLessThan(1e-10);
    }
  });

  it("fractional entitlement is preserved: the sub-unit remainder stays pending, never lost", () => {
    const s = fresh();
    s.mode = "upgrade";
    // E = 2.5 at a quarter decade: two whole Arete bank, the half stays.
    s.eraEarned = BALANCE.world.entryNous * 10 ** 0.25;
    expect(pendingClaimOf(s)).toBeCloseTo(2.5, 10);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(2);
    expect(s.world.frontier).toBe(2);
    // Returning to the same depth banks nothing — the remainder alone
    // cannot clear a whole unit.
    s.eraEarned = BALANCE.world.entryNous * 10 ** 0.25;
    expect(pendingClaimOf(s)).toBeCloseTo(0.5, 10);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(2);
    // Surpassing the depth completes the fraction exactly: floor sums
    // recombine to the single-climb figure.
    s.eraEarned = BALANCE.world.entryNous * 10;
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(4);
  });

  it("repeating a previously reached depth awards nothing, shallower still nothing", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.eraEarned = BALANCE.world.entryNous * 100;
    expect(prestige(s).ok).toBe(true);
    const banked = s.arete;
    expect(banked).toBe(6);
    // The exact same depth: high-water, no reward.
    s.eraEarned = BALANCE.world.entryNous * 100;
    expect(pendingClaimOf(s)).toBeCloseTo(0, 10);
    expect(bankableClaimOf(s)).toBe(0);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(banked);
    // A shallower era: still nothing.
    s.eraEarned = BALANCE.world.entryNous * 10;
    expect(pendingClaimOf(s)).toBe(0);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(banked);
  });

  it("a zero-claim reset stays valid: nothing banks, the frontier holds", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.eraEarned = BALANCE.world.entryNous * 10;
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(4);
    s.eraEarned = ARETE_HORIZON; // a fresh, shallow era past the door
    expect(bankableClaimOf(s)).toBe(0);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(4);
    expect(s.world.frontier).toBe(4);
    expect(s.prestiges).toBe(2);
  });
});

describe("the first World-eligible claim (issue #425, priority 2)", () => {
  function eligible(): GameState {
    const s = fresh();
    s.mode = "upgrade";
    s.eraEarned = BALANCE.world.entryNous;
    return s;
  }

  it("banks at least the Column's price and grants the starter weapon outright", () => {
    const s = eligible();
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBeGreaterThanOrEqual(columnCost(0));
    expect(s.world.starterWeaponGranted).toBe(true);
    expect(s.world.weapons).toHaveLength(1);
    expect(s.world.weapons[0]!.type).toBe("chargeBlade");
    // A granted copy: it waits in the World tray, owing nothing to any
    // roll queue or purchase.
    expect(s.world.weapons[0]!.pos).toBeNull();
    expect(s.bankedRolls).toHaveLength(0);
  });

  it("grants exactly once, ever: no later claim or prestige grants a weapon", () => {
    const s = eligible();
    expect(prestige(s).ok).toBe(true);
    s.eraEarned = BALANCE.world.entryNous * 1e5;
    expect(prestige(s).ok).toBe(true);
    expect(s.world.weapons).toHaveLength(1);
    // Even a manufactured flag cannot mint a second: the grant reads the
    // flag, and the flag round-trips the save.
    const loaded = deserialize(serialize(s, 5_000)).state!;
    expect(loaded.world.starterWeaponGranted).toBe(true);
    expect(loaded.world.weapons).toHaveLength(1);
  });

  it("a pre-entry first prestige grants nothing and the grant still waits", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.eraEarned = ARETE_HORIZON;
    expect(prestige(s).ok).toBe(true);
    expect(s.world.starterWeaponGranted).toBe(false);
    expect(s.world.weapons).toHaveLength(0);
    s.eraEarned = BALANCE.world.entryNous;
    expect(prestige(s).ok).toBe(true);
    expect(s.world.weapons).toHaveLength(1);
  });
});

describe("the authored roster and its reachability invariant (issue #425, priority 3)", () => {
  it("every enemy sits within the available octave rows and beside an obtainable cell", () => {
    const rowFloor = -BALANCE.launchRowsBelow - 1;
    const rowCeil = BALANCE.launchRowsAbove + 1;
    for (const def of WORLD_ENEMIES) {
      const row = octaveRowOf(def.pos);
      expect(row).toBeGreaterThanOrEqual(rowFloor);
      expect(row).toBeLessThanOrEqual(rowCeil);
      // Reachable: an owned neighboring cell is obtainable through
      // ordinary expansion — a neighbor inside the purchasable range.
      const reachable = [def.pos]
        .flatMap((pos) => [-1, 0, 1].flatMap((dq) => [-1, 0, 1].map((dr) => hex(pos.q + dq, pos.r + dr))))
        .filter((n) => !(n.q === def.pos.q && n.r === def.pos.r))
        .some((n) => {
          const neighborRow = octaveRowOf(n);
          const inRows = neighborRow >= rowFloor && neighborRow <= rowCeil;
          const inColumns = n.q >= -5 && n.q <= 6;
          return inRows && inColumns;
        });
      expect(reachable).toBe(true);
    }
  });

  it("the first enemy is reachable from the opening footprint under its penalty", () => {
    const opening = createInitialState().cells;
    const first = WORLD_ENEMIES[0]!;
    expect(opening.some((cell) => adjacent(cell, first.pos))).toBe(true);
    expect(first.threshold).toBe(BALANCE.world.entryNous);
  });

  it("thresholds, positions, and stats repeat unchanged each era — prestige never raises enemy strength", () => {
    const s = fresh();
    s.mode = "upgrade";
    reveal(s, "w0", 3);
    s.eraEarned = BALANCE.world.entryNous * 100;
    expect(prestige(s).ok).toBe(true);
    for (const def of WORLD_ENEMIES) {
      expect(s.world.enemies[def.key]).toEqual({ discovered: false, hp: def.maxHp });
    }
  });
});

describe("discovery (issue #425, priorities 3 and 5)", () => {
  it("all thresholds crossed in one move discover together — sequential ordering is rejected", () => {
    const s = fresh();
    s.eraEarned = BALANCE.world.entryNous * 500; // under w3's threshold: three at once
    expect(syncWorldDiscoveries(s)).toBe(3);
    expect(s.world.enemies.w0!.discovered).toBe(true);
    expect(s.world.enemies.w1!.discovered).toBe(true);
    expect(s.world.enemies.w2!.discovered).toBe(true);
    expect(s.world.enemies.w3!.discovered).toBe(false);
    // Idempotent.
    expect(syncWorldDiscoveries(s)).toBe(0);
  });

  it("the reveal is the era-earned crossing: production discovers at the boundary, not before", () => {
    const s = flowing();
    const def = WORLD_ENEMIES[0]!;
    // Start the era five produced nous below the reveal, and measure the
    // board's rate on a twin with no World state in play.
    s.eraEarned = def.threshold - 5;
    s.totalEarned = s.eraEarned;
    const twin = flowing();
    advance(twin, 10);
    const rate = twin.eraEarned / 10;
    advance(s, 1000);
    expect(s.world.enemies.w0!.discovered).toBe(true);
    // Nothing past the first threshold discovered: the walk crossed one.
    expect(s.world.enemies.w1!.discovered).toBe(false);
    // The span split at the crossing: the five gap nous banked at full
    // rate, the remainder carried the penalty from the discovery point on.
    // The era started five below the threshold, so the crossing spent the
    // first 5/rate seconds of the window at full production.
    const expected = def.threshold + (1 - BALANCE.world.enemyPenalty) * (rate * 1000 - 5);
    expect(Math.abs(s.eraEarned - expected)).toBeLessThan(1e-9);
  });

  it("the debuff change is a rate boundary at the discovery point: a kill mid-span really changes the remainder", () => {
    const s = flowing();
    give(s, "additive", hex(0, 1)); // widen the owned patch for placement
    const weapon = grantWeapon(s, hex(1, 0));
    reveal(s, "w1"); // adjacent to (1, 0), full HP 18: five attacks
    // Measure the rate on a twin built identically but targetless, so the
    // measurement runs carry no combat and no penalty.
    const twin = flowing();
    give(twin, "additive", hex(0, 1));
    grantWeapon(twin, hex(1, 0));
    advance(twin, 10);
    const rate = twin.eraEarned / 10;
    const penalized = rate * (1 - BALANCE.world.enemyPenalty);
    const bonus = rate * (1 + BALANCE.world.enemyBonus);
    // Five attacks at 60s cadence: the kill lands at t = 300 exactly.
    advance(s, 600);
    expect(s.world.enemies.w1!.hp).toBe(0);
    const expected = penalized * 300 + bonus * 300;
    expect(Math.abs(s.eraEarned - expected)).toBeLessThan(1e-6);
    expect(weapon.store).toBe(BALANCE.world.storageCap - 5);
  });
});

describe("multiplicative penalty stacking (issue #425, priority 3)", () => {
  it("every living discovered enemy multiplies its remaining-production factor", () => {
    const s = fresh();
    expect(worldFactorOf(s)).toBe(1);
    reveal(s, "w0");
    expect(worldFactorOf(s)).toBeCloseTo(0.8, 10);
    reveal(s, "w1");
    expect(worldFactorOf(s)).toBeCloseTo(0.8 * 0.8, 10);
  });

  it("nine living enemies floor at 0.8⁹, never an additive -180%", () => {
    const s = fresh();
    for (const def of WORLD_ENEMIES) reveal(s, def.key);
    expect(worldFactorOf(s)).toBeCloseTo(0.8 ** 9, 10);
    expect(worldFactorOf(s)).toBeCloseTo(0.134217728, 9);
  });

  it("defeat replaces the penalty with the era bonus; mixed boards multiply both", () => {
    const s = fresh();
    reveal(s, "w0", 0); // defeated: ×1.08
    reveal(s, "w1", 5); // alive: ×0.8
    expect(worldFactorOf(s)).toBeCloseTo(1.08 * 0.8, 10);
  });

  it("the factor lands on the nous rate alone — the snapshot carries it, the legs multiply out", () => {
    const twin = flowing();
    advance(twin, 10);
    const rate = twin.eraEarned / 10;
    const s = flowing();
    reveal(s, "w0");
    advance(s, 10);
    expect(Math.abs(s.eraEarned - rate * (1 - BALANCE.world.enemyPenalty) * 10)).toBeLessThan(1e-9);
  });
});

describe("the Charge Column's conservation (issue #425, priority 6)", () => {
  it("splits a supply equally among consumers with space", () => {
    const split = splitColumnSupply(9, new Map([["a", 10], ["b", 10]]));
    expect(split.accepted.get("a")).toBeCloseTo(4.5, 10);
    expect(split.accepted.get("b")).toBeCloseTo(4.5, 10);
    expect(split.wasted).toBeCloseTo(0, 10);
  });

  it("redistributes overflow to consumers still able to accept", () => {
    const split = splitColumnSupply(9, new Map([["small", 2], ["large", 10]]));
    expect(split.accepted.get("small")).toBeCloseTo(2, 10);
    expect(split.accepted.get("large")).toBeCloseTo(7, 10);
    expect(split.wasted).toBeCloseTo(0, 10);
  });

  it("full storage wastes no share while another consumer can accept", () => {
    const split = splitColumnSupply(6, new Map([["full", 0], ["open", 10]]));
    expect(split.accepted.get("full") ?? 0).toBeCloseTo(0, 10);
    expect(split.accepted.get("open")).toBeCloseTo(6, 10);
    expect(split.wasted).toBeCloseTo(0, 10);
  });

  it("starvation wastes exactly what nobody could take", () => {
    const split = splitColumnSupply(6, new Map([["a", 1], ["b", 2]]));
    expect(split.accepted.get("a")).toBeCloseTo(1, 10);
    expect(split.accepted.get("b")).toBeCloseTo(2, 10);
    expect(split.wasted).toBeCloseTo(3, 10);
  });

  it("conservation is an invariant: accepted plus wasted equals copied, whatever the shape", () => {
    const shapes: [number, [string, number][]][] = [
      [0, [["a", 5]]],
      [1e-9, [["a", 5]]],
      [100, []],
      [7.25, [["a", 0.5], ["b", 0.5], ["c", 0.5]]],
      [12, [["a", 3], ["b", 0], ["c", 9.5], ["d", 1]]],
      [1e6, [["a", 1]]],
    ];
    for (const [supply, space] of shapes) {
      const split = splitColumnSupply(supply, new Map(space));
      let accepted = 0;
      for (const amount of split.accepted.values()) accepted += amount;
      expect(accepted + split.wasted).toBeCloseTo(supply, 10);
    }
  });

  it("the lift copies the module cell's received charge without draining the module beneath", () => {
    const s = flowing();
    const generator = give(s, "focusKeyed", hex(1, 0));
    generator.reserve = 100000;
    give(s, "additive", hex(0, 1)); // a voice receiving the generator's charge
    // Twin board, no World face: the module layer reads identically.
    const plain = deserialize(serialize(s, 1)).state!;
    s.world.columns.push({ id: "col1", pos: hex(0, 1) });
    grantWeapon(s, hex(1, 0), 0);
    grantWeapon(plain, hex(1, 0), 0);
    advance(s, 60);
    advance(plain, 60);
    // The copy lifts exactly what the cell received over the span, and the
    // module beneath keeps its own received strength — the states differ
    // only in the World face.
    expect(s.world.weapons[0]!.store).toBeGreaterThan(0);
    expect(plain.world.weapons[0]!.store).toBe(0);
    // Conservation at the seam: the weapon gained exactly what the split
    // accepted, the rest (if any) wasted — never minted.
    expect(s.world.weapons[0]!.store).toBeLessThanOrEqual(BALANCE.world.storageCap);
  });

  it("Columns never relay to Columns: a lone Column's supply is wasted, not forwarded", () => {
    const s = flowing();
    const generator = give(s, "focusKeyed", hex(1, 0));
    generator.reserve = 1000;
    const column = { id: "col1", pos: hex(0, 1) };
    s.world.columns.push(column);
    s.world.columns.push({ id: "col2", pos: hex(1, 1) });
    const snapshot = { chargeStrength: new Map([[generator.id, 5]]) } as never;
    const before = s.world.weapons.length;
    advanceWorldCharge(s, snapshot, 60);
    expect(s.world.weapons.length).toBe(before);
    expect(s.world.weapons).toHaveLength(0);
  });
});

describe("automatic combat on trusted time (issue #425, priority 4)", () => {
  // The weapon's rig cell: the opening synth's own coordinate — its World
  // face hosts the copy, and (−1, 0) is hex-adjacent to it.
  const RIG = hex(0, 0);
  it("weapons attack adjacent discovered undefeated enemies on the capped cadence", () => {
    const s = flowing();
    grantWeapon(s, RIG);
    reveal(s, "w0"); // adjacent to the rig cell, HP 12, attack 4 → three attacks
    advance(s, 181); // ticks land at 60s, 120s, and exactly 180s
    expect(s.world.enemies.w0!.hp).toBe(12 - 4 * 3);
  });

  it("the cadence caps attacks: more time, same fired ticks once the target falls", () => {
    const s = flowing();
    const weapon = grantWeapon(s, RIG);
    reveal(s, "w0");
    advance(s, 600);
    // Three attacks kill (t = 60, 120, 180); the later ticks fire at
    // nothing and are wasted.
    expect(weapon.store).toBe(BALANCE.world.storageCap - 3);
    expect(s.world.enemies.w0!.hp).toBe(0);
  });

  it("the type's attack power reads the Hone ranks — every copy of the type", () => {
    const s = fresh();
    expect(attackPowerOf(s, "chargeBlade")).toBe(BALANCE.world.attackBase);
    s.world.hone.chargeBlade = 2;
    expect(attackPowerOf(s, "chargeBlade")).toBe(BALANCE.world.attackBase + 2 * BALANCE.world.honeAttackPerRank);
  });

  it("an unfed weapon holds fire: no charge, no attack, no damage", () => {
    const s = flowing();
    grantWeapon(s, RIG, 0);
    reveal(s, "w0");
    advance(s, 600);
    expect(s.world.enemies.w0!.hp).toBe(12);
  });

  it("weapons attack only adjacent enemies: range is adjacency, nothing further", () => {
    const s = flowing();
    grantWeapon(s, RIG);
    reveal(s, "w2"); // at (2, −1): not adjacent to the rig cell
    advance(s, 600);
    expect(s.world.enemies.w2!.hp).toBe(WORLD_ENEMIES[2]!.maxHp);
  });

  it("undiscovered enemies are never attacked", () => {
    const s = flowing();
    grantWeapon(s, RIG, BALANCE.world.storageCap);
    advance(s, 600); // w0 adjacent but still reserved: silent until revealed
    expect(s.world.enemies.w0!.hp).toBe(WORLD_ENEMIES[0]!.maxHp);
    expect(s.world.enemies.w0!.discovered).toBe(false);
  });

  it("defeat skips to the next eligible target in preference order", () => {
    const s = flowing();
    // (1, 0) is owned and hex-adjacent to both w1 (1, 1) and w2 (2, −1).
    grantWeapon(s, hex(1, 0));
    reveal(s, "w2", 0); // defeated: skipped
    reveal(s, "w1", 8);
    advance(s, 60);
    expect(s.world.enemies.w1!.hp).toBe(8 - BALANCE.world.attackBase);
    expect(s.world.enemies.w2!.hp).toBe(0);
  });

  it("target priority orders the eligible set, and retargeting between sessions persists", () => {
    const s = fresh();
    // (1, 0) is owned and hex-adjacent to both w1 (1, 1) and w2 (2, −1).
    const weapon = grantWeapon(s, hex(1, 0));
    reveal(s, "w2", 4);
    reveal(s, "w1", 8);
    // Unconfigured, the authored roster order leads: w1 before w2.
    expect(eligibleTargetsOf(s, weapon)).toEqual(["w1", "w2"]);
    // The stored priority leads: w2 first — a between-sessions pick, so
    // the state sits in upgrade mode for the setting, then flow fights.
    expect(setWeaponTargetPriority(s, weapon.id, ["w2"]).ok).toBe(true);
    expect(eligibleTargetsOf(s, weapon)).toEqual(["w2", "w1"]);
    expect(weapon.targetPriority).toEqual(["w2"]);
    // Unknown keys drop; duplicates collapse.
    expect(setWeaponTargetPriority(s, weapon.id, ["nope", "w1", "w1"]).ok).toBe(true);
    expect(weapon.targetPriority).toEqual(["w1"]);
    // Between sessions: the pick survives a save round-trip.
    const loaded = deserialize(serialize(s, 5_000)).state!;
    expect(loaded.world.weapons[0]!.targetPriority).toEqual(["w1"]);
    // And the fight reads the pick: the reloaded save flows and engages
    // the priority's head.
    const fighter = deserialize(serialize(s, 5_001)).state!;
    expect(startSession(fighter, null).ok).toBe(true);
    advance(fighter, 60);
    expect(fighter.world.enemies.w1!.hp).toBe(8 - BALANCE.world.attackBase);
    expect(fighter.world.enemies.w2!.hp).toBe(4);
  });

  it("combat advances on flow-live spans only: provisional time produces but never fights", () => {
    const s = flowing();
    const weapon = grantWeapon(s, RIG);
    reveal(s, "w0");
    const hpBefore = s.world.enemies.w0!.hp;
    const storeBefore = weapon.store;
    const cooldownBefore = weapon.cooldown;
    advance(s, 600, Math.random, "provisional");
    expect(s.world.enemies.w0!.hp).toBe(hpBefore);
    expect(weapon.store).toBe(storeBefore);
    expect(weapon.cooldown).toBe(cooldownBefore);
    // The bucket holds the produced nous; the live walk fights.
    expect(s.session!.accounting.poolSeconds).toBeGreaterThan(0);
    advance(s, 60);
    expect(s.world.enemies.w0!.hp).toBeLessThan(hpBefore);
  });

  it("breathers fight beside production, with no class accrual anywhere near the leg", () => {
    const s = fresh();
    s.mode = "breather";
    s.breather = { startedAt: 0, allowanceSeconds: 600, elapsed: 0 };
    grantWeapon(s, RIG);
    reveal(s, "w0");
    advanceBreather(s, 185);
    expect(s.world.enemies.w0!.hp).toBe(12 - BALANCE.world.attackBase * 3);
  });

  it("upgrade mode and pauses never reach the walk: the phase gates are the engine's own", () => {
    const s = fresh();
    s.mode = "upgrade";
    grantWeapon(s, hex(0, 1));
    reveal(s, "w0");
    expect(advance(s, 600).nousEarned).toBe(0);
    s.mode = "paused";
    expect(advance(s, 600).nousEarned).toBe(0);
    expect(s.world.enemies.w0!.hp).toBe(12);
  });

  it("honesty-credited minutes credit practice but never retro-fight", () => {
    const s = flowing();
    grantWeapon(s, hex(0, 1));
    reveal(s, "w0");
    // Away time past a plan goes provisional: produces into the bucket.
    advance(s, 600, Math.random, "provisional");
    const hpBefore = s.world.enemies.w0!.hp;
    const result = resolveHonestyReport(s, "full");
    expect(result.ok).toBe(true);
    // The minutes credit — and the bucket's landing discovers crossings —
    // but no damage, victory, or bonus rides the reconciliation.
    expect(s.world.enemies.w0!.hp).toBe(hpBefore);
    expect(s.world.enemies.w0!.discovered).toBe(true);
  });

  it("the bucket's one-move landing discovers every threshold it crossed together", () => {
    const s = flowing();
    grantWeapon(s, hex(0, 1));
    reveal(s, "w0");
    // Hand the bucket a figure that clears three thresholds at once — the
    // same move that settles the pool lands all three reveals.
    s.session!.accounting.bucketNous = BALANCE.world.entryNous * 1e3;
    s.session!.accounting.poolSeconds = 600;
    resolveHonestyReport(s, "full");
    expect(s.world.enemies.w0!.discovered).toBe(true);
    expect(s.world.enemies.w1!.discovered).toBe(true);
    expect(s.world.enemies.w2!.discovered).toBe(true);
  });
});

describe("the combat clock in the span walk (issue #425, priority 5)", () => {
  it("the next armed tick is a boundary; unarmed weapons hold none", () => {
    const s = flowing();
    const weapon = grantWeapon(s, hex(0, 0));
    reveal(s, "w0");
    expect(combatBoundaryOf(s)).toBe(BALANCE.world.attackCadenceSeconds);
    advance(s, 60);
    expect(weapon.cooldown).toBe(0);
    // Fed but targetless: no boundary.
    s.world.enemies.w0!.hp = 0;
    expect(combatBoundaryOf(s)).toBe(Infinity);
  });

  it("a multi-day away gap with live combat resolves iteratively: bounded, complete, exact at the kills", () => {
    const s = flowing();
    give(s, "additive", hex(0, 1));
    const generator = give(s, "focusKeyed", hex(1, 0));
    generator.reserve = 500000;
    // The column rides the additive's cell — the voice receiving the
    // generator's charge — and feeds the weapon deployed beside the
    // generator, whose World face shares the cell.
    s.world.columns.push({ id: "col1", pos: hex(0, 1) });
    const weapon = grantWeapon(s, hex(1, 0), 0);
    reveal(s, "w1", 18 * 45); // a long kill: 180 attacks at power 4
    expect(() => advance(s, 3 * 86400)).not.toThrow();
    // The iterative walk finished the kill it was fed for, never wedged,
    // never recursed, and left sane clocks behind.
    expect(s.world.enemies.w1!.hp).toBe(0);
    expect(weapon.store).toBeGreaterThanOrEqual(0);
    expect(weapon.store).toBeLessThanOrEqual(BALANCE.world.storageCap);
    expect(weapon.cooldown).toBeGreaterThanOrEqual(0);
    expect(weapon.cooldown).toBeLessThan(BALANCE.world.attackCadenceSeconds);
  });
});

describe("weapons store; Arete upgrades the type (issue #425, priority 7)", () => {
  it("storage caps the store; extra supply wastes through the conservation split", () => {
    const s = flowing();
    const generator = give(s, "focusKeyed", hex(1, 0));
    generator.reserve = 100000;
    give(s, "additive", hex(0, 1));
    s.world.columns.push({ id: "col1", pos: hex(0, 1) }); // over the receiving voice
    const weapon = grantWeapon(s, hex(1, 0), 0); // beside the column, on the generator's World face
    advance(s, 600);
    expect(weapon.store).toBeGreaterThan(0);
    expect(weapon.store).toBeLessThanOrEqual(BALANCE.world.storageCap + 1e-9);
    // It never exceeds the cap, whatever the supply keeps lifting.
    advance(s, 600);
    expect(weapon.store).toBeLessThanOrEqual(BALANCE.world.storageCap + 1e-9);
  });

  it("the store persists between sessions and resets on prestige; the copy and its priority persist", () => {
    const s = fresh();
    s.mode = "upgrade";
    grantWeapon(s, hex(0, 1), 17);
    s.world.starterWeaponGranted = true; // the rig copy stands in for the grant
    s.cells.push(hex(0, 1));
    s.eraEarned = BALANCE.world.entryNous;
    expect(prestige(s).ok).toBe(true);
    expect(s.world.weapons).toHaveLength(1); // the copy persists
    expect(s.world.weapons[0]!.store).toBe(0); // stored World charge resets
    expect(s.world.weapons[0]!.cooldown).toBe(0);
  });

  it("Hone ranks persist through prestige and price on the authored ladder", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.arete = 100;
    expect(honeCostOf(s, "chargeBlade")).toBe(BALANCE.world.honeCosts[0]);
    expect(buyHoneRank(s, "chargeBlade").ok).toBe(true);
    expect(buyHoneRank(s, "chargeBlade").ok).toBe(true);
    expect(s.world.hone.chargeBlade).toBe(2);
    s.eraEarned = BALANCE.world.entryNous;
    expect(prestige(s).ok).toBe(true);
    expect(s.world.hone.chargeBlade).toBe(2);
    // The ladder ends: past the authored rungs nothing is sold.
    s.world.hone.chargeBlade = BALANCE.world.honeCosts.length;
    expect(honeCostOf(s, "chargeBlade")).toBeNull();
    expect(buyHoneRank(s, "chargeBlade").ok).toBe(false);
  });
});

describe("no refunds — World purchases are permanent (issue #425, priority 8)", () => {
  it("Columns buy on the escalating ladder, persist through prestige, and Arete never returns", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.arete = 20;
    expect(columnCost(0)).toBe(BALANCE.world.columnFirstPrice);
    expect(buyChargeColumn(s).ok).toBe(true);
    expect(buyChargeColumn(s).ok).toBe(true);
    expect(columnCost(2)).toBe(BALANCE.world.columnFirstPrice * BALANCE.world.columnPriceGrowth ** 2);
    expect(s.arete).toBe(20 - columnCost(0) - columnCost(1));
    const columnsBefore = s.world.columns.length;
    s.eraEarned = BALANCE.world.entryNous * 100;
    expect(prestige(s).ok).toBe(true);
    expect(s.world.columns.length).toBe(columnsBefore);
    // The reset mints nothing back: the balance only ever grew by the
    // claim, and no refund action exists to reverse a purchase.
    expect(s.arete).toBe(20 - columnCost(0) - columnCost(1) + 6);
  });

  it("placement is between-sessions only, on owned cells, never on reserved enemy cells", () => {
    const s = fresh();
    const weapon = grantWeapon(s, null);
    expect(placeWorldOccupant(s, weapon.id, hex(5, 5)).ok).toBe(false); // unowned
    expect(placeWorldOccupant(s, weapon.id, hex(-1, 0)).ok).toBe(false); // w0's cell
    s.cells.push(hex(0, 1));
    s.mode = "flow";
    expect(placeWorldOccupant(s, weapon.id, hex(0, 1)).ok).toBe(false); // flow lock
    s.mode = "upgrade";
    expect(placeWorldOccupant(s, weapon.id, hex(0, 1)).ok).toBe(true);
    expect(weapon.pos).toEqual(hex(0, 1));
    const second = grantWeapon(s, null, 0);
    expect(placeWorldOccupant(s, second.id, hex(0, 1)).ok).toBe(false); // occupied
    expect(retrieveWorldOccupant(s, weapon.id).ok).toBe(true);
    expect(weapon.pos).toBeNull();
    expect(placeWorldOccupant(s, second.id, hex(0, 1)).ok).toBe(true);
  });

  it("the enemy cell blocks World placement even after defeat — the encounter remains", () => {
    const s = fresh();
    s.cells.push(hex(-1, 0)); // the player owns the cell beneath w0
    reveal(s, "w0", 0);
    const weapon = grantWeapon(s, null);
    expect(placeWorldOccupant(s, weapon.id, hex(-1, 0)).ok).toBe(false);
    expect(enemyDefAt(hex(-1, 0))!.key).toBe("w0");
  });
});

describe("the prestige round-trip with World persistence (issue #425, priority 9)", () => {
  it("purchases and the frontier survive; encounters, damage, stored charge, and era bonuses reset", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.arete = 30;
    expect(buyChargeColumn(s).ok).toBe(true);
    expect(buyHoneRank(s, "chargeBlade").ok).toBe(true);
    const weapon = grantWeapon(s, null);
    s.cells.push(hex(0, 1));
    expect(placeWorldOccupant(s, weapon.id, hex(0, 1)).ok).toBe(true);
    setWeaponTargetPriority(s, weapon.id, ["w2", "w0"]);
    // Era state: discoveries, damage, a defeat's bonus, a stocked store.
    reveal(s, "w0", 3);
    reveal(s, "w1", 0);
    reveal(s, "w2");
    weapon.store = 9;
    weapon.cooldown = 30;
    s.eraEarned = BALANCE.world.entryNous * 10;
    expect(prestige(s).ok).toBe(true);
    // Persisted: the frontier, the purchase, the copy with its pick.
    expect(s.world.frontier).toBe(4);
    expect(s.world.columns).toHaveLength(1);
    expect(s.world.hone.chargeBlade).toBe(1);
    expect(s.world.weapons[0]!.id).toBe(weapon.id);
    expect(s.world.weapons[0]!.targetPriority).toEqual(["w2", "w0"]);
    expect(s.world.weapons[0]!.pos).toEqual(hex(0, 1));
    // Reset: reserved enemies at fixed stats, no charge, no clock.
    for (const def of WORLD_ENEMIES) {
      expect(s.world.enemies[def.key]).toEqual({ discovered: false, hp: def.maxHp });
    }
    expect(s.world.weapons[0]!.store).toBe(0);
    expect(s.world.weapons[0]!.cooldown).toBe(0);
    // And the whole surface round-trips the save.
    const loaded = deserialize(serialize(s, 5_000)).state!;
    expect(loaded.world).toEqual(s.world);
  });

  it("the starter grant is never re-granted after a round-trip prestige", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.eraEarned = BALANCE.world.entryNous;
    expect(prestige(s).ok).toBe(true);
    expect(s.world.weapons).toHaveLength(1);
    const loaded = deserialize(serialize(s, 5_000)).state!;
    loaded.mode = "upgrade";
    loaded.eraEarned = BALANCE.world.entryNous * 1e4;
    expect(prestige(loaded).ok).toBe(true);
    expect(loaded.world.weapons).toHaveLength(1);
  });
});

describe("the save schema (issue #425)", () => {
  it("a save written before the World layer loads with a fresh surface", () => {
    const file = JSON.parse(serialize(fresh(), 5_000));
    delete file.state.world;
    const loaded = deserialize(JSON.stringify(file)).state!;
    expect(loaded.world.frontier).toBe(0);
    expect(loaded.world.starterWeaponGranted).toBe(false);
    expect(loaded.world.columns).toEqual([]);
    expect(loaded.world.weapons).toEqual([]);
    expect(loaded.world.enemies.w0).toEqual({ discovered: false, hp: WORLD_ENEMIES[0]!.maxHp });
  });

  it("corrupt World figures re-default; unknown enemy keys drop; overfill clamps", () => {
    const file = JSON.parse(serialize(fresh(), 5_000));
    file.state.world = {
      frontier: "deep",
      starterWeaponGranted: true,
      columns: [{ id: "c1", pos: { q: 0, r: 1 } }, { id: 9 }],
      weapons: [{ id: "w1", type: "chargeBlade", pos: null, store: 9999, cooldown: 97, targetPriority: ["w0", "ghost", "w0"] }],
      hone: { chargeBlade: 99 },
      enemies: { w0: { discovered: true, hp: -5 }, ghost: { discovered: true, hp: 1 } },
    };
    const loaded = deserialize(JSON.stringify(file)).state!;
    expect(loaded.world.frontier).toBe(0);
    expect(loaded.world.starterWeaponGranted).toBe(true);
    expect(loaded.world.columns).toEqual([{ id: "c1", pos: { q: 0, r: 1 } }]);
    expect(loaded.world.weapons).toHaveLength(1);
    expect(loaded.world.weapons[0]!.store).toBe(BALANCE.world.storageCap);
    expect(loaded.world.weapons[0]!.cooldown).toBe(97 % BALANCE.world.attackCadenceSeconds);
    expect(loaded.world.weapons[0]!.targetPriority).toEqual(["w0"]);
    expect(loaded.world.hone.chargeBlade).toBe(BALANCE.world.honeCosts.length);
    expect(loaded.world.enemies.w0).toEqual({ discovered: true, hp: 0 });
    expect(loaded.world.enemies.ghost).toBeUndefined();
    expect(Object.keys(loaded.world.enemies)).toHaveLength(WORLD_ENEMIES.length);
  });

  it("a pre-World save carrying the retired Horizon break flag loads without it", () => {
    const file = JSON.parse(serialize(fresh(), 5_000));
    file.state.horizonBroken = true;
    const loaded = deserialize(JSON.stringify(file)).state!;
    expect((loaded as unknown as Record<string, unknown>).horizonBroken).toBeUndefined();
    expect(loaded.world.frontier).toBe(0);
  });
});

describe("shipped tuning defaults are hypothesis knobs — calibration unavailable", () => {
  // The re-derivation of recoverability under the no-refund economy had
  // not landed when these shipped (findings.md's provenance section
  // records no current-engine calibration and no playtest export). Every
  // figure here is pinned as a hypothesis: changing one must fail this
  // suite and force a fresh citation, never silently claim recoverability.
  it("the frontier curve ships the log candidate from findings.md, flagged", () => {
    expect(BALANCE.world.entryNous).toBe(1e12);
    expect(BALANCE.world.claimBase).toBe(2);
    expect(BALANCE.world.claimDepthSlope).toBe(2);
  });

  it("the encounter table ships findings.md's nine fixed enemies, flagged", () => {
    expect(WORLD_ENEMIES).toHaveLength(9);
    WORLD_ENEMIES.forEach((def, i) => {
      expect(def.threshold).toBe(1e12 * 10 ** i);
      expect(def.maxHp).toBeCloseTo(12 * 1.5 ** i, 9);
      expect(def.penalty).toBe(0.2);
      expect(def.bonus).toBe(0.08);
    });
  });

  it("the combat figures ship findings.md's cadence hypothesis, flagged", () => {
    expect(BALANCE.world.attackCost).toBe(1);
    expect(BALANCE.world.attackCadenceSeconds).toBe(60);
    expect(BALANCE.world.attackBase).toBe(4);
    expect(BALANCE.world.storageCap).toBe(30);
    expect(BALANCE.world.columnFirstPrice).toBe(1);
  });
});
