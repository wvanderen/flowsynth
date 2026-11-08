# Meaningful progression through 100 credited hours

Status: **evaluation recorded at the shipped calibration (2026-11-07, ADR-0086's claim grant and slope 2.5)**. The full 80-walk matrix, both fixture continuations, and the re-frozen baseline carry the current recording — fingerprint `ed2bd449`, composed at commit `eb4e185`, every row `measurementVersion` 2 (the boundary-aware gap read). The historical paragraphs below keep the slope-4 evaluation's story; the generated section and the recheck paragraph carry the current one.

Historical evaluation and calibration, 2026-11-04 (issue #492, parent [#484](https://github.com/wvanderen/flowsynth/issues/484), stories 5–9, 33, 42–43). The accepted direction lives in [ADR-0078](adr/0078-breakthroughs-preserve-further-progression-cycles.md); the frozen baseline's decision is [ADR-0079](adr/0079-the-calibrated-century-baseline-is-frozen-for-save-translation.md). The first worthwhile prestige's calibration is [#490's record](first-worthwhile-prestige.md); the later-era and route evidence this evaluation rechecked is [#491's record](later-era-productivity.md).

## What was evaluated

The shipped economy's consequential progression through the declared 100-credited-flow-hour horizon, on the existing scheduled playthrough runner (version 15) invoking real engine actions — no second simulator, no grant, no refund, no shared-balance mutation. The runner gained one declared input for this evaluation: the recipe's **credited-flow stop** (`stopCreditedHours`, issue #492) — a century walk completes at the first between-sessions moment the credited clock reaches the mark, banks per its policy's own rule at every door until then, and the era count stops gating it. The prompt policy's door still fires at every crossing; a century walk simply does not end at its first bank.

The declared matrix: **eight seeds (42, 468, 157, 2026, 7, 99, 11, 23) × two session shapes (two 25-minute daily sessions, two 60-minute) × five policies** — the prompt and pushing policies plus the declared support-seeking, combat-engaging, and enemy-ignoring trio. Eighty walks, each through the full 100 credited hours, budgets 140 baseline / 60 long days. The matrix distinguishes representative walks (the matrix itself), stress fixtures (the declared sparse-acquisition seeds and the anonymized supplied-board continuation), and expected unsuccessful policies (the prompt door policy, whose honest zero-claim banking resets each era at the horizon: 174 banks on the 25-minute slices with the frontier still at zero — recorded, not repaired).

**The slope re-prices at 2.5 (2026-11-07, ADR-0086).** The later-era effort repair (#491's standing unmet record) showed the slope-4 cadence could not serve both horizons: with every reset returning the board to a 12ν opening grant, each later era spent most of its credited time below the previous bank's depth regardless of demand — 0 of 119 closed eras carried a new-territory majority across three re-records. The repair adds the **claim grant** (base × growth^claimed-frontier, paid beside a banked claim's Arete): the next attempt starts its rebuild at roughly the previous bank's production instead of re-crawling the level ladder. With the rebuild compressed, the same demand that matched production growth left the push beside each claim too short to carry an era, so the slope re-prices at **2.5** — each banked two-Arete claim now demands ×6.3 of era-earned depth. The entry depth, claim base, horizon, enemy ladder, and every module figure stay exactly as calibrated above; the opening era is structurally untouched (frontier zero reads the plain opening grant; the slope never reads it). The recorded century walks at this pair still bank through the mark (2–15 productive banks per walk, 685 across the matrix, frontier 14–30 on the claim-pushing rows — and the deeper reach defeats the whole authored roster, where the slope-4 recording reached w0–w6), and the later-era window's coverage holds with the effort criteria met — [the later-era record](later-era-productivity.md) owns that distribution. The re-freeze below carries the new figures.

## The calibration decision

The shipped claim curve's depth slope was findings.md's flagged hypothesis (2): each banked advance demanded a full decade of era-earned depth (×10 per era). The recorded walks priced it against the board it governs — a mature board compounds its production roughly ×3–4 per productive era — and the deficit is exactly what they showed: eras lengthening 14 → 15 → 26 credited hours, bankless tails reaching 39 hours inside the mark, and frontier reach stalling near 12 while the enemy ladder's authored decades ran to 2e15.

**The slope ships at 4** (`BALANCE.world.claimDepthSlope`): each banked claim — the declared two-Arete target — now demands ×3.16 of era-earned depth where the shipped hypothesis demanded ×10 for the same two-Arete advance. The entry depth, claim base, horizon, and enemy ladder are untouched — #490's 8–12-hour opening calibration sits at the entry depth, which the slope never reads. The rechecks below confirm the opening and later-era ranges after the change, per the ticket's tuning clause. The claim curve's last hypothesis knob is retired; module identities, the bounded response-support shape (#488), and Tail's bounded lasting growth are unchanged.

**Rack Extenders join the declared purchase rules.** The board's six-row cap is the expansion ceiling the Catalog sells (1 then 2 Arete), and no declared policy ever bought it — the century walks' maturation ceiling is largely cells inside the launch band. After the World's entry, a locked octave row the board reaches now opens before the expansion continues, in every policy's rules (the ignoring policy included: it is board expansion, not a World face). This is declared policy content — a new decision rule reading an existing Catalog product — recorded as such, beside the numeric tuning, not disguised as one.

## The recorded matrix (representative walks)

All 80 walks reach the century mark (`stop.kind` "century"), bank per their policies' own rules, and stay finite with intact serialized round trips at every sampled state and bank — in the current recording (the generated section below) as in the slope-4 historical one. The historical recording's legacy gap reader omitted start and terminal waits; the current recording measures them (version 2) and reads **0 inter-decision gaps at or above the declared two credited hours**. The slope-4 archived run records showed 715 banks landed across the matrix; the calibrated pair's 685 banks are each deeper (the generated table owns the counts).

Later-era timing classes (the opening era reads the 8–12 window, later eras 5–10; open eras are the explicit incomplete outcomes at the mark):

<!-- report-figures:century begin (regenerate: node tools/run-supported.mjs tools/render-report-figures.mjs write) -->
Century figures composed from the recorded matrix — engine fingerprint `ed2bd449`, composed at recording commit `49b414f`. The rows carry no per-unit provenance; absence is recorded as absence, never invented.
Generated from the recorded JSON alone — no simulation; regenerate with `node tools/run-supported.mjs tools/render-report-figures.mjs write` and review the diff. The recorded rows are the only numerical truth in this section.

| slice | in-window | under | over | open | banks | max frontier |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| prompt, 25m | 35 | 128 | 10 | 7 | 173 | 0 |
| pushing, 25m | 19 | 21 | 22 | 8 | 62 | 30 |
| support, 25m | 14 | 20 | 25 | 8 | 59 | 20 |
| combat, 25m | 15 | 19 | 24 | 8 | 58 | 20 |
| ignoring, 25m | 6 | 10 | 22 | 7 | 38 | 14 |
| prompt, 60m | 50 | 54 | 13 | 7 | 117 | 2 |
| pushing, 60m | 29 | 7 | 20 | 8 | 56 | 22 |
| support, 60m | 21 | 3 | 19 | 8 | 43 | 14 |
| combat, 60m | 21 | 3 | 19 | 8 | 43 | 14 |
| ignoring, 60m | 14 | 3 | 19 | 8 | 36 | 13 |
| **total** | **224** | **268** | **193** | **77** | **685** | — |

Excluding the prompt rows, the claim-pushing policies bank 395 nonzero claims across the matrix; banks per claim-pushing walk run 2–15. The prompt rows bank 290 doors of which 288 are honest zeros, with a final frontier no higher than 2.

The representative 60-minute support walks read seed by seed (era: hours/class):

| seed | banks | frontier | era spans |
| --- | ---: | ---: | --- |
| 42 | 7 | 14 | 0:20/over · 1:7/in · 2:7/in · 3:7/in · 4:9/in · 5:10/in · 6:15/over · open |
| 468 | 7 | 14 | 0:11/in · 1:4/under · 2:5/in · 3:6/in · 4:7/in · 5:9/in · 6:12/over · open |
| 157 | 2 | 4 | 0:43/over · 1:44/over · open |
| 2026 | 5 | 10 | 0:18/over · 1:7/in · 2:9/in · 3:17/over · 4:36/over · open |
| 7 | 5 | 10 | 0:17/over · 1:5/in · 2:7/in · 3:15/over · 4:35/over · open |
| 99 | 6 | 12 | 0:20/over · 1:6/in · 2:9/in · 3:8/in · 4:13/over · 5:20/over · open |
| 11 | 5 | 10 | 0:30/over · 1:18/over · 2:16/over · 3:14/over · 4:13/over · open |
| 23 | 6 | 14 | 0:8/in · 1:2/under · 2:3/under · 3:5/in · 4:6/in · 5:5/in · open |

Mechanical verdicts — each names its criterion, its observed read, and its state:

| Criterion | Observed read | State |
| --- | --- | --- |
| Walks through the 100-credited-hour mark (#492) | 80 of 80 matrix rows stop at the century mark with at least 100 credited hours | met |
| Finite state and exact serialized round trips (#492) | 80 of 80 rows read finite at every sampled snapshot; 80 of 80 serialized every sampled bank, stride, and final state with exact monetary round trips | met |
| No grant, no refund (#492) | 80 of 80 walks `noGrant` | met |
| Long decision-free periods recorded as failures (#492) | gap read at the declared 7200s threshold: 0 inter-decision gaps at or above it, measured across starts, terminals, and whole-run spans | **met** |
| Expected-unsuccessful prompt policy distinguished (#492) | 288 of 290 prompt banks are zero-claim; final frontier at most 2 across its rows | recorded as the expected unsuccessful policy — the distinction holds |
| Sparse seeds and supplied-board continuations included, never pooled (#492) | the sparse seeds (11, 42) ride the matrix rows; both continuations stand outside the 80 matrix rows | met |

An unmet or incomplete verdict is a recorded finding, never an approved exception: this documentation does not waive it, and resolving it takes the declared boundary-aware re-recording or an explicit maintainer scope decision.
<!-- report-figures:century end -->

The prompt classes are the door policy's own shape: each zero-claim reset opens an era the next door closes, so most of its eras are minutes long — the honest read of a policy that cannot sustain century-scale progression (the generated verdict records the observed shape). Excluding it, the claim-pushing policies bank 426 nonzero claims across the matrix — the generated table above owns the count; their later eras land in-window most often on the baseline schedule (roughly half) and drift over-window as the board matures, especially on the long-session shapes and the sparse seeds — every miss rides the recorded rows, never an average.

## What the runs revealed, and what was tuned

- **Exhausted choices (slope 2): repaired by the slope.** At the shipped hypothesis the walks' productive banking stopped mid-horizon — a seed-23 walk's last bank landed at hour 61 and the walk sat bankless for the remaining 39 credited hours. At the calibrated slope every claim-pushing walk keeps banking through the mark (2–14 banks per century walk; the strongest reach frontier 32). The archived gap read cannot establish that those open-era tails remain decision-rich; that verdict requires the boundary-aware rerun.
- **The maturation ceiling (cell ladder): partially relieved by the Row unlock.** With the unlock in the declared rules, boards reach 41 cells inside a century walk where the launch band capped them near 29. The expansion remains priced-out late (the scaler is 2.5ⁿ) — the over-window drift at depth is the honest residue, and cheapening the ladder was probed and rejected: under the declared cell-first rule it starves level sweeps and lengthens the late eras it was meant to shorten.
- **Capacity ladder and Arete sinks: saturated, recorded.** The Poly Expander's four rungs, the two bays, the discounts, and the Hone ladder's four ranks all complete inside the century for the offerings-first policies; the support and combat policies' World lines consume their claims first. Charge Columns remain the open-ended sink. Extending the ladders needs an Arete-income rebalance beyond this ticket's scope — recorded in the baseline's limitations.
- **Numeric limits: none engaged.** Maxima across all 80 walks: era-earned 7.5e14, nous 2.2e14, rate 1.2e11 ν/s. The float64 representation holds the target range with wide margin, so the larger-representation clause of the ticket did not engage. Every snapshot's finite read passed, and the real save seam serialized every sampled bank, stride, and final state with exact monetary round trips.
- **The prompt door policy: expected unsuccessful, recorded.** Zero-claim banking resets the era at the horizon before the entry depth's claim can form, so the frontier never opens; the walks bank 115–174 honest zeros each and reach no World face. The policy's door remains exactly what #490 calibrated it to be — the opening's eligibility read — and its century-scale failure is the recorded argument for the claim-pushing rules.

## The rechecks after the change

**The opening's 8–12-hour range (#490's calibration): unmoved.** The eligibility doors recorded by the re-run [first-prestige matrix](first-prestige-results.json) are identical to the shipped calibration (25-minute doors 5.4–16.7 credited hours, median ~11 — the door reads the horizon and entry, which the slope never touches), and the worthwhile-prestige journeys still complete: pushing 25m lands 1 in-window (8.33h), 2 under, 2 over, 3 bank-only; pushing 60m lands 2 in-window (11h, 8h), 4 over, 1 unreached, 1 bank-only. The sparse seeds' over-window doors are the same recorded variance #490 carried.

**The later eras' 5–10-hour range (#491's evaluation): re-recorded at the calibrated slope** — [results](later-era-results.json), 48 walks plus the route probes. The distributions: 64 of 119 closed later eras in-window (against 31 of 86 at the shipped hypothesis), 7 under, 48 over, and 35 of 48 walks complete all four declared banks (against 15). The no-refund route probes at the walk's exact bank states (frontiers 2, 6, 9, 11) all advanced through the engine's own purchase orders with currency and finite checks intact. Two honest deteriorations are recorded, not smoothed: at the calibrated slope a route continuation can bank its claim before its weapon's fight resolves, so the fighting demonstration lives in the support walks' defeats rather than in every probed order; and the first later era's fixed rebuild ramp now consumes more than half of many closed eras — the **new-frontier-effort criterion remains #491's standing unmet record** (0 of 119 closed eras spend a new-territory majority), with the faster-return mark itself still holding (104 of 119 re-walk prior depth faster). A steeper slope would serve that criterion and break the century coverage; the trade is recorded here for the maintainer's scope decision that #491's doc already asks for.

**The ADR-0086 repair's recheck (2026-11-07): the matrix re-recorded at the claim grant and slope 2.5.** The whole declared matrix re-walked at the calibrated pair (80 rows, fingerprint `ed2bd449`, composed at `eb4e185`): every walk stops at the century mark, every row reads `noGrant` with finite state and exact serialized round trips, and the boundary-aware gap read finds **0 inter-decision gaps at or above the declared two credited hours** across starts, terminals, and whole-run spans. Banking continues through the mark: 685 banks land across the matrix (the slope-4 recording landed 715), banks per claim-pushing walk run 2–15, and the claim-pushing frontiers reach 14–30 (pushing's deepest) against the slope-4 recording's 25–32 — each bank is deeper, so the same depth budget divides into fewer, larger claims. The era-class distribution reads 224 in-window / 268 under / 193 over / 77 open: the shallower cadence moves eras off both ends of the window honestly recorded, and the sparse seeds' long eras stay the recorded misses they were. The representative 60-minute support walks bank through the mark on every seed (the generated seed table above); the prompt policy remains the recorded expected-unsuccessful shape (honest zeros, frontier ≤ 2). The later-era record carries the effort criteria this repair exists for (91/115 new-territory majorities, 0/115 rebuilding majorities).

## The stress fixtures

**Sparse/unlucky acquisition: declared from the matrix, measured in every row.** Seeds 11 and 42 are the declared sparse-acquisition fixtures (`SPARSE_ACQUISITION_SEEDS`) — their recorded roll acceptances per credited hour and distinct acquired designs sit at the matrix floor (seed 11's opening era alone spans 30 credited hours at 60-minute sessions). They are matrix seeds walked by the same recipes — never a hand-built lucky or unlucky board. The supplied-board continuation is **never** counted as acquisition pacing: it is a retained collection.

**The anonymized supplied-board topology: two declared continuations, never pooled into the matrix.** The fixture rebuilds the reported player's end state through the engine's own creation seams — 35 modules at level 1504 (the deepest level whose invested sum stays finite: 1.65e308; the reported 1506 is two past it, which is exactly why the original save's invested figures serialized to null), the launch band's compact frontier with both Row unlocks declared, merge tiers through the roster's shape, every enemy discovered and alive, one prestige banked, Catalog entry owned, no deployed World rig. The aggregate facts are the parent's; the layout, tier, and type-mix values are anonymized-synthetic, and the private save is never committed.

- **Raw:** the un-translated position. The retained levels bank a frontier of 684 Arete in their first hour — and with the claim grant shipped (ADR-0086), that frontier prices the next era's grant past the ν representation, so the reset refuses whole (the integrity refusal preserving a valid save that story 34 demands; the walk records its own decline and keeps playing). The recorded row: one bank, 100 credited hours, no further prestige — the stranding the save translation (issue #493) exists to repair, recorded, never silently repaired here. The recorded artifact predating the grant (restored from the slope-4 evaluation) showed the same stranding by arithmetic instead: a 69-credited-hour re-growth to a token 3-Arete bank at frontier 687, every later era open through the mark.
- **Collection-reset:** the retained collection as one honest calibrated reset leaves it (levels reset by the shipped prestige rule; tiers, designs, and layout stand; the claimed frontier at zero). Its century walk banks calibrated claims through the mark — the topology's evidence that the calibrated economy sustains meaningful play from the reported position once translated, and the grounding for #493's retention table.

## The frozen baseline

`docs/century-calibration-baseline.json` compiles the calibrated curve and entitlement figures a save translation reads — the claim curve (entry 2e7, base 2, slope 2.5 since ADR-0086's re-pricing), the claim grant's authored figures, the enemy ladder's thresholds and stats, the World purchase ladders, the capacity ladder, the response-support shape, the level and cell price curves, the opening grant, and the schema and runner versions — beside the recorded evidence's representative run and the limitations above. The figures are compiled from the shipped constants and asserted beside them in `tools/century.test.ts`, so the baseline cannot drift from the engine silently; a change to any frozen figure must re-run this evidence and re-freeze (ADR-0079) — the rule the ADR-0086 re-pricing exercised for real, re-recording the whole matrix at the calibrated pair before re-freezing. The translation that consumes it is #493's scope, and its schema figure has re-frozen with that translation ([ADR-0081](adr/0081-the-calibrated-save-translation-converts-once-at-the-v13-boundary.md)): the top-level `saveVersion` reads 13 since the v12 → v13 conversion shipped, and the ADR-0086 re-freeze stays inside that same boundary — a converted save lands at a cleared frontier, so its era-start grant reads the plain opening grant and every later claim banks against the re-priced curve through the same one-time conversion. The historical paragraphs above keep their original figures; only the generated section and this note carry the current calibration.

## Reproduction and source provenance

After `npm install`, with committed source, select the declared runtime (for example `mise exec node@$(cat .node-version) -- npm run preflight`). Bare recorder invocations now refuse an incompatible runtime before compiling or loading inputs. The commands below explicitly use the runtime selector:

The committed artifacts are the 2026-11-07 recording at the shipped calibration: regenerate **all** slices and fixtures before composing after any source change; do not mix legacy (version-less) and version-2 gap measurements.

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

The restored ten slices and [composed report](century-calibration-results.json) retain their historical recording commits and compiled engine fingerprint. New composition verifies each slice's fingerprint byte for byte and its commit's ancestry, requires version-2 gap measurements, preserves each input's actual environment (including legacy absence) in `recordingInputs`, and labels its own environment separately as `compositionEnvironment`. The equivalent `FLOWSYNTH_CENTURY_SLICE` / `FLOWSYNTH_CENTURY_REPORT` vitest gates invoke this same recorder. Ordinary suite runs skip the multi-hour evaluation; the always-on cases in `tools/century.test.ts` pin the matrix declaration, the century stop's mechanics, the classification windows, the fixture construction, boundary-gap reads, and the frozen-figure comparison. After any re-record and compose, regenerate this report's generated figures — the distribution tables and the mechanical verdicts — with `node tools/run-supported.mjs tools/render-report-figures.mjs write` (issue #512); the suite's staleness check (`tools/report-figures.test.ts`) fails while the committed section disagrees with the recorded JSON. The rechecks re-recorded their own evaluations: `FLOWSYNTH_FIRST_PRESTIGE_REPORT` and `node tools/record-later-eras.mjs slice … | compose`.

## The smoke tier

Ordinary verification exercises the recording pipeline without any matrix work (issue #506): both recorders' `smoke slice` and `smoke compose` commands drive the real command surface — argument validation, the Vite compile, one bounded walk (a single credited hour, far under every calibration mark, declared as `CENTURY_SMOKE` / `LATER_ERA_SMOKE` in the compiled recording modules), the slice payload with tier `"smoke"`, and composition — in seconds. A shared lifecycle in `tools/dev/smoke-recorder.mjs` owns persistence, provenance, and composition; each recorder supplies its compiled recipe and domain checks. The full normalized recipe is persisted and compared on composition, including seed, schedule, budget, and credited stop; the row's identity must agree too. Smoke evidence made before this recipe field existed must be re-recorded.

Smoke publishes only into isolated temporary output: a fresh temp root per invocation, or `FLOWSYNTH_SMOKE_OUTPUT`. Both the checkout and output paths are canonicalized through symlinks and existing ancestors before any output directory is created. Exclusive file creation prevents even simultaneous invocations sharing one explicit root from overwriting a slice or report. To compose a prior slice, explicitly reuse its printed output root (an unset variable creates a different root on each invocation):

```sh
export FLOWSYNTH_SMOKE_OUTPUT="$(mktemp -d)"
node tools/run-supported.mjs tools/record-century.mjs smoke slice
node tools/run-supported.mjs tools/record-century.mjs smoke compose
# The later-era pair may use this root too: their artifact names are distinct.
node tools/run-supported.mjs tools/record-later-eras.mjs smoke slice
node tools/run-supported.mjs tools/record-later-eras.mjs smoke compose
```

The calibration compose refuses smoke-tier slices outright, and a smoke row stays under the century mark by construction — smoke evidence certifies the pipeline, never balance. `tools/recording-smoke.test.ts` runs the CLI cases, actual concurrent same-root publication, symlink isolation, and stale recipe/source refusals on every suite run. `npm run check` statically checks the recorder scripts for undefined references before anything executes. The #506 acceptance-criterion completion record lives in PR #518's Verification section.

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
