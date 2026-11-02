# The first worthwhile prestige around ten credited hours

Status: recorded evaluation, 2026-11-01 (issue #490, parent #484 stories 1–4, 22–24, 28–31, and 42–43). The accepted direction lives in [ADR-0078](adr/0078-breakthroughs-preserve-further-progression-cycles.md); the four-hour experiments this evaluation supersedes as a baseline remain recorded in [the balance plan](balance-implementation-plan.md) as early baselines, not failures against the revised target.

## What was evaluated

The shipped economy's opening, on the existing scheduled playthrough runner invoking real engine actions — no second simulator, no shared-balance mutation, no grant. The declared matrix: eight seeds (42, 468, 157, 2026, 7, 99, 11, 23) × two session shapes (the suite's baseline two-25-minute-day and a two-60-minute variant, same five-minute breather) × the two declared policies. The **prompt** walk prestiges at the first between-sessions horizon crossing — the eligibility door, whose claim is whatever the curve pays there. The **pushing** walk holds that door until the pending claim reaches its target, then demonstrates the worthwhile-prestige journey the runner now measures (runner v11): the banked claim, the first lasting Arete purchase, the starter weapon and Charge Column deployments, the return toward pre-reset output, the next eligibility crossing, and the frontier advancing beyond the claimed frontier — each timed on both clocks, unreached marks explicit, and the walk's completion requiring every mark.

One authored figure changed to make the journey reachable: the frontier claim curve's entry depth (`BALANCE.world.entryNous`) moves from findings.md's hypothesis 1e12 to **2e7 era-earned** — a short hold (≈2.9×) past the 7e6 prestige horizon. At the hypothesis figure no seed, schedule, or policy banked a positive claim inside any baseline-budgeted run: the first worthwhile prestige did not exist. The enemy ladder's thresholds ride the entry depth they derive from, so the World's reveal scale moves with it. The curve's slope remains the flagged findings.md hypothesis; only the entry is calibrated.

Reproduce after `npm install`:

```sh
FLOWSYNTH_FIRST_PRESTIGE_REPORT=docs/first-prestige-results.json \
  npx vitest run tools/first-prestige.test.ts -t "walks the full declared matrix"
```

The recorded [results](first-prestige-results.json) carry the target window, the declared budgets, every row's recipe-driven clocks (elapsed calendar, credited flow, breather rest and breather production, management breaks — recorded separately), the journey marks on both clocks, the opening's decision-gap read, and the per-run source provenance (runner 11, engine `22f19337`). The always-on cases pin the matrix declaration, the gap rule, and the zero-claim row shape.

## The distributions against the 8–12 credited-hour target

Per-run classifications — counts are not evidence, and no average hides a miss:

| slice | in 8–12h | under | over | unreached | per-seed credited hours |
| --- | --- | --- | --- | --- | --- |
| pushing, 25m sessions | 1 | 2 | 5 | 0 | 42: 7.92 · 468: **8.33** · 157: 17.08 · 2026: 16.25 · 7: 14.17 · 99: 21.67 · 11: 12.5 · 23: 6.25 |
| pushing, 60m sessions | 2 | 0 | 5 | 1 | 42: 20 · 468: **11** · 157: unreached · 2026: 18 · 7: 17 · 99: 20 · 11: 30 · 23: **8** |
| prompt, 25m sessions | 0 | — | — | 8 | every door banks the honest zero (doors at 5.4–16.7h) |
| prompt, 60m sessions | 1 | 0 | 0 | 7 | seed 23's single long session carried the era past the entry before its door check: a legitimate 2-Arete bank at 8h; the rest bank zero |

Read with the eligibility doors beside them: the prompt 25m doors land 5.4–16.7 credited hours (median ~11) — the horizon is paced around ten — and the worthwhile bank adds the entry hold, ≈0.8–4.7 credited hours later. The over-window pushing runs are door variance, not curve drift: seed 157's door alone sits at 14.2 credited hours (16 baseline days of roll-starved acquisition), and its bank inherits the delay. The 60m slices read systematically higher in credited hours at nearly identical day counts — a 60-minute day credits 2 flow hours against the baseline's 0.83 — the management-density effect the rows record separately (13–35 breaks per run; the gap table below). That is a property of longer sessions to record, not a defect the entry depth can tune away; tuning it out would push the baseline schedule below the window.

## The journey behind the bank

On the baseline schedule every one of the eight seeds banks its first 2 Arete and spends it the same break — Catalog entry first, Charge Column with it — and the ledger shows no missing currency and no hidden grant (the no-grant check compares the state's whole intake against the run's earned ν on every pushing row). Four of the eight (42, 468, 7, 23) complete the full journey inside the declared 30-day budget: the starter Charge Blade deploys beside the re-revealed w0 (2.9–8.8 credited hours after the bank), the next era regains its pre-reset production and crosses eligibility again (2.1–6.7h), and a second bank advances the frontier to 4–5 Arete (4.2–10.8h past the first bank). **The rig fights**: w0 sits defeated in every completed run's ledger, killed on the blade's own cadence by the Column-fed charge line — a functioning recovery route, not merely a placement. Seeds 157, 2026, 99, and 11 banked and spent but stopped inside the journey at budget (recovery or frontier marks explicitly unreached) — recorded misses, each with its bottleneck and the engine's own decline reason.

## The opening earns its length

Gaps between meaningful decisions (the declared rule: acquisitions, purchases, placements, Arete and World products, capacity rungs, feats, World finds — never level sweeps or session stamps), in credited time:

- **25m pushing runs**: 74–117 decisions per opening, mean gap 4–11 credited minutes, longest gap 25–50 minutes — one to two session lengths, closed by roll acceptances and feats. No stretch of the opening asks the player to wait on production alone.
- **60m pushing runs**: mean gap 7–10 credited minutes, longest 60 minutes — the session boundary itself, again closed by an acquisition.

Reaching the timing range alone was never the criterion; the gap table is the evidence the longer first era is eventful throughout. The full per-run gap lists ride the recorded JSON.

## What this establishes and what stays open

Established: the first worthwhile prestige exists on the shipped layers, banks a real claim, funds a lasting purchase and a functioning starter combat rig, demonstrates recovery, and advances the frontier — with its credited-hour distribution recorded against the 8–12 window and every miss named. The honest zero-claim reset survives beside it, confirmed outright.

Open for the later tickets: the entry slope's recoverability re-derivation (#425's blocker), later-era productivity and no-refund routes (#491), the 100-hour horizon calibration that revisits the enemy ladder's upper decades (#492), and the save migration the recalibrated curve implies (#493). The recorded matrix is this ticket's calibration evidence for the entry depth; it is not a claim that those later ranges pass.
