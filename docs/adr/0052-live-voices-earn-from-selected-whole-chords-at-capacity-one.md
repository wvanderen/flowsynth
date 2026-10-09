# 0052 — Live voices earn from selected whole chords at capacity one, gated before calibration

Date: 2026-10-06
Status: Accepted; the development gate (§5, and §1's ordinary/development split) was superseded by the release calibration (ADR-0055, issue #262) — every state rides the allocation economy
Issue: #258

## Context

ADR-0051 proved whole-chord capacity allocation on a development-only board and left the production path on ADR-0049's uncapped recognition. Issue #258 enables the authoritative allocation in the development-enabled game: every voice opens with capacity one — rarity never alters it, spacers conduct without ever consuming — and the board earns from the selected whole chords only. The change reopens and caps what ADR-0049 left uncapped, so the pacing the existing economy was priced against (the 1e23 horizon's runaway stacking) no longer holds. The confirmed design defers rebalancing: prices, thresholds, and the horizon stay put until the calibration ticket validates release.

## Decision

1. **One gate serves production and display.** `allocateRates` (economy.ts) runs the real rate pass twice — chordless for the per-voice weights, then whole-chord allocation riding the same pass — and the snapshot carries an `AllocationSummary`: capacity, per-voice used counts, active instances, every recognized voice-set, and certification. `syncRates` runs `computeRates` for ordinary play and `syncAllocation` for development play; `displayedRates` applies the same gate without writing. Ticks, action-boundary checks, session summaries, achievements, and readouts all use this seam. `syncAllocation` threads the stored `activeChords` keys as the retention hint and writes the new keys back only on the allocation path.

2. **One accessor owns the budget.** `voiceCapacityOf` returns one; the purchase ladder (#259's global nous Catalog step, the Arete ceiling unlocks, the prestige reset) has exactly one place to land. Capacity is economy-wide, never per-module, and never a function of rarity.

3. **Recognition and activation split cleanly.** Active instances alone populate the bonus terms, the board's full-voice seams, and the rate. Every complete voice-set — idle instances and all-silent sets included — stays on the allocation read: `syncChordDiscoveries` takes `summaryTermsOf(snapshot.allocation)`, so a chord the board sings but the capacity can't afford still names itself in the library and still counts its roots. Recognition parity with the plain recognizer is asserted in the suite. The `power-chord` feat reads `maxChordFactorOf` from the final contribution snapshot, including the resonance fold. Tick and action checks pass this earned figure in their sync context; progress and eager load checks use the same gated display pass.

4. **The board distinguishes earning from hearing.** Idle candidates draw their own dotted, dim, never-pulsing marks beneath the active seams; the reserved readout shows the selected voice's `Capacity used/available`, its total earned chord factor, and its final ν/s, with idle chips labeled "idle"; the rate details carry a Capacity leg whose note names idle candidates as "earns nothing"; the library's cards say "singing now" or "heard — not singing". The formation strum celebrates newly *recognized* chords — the discovery moment — on the same recognized basis.

5. **The model stays development-only.** The existing `?dev` switch enables allocation for the live game. `App` applies the runtime opt-in whenever it adopts, imports, resets, or loads a state, before any eager achievement check or elapsed-time accounting. The switch is not serialized: opening a development save in an ordinary tab restores uncapped recognition and production. Ordinary nous prices, thresholds, horizon behavior, and the `arete-tuning` horizon/prestige assertions remain on their existing path pending calibration.

6. **Incumbents are development results, never proof of maximization.** The live development pass uses a deterministic 250k-node budget without a wall-clock cutoff, so machine speed cannot change the selected allocation across display, sync, or reload. Exhausting the node budget still sets `certified: false`. The board readout and rate details visibly say “Allocation uncertified”; the details tooltip explains that maximum production remains unproven. The separate configurable scenario/stress board retains its existing wall-clock safety valve. The universal maximization contract remains a release blocker; this slice does not resolve the large chromatic formations measured in ADR-0051.

## Consequences

- Development ticks, summaries, achievements, discoveries, and readouts use the allocation and expose uncertified incumbents. Ordinary gameplay uses the existing uncapped pass and shows no capacity controls or idle allocation seams.
- Saves grow the lenient-default `activeChords` hint on the standing v8 surface — no version bump, older saves load with an empty hint and recompute deterministically.
- #259 wires the Catalog ladder into `voiceCapacityOf`; #260 builds the placement preview on `allocateRates` over a projected board. Both inherit the retention-hint and recognition seams unchanged.
- Development ticks double the rate pass and add the solve, bounded by the node cap. Ordinary ticks incur no allocator work. Latency retuning and certified maximization remain prerequisites for releasing the new economy.
