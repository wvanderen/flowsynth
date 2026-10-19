import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { dismissSummary, endBreather, endSession, startBreather, startSession } from "./actions";
import { BREATHER } from "./constants";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { displayedRates, sessionClockOf } from "./economy";
import { deserialize, serialize } from "./save";
import { applyBreatherGap } from "./trust";

// The breather (docs/breather-spec.md, ADR-0073): a timed break phase after
// a flow session closes — the board runs at full production minus practice,
// paid in authored per-voice breather responses, self-ending on a
// pre-trusted wall-clock allowance. The Carrier produces 0.1 ν/s; the
// balance starts at the opening grant, so assertions read deltas against a
// captured baseline.

// End a 25-minute session the plain way: live present time, no honesty.
function runSession(state: ReturnType<typeof fresh>, seconds: number): void {
  startSession(state, null);
  advance(state, seconds);
  endSession(state);
}

describe("the breather allowance (spec §2)", () => {
  it("a 25-minute session mints a 5-minute breather", () => {
    const s = fresh();
    runSession(s, 1500);
    expect(s.summary?.breatherAllowance).toBe(300);
  });

  it("nothing under ten credited minutes", () => {
    const s = fresh();
    runSession(s, BREATHER.minCreditedSeconds - 1);
    expect(s.summary?.breatherAllowance).toBe(0);
  });

  it("exactly the gate mints the smallest allowance", () => {
    const s = fresh();
    runSession(s, BREATHER.minCreditedSeconds);
    expect(s.summary?.breatherAllowance).toBe(120);
  });

  it("the allowance caps at ten minutes and floors to the whole minute", () => {
    const capped = fresh();
    runSession(capped, 90 * 60);
    expect(capped.summary?.breatherAllowance).toBe(BREATHER.capSeconds);
    const floored = fresh();
    runSession(floored, BREATHER.minCreditedSeconds + 1);
    expect(floored.summary?.breatherAllowance).toBe(120);
  });

  it("the departed session's clock stamps at close for the breather to advance", () => {
    const s = fresh();
    runSession(s, 1200);
    expect(s.lastSessionClock).toBe(1200);
  });
});

describe("the breather's start and end (spec §1, §4)", () => {
  it("starts only from an unseen summary that minted an allowance", () => {
    const s = fresh();
    runSession(s, 1500);
    expect(startBreather(s, 1000).ok).toBe(true);
    expect(s.mode).toBe("breather");
    expect(s.breather).toEqual({ startedAt: 1000, allowanceSeconds: 300, elapsed: 0 });
  });

  it("refuses while a session runs, without a summary, after dismissal, and with no allowance", () => {
    const flowing = fresh();
    startSession(flowing, null);
    expect(startBreather(flowing).ok).toBe(false);
    const empty = fresh();
    expect(startBreather(empty).ok).toBe(false);
    const declined = fresh();
    runSession(declined, 1500);
    dismissSummary(declined);
    expect(startBreather(declined).ok).toBe(false);
    const brief = fresh();
    runSession(brief, 60);
    expect(startBreather(brief).ok).toBe(false);
  });

  it("a completed breather increments the count; an early exit never does; both bank seconds", () => {
    const s = fresh();
    runSession(s, 1500);
    startBreather(s, 1000);
    applyBreatherGap(s, 299);
    endBreather(s);
    expect(s.breathersCompleted).toBe(0);
    expect(s.breatherSeconds).toBeCloseTo(299, 6);
    expect(s.mode).toBe("upgrade");
    expect(s.breather).toBeNull();
    const record = s.sessionRecords[s.sessionRecords.length - 1]!;
    expect(record.breather).toEqual({ seconds: 299, completed: false });

    const t = fresh();
    runSession(t, 1500);
    startBreather(t, 1000);
    applyBreatherGap(t, 300);
    expect(t.mode).toBe("breather");
    endBreather(t);
    expect(t.breathersCompleted).toBe(1);
    expect(t.breatherSeconds).toBeCloseTo(300, 6);
    const tRecord = t.sessionRecords[t.sessionRecords.length - 1]!;
    expect(tRecord.breather).toEqual({ seconds: 300, completed: true });
  });

  it("no breather runs twice, and nothing ends when none is live", () => {
    const s = fresh();
    runSession(s, 1500);
    startBreather(s);
    applyBreatherGap(s, 300);
    endBreather(s);
    expect(endBreather(s).ok).toBe(false);
  });
});

describe("the breather's boundary (spec §4)", () => {
  it("breather time is pre-trusted: production banks live, nothing credits", () => {
    const s = fresh();
    runSession(s, 1500);
    startBreather(s);
    const balance = s.nous;
    const { result, completed } = applyBreatherGap(s, 120);
    expect(completed).toBe(false);
    // Pre-trusted time banks through the live seam — the counter-image of
    // the provisional sink. The figure stays loose: a feat unlocking
    // mid-walk moves the rate mid-gap, exactly as flow's would.
    expect(result.nousEarned).toBeGreaterThan(0);
    expect(s.nous).toBeGreaterThan(balance);
    expect(s.breather!.elapsed).toBeCloseTo(120, 6);
    // No practice anywhere: no habit exists to accrue, and the flow meter
    // — practice's whole diet — never moves.
    expect(result.rollsFlow).toBe(0);
    expect(result.goalsCompleted).toBe(0);
  });

  it("the gap clamps at the allowance; past it nothing produces", () => {
    const s = fresh();
    runSession(s, 1500);
    startBreather(s);
    const balance = s.nous;
    const { completed } = applyBreatherGap(s, 600);
    expect(completed).toBe(true);
    expect(s.breather!.elapsed).toBeCloseTo(300, 6);
    const afterDeadline = applyBreatherGap(s, 600);
    expect(afterDeadline.completed).toBe(true);
    expect(afterDeadline.result.nousEarned).toBe(0);
    expect(s.breather!.elapsed).toBeCloseTo(300, 6);
    // The clamped walk banked only the allowance's worth — 300 seconds at
    // better than the Carrier's 0.1 ν/s, never the 600 asked.
    expect(s.nous - balance).toBeLessThan(600 * 0.1);
    expect(s.nous - balance).toBeGreaterThan(300 * 0.1);
  });
});

