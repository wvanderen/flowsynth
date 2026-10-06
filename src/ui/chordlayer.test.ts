import { describe, expect, it } from "vitest";
import { chordMarkCovers, chordOverlay, chipWidth, edgeDistance, EDGE_HALF, EDGE_OFFSET } from "./chordlayer";
import { hex } from "../engine/hex";
import { HEX_RADIUS } from "./face";
import type { Hex, NamedChordTerm } from "../engine/types";

// The chord overlay's geometry — the dense-board seam language (#174,
// #201): which voices connect, which form the chord wears, where its
// ghost chip anchors. render.ts's point mapping is injected, so tests use
// the same axial→pixel shape. The name chip lives in a reserved spot by
// the board; selection is the caller's emphasis question.

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
  m4: hex(3, 0),
  far: hex(0, 5),
};

function overlayWith(namedChords: NamedChordTerm[], extra: Partial<Parameters<typeof chordOverlay>[0]> = {}) {
  return chordOverlay({
    namedChords,
    posOf: (id) => POS[id] ?? null,
    point,
    radius: HEX_RADIUS,
    step: Math.sqrt(3) * 65,
    labelFor: (c) => `${c.name} ×${(1 + c.bonus).toFixed(2)}`,
    ...extra,
  });
}

describe("the dense-board seam language (#201)", () => {
  it("an adjacent pair seals the shared edge: twin brackets riding the gap", () => {
    const overlay = overlayWith([chord("Octave", ["m1", "m2"])]);
    expect(overlay.marks).toHaveLength(1);
    const seams = overlay.marks[0]!.seams;
    // Twin lines, one per side of the shared edge.
    expect(seams).toHaveLength(2);
    const [mx, my] = [(point(POS.m1!)[0] + point(POS.m2!)[0]) / 2, (point(POS.m1!)[1] + point(POS.m2!)[1]) / 2];
    for (const seam of seams) {
      // Each bracket crosses the center axis at a right angle, one
      // EDGE_OFFSET either side of the gap's midpoint, EDGE_HALF long.
      const perp = Math.abs(seam.x1 - seam.x2) < 1e-6;
      expect(perp).toBe(true);
      const offset = Math.abs(seam.x1 - mx);
      expect(offset).toBeCloseTo(EDGE_OFFSET, 2);
      expect(Math.abs(seam.y1 - my)).toBeCloseTo(EDGE_HALF, 1);
      expect(Math.hypot(seam.x2 - seam.x1, seam.y2 - seam.y1)).toBeCloseTo(EDGE_HALF * 2, 1);
    }
    // The twins straddle the edge: one before it, one past it.
    const offsets = seams.map((s) => s.x1 - mx).sort((a, b) => a - b);
    expect(offsets[0]).toBeLessThan(0);
    expect(offsets[1]).toBeGreaterThan(0);
    // The face centers stay free — no bracket line comes near a center.
    for (const seam of seams) {
      expect(edgeDistance(point(POS.m1!), [[seam.x1, seam.y1], [seam.x2, seam.y2]])).toBeGreaterThan(EDGE_HALF);
    }
  });

  it("a collinear chord runs one continuous twin line first voice to last", () => {
    // The octave column: three voices down one lattice line — one run,
    // not two brackets.
    const overlay = overlayWith([chord("Fifth", ["m1", "m2", "m3"])]);
    const mark = overlay.marks[0]!;
    expect(mark.outline).toBeNull();
    expect(mark.seams).toHaveLength(2);
    const trim = HEX_RADIUS * (Math.sqrt(3) / 2) + 2;
    const [firstX, lastX] = [point(POS.m1!)[0], point(POS.m3!)[0]];
    for (const seam of mark.seams) {
      // The line spans the whole run, trimmed just short of the end faces.
      expect(Math.abs(seam.x1 - (firstX + trim))).toBeLessThan(0.02);
      expect(Math.abs(seam.x2 - (lastX - trim))).toBeLessThan(0.02);
      // And rides EDGE_OFFSET off the axis, per side.
      expect(Math.abs(Math.abs(seam.y1 - point(POS.m1!)[1]) - EDGE_OFFSET)).toBeLessThan(0.02);
    }
  });

  it("a spacer-bridged pair stays straight — the run carries it through the wire", () => {
    // A wire-conducted pair sits beyond bracket reach: the continuous run
    // draws first voice to last, passing under the faces between — the
    // open wire, deliberately straight.
    const overlay = overlayWith([chord("Flat seventh", ["m1", "far"])]);
    const mark = overlay.marks[0]!;
    expect(mark.outline).toBeNull();
    expect(mark.seams).toHaveLength(2);
    const trim = HEX_RADIUS * (Math.sqrt(3) / 2) + 2;
    const [p0, p1] = [point(POS.m1!), point(POS.far!)];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const [ax, ay] = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len];
    const base1: [number, number] = [p0[0] + ax * trim, p0[1] + ay * trim];
    const base2: [number, number] = [p1[0] - ax * trim, p1[1] - ay * trim];
    for (const seam of mark.seams) {
      // Each twin line spans the whole run, trimmed just short of the end
      // faces, riding EDGE_OFFSET perpendicular off the axis.
      expect(Math.hypot(seam.x1 - base1[0], seam.y1 - base1[1])).toBeCloseTo(EDGE_OFFSET, 1);
      expect(Math.hypot(seam.x2 - base2[0], seam.y2 - base2[1])).toBeCloseTo(EDGE_OFFSET, 1);
      // And the line runs parallel to the axis.
      const cross = (seam.x2 - seam.x1) * ay - (seam.y2 - seam.y1) * ax;
      expect(Math.abs(cross)).toBeLessThan(0.02);
    }
  });

  it("a chord off the lattice lines wraps in the note-corner polygon", () => {
    // The power-chord region: three mutually adjacent voices in an L —
    // no run can carry them, so each hull voice owns one corner pushed
    // just past its own outline.
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
    const polygon = mark.outline!;
    // One corner per voice: the L's hull holds all three voices.
    expect(polygon).toHaveLength(3);
    const centers = Object.values(region).map((h) => point(h));
    for (const [vx, vy] of polygon) {
      // Every corner sits just past exactly one voice's chassis edge.
      const nearest = Math.min(...centers.map(([cx, cy]) => Math.hypot(vx - cx, vy - cy)));
      expect(nearest).toBeCloseTo(HEX_RADIUS + 6, 0);
      expect(nearest).toBeLessThan(HEX_RADIUS + 10);
    }
    // And no corner strays near a voice it doesn't name: each corner is
    // close to its own voice and far from the others. (The connecting
    // edges may pass under the plates — the work renders beneath the
    // modules; only the corners name the voices.)
    for (const [vx, vy] of polygon) {
      const distances = centers.map(([cx, cy]) => Math.hypot(vx - cx, vy - cy)).sort((a, b) => a - b);
      expect(distances[0]).toBeLessThan(HEX_RADIUS + 10);
      expect(distances[1]).toBeGreaterThan(HEX_RADIUS + 20);
    }
  });

  it("overlapping chord terms all draw — no pair is claimed once (#201)", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Octave", ["m1", "m2"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
      step: Math.sqrt(3) * 65,
      labelFor: (c) => c.name,
    });
    expect(overlay.marks).toHaveLength(2);
    // Both marks seal the same shared edge, each in its own hue.
    expect(overlay.marks[0]!.seams).toHaveLength(2);
    expect(overlay.marks[1]!.seams).toHaveLength(2);
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

