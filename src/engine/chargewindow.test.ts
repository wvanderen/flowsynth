import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, pauseSession, resumeSession, startSession } from "./actions";
import { createHabit, addPracticeLog } from "./habits";
import { computeRates } from "./economy";
import { fresh, give, stubRng } from "./fixtures";
import { serialize, deserialize } from "./save";
import { hex } from "./hex";

// The focus generator's reserve (§2.3, ADR-0012; ADR-0018 made the
// focus-keyed generator the launch generator; ADR-0047 made the reserve the
// module's own): ending any session banks into every owned focus generator
// a window of fraction × live practice time — the tuning fraction is 0.1,
// so a 600 s session banks 60 s — spent as that generator's output during
// the next session's first minutes. Charge is an across-session reserve,
// never a live drip, and it lives on the module now: board or tray alike,
// reset at prestige.

// A board with the receiving forge and the focus generator placed, so the
// banked window has a receiver and an emitter.
function receiving(s: ReturnType<typeof fresh>): void {
  give(s, "forge", hex(1, 0));
  give(s, "focusKeyed", hex(2, 0));
}

// The generator the fixtures added — the only focus generator on the board.
const theGenerator = (s: ReturnType<typeof fresh>) => s.modules.find((m) => m.type === "focusKeyed")!;

