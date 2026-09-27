# The phone nav holds session controls only; the tiles return only while an app is open

The responsive spec's phone line says the top nav holds session controls only, but the first console-and-responsive build (issue #139) kept the icon-only focus-app tiles and the settings gear in place at the 600px line, shrinking them instead of docking them out — the acceptance check read as only partially met. Review of PR #143 (2026-09-27) settled the composition. This ADR records the decision; the spec's §7 phone bullet is amended in the same change.

## Decision

- **At rest, the phone nav holds session controls only**: brand glyph, clock, pause, main switch, settings. The focus-app tiles hide below the 600px container line.
- **The tiles return only while an app popover is open.** The clock is the plan affordance (§7) and the Time popover renders anchored inside the tiles' row, so the row cannot simply vanish — it reappears when a popover opens and hides again the moment it closes. Planning lives only in the Time app, and the clock stays its door.
- **The settings gear stays.** It is a control, not a focus app and not a read: mute, export, import, and reset need a home at every width, and nothing in the spec retires it. The nav's "session controls only" enumeration is read as clock, pause, enter/exit, settings.

## Consequences

- The Habit, Notes, and Goals apps have no phone entry point; their tiles are unreachable below the 600px line. They return with a designed need, not as a concession row.
- The nav's resting anatomy is one row that never wraps: `console-apps` hides until an `app-open` state says a popover needs its anchor.
