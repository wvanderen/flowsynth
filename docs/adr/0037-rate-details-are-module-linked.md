# The rate details are module-linked

Playing with the local-chord board (ADR-0036) exposed the next honesty gap (issue #154, 2026-09-27): the Rate cell led with an operand chain — `(synths + infusors) × emp × ach` — whose legs aggregate the whole board, so nothing on the surface answered the player's actual question, "which module makes this, and what changed it?" The session summary and the reserved readout had per-module figures; the rate disclosure itself did not. This ADR records the shape that landed.

## Decision

- **The Rate cell shows the final total, and the total is the display at every width.** The ambient operand chain dies — there is no width where the collapsed equation stands instead of the figure — and with it the leg-level tooltip prose riding its terms.
- **The disclosure is one module-linked roster, shared by both channels.** Above the 760px breakpoint the Rate cell's hover or focus opens the popover; below it a tap opens the same roster as a sheet over a scrim, and the phone game-info strip's rate read taps open to the same sheet. One builder renders both, the popover through live slots the tick fills, the sheet printing the snapshot outright.
- **One row per synthesizer, leading with its final ν/s.** The row expands into the legs that built it — the base term, the local chord multiplier with its named terms ("Fifth ×1.3"; "none" when chordless), the local infusor uplift, the charge factor with the strength received, and the achievement boost — and the legs multiply back to the row's figure exactly. The roster's rows sum to the board's rate within rounding, so the details can never disagree with the total above them.
- **A synthesizer row's tap identifies its module on the board.** Selection is the board's one emphasis (ADR-0025): the row wears a picked mark, the module's face lifts into the bloom, its chords stay focused. On the sheet the tap closes the sheet first, so the answer lands on the board it names.
- **Nonproducing modules disclose effects, never ν/s.** A second section lists the board's other deployed modules in the bloom's own vocabulary — the infusor's "% to adjacent", the generator's charge strength, the Forge's progress/s, the spacer's silence — under a heading that says outright these carry no ν/s, so nothing reads as a second producer or a double count.
- **The desktop Session read joins the tight-surface rule (amends ADR-0031's carve-out).** It formats with `formatFixed` — trailing zeros kept — and its cell reserves a lane, so the ticking session no longer breathes; the ledger was the last `formatNumber` read that moved every tick.
- **The achievements page points at the rows.** Its lead names the Achievements leg of every synthesizer row in the rate details — there is no board-level "Achievements line" anymore.

## Consequences

- Supersedes ADR-0030's "the operand chain never goes ambient on phone" clause and the spec's ambient-chain wording: there is no chain anywhere to keep non-ambient. ADR-0030's other provision — one feats surface, the strip's read as the phone's door — stands, with the door now opening the module-linked sheet.
- Amends ADR-0031: "ledgers keep `formatNumber`" loses the Session cell, which now pays the fixed-width cost like the other tight surfaces.
- The empowerment leg keeps no surface of its own; it survives in the engine's rate identity (`rate = (synths + infusors) × empowerment × achievementBoost`) and the session summary's legs. A reader who wants the aggregate can still add the rows.
- The sheet's rows are expandable `<details>`; a rebuild that re-prices them (roster, feats, or the whole-ν/s rate changing) collapses open rows. Accepted: rebuilds are quantized, and a collapsed roster is the sheet's resting state.
