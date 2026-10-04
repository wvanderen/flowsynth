// The chord library's field guide (#218, issue #230): the card glyphs and
// the library sheet's markup. Like chordlayer.ts the diagram stays pure and
// testable — the stylesheet keeps every color in the token table.
//
// The glyph language is the prototype's approved round three
// (prototype/chord-library-218, never merged): an exact miniature of the
// board — the game's own pointy-top hexes and axial→pixel mapping — with
// voices at the canonical cheapest placements, the wire gaps between root
// and voice rendered as empty dashed hex outlines (counted at a glance),
// and every 2+-voice chord sealed by the offset-outline polygon (the
// capsule around a pair, the hull through three or more). Labels carry no
// accidentals: the root wears R, every other voice its half-step count
// (R·4·7, R·10). Discovered glyphs ride the board's own --chord-* hues;
// undiscovered ones are hueless — dashed silhouette and counted wire gaps
// only, no name, no labels, no value, no copy.

import type { ChordDiscovery } from "../engine/types";
import type { NamedChordDef } from "../engine/constants";
import { CHORD_HUES, convexHull } from "./chordlayer";
import { boardPoint, hexCorner, SPACING } from "./face";
import { formatNumber } from "./format";

// The canonical cheapest lattice offset for an interval class: the (dq, dr)
// with 7·dq ≡ interval (mod 12) at minimal hex distance — where a player
// would actually build the voice. The register axis never changes pitch
// class (12·dr ≡ 0), so ties across dr are the norm; among equals the
// glyph takes the position euclidean-closest to the root in pixel space,
// stable on |dr| — the compact spread.
// The sprawl still tells the truth: an M3 lands three wire cells out and
// the glyph is exactly as wide as the chord is expensive.
export interface LatticeOffset {
  dq: number;
  dr: number;
  dist: number;
}

export function latticeOffset(interval: number): LatticeOffset {
  const target = ((interval % 12) + 12) % 12;
  let best: { dq: number; dr: number; dist: number; eu: number } | null = null;
  for (let dq = -6; dq <= 6; dq++) {
    if ((((7 * dq) % 12) + 12) % 12 !== target) continue;
    for (let dr = 6; dr >= -6; dr--) {
      const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
      const eu = Math.hypot(...boardPoint({ q: dq, r: dr })) / SPACING;
      if (!best || dist < best.dist || (dist === best.dist && eu < best.eu - 1e-9)) best = { dq, dr, dist, eu };
    }
  }
  const { dq, dr, dist } = best!;
  return { dq, dr, dist };
}

// Axial rounding over cube coordinates — the cells a straight hex line
// between root and voice passes through. The between cells are the wire
// gaps the glyph counts.
export interface AxialCell {
  dq: number;
  dr: number;
}

export function wireCells(from: AxialCell, to: AxialCell): AxialCell[] {
  const n = (Math.abs(to.dq - from.dq) + Math.abs(to.dr - from.dr) + Math.abs(to.dq - from.dq + to.dr - from.dr)) / 2;
  const round = (q: number, r: number): AxialCell => {
    const y = -q - r;
    let rq = Math.round(q);
    let ry = Math.round(y);
    const rr = Math.round(r);
    const dq2 = Math.abs(rq - q);
    const dy2 = Math.abs(ry - y);
    const dr2 = Math.abs(rr - r);
    if (dq2 > dy2 && dq2 > dr2) rq = -ry - rr;
    else if (dy2 > dr2) ry = -rq - rr;
    return { dq: rq, dr: rr };
  };
  const out: AxialCell[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    out.push(round(from.dq + (to.dq - from.dq) * t, from.dr + (to.dr - from.dr) * t));
  }
  return out;
}

interface Pt {
  x: number;
  y: number;
}

