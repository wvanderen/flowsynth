# 0055 — Calibrate and release the harmonic-capacity prestige loop

Date: 2026-10-07
Status: Accepted
Issue: #262

## Context

ADR-0053 landed the capacity ladder behind the development gate with explicitly provisional prices, and the numerical prototype (retained on `codex/prototype-harmonic-capacity`) found the inherited 1e23 horizon inseparable from the uncapped stacking the capacity design retires. The calibration ticket asked for the horizon, the finite capacity prices, the finite Arete prices, and the Q curve to be tuned together against the authoritative selector, validated across seeds, policies, complete-board comparisons and further eras, and the ordinary-play path enabled only once the whole loop met the design's acceptance criteria. Fresh evidence was required; neither the prototype's trial numbers nor the inherited 1e23 horizon could be carried over.

## Decision

1. **The horizon rebases to 7e6, the visible log floor to 1e3.** The ordinary policy's first era crosses in a median 1,215 credited-practice minutes (~20.3 hours) across eight seeds at full production fidelity, and the second era lands at a median ~12 hours — provisionally near the 70% direction (measured median ratio ~0.60, per-seed 0.33–0.94; the targets are tuning aims, not gates). The old floor of 10 sat above the new horizon's decades and would have pinned the bar at zero, so it rebases with the line. The "Eyes on the horizon" feat keeps reading the horizon, and so rebases with it.

2. **The Arete-gated rungs reprice; the first-era rungs stand.** Rungs one and two (600 and 30,000 ν) sell mid-era in every seed and policy — genuine milestones with 26–77% whole-board rate jumps measured across the purchase. The ceiling-gated rungs reprice from the provisional 1.5M/75M to 700,000 and 5,000,000: under the rebased horizon the old figures were either trivial at their unlock era (rung three) or unreachable within any era's wiped-at-prestige budget (rung four at twelve times an era's income). At the adopted prices rung three sells in the era after the first ceiling unlock (era seven in every recorded seed) and rung four sells by era ten under a saving posture.

3. **The Arete prices stand as shipped (3/7 discounts, 6/14 ceilings).** The cumulative at-threshold claims (1, 3, 6, 10, 15, 21…) spread both finite ladders across the arc: the first discount lands after era two, the second after era four, the first ceiling after era six, the second by era eight — each purchasable, neither recreating an immediate repeatable prestige (no recorded era fell below 40% of the first era's length; the shortest rebuild was five hours).

4. **The Q curve stands as adopted in #260.** The allocation magnitudes (complexity rate 0.12, tension allowance 0.8, bounds ×0.5–×1.5) were revalidated against the complete-board comparison suite rather than retuned: chromatic cramming never activates against organized boards at any capacity or budget scale, doubled sevenths beat plain triads roughly two-to-one where their voices participate, duplicates exploit capacity better than wide formations, silent-voice support loses at capacity one and competes at the high end, and concentrated power stays within a small factor of distributed everywhere. The prototype's trial rate of 0.25 belonged to the old structure and is not adopted.

5. **Ordinary play is released onto the allocation model.** The development gate (`setAllocationEnabled` keyed to the dev flag) is retired: every state — ordinary or development — rides the whole-chord selector, the Catalog's capacity row and the Arete sheet's offerings render for everyone, and the `dev` flag now gates only the development surfaces (the dev panel and stress board). Prestige's modal names the capacity reset unconditionally.

6. **Pre-calibration banks degrade honestly, never wiped.** No save-shape change ships (v8 stands; the counters already lenient-default). A save banked under the old 1e23 horizon loads with the door standing open — the crossing fires at the next reset boundary, banking the linear claim, while the board, tray, life record and lifetime total survive intact; the balance consequence is documented, not silently resolved.

## Evidence

The calibration record lives in `docs/capacity-release-tuning.md` and in two committed suites: `capacity-calibration.test.ts` (the authoritative progression harness — real purchases, practice advancement and prestige; an always-on pacing guard plus the full seed-and-policy tier behind `FLOWSYNTH_CALIBRATION=1`) and `capacity-comparisons.test.ts` (the equal-investment board comparisons across power shapes, formations, chromatic density, duplicates, silent voices, charge, boosters, builds, rarity and mutators). Browser validation of the released surfaces — Catalog and Arete purchase paths, the live readouts, discovery consistency, and large-board interaction at desktop width — rode the dev-server provenance workflow; the phone-viewport capture could not run in the reviewing tool and is asserted by the committed phone-geometry tests instead.

## Consequences

- Pacing is now a guarded property: the committed tier fails if the ordinary era leaves its band or a rebuild collapses, so a future tuning change that silently breaks the ~20-hour contract surfaces in CI.
- Organic boards of ~17 voices in one formation can exhaust the selector's 250k-node budget (~200–300 ms per solve, bounded by the deterministic cap); the read names the result "uncertified" and plays the incumbent. Placement-driven boards in the recorded progressions certified 100% of solves (worst 193 nodes). Scalable certification on pathologically messy boards remains open work.
- The horizon break's overfill claims (ADR-0042) now interact with a reachable horizon: practicing past the crossing multiplies the claim up to the cap, the accelerant for the late Arete ladder. Higher ceilings and deeper discounts remain deferred by design.
- Second-era pacing measured ~60% of the first era rather than the provisional 70%; closing that gap would take a rebuilt-board change outside this calibration's scope and is recorded as the tuning's main residual.
