import type { GameState } from "./types";

// Focus apps (ADR-0012): unlock-only, fixed-function console instruments.
// Activation is permanent and player-wide; the board may read app state as
// effect inputs, but apps never touch nous or charge (§2.3's boundary rule).

export type FocusApp = "habit" | "time" | "notes" | "goals";

// Tile order on the console: the free app leads; the rung purchases close
// the rack (spec §2.3's launch inventory).
export const FOCUS_APPS: readonly FocusApp[] = ["habit", "time", "notes", "goals"];

// Habit is free and always on; Time auto-activates after the first session;
// Notes and Goals are rung purchases on the activation ladder (issue #42
// adds the purchase that flips them — until then they stay locked).
export function appActive(state: GameState, app: FocusApp): boolean {
  switch (app) {
    case "habit":
      return true;
    case "time":
      return state.sessionsCompleted > 0;
    case "notes":
    case "goals":
      return false;
  }
}

// The one-line gate each locked tile names ("after your first session",
// "activate with nous"); active apps carry no note. Habit's entry is dead
// data — it is always active.
const LOCK_NOTES: Record<FocusApp, string> = {
  habit: "",
  time: "after your first session",
  notes: "activate with nous",
  goals: "activate with nous",
};

export function appLockNote(state: GameState, app: FocusApp): string | null {
  return appActive(state, app) ? null : LOCK_NOTES[app];
}
