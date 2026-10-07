// The chord sheet's glyphs and markup (issue #230, reworked by the refit's
// chord-sheet ticket #278): the class index's rows and the selected class's
// stage. Like chordlayer.ts the diagram stays pure and testable — the
// stylesheet keeps every color in the token table.
//
// The glyph language is the prototype's approved round three
// (prototype/chord-library-218, never merged): an exact miniature of the
// board — the game's own pointy-top hexes and axial→pixel mapping — with
// voices at the canonical cheapest placements, the wire gaps between root
// and voice rendered as empty dashed hex outlines (counted at a glance),
// and every 2+-voice chord sealed by the offset-outline polygon (the
// capsule around a pair, the hull through three or more). Labels carry no
// accidentals: the root wears R, every other voice its half-step count
// (R·4·7, R·10). Discovered glyphs ride the board's own --chord-* hues.
// Undiscovered ones stop overlapping the conventions (#278): solid, dimmed,
// hueless voice hexes — modules and spacers distinct at a glance — with
// the dashed wire gaps kept as the spacer path and the sealing ring
// absent; no name, labels, or bonus.

import type { ChordDiscovery, NamedChordTerm } from "../engine/types";
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

export interface GlyphOptions {
  // The recipe labels ride the voices (discovered only) — off for the
  // index's mini glyphs, where the row's own name carries the identity.
  labels?: boolean;
  // Stroke-width multiplier: the small index glyphs thicken to stay
  // legible at 32px.
  sw?: number;
}

