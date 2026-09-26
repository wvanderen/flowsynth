import { describe, expect, it } from "vitest";
import { chordOverlay, chipWidth, edgeDistance } from "./chordlayer";
import { hex } from "../engine/hex";
import { HEX_RADIUS, hexApothem } from "./face";
import type { Hex, NamedChordTerm } from "../engine/types";

// The chord overlay's geometry — the prototype's seam language (#120):
// which voices connect, which hue and pulse period a chord wears, where
// its ghost chip anchors. render.ts's point mapping is injected, so tests
// use the same axial→pixel shape. The name chip lives in a reserved spot
// by the board; selection is the caller's emphasis question.

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
    step: Math.sqrt(3) * 65,
    labelFor: (c) => `${c.name} ×${(1 + c.bonus).toFixed(2)}`,
  });
}

describe("tracesFor — the prototype's seam language", () => {
  it("connects two adjacent voices with a seam trimmed clear of both faces", () => {
    const overlay = overlayWith([chord("Octave", ["m1", "m2"])]);
    expect(overlay.marks).toHaveLength(1);
    const seams = overlay.marks[0]!.seams;
    expect(seams).toHaveLength(1);
    const seam = seams[0]!;
    // Both ends stop short of their center, outside the chassis apothem.
    const [cx1, cy1] = point(POS.m1!);
    const [cx2, cy2] = point(POS.m2!);
    const apothem = hexApothem(HEX_RADIUS);
    expect(Math.hypot(seam.x1 - cx1, seam.y1 - cy1)).toBeGreaterThanOrEqual(apothem);
    expect(Math.hypot(seam.x2 - cx2, seam.y2 - cy2)).toBeGreaterThanOrEqual(apothem);
    // And the line runs toward the far voice, not away from it.
    expect(seam.x2).toBeGreaterThan(seam.x1);
  });

  it("draws a three-voice chord's offset outline — the prototype's triangle", () => {
    // The power-chord region: three mutually adjacent voices draw the
    // convex outline behind the modules, no seams.
    const region: Record<string, Hex> = { c4: hex(0, 0), g4: hex(1, 0), c5: hex(0, 1) };
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["c4", "g4", "c5"])],
      posOf: (id) => region[id] ?? null,
      point,
      radius: HEX_RADIUS,
      step: Math.sqrt(3) * 65,
      labelFor: (c) => c.name,
    });
    const mark = overlay.marks[0]!;
    expect(mark.seams).toHaveLength(0);
    expect(mark.outline).not.toBeNull();
    const polygon = mark.outline!.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
    // Two clipped ends per hull edge: the triangle yields six points, the
    // consecutive ends joining into the short corner bevels.
    expect(polygon).toHaveLength(6);
    const centers = Object.values(region).map((h) => point(h));
    // The corners poke only just past the outer module edges: every
    // clipped corner point sits a fixed poke past the chassis radius.
    for (const [vx, vy] of polygon) {
      const nearest = Math.min(...centers.map(([cx, cy]) => Math.hypot(vx - cx, vy - cy)));
      expect(nearest).toBeCloseTo(HEX_RADIUS + 8, 0);
      expect(nearest).toBeLessThan(HEX_RADIUS + 12);
    }
    // The edges stay straight through the gap between neighboring faces:
    // just off the plates' facing edges, never cutting a plate.
    const pad = hexApothem(HEX_RADIUS) + 2.5;
    for (const center of centers) {
      const d = edgeDistance(center, polygon);
      expect(d).toBeGreaterThanOrEqual(pad - 0.6);
      expect(d).toBeLessThanOrEqual(pad + 0.6);
      expect(d).toBeGreaterThanOrEqual(hexApothem(HEX_RADIUS));
    }
  });

  it("a chord with a bridged voice still outlines the whole cluster", () => {
    // Three voices, one far off-row: the outline wraps all three — the
    // bridged-voice case the seams could never draw.
    const overlay = overlayWith([chord("Fifth", ["m1", "m2", "far"])]);
    expect(overlay.marks[0]!.seams).toHaveLength(0);
    expect(overlay.marks[0]!.outline).not.toBeNull();
    // A two-voice chord keeps the center-to-center seam and grows no loop.
    const pair = overlayWith([chord("Octave", ["m1", "m2"])]);
    expect(pair.marks[0]!.seams).toHaveLength(1);
    expect(pair.marks[0]!.outline).toBeNull();
  });

  it("a spacer-bridged two-voice chord draws the outline — never nothing", () => {
    // A wire-conducted pair sits beyond seam reach: no seam could span
    // the wired cells between, so the outline carries the chord instead
    // (the same way a bridged triad draws).
    const overlay = overlayWith([chord("Flat seventh", ["m1", "far"])]);
    expect(overlay.marks[0]!.seams).toHaveLength(0);
    expect(overlay.marks[0]!.outline).not.toBeNull();
    // The stadium around the pair: two clipped ends per long edge, joined
    // into the short corner cuts. Every vertex pokes just past its
    // module's chassis edge; the long edges ride the gaps (the cuts
    // themselves hide behind the modules).
    const polygon = overlay.marks[0]!.outline!.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
    expect(polygon).toHaveLength(4);
    const centers = ["m1", "far"].map((id) => point(POS[id]!));
    for (const [vx, vy] of polygon) {
      const nearest = Math.min(...centers.map(([cx, cy]) => Math.hypot(vx - cx, vy - cy)));
      expect(nearest).toBeCloseTo(HEX_RADIUS + 8, 0);
    }
  });

  it("shares a claimed pair across chords: the first chord's color wins", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Octave", ["m1", "m2"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
      step: Math.sqrt(3) * 65,
      labelFor: (c) => c.name,
    });
    expect(overlay.marks).toHaveLength(2);
    expect(overlay.marks[0]!.seams).toHaveLength(1);
    expect(overlay.marks[1]!.seams).toHaveLength(0);
  });

  it("skips terms whose voices left the board — no mark", () => {
    const overlay = overlayWith([chord("Octave", ["m1", "gone"])]);
    expect(overlay.marks).toHaveLength(0);
  });

  it("sizes the ghost chip's backing from its label", () => {
    expect(chipWidth("Fifth ×1.15")).toBe("Fifth ×1.15".length * 7.4 + 12);
  });

  it("anchors the chip above the chord's topmost voice", () => {
    // c5 sits a row below (larger y): the anchor rides over m1's row.
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    const mark = overlay.marks[0]!;
    const [topX, topY] = point(POS.m1!);
    expect(mark.chipX).toBe(topX);
    expect(mark.chipY).toBeCloseTo(topY - HEX_RADIUS * 1.18, 1);
  });
});

describe("the chord's identity", () => {
  it("wears its hue token and pulse period", () => {
    const overlay = overlayWith([
      chord("Fifth", ["m1", "m2"]),
      chord("Octave", ["m2", "m3"]),
    ]);
    expect(overlay.marks.map((m) => m.colorVar)).toEqual(["chord-fifth", "chord-octave"]);
    expect(overlay.marks.map((m) => m.duration)).toEqual([2.7, 3.4]);
  });

  it("unknown chord names take the fallback hue and period", () => {
    const overlay = overlayWith([chord("Mystic octatonic cluster", ["m1", "m2"])]);
    expect(overlay.marks[0]!.colorVar).toBe("chord-octave");
    expect(overlay.marks[0]!.duration).toBe(2.7);
  });
});

describe("selection emphasis (§6)", () => {
  it("focuses the selected module's chords and fades the rest", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Octave", ["m3", "far"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
      step: Math.sqrt(3) * 65,
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
      step: Math.sqrt(3) * 65,
      labelFor: (c) => c.name,
    });
    expect(overlay.marks.every((m) => m.focused)).toBe(true);
  });

  it("carries each chord's voices for the hover reveal", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    expect(overlay.marks[0]!.voices).toEqual(["m1", "m2"]);
  });
});