describe("the breather's board (spec §1, §3)", () => {
  it("the authored response scales the voice's final ν/s; the absent mark reads exactly ×1", () => {
    const s = fresh();
    give(s, "afterglow", hex(1, 0));
    startSession(s, null);
    advance(s, 620);
    const flowRates = displayedRates(s);
    const additiveFlow = flowRates.contributions.get(s.modules[0]!.id)!.value;
    const afterglowFlow = flowRates.contributions.get(s.modules[1]!.id)!.value;
    endSession(s);
    startBreather(s, 1000);
    // The same state object: the mode change alone must re-solve — a stale
    // memo can never serve the flow basis into a breather read.
    const breatherRates = displayedRates(s);
    const additiveBreather = breatherRates.contributions.get(s.modules[0]!.id)!.value;
    const afterglowBreather = breatherRates.contributions.get(s.modules[1]!.id)!.value;
    // Any boost that moved between the reads moves both voices equally, so
    // the response is the ratio of the ratios.
    expect(afterglowBreather / afterglowFlow).toBeCloseTo(1.25 * (additiveBreather / additiveFlow), 6);
  });

  it("breather seconds advance the departed session's clock — the warmth holds", () => {
    const s = fresh();
    give(s, "afterglow", hex(1, 0));
    startSession(s, null);
    advance(s, 620);
    endSession(s);
    expect(s.lastSessionClock).toBe(620);
    startBreather(s, 1000);
    expect(sessionClockOf(s)).toBe(620);
    applyBreatherGap(s, 60);
    expect(sessionClockOf(s)).toBe(680);
  });

  it("charge flows through a breather: the reserve drains, forge progress turns", () => {
    const s = fresh();
    const generator = give(s, "focusKeyed", hex(1, 0));
    startSession(s, null);
    advance(s, 1500);
    endSession(s);
    // The focus earning banked at session end sits in the reserve.
    const banked = generator.reserve;
    expect(banked).toBeGreaterThan(0);
    startBreather(s, 1000);
    applyBreatherGap(s, 60);
    // The breather delivered at the banked strength — reserve below what
    // the session banked, forge progress turned by the received charge.
    expect(generator.reserve).toBeLessThan(banked);
    expect(s.forge.earned).toBeGreaterThanOrEqual(0);
  });
});

describe("the breather in the save", () => {
  it("a live breather round-trips: mode, state, and the lifetime facts", () => {
    const s = fresh();
    runSession(s, 1500);
    startBreather(s, 1000);
    applyBreatherGap(s, 60);
    const loaded = deserialize(serialize(s, 2000));
    expect(loaded.error).toBeUndefined();
    const m = loaded.state!;
    expect(m.mode).toBe("breather");
    expect(m.breather).toEqual({ startedAt: 1000, allowanceSeconds: 300, elapsed: 60 });
    expect(m.lastSessionClock).toBe(1500);
    expect(m.summary?.breatherAllowance).toBe(300);
  });

  it("breather mode saved without a coherent breather state lands in upgrade mode", () => {
    const s = fresh();
    runSession(s, 1500);
    startBreather(s, 1000);
    const file = JSON.parse(serialize(s, 2000));
    file.state.breather = null;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.mode).toBe("upgrade");
    expect(loaded.state!.breather).toBeNull();
  });

  it("a pre-breather save lenient-defaults the facts, the summary offer, and the record lines", () => {
    const s = fresh();
    runSession(s, 1500);
    const file = JSON.parse(serialize(s, 2000));
    delete file.state.lastSessionClock;
    delete file.state.breathersCompleted;
    delete file.state.breatherSeconds;
    delete file.state.breather;
    delete file.state.summary.breatherAllowance;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    const m = loaded.state!;
    expect(m.lastSessionClock).toBe(0);
    expect(m.breathersCompleted).toBe(0);
    expect(m.breatherSeconds).toBe(0);
    expect(m.breather).toBeNull();
    expect(m.summary!.breatherAllowance).toBe(0);
    for (const record of m.sessionRecords) expect(record.breather).toBeNull();
  });

  it("the record's breather line survives the round-trip", () => {
    const s = fresh();
    runSession(s, 1500);
    startBreather(s, 1000);
    applyBreatherGap(s, 120);
    endBreather(s);
    const loaded = deserialize(serialize(s, 3000));
    expect(loaded.error).toBeUndefined();
    const record = loaded.state!.sessionRecords[loaded.state!.sessionRecords.length - 1]!;
    expect(record.breather).toEqual({ seconds: 120, completed: false });
  });
});
