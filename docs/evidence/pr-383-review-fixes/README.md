# PR #383 review corrections

Captured from `/Users/eggfam/.t3/worktrees/flowsynth/t3code-9dc34990` at
`http://localhost:5175/`, with the provenance endpoint verified against that
worktree and base commit `a28a61e18ef2948b924725e938bc0ef2d9df47f0`, plus the
review corrections committed alongside this evidence.

- [Desktop, 1280 × 800](desktop.png): unaffordable Add focused with its price
  description visible. Escape closes the read; Enter refuses the locked action.
- [Phone, 390 × 844](phone.png): Collection opened by touch; its full description
  clears the board controls and stays within the viewport. All five tools were
  checked for visible first-tap disclosure, viewport bounds, and tap-away
  dismissal. Catalog's second tap opens the catalog.

The T3 collaborative preview disconnected during verification. Final screenshots
and interaction checks used headless Chromium with Playwright; the phone context
used mobile layout and touch emulation. Physical-device testing is unavailable.
No new motion was introduced; a separate reduced-motion pass is unavailable.
The tooltip remains plain text over the panel, with no border, shadow, or radius,
as required by the pinned controls sheet in `docs/instrument-standards.md`.

Validation: `npm run check`; `npm test` (64 files passed, 1,376 tests passed,
two skipped); `npx vitest run --project ui` (751 tests passed). New interaction
tests cover touch inspection before activation, tap-away, and focusable locked
controls that refuse activation. The existing catalog glossary expectation now
includes the heading's definition.
