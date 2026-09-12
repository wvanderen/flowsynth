# First-playable economy experiment

Design experiment, 2026-09-12. These results validate arithmetic and expose tuning questions; they do not validate engagement, establish optimal strategies, or change accepted balance values.

## Findings

1. **The planned opening works arithmetically.** The no-level route earns 60, then 72, then 113.4 nous in three ten-minute sessions and earns its first roll in session three. Forge-first and expansion-first can both reach their named first reward at that point.
2. **Repeated production upgrades accelerate substantially.** The greedy production route reaches tens of thousands of cumulative nous in two hours, without Forge or expansion. This is a signal to review early scale and pacing, not proof that these modules are strategically inferior: their banked rewards are deliberately not spent here.
3. **Power and cost must be tuned together.** Cheaper upgrades while keeping ×1.20 power cause extreme acceleration in this model. Paired smaller power increases produce much calmer trajectories. Alternate curves remain experiments only.
4. **Early combination primarily frees space.** At low levels, two equally useful deployed common copies outperform one uncommon copy in raw summed contribution, including some cases after reinvesting the refund. Combining an inventory-only spare or freeing a valuable cell can still be advantageous.
5. **Rare rolls will usually be absent from a short test.** The chance of a rare candidate in a three-option roll is about 0.30%; most test rarity progression will need to come from combinations or a separately approved test fixture.

## Method and limits

All sessions last ten minutes and stop exactly at their target. The first session activates Time; the second completes the first timed target and opens the store. Its burst runs in session three. Sessions have frozen configurations and event-exact charge/on versus charge/off integration, not a frame-rate-dependent loop.

The principal routes unlock purchased levels with the store; an alternate run permits them after session one as a historical sensitivity comparison. Store-time unlocking is now the accepted rule. Gameplay placements are exhaustively ranked on a fixed core layout and a deterministic connected expansion shape. The full game's freely reshaped core board is not searched. Module inventory in these routes consists of guaranteed common starter copies only. **All rolls remain banked and no combinations are performed in the route runs.** Combination is analyzed separately below; the subsequently agreed distinct-type draws are not exercised by these deterministic routes.

Policies are intentionally simple, not optimal planners:

- Tutorial reference buys additive, Forge, expander, conditional, infusor in that order, with no purchased levels. It prioritizes connecting the first expander until one cell is earned, then prioritizes current-session income.
- Production-first repeatedly buys the affordable starter or level with the highest immediate next-session income gain per nous. It assigns no speculative value to future rolls/cells, so does not buy machines with no immediate nous return.
- Forge-first buys Forge, additive, expander, infusor, conditional; leftover currency buys Forge levels. Layout prioritizes Forge progress, then expansion progress, then income.
- Expansion-first buys expander, additive, Forge, infusor, conditional; leftover currency buys expander levels. Layout prioritizes expansion progress, then Forge progress, then income.

Passing an unaffordable next starter purchase stops that pass through the priority list; leftovers may buy the route's named machine levels. Earned cells are placed before the next session, and all choices occur in upgrade mode. There is no random reward luck in these comparisons. Results show consequences of the named policies, not a universal dominance ordering.

Simulation-specific conventions: prices are `ceil(10 × growth^current_level)` without recursive rounding; global thresholds retain fractional values; strength empowerment interpolates as `1+s/(1+s)`. Routes exercise only strengths 0 and 1. None of these conventions chooses the eventual app stack or numeric representation.

## Opening and route comparison

Amounts below are cumulative **earned** nous, before subtracting spending. Banked balance alone would make an investing route look artificially weak. Cells are expansion-earned cells in addition to the initial eight.

| Route | Nous at 30 min | Nous at 60 min | Nous at 120 min | Banked rolls at 120 min | Cells at 120 min |
|---|---:|---:|---:|---:|---:|
| Tutorial reference (no levels) | 245.40 | 667.76 | 1,708.04 | 1 | 1 |
| Production-first | 335.47 | 2,211.99 | 65,126.18 | 0 | 0 |
| Forge-first | 245.40 | 547.80 | 1,439.72 | 6 | 3 |
| Expansion-first | 245.40 | 614.84 | 1,589.40 | 4 | 4 |

### First four sessions of the tutorial reference

| Session | Earned this session | Before management | Management actions | After management | Rolls / extra cells |
|---|---:|---:|---|---:|---|
| 1 | 60.00 | 60.00 | Time activates | 60.00 | 0 / 0 |
| 2 | 72.00 | 132.00 | buy additive (40); buy forge (80) | 12.00 | 0 / 0 |
| 3 | 113.40 | 125.40 | buy expander (80) | 45.40 | 1 / 0 |
| 4 | 75.60 | 121.00 | buy conditional (60); buy infusor (40) | 21.00 | 1 / 1 |

Session four's income falls because the two free slots run Forge and the expander instead of the additive synthesizer. It earns a cell and makes the space tradeoff tangible. After the reference route switches to maximizing current income, machine progress can stop even though it owns machines; this is a policy choice, not a deadlock in the economy.

