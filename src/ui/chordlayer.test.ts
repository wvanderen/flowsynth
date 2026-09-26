import { describe, expect, it } from "vitest";
import { chordOverlay, convexHull, edgeDistance, hexVertices } from "./chordlayer";
import { hex } from "../engine/hex";
import { HEX_RADIUS } from "./face";
import type { Hex, NamedChordTerm } from "../engine/types";

// The chord overlay's geometry: which modules light and the hulls that wrap
// named chords. render.ts's point mapping is injected, so tests use the same
// axial→pixel shape. With the carrierless board (ADR-0021) there are no pair
// links — chords are register-free pitch sets drawn as hulls over their
// voices.

const point = ({ q, r }: { q: number; r: number }): [number, number] => [
  Math.sqrt(3) * 65 * (q + r / 2),
  65 * 1.5 * r,
];

const chord = (name: string, moduleIds: string[], instances = 1): NamedChordTerm => ({
  name,
  bonus: 0.15,
  instances,
  moduleIds,
});

const POS: Record<string, Hex> = {
  m1: hex(0, 0),
  m2: hex(1, 0),
  m3: hex(2, 0),
  far: hex(0, 5),
};

function overlayWith(namedChords: NamedChordTerm[]) {
  return chordOverlay({
    namedChords,
    posOf: (id) => POS[id] ?? null,
    point,
    radius: HEX_RADIUS,
    pad: 5,
    labelFor: (c) => `${c.name} ×${(1 + c.bonus).toFixed(2)}`,
  });
}

function polygonOf(mark: { points: string }): [number, number][] {
  return mark.points.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
}

// Every voice hex's corners must sit at least pad inside the hull: the
// clearance must hold along the edges, not just at the vertices.
function expectClearance(mark: { points: string }, voices: Hex[], pad: number): void {
  const polygon = polygonOf(mark);
  for (const voice of voices) {
    for (const corner of hexVertices(point(voice), HEX_RADIUS)) {
      expect(edgeDistance(corner, polygon)).toBeGreaterThanOrEqual(pad - 0.01);
    }
  }
}

describe("convexHull", () => {
  it("keeps the corners and drops interior points", () => {
    const hull = convexHull([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
    ]);
    expect(hull).toHaveLength(4);
  });
});

describe("chordOverlay", () => {
  it("wraps every voice hex inside the named chord's hull and labels it", () => {
    const overlay = overlayWith([chord("Octave", ["m1", "m2"])]);
    expect(overlay.marks).toHaveLength(1);
    const mark = overlay.marks[0]!;
    expect(mark.label).toBe("Octave ×1.15");
    expectClearance(mark, [hex(0, 0), hex(1, 0)], 5);
    // The label rides above the hull, clear of the faces.
    const minY = Math.min(...polygonOf(mark).map((p) => p[1]!));
    expect(mark.labelY).toBeLessThan(minY);
  });

  it("holds the clearance along a deep chord's row, not just at the corners", () => {
    // A three-in-a-row chord is the elongated case that breaks radial
    // scaling: mid-row faces would clip a vertex-scaled hull.
    const overlay = overlayWith([chord("Major triad", ["m1", "m2", "m3"])]);
    expect(overlay.marks).toHaveLength(1);
    expectClearance(overlay.marks[0]!, [hex(0, 0), hex(1, 0), hex(2, 0)], 5);
  });

  it("lights exactly the voices of drawable terms", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    expect(overlay.participants.has("m1")).toBe(true);
    expect(overlay.participants.has("m2")).toBe(true);
    expect(overlay.participants.has("m3")).toBe(false);
  });

  it("keys marks by index so same-named chords in separate clusters coexist", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Fifth", ["m3", "far"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
      pad: 5,
      labelFor: (c) => c.name,
    });
    expect(overlay.marks.map((m) => m.key)).toEqual(["chord-0", "chord-1"]);
    expect(overlay.marks.every((m) => m.label === "Fifth")).toBe(true);
  });

  it("skips terms whose voices left the board — no light, no mark", () => {
    const overlay = overlayWith([chord("Octave", ["m1", "gone"])]);
    expect(overlay.marks).toHaveLength(0);
    expect(overlay.participants.size).toBe(0);
  });
});
