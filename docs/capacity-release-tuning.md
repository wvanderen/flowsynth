# Harmonic capacity: release tuning record (issue #262)

The chosen tuning and the evidence behind it. The decision is ADR-0055; this file records the numbers. Every progression figure below comes from the authoritative harness (`capacity-calibration.ts` + `capacity-calibration.test.ts`): real purchases, rolls, charge, practice advancement and prestige through the engine's own actions, the allocation model enabled, no free resources. Browser observations are recorded separately from numerical ones. Rerun the full tier with `FLOWSYNTH_CALIBRATION=1 npx vitest run src/engine/capacity-calibration.test.ts`.

## Adopted tuning

| Knob | Value | Was |
| --- | --- | --- |
| `ARETE_HORIZON` | 7e6 | 1e23 |
| `ARETE_LOG_FLOOR` | 1e3 | 10 |
| `capacityPrices` | 600 / 30,000 / 700,000 / 5,000,000 ν | 600 / 30,000 / 1.5M / 75M |
| `capacityCeilingCosts` | 6 / 14 Arete | unchanged |
| `capacityDiscountCosts` | 3 / 7 Arete | unchanged |
| Allocation Q curve | complexity 0.12, allowance 0.8, bounds 0.5–1.5 | unchanged (#260) |

## Horizon search

Within an era the horizon never influences behavior (prestige fires only at the crossing), so one long run per seed read every candidate at once. Search at coarse steps (120 s), ordinary policy, era-1 crossing in credited minutes:

| Horizon | 157 | 42 | 2026 | 7 | 99 | 11 | 23 | 77 | median |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3e6 | 710 | 1202 | 974 | 2526 | 1004 | 1168 | 902 | 922 | 989 |
| 5e6 | 806 | 1406 | 1130 | >2700 | 1160 | 1334 | 994 | 1062 | ~1145 |
| 7e6 (adopted) | 840 | 1410 | 1170 | >2400 | 1260 | 1290 | 930 | 1110 | **1215** |
| 1e7 | 994 | 1778 | 1422 | >2700 | 1450 | 1666 | 1168 | 1322 | ~1436 |

7e6 puts the eight-seed ordinary median at 1,215 minutes (~20.3 h), on the ~20-hour target; 1e7 overshoots to ~24 h, 5e6 undershoots to ~19 h with the second era under 10 h. The >2400 seeds are the roll-lottery tail (8–9 acquired voices).

## Adopted-tuning distributions (full fidelity, 60 s steps, two eras)

| Seed | Ordinary 1st / 2nd | Pushy 1st / 2nd | Aggressive 1st / 2nd |
| --- | --- | --- | --- |
| 157 | 840 / 540 (0.64) | 810 / 480 (0.59) | 720 / 480 (0.67) |
| 42 | 1410 / 960 (0.68) | 1680 / 1230 (0.73) | 1050 / 990 (0.94) |
| 2026 | 1170 / 750 (0.64) | 1590 / 1050 (0.66) | 870 / 630 (0.72) |
| 7 | >2400 / – | 1440 / 780 (0.54) | 1320 / 870 (0.66) |
| 99 | 1260 / 750 (0.60) | 1380 / 930 (0.67) | 1350 / 1050 (0.78) |
| 11 | 1290 / 720 (0.56) | >2400 / – | 720 / 450 (0.63) |
| 23 | 930 / 480 (0.52) | 1470 / 960 (0.65) | 900 / 300 (0.33) |
| 77 | 1110 / 630 (0.57) | 1470 / 1020 (0.69) | 870 / 390 (0.45) |

- Ordinary first era: median **1,215 min (~20.3 h)** — on target. Second era: median 720 min (~12 h), ratio median ~0.60 against the provisional 70% direction. The main residual: closing the ratio gap would take a rebuilt-board change (the persist boundary is settled design), not a horizon move — both eras scale together with the horizon.
- Aggressive first era: median ~885 min (~14.8 h) — a real but modest spread over ordinary; the roll lottery dominates policy differences.
- Seed 42's aggressive 0.94 and seed 23's 0.33 bracket the rebuild spread; no era collapsed toward an immediate re-crossing.

## Capacity milestones

Rungs one and two sold inside the first era in every recorded run, at minutes 90–360 and 240–1410 respectively, each opening a measured whole-board rate jump of **+26% to +77%** (smaller on tiny early boards, larger on mature rebuild boards). These are the "prices are milestones" moments working: each purchase re-ran the allocation and visibly re-arranged the active chord set.

## The finite Arete ladders across ten eras (seed 157)

Claims banked the linear base exactly (1–10 Arete across the ten resets). At-threshold purchase timeline: first discount after era two, second after era four, first ceiling after era six, second by era eight.

- Ordinary (prompt purchases, no saving posture): rung three sold in era 7 at minute 270 (the era after its ceiling opened); rung four stayed unsold — it is the deliberate-saving luxury.
- Aggressive (holds half the bank while a rung stands unsold): rung three era 7 at minute 180, rung four era 10 at minute 300.
- Era lengths never collapsed: ordinary settled 450–540 min, aggressive ran 750 → 330 min as capacity landed — the ceilings visibly *refreshed* pacing rather than trivializing it. The shortest recorded rebuild anywhere was 300 min (5 h).
- The same pattern held on seeds 42/2026/99: rung three sold in era 7 everywhere, eras improved from 750 to ~630 when capacity four landed.

## Complete-board comparisons

Committed as `capacity-comparisons.test.ts` (equal acquisition and upgrade investment, unspent recorded, capacities 1–5, late-era 2.5M-ν budget repeated for the formation family). Findings:

- **Formations**: doubled dominant/major sevenths beat doubled triads by ~2× where their extra voices participate (capacity ≥ 2) and ~6× at capacity 3; the chromatic hexad never activates (rate = its idle floor at every capacity) — organized sevenths useful, chromatic cramming never dominant, at mid and late budgets alike.
- **Duplicates**: the doubled triad's per-voice depth climbs with every rung (factor 2.17 → 6.65) and its standing over a duplicate-free wide hexatonic rises with capacity — rungs are real optimization opportunities.
- **Power shapes**: distributed spending out-produces concentrated everywhere, but concentrated never falls below a tenth of it and gains relatively at higher capacity — viable, competing.
- **Silent voices**: the harmonizer-support archetype loses at capacity one (6.9 vs 9.7), ties at two, wins at three-plus by up to +41% — a capacity-scaling strategy, bounded well under the 2× runaway line the tests enforce.
- **Charge and boosters**: an adjacent generator (+12%) and infusor (+8%) each beat sinking the same spend into levels at every capacity.
- **Builds and mutators**: pitch-ear/weights lift every row without flipping any ordering; power and resonance mutators both land, resonance riding the chord factor it multiplies.
- **Rarity**: chord factors match to nine decimals across common/uncommon/rare boards at every capacity — rarity scales power only, never the capacity math.

## Certification on real boards

A 30-session ordinary run measured **900/900 solves certified** (worst solve 193 nodes of the 250k budget). The hand-seeded 17-voice organic board used for browser validation trips the budget (incumbent played, honestly flagged "Allocation uncertified", ~200–300 ms per solve — the deterministic node cap bounding work). Organized placement keeps boards in the certified fast path; pathologically messy monoliths stay the documented open work.

## Browser validation (ordinary play, no `?dev`, provenance-verified server)

- The nous Catalog renders the capacity row with its state grammar (figure 3/3, `capped`, pointer at the Arete sheet) and the Arete face renders all four offerings; the first discount purchased in-browser (3 Arete), the row flipped to its owned word, and the status line announced the cheaper rungs.
- Selecting a voice shows the capacity readout (`Capacity 3/3`, total chord factor ×2.14, applied formation term) with active and idle instance chips; the chord library chip and modal agree (10/11 classes).
- The rebased horizon bar renders sanely (97% at 5.2e6 of 7e6); a real 30-minute session earned through the allocation path.
- Large-board interaction at desktop width: bounded ~200–300 ms per selection on the deliberately messy uncertified board (see certification above); placement previews are cached per hovered cell, not per pointer move.
- Phone-viewport capture: **unavailable** in the reviewing tool (viewport resize timed out); the phone surfaces' geometry is asserted by the committed UI tests (the catalog's 74%-height bottom sheet among them). Recorded as unavailable, not claimed.

## Existing saves and the rebased horizon

No save-shape change ships (version 8 stands; the capacity counters lenient-default). The consequence for pre-change banks is the crossing, not a wipe: a save banked under the old 1e23 horizon — ordinary tens-of-hours play or development saves — loads with the prestige door standing open, and the reset banks the linear claim while the board inventory, tray, flow meter, life record and lifetime total survive (pinned by the pre-calibration-bank test in `capacity.test.ts`). Era progress under the old scale converts into one immediate prestige, then ordinary pacing resumes; this is documented rather than silently clamped.

## Limitations and deferred work

- Second-era pacing measured ~60% of the first against the provisional 70%; closing it needs rebuilt-board economics, not horizon tuning.
- Exact certification on large, messy, single-formation boards (the 250k-node cap trips around ~17 organically-placed voices in one cluster; the 72-voice stress ladder certifies structured boards only). Scalable allocation remains the known open engineering item.
- The horizon break's overfill claims now operate on a reachable horizon (the late-ladder accelerant); no repeatable-prestige loop was found under either policy, but an adversarial overfill-maximizing strategy is untested.
- Higher ceilings and deeper discounts remain deferred by design (ADR-0050/0053).
