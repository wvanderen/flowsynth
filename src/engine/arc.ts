import { isSynthesizerType } from "./constants";
import type { GameState } from "./types";

// The opening learning arc (board-redesign spec §8, issue #138): a
// single-synth earned start with one pop-up hint. The board's opening
// lives in state.ts; this module carries the arc's one piece of learned
// state — the card that fires when the second synthesizer arrives.

// Every synthesizer the player has acquired, tray or board. The opening
// grants one; the arc's card keys off the second.
export function synthsAcquired(state: GameState): number {
  return state.modules.filter((m) => isSynthesizerType(m.type)).length;
}

// Whether the one pop-up is due: after the second acquisition, until its
// single dismissal. `arcCardSeen` is the ever — set once by the dismissal,
// it persists, so the card never fires again however the board grows.
export function arcCardDue(state: GameState): boolean {
  return !state.arcCardSeen && synthsAcquired(state) >= 2;
}
