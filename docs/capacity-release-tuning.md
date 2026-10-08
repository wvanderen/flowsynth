# Harmonic capacity: release tuning record (issue #262)

The chosen tuning and the evidence behind it. The decision is ADR-0055; this file records the numbers. Every progression figure below comes from the authoritative harness (`capacity-calibration.ts` + `capacity-calibration.test.ts`): real purchases, rolls, charge, practice advancement and prestige through the engine's own actions — the Arete ladder riding the playable purchase path (Catalog entry first, then the offerings, issue #262's rerun gate) — on the allocation economy every state rides by default, no free resources. Browser observations are recorded separately from numerical ones. Rerun the full tier with `FLOWSYNTH_CALIBRATION=1 npx vitest run src/engine/capacity-calibration.test.ts`.

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

## Adopted-tuning distributions (full fidelity, 60 s steps, two eras — rerun on the released build)

| Seed | Ordinary 1st / 2nd | Pushy 1st / 2nd | Aggressive 1st / 2nd |
| --- | --- | --- | --- |
| 157 | 840 / 540 (0.64) | 810 / 480 (0.59) | 750 / 480 (0.64) |
| 42 | 1410 / 930 (0.66) | 1680 / 1230 (0.73) | 1050 / 960 (0.91) |
| 2026 | 1170 / 750 (0.64) | 1590 / 1050 (0.66) | 750 / 450 (0.60) |
| 7 | 2400 / uncrossed | 1440 / 780 (0.54) | 1260 / 810 (0.64) |
| 99 | 1260 / 750 (0.60) | 1380 / 930 (0.67) | 1230 / 960 (0.78) |
| 11 | 1290 / 690 (0.53) | 2400 / uncrossed | 840 / 570 (0.68) |
| 23 | 930 / 450 (0.48) | 1470 / 930 (0.63) | 900 / 300 (0.33) |
| 77 | 1110 / 600 (0.54) | 1470 / 1020 (0.69) | 840 / 330 (0.39) |

Rerun after the rerun-gate repairs (the allocation retention hint now writes on every state's boundary sync, which shifts a few aggressive trajectories by one session's worth of production; ordinary and pushy reproduced exactly).

- Ordinary first era: median **1,215 min (~20.3 h)** — on target. Second era: median 690 min (~11.5 h), ratio median ~0.60 against the provisional 70% direction. The main residual: closing the ratio gap would take a rebuilt-board change (the persist boundary is settled design), not a horizon move — both eras scale together with the horizon.
- Aggressive first era: median **870 min (~14.5 h)** — a real but modest spread over ordinary; the roll lottery dominates policy differences.
- Seed 42's aggressive 0.91 and seed 23's 0.33 bracket the rebuild spread; no era collapsed toward an immediate re-crossing. The two uncrossed cells are the 80-session cap absorbing the roll-lottery tail, not collapses.

## Capacity milestones

Rungs one and two sold inside the first era in every recorded run, at minutes 90–360 and 240–840 respectively, each opening a measured whole-board rate jump of **+15% to +81%** (smaller on tiny early boards, larger on mature rebuild boards). These are the "prices are milestones" moments working: each purchase re-ran the allocation and visibly re-arranged the active chord set.

## The finite Arete ladders across ten eras (seed 157, playable purchase path)

The harness now pays the Arete Catalog entry at the first break that can afford it, then buys the cheapest offering each break — the playable order the UI enforces (the reviewed revision bought discounts without entry, which claims 1+2 cannot afford: entry 1 + discount 3 > 3). Regenerated ten-era walks on seed 157 (both complete: entry 1, discounts 2, ceilings 2; claims bank 1–10, the linear base):

