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
