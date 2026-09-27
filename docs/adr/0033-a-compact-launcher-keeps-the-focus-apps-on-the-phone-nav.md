# A compact launcher keeps the focus apps on the phone nav; its Goals entry wears the tracker's state

ADR-0028 docked the focus-app tiles out below the 600px line, leaving Habit, Notes, and Goals with no phone entry point — "they return with a designed need, not as a concession row." Issue #149 is that designed need: phone players need the three apps reachable, the header must stay one row, the clock must remain the Time entry, and the thumb bar must keep the board actions. This ADR records the launcher decision; ADR-0028's consequence line and the spec's §7 phone bullet are amended in the same change.

## Decision

- **One compact launcher stands in the phone nav**: a single icon-only button between the session cluster and Settings, docked out above the 600px line where the tiles stand. It opens a compact menu of the three tile apps — Habit, Notes, Goals — so the header never gains a second row and the tiles stay retired below the line.
- **The launcher always means its menu.** Pressing it dismisses any open app popover (the clock's Time popover included) and shows the menu; picking an entry swaps the menu for that app's own panel popover, anchored beneath the launcher at the row's right end; pressing again returns to the menu, and once more closes. Click-away and Escape dismiss from wherever the launcher stands.
- **The Goals entry carries the tracker's rolled-up state**, in the habit-dot vocabulary: dashed when nothing is tracked, hollow while at least one current occurrence is open, filled when every current occurrence is complete, with the state word beside the pip and in the entry's accessible name. A recurring reset returns the read to in progress — and the read is kept honest on a resting tab by rolling occurrences on every tick (the engine's documented cadence), not only across flow boundaries. It is a state, never an aggregate — no goal percentage or completed-of-total readout rides the header, which stays pure control (§7).
- **One panel body, one anchor per width**: below the line the launcher hosts the panel (the tiles are docked out, so their popovers would land unseen); above it the tiles host their own, as issue #148 decided. The gate reads the same container width the phone stylesheet rules respond to, as the bloom's sheet shape already does.
- **Stale instances never close what they cannot see.** The exposure came from the tests: an App instance whose board was replaced still answered document-level clicks, closing — and re-rendering its own stale state over — a newer instance's DOM. The app-popover closer now reads the same `ownsBoard()` guard the bloom closer already applied.

## Consequences

- ADR-0028's consequence is amended: the Habit, Notes, and Goals apps are reachable on phone through the launcher; the tiles themselves stay docked out below the 600px line.
- The phone nav's resting anatomy gains one control: brand glyph, clock, switch, launcher, Settings — still one row that never wraps.
- The desktop row is unchanged: three consistently sized icon-only tiles, the clock as Time's affordance, Settings last.
