import { describe, expect, it } from "vitest";
import { CHIP_STACK_PX, chordOverlay, chipWidth } from "./chordlayer";
import { hex } from "../engine/hex";
import { HEX_RADIUS, hexApothem } from "./face";
import type { Hex, NamedChordTerm } from "../engine/types";

// The chord overlay's geometry — the prototype's seam language (#120):
// which voices connect, which hue and pulse period a chord wears, where its
// chip sits. render.ts's point mapping is injected, so tests use the same
// axial→pixel shape. Chips clear each other where chords overlap; selection
// is the caller's emphasis question.

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
    labelFor: (c) => `${c.name} ×${(1 + c.bonus).toFixed(2)}`,
  });
}

describe("seamsFor — the prototype's trimmed voice pairs", () => {
  it("connects adjacent voices with a seam trimmed clear of both faces", () => {
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

  it("connects straight and diagonal neighbors but not longer pairs", () => {
    // m1→m2 straight, m1→far off-row — only the straight pair is close
    // enough; a vertical pair (rows) also qualifies.
    const overlay = overlayWith([chord("Fifth", ["m1", "m2", "far"])]);
    const seams = overlay.marks[0]!.seams;
    expect(seams).toHaveLength(1);
    // A three-in-a-row chord: every adjacent pair draws, the end pair (two
    // steps) does not.
    const row = overlayWith([chord("Fifth", ["m1", "m2", "m3"])]);
    expect(row.marks[0]!.seams).toHaveLength(2);
  });

  it("shares a claimed pair across chords: the first chord's color wins", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Octave", ["m1", "m2"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
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

  it("sizes each chip's backing from its label", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    expect(overlay.marks[0]!.labelW).toBe(chipWidth("Fifth ×1.15"));
  });

  it("floats the chip above the chord's topmost voice", () => {
    // c5 sits a row below (larger y): the chip rides over m1's row.
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    const mark = overlay.marks[0]!;
    const [topX, topY] = point(POS.m1!);
    expect(mark.chipX).toBe(topX);
    expect(mark.chipY).toBeCloseTo(topY - HEX_RADIUS * 1.18, 1);
  });

  it("draws nested chords with cleared chips on a power-chord region", () => {
    // A seeded power-chord region on the lattice: C4, G4, C5 — the octave
    // nests inside the fifth's region and the two chips clear each other.
    const region: Record<string, Hex> = { c4: hex(0, 0), g4: hex(1, 0), c5: hex(0, 1) };
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["c4", "g4", "c5"]), chord("Octave", ["c4", "c5"])],
      posOf: (id) => region[id] ?? null,
      point,
      radius: HEX_RADIUS,
      labelFor: (c) => c.name,
    });
    expect(overlay.marks).toHaveLength(2);
    const [outer, inner] = overlay.marks;
    // The chips clear each other: a full stack step apart, or side by side.
    const clearedVertically = Math.abs(outer!.chipY - inner!.chipY) >= CHIP_STACK_PX;
    const clearedHorizontally = Math.abs(outer!.chipX - inner!.chipX) >= (outer!.labelW + inner!.labelW) / 2;
    expect(clearedVertically || clearedHorizontally).toBe(true);
  });

  it("stacks same-row chips that would collide", () => {
    const overlay = chordOverlay({
      namedChords: [chord("Fifth", ["m1", "m2"]), chord("Fifth", ["m2", "m3"])],
      posOf: (id) => POS[id] ?? null,
      point,
      radius: HEX_RADIUS,
      // A long label makes the neighboring chips' footprints overlap.
      labelFor: () => "Flat seventh ×1.45 ×12",
    });
    expect(overlay.marks).toHaveLength(2);
    const [a, b] = overlay.marks;
    expect(Math.abs(a!.chipY - b!.chipY)).toBeGreaterThanOrEqual(CHIP_STACK_PX);
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
      labelFor: (c) => c.name,
    });
    expect(overlay.marks.every((m) => m.focused)).toBe(true);
  });

  it("carries each chord's voices for the hover reveal", () => {
    const overlay = overlayWith([chord("Fifth", ["m1", "m2"])]);
    expect(overlay.marks[0]!.voices).toEqual(["m1", "m2"]);
  });
});
