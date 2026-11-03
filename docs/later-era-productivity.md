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
- **A Column seats on a charge line** — a cell whose module can receive charge, beside a generator or conduit — with the flow-basis strength only breaking ties, and a Column moves only to a fight-adjacent line. The first recording of this matrix exposed the ticket's progression trap: the old generator-adjacent seat could strand the irreversible Arete purchase on a cell whose module receives nothing, the relocation churned between dead seats, and whole walks never surpassed the first frontier. The repair is in the placement rule, never in currency — the trap read is pinned in the suite (`walks every affordable order at each tested frontier without a trap`, `demonstrates the combat route surpassing the first frontier's resistance`, both in `tools/later-eras.test.ts`).

One consequence of the repair is recorded honestly: the shared placement leg serves the shipped pushing policy too, so the journey walk #490 recorded re-routes — its second bank reads 3 Arete (was 2), its frontier stands at 6 (was 5), and its defeat ledger gains w1 through the relocation. The journey's shape and completion day are unchanged, and the re-pinned figures live in `app.playthrough.test.ts`. [#490's record](first-worthwhile-prestige.md) remains the evidence of its own revision (runner 12) and was not re-recorded here.

Budgets are the walk's own honest stop: 70 baseline days, 30 long-session days. The matrix records as six independent slices (one per shape × policy) that compose into one report; a recording interruption loses at most its own slice. Reproduce after `npm install`:

```sh
FLOWSYNTH_LATER_ERA_SLICE="25:support" npx vitest run tools/later-eras.test.ts -t "walks the 25:support slice"
# ... the other five slices ...
FLOWSYNTH_LATER_ERA_REPORT=docs/later-era-results.json \
  npx vitest run tools/later-eras.test.ts -t "composes the full declared matrix"
