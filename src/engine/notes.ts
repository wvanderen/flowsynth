import type { GameState } from "./types";

// Notes (issue #4), now a pure fixed-function instrument (ADR-0012): notes
// are notes. Capture happens during flow; the old charge burst is retired
// with the session-reward coupling.

export function canWriteNotes(state: GameState): boolean {
  return state.mode !== "upgrade";
}

export function writeNote(state: GameState, text: string): { ok: boolean; reason?: string } {
  const trimmed = text.trim();
  if (!canWriteNotes(state)) {
    return { ok: false, reason: "Notes capture happens during flow." };
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
