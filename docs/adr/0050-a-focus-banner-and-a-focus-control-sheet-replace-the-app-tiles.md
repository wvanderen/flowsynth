# A focus banner and a Focus control sheet replace the console's app tiles

The console has organized focus tools as popovers under consistently sized icon tiles — Habit, Notes, Goals — with the clock as the Time app's affordance on desktop (ADR-0012 moved the apps off the board; ADR-0033 later re-docked them onto the phone nav through a compact launcher). The wayfinder session on the instrument standards (issue #249, prototype of 2026-10-05) redirected that presentation: capture is distinct from planning, focus customization belongs in one home, and the enter-flow prompt should be that home rather than a separate dialog. This ADR records the restructure; ADR-0028 and ADR-0033 are amended in the same change.

## Decision

- **The focus banner is the console's row of focus information and controls**: the Enter/Exit main switch — still the dominant, centered session gate, glowing live or held paused — with the clock beside it, Settings at the far right, and, between switch and Settings, the selected habit's name and one thin progress bar per open tracked goal. The reads are ambient and label-free: at most three bars with overflow shown as a count, `none selected` when the next session would be unstructured, no bars and no furniture when nothing is tracked, live while a session runs.
- **One icon on the banner opens the Focus control sheet**; Notes carries its own launcher icon beside it. The tiles and their popovers retire at every width.
- **The Focus control sheet gathers every focus function but capture** behind face navigation in a fixed frame: PLAN, HABIT, GOALS, HISTORY. It opens on PLAN. PLAN is session setup and confirmation in one — the ready readout (habit, plan, goals tracked), the session habit selection including the unstructured choice, the planned target controls, and the Enter flow control that starts the session. HABIT is management and development of practices — summaries, build, rename, archive — not selection. GOALS carries tracking and the console long goal row; HISTORY carries the session record list and drill-down.
- **Time, Habit, and Goals survive as focus apps as the sheet's faces.** The console stops showing tiles, not apps; the activation ladder still gates future focus apps, which would join as faces (Tasks).
- **The enter-flow prompt retires into the sheet.** With the confirm preference on (default), a switch press opens the sheet at PLAN and the ready readout is the confirmation; with it off, the switch starts instantly on the last plan and active habit. The preference lives in Settings beside mute.
- **Notes stands apart.** Its launcher opens its own minimal sheet — composer and browse stream with stamps and habit chips — because capture is distinct from planning flow sessions. A larger Notes rework stays future scope.
- **On portrait phone the banner is the phone nav.** One row: brand glyph, clock, switch, banner reads, focus icon, Notes icon, Settings. The board thumb bar is unchanged.

## Consequences

- ADR-0033 is amended: the compact launcher retires; its Goals-state read is carried by the banner's goal bars and its inline habit-name read by the banner's habit name.
- ADR-0028 is amended: the phone nav is the focus banner itself; session controls, reads, and the two icons share its one row.
- The clock loses its Time-app disclosure: it reads session or planned time and opens the Focus control sheet.
- Focus apps' surfaces stop being popovers anchored to tiles; the popover form survives only for the board surfaces that already use it.
- The sheet's faces adopt the instrument standards' ruled-folio presentation — open divisions, tooltip-layer mechanics, figures right-aligned — as prototyped on `prototype/focus-surfaces`.
