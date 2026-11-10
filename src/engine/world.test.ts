import { describe, expect, it } from "vitest";
import {
  advanceWorldCharge,
  attackPowerOf,
  bandBoundarySeconds,
  columnLiftsOf,
  combatBoundaryOf,
  eligibleTargetsOf,
  enemyDefAt,
  enemyDepthOf,
  enemyPenaltyOf,
  honeCostOf,
  splitColumnSupply,
  syncWorldDiscoveries,
  worldBoundarySeconds,
  worldFactorOf,
} from "./world";
import { bankableClaimOf, frontierEntitlement, pendingClaimOf, ARETE_HORIZON } from "./accumulator";
import { buyChargeColumn, buyHoneRank, placeWorldOccupant, prestige, reshapeCells, retrieveWorldOccupant, setWeaponTargetPriority, startSession } from "./actions";
import { advance, advanceBreather, emptyAdvanceResult, sumResults } from "./advance";
import { BALANCE, WORLD_ENEMIES } from "./constants";
import { syncRates } from "./economy";
import { createInitialState, createWeapon } from "./state";
import { fresh, give } from "./fixtures";
import { serialize, deserialize } from "./save";
import { adjacent, hex, neighbors } from "./hex";
import { octaveRowOf, positionInRange } from "./lattice";
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

// The charged rig: a host voice, a fed generator, the Column over the
// host, and the store-empty weapon beside both — the board shape the
// charge-and-combat cases share.
function chargedRig(): GameState {
  const s = flowing();
  give(s, "additive", hex(0, 1));
  const generator = give(s, "focusKeyed", hex(1, 0));
  generator.reserve = 500000;
  s.world.columns.push({ id: "col1", pos: hex(0, 1) });
  grantWeapon(s, hex(1, 0), 0);
  return s;
}

// Reveals an authored enemy and scars it to the given HP.
function reveal(state: GameState, key: string, hp?: number): void {
  const live = state.world.enemies[key]!;
  live.discovered = true;
  if (hp !== undefined) live.hp = hp;
}

