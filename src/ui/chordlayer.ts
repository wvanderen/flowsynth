// The chord overlay: pure geometry for the board's chord annotation. Like
// leads.ts, the diagram stays pure and testable — render.ts draws the
// markup and the stylesheet keeps every color in the token table.
//
// The language is the prototype's (#120): a two-voice chord seams
// center-to-center between its voices; a chord the seams can't carry —
// three or more voices, or a spacer-bridged pair — draws an offset
// outline around its voices — a closed convex hull riding the gaps
// between the faces, its corners poking out past the outer edges — drawn
// behind the modules. Name chips live in a reserved spot by the board;
// selection and hover are the caller's emphasis questions.
import type { Hex, NamedChordTerm } from "../engine/types";
import { hexApothem } from "./face";

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
  // A two-voice chord's drawn segments: center-to-center per qualifying
  // pair. Chords the seams can't carry draw the outline instead.
  readonly seams: ChordSeam[];
  // A chord the seams can't carry — three or more voices, or a pair
  // beyond seam reach: the offset hull around its centers as a polygon
  // points string — the prototype's triangle behind the modules, corners
  // sticking out. Null when the seams carry the chord.
  readonly outline: string | null;
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

// A seam's reach: 1.9 × the hex radius — a hair over one adjacent-center
// step, so straight and diagonal neighbors draw and anything longer is a
// bridged pair that draws the outline instead.
const SEAM_REACH = 1.9;

// How far a seam end stops short of its voice's center: just outside the
// chassis apothem — and always short of the gap's midpoint, so adjacent
// seams never cross.
function seamTrim(radius: number): number {
  return radius * (Math.sqrt(3) / 2) + 2;
}

// Andrew's monotone chain over pixel coordinates.
function convexHull(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: Point, a: Point, b: Point): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}
// Shortest distance from a point to the polygon's boundary segments —
// clamped to the segments, so bevel cuts measure by their endpoints.
export function edgeDistance(point: Point, polygon: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t)));
  }
  return best;
}

// How far the outline rides past the plates' facing edges (tuning): enough
// that the stroke stays clear of the chassis, little enough to stay inside
// the gap between neighboring faces.
const OUTLINE_CLEARANCE = 2.5;

// How far past the module corner the outline's corners reach (tuning): a
// plain offset of a 60° corner would spike to twice the pad — instead the
// corner is bevel-cut at this radius from its voice's center, just past
// the module's own corner so the cut reads.
const CORNER_POKE = 8;

// The outline for a chord the seams can't carry: the convex hull of the
// voice centers, offset so its edges run straight through the gap between
// neighboring faces — just off the plates' facing edges — with each corner
// bevel-cut a hair past the outer module edges: the prototype's triangle
// behind the modules. Returns the polygon as a points string.
function outlineFor(centers: readonly Point[], radius: number, step: number): string {
  const pad = Math.min(hexApothem(radius) + OUTLINE_CLEARANCE, step / 2);
  const hull = convexHull(centers);
  if (hull.length < 2) return "";
  const reach = Math.sqrt(Math.max(0, (radius + CORNER_POKE) ** 2 - pad * pad));
  const cx = hull.reduce((acc, p) => acc + p[0], 0) / hull.length;
  const cy = hull.reduce((acc, p) => acc + p[1], 0) / hull.length;
  const points: string[] = [];
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!;
    const b = hull[(i + 1) % hull.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    let nx = (b[1] - a[1]) / len;
    let ny = -(b[0] - a[0]) / len;
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    // Outward faces away from the centroid, whichever way the hull winds.
    if (nx * mx + ny * my < 0) {
      nx = -nx;
      ny = -ny;
    }
    // The offset edge, extended to the corner-bevel radius off each end —
    // the spike sits BEHIND the perpendicular foot on each side, so the
    // extension runs toward the corners, and consecutive edges' clipped
    // ends join into the short corner bevels.
    points.push(`${(a[0] + nx * pad - ux * reach).toFixed(2)},${(a[1] + ny * pad - uy * reach).toFixed(2)}`);
    points.push(`${(b[0] + nx * pad + ux * reach).toFixed(2)},${(b[1] + ny * pad + uy * reach).toFixed(2)}`);
  }
  return points.join(" ");
}

// Whether a two-voice chord's voices sit beyond seam reach — a
// spacer-conducted pair, usually. The seams can't draw it (a long line
// would cross the faces in between), so the outline carries it, the same
// way a bridged triad draws.
export function bridgedPair(centers: readonly Point[], radius: number): boolean {
  if (centers.length !== 2) return false;
  const reach = radius * SEAM_REACH;
  const [p, q] = [centers[0]!, centers[1]!];
  return Math.hypot(q[0] - p[0], q[1] - p[1]) > reach;
}

// The chord's drawn seams: two voices seam center-to-center (each
// qualifying adjacent pair; `claimed` carries pair keys across chords — a
// shared pair draws once, the first chord's color winning). Pairs beyond
// reach draw nothing — the chord is bridged and the outline carries it.
function seamsFor(centers: readonly Point[], radius: number, claimed: Set<string>): ChordSeam[] {
  if (centers.length >= 3) return [];
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
    const seams = seamsFor(centers, radius, claimed);
    const outline = centers.length >= 3 || bridgedPair(centers, radius) ? outlineFor(centers, radius, step) : null;
    const top = centers.reduce((a, b) => (b[1] < a[1] ? b : a));
    marks.push({
      key: `chord-${index}`,
      label: labelFor(chord),
      colorVar: CHORD_HUES[chord.name] ?? FALLBACK_HUE,
      duration: CHORD_PULSE[chord.name] ?? FALLBACK_PULSE,
      seams,
      outline,
      chipX: Number(top[0].toFixed(2)),
      // The chip anchor floats above the topmost voice, a half-hex clear.
      chipY: Number((top[1] - radius * 1.18).toFixed(2)),
      voices: chord.moduleIds,
      focused: !emphasize || chord.moduleIds.some((id) => focus.has(id)),
    });
  });
  return { marks };
}
