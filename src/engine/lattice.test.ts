import { describe, expect, it } from "vitest";
import { BALANCE } from "./constants";
import { adjacent, hex, hexDistance, hexKey } from "./hex";
import { cellNoteOf, noteNameOf, octaveRowOf, pitchClassOf, pitchOf, positionInRange } from "./lattice";

// The octave-stack lattice (ADR-0021): pitch is an absolute property of the
// cell — 12-TET, one horizontal step walks the circle of fifths, one lattice
// direction stacks octaves. Derived from coordinates, never persisted.

describe("absolute pitch", () => {
  it("derives from coordinates: fifths horizontally, octaves along one direction", () => {
    expect(pitchOf(hex(0, 0))).toBe(60); // C4 — the start register anchor
    expect(pitchOf(hex(1, 0))).toBe(67); // one step right: G4, a fifth up
    expect(pitchOf(hex(2, 0))).toBe(74); // two steps: D5
    expect(pitchOf(hex(-1, 0))).toBe(53); // one step left: F3, a fifth down
    expect(pitchOf(hex(0, 1))).toBe(72); // one step along the octave direction: C5
    expect(pitchOf(hex(0, -1))).toBe(48); // and back: C3
    // The remaining two neighbors are the other fifths diagonal.
    expect(pitchOf(hex(1, -1))).toBe(55); // G3
    expect(pitchOf(hex(-1, 1))).toBe(65); // F4
  });

  it("columns read as one note name: pitch class depends on the column alone", () => {
    for (let q = -14; q <= 14; q++) {
      expect(pitchClassOf(hex(q, 0))).toBe(pitchClassOf(hex(q, 5)));
      expect(pitchClassOf(hex(q, -3))).toBe(pitchClassOf(hex(q, 0)));
    }
    // The horizontal axis walks the circle of fifths: C G D A E B …
    // (each fifth step adds 7 semitones, so the register climbs too).
    expect([0, 1, 2, 3, 4, 5].map((q) => cellNoteOf(hex(q, 0)))).toEqual(["C4", "G4", "D5", "A5", "E6", "B6"]);
    expect(cellNoteOf(hex(-1, 1))).toBe("F4");
  });

  it("each note appears exactly once per octave row", () => {
    // Within the board's finite patch, every absolute pitch belongs to one
    // cell — no aliasing anywhere on the reachable board.
    const seen = new Map<number, string>();
    for (let q = -30; q <= 30; q++) {
      for (let r = -30; r <= 30; r++) {
        const pos = hex(q, r);
        if (!positionInRange(pos)) continue;
        const pitch = pitchOf(pos);
        const key = hexKey(pos);
        expect(seen.has(pitch), `${pitch} already at ${seen.get(pitch)}, found again at ${key}`).toBe(false);
        seen.set(pitch, key);
      }
    }
  });

  it("names absolute pitches in scientific notation", () => {
    expect(noteNameOf(60)).toBe("C4");
    expect(noteNameOf(61)).toBe("C♯4");
    expect(noteNameOf(70)).toBe("A♯4");
    expect(noteNameOf(72)).toBe("C5");
    expect(noteNameOf(59)).toBe("B3");
  });
});

describe("octave rows", () => {
  it("bands cells whose pitches sit in the same octave, row 0 at the start register", () => {
    expect(octaveRowOf(hex(0, 0))).toBe(0); // C4
    expect(octaveRowOf(hex(0, 1))).toBe(1); // C5
    expect(octaveRowOf(hex(0, -1))).toBe(-1); // C3
    // Along a row the band follows the register, not the raw r coordinate.
    expect(octaveRowOf(hex(1, 0))).toBe(0); // G4 sits with C4
    expect(octaveRowOf(hex(12, -7))).toBe(0); // 7q/12 = 7: twelve columns right, seven rows down
  });

  it("is finite and symmetric around the start register", () => {
    expect(positionInRange(hex(0, BALANCE.octaveRows))).toBe(true);
    expect(positionInRange(hex(0, -BALANCE.octaveRows))).toBe(true);
    expect(positionInRange(hex(0, BALANCE.octaveRows + 1))).toBe(false);
    expect(positionInRange(hex(0, -BALANCE.octaveRows - 1))).toBe(false);
  });

  it("the fifths axis is ungated by the range: columns walk the whole circle", () => {
    // Twelve columns, five before the start column and six after: C sits
    // near the middle and the tritone lands at the far edge, once.
    expect(positionInRange(hex(-5, 0))).toBe(true);
    expect(positionInRange(hex(6, 0))).toBe(true);
    expect(positionInRange(hex(-6, 0))).toBe(false);
    expect(positionInRange(hex(7, 0))).toBe(false);
  });
});

// The spacer ladder (board-redesign spec §3): on this lattice a ♭7 sits one
// wire cell out, m3/M6 two, M3/m6 three — harder chords literally cost more
// board. Wire cells = hex distance − 1: the spacers bridging the two voices.
describe("the difficulty ladder is geometry", () => {
  const C4 = hex(0, 0);
  const wireCellsTo = (pitch: number): number => {
    // The nearest cell sounding `pitch` — its hex distance from C4.
    let best = Infinity;
    for (let q = -30; q <= 30; q++) {
      for (let r = -30; r <= 30; r++) {
        const pos = hex(q, r);
        if (pitchOf(pos) !== pitch) continue;
        best = Math.min(best, hexDistance(C4, pos));
      }
    }
    return best - 1;
  };

  it("a fifth and an octave are adjacent — no wire needed", () => {
    expect(wireCellsTo(67)).toBe(0); // G4
    expect(wireCellsTo(72)).toBe(0); // C5
  });

  it("a ♭7 sits one wire cell out", () => {
    expect(wireCellsTo(70)).toBe(1); // B♭4 at (−2, 2): two steps, one between
  });

  it("m3 and M6 sit two wire cells out", () => {
    expect(wireCellsTo(63)).toBe(2); // E♭4
    expect(wireCellsTo(69)).toBe(2); // A4
  });

  it("M3 and m6 sit three wire cells out", () => {
    expect(wireCellsTo(64)).toBe(3); // E4
    expect(wireCellsTo(68)).toBe(3); // A♭4
  });

  it("the wiring path is real: the gap cells sit adjacent along a chain", () => {
    // C4 — (−1,1) — B♭4: both steps are true adjacencies.
    expect(adjacent(hex(0, 0), hex(-1, 1))).toBe(true);
    expect(adjacent(hex(-1, 1), hex(-2, 2))).toBe(true);
    expect(pitchOf(hex(-1, 1))).toBe(65); // F4 — the wire cell's own note
  });
});
