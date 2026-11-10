# #529 — distinct World hex presentation

## Scope and provenance

Branch: `t3/world-hex-presentation`. Prepared HEAD was `4f9cfa7`, exactly the requested #525 integration baseline; baseline ancestry passed. Read #529/#525 bodies and comments through `gh` (both had no comments), AGENTS, instrument standards, pinned `eb232c4` prototype source, World feedback brief, ADR-0087, and checks/review/verification/visual-evidence guides. No #526/#527 behavior authored here. No engine, coordinates, hit shapes, occupancy, targeting, combat, acquisition, or progression changes.

Confirmed seams: #525 Testing Decisions already approves application workflow/rendering and engine regressions. TDD uses those boundaries, no test-only API. The new `World hex identity (issue #529) > carries a six-sided steel silhouette from board to inventory, drag artwork and detail without changing cell hits` failed first with `expected 'rect' to be 'polygon'`, then passed after the shared builders changed. Only the explicit exterior silhouette contract is inspected, not glyph/bar internals or incidental path strings. The ghost's shared artwork is covered; actual pointer drag evidence is unavailable.

Environment: `npm install` completed (audit reports three high-severity dependency vulnerabilities; no unrequested dependency changes). Initial preflight rejected host Node 26.13.0. Documented manager fix `mise exec node@22.23.4 -- npm run preflight` passed: Node 22.23.4, America/Chicago, working happy-dom storage. Checks use supported-runtime npm scripts.

## Criterion mapping — final disposition

All tests below ran at the final merged source revision, `f1e66f05`.

| #529 criterion | Named verification | Class/status |
| --- | --- | --- |
| Board, inventory, drag, details share distinct hex silhouettes | New `world.test.ts` case named above; board/details use `plate`, inventory/real pointer ghost use `worldTileSvg` | Automated passed; visual and real-pointer evidence unavailable |
| Geometry, footprint, reserved positions, placement/retrieval and combat unchanged | New case compares every cell hit and state before/after inspection; `world.test.ts`: `switching layers alters no World or board state`, `arm-and-place lands a tray weapon on an open face, free`, `an occupied cell refuses; enemy cells refuse, cleared ones included`, `right-click retrieves to the tray; the arm's Esc cancels`. Engine `world.test.ts`: `thresholds, positions, and stats repeat unchanged each era — prestige never raises enemy strength`; full existing combat regressions retained | Automated passed; source diff has no engine edits |
| Enemy, cleared, Column, Blade identity/numeric state; no merge tiers | `world.test.ts`: `discovery replaces the reserved plate with the encounter's face and its penalty`, `defeat turns the face to its cleared state, era bonus engraved, encounter retained`, `a starved weapon's face reads UNFED — the state on the plate, never a tooltip apology`, `a fed weapon's face reads the charge figure and its attack power`, `a Column over a hostless cell wears the inert verdict; a hosted one its lift`; new detail case rejects module level/tier notation | Automated passed; visual readability unavailable |
| Application workflows and rendering tests preserve interactions | New board → inventory inspection → detail case; `inspect then Place arms the tray tile; back keeps the browser`, `relocation is free: arm a placed weapon and click another open face`, `in flow the faces read but nothing places, retrieves, or retargets` | Automated passed; real drag evidence unavailable |
| Pinned comparison, desktop/phone board/inventory/drag/details, non-color, keyboard/touch, reduced motion | Source comparison against pin and explicit World amendment; limited page checks and failed browser recovery detailed below | Manual partial; required visual/accessibility evidence unavailable, acceptance blocked |
| No adjacency/topology/targeting/combat redesign or extra furniture | Source/spec review: authored diff is World outlines, shared icon, silhouette regression and domain wording only | Source review passed |

## Preliminary source/spec review — before freeze

Self-review, no delegates, against #529/#525, ADR-0087, instrument standards and pinned `eb232c4`: open divisions, square controls, existing technical/monospace hierarchy, steel register, no added furniture. World keeps functional glyphs and hatch/engraved/dashed state grammar, not module category rails, rarity finish or merge rings. Flat-crowned hex plates fit inside existing full-cell hits. Shared tray/drag builder and detail `plate` eliminate square-face drift; reserved hatching follows the outline rather than overlaying a square.

Findings reported together: (1) stale square-plate comments needed correction; (2) CONTEXT needed shipped-presentation-only reconciliation rather than marking sibling progression work shipped. Both resolved in one pre-freeze revision. Second source/spec pass read fixes: no remaining source blocker found. Optional broader rendering deduplication declined: unnecessary scope/interference risk. This was the source gate, not final acceptance.

