# Later-era pacing: inspect the cycle before changing its coefficients

Historical exploratory note. The subsequent [maintainer-approved playtest decision](https://github.com/wvanderen/flowsynth/issues/484#issuecomment-6748062967) defers further ideal-tuning experiments and removes the 5–10h range as a gate for this playtest only. Stable-board/Upgrade-All play is intended; the recommendations and blocker statements below record the investigation at that time, not additional prerequisites for shipping.

## Question and scope

Why does the ADR-0086 effort repair leave many later eras outside 5–10 credited hours? Compare an under-window, in-window, and over-window era for each session shape, separating rebuilding, familiar depth, the new-depth push, management opportunity, and the decision to bank.

This is an observational investigation, performed sequentially in the implementation thread (shared context), not independent review or a new calibration. No simulation, balance change, reset-contract change, scope waiver, or new acceptance evidence is claimed. Inputs retain engine fingerprint `ed2bd449`; the checked-out source is `a467d2e`. The existing pacing blocker remains.

## Sources and reproducibility

- [Later-era results](../docs/later-era-results.json): all 48 runs and each era's timing/recovery/route fields.
- [Century results](../docs/century-calibration-results.json): the matching support runs' `rateAtBank`. The first two eras' hours, claims, frontiers, familiar/new hours, purchases, and defeats were compared for exact equality against the later-era results for all six selections below. The different terminal budgets do not change those matching prefixes.
- [Published probe](../docs/later-era-probe.json): seed 23, support, 60-minute schedule.
- Local retained probe record: `.recording/later-era/evaluation/units/probe-walk.json`, `result.record`, recorded at `a139bbeb6e34ca515543226e1c3e8ffcd970d1a8`, Node v22.23.4, America/Chicago, fingerprint `ed2bd449`. Its `result.row` was compared for exact equality with the published matching later-era row. The local full event/snapshot record is not a committed artifact (file SHA-256 `88fdd125c8beaade050bfaae80abd2da263c250ffe6d5999c722b89e3f4737a3`); the relevant observations are transcribed below. The published row alone cannot verify every event in that transcription. No new walk was run.
- [Runner](../src/engine/playthrough.ts): `manage`, `tryPrestige`, `stopBetweenSessions`, `runSession`; [claim curve](../src/engine/accumulator.ts): `frontierEntitlement`, `pendingClaimOf`; [grant](../src/engine/state.ts): `eraStartGrantOf`.
- [Era interpretation](../tools/later-eras.ts): `laterEraView`; [decision classification](../tools/first-prestige.ts): `meaningfulDecisions`.

The fast diagnostic loop reads the recorded outcomes, rather than replaying expensive walks. Run from the repository root:

```sh
python3 - <<'PY'
import collections, json
later = json.load(open('docs/later-era-results.json'))
century = json.load(open('docs/century-calibration-results.json'))
closed = [(r, e) for r in later['runs'] for e in r['eras']
          if e['index'] > 0 and e['hours'] is not None]
counts = collections.Counter(e['eraClass'] for r, e in closed)
assert counts == {'under': 34, 'in-window': 47, 'over': 34}
print('closed later eras:', len(closed), dict(counts))
for minutes in (25, 60):
    cohort = [e for r, e in closed if r['sessionMinutes'] == minutes]
    print(minutes, 'minutes:', len(cohort),
          dict(collections.Counter(e['eraClass'] for e in cohort)))
for seed, minutes in [(42,25), (7,25), (11,25), (23,60), (42,60), (11,60)]:
    def select(data):
        return next(r for r in data['runs'] if
                    (r['seed'], r['sessionMinutes'], r['policy']) ==
                    (seed, minutes, 'support'))
    r, c = select(later), select(century)
    for index in (0, 1):
        for key in ('hours','claim','frontierAfter','familiarHours',
                    'newHours','newShare','purchases','defeats'):
            assert r['eras'][index][key] == c['eras'][index][key]
    e = r['eras'][1]
    rebuild = e['productionRegainedHours']
    print(seed, minutes, e['eraClass'], 'total', e['hours'],
          'rebuild', rebuild,
          'familiar after rebuild', round(e['familiarHours'] - rebuild, 2),
          'new', e['newHours'],
          'pre-reset rate', round(c['eras'][0]['rateAtBank'], 2))
PY
```

This reproduces the symptom deterministically in milliseconds. It is a data audit, not a live-engine regression test or proof of a causal fix.

## 1. The distribution is broad, not merely shifted

| Session shape | Under 5h | In 5–10h | Over 10h | Closed total | In-window share |
| --- | ---: | ---: | ---: | ---: | ---: |
| 25 minutes | 25 | 10 | 24 | 59 | 17% |
| 60 minutes | 9 | 37 | 10 | 56 | 66% |
| Total | 34 | 47 | 34 | 115 | 41% |

**Correction to the earlier discussion/completion notes:** the denominators are 59 and 56, not 48 and 67. Those earlier denominators were wrong; the 47/115 aggregate and the six published policy/session count rows are unchanged. These are closed-era counts, not independent players or independent runs; several eras belong to one run and early support/combat behavior overlaps. Open eras remain excluded from these percentages, not reclassified as successes.

The class medians are 3.75h (under), 7h (in-window), and 17h (over). This is not explained by small rounding errors at the 5h or 10h boundaries.

## 2. Six matched-stage examples

Selection was purposive, not random: one of each timing class per session shape, all **support policy, era index 1**, to hold the claimed-frontier stage fixed. Seed 42 and seed 11 also give cross-schedule comparisons. This cannot establish the distribution of mature eras throughout the century.

Every example starts at frontier 2, receives **3,456,000ν** (`600000 × 2.4²`), banks **2 Arete**, and ends at frontier 4. The pending two-Arete target requires at least **126,191,469 era-earned ν** (`2e7 × 10^((4−2)/2.5)`), independent of seed. The grant itself is not era-earned production.

| Session / seed | Class | Total h | Rebuild h | Familiar after rebuild h | New-depth push h | Previous bank's rate ν/s |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 25m / 42 | under | 2.08 | 0.42 | 0.43 | 1.23 | 5,097 |
| 25m / 7 | in-window | 7.08 | 0.83 | 1.37 | 4.88 | 1,836 |
| 25m / 11 | over | 10.83 | 1.25 | 2.93 | 6.65 | 725 |
| 60m / 23 | under | 2.00 | 0.00 | 0.78 | 1.22 | 5,140 |
| 60m / 42 | in-window | 7.00 | 2.00 | 1.87 | 3.13 | 1,625 |
| 60m / 11 | over | 18.00 | 7.00 | 4.00 | 7.00 | 451 |

**Do not add rebuilding to the published familiar span.** Rebuilding is a recovery milestone *inside* familiar territory in these examples (and in all 115 closed later eras). The chart/table partitions it as rebuild, then familiar remainder, then new depth. Values derive from rounded report fields; allow roughly 0.01h rounding drift.

All six buy Catalog entry and the first Rack Extenders row and deploy the granted blade; none defeats an enemy during this era. Their successful routine nous-purchase counts are only 1–2, but those counts exclude level sweeps, module-roll acquisitions, ordinary module placements, and capacity milestones. They do not mean the player made only 1–2 decisions.

**Observation:** the same stage, grant, claim demand, and broad World route coexist with a 2–18h timing spread. The pre-reset rates range over 11×. The grant compresses rebuild, but it does not normalize the boards' ability to earn the next claim. This is consistent with board/acquisition/management path dependence; it does not isolate which factor causes how much of the spread.

A matched seed also starts from different earned states: seed 42 arrives at its first bank after 7.92h at 25m versus 20h at 60m, with rates 5097 versus 1625ν/s. Its later-era comparison is therefore not a controlled intervention on management frequency.

## 3. What the short era actually does

The retained seed-23/60m probe provides a complete event/snapshot trace for its two-hour era. Hours below are relative to the first bank:

| Credited hour | Recorded action/state |
| ---: | --- |
| 0 | First bank: frontier 2, wallet 3,456,000ν, all module levels reset; snapshot rate about 3.33ν/s. The erased board's rate was 5140.28ν/s. |
| 0 | Accept pending module rolls, buy two capacity rungs, sweep 321 levels, buy Catalog entry. Prior production is regained before further credited practice. The post-management snapshot rate is 10,961ν/s; wallet 80,859ν. |
| 0.783 | Prior bank's era-earned depth is passed. |
| 1 | First 60m session and 5m breather leave era earnings about 38.87mν—below the 126.19m target. |
| 1 | Accept further rolls, buy Rack Extenders and two cells, place two modules, sweep 103 levels, deploy the blade. Post-management rate about 63,669ν/s. |
| 2 | Second session and breather leave era earnings about 259.31mν. The runner immediately banks 2 Arete, resetting the upgraded board. |

Here the reset's visible production loss is restored by an immediate repurchase batch; the next management batch increases production strongly; the policy then banks at the next available break. The record does **not** demonstrate that spending five hours in this era would be better. It also does not demonstrate that a human would choose to reset immediately or that the rebuild decisions were interesting.

The published `newHours` metric means time above the prior bank's **era-earned depth**, not time making new build choices. It is useful progress evidence but not a direct measure of novelty.

## 4. Management waiting is an overlay, not another additive phase

The runner calls `tryPrestige` at between-session points before `manage`, and after each session/breather. Claim-pushing policies bank when `pendingClaimOf >= claimTarget`; no minimum era time, five-hour floor, or purchase-payoff condition gates each bank. Completion/recovery conditions govern the overall walk, not a strategic evaluation of each reset.

For these successful banks, any credited waiting after first reaching the claim target is bounded by the current session: at most 25 minutes or 60 minutes. That cannot explain the 11h gap between the two-hour and 18-hour examples. In the retained probe the target is below threshold after hour 1 and above it at hour 2; it banks at that boundary. The exact within-session claim-crossing instant is **not recorded** by the retained snapshots. No exact delay is invented.

Waiting to reinvest is different: practice proceeds on the existing board until the next management break. That happens repeatedly and can change the entire compounding path, rather than merely delaying the last bank. Such time overlaps rebuild/familiar/new-depth phases; the summary fields cannot allocate it as a fourth disjoint duration.

The original 25m-versus-60m schedules change several inputs together:

| Per credited hour / day | 25m shape | 60m shape |
| --- | ---: | ---: |
| Management breaks per credited hour | 2.4 | 1 |
| Scheduled breather minutes per credited hour | 12 | 5 |
| Credited practice per calendar day | 50m | 120m |
| Daily 25m goal completion opportunities per credited hour, once active | 1.2 | 0.5 |

Source: `manage`, `runSession`, and the recipes' two sessions/day, five-minute breathers, daily 25-minute goal. Goal-generator credits remain bounded by credited-time fuel ([goals](../src/engine/goals.ts), [reserves](../src/engine/reserves.ts)); more goal completions do not imply unbounded extra rewards. Breathers earn production but no credited practice/roll progress. Roll acceptance, session-end effects, goal timing, and reinvestment boundaries can all alter the trajectory. The schedule comparison alone cannot attribute the timing difference to management density.

## 5. Hypotheses: what this inspection supports and leaves open

1. **Board-strength spread matters.** Supported as an observation: identical first-later-era grant and target, wide pre-reset-rate and timing spread. Cause decomposition across acquisition, module interactions, and layout remains untested.
2. **Management density drives path dependence.** Plausible, with source-confirmed repeated reinvestment opportunities. Not causally isolated from session-end effects, breathers, calendar/goal cadence, or the already different bank states.
3. **Bank policy converts strong growth into frequent resets.** Confirmed rule and observed in the probe. It is not confirmed that a larger target or later human reset would improve the experience; that is the next comparison to make.
4. **Simple end-of-session banking delay causes the pacing spread.** Insufficient for these extremes: at most one session of credited delay per successful bank, not many hours.
5. **Combat purchases alone explain these six classes.** Not supported: they have the same early World route and no kills in the inspected era. This says nothing about combat's importance in deeper eras.

## Where this leads

Do **not** choose another universal grant/slope adjustment yet. Increasing demand would lengthen the already-long runs as well as the short ones; whether the nonlinear production response compensates is untested. The grant also clearly serves a real recovery purpose, so simply deleting it is not supported.

The next bounded experiment should start from the **same recorded bank state** and compare the shipped immediate two-Arete bank with one deeper claim target (for example four), using the existing isolated continuation seam, without changing grants or slope. Hold schedule, runtime, and input state fixed and record the full recipe/RNG provenance; use the same continuation setup for both branches rather than comparing a restarted branch against its parent's later history. Do this on both a strong/short and weak/long case, not only the fast seed. Observe credit to bank, new build opportunities, what the extra claim actually buys, time using those purchases, recovery, and any open outcome. The probe's frontier-2 state already exists locally; the weak case's full bank state would need a targeted deterministic replay because the seed-unit publications retain summaries, not all boards. Never fabricate a board from its rate.

This experiment distinguishes “the runner resets too soon to enjoy a strong board” from “the economy cannot give weak and strong boards a useful cycle.” If delay merely turns the weak run into a longer slog without giving the strong run better choices, the design discussion should move to what reset retains and what constitutes a worthwhile cycle—not a timer, an automatic income-normalizing grant, or a silent widening of the acceptance range.

**No design decision yet:** the evidence supports investigating the banking objective and strength variance before retuning duration. A short reset may be productive rather than defective; a long reset may be engaging rather than empty. Neither is established by elapsed duration or a majority-of-new-depth metric alone.
