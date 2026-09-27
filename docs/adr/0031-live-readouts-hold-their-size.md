# Live readouts hold their size; trailing zeros stay

Tight production surfaces breathed with their own numbers: the game-info strip was content-sized and viewport-centered, so the session read's every tick re-centered the pill; the pill's beat bubble resized every second as its m:ss countdown moved; and the lifetime total oscillated between trimmed and untrimmed widths — `2,426.1` → `2,426.11` → `2,426.1` — because the shared formatter treats trailing zeros as optional. Playtesting the phone build (PR #143 round, 2026-09-27) read the jitter as broken layout. This ADR records the rule and the one deliberate formatter departure; spec §7 needs no amendment — this is constraint, not anatomy.

## Decision

- **On tight surfaces the readout holds its size and the content changes instead.** The game-info strip anchors edge to edge with centered content (no transform, no content-derived width); the beat bubble wears a locked 50ch width and centers its text; the pill row's total owns the middle lane (`flex: 1`, centered), so ARETE and the prestige button sit pinned to their edges however long the figure runs.
- **Tight surfaces format with `formatFixed`** — always two decimals, trailing zeros kept, comma-grouped — for the lifetime total and the strip's rate and session reads. This deliberately departs from `formatNumber`'s trimmed exactness; do not "simplify" the zeros away. Past the exact range (1e6) the ladder takes over, where magnitude changes are rare enough not to pulse.
- **Everything else keeps `formatNumber`.** Ledgers, tooltips, faces, and modals have room for a character to come and go; only size-critical surfaces pay the fixed-width cost.

## Consequences

- Remaining jumps are one-off, not rhythmic: decade and thousand crossings (`9.99 → 10.00`), the ladder handoff at 1e6, and the countdown's hour boundary (`59:59 → 1h 0m`) inside its locked bubble. Accepted as inherent to live numbers.
- A readout that starts breathing again means it moved off `formatFixed` or lost its reserved lane — the regression is a one-line diff, not a redesign.
