import { describe, expect, it } from "vitest";
import { breakHorizon, endSession, prestige, startSession } from "./actions";
import { ARETE_HORIZON, claimOf, horizonReached } from "./accumulator";
import { BALANCE } from "./constants";
import { advance } from "./advance";
import { fresh, give } from "./fixtures";
import { serialize, deserialize } from "./save";
import { hex } from "./hex";
import { levelCost } from "./economy";
import type { GameState } from "./types";

// The prestige reset boundary (ADR-0039, issue #194): what a reset banks,
// what it takes, and what it leaves exactly where it stood.

function atHorizon(state: GameState = fresh()): GameState {
  state.eraEarned = ARETE_HORIZON;
  return state;
}

describe("the prestige action", () => {
  it("keeps earlier milestones closed and opens prestige at 1e23 earned nous", () => {
    const s = fresh();
    s.eraEarned = 100_000;
    expect(horizonReached(s)).toBe(false);
    expect(prestige(s).ok).toBe(false);
    s.eraEarned = 1e9;
    expect(prestige(s).ok).toBe(false);
    // Subtracting one rounds back to 1e23 at this magnitude.
    s.eraEarned = 1e23 * (1 - 1e-12);
    expect(prestige(s).ok).toBe(false);
    s.eraEarned = 1e23;
    expect(horizonReached(s)).toBe(true);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(1);
    expect(s.eraEarned).toBe(0);
  });

  it("is gated: upgrade mode only, and only at the horizon", () => {
    const resting = fresh();
    resting.eraEarned = ARETE_HORIZON;
    resting.mode = "flow";
    expect(prestige(resting).ok).toBe(false);
    expect(prestige(fresh()).ok).toBe(false);
    const ready = atHorizon();
    expect(prestige(ready).ok).toBe(true);
  });

  it("banks the live claim: the nth reset banks n, and no other code path grants Arete", () => {
    const s = atHorizon();
    prestige(s);
    expect(s.arete).toBe(1);
    // Production past the horizon banks nothing on its own.
    startSession(s, null);
    advance(s, 600);
    endSession(s, 5_000);
    expect(s.arete).toBe(1);
    s.eraEarned = ARETE_HORIZON;
    prestige(s);
    expect(s.arete).toBe(3);
  });

  it("resets module levels to base while keeping every owned module", () => {
    const s = atHorizon();
    const synth = give(s, "additive", hex(1, 0), 4);
    const traySpacer = give(s, "spacer", null, 2);
    const rare = give(s, "harmonizer", hex(0, 1), 6);
    rare.rarity = "rare";
    prestige(s);
    expect(s.modules.map((m) => m.id)).toContain(synth.id);
    for (const module of [synth, traySpacer, rare]) {
      expect(module.level).toBe(0);
      expect(module.invested).toBe(0);
    }
    expect(rare.rarity).toBe("rare");
    // Placement persists through the reset.
    expect(synth.pos).toEqual(hex(1, 0));
    expect(traySpacer.pos).toBeNull();
  });

  it("resets nous to a fresh opening grant and zeroes the reserves", () => {
    const s = atHorizon();
    s.nous = 9_999;
    const gen = give(s, "focusKeyed", hex(2, 0));
    gen.reserve = 480;
    prestige(s);
    expect(s.nous).toBe(BALANCE.openingGrant);
    expect(s.modules.every((m) => m.reserve === 0)).toBe(true);
  });

  it("persists the board: cells, placement, cellsBought, and the paid row gates", () => {
    const s = atHorizon();
    s.cells.push(hex(2, 0), hex(-1, -1));
    s.cellsBought = 5;
    s.gatedRows = [0, 1, -1, 2];
    prestige(s);
    expect(s.cells.map((c) => `${c.q},${c.r}`)).toContain("2,0");
    expect(s.cells).toHaveLength(5);
    expect(s.cellsBought).toBe(5);
    expect(s.gatedRows).toEqual([0, 1, -1, 2]);
  });

  it("persists banked rolls, Forge progress, and the shelf's purchased flags", () => {
    const s = atHorizon();
    give(s, "forge", hex(1, 0), 2);
    s.forge = { progress: 40, earned: 3 };
    s.bankedRolls.push({
      id: "offer",
      candidates: [
        { id: "c1", type: "additive", rarity: "common" },
        { id: "c2", type: "spacer", rarity: "common" },
        { id: "c3", type: "infusor", rarity: "common" },
      ],
    });
    s.purchased = { generator: true, infusor: true, forge: true };
    prestige(s);
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.forge).toEqual({ progress: 40, earned: 3 });
    expect(s.purchased).toEqual({ generator: true, infusor: true, forge: true });
  });

  it("the flow meter's fill and earned count survive prestige intact (ADR-0041)", () => {
    const s = atHorizon();
    s.flow = { progress: 900, earned: 4 };
    s.bankedRolls = [];
    prestige(s);
    expect(s.flow).toEqual({ progress: 900, earned: 4 });
    // The reset mints nothing and un-banks nothing: the queue persists too.
    expect(s.bankedRolls).toHaveLength(0);
  });

  it("persists achievements, the life record, and lifetime totalEarned", () => {
    const s = atHorizon();
    s.achievements = { "first-light": 1_000 };
    s.habits.push({ id: "h1", name: "Piano", seconds: 600, archived: false, build: [] });
    s.activeHabitId = "h1";
    s.practiceLog.push({ id: "p1", habitId: "h1", seconds: 60, source: "live", at: 1_000 });
    s.notes.push({ id: "n1", sessionId: 1, atElapsed: 30, text: "kept", habitId: "h1", at: 1_000 });
    s.sessionRecords.push({
      sessionNumber: 1,
      startedAt: 1_000,
      endedAt: 2_000,
      habitId: "h1",
      mode: "planned",
      plannedTarget: 600,
      creditedSeconds: 600,
      earned: 60,
      honestyEvents: [],
      reflection: null,
      goalsAdvanced: [],
      achievements: [],
    });
    s.sessionsCompleted = 4;
    s.combinations = 2;
    s.muted = true;
    s.totalEarned = ARETE_HORIZON;
    prestige(s);
    expect(s.achievements).toEqual({ "first-light": 1_000 });
    expect(s.habits).toHaveLength(1);
    expect(s.practiceLog).toHaveLength(1);
    expect(s.notes).toHaveLength(1);
    expect(s.sessionRecords).toHaveLength(1);
    expect(s.sessionsCompleted).toBe(4);
    expect(s.combinations).toBe(2);
    expect(s.muted).toBe(true);
    expect(s.totalEarned).toBe(ARETE_HORIZON);
  });

  it("a prestige round-trips the save cleanly", () => {
    const s = atHorizon();
    s.totalEarned = ARETE_HORIZON;
    give(s, "additive", hex(1, 0), 3);
    prestige(s);
    const loaded = deserialize(serialize(s, 5_000));
    expect(loaded.error).toBeUndefined();
    const m = loaded.state!;
    expect(m.arete).toBe(1);
    expect(m.prestiges).toBe(1);
    expect(m.eraEarned).toBe(0);
    expect(m.totalEarned).toBe(ARETE_HORIZON);
    expect(m.nous).toBe(BALANCE.openingGrant);
  });

  it("an upgraded module's next level prices from base again", () => {
    const s = atHorizon();
    const synth = give(s, "additive", hex(1, 0), 5);
    expect(levelCost(synth.level)).toBeGreaterThan(levelCost(0));
    prestige(s);
    expect(levelCost(synth.level)).toBe(levelCost(0));
  });
});

