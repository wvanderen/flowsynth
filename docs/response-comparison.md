# Response-support candidate comparison

Status: comparison evidence, 2026-10-31 (issue #487, parent #484 stories 7–14 and 42–43). Gameplay tuning is unchanged; every figure here is a declared-candidate read, never shipped-balance or production adoption. The accepted product direction lives in [ADR-0078](adr/0078-breakthroughs-preserve-further-progression-cycles.md); the implementation plan and its earlier synthetic-rig experiments live in [the balance plan](balance-implementation-plan.md).

## What was compared

Shipped, linear (`1 + 0.1·level`), and bounded (`1 + 3·level/(level + 20)`) progression for the Chorus and Exciter response grants — the two candidates the plan's experiments surfaced, now declared in the engine's catalog (`RESPONSE_CURVES`) and read by the rate pass's own seam (`responseSupportPowerOf`). A candidate rides a run's own candidate state: a playthrough recipe input, a comparison fixture, never `BALANCE`, never another run, never an ordinary save.

Reproduce after `npm install`:

```sh
FLOWSYNTH_RESPONSE_REPORT=docs/response-comparison-results.json npx vitest run tools/response-comparison.test.ts -t "walks the full comparison"
```

The recorded [results](response-comparison-results.json) carry the recipes, the engine source fingerprint (`runnerVersion` 10, `engineSource` per run), every row's certification flag, the explicit beyond-representable nulls, and the findings quoted below. The always-on cases pin the seam, the level-zero parity, the control, the divergence ordering, the capacity ladder, and the recipe contract.

## The three evidence classes

- **Analytical envelopes** — the supplied board's rate curve under each candidate against the upgrade ladder's own prices. Idealized waiting-time arithmetic; never a pacing forecast.
- **Already-acquired fixtures** — nine real allocated boards read by `allocateRates` exactly as live play reads: the eight phenomenon rigs (Chorus stacking, an independent charged Exciter producer, Sideband conversion, multiple supports, silent voices, amplitude support, conduit chains, merge-tier extremes) swept over declared finite levels, plus the Blaster's intrinsic seats and the supplied board over the full reachable capacity ladder (the two declared Expansion Bays open capacity five).
- **Fresh-start pacing** — the scheduled prompt acquisition walk (one per candidate, seed 468, plus a recorded 12-seed scan) and the prompt purchase policy's own five-level gesture sweep against a declared bank on the already-acquired board. Real engine actions throughout.

## The supplied-board reconstruction

The parent save's board, anonymized to its topology and tier facts: thirty copies P01–P30 created in the table's relative order (the Echo's lowest-id adjacent-voice tie-break reproduces), the two Spotlights selecting P30, the Bend on its ♯. Declared inputs: four Poly Expander purchases, two Expansion Bays, two Chord Catalysts, 17 completed breathers, 6,241 lifetime breather seconds, all nine enemies discovered and undefeated, weapon and Columns unplaced. Omitted: personal records, original reserves, feats, discovery bonuses, the historical clock. The saved deployed levels were 1506 and the monetary fields were lost — neither is treated as valid, and no historical rate is claimed: the sweeps run declared finite levels (0–1000) against declared synthetic reserve supplies. The board allocates twenty chord instances under the certified allocator; its nine living enemies multiply every row by 0.134.

## Findings

Quoted from the recorded report; the rows carry the same facts.

- **Level-zero grant parity.** Every phenomenon board reads exactly the same rate under all three candidates at level 0 — the candidates preserve the shipped level-zero grants, and the merge tier rides every curve.
- **The amplitude control never moves.** The Booster/Field/Spotlight-only board reads identically under every curve: the candidates touch the response grants alone.
- **The Chorus leg is the multiplier path.** On the chord-carrying rig at level 1000, shipped reads 2.07e+174ν/s against linear's 2.80e+79 (7.4e+94×) and bounded's 3.22e+78 (6.4e+95×): the grant rides inside every chord instance, so the response curve compounds per seat. On the isolated charged producer and the Sideband converter the shipped spread is only 1.8×/1.6× and the two candidates are float-identical there — the producer's own (untouched) power dominates at extreme levels, and the Exciter's grant lands once per producer. Structural candidate choice therefore turns primarily on the chord-response leg; the charge-response leg needs its own stress inputs.
- **The supplied board cannot hold its own shipped regime.** At level 100 the shipped board reads 2.29e+72ν/s against bounded's 1.60e+27 (1.4e+45×); by level 500 the shipped board's rate leaves the representable range (recorded as an explicit null) while bounded reads 1.01e+108 at 500 and 1.21e+206 at 1000. This is the parent's numeric-integrity motivation demonstrated on the reconstruction itself.
- **Waiting times.** Both candidates' waiting-time ratios cross above one inside the sweep (bounded from level 250) and keep climbing; the shipped curve never crosses before its own board overflows. Levelling under a candidate eventually slows; under shipped it never does.
- **Certification.** All phenomenon rows certified. Five envelope levels and one capacity row did not certify under the default budget (the shipped regime plus level-1000 boards) and carry `certified: false` in place — the runaway board cannot even finish its own optimal search; their figures are the incumbent's. The declared reduced-budget probe demonstrates the recorded distinction (ADR-0051).
- **The opening era is curve-invariant.** The scheduled prompt acquisition policy acquired no Chorus or Exciter in the recorded walks (seed 468, and 0 of 12 scanned seeds at 20 days): the candidates cannot move an opening era, so the rebalance decision binds already-acquired boards and leaves the new-player path untouched.
- **The purchase side costs the same under every candidate.** The gesture sweep lands the same 1,054 levels from the same declared bank — the ladder's prices do not read the candidate — and the resulting-rate rows show what those levels earn under each curve (shipped 2.12e+44, linear 6.29e+19, bounded 2.83e+18). The decision changes the response side only.

## Limits

These rows support choosing a structural candidate — which curve shape removes the runaway while preserving level-zero identity. They are not 100-hour progression acceptance: era-budget calibration, enemy pressure, prestige pacing, and the numeric-integrity tickets all remain open in the parent, and production adoption of any coefficient waits for them. The candidate curves are declared comparison inputs, not approved tuning.
