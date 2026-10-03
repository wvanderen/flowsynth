// The module face (ADR-0016, issue #39): every module renders as a Readout
// panel in the Rack identity — a shared chassis, a narrow category rail in
// the category hue, a condensed technical-caps nameplate, the module's
// signature glyph as the centered centerpiece, and the contribution readout
// beneath it. Rarity is engraved ring count plus a subtle plate tint (styled
// from data-rarity in the stylesheet) — never hue, never glow. Shared by the
// board and the Forge candidate tiles. The inventory wears the minimal mark
// instead (hue-outlined hexagon and glyph alone, ADR-0027): at tile size the
// engraving is noise.
import type { Hex, ModuleType, Rarity } from "../engine/types";
import { moduleIcon } from "./icons";
import { META } from "./meta";

export const HEX_RADIUS = 61;

// The board lattice's projection (§7): pointy-top, spacing 65 — the one
// projection every board-surface renderer shares (the grid's cells, the
// chord seams, and the Mutator Grid's second layer alike).
export const SPACING = 65;

export function boardPoint({ q, r }: Hex): [number, number] {
  return [Math.sqrt(3) * SPACING * (q + r / 2), SPACING * 1.5 * r];
}

// The face's pointy-top corner offsets, shared with every renderer that must
// wrap or touch a hex's corners (the chord view's hulls, for one).
export function hexCorner(radius: number, i: number): [number, number] {
  const a = ((60 * i - 30) * Math.PI) / 180;
  return [radius * Math.cos(a), radius * Math.sin(a)];
}

export function hexPoints(radius: number): string {
  return Array.from({ length: 6 }, (_, i) => hexCorner(radius, i).map((v) => v.toFixed(4)).join(",")).join(" ");
}

// The flat-to-flat apothem — half the distance between two neighboring
// centers' facing edges. Renderers that must bridge or trim to a chassis
// (charge leads, chord links) derive their pads from this one place.
export function hexApothem(radius: number): number {
  return (radius * Math.sqrt(3)) / 2;
}

// Hue = category: the rail and signature wear the category hue; per-type
// identity rides the glyph and nameplate. The spacer wears its own muted
// wire hue — its own module category (ADR-0021), never a synthesizer.
export const HUE_TOKEN_OF: Record<ModuleType, string> = {
  additive: "hue-synthesizer",
  conditional: "hue-synthesizer",
  spacer: "hue-spacer",
  focusKeyed: "hue-generator",
  infusor: "hue-infusor",
  forge: "hue-forge",
  mutatorForge: "hue-forge",
};

// Rarity = finish: engraved ring count, one to three.
const RING_RADII = [55, 50, 45];
export const RING_COUNT: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3 };

// The charged face sits in the charge register, scaled by the glow. The
// stylesheet paints the colors; the received strength only sets how much:
// the chassis fill rises from a floor that keeps a just-charged receiver
// visible, and the rail — which the stylesheet swaps to the charge token
// for charged receivers (ADR-0016) — brightens toward full luminous
// strength.
export const CHARGED_FILL_MIN = 0.08;
export const CHARGED_FILL_SPAN = 0.34;
export const RAIL_CHARGED_FLOOR = 0.6;
export const RAIL_CHARGED_SPAN = 0.4;

// The face's vertical rhythm (ADR-0016): the engraved level and nameplate sit
// above, the signature glyph holds the center at its scale, and the readout
// and note sit beneath, all horizontally centered. The doc's glyph-authoring
// notes in docs/modules.md point at FACE_GLYPH_SCALE.
export const FACE_GLYPH_SCALE = 0.8;
const FACE_LEVEL_Y = -31;
const FACE_NAME_Y = -18;
const FACE_READOUT_Y = 30;
const FACE_NOTE_Y = 43;

export interface FaceSpec {
  type: ModuleType;
  rarity: Rarity;
  // The prominent readout beneath the signature: the module's contribution —
  // for the chargeable Forge, charge-vs-threshold.
  readout: string;
  // Extra class on the readout (e.g. the charge register on the Forge).
  readoutClass?: string;
  // Small line under the readout (a synthesizer's note name).
  note?: string;
  // Engraved level, top center. Explicitly undefined (the spacer's — its
  // level buys nothing, #193) leaves the engraving off.
  level?: number | undefined;
  // Interaction classes for the chassis polygon (selected, charged, ...).
  hexClass?: string;
  // Received-charge light (§8, #41): a 0..1 glow (chargeGlow) that scales
  // the charged chassis fill and the rail's stroke-opacity toward the
  // luminous charge register with the strength the module receives.
  // Absent or zero leaves the plate finish and the category hue.
  chargeGlow?: number;
  // Markup drawn directly on the chassis, under the engraving (the Forge's
  // threshold fill).
  under?: string;
  // The expanded face's layout (§5): the same vocabulary — chassis, rings,
  // rail, level, name, signature, readout, note — re-proportioned for the
  // bloom hexagon. The engraving recenters over the full-width band and the
  // cell note drops to the lower taper as a footnote, making room for the
  // Upgrade button between readout and taper.
  variant?: "bloom";
  // The spacer's open-wire board face (#201, ring window per issue #219):
  // the plate keeps only its cap (the nameplate, centered) and base (the
  // cell note) — a hexagonal ring window framed inside the module lets the
  // chord lines run visibly through. The glyph, readout, level line,
  // rarity rings, and category rail all go quiet; the chassis wears the
  // shared `spacer-window` clip (render.ts owns the def) and a hairline
  // traces the inner edge. Board faces only — the expanded face and the
  // candidate tiles keep the full readout panel.
  openWire?: boolean;
}

