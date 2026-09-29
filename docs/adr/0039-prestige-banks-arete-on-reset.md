# Prestige banks Arete on reset

ADR-0015 shipped the Arete accumulator with an auto-mint at the horizon and deferred prestige's design; ADR-0038 made the bar ambient, retired its furniture, and left prestige to design its own door. The playtest that reached the first Arete — one Arete held with no reset behind it — asked for an Infinities-style reset whose payoff is the reset itself. Grilling the prestige contract (issue #170, 2026-09-29) decided the first loop's shape.

## Decision

- **Claim on reset, never before.** No Arete is ever rewarded without prestige — not at the horizon crossing, not by anything else. This holds permanently: even after the horizon break lets score beyond the threshold earn more, everything still banks on the reset action. The auto-mint at the crossing (`syncArete`'s check) is superseded: crossing only opens the door and mints nothing.
- **Prestige is the verb.** The completed bar hosts the door: the percentage readout gives way to "Prestige and Claim X Arete", X exactly what resetting would bank now. Pressing in upgrade mode confirms and banks; outside upgrade mode the door shows locked, a tooltip or readout explaining why (exact copy is tuning).
- **Fixed horizon, per-era measure.** The horizon line stays at its launch threshold every era (Revolution Idle's shared-infinity-threshold shape). The bar measures only the current era's earned nous on today's log scale and rebases at each prestige; lifetime `totalEarned` stays the monotonic truth underneath.
- **Flat base yield.** 1 Arete per prestige at the base threshold, every cycle. Yield growth lives entirely downstream: what Arete buys (issue #171) and the horizon break — never from resetting repeatedly.
- **The break, named but deferred.** The endgame act breaks the horizon cap so score beyond the threshold scales the claim. Its unlock condition, curve, and surface graduate to the "Horizon break" ticket (issue #181) once the Arete-spending design exists.
- **The reset boundary.** Prestige persists owned modules (types, rarity, secondary effects), cell count and placement including `cellsBought` scaler progress and paid row gates, tray inventory, banked forge rolls and forge progress, achievements and `achievementBoost`, the life record, the Arete balance, and lifetime `totalEarned`. It resets module levels to base, nous to a fresh opening grant, and charge state with the charge window.

## Consequences

- Amends ADR-0015's mint clause and ADR-0038's "reaching the horizon mints the first Arete" clause: the completed state is no longer a terminal era — it is the door, and the accumulator's fill is per-era rather than lifetime.
- The engine swaps `syncArete`'s crossing mint for a crossing signal plus reset-time banking; `arete` counts banked prestige. Existing saves carrying the auto-minted first Arete are disposable per the map's standing note (issue #169); any save-format handling lands with implementation.
- "Eyes on the horizon" keeps its predicate (`totalEarned ≥ ARETE_HORIZON`, lifetime) — the feat is unchanged.
- No new era/prestige furniture: ADR-0038's one-figure discipline holds; the prestige count ships as engine state awaiting a surface (a prestige-ladder feat or a summary line, later tickets).
- Yield curves, threshold values, and the break's numbers stay tuning and map fog until #171 and the Forge-source ticket settle their contracts.
