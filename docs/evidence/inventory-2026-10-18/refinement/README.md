# Inventory and face refinement — 2026-10-18

User-directed follow-up: `Lv.` above the face identity line; rarity + name + Roman tier together on that line; `Lv.` restored on level readouts; inventory name/tier baseline alignment; inset dropdown chevrons; filled hexagonal hypercube center.

Provenance checked from `http://localhost:5174/-/dev/provenance`: worktree `/Users/eggfam/.codex/worktrees/a478/flowsynth`, commit `305e669f6e72b0b5b55fae1bcd4e792596e1a636`, with the local diff applied. The approved instrument standards and this user's follow-up govern the refinement.

- [Desktop, 1440 × 960](desktop.jpg): level above grouped rarity/name/tier; inventory examples include common/uncommon/rare, tiers I–V, long names, and one/two-digit levels.
- [Phone, 390 × 844](phone.jpg): no horizontal document overflow; inventory text uses baseline alignment; selects reserve 28px right padding with chevrons inset 12px. Native select semantics and keyboard interaction remain.
- [Collapsed inventory](collapsed.jpg) and [symbol close-up](hypercube.png): the centered hexagon is filled. The close-up is a browser capture of the actual control at 2× scale.

One batched desktop/phone inspection found no layout defects requiring a further style change. A cropped screenshot initially targeted a hidden container after resize; it was replaced with a capture of the visible button. Temporary inventory fixtures were removed by restoring the original preview state saved before the inspection.

Validation: `npm run check`, `npm run build`, `npx vitest run --project ui` (847 tests), and `npm test` (1,674 passed, 2 skipped across 83 files) all pass. `git diff --check` passes. Existing face/name and level-label assertions were updated for the requested presentation. No interaction logic changed in this follow-up.

The Impeccable detector reports incumbent layout-transition warnings and typography/radius advisories; the refinement adds no animation or rounded control. Native physical touch testing remains unavailable in this browser; no new gesture behavior was introduced. The earlier interaction evidence and passing regression suites cover shared inventory behavior.