describe("the focus generator's reserve", () => {
  it("every session end banks fraction × live practice time into each owned generator", () => {
    const planned = fresh();
    receiving(planned);
    startSession(planned, 600);
    advance(planned, 600);
    endSession(planned);
    // 0.1 × 600 s of practice banks a 60 s reserve.
    expect(theGenerator(planned).reserve).toBeCloseTo(60, 6);

    const openEnded = fresh();
    receiving(openEnded);
    startSession(openEnded, null);
    advance(openEnded, 300);
    endSession(openEnded);
    expect(theGenerator(openEnded).reserve).toBeCloseTo(30, 6);
  });

  it("a session banks exactly once, whatever its shape or exit", () => {
    const s = fresh();
    receiving(s);
    startSession(s, null);
    advance(s, 100);
    pauseSession(s);
    endSession(s);
    expect(theGenerator(s).reserve).toBeCloseTo(10, 6);
    endSession(s);
    expect(theGenerator(s).reserve).toBeCloseTo(10, 6);
  });

  it("only live flow banks: paused time is not practice", () => {
    const s = fresh();
    receiving(s);
    startSession(s, 600);
    advance(s, 100);
    pauseSession(s);
    resumeSession(s);
    advance(s, 100);
    endSession(s);
    expect(theGenerator(s).reserve).toBeCloseTo(20, 6);
  });

  it("manual practice logs never bank or simulate charge activity", () => {
    const s = fresh();
    receiving(s);
    const habit = createHabit(s, "Piano");
    expect(habit.ok).toBe(true);
    expect(addPracticeLog(s, habit.habit!.id, 45).ok).toBe(true);
    expect(theGenerator(s).reserve).toBe(0);

    // Ending a session with no live time banks nothing either.
    startSession(s, null);
    endSession(s);
    expect(theGenerator(s).reserve).toBe(0);
  });

  it("a tray generator banks its reserve too — the console fact credits board and tray alike", () => {
    const s = fresh();
    give(s, "focusKeyed", null);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    expect(theGenerator(s).reserve).toBeCloseTo(60, 6);
  });

  it("the reserve is spent as the generator's output early in the next session", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    receiving(s);
    endSession(s);
    expect(theGenerator(s).reserve).toBeCloseTo(60, 6);

    startSession(s, null);
    const rng = stubRng(new Array(12).fill(0.5));
    advance(s, 60, rng);
    // The prep session's 600 credited seconds crossed only the flow meter's
    // opening fill (ADR-0041) — this branch starts clean. The measured 60 s
    // adds strength 1 × 60 s of reserve charge: the 60 threshold crosses.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(theGenerator(s).reserve).toBeCloseTo(0, 6);

    // The reserve is empty: the next minute moves this branch by nothing —
    // practice is the flow meter's diet, filling on beside it.
    advance(s, 60, rng);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.forge.earned).toBe(1);
    expect(s.flow.progress).toBeCloseTo(540, 6);
  });

  it("reserve time buys charge, never nous: the board's rate is unchanged", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    receiving(s);
    endSession(s);

    startSession(s, null);
    const before = s.nous;
    // Board production only (0.1 ν/s) — the reserve buys charge, never
    // nous — scaled by the boost leg in force during the step (ADR-0015).
    const boost = computeRates(s, true).achievementBoost;
    advance(s, 60);
    expect(s.nous - before).toBeCloseTo(0.1 * 60 * boost, 6);
  });

  it("reserve time elapses during flow even without eligible neighbors", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    give(s, "focusKeyed", hex(2, 0));
    endSession(s);
    expect(theGenerator(s).reserve).toBeCloseTo(60, 6);

    startSession(s, null);
    advance(s, 60);
    expect(theGenerator(s).reserve).toBeCloseTo(0, 6);
  });

  it("an undeployed focus generator produces nothing and its reserve holds", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    give(s, "focusKeyed", null);
    endSession(s);
    expect(theGenerator(s).reserve).toBeCloseTo(60, 6);

    startSession(s, null);
    advance(s, 600);
    expect(theGenerator(s).reserve).toBeCloseTo(60, 6);
  });

  it("pausing freezes the reserve; the drained reserve yields no output", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    receiving(s);
    endSession(s);

    startSession(s, null);
    advance(s, 30);
    expect(theGenerator(s).reserve).toBeCloseTo(30, 6);
    pauseSession(s);
    advance(s, 100);
    expect(theGenerator(s).reserve).toBeCloseTo(30, 6);
    resumeSession(s);
    advance(s, 30);
    expect(theGenerator(s).reserve).toBeCloseTo(0, 6);
    // The reserve drained across the two live legs — 30 + 30 charge — over
    // this branch's clean start (the prep session filled only the flow
    // meter): the 60 threshold crosses at the end, and the pause moved
    // nothing.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.flow.progress).toBeCloseTo(480, 6);
  });

  it("reserves stack by extending the remaining duration, never the strength", () => {
    const s = fresh();
    // Owned in the tray: the generator banks both windows and never emits
    // during them (an undeployed generator produces nothing).
    give(s, "focusKeyed", null);
    for (let i = 0; i < 2; i++) {
      startSession(s, 600);
      advance(s, 600);
      endSession(s);
    }
    expect(theGenerator(s).reserve).toBeCloseTo(120, 6);

    // Deployed beside the receiving forge, it spends both windows at
    // constant strength 1 (the second window extended the first instead of
    // amplifying it): the 60 threshold crosses, 60 carries into the grown
    // one. Practice filled only the flow meter.
    theGenerator(s).pos = hex(2, 0);
    give(s, "forge", hex(1, 0));
    startSession(s, null);
    advance(s, 120, stubRng(new Array(12).fill(0.5)));
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(60, 6);
    expect(theGenerator(s).reserve).toBeCloseTo(0, 6);
    expect(s.flow.progress).toBeCloseTo(1140, 6);
  });

  it("a step that outlives the reserve splits at the boundary, never over-crediting", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    receiving(s);
    endSession(s);
    startSession(s, null);
    // One 100 s step across the 60 s reserve — as a throttled tab's
    // catch-up tick would take: the drained generator credits only 60 s of
    // it, and the step's remaining 40 s run uncharged.
    advance(s, 100, stubRng(new Array(12).fill(0.5)));
    expect(theGenerator(s).reserve).toBeCloseTo(0, 6);
    // Over this branch's clean start: the charged 60 s leg adds 60 charge —
    // the threshold crosses exactly — and the drained 40 s leg adds nothing.
    // The split never over-credits.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.session!.elapsed).toBeCloseTo(100, 6);
  });

  it("no banked reserve means silence (ADR-0018)", () => {
    const s = fresh();
    receiving(s);
    startSession(s, null);
    advance(s, 10);
    // No reserve is banked yet — session one only accrues it — so no charge
    // flows at all (charge is a reserve, never a live drip). This branch
    // stays silent; the 10 credited seconds fill the flow meter (ADR-0041).
    expect(computeRates(s, true).forgeRate).toBe(0);
    expect(s.forge.progress).toBeCloseTo(0, 6);
    expect(s.flow.progress).toBeCloseTo(10, 6);
    expect(theGenerator(s).reserve).toBe(0);
  });

  it("the reserve survives a save round-trip", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    receiving(s);
    endSession(s);
    const result = deserialize(serialize(s, 1234));
    expect(result.error).toBeUndefined();
    expect(theGenerator(result.state!).reserve).toBeCloseTo(60, 6);
  });
});

