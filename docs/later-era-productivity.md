# Later eras productive and recoverable without refunds

Status: recorded evaluation, 2026-11-02 (issue #491, parent #484 stories 5, 17–27, and 42–43). The accepted direction lives in [ADR-0078](adr/0078-breakthroughs-preserve-further-progression-cycles.md); the first worthwhile prestige this evaluation builds on is recorded in [the ten-hour evaluation](first-worthwhile-prestige.md) (issue #490).

## What was evaluated

The shipped economy's repeated eras, on the existing scheduled playthrough runner invoking real engine actions — no second simulator, no shared-balance mutation, no grant, no refund. The runner grew the declared inputs this evaluation needs: a recipe walks **four claimed frontiers** (`eras: 4` — the opening era plus three later eras), and every closed era's ledger records its span on the credited clock, its banked claim, the strictly larger frontier it advanced to, the **familiar/new territory split** (credited seconds below the previous bank's depth against beyond it), the two faster-return marks (production regained, prior depth passed, both clocks from the era's own start), the consequential decisions and their pacing gaps, and a finite read over the exact recorded state the bank produced.

The declared matrix: eight seeds (42, 468, 157, 2026, 7, 99, 11, 23) × two session shapes (the suite's baseline two-25-minute day, ~0.83 credited hours, and its two-60-minute variant, ~2 credited hours — same five-minute breather) × the parent's three declared World policies, each pushing claims to the same target of 2 Arete:

- **Support-seeking** pays the Catalog entry, then Charge Columns while affordable, then Hone ranks cheapest-first — the charge line before the blade — and deploys its charge line before any waiting weapon.
- **Combat-engaging** pays the Catalog entry, then Hone ranks cheapest-first, then Charge Columns — the blade before the charge line — and deploys each weapon beside the fight immediately.
- **Enemy-ignoring** never buys or deploys a World occupant: the starter weapon stays in the tray, every discovered enemy's pressure stands for the whole era.

One placement rule joined the runner's shared leg, and it is the authored mechanic read literally: **a weapon whose fight is won relocates** to the next living discovered enemy (relocation is free between sessions), and a Column the fight left behind follows the charge line. Without it the walks park the blade beside a dead enemy forever and no later frontier's resistance is ever engaged.

Budgets are the walk's own honest stop: 70 baseline days, 30 long-session days. Reproduce after `npm install`:

```sh
FLOWSYNTH_LATER_ERA_REPORT=docs/later-era-results.json \
  npx vitest run tools/later-eras.test.ts -t "walks the full declared matrix"
```

The recorded [results](later-era-results.json) carry the window, the declared budgets, every row's clocks, every era's ledger, the per-era route reads, and the per-run source provenance (runner 13).

## The later-era distributions against the 5–10 credited-hour window

A later era classifies `in-window` at 5–10 credited hours, `under` or `over` outside it, `open` when the budget ended inside it. Era 0 — the opening — is not a later era; its 8–12-hour window is #490's evaluation.

FIXME-DISTRIBUTION

## Faster return through familiar territory, and the rebuilding share

FIXME-RETURN

## The no-refund routes at the tested frontiers

FIXME-ROUTES

## The three policies compared

FIXME-COMPARISON

## What this establishes and what stays open

FIXME-ESTABLISHES
