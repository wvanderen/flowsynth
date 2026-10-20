# World recoverability under the amended no-refund economy: hypothesis re-derivation

Research for [Re-derive World recoverability under the amended no-refund economy](https://github.com/wvanderen/flowsynth/issues/424), under [World progression and habit classes](https://github.com/wvanderen/flowsynth/issues/419). 2026-10-19. This extends [the v1 findings](findings.md) (commit `4eaac5f`) under the [#421 prototype amendments](https://github.com/wvanderen/flowsynth/issues/421): Arete purchases are permanent (no refund path exists), weapons are never sold (starter granted at the first World-eligible claim, further copies on the class-skill roll cadence), Arete buys persistent type-level power, and Charge Columns remain the only direct Arete product. This is decision evidence for the engine/economy brief's shipped defaults, **not selected balance or a production implementation**.

## Verdict

The no-refund guarantee holds fresh at every sampled frontier on all three curves: the cumulative budget funds a build that clears its frontier's enemy and reaches 110% with victories. Deliberate total waste creates narrow combat-dead windows on two curves (three of 24 sampled frontiers); every one is recovered within one additional depth by whole-Arete fraction carry, at the cost of roughly one extra combatless push — recoverable, never a dead save. The first-claim guarantee constrains the Column price to at most 2◇ by construction and stays windfall-safe at 1◇. The roll cadence delays nothing: the starter's timing is identical to the prototype's (both land at the first post-entry prestige), and further rolled weapons are completely masked by Column supply — the roll cadence cannot distort the economy until Columns are bought. Two findings escalate: **the push-versus-reset tension did not improve** (one reset still wins by ~1.3%; a second reset still costs ~41%), and **1T era-earned entry is unreachable in the current engine** — a 200-credited-hour push past the horizon plateaus near 7×10⁹, two orders of magnitude short. The first is a tuning matter with specific knobs; the second is a progression-design fact the briefs must absorb before shipping an entry threshold.

## Primary evidence and provenance gate

- The [#424 ticket](https://github.com/wvanderen/flowsynth/issues/424), the [#421 amendments](https://github.com/wvanderen/flowsynth/issues/421) (resolved with the no-refund / rolled-weapons / type-level-upgrade amendments and their carried-open details), and the [engine/economy brief](https://github.com/wvanderen/flowsynth/issues/425) were read from the tracker with `gh issue view`. ADR-0074 is absent from the research base commit (still planned, reproduced in the map body).
- The prototype's actual grant timing was taken from the [prototype branch](https://github.com/wvanderen/flowsynth/tree/prototype/world-loop) walkthrough steps (`research/world-prototype/world-loop.prototype.html`, "First reset" scenario): prestige first, then buy — so the prototype's starter also landed at the first post-entry prestige, not at entry. The amended grant moves *what* arrives there, not *when*.
- Roll cadence had no prior figure anywhere: the [classes brief](https://github.com/wvanderen/flowsynth/issues/423) explicitly leaves cadence figures "pending the re-derived simulation evidence". The sweep below (30/60/120/240 credited minutes per roll) is the hypothesis being proposed, not a recovered constant.
- Current-engine evidence is the [capacity-calibration harness](../../src/engine/capacity-calibration.ts) itself, pushed past its horizon with `horizonOverride` — its documented post-hoc-read mechanism, not a semantic fork. Drift note: seed 42 now crosses the horizon at 634 minutes; the calibration test comment recorded 540 on 2026-10-16. The World/reset/Engineer economy does not exist in the engine, so the walk is an optimistic bound (no debuffs, no combat, no class meters).
- No playtest export or new calibration battery was supplied. As in v1: no measured 1T pacing existed before this report; the measurement below is new and reproducible.

## Runnable artifacts and assumptions

- `python3 research/world-frontier/simulate.py` — hypothesis model v2 (`results-no-refund.json` regenerates deterministically; standard library only). Extends v1's file in place; v1's refund-era witnesses are superseded where they conflict.
- `npx vitest run --config research/world-frontier/vitest.config.ts` — the current-engine entry-pacing walk (~20 minutes; four walks: ordinary/pushy × seeds 42/157, 400 thirty-minute sessions each). Excluded from the default projects on purpose; asserts no tuning gate.

Model assumptions carried from v1: the retained-rig trajectory `0.04·exp(0.025t)` T/min is an unfitted proxy; all figures are synthetic credited minutes, valid as comparisons only. Damage is time-averaged (below-one-shot values possible); cadence caps shots, never damage. The reach/path abstraction and nine fixed enemies (HP `12·1.5^i` at `10^i`) are v1's. New in v2, all labelled: whole-Arete banking with fraction carry (the production scheme #425 sketches); Column supply 1 charge/min ≡ one attack/min; type power `p = 2 + rank`, damage `p²/4` (the prototype's curve); roll meter on credited Engineer time with Engineer selected throughout (the single-habit assumption); purchases only at era boundaries (between sessions). Weapons and Columns survive prestige; stored charge and enemy damage reset — modeled by era independence.

## 1. Finite-budget recovery without refunds

**Fresh-optimal (the guarantee's strong case).** For each curve and each depth 0–8, the full cumulative entitlement buys one Column plus all-in type power; the frontier's enemy clears between 1.2 and 10.2 combat minutes and every sampled run reaches 110% (results: `frontier_checks`). Max clear per curve: log 5.33, sqrt-log 10.17, power-0.15 8.0 minutes. Every depth ≥ 1 also banks a victory inside the 110% window; depth 0's window closes before its enemy becomes reachable (~19.5 min discovery + ~4 min reach against a ~21.4 min 110% crossing) — the kill itself lands minutes later, as the roll-sweep's return era shows (first kill ~28.8 min). No combat-dead frontier exists on the fresh path at the 1◇ Column price. Unlike v1, in-experiment Arete has no competing products (Mutators retired), so the "budget competition invalidates the starter argument" caveat narrows to Columns-versus-power — section 4.

**All-prior-waste (the no-refund break test).** Every prior claim spent on nothing; the marginal claim is all the player keeps (the granted starter weapon persists the waste):

| Curve | Depth | Marginal claim | Combat | Recovery |
|---|---|---:|---|---|
| log | 1–8 | 2◇ every depth | always | — |
| sqrt-log | 5 | 0◇ | **dead** | one depth (6), +586 combatless push minutes |
| sqrt-log | 7 | 0◇ | **dead** | one depth (8), +788 combatless push minutes |
| power-0.15 | 1 | 0◇ | **dead** | one depth (2), +183 combatless push minutes |

The other 21 frontiers bank 1–9◇ and all surpass 110% (results: `recovery`). The dead windows exist because sqrt-log's and early power-0.15's marginal entitlement dips below 1◇; in every sampled dead window, pushing exactly one more depth banked at least 1◇ — which with the granted weapon is a minimum viable combat build (Column only, dps 1.0) — because the fraction carry accumulates the unbanked remainder. (The carry makes permanent deadness unlikely anywhere on these curves, but the witness only covers the sampled windows.) Worst observed recovery costs roughly one extra frontier's worth of push time (~590–790 minutes against return climbs of ~430–700). Power-0.15 — v1's most generous deep curve — is the most fragile at its first frontier. **Classification: tuning.** No witness shows an unrecoverable state, and no curve family in the sweep needs a refund to satisfy the guarantee. The sqrt-log thin-marginal frequency (two dead windows in eight depths) is a curve-selection signal, not a bug.

**Over-priced ladders and unreachable paths.** Column price 2◇ still funds entry everywhere; price 4◇ makes even the *entry* frontier combat-dead **by construction** (`E(entry) = 2`), starter grant notwithstanding — the curve-construction constraint `E(entry) ≥ Column price` is real and binding (results: `first_claim`, `sensitivities`). Reach-cost sensitivities on the amended economy: 10× path costs degrade the 1000T run to 2 victories at 260.9 minutes (v1's 1000× already produced zero victories and stands); zero uptime removes all victories (283.5 minutes) — under no refunds these are now *permanent* mistakes, which is exactly why the fresh-budget guarantee matters and the recovery table above is the honest worst case.

## 2. The first-claim guarantee under the new model

`E(entry) = 2◇` on all three curves. The guarantee "banks at least the Column's price" holds by construction for any price ≤ 2◇ and fails outright at 4◇ (combatless entry era even with the grant):

| Column price | Kit after entry claim | Enemy 1 clear | Enemy 2 clear | Reading |
|---|---|---:|---:|---|
| 0.5◇ | Column + power 3 | 5.33 min | 8.0 min | same kit as 1◇ at whole-Arete granularity |
| 1◇ | Column + power 3 | 5.33 min | 8.0 min | **proposed default** |
| 2◇ | Column only | 12.0 min | 18.0 min | real, slowest legal |
| 4◇ | no Column | never | never | guarantee broken |

Windfall is bounded twice: the cadence cap (1 attack/min) keeps even an infinite-damage kit above `HP` minutes, and enemy 2 is discovered a depth later. At whole-Arete granularity, prices 0.5◇ and 1◇ buy the identical entry kit (the fractional remainder buys nothing until it sums past 1◇), so the real price sensitivity is *when the second Column arrives* — a 0.5◇ ladder puts two Columns within the first two claims, a 1◇ ladder at the third. **The guarantee is real across 0.5–2◇ and windfall-safe throughout.** No-repeat-grant: across 20 random partition splittings per curve, the grant counter is exactly 1 and whole-Arete banking telescopes to the single claim's floor exactly (`grant_invariants`). The partition-independence property survives flooring via the fraction carry; #425's "within 1e-10" test re-pins it in production terms.

## 3. Rolled weapons' delay cost

**The first kill is not roll-delayed.** The starter lands with the first World-eligible claim — the same instant the prototype's purchased starter landed (both post-entry-prestige; verified against the prototype's walkthrough steps). The entry era is combatless *by design* ("the first claim guarantees a basic weapon and Charge Column for the next era") and combatless *by structure* (Arete mints only on prestige claims, so no Column can exist before the first claim): the model's entry era shows zero victories at every roll cadence. First kill in the return era: ~28.8 minutes (discovery ≈ 19.6 + reach ≈ 4 + clear ≈ 5.3, synthetic minutes) — identical to the prototype's granted start.

**Further copies are masked by Column supply.** Sweeping the roll cadence (30/60/120/240 credited minutes per roll, meter running from first Engineer session): the return era to 100T is 160.95 minutes at *every* cadence; only the weapon count differs (6/3/2/1). With one Column, `min(weapons·cadence, columns·supply)` pins total shots at one per minute — a rolled weapon without a second Column contributes exactly nothing. **The roll cadence's delay cost is currently zero-because-masked; the gating resource is Columns.** Consequences: (a) roll cadence is safe to set slow (120 credited min is the proposed hypothesis) without harming combat pacing; (b) the cadence only starts to matter through the Column trade in section 4 — faster rolls make the second Column *want* to be bought sooner.

**Push-versus-reset: unchanged, still weak (escalate to tuning).** Total credited minutes to a 100T final frontier, amended economy:

| Strategy | log | sqrt-log | power-0.15 | v1 (refund era) |
|---|---:|---:|---:|---:|
| Push straight | 182.85 | 182.85 | 182.85 | 182.85 |
| Reset at 1T | 180.40 | 180.40 | 180.40 | 181.00 |
| Reset at 1T, 10T | 257.80 | 257.70 | 257.95 | 258.20–258.55 |

Persistence and rolls did not rescue the multi-reset tension: one reset wins by ~1.3% (~2.45 minutes), a second costs ~41%. The dominant cost is the reset contract itself (re-earning module levels replays the rig proxy), which World persistence offsets by only ~2 minutes here. The [#421 prototype resolution](https://github.com/wvanderen/flowsynth/issues/421) demonstrated the tension feels live under the refund economy; the amendments removed refunds and the model shows the arithmetic did not improve. This is the v1 weakness surviving intact — a tuning matter with concrete knobs (era-local bonus strength, rig-releveling cost, claim curve slope), flagged for the tuning pass, not silently inherited.

## 4. Type-level upgrades' economy

Allocation sweep over the first three encounters (budget = cumulative entitlement at the frontier; flat Column ladder; flat power price; rolls live at 120 min; results: `allocations`):

| Depth (budget) | Best line | dps | Runner-up | dps | Real choice? |
|---|---|---:|---|---:|---|
| 0 (2◇) | 1 Column + rank 1 | 2.25 | 2 Columns, rank 0 | 1.0 | no — power strictly wins |
| 1 (4◇) | 1 Column + rank 3 | 6.25 | 2 Columns + rank 2 | 4.0 | no — power wins |
| 2 (6◇) | **2 Columns + rank 4** | **18.0** | 1 Column + rank 5 | 12.25 | **yes — flips** |

The trade is real exactly where the second weapon has rolled: with `w = 2` weapons, the second Column's parallel shot (supply-capped) beats another rank. Depth 0–1 the second Column idles (one weapon) and power dominates. The flip is **gated by roll cadence** — at 240-minute rolls the depth-2 Columns-first line arrives one weapon later — so the two knobs must be tuned together, and the price/power families remain to be swept (only flat/flat is witnessed here; increasing power prices `cost(k) = k` are implemented in the artifact but unreported). Over the witnessed family: "upgrade the type vs buy another Column" is a genuine choice from the third encounter onward, neither line dominating the sweep.

## 5. 1T entry pacing — measured, and unreachable

The capacity-calibration walk pushed past its horizon for 400 thirty-minute sessions (200 credited hours) per walk, four walks (ordinary/pushy × seeds 42/157), real purchases, no free resources:

| Walk | Horizon (7×10⁶) crossed | 1T reached? | Peak era-earned | Tail rate |
|---|---:|---|---:|---:|
| 42 ordinary | 634 min | **never** | 7.39×10⁹ | 5.1×10⁵/h |
| 157 ordinary | 1186 min | **never** | 3.05×10⁹ | 6.1×10⁵/h |
| 42 pushy | 661 min | **never** | 7.23×10⁹ | 4.7×10⁵/h |
| 157 pushy | 991 min | **never** | 5.72×10⁹ | 8.8×10⁵/h |

The board saturates (capacity purchases stall after their recorded rungs, the per-hour tail rate collapses to 10⁵–10⁶ against 10¹² needed): from the 7.4×10⁹ plateau at ~5×10⁵/h, 1T is roughly two million credited hours away. **The current engine cannot reach 1T era-earned; the authored 1T entry is not calibratable against the current economy and the figure the briefs need does not exist to be tuned.** Classification: **a progression-design fact to escalate**, not a tuning knob — either the entry threshold moves into the measured plateau's territory (~10⁹–10¹⁰ era-earned, i.e., a deliberate post-horizon push of tens of hours), or the World layer's own economy must raise the era-production ceiling and the entry threshold is then calibrated post-implementation. Note also the drift evidence: seed 42's horizon crossing moved 540 → 634 minutes since the 2026-10-16 recording, so any entry threshold calibrated now needs the same re-recording discipline.

## What the engine/economy brief must cite (and may not claim)

- Column price hypothesis: 1◇, legal window 0.5–2◇, hard construction bound `E(entry) ≥ price` (section 2).
- Entry guarantee: grant-once + banks ≥ Column price, partition-tested with whole-Arete carry (section 2).
- Roll cadence hypothesis: 120 credited minutes per weapon roll, masked by Column supply — safe default, co-tuned with the Column ladder (sections 3–4).
- Recoverability: fresh guarantee witnessed on all three curves to depth 8; waste-dead windows are curve-specific and one-depth recoverable — ship the guarantee as *curve + price construction*, never as a refund feature (section 1).
- Entry threshold 1T: **unusable as authored** against the current economy — escalate before shipping any default that cites it (section 5).
- Push-versus-reset: one-reset incentive ~1.3%, multi-reset −41% — inherited unchanged; the tuning pass owns it (section 3).

## Verification record

Separate research worktree at `/private/var/folder…/fs-world-norefund`, branch `research/world-frontier-norefund`, based on v1 commit `4eaac5f`. `npm install --ignore-scripts` completed before the engine walk. `python3 research/world-frontier/simulate.py` passes its ledger invariants (partition telescoping, grant-once, wallet conservation without a refund path) and writes deterministic results in 0.6 s. The vitest research fixture runs the four 200-hour walks in ~20 minutes and asserts no tuning gate. No production code changed; no browser/UI checks apply (no UI artifact in this ticket); the engine walk reuses the harness's documented `horizonOverride` semantics without forking them. All figures above are hypothesis-model outputs or recorded harness walks, never engine-adopted balance.