describe("the frontier entitlement curve (issue #425)", () => {
  it("pays nothing below the World entry and jumps to the starter grant at it", () => {
    expect(frontierEntitlement(BALANCE.world.entryNous - 1)).toBe(0);
    expect(frontierEntitlement(BALANCE.world.entryNous)).toBe(2);
    expect(frontierEntitlement(0)).toBe(0);
  });

  it("pays its slope per decade past the entry, fractionally valued", () => {
    const slope = BALANCE.world.claimDepthSlope;
    expect(frontierEntitlement(BALANCE.world.entryNous * 10)).toBe(BALANCE.world.claimBase + slope);
    expect(frontierEntitlement(BALANCE.world.entryNous * 1e8)).toBe(BALANCE.world.claimBase + slope * 8);
    expect(frontierEntitlement(BALANCE.world.entryNous * Math.sqrt(10))).toBeCloseTo(BALANCE.world.claimBase + slope / 2, 10);
  });

  it("is increasing with diminishing marginal reward per nous", () => {
    // The log curve's per-decade step is flat by shape; its marginal
    // reward per unit of earned nous is what diminishes.
    const marginal = (x: number) => frontierEntitlement(x + BALANCE.world.entryNous) - frontierEntitlement(x);
    expect(marginal(BALANCE.world.entryNous)).toBeGreaterThan(marginal(BALANCE.world.entryNous * 10));
    expect(marginal(BALANCE.world.entryNous * 10)).toBeGreaterThan(marginal(BALANCE.world.entryNous * 100));
  });

  it("preserves the first positive entitlement at 20M independently of retired Column prices", () => {
    expect(frontierEntitlement(20_000_000 - 1)).toBe(0);
    expect(frontierEntitlement(20_000_000)).toBe(2);
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
    expect(pendingClaimOf(s)).toBe(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope);
    s.world.frontier = BALANCE.world.claimBase + BALANCE.world.claimDepthSlope + 1;
    expect(pendingClaimOf(s)).toBe(0);
  });

  it("banks whole Arete on prestige and advances the frontier by exactly the banked step", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.eraEarned = BALANCE.world.entryNous * Math.sqrt(10); // E = claimBase + slope/2
    s.eraEarned = Math.max(s.eraEarned, ARETE_HORIZON);
    const whole = Math.floor(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope / 2);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(whole);
    expect(s.world.frontier).toBe(whole);
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
    // E = claimBase + slope/4 at a quarter decade: the whole part banks,
    // the fraction stays. The quarter decade's fraction is .25, .5, or .75
    // — a quarter decade at slope 4 lands exactly whole, so a quarter
    // decade plus an eighth prices the fractional case.
    const e = BALANCE.world.claimBase + BALANCE.world.claimDepthSlope * 0.25;
    const fractional = e % 1;
    const depth = 10 ** (0.25 + (fractional === 0 ? 0.125 : 0));
    const wholeBanked = Math.floor(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope * Math.log10(depth));
    s.eraEarned = BALANCE.world.entryNous * depth;
    expect(pendingClaimOf(s)).toBeCloseTo(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope * Math.log10(depth), 10);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(wholeBanked);
    expect(s.world.frontier).toBe(wholeBanked);
    // Returning to the same depth banks nothing — the remainder alone
    // cannot clear a whole unit.
    s.eraEarned = BALANCE.world.entryNous * depth;
    expect(pendingClaimOf(s)).toBeCloseTo(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope * Math.log10(depth) - wholeBanked, 10);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(wholeBanked);
    // Surpassing the depth completes the fraction exactly: floor sums
    // recombine to the single-climb figure.
    s.eraEarned = BALANCE.world.entryNous * 10;
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(Math.floor(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope));
  });

  it("repeating a previously reached depth awards nothing, shallower still nothing", () => {
    const s = fresh();
    s.mode = "upgrade";
    s.eraEarned = BALANCE.world.entryNous * 100;
    expect(prestige(s).ok).toBe(true);
    const banked = s.arete;
    expect(banked).toBe(Math.floor(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope * 2));
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
    const first = Math.floor(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope);
    expect(s.arete).toBe(first);
    s.eraEarned = ARETE_HORIZON; // a fresh, shallow era past the door
    expect(bankableClaimOf(s)).toBe(0);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(first);
    expect(s.world.frontier).toBe(first);
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

  it("a positive bank permanently unlocks World and grants an unplaced starting kit", () => {
    const s = eligible();
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(2);
    expect(s.world.unlocked).toBe(true);
    expect(s.world.starterColumnGranted).toBe(true);
    expect(s.world.columns).toHaveLength(1);
    expect(s.world.columns[0]!.pos).toBeNull();
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
    // "Obtainable through ordinary expansion" reads the authoritative
    // purchasable predicate at the board's six-row cap — both Row unlocks
    // owned, the furthest state ordinary expansion can reach.
    const maxed = fresh();
    maxed.unlockedRows = [-BALANCE.launchRowsBelow - 1, BALANCE.launchRowsAbove + 1];
    for (const def of WORLD_ENEMIES) {
      const row = octaveRowOf(def.pos);
      expect(row).toBeGreaterThanOrEqual(-BALANCE.launchRowsBelow - 1);
      expect(row).toBeLessThanOrEqual(BALANCE.launchRowsAbove + 1);
      const reachable = neighbors(def.pos).some((n) => positionInRange(maxed, n));
      expect(reachable).toBe(true);
    }
  });

  it("the first enemy is reachable from the opening footprint under its penalty", () => {
    const opening = createInitialState().cells;
    const first = WORLD_ENEMIES[0]!;
    // Adjacent to an owned cell from day one: the penalty is survivable
    // because the attack never waits on expansion.
    expect(opening.some((cell) => adjacent(cell, first.pos))).toBe(true);
    expect(first.threshold).toBe(BALANCE.world.entryNous);
    // The discovery band's pressure is survivable — the deepened bands
    // (issue #489) only bite as the era earns past the reveal.
    expect(BALANCE.world.enemyDepthPenalties[0]).toBeGreaterThan(0);
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
    const expected = def.threshold + (1 - BALANCE.world.enemyDepthPenalties[0]!) * (rate * 1000 - 5);
    expect(Math.abs(s.eraEarned - expected)).toBeLessThan(1e-9);
  });

  it("the penalty change is a rate boundary at the discovery point: a kill mid-span really changes the remainder", () => {
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
    const penalized = rate * (1 - BALANCE.world.enemyDepthPenalties[0]!);
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
    expect(Math.abs(s.eraEarned - rate * (1 - BALANCE.world.enemyDepthPenalties[0]!) * 10)).toBeLessThan(1e-9);
  });
});

// ── Era pressure: the depth bands (issue #489, ADR-0078) ────────────────
describe("era pressure: the depth bands (issue #489)", () => {
  const bands = () => BALANCE.world.enemyDepthPenalties;

  it("each authored step past its own reveal deepens the enemy one band, bounded at the last", () => {
    const s = fresh();
    reveal(s, "w0");
    const def = WORLD_ENEMIES[0]!;
    expect(enemyDepthOf(s, "w0")).toBe(0);
    expect(enemyPenaltyOf(s, "w0")).toBe(bands()[0]);
    BALANCE.world.enemyDepthSteps.forEach((step, i) => {
      s.eraEarned = def.threshold * step;
      expect(enemyDepthOf(s, "w0")).toBe(i + 1);
      expect(enemyPenaltyOf(s, "w0")).toBe(bands()[i + 1]);
    });
    // Bounded: past the last authored step the deepest band holds.
    s.eraEarned = def.threshold * 1e6;
    expect(enemyDepthOf(s, "w0")).toBe(BALANCE.world.enemyDepthSteps.length);
    expect(enemyPenaltyOf(s, "w0")).toBe(bands()[bands().length - 1]);
    // And the factor carries the deepened figure.
    expect(worldFactorOf(s)).toBe(1 - bands()[bands().length - 1]!);
  });

  it("the depth is era-earned's own measure: the wallet never relieves it", () => {
    const def = WORLD_ENEMIES[0]!;
    const poor = fresh();
    reveal(poor, "w0");
    poor.eraEarned = def.threshold * 10;
    const wealthy = fresh();
    reveal(wealthy, "w0");
    wealthy.eraEarned = poor.eraEarned;
    wealthy.nous = 1e15; // a huge balance on the same era measure
    expect(enemyPenaltyOf(wealthy, "w0")).toBe(enemyPenaltyOf(poor, "w0"));
    // Spending the wallet to zero leaves the pressure standing.
    poor.nous = 0;
    expect(enemyPenaltyOf(poor, "w0")).toBe(bands()[1]);
  });

  it("the deepest band leaves a strictly positive floor, per enemy and across all nine", () => {
    const deepest = bands()[bands().length - 1]!;
    expect(1 - deepest).toBeGreaterThan(0);
    const s = fresh();
    s.eraEarned = 1e24; // past every enemy's deepest mark
    for (const def of WORLD_ENEMIES) reveal(s, def.key);
    for (const def of WORLD_ENEMIES) expect(enemyPenaltyOf(s, def.key)).toBe(deepest);
    expect(worldFactorOf(s)).toBeCloseTo((1 - deepest) ** WORLD_ENEMIES.length, 12);
    expect(worldFactorOf(s)).toBeGreaterThan(0);
  });

  it("the next uncrossed band step is a walk boundary; defeated and undiscovered enemies hold none", () => {
    const def = WORLD_ENEMIES[0]!;
    const banded = () => {
      const s = fresh();
      reveal(s, "w0");
      s.eraEarned = def.threshold * 10 - 100;
      return s;
    };
    // 100 earned ν short of the first step mark: 50 s of production at rate 2.
    expect(bandBoundarySeconds(banded(), 2)).toBe(50);
    // The walk's one boundary read carries the band crossing beside the others.
    expect(worldBoundarySeconds(banded(), 2)).toBe(50);
    // An exact mark counts as crossed; the next step owns the boundary.
    const atMark = banded();
    atMark.eraEarned = def.threshold * 10;
    expect(bandBoundarySeconds(atMark, 2)).toBe((def.threshold * 90) / 2);
    // Defeated: no pressure stands, so no band waits.
    const cleared = banded();
    cleared.world.enemies.w0!.hp = 0;
    expect(bandBoundarySeconds(cleared, 2)).toBe(Infinity);
    // Undiscovered: the reveal boundary is the earlier split, always.
    expect(bandBoundarySeconds(fresh(), 2)).toBe(Infinity);
  });

  it("production splits at the band crossing: the remainder earns at the deepened factor", () => {
    const s = flowing();
    reveal(s, "w0");
    const def = WORLD_ENEMIES[0]!;
    s.eraEarned = def.threshold * 10 - 5;
    // Rate from a twin's returned earnings — era-earned itself sits on
    // the 1e13 float grid and is too coarse to measure with.
    const twin = flowing();
    reveal(twin, "w0");
    const rate = advance(twin, 10).nousEarned / 10;
    const earned = advance(s, 1000).nousEarned;
    // The crossing is also w1's reveal (its threshold is the same
    // figure): the factor moves from w0's discovery band to w0's band
    // one beside w1's discovery band — a ratio the expected figure names
    // against the pre-boundary rate. Tolerance: 0.01 earned ν — the
    // era-earned grid at 1e13 can wobble the split instant by about one
    // ulp, and any real mis-split misses by tens.
    const preFactor = 1 - bands()[0]!;
    const postFactor = (1 - bands()[1]!) * (1 - bands()[0]!);
    const expected = 5 + (postFactor / preFactor) * (rate * 1000 - 5);
    expect(Math.abs(earned - expected)).toBeLessThan(0.01);
    expect(enemyDepthOf(s, "w0")).toBe(1);
    expect(s.world.enemies.w1!.discovered).toBe(true);
    expect(enemyDepthOf(s, "w1")).toBe(0);
  });

  it.each(["flow", "breather"] as const)("%s: one long advance and per-second steps across band, discovery, and combat boundaries earn and damage identically", (mode) => {
    const rig = () => {
      const s = chargedRig();
      // Just under the mark that is at once w0's first band step and
      // w1's reveal: the boundary fires inside the window's first
      // second, then the weapon's ticks carry the combat boundaries.
      reveal(s, "w0");
      s.eraEarned = BALANCE.world.entryNous * 10 - 0.05;
      if (mode === "breather") {
        s.mode = "breather";
        s.breather = { startedAt: 0, allowanceSeconds: 400, elapsed: 0 };
      }
      return s;
    };
    const long = rig();
    const short = rig();
    const walk = mode === "flow" ? advance : advanceBreather;
    const earnedLong = walk(long, 400);
    let earnedShort = emptyAdvanceResult();
    for (let second = 0; second < 400; second++) {
      earnedShort = sumResults(earnedShort, walk(short, 1));
    }
    // The band landed and the reveal fired in both — the boundary walk
    // is step-size independent, not a long-run privilege.
    expect(enemyDepthOf(long, "w0")).toBe(1);
    expect(enemyDepthOf(short, "w0")).toBe(1);
    expect(long.world.enemies.w1!.discovered).toBe(true);
    expect(short.world.enemies.w1!.discovered).toBe(true);
    // Earnings agree within 1e-4 ν on a ~150 ν window — the era-earned
    // float grid at 1e13 wobbles the split instant by less than that,
    // and any real boundary mis-walk misses by whole earned ν.
    expect(Math.abs(earnedLong.nousEarned - earnedShort.nousEarned)).toBeLessThan(1e-4);
    // Damage and the combat clock agree exactly: w1 (the only adjacent
    // living enemy) took the same five attacks and fell in both.
    expect(long.world.enemies.w1!.hp).toBe(0);
    expect(short.world.enemies.w1!.hp).toBe(0);
    expect(long.world.weapons[0]!.store).toBe(short.world.weapons[0]!.store);
    expect(long.world.weapons[0]!.cooldown).toBeCloseTo(short.world.weapons[0]!.cooldown, 9);
  });

  it("paused time neither earns nor deepens; provisional time produces but never deepens until its report settles", () => {
    const s = flowing();
    reveal(s, "w0");
    s.eraEarned = BALANCE.world.entryNous * 10 - 1;
    // Paused: no walk, no era movement, no depth change.
    s.mode = "paused";
    expect(advance(s, 600).nousEarned).toBe(0);
    expect(enemyDepthOf(s, "w0")).toBe(0);
    // Provisional: production lands in the bucket at the standing band;
    // era-earned never moves, so no boundary and no deepening mid-gap.
    s.mode = "flow";
    const factorBefore = worldFactorOf(s);
    advance(s, 600, Math.random, "provisional");
    expect(s.session!.accounting.bucketNous).toBeGreaterThan(0);
    expect(enemyDepthOf(s, "w0")).toBe(0);
    expect(worldFactorOf(s)).toBe(factorBefore);
  });

  it("the report's one move lands reveals and bands together; a missed report drops both", () => {
    const settle = (outcome: "full" | "missed") => {
      const s = flowing();
      reveal(s, "w0");
      s.eraEarned = BALANCE.world.entryNous * 10 - 5;
      s.session!.accounting.bucketNous = BALANCE.world.entryNous * 500;
      s.session!.accounting.poolSeconds = 600;
      resolveHonestyReport(s, outcome);
      return s;
    };
    const banked = settle("full");
    // The landing crossed w0's first two marks and w1's and w2's reveals:
    // w0 stands two bands deep, w1 one, w2 at its discovery band.
    expect(banked.world.enemies.w1!.discovered).toBe(true);
    expect(banked.world.enemies.w2!.discovered).toBe(true);
    expect(banked.world.enemies.w3!.discovered).toBe(false);
    expect(enemyDepthOf(banked, "w0")).toBe(2);
    expect(enemyDepthOf(banked, "w1")).toBe(1);
    expect(enemyDepthOf(banked, "w2")).toBe(0);
    // A missed report drops the bucket: no era movement, no reveal, no
    // deepening — rejected practice earns no pressure either way.
    const dropped = settle("missed");
    expect(dropped.world.enemies.w1!.discovered).toBe(false);
    expect(enemyDepthOf(dropped, "w0")).toBe(0);
  });

  it("defeat removes only that enemy's pressure at any depth; prestige restores the era state", () => {
    const s = fresh();
    s.mode = "upgrade";
    reveal(s, "w0", 0); // defeated while its era sits two bands deep
    reveal(s, "w1"); // living at its first band
    s.eraEarned = BALANCE.world.entryNous * 100;
    expect(enemyDepthOf(s, "w0")).toBe(2);
    expect(enemyDepthOf(s, "w1")).toBe(1);
    expect(worldFactorOf(s)).toBeCloseTo((1 + WORLD_ENEMIES[0]!.bonus) * (1 - bands()[1]!), 12);
    expect(s.eraEarned).toBeGreaterThanOrEqual(ARETE_HORIZON);
    expect(prestige(s).ok).toBe(true);
    // The era state returns: the enemy reserved at fixed stats, the bonus
    // gone, and the depth fallen away with the rebased era-earned.
    expect(s.world.enemies.w0).toEqual({ discovered: false, hp: WORLD_ENEMIES[0]!.maxHp });
    expect(s.eraEarned).toBeLessThan(WORLD_ENEMIES[0]!.threshold);
    expect(enemyDepthOf(s, "w0")).toBe(0);
    expect(enemyDepthOf(s, "w1")).toBe(0);
    expect(worldFactorOf(s)).toBe(1);
  });

  it("the depth rides the save's era-earned: a round trip reads the same pressure", () => {
    const s = fresh();
    reveal(s, "w0");
    s.eraEarned = BALANCE.world.entryNous * 1000;
    const loaded = deserialize(serialize(s, 5_000)).state!;
    expect(loaded.world.enemies.w0).toEqual(s.world.enemies.w0);
    expect(enemyDepthOf(loaded, "w0")).toBe(enemyDepthOf(s, "w0"));
    expect(enemyPenaltyOf(loaded, "w0")).toBe(enemyPenaltyOf(s, "w0"));
    expect(worldFactorOf(loaded)).toBe(worldFactorOf(s));
  });

  it("the deepened bands never touch charge, routing, cadence, or damage", () => {
    const rig = (eraEarned: number, revealed: readonly string[]) => {
      const s = chargedRig();
      for (const key of revealed) reveal(s, key);
      s.eraEarned = eraEarned;
      return s;
    };
    const entry = BALANCE.world.entryNous;
    // Shallow era: w0 and w1 at the discovery band. Deep era: w0 two
    // bands down, w1 one, w2 discovered at its own threshold. Reserved:
    // the same board with nothing revealed — the unpressured raw rate.
    const shallow = rig(entry, ["w0", "w1"]);
    const deep = rig(entry * 100, ["w0", "w1", "w2"]);
    const reserved = rig(entry * 100, []);
    const shallowSnapshot = syncRates(shallow);
    const deepSnapshot = syncRates(deep);
    const rawSnapshot = syncRates(reserved);
    // The rate pass carries the deepened bands…
    expect(deepSnapshot.worldFactor).toBeCloseTo((1 - bands()[2]!) * (1 - bands()[1]!) * (1 - bands()[0]!), 12);
    expect(shallowSnapshot.worldFactor).toBeCloseTo((1 - bands()[0]!) ** 2, 12);
    expect(rawSnapshot.worldFactor).toBe(1);
    expect(deepSnapshot.rate).toBeCloseTo(rawSnapshot.rate * deepSnapshot.worldFactor, 9);
    // …and only the rate: the charge legs and the forge meters are
    // identical under every depth.
    expect(deepSnapshot.chargeStrength).toEqual(shallowSnapshot.chargeStrength);
    expect(deepSnapshot.chargeStrength).toEqual(rawSnapshot.chargeStrength);
    expect(deepSnapshot.forgeRate).toBe(shallowSnapshot.forgeRate);
    // Combat under the deepest standing pressure: same cadence, same
    // damage, same store draw.
    advance(shallow, 181);
    advance(deep, 181);
    expect(deep.world.enemies.w1!.hp).toBe(shallow.world.enemies.w1!.hp);
    expect(deep.world.enemies.w1!.hp).toBe(WORLD_ENEMIES[1]!.maxHp - attackPowerOf(deep, "chargeBlade") * 3);
    expect(deep.world.weapons[0]!.store).toBeCloseTo(shallow.world.weapons[0]!.store, 9);
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

  it("an unfed roster wastes exactly what nobody could take", () => {
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

  it.each(["flow", "breather"] as const)("%s combat uses charge earned before a tick regardless of step size", (mode) => {
    const rig = () => {
      const s = flowing();
      give(s, "additive", hex(0, 1));
      give(s, "focusKeyed", hex(1, 0)).reserve = 500000;
      s.world.columns.push({ id: "col1", pos: hex(0, 1) });
      grantWeapon(s, hex(1, 0), 0);
      reveal(s, "w1");
      if (mode === "breather") {
        s.mode = "breather";
        s.breather = { startedAt: 0, allowanceSeconds: 600, elapsed: 0 };
      }
      return s;
    };
    const whole = rig();
    const split = rig();
    const walk = mode === "flow" ? advance : advanceBreather;
    walk(whole, 60);
    walk(split, 30);
    walk(split, 30);
    expect(whole.world.enemies.w1!.hp).toBe(WORLD_ENEMIES.find(e => e.key === "w1")!.maxHp - BALANCE.world.attackBase);
    expect(whole.world.enemies).toEqual(split.world.enemies);
    expect(whole.world.weapons).toEqual(split.world.weapons);
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
  it("Columns cannot be purchased or refunded through the retired purchase action", () => {
    const s = fresh();
    s.arete = 20;
    const before = serialize(s, 5_000);
    expect(buyChargeColumn(s).ok).toBe(false);
    expect(serialize(s, 5_000)).toBe(before);
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

  it.each(["column", "weapon"] as const)("reshaping preserves a deployed %s host", (kind) => {
    const s = fresh();
    for (const module of s.modules) module.pos = null;
    const occupant = kind === "weapon" ? grantWeapon(s, null) : { id: "col1", pos: null as Hex | null };
    if (kind === "column") s.world.columns.push(occupant);
    expect(placeWorldOccupant(s, occupant.id, hex(0, 1)).ok).toBe(true);
    const next = [hex(0, 0), hex(1, 0), hex(1, -1)];
    const before = [...s.cells];
    expect(reshapeCells(s, next).ok).toBe(false);
    expect(s.cells).toEqual(before);
    expect(retrieveWorldOccupant(s, occupant.id).ok).toBe(true);
    expect(reshapeCells(s, next).ok).toBe(true);
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
    s.world.columns.push({ id: "retained-column", pos: null });
    s.world.starterColumnGranted = true;
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
    expect(s.world.frontier).toBe(Math.floor(BALANCE.world.claimBase + BALANCE.world.claimDepthSlope));
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
    expect(loaded.world.columns[0]).toEqual({ id: "c1", pos: { q: 0, r: 1 } });
    expect(loaded.world.columns).toHaveLength(2);
    expect(loaded.world.columns[1]!.pos).toBeNull();
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
  it("the frontier curve ships the calibrated entry and the later-era-calibrated slope", () => {
    // The entry depth is the first-worthwhile-prestige calibration (issue
    // #490): a short hold past the horizon banks the first positive claim
    // around ten credited hours. The slope is the century calibration
    // (issue #492, ADR-0079) as re-priced by the later-era repair (issue
    // #484, ADR-0086): each advance now demands 2/2.5 of a decade of
    // era-earned depth, so the push beside each banked claim carries most
    // of its era's credited time while the claim grant compresses the
    // rebuild that era re-walks.
    expect(BALANCE.world.entryNous).toBe(2e7);
    expect(BALANCE.world.claimBase).toBe(2);
    expect(BALANCE.world.claimDepthSlope).toBe(2.5);
  });

  it("the encounter table ships findings.md's nine fixed enemies, flagged", () => {
    expect(WORLD_ENEMIES).toHaveLength(9);
    WORLD_ENEMIES.forEach((def, i) => {
      // Thresholds ride the calibrated entry depth (issue #490): the
      // ladder scales with the World's own opening.
      expect(def.threshold).toBe(BALANCE.world.entryNous * 10 ** i);
      expect(def.maxHp).toBeCloseTo(12 * 1.5 ** i, 9);
      expect(def.bonus).toBe(0.08);
    });
    // The depth bands (issue #489): band steps in the enemy's own
    // threshold multiples, penalties per band with the discovery figure
    // leading and the deepest leaving the positive floor. Hypothesis
    // coefficients pending scheduled calibration — changing one must
    // fail here and force a fresh citation.
    expect(BALANCE.world.enemyDepthSteps).toEqual([10, 100, 1000]);
    expect(BALANCE.world.enemyDepthPenalties).toEqual([0.2, 0.35, 0.5, 0.65]);
    expect(BALANCE.world.enemyDepthPenalties).toHaveLength(BALANCE.world.enemyDepthSteps.length + 1);
  });

  it("the combat figures ship findings.md's cadence hypothesis, flagged", () => {
    expect(BALANCE.world.attackCost).toBe(1);
    expect(BALANCE.world.attackCadenceSeconds).toBe(60);
    expect(BALANCE.world.attackBase).toBe(4);
    expect(BALANCE.world.storageCap).toBe(30);
    expect(BALANCE.world.columnFirstPrice).toBe(1);
  });
});

describe("the lift read (issue #426): one conservation arithmetic for the walk and the UI", () => {
  it("the walk applies the split against live headroom; the read shows the routing", () => {
    const s = fresh();
    const generator = give(s, "focusKeyed", hex(1, 0));
    generator.reserve = 1000;
    const host = give(s, "additive", hex(0, 1));
    s.world.columns.push({ id: "col1", pos: hex(0, 1) });
    const weapon = grantWeapon(s, hex(1, 0), 0);
    const snapshot = { chargeStrength: new Map([[host.id, 5]]) } as never;
    const lift = columnLiftsOf(s, snapshot);
    expect(lift.byColumn.get("col1")).toBeCloseTo(5, 10);
    expect(lift.byWeapon.get(weapon.id)).toBeCloseTo(5, 10);
    // The walk's accepted amount is the read's rate times the span while
    // storage headroom lasts.
    advanceWorldCharge(s, snapshot, 4);
    expect(weapon.store).toBeCloseTo(20, 9);
  });

  it("the preview's override re-positions one occupant and touches nothing else", () => {
    const s = fresh();
    const generator = give(s, "focusKeyed", hex(1, 0));
    generator.reserve = 1000;
    const host = give(s, "additive", hex(0, 1));
    s.world.columns.push({ id: "col1", pos: hex(0, 1) });
    const fed = grantWeapon(s, hex(1, 0), 0);
    const far = grantWeapon(s, hex(4, 0), 0);
    const snapshot = { chargeStrength: new Map([[host.id, 5]]) } as never;
    const before = columnLiftsOf(s, snapshot);
    expect(before.byWeapon.get(fed.id)!).toBeCloseTo(5, 10);
    expect(before.byWeapon.has(far.id)).toBe(false);
    // Moving the far weapon beside the Column admits it to the split —
    // half each — while the state itself never moved.
    const preview = columnLiftsOf(s, snapshot, { id: far.id, pos: hex(1, 0) });
    expect(preview.byWeapon.get(fed.id)).toBeCloseTo(2.5, 10);
    expect(preview.byWeapon.get(far.id)).toBeCloseTo(2.5, 10);
    expect(far.pos).not.toBeNull();
    // Moving the Column itself re-homes its lift: over the hostless cell it
    // copies nothing.
    const moved = columnLiftsOf(s, snapshot, { id: "col1", pos: hex(2, 0) });
    expect(moved.byColumn.get("col1")).toBeUndefined();
    expect(moved.byWeapon.size).toBe(0);
  });

  it("a Column over a hostless cell lifts nothing, and tray occupants read nowhere", () => {
    const s = fresh();
    const generator = give(s, "focusKeyed", hex(1, 0));
    generator.reserve = 1000;
    s.cells.push(hex(2, 2));
    s.world.columns.push({ id: "col1", pos: hex(2, 2) });
    const trayed = grantWeapon(s, null, 0);
    const snapshot = { chargeStrength: new Map([[generator.id, 5]]) } as never;
    const lift = columnLiftsOf(s, snapshot);
    expect(lift.byColumn.size).toBe(0);
    expect(lift.byWeapon.size).toBe(0);
    expect(trayed.pos).toBeNull();
  });
});
