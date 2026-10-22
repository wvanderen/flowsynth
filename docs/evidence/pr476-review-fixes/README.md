# PR #476 review corrections

Source revision: bd050566. The preflight accepted this checkout at http://localhost:5173; provenance.json records the full SHA and worktree.

## Findings and verification

- Pending selection and keyboard focus: `app.scenarios.test.ts`, `keeps pending selection and focus through %s ticks` runs for flow and breather, retains node identity/focus/value over a tick, then launches the pending choice. `app.board.test.ts`, `the gesture survives a render between moves; the position persists` verifies the persistent grip still drags through a render.
- Rejected launch candidate: `app.scenarios.test.ts`, `rejects a failing candidate before changing state or the save destination` forces the descriptor assertion to throw before any install. State identity, active scenario and ordinary bytes remain unchanged. A later explicit save still reaches the ordinary slot before isolation; after a Focus launch it remains private, including unload.
- Native option titles: removed. The panel parity case asserts the fresh-start option has no title; the app catalog still exposes situation/origin to agents and the standing launch declaration exposes them visibly.
- Repeated fresh-start facts: situation now reads `the shipped opening board`; the summary owns the grant, synth count and mode. phone.png records the composed declaration without repeated facts.

## Browser evidence

- desktop.png: 1280×800, Focus running, pending Fresh start selected and focused across six live ticks. Evaluate returned sameNode=true, focused=true and value=fresh-start after 600ms.
- phone.png: 390×844 (confirmed in-page), the same live-tick check passed, then the panel Launch control installed Fresh start. The screenshot retains the visible focus ring and shows the simplified declaration. Option-title count was zero.
- Both compositions were visually inspected against the instrument standard: square controls, open panel, plain textual declaration and non-color selection/focus. The pointer-capture drag contract remains covered by the named automated case.
- Native platform picker touch interaction, greyscale and reduced-motion emulation remain unavailable in this capture harness. No new animation was added.

## Checks

Targeted scenario and board suites: 132 passed. `npm run check` passed. Final `npm test`: 94 files passed, 1880 tests passed, 2 skipped. Evidence-only additions after this run do not change source.
