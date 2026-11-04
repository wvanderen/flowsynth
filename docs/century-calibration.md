# Meaningful progression through 100 credited hours

Status: **historical evaluation restored; current boundary-aware evaluation incomplete** (PR #514 review fixes). The JSON artifacts below are restored byte-for-byte from `9601386^`, with original source fingerprint `8790c6cb`, original recording commits where present, and absent runtime/timezone metadata left absent. They are not re-recordings at this revision. Their old gap summaries omit observation boundaries and cannot establish the absence of long waits. The numeric baseline remains frozen; new measurements use `measurementVersion: 2` and composition refuses legacy gap summaries. The full 80-walk matrix and both continuations need re-recording before a current long-gap verdict. See [the review completion record](evidence/pr514-review/README.md).

Historical evaluation and calibration, 2026-11-04 (issue #492, parent [#484](https://github.com/wvanderen/flowsynth/issues/484), stories 5–9, 33, 42–43). The accepted direction lives in [ADR-0078](adr/0078-breakthroughs-preserve-further-progression-cycles.md); the frozen baseline's decision is [ADR-0079](adr/0079-the-calibrated-century-baseline-is-frozen-for-save-translation.md). The first worthwhile prestige's calibration is [#490's record](first-worthwhile-prestige.md); the later-era and route evidence this evaluation rechecked is [#491's record](later-era-productivity.md).

## What was evaluated

The shipped economy's consequential progression through the declared 100-credited-flow-hour horizon, on the existing scheduled playthrough runner (version 15) invoking real engine actions — no second simulator, no grant, no refund, no shared-balance mutation. The runner gained one declared input for this evaluation: the recipe's **credited-flow stop** (`stopCreditedHours`, issue #492) — a century walk completes at the first between-sessions moment the credited clock reaches the mark, banks per its policy's own rule at every door until then, and the era count stops gating it. The prompt policy's door still fires at every crossing; a century walk simply does not end at its first bank.

The declared matrix: **eight seeds (42, 468, 157, 2026, 7, 99, 11, 23) × two session shapes (two 25-minute daily sessions, two 60-minute) × five policies** — the prompt and pushing policies plus the declared support-seeking, combat-engaging, and enemy-ignoring trio. Eighty walks, each through the full 100 credited hours, budgets 140 baseline / 60 long days. The matrix distinguishes representative walks (the matrix itself), stress fixtures (the declared sparse-acquisition seeds and the anonymized supplied-board continuation), and expected unsuccessful policies (the prompt door policy, whose honest zero-claim banking resets each era at the horizon: 174 banks on the 25-minute slices with the frontier still at zero — recorded, not repaired).

## The calibration decision

The shipped claim curve's depth slope was findings.md's flagged hypothesis (2): each banked advance demanded a full decade of era-earned depth (×10 per era). The recorded walks priced it against the board it governs — a mature board compounds its production roughly ×3–4 per productive era — and the deficit is exactly what they showed: eras lengthening 14 → 15 → 26 credited hours, bankless tails reaching 39 hours inside the mark, and frontier reach stalling near 12 while the enemy ladder's authored decades ran to 2e15.

**The slope ships at 4** (`BALANCE.world.claimDepthSlope`): each banked claim — the declared two-Arete target — now demands ×3.16 of era-earned depth where the shipped hypothesis demanded ×10 for the same two-Arete advance. The entry depth, claim base, horizon, and enemy ladder are untouched — #490's 8–12-hour opening calibration sits at the entry depth, which the slope never reads. The rechecks below confirm the opening and later-era ranges after the change, per the ticket's tuning clause. The claim curve's last hypothesis knob is retired; module identities, the bounded response-support shape (#488), and Tail's bounded lasting growth are unchanged.

**Rack Extenders join the declared purchase rules.** The board's six-row cap is the expansion ceiling the Catalog sells (1 then 2 Arete), and no declared policy ever bought it — the century walks' maturation ceiling is largely cells inside the launch band. After the World's entry, a locked octave row the board reaches now opens before the expansion continues, in every policy's rules (the ignoring policy included: it is board expansion, not a World face). This is declared policy content — a new decision rule reading an existing Catalog product — recorded as such, beside the numeric tuning, not disguised as one.

## The recorded matrix (representative walks)

All 80 walks reached the century mark (`stop.kind` "century"), banked per their policies' own rules, and stayed finite with intact serialized round trips at every sampled state and bank. **The legacy reader recorded no inter-decision gap over two credited hours, but omitted start and terminal waits. This is not evidence of zero long gaps through the whole horizon.** The archived run records show: 715 banks landed across the matrix, and where banking slowed, purchases, placements, and acquisitions kept flowing at mean gaps of 10–20 credited minutes.

Later-era timing classes (the opening era reads the 8–12 window, later eras 5–10; open eras are the explicit incomplete outcomes at the mark):

| slice | in-window | under | over | open | banks | max frontier |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| prompt, 25m | 37 | 129 | 8 | 6 | 174 | 0 |
| pushing, 25m | 27 | 9 | 28 | 8 | 64 | 32 |
| support, 25m | 29 | 5 | 28 | 8 | 62 | 24 |
| combat, 25m | 30 | 4 | 29 | 8 | 63 | 26 |
| ignoring, 25m | 13 | 4 | 28 | 8 | 45 | 16 |
| prompt, 60m | 50 | 52 | 13 | 8 | 115 | 3 |
| pushing, 60m | 22 | 0 | 31 | 8 | 53 | 25 |
| support, 60m | 17 | 0 | 31 | 8 | 48 | 25 |
| combat, 60m | 17 | 0 | 31 | 8 | 48 | 25 |
| ignoring, 60m | 14 | 0 | 29 | 8 | 43 | 19 |
| **total** | **256** | **203** | **256** | **78** | **715** | — |

The prompt classes are the door policy's own shape: each zero-claim reset opens an era the next door closes, so most of its eras are minutes long — the honest read of a policy that cannot sustain century-scale progression. Excluding it, the claim-pushing policies banked 332 claims across the matrix; their later eras land in-window most often on the baseline schedule (roughly half) and drift over-window as the board matures, especially on the long-session shapes and the sparse seeds — every miss rides the recorded rows, never an average.

The representative 60-minute support walks read seed by seed (era: hours/class):

| seed | banks | frontier | era spans |
| --- | ---: | ---: | --- |
| 23 | 9 | 25 | 0:8/in · 1:5/in · 2:6/in · 3:8/in · 4:10/in · 5:11/over · 6:10/in · 7:11/over · 8:14/over · open |
| 468 | 9 | 18 | 0:11/in · 1:6/in · 2:7/in · 3:8/in · 4:9/in · 5:12/over · 6:13/over · 7:14/over · 8:17/over · open |
| 42 | 7 | 14 | 0:20/over · 1:12/over · 2:8/in · 3:9/in · 4:11/over · 5:13/over · 6:17/over · open |
| 99 | 6 | 12 | 0:20/over · 1:8/in · 2:10/in · 3:12/over · 4:16/over · 5:18/over · open |
| 7 | 6 | 13 | 0:17/over · 1:7/in · 2:9/in · 3:12/over · 4:17/over · 5:25/over · open |
| 2026 | 5 | 10 | 0:18/over · 1:11/over · 2:13/over · 3:17/over · 4:20/over · open |
| 11 | 4 | 8 | 0:30/over · 1:26/over · 2:15/over · 3:17/over · open |
| 157 | 2 | 4 | 0:43/over · 1:50/over · open |

## What the runs revealed, and what was tuned

- **Exhausted choices (slope 2): repaired by the slope.** At the shipped hypothesis the walks' productive banking stopped mid-horizon — a seed-23 walk's last bank landed at hour 61 and the walk sat bankless for the remaining 39 credited hours. At the calibrated slope every claim-pushing walk keeps banking through the mark (2–10 banks per century walk; the strongest reach frontier 32). The archived gap read cannot establish that those open-era tails remain decision-rich; that verdict requires the boundary-aware rerun.
- **The maturation ceiling (cell ladder): partially relieved by the Row unlock.** With the unlock in the declared rules, boards reach 41 cells inside a century walk where the launch band capped them near 29. The expansion remains priced-out late (the scaler is 2.5ⁿ) — the over-window drift at depth is the honest residue, and cheapening the ladder was probed and rejected: under the declared cell-first rule it starves level sweeps and lengthens the late eras it was meant to shorten.
- **Capacity ladder and Arete sinks: saturated, recorded.** The Poly Expander's four rungs, the two bays, the discounts, and the Hone ladder's four ranks all complete inside the century for the offerings-first policies; the support and combat policies' World lines consume their claims first. Charge Columns remain the open-ended sink. Extending the ladders needs an Arete-income rebalance beyond this ticket's scope — recorded in the baseline's limitations.
- **Numeric limits: none engaged.** Maxima across all 80 walks: era-earned 7.5e14, nous 2.2e14, rate 1.2e11 ν/s. The float64 representation holds the target range with wide margin, so the larger-representation clause of the ticket did not engage. Every snapshot's finite read passed, and the real save seam serialized every sampled bank, stride, and final state with exact monetary round trips.
- **The prompt door policy: expected unsuccessful, recorded.** Zero-claim banking resets the era at the horizon before the entry depth's claim can form, so the frontier never opens; the walks bank 115–174 honest zeros each and reach no World face. The policy's door remains exactly what #490 calibrated it to be — the opening's eligibility read — and its century-scale failure is the recorded argument for the claim-pushing rules.

## The rechecks after the change

**The opening's 8–12-hour range (#490's calibration): unmoved.** The eligibility doors recorded by the re-run [first-prestige matrix](first-prestige-results.json) are identical to the shipped calibration (25-minute doors 5.4–16.7 credited hours, median ~11 — the door reads the horizon and entry, which the slope never touches), and the worthwhile-prestige journeys still complete: pushing 25m lands 1 in-window (8.33h), 2 under, 2 over, 3 bank-only; pushing 60m lands 2 in-window (11h, 8h), 4 over, 1 unreached, 1 bank-only. The sparse seeds' over-window doors are the same recorded variance #490 carried.

**The later eras' 5–10-hour range (#491's evaluation): re-recorded at the calibrated slope** — [results](later-era-results.json), 48 walks plus the route probes. The distributions: 64 of 119 closed later eras in-window (against 31 of 86 at the shipped hypothesis), 7 under, 48 over, and 35 of 48 walks complete all four declared banks (against 15). The no-refund route probes at the walk's exact bank states (frontiers 2, 6, 9, 11) all advanced through the engine's own purchase orders with currency and finite checks intact. Two honest deteriorations are recorded, not smoothed: at the calibrated slope a route continuation can bank its claim before its weapon's fight resolves, so the fighting demonstration lives in the support walks' defeats rather than in every probed order; and the first later era's fixed rebuild ramp now consumes more than half of many closed eras — the **new-frontier-effort criterion remains #491's standing unmet record** (0 of 119 closed eras spend a new-territory majority), with the faster-return mark itself still holding (104 of 119 re-walk prior depth faster). A steeper slope would serve that criterion and break the century coverage; the trade is recorded here for the maintainer's scope decision that #491's doc already asks for.

## The stress fixtures

**Sparse/unlucky acquisition: declared from the matrix, measured in every row.** Seeds 11 and 42 are the declared sparse-acquisition fixtures (`SPARSE_ACQUISITION_SEEDS`) — their recorded roll acceptances per credited hour and distinct acquired designs sit at the matrix floor (seed 11's opening era alone spans 30 credited hours at 60-minute sessions). They are matrix seeds walked by the same recipes — never a hand-built lucky or unlucky board. The supplied-board continuation is **never** counted as acquisition pacing: it is a retained collection.

**The anonymized supplied-board topology: two declared continuations, never pooled into the matrix.** The fixture rebuilds the reported player's end state through the engine's own creation seams — 35 modules at level 1504 (the deepest level whose invested sum stays finite: 1.65e308; the reported 1506 is two past it, which is exactly why the original save's invested figures serialized to null), the launch band's compact frontier with both Row unlocks declared, merge tiers through the roster's shape, every enemy discovered and alive, one prestige banked, Catalog entry owned, no deployed World rig. The aggregate facts are the parent's; the layout, tier, and type-mix values are anonymized-synthetic, and the private save is never committed.

- **Raw:** the un-translated position. The retained levels bank a frontier of 684 Arete in their first hour; the next era re-grows through 69 credited hours to a token 3-Arete bank at frontier 687, and every era after that stays open through the mark — the depth the curve would demand (≈10^171 era-earned per advance) is unreachable from any reset board. The stranding the save translation (issue #493) exists to repair, recorded, never silently repaired here.
- **Collection-reset:** the retained collection as one honest calibrated reset leaves it (levels reset by the shipped prestige rule; tiers, designs, and layout stand; the claimed frontier at zero). Its century walk banks calibrated claims through the mark — the topology's evidence that the calibrated economy sustains meaningful play from the reported position once translated, and the grounding for #493's retention table.

## The frozen baseline

`docs/century-calibration-baseline.json` compiles the calibrated curve and entitlement figures a save translation reads — the claim curve (entry 2e7, base 2, slope 4), the enemy ladder's thresholds and stats, the World purchase ladders, the capacity ladder, the response-support shape, the level and cell price curves, the opening grant, and the schema and runner versions — beside the recorded evidence's representative run and the limitations above. The figures are compiled from the shipped constants and asserted beside them in `tools/century.test.ts`, so the baseline cannot drift from the engine silently; a change to any frozen figure must re-run this evidence and re-freeze (ADR-0079). The translation that consumes it is #493's scope.

## Reproduction and source provenance

After `npm install`, with committed source, select the declared runtime (for example `mise exec node@$(cat .node-version) -- npm run preflight`). Bare recorder invocations now refuse an incompatible runtime before compiling or loading inputs. The commands below explicitly use the runtime selector:

The restored files are historical: regenerate **all** slices and fixtures before composing; do not mix legacy and version-2 gap measurements.

```sh
# One slice per session shape × policy (ten slices; each walks eight centuries)
node tools/run-supported.mjs tools/record-century.mjs slice 25:prompt
node tools/run-supported.mjs tools/record-century.mjs slice 25:pushing
node tools/run-supported.mjs tools/record-century.mjs slice 25:support
node tools/run-supported.mjs tools/record-century.mjs slice 25:combat
node tools/run-supported.mjs tools/record-century.mjs slice 25:ignoring
node tools/run-supported.mjs tools/record-century.mjs slice 60:prompt
node tools/run-supported.mjs tools/record-century.mjs slice 60:pushing
node tools/run-supported.mjs tools/record-century.mjs slice 60:support
node tools/run-supported.mjs tools/record-century.mjs slice 60:combat
node tools/run-supported.mjs tools/record-century.mjs slice 60:ignoring
# The fixture pair is recorded separately; compose only reads it.
node tools/run-supported.mjs tools/record-century.mjs fixture raw
node tools/run-supported.mjs tools/record-century.mjs fixture collection-reset
# Compose the report and explicitly re-freeze after reviewing the evaluation.
node tools/run-supported.mjs tools/record-century.mjs compose
```

The restored ten slices and [composed report](century-calibration-results.json) retain their historical recording commits and compiled engine fingerprint. New composition verifies each slice's fingerprint byte for byte and its commit's ancestry, requires version-2 gap measurements, preserves each input's actual environment (including legacy absence) in `recordingInputs`, and labels its own environment separately as `compositionEnvironment`. The equivalent `FLOWSYNTH_CENTURY_SLICE` / `FLOWSYNTH_CENTURY_REPORT` vitest gates invoke this same recorder. Ordinary suite runs skip the multi-hour evaluation; the always-on cases in `tools/century.test.ts` pin the matrix declaration, the century stop's mechanics, the classification windows, the fixture construction, boundary-gap reads, and the frozen-figure comparison. The rechecks re-recorded their own evaluations: `FLOWSYNTH_FIRST_PRESTIGE_REPORT` and `node tools/record-later-eras.mjs slice … | compose`.

## Every acceptance criterion beside its evidence

| #492 criterion | Named verification / recorded evidence | Class and outcome |
| --- | --- | --- |
| Scheduled runs through 100 credited hours across the eight seeds, both session shapes, prompt/pushing plus support/combat/ignoring; representative runs, stress fixtures, and expected unsuccessful policies distinguished | All 80 rows in `docs/century-calibration-results.json`, every row `stop.kind` "century" with ≥100 credited hours; `tools/century.test.ts` "declares the eight seeds, two session shapes, five policies, the mark, and the windows" and "completes at the mark"; the prompt slices' zero-frontier rows and the sparse-fixture declaration (`SPARSE_ACQUISITION_SEEDS`) | automated + historical recording; current boundary-aware matrix unavailable — multi-hour tier not rerun in this fix session |
| Sparse/unlucky acquisition and the anonymized supplied-board topology included; no retained collection as fresh-start pacing evidence | The sparse seeds ride the matrix rows (acquisition reads per row); `suppliedBoardState()` construction case in `tools/century.test.ts` "builds the reported position through the engine's own seams"; both fixture continuations ride `kind: "continuation"` in the composed report and never join the distributions | automated + recorded |
| Productive prestiges, newly reachable investments, build/placement changes, combat advantage, and gaps recorded; long decision-free periods as failures | Per-run `claims`, era `rateAtBank` (the pre-reset rate each bank erased) with claim and frontier per era, `investments` (first-reach timeline with credited hour and era), era `purchases`/`placements`/`defeats`, and the whole-run gap read with `LONG_GAP_CREDITED` = two credited hours; the archived **zero inter-decision gaps** result is superseded: start and terminal waits were not measured; `tools/century.test.ts` "decision gaps at observation boundaries" now covers no decisions, first waits, terminal waits, closed eras, and uninterrupted cross-bank waits. Whole-run waits cross banks; era waits are clipped, so counts need not sum. `decisionGapsOk: false` records an evaluation failure even when the walk completes. Combat advantage in the slices' defeat ledgers (support 60m: defeats on most seeds; ignoring: zero defeats, longer eras). The gaps are the affordable-action gaps: the declared policies attempt every affordable action each break, so a recorded gap is precisely a stretch where nothing was affordable and nothing was found — each attempted-but-unaffordable action rides the record with the engine's own decline reason | automated boundaries + historical recordings; current long-gap verdict unavailable pending rerun |
| Integrated economy tuned where runs reveal exhaustion, waiting, dominant builds, or numeric limits; opening and later ranges rechecked; module identities and bounded lasting growth preserved | The slope calibration (this doc's decision section) with the slope-2 exhaustion evidence; `world.test.ts` "the frontier curve ships the calibrated entry and the century-calibrated slope"; the rechecks section above (first-prestige results re-recorded, later-era results re-recorded); #488's bounded response shape and every module profile untouched | automated + recorded |
| Finite supported-range rates, prices, earnings, balances, reserves/meters, claims, and serialized output throughout; larger representation only if target play requires it | Recorder asserts `stateNumbersFinite` and finite rates at every snapshot of every walk, `noGrant` per run, and serialize→deserialize round trips with exact monetary fields at every bank, stride, and final state; the explicit recorder tier exercises serialized reads on both fixture walks; the always-on fixture cases only establish construction and finite rate, not a serialized century walk; that stronger current-source verification remains unavailable pending the explicit tier; maxima recorded per run (era-earned ≤ 7.5e14) — the larger-representation clause did not engage | automated + recorded |
| Reproducible recipes, source provenance, trajectories, policy distributions, explicit unreached outcomes, criterion-to-evidence record; long-running evidence behind an explicit tier with fast regressions retained | Every row carries its recipe-driven clocks, coarse per-hour trajectory, and honest stop; the slices + compose commands above with fingerprint-and-ancestry provenance; the `FLOWSYNTH_CENTURY_SLICE`/`_REPORT` gates; always-on `tools/century.test.ts` boundary and baseline cases plus `tools/calibration-evidence.test.ts` verifying the published matrix, slices, fixtures, and rechecks; open eras, unreached fixtures, and over-window eras explicit in the JSON and the tables above | automated + recorded |
| The calibrated curve/entitlement baseline frozen for save translation; remaining limitations documented honestly; completion not claimed from a terminating run or green suite | `docs/century-calibration-baseline.json` (ADR-0079) with the compiled figures, the representative run, and six named limitations; `tools/century.test.ts` "matches every frozen figure to the committed save-translation baseline" compares the compiled figure set against the restored artifact (excluding the recording's source fingerprint); this table maps every criterion, including the unmet ones recorded beside #491's standing blocker | automated + recorded |

The changed surfaces are engine, tooling, and documentation only — no player-facing UI surface changed, so no desktop/phone capture is owed; the runner's new recipe input rides the same seam as #491's era count, which the terminal's `run` catalog never exposed.
