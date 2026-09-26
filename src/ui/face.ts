// The module face (ADR-0016, issue #39): every module renders as a Readout
// panel in the Rack identity — a shared chassis, a narrow category rail in
// the category hue, a condensed technical-caps nameplate, the module's
// signature glyph as the centered centerpiece, and the contribution readout
// beneath it. Rarity is engraved ring count plus a subtle plate tint (styled
// from data-rarity in the stylesheet) — never hue, never glow. Shared by the
// board, the inventory tiles, the drag ghost, and the Forge candidate
// tiles, so a module reads identically everywhere it appears.
import type { ModuleType, Rarity } from "../engine/types";
import { moduleIcon } from "./icons";
import { META } from "./meta";

export const HEX_RADIUS = 61;

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
  // Engraved level, top center.
  level?: number;
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
}

// Engraving positions per variant (y in face units; the chassis spans
// ±61). The compact face is the board's own; the bloom re-centers its
// content over the hexagon's full-width band — level clear of the top
// vertex, the signature holding the middle, the readout above the button
// band, and the note footnoted into the taper.
const FACE_LAYOUT = {
  compact: { level: FACE_LEVEL_Y, name: FACE_NAME_Y, glyph: 0, glyphScale: FACE_GLYPH_SCALE, readout: FACE_READOUT_Y, note: FACE_NOTE_Y },
  bloom: { level: -39, name: -27, glyph: -6, glyphScale: 0.7, readout: 18, note: 46 },
} as const;

export function moduleFace(spec: FaceSpec): string {
  const hue = `var(--${HUE_TOKEN_OF[spec.type]})`;
  const rings = Array.from({ length: RING_COUNT[spec.rarity] }, (_, i) => `<polygon points="${hexPoints(RING_RADII[i]!)}"/>`).join("");
  // The charge light (§8, #41): the chassis fill takes the charge hue at an
  // inline fill-opacity, and the rail takes an inline stroke-opacity — both
  // scaling continuously with the glow the module's received strength maps
  // onto. Absent or zero glow leaves the plate finish and the category hue.
  const glow = spec.chargeGlow ?? 0;
  const hexStyle = glow > 0 ? ` style="fill-opacity:${(CHARGED_FILL_MIN + CHARGED_FILL_SPAN * glow).toFixed(3)}"` : "";
  const railStyle = glow > 0 ? ` style="stroke-opacity:${(RAIL_CHARGED_FLOOR + RAIL_CHARGED_SPAN * glow).toFixed(3)}"` : "";
  const layout = FACE_LAYOUT[spec.variant ?? "compact"];
  return `<polygon data-key="hex" class="hex${spec.hexClass ? ` ${spec.hexClass}` : ""}" points="${hexPoints(HEX_RADIUS)}"${hexStyle}/>${spec.under ?? ""}
    <g data-key="rings" class="face-rings">${rings}</g>
    <path data-key="rail" class="face-rail" d="M-39 -19V19" stroke="${hue}"${railStyle}/>
    ${spec.level !== undefined ? `<text data-key="level" y="${layout.level}" text-anchor="middle" class="face-level">LV ${spec.level}</text>` : ""}
    <text data-key="name" y="${layout.name}" text-anchor="middle" class="face-name">${META[spec.type].short.toUpperCase()}</text>
    <g data-key="signature" class="face-signature" transform="translate(0 ${layout.glyph}) scale(${layout.glyphScale})" fill="none" stroke="${hue}" stroke-width="2">${moduleIcon(spec.type)}</g>
    <text data-key="readout" x="0" y="${layout.readout}" text-anchor="middle" class="face-readout${spec.readoutClass ? ` ${spec.readoutClass}` : ""}">${spec.readout}</text>
    ${spec.note ? `<text data-key="note" x="0" y="${layout.note}" text-anchor="middle" class="face-note">${spec.note}</text>` : ""}`;
}
