import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CENTURY_POLICIES, CENTURY_SEEDS } from "./century";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../docs/${name}.json`, import.meta.url), "utf8"));

describe("published calibration evidence", () => {
  it("ships every century slice and the full matrix instead of only citing absent files", () => {
    const report = read("century-calibration-results");
    expect(report.runs).toHaveLength(80);
    for (const minutes of [25, 60]) for (const policy of CENTURY_POLICIES) {
      const slice = read(`century-slice-${minutes}-${policy}`);
      expect(slice.rows.map((row: { seed: number }) => row.seed)).toEqual(CENTURY_SEEDS);
      expect(slice.source).toEqual(report.source);
      expect(report.runs.filter((row: { sessionMinutes: number; policy: string }) =>
        row.sessionMinutes === minutes && row.policy === policy)).toEqual(slice.rows);
    }
  });

  it("ships the two retained-board continuations separately from acquisition pacing", () => {
    for (const variant of ["raw", "collection-reset"]) {
      const fixture = read(`century-fixture-${variant}`);
      expect(fixture.variant).toBe(variant);
      expect(fixture.row.kind).toBe("continuation");
      expect(fixture.row.creditedHours).toBeGreaterThanOrEqual(100);
      expect(fixture.recordingCommit).toMatch(/^[a-f0-9]{40}$/);
    }
    expect(read("century-calibration-results").runs.every((row: { kind: string }) => row.kind === "representative")).toBe(true);
  });

  it("ships the opening and later-era rechecks and their six source slices", () => {
    expect(read("first-prestige-results").runs).toHaveLength(32);
    const report = read("later-era-results");
    expect(report.runs).toHaveLength(48);
    for (const minutes of [25, 60]) for (const policy of ["support", "combat", "ignoring"]) {
      const slice = read(`later-era-slice-${minutes}-${policy}`);
      expect(slice.rows.map((row: { seed: number }) => row.seed)).toEqual(CENTURY_SEEDS);
      expect(slice.source).toEqual(report.source);
    }
  });
});
