# Reject v4 saves at the v5 boundary

The decoupled board/console model is a structural rewrite: cores leave the board, the expander and session rewards retire, the opening changes completely, and the formula changes shape. Issue #21 (2026-09-14) decided the save policy.

## Decision

- **`SAVE_VERSION` bumps to 5.** `deserialize` rejects v4-and-older saves with a clear "incompatible older version — starting fresh" message, and the game starts from the new initial state. The v1–v3 field-patching `migrate` chain is deleted with it.
- **No archive and no import path** for old saves. The life-record (habits, practice log, goals, notes, tasks, allowance) is accepted as lost: the player population is the maintainer and playtesters with days-old saves (the first playable shipped 2026-09-12 per ADR-0010), and the maintainer clears browser storage.
- **The version gate is required regardless of policy**: without it, a v4 state silently merges into fresh v5 defaults and produces a broken hybrid.

## Consequences

- **Supersedes ADR-0011's grandfathering provision** ("Existing saves are grandfathered"); that precedent covered a compatible change (activation flags remapped), and this rewrite is structural.
- Every player plays the new opening from zero (ADR-0013) — the onboarding script can assume no player arrives with skipped beats.
- ADR-0010's persistence provisions otherwise stand: versioned localStorage, export/import of the current version, autosave cadence, and reload recovery.
