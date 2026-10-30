# Balance implementation plan

Status: implementation plan and initial experiments, 2026-10-30. Gameplay tuning is unchanged. The accepted product decisions live in [ADR-0078](adr/0078-breakthroughs-preserve-further-progression-cycles.md); this document owns the implementation sequence and evidence gaps.

## Intent and priorities

A strong build should open the next period of consequential choices. Preserve the satisfaction of discovering chords and specialized modules while keeping production, World resistance, and prestige useful over the agreed 100 credited flow hours.

Priorities, in order: preserve earned practice and prevent numeric-state loss; remove structural runaway paths; establish worthwhile prestige and combat recovery; sustain distinct build decisions; then tune individual module standings. A display change alone cannot satisfy this work.

Non-goals: another prestige layer, new classes or enemies, mid-session purchases or combat attention, a global module nerf chosen from this one save, and any claim that an analytical growth envelope proves 100 hours of play. Tail's lasting warmth already caps at ×2; permanence alone is not evidence that it needs changing.

## Evidence gathered

Reproduce the experiments after `npm install`:

```sh
FLOWSYNTH_BALANCE_REPORT=docs/balance-growth-results.json FLOWSYNTH_BASELINE_REPORT=docs/balance-baseline-results.json npx vitest run tools/balance-growth.test.ts
```

The [growth results](balance-growth-results.json) evaluate synthetic, already-acquired rigs with equal module levels, saturated charge, quality and merge tier one, and a unit chord bonus per seat. The model uses the engine's authored coefficients and chord-response helper. It does not search geometry, fund acquisition, model management opportunities, or assert that every combination of its inputs is realizable. Its immediate-reinvestment times are idealized lower bounds, not pacing forecasts. The marginal waiting-time ratio is next level's cost/rate divided by this level's cost/rate; below one means levelling is becoming faster.

Findings:

- Chorus's exponential level power enters each multiplicatively stacked chord. A five-seat common oscillator has an asymptotic exponential base of `1.2 × 1.25^5 ≈ 3.662`, against the cost base 1.6. Linear silent-voice uplift strengthens this without being the repeated exponential source.
- Exciter independently produces an inversion: a rare charged oscillator supported by a rare Exciter can approach base `1.3 × 1.3 = 1.69`, even without Chorus or chords. Sideband places the amplified response inside each chord, making this more severe. Fixing Chorus alone is insufficient.
- Both linear and bounded response-power candidates eventually restore increasing waiting times in the modeled rigs. The bounded candidate `1 + 3L/(L+20)` preserves level-zero grants, approaching four times their original strength. It is a search candidate, not selected tuning. In the combined-support case its waiting-time ratio remains below one at level 100 and exceeds one at level 500: removing an asymptotic failure does not establish acceptable midgame pacing.
- After both response-grant exponentials are removed, a rare producer times a common amplitude booster still approaches base `1.3 × 1.2 = 1.56`, only narrowly below prices. The linear factors from chords and other support must remain in stress tests. Increasing price growth everywhere would also slow independent producers; category-specific curves are the first candidate to test.

The [fresh-start baseline](balance-baseline-results.json) uses actual engine purchases, rolls, charge, sessions, breathers, and the pushing policy. Seeds 42 and 468 each run two sessions daily, with five-minute breathers. At roughly four credited hours, neither the 25-minute nor the 60-minute session schedule has banked Arete or reached a positive claim. Earned nous ranges from 10,237 to 279,311; the World's first positive claim requires 1e12. These are four declared policy runs, not a player distribution. Their recipes and source metadata are recorded in the JSON. This experiment predates the revised 8–12-hour first-era target: it establishes an early baseline, not a failure against that revised range. Extend the scheduled runs to evaluate the new target.

Existing `capacity-calibration.test.ts` demonstrates a different milestone: eligibility at `ARETE_HORIZON = 7e6`, where prestige can still bank zero Arete. It cannot stand in for the agreed first **worthwhile** prestige. Reuse `playthrough.ts` and its pushing/recovery path for reward-bearing calibration; do not create a competing full-game simulator.

The supplied save adds corroborating evidence: 32 sessions, about 12.4 credited flow hours, one prestige, 35 modules at level 1506, all nine enemies alive, and no deployed World weapon or Columns. Currency and investment nulls are consistent with nonfinite numbers lost through JSON serialization. A snapshot cannot recover the original numbers or historical purchases and placements. Keep the original attachment private; commit only aggregate observations or an anonymized synthetic regression fixture.

## Implementation sequence

### 1. Prevent numeric-state loss

Own the numeric invariant at engine transaction and persistence boundaries. Keep finite-number arithmetic for the initial candidate search, but make representability an explicit release constraint. Use log-space comparisons for analytical stress experiments. Adopt a larger-number representation only if legitimate target-range progression needs it; a larger range never substitutes for repaired growth.

