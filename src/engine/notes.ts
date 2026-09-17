import { syncAchievements } from "./achievements";
import type { GameState } from "./types";

// Notes (issue #4), now a pure fixed-function instrument (ADR-0012): notes
// are notes. Capture works between sessions as well as during flow
// (ADR-0018) — the old charge burst is retired with the session-reward
// coupling. A note carries `atElapsed: -1` when written outside flow; flow
// notes carry their session clock, which is what Marginalia counts.

// Elapsed marker for notes captured outside any session.
export const NOTE_BETWEEN_SESSIONS = -1;

// The one place that decodes the marker: a note is in-flow when it carries
// a session clock. Marginalia and the note ladder count only these.
export function isInFlowNote(note: { atElapsed: number }): boolean {
  return note.atElapsed !== NOTE_BETWEEN_SESSIONS;
}

export function writeNote(state: GameState, text: string): { ok: boolean; reason?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "Write something first." };
  const live = state.session !== null;
  state.notes.push({
    id: `n${state.nextId++}`,
    sessionId: state.sessionIndex,
    atElapsed: live ? state.session!.elapsed : NOTE_BETWEEN_SESSIONS,
    text: trimmed.slice(0, 2000),
  });
  // The boundary check (ADR-0015): Marginalia and the note ladder unlock
  // here; a live session queues them into its summary row.
  syncAchievements(state);
  return { ok: true };
}

export function sessionNoteCount(state: GameState): number {
  return state.notes.filter((n) => n.sessionId === state.sessionIndex).length;
}