// One class's glyph: an svg scaled to fill whatever box the sheet gives
// it. Discovered, the voices carry labels and the class's board hue, and
// the sealing ring rides around them. Undiscovered (#278): solid, dimmed,
// hueless voice hexes, the dashed wire gaps still counted, and the ring
// absent — no name, labels, or bonus.
export function chordGlyphSvg(def: NamedChordDef, discovered: boolean, opts: GlyphOptions = {}): string {
  const labels = opts.labels ?? true;
  const sw = opts.sw ?? 1;
  const hue = CHORD_HUES[def.name];
  const seam = discovered && hue ? `var(--${hue})` : "var(--muted)";
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
      const text = discovered && labels ? voiceLabel(interval) : "";
      const label = text
        ? `<text x="${p.x.toFixed(1)}" y="${(p.y + fontSize * 0.35).toFixed(1)}" text-anchor="middle" fill="var(--ink)"
        font-size="${fontSize.toFixed(1)}" font-family="var(--mono)">${text}</text>`
        : "";
      // Undiscovered faces are solid, dimmed, and hueless — the module
      // voice against the wire gaps' dashed spacers.
      return `<path d="${hexPathAt(p.x, p.y, R)}" fill="${discovered && hue ? `color-mix(in srgb, var(--${hue}) 18%, var(--panel))` : "var(--panel)"}"
        stroke="${seam}" stroke-width="${String(1.3 * sw)}" />${label}`;
    })
    .join("");
  // The wire gaps: empty dashed hex outlines between root and voice, so
  // the spacer path counts at a glance — undiscovered, the one convention
  // that stays. Shared cells (two voices passing one wire) draw once.
  const seen = new Set<string>();
  const ghosts: string[] = [];
  for (const o of offsets.slice(1)) {
    for (const wire of wireCells(offsets[0]!, o)) {
      const key = `${wire.dq},${wire.dr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const p = at(wire);
      ghosts.push(
        `<path d="${hexPathAt(p.x, p.y, R * 0.92)}" fill="none" stroke="var(--line-strong)" stroke-width="${String(1 * sw)}" stroke-dasharray="2.5 2.5" />`,
      );
    }
  }
  // The sealing ring — every chord of two or more voices draws the
  // offset-outline polygon, the capsule around a pair, the hull through
  // three or more. Undiscovered, the ring is absent: silhouette only, no
  // dashed echo of it. Taking the hull of the expanded faces also encloses
  // collinear voices without collapsing.
  let ring = "";
  if (discovered) {
    const ringPath = offsets.length === 2
      ? capsulePath(pts[0]!, pts[1]!, R * 1.1)
      : convexHull(pts.flatMap((p) => Array.from({ length: 6 }, (_, i) => {
          const [dx, dy] = hexCorner(R * 1.1, i);
          return [p.x + dx, p.y + dy] as const;
        }))).map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";
    ring = `<path d="${ringPath}" fill="${hue ? `color-mix(in srgb, var(--${hue}) 9%, transparent)` : "transparent"}"
      stroke="${seam}" stroke-width="${String(1.6 * sw)}" stroke-linejoin="round" />`;
  }
  return `<svg class="chord-glyph" viewBox="0 0 ${GLYPH_VIEW} ${GLYPH_VIEW}" role="img" aria-label="${discovered ? `${def.name} glyph` : "Undiscovered chord glyph"}" preserveAspectRatio="xMidYMid meet">
    ${ghosts.join("")}${ring}${voices}
  </svg>`;
}

// Standing instances per class, summed over the live rate pass's terms —
// the one read both the index's per-class counts and the stage's active
// read share, so neither can drift from the allocation.
export function instancesByClass(terms: readonly NamedChordTerm[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const term of terms) counts.set(term.name, (counts.get(term.name) ?? 0) + term.instances);
  return counts;
}

// The classes standing, in sheet order with their tallies — the shape the
// stage's active tooltip and the render key both read.
export type RingingClass = Pick<NamedChordTerm, "name" | "instances">;

// The live tally as a stable string — the sheet's rebuild signature's
// instance leg, shared by the render guard and nothing else.
export function instancesKeyOf(instances: Map<string, number>): string {
  return [...instances.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => `${name}:${count}`).join(",");
}

// A tooltip-wrapped figure: the visible mono read is itself the trigger —
// hover, focus, and touch pin open the body; the figure never hides
// behind the tooltip (the standards' critical-state rule).
function tipFigure(id: string, label: string, figure: string, body: string): string {
  return `<span class="inst-tip"><button class="inst-tip-trigger tip-figure" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="${label}">${figure}</button><span class="inst-tip-body" id="${id}" role="tooltip">${body}</span></span>`;
}

// The stacking clause both chord tooltips carry — worded once so the
// mechanic can never drift between them.
const STACKING_CLAUSE = "Instances stack on their members";

// The class bonus's tooltip mechanics — the only mechanics anywhere: each
// standing instance multiplies its member oscillators' output, instances
// stacking. No "while it sings," no board-wide claim (ADR-0036 stands).
export function bonusTipText(def: NamedChordDef): string {
  const factor = formatNumber(1 + def.bonus);
  return `Each standing instance multiplies its member oscillators' output ×${factor}. ` +
    `${STACKING_CLAUSE} — a doubled voice rings the factor twice — and no other module's output changes.`;
}

// The active read's tooltip: the classes ringing, named, and the stacking
// statement; the empty board says so plainly.
export function activeTipText(ringing: readonly RingingClass[]): string {
  if (ringing.length === 0) return "No chord instance stands on the board right now.";
  const named = ringing.map((chord) => `${chord.name} ×${chord.instances}`).join(" · ");
  const total = ringing.reduce((sum, chord) => sum + chord.instances, 0);
  return `${named} ring${ringing.length === 1 ? "s" : ""} on the board — ${total} standing instance${total === 1 ? "" : "s"}. ` +
    `${STACKING_CLAUSE}.`;
}

// The roots history's tooltip: the distinct-root count, and the rule that
// a root rings once however many formations carried it.
export function rootsTipText(heard: number): string {
  return `Distinct roots this class has rung: ${heard} of 12. A root counts once, wherever it stood.`;
}

// The header's count read: `Chords (4/11) (+4% ν)` — the discovery count
// with the bonus parenthetical, whose tooltip carries the discovery
// mechanic (each class adds its permanent +1%, across prestige).
export function libraryHeaderHtml(count: number, total: number, perClassPercent: number, boostPercent: number): string {
  const bonus = tipFigure(
    "chord-tip-discovery",
    "The discovery bonus",
    `(+${boostPercent}% ν)`,
    `Each discovered class adds +${perClassPercent}% ν to the rate — permanent, across prestige. ${count} of ${total} classes named.`,
  );
  return `<h2 id="modal-title" class="chord-head">Chords <span class="mono">(${count}/${total})</span> ${bonus}</h2>`;
}

// One index row: mini glyph, name — the dotted leader while undiscovered
// (the approved prototype's no-name placeholder) — and the live pip with
// its per-class instance count. Selecting a row puts that class on the
// stage; the selected row wears the state grammar's firm inset marker
// (aria-current for the non-color channel).
export function libraryIndexRowHtml(
  def: NamedChordDef,
  record: ChordDiscovery | undefined,
  instances: number,
  selected: boolean,
): string {
  const discovered = record?.formed === true;
  const hue = CHORD_HUES[def.name];
  const count =
    discovered && instances > 0
      ? `<span class="chord-count mono"><i class="chord-pip" style="--pip:var(--${hue})" role="img" aria-label="active"></i>×${instances}</span>`
      : "";
  const name = discovered
    ? `<span class="chord-row-name">${def.name}</span>`
    : `<span class="chord-row-name" aria-label="undiscovered">·····</span>`;
  return `<button class="chord-row${discovered ? "" : " locked"}" type="button" data-chord="${def.name}" aria-current="${selected}">
    ${chordGlyphSvg(def, discovered, { labels: false, sw: 1.7 })}${name}${count}
  </button>`;
}

// The stage: the selected class, giant — glyph, name in condensed
// lettering, the bonus figure beside the name's read, the board's active
// read, and the roots history as the inline tooltip figure. Undiscovered,
// the stage keeps the silhouette, the dotted leader, and one short
// invitation; no name, bonus, or roots ride it.
export function libraryStageHtml(def: NamedChordDef, record: ChordDiscovery | undefined, activeTotal: number, ringing: readonly RingingClass[]): string {
  const discovered = record?.formed === true;
  const glyph = `<div class="glyph-big">${chordGlyphSvg(def, discovered)}</div>`;
  const active = tipFigure(
    "chord-tip-active",
    "The active read",
    `${activeTotal} active`,
    activeTipText(ringing),
  );
  if (!discovered) {
    return `<div class="chord-stage">
      ${glyph}
      <h3 class="chord-stage-name" aria-label="undiscovered class">·····</h3>
      ${active}
      <p class="chord-stage-hint">Form this pitch set on the board to name it.</p>
    </div>`;
  }
  const heard = Math.min(12, record?.rootsHeard ?? 0);
  const bonus = tipFigure(
    `chord-tip-bonus-${def.name}`,
    `${def.name} bonus`,
    `×${formatNumber(1 + def.bonus)}`,
    bonusTipText(def),
  );
  const roots = tipFigure(
    `chord-tip-roots-${def.name}`,
    `${def.name} roots heard`,
    `${heard}/12 roots`,
    rootsTipText(heard),
  );
  return `<div class="chord-stage">
    ${glyph}
    <h3 class="chord-stage-name">${def.name}</h3>
    <div class="chord-stage-read">${bonus}${active}${roots}</div>
  </div>`;
}