```

The recorded [results](later-era-results.json) carry the window, the declared budgets, every row's clocks, every era's ledger, the per-era route reads, the route enumerations at the probed walk's four tested frontiers, and the per-run source provenance (runner 13). One provenance caveat, recorded rather than papered over: the engine fingerprint the runner cites is not content-sensitive in the vitest path — it held still across this ticket's own 144-line placement refactor — so the runs are identified by their recipes plus the recording commits (`a7c9c0a`…`956b866`), and determinism is carried by the reproduction check: the refactored source reproduced its recorded slice row byte for byte. The fingerprint gap is filed as issue #503. All 48 rows read `noGrant` true — the state's whole intake is what the walk earned — and every closed era's bank state scanned finite.

## The later-era distributions against the 5–10 credited-hour window

A later era classifies `in-window` at 5–10 credited hours, `↓` under, `↑` over, `·` open when the budget ended inside it. Counts cover every closed later era across the matrix:

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

- **The first later era is the window's strongest evidence, with the variance recorded beside it.** At 25m it lands in-window or under on three of eight seeds per fighting policy (4.17–7.08h) and runs 10.8–31.3h on the roll-starved openings (157, 99, 11 — the same seeds #490 recorded as door-delayed — plus 2026 and 7). At 60m, six seeds demonstrated era 1 per fighting policy and three landed in-window (7–8h on 468 and 7, 5h on 23). Seed variance, not curve drift, dominates the spread.
- **The deeper later eras drift long, on both shapes.** Era 2 runs 7.5–28h depending on seed and schedule; era 3, demonstrated on 15 of the 48 walks, runs 6.25–25.83h. Each later bank claims one full decade more era-earned than the last — the authored claim curve pays 2 Arete per decade — and the decade's credited price grows past ten hours on most seeds. On the complete walks (468 and 23 on both shapes) eras 1–2 sit at 4.58–11h and era 3 at 6.25–22h. This is the recorded calibration input for #492's horizon work, not a defect this ticket tunes away: the entry depth and first-era pacing are #490's calibrated figures, the deeper decades' pacing is exactly what #492's 100-hour calibration revisits.

## Faster return through familiar territory, and the rebuilding share

Three reads per later era, from the era ledgers — figures across all 86 closed later eras that carried a crossing:

- **Faster return**: the era's familiar credited walk (from zero to the previous bank's depth) against the previous era's FULL credited span to that same depth. Demonstrated in **78 of the 86** closed later eras; the eight misses are the deepest demonstrated eras of seeds 468 and 23 (six) and 2026-era-2-class walks (two) — the walks where the previous era's span was itself short and the re-walk's saving thins. The retained purchases — the Catalog, the capacity offerings, the World line, the class development — re-walk the claimed ground faster than its first development on nearly every demonstrated era.
- **Rebuilding share** — recorded as a finding, not argued away: the credited span the era spent regaining the production the reset erased, against the era's whole span, stays at or under half in **62 of the 86** closed later eras and exceeds half in **24** (11 of 48 at 25m, 13 of 38 at 60m; floor 0.23, top 0.80). The misses concentrate in the support line's 60m walks (nine) and in the deepest demonstrated eras. The criterion's absolute reading — never most of ANY later era — is therefore not demonstrated on this recording; what is demonstrated is the majority hold plus the exact shape of the misses: the 60m shape's long sessions credit enough time that the rebuild's absolute span (~5–7 credited hours at 25m, ~5–11h at 60m) reads as a larger share even where it matches the baseline's figure. Whether the deeper-eras' regain span itself should shrink is #492's calibration question.
- **New territory**: the credited share beyond the previous bank's depth — the part of the era that is genuinely new frontier — means 0.29–0.53 per slice and era. The familiar span dominates credited time on most walks: the depth the player re-walks grows a full decade per bank while the new-territory stretch is the single decade the era banks. What retained strength buys is the *pace* of the familiar re-walk (faster on 78 of 86 eras), not its share of the clock.

## The no-refund routes at the tested frontiers

The suite's route probe enumerates **every affordable purchase order at each tested frontier a probed walk recorded** — the exact bank states, each claim unspent, each piece priced from that state's own ladders (the Column's price grows with the copies owned; the Hone ladder's next rung; the Catalog entry while unowned) — and drives each order through the engine's own purchase and placement actions: every order lands, refunds nothing, leaves the recorded state finite, and finds seats for the rig. The always-on case reads the two banks of a baseline pushing walk (frontiers 2 and 4); the recorded report carries the four-bank enumeration of the 60m support walk — **frontiers 2, 4, 6, and 8** — under `routeProbes` in [the results](later-era-results.json). No order at any probed frontier failed a read: no affordable, irreversible purchase strands the route forward.

Beyond the probed frontiers, the walks themselves demonstrate the routes at every frontier they passed, per era in the recorded rows — what the Arete bought, what deployed, what died:

- **Support** (charge line first) is the strongest route: defeats reach **w2 by frontier 6** on seeds 42, 468, 2026, and 23 at 25m and 468, 7, and 23 at 60m; w0–w1 on the other demonstrated seeds except 157@60m (budget-ended before its first bank). The era bonuses of the kills are visible in its era durations (seed 23 at 60m: 5/7/10h — the matrix's only all-in-window completed walk).
- **Combat** (blade first) matches the w2 chain at 25m on 42, 468, and 2026, but its honed blade starves without the charge line elsewhere — at 60m only 468 kills, and the walks whose line never formed (7, 99, 11, 23 at 25m and 60m) run the longest eras of their slices. The material cost of skipping support, paid under no-refund rules.
- **Ignoring** banks its claims everywhere it demonstrated (postponing combat remains possible) and defeats nothing anywhere; its later eras run longest at the same seeds (23 at 25m: 5.00 / 10.83↑ / 22.50↑ against support's 4.58↓ / 6.67 / 6.25).

The discovered-enemy pressure the ignoring walks paid is the era-earned depth bands' own arithmetic (issue #489): at frontier 6's depths three to four enemies sit discovered and alive, their production factor multiplying down while the fighting walks' defeated enemies pay their era bonuses instead. Combat and supporting placement confer their benefit exactly there: shorter eras at the same claims, and kills the ignoring route never collects.

## The three policies compared

The declared spending orders behave as declared on every recorded walk (pinned in the suite on real walks): support bought 16 Columns / 6 Hone ranks across the 25m matrix, combat 4 / 16, ignoring neither (its Arete goes to the Catalog's capacity offerings — 8 Chord Catalysts — the prompt policy's own lasting line). The comparison's material reading:

- **Combat + supporting placement confers a material benefit.** On identical seeds and schedules the support route's eras run shortest, its defeat ledger is the deepest and the most even across seeds (w0 on all seven demonstrated seeds at 25m, w2 on four), and its rig demonstrably fights — the defeats are recorded kills through the deployed charge line, not placements.
- **Postponing combat remains a possible trade-off.** The ignoring walks banked the same strictly larger frontiers under the enemies' full pressure — 2 of 8 seeds completed all four claimed frontiers at 25m (against support's 4) — paying for the postponement in era duration (up to +150% at the deepest demonstrated era) and in never collecting an era bonus.
- **The blade without the line is the middle case.** Combat-engaging's no-refund purchase order still advanced every frontier it demonstrated, but where the charge line never formed its kills stayed zero and its eras paid for it — supporting placement, not the blade alone, is what the World's route rewards.

## Every criterion beside its evidence

| Criterion (issue #491) | Named verification | Class |
| --- | --- | --- |
| Repeated productive eras through the real-action playthrough path — banked claims, purchases, combat deployment, recovery, strictly larger claimed frontiers | `closes the first era at its bank and reads the familiar/new split` (real walk: ledger's claim, frontier, split, finite); recorded compose case asserts per row: `noGrant`, frontiers strictly increasing, finite on every closed era; the 48 recorded rows carry purchases, placements, defeats, and both recovery marks per era | automated + recorded |
| Faster return through familiar territory; new-territory time measured; rebuilding not most of every later era | `closes the first era...` pins `rebuildingShare < 0.5` on a demonstrated era and the split recombining to the span; per-era views carry `familiarFaster`, `newShare`, `rebuildingShare`, both marks; **recorded finding**: faster return 78/86 demonstrated; rebuilding under half in 62/86, over half in 24 — the misses named above and owned by #492's calibration | automated + recorded (partial: the absolute never-most bar) |
| Later productive-era durations evaluated against 5–10 credited hours across declared policies, seeds, schedules; incomplete runs and misses explicit | `classifies eras: the opening is not a later era, and an open era stays open` pins the mechanics; the recorded tables above classify every closed later era of all 48 walks, per seed, with open eras explicit | automated + recorded |
| At tested frontiers: enumerated affordable Arete routes; charge/weapon/placement configurations surpassing resistance under no-refund rules; traps detected and repaired | `walks every affordable order at each tested frontier without a trap` (frontiers 2 and 4, real bank states, all orders through real actions); `demonstrates the combat route surpassing the first frontier's resistance` (the recorded defeat chain); the recorded report's `routeProbes` enumerates frontiers 2, 4, 6, and 8; the charge-line trap found during recording was repaired in the placement rule, never in currency | automated + recorded |
| Support-seeking vs combat-engaging vs enemy-ignoring: combat and supporting placement confer material benefit; postponing combat stays possible | `support buys its charge line before its blade; combat its blade before its charge line`; `ignoring never buys or deploys a World occupant, and still banks its claims`; the recorded comparison above (support defeats on every demonstrated seed, ignoring none, durations ordered) | automated + recorded |
| Consequential purchase/build/placement opportunities and finite numeric state per era; existing reset/readout behavior preserved; every criterion mapped | Per-era views carry the decision-gap read (`reads an open era honestly...`), route labels, and the finite scan; the compose case asserts finite on every closed era; existing reset/readout behavior stays pinned by the untouched `prestige.test.ts`, `world.test.ts`, `accumulator.test.ts` and #490's cases (their eras-1 semantics unchanged, the re-pinned journey figures in `app.playthrough.test.ts`); this table is the mapping | automated |

