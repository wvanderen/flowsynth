// The chord overlay: pure geometry for the board's chord annotation. Like
// leads.ts, the diagram stays pure and testable — render.ts draws the
// markup and the stylesheet keeps every color in the token table.
//
// The language is the dense-board prototype's approved direction (#174,
// implemented for #201): a two-voice chord seals the shared edge — twin
// parallel lines riding the gap between the faces, so the face centers
// stay free for the charge leads. A chord whose voices all sit on one
// lattice line — octave columns, fifth chains, wired (spacer-conducted)
// pairs — extends ONE continuous twin line from its first voice to its
// last, trimmed short of the end faces; a distant bridged pair stays
// straight through the wire, deliberately. Any chord the lines can't
// carry — three or more voices off the lattice lines — wraps in a
// note-corner polygon: one corner per voice, pushed just past its own
// outline. Overlapping chord terms all draw — no pair is claimed once.
// Name chips live in a reserved spot by the board; selection and hover
// are the caller's emphasis questions.
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
  // The chord's drawn segments: a two-voice chord's edge brackets (twin
  // lines sealing the shared edge), or a collinear run's one continuous
  // twin line, first voice to last.
  readonly seams: ChordSeam[];
  // A chord the lines can't carry — three or more voices off the lattice
  // lines: the note-corner polygon as a points string, one corner per
  // voice pushed just past its own outline. Null when the seams carry the
  // chord.
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
// bridged pair that runs straight through the wire instead.
const SEAM_REACH = 1.9;

// How far a run's ends stop short of their end voices' centers: just
// outside the chassis apothem — and always short of the gap's midpoint,
// so neighboring marks never cross.
function seamTrim(radius: number): number {
  return radius * (Math.sqrt(3) / 2) + 2;
}

// Each bracket line's offset off the shared edge, into the gap (tuning):
// the twin lines straddle the seam the way stitches do.
export const EDGE_OFFSET = 1.8;

// Half a two-voice bracket's length along the shared edge (tuning): the
// seal rides the middle of the edge, clear of the corners.
export const EDGE_HALF = 22;

// How far past a voice's own outline its polygon corner reaches (tuning):
// just past the chassis, so every corner names its voice.
export const CORNER_REACH_PAD = 6;

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
// clamped to the segments.
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

// The two-voice seal: from the shared edge's midpoint — the gap between
// the two faces — twin parallel lines ride the gap, each a stitch long,
// offset either side of the edge. The face centers stay free for the
// charge leads.
function edgeBrackets([p, q]: readonly [Point, Point]): ChordSeam[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [];
  const ux = dx / len;
  const uy = dy / len;
  const mx = (p[0] + q[0]) / 2;
  const my = (p[1] + q[1]) / 2;
  const vx = -uy;
  const vy = ux;
  const line = (off: number): ChordSeam => ({
    x1: Number((mx + ux * off - vx * EDGE_HALF).toFixed(2)),
    y1: Number((my + uy * off - vy * EDGE_HALF).toFixed(2)),
    x2: Number((mx + ux * off + vx * EDGE_HALF).toFixed(2)),
    y2: Number((my + uy * off + vy * EDGE_HALF).toFixed(2)),
  });
  return [line(EDGE_OFFSET), line(-EDGE_OFFSET)];
}

// Whether the points all sit on one line, and the line's unit axis with
// the points sorted along it. Two points always are; three or more
// decide the run against the first segment's axis.
function collinearSpan(points: readonly Point[]): { axis: Point; ordered: Point[] } | null {
  if (points.length < 2) return null;
  const [p, q] = [points[0]!, points[1]!];
  let ax = q[0] - p[0];
  let ay = q[1] - p[1];
  const alen = Math.hypot(ax, ay);
  if (alen < 1e-6) return null;
  ax /= alen;
  ay /= alen;
  for (let i = 2; i < points.length; i++) {
    const rx = points[i]![0] - p[0];
    const ry = points[i]![1] - p[1];
    if (Math.abs(ax * ry - ay * rx) > 1e-6) return null;
  }
  const ordered = [...points].sort((a, b) => a[0] * ax + a[1] * ay - (b[0] * ax + b[1] * ay));
  return { axis: [ax, ay], ordered };
}

// One continuous twin line spanning the run, trimmed at the end voices —
// the line passes under the faces between (marks draw beneath the
// modules), showing only in the gaps: the open wire.
function runSeams(ordered: readonly Point[], axis: Point, radius: number): ChordSeam[] {
  const [ax, ay] = axis;
  const trim = seamTrim(radius);
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const vx = -ay;
  const vy = ax;
  const line = (off: number): ChordSeam => ({
    x1: Number((first[0] + ax * trim - vx * off).toFixed(2)),
    y1: Number((first[1] + ay * trim - vy * off).toFixed(2)),
    x2: Number((last[0] - ax * trim - vx * off).toFixed(2)),
    y2: Number((last[1] - ay * trim - vy * off).toFixed(2)),
  });
  return [line(EDGE_OFFSET), line(-EDGE_OFFSET)];
}

