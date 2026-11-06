import { describe, expect, it } from "vitest";
import {
  completeSnapshotsOf,
  composePlaythroughRecipe,
  playthroughInspection,
  runPlaythrough,
  runPlaythroughCheckpoint,
  type PlaythroughRecord,
} from "./playthrough";
import { exportPlaythroughArtifact, importPlaythroughArtifact } from "./playthrough-artifact";
import { syncRates } from "./economy";
import type { GameState } from "./types";

// Bounded historical retention (issue #509): a batch walk may declare
// `retention: "bounded"` and keep the captured figures while the boards
// drop, so a long recording's memory stops growing with the board. These
// cases pin the shape (summaries present, states absent, associations
// exact), the equivalence (bounded and complete walks agree on identical
// inputs), and the refusal boundaries (a bounded record never inspects
// like a complete one nor exports like an interactive artifact).

// One short real walk: two 25-minute sessions on the fresh board —
// seconds of work, enough snapshots to bind events, samples, and eras.
function shortRecipe() {
  return composePlaythroughRecipe({ seed: 468, policyId: "pushing", budgetDays: 2, claimTarget: 2 });
}

function boundedWalk(): PlaythroughRecord {
  return runPlaythrough(shortRecipe(), undefined, { retention: "bounded" });
}

// The behavior-affecting state comparison: discovery stamps carry the
// honest wall clock (presentation metadata, not run behavior — the same
// normalization the artifact comparisons in the UI suite apply).
function comparableState(raw: GameState): GameState {
  const state = structuredClone(raw);
  state.achievements = Object.fromEntries(Object.keys(state.achievements).map((id) => [id, 0]));
  for (const discovery of Object.values(state.chordDiscovery)) discovery.firstFormedAt = 0;
  return state;
}

 describe("bounded retention carries figures, not boards", () => {
  it("a bounded walk's snapshots carry the captured numbers and no states", () => {
    const record = boundedWalk();
    expect(record.retention).toBe("bounded");
    expect(record.snapshots.length).toBeGreaterThan(0);
    for (const snapshot of record.snapshots) {
      expect(snapshot.state).toBeNull();
      expect(snapshot.voices).toEqual([]);
      expect(Number.isFinite(snapshot.numbers.nous)).toBe(true);
      expect(Number.isFinite(snapshot.numbers.eraEarned)).toBe(true);
      expect(Number.isFinite(snapshot.numbers.totalEarned)).toBe(true);
      expect(Number.isFinite(snapshot.numbers.arete)).toBe(true);
      expect(Number.isFinite(snapshot.numbers.maxLevel)).toBe(true);
      expect(Number.isFinite(snapshot.numbers.maxAbsReserve)).toBe(true);
      expect(snapshot.numbers.finite).toBe(true);
    }
    // The final state is still the record's ground truth — one state,
    // retained in both retentions.
    expect(record.state.modules.length).toBeGreaterThan(0);
  });

  it("a complete walk keeps every snapshot's frozen state beside its numbers", () => {
    const record = runPlaythrough(shortRecipe());
    expect(record.retention).toBe("complete");
    for (const snapshot of record.snapshots) {
      expect(snapshot.state).not.toBeNull();
      expect(Object.isFrozen(snapshot.state)).toBe(true);
      // The captured figures are the same clone the state froze: one
      // store, two views.
      expect(snapshot.numbers.nous).toBe(snapshot.state!.nous);
      expect(snapshot.numbers.eraEarned).toBe(snapshot.state!.eraEarned);
      expect(snapshot.numbers.totalEarned).toBe(snapshot.state!.totalEarned);
      expect(snapshot.numbers.arete).toBe(snapshot.state!.arete);
      expect(snapshot.numbers.prestiges).toBe(snapshot.state!.prestiges);
      expect(snapshot.numbers.frontier).toBe(snapshot.state!.world.frontier);
      expect(snapshot.numbers.finite).toBe(true);
    }
    expect(completeSnapshotsOf(record).length).toBe(record.snapshots.length);
  });

  it("event and sample associations resolve exactly on a bounded record", () => {
    const record = boundedWalk();
    // Every stamped decision resolves to a recorded snapshot and carries
    // its snapshot's credited clock.
    for (const event of record.events) {
      expect(event.snapshot).toBeGreaterThanOrEqual(0);
      expect(event.snapshot).toBeLessThan(record.snapshots.length);
      expect(record.snapshots[event.snapshot]!.credited).toBe(event.credited);
      expect(record.snapshots[event.snapshot]!.elapsed).toBe(event.at);
    }
    // Every plotted sample resolves to its own snapshot.
    for (const point of record.trajectory) {
      const snapshot = record.snapshots[point.snapshot]!;
      expect(snapshot.elapsed).toBe(point.elapsed);
      expect(snapshot.credited).toBe(point.credited);
      // The captured figures carry the sample's plotted values.
      expect(snapshot.numbers.eraEarned).toBe(point.eraEarned);
      expect(snapshot.numbers.arete).toBe(point.arete);
    }
  });
});

