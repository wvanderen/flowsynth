# Frontier Arete and accumulated World resistance: hypothesis experiment

Research for [Simulate frontier Arete and accumulated World resistance](https://github.com/wvanderen/flowsynth/issues/420), under [World progression and habit classes: frontier Arete, automatic combat, Engineer](https://github.com/wvanderen/flowsynth/issues/419). 2026-10-19. This is decision evidence for a playable prototype, **not selected balance or a production implementation**.

## Verdict

Advance to a deliberately short prototype with three interchangeable cumulative curves and explicit first-reset/return-climb comparisons. The starter force improves return time, finite-budget recovery is arithmetically possible over the sampled frontier, and accumulated fixed penalties are implementable without reset-count rewards. However, the model finds a weak first-reset incentive and severe long-run mismatch between some reward curves and combat costs. It does **not** establish a compelling progression loop or universal recoverability. Those are prototype acceptance questions, not grounds to claim final tuning.

## Primary evidence and provenance gate

- Planned behavior comes from the self-contained [map body](https://github.com/wvanderen/flowsynth/issues/419) and [research brief](https://github.com/wvanderen/flowsynth/issues/420), retrieved with `gh issue view ... --json title,body,comments`. Both had no comments. The map's referenced ADR-0074 file is **absent** from research base commit `2c4372274da708e96c8fe14f21ab541ef9fcfe1d`; this is a planned contract, not proof the engine already implements it.
- [Historical Python economy README](../../tools/economy/README.md) explicitly says its model predates the local chord economy. [Historical economy report](../../docs/economy-report.md) models a different opening and banked rolls. Neither is suitable for fitting World's 1T entry.
- [First-Arete tuning](../../docs/arete-tuning.md) is explicitly superseded: 1e23 belonged to uncapped chord stacking; shipped horizon is 7e6. Its historical version-6 save has nonfinite income serialized as null, no reconstructible crossing, and a different board geometry. It cannot calibrate this experiment.
- [Capacity release tuning](../../docs/capacity-release-tuning.md) is real-engine evidence, but its dated addenda explicitly say the full tables predate successive roster changes. The current checkout includes still later roster changes. [Calibration test](../../src/engine/capacity-calibration.test.ts) exercises the released capacity economy, not this proposed World/reset/Engineer economy.
- No actual playtest export with economy commit, migration version, credited-time records, board/loadout and purchase history was supplied here. Current-engine calibration was **not rerun**, since it cannot validate the missing World system. There is no measured current-engine 1T entry time in this report. The 7M horizon must not be scaled or treated as a pacing guarantee.

Consequently, all times below are **synthetic credited minutes** from an explicitly authored retained-rig trajectory. They are comparisons within a hypothesis, never predicted player session lengths. No external API or scientific facts are needed; the repo and tracker are the owning primary sources for these design questions.

## Runnable artifact and assumptions

Run `python3 research/world-frontier/simulate.py` from this branch. Standard library only. It asserts ledger invariants and regenerates [results.json](results.json), including all sampled budgets, strategy traces, sensitivity settings, encounter discovery/victory events and reachability spending. Source is [simulate.py](simulate.py).

Let `x = era-earned nous / 1e12`; depth `d = log10(x)`. Eligibility is `x >= 1`. Cumulative entitlement is zero below entry, then one of:

| Curve | Entitlement at eligible x | At entry / depth 2 / depth 8 |
|---|---|---|
| log | `2 + 2 log10(x)` | 2 / 6 / 18 |
| sqrt-log | `2 + 3 sqrt(log10(x))` | 2 / 6.243 / 10.485 |
| power 0.15 | `2 x^0.15` | 2 / 3.991 / 31.698 |

All are increasing and have diminishing marginal reward per nous; the discontinuous entry grant pays exactly one weapon plus one Column (one Arete each). Granting the same two Arete at every reset is forbidden. Prices and units are hypotheses.

One weapon/Column build buys damage `D=(B/2)^2` for budget `B>=2`, zero below; fractional remaining Arete buys continuous upgrades. This relaxation makes budget search analytic: all remaining money goes into the only available damage upgrade. An integer-upgrade sensitivity rounds down every two Arete. One weapon spends one copied charge per attack, with one attack/minute maximum; layout is a fractional uptime multiplier 0–1. Integration uses time-averaged damage, **not discrete shots or storage simulation**. Damage is uncapped, cadence is capped. Two Columns, multiple weapons, actual conserved equal splitting, storage overflow and module routing need the spatial prototype.

There are nine fixed enemies at scores `10^i`, `i=0..8`, with HP `12*1.5^i`. Their position/path is abstracted, not rendered. All thresholds crossed discover; every living discovered enemy multiplies nous by 0.8. Victory removes its penalty and multiplies production by 1.08 for that era. Thus nine living enemies leave `0.8^9 = 13.42%` production, not an additive -180%. Charge is unaffected. Stats and thresholds repeat each era.

Unpenalized retained-rig rate is `0.04 exp(0.025*t)` T/minute, an **unfitted** exponential proxy for releveling a retained board. All runs restart this trajectory; no separate reset-count benefit exists. No hard per-era production ceiling is modeled. This is a critical limitation: continuing long enough can eventually outwait every penalty here.

Reachability reserves `0.1*enemy_threshold` T of earned nous from an abstract wallet and delays access by `4*(1+i/4)` credited minutes for connected expansion/releveling. Purchases reduce the wallet, never cumulative earned score. Enemy coordinates, actual cell/row gates, existing purchases, alternate paths and competition with module levels are absent. Raising path cost is tested. These proxies do not prove a path fits the actual available octave rows.

All modeled time is credited flow. No manual logs, away time, rejected provisional practice, breathers or upgrade-mode production are invented. Breather combat/production and provisional rollback require later engine experiments; this model cannot equate wall-clock speed to class development speed.

## Claims, finite budgets, and recoverability

Pending claim is `max(0,E(current_score)-E(claimed_frontier))`. Reset banks that difference and advances the frontier to the greater score in one logical operation. Fractional values are retained; intermediate claims telescope to the same total as one final claim (checked within 1e-10). This is floating-point arithmetic evidence, **not crash-safe persistence or multi-tab atomicity**. Production must transact claim and frontier in the shared save.

Assertions cover below-entry claims, the guaranteed starter claim, repeated equal-depth zero claims, shallower zero claims, fractional successive depths, partition independence and exact budget restoration after full refunds. A zero-claim reset remains mathematically valid; confirmation UX is outside this artifact. Refund restores paid currency, never mints an entitlement. All available money at any frontier is finite. The model assumes no legacy balance/refund windfall and no spending on useful non-Mutator products. Those products' competing costs could invalidate the starter-only budget argument and must be included before a production recoverability assertion.

For **each** curve and **each** sampled depth `0..8`, the cumulative budget funds the analytic one-weapon/one-Column build, clears that depth's fixed enemy in at most 12 combat minutes under ideal uptime, and reaches **110% of its claimed score** within the 3,000-minute observation cap. Full per-point budgets and return/exceed times are in results. This is a finite witness over `1T..1e20` nous, not evidence for unbounded depth. Exceeding 110% alone is weak: a rig with positive unbounded growth can do it without combat. The stronger local witness is the affordable fixed-enemy clear time, but it still assumes an accessible path and all Arete allocated to World.

Deep analytic counterexamples expose the limit. With the same HP curve, log entitlement takes ~90.5 combat minutes at depth 20 and ~2,394 at depth 30; sqrt-log takes ~671.6 and ~27,093. Power-0.15 instead collapses those clear times to ~0.040 and ~0.0023 minutes (time-averaged, below one attack, showing where this relaxation breaks). None is justified as an infinite progression rule. A finite authored enemy roster and bounded purchase progression are easier to evaluate honestly.

## Return climbs, strategies, and failure cases

For a common target of 100T and the same retained-rig proxy:

| Available World budget | Return time | Victories before target |
|---|---:|---:|
| 0 | 182.85 min | 0 |
| 2 | 161.55 min | 2 |
| 8 | 160.65 min | 2 |

The starter saves 21.30 minutes (~11.6%). Quadrupling budget saves only another 0.90 minute here: once fueled, combat clears well before growth reaches the next threshold. This hypothesis's purchase ladder quickly loses useful marginal value. Module placement that reduces uptime to 25% still works, but at later targets its cost becomes visible.

Comparing complete strategies from zero budget to the same 100T final frontier:

| Strategy | log | sqrt-log | power-0.15 |
|---|---:|---:|---:|
| Push straight to 100T, then reset | 182.85 | 182.85 | 182.85 |
| Reset at 1T, then 100T | 181.00 | 180.95 | 181.00 |
| Reset at 1T, 10T, then 100T | 258.35 | 258.20 | 258.55 |

Figures are total credited minutes across eras. Starter reset barely beats direct push (~1.85 minutes); an intermediate reset loses heavily. These are transparent fixed policies, not global optimal-control solutions. Finite integration overshoot means the claims use actual reached scores rather than exactly the nominal target; no integer rounding is used. This evidence supports testing the choice, **not claiming it is already meaningful**.

At a 1,000T target with the power-0.15 budget earned at 100T, baseline is 249.25 minutes. 25% uptime needs 250.35; disconnected charge (0%) needs 283.50 with zero victories. Expensive reachability (`1000*threshold` path costs) also produces zero victories and 283.50 minutes. Forty-minute base path delay needs 254.35. Removing victory bonuses needs 257.95. 50% remaining-production factors need 249.75 because this ideal build removes enemies quickly; that must not be mistaken for harmless stacked penalties. Slowing the retained-rig growth coefficient from .025 to .01 needs 530.95. Limiting the observation to 100 minutes fails to reach the target despite two victories. Thus affordable damage is insufficient evidence for accessible or timely progress.

Integration sensitivity at `.05/.025/.0125` minute steps gives `249.25/249.20/249.20` minutes for that baseline. Discrete cadence, threshold event splitting and real session boundaries remain unmodeled; differences smaller than a few seconds should not drive tuning.

## Prototype hypothesis and remaining decisions

Start with entry 1T, two-Arete starter entitlement, 20% multiplicative enemy penalties, 8% era-local victory factors, fixed repeated encounters, refunds, and all three switchable curves. Limit the first comparison to the first three encounters; keep the full nine-point sweep as a regression fixture. Prefer the log candidate as an easily legible baseline **within this short horizon**, not as a selected long-term curve. Preserve fractional entitlement and permit zero claims. The weapon/Column prices of one each and damage curve above are test knobs, not adopted design.

The prototype must supply human evidence on whether an ~12% return improvement feels worth resetting, and compare faster return vs worthwhile new frontier rather than rewarding repeated depth. It must expose charge-starved and unreachable builds, demonstrate a reachable affordable starter path under the first penalty, and demonstrate full-refund recovery. If a hard era ceiling is intended, author it explicitly and prove funded escape for that ceiling; this model does not contain one.

Remaining fog: actual retained-board 1T pacing on the new economy; a compelling reset/push tradeoff; bounded damage/price progression vs deeper HP; purchases competing with other Arete products; finite discrete upgrade costs; multiple-copy force allocation and storage/Column conservation; reachable authored coordinates and row unlock refunds; retained Engineer progression during retries; breather assistance; provisional combat atomic rollback. No human approval or final balance is inferred from these AFK arithmetic results.

## Verification record

Separate research worktree based on the commit above; `npm install --ignore-scripts` completed before final checks (no production dependency changes intended). `python3 research/world-frontier/simulate.py` passes its invariants and writes deterministic results. No production code changed. No browser/UI checks apply. No game-engine check or current calibration run is claimed. The fixture demonstrates hypothesis behavior and exposes its limits; it is not the engine's implementation test suite.
