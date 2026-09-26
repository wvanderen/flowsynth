# Re-anchor the cell economy on octave rows

With pitch a property of the cell (ADR-0021), cells no longer gate harmonic depth through distance, and the economy needed a new scarcity axis. Decided with the maintainer across two grilling rounds (issue #122, 2026-09-24), with the opening grant settled by the opening-arc playtest (issue #123, 2026-09-25).

## Decision

- **One unified synth leg**: `rate = (synths + infusor uplift) × Π chord terms × empowerment × achievementBoost`. Every synthesizer shares one base rate scaled by `rarityPower^level` — the carrier/harmonics split dies with the distinction it served — while the infusor uplift stays its own named leg (ADR-0020's pattern). The breakdown and session-summary legs rename `carrier` + `harmonics` into one `synths` leg.
- **Chord value is pitch-set-shaped.** Only named pitch-set chords pay multipliers; anonymous adjacency bonuses are gone — adjacency alone is chordless, matching what the always-on hulls show. The Conditional's per-pair bonus becomes +10% per named-chord instance it belongs to (constant = tuning). A doubled voice automatically forms an Octave instance with the original and stacks its small term — accepted over suppression: one matching rule, no special cases, and the duplicate paid a full cell + module for it. Disjoint clusters each forming the same chord stack multiplicatively (the existing overlap rule). Bonus tiers track construction cost per the spacer ladder; exact tiers are tuning.
- **Cells gate registers, not depth.** The geometric purchase-count scaler stays, plus a **one-time row gate**: the first *purchase* into each new octave row pays a gate premium on top of that cell's price. Gates tax acquisition only — moving owned cells between rows is free and never meets a gate, keeping the always-live drag friction-free — and gate spend never advances the purchase scaler. Gate price escalates with row distance (tuning). The row range is finite, generous, and symmetric around the start register (count = tuning) so real estate stays scarce; the fifths axis stays ungated.
- **Height carries no inherent per-row rate bonus** — its worth is access: registers, voicing freedom, and gate-paced beats. Horizontal expansion = new pitch classes = implicit chord-vocabulary access (no tech tree); area = simultaneous voices and multi-chord stacking.
- **The spacer ships through forge rolls** — deliberately not the starter shelf — priced like a cheap synth with no upkeep; the wire ladder already bills difficulty in board.
- **The opening grant is plain free synths**: exactly one pre-placed synth (C4) plus a nous grant that affords the first upgrade; further synthesizers arrive only through the forge loop (issue #123). The starter shelf keeps the generator, one infusor, and the Forge.

## Consequences

- **Supersedes ADR-0014's depth-coupling clause** ("cell purchases deepen achievable pitch") and its breakdown leg list, and **amends ADR-0020**'s leg names: `carrier` + `harmonics` collapse into `synths`; the uplift-leg pattern stands.
- **Supersedes ADR-0013's grant-equals-first-upgrade leg** (the grant now affords, but does not exactly equal, the first upgrade) and **ADR-0018's shelf-sells-an-Additive-Synth leg**: no synth purchases exist outside the forge loop in the opening.
- Real estate, not module price, is the difficulty ladder's currency: the wire model makes board cells the bill, so harder-to-construct chords literally cost more board and earn bigger multipliers.
- All numbers remain tuning: prices, scalers, gate premiums, row count, chord bonus tiers, the Conditional constant, forge pacing.
- `CONTEXT.md` is reconciled: Chord, Pitch, Synthesizer, and Composite rewritten; Carrier, Chord pair, Harmonic term, and Named chord retired; Spacer, Row gate, Octave row, and Start register added.
