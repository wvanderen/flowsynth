# Later-era productivity and no-refund recoverability

**Acceptance remains blocked on parent story 26 (later-era pacing).** The effort/rebuilding repair below is supported, but only 47 of 115 closed later eras (41%) occupy the requested 5–10 credited hours, versus 64 of 119 (54%) before the repair; the 25-minute schedules reach just 10 of 48. The current evidence does not establish that later productive eras *generally* meet that range. Recording these misses is not a waiver: acceptance requires further validated calibration or an explicit maintainer-approved scope change recorded on #484. Neither is established by this revision. The timing evaluation is complete; the pacing requirement is not.

**Status: the effort criteria are met by the recorded balance repair (2026-11-07).** The claim grant funds each banked claim's next attempt and the claim slope re-prices at 2.5 ([ADR-0086](adr/0086-the-claim-grant-funds-each-attempts-rebuild.md), issue #484's later-era repair) — the validated balance repair the status lines below asked for, not a scope decision. The whole evaluation re-recorded through the durable job at that calibrated engine — fingerprint `ed2bd449`, runner 15, recording commit `a139bbe` — as 71 persisted work units (48 seed walks, the probe walk, and 22 derived route forwards). The generated section below owns the figures: **91 of 115 closed later eras hold a new-territory majority** (was 0 of 119 across three re-records), **0 spend more than half their era rebuilding** (was 107 of 119), **115 of 115 re-walk the previous bank's depth faster**, 48 of 48 walks read `noGrant`, and all 22 probed route orders advanced strictly within budget at the walk's own banks (frontiers 2, 4, 7, 9). The 5–10 credited-hour window reads 47 of 115 closed eras in-window (37 of 67 on the 60-minute shapes, 10 of 48 on the 25-minute shapes), with 34 under, 34 over, and 18 open eras explicit — the window is a validation range, not a timer, and the sparse seeds' long eras stay recorded misses.

PR #514 provenance correction: the linked results and all six slices are byte-for-byte restorations from `9601386^`, with their historical fingerprint `8790c6cb` and original recording commits. Missing environment metadata stays missing. These are not new measurements at the review-fix revision; see [the review completion record](evidence/pr514-review/README.md).

**The #507 re-record (2026-11-06, superseded by the repair above).** Issue #507 rebuilt the recording as one resumable job, and the whole evaluation was re-recorded through it at the current engine — fingerprint `ccab0a92`, runner 15, recording commit `6727d04` — as 69 persisted work units (48 seed walks, the probe walk, and 20 derived route forwards). The distribution reproduces the #492 recheck's recording: 64 of 119 closed later eras in the 5–10 credited-hour window, 7 under, 48 over, 12 open, and 35 of 48 walks complete all four declared banks. The per-era reads, recomputed from this report: 104 of 119 closed eras re-walk the previous bank's depth in less credited time than its first development; 107 spend more than half their era rebuilding; 0 of 119 carry a new-territory majority. **The new-frontier-effort criterion therefore remained unmet**, on the same recorded trade the recheck paragraph below documents — until the ADR-0086 repair. [The demonstration record](evidence/issue-507/README.md) shows the job surviving three real interruptions with every completed unit reused.

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

The six slice files, [the probe evidence](later-era-probe.json), and the [composed results](later-era-results.json) were re-recorded at source commit `a139bbe`, runner 15, fingerprint `ed2bd449`, on the declared runtime (v22.23.4, `America/Chicago`). Each artifact carries its publication's recording commit and fingerprint; each slice and the probe evidence additionally carry `unitProvenance` — every unit's original recording commit, environment, and full behavior-affecting identity. Composition verifies those identities against current inputs (including evaluation versions and forward-only budgets), the compiled source byte for byte, that every unit's commit is an ancestor of the composing checkout, the full seed matrix and exact affordable-order set without duplicates, and every persisted forward, and it runs no walks: the route continuations are persisted work units, never hidden composition steps.

