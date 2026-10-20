import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { forgeThreshold } from "./rolls";
import { combine, endSession, pauseSession, prestige, startSession } from "./actions";
import { computeRates, emittedStrength } from "./economy";
import { fresh, give, stubRng } from "./fixtures";
import { createHabit } from "./habits";
import { hex } from "./hex";
import { writeNote } from "./notes";
import { deserialize, serialize } from "./save";
import { accrueGoalProgress, createGoal } from "./goals";
import { ARETE_HORIZON } from "./accumulator";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";

// The generator profile wave (issue #371, parent #366): the Flywheel,
// Scribe, and Milestone each read every practice fact through their own
// authored profile, bank charge QUANTITY into their own reserve, and spend
// it at their emission rate while deployed. Public actions and state are
// the whole seam: practice → earning → reserve → delivery → production,
// with no profile-specific test API.

// A board where the forge receives from the generator at (2, 0).
function receiver(s: ReturnType<typeof fresh>): void {
  give(s, "forge", hex(1, 0));
}

describe("earning at the practice facts", () => {
  it("a session's focus window banks at each profile's own coefficient — the Flywheel leads", () => {
    const s = fresh();
    const flywheel = give(s, "focusKeyed", hex(2, 0));
    const scribe = give(s, "noteKeyed", hex(2, 1));
    const milestone = give(s, "goalKeyed", hex(1, 1));
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    // 0.1 vs 0.02 vs 0.02 per credited second — the specialist's five-to-one
    // lead is the authored shape, not a percentage split.
    expect(flywheel.reserve).toBeCloseTo(60, 6);
    expect(scribe.reserve).toBeCloseTo(12, 6);
    expect(milestone.reserve).toBeCloseTo(12, 6);
  });

  it("note and goal credit land at the fact itself — immediate, even between sessions", () => {
    const s = fresh();
    const scribe = give(s, "noteKeyed", null);
    const milestone = give(s, "goalKeyed", null);
    const habit = createHabit(s, "Piano").habit!;
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: 1 });
    // The completion-credit arithmetic is the subject: fill the fuel pool
    // past any draw, so the budget scales nothing here (issue #423).
    s.goalFuel = 1e9;
    // No session has ever run: the write and the completion still bank —
    // and every generator reads both facts through its own profile.
    writeNote(s, "a thought worth keeping");
    accrueGoalProgress(s, habit.id, 600);
    // Scribe: 23 chars × 1 + the 30 creation bonus, plus its modest goal
    // axis (1 × 0.1 × 600). Milestone: ×5 the completion base, plus its
    // modest note axis (23 × 0.2 + 5).
    expect(scribe.reserve).toBeCloseTo(53 + 60, 6);
    expect(milestone.reserve).toBeCloseTo(300 + 9.6, 6);
  });

  it("focus earning never lands mid-session — the bank is the session end", () => {
    const s = fresh();
    const flywheel = give(s, "focusKeyed", hex(2, 0));
    startSession(s, 600);
    advance(s, 600);
    // The whole session practiced; nothing has banked yet.
    expect(flywheel.reserve).toBe(0);
    endSession(s);
    expect(flywheel.reserve).toBeCloseTo(60, 6);
  });

  it("every owned copy earns full independent credit — copies bank, never split", () => {
    const s = fresh();
    const first = give(s, "noteKeyed", hex(2, 0));
    const second = give(s, "noteKeyed", null);
    const third = give(s, "noteKeyed", null);
    writeNote(s, "one qualifying thought");
    for (const copy of [first, second, third]) {
      expect(copy.reserve).toBeCloseTo(22 + 30, 6);
    }
  });

  it("a tray copy banks without emitting — its reserve holds while flow runs", () => {
    const s = fresh();
    const tray = give(s, "noteKeyed", null);
    tray.reserve = 40;
    startSession(s, 600);
    advance(s, 600);
    // Undeployed: no output, no burn.
    expect(tray.reserve).toBeCloseTo(40, 6);
    expect(computeRates(s, true).forgeRate).toBe(0);
    endSession(s);
    // The session's focus window still banked — placement is a delivery
    // choice, never an earning one.
    expect(tray.reserve).toBeCloseTo(40 + 12, 6);
  });
});

