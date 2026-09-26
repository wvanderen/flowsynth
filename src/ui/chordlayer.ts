// The chord overlay: pure geometry for the board's chord annotation. Like
// leads.ts, the diagram stays pure and testable — render.ts draws the
// markup and the stylesheet keeps every color in the token table.
//
// The language is the prototype's seams (#120, variant B): a chord names
// itself with colored lines between its voices — trimmed short of each
// face, chord-colored, pulse-timed per chord — and a name chip that only
// appears when asked for (a seam or an included voice hovered, an included
// voice selected). The overlay is always on (§6, #137): every formed chord
// wears its seams; selection is the caller's emphasis question.
import type { Hex, NamedChordTerm } from "../engine/types";

export type Point = readonly [number, number];

// One colored line between two voices, trimmed clear of both faces.
export interface ChordSeam {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ChordMark {
  readonly key: string;
  readonly label: string;
  // The chord hue's token key — render.ts styles `--cc: var(--<key>)`.
  readonly colorVar: string;
  // The flow pulse period (seconds), per chord — the prototype's rhythm.
  readonly duration: number;
  readonly seams: ChordSeam[];
  readonly chipX: number;
  readonly chipY: number;
  // The chip's estimated pixel width — the backing rect's width and the
  // stacking collision's footprint.
  readonly labelW: number;
  // The chord's voice ids — the hover reveal's lookup on the mark node.
  readonly voices: readonly string[];
  // Whether this chord carries one of the caller's focus ids (§6): the
  // selected module's chords emphasize, the rest fade. Always true when no
  // focus is asked for.
  readonly focused: boolean;
}

export interface ChordOverlay {
  marks: ChordMark[];
}

// The chip's metrics: the mono face runs ~10.5px with 0.1em tracking, so a
// character is ~7.4px wide; the backing adds side padding, and the vertical
// stack step is chip height plus breathing room. Estimates for layout, not
// measurement — the stylesheet owns the truth (tuning).
export const CHIP_CHAR_PX = 7.4;
export const CHIP_PAD_PX = 12;
export const CHIP_STACK_PX = 20;

// A chip's estimated pixel width from its label.
export function chipWidth(label: string): number {
  return label.length * CHIP_CHAR_PX + CHIP_PAD_PX;
}

// Per-chord hue tokens and pulse periods (the prototype's rhythm table,
// extended to the launch vocabulary; unknown names take the fallbacks).
const CHORD_HUES: Record<string, string> = {
  Octave: "chord-octave",
  Fifth: "chord-fifth",
  "Flat seventh": "chord-flat-seventh",
  "Minor triad": "chord-minor-triad",
  "Major triad": "chord-major-triad",
};
const CHORD_PULSE: Record<string, number> = {
  Octave: 3.4,
  Fifth: 2.7,
  "Flat seventh": 3.0,
  "Minor triad": 2.4,
  "Major triad": 2.7,
};
const FALLBACK_HUE = "chord-octave";
const FALLBACK_PULSE = 2.7;

// A seam's reach: pairs of voices within ~1.1 adjacent-center steps draw —
// straight and diagonal neighbors — longer pairs stay silent.
const SEAM_REACH = 1.9;

// How far a seam end stops short of its voice's center: just outside the
// chassis apothem — and always short of the gap's midpoint, so adjacent
// seams never cross.
function seamTrim(radius: number): number {
  return radius * (Math.sqrt(3) / 2) + 2;
}

// The chord's seams: every qualifying voice pair, center-to-center trimmed
// to the chassis. `claimed` carries pair keys across chords — a shared pair
// draws once, the first chord's color winning.
function seamsFor(centers: readonly Point[], radius: number, claimed: Set<string>): ChordSeam[] {
  const reach = radius * SEAM_REACH;
  const trim = seamTrim(radius);
  const seams: ChordSeam[] = [];
  for (let a = 0; a < centers.length; a++) {
    for (let b = a + 1; b < centers.length; b++) {
      const p = centers[a]!;
      const q = centers[b]!;
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d > reach) continue;
      const key = [p, q].map((pt) => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).sort().join("|");
      if (claimed.has(key)) continue;
      claimed.add(key);
      const ux = (q[0] - p[0]) / d;
      const uy = (q[1] - p[1]) / d;
      seams.push({
        x1: Number((p[0] + ux * trim).toFixed(2)),
        y1: Number((p[1] + uy * trim).toFixed(2)),
        x2: Number((q[0] - ux * trim).toFixed(2)),
        y2: Number((q[1] - uy * trim).toFixed(2)),
      });
    }
  }
  return seams;
}

// Stack overlapping chips (§6): where chords overlap or sit side by side,
// their chips pile upward instead of colliding. Bottom-first, left-second
// order — the lowest chip pins to its chord and the rest climb clear.
function stackChips(marks: ChordMark[]): ChordMark[] {
  const placed: ChordMark[] = [];
  const ordered = [...marks].sort((a, b) => b.chipY - a.chipY || a.chipX - b.chipX);
  for (const mark of ordered) {
    let chipY = mark.chipY;
    while (
      placed.some(
        (p) =>
          Math.abs(p.chipY - chipY) < CHIP_STACK_PX &&
          Math.abs(p.chipX - mark.chipX) < (p.labelW + mark.labelW) / 2,
      )
    ) {
      chipY -= CHIP_STACK_PX;
    }
    placed.push({ ...mark, chipY: Number(chipY.toFixed(2)) });
  }
  return placed;
}

// The overlay over one board's chord terms: per named chord, its seams and
// its chip position. A term with a voice off the board cannot be drawn
// whole — it contributes nothing at all, not even light. `focusIds` carries
// the selection's emphasis (§6): chords carrying one of those ids come back
// focused, every other mark fades; unset, nothing fades.
export function chordOverlay(opts: {
  namedChords: readonly NamedChordTerm[];
  posOf: (id: string) => Hex | null;
  point: (h: Hex) => Point;
  radius: number;
  labelFor: (chord: NamedChordTerm) => string;
  focusIds?: readonly string[];
}): ChordOverlay {
  const { namedChords, posOf, point, radius, labelFor } = opts;
  const focus = new Set(opts.focusIds ?? []);
  const emphasize = focus.size > 0;
  const claimed = new Set<string>();
  const marks: ChordMark[] = [];
  namedChords.forEach((chord, index) => {
    const positions = chord.moduleIds.map(posOf);
    if (positions.some((pos) => pos === null)) return;
    const centers = positions.map((pos) => point(pos as Hex));
    const seams = seamsFor(centers, radius, claimed);
    const top = centers.reduce((a, b) => (b[1] < a[1] ? b : a));
    const label = labelFor(chord);
    marks.push({
      key: `chord-${index}`,
      label,
      colorVar: CHORD_HUES[chord.name] ?? FALLBACK_HUE,
      duration: CHORD_PULSE[chord.name] ?? FALLBACK_PULSE,
      seams,
      chipX: Number(top[0].toFixed(2)),
      // The callout floats above the chord's topmost voice, a half-hex clear.
      chipY: Number((top[1] - radius * 1.18).toFixed(2)),
      labelW: Number(chipWidth(label).toFixed(2)),
      voices: chord.moduleIds,
      focused: !emphasize || chord.moduleIds.some((id) => focus.has(id)),
    });
  });
  return { marks: stackChips(marks) };
}
