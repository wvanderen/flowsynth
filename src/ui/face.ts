// The module face (ADR-0016, issue #39): every module renders as a Readout
// panel in the Rack identity — a shared chassis, a narrow category rail in
// the category hue, a condensed technical-caps nameplate, a prominent
// contribution readout, and a smaller geometric signature. Rarity is
// engraved ring count plus a subtle plate tint (styled from data-rarity in
// the stylesheet) — never hue, never glow. The Carrier wears white, the sole
// hue-law exception. Shared by the board, the inventory tiles, the drag
// ghost, and the Forge candidate tiles, so a module reads identically
// everywhere it appears.
import { CATEGORY_OF } from "../engine/constants";
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
  generator: "hue-generator",
  focusKeyed: "hue-generator",
  infusor: "hue-infusor",
  forge: "hue-forge",
};

// Rarity = finish: engraved ring count, one to three.
const RING_RADII = [55, 50, 45];
export const RING_COUNT: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 3 };

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
    ? `<title>The Carrier — granted at the origin. Pinned: it never moves and never leaves the board.</title><g data-key="pin" class="module-pin" transform="translate(36,-33)"><circle cx="0" cy="-3.4" r="3.1"/><path d="M0-.4v7.4"/></g>`
    : "";
  return `${pin}
    <polygon data-key="hex" class="hex${spec.hexClass ? ` ${spec.hexClass}` : ""}" points="${hexPoints(HEX_RADIUS)}"/>${spec.under ?? ""}
    <g data-key="rings" class="face-rings">${rings}</g>
    <path data-key="rail" class="face-rail" d="M-39 -19V19" stroke="${hue}"/>
    ${spec.level !== undefined ? `<text data-key="level" y="-40" text-anchor="middle" class="face-level">LV ${spec.level}</text>` : ""}
    <text data-key="name" y="-27" text-anchor="middle" class="face-name">${META[spec.type].short.toUpperCase()}</text>
    <text data-key="readout" y="9" text-anchor="middle" class="face-readout${spec.readoutClass ? ` ${spec.readoutClass}` : ""}">${spec.readout}</text>
    ${spec.note ? `<text data-key="note" y="23" text-anchor="middle" class="face-note">${spec.note}</text>` : ""}
    <text data-key="category" x="-21" y="41" text-anchor="middle" class="face-category">${CATEGORY_OF[spec.type].toUpperCase()}</text>
    <g data-key="signature" class="face-signature" transform="translate(25 29) scale(0.62)" fill="none" stroke="${hue}" stroke-width="2">${moduleIcon(spec.type)}</g>`;
}
