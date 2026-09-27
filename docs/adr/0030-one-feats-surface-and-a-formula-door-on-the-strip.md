# One feats surface per screen; the game-info strip's rate read is the phone's formula door

The responsive spec listed feats twice for portrait phone — once inside the game-info strip's reads and once on the thumb bar — and the first build shipped both, so `6/17` rode the board twice on one screen (review of PR #143 and playtesting, 2026-09-27). The same round exposed a second gap: the formula was disclosed only from the ledger strip's Rate cell, which is `display: none` below the 600px line, leaving portrait phone with no door to the formula at all. This ADR records the resolutions; the spec's §7 phone bullet and the glossary are amended in the same change.

## Decision

- **Feats appears once per screen.** The thumb bar owns feats on phone — it is the played decision (prototype #121's rev 2 moved feats onto the bar), and a bigger tap target beats a second chip. The strip carries ν, rate, and session and no feats chip; the ledger strip's feats chip serves every other width, where no thumb bar exists.
- **The strip's rate read is the phone's formula door.** The read wears the Rate cell's ⓘ and opens the same formula sheet over a scrim — the sheet, not a new surface, so the disclosure stays "only from the rate figure" at every width.
- **The operand chain never goes ambient on phone.** Above the 760px breakpoint the collapsed equation is ambient because there is room; on a 390px board there is not. The full formula + value breakdown lives only in the sheet, and the strip's rate read stays a bare total.

## Consequences

- The feats chip's markup is the ledger strip's alone; `featsChipHtml` takes no id variant.
- Phone formula access is a tap on a read that already exists — no extra chrome, no second disclosure surface to keep in sync with the ledger's Rate cell.
- If the strip ever gains a fourth read, the one-feats-per-screen rule, not the strip's historical roster, decides what may join.