// A two-voice ring: the capsule around both centers, sampled — no arc
// path guessing.
function capsulePath(a: Pt, b: Pt, r: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const phi = Math.atan2(ny, nx);
  const pts: string[] = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const ang = phi + (Math.PI * i) / N;
    pts.push(`${(a.x + r * Math.cos(ang)).toFixed(1)},${(a.y + r * Math.sin(ang)).toFixed(1)}`);
  }
  for (let i = 0; i <= N; i++) {
    const ang = phi + Math.PI + (Math.PI * i) / N;
    pts.push(`${(b.x + r * Math.cos(ang)).toFixed(1)},${(b.y + r * Math.sin(ang)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

// The board's pointy-top hexagon: corners at 60i − 30 degrees, from the
// one corner math every board-surface renderer shares (face.ts hexCorner).
function hexPathAt(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const [dx, dy] = hexCorner(r, i);
    pts.push(`${(cx + dx).toFixed(1)},${(cy + dy).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

// Labels carry no accidentals: the root's slot wears R, every other voice
// its raw half-step count.
function voiceLabel(interval: number): string {
  return interval === 0 ? "R" : String(interval);
}

const GLYPH_VIEW = 100;

// One class's glyph: an svg scaled to fill whatever box the card gives it
// (the prototype's fixed 176px ceiling dies here — the glyph is the card's
// whole top space). Discovered, the voices carry labels and the class's
// board hue; undiscovered, the hueless dashed silhouette with its wire
// gaps still counted.
export function chordGlyphSvg(def: NamedChordDef, discovered: boolean): string {
  const hue = CHORD_HUES[def.name];
  const seam = discovered && hue ? `var(--${hue})` : "var(--line-strong)";
  // The Octave is two voices of one class a register apart — offsets by
  // hand, since both intervals are class 0.
  const offsets: LatticeOffset[] = def.name === "Octave"
    ? [
        { dq: 0, dr: 0, dist: 0 },
        { dq: 0, dr: 1, dist: 1 },
      ]
    : def.intervals.map(latticeOffset);
  // The board's own pointy-top axial mapping (face.ts boardPoint), scaled
  // to fill the viewBox.
  const unitPoint = ({ dq, dr }: AxialCell): Pt => {
    const [x, y] = boardPoint({ q: dq, r: dr });
    return { x: x / SPACING, y: y / SPACING };
  };
  const unit = offsets.map(unitPoint);
  const half = GLYPH_VIEW / 2 - 2;
  const mx = Math.max(...unit.map((p) => Math.abs(p.x))) + Math.sqrt(3) / 2 + 0.3;
  const my = Math.max(...unit.map((p) => Math.abs(p.y))) + 1 + 0.3;
  const u = Math.min(half / Math.max(mx, my), half / 1.8);
  const R = u * 0.92;
  const at = (o: AxialCell): Pt => {
    const { x, y } = unitPoint(o);
    return { x: GLYPH_VIEW / 2 + x * u, y: GLYPH_VIEW / 2 + y * u };
  };
  const pts = offsets.map(at);
  const fontSize = Math.min(11, R * 0.9);
  const voices = pts
    .map((p, i) => {
      const interval = def.name === "Octave" && i === 1 ? 12 : def.intervals[i]!;
      const text = discovered ? voiceLabel(interval) : "";
      const label = text
        ? `<text x="${p.x.toFixed(1)}" y="${(p.y + fontSize * 0.35).toFixed(1)}" text-anchor="middle" fill="var(--ink)"
        font-size="${fontSize.toFixed(1)}" font-family="var(--mono)">${text}</text>`
        : "";
      return `<path d="${hexPathAt(p.x, p.y, R)}" fill="${discovered && hue ? `color-mix(in srgb, var(--${hue}) 18%, var(--panel))` : "var(--panel)"}"
        stroke="${seam}" stroke-width="1.3" ${discovered ? "" : 'stroke-dasharray="3.5 2.5"'} />${label}`;
    })
    .join("");
  // The wire gaps: empty hex outlines between root and voice, so the
  // count reads at a glance. Shared cells (two voices passing one wire)
  // draw once.
  const seen = new Set<string>();
  const ghosts: string[] = [];
  for (const o of offsets.slice(1)) {
    for (const wire of wireCells(offsets[0]!, o)) {
      const key = `${wire.dq},${wire.dr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = at(wire);
      ghosts.push(
        `<path d="${hexPathAt(p.x, p.y, R * 0.92)}" fill="none" stroke="var(--line-strong)" stroke-width="1" stroke-dasharray="2.5 2.5" />`,
      );
    }
  }
  // Every chord of two or more voices draws the offset-outline polygon —
  // the capsule around a pair, the hull through three or more. Undiscovered,
  // the ring stays transparent: silhouette only. Taking the hull of the
  // expanded faces also encloses collinear voices without collapsing.
  const ring = offsets.length === 2
    ? capsulePath(pts[0]!, pts[1]!, R * 1.1)
    : convexHull(pts.flatMap((p) => Array.from({ length: 6 }, (_, i) => {
        const [dx, dy] = hexCorner(R * 1.1, i);
        return [p.x + dx, p.y + dy] as const;
      }))).map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";
  const annotation = `<path d="${ring}" fill="${discovered && hue ? `color-mix(in srgb, var(--${hue}) 9%, transparent)` : "transparent"}"
    stroke="${seam}" stroke-width="1.6" stroke-linejoin="round" ${discovered ? "" : 'stroke-dasharray="5 4"'} />`;
  return `<svg class="chord-glyph" viewBox="0 0 ${GLYPH_VIEW} ${GLYPH_VIEW}" role="img" aria-label="${discovered ? `${def.name} glyph` : "Undiscovered chord glyph"}" preserveAspectRatio="xMidYMid meet">
    ${ghosts.join("")}${annotation}${voices}
  </svg>`;
}

// The roots-heard hairline at the card's bottom edge: the class's progress
// across the twelve roots, present on locked and discovered cards alike,
// and read aloud — the count is the card's only progress figure.
function hairlineHtml(record: ChordDiscovery | undefined): string {
  const heard = Math.min(12, record?.rootsHeard ?? 0);
  return `<div class="library-hairline" role="img" aria-label="${heard} of 12 roots heard"><i style="width:${((heard / 12) * 100).toFixed(1)}%"></i></div>`;
}

// One field-guide card: glyph, name, bonus, hairline — nothing else on a
// discovered card, and the glyph-only silhouette (hairline still at the
// bottom edge) on an undiscovered one.
export function libraryCardHtml(def: NamedChordDef, record: ChordDiscovery | undefined): string {
  if (record?.formed !== true) {
    return `<article class="library-card locked">${chordGlyphSvg(def, false)}${hairlineHtml(record)}</article>`;
  }
  return `<article class="library-card">
    ${chordGlyphSvg(def, true)}
    <h3>${def.name}</h3>
    <p class="library-bonus mono">×${formatNumber(1 + def.bonus)} while it sings</p>
    ${hairlineHtml(record)}
  </article>`;
}