describe("delivery spends the quantity", () => {
  it("expenditure is independent of the neighbor count — full strength to every receiver", () => {
    function drained(receivers: number): number {
      const s = fresh();
      const gen = give(s, "focusKeyed", hex(2, 0));
      gen.reserve = 50;
      receiver(s);
      if (receivers > 1) give(s, "additive", hex(2, 1)); // a second eligible receiver
      startSession(s, null);
      advance(s, 20, stubRng(new Array(4).fill(0.5)));
      return gen.reserve;
    }
    // One receiver or two: the same 20 seconds of delivery costs the same
    // 20 charge at strength 1. The added receiver never thins its neighbor.
    expect(drained(1)).toBeCloseTo(30, 6);
    expect(drained(2)).toBeCloseTo(30, 6);
  });

  it("an exhausted reserve stops the output mid-session", () => {
    const s = fresh();
    const gen = give(s, "noteKeyed", hex(2, 0));
    gen.reserve = 30;
    receiver(s);
    startSession(s, null);
    const rng = stubRng(new Array(12).fill(0.5));
    advance(s, 30, rng);
    expect(gen.reserve).toBeCloseTo(0, 6);
    expect(s.forge.progress).toBeCloseTo(30, 6);
    // Dry: the next span moves nothing — charge is a reserve, never a drip.
    advance(s, 60, rng);
    expect(s.forge.progress).toBeCloseTo(30, 6);
    expect(s.forge.earned).toBe(0);
  });

  it("drains sub-tolerance delivery spans without losing charge or recursing forever", () => {
    function run(split: boolean) {
      const s = fresh();
      const gen = give(s, "focusKeyed", hex(2, 0), 40);
      startSession(s, null);
      advance(s, 600);
      endSession(s);
      const banked = gen.reserve;
      receiver(s);
      startSession(s, null);
      if (split) advance(s, 59.9999999995);
      advance(s, split ? 1 : 60.9999999995);
      const spent = Array.from({ length: s.forge.earned }, (_, i) => forgeThreshold(i)).reduce((a, b) => a + b, 0);
      return { reserve: gen.reserve, delivered: s.forge.progress + spent, banked, elapsed: s.session!.elapsed };
    }
    const one = run(false);
    const split = run(true);
    for (const result of [one, split]) {
      expect(result.reserve).toBe(0);
      expect(result.delivered).toBeCloseTo(result.banked, 6);
      expect(result.elapsed).toBeCloseTo(60.9999999995, 9);
    }
  });

  it("equivalent time intervals deliver equivalently — one step or many", () => {
    function run(step: number): { reserve: number; forge: number; elapsed: number } {
      const s = fresh();
      const gen = give(s, "focusKeyed", hex(2, 0));
      gen.reserve = 45;
      receiver(s);
      startSession(s, null);
      const rng = stubRng(new Array(120).fill(0.5));
      for (let t = 0; t < 60; t += step) advance(s, step, rng);
      return { reserve: gen.reserve, forge: s.forge.progress, elapsed: s.session!.elapsed };
    }
    const one = run(60);
    const six = run(10);
    const sixty = run(1);
    // 45 charge at strength 1: forty-five charged seconds, then dry — the
    // same total whatever the step shape.
    for (const run of [one, six, sixty]) {
      expect(run.reserve).toBeCloseTo(0, 6);
      expect(run.forge).toBeCloseTo(45, 6);
      expect(run.elapsed).toBeCloseTo(60, 6);
    }
  });

  it("the emitted strength is the module's power — read by the pass and the drain alike", () => {
    const s = fresh();
    const gen = give(s, "goalKeyed", hex(2, 0), 2); // power 1.44
    gen.reserve = 28.8;
    receiver(s);
    startSession(s, null);
    advance(s, 10, stubRng(new Array(4).fill(0.5)));
    // Delivery at strength 1.44: 14.4 charge spent, 10 s of rhythm left.
    expect(gen.reserve).toBeCloseTo(14.4, 6);
    expect(emittedStrength(s, gen, true)).toBeCloseTo(1.44, 6);
  });
});

