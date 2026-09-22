import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, pauseSession, startSession } from "./actions";
import { RECONCILIATION_FLOOR_SECONDS } from "./constants";
import { fresh } from "./fixtures";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, poolOutstanding, resolveHonestyReport } from "./trust";
import type { GameState } from "./types";

// The trust-accounting matrix (focus-tool spec §1–3): presence (visible /
// hidden / slept / discarded / reloaded / import) × mode (planned /
// open-ended) × slice (under-plan / past-target / sub-floor). Every cell's
// banking, crediting, and report expectation is decided by the spec's trust
// table. The Carrier alone produces 0.1 ν/s; the balance starts at the
// opening grant, so assertions read deltas against a captured baseline.

// Buffer an away gap and classify it whole — the flush is the boundary a
// return performs.
function away(state: GameState, seconds: number): void {
  applyGap(state, seconds, "away", 0);
  flushPendingAway(state);
}

describe("presence: visible banks live in every slice", () => {
  it("planned, under target: presence banks and credits live", () => {
    const s = fresh();
    startSession(s, 600);
    const balance = s.nous;
    applyGap(s, 300, "visible", 0);
    expect(s.nous - balance).toBeCloseTo(30, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(300, 6);
    expect(s.session!.accounting.poolSeconds).toBe(0);
  });

  it("planned, past target: overrun presence still banks live — presence is always trusted", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    const balance = s.nous;
    applyGap(s, 300, "visible", 0);
    expect(s.nous - balance).toBeCloseTo(30, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(900, 6);
    expect(s.session!.accounting.poolSeconds).toBe(0);
  });

  it("open-ended: presence banks live", () => {
    const s = fresh();
    startSession(s, null);
    const balance = s.nous;
    applyGap(s, 120, "visible", 0);
    expect(s.nous - balance).toBeCloseTo(12, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(120, 6);
  });
});

describe("presence: hidden away through the trust table", () => {
  it("planned, under target: away is trusted — auto-banks and credits, never questioned", () => {
    const s = fresh();
    startSession(s, 600);
    const balance = s.nous;
    away(s, 400);
    expect(s.nous - balance).toBeCloseTo(40, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(400, 6);
    expect(s.session!.accounting.poolSeconds).toBe(0);
    expect(poolOutstanding(s)).toBe(false);
  });

  it("planned, past target: away is provisional — nous to the bucket, minutes to the pool", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    const balance = s.nous;
    away(s, 300);
    expect(s.nous - balance).toBeCloseTo(0, 6);
    expect(s.session!.accounting.bucketNous).toBeCloseTo(30, 6);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(300, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(600, 6);
    expect(poolOutstanding(s)).toBe(true);
  });

  it("a gap spanning the target splits at the return: under-plan auto-banks, past-target goes provisional", () => {
    const s = fresh();
    startSession(s, 600);
    const balance = s.nous;
    away(s, 900);
    expect(s.nous - balance).toBeCloseTo(60, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(600, 6);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(300, 6);
    expect(s.session!.accounting.bucketNous).toBeCloseTo(30, 6);
  });

  it("open-ended past the floor: all away time is provisional", () => {
    const s = fresh();
    startSession(s, null);
    const balance = s.nous;
    away(s, 1200);
    expect(s.nous - balance).toBe(0);
    expect(s.session!.accounting.bucketNous).toBeCloseTo(120, 6);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(1200, 6);
    expect(s.session!.accounting.creditedSeconds).toBe(0);
  });

  it("paused produces and credits nothing — neither present nor away", () => {
    const s = fresh();
    startSession(s, 600);
    pauseSession(s);
    const before = s.session!.elapsed;
    const result = applyGap(s, 600, "visible", 0);
    expect(result.nousEarned).toBe(0);
    expect(s.session!.elapsed).toBe(before);
  });
});

describe("presence: sub-floor absences auto-credit silently on both modes", () => {
  it("open-ended, below the floor: banks and credits, never joins the pool", () => {
    const s = fresh();
    startSession(s, null);
    const balance = s.nous;
    away(s, RECONCILIATION_FLOOR_SECONDS - 1);
    expect(s.nous - balance).toBeCloseTo((RECONCILIATION_FLOOR_SECONDS - 1) * 0.1, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(RECONCILIATION_FLOOR_SECONDS - 1, 6);
    expect(s.session!.accounting.poolSeconds).toBe(0);
  });

  it("planned, past target, below the floor: still auto-credits silently", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    const balance = s.nous;
    away(s, RECONCILIATION_FLOOR_SECONDS - 1);
    expect(s.nous - balance).toBeCloseTo((RECONCILIATION_FLOOR_SECONDS - 1) * 0.1, 6);
    expect(s.session!.accounting.poolSeconds).toBe(0);
  });

  it("a hidden stretch classifies whole, never per throttled wake-up", () => {
    const s = fresh();
    startSession(s, null);
    // A throttled tab wakes ~1/min: ten buffered wake-ups are one absence.
    const balance = s.nous;
    for (let i = 0; i < 10; i++) applyGap(s, 60, "away", 0);
    flushPendingAway(s);
    expect(s.nous - balance).toBe(0);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(600, 6);
    expect(s.session!.accounting.creditedSeconds).toBe(0);
  });
});

describe("presence: slept gaps size by dual-clock drift", () => {
  it("a positive drift step is away even while the tab stayed visible", () => {
    const s = fresh();
    startSession(s, null);
    const balance = s.nous;
    applyGap(s, 3600, "visible", 1800);
    // The machine slept for 1800 s of the 3600 s wall gap: that span is
    // away (provisional, open-ended past the floor); the awake half banks
    // live as presence.
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(1800, 6);
    expect(s.session!.accounting.bucketNous).toBeCloseTo(180, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(1800, 6);
    expect(s.nous - balance).toBeCloseTo(180, 6);
  });

  it("sleep-gap credit clamps at the plan on planned sessions", () => {
    const s = fresh();
    startSession(s, 600);
    applyGap(s, 5000, "visible", 5000);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(600, 6);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(4400, 6);
  });

  it("sub-noise jitter steps neither discard the gap nor size a sleep", () => {
    const s = fresh();
    startSession(s, 600);
    const balance = s.nous;
    // Date.now() reads whole milliseconds while performance.now() reads
    // finer: even with both clocks running true, the measured drift jitters
    // by a millisecond or two across every boundary — the stopwatch report
    // of a session clock running at a steady fraction of real time.
    for (let i = 0; i < 10; i++) applyGap(s, 0.1, "visible", i % 2 === 0 ? -0.002 : 0.002);
    expect(s.session!.elapsed).toBeCloseTo(1, 6);
    expect(s.nous - balance).toBeCloseTo(0.1, 6);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(1, 6);
    expect(s.session!.accounting.poolSeconds).toBe(0);
  });

  it("a negative drift step (clock rolled back) credits zero", () => {
    const s = fresh();
    startSession(s, 600);
    const balance = s.nous;
    const result = applyGap(s, 600, "visible", -120);
    expect(result.nousEarned).toBe(0);
    expect(s.nous - balance).toBe(0);
    expect(s.session!.elapsed).toBeCloseTo(0, 6);
    expect(s.session!.accounting.creditedSeconds).toBe(0);
  });

  it("sleep during an already-hidden stretch changes nothing: the stretch is away regardless", () => {
    const s = fresh();
    startSession(s, null);
    away(s, 3000);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(3000, 6);
  });

  it("slept past the plan on a planned session: the sleep slice past the target goes provisional", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    applyGap(s, 1800, "visible", 1800);
    // All 1800 s of sleep land past the target: nothing credits, all of it
    // waits in the bucket and pool.
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(600, 6);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(1800, 6);
    expect(s.session!.accounting.bucketNous).toBeCloseTo(180, 6);
  });

  it("a slept gap straddling the plan: sleep clamps at the target, the awake tail banks live", () => {
    const s = fresh();
    startSession(s, 600);
    applyGap(s, 1800, "visible", 1000);
    // Sleep: 600 s trusted up to the plan, 400 s provisional; then 800 s
    // awake presence banks live past the target.
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(1400, 6);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(400, 6);
    expect(s.session!.elapsed).toBeCloseTo(1800, 6);
  });
});

describe("one reconcile path: discard, reload, and import", () => {
  it("a mid-session reload classifies the saved gap as away through the same rules", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 300);
    const savedAt = 1_000_000;
    const loaded = deserialize(serialize(s, savedAt))!.state!;
    // The tab comes back ten minutes later — the whole gap is away, and
    // it spans the target: 300 s trusted, 300 s provisional.
    away(loaded, 600);
    expect(loaded.session!.accounting.creditedSeconds).toBeCloseTo(600, 6);
    expect(loaded.session!.accounting.poolSeconds).toBeCloseTo(300, 6);
  });

  it("a discarded tab's long gap flows provisional on open-ended and the report waits", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 120);
    const loaded = deserialize(serialize(s, 5_000))!.state!;
    away(loaded, 3600);
    expect(loaded.session!.accounting.poolSeconds).toBeCloseTo(3600, 6);
    expect(poolOutstanding(loaded)).toBe(true);
    expect(loaded.session!.accounting.creditedSeconds).toBeCloseTo(120, 6);
  });

  it("an imported save with a running session reconciles identically", () => {
    const original = fresh();
    startSession(original, 600);
    advance(original, 600);
    const imported = deserialize(serialize(original, 2_000_000))!.state!;
    away(imported, 1500);
    // 900 s trusted up to the plan, 600 s provisional past it.
    expect(imported.session!.accounting.creditedSeconds).toBeCloseTo(600, 6);
    expect(imported.session!.accounting.poolSeconds).toBeCloseTo(1500, 6);
    expect(imported.session!.accounting.bucketNous).toBeCloseTo(150, 6);
  });

  it("an imported save's sub-floor gap auto-credits silently, never joining the pool", () => {
    const original = fresh();
    startSession(original, null);
    advance(original, 60);
    const imported = deserialize(serialize(original, 2_000_000))!.state!;
    away(imported, RECONCILIATION_FLOOR_SECONDS - 1);
    expect(imported.session!.accounting.poolSeconds).toBe(0);
    expect(imported.session!.accounting.creditedSeconds).toBeCloseTo(60 + RECONCILIATION_FLOOR_SECONDS - 1, 6);
  });

  it("a discarded tab's gap on a planned session still under the plan is trusted in full", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 120);
    const loaded = deserialize(serialize(s, 5_000))!.state!;
    away(loaded, 300);
    expect(loaded.session!.accounting.creditedSeconds).toBeCloseTo(420, 6);
    expect(loaded.session!.accounting.poolSeconds).toBe(0);
    expect(poolOutstanding(loaded)).toBe(false);
  });
});