// The keyed family's shared surface (ADR-0047, wave 5): the note and goal
// generators join the focus generator's reserve semantics unchanged — one
// burn rule, one standing vocabulary, one prestige reset. Delivery is the
// focus generator's too: level, rarity, and mutators scale output strength
// only, never the banked duration.
describe("the note and goal reserves share the focus generator's surface", () => {
  it("note and goal reserves burn 1 s/s in flow even without eligible neighbors", () => {
    const s = fresh();
    const note = give(s, "noteKeyed", hex(2, 0));
    const goal = give(s, "goalKeyed", null); // tray copies hold until placed
    note.reserve = 60;
    goal.reserve = 60;
    startSession(s, null);
    advance(s, 60);
    expect(note.reserve).toBeCloseTo(0, 6);
    // Undeployed, the tray copy produces nothing and its reserve holds.
    expect(goal.reserve).toBeCloseTo(60, 6);
    note.reserve = 60;
    advance(s, 100);
    // A step that outlives the reserve clamps at empty, never negative.
    expect(note.reserve).toBe(0);
  });

  it("a drained note reserve buys charge like any generator's — strength, never duration", () => {
    const s = fresh();
    const note = give(s, "noteKeyed", hex(2, 0));
    give(s, "forge", hex(1, 0));
    note.reserve = 60;
    startSession(s, null);
    // Strength 1 × 60 s of reserve charge: the 60 threshold crosses.
    advance(s, 60, stubRng(new Array(12).fill(0.5)));
    expect(s.forge.earned).toBe(1);
    expect(note.reserve).toBeCloseTo(0, 6);
  });

  it("level scales the note reserve's delivery strength only — never the banked duration", () => {
    const s = fresh();
    const note = give(s, "noteKeyed", hex(2, 0), 2); // power 1.2²
    give(s, "forge", hex(1, 0));
    note.reserve = 17; // the credit a 17-character note banked — flat, sizing never reads level
    startSession(s, null);
    advance(s, 10, stubRng(new Array(12).fill(0.5)));
    // The same 17 s budget delivers at strength 1.44 — the rate reads it,
    // the duration never grew.
    expect(note.reserve).toBeCloseTo(7, 6);
    expect(computeRates(s, true).forgeRate).toBeCloseTo(1.44, 6);
  });

  it("reserves survive upgrade mode (the paused board) — only flow burns them", () => {
    const s = fresh();
    const goal = give(s, "goalKeyed", hex(2, 0));
    goal.reserve = 60;
    startSession(s, null);
    advance(s, 30);
    pauseSession(s);
    advance(s, 100); // paused: no production, no burn
    expect(goal.reserve).toBeCloseTo(30, 6);
    resumeSession(s);
    advance(s, 30);
    expect(goal.reserve).toBeCloseTo(0, 6);
    // Between sessions the reserve sits untouched.
    endSession(s);
    goal.reserve = 45;
    startSession(s, null);
    expect(goal.reserve).toBeCloseTo(45, 6);
  });
});