- **Ordinary** (prompt purchases, no saving posture): the entry lands at era two's first break; the ladders complete across the walk with the first ceiling opening mid-walk — rung three (700,000 ν, the first ceiling-gated rung) sells **in era five at minute 360**, the same era its ceiling opened, for a measured +64% whole-board jump; rung four never sells — it is the deliberate-saving luxury. Eras settle 840 → 450 min.
- **Aggressive** (holds half the bank while a rung stands unsold): rung three sells era five at minute 180 (+60%), rung four sells **era ten at minute 300** (+57%) — the top rung is the saving posture's prize. Eras run 750 → 330 min as capacity lands, and the board grows a thirteenth voice and a sixteenth cell late — the ceilings visibly *refresh* pacing rather than trivializing it.
- The purchase order the harness's discount-first attempt produces is worth naming: once six Arete accumulate, the first ceiling (6) prices under the second discount (7), so the ceiling opens a rung before the deeper discount lands — the milestone ordering, not a scripted one.
- Era lengths never collapsed: no recorded era fell below 40% of the first era's length, so neither ladder recreates an immediate repeatable prestige.
- The committed ten-era test asserts the same walk for ordinary and aggressive: `areteSpent = {entry: 1, ceilings: 2, discounts: 2}`, rung three sold, the top rung sold under the saving posture, no collapse.

## Complete-board comparisons

Committed as `capacity-comparisons.test.ts` and rerun on the released build. The equal-investment contract is explicit (`ledgerOf`): every board's nous bill covers its keyed shelf purchases, its level investments, and its topology — the cell scaler over the cells bought past the opening grant's twelve (which ride every bill equally) plus one-time octave-row gates past the granted rows — and unspent nous is recorded on every row. The practice-metered side (module rolls) is counted, never priced: roll-bought modules cadence on credited practice, so the formation family's differing roll counts (singers plus wires: 10/12/15/11) are recorded beside the nous equality rather than pretended equal. The Arete side (the Mutator entry; the first slot rides it) prices mutator fixtures only and is recorded on those rows. Boards are assembled through an occupancy-safe builder — unique cells, at most one module per cell — so the reviewed revision's illegal doubled-dominant-seventh (spacers stubbed onto the occupied G and E cells) cannot recur silently; a pinned regression asserts every fixture's legality and the builder's refusal.

Findings (small budget 25,000 ν; late-progression leg 25M ν, where the sprawling boards' past-the-grant topology actually exists — cells persist across prestiges, so that bill is lifetime acquisition, the levels the era's upgrade investment):

- **Formations**: the doubled major seventh beats the doubled triad roughly 1.5–2× at every capacity where it fields two participating instances (14.1 vs 9.7 ν/s at capacity one, 59.4 vs 29.6 at three; at the late leg 763 vs 456 at three), and the corrected dominant seventh leads at the late leg too (534 vs 456 at three, its extra participating voices paying for the cells past the grant). The chromatic hexad never activates at any capacity or budget (rate = its idle floor) — organized sevenths useful, chromatic cramming never dominant. At the small budget the dom7 cannot be built at all: its fifteenth cell costs more than the whole budget, which is itself the topology tax working.
- **Duplicates**: the doubled triad's per-voice depth climbs with every rung (factor 2.17 → 6.65) and its standing over the duplicate-free wide hexatonic rises with capacity (29.6 vs 14.8 at three) — rungs are real optimization opportunities.
- **Power shapes**: concentrated spending (one voice carrying ~19.6k of 25k) produces 0.46× the distributed shape at every capacity — viable (never below a tenth), never competitive; distributed/support strategies hold the field.
- **Silent voices**: the harmonizer-support archetype loses at capacity one (6.9 vs 9.7), ties at two, wins at three-plus by +41% (41.7 vs 29.6) — a capacity-scaling strategy, bounded well under the 2× runaway line the tests enforce.
- **Charge and boosters**: an adjacent generator (+12%) and infusor (+8%) each beat sinking the same spend into levels at every capacity; their boards' extra cell rides the grant, and the row gate for the out-of-band row is in the ledger.
- **Builds and mutators**: pitch-ear/weights lift every row without flipping any ordering; power and resonance mutators both land (+17% rate), resonance riding the chord factor it multiplies (×13.3 at three), their Arete side (1 Arete) recorded on the rows.
- **Rarity**: chord factors match to nine decimals across common/uncommon/rare boards at every capacity — rarity scales power only, never the capacity math.

## Certification on real boards

A 30-session ordinary run measured **900/900 solves certified** (worst solve 193 nodes of the 250k budget). The hand-seeded 17-voice organic board used for browser validation stays in the certified fast path on the released build (19-cell constructed cluster: selections ~31 ms, hover previews ~13 ms, no uncertified flag). Organized placement keeps boards in the certified fast path; pathologically messy monoliths stay the documented open work.

## Browser validation (ordinary play, no `?dev`, provenance-verified server)