describe("the honesty report", () => {
  it("didn't practice: the pool credits 0 and the bucket drops in one move", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 60);
    away(s, 600);
    const balance = s.nous;
    const resolution = resolveHonestyReport(s, "missed");
    expect(resolution.ok).toBe(true);
    expect(s.nous - balance).toBeCloseTo(0, 6);
    expect(s.session!.accounting.poolSeconds).toBe(0);
    expect(s.session!.accounting.bucketNous).toBe(0);
    expect(s.session!.accounting.events).toEqual([{ awaySeconds: 600, outcome: "missed" }]);
  });

  it("did what I planned: credit rises to max(C, T); the pool credits only up to the plan; the bucket banks", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    away(s, 300);
    const balance = s.nous;
    const resolution = resolveHonestyReport(s, "planned");
    expect(resolution.ok).toBe(true);
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(600, 6);
    expect(s.nous - balance).toBeCloseTo(30, 6);
    expect(s.session!.earned).toBeCloseTo(60 + 30, 6);
    expect(s.session!.accounting.events).toEqual([{ awaySeconds: 300, outcome: "planned" }]);
  });

  it("practiced the whole time away: the pool credits fully and the bucket banks", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    away(s, 300);
    const balance = s.nous;
    resolveHonestyReport(s, "full");
    expect(s.session!.accounting.creditedSeconds).toBeCloseTo(900, 6);
    expect(s.nous - balance).toBeCloseTo(30, 6);
    expect(s.session!.earned).toBeCloseTo(90, 6);
    expect(s.session!.accounting.events).toEqual([{ awaySeconds: 300, outcome: "full" }]);
  });

  it("open-ended sessions have no middle option: matching a plan is rejected", () => {
    const s = fresh();
    startSession(s, null);
    away(s, 600);
    expect(resolveHonestyReport(s, "planned").ok).toBe(false);
  });

  it("an unanswered pool rolls forward and the next answer settles the whole recalculated pool", () => {
    const s = fresh();
    startSession(s, null);
    away(s, 300);
    away(s, 300);
    expect(s.session!.accounting.poolSeconds).toBeCloseTo(600, 6);
    resolveHonestyReport(s, "full");
    expect(s.session!.accounting.events).toEqual([{ awaySeconds: 600, outcome: "full" }]);
  });

  it("nothing already banked is ever retracted by a later miss", () => {
    const s = fresh();
    startSession(s, null);
    const balance = s.nous;
    away(s, 600);
    resolveHonestyReport(s, "full");
    expect(s.nous - balance).toBeCloseTo(60, 6);
    away(s, 600);
    resolveHonestyReport(s, "missed");
    expect(s.nous - balance).toBeCloseTo(60, 6);
    expect(s.session!.accounting.events).toHaveLength(2);
  });

  it("credited provisional time accrues the habit and goals only when the report credits it", () => {
    const s = fresh();
    s.habits.push({ id: "h1", name: "Piano", seconds: 0, archived: false });
    s.activeHabitId = "h1";
    s.goals.push({
      id: "g1",
      condition: { kind: "habit-minutes", habitId: "h1", minutes: 10 },
      schedule: { kind: "once" },
      occurrenceKey: "once",
      progressSeconds: 0,
      completed: false,
      completedCount: 0,
      createdAt: 0,
    });
    startSession(s, null);
    away(s, 900);
    // Provisional time sits: no habit seconds, no goal progress.
    expect(s.habits[0]!.seconds).toBe(0);
    expect(s.goals[0]!.progressSeconds).toBe(0);
    resolveHonestyReport(s, "full");
    expect(s.habits[0]!.seconds).toBeCloseTo(900, 6);
    expect(s.goals[0]!.completed).toBe(true);
  });
});

