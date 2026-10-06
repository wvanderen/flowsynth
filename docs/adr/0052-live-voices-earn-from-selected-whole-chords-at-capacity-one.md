# 0052 — Live voices earn from selected whole chords at capacity one, gated before calibration

Date: 2026-10-06
Status: Accepted (development slice — the ordinary economy stays on its existing path pending full calibration)
Issue: #258

## Context

ADR-0051 proved whole-chord capacity allocation on a development-only board and left the production path on ADR-0049's uncapped recognition. Issue #258 flips the real game onto the authoritative allocation: every voice opens with capacity one — rarity never alters it, spacers conduct without ever consuming — and the board earns from the selected whole chords only. The change reopens and caps what ADR-0049 left uncapped, so the pacing the existing economy was priced against (the 1e23 horizon's runaway stacking) no longer holds. The confirmed design defers rebalancing: prices, thresholds, and the horizon stay put until the calibration ticket validates release.

## Decision

1. **The seam is the default.** `allocateRates` (economy.ts) runs the real rate pass twice — chordless for the per-voice weights, then the whole-chord allocation riding the same pass — and the snapshot carries an `AllocationSummary`: capacity, per-voice used counts, the active instances, and every recognized voice-set. `syncAllocation` is the one engine write (`advance`, and `checkUnlocks` at action boundaries): it threads the state's stored `activeChords` keys as the solver's retention hint and writes the new active keys back. `displayedRates` is the read-only twin the UI renders from, so no surface can answer a different allocation than production runs. `computeRates` keeps its plain recognizer default — a building block, never the live economy.

2. **One accessor owns the budget.** `voiceCapacityOf` returns one; the purchase ladder (#259's global nous Catalog step, the Arete ceiling unlocks, the prestige reset) has exactly one place to land. Capacity is economy-wide, never per-module, and never a function of rarity.

3. **Recognition and activation split cleanly.** Active instances alone populate the bonus terms, the board's full-voice seams, and the rate. Every complete voice-set — idle instances and all-silent sets included — stays on the allocation read: `syncChordDiscoveries` takes `recognizedTermsOf(read)`, so a chord the board sings but the capacity can't afford still names itself in the library and still counts its roots. Recognition parity with the plain recognizer is asserted in the suite. The `power-chord` feat reads `maxVoiceFactorOf` off the allocated analysis — the factor actually earned — via the sync context, never a second uncapped read.

4. **The board distinguishes earning from hearing.** Idle candidates draw their own dotted, dim, never-pulsing marks beneath the active seams; the reserved readout shows the selected voice's `Capacity used/available`, its total earned chord factor, and its final ν/s, with idle chips labeled "idle"; the rate details carry a Capacity leg whose note names idle candidates as "earns nothing"; the library's cards say "singing now" or "heard — not singing". The formation strum celebrates newly *recognized* chords — the discovery moment — on the same recognized basis.

5. **The development gate is explicit.** The issue's first requirement — "each voice starts with capacity one and earns production from the selected whole chords only" in the development-enabled game — is the production *model*, and this slice ships it unconditionally; what stays gated is *release balance*: "the ordinary economy remains on its existing path" reads on the tuning, not on the model — the nous prices, the trial ladder, the horizon figure, the purchase ladders (#259's work), every balance constant stand exactly as #257 left them, and nothing here presents itself as final calibration. `arete-tuning` records the scenario's pacing in its report instead of asserting the old horizon crossing, whose runaway-stacking basis this slice removes; the calibration ticket owns the rebase.

## Consequences

- The live tick, session summaries, achievements, discoveries, and every readout now run the allocation; a board whose solve trips the budget valve renders its certified-false incumbent through the same surfaces (the flag rides `AllocationSummary.certified`).
- Saves grow the lenient-default `activeChords` hint on the standing v8 surface — no version bump, older saves load with an empty hint and recompute deterministically.
- #259 wires the Catalog ladder into `voiceCapacityOf`; #260 builds the placement preview on `allocateRates` over a projected board. Both inherit the retention-hint and recognition seams unchanged.
- Per-tick cost doubles the rate pass and adds the solve; ordinary boards pay milliseconds, and the 250k-node/750ms valve bounds the pathological ones. The calibration ticket owns any latency retuning.
