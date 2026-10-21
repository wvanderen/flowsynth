import type { FocusApp } from "./types";

export type { FocusApp };

// Focus apps (ADR-0012): fixed-function console instruments that never
// touch nous or charge (§2.3's boundary rule). Every app is free from the
// very first session (ADR-0019, issue #83). The Goals app retired with its
// separate face (issue #445) — goals edit inside their habit — and when
// the ladder's first tenant joins (Tasks, ADR-0012), it joins this set.
export const FOCUS_APPS: readonly FocusApp[] = ["habit", "time", "notes"];

// The console's door tiles (issue #148, retired by #313): Notes alone wears
// one — capture is a distinct action. The clock block is the Focus sheet's
// one wide entry and the focus door its phone entry, the PLAN / HABIT /
// HISTORY faces switching inside the sheet; Time never wore a tile (issue
// #148): the console clock is itself the app's affordance.
export const TILE_APPS: readonly FocusApp[] = ["notes"];
