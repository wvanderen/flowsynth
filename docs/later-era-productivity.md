# Later-era productivity and no-refund recoverability

**Status: evaluation recorded; #491 is not complete.** The second acceptance criterion remains a merge blocker: later eras do not yet spend most of their effort on new territory. This is not an accepted deferral to #492. Completion requires either a validated balance repair or an explicit maintainer decision to change this ticket's scope. No such scope decision is recorded here.

**The #492 recalibration recheck (2026-11-04).** The claim slope's century calibration (issue #492, slope 2 → 4) required re-recording this evaluation at the calibrated engine. The re-recorded [results](later-era-results.json) (48 walks, recording commit `0d17f824`, runner 15) hold the evaluation's shape and move its distribution: 64 of 119 closed later eras land in the 5–10 credited-hour window (against 31 of 86), 7 under, 48 over, and 35 of 48 walks complete all four declared banks (against 15). The route probes at the walk's exact bank states (frontiers 2, 6, 9, 11) all advanced through real purchase orders with no grants or refunds. Two honest readings at the steeper banking cadence: a route continuation can bank its claim by depth growth before its weapon's fight resolves, so the fighting configurations are demonstrated by the support walks' defeats rather than by every probed order; and the fixed rebuild ramp now consumes more than half of most closed eras — the new-territory-majority count fell to 0 of 119. **The new-frontier-effort criterion above therefore remains unmet, now with the steeper-cadence trade recorded:** the century calibration was chosen for horizon coverage (the slope-2 economy's bankless tails reached 39 credited hours inside 100), and serving the effort criterion would take a steeper curve that breaks it. The trade is recorded in [the century calibration](century-calibration.md) for the maintainer's scope decision this doc already calls for. The faster-return mark itself holds: 104 of 119 closed eras re-walk the previous bank's depth in less credited time than its first development.

