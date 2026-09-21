// The chord overlay (issue #62): pure geometry for the on-demand chord view.
// Like leads.ts, the diagram stays pure and testable — render.ts draws the
// markup and the stylesheet keeps every color in the token table. This module
// decides which modules participate in drawable chord terms, where pair links
// span, and the hull that wraps each named chord's voices.
import type { ChordPairTerm, Hex, NamedChordTerm } from "../engine/types";
import { hexApothem, hexCorner } from "./face";

export type Point = readonly [number, number];

export interface ChordLink {
  readonly key: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ChordMark {
  readonly key: string;
  readonly label: string;
  // The hull polygon, offset outward so it clears the faces it wraps.
  readonly points: string;
  readonly labelX: number;
  readonly labelY: number;
}

export interface ChordOverlay {
  links: ChordLink[];
  marks: ChordMark[];
  // Every module id that lives in a drawable chord term — the view lights
  // these and dims everything else.
  participants: Set<string>;
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

// The overlay over one board's chord terms: a trimmed seam link per pair and
// an offset hull plus formula-chip label per named chord. A term with a voice
// off the board cannot be drawn whole — it contributes nothing at all, not
// even light.
export function chordOverlay(opts: {
  pairs: readonly ChordPairTerm[];
  namedChords: readonly NamedChordTerm[];
  posOf: (id: string) => Hex | null;
  point: (h: Hex) => Point;
  radius: number;
  // How far the hull clears the faces it wraps (pixels).
  pad: number;
  labelFor: (chord: NamedChordTerm) => string;
}): ChordOverlay {
  const { pairs, namedChords, posOf, point, radius, pad, labelFor } = opts;
  const round = (v: number) => Number(v.toFixed(2));
  // Pair links bridge the seam between neighboring faces, trimmed to the
  // chassis edge-to-edge (flat-to-flat apothem plus a hair), so they read in
  // the same wiring register the charge leads render in.
  const trim = hexApothem(radius) + 1;
  const links: ChordLink[] = [];
  const participants = new Set<string>();
  for (const pair of pairs) {
    const a = posOf(pair.a);
    const b = posOf(pair.b);
    if (!a || !b) continue;
    participants.add(pair.a);
    participants.add(pair.b);
    const [ax, ay] = point(a);
    const [bx, by] = point(b);
    const len = Math.hypot(bx - ax, by - ay);
    if (!(len > 0)) continue;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    links.push({
      key: `${pair.a}-${pair.b}`,
      x1: round(ax + ux * trim),
      y1: round(ay + uy * trim),
      x2: round(bx - ux * trim),
      y2: round(by - uy * trim),
    });
  }
  const marks: ChordMark[] = [];
  namedChords.forEach((chord, index) => {
    const positions = chord.moduleIds.map(posOf);
    if (positions.some((pos) => pos === null)) return;
    for (const id of chord.moduleIds) participants.add(id);
    const corners = positions.flatMap((pos) => hexVertices(point(pos as Hex), radius));
    const grown = offsetConvex(convexHull(corners), pad);
    const cx = grown.reduce((acc, p) => acc + p[0], 0) / grown.length;
    marks.push({
      key: `chord-${index}`,
      label: labelFor(chord),
      points: grown.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" "),
      labelX: round(cx),
      // The callout rides above the hull, clear of the faces it names.
      labelY: round(Math.min(...grown.map((p) => p[1])) - 9),
    });
  });
  return { links, marks, participants };
}
