import { syncAchievements } from "./achievements";
import { creditNoteEarning } from "./reserves";
import type { GameState } from "./types";

// Notes (issue #4), now a pure fixed-function instrument (ADR-0012): notes
// are notes. Capture works between sessions as well as during flow
// (ADR-0018) — the old charge burst is retired with the session-reward
// coupling. A note carries `atElapsed: -1` when written outside flow; flow
// notes carry their session clock, which is what Marginalia counts. A note
// written while a session runs also carries that session's selected habit
// as its habit-keyed tag (§9) — tagged once at capture, never retagged;
// unstructured and upgrade-mode notes go untagged.

// Elapsed marker for notes captured outside any session.
export const NOTE_BETWEEN_SESSIONS = -1;

// The one place that decodes the marker: a note is in-flow when it carries
// a session clock. Marginalia and the note ladder count only these.
export function isInFlowNote(note: { atElapsed: number }): boolean {
  return note.atElapsed !== NOTE_BETWEEN_SESSIONS;
}

export function writeNote(state: GameState, text: string, now: number = 0): { ok: boolean; reason?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "Write something first." };
  const stored = trimmed.slice(0, 2000);
  const live = state.session !== null;
  state.notes.push({
    id: `n${state.nextId++}`,
    sessionId: state.sessionIndex,
    atElapsed: live ? state.session!.elapsed : NOTE_BETWEEN_SESSIONS,
    text: stored,
    // The habit-keyed tag (§9): the active habit while a session runs —
    // flow or paused, same session — null when unstructured or between
    // sessions.
    habitId: live ? state.activeHabitId : null,
    at: now,
  });
  // The written-note fact's credit (ADR-0047, generalized by issue #371):
  // the note banks the moment it is written — in flow or between sessions,
  // tagged or not — crediting every owned generator at its own profile:
  // character earning per stored character under the per-note cap, plus
  // the creation bonus once for a note meeting the creation minimum.
  // Notes are append-only, so there is no refund path and no edit or
  // re-save that could re-award the creation bonus; a future delete never
  // refunds.
  creditNoteEarning(state, stored);
  // The boundary check (ADR-0015): Marginalia and the note ladder unlock
  // here; a live session queues them into its summary row.
  syncAchievements(state);
  return { ok: true };
}
