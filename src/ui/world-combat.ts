import { BALANCE } from "../engine/constants";
import { neighbors } from "../engine/hex";
import { cellNoteOf } from "../engine/lattice";
import { attackPowerOf, type WorldLift, type WorldPiece } from "../engine/world";
import { COMBAT_PROOF, proofGearBound } from "../engine/world-combat";
import type { GameState } from "../engine/types";
import { formatNumber } from "./format";
import { COLUMN_WORD, WORLD_META } from "./meta";

export function worldPieceName(piece: WorldPiece): string {
  switch (piece.kind) {
    case "weapon": return WORLD_META[piece.copy.type].name;
    case "column": return COLUMN_WORD;
    default: return COMBAT_PROOF[piece.kind].name;
  }
}

export const COMBAT_GLYPHS = {
  creature: '<path d="M-10 8V-2l5-6h10l5 6v10M-4 6h8M-5-1h1m8 0h1"/>',
  armor: '<path d="M-10-8h20v11L0 10-10 3Z M-5 0h10"/>',
  spell: '<path d="M-12 3h5l3-10 5 14 4-8h7"/>',
  conduit: '<path d="M-10 0H10M3-6l7 6-7 6"/>',
  shale: '<path d="M-11 5-4-8h10l5 13zM-5 5 0-3l5 8"/>',
  basalt: '<path d="M-9 8V-4l5-5 4 5 4-5 5 5V8ZM-4-1v9m8-9v9"/>',
};

export function proofWallFor(key: string) {
  return COMBAT_PROOF.walls.find((wall) => wall.key === key);
}

export function proofPieceRead(state: GameState, piece: WorldPiece, lift?: WorldLift): { read: string; stateWord: string; tip: string } {
  const { creature, armor, spell, bladeCadence } = COMBAT_PROOF;
  const bound = piece.copy.pos ? proofGearBound(state.world.proof!, piece.copy.pos) : false;
  const gear = bound ? "Bound" : "Unbound";
  switch (piece.kind) {
    case "creature": {
      const stateWord = piece.copy.pos ? "Deployed" : piece.copy.recovering ? "Recovering" : "Ready";
      const read = `${Math.floor(piece.copy.hp)}/${creature.hp} HP`;
      return { read, stateWord, tip: piece.copy.recovering ? "Requires full HP to deploy" : `Hits adjacent walls · ${creature.damage} HP / ${creature.cadence} s` };
    }
    case "armor":
      return { read: `−${Math.round((1 - armor.remainingDamage) * 100)}% damage`, stateWord: gear, tip: "Guards an adjacent creature" };
    case "spell":
      return { read: `⌁${Math.floor(piece.copy.store)}/${spell.threshold}`, stateWord: bound && !(lift?.bySpell.get(piece.copy.id)) ? "Unfed" : gear, tip: `Bursts for ${spell.damage} HP when bound and charged` };
    case "weapon":
      return { read: `⌁${Math.floor(piece.copy.store)}/${BALANCE.world.storageCap}`, stateWord: bound && !(lift?.byWeapon.get(piece.copy.id)) ? "Unfed" : gear, tip: `Charged hit · ${attackPowerOf(state, piece.copy.type)} HP / ${bladeCadence} s when bound` };
    case "column":
      return { read: `⌁${formatNumber(lift?.byColumn.get(piece.copy.id) ?? 0)}/s`, stateWord: "Lift", tip: "Copies the module cell’s received charge" };
    case "conduit": {
      const outlet = piece.copy.pos ? neighbors(piece.copy.pos)[piece.copy.direction]! : null;
      return { read: outlet ? `→ ${cellNoteOf(outlet)}` : "", stateWord: "", tip: "Forwards charge along its selected edge" };
    }
  }
}

export function conduitEdgesHtml(piece: Extract<WorldPiece, { kind: "conduit" }>): string {
  return `<div class="hex-shift world-outlet" role="group" aria-label="Conduit outlet"><span>Outlet</span>${neighbors(piece.copy.pos!).map((pos, edge) =>
    `<button class="hex-shift-chip" data-world-edge="${edge}" aria-pressed="${piece.copy.direction === edge}" aria-label="Route to ${cellNoteOf(pos)} at ${pos.q}, ${pos.r}">${cellNoteOf(pos)}</button>`,
  ).join("")}</div>`;
}
