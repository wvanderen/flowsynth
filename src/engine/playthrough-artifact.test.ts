import { describe, expect, it } from "vitest";
import {
  PLAYTHROUGH_ARTIFACT_FORMAT,
  PLAYTHROUGH_ARTIFACT_VERSION,
  artifactNote,
  exportPlaythroughArtifact,
  importPlaythroughArtifact,
} from "./playthrough-artifact";
import { playthroughInspection, runPlaythrough } from "./playthrough";
import type { PlaythroughRecord } from "./playthrough";

// The run artifact's format seam (issue #473, parent stories 34–36): the
// named rejections at the file boundary, the round trip's byte-faithful
// record, and the imported copies' read-only guarantee. The behavioral
// boundary — the app commands humans and agents share — carries its own
// cases beside these.

function sampleRecord(): PlaythroughRecord {
  // A one-day budget ends incomplete quickly; the record shape is what
  // the round trip and the rejections read, not the run's balance figures.
  return runPlaythrough({
    scenarioId: "fresh-start",
    seed: 473,
    policyId: "prompt",
    claimTarget: 2,
    schedule: {
      sessionsPerDay: 1,
      sessionMinutes: 1,
      breatherMinutes: 1,
      habitName: "Practice",
      goalMinutes: 25,
      startAt: Date.UTC(2026, 0, 5, 9, 0, 0),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    budgetDays: 1,
    overrides: {},
  });
}

describe("the run artifact format", () => {
  it("exports one versioned artifact carrying recipe, provenance, trajectory, reasons, status, and snapshots", () => {
    const record = sampleRecord();
    const artifact = JSON.parse(exportPlaythroughArtifact({ record, exportedAt: 1750000000000 })) as Record<string, unknown>;
    expect(artifact.format).toBe(PLAYTHROUGH_ARTIFACT_FORMAT);
    expect(artifact.version).toBe(PLAYTHROUGH_ARTIFACT_VERSION);
    expect(artifact.exportedAt).toBe(1750000000000);
    expect(artifact.runId).toBe(record.runId);
    expect(artifact.modified).toBe(false);
    expect(artifact.interventions).toEqual([]);
    const carried = artifact.record as PlaythroughRecord;
    expect(carried.recipe).toEqual(record.recipe);
    expect(carried.source).toEqual(record.source);
    expect(carried.events).toEqual(record.events);
    expect(carried.trajectory).toEqual(record.trajectory);
    expect(carried.snapshots).toEqual(record.snapshots);
    expect(carried.complete).toBe(record.complete);
    expect(carried.stop).toEqual(record.stop);
    expect(carried.state).toEqual(record.state);
  });

  it("round trips through import with the record, status, and interventions intact", () => {
    const record = sampleRecord();
    const interventions = [{ at: 1750000001000, label: "Dev grant — +100ν", ok: true }];
    const text = exportPlaythroughArtifact({ record, modified: true, interventions, exportedAt: 1750000000000 });
    const load = importPlaythroughArtifact(text);
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    expect(load.artifact.runId).toBe(record.runId);
    expect(load.artifact.modified).toBe(true);
    expect(load.artifact.interventions).toEqual(interventions);
    expect(load.artifact.record).toEqual(record);
    expect(artifactNote(load.artifact)).toContain("modified — 1 intervention");
    expect(artifactNote(load.artifact)).toContain(`engine ${record.source.engineSource}`);
  });

  it("freezes an imported artifact's recorded states whole, like a fresh walk's", () => {
    const text = exportPlaythroughArtifact({ record: sampleRecord() });
    const load = importPlaythroughArtifact(text);
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    expect(Object.isFrozen(load.artifact.record.state)).toBe(true);
    for (const snapshot of load.artifact.record.snapshots) {
      expect(Object.isFrozen(snapshot.state)).toBe(true);
    }
    expect(() => {
      (load.artifact.record.state as { mode: string }).mode = "flow";
    }).toThrow();
  });

  it("rejects a save file, non-JSON, and non-artifact JSON by name", () => {
    expect(importPlaythroughArtifact("not json at all").ok).toBe(false);
    const load = importPlaythroughArtifact('{"app":"flowsynth","version":14,"savedAt":0,"state":{}}');
    expect(load.ok).toBe(false);
    if (load.ok) return;
    expect(load.error).toBe("This file is not a FlowSynth run artifact.");
    expect(importPlaythroughArtifact("{}").ok).toBe(false);
    expect(importPlaythroughArtifact("[]").ok).toBe(false);
  });

  it("rejects unsupported versions clearly: newer, older, and missing", () => {
    const record = sampleRecord();
    const text = exportPlaythroughArtifact({ record });
    const newer = JSON.parse(text) as Record<string, unknown>;
    newer.version = PLAYTHROUGH_ARTIFACT_VERSION + 1;
    const newerLoad = importPlaythroughArtifact(JSON.stringify(newer));
    expect(newerLoad.ok).toBe(false);
    if (newerLoad.ok) return;
    expect(newerLoad.error).toContain(`Artifact version ${PLAYTHROUGH_ARTIFACT_VERSION + 1} is newer than this build supports`);
    const older = JSON.parse(text) as Record<string, unknown>;
    older.version = PLAYTHROUGH_ARTIFACT_VERSION - 1;
    expect(importPlaythroughArtifact(JSON.stringify(older)).ok).toBe(false);
    const unversioned = JSON.parse(text) as Record<string, unknown>;
    delete unversioned.version;
    const unversionedLoad = importPlaythroughArtifact(JSON.stringify(unversioned));
    expect(unversionedLoad.ok).toBe(false);
    if (!unversionedLoad.ok) expect(unversionedLoad.error).toContain("format version is missing");
  });

  it("rejects incomplete payloads by naming the missing part", () => {
    const record = sampleRecord();
    const text = exportPlaythroughArtifact({ record });
    const strip = (pick: (artifact: Record<string, unknown>) => void): string => {
      const artifact = JSON.parse(text) as Record<string, unknown>;
      pick(artifact);
      return JSON.stringify(artifact);
    };
    const expectReject = (payload: string, fragment: string): void => {
      const load = importPlaythroughArtifact(payload);
      expect(load.ok).toBe(false);
      if (!load.ok) expect(load.error).toContain(fragment);
    };
    expectReject(strip((a) => delete a.exportedAt), "export stamp");
    expectReject(strip((a) => delete a.runId), "run id is missing");
    expectReject(strip((a) => delete (a.record as Record<string, unknown>).recipe), "recipe is missing");
    expectReject(strip((a) => delete (a.record as Record<string, unknown>).source), "source provenance is missing");
    expectReject(strip((a) => delete (a.record as Record<string, unknown>).events), "decision record is missing");
    expectReject(strip((a) => delete (a.record as Record<string, unknown>).trajectory), "trajectory is missing");
    expectReject(strip((a) => delete (a.record as Record<string, unknown>).snapshots), "snapshots are missing");
    expectReject(
      strip((a) => {
        (a.record as Record<string, unknown>).snapshots = [];
      }),
      "snapshots are missing",
    );
    expectReject(
      strip((a) => {
        const snapshots = (a.record as Record<string, unknown>).snapshots as Record<string, unknown>[];
        delete snapshots[0]!.state;
      }),
      "snapshot is incomplete",
    );
    expectReject(strip((a) => delete (a.record as Record<string, unknown>).complete), "stop status is missing");
    expectReject(strip((a) => delete (a.record as Record<string, unknown>).state), "final state is missing");
    expectReject(strip((a) => delete a.modified), "modified status is missing");
    expectReject(strip((a) => delete a.interventions), "intervention record is incomplete");
    expectReject(strip((a) => { a.runId = "another-run"; }), "does not match its record");
  });

  it("reads foreign historical rates and contributions exactly as recorded", () => {
    const record = sampleRecord();
    const snapshot = record.snapshots[0]!;
    const carried = { ...record, source: { ...record.source, engineSource: "historical-engine" },
      snapshots: [{ ...snapshot, rate: 123456, voices: snapshot.voices.map(voice => ({ ...voice, nuPerSecond: 654321 })) }, ...record.snapshots.slice(1)] };
    const loaded = importPlaythroughArtifact(exportPlaythroughArtifact({ record: carried }));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const inspection = playthroughInspection(loaded.artifact.record, 0);
    expect(inspection.rate).toBe(123456);
    expect(inspection.voices).toEqual(carried.snapshots[0]!.voices);
    expect(inspection.voices.length).toBeGreaterThan(0);
  });

  it("rejects malformed nested evidence before it can enter inspection", () => {
    const text = exportPlaythroughArtifact({ record: sampleRecord() });
    const mutations = [
      (a: any) => { a.record.snapshots[0].state = {}; },
      (a: any) => { a.record.snapshots[0].state.modules = [null]; },
      (a: any) => { a.record.snapshots[0].voices = [{}]; },
      (a: any) => { a.record.state.world = {}; },
      (a: any) => { a.record.events = [{}]; },
      (a: any) => { a.record.trajectory = [{ snapshot: 999999 }]; },
      (a: any) => { a.record.recipe.schedule = {}; },
      (a: any) => { a.record.stop.kind = "unknown"; },
      (a: any) => { a.interventions = [{ at: 1, label: "bad" }]; },
    ];
    for (const mutate of mutations) {
      const artifact = JSON.parse(text);
      mutate(artifact);
      const loaded = importPlaythroughArtifact(JSON.stringify(artifact));
      expect(loaded.ok).toBe(false);
      if (!loaded.ok) expect(loaded.error).toContain("malformed");
    }
  });

  it("refuses to export without a recorded run", () => {
    expect(() => exportPlaythroughArtifact({ record: undefined as unknown as PlaythroughRecord })).toThrow(
      /export needs a recorded run/,
    );
  });
});
