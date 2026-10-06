# Keep the Arete Catalog with the Mutator tree and the break

Two Arete purchases left the sheet before it was ever built: the row unlock moved onto the board (issue #174, 2026-09-29) and the slot ladder onto the Mutators layer (issue #184, 2026-09-30). Grilling what remains of the Catalog (issue #189, 2026-09-30) settled its shape.

## Decision

- **The Catalog survives as the sheet holding what has no board affordance.** The Mutator tree's entry purchase (1 Arete — activates the Mutator Grid, grants the Mutator Forge, unlocks the first slot) and its roll-pool join (5 Arete) stay sheet purchases, and the Horizon break stands alone beside the tree, as ADR-0042 placed it. The entry is a system activation with no natural board place; a break living only on the prestige door would surface when an era completes, losing the goalpost ADR-0042 wants visible from the first banked Arete. And future Arete purchases may carry no board surface at all — the Catalog is where they land. Trees stay the organizing vocabulary, one tenant this phase.
- **The sheet stays pure.** No informational rows for the surface-bought ladders: slot unlocks advertise themselves on the Mutators layer the moment the entry lands, and the shaded row appears when the frontier reaches it — both are more discoverable in context than as list rows.
- **The banner buys outright.** One click on the shaded row's "Unlock this octave row · ⟨Arete⟩" banner purchases — matching cell-purchase ergonomics (armed pill, one click, permanent); the board is greyed behind it in add-cell mode, so the banner is the only live target.
- **Rows escalate.** First unlock 1 Arete, second 2, in either order (tuning) — preserving ADR-0040's enters-at-1-and-escalates rule for the one purchase body that still has a ladder.
- **The Octave tree retires.** Its two purchases are the board's row-unlock surface; the six-row cap rides with them. The Catalog holds one tree plus the break this phase; "Arete Catalog" stays the name, and the chip opens the catalog sheet — "prestige sheet" is retired as a misnomer, since prestige happens at the horizon bar's door.
- **Upgrade mode gates every Arete purchase**, and the Catalog stays locked until the first Arete reset. The sheet's buttons, the banner, and the grid pill all act in upgrade mode only; Arete is banked by prestige and nothing else, so nothing of Arete is reachable before the first prestige.

## Consequences

- CONTEXT.md is reconciled: Arete Catalog rewritten (catalog sheet, upgrade-mode purchases, lock until the first reset), Mutator tree amended to its two sheet purchases, Octave tree retired with Row unlock added, Horizon break reworded.
- ADR-0040's "launch trees are the Mutator tree and the Octave tree" clause and its "slots are bought inside this tree" reading are amended by this record; ADR-0042's "beside the trees" reads "beside the tree"; ADR-0043's slot ladder is unchanged, paid grid-side.
- The ordered implementation handoff (issue #180) picks this surface contract up.
- All numbers — the row ladder, the roll-pool price, the break's price — stay provisional tuning, landing with implementation.

## Amendment — the entry performs the first roll (2026-10-06)

The instrument map ([#242](https://github.com/wvanderen/flowsynth/issues/242), ticket [#247](https://github.com/wvanderen/flowsynth/issues/247)) grows the entry's contents to *Mutator Grid activation + the Mutator Forge module + the free first slot + **one performed Mutator roll***. The roll is a normal, unrigged roll — generated at purchase by the normal two-candidate generator under the shared rarity table — and ADR-0043's "no first-roll rig" stands: it ever concerned outcome rigging, not granting a roll at entry. The sequence is serial: the sheet closes to the Mutators layer, the first slot auto-arms from Add, the slot landing auto-opens the existing Forge modal's roll choice, and the chosen mutator auto-arms placement targeting the fresh slot; Esc and reload fall back to the standard surfaces (armed steps never persist). Existing saves are untouched — no retro-sequence, no retro roll; the forge-module backfill stands — and later charge-funded minting is unchanged. The glossary's "charge-earned" Mutator roll definition stretches accordingly: the entry performs the first roll; every later roll is charge-earned.
