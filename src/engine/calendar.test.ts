import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession } from "./actions";
import { fresh } from "./fixtures";
import { createGoal, editGoal, occurrenceKeyFor, occurrenceStartFor } from "./goals";
import { createHabit, selectHabit } from "./habits";
import { composePlaythroughRecipe, runPlaythrough } from "./playthrough";
import type { GoalSchedule } from "./types";

// The calendar-basis regressions (issue #505). The engine's calendar basis
// is the host's local calendar — goal occurrence days and playthrough
// schedule days both read it — and that basis is declared, not discovered:
// these cases hold under UTC and under a DST-observing zone alike (the
// targeted runner, `npm run test:calendar`, executes this file and the goals
// suite under both). The expectations are derived from the raw UTC offset —
// an independent construction — so the goals primitives can never disagree
// with themselves without failing here, and the fixed-figure assertions are
// identical in both zones by design.

const DAY_MS = 24 * 60 * 60 * 1000;

// The local midnight preceding t, derived arithmetically from the raw
// offsets the host reports across the previous day. On a fall-back day the
// calendar date holds two midnight instants (00:00 in the pre-transition
// offset and 00:00 in the post-transition one); the engine's day start is
// the earliest real midnight — the Date-constructor pick — so the derivation
// takes every offset seen in the trailing 26 hours, keeps the candidates
// that display as 00:00 in the host zone, and takes the earliest. Ordinary
// days have one offset and one candidate; spring-forward days one real
// midnight. This is the independent side of every derivation below.
function localMidnightBefore(t: number): number {
  const offsets = new Set<number>();
  for (let back = 0; back <= 26; back += 1) offsets.add(-new Date(t - back * 3_600_000).getTimezoneOffset());
  let earliest: number | null = null;
  for (const offset of offsets) {
    const minutesIntoDay = (((t / 60_000) + offset) % 1440 + 1440) % 1440;
    const candidate = t - minutesIntoDay * 60_000;
    const shown = new Date(candidate);
    if (shown.getHours() !== 0 || shown.getMinutes() !== 0) continue;
    if (earliest === null || candidate < earliest) earliest = candidate;
  }
  return earliest!;
}

function withHabit(s: ReturnType<typeof fresh>) {
  const habit = createHabit(s, "Piano")!.habit!;
  selectHabit(s, habit.id);
  return habit;
}

describe("the declared calendar basis (issue #505)", () => {
  it("daily occurrences begin at the earliest local midnight — the first one on a fall-back day", () => {
    // The first stamp lands on different local dates per zone (02:00 UTC is
    // the previous evening in a west-of-UTC zone); the second sits after a
    // 23-hour spring-forward day; the third sits on a fall-back day, whose
    // calendar date holds two midnight instants — the day rolls at the
    // first of them, and the derivation pins exactly that pick.
    const stamps = [
      Date.UTC(2026, 5, 10, 2, 0, 0),
      Date.UTC(2026, 2, 9, 12, 30, 0),
      Date.UTC(2026, 10, 1, 21, 0, 0),
    ];
    const schedule: GoalSchedule = { kind: "daily" };
    for (const now of stamps) {
      const start = occurrenceStartFor(schedule, now, 0);
      expect(start).toBe(localMidnightBefore(now));
      // The occurrence key and its own period start can never disagree.
      expect(occurrenceKeyFor(schedule, now)).toBe(occurrenceKeyFor(schedule, start));
      expect(start).toBeLessThanOrEqual(now);
    }
  });

  it("weekly occurrences begin on the local Monday", () => {
    const stamps = [Date.UTC(2026, 2, 8, 22, 0, 0), Date.UTC(2026, 10, 1, 12, 0, 0)];
    const schedule: GoalSchedule = { kind: "weekly" };
    for (const now of stamps) {
      const start = occurrenceStartFor(schedule, now, 0);
      expect(new Date(start).getDay()).toBe(1); // Monday, in local terms
      expect(start).toBeLessThanOrEqual(now);
      expect(occurrenceKeyFor(schedule, now)).toBe(occurrenceKeyFor(schedule, start));
    }
  });

  it("a session crossing the midnight after a DST-shortened day splits at the local boundary", () => {
    // Local noon on March 9 — its preceding local midnight closes the
    // 23-hour spring-forward day (March 8) in a DST-observing zone and an
    // ordinary 24-hour day in UTC. The split figures are identical in both.
    const boundary = localMidnightBefore(new Date(2026, 2, 9, 12).getTime());
    const s = fresh();
    const habit = withHabit(s);
    const goal = createGoal(s, { habitId: habit.id, minutes: 60, schedule: "weekly", now: boundary - DAY_MS }).goal!;
    startSession(s, null, boundary - 600_000);
    advance(s, 1200);
    endSession(s, boundary + 600_000);
    const fuel = s.goalFuel;
    editGoal(s, goal.id, { minutes: 60, schedule: "daily" }, boundary + 600_000);
    // Only the post-boundary share belongs to the new daily occurrence;
    // the pre-boundary share never replays as fuel.
    expect(goal.progressSeconds).toBeCloseTo(600, 6);
    expect(goal.liveSeconds).toBeCloseTo(600, 6);
    expect(s.goalFuel).toBe(fuel);
  });
});