The dev panel's policy select gained the three declared options (a UI surface change): desktop and phone captures from the verified checkout are recorded under [docs/evidence/491-policy-select/](evidence/491-policy-select/).

## What this establishes and what stays open

Established: repeated productive eras exist on the shipped layers — four strictly larger claimed frontiers banked on real scheduled walks with per-era ledgers (15 of 48 walks completed the fourth bank within budget); retained strength demonstrably shortens the familiar re-walk (78 of 86 demonstrated eras); the first later era lands in the 5–10-hour window on three of the demonstrated seeds per slice and shape; the no-refund purchase routes are enumerated and trap-free at the probed frontiers (2, 4, and 6); and the three declared policies' trade-offs are recorded with the currency-integrity and finite reads green on all 48 walks.

Open, deliberately: a majority of the demonstrated deeper eras (era 2 and beyond) run past ten credited hours, 24 of 86 eras rebuild for more than half their span, and the fourth bank lands within budget on a minority of walks — the decades' pacing above the first frontier is #492's calibration target (the 100-hour horizon and the enemy ladder's upper decades), and the save migration the recalibrated curve implies is #493's. The entry depth and the first worthwhile prestige are #490's calibrated figures and were not re-tuned here. The recorded matrix is this ticket's evaluation evidence; it is not a claim that the deeper decades already pass.
