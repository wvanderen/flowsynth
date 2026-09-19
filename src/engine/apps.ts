import { rungCost } from "./economy";
import type { FocusApp, GameState } from "./types";

export type { FocusApp };

// Focus apps (ADR-0012): unlock-only, fixed-function console instruments.
// Activation is permanent and player-wide; the board may read app state as
// effect inputs, but apps never touch nous or charge (§2.3's boundary rule).

// Tile order on the console: the free app leads the rack (spec §2.3's
// launch inventory).
export const FOCUS_APPS: readonly FocusApp[] = ["habit", "time", "notes", "goals"];

// The activation ladder rests empty at launch (ADR-0019): with Notes and
// Goals free, it has no launch tenant. Its shared, scaling, free-order
// shape stands; the ladder gains its members — Tasks first (ADR-0012) —
// and its pricing, with that tenant's effort.
export const LADDER_APPS: readonly FocusApp[] = [];

// All four launch apps are free from the very first session (ADR-0019,
// issue #83): Time's after-first-session milestone is struck and the rungs
// are gone. A future ladder tenant will consult the permanent
// `activatedApps` record here.
export function appActive(state: GameState, app: FocusApp): boolean {
  return FOCUS_APPS.includes(app) || state.activatedApps.includes(app);
}

// The next rung's number: one past every rung already bought, whichever
// apps they opened. The shape stays for the ladder's first tenant; at
// launch nothing is ever sold, so the number never moves.
export function nextRung(state: GameState): number {
  return state.activatedApps.length + 1;
}

// The price of the next rung, for the telegraph and purchase surfaces.
export function nextRungCost(state: GameState): number {
  return rungCost(nextRung(state));
}

// Every ladder app has been activated; with the ladder resting empty this
// holds vacuously until a tenant joins (Tasks is the designed first member,
// ADR-0012).
export function ladderComplete(state: GameState): boolean {
  return LADDER_APPS.every((app) => state.activatedApps.includes(app));
}

// The one-line gate each locked tile names. The launch four never lock
// (ADR-0019) — greyed tiles and locknotes are struck — so no tile carries
// a note; the surface stays for a future ladder tenant.
export function appLockNote(state: GameState, app: FocusApp): string | null {
  return appActive(state, app) ? null : "";
}
