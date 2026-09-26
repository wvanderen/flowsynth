import { describe, expect, it } from "vitest";
import { CHIP_STACK_PX, chordOverlay, chipWidth, convexHull, edgeDistance, hexVertices } from "./chordlayer";
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
  root: 0,
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

  it("skips terms whose voices left the board — no mark", () => {
    const overlay = overlayWith([chord("Octave", ["m1", "gone"])]);
    expect(overlay.marks).toHaveLength(0);
  });

  it("sizes each chip's backing from its label", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    expect(overlay.marks[0]!.labelW).toBe(chipWidth("Fifth ×1.15"));
  });

  it("draws a power-chord region's nested hulls with cleared chips", () => {
    // A seeded power-chord region on the lattice: C4, G4, C5 — the octave
    // nests inside the fifth's hull and the two chips clear each other.
    const region: Record<string, Hex> = { c4: hex(0, 0), g4: hex(1, 0), c5: hex(0, 1) };
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["c4", "g4", "c5"]), chord("Octave", ["c4", "c5"])],
      posOf: (id) => region[id] ?? null,
      point,
      radius: HEX_RADIUS,
      pad: 5,
      labelFor: (c) => c.name,
    });
    expect(overlay.marks).toHaveLength(2);
    const [outer, inner] = overlay.marks;
    // Two distinct hulls wrap the shared voices.
    expect(outer!.points).not.toBe(inner!.points);
    // The chips clear each other: a full stack step apart, or side by side.
    const clearedVertically = Math.abs(outer!.labelY - inner!.labelY) >= CHIP_STACK_PX;
    const clearedHorizontally = Math.abs(outer!.labelX - inner!.labelX) >= (outer!.labelW + inner!.labelW) / 2;
    expect(clearedVertically || clearedHorizontally).toBe(true);
  });

  it("stacks same-row chips that would collide", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Fifth", ["m2", "m3"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
      pad: 5,
      // A long label makes the neighboring chips' footprints overlap.
      labelFor: () => "Flat seventh ×1.45 ×12",
    });
    expect(overlay.marks).toHaveLength(2);
    const [a, b] = overlay.marks;
    expect(Math.abs(a!.labelY - b!.labelY)).toBeGreaterThanOrEqual(CHIP_STACK_PX);
  });
});

describe("selection emphasis (§6)", () => {
  it("focuses the selected module's chords and fades the rest", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Octave", ["m3", "far"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
      pad: 5,
      labelFor: (c) => c.name,
      focusIds: ["m1"],
    });
    const byLabel = new Map(overlay.marks.map((m) => [m.label, m.focused]));
    expect(byLabel.get("Fifth")).toBe(true);
    expect(byLabel.get("Octave")).toBe(false);
  });

  it("focuses everything when nothing is selected", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Octave", ["m3", "far"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
      pad: 5,
      labelFor: (c) => c.name,
    });
    expect(overlay.marks.every((m) => m.focused)).toBe(true);
  });

  it("a shared voice focuses every chord wearing it", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"]), chord("Fifth", ["m2", "m3"])]);
    expect(overlay.marks.every((m) => m.focused)).toBe(true);
  });
});