// The note-corner polygon: each hull voice owns one corner, pushed just
// past its own outline in the voice's outward direction — no bevel cuts,
// no angles that loop back between notes. Returns the polygon as a
// points string.
function voiceOutline(centers: readonly Point[], radius: number): string {
  const hull = convexHull(centers);
  if (hull.length < 2) return "";
  const reach = radius + CORNER_REACH_PAD;
  const cx = hull.reduce((acc, p) => acc + p[0], 0) / hull.length;
  const cy = hull.reduce((acc, p) => acc + p[1], 0) / hull.length;
  return hull
    .map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return `${(x + (dx / len) * reach).toFixed(2)},${(y + (dy / len) * reach).toFixed(2)}`;
    })
    .join(" ");
}

// Whether a two-voice chord's voices sit beyond seam reach — a
// spacer-conducted pair, usually. The brackets can't draw it; the run
// carries it, straight through the wire.
export function bridgedPair(centers: readonly Point[], radius: number): boolean {
  if (centers.length !== 2) return false;
  const reach = radius * SEAM_REACH;
  const [p, q] = [centers[0]!, centers[1]!];
  return Math.hypot(q[0] - p[0], q[1] - p[1]) > reach;
}

// A chord's drawn geometry: adjacent pairs seal their shared edge with
// brackets; everything else runs continuous when its voices line up —
// octave columns, fifth chains, wired pairs — and wraps in the
// note-corner polygon when they don't. Overlapping terms each draw their
// own: no pair is claimed once.
function geometryFor(centers: readonly Point[], radius: number): { seams: ChordSeam[]; outline: string | null } {
  if (centers.length === 2 && !bridgedPair(centers, radius)) {
    return { seams: edgeBrackets(centers as [Point, Point]), outline: null };
  }
  const span = collinearSpan(centers);
  if (span) return { seams: runSeams(span.ordered, span.axis, radius), outline: null };
  return { seams: [], outline: voiceOutline(centers, radius) || null };
}

function parsePoints(text: string): Point[] {
  return text
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return [x!, y!] as Point;
    });
}

function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi! > y !== yj! > y && x! < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

// How far a covering ask reaches from the drawn work (tuning): the gap's
// half-width plus the twin lines' offset, with slack — a spacer's center
// sits ~1.8px off each twin line of a run it conducts.
const COVER_REACH = 6;

// Whether a board point sits inside the mark's drawn work — within its
// note-corner polygon, or a hair off one of its lines. The spacer ask
// reads by containment: a wire asks the chords it conducts, and a
// conducting spacer's selection lifts them.
export function chordMarkCovers(mark: Pick<ChordMark, "seams" | "outline">, at: Point): boolean {
  if (mark.outline) return pointInPolygon(at[0], at[1], parsePoints(mark.outline));
  return mark.seams.some((s) => edgeDistance(at, [[s.x1, s.y1], [s.x2, s.y2]]) <= COVER_REACH);
}

// The overlay over one board's chord terms: per named chord, its drawn
// segments and its chip anchor. A term with a voice off the board cannot
// be drawn whole — it contributes nothing at all, not even light.
// `focusIds` carries the selection's emphasis (§6): chords carrying one of
// those ids come back focused, every other mark fades; unset, nothing
// fades. `focusPoint` extends the same emphasis to a selection that sings
// in no chord — the conducting spacer: chords whose drawn work covers the
// point lift with it. `step` is the lattice's adjacent-center distance.
export function chordOverlay(opts: {
  namedChords: readonly NamedChordTerm[];
  posOf: (id: string) => Hex | null;
  point: (h: Hex) => Point;
  radius: number;
  step: number;
  labelFor: (chord: NamedChordTerm) => string;
  focusIds?: readonly string[];
  focusPoint?: Point | null;
}): ChordOverlay {
  const { namedChords, posOf, point, radius, labelFor } = opts;
  const focus = new Set(opts.focusIds ?? []);
  const emphasize = focus.size > 0 || opts.focusPoint != null;
  const marks: ChordMark[] = [];
  namedChords.forEach((chord, index) => {
    const positions = chord.moduleIds.map(posOf);
    if (positions.some((pos) => pos === null)) return;
    const centers = positions.map((pos) => point(pos as Hex));
    const { seams, outline } = geometryFor(centers, radius);
    const top = centers.reduce((a, b) => (b[1] < a[1] ? b : a));
    const mark: ChordMark = {
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
      focused:
        !emphasize ||
        chord.moduleIds.some((id) => focus.has(id)) ||
        (opts.focusPoint != null && chordMarkCovers({ seams, outline }, opts.focusPoint)),
    };
    marks.push(mark);
  });
  return { marks };
}