describe("progression scales earning and delivery together", () => {
  it("a merged tier banks proportionally more and delivers proportionally stronger — same rhythm", () => {
    const s = fresh();
    const first = give(s, "focusKeyed", null);
    const second = give(s, "focusKeyed", hex(2, 0));
    // Two exact copies combine into one tier-1 Flywheel (ADR-0058's
    // ladder); the result lands where the drop target stood.
    expect(combine(s, first.id, second.id).ok).toBe(true);
    const merged = s.modules.find((m) => m.id === first.id)!;
    expect(merged.tier).toBe(1);
    expect(merged.pos).toEqual(hex(2, 0));
    receiver(s);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    // Tier power 1.5 scales the bank: 0.1 × 600 × 1.5 = 90 charge.
    expect(merged.reserve).toBeCloseTo(90, 6);
    startSession(s, null);
    advance(s, 60, stubRng(new Array(12).fill(0.5)));
    // …delivered at the same-scaled strength 1.5: the 60-second rhythm
    // stands, the forge crossed its window exactly once.
    expect(merged.reserve).toBeCloseTo(0, 6);
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(30, 6);
  });

  it("the axes keep their proportions at any level — power multiplies them all", () => {
    const s = fresh();
    const flywheel = give(s, "focusKeyed", null, 3); // power 1.2³
    const scribe = give(s, "noteKeyed", null, 3);
    startSession(s, 600);
    advance(s, 600);
    writeNote(s, "z".repeat(50)); // qualifying: the creation bonus fires
    endSession(s);
    const power = 1.2 ** 3;
    // Both profiles' every axis rode the same multiplier — the 5:1 focus
    // lead and the modest note axes read exactly level-0-shaped, scaled.
    expect(flywheel.reserve).toBeCloseTo((0.1 * 600 + (50 * 0.2 + 5)) * power, 6);
    expect(scribe.reserve).toBeCloseTo((0.02 * 600 + (50 * 1 + 30)) * power, 6);
  });
});

describe("reconciliation and the reserve", () => {
  it("honesty-credited time banks newly credited charge at session end — never replayed production", () => {
    const s = fresh();
    const flywheel = give(s, "focusKeyed", null); // tray: nothing drains, nothing emits
    startSession(s, null);
    applyGap(s, 900, "away", 0); // open-ended past the floor: provisional
    flushPendingAway(s);
    // The generator banked nothing for the away span itself — no simulated
    // output, no replayed production. The charge waits for the session end.
    expect(flywheel.reserve).toBe(0);
    resolveHonestyReport(s, "full"); // the report credits its minutes
    expect(flywheel.reserve).toBe(0);
    endSession(s);
    // The newly credited 900 seconds bank their window exactly once.
    expect(flywheel.reserve).toBeCloseTo(0.1 * 900, 6);
  });

  it("ordinary session endings retain unused charge; the Arete reset clears it", () => {
    const s = fresh();
    const flywheel = give(s, "focusKeyed", hex(2, 0));
    receiver(s);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    expect(flywheel.reserve).toBeCloseTo(60, 6);
    // An ordinary ending: the reserve holds what's left, and the ending
    // banks only its own credited window (30 s → 3 more).
    startSession(s, 600);
    advance(s, 30);
    pauseSession(s);
    endSession(s);
    expect(flywheel.reserve).toBeCloseTo(30 + 3, 6);
    // The Arete boundary (prestige) clears the stored charge with the
    // rest of the era's economy.
    s.eraEarned = ARETE_HORIZON;
    expect(prestige(s).ok).toBe(true);
    expect(flywheel.reserve).toBe(0);
  });

  it("the reserve survives a save round-trip beside its earning", () => {
    const s = fresh();
    const scribe = give(s, "noteKeyed", null);
    writeNote(s, "persisted thought"); // 17 characters — under the minimum
    const result = deserialize(serialize(s, 77));
    expect(result.error).toBeUndefined();
    expect(result.state!.modules.find((m) => m.id === scribe.id)!.reserve).toBeCloseTo(17, 6);
  });
});