## Freeze and integration merge

Initial freeze: `9569bcb356a6f2736c4fe5853e0eb7cfe9da1c1b`. Initial integration merge was up to date. During verification integration advanced to `4329105` (#527); merged as `f1e66f05`. No conflicts, World-face edits or engine edits from integration. Rechecked source gate against the merged diff; ledger/reset changes remain sibling work. Final freeze is `f1e66f05`; previous suite/provenance results were superseded, not relabeled. Final `git merge-base --is-ancestor integration/525-world-progression HEAD` passed with integration tip `4329105`.

No balance recording owed for this presentation-only change; historical calibration is not validation of #525's pending acquisition economy.

## Final checks at f1e66f05

- [targeted.log](targeted.log): World, Hex detail, inventory and integration board workflows pass.
- [check.log](check.log): `npm run check` passes, including recorder static gate.
- [full-test.log](full-test.log): `npm test` passes: 127 files, 2,397 passed, 9 skipped; 1,130.37 seconds. A previous initial-freeze attempt hit the 200-second command timeout; its longer rerun passed, then the integration merge invalidated it. Only the final merged run is offered. Git-not-a-repository diagnostics occur in successful test logs; no failed tests accompanied them. Skips are not claimed as executed.
- [provenance.json](provenance.json): capture preflight passes for `http://localhost:5174`, correct worktree, final merged commit and clean source.

## Browser evidence — unavailable, not waived

No screenshots or real-drag recording were produced. No substitute image is represented as evidence. The requested final desktop/phone visual acceptance is **not satisfied** and remains a blocker, not an approved scope waiver.

### Recovery log

Initial source freeze, same verified checkout/server:
1. `preview_snapshot(includeImage=true,save=true)` failed: `Preview automation snapshot timed out after 15000ms`.
2. Evidence healthcheck: server provenance OK. Status: available, loaded, no dialog, correct URL, 1280×800, `visible:false`. Activation via `preview_open(open=true)` still false.
3. Same snapshot retried after status/activation: same timeout.
4. Status read again: still available/loaded/dialog-free/correct URL. Third/final same snapshot: same timeout. Budget exhausted. Desktop board/inventory/drag/details captures and visibility confirmation unavailable. The merge does not repair this external pipeline; these failures never became evidence and are not claimed at the merged source.

Final merged-source phone attempt: requested `preview_resize(390,844)` returned the requested setting but actual viewport stayed 1280×800. Three attempts, a status read between each, and live `innerWidth/innerHeight` read after each: always 1280×800. Budget exhausted. Phone board/inventory/drag/details captures and touch verification unavailable.

### Limited final-page checks (not visual evidence)

Used existing `devWorldEra()`, made w0 discovered with HP 7, w1 cleared, placed Blade store 9, rendered. DOM read returned:
- `ENEMY / HP 7/12 / −20% ν`
- `CLEARED / +8% ν`, `RESERVED`
- `BLADE · UNFED / ⌁9/30 / ATK 4`
- `COLUMN / inert · no host`

Programmatic inventory inspection showed Charge Blade, charge/capacity, ATK, Place and target priority; detail showed the matching placed Blade figures. These confirm copy, not visual readability. Text states, hatch, dashed open edges and engraved cleared state preserve non-color distinctions in source/tests; visual greyscale judgment unavailable.

Accessibility: evaluation focused the real inventory button, confirmed active element, accessible name `Inspect Charge Blade · ⌁0/30 · ATK 4`, and computed 2px solid focus outline. `preview_act(press Enter)` returned but did not open inspection: real keyboard activation is **unavailable**, not passed. Touch access unavailable. Application tests do not replace physical keyboard/touch evidence.

Reduced motion: loaded CSS has static reduce rules for `.world-plate.pulse` and `.world-bar-fill.live`; live breathing is restricted to `no-preference`. No new motion introduced. Reduced-motion emulation is unavailable through this preview interface. `animationName:none` on seeded unfed/static faces does not establish reduced-motion behavior for live supplied weapons.

Pinned comparison is source/spec only: panel composition, controls and state vocabulary retained; silhouette follows the explicit World amendment. No captured desktop/phone comparison claimed.

## Final acceptance

Implementation and automated/source checks are complete, committed, and local integration merged. Criterion 5's visual, keyboard/touch and reduced-motion evidence remains unavailable and **blocks full acceptance**; real drag and visual readability portions of other rows remain limited as declared. This record does not declare #529 fully accepted. No issue closure, PR, or subagents.
