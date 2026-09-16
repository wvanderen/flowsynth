import { rungCost } from "./economy";
import type { FocusApp, GameState } from "./types";

export type { FocusApp };

// Focus apps (ADR-0012): unlock-only, fixed-function console instruments.
// Activation is permanent and player-wide; the board may read app state as
// effect inputs, but apps never touch nous or charge (§2.3's boundary rule).

// Tile order on the console: the free app leads; the rung purchases close
// the rack (spec §2.3's launch inventory).
export const FOCUS_APPS: readonly FocusApp[] = ["habit", "time", "notes", "goals"];

// The activation ladder (ADR-0013) sells these two, in either order — the
// rung price is shared and counted globally, never per app.
export const LADDER_APPS: readonly FocusApp[] = ["notes", "goals"];

// Habit is free and always on; Time auto-activates after the first session;
// Notes and Goals are rung purchases on the activation ladder (issue #42).
export function appActive(state: GameState, app: FocusApp): boolean {
  switch (app) {
    case "habit":
      return true;
    case "time":
      return state.sessionsCompleted > 0;
    case "notes":
    case "goals":
      return state.activatedApps.includes(app);
  }
}

// The next rung's number: one past every rung already bought, whichever
// apps they opened.
export function nextRung(state: GameState): number {
  return state.activatedApps.length + 1;
}

// The price of the next rung, for the telegraph and purchase surfaces.
export function nextRungCost(state: GameState): number {
  return rungCost(nextRung(state));
}

// Every ladder app has been activated; the ladder stands complete until a
// new app joins it (Tasks is the designed future member, ADR-0012).
export function ladderComplete(state: GameState): boolean {
  return LADDER_APPS.every((app) => state.activatedApps.includes(app));
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
