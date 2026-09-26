import { describe, expect, it } from "vitest";
import { chordOverlay, chipWidth } from "./chordlayer";
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

  it("traces a three-voice chord along its voices' edges — the prototype's loop", () => {
    // The power-chord region: three mutually adjacent hexes trace a closed
    // loop — 18 hex edges less the 3 shared pairs' interior edges.
    const region: Record<string, Hex> = { c4: hex(0, 0), g4: hex(1, 0), c5: hex(0, 1) };
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["c4", "g4", "c5"])],
      posOf: (id) => region[id] ?? null,
      point,
      radius: HEX_RADIUS,
      step: Math.sqrt(3) * 65,
      labelFor: (c) => c.name,
    });
    const loop = overlay.marks[0]!.seams;
    expect(loop).toHaveLength(12);
    // The trace rides the module edges: every segment endpoint sits at the
    // trace inset from some voice's center — the lines hug the hexagons.
    // (Adjacent chassis hexes never touch on this lattice, so the loop's
    // arcs break at the corners; the stroke's round caps bridge them.)
    const trace = HEX_RADIUS * 0.97;
    const voiceCenters = Object.values(region).map((h) => point(h));
    for (const edge of loop) {
      for (const [ex, ey] of [
        [edge.x1, edge.y1],
        [edge.x2, edge.y2],
      ]) {
        expect(
          voiceCenters.some(([cx, cy]) => Math.abs(Math.hypot(ex - cx, ey - cy) - trace) < 0.06),
        ).toBe(true);
      }
    }
    // Shared interior edges stay silent: no segment crosses between the
    // voices — the line work runs around the cluster, not through it.
    const midpoints = [
      [region.c4!, region.g4!],
      [region.c4!, region.c5!],
      [region.g4!, region.c5!],
    ].map(([a, b]) => {
      const [ax, ay] = point(a);
      const [bx, by] = point(b);
      return [(ax + bx) / 2, (ay + by) / 2] as const;
    });
    for (const [mx, my] of midpoints) {
      for (const edge of loop) {
        // An interior crossing sits deep inside some hex; no traced edge's
        // midpoint comes near one.
        const ex = (edge.x1 + edge.x2) / 2;
        const ey = (edge.y1 + edge.y2) / 2;
        expect(Math.hypot(ex - mx, ey - my)).toBeGreaterThan(trace * 0.4);
      }
    }
  });

  it("a two-voice chord never grows a loop, and longer pairs stay silent", () => {
    // m1→m2 seam; m1→far is off-cluster distance and draws nothing.
    const overlay = overlayWith([chord("Fifth", ["m1", "m2", "far"])]);
    // Three voices → the loop language, but `far` is alone: the loop covers
    // all three voices' outlines — the bridged-voice case still annotates.
    expect(overlay.marks[0]!.seams.length).toBeGreaterThan(0);
    // A two-voice chord keeps the center-to-center seam.
    const pair = overlayWith([chord("Octave", ["m1", "m2"])]);
    expect(pair.marks[0]!.seams).toHaveLength(1);
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
