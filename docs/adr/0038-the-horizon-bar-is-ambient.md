# The horizon bar is ambient

ADR-0015 shipped the accumulator as a translucent pill over the board's bottom edge — a log-scale rail with decade graduations, a practice-relative beat readout riding the fill head, a numeric lifetime total, and a reserved prestige button whose press acknowledged the horizon. Playtesting the first-Arete stretch (issue #156, 2026-09-28) read that furniture as noise: numbers before prestige exists, marks for a ladder that never gates anything, a countdown answering a question nobody asked, and a control for a mechanic that is not designed. This ADR records the shape that landed.

## Decision

- **The pill becomes the ambient horizon bar**: one wide curved-scale fill — the accumulator's log scale drawn as a shallow arc — riding the board's lower edge at every width, spanning most of the board's breadth. The bar is pointer-transparent and carries **no decade marks, no practice countdown, and no Prestige button** — no lifetime totals, no endpoint tick; its one figure is its own log-scale percentage, riding centered beneath the arc beside the Arete name. The engine keeps `accumulatorFill` and its log floor and horizon unchanged.
- **Reaching the horizon mints the first Arete and the bar settles into a completed state** — filled end to end, "First Arete reached" — that stands until prestige's design lands. Minting stays `syncArete`'s crossing check; nothing resets.
- **"Eyes on the horizon" unlocks from reaching the horizon, never from the flag.** The feat's predicate reads `totalEarned ≥ ARETE_HORIZON` and its progress row shows the real fraction. The legacy `horizonAcknowledged` flag stays in the state and the save's preserved keys so old saves load untouched, but nothing reads it: a save that pressed the removed button without the crossing behind it does not have the feat minted retroactively.
- **The bar holds its lanes at every width**: clearing the left dock's lower reach and the zoom cluster's right edge on desktop, riding above the phone's thumb bar edge to edge, and surviving open board sheets (sheets cover it; nothing dismisses it).

## Consequences

- Amends ADR-0015: the graduation, beat-readout, lifetime-total, and reserved-button clauses are retired, along with the engine's `ARETE_GRADUATIONS`, `nextAccumulatorMark`, and the `acknowledgeHorizon` action. The accumulator's purpose — one grand numeric objective on a prestige horizon — stands; its surface no longer narrates the arithmetic.
- ADR-0029's rule survives the rename with it: the bar rides the board at every width and is never dismissed — sheets may cover the lower edge, but nothing unmounts or gates the bar. The board-redesign spec's "floating Arete pill" wording (§7) reads as this bar throughout.
- The removed button's reserved-UI-slot rationale lapses with it: when prestige arrives it designs its own door (issue #156's horizon is the provisional target and may move with prestige's design).
- Feat detection is unchanged elsewhere: already-unlocked feats never re-fire, nothing unlocks in session one, and unlocks toast and persist exactly as before.
