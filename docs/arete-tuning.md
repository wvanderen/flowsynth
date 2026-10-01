# First Arete horizon tuning (#157)

## Decision

Raise the provisional per-era prestige threshold to **1e23 earned nous**, superseding the initial 1e9 proposal. The target is roughly **16 hours of credited practice** for expanding chord boards, not 16 hours of wall-clock use or a guaranteed reset time. Keep the logarithmic floor at 10 and the existing prestige claim/reset rules. This is an early-game objective after developing a board, not a reward promised after five sessions. Five 30-minute sessions are a diagnostic checkpoint, not the optimization target. Board expansion, chord discovery, and creative experimentation are the intended progression; a minimal board reaching an easy reset is not the design goal.

The source of truth remains `ARETE_HORIZON`; production, the ambient bar, prestige gating, the horizon achievement, and post-break overfill all read it. Existing earned nous and banked Arete are preserved. A save between the old and new thresholds loses access to an unclaimed reset until it reaches the new line; already banked prestige is untouched. The same threshold applies in later eras, whose retained boards need separate playtesting.

## Repeatable current-engine experiment

Run `npm test -- src/engine/arete-tuning.test.ts`. This executes the actual TypeScript engine, not the historical Python economy model. It uses three seeded random streams (157, 42, 2026) for each of two board-growth preferences, starting with the ordinary opening grant. All acquisition and spending use real engine actions; there are no gifted modules, patched earnings, free cells, or fixed favorable offers. The launch lattice is four octave rows and twelve columns; no Arete rows are unlocked.

Each session credits 30 minutes of present practice, in one-minute production steps. Between sessions the policy accepts a synthesizer if a real roll offers one, otherwise the first candidate; attempts one unowned shelf offer in generator/Forge/infusor order; buys at most two cells if inventory needs space; places tray modules on vacant cells using a greedy rate-plus-Forge-output preview; and makes up to three upgrade gestures, each at most five levels, on the lowest-level deployed synthesizers. Placements and roll acceptance can exceed that purchase count. There are no combinations, full-layout searches, manual practice grants, interruptions, or prestige resets during measurement. This is a transparent reference policy, not an optimal strategy or a model of enjoyment.

Compact growth prefers nearby columns across available octave rows; fifths growth prefers staying in the start octave before spreading vertically. Both purchase cells. The same roll seed is reproducible within each route; different Forge output can consume different numbers of draws, so the routes do not receive identical offer histories. Support modules can remain in inventory when synthesizers fill the available cells. Forty-eight sessions give a 24-hour **credited-practice** observation window. Minute crossings are rounded upward to the next simulated minute; idle wall-clock time contributes nothing.

| Growth | Seed | Earned after five sessions | Cells after five sessions | Minutes to 100k | Minutes to 1m | Minutes to 1bn | Minutes to 1tn | Minutes to 1e23 | Minutes to 1e25 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Compact | 157 | 50,441 | 10 | 174 | 283 | 338 | 411 | 910 | >1,440 |
| Compact | 42 | 24,652 | 9 | 203 | 335 | 421 | 475 | 961 | 1,070 |
| Compact | 2026 | 44,155 | 10 | 178 | 283 | 334 | 391 | 853 | 901 |
| Fifths | 157 | 14,276 | 9 | 306 | 757 | >1,440 | >1,440 | >1,440 | >1,440 |
| Fifths | 42 | 11,559 | 8 | 327 | 850 | >1,440 | >1,440 | >1,440 | >1,440 |
| Fifths | 2026 | 12,755 | 9 | 309 | 742 | >1,440 | >1,440 | >1,440 | >1,440 |

The earlier 1e9 proposal opens during session 12–15 (5h34m–7h01m). That is earlier than the now-agreed target. **1e23 opens at 14h13m, 15h10m, and 16h01m** across the compact seeds, during session 29–33. These measurements use the final 1e23 horizon; raising it also delays the horizon achievement's production boost, shifting two crossings by one minute from the initial comparison. This is a provisional reference range, not a time gate: reaching the earned-nous threshold is still the only production requirement.

| Compact seed | Earned at 16 credited hours | Earned at 24 credited hours |
|---|---:|---:|
| 157 | 2.2501e23 | 2.2089e24 |
| 42 | 4.1800e22 | 6.7977e25 |
| 2026 | 2.0288e28 | 4.7699e29 |

A 24-hour target is much less stable under the same fixed-threshold approach. For comparison, 1e25 opens at 15h01m and 17h50m for two compact seeds; extending the same scenario to 96 sessions puts the remaining seed's crossing at 32h39m. To reproduce that extended measurement, change the scenario's session limit to 96; the checked-in run retains the 48-session observation window. The late-game spread reflects geometry and acquisition history; three seeds do not establish a typical player distribution. We selected the roughly 16-hour experiment rather than the more variable 24-hour alternative.

By 16 hours the compact routes own all 48 launch cells and deploy 31–35 synthesizers. They eventually deploy 35–38 synthesizers by 24 hours; fifths routes finish with 13–14 cells. The fifths routes do not reach 1e23 within the observation window, demonstrating substantial sensitivity to geometry and cell affordability, not proof that this style is invalid. Players can rearrange freely and change direction; these deliberately persistent policies do neither. A higher threshold alone cannot balance every chord strategy or cure exponential scaling.

## Maintainer save as context

The supplied version-6 export contains 20 session records totaling **27,221.728 credited seconds (7h33m42s)**, 108 cells across 15 distinct stored `r` coordinates, 86 modules, and 19 combinations. The maintainer reports reaching floating-point overflow in about 24 hours of real-world use. Both `nous` and `totalEarned` are JSON `null`, consistent with non-finite values being serialized, so the exact final income and first threshold crossing cannot be reconstructed from this export. Stored `r` coordinates are not the current lattice's derived octave rows.

That history supports leaving space for investment and chord exploration rather than tuning to a poor five-session strategy. It does **not** establish that today's four-row, twelve-column board reaches the same production in 24 hours, nor that 24 wall-clock hours mean 24 credited hours. The save is not imported as a current-board fixture, and private practice records are not committed. The roughly 16-hour target is an explicit pacing choice for the current bounded board, not a fit to the historical save's 7.56 credited hours or its overflow.

## Real-life playtesting still needed

- Whether repeated purchases, rearrangements, chord discoveries, combinations, and support-module choices feel rewarding before the first reset; raw time-to-threshold cannot measure fun.
- Adaptive layouts, spacer bridges, different roll selection, unlucky sequences, combinations and rarity, generator/Forge investment, and occasional long sessions. Three seeds do not estimate a probability distribution.
- Whether the slow fifths route exposes a discoverability problem or an overly sharp economic cliff. Test players changing their boards, rather than requiring them to follow a fixed efficient recipe.
- How a retained developed board affects later prestige pacing and access to rows, mutators, and the Horizon break. Raising the threshold also changes the overfill ratio used after that purchase.
- Whether the bar's early movement remains readable: 100 nous now fills about 4.55%, 1,000 fills 9.09%, and 100k fills 18.18% across the 22-decade rail. Early movement is smaller than under 1e9; verify that it remains useful feedback during ordinary play.
- Continued high-output play on the bounded board and numerical stability. This ticket tunes the reset horizon; it does not resolve overflow or suppress chord multiplication.

Revise the provisional number from observed creative play, not by imposing a five-session guarantee or optimizing only the quickest reset.