describe("credited practice time is the consumers' seam", () => {
  it("the practice-log entry, the charge window, and the summary key off C — never raw elapsed", () => {
    const s = fresh();
    s.habits.push({ id: "h1", name: "Piano", seconds: 0, archived: false });
    s.activeHabitId = "h1";
    startSession(s, 600);
    advance(s, 600);
    away(s, 300);
    resolveHonestyReport(s, "full");
    endSession(s, 5_000);
    // C = 900: the log entry, the window (0.1 × C), and the summary agree.
    expect(s.practiceLog).toHaveLength(1);
    expect(s.practiceLog[0]!.seconds).toBeCloseTo(900, 6);
    expect(s.practiceLog[0]!.source).toBe("live");
    expect(s.chargeWindow).toBeCloseTo(90, 6);
    expect(s.summary!.seconds).toBeCloseTo(900, 6);
    expect(s.summary!.earned).toBeCloseTo(90, 6);
  });

  it("a reported miss never suppresses a presence-earned target hit", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    away(s, 300);
    resolveHonestyReport(s, "missed");
    endSession(s, 5_000);
    expect(s.plannedSessionsCompleted).toBe(1);
    expect(s.summary!.seconds).toBeCloseTo(600, 6);
    expect(s.summary!.earned).toBeCloseTo(60, 6);
  });

  it("ending with the pool outstanding is refused — the answer is mandatory and final", () => {
    const s = fresh();
    startSession(s, null);
    away(s, 600);
    const result = endSession(s, 5_000);
    expect(result.ok).toBe(false);
    expect(s.mode).toBe("flow");
    resolveHonestyReport(s, "missed");
    expect(endSession(s, 5_000).ok).toBe(true);
  });

  it("a dropped bucket is absent from the summary's banked headline", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    away(s, 300);
    resolveHonestyReport(s, "missed");
    endSession(s, 5_000);
    expect(s.summary!.earned).toBeCloseTo(60, 6);
  });
});