describe("post-break banking (ADR-0042, issue #200)", () => {
  function brokenAt(overfill: number): GameState {
    const s = fresh();
    s.arete = BALANCE.horizonBreakCost;
    expect(breakHorizon(s).ok).toBe(true);
    s.eraEarned = ARETE_HORIZON * overfill;
    return s;
  }

  it("an at-threshold reset banks exactly n; a decade of overfill multiplies by two", () => {
    const s = brokenAt(1);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(1);
    // The next era pushed one decade past the line: n = 2 doubles to 4.
    s.eraEarned = ARETE_HORIZON * 10;
    expect(claimOf(s)).toBe(4);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(5);
  });

  it("prestige and immediately re-resetting banks n, not a decade-multiplied claim", () => {
    // The acceptance check: the claim reads the bar's own rebased measure —
    // the decade's overfill died with the era that earned it.
    const s = brokenAt(1_000_000);
    expect(prestige(s).ok).toBe(true);
    s.eraEarned = ARETE_HORIZON;
    expect(claimOf(s)).toBe(2);
  });

  it("nothing banks beyond the cap even from a maximally juiced era", () => {
    const s = brokenAt(1e30);
    expect(prestige(s).ok).toBe(true);
    expect(s.arete).toBe(BALANCE.horizonBreakClaimCap);
  });

  it("the break round-trips the save cleanly", () => {
    const s = brokenAt(1);
    const loaded = deserialize(serialize(s, 5_000));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.horizonBroken).toBe(true);
  });
});
