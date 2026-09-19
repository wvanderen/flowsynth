import type { GameState, NoteEntry, SessionRecord } from "./types";

// Session records (focus-tool spec §9). The records themselves are written
// once at close (actions.endSession) and never pruned; this module holds
// what reads them. Nothing here is stored: the target hit, the miss marker,
// and the honesty summary are derived, so they can never drift from the
// events they summarize. Habit ids resolve at render — renames and
// archiving never rewrite history.

// The derived target hit (§9): a planned session whose credited practice
// time reached its plan. Presence-earned hits count even when a later
// honesty event read missed.
export function recordTargetHit(record: SessionRecord): boolean {
  return record.plannedTarget !== null && record.creditedSeconds >= record.plannedTarget;
}

// The derived miss marker (§9): the record carries a reconciliation that
// settled as didn't-practice. Muted grey wherever rendered — accounting,
// not judgment.
export function recordMissed(record: SessionRecord): boolean {
  return record.honestyEvents.some((event) => event.outcome === "missed");
}

// The habit name behind a record or note, resolved at render: renames show
// forward through history, and an archived habit's name keeps resolving.
export function habitRecordName(state: GameState, habitId: string): string {
  return state.habits.find((habit) => habit.id === habitId)?.name ?? "a removed habit";
}

// The per-habit aggregates (§9), read off the practice log — live sessions
// and manual logs together. Lifetime and last-practiced count both kinds;
// "sessions practiced" counts live entries only, since a manual log is by
// definition practice outside a running session — practice, but not a
// session.
export function habitPracticeSummary(state: GameState, habitId: string): { sessions: number; lastPracticed: number | null } {
  let sessions = 0;
  let lastPracticed: number | null = null;
  for (const entry of state.practiceLog) {
    if (entry.habitId !== habitId) continue;
    if (entry.source === "live") sessions++;
    if (lastPracticed === null || entry.at > lastPracticed) lastPracticed = entry.at;
  }
  return { sessions, lastPracticed };
}

// The habit's tagged notes (§9), newest first — the stream order reversed.
export function habitTaggedNotes(state: GameState, habitId: string): NoteEntry[] {
  return state.notes.filter((note) => note.habitId === habitId).reverse();
}

// The history list's order (§9): newest first.
export function sessionRecordsNewestFirst(state: GameState): SessionRecord[] {
  return [...state.sessionRecords].reverse();
}
