# Retire the inspector; the expanded face is the module's only surface

The board-redesign spec left the inspector (the right-hand sidebar that once hosted the module panel and, before #38, the grid overview) unmentioned: §5 moved the module's Upgrade onto the expanded face and demoted the panel to an information surface, but never retired the panel itself. Reviewing the console-and-responsive build (issue #139, 2026-09-26) surfaced the gap: with production on the board ledger, chords in the reserved readout, and actions on the bloom, the sidebar had no job left but duplicating what the board already says — and it spent a third of the workspace doing it. This ADR records the retirement as decided; the spec's §10 ledger gains the row in the same change.

## Decision

- **The inspector is retired entirely** — the element, the workspace column, and the module panel with it. The board is the whole workspace at every width.
- **The expanded face is the module's only surface.** Everything the panel uniquely offered either already lives on the board or moves onto the bloom: the Upgrade button (§5), and now the **Combine button beside it** — two copies of one type and rarity merge into a single stronger copy, with the lower copy's upgrades refunded. The panel's read-only stats (level effect prose, position, charge tallies) die with it: the face's readout, the cell's note, and the chord readout already say what matters.
- **Combine's home moves once more.** The retirement ledger's "combine stays a panel button" clause is superseded — there is no panel. The bloom carries the button in every presentation: the popped plate, the zoomed-in ride card, and the phone bottom sheet.

## Consequences

- The workspace is single-column; no responsive rule re-docks or resizes an inspector.
- Selecting a module never opens a sidebar surface; selection presents the bloom or the ride card, and chord chips answer in the reserved readout.
- Module information not stated on the board (per-type effect prose, exact charge bookkeeping) has no surface; it returns only with a designed need.
  - _Amended by ADR-0038 (issue #155): the designed need arrived — the expanded face's help control discloses the module's rules, conditions, and current values on the modal layer, in flow as well as between sessions. Still no sidebar; the face remains the module's only docked surface._
