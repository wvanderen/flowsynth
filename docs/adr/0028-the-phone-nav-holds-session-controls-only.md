# The phone nav holds session controls only; the tiles return only while an app is open

The responsive spec's phone line says the top nav holds session controls only, but the first console-and-responsive build (issue #139) kept the icon-only focus-app tiles and the settings gear in place at the 600px line, shrinking them instead of docking them out — the acceptance check read as only partially met. Review of PR #143 (2026-09-27) settled the composition. This ADR records the decision; the spec's §7 phone bullet is amended in the same change.

## Decision

- **At rest, the phone nav holds session controls only**: brand glyph, clock, pause, main switch, settings. The focus-app tiles hide below the 600px container line.
- **The tiles return only while an app popover is open.** *Amended by ADR-0033 (issue #149): the tiles stay retired below the line — the clock's Time popover anchors to the clock itself (issue #148), and one compact launcher in the resting row opens the three tile apps.* The original reasoning — the row cannot simply vanish while a popover needs its anchor — held until the clock itself became Time's anchor. Planning lives only in the Time app, and the clock stays its door.
- **The settings gear stays.** It is a control, not a focus app and not a read: mute, export, import, and reset need a home at every width, and nothing in the spec retires it. The nav's "session controls only" enumeration is read as clock, pause, enter/exit, settings.

## Consequences

- The Habit, Notes, and Goals apps have no phone entry point through the tiles; they return through the compact launcher when the designed need arrives — which it did, as issue #149 (ADR-0033). The tiles themselves stay retired below the 600px line.
- The nav's resting anatomy is one row that never wraps. *Amended by ADR-0033 (issue #149): `console-apps` stays in the resting row carrying the compact launcher; the tiles within it stay hidden below the 600px line.*
