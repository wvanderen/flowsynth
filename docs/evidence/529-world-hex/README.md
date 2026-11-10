# #529 — distinct World hex presentation

## Scope and provenance

Branch: `t3/world-hex-presentation`. Prepared HEAD was `4f9cfa7`, exactly the requested #525 integration baseline; `git merge-base --is-ancestor 4f9cfa7 HEAD` passed. #529 and #525 bodies/comments read through `gh` (both had no comments). No #526/#527 behavior is implemented here. No engine, coordinates, hit shapes, occupancy, targeting, combat, acquisition, or progression changes.

Confirmed seams: #525 Testing Decisions already approves the existing application workflow/rendering boundary and engine regressions. TDD uses that existing boundary, no test-only API. The new `World hex identity (issue #529) > carries a six-sided steel silhouette from board to inventory, drag artwork and detail without changing cell hits` failed first with `expected 'rect' to be 'polygon'`, then passed after the shared face builders changed. Only the explicit exterior silhouette contract is inspected, not glyph/bar internals or incidental path strings. Real drag evidence is separately owed below.

Environment: `npm install` completed (audit reports three high-severity dependency vulnerabilities; no unrequested dependency changes). Initial `npm run preflight` rejected host Node 26.13.0. The documented manager fix `mise exec node@22.23.4 -- npm run preflight` passed: Node 22.23.4, America/Chicago, working happy-dom storage. Checks use supported-runtime npm scripts.

## Criterion mapping

| #529 criterion | Named verification | Class/status |
| --- | --- | --- |
| Board, inventory, drag, details share distinct hex silhouettes | New `world.test.ts` case above; board/details use `plate`, inventory/real pointer ghost use `worldTileSvg`; final desktop/phone captures owed at freeze | Automated + manual owed |
| Geometry, footprint, reserved positions, placement/retrieval and combat unchanged | New case compares every cell's hit geometry and complete state before/after inspection; existing `world.test.ts` cases `switching layers alters no World or board state`, `arm-and-place lands a tray weapon on an open face, free`, `right-click retrieves to the tray; the arm's Esc cancels`; engine World regressions at final suite | Automated; final pass owed |
| Enemy, cleared, Column, Blade identity and numeric state; no merge tiers | Existing `world.test.ts` enemy/occupant cases (reserved concealment, discovery/HP/penalty, cleared bonus, fed/unfed, inert Column); new detail case rejects module level/tier notation; desktop/phone review owed | Automated + manual owed |
| Application workflows and rendering tests preserve interactions | Existing World application tests plus new board → inventory inspection → detail case; real drag evidence owed | Automated + manual owed |
| Pinned comparison, desktop/phone board/inventory/drag/details, non-color, keyboard/touch, reduced motion | Pinned `eb232c4` prototype source and current instrument standards / World amendment read. Final evidence owed at freeze | Manual owed |
| No adjacency, topology, targeting/combat redesign or extra furniture | Source diff limited to World outlines, shared icon, explicit silhouette regression and domain wording; source/spec review below | Source review |

## Preliminary source/spec review (before freeze)

Self-review, no delegates, against #529/#525, ADR-0087, instrument standards and pinned `eb232c4` composition: open divisions, square controls, existing technical/monospace hierarchy, steel resource register, no added furniture. World deliberately keeps its functional glyphs and hatch/engraved/dashed state grammar, not module category rails, rarity finish or merge rings. Six-sided flat-crowned plates fit inside existing full-cell hit regions. Shared tray/drag builder and detail `plate` eliminate square-face drift; reserved hatching uses the same outline rather than a square overlay.

Findings reported together: (1) stale square-plate comments needed correction; (2) CONTEXT needed a shipped-presentation-only reconciliation rather than marking sibling progression work shipped. Both resolved in the same pre-freeze revision. Second source/spec pass: fixes read, no further source blocker found. Optional broad World rendering deduplication declined: unnecessary scope and interference risk with sibling work. Final acceptance is not claimed here.

## Freeze and final evidence

Owed at freeze: final `npm run check`, `npm test`; provenance-gated desktop/phone board, inventory, drag and details; keyboard/touch and reduced-motion checks. No balance recording is owed for this presentation-only change; historical calibration is not validation of #525's pending economy.