describe("the spacer's containment ask (#201)", () => {
  it("a mark covers the points its drawn work passes through", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2", "m3"])]);
    const mark = overlay.marks[0]!;
    // The spacer mid-run sits right on the axis, between the twin lines.
    expect(chordMarkCovers(mark, point(hex(1, 0)))).toBe(true);
    // A cell one row off the line is nobody's wire.
    expect(chordMarkCovers(mark, point(hex(1, 1)))).toBe(false);
  });

  it("a polygon chord covers the region it wraps", () => {
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
    // The region's centroid — inside the wrapped triangle of voices.
    const [cx, cy] = [0, 0].map((_, i) => centersAvg(i));
    function centersAvg(i: number): number {
      return Object.values(region).reduce((acc, h) => acc + point(h)[i]!, 0) / 3;
    }
    expect(chordMarkCovers(mark, [cx, cy])).toBe(true);
    // Far off the region: not covered.
    expect(chordMarkCovers(mark, point(POS.far!))).toBe(false);
  });

  it("a conducting spacer's selection lifts the chords its wire carries", () => {
    // The spacer at G4 conducts the C4–C5 octave column.
    const posOf = (id: string): Hex | null => (id === "wire" ? hex(1, 0) : POS[id] ?? null);
    const overlay = chordOverlay({
      namedChords: [chord("Octave", ["m1", "m3"])],
      posOf,
      point,
      radius: HEX_RADIUS,
      step: Math.sqrt(3) * 65,
      labelFor: (c) => c.name,
      focusIds: ["wire"],
      focusPoint: point(hex(1, 0)),
    });
    // The spacer sings in no chord, yet the run it carries stays focused.
    expect(overlay.marks[0]!.focused).toBe(true);
    // The same selection without the point read fades the chord.
    const strict = chordOverlay({
      namedChords: [chord("Octave", ["m1", "m3"])],
      posOf,
      point,
      radius: HEX_RADIUS,
      step: Math.sqrt(3) * 65,
      labelFor: (c) => c.name,
      focusIds: ["wire"],
    });
    expect(strict.marks[0]!.focused).toBe(false);
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
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"]), chord("Octave", ["m3", "far"])]);
    expect(overlay.marks.every((m) => m.focused)).toBe(true);
  });

  it("carries each chord's voices for the hover reveal", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    expect(overlay.marks[0]!.voices).toEqual(["m1", "m2"]);
  });
});

describe("the idle candidates (issue #258)", () => {
  it("inactive chords draw their own marks after the active ones, flagged idle", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])], {
      inactiveChords: [chord("Octave", ["m3", "m4"]), chord("Fifth", ["m1", "m3"])],
    });
    expect(overlay.marks).toHaveLength(3);
    expect(overlay.marks[0]!.inactive).toBe(false);
    expect(overlay.marks[0]!.key).toBe("chord-0");
    for (const mark of overlay.marks.slice(1)) {
      expect(mark.inactive).toBe(true);
      expect(mark.key).toMatch(/^chord-idle-\d$/);
    }
  });

  it("an inactive chord keeps its full geometry and hover identity", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])], {
      inactiveChords: [chord("Fifth", ["m3", "m4"])],
    });
    const idle = overlay.marks[1]!;
    expect(idle.seams).toHaveLength(2);
    expect(idle.voices).toEqual(["m3", "m4"]);
    expect(idle.focused).toBe(true);
  });

  it("no inactive chords, no idle marks — the plain call is unchanged", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    expect(overlay.marks).toHaveLength(1);
    expect(overlay.marks[0]!.inactive).toBe(false);
  });
});