The specification is [#491](https://github.com/wvanderen/flowsynth/issues/491), parent [#484](https://github.com/wvanderen/flowsynth/issues/484), with the accepted direction in [ADR-0078](adr/0078-breakthroughs-preserve-further-progression-cycles.md). The first worthwhile prestige's separate calibration is [#490's record](first-worthwhile-prestige.md).

## What was evaluated

The shipped economy, through the existing scheduled playthrough runner's real engine actions: no second simulator, hidden balance mutation, grant, or refund. The matrix remains eight seeds (42, 468, 157, 2026, 7, 99, 11, 23), two daily sessions of either 25 or 60 minutes, five-minute breathers, and three policies. Each walk targets four positive banks of at least 2 Arete, within 70 baseline days or 30 long-session days. The policies share the ordinary board-management rules and differ in their World purchases:

- **Support-seeking:** Catalog entry, Columns while affordable, then Hone ranks; the charge line before the blade.
- **Combat-engaging:** Catalog entry, Hone ranks while affordable, then Columns; the blade before the charge line.
- **Enemy-ignoring:** Catalog entry and capacity offerings, no World purchases or deployment; discovered enemies retain their pressure.

The common World placement leg seats weapons beside living discovered enemies and Columns over receiving modules on a charge line. Won fights trigger free between-session relocation. `src/engine/playthrough-placement.ts` owns the structural charge-line predicate used by both the runner and the probe. This policy is not a substitute for the engine's actual charge calculation; a seat alone does not establish a functioning fight.

Each era records its own credited span, bank, strictly larger claimed frontier, production-regained mark, prior-depth crossing, familiar/new split, decisions and gaps, and finite bank state. Actual open eras remain explicit; the zero-duration successor opened at a successful terminal bank is not counted as an incomplete attempted era.

## Review repairs and their regressions

The review found recording defects, not a reason to invent better balance figures:

| Finding | Repair and named regression in `tools/later-eras.test.ts` |
| --- | --- |
| Mid-session crossing and inspection clocks disagreed | Snapshots read the same credited stamp as events. `keeps crossing events, inspection clocks, and the familiar span in agreement` asserts exact equality. Before the fix the baseline fixture's event said 33,180s while its snapshot said 33,000s. |
| Crossing minute counted as new territory | Credit the step on its pre-crossing side, then settle the crossing. The same regression asserts familiar credited seconds equal the crossing mark; it previously differed by 60s. Breather crossings settle before a possible bank, with no practice credit. |
| Closing facts moved into the successor era; repeated kills disappeared | Event order around banks owns each era, even when credited clocks tie. World facts deduplicate per era, while the run summary remains unique. `keeps facts before a tied bank in the closing era and facts after it in the next` and `owns closing-session defeats and repeated kills in the era that fought them` pin those boundaries; the recording tier additionally compares every era's defeats with its pre-bank board. |
| Relocations appeared as purchases | The per-era view treats both placement and relocation events as placements. |
| Another branch's success stood in for a no-refund route | The cheap enumeration carries `forward: null` and never claims advancement. `enumerates orders without mistaking seats or another branch for forward progress` and `continues the exact earned bank without mutating it or inferring the parent's later success` pin the distinction. The latter deliberately gives a real branch only one day and requires `unreached`, despite its parent having a later successful bank. |
| No positive regression for the continuation seam | `banks a strictly greater frontier in a constructed continuation without a grant or refund` exercises the positive terminal with a labelled fast constructed fixture. It is not acquisition or balance evidence. |

A real seed-23, 60-minute support walk now attributes w0 to era 1, w0/w1 to era 2, and w0/w1/w2 to era 3. Its era-1 crossing and inspection both read 42,300 credited seconds; the familiar span is 13,500 seconds, not 13,440. The actual session lengths, purchases, claims, production, and bank dates are unchanged by these recording repairs.

## Reproduction and source provenance

The six slice files and [composed results](later-era-results.json) were re-recorded from source commit `3181bebf6e8e0fb0153b90ed507e0d0ae7478654`, runner 14. Each carries that recording commit and the compiled engine fingerprint `1ae24261`. The explicit recorder compiles through Vite's real raw/glob transform; it does not rely on the content-insensitive vitest fingerprint reported in #503. Composition verifies the source and recording commit of every slice, the full seed matrix, and the branch results.

After `npm install`, with committed source:

```sh
node tools/record-later-eras.mjs slice 25:support
node tools/record-later-eras.mjs slice 25:combat
node tools/record-later-eras.mjs slice 25:ignoring
node tools/record-later-eras.mjs slice 60:support
node tools/record-later-eras.mjs slice 60:combat
node tools/record-later-eras.mjs slice 60:ignoring
node tools/record-later-eras.mjs compose
```

The equivalent `FLOWSYNTH_LATER_ERA_SLICE` / `FLOWSYNTH_LATER_ERA_REPORT` vitest gates invoke this same recorder. Ordinary suite runs skip the multi-hour evaluation. In this re-recording the independent forward-route recording ran alongside the matrix slices, then composed with them after matching the compiled source and recording commit; the commands above reproduce the same measurements without requiring parallel execution.

All 48 rows read `noGrant: true`. The recorder checks finite state and rates at every recorded snapshot, not only after resets. Every closed era advances the frontier strictly; closing-session facts, repeated kills, snapshot clocks, and crossing/split agreement are checked during recording.

## Durations and the unresolved effort criterion

Later eras classify against roughly 5–10 credited hours; era 0 has its own 8–12-hour opening target and is not classified here. The report retains each seed's durations, routes, gaps, and incomplete outcome, not an average alone.

| Policy / session length | In 5–10h | Under | Over | Actually open at budget stop |
| --- | ---: | ---: | ---: | ---: |
| support / 25m | 7 | 2 | 9 | 4 |
| combat / 25m | 7 | 1 | 8 | 4 |
| ignoring / 25m | 4 | 1 | 9 | 6 |
| support / 60m | 5 | 0 | 8 | 6 |
| combat / 60m | 4 | 0 | 9 | 6 |
| ignoring / 60m | 4 | 0 | 8 | 6 |
| **Total** | **31** | **4** | **51** | **32** |

Fifteen of 48 walks complete all four banks. The earlier report counted 48 open later eras because it included 16 empty successors: 15 at completed terminal banks and one at seed 99's 60-minute ignoring bank exactly at the budget stop. The latter walk is still incomplete at three banks, but it never attempted its next era. These unattempted successors are no longer presented as open attempted eras.

Across 86 closed later eras:

- **Faster familiar return:** 78 re-walk the previous bank's depth in less credited time than its first development; eight do not. Faster return alone does not establish a majority of effort on new territory.
- **Rebuilding:** 62 regain the previous production within half their era, while 24 spend more than half rebuilding. The latter are explicit failures of the rebuilding bar, not passes rescued by the majority.
- **New territory:** only 22 eras have a recorded new-territory share above one half. Familiar territory still dominates most walks. The corrected crossing-step accounting does not repair this gameplay shortfall.
- **Cadence:** 51 closed later eras exceed ten hours. The record evaluates the requested window honestly; it does not establish that the shipped deeper eras generally meet it.

**These results do not satisfy the new-frontier-effort requirement.** The review fixes preserve the current entitlement curve, reset boundary, first-prestige calibration, enemy thresholds/stats, and purchase prices. Quietly changing any of these merely to make this recording green would not be a validated calibration and could strand existing saves. #492 is related calibration work, but its existence does not waive #491's requirement. This PR must not close #491 as complete without a balance repair or an explicit scope decision.

## Direct no-refund routes, including frontier 8

The probe enumerates the affordable entry/Column/Hone purchase orders at the exact unspent bank states of the declared seed-23, 60-minute support walk: frontiers **2, 4, 6, and 8**, 17 orders in total. Each order rides real irreversible purchase actions. A structural placement attempt runs on a separate clone, so the probe does not impose its candidate seats on the policy it is testing. An order with no Column correctly fails the immediate rig read; that does not by itself prove a progression trap.

Each branch then continues its own exact purchased state through `continuePlaythrough`, the same session/management/advance/prestige walk, using a declared support policy, its remaining currency, a 30-day budget, and a target of one positive Arete. One real positive bank suffices to surpass the starting frontier; no reward is forced at a clock threshold. The continuation is labelled `kind: "continuation"`, captures its initial state, includes that state in its run identity, and is not fresh-start acquisition evidence. Its recipe and resulting run identity are carried under that order's `forward` record.

All 17 directly continued orders bank a strictly greater frontier within budget. Every tested frontier has a directly demonstrated fighting route, including the route from frontier 8 past frontier 8; every branch carries its actual defeats, credited duration, `noGrant`, `noRefund`, and finite-state result. The last frontier is no longer certified by placement alone. This establishes routes for these tested states and policies, not universal recoverability for every future build or a guarantee of short recovery.

The policy comparison remains material: in the 60-minute matrix support defeats enemies on seven of eight seeds (w2 on three), combat on one of eight, and ignoring on none. Seed 23's later eras take 5/7/10h under support, 5/9/15h under combat, and 5/8/15h under ignoring. Hone-first spending can leave combat unfed; ignoring still banks positive claims without defeats, paying for postponement in longer eras. Per-era routes now show repeated kills and relocations in their actual eras instead of shifting or suppressing them.

## Every acceptance criterion beside its evidence

| #491 criterion | Named verification / recorded evidence | Class and outcome |
| --- | --- | --- |
| Repeated productive eras; banked claims, purchases, deployment, recovery, strictly larger frontiers | `closes the first era at its bank and reads the familiar/new split`; all 48 slice rows, 15 four-bank completions; recorder asserts each bank's frontier and finite state; per-era route/marks retain unreached outcomes | automated + recorded; repeated eras demonstrated |
| Faster familiar return, measured new territory, rebuilding not most of later eras | `keeps crossing events, inspection clocks, and the familiar span in agreement`; per-era `familiarFaster`, `newShare`, and `rebuildingShare`; 78/86 faster, 24/86 rebuilding misses, only 22/86 new-territory majorities | automated + recorded; **UNMET / merge blocker**, no accepted deferral |
| Evaluate the 5–10h window across policies/seeds/schedules; misses and incomplete runs explicit | `classifies eras: the opening is not a later era, and an open era stays open`; all six distributions above and every per-seed era in the composed results | automated + recorded; evaluation complete, timing misses explicit |
| Enumerate affordable no-refund routes; demonstrate configurations surpassing resistance; detect/repair traps without grants/refunds | `enumerates orders without mistaking seats or another branch for forward progress`; negative real continuation and positive labelled-fixture cases; recorded 17 real continuations over frontiers 2/4/6/8, all advanced with currency/finite checks; actual defeats establish fighting configurations | automated + recorded; demonstrated at the tested states, not extrapolated universally |
| Support/combat/ignoring comparison; material benefit and possible postponement | `support buys its charge line before its blade; combat its blade before its charge line`; `ignoring never buys or deploys a World occupant, and still banks its claims`; the six recorded slices' durations and defeats | automated + recorded; comparison demonstrated |
| Consequential opportunities and finite state per era; reset/readout preservation; every criterion mapped | Per-era routes/gaps; `keeps facts before a tied bank in the closing era and facts after it in the next`; `owns closing-session defeats and repeated kills in the era that fought them`; recorder checks every snapshot; existing prestige/World/accumulator/app readout tests; artifact round trips including continuations | automated + recorded; mapping is this table, not a suite count |

The changed inspection clock's verified desktop/phone evidence and check results are recorded in [the review-fix evidence](evidence/491-review-fixes/README.md). The dev panel's option catalog and presentation are unchanged by these review fixes; its original addition is documented in [the policy-select evidence](evidence/491-policy-select/README.md).