## Upgrade-growth sensitivity

Same greedy production policy, common modules, store-time upgrades. The paired experiments vary power and cost together as requested. No alternative is adopted.

| Cost growth | Common power per level | Cumulative nous at 60 min | Cumulative nous at 120 min / stopping point |
|---|---|---:|---|
| ×1.15 | ×1.20 | 9.71e+14 | 9.71e+14; stopped at 60 min |
| ×1.3 | ×1.20 | 18,018.51 | 1.57e+14; stopped at 80 min |
| ×1.6 | ×1.20 | 2,211.99 | 65,126.18 |
| ×1.15 | ×1.05 | 970.62 | 3,462.95 |
| ×1.3 | ×1.10 | 1,275.74 | 6,836.66 |

Runs crossing 10^12 cumulative nous stop before further management to keep this small numerical experiment within a useful range. This is **not a proposed game cap**, and stopped runs are not extrapolated to 120 minutes. Their huge values indicate rapid acceleration, not a prediction of sustainable long-term balance.

The infusor can simultaneously strengthen Enter/Exit and Time, and their contributions then multiply. The conditional synthesizer adds another multiplicative factor. Consequently, system-wide growth can be much faster than the ×1.20 improvement of a single module would suggest. Lowering price growth alone does not reproduce a game where purchased units have much smaller marginal effects.

### When levels unlock

Allowing levels after session one changes second-session income from 72.00 to 124.42 nous under the greedy policy; cumulative income after three sessions changes from 335.47 to 429.99. The store-time boundary has since been accepted; the earlier-unlock run remains a sensitivity comparison.

## Combination versus two deployed copies

Normalized primary contribution, assuming both common inputs have the same level and equal useful adjacency/charge. This is directly applicable to additive contributions or Forge/expansion efficiency; it is not a blanket comparison for every spatial infusor arrangement. Both-copy columns consume two cells; combined columns consume one. Core types are unique on the board, so this two-deployed comparison does not apply to core duplicates.

| Input level | Two common copies | One uncommon | Refund (nous) | Uncommon after refund reinvestment | Remaining refund |
|---|---:|---:|---:|---|---:|
| 0 | 2.000 | 1.000 | 0 | 1.000 at L0 | 0 |
| 1 | 2.400 | 1.250 | 10 | 1.250 at L1 | 10 |
| 4 | 4.147 | 2.441 | 93 | 3.052 at L5 | 27 |
| 8 | 8.600 | 5.960 | 701 | 7.451 at L9 | 271 |
| 12 | 17.832 | 14.552 | 4679 | 18.190 at L13 | 1864 |
| 17 | 44.372 | 44.409 | 49181 | 55.511 at L18 | 19666 |

At level zero, all rarities have equal primary power, so combination alone supplies no power increase. At level four, the refund buys one more uncommon level, but the combined contribution still falls below two deployed commons. The freed slot can compensate; its value depends on what replaces the removed copy. Without reinvestment, one uncommon surpasses two equal-level commons at level 17, far beyond the proposed first few sessions. These are reasons to test the decision, not automatic grounds to add secondary effects back into scope.

## Forge rarity

Three independent candidates give a 2.9701% chance of at least one non-common candidate and a 0.2997% chance of at least one rare candidate per roll. Ten earned rolls would give about 2.96% chance of seeing at least one rare candidate. This calculation assumes the accepted independent rarity draws and says nothing about which module types appear.

## Decisions to review next

- Resolved: level purchases unlock with the store after the first timed completion.
- Review the paired low-power/low-cost alternative against the baseline in a playable; keep the baseline unchanged until a choice is made.
- Confirm whether early combination should primarily save space. Test both deployed duplicates and inventory-only spares.
- Resolved: sample three distinct specific module types uniformly and persist outcomes when earned. A future stochastic simulation can exercise these rules; the current routes still bank rolls.
- Sketch the focus/upgrade views and choose the implementation stack after these material questions are settled.

## Reproduce and inspect

```sh
python3 -m unittest discover -s tools/economy -p 'test_*.py' -v
python3 tools/economy/simulate.py --output docs/economy-results.json
python3 tools/economy/report.py --input docs/economy-results.json --output docs/economy-report.md
```

No third-party runtime dependencies. Baseline values live in `tools/economy/baseline.json`; `--config` can point to a separate variant without modifying the accepted baseline. `docs/economy-results.json` includes per-session purchases, levels, layout snapshots, balances, meter progress, and the full assumptions list. This report is generated from that file.

Checks cover shared-rate arithmetic, inactive modules, absence of self-charging, duplicate multiplier stacking, charged infusors, full transmission to multiple receivers, globally shared thresholds and carry, layout-independent progress, open-ended charge consumption, zero-time freezing, integration segmentation, opening numbers, connected expansion, and upgrade rounding. They validate the experiment, not an application that has not yet been built.
