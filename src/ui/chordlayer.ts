// The chord overlay: pure geometry for the board's chord annotation. Like
// leads.ts, the diagram stays pure and testable — render.ts draws the
// markup and the stylesheet keeps every color in the token table. This
// module decides which modules participate in drawable chord terms and the
// hull that wraps each named chord's voices. With the carrierless board
// (ADR-0021) chords are register-free pitch sets — there are no pair links
// to draw, only named-chord hulls. The overlay is always on (§6): every
// formed chord wears its hull and name chip, chips stack where chords
// overlap, and selection is the caller's emphasis question.
import type { Hex, NamedChordTerm } from "../engine/types";
import { hexCorner } from "./face";

export type Point = readonly [number, number];

export interface ChordMark {
  readonly key: string;
  readonly label: string;
  // The hull polygon, offset outward so it clears the faces it wraps.
  readonly points: string;
  readonly labelX: number;
  readonly labelY: number;
  // The chip's estimated pixel width — the backing rect's width and the
  // stacking collision's footprint.
  readonly labelW: number;
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

// Hex corners in pixel space at a center, face.ts's angle convention.
export function hexVertices(center: Point, radius: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const [dx, dy] = hexCorner(radius, i);
    return [center[0] + dx, center[1] + dy] as const;
  });
}

// Andrew's monotone chain over pixel coordinates.
export function convexHull(points: readonly Point[]): Point[] {
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

// Offset a convex polygon outward by pad: shift every edge along its outward
// normal and rebuild the vertices at the intersections. Radial vertex scaling
// would starve long edges — a deep chord's row would clip its outer faces.
function offsetConvex(hull: readonly Point[], pad: number): Point[] {
  const cx = hull.reduce((acc, p) => acc + p[0], 0) / hull.length;
  const cy = hull.reduce((acc, p) => acc + p[1], 0) / hull.length;
  const edges = hull.map((a, i) => {
    const b = hull[(i + 1) % hull.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = (b[1] - a[1]) / len;
    const ny = -(b[0] - a[0]) / len;
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    // Outward faces away from the centroid, whichever way the hull winds.
    const outward = nx * mx + ny * my < 0 ? -1 : 1;
    const fnx = nx * outward;
    const fny = ny * outward;
    // The edge's offset line: every point p on it satisfies p·n = c.
    return { nx: fnx, ny: fny, c: a[0] * fnx + a[1] * fny + pad };
  });
  return hull.map((_, i) => {
    const p = edges[(i - 1 + edges.length) % edges.length]!;
    const q = edges[i]!;
    const det = p.nx * q.ny - p.ny * q.nx;
    if (Math.abs(det) < 1e-9) return hull[i]!;
    return [
      (p.c * q.ny - p.ny * q.c) / det,
      (p.nx * q.c - p.c * q.nx) / det,
    ] as const;
  });
}

// Shortest distance from a point to the polygon's edge lines; exact for
// points inside a convex polygon, which is the only case the tests need.
export function edgeDistance(point: Point, polygon: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dist = Math.abs(((b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])) / len);
    best = Math.min(best, dist);
  }
  return best;
}

// Stack overlapping chips (§6): where chords overlap or sit side by side,
// their chips pile upward instead of colliding. Bottom-first, left-second
// order — the lowest chip pins to its hull and the rest climb clear.
function stackChips(marks: ChordMark[]): ChordMark[] {
  const placed: ChordMark[] = [];
  const ordered = [...marks].sort((a, b) => b.labelY - a.labelY || a.labelX - b.labelX);
  for (const mark of ordered) {
    let labelY = mark.labelY;
    while (
      placed.some(
        (p) =>
          Math.abs(p.labelY - labelY) < CHIP_STACK_PX &&
          Math.abs(p.labelX - mark.labelX) < (p.labelW + mark.labelW) / 2,
      )
    ) {
      labelY -= CHIP_STACK_PX;
    }
    placed.push({ ...mark, labelY });
  }
  return placed;
}

// The overlay over one board's chord terms: an offset hull plus formula-chip
// label per named chord. A term with a voice off the board cannot be drawn
// whole — it contributes nothing at all, not even light. `focusIds` carries
// the selection's emphasis (§6): chords carrying one of those ids come back
// focused, every other mark fades; unset, nothing fades.
export function chordOverlay(opts: {
  namedChords: readonly NamedChordTerm[];
  posOf: (id: string) => Hex | null;
  point: (h: Hex) => Point;
  radius: number;
  // How far the hull clears the faces it wraps (pixels).
  pad: number;
  labelFor: (chord: NamedChordTerm) => string;
  focusIds?: readonly string[];
}): ChordOverlay {
  const { namedChords, posOf, point, radius, pad, labelFor } = opts;
  const focus = new Set(opts.focusIds ?? []);
  const emphasize = focus.size > 0;
  const round = (v: number) => Number(v.toFixed(2));
  const marks: ChordMark[] = [];
  namedChords.forEach((chord, index) => {
    const positions = chord.moduleIds.map(posOf);
    if (positions.some((pos) => pos === null)) return;
    const corners = positions.flatMap((pos) => hexVertices(point(pos as Hex), radius));
    const grown = offsetConvex(convexHull(corners), pad);
    const cx = grown.reduce((acc, p) => acc + p[0], 0) / grown.length;
    const label = labelFor(chord);
    marks.push({
      key: `chord-${index}`,
      label,
      points: grown.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" "),
      labelX: round(cx),
      // The callout rides above the hull, clear of the faces it names.
      labelY: round(Math.min(...grown.map((p) => p[1])) - 9),
      labelW: round(chipWidth(label)),
      focused: !emphasize || chord.moduleIds.some((id) => focus.has(id)),
    });
  });
  return { marks: stackChips(marks) };
}
