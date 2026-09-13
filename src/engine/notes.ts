import { pushBurst } from "./advance";
import { BALANCE, EPS } from "./constants";
import { deployedTime, isActive } from "./economy";
import type { GameState, ModuleInstance } from "./types";

// Notes (issue #4). ADR-0001: the Notes benefit is a charge burst banked at
// session end for the next session, bounded by charge per qualifying minute
// rather than a per-session ceiling. A session qualifies once at least one
// note was written during it — when the first note was written never matters,
// so there is nothing to time and no reward per entry.

export function notesModule(state: GameState): ModuleInstance | undefined {
  return state.modules.find((m) => m.type === "notes" && m.pos !== null);
}

export function notesActive(state: GameState): boolean {
  return state.notesActive && notesModule(state) !== undefined;
}

export function canWriteNotes(state: GameState): boolean {
  return state.mode !== "upgrade" && notesActive(state);
}

export function writeNote(state: GameState, text: string): { ok: boolean; reason?: string } {
  const trimmed = text.trim();
  if (!canWriteNotes(state)) {
    return { ok: false, reason: state.mode === "upgrade" ? "Notes capture happens during flow." : "The Notes module is not active yet." };
  }
  if (!trimmed) return { ok: false, reason: "Write something first." };
  if (state.session === null) return { ok: false, reason: "No session is running." };
  state.notes.push({
    id: `n${state.nextId++}`,
    sessionId: state.sessionIndex,
    atElapsed: state.session.elapsed,
    text: trimmed.slice(0, 2000),
  });
  return { ok: true };
}

export function sessionNoteCount(state: GameState): number {
  return state.notes.filter((n) => n.sessionId === state.sessionIndex).length;
}

// Projected burst if the session ended now: full practice time of this
// session counts once a note exists (timing of the note is irrelevant).
export function projectedNotesBurst(state: GameState): number {
  if (!notesActive(state) || state.session === null) return 0;
  if (sessionNoteCount(state) === 0) return 0;
  const minutes = state.session.elapsed / 60;
  const notes = notesModule(state)!;
  const perMinute = BALANCE.notesChargePerMinute * notesPower(notes);
  return minutes * perMinute;
}

export function notesPower(module: ModuleInstance): number {
  return BALANCE.rarityPower[module.rarity] ** module.level;
}

// Called from endSession, after the session is closed: the burst is banked
// for the NEXT session and never acts inside the one that earned it.
export function bankNotesBurst(state: GameState, sessionId: number, elapsedSeconds: number): number {
  if (!state.notesActive) return 0;
  const hasNote = state.notes.some((n) => n.sessionId === sessionId);
  if (!hasNote || elapsedSeconds <= EPS) return 0;
  const time = deployedTime(state);
  const notes = notesModule(state);
  if (!time || !notes || !isActive(state, notes)) return 0;
  const seconds = (elapsedSeconds / 60) * BALANCE.notesChargePerMinute * notesPower(notes);
  pushBurst(time, { strength: 1, seconds });
  return seconds;
}
