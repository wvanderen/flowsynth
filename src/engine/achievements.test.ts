import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achievementBoostOf, achievementById, syncAchievements } from "./achievements";
import { acknowledgeHorizon, buyCell, combine, endSession, placeModule, startSession } from "./actions";
import { advance } from "./advance";
import { BALANCE } from "./constants";
import { computeRates } from "./economy";
import { addPracticeLog, createHabit, selectHabit } from "./habits";
import { writeNote } from "./notes";
import { createGoal } from "./goals";
import { deserialize, serialize } from "./save";
import { fresh, give, stubRng } from "./fixtures";
import { generateOffer } from "./rolls";
import { hex } from "./hex";
import type { GameState } from "./types";

const NOW = 1_770_000_000_000;

// One completed session clears the session-one gate for every later test.
// Structured and open-ended, so the helper never touches the unstructured
// or planned-session counters the feats read.
function completeSession(s: GameState, seconds = 10): void {
  if (!s.habits.some((h) => !h.archived)) createHabit(s, "Piano");
  selectHabit(s, s.habits.find((h) => !h.archived)!.id);
  startSession(s, null);
  advance(s, seconds);
  endSession(s, NOW);
}

function unlockIds(s: GameState): string[] {
  return Object.keys(s.achievements);
}

describe("the achievement registry", () => {
  it("ships the 17-feat launch set with unique ids and copy", () => {
    expect(ACHIEVEMENTS).toHaveLength(17);
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(17);
    for (const def of ACHIEVEMENTS) {
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });

  it("never unlocks anything during session one", () => {
    const s = fresh();
    createHabit(s, "Piano");
    selectHabit(s, s.habits[0]!.id);
    addPracticeLog(s, s.habits[0]!.id, 30, NOW); // manual log before session one
    s.nous = 1000;
    expect(buyCell(s, hex(2, 0)).ok).toBe(true); // Room to grow's trigger, met pre-session
    startSession(s, null);
    writeNote(s, "a note during session one"); // Marginalia's trigger, met in-session
    advance(s, 60);
    expect(unlockIds(s)).toEqual([]);
    expect(s.session!.unlocked).toEqual([]);
    endSession(s, NOW);
    // The gate lifts at session one's end boundary: everything already
    // earned fires there at once — no progress lost, nothing mid-session.
    expect(s.summary!.achievements).toEqual(["first-light", "off-the-clock", "marginalia", "room-to-grow"]);
  });

  it("records unlocks with their timestamps and never re-fires", () => {
    const s = fresh();
    completeSession(s);
    s.forge.earned = 1; // the minted roll was taken (nothing waits in the Forge)
    expect(syncAchievements(s, { now: NOW }).map((d) => d.id)).toEqual(["roll-credit"]);
    expect(s.achievements["roll-credit"]).toBe(NOW);
    expect(syncAchievements(s, { now: NOW + 1 })).toEqual([]);
  });

  it("queues in-session unlocks into the summary row instead of toasting", () => {
    const s = fresh();
    completeSession(s);
    selectHabit(s, null);
    startSession(s, null);
    // Untethered fires at the session-start boundary and queues.
    expect(syncAchievements(s, { now: NOW })).toEqual([]);
    expect(s.session!.unlocked).toEqual(["untethered"]);
    writeNote(s, "marginalia");
    expect(s.session!.unlocked).toEqual(["untethered", "marginalia"]);
    endSession(s, NOW);
    expect(s.summary!.achievements).toEqual(["untethered", "marginalia"]);
    expect(unlockIds(s)).toEqual(["first-light", "untethered", "marginalia"]);
  });
});

describe("the 17-feat launch set", () => {
  it("First light: the first completed flow session", () => {
    const s = fresh();
    completeSession(s);
    expect(s.achievements["first-light"]).toBe(NOW);
  });

  it("Off the clock: the first manual practice log", () => {
    const s = fresh();
    completeSession(s);
    createHabit(s, "Piano");
    const result = addPracticeLog(s, s.habits[0]!.id, 5, NOW);
    expect(result.unlocked).toEqual(["off-the-clock"]);
  });

  it("Kept promise: a completed goal", () => {
    const s = fresh();
    completeSession(s);
    createGoal(s, { habitId: s.habits[0]!.id, minutes: 1, schedule: "once", now: NOW });
    startSession(s, null); // helper's habit is still selected
    advance(s, 60); // goal completes inside the tick; the tick detects
    expect(s.session!.unlocked).toContain("kept-promise");
  });

  it("Untethered: starting an unstructured session", () => {
    const s = fresh();
    completeSession(s);
    expect(s.unstructuredSessions).toBe(0);
    selectHabit(s, null);
    startSession(s, null);
    expect(s.unstructuredSessions).toBe(1);
    expect(s.session!.unlocked).toContain("untethered");
    // A session with an active habit does not count, and the feat never
    // re-fires for later unstructured sessions.
    endSession(s, NOW);
    startSession(s, null);
    expect(s.unstructuredSessions).toBe(2);
    expect(s.session!.unlocked).toEqual([]);
  });

  it("Marginalia: an in-flow note, never a between-session one (ADR-0018)", () => {
    const s = fresh();
    completeSession(s);
    writeNote(s, "captured outside any session");
    // The between-session note changes nothing: Marginalia waits.
    expect(s.achievements["marginalia"]).toBeUndefined();
    startSession(s, null);
    writeNote(s, "captured in flow");
    expect(s.session!.unlocked).toEqual(["marginalia"]);
  });

  it("On the clock: a planned session completed to its target", () => {
    const s = fresh();
    completeSession(s);
    startSession(s, 600);
    advance(s, 600);
    endSession(s, NOW);
    expect(s.plannedSessionsCompleted).toBe(1);
    expect(s.summary!.achievements).toContain("on-the-clock");
    // Ending short of the target does not count.
    startSession(s, 600);
    advance(s, 599);
    endSession(s, NOW);
    expect(s.plannedSessionsCompleted).toBe(1);
  });

  it("Room to grow: the first cell purchase", () => {
    const s = fresh();
    completeSession(s);
    s.nous = 1000;
    expect(buyCell(s, hex(2, 0)).unlocked).toEqual(["room-to-grow"]);
  });

  it("Spark: first charge delivered during flow", () => {
    const s = fresh();
    completeSession(s);
    give(s, "focusKeyed", hex(1, 0));
    give(s, "infusor", hex(0, 1));
    s.chargeWindow = 60;
    startSession(s, null);
    advance(s, 1);
    expect(s.session!.unlocked).toContain("spark");
    // Charge paused between sessions never delivers: no upgrade-mode fire.
    endSession(s, NOW);
    expect(syncAchievements(s, { now: NOW }).map((d) => d.id)).toEqual([]);
  });

  it("Roll credit: the first Forge roll taken, not merely minted", () => {
    const s = fresh();
    completeSession(s);
    // A minted roll waits in the Forge; taking it is the feat.
    s.forge.earned = 1;
    s.bankedRolls.push(generateOffer(s, stubRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])));
    expect(syncAchievements(s, { now: NOW }).map((d) => d.id)).toEqual([]);
    s.bankedRolls.length = 0;
    expect(syncAchievements(s, { now: NOW }).map((d) => d.id)).toEqual(["roll-credit"]);
  });

  it("Two of a kind and Fine china: combining pairs up the rarity ladder", () => {
    const s = fresh();
    completeSession(s);
    const a = give(s, "additive", null);
    const b = give(s, "additive", null);
    expect(combine(s, a.id, b.id).unlocked).toEqual(["two-of-a-kind"]);
    expect(s.combinations).toBe(1);
    const c = give(s, "additive", null);
    const d = give(s, "additive", null);
    c.rarity = "uncommon";
    d.rarity = "uncommon";
    expect(combine(s, c.id, d.id).unlocked).toEqual(["fine-china"]);
    expect(s.modules.some((m) => m.rarity === "rare")).toBe(true);
  });

  it("Power chord: chord multipliers stacked to ×2 of the composite", () => {
    const s = fresh();
    completeSession(s);
    // A 4·5·6 major triad overlapped with a 5·6·7 blues triad:
    // 1.5 × 1.75 = ×2.625, clear of the ×2 bar. The boundary checks on
    // each placement detect the crossing as the layout lands.
    for (const q of [1, 2, 3, 4, 5, 6]) s.cells.push(hex(q, 0));
    for (const q of [1, 2, 3, 4, 5, 6]) placeModule(s, give(s, "additive", null).id, hex(q, 0));
    expect(computeRates(s, true).chordMultiplier).toBeGreaterThan(2);
    expect(s.achievements["power-chord"]).toBeDefined();
  });

  it("Power chord reads synthesizers and spacers only: other neighbors never chord", () => {
    const s = fresh();
    completeSession(s);
    s.cells.push(hex(2, 0));
    give(s, "additive", hex(1, 0)); // G4 — a Fifth with the opening C4: ×1.3
    give(s, "focusKeyed", hex(2, 0)); // not a synth — would add another fifth if it voiced
    const def = ACHIEVEMENTS.find((a) => a.id === "power-chord")!;
    expect(def.progress(s, { chargeDelivered: false }).current).toBeCloseTo(1.3, 9);
  });

  it("Eyes on the horizon: pressing the reserved prestige button", () => {
    const s = fresh();
    completeSession(s);
    expect(acknowledgeHorizon(s).unlocked).toEqual(["eyes-on-the-horizon"]);
  });

  it("Time in the seat: 100 lifetime practice minutes, live plus manual", () => {
    const s = fresh();
    completeSession(s);
    const id = s.habits[0]!.id;
    addPracticeLog(s, id, 40, NOW);
    expect(unlockIds(s)).toEqual(["first-light", "off-the-clock"]);
    addPracticeLog(s, id, 60, NOW);
    expect(s.achievements["time-in-the-seat"]).toBe(NOW);
  });

  it("Keeping time: ten completed flow sessions", () => {
    const s = fresh();
    for (let i = 0; i < 10; i++) completeSession(s);
    expect(s.achievements["keeping-time"]).toBe(NOW);
  });

  it("Marathoner: ten lifetime hours of live flow practice", () => {
    const s = fresh();
    completeSession(s);
    startSession(s, null); // helper's habit is still selected: live practice logs
    advance(s, 36000); // ten hours of live practice in one stretch
    endSession(s, NOW);
    expect(s.summary!.achievements).toContain("marathoner");
  });

  it("Commonplace book: 25 notes recorded", () => {
    const s = fresh();
    completeSession(s);
    startSession(s, null);
    for (let i = 0; i < 25; i++) writeNote(s, `note ${i}`);
    expect(s.session!.unlocked).toContain("commonplace-book");
  });
});

