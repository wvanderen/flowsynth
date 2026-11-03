# Later eras productive and recoverable without refunds

Status: recorded evaluation, 2026-11-02 (issue #491, parent #484 stories 5, 17–27, and 42–43). The accepted direction lives in [ADR-0078](adr/0078-breakthroughs-preserve-further-progression-cycles.md); the first worthwhile prestige this evaluation builds on is recorded in [the ten-hour evaluation](first-worthwhile-prestige.md) (issue #490).

## What was evaluated

The shipped economy's repeated eras, on the existing scheduled playthrough runner invoking real engine actions — no second simulator, no shared-balance mutation, no grant, no refund. The runner grew the declared inputs this evaluation needs: a recipe walks **four claimed frontiers** (`eras: 4` — the opening era plus three later eras), and every closed era's ledger records its span on the credited clock, its banked claim, the strictly larger frontier it advanced to, the **familiar/new territory split** (credited seconds below the previous bank's depth against beyond it), the two faster-return marks (production regained, prior depth passed, both clocks from the era's own start), the consequential decisions and their pacing gaps, and a finite read over the exact recorded state the bank produced.

The declared matrix: eight seeds (42, 468, 157, 2026, 7, 99, 11, 23) × two session shapes (the suite's baseline two-25-minute day, ~0.83 credited hours, and its two-60-minute variant, ~2 credited hours — same five-minute breather) × the parent's three declared World policies, each pushing claims to the same target of 2 Arete:

- **Support-seeking** pays the Catalog entry, then Charge Columns while affordable, then Hone ranks cheapest-first — the charge line before the blade.
- **Combat-engaging** pays the Catalog entry, then Hone ranks cheapest-first, then Charge Columns — the blade before the charge line.
- **Enemy-ignoring** never buys or deploys a World occupant: the starter weapon stays in the tray, every discovered enemy's pressure stands for the whole era.

Two placement rules joined the runner's shared leg, both the authored mechanics read literally:

- **A weapon whose fight is won relocates** to the next living discovered enemy, and a Column the fight left behind follows it when a charge line touches the new fight (relocation is free between sessions). Without it the walks park the blade beside a dead enemy forever and no later frontier's resistance is ever engaged.
- **A Column seats on a charge line** — a cell whose module can receive charge, beside a generator or conduit — with the flow-basis strength only breaking ties, and a Column moves only to a fight-adjacent line. The first recording of this matrix exposed the ticket's progression trap: the old generator-adjacent seat could strand the irreversible Arete purchase on a cell whose module receives nothing, the relocation churned between dead seats, and whole walks never surpassed the first frontier. The repair is in the placement rule, never in currency — the trap read (`walks every affordable order at the tested frontier without a trap`, `demonstrates the combat route surpassing the first frontier's resistance`) is pinned in the suite.

Budgets are the walk's own honest stop: 70 baseline days, 30 long-session days. The matrix records as six independent slices (one per shape × policy) that compose into one report; a recording interruption loses at most its own slice. Reproduce after `npm install`:

```sh
FLOWSYNTH_LATER_ERA_SLICE="25:support" npx vitest run tools/later-eras.test.ts -t "walks the 25:support slice"
# ... the other five slices ...
FLOWSYNTH_LATER_ERA_REPORT=docs/later-era-results.json \
  npx vitest run tools/later-eras.test.ts -t "composes the full declared matrix"
```

The recorded [results](later-era-results.json) carry the window, the declared budgets, every row's clocks, every era's ledger, the per-era route reads, and the per-run source provenance (runner 13; engine fingerprint `3aec0c6f`). All 48 rows read `noGrant` true — the state's whole intake is what the walk earned — and every closed era's bank state scanned finite.

## The later-era distributions against the 5–10 credited-hour window

A later era classifies `in-window` at 5–10 credited hours, `↓` under, `↑` over, `·` open when the budget ended inside it. Era 0 — the opening — is not a later era; its 8–12-hour window is #490's evaluation. Counts cover every closed later era across the matrix:

| slice | in 5–10 | under | over | open at stop |
| --- | --- | --- | --- | --- |
| support, 25m sessions | 7 | 2 | 9 | 8 |
| combat, 25m sessions | 7 | 1 | 8 | 8 |
| ignoring, 25m sessions | 4 | 1 | 9 | 8 |
| support, 60m sessions | 5 | 0 | 8 | 8 |
| combat, 60m sessions | 4 | 0 | 9 | 8 |
| ignoring, 60m sessions | 4 | 0 | 8 | 8 |

Per-seed credited hours (open eras shown as the split accrued when the budget ended):

**support, 25m** — 42: 4.17↓ / 5.83 / 10.00 / open · 468: 6.25 / 11.25↑ / 25.83↑ / open · 157: 23.75↑ / open · 2026: 19.17↑ / 7.50 / 8.75 / open · 7: 10.83↑ / 19.58↑ / open · 99: 27.08↑ / open · 11: 16.25↑ / 25.42↑ / open · 23: 4.58↓ / 6.67 / 6.25 / open

**combat, 25m** — 42: 4.17↓ / 7.50 / 9.58 / open · 468: 7.08 / 15.00↑ / 21.25↑ / open · 157: 23.75↑ / open · 2026: 20.83↑ / 8.75 / 8.75 / open · 7: 13.33↑ / open · 99: 31.25↑ / open · 11: 18.33↑ / open · 23: 5.00 / 9.58 / 21.25↑ / open

**ignoring, 25m** — 42: 4.17↓ / 8.33 / 17.50↑ / open · 468: 7.08 / 14.58↑ / open · 157: 23.75↑ / open · 2026: 20.83↑ / 9.17 / open · 7: 13.33↑ / open · 99: 31.25↑ / open · 11: 18.33↑ / open · 23: 5.00 / 10.83↑ / 22.50↑ / open

**support, 60m** — 42: 16.00↑ / open · 468: 7.00 / 11.00↑ / 22.00↑ / open · 157: open · 2026: 13.00↑ / 18.00↑ / open · 7: 8.00 / 11.00↑ / open · 99: 11.00↑ / 18.00↑ / open · 11: open · 23: 5.00 / 7.00 / 10.00 / open

**combat, 60m** — 42: 17.00↑ / open · 468: 8.00 / 15.00↑ / 22.00↑ / open · 157: open · 2026: 14.00↑ / 23.00↑ / open · 7: 8.00 / 16.00↑ / open · 99: 12.00↑ / 26.00↑ / open · 11: open · 23: 5.00 / 9.00 / 15.00↑ / open

**ignoring, 60m** — 42: 17.00↑ / open · 468: 8.00 / 15.00↑ / open · 157: open · 2026: 14.00↑ / 22.00↑ / open · 7: 8.00 / 17.00↑ / open · 99: 12.00↑ / 28.00↑ / open · 11: open · 23: 5.00 / 8.00 / 15.00↑ / open

Read with the misses named, never averaged away:

- **The first later era is the window's strongest evidence.** On the baseline shape it lands in-window or under on five of eight seeds (4.17–7.08h) and only seed 157's roll-starved opening (23.75h) runs far past; on the 60m shape it lands in-window at 7–8h on 468 and 7 and 5h on 23. The era after the first worthwhile prestige is where retained strength bites hardest.
- **The deeper later eras drift long, on both shapes.** Era 2 runs 7.5–26h depending on seed and schedule; era 3, where demonstrated (10 of 48 walks reached the fourth bank), runs 6.25–22h. Each later bank claims one full decade more era-earned than the last — the authored claim curve pays 2 Arete per decade — and the decade's credited price grows past ten hours on most seeds. On the demonstrated complete walks (468 and 23 on both shapes) eras 1–2 sit at 4.58–11h and era 3 at 6.25–22h. This is the recorded calibration input for #492's horizon work, not a defect this ticket tunes away: the entry depth and first-era pacing are #490's calibrated figures, the deeper decades' pacing is exactly what #492's 100-hour calibration revisits.
- **Acquisition variance is seed variance.** Seeds 157, 99, and 11's roll-starved openings (the same seeds #490 recorded as door-delayed) push their era 1 past 16h on both shapes; seeds 42 and 23's fast openings land eras 1–2 under ten.

## Faster return through familiar territory, and the rebuilding share

Three reads per later era, from the era ledgers:

- **Faster return**: the era's familiar credited walk (from zero to the previous bank's depth) against the previous era's FULL credited span to that same depth. Demonstrated in **56 of the 60 closed later eras that carried a crossing** (the four misses are the deepest eras of the 60m slice, where the line's strength thins). The retained purchases — the Catalog, the capacity offerings, the World line, the class development — re-walk the claimed ground faster than its first development on essentially every demonstrated era.
- **Rebuilding share**: the credited span the era spent regaining the production the reset erased, against the era's whole span. Means per slice and era index: 0.32–0.63 at 25m (combat's line the tightest at 0.41–0.47), 0.46–0.69 at 60m. Rebuilding stays under half of the era in most slices — and drifts above half on the 60m support line and the 25m third era. Recorded as measured: the regeneration is quick (the board's cells and owned modules persist; only levels reset), but the 60m shape's long sessions credit enough time that the rebuild's share reads high even when its absolute span (~5–7 credited hours) matches the baseline's.
- **New territory**: the credited share beyond the previous bank's depth — the part of the era that is genuinely new frontier. Means run 0.29–0.53 per slice and era. The familiar span dominates credited time on most walks: the depth the player re-walks grows a full decade per bank while the new-territory stretch is the single decade the era banks. What retained strength buys is the *pace* of the familiar re-walk (faster on 56 of 60 eras), not its share of the clock — and the ticket's own bar, that rebuilding must not consume most of every later era, reads on the rebuilding share above, not on the familiar share.

## The no-refund routes at the tested frontiers

At the first tested frontier — the exact recorded state the first worthwhile bank produced, its 2 Arete unspent — the suite's route probe enumerates **every affordable purchase order** (the empty route, each single piece, all six two-piece permutations of Catalog entry / Charge Column / Hone rank) and drives each through the engine's own purchase and placement actions: every order lands, refunds nothing, leaves the recorded state finite, finds seats for the rig, and keeps every skipped piece affordable within the next two claims (`walks every affordable order at the tested frontier without a trap`). No progression trap exists at that frontier: no affordable, irreversible purchase can strand the route forward.

Beyond it, the walks themselves demonstrate the routes at every frontier they passed, per era in the recorded rows — what the Arete bought, what deployed, what died:

- **Support** (charge line first) is the strongest route: defeats chain to **w2 at frontier 6** on seeds 42, 468, 7, and 23 (both shapes), w0–w1 on 2026 and 99, w0 on 11; the era bonuses of the kills are visible in its era durations (seed 23 at 60m: 5/7/10h — the matrix's only all-in-window completed walk).
- **Combat** (blade first) reaches the same defeats on 468 and on the 25m shape's 42 and 2026, but its honed blade starves without the charge line on the 60m shape (defeats on 1 of 8 seeds) and its eras run systematically longer where the line never formed — the material cost of skipping support, paid under no-refund rules.
- **Ignoring** banks its claims everywhere it demonstrated (postponing combat remains possible) and defeats nothing anywhere; its later eras run longest at the same seeds (23 at 25m: 5.00 / 10.83↑ / 22.50↑ against support's 4.58↓ / 6.67 / 6.25).

The discovered-enemy pressure the ignoring walks paid is the era-earned depth bands' own arithmetic (issue #489): at frontier 6's depths three to four enemies sit discovered and alive, their production factor multiplying down while the fighting walks' defeated enemies pay their era bonuses instead. Combat and supporting placement confer their benefit exactly there: shorter eras at the same claims, and kills the ignoring route never collects.

## The three policies compared

The declared spending orders behave as declared on every recorded walk (pinned in the suite on real walks): support buys 16 Columns / 6 Hone ranks across the 25m matrix, combat 4 / 16, ignoring neither (its Arete goes to the Catalog's capacity offerings — 8 Chord Catalysts — the prompt policy's own lasting line). The comparison's material reading:

- **Combat + supporting placement confers a material benefit.** On identical seeds and schedules the support route's eras run shortest, its defeat ledger is the deepest (w2 at frontier 6 on four seeds per shape), and its rig demonstrably fights — the defeats are recorded kills through the deployed charge line, not placements.
- **Postponing combat remains a possible trade-off.** The ignoring walks banked the same strictly larger frontiers under the enemies' full pressure — 2 of 8 seeds completed all four claimed frontiers at 25m (against support's 4) — paying for the postponement in era duration (up to +150% at the deepest demonstrated era) and in never collecting an era bonus.
- **The blade without the line is the middle case.** Combat-engaging's no-refund purchase order still advanced every frontier it demonstrated, but where the charge line never formed its kills stayed zero and its eras paid for it — supporting placement, not the blade alone, is what the World's route rewards.

## What this establishes and what stays open

Established: repeated productive eras exist on the shipped layers — four strictly larger claimed frontiers banked on real scheduled walks with per-era ledgers; retained strength demonstrably shortens the familiar re-walk (56 of 60 demonstrated eras) while rebuilding stays under half the era in most slices; the first later era lands in the 5–10-hour window on most seeds and both schedules; the no-refund purchase routes are enumerated and trap-free at the tested frontier, and the three declared policies' trade-offs are recorded with the currency-integrity and finite reads green on all 48 walks.

Open, deliberately: the deeper later eras drift past ten credited hours on most seeds and schedules, and the fourth bank lands within budget on only 10 of 48 walks — the decades' pacing above the first frontier is #492's calibration target (the 100-hour horizon and the enemy ladder's upper decades), and the save migration the recalibrated curve implies is #493's. The entry depth and the first worthwhile prestige are #490's calibrated figures and were not re-tuned here. The recorded matrix is this ticket's evaluation evidence; it is not a claim that the deeper decades already pass.