- Audit single, bulk, MAX, and upgrade-all affordability. A nonfinite budget, price, cumulative spend, or resulting value must never grant levels. In particular `Infinity > Infinity` is false, so a comparison alone is insufficient.
- Check rate generation, accumulated earnings, reserves, forge progress, combat supply, and pending prestige claims for finite results. Abort an invalid economy transaction without writing partial balances. Practice records must remain recoverable; the persistence path keeps the last valid save.
- Refuse serialization that would silently convert a nonfinite number into null. Back up the original stored/imported bytes before any recovery or migration replaces them. Surface recovery through the existing save/import flow; no successful import or automatic overwrite may hide a reset.
- Add boundary tests with synthetic nonfinite budgets, prices at the representation boundary, bulk accumulation overflow, and failed serialization. These are integrity tests, not tests of a chosen module coefficient.

### 2. Repair response-support growth through the shared grant seam

`economy.ts:responseGrantsAt` is the shared Chorus/Exciter grant read. Add one authored response-support progression helper; the allocator, rates, decomposition, and inspection must all read it. Keep the effect on its current response axis. Preserve the level-zero grant and charged/uncharged structural conditions. Put coefficients in `BALANCE`, never in a UI or a second simulation-only production path.

Compare the shipped curve, a linear level curve, and a bounded level curve for both Chorus and Exciter. Test all intrinsic/purchased capacities, multiple adjacent supports, maximum merge tiers, silent-voice combinations, Sideband conversion, amplitude support, and charge-conduit chains. Use real allocated board fixtures to confirm the envelope's suspected paths. Record allocator certification; an uncertified incumbent cannot establish the strongest possible build.

Select a curve only after both marginal-growth stress tests and scheduled playthroughs pass. Preserve multiplicative chord instances, capacity budgeting, and profile distinctions unless the evidence shows that this interface itself must change. Existing Chorus/Exciter tests that promise exponential host-power scaling require deliberate updates alongside the new contract.

### 3. Add progression-dependent enemy pressure

Keep one penalty calculation in `world.ts`, authored parameters in `BALANCE.world`, with all consumers reading that result. Progress depends on era-earned nous relative to the individual enemy's discovery threshold, never wallet balance. Defeat replaces pressure with the existing era-local bonus. Charge generation, routing, weapon cadence, and damage remain independent of the penalty.

Prefer authored depth bands for the first experiment: each band increases the penalty toward a strictly positive remaining-production floor. Introduce each band's crossing into the advance boundary walk, alongside discovery and combat boundaries. This preserves exact integration between changes. A continuously varying rate cannot be implemented by updating a multiplier once per arbitrary caller timestep.

Verify discovery exactly at threshold; simultaneous discovery/band crossings; spending without relief; one defeat removing only its own pressure; prestige restoring the initial state; paused, trusted, breather, and provisional/rejected time; and equal earnings/damage for one long advance versus many short advances across every boundary. Tune pressure after repairing response growth, so it supplies resistance rather than disguising runaway production.

### 4. Re-derive worthwhile prestige and the 100-hour loop

Extend the existing playthrough recipe/runner with explicit candidate response and enemy-band settings and repeated productive eras. Preserve source/run identity and state isolation. Never mutate shared `BALANCE` during a candidate run. Keep calendar, session duration, management breaks, rest, and credited flow clocks distinct.

Use seeds 42, 468, 157, 2026, 7, 99, 11, and 23; both 25- and 60-minute sessions; prompt/pushing policies plus explicit chord-support-seeking, combat-engaging, and enemy-ignoring policies. Include sparse/unlucky rewards and the supplied build's anonymized topology as separate stress fixtures. A retained late-game collection is not a fresh-start pacing test.

Measure the first reset that banks enough to buy a useful lasting improvement and funds a functioning starter World rig, rather than first eligibility. Record time to bank, actual purchase/deployment, return to prior output, and a strictly larger claimed frontier. First worthwhile reset targets around 10 credited hours, validated against an 8–12-hour range; later productive eras target roughly 5–10. Measure gaps between useful purchases, new combinations, and meaningful placement decisions throughout the longer first era. Retained bonuses should shorten familiar territory in later eras, leaving most time for the new frontier. Treat misses as misses, without forcing a reset at the target time or granting missing currency.

At each frontier, enumerate reachable Arete purchases and demonstrate an affordable charge/weapon/placement route past the next resistance with no refunds. Report trapped or unreached states explicitly. Rerun through 100 credited hours; record productive prestiges, newly reachable upgrades, changes of preferred placement/build, combat advantage, and time spent waiting for the next affordable consequential action. Every target-range state and serialization must remain finite. Compare timing distributions and trajectories, not just final wealth. A long run with no new decisions fails even if all arithmetic remains finite.

### 5. Specify and implement save transition after curves stabilize

