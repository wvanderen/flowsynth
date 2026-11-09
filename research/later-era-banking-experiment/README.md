# Banking objective experiment: two smaller banks versus one larger bank

Historical exploratory note. The subsequent [maintainer-approved playtest decision](https://github.com/wvanderen/flowsynth/issues/484#issuecomment-6748062967) defers the suggested board-refresh experiment: hands-on play, including stable-board/Upgrade-All sessions, now takes priority. The experiment below is not a prerequisite for release, and its old pacing-blocker statement predates that explicit scope decision.

## Purpose and disposition

Follow-up to [the pacing diagnosis](../later-era-pacing-diagnosis.md): does the runner bank a strong board too early, and would asking for a larger claim create a better era without making weak boards a slog?

**Exploratory real-action comparison, not a calibration or acceptance claim.** No economy constants, engine rules, management rules, or acceptance ranges changed. The existing later-era pacing blocker remains. This work was performed in the current thread, sharing prior context, without independent reviewers.

**Result:** waiting for a larger claim makes the first era longer but reaches the cumulative frontier milestone sooner in both inspected cases. It does not bring the strong and weak cases into a common 5–10h range. The weak run also exposes a management-policy limitation: a large collection accumulates in the tray while the runner never revisits occupied module cells.

## Setup and controls

- Compiled engine: game `flowsynth`, save version 13, runner 15, source fingerprint `ed2bd449`; checkout revision `a467d2e` plus documentation/research-only work. The fingerprint was asserted against the actual newly compiled engine.
- Runtime: Node v22.23.4, America/Chicago; supported-runtime/storage preflight passed. Allocation budget: 250,000 nodes / 750ms, unchanged.
- Same schedule in all branches: support policy, two 60-minute sessions per day, five-minute breathers, daily 25-minute goal, shipped response curve, no economy overrides.
- Post-input budget: **30 days / up to 60 credited hours**, fixed before running. This is a diagnostic continuation budget, not the remaining budget of the original matrix run.
- Strong input: seed 23, exact frontier-2 bank snapshot from the retained original probe record; parent first bank at 8 credited hours, pre-reset rate 5140.28ν/s. Original recording commit `a139bbeb6e34ca515543226e1c3e8ffcd970d1a8`; original engine fingerprint matches.
- Weak input: seed 11, deterministic targeted replay through public `runPlaythroughCheckpoint(..., 'after-first-bank')`, using the original later-era recipe; first bank at 30 credited hours, pre-reset rate 450.86ν/s. This replay is a new diagnostic input capture, not a restamp of an old recording.
- Both inputs: frontier 2, zero era earnings, 2 unspent Arete, 3,456,000ν claim grant, between-session state. Input files are synthetic scheduled fixtures, not a personal save.
- Branch A: claim target 2, stop after two successful banks. Branch B: claim target 4, stop after one successful bank. Both aim to bank at least frontier 6; any whole-session overshoot is preserved, not normalized away.
- Every branch starts from the identical case input, seed, and calendar anchor. The continuation seam restarts its seeded RNG; neither branch is compared against the parent's later RNG history. Seeds are the same within each pair, but draws can diverge after banking changes actions.
- Each successful terminal bank gets an additional, separately declared **one-hour** real-action continuation under its branch's claim target, to observe actual post-bank purchasing and initial use. This resets the continuation RNG again in both branches; it is not falsely presented as a seamless extra hour of the parent branch.

### State equality and wall-clock logging

Exact input hashes and cloned first snapshots match within each pair, and public continuations leave caller inputs unchanged. Action prefixes up to the two-Arete branch's first bank are identical. Economic/board state at that point also matches.

The initial strict full-state assertion failed because some public actions stamp feat unlocks and first chord discoveries using wall-clock `Date.now()`. The failure was investigated before interpreting outcomes. Comparisons now exclude **only achievement timestamp values and `chordDiscovery.firstFormedAt`**, retaining achievement membership, every other discovery fact, and every other state field. Raw records preserve the differing stamps. Performance deadlines and economic clocks were not replaced or frozen. Both pairs pass the narrowed comparison; no unexplained state difference is waived.

## Outcomes

Times are credited hours from the common frontier-2 bank input.

| Case | Claim target | First reset | Actual banked claims | Time to terminal bank | Actual frontier |
| --- | ---: | ---: | --- | ---: | ---: |
| Strong, seed 23 | 2 | 2h | 2, 3 | 5h | 7 |
| Strong, seed 23 | 4 | 3h | 4 | 3h | 6 |
| Weak, seed 11 | 2 | 18h | 2, 2 | 34h | 6 |
| Weak, seed 11 | 4 | 29h | 4 | 29h | 6 |

All four complete within the declared budget. All sampled states are finite, earned production reconciles with the continuation's earned-production ledger, and all eight branch/follow-up caller inputs remain unchanged.

**Fairness limit:** the strong two-bank branch overshoots to frontier 7 and banks one more Arete overall. It is not an exact equal-frontier comparison. At the 4h snapshot it has frontier 4 and 683.68m era-earned ν, below the 796.21m entitlement threshold needed to bank frontier 6; its next permitted bank is at hour 5. The one-large-bank branch has already banked frontier 6 at hour 3. This supports the observed milestone-time ordering, not a claim of universal economic efficiency or better long-term value.

The weak comparison ends at exactly the same frontier and total new Arete. It saves five hours by avoiding the intermediate reset, while making one era 29 hours long. Better cumulative progress and acceptable era duration are different outcomes.

## What extra play occurs before resetting?

Both cases spend the initial two Arete on Catalog entry and the first Rack Extenders row. No branch buys a Charge Column or Hone rank before its terminal bank; no enemy is defeated before that terminal bank.

### Strong board

The two-Arete branch banks at hour 2. The four-Arete branch instead spends its accumulated ν on two additional cells and places a Forge and Triangle at hour 2, then banks at hour 3. It gets one additional session using that expanded board. That is a concrete added investment/payoff opportunity, not merely a longer idle wait.

The two-bank branch rebuilds at hour 2, buys its second Rack Extenders row, and expands by three cells across the next three hours. Its terminal bank includes a third Arete due to overshoot. The branches have different boards and budgets by then; neither can be declared globally better from a terminal rate alone.

### Weak board

Both branches make their first new placements only at hours 14 and 15. The four-Arete branch adds cells/modules again at hours 18 and 26, before banking at 29. The two-bank branch resets at hour 18 and adds its next cells/modules at hours 22 and 32, banking again at 34.

The four-Arete branch therefore exposes four new module placements over **29 hours**, accepts 66 module/mutator rolls, and performs a level sweep at every management break. Those rolls are not 66 deployed build changes. The time is not literally event-free, but the trace does not demonstrate a rich sequence of changing builds. The eight-hour interval between placements at hours 18 and 26 should not be hidden by counting routine sweeps or acquisitions as proof of strategic novelty.

## What does the claim buy, and does it pay off?

The following are **actual purchases in the separate one-hour post-terminal observation**, not affordability estimates:

| Case / target | Purchases after terminal bank | End-of-hour deployed strength | Defeats within that hour |
| --- | --- | --- | --- |
| Strong / 2 | Two Charge Columns | Two Columns, Hone 0 | None |
| Strong / 4 | Second Rack Extenders row, one Column, one Hone | One Column, Hone 1 | None |
| Weak / 2 | One Column, one Hone (second row bought earlier) | One Column, Hone 1 | w0 |
| Weak / 4 | Second Rack Extenders row, one Column, one Hone | One Column, Hone 1 | w0 |

The strong target-2 branch's extra Arete and higher frontier change both its purchases and its grant; its two-Column result is not a controlled victory over the target-4 branch. World occupants were purchased/placed through real actions; the short follow-up does not establish every later combat outcome.

For the weak case, the same initial combat milestone is achieved in either follow-up, but five hours earlier from the common input in the larger-bank branch (29+1 versus 34+1). **There is a real progression benefit, but not a pacing fix.**

Recovery is also unfinished in several observations. At the post-bank hour's end, the weak cases produce about 6928 and 6976ν/s, below their respective pre-terminal-bank rates of 44,700 and 20,188ν/s. The strong smaller-bank branch regains prior production immediately after management; the strong larger-bank branch does not regain its higher pre-reset rate during the observed hour. One hour of follow-up is insufficient to declare every reset worthwhile or fully recovered.

## A more consequential confound: the runner's frozen deployed roster

The strong input has **18 modules, 16 placed, 2 in the tray**. The weak input has **91 modules, 16 placed, 75 in the tray**. At the end of the weak 29h branch, there are **157 modules, 20 placed, 137 in the tray**.

The runner's [`manage`](../../src/engine/playthrough.ts) places tray modules into vacancies using the authoritative rate preview. It iterates the existing tray order and stops when no vacant cell exists. It does **not** replace deployed modules with potentially better tray modules, rebuild the board around a new combination, or merge modules. Its World-occupant relocation is a separate rule and does not refresh the module board.

Consequently, a seed's early placements can remain economically decisive despite a large later collection. The weak run's quantity of acquisitions is not evidence that its available modules are being used well. This does not prove that a particular replacement would rescue it, nor that its collection can meet the target window: the relevant replacement counterfactual has not been run. It does mean we should avoid diagnosing the available economy from this fixed-roster policy alone.

## Interpretation and next decision

Supported by these two pairs:

1. Banking at every two-Arete opportunity can spend time rebuilding that would otherwise advance the same cumulative frontier.
2. A larger target does not automatically create an appropriately paced era: the strong/weak contrast remains 3h versus 29h for the first larger bank.
3. Some extra time buys real placement payoff on the strong board, but the weak run still shows long stretches with little deployed-board change.
4. Early claim revenue competes with Catalog/row expansion before funding the combat line. The two-Arete target is not itself a guarantee of a materially different next attempt.
5. A fixed deployed-module roster is an important limitation of the present player model.

**Recommendation:** before retuning grant/slope or choosing four as a new default, test one modest, explicit **between-session board-refresh policy** against the unchanged fill-vacancies-only policy from the same weak input and with the same banking objective. Use available modules and public placement/removal actions, preserve their real costs and retained facts, and evaluate a human-plausible replacement rule—not an omniscient full-board optimizer. This would distinguish “the seed's available collection is weak” from “the runner leaves useful strength unused.”

No balance choice, policy change, or scope approval is made here. Broader seeds, both session shapes, deeper frontiers, and longer post-bank recovery would be needed before any production conclusion.

## Artifacts and checks

- [`strong-input.json`](strong-input.json), [`weak-input.json`](weak-input.json): exact synthetic starting states. Input hashes and schedule anchors are in [`results.json`](results.json).
- [`results.json`](results.json): reduced measured results, full recipes, source/runtime/solver provenance, relevant purchase/placement event lines, follow-up outcomes, and hashes of the original full records.
- Original full records remain in `.dev/banking-experiment/`, about 11MB in total; not committed. They include all snapshots and events. The reduced results do not pretend to retain every board.
- [`run.mjs`](run.mjs): reproducible real-action replay from the supplied input fixtures. Run from repo root using the supported runtime; it writes new full records to `.dev/banking-experiment-replay/`. Logging timestamps can change, but gameplay outcomes and identical action prefixes are asserted.

```sh
mise exec node@22.23.4 -- npm run preflight
node tools/run-supported.mjs research/later-era-banking-experiment/run.mjs
# Verify the retained original records without rerunning walks:
node tools/run-supported.mjs research/later-era-banking-experiment/run.mjs --audit .dev/banking-experiment
```

Executed: the four real-action branches and four real-action one-hour observations through the diagnostic driver; the retained-record audit through `run.mjs` passed for exact input/source hashes, finite sampled states, earned-production reconciliation, unchanged input states, action prefixes, outcomes, and original file hashes. The replay script passed Node syntax checking. The first attempted syntax-check command put `--check` on the runtime selector, which rejected it before executing a script; the successful check used `mise exec node@22.23.4 -- node --check …`.

The final audit runs **no walks**. A fresh replay using the packaged fixtures is available but was not run a second time merely to repeat the same experiment. No production engine or UI source changed; no full regression suite, century matrix, or acceptance re-recording is claimed for this exploratory work.
