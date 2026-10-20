// The mutator vocabulary (issues #199, #426): the Forge's candidate tiles
// and the family words are what remain of the Mutator Grid's surfaces —
// the board's second face is the World layer's now (src/ui/world.ts), and
// the mutator economy's own migration retires the rest. Every surface that
// still shows a mutator wears the --arete register and reads these
// builders, so the vocabulary cannot drift.
import { mutatorMagnitude } from "../engine/economy";
import type { MutatorFamily, MutatorInstance, Rarity } from "../engine/types";
import { rarityShape } from "./meta";
import { HEX_RADIUS, hexPoints } from "./face";

// The families' words, one spelling everywhere — the readout ask, the
// popover, the Forge modal, the toasts.
export const FAMILY_WORD: Record<MutatorFamily, string> = { power: "Power", resonance: "Resonance", charge: "Charge" };

// One effect phrasing per family, read off the engine's one magnitude
// rule (ADR-0043): never a ν/s figure, never a rate-details promise.
export function mutatorEffectText(family: MutatorFamily, rarity: Rarity): string {
  const pct = `+${Math.round(mutatorMagnitude(family, rarity) * 100)}%`;
  if (family === "power") return `${pct} to this module's power`;
  if (family === "resonance") return `${pct} to this module's chord factor`;
  return `${pct} to the strength this module receives`;
}

// The family glyph strokes, drawn centered on the origin like the module
// icons — the Forge candidates share them (issue #295).
const FAMILY_GLYPH: Record<MutatorFamily, string> = {
  power: '<path d="M-9 9 0-11 9 9"/><path d="M-4.5 9h9"/>',
  resonance: '<path d="M-11 0q5.5-10 11 0t11 0"/><circle r="1.7" cx="-11" cy="0"/><circle r="1.7" cx="11" cy="0"/>',
  charge: '<path d="M3.5-12-7.5 2.5H-1L-3.5 12 7.5-2.5H1Z"/>',
};

export function mutatorGlyph(family: MutatorFamily, scale = 1): string {
  return `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="scale(${scale})">${FAMILY_GLYPH[family]}</g>`;
}

// Shared shape-and-color rarity marks; merge rings belong only to modules.
export function rarityTicks(rarity: Rarity): string {
  return rarityShape(rarity);
}

// The minimal mark (ADR-0027's shape, in the arete register): an arete
// hexagon outline, the family glyph, the rarity ticks, the effect short —
// what you carry is what you drop. The Forge candidates read this builder.
export function mutatorTileInner(item: { family: MutatorFamily; rarity: Rarity }): string {
  const effectShort = `${{ power: "PWR", resonance: "RES", charge: "CHG" }[item.family]} ${mutatorEffectText(item.family, item.rarity).split(" ")[0]}`;
  return `<polygon class="mut-tile-hex" points="${hexPoints(HEX_RADIUS)}"/>
    <g class="mut-tile-glyph" transform="translate(0,-8)">${mutatorGlyph(item.family, 1.6)}</g>
    <g class="mut-tile-ticks" transform="translate(0,22)">${rarityTicks(item.rarity)}</g>
    <text class="mut-tile-effect mono" y="42" text-anchor="middle">${effectShort}</text>`;
}

export function mutatorTileSvg(item: MutatorInstance): string {
  return `<svg viewBox="-70 -70 140 140" aria-hidden="true" style="color: var(--arete)">${mutatorTileInner(item)}</svg>`;
}
