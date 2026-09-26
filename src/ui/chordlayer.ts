// The chord overlay: pure geometry for the board's chord annotation. Like
// leads.ts, the diagram stays pure and testable — render.ts draws the
// markup and the stylesheet keeps every color in the token table.
//
// The language is the prototype's seams (#120, variant B): a chord names
// itself with colored lines between its voices — trimmed short of each
// face, chord-colored, pulse-timed per chord — while its name chip lives
// in a reserved spot by the board (never floating over it). Selection and
// hover are the caller's emphasis questions.
import type { Hex, NamedChordTerm } from "../engine/types";
import { hexCorner } from "./face";

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
  // The chord's drawn segments: a two-voice chord seams center-to-center
  // between its adjacent voices; a chord of three or more traces the
  // edges of its voices' hexagons — the prototype's outline loop (#120).
  readonly seams: ChordSeam[];
  // The chip anchor: above the chord's topmost voice. Ghost marks (the
  // would-form preview) render their chip here; formed chords render
  // theirs in the reserved spot instead.
  readonly chipX: number;
  readonly chipY: number;
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

// The chip label's metrics: the mono face runs ~10.5px with 0.1em
// tracking, so a character is ~7.4px wide; the backing adds side padding.
// Estimates for layout, not measurement — the stylesheet owns the truth
// (tuning).
export const CHIP_CHAR_PX = 7.4;
export const CHIP_PAD_PX = 12;

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

// Where the edge trace rides: just inside the chassis outline, clear of
// both the chassis stroke and the outer rarity ring (tuning).
const EDGE_TRACE_INSET = 0.97;

// Center keys round to tenth-pixel grid cells — and normalize negative
// zero, or a computed `(0, 0)` neighbor lands as "-0.0" and never matches.
function centerKey(x: number, y: number): string {
  return `${Math.round(x * 10) + 0}:${Math.round(y * 10) + 0}`;
}

// The chord's edges: for a chord of three or more voices, the boundary of
// the voices' union traced along the hexagons' own edges — the prototype's
// closed loop around the cluster (a trio of neighbors reads as a triangle).
// An edge is on the boundary when the hex across it is not one of the
// chord's voices; shared edges stay silent so interior faces don't get
// crossed out. `step` is the lattice's adjacent-center distance in pixel
// space (the trace rides at the hex radius, but neighbors sit a lattice
// step across each edge).
function edgeLoopFor(centers: readonly Point[], radius: number, step: number): ChordSeam[] {
  const trace = radius * EDGE_TRACE_INSET;
  const at = new Set(centers.map((c) => centerKey(c[0], c[1])));
  const edges: ChordSeam[] = [];
  for (const [cx, cy] of centers) {
    for (let i = 0; i < 6; i++) {
      // face.ts's pointy-top corners: corner i at (60i − 30)°, so the edge
      // to corner i+1 faces outward along 60i°, neighbor a lattice step
      // across it.
      const a = hexCorner(trace, i);
      const b = hexCorner(trace, (i + 1) % 6);
      const outward = (60 * i * Math.PI) / 180;
      const nx = cx + step * Math.cos(outward);
      const ny = cy + step * Math.sin(outward);
      if (at.has(centerKey(nx, ny))) continue;
      edges.push({
        x1: Number((cx + a[0]).toFixed(2)),
        y1: Number((cy + a[1]).toFixed(2)),
        x2: Number((cx + b[0]).toFixed(2)),
        y2: Number((cy + b[1]).toFixed(2)),
      });
    }
  }
  return edges;
}

// The chord's drawn segments: two voices seam center-to-center (each
// qualifying adjacent pair; `claimed` carries pair keys across chords — a
// shared pair draws once, the first chord's color winning); three or more
// voices trace their union's edges instead.
function tracesFor(centers: readonly Point[], radius: number, step: number, claimed: Set<string>): ChordSeam[] {
  if (centers.length >= 3) return edgeLoopFor(centers, radius, step);
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

// The overlay over one board's chord terms: per named chord, its drawn
// segments and its chip anchor. A term with a voice off the board cannot
// be drawn whole — it contributes nothing at all, not even light.
// `focusIds` carries the selection's emphasis (§6): chords carrying one of
// those ids come back focused, every other mark fades; unset, nothing
// fades. `step` is the lattice's adjacent-center distance.
export function chordOverlay(opts: {
  namedChords: readonly NamedChordTerm[];
  posOf: (id: string) => Hex | null;
  point: (h: Hex) => Point;
  radius: number;
  step: number;
  labelFor: (chord: NamedChordTerm) => string;
  focusIds?: readonly string[];
}): ChordOverlay {
  const { namedChords, posOf, point, radius, step, labelFor } = opts;
  const focus = new Set(opts.focusIds ?? []);
  const emphasize = focus.size > 0;
  const claimed = new Set<string>();
  const marks: ChordMark[] = [];
  namedChords.forEach((chord, index) => {
    const positions = chord.moduleIds.map(posOf);
    if (positions.some((pos) => pos === null)) return;
    const centers = positions.map((pos) => point(pos as Hex));
    const seams = tracesFor(centers, radius, step, claimed);
    const top = centers.reduce((a, b) => (b[1] < a[1] ? b : a));
    marks.push({
      key: `chord-${index}`,
      label: labelFor(chord),
      colorVar: CHORD_HUES[chord.name] ?? FALLBACK_HUE,
      duration: CHORD_PULSE[chord.name] ?? FALLBACK_PULSE,
      seams,
      chipX: Number(top[0].toFixed(2)),
      // The chip anchor floats above the topmost voice, a half-hex clear.
      chipY: Number((top[1] - radius * 1.18).toFixed(2)),
      voices: chord.moduleIds,
      focused: !emphasize || chord.moduleIds.some((id) => focus.has(id)),
    });
  });
  return { marks };
}
