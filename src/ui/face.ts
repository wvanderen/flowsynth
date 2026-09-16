// The module face (ADR-0016, issue #39): every module renders as a Readout
// panel in the Rack identity — a shared chassis, a narrow category rail in
// the category hue, a condensed technical-caps nameplate, a prominent
// contribution readout, and a smaller geometric signature. Rarity is
// engraved ring count plus a subtle plate tint (styled from data-rarity in
// the stylesheet) — never hue, never glow. The Carrier wears white, the sole
// hue-law exception. Shared by the board, the inventory tiles, the drag
// ghost, and the Forge candidate tiles, so a module reads identically
// everywhere it appears.
import type { ModuleType, Rarity } from "../engine/types";
import { moduleIcon } from "./icons";
import { META } from "./meta";

export const HEX_RADIUS = 61;

export function hexPoints(radius: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return `${radius * Math.cos(a)},${radius * Math.sin(a)}`;
  }).join(" ");
}

// Hue = category: the rail and signature wear the category hue; per-type
// identity rides the glyph and nameplate. The Carrier maps to its white —
// the sole exception to the category→hue law.
export const HUE_TOKEN_OF: Record<ModuleType, string> = {
  carrier: "hue-carrier",
  additive: "hue-synthesizer",
  conditional: "hue-synthesizer",
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

export interface FaceSpec {
  type: ModuleType;
  rarity: Rarity;
  // The prominent readout: the module's contribution — for the chargeable
  // Forge, charge-vs-threshold.
  readout: string;
  // Extra class on the readout (e.g. the charge register on the Forge).
  readoutClass?: string;
  // Small line under the readout (a synthesizer's pitch).
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
  // The Carrier's pin: granted at the origin, immovable and unsellable.
  pinned?: boolean;
}

export function moduleFace(spec: FaceSpec): string {
  const hue = `var(--${HUE_TOKEN_OF[spec.type]})`;
  const rings = Array.from({ length: RING_COUNT[spec.rarity] }, (_, i) => `<polygon points="${hexPoints(RING_RADII[i]!)}"/>`).join("");
  const pin = spec.pinned
    ? `<title>The Carrier — granted at the origin. Pinned: it never moves and never leaves the board.</title><g data-key="pin" class="module-pin" transform="translate(35,-26)"><circle cx="0" cy="-3.4" r="3.1"/><path d="M0-.4v7.4"/></g>`
    : "";
  // The charge light (§8, #41): the chassis fill takes the charge hue at an
  // inline fill-opacity, and the rail takes an inline stroke-opacity — both
  // scaling continuously with the glow the module's received strength maps
  // onto. Absent or zero glow leaves the plate finish and the category hue.
  const glow = spec.chargeGlow ?? 0;
  const hexStyle = glow > 0 ? ` style="fill-opacity:${(CHARGED_FILL_MIN + CHARGED_FILL_SPAN * glow).toFixed(3)}"` : "";
  const railStyle = glow > 0 ? ` style="stroke-opacity:${(RAIL_CHARGED_FLOOR + RAIL_CHARGED_SPAN * glow).toFixed(3)}"` : "";
  return `${pin}
    <polygon data-key="hex" class="hex${spec.hexClass ? ` ${spec.hexClass}` : ""}" points="${hexPoints(HEX_RADIUS)}"${hexStyle}/>${spec.under ?? ""}
    <g data-key="rings" class="face-rings">${rings}</g>
    <path data-key="rail" class="face-rail" d="M-39 -19V19" stroke="${hue}"${railStyle}/>
    ${spec.level !== undefined ? `<text data-key="level" y="-40" text-anchor="middle" class="face-level">LV ${spec.level}</text>` : ""}
    <text data-key="name" y="-27" text-anchor="middle" class="face-name">${META[spec.type].short.toUpperCase()}</text>
    <text data-key="readout" x="7" y="5" text-anchor="middle" class="face-readout${spec.readoutClass ? ` ${spec.readoutClass}` : ""}">${spec.readout}</text>
    ${spec.note ? `<text data-key="note" x="7" y="19" text-anchor="middle" class="face-note">${spec.note}</text>` : ""}
    <g data-key="signature" class="face-signature" transform="translate(0 36.5) scale(0.62)" fill="none" stroke="${hue}" stroke-width="2">${moduleIcon(spec.type)}</g>`;
}