Use a versioned, one-time transition with a field-by-field retention/reset table. Required retention: practice/history, habits/goals/notes, class development, module collection/merge tiers, and earned rolls. Preserve originals before conversion, including unavailable historical monetary figures; never fabricate lost currency or rewrite practice credit.

The expected era reset clears levels/investment, nous, era earnings, capacity purchases, reserves, temporary meters, enemy damage, and stored combat charge, while preserving collection and board layout. Derive the treatment of banked Arete, World purchases, and claimed frontier together from the new curve: carrying an old frontier that can no longer be surpassed is not recovery, and clearing it while retaining its purchased strength must not duplicate unearned rewards. This conversion table is a required output of the recoverability experiments before migration ships, not permission to silently choose a fresh start.

Separate finite overpowered saves from saves with missing/null numeric state. Valid finite saves get the declared economy migration. Corrupted saves get an explicitly explained recovery reset with retained earned history, not ordinary normalization that pretends their currency was zero. Test original-byte backup, cancel/failure without replacement, successful conversion, reload idempotence, and older supported versions.

When increasing `SAVE_VERSION`, replace the existing `parsed.version < SAVE_VERSION` gate for the v11→v12 conversion with its explicit `< 12` boundary before appending the next migration. Otherwise a new version would accidentally apply that older conversion to v12 data.

## One-place rules and UI scope

Authored coefficients live in `constants.ts`; response grants in the shared economy helper; enemy pressure in `world.ts`; claim arithmetic in `accumulator.ts`; save conversion in `save.ts`; recipe execution in `playthrough.ts`. Domain meaning lives in `CONTEXT.md` and decisions in ADR-0078. The growth experiment is not a second production implementation.

Any recovery copy or inspection changes follow [instrument standards](instrument-standards.md), using the existing save/import or module-detail destination. Player-facing terms use [CONTEXT.md](../CONTEXT.md). Such implementation changes owe desktop/phone evidence under [visual evidence](agents/visual-evidence.md). This investigation changes no game surface.

## Verification record for this investigation

- Structural growth paths: automated check, `tools/balance-growth.test.ts` — “detects Chorus and the independent Exciter runaway paths”; raw comparison in `balance-growth-results.json`. Synthetic-rig scope only.
- Candidate bounded grants preserve the starting value and eliminate the modeled repeated exponential at high levels: automated check, “bounded response candidates preserve the floor and leave no repeated exponential response term”. This does not certify live topology or intermediate pacing.
- Fresh-start four-hour baseline: recorded engine experiment, “records the four-hour fresh-start baseline through real engine actions”, explicitly enabled by `FLOWSYNTH_BASELINE_REPORT`; recipes/results in `balance-baseline-results.json`. Neither target pacing nor 100-hour longevity passes yet.
- Accepted design carried into a sequenced plan: manual review of this plan against ADR-0078; exact tuning and migration translation are declared pending evidence.
- Production overflow protection, dynamic pressure, worthwhile prestige cadence, 100-hour decisions, and safe migration: unavailable in this change because production implementation has not occurred. Required behavioral cases are specified above; the implementation completion record must map each criterion to its named evidence.
- Browser evidence: not applicable to this investigation; no game UI changes.

Typecheck and full-suite outcomes for the calibration source are recorded below. The subsequent first-era target revision changes documentation only; its verification is a review that the ADR and plan agree and the four-hour evidence retains its original scope. Passing existing tests does not close the production acceptance gaps above.

### Executed checks

Source baseline: `9e44b416db4d3f5a87fa99ab4e7fc104c00f5f98`; the new calibration files accompany this plan, and production engine/UI source is unchanged. Engine recipe provenance is also embedded in the baseline report.

- `npm run check`: passed.
- Explicit report-generation command above: passed all three named experiment cases, including the optional real-engine baseline.
- `npm test`: completed with timeout failures in `src/engine/progression-presets.test.ts` (“stops the pushing walk at the living fight with the placement unplayed” and “carries the recipe and origin provenance on each preset descriptor”) and `src/ui/app.playthrough.test.ts` (“pushes past the first eligibility, banks its claim, spends it, and measures both recovery marks”). Every other executed case passed; the optional baseline report case is intentionally skipped without its environment variable.
- `npx vitest run src/engine/progression-presets.test.ts --maxWorkers=1`: passed the entire file in 143.18 seconds, including both previously timed-out cases.
- `npx vitest run src/ui/app.playthrough.test.ts -t 'pushes past the first eligibility, banks its claim, spends it, and measures both recovery marks' --maxWorkers=1`: passed the previously timed-out case in 81.03 seconds.
- New-file whitespace checks passed. The documentation chart was checked through HTML preview and rendered inline; it is evidence about this analytical model, not a game UI capture.

The full run itself was not green. The isolated reruns complete the timed-out case coverage at the same source revision; no production source was changed to raise timeouts or alter behavior. These results do not establish any of the future production acceptance criteria listed above.
