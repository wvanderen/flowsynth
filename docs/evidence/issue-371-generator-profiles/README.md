# Issue #371 — generator profiles and charge-quantity reserves

Verified `http://localhost:5174/` through `/-/dev/provenance` before
capture: worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-0ede4b42`,
branch `t3code/issue-371-implementation`, commit `f290865` (HEAD) with the
implementation as uncommitted changes. The later review fixes (goal-base
constant home, comment sweeps, reserves internals) touch no captured
surface — the quoted figures are the same authored coefficients.

`shelf-flywheel-desktop.png` (desktop, 1402×877 CSS pixels) captures the
starter shelf's Flywheel row: the new name and the one description line,
with the "charge" term disclosure riding the existing dotted-underline
pattern — a real button with the accessible name "charge — what it means",
keyboard and touch reachable (verified in the accessibility tree; no new
disclosure furniture was added).

`forge-generators-desktop.png` captures the Forge's candidate tiles for
the three named designs: FLYW / SCRB / MILE nameplates, the exact profile
effect lines ("+0.1 charge/s of practice · modest note and goal credit",
"+30 charge per new note · +1/char · modest practice credit", "×5
completion base · modest practice and note credit"), and the rarity word
COMMON as text — state never rides color alone. The tray tile was checked
in the DOM: its title reads "Flywheel · common · Tier 1 — click, then a
cell" through the same META table.

`forge-generators-phone.png` (~390×844 CSS pixels) captures the same
Forge sheet on the phone layout: the candidates stack, the disclosures
and names stay identical, and the thumb bar's Forge door opens the same
modal — no separate phone economy or duplicate readout.

Validation: repository typecheck, full suite (67 files, 1,427 tests
passed, 2 skipped), and the UI regression project (27 files, 761 passed)
all green at capture time, re-run green after the review fixes. The forge
suite gained an app-fixture assertion quoting the three generator effect
lines and their accessible names.

Unavailable, recorded honestly: native keyboard-focus and touch-screen
capture (desktop pointer only; the disclosure path is the existing
term-trigger pattern covered by app-fixture tests), reduced-motion capture
(the change adds no motion — names, copy, and one table), and a phone
capture of the shelf row (the resize budget went to the Forge sheet, the
richer changed surface; the catalog modal is the same component at every
width).
