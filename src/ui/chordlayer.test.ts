import { describe, expect, it } from "vitest";
import { chordOverlay, convexHull, edgeDistance, hexVertices } from "./chordlayer";
import { hex } from "../engine/hex";
import { HEX_RADIUS } from "./face";
import type { ChordPairTerm, Hex, NamedChordTerm } from "../engine/types";

// The chord overlay's geometry (issue #62): which modules light, where pair
// links span, and the hulls that wrap named chords. render.ts's point mapping
// is injected, so tests use the same axial→pixel shape.

const point = ({ q, r }: { q: number; r: number }): [number, number] => [
  Math.sqrt(3) * 65 * (q + r / 2),
  65 * 1.5 * r,
];

const pair = (a: string, b: string): ChordPairTerm => ({ a, b, bonus: 0.1 });
const chord = (name: string, moduleIds: string[]): NamedChordTerm => ({
  name,
  pitches: moduleIds.map((_, i) => i + 1),
  bonus: 0.15,
  moduleIds,
});

const POS: Record<string, Hex> = {
  m1: hex(0, 0),
  m2: hex(1, 0),
  m3: hex(2, 0),
  far: hex(0, 5),
};

function overlayWith(pairs: ChordPairTerm[], namedChords: NamedChordTerm[]) {
  return chordOverlay({
    pairs,
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
  it("trims pair links to the faces' edges, spanning the seam", () => {
    const overlay = overlayWith([pair("m1", "m2")], []);
    expect(overlay.links).toHaveLength(1);
    const link = overlay.links[0]!;
    const trim = (HEX_RADIUS * Math.sqrt(3)) / 2 + 1;
    const span = Math.sqrt(3) * 65;
    expect(link.y1).toBe(0);
    expect(link.y2).toBe(0);
    expect(link.x1).toBeCloseTo(trim, 1);
    expect(link.x2).toBeCloseTo(span - trim, 1);
    expect(link.x2 - link.x1).toBeLessThan(span);
  });

  it("lights exactly the drawable terms: no light for a partner off the board", () => {
    const overlay = overlayWith([pair("m1", "gone")], []);
    expect(overlay.links).toHaveLength(0);
    expect(overlay.participants.has("m1")).toBe(false);
  });

  it("wraps every voice hex inside the named chord's hull and labels it", () => {
    const overlay = overlayWith([], [chord("Octave", ["m1", "m2"])]);
    expect(overlay.marks).toHaveLength(1);
    const mark = overlay.marks[0]!;
    expect(mark.label).toBe("Octave ×1.15");
    expectClearance(mark, [hex(0, 0), hex(1, 0)], 5);
    // The label rides above the hull, clear of the faces.
    const minY = Math.min(...polygonOf(mark).map((p) => p[1]!));
    expect(mark.labelY).toBeLessThan(minY);
  });

  it("holds the clearance along a deep chord's row, not just at the corners", () => {
    // A three-in-a-row Fifth is the elongated case that breaks radial
    // scaling: mid-row faces would clip a vertex-scaled hull.
    const overlay = overlayWith([], [chord("Fifth", ["m1", "m2", "m3"])]);
    expect(overlay.marks).toHaveLength(1);
    expectClearance(overlay.marks[0]!, [hex(0, 0), hex(1, 0), hex(2, 0)], 5);
  });

  it("keys marks by index so same-named chords in separate clusters coexist", () => {
    const overlay = chordOverlay({
      pairs: [],
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

  it("skips terms whose voices left the board", () => {
    const overlay = overlayWith([pair("m1", "gone")], [chord("Octave", ["m1", "gone"])]);
    expect(overlay.links).toHaveLength(0);
    expect(overlay.marks).toHaveLength(0);
    expect(overlay.participants.size).toBe(0);
  });
});
