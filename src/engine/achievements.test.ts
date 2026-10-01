import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achievementBoostOf, achievementById, syncAchievements } from "./achievements";
import { ARETE_HORIZON } from "./accumulator";
import { buyCell, combine, endSession, placeModule, startSession } from "./actions";
import { advance } from "./advance";
import { BALANCE } from "./constants";
import { computeRates } from "./economy";
import { addPracticeLog, createHabit, selectHabit } from "./habits";
import { writeNote } from "./notes";
import { createGoal } from "./goals";
import { deserialize, serialize } from "./save";
import { fresh, give, stubRng, sumSynthValues } from "./fixtures";
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

  it("feats keyed on rolls taken read both sources' total (ADR-0041)", () => {
    const s = fresh();
    completeSession(s);
    // One practice-minted roll, taken: the total earned minus the queue.
    s.flow.earned = 1;
    expect(syncAchievements(s, { now: NOW }).map((d) => d.id)).toEqual(["roll-credit"]);
    // One from each source, both still waiting: none was taken yet.
    const second = fresh();
    completeSession(second);
    second.flow.earned = 1;
    second.forge.earned = 1;
    for (const id of ["wait-a", "wait-b"]) {
      second.bankedRolls.push({
        id,
        candidates: [
          { id: `${id}-c1`, type: "additive", rarity: "common" },
          { id: `${id}-c2`, type: "spacer", rarity: "common" },
          { id: `${id}-c3`, type: "infusor", rarity: "common" },
        ],
      });
    }
    // completeSession already fired first-light at its end boundary; the
    // two-source total with both rolls waiting is zero taken — no credit.
    syncAchievements(second, { now: NOW });
    expect(second.achievements["roll-credit"]).toBeUndefined();
    // Taking one crosses the feat on the total, whichever source minted.
    second.bankedRolls.pop();
    expect(syncAchievements(second, { now: NOW + 1 }).map((d) => d.id)).toEqual(["roll-credit"]);
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

  it("Power chord: one synthesizer carries its participating multipliers to ×2", () => {
    const s = fresh();
    completeSession(s);
    // A 4·5·6 major triad overlapped with a 5·6·7 blues triad: every voice
    // in the run sings a ×1.75 and a ×1.6 term together — ×2.8, clear of
    // the ×2 bar on its own. The boundary checks on each placement detect
    // the crossing as the layout lands.
    for (const q of [1, 2, 3, 4, 5, 6]) s.cells.push(hex(q, 0));
    const first = give(s, "additive", null);
    placeModule(s, first.id, hex(1, 0));
    for (const q of [2, 3, 4, 5, 6]) placeModule(s, give(s, "additive", null).id, hex(q, 0));
    // The G voice sings the root-7 major, the root-4 minor, and the
    // root-0 major: ×1.75 × 1.6 × 1.75.
    expect(computeRates(s, true).contributions.get(first.id)?.chordFactor).toBeGreaterThan(2);
    expect(s.achievements["power-chord"]).toBeDefined();
  });

  it("Power chord refuses the old board-wide read: disjoint stacks are not one voice's ×2", () => {
    const s = fresh();
    completeSession(s);
    // C · G · D overlapping row: each voice stacks ×1.3 × 1.45 = ×1.885 —
    // short of ×2 — while the old global product (1.3² × 1.45 ≈ 2.45)
    // would have cleared it.
    s.cells.push(hex(1, 0), hex(2, 0));
    give(s, "additive", hex(1, 0)); // G4
    give(s, "additive", hex(2, 0)); // D5
    const def = ACHIEVEMENTS.find((a) => a.id === "power-chord")!;
    expect(def.progress(s, { chargeDelivered: false }).current).toBeLessThan(2);
    expect(syncAchievements(s, { now: NOW }).map((d) => d.id)).toEqual([]);
  });

  it("Power chord unlocks persist: an earned feat survives a chordless board", () => {
    const s = fresh();
    completeSession(s);
    s.achievements["power-chord"] = NOW;
    s.achievements["first-light"] = NOW;
    // The ledger is the truth: sync re-evaluates only the locked feats, so
    // a board whose chords are gone never revokes what was earned.
    expect(syncAchievements(s, { now: NOW })).toEqual([]);
    expect(s.achievements["power-chord"]).toBe(NOW);
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

  it("Eyes on the horizon: the lifetime crossing, never the era's measure", () => {
    const s = fresh();
    completeSession(s);
    // The per-era rebasing must never leak into the feat (ADR-0039): a
    // fresh era's fill is not the feat, and a past crossing stays earned
    // whatever the current era says.
    s.eraEarned = ARETE_HORIZON;
    expect(syncAchievements(s, { now: NOW }).map((d) => d.id)).toEqual([]);
    s.totalEarned = ARETE_HORIZON;
    expect(syncAchievements(s, { now: NOW }).map((d) => d.id)).toEqual(["eyes-on-the-horizon"]);
    // Already unlocked never re-fires.
    expect(syncAchievements(s, { now: NOW })).toEqual([]);
    // The era rebases at prestige; the feat stays unlocked regardless.
    s.eraEarned = 0;
    expect(s.achievements["eyes-on-the-horizon"]).toBe(NOW);
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

  it("enters the rate: rate = (synths + infusors) × empowerment × achievementBoost", () => {
    const s = fresh();
    const plain = computeRates(s, true);
    expect(plain.achievementBoost).toBe(1);
    expect(plain.rate).toBeCloseTo(plain.amplitude * plain.empowerment, 9);

    s.achievements["first-light"] = NOW;
    s.achievements["roll-credit"] = NOW;
    s.achievements["kept-promise"] = NOW;
    const boosted = computeRates(s, true);
    expect(boosted.achievementBoost).toBeCloseTo(1.06, 9);
    expect(boosted.rate).toBeCloseTo(plain.rate * 1.06, 9);
    expect(boosted.rate).toBeCloseTo(boosted.amplitude * boosted.empowerment * boosted.achievementBoost, 9);
    // Every displayed module figure carries the boost: they sum to the rate.
    expect(sumSynthValues(boosted)).toBeCloseTo(boosted.rate, 9);
  });
});

describe("achievement persistence", () => {
  it("round-trips the id → unlockedAt map and the counters", () => {
    const s = fresh();
    completeSession(s);
    s.totalEarned = ARETE_HORIZON;
    syncAchievements(s, { now: NOW }); // eyes-on-the-horizon, by reaching
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

  it("an unlocked feat survives a reload that predates the field's checks", () => {
    // A save carrying the feat must neither lose it nor re-fire it on the
    // next boundary, whatever the current era's measure reads (issue #156).
    const s = fresh();
    completeSession(s);
    s.achievements["eyes-on-the-horizon"] = NOW;
    const loaded = deserialize(serialize(s, NOW)).state!;
    expect(loaded.achievements["eyes-on-the-horizon"]).toBe(NOW);
    expect(syncAchievements(loaded, { now: NOW })).toEqual([]);
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
