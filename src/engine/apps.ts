import { rungCost } from "./economy";
import type { FocusApp, GameState } from "./types";

export type { FocusApp };

// Focus apps (ADR-0012): unlock-only, fixed-function console instruments.
// Activation is permanent and player-wide; the board may read app state as
// effect inputs, but apps never touch nous or charge (§2.3's boundary rule).

// Tile order on the console: the free app leads the rack (spec §2.3's
// launch inventory).
export const FOCUS_APPS: readonly FocusApp[] = ["habit", "time", "notes", "goals"];

// Free from the very first session (ADR-0019, issue #83). Today this is
// every FocusApp there is. When the ladder's first tenant joins (Tasks,
// ADR-0012), it takes a tile in FOCUS_APPS but stays out of this set —
// it then gates on the permanent `activatedApps` record below, bought
// from the ladder at pricing that tenant's effort decides.
const FREE_APPS: readonly FocusApp[] = FOCUS_APPS;

// The activation ladder rests empty at launch (ADR-0019): with Notes and
// Goals free, it has no launch tenant. Its shared, scaling, free-order
// shape stands; the ladder gains its members — Tasks first (ADR-0012) —
// and its pricing, with that tenant's effort.
export const LADDER_APPS: readonly FocusApp[] = [];

// Activation: the launch four are free; anything beyond them consults the
// permanent `activatedApps` record the ladder writes.
export function appActive(state: GameState, app: FocusApp): boolean {
  return FREE_APPS.includes(app) || state.activatedApps.includes(app);
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

// The one-line gate each locked tile names ("activate with nous"). The
// launch four never lock (ADR-0019) — greyed tiles and locknotes are
// struck — so nothing carries a note today; a future ladder tenant brings
// its gate line back here, keyed off `appActive` flipping false.
export function appLockNote(state: GameState, app: FocusApp): string | null {
  return appActive(state, app) ? null : "activate with nous";
}
