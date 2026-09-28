# Disclose module rules from the expanded face

Playing the opening arc kept asking one question the board could not answer: what does this module actually do, and what is it doing right now? The expanded face carries the final contribution and (between sessions) the Upgrade button, but the rules behind the numbers — what a Conditional's per-instance bonus stacks onto, when a generator's window banks and drains, what a spacer conducts — had no surface anywhere. ADR-0026 retired the inspector and left per-type effect prose and exact charge bookkeeping with no surface "until a designed need". Reviewing the post-#153 board (issue #155, 2026-09-28) surfaced that need: players inspect modules mid-session, when the retired inspector would have been the only answer. This ADR records the shape that landed.

## Decision

- **A help control rides beside the module's name on every presentation of the expanded face** — the popped plate, the zoomed-in ride card, and the phone bottom sheet. It opens the module's **rules dialog** on the modal layer: the type's full effect rules, the conditions each effect applies under, and the module's current values. The workspace never redocks; this is not the inspector's return.
- **Module information is available in flow as well as upgrade mode.** Selecting a module mid-session opens its expanded face — information only. The board's actions stay locked: no drags, no placements, no purchases, and the Upgrade control waits between sessions.
- **The rules dialog shares the rate details' decomposition.** A synthesizer's current values are the same base / chords / infusor / charge / achievement legs the Rate cell's roster carries (one decomposition, exported once — never two that can drift), and they wear the same basis as every rate figure: live during flow, projected between sessions. Live values mount the same kind of live slots the tick fills, so a clock tick never rebuilds an open dialog.
- **The expanded face stays concise.** The face keeps its readout — the final contribution — and nothing else moves onto it; the detail lives one press away, on demand.
- **The rules phrasing is per type, in one place.** All six launch module types carry rules and conditions from one map in the UI layer; the numbers in the prose read off BALANCE, never hardcodes.

## Consequences

- Amends ADR-0026: per-type effect prose and exact charge bookkeeping have a surface again — disclosed from the expanded face's help control, not a docked panel. The "expanded face is the module's only surface" rule stands; the dialog is a disclosure from that surface, on the modal layer the rate details already ride.
- Amends the §5 lock reading: flow locks the board's actions, not its answers. A locked board still explains itself.
- The `pickCell` flow branch now toggles selection like upgrade mode's; the "board is locked" toast is gone — the board's response to a click is the face itself.
- One more modal kind (`module`) rides the existing dialog machinery: backdrop, Esc, focus, and the phone sheet shape all come free; the guard drops the dialog if its module leaves the board.
