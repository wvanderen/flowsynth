# The playtesting suite's completion record (issue #474)

One record for the whole suite (#465's slice closure): every parent user
story and the implementation acceptance requirements beside its named
verification — automated check, manual evidence, or an explicit
unavailable gap. The parent's confirmed spec governs; the per-ticket
records (dev-controls-audit.md, the evidence READMEs, and the delivery
PRs' Verification sections) remain each slice's own mapping; this file
consolidates them, reconciles the audit against the final suite, and
adds the integrated whole-workflow verification (#474's own deliverable).
Automated names cite the assertions that would fail if the behavior
regressed; a green suite count proves none of this on its own. Parent
closure or modification stays with a separate authorized action — this
record does not close #465.

## The integrated whole-workflow verification (#474)

The new thread is `src/ui/app.workflow.test.ts`: one continuous
instrument walk across the five workflow stages — scenario selection, a
configured scripted run, terminal interventions, historical curve/board
inspection, export/import — alternating the human entry points (the
panel's controls through real DOM events) with the agent entry points
(`window.__flowsynth` methods and the terminal's commands), and carrying
the walked `approaching-prestige` preset through the same stages. Four
cases:

1. **the whole workflow through both entry points** — catalog parity
   between the suite select and `devScenarios()`; the Launch control and
   `devScenarioAssert()`; a configured pushing run (policy, claim target,
   seed, budget) composed identically from the panel inputs and the agent
   command, stopping honestly incomplete (`claim none/2 Arete`); a
   +100ν click and four terminal commands landing in one intervention
   record with the engine's own refusal recorded verbatim; a plotted
   click and the shared inspection command landing on the same exact
   recorded state, with the read-only history board and the
   keyboard-opened term disclosure; and the artifact round trip through
   the Export button, the file picker, and the terminal's
   `runs`/`export`/`select`/`import`. The ordinary save is byte-identical
   from boot to the last command.
2. **the walked preset rides the same workflow** — the awaited preset
   launch installs with its own walked record (selected, unmodified,
   `walked here` provenance); an intervention marks the walked record's
   library entry and the curves provenance line; the artifact carries the
   checkpoint stop and the modified status across a fresh browser; and
   two continuations from the walked state — the prompt policy meeting
   the preset's open door at its first between-sessions moment and
   banking the honest zero-Arete claim, the pushing policy holding the
   door and playing real sessions — each its own identified record,
   leaving the carried evidence and the ordinary save untouched.
3. **the audit's reconciliation, control tier** — every audited control
   on the final panel, and ADR-0077's two tiers demonstrated on one
   control: +100ν with no run installed writes the ordinary save at once
   (the audit's repair); with a run installed it is a recorded
   intervention and the save's bytes stand.
4. **the audit's reconciliation, retained surfaces** — the Focus scenario
   launching and re-asserting through the suite entry, and the allocation
   laboratory opening, solving certified, and closing.

### Issue #474's acceptance criteria

1. *Exercise scenario selection → configured scripted run → terminal
   intervention → historical curve/board inspection → export/import
   through human and agent entry points on the verified checkout.* —
   Automated: workflow cases 1–2 above. Manual: the browser evidence
   pass below runs the same thread live on the verified checkout
   (in-page; the captures themselves are recorded unavailable there).
2. *Include the representative pushing/earned-spending/recovery/World
   path and prompt-policy zero-claim behavior; show honest incomplete
   outcomes where milestones are unreachable rather than tuning gameplay
   to force completion.* — Automated, the representative path's named
   case: `src/ui/app.playthrough.test.ts` "pushes past the first
   eligibility, banks its claim, spends it, and measures both recovery
   marks" (the complete push → bank → earned spending → World placement
   → both recovery measures walk, with the no-grant ledger check);
   prompt-policy zero-claim: "prestiges at first eligibility and banks
   the honest zero-Arete claim" and workflow case 2's prompt
   continuation (`claims [0]` at the preset's open door). Honest
   incomplete outcomes: "treats an unreached claim target as an explicit
   incomplete outcome, never a fabricated bank" (the 6-Arete target the
   budget cannot reach), "reports a half-recovered era with the missing
   measure explicitly unreached" (`rate unreached`, no ✓), the one-day
   budget stop in workflow case 1, and the World-fight situation's
   walked record (`progression-presets.test.ts` "stops the pushing walk
   at the living fight with the placement unplayed"). No gameplay was
   tuned for this ticket; the demonstrations ride the shipped economy.
3. *Consolidate all 39 parent user stories and implementation acceptance
   requirements into one record referencing named tests, manual
   evidence, or explicit unavailable gaps.* — This document (the story
   table below and the requirements section).
4. *Reconcile the existing-control audit with the final suite.* — The
   reconciliation section below, pinned by workflow cases 3–4.
5. *Record desktop and phone compositions, meaningful interactions,
   required source-provenance preflight, applicable keyboard/touch
   disclosures, non-color states, and reduced-motion evidence under the
   instrument standards. Mark unavailable checks explicitly.* — The
   evidence pass below (`docs/evidence/final-workflow-474/`): preflight
   ACCEPT at the offered commit, the workflow's interactions and
   keyboard/touch/non-color/reduced-motion reads in-page; desktop and
   phone captures and the phone viewport are marked unavailable there
   with the raw failures, and the pixel compositions stand on the prior
   slices' captures.
6. *Follow repository final-revision dependency setup, targeted
   verification, typecheck, and full-suite rules without redundant
   unchanged-revision runs.* — Recorded in "Final checks" below.
7. *Cover parent story 39 and the integrated behavior of all prior
   stories; leave parent closure to a separate authorized action.* —
   This record; #465 left open.

## The 39 parent user stories

| # | Story (abridged) | Verification | Class |
| --- | --- | --- | --- |
| 1 | Every existing console control audited | `docs/dev-controls-audit.md` inventory (seven controls + console); the final-revision presence pin: `app.workflow.test.ts` "keeps every audited control on the final panel with its promised save tier" | manual + automated |
| 2 | Each control's effect/save behavior recorded with a retain/repair/replace/retire disposition | the audit's inventory table (effect, save, disposition columns); dispositions backed by `app.dev.test.ts` — "refuses every mode but flow and leaves the state untouched", "in flow it advances the real seam: production, credited practice, and elapsed together", "credits the one seam and lands in the ordinary save at once — a reload keeps it", "refuses while a session is live and leaves the session and the save untouched", "refuses while paused and preserves the complete state, board layer, and save", "in upgrade mode it grants the era and saves it: a reload returns the same era", "a normal instrument ignores every dev helper" | manual + automated |
| 3 | Fresh-start, approaching-first-prestige, post-first-prestige-with-Arete, active-World-enemy presets | `app.scenarios.test.ts` "declares the openings, the progression presets, and the Focus setup with their situations and origins" (five ids); `progression-presets.test.ts` "stops the approaching walk at the open door of the played first era", "stops the pushing walk immediately after its first earned bank, before the spending", "stops the pushing walk at the living fight with the placement unplayed"; the workflow rides `approaching-prestige` end to end | automated |
| 4 | The Focus evidence scenario remains available | `app.scenarios.test.ts` "launching Focus through the same boundary keeps the prior guarantees (#456)"; `focus-scenario.test.ts` "builds the intended habit, goal, and class advancement", "rebuilds equivalent state without accumulating grants, habits, goals, or progress", "assertions fail clearly when the expected setup is absent or inconsistent"; `app.workflow.test.ts` "keeps the Focus scenario and the allocation laboratory available per their recorded dispositions" | automated |
| 5 | Presets assert their intended situations; stale setups fail clearly | `app.scenarios.test.ts` "rejects a failing candidate before changing state or the save destination", "asserts a fresh start by its own named facts", "asserts a walked preset by its own named facts, and relaunch restores it", "fails clearly when the setup drifts, and relaunch restores it" (drift case); `progression-presets.test.ts` "fails the build with a named reason when the recipe cannot reach its checkpoint" | automated |
| 6 | Preset launches isolated from the ordinary save | `app.scenarios.test.ts` "launching fresh start installs the shipped opening state and leaves the ordinary save untouched", "launching from a boot with no prior save claims nothing else", "shared-save recovery cannot replace a launched scenario with unrelated state"; workflow cases assert byte-identical ordinary-save bytes across the whole thread | automated |
| 7 | Repeated launches rebuild the same setup | `app.scenarios.test.ts` "repeating a launch rebuilds the setup without accumulating, either scenario", "repeating a progression launch rebuilds the walked setup without accumulating"; `progression-presets.test.ts` "rebuilds the same stopped state from nothing on every read — no accumulation" | automated |
| 8 | Progression presets identified as recipe-generated checkpoints | origins on every descriptor (catalog case); `progression-presets.test.ts` "carries the recipe and origin provenance on each preset descriptor", "the declared checkpoint recipes > carries the baseline walk for the approaching door and the pushing walk past the 1T entry" | automated |
| 9 | Constructed setups explicitly identified | the origin classification (`constructed fixture` on Focus, `initial state` on fresh start) asserted in the catalog case; no constructed progression setup exists — the checkpoints are walked (same case) | automated |
| 10 | Inspect or play a preset; start a scripted run from it | `app.scenarios.test.ts` "a scripted run starts from a progression preset through the same run command"; `progression-presets.test.ts` "starts declared runs from every checkpoint preset through the same composition seam"; `app.workflow.test.ts` case 2's prompt and pushing continuations from the walked preset | automated |
| 11 | A recipe declaring starting conditions, seed, policy, schedule, overrides | `app.playthrough.test.ts` "carries starting state, seed, policy, claim target, schedule, budget, calendar anchor, and empty overrides", "rejects unsupported input by name instead of running a default", "declares the host calendar and rejects a different timezone before running" | automated |
| 12 | Accelerated runs follow current game actions and accounting | the runner rides the real actions: `app.playthrough.test.ts` "runs two 25-minute sessions with the five-minute breather and honest overnight gaps" (each session planned/credited through real session accounting; every ν traceable to `earnedNous`), "records purchases, placement, milestones, sessions, and the engine's own decline reasons" (real purchases through `buyShelfModule` et al.) | automated |
| 13 | Economy-only simulations distinguished from representative playthroughs | the record's `kind: "representative"` is carried and pinned by `playthrough-artifact.test.ts` "exports one versioned artifact carrying recipe, provenance, trajectory, reasons, status, and snapshots"; the calibration walk remains the economy-only kind (runner header; `capacity-calibration.test.ts` unchanged) | automated |
| 14 | Configurable two 25-minute daily sessions with a five-minute breather | `app.playthrough.test.ts` "runs two 25-minute sessions with the five-minute breather and honest overnight gaps" (four sessions, 1500 s planned/credited, 300 s completed breathers, exact stamps) | automated |
| 15 | Time between days uses actual game accounting | the same case (the overnight gap produced nothing — `totalEarned` equals `earnedNous`); "keeps local calendar starts and monotonic elapsed clocks across daylight-saving dates"; "rejects schedules that overlap a calendar day or overrun the budget" | automated |
| 16 | Prompt-prestige and pushing policies on the same schedule | `app.playthrough.test.ts` "pushes past the first eligibility…" beside "prestiges at first eligibility…" (same purchase rules, same schedule); "ignores the claim target behind the prompt door" | automated |
| 17 | Readable rules for purchases, placement, upgrades, endings, prestige | the policies' declared rule lists (`PROMPT_POLICY.rules`, `PUSHING_POLICY.rules` — data, asserted offered by "carries starting state…"); explainability pinned by the decision records every rule lands in ("records purchases, placement, milestones, sessions, and the engine's own decline reasons" — declines carry the engine's verbatim reasons) | automated |
| 18 | Consequential actions and reasons recorded | "records purchases, placement, milestones, sessions, and the engine's own decline reasons" (each decline carries a truthy reason); historical inspection reveals the moment's decisions ("selection reveals the matching board, state, and recent decisions through the shared command") | automated |
| 19 | Pushing policy targets a configurable pending claim above first eligibility | `app.playthrough.test.ts` "rejects a claim target the frontier curve cannot treat as a stopping rule" (0, 1.5, 100 refused), "pushes past the first eligibility, banks its claim…" (target 2 held past the zero door), "reproduces the pushing run from the same recipe and identifies a changed target" | automated |
| 20 | Target and actual claims recorded | `record.claimTarget` beside `record.claims` asserted throughout the pushing cases; the note's `claim 2/2 Arete` / `claim none/6 Arete` compositions | automated |
| 21 | Runs bounded by a configurable time budget | "returns an explicit incomplete result with milestone, bottleneck, and no granted resources" (stop `budget`), "reports the same prestige day when the budget ends on the crossing day", "rejects schedules that overlap a calendar day or overrun the budget" | automated |
| 22 | Incomplete results show the last milestone, bottleneck, and declined reasons | "returns an explicit incomplete result…" (`lastMilestone` truthy, `bottleneck` carries the stop and the last decline verbatim), "treats an unreached claim target as an explicit incomplete outcome…" (`bottleneck` names the 6-Arete target), and the no-decline form "No action was declined — practice rate alone did not reach the horizon" asserted by the budget case's bottleneck composition | automated |
| 23 | No automatic grants to force completion | `totalEarned` equals `earnedNous` in "returns an explicit incomplete result…", the pushing completion case, and "never lets an override touch the live state or the ordinary save"; no grant event exists in any record (the budget case asserts the absence) | automated |
| 24 | Fresh-start progression through prestige, earned spending, next-era recovery with World milestones | "pushes past the first eligibility, banks its claim, spends it, and measures both recovery marks" (Catalog entry + Charge Column spent from the earned claim; frontier advanced; w0 discovered; the spending ledger `entry 1 + 1 Charge Column`) | automated |
| 25 | Recovery measured by regaining pre-reset production and reaching eligibility again, both clocks | the same case (`recovery.productionRegained` and `eligibilityReached` exact marks on both clocks, ordered, credited ≤ elapsed); "reports a half-recovered era with the missing measure explicitly unreached" keeps the measures distinguishable | automated |
| 26 | Both simulated elapsed and credited practice reported | "reports both clocks per sample, and the axes switch"; the schedule accounting case's both-clock figures | automated |
| 27 | Balances and rate curves with purchase/unlock/session/prestige markers | `app.playthrough.test.ts` "classifies curve markers, and declined attempts and unlisted actions plot none", "records a frozen snapshot for every plotted sample and every event's exact moment"; the curves wiring ("opens empty, plots the run's samples, and selects from points, markers, and stepping"); #470's in-page composition reads | automated + manual |
| 28 | Selecting a historical point reveals its board, state, and recent decisions | "selection reveals the matching board, state, and recent decisions through the shared command"; "draws the selected board layers and exposes the same frozen state without editing the live board"; "keeps preparation decisions at a session boundary without future or stale sessions"; workflow case 1's plotted-click thread | automated |
| 29 | Historical inspection read-only | "inspection never mutates the active run, the save, or the recorded state" (frozen states throw on write); "keeps imported evidence read-only and unchanged by inspection"; "draws the selected board layers…" (no purchase affordances) | automated |
| 30 | The same inspection and game-action commands for agents | `app.terminal.test.ts` "plays a session loop through the same commands agents call", "reads the installed run's figures and names its identity and modified state", "validates data arguments before mutation and exposes the remaining workspace actions"; workflow case 1 runs the same commands through the panel input and asserts the shared intervention record | automated |
| 31 | Terminal and visual controls share validated tuning overrides | `app.terminal.test.ts` "runs the same tuned playthrough from the terminal, the panel inputs, and the agent command" (identical recipe/source/trajectory; identical rejection text through every door) | automated |
| 32 | Unsupported or invalid overrides rejected clearly | `app.playthrough.test.ts` "rejects unsupported, invalid, and inapplicable overrides by name before running"; artifact import's named rejections ("rejects a save file, non-JSON, and non-artifact JSON by name", "rejects unsupported versions clearly: newer, older, and missing") | automated |
| 33 | Interventions recorded; run marked modified | `app.terminal.test.ts` "performs real engine actions, records their outcomes, and marks the run modified", "marks the run modified only by interventions that landed — refusals record without the mark", "keeps the baseline recipe untouched and rebuilds clean on relaunch", "records the quick grants as interventions on a run, and never on the ordinary save"; the walked record's modified continuity (`app.playthrough.test.ts` "carries a modified preset install's interventions and mark through export and import"; workflow case 2) | automated |
| 34 | Versioned export with recipe, provenance, trajectories, reasons, snapshots | `playthrough-artifact.test.ts` "exports one versioned artifact carrying recipe, provenance, trajectory, reasons, status, and snapshots", "round trips through import with the record, status, and interventions intact" | automated |
| 35 | Imported artifacts inspectable after the original browser closes | `app.playthrough.test.ts` "reopens an imported run's inspection after the original session is gone"; `playthrough-artifact.test.ts` "freezes an imported artifact's recorded states whole, like a fresh walk's"; workflow case 2's fresh-browser reopen of the checkpoint record | automated |
| 36 | Reruns against different source create separately identified results | `app.playthrough.test.ts` "keeps reruns separately identified and each result's own provenance" (execution identity distinct; imported/modified evidence preserved; foreign `engineSource` carried with `≠ current`), "records engine content provenance and identifies a changed source", "reproduces the behavior-affecting outcomes from the same recipe and identifies a changed seed" | automated |
| 37 | Measurements and explicit failures, no automatic pacing verdicts | `playthroughNote`'s exact composition asserted everywhere (both clocks, claims, spending, recovery marks, the honest stop) — the assertions leave no room for a verdict field; stop reasons name moments and budgets, never judgments ("Recovery measured at day N.", "First prestige at day N.", the budget reasons); `playthroughStatusMark` is ✓/✗/◆ only | automated |
| 38 | Existing dev controls usable and suite entry/layout sensible on phone | `app.phone.test.ts` (thumb bar, phone anatomy, small-screen composition, coarse-pointer touch floor); phone captures: `docs/evidence/scenario-suite-2026-10-22/` (05, 06), `docs/evidence/issue-472/phone-terminal.png`, `docs/evidence/run-artifacts-473/` (phone, phone-curves, measured 44 px floors), and this record's `docs/evidence/final-workflow-474/phone*.png`. Full phone-based analysis remains a parent non-goal | automated + manual |
| 39 | Every acceptance criterion mapped to named evidence or an explicit gap | this record (and each slice's own record beside its delivery) | manual |

## Implementation acceptance requirements

The parent's Implementation Decisions, each beside its pin:

- **One application-facing playtesting command boundary** (terminal,
  visual controls, and agents): the `dev*` method family with the
  terminal dispatcher over it (`app.terminal.test.ts` parity cases; the
  panel wiring cases throughout `app.playthrough.test.ts`; the workflow
  thread exercising both doors on one instrument). No parallel launch or
  run path exists — the catalog (`scenarios.ts`) and the runner
  (`playthrough.ts`) have exactly one consumer boundary.
- **Reuse the authoritative seams**: the runner calls `advance`,
  `endSession`, `prestige`, the purchases, and World placements
  directly; the accounting cases (`totalEarned` = `earnedNous`, real
  session records with exact stamps) fail if a walk substituted its own
  economy.
- **Isolated in-memory installation, ADR-0077's two tiers preserved**:
  `app.scenarios.test.ts` (launch isolation, recovery-proof, no prior
  save) beside `app.dev.test.ts` "credits the one seam and lands in the
  ordinary save at once"; workflow case 3 demonstrates both tiers on one
  control in one thread.
- **Presets from declared recipe checkpoints; constructed setups
  classified**: `progression-presets.test.ts` (declared recipes, walked
  stops, provenance) and the origin catalog case.
- **Recipes declare every behavior-affecting input**: the recipe
  composition/rejection cases, including the timezone guard and the
  calendar-fit rejection.
- **Authored policies are understandable; the zero claim stands; no
  fabricated success**: the policy rule lists as data; "banks the honest
  zero-Arete claim"; the explicit incomplete outcomes (story rows 21–23,
  37).
- **Recovery measured, slower recovery valid**: the recovery-mark
  assertions and the half-recovered case.
- **Records and snapshots consistent; no interpolated board**: "records
  a frozen snapshot for every plotted sample and every event's exact
  moment" (every sample resolves to its exact recorded state whose
  recomputed rate equals the plotted figure; every event's stamp equals
  its snapshot's).
- **Read-only historical inspection; no resume/fork**: the read-only
  cases; no path writes historical state back into a run (nothing in the
  diff adds one; the selection is the only owner of the inspected
  snapshot).
- **One-place ownership**: the recipe owns configuration (a tuned run
  leaves `devPlaythroughRecipe().overrides` empty — "never lets an
  override touch the live state or the ordinary save"); the action
  record owns decisions (inspection's events are the record's own
  objects, asserted by reference); the selection owns the inspected
  board (`devInspected` is the one field); the artifact owns persisted
  provenance (round-trip and rejection cases).
- **Overrides declared, validated, confined**: "rejects unsupported,
  invalid, and inapplicable overrides by name before running"; the
  tuned run names its tuning in the note; the override never leaves the
  candidate.
- **Artifacts versioned with provenance; old results preserved;
  reruns identified separately**: the artifact format's version
  rejections (older *and* newer, by name); "keeps reruns separately
  identified…"; the foreign-source provenance line.
- **Every current control audited; allocation laboratory preserved
  (ADR-0051); draggable console preserved (ADR-0050)**: the audit
  document; workflow cases 3–4; `app.board.test.ts` "the dev console's
  drag handle", `app.capacity.test.ts` "the dev allocation board
  (#257)".
- **Instrument standards and phone entry**: the evidence passes
  (below), the touch-floor and phone-anatomy suites.
- **No invented pacing thresholds**: story 37's row; no check in the
  suite encodes a target day, rate, or recovery figure as a requirement —
  the numeric assertions pin recorded facts of declared fixtures
  (deterministic walks), never acceptability.

## Reconciling the audit with the final suite

`docs/dev-controls-audit.md` recorded seven controls' dispositions at
#466. The reconciliation at the final revision:

| Control | Audit disposition | Final-suite status |
| --- | --- | --- |
| Minute jumps | Retain | Present (workflow case 3's inventory pin); behavior: "in flow it advances the real seam…", "refuses every mode but flow…"; persistence unchanged (flow heartbeat, hide/unload) |
| Timed-target jump | Retain | Present; behavior: "refuses outside flow by naming the clock…", "lands exactly on the target…" |
| Resource grant +100ν | Repair (saves at once) | Present; the repair's regression pinned ("credits the one seam and lands in the ordinary save at once — a reload keeps it") and re-demonstrated across both ADR-0077 tiers in workflow case 3 |
| Module grant +synth | Retain | Present; `app.board.test.ts` "the dev panel's synth grant (#137)" |
| World setup | Repair (upgrade-only) | Present; "refuses while a session is live…", "refuses while paused…", "in upgrade mode it grants the era and saves it…" |
| Focus setup | Retain (now the suite entry) | Available through the suite entry: "launching Focus through the same boundary keeps the prior guarantees (#456)" and workflow case 4; the audit's amendment (#467) records the entry change |
| Allocation-board access | Retain (ADR-0051) | Available and unsaved: `app.capacity.test.ts` "the dev allocation board (#257)" and workflow case 4 (opens, solves certified, closes) |
| Console + grip | Retain (ADR-0050) | Present; `app.board.test.ts` "the dev console's drag handle"; the grip pin in workflow case 3 |

The audit's declared gap stands as recorded: the World-era refusal
shares one mode guard across flow, paused, and breather; only the flow
case carries its own browser demonstration (the paused case is
automated; the breather case rides the same branch without a dedicated
case). Nothing in the later tickets widened or repaired that surface.

## Browser evidence (#474)

`docs/evidence/final-workflow-474/` — the whole workflow thread ran live
on the verified checkout (preflight ACCEPT, clean source at the offered
commit), twice, with the panel's composition, the honest incomplete run
note, the intervention record, the curves provenance line, and the
export/import receipts read in-page; keyboard disclosure, touch floors,
non-color states, and reduced motion read there too. Desktop and phone
captures and the phone viewport are **unavailable** in that pass — the
preview screenshot pipeline stalled on every attempt and the 390×844
resize never landed (both budgets spent and recorded in that README) —
so the pixel-level compositions stand on the prior slices'
verified-checkout captures (`scenario-suite-2026-10-22`, `issue-472`,
`run-artifacts-473`, `dev-controls-audit-2026-10-22`) beside the
honestly-recorded partial passes (`playthrough-468`, `pushing-469`,
`resource-curves-470` + its review fixes, `progression-presets-471`).

## Final checks

Dependency install before the first check; targeted runs while iterating
the new file (`npx vitest run src/ui/app.workflow.test.ts`, `npm run
check` after each edit). At the offered source revision (`194eeb7`): one
`npm run check` — clean — and one full `npm test` — 99 files, 1,976
passed, 2 skipped, no failures — the UI project included, no separate UI
pass. The later commits carry only this record and the evidence
artifacts; per `docs/agents/checks.md` they retain that provenance and
owe no further run.