Provenance verified (`/-/dev/provenance`: worktree and commit match the reviewed checkout). Two saves exercised the surfaces: a mid-progression save built through the engine's own actions (200 credited sessions, two eras banked, capacity rungs sold), and a large CONSTRUCTED 19-cell/20-module board (fixture-built roster, documented as interaction evidence only). A session summary, the horizon door, and every purchase below were reached through the real UI.

- **Nous Catalog** (desktop): the capacity row renders for ordinary play — figure `3/3`, `+1 whole chord per voice`, `capped` with the pointer at the Arete sheet; after the discount the state grammar held.
- **Arete purchase path, playable order** (desktop and phone): the face opens on the entry lock screen (`Unlock Mutator Layer · 1 Arete`); buying it armed the four offerings; the first discount purchased (3 Arete), flipped to its owned word, announced "Capacity rungs cost less nous.", and with 1 Arete left every remaining offering rendered unavailable — claims 1+2 pay entry plus exactly one discount, and no more.
- **Live placement outcomes**: arming a tray oscillator over an occupied cell previewed the swap (`Placement −0.56 ν/s`, the newcomer's row, `Capacity 1/3`, `×1.35`, `Formation ×1.04`, the idle claims) — the preview owns the readout spot per the instrument standards; committing announced the placement. A tap-placed module during the phone pass committed through the same path.
- **Discovery/readout consistency**: the chord chip counts 1/11 discovered; a selected voice reads final ν/s, `Capacity 1/3`, total chord factor ×1.35, the applied formation term ×1.04, and the formation-quality scale with its marker.
- **Large-board interaction**: desktop ~31 ms per selection and ~13 ms per hover preview on the 19-cell board, allocation certified; phone (427×925 CSS px) ~29 ms per selection, readout within viewport, no horizontal overflow.
- **Disclosure**: the capacity row's tooltip opens on keyboard focus and Escape dismisses it, at phone width. State distinctions ride the four-state grammar (figure / `capped` / owned word / `After the first` lock), readable without color.
- **Reduced motion**: the surfaces' motion is charge-gated by CSS under `@media (prefers-reduced-motion: reduce)` with committed coverage in `instrument.test.ts`; a live media-emulation capture was unavailable in this tool and is not claimed.
- Phone capture note: freeform viewport resize to 390×844 applied (page reported 427×925 CSS px); a later resize back to desktop timed out repeatedly (the tool limitation the previous round recorded), so the final desktop composition was captured in a fresh tab at 1402×877.

## Existing saves and the rebased horizon

No save-shape change ships (version 8 stands; the capacity counters lenient-default). Both migration claim modes are pinned in `capacity.test.ts` and documented rather than silently resolved:

- **Without the horizon break** (the ordinary pre-change save): the save loads with the prestige door standing open — an eraEarned banked under the old 1e23 line is far past 7e6 — and the reset banks the linear claim (1 Arete on the first reset), while the board inventory, tray, flow meter, life record and lifetime total survive. Era progress converts into one immediate prestige, then ordinary pacing resumes.
- **With the horizon break owned** (a late-game save that bought the 10-Arete break): the claim is ADR-0042's logarithmic overfill read, not the linear base — a decade of overfill banks 4, the old 1e23 bank banks 17, and a late prestige count at extreme overfill lands on the 25-Arete cap. The overfill windfall is real and capped; the claim is not universally linear, and nothing promises otherwise.

The browser walk exercised the first mode live: the imported two-era save opened with "Prestige and Claim 3 Arete" standing in the horizon bar.

## Limitations and deferred work

- Second-era pacing measured ~60% of the first against the provisional 70%; closing it needs rebuilt-board economics, not horizon tuning.
- Exact certification on large, messy, single-formation boards (the 250k-node cap trips around ~17 organically-placed voices in one cluster; the 72-voice stress ladder certifies structured boards only). Scalable allocation remains the known open engineering item.
- The horizon break's overfill claims now operate on a reachable horizon (the late-ladder accelerant); no repeatable-prestige loop was found under either policy, but an adversarial overfill-maximizing strategy is untested.
- Higher ceilings and deeper discounts remain deferred by design (ADR-0050/0053).
- The large-board browser interaction evidence rode a constructed 19-cell board (fixture-built roster); a purchased board of that size is late-ladder wealth, and the harness's own boards certify without tripping the budget.