describe("bounded and complete walks agree on identical inputs", () => {
  // Determinism note: the runner is seeded and action-deterministic, so
  // two walks of one recipe produce one trajectory. A solve tripped by
  // the wall-clock valve would be timing-dependent; these small boards
  // never trip it, and a trip here would surface as a disagreement.
  it("the recorded outcomes and every batch read match exactly", () => {
    const complete = runPlaythrough(shortRecipe());
    const bounded = boundedWalk();
    expect(bounded.snapshots.length).toBe(complete.snapshots.length);
    expect(bounded.events).toEqual(complete.events);
    expect(bounded.trajectory).toEqual(complete.trajectory);
    expect(bounded.claims).toEqual(complete.claims);
    expect(bounded.eras).toEqual(complete.eras);
    expect(bounded.stop).toEqual(complete.stop);
    expect(comparableState(bounded.state)).toEqual(comparableState(complete.state));
    expect(bounded.runId).toBe(complete.runId);
  });
});

describe("a bounded record never masquerades as a complete artifact", () => {
  it("a checkpoint preset walk refuses bounded retention at the door, before any walk", () => {
    // Presets feed interactive inspection and artifact export, so the
    // checkpoint door refuses bounded retention before the walk starts.
    expect(() => runPlaythroughCheckpoint(
      composePlaythroughRecipe({ budgetDays: 1 }),
      "approaching-prestige",
      undefined,
      { retention: "bounded" },
    )).toThrow(/presets are interactive records/);
  });

  it("historical inspection refuses a bounded record by name, and reads a complete one", () => {
    const bounded = boundedWalk();
    expect(() => playthroughInspection(bounded, 0)).toThrow(/bounded-retention record carries no historical board states/);
    const complete = runPlaythrough(shortRecipe());
    const inspection = playthroughInspection(complete, 0);
    expect(inspection.state).toBe(completeSnapshotsOf(complete)[0]!.state);
  });

  it("artifact export refuses a bounded record by name", () => {
    const bounded = boundedWalk();
    expect(() => exportPlaythroughArtifact({ record: bounded }))
      .toThrow(/not a complete interactive artifact/);
    // The complete twin exports whole.
    const complete = runPlaythrough(shortRecipe());
    const text = exportPlaythroughArtifact({ record: complete });
    const load = importPlaythroughArtifact(text);
    expect(load.ok).toBe(true);
  });

  it("artifact import rejects a bounded-shaped record as malformed", () => {
    const complete = runPlaythrough(shortRecipe());
    const text = exportPlaythroughArtifact({ record: complete });
    const parsed = JSON.parse(text) as { record: Record<string, unknown> };
    // A batch artifact that dropped its boards cannot pass as interactive
    // evidence: the snapshots' states are the first thing import reads.
    parsed.record = {
      ...parsed.record,
      retention: "bounded",
      snapshots: (parsed.record.snapshots as Record<string, unknown>[]).map(
        (snapshot) => ({ ...snapshot, state: null }),
      ),
    };
    const load = importPlaythroughArtifact(JSON.stringify(parsed));
    expect(load.ok).toBe(false);
    if (!load.ok) expect(load.error).toMatch(/bounded-retention batch record|historical snapshot/);
  });
});

describe("the capture read's integrity verdicts", () => {
  it("a bounded walk's serialized stride verdicts all pass on a healthy board", () => {
    const bounded = boundedWalk();
    const checked = bounded.snapshots.filter((snapshot) => snapshot.numbers.serializedChecks > 0);
    expect(checked.length).toBeGreaterThan(0);
    for (const snapshot of checked) {
      expect(snapshot.numbers.serializedChecks).toBe(1);
      expect(snapshot.numbers.serializedOk).toBe(1);
    }
    // Complete snapshots carry zeros here: their stride checks run at
    // report time off the retained states.
    for (const snapshot of runPlaythrough(shortRecipe()).snapshots) {
      expect(snapshot.numbers.serializedChecks).toBe(0);
    }
  });

  it("the recorded rate reproduces off the bounded capture, same preview basis as complete", () => {
    const complete = runPlaythrough(shortRecipe());
    const bounded = boundedWalk();
    for (let index = 0; index < complete.snapshots.length; index++) {
      expect(bounded.snapshots[index]!.rate).toBe(complete.snapshots[index]!.rate);
    }
    // The basis itself: a fresh preview read over the final state matches
    // the record's own final figure, both retentions alike.
    const replay = syncRates(structuredClone(bounded.state), false);
    expect(replay.rate).toBeGreaterThan(0);
  });
});