// Engraving positions per variant (y in face units; the chassis spans
// ±61). The compact face is the board's own; the bloom re-centers its
// content over the hexagon's full-width band with an even vertical rhythm
// — title block, signature, production line, button band, and the cell
// note footnoted into the taper — each step a similar breath apart. The
// note sits deep in the taper (issue #195): the dial widens the button
// band, so the footnote yields the room.
const FACE_LAYOUT = {
  compact: { level: FACE_LEVEL_Y, name: FACE_NAME_Y, glyph: 0, glyphScale: FACE_GLYPH_SCALE, readout: FACE_READOUT_Y, note: FACE_NOTE_Y },
  // The bloom re-proportions (issue #219, validated in the prototype): the
  // glyph opens to −12 and the readout to 16 — the tighter −7/11 pair
  // overlaps at bloom scale. The note yields a little deeper into the
  // taper (the #195 principle): the #195 button band follows the readout
  // down, and the footnote keeps its clearance beneath it.
  bloom: { level: -39, name: -26, glyph: -12, glyphScale: 0.7, readout: 16, note: 55 },
} as const;

// The open-wire window's furniture (issue #219): the plate clips as a
// hexagonal ring window — the chassis minus an inner hexagon — so the
// module reads as a ring the chords run through, and the nameplate rides
// the top band inside the chassis. The hairline traces the inner edge.
const SPACER_NAME_Y = -40;
export const SPACER_WINDOW_RADIUS = 36;
// One hexagon subpath as a clip-path segment.
const hexSubpath = (radius: number): string => `M ${hexPoints(radius).split(" ").join(" L ")} Z`;
export function spacerClipPath(): string {
  // Even-odd: the inner hexagon cuts the chassis into a ring.
  return `${hexSubpath(HEX_RADIUS)} ${hexSubpath(SPACER_WINDOW_RADIUS)}`;
}

// The long-readout fit (#201, the approved compression): past seven
// characters the face readout steps down to 14px, past nine to 12px. The
// stylesheet owns the sizes; the count only picks the class.
export function readoutFitClass(readout: string): string {
  if (readout.length > 9) return " face-readout-xs";
  if (readout.length > 7) return " face-readout-sm";
  return "";
}

export function moduleFace(spec: FaceSpec): string {
  const hue = `var(--${HUE_TOKEN_OF[spec.type]})`;
  const openWire = spec.openWire === true;
  const rings = Array.from({ length: RING_COUNT[spec.rarity] }, (_, i) => `<polygon points="${hexPoints(RING_RADII[i]!)}"/>`).join("");
  // The charge light (§8, #41): the chassis fill takes the charge hue at an
  // inline fill-opacity, and the rail takes an inline stroke-opacity — both
  // scaling continuously with the glow the module's received strength maps
  // onto. Absent or zero glow leaves the plate finish and the category hue.
  const glow = spec.chargeGlow ?? 0;
  const hexStyle = glow > 0 ? ` style="fill-opacity:${(CHARGED_FILL_MIN + CHARGED_FILL_SPAN * glow).toFixed(3)}"` : "";
  const railStyle = glow > 0 ? ` style="stroke-opacity:${(RAIL_CHARGED_FLOOR + RAIL_CHARGED_SPAN * glow).toFixed(3)}"` : "";
  const layout = FACE_LAYOUT[spec.variant ?? "compact"];
  return `<polygon data-key="hex" class="hex${spec.hexClass ? ` ${spec.hexClass}` : ""}" points="${hexPoints(HEX_RADIUS)}"${openWire ? ' clip-path="url(#spacer-window)"' : ""}${hexStyle}/>${spec.under ?? ""}
    ${openWire ? "" : `<g data-key="rings" class="face-rings">${rings}</g>`}
    ${openWire ? "" : `<path data-key="rail" class="face-rail" d="M-39 -19V19" stroke="${hue}"${railStyle}/>`}
    ${!openWire && spec.level !== undefined ? `<text data-key="level" y="${layout.level}" text-anchor="middle" class="face-level">LV ${spec.level}</text>` : ""}
    <text data-key="name" y="${openWire ? SPACER_NAME_Y : layout.name}" text-anchor="middle" class="face-name">${META[spec.type].short.toUpperCase()}</text>
    ${openWire ? "" : `<g data-key="signature" class="face-signature" transform="translate(0 ${layout.glyph}) scale(${layout.glyphScale})" fill="none" stroke="${hue}" stroke-width="2">${moduleIcon(spec.type)}</g>`}
    ${openWire ? "" : `<text data-key="readout" x="0" y="${layout.readout}" text-anchor="middle" class="face-readout${readoutFitClass(spec.readout)}${spec.readoutClass ? ` ${spec.readoutClass}` : ""}">${spec.readout}</text>`}
    ${spec.note ? `<text data-key="note" x="0" y="${layout.note}" text-anchor="middle" class="face-note">${spec.note}</text>` : ""}
    ${openWire ? `<polygon data-key="spacer-frame" class="spacer-frame" points="${hexPoints(SPACER_WINDOW_RADIUS)}"/>` : ""}`;
}