describe("the playthrough schedule's calendar (issue #505)", () => {
  it("declares the host's calendar and rejects a foreign zone by name", () => {
    const host = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const recipe = composePlaythroughRecipe();
    expect(recipe.schedule.timeZone).toBe(host);
    const foreign = host === "UTC" ? "America/Chicago" : "UTC";
    expect(() => composePlaythroughRecipe({ schedule: { timeZone: foreign } }))
      .toThrow(/timeZone must match the engine's host calendar/);
  });

  it("fits a real spring-forward and fall-back day, whatever the zone's day length", () => {
    // The anchor's first five days straddle March 8 (23 hours in a
    // DST-observing zone) and the fall-back stretch similarly.
    const recipe = composePlaythroughRecipe({
      seed: 42,
      budgetDays: 5,
      schedule: { startAt: Date.UTC(2026, 2, 6, 23, 30, 0) },
    });
    expect(recipe.schedule.startAt).toBe(Date.UTC(2026, 2, 6, 23, 30, 0));
    const fallback = composePlaythroughRecipe({
      seed: 42,
      budgetDays: 5,
      schedule: { startAt: Date.UTC(2026, 9, 30, 23, 30, 0) },
    });
    expect(fallback.schedule.startAt).toBe(Date.UTC(2026, 9, 30, 23, 30, 0));
  });

  it("an over-full day is refused exactly where the calendar is shorter than the schedule", () => {
    // Two 600-minute sessions with 120-minute breathers span exactly 24
    // hours — enough for a UTC day, one hour too much for the 23-hour
    // spring-forward day. The validator must refuse where the calendar is
    // shorter and accept where it is not, per the host's own day lengths.
    const anchor = Date.UTC(2026, 2, 6, 23, 30, 0);
    const dayGap = new Date(2026, 2, 9).getTime() - new Date(2026, 2, 8).getTime();
    let refused = false;
    try {
      composePlaythroughRecipe({
        seed: 42,
        budgetDays: 2,
        schedule: { startAt: anchor, sessionsPerDay: 2, sessionMinutes: 600, breatherMinutes: 120 },
      });
    } catch (error) {
      refused = (error as Error).message.includes("must fit each calendar day");
    }
    expect(refused).toBe(dayGap < DAY_MS);
  });

  it("a short real walk records the declared schedule identically across calendar bases", () => {
    // Two declared days of two 25-minute sessions: 6,000 credited seconds,
    // day 2's first session at the second local midnight after the anchor —
    // 23 hours after it under a DST-observing zone, 24 under UTC — with the
    // honest budget stop. The figures are computed from the host's own day
    // lengths, so the same assertion pins both zones.
    const anchor = Date.UTC(2026, 2, 7, 9, 0, 0);
    const record = runPlaythrough(composePlaythroughRecipe({
      seed: 42,
      budgetDays: 2,
      schedule: { startAt: anchor },
    }));
    expect(record.days).toBe(2);
    expect(record.complete).toBe(false);
    expect(record.stop.kind).toBe("budget");
    expect(record.creditedSeconds).toBe(4 * 25 * 60);
    const sessions = record.events.filter((event) => event.kind === "session");
    expect(sessions).toHaveLength(4);
    // Session events record at the session's end: 1,500 s after its start.
    expect(sessions[0]!.at).toBe(25 * 60);
    expect(sessions[1]!.at).toBe(25 * 60 + 30 * 60);
    const springGap = new Date(2026, 2, 9).getTime() - new Date(2026, 2, 8).getTime();
    expect(sessions[2]!.at).toBe(springGap / 1000 + 25 * 60);
    expect(sessions[3]!.at).toBe(springGap / 1000 + 25 * 60 + 30 * 60);
  });
});