describe("the achievementBoost term", () => {
  it("adds per feat, tuning-exposed", () => {
    const s = fresh();
    expect(achievementBoostOf(s)).toBe(1);
    s.achievements["first-light"] = NOW;
    s.achievements["roll-credit"] = NOW;
    expect(achievementBoostOf(s)).toBe(1 + 2 * BALANCE.achievementBoostPerFeat);
  });

  it("enters the rate: rate = composite × empowerment × achievementBoost", () => {
    const s = fresh();
    const plain = computeRates(s, true);
    expect(plain.achievementBoost).toBe(1);
    expect(plain.rate).toBeCloseTo(plain.composite * plain.empowerment, 9);

    s.achievements["first-light"] = NOW;
    s.achievements["roll-credit"] = NOW;
    s.achievements["kept-promise"] = NOW;
    const boosted = computeRates(s, true);
    expect(boosted.achievementBoost).toBeCloseTo(1.06, 9);
    expect(boosted.rate).toBeCloseTo(plain.rate * 1.06, 9);
    expect(boosted.rate).toBeCloseTo(boosted.composite * boosted.empowerment * boosted.achievementBoost, 9);
  });
});

describe("achievement persistence", () => {
  it("round-trips the id → unlockedAt map and the counters", () => {
    const s = fresh();
    completeSession(s);
    acknowledgeHorizon(s);
    s.unstructuredSessions = 3;
    s.plannedSessionsCompleted = 2;
    s.combinations = 1;
    const text = serialize(s, NOW);
    const loaded = deserialize(text);
    expect(loaded.error).toBeUndefined();
    expect(serialize(loaded.state!, NOW)).toBe(text);
    expect(loaded.state!.achievements["first-light"]).toBe(NOW);
    expect(loaded.state!.achievements["eyes-on-the-horizon"]).toBeDefined();
  });

  it("saves missing the ledger fields lenient-default them at load", () => {
    const s = fresh();
    completeSession(s);
    const file = JSON.parse(serialize(s, NOW));
    delete file.state.achievements;
    delete file.state.unstructuredSessions;
    delete file.state.plannedSessionsCompleted;
    delete file.state.combinations;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.achievements).toEqual({});
    expect(loaded.state!.unstructuredSessions).toBe(0);
    expect(loaded.state!.plannedSessionsCompleted).toBe(0);
    expect(loaded.state!.combinations).toBe(0);
  });

  it("a mid-flow save carries the session's unlock queue", () => {
    const s = fresh();
    completeSession(s);
    selectHabit(s, null);
    startSession(s, null);
    writeNote(s, "kept mid-flow");
    const loaded = deserialize(serialize(s, NOW));
    expect(loaded.state!.session!.unlocked).toEqual(["untethered", "marginalia"]);
  });
});

describe("progress reads", () => {
  it("expose every feat's fraction for the popover bars", () => {
    const s = fresh();
    completeSession(s);
    s.nous = 1000;
    buyCell(s, hex(2, 0));
    const ctx = { chargeDelivered: false };
    const def = achievementById("room-to-grow")!;
    expect(def.progress(s, ctx)).toEqual({ current: 1, goal: 1 });
    const ladder = achievementById("keeping-time")!;
    expect(ladder.progress(s, ctx)).toEqual({ current: 1, goal: 10 });
    const seat = achievementById("time-in-the-seat")!;
    expect(seat.progress(s, ctx).goal).toBe(6000);
  });
});