One supported interface records the evaluation (issue #507, [ADR-0083](adr/0083-the-later-era-evaluation-records-as-one-resumable-job.md)). After `npm install`, with committed source:

```sh
# Launch the whole declared evaluation (48 seed walks + probe walk + forwards).
# --detach hands it to a detached supervisor and returns immediately; --notify
# runs once at the terminal state. Omit --detach to watch it in the foreground.
node tools/record-later-eras.mjs run --detach --jobs 5 \
  --notify 'notify-send "later-era evaluation" "$FLOWSYNTH_JOB_STATUS"'

# Observe completed/remaining units, failures, elapsed time, worker memory.
node tools/record-later-eras.mjs status

# After the job completes: verify completeness and provenance, publish the report.
node tools/record-later-eras.mjs compose
```

`run 25:support` (any `<25|60>:<support|combat|ignoring>`) records only that slice's units; `status --dir` points at a specific job directory. Every completed unit is persisted atomically under its own identity — the compiled engine and runner source, the full recipe (seed, schedule shape, calendar basis, budgets, stops), the evaluation-logic version, the allocation solver's declared budget, and the runtime — so a relaunch reuses exactly the units whose behavior-affecting inputs still match and re-executes missing, failed, or invalidated ones. Report-format changes never discard completed evidence. Corrupt or duplicate-shaped units are rejected, their bytes preserved under the job's `logs/corrupt/`. Workers run in separate processes with bounded concurrency (`--jobs`) and an explicit per-worker heap budget (`--worker-mb`); SIGTERM cancels active supervision cleanly (status `cancelled`, workers stopped). After a supervisor-only crash, the next launch takes its stale lock and waits for all registered old workers to finish before recompiling, cleaning temporaries, scanning, or starting replacements. Worker pid leases are durable before IPC authorizes computation. Cancelling that recovery records `cancelled` and notifies, leaving the old workers registered for the next resume rather than signalling possibly recycled pids. Detached preflight never writes the live job's bundle; relative `--dir` paths work for foreground and detached launches.

**Published-evidence migration (#519).** Composition now requires `unitProvenance[id].identity`, not just commit/environment stamps. The seven #507 input artifacts were enriched from their original 69 verified persisted units: every row, route-forward result, recording commit, and environment was compared unchanged. This was metadata recovery, not a new measurement or a current-identity restamp. For another identity-less publication, re-publish from its verified original job units; if they are unavailable, re-record. Before upgrading a pre-lease working directory, stop its old workers; completed units still reuse normally.

The smoke tier drives the same pipeline in seconds (`node tools/record-later-eras.mjs smoke slice|run|compose`, isolated output only). The `FLOWSYNTH_LATER_ERA_REPORT` / `FLOWSYNTH_LATER_ERA_SLICE` vitest gates invoke the same recorder; ordinary suite runs skip the multi-hour evaluation. After any re-record and compose, regenerate this report's generated figures — the distribution table and the mechanical verdicts — with `node tools/run-supported.mjs tools/render-report-figures.mjs write` (issue #512); the suite's staleness check (`tools/report-figures.test.ts`) fails while the committed section disagrees with the recorded JSON. Handwritten interpretation around the generated section is never touched by regeneration, and a rerun that moves the figures obliges a fresh read of that interpretation.

All 48 rows read `noGrant: true`. The recorder checks finite state and rates at every recorded snapshot, not only after resets. Every closed era advances the frontier strictly; closing-session facts, repeated kills, snapshot clocks, and crossing/split agreement are checked during recording and again at composition.

## Durations and the effort criterion

Later eras classify against roughly 5–10 credited hours; era 0 has its own 8–12-hour opening target and is not classified here. The report retains each seed's durations, routes, gaps, and incomplete outcome, not an average alone. The distribution and the mechanical reads in the generated section below are derived from the recorded JSON — the 2026-11-07 re-record at the claim grant and slope 2.5 (ADR-0086) — and are never hand-edited.

<!-- report-figures:later-era begin (regenerate: node tools/run-supported.mjs tools/render-report-figures.mjs write) -->
Source evidence: [`later-era-results.json`](later-era-results.json) — 48 recorded walks composed from the six published slices and the probe evidence; engine fingerprint `ed2bd449`, composed at recording commit `a139bbe`. Every input's own recording commit and environment ride the results file: `docs/later-era-slice-25-support.json` at a139bbe (v22.23.4 on America/Chicago); `docs/later-era-slice-25-combat.json` at a139bbe (v22.23.4 on America/Chicago); `docs/later-era-slice-25-ignoring.json` at a139bbe (v22.23.4 on America/Chicago); `docs/later-era-slice-60-support.json` at a139bbe (v22.23.4 on America/Chicago); `docs/later-era-slice-60-combat.json` at a139bbe (v22.23.4 on America/Chicago); `docs/later-era-slice-60-ignoring.json` at a139bbe (v22.23.4 on America/Chicago); `docs/later-era-probe.json` at a139bbe (v22.23.4 on America/Chicago).
Generated from the recorded JSON alone — no simulation; regenerate with `node tools/run-supported.mjs tools/render-report-figures.mjs write` and review the diff. The recorded rows are the only numerical truth in this section.

| Policy / session length | In 5–10h | Under | Over | Open at stop |
| --- | ---: | ---: | ---: | ---: |
| support / 25m | 3 | 9 | 8 | 3 |
| combat / 25m | 3 | 9 | 8 | 3 |
| ignoring / 25m | 4 | 7 | 8 | 4 |
| support / 60m | 13 | 3 | 3 | 2 |
| combat / 60m | 13 | 3 | 3 | 3 |
| ignoring / 60m | 11 | 3 | 4 | 3 |
| **Total** | **47** | **34** | **34** | **18** |

31 of 48 walks complete all four declared banks; 17 stop at their day budget with 1–3 banks banked. Across 115 closed later eras:

- **Faster familiar return:** 115 re-walk the previous bank's depth in less credited time than its first development; 0 do not.
- **Rebuilding:** 115 regain the previous production within half their era; 0 spend more than half rebuilding — recorded misses of the rebuilding bar, not passes rescued by a majority elsewhere.
- **New territory:** 91 eras hold a recorded new-territory share above one half.
- **Cadence:** 34 closed later eras exceed ten credited hours. The record evaluates the requested window honestly; it does not establish that the shipped deeper eras generally meet it.

Mechanical verdicts — each names its criterion, its observed read, and its state, derived from the figures above:

| Criterion | Observed read | State |
| --- | --- | --- |
| New-territory majority of era effort (#491) | 91 of 115 closed eras hold a new-territory share above one half | met by the recorded majority |
| Rebuilding not most of later eras (#491) | 0 of 115 closed eras spend more than half rebuilding | met |
| Faster familiar return (#491) | 115 of 115 closed eras re-walk the previous bank's depth faster | met by the recorded majority |
| Four declared banks per walk (#491) | 31 of 48 walks complete; 17 stop at budget | incomplete — 17 recorded incompletes |
| No grant, no refund (#491) | 48 of 48 walks `noGrant` | met |
| No-refund routes at the probed banks (2, 4, 7, 9) | 22 of 22 orders advanced strictly within budget; route demonstrated at 4 of 4 tested banks | met at the tested states, not extrapolated |

An unmet or incomplete verdict is a recorded finding, never an approved exception: this documentation does not waive it, and resolving it takes a validated balance repair or an explicit maintainer scope decision.
<!-- report-figures:later-era end -->

**The two unmet verdicts are resolved by the recorded calibration, not by a re-read.** The ADR-0086 repair changed exactly two authored figures — the claim grant (`prestigeGrantBase`/`prestigeGrantGrowth`) and the claim slope (4 → 2.5) — with the entry depth, reset boundary, first-prestige calibration, enemy thresholds/stats, and purchase prices untouched. The opening era is structurally unaffected (frontier zero reads the plain opening grant; the slope never reads it), and the first-prestige recheck re-recorded beside this evaluation confirms its distribution. The century horizon re-recorded at the same pair — [the century calibration](century-calibration.md) carries its coverage verdict and the re-frozen baseline (ADR-0079's standing rule).

## Direct no-refund routes at the probed frontiers

The probe enumerates the affordable entry/Column/Hone purchase orders at the exact unspent bank states of the declared seed-23, 60-minute support walk: frontiers **2, 4, 7, and 9**, 22 orders in total. Each order rides real irreversible purchase actions. A structural placement attempt runs on a separate clone, so the probe does not impose its candidate seats on the policy it is testing. Each order's continuation is its own persisted work unit (issue #507): the walk's worker enumerates cheaply with no continuation, and every order's forward executes on a worker process under its own identity before composition reads it — composition runs no walks.

Each branch continues its own exact purchased state through `continuePlaythrough`, the same session/management/advance/prestige walk, using a declared support policy, its remaining currency, a 30-day budget, and a target of one positive Arete. One real positive bank suffices to surpass the starting frontier; no reward is forced at a clock threshold. The continuation's recipe and resulting run identity are carried under that order's `forward` record.

The recorded count — every continued order banking a strictly greater frontier within budget, with the route demonstrated at each tested bank — is generated in the durations section above and not restated by hand. Every branch carries its actual defeats, credited duration, `noGrant`, `noRefund`, and finite-state result. This establishes routes for these tested states and policies, not universal recoverability for every future build or a guarantee of short recovery.

The policy comparison remains material: in the 25-minute matrix support and combat each defeat enemies on seven of eight seeds (all but 99), and ignoring on none; at 60 minutes support and combat each defeat on three of eight seeds (42, 468, 99), ignoring on none — the longer session reaches the World later and fights less. Seed 23's closed later eras take 2/3/5h under support at 60 minutes. Hone-first spending can leave combat unfed; ignoring still banks positive claims without defeats, paying for postponement in longer eras. Per-era routes show repeated kills and relocations in their actual eras instead of shifting or suppressing them.

## Every acceptance criterion beside its evidence

| #491 criterion | Named verification / recorded evidence | Class and outcome |
| --- | --- | --- |
| Repeated productive eras; banked claims, purchases, deployment, recovery, strictly larger frontiers | `closes the first era at its bank and reads the familiar/new split`; all 48 slice rows, 31 four-bank completions; the recorder asserts each bank's frontier and finite state in every worker; per-era route/marks retain unreached outcomes | automated + recorded; repeated eras demonstrated |
| Faster familiar return, measured new territory, rebuilding not most of later eras | `keeps crossing events, inspection clocks, and the familiar span in agreement`; per-era `familiarFaster`, `newShare`, and `rebuildingShare`; 115/115 faster, 0/115 rebuilding misses, 91/115 new-territory majorities at the ADR-0086 calibration | automated + recorded; met by the recorded majority |
| Evaluate the 5–10h window across policies/seeds/schedules; misses and incomplete runs explicit | `classifies eras: the opening is not a later era, and an open era stays open`; all six distributions above and every per-seed era in the composed results | automated + recorded; evaluation complete, but parent story 26's generally-in-window pacing remains **UNMET — acceptance blocker**, not an approved exception |
| Enumerate affordable no-refund routes; demonstrate configurations surpassing resistance; detect/repair traps without grants/refunds | `enumerates orders without mistaking seats or another branch for forward progress`; negative real continuation and positive labelled-fixture cases; 22 persisted forward units over frontiers 2/4/7/9, all advanced with currency/finite checks; actual defeats establish fighting configurations | automated + recorded; demonstrated at the tested states, not extrapolated universally |
| Support/combat/ignoring comparison; material benefit and possible postponement | `support buys its charge line before its blade; combat its blade before its charge line`; `ignoring never buys or deploys a World occupant, and still banks its claims`; the six recorded slices' durations and defeats | automated + recorded; comparison demonstrated |
| Consequential opportunities and finite state per era; reset/readout preservation; every criterion mapped | Per-era routes/gaps; `keeps facts before a tied bank in the closing era and facts after it in the next`; `owns closing-session defeats and repeated kills in the era that fought them`; recorder checks every snapshot; existing prestige/World/accumulator/app readout tests; artifact round trips including continuations | automated + recorded; mapping is this table, not a suite count |

The changed inspection clock's verified desktop/phone evidence and check results are recorded in [the review-fix evidence](evidence/491-review-fixes/README.md). The dev panel's option catalog and presentation are unchanged by these review fixes; its original addition is documented in [the policy-select evidence](evidence/491-policy-select/README.md).
