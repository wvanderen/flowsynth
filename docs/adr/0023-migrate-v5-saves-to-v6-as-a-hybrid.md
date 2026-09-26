# Migrate v5 saves to v6 as a hybrid

ADR-0017's clean cut worked when the life record was disposable and the player population was playtesters with days-old saves. The redesigned board (ADR-0021/0022) invalidates the balance, purchase count, and shelf state — but the life record is now load-bearing: trust-model session accounting, the practice log, and the Arete accumulator all read it. Issue #124 (2026-09-24, two grilling rounds) decided the boundary; the doc edits land with consolidation (issue #125).

## Decision

- **`SAVE_VERSION` bumps to 6; v5 converts once inside `deserialize`** — a one-time transform, not a rejection. Anything older than v5, and future versions, still hard-rejects with the start-fresh message. Exported `.json` saves follow the same rule: v5 imports convert exactly like in-app saves. ADR-0017's version-gate requirement stands; its clean-cut precedent is deliberately not repeated.
- **The life record and lifetime meta carry over**: `habits`, `practiceLog`, `notes`, `goals`, `activeHabitId`, `sessionRecords`, `achievements`, `sessionsCompleted`, `unstructuredSessions`, `plannedSessionsCompleted`, `sessionIndex`, `combinations`, `muted`, `notificationAsked`, `activatedApps`, `goalCapacityBought`, `totalEarned`, `arete`, `horizonAcknowledged`. Preserved session counters mean the `syncAchievements` session-one guard does not re-fire — feats can unlock from the first post-migration session.
- **Board-side state resets to the new opening**: `modules` (the Carrier row included), `cells`, `cellsBought`, `forge`, `bankedRolls`, `chargeWindow`, `purchased`, `welcomeAcked` (explicitly deleted by the loader), `session`, `summary`, `nextId`, and `nous` → the new opening grant. Rationale: the balance, purchase count, and shelf state were earned under the invalidated formula and scaler; carrying them over would price a restarting player out of the new opening. Every player plays the new opening from zero — this time with the life record intact. `totalEarned`/`arete` persist as lifetime truth feeding the Arete accumulator, which the playtest did not invalidate.
- **Mid-flow boundary**: a v5 save captured in `flow` or `paused` discards the live session — `session = null`, landing in upgrade mode on the fresh board. That time never credits, matching today's uninstall-mid-session behavior. Accepted tradeoff: possible uncredited present time, against a population of the maintainer and deliberate playtesters.
- **New persisted state**:
  - `gatedRows: number[]` — row indices whose one-time octave-row gate is paid; an explicit array (not a max-distance scalar) so purchase order never matters; lenient-defaults to `[]` in the merge-over-fresh loader.
  - `"spacer"` enters the module type union as a **new module category** — not a synthesizer: silent, occupies a cell, never joins a pitch set. Category-level membership keeps the chord math, unified-leg filter, and roll pool single-lookup with no exceptions. Ships via forge rolls only.
  - Summary/formula legs rename per ADR-0022 (`carrier` + `harmonics` → `synths`; the infusor uplift stays its own leg). Old v5 summaries are discarded by the migration anyway.
  - `SynthesizerType` drops `"carrier"`.
  - Pitch stays derived, never persisted: absolute pitch is a pure function of cell coordinates under the octave-stack lattice.

## Consequences

- **Supersedes ADR-0017's clean-cut policy** (reject v4, no archive, life-record loss accepted) while keeping its version-gate requirement and ADR-0010's persistence provisions: versioned localStorage, export/import of the current version, autosave cadence, reload recovery.
- Amends ADR-0013's "every player plays the new opening from zero": the opening is replayed from zero, the life record is not lost.
