# Stable Hex detail and redundant control removal — 2026-10-18

User-requested follow-up removes the Store/Retrieve buttons from both enlarged faces and keeps the main composition stationary while inventory opens. The inventory overlays the stage; it no longer changes the detail inset according to its collapsed state. Shared drag retrieval remains.

Verified the serving worktree and commit through `http://localhost:5174/-/dev/provenance`: `/Users/eggfam/.codex/worktrees/a478/flowsynth`, `305e669f6e72b0b5b55fae1bcd4e792596e1a636`, with the local diff applied.

- [Desktop 1440 × 960](desktop.jpg): collapsed → expanded inventory changes the enlarged module's X and Y by **0px**; its width and height also stay identical. No Store/Retrieve button stands beside the faces.
- [Phone 390 × 844](phone.jpg): opening the inventory sheet changes the enlarged module's X and Y by **0px**. No Store/Retrieve button exists on either detail face.
- [Recorded bounds](checks.json) preserve both before/after measurements. No game-state fixtures were needed or modified.

Reviewed against instrument standards and the user's explicit removal request, which supersedes the earlier Retrieve-button decision. The existing drag placement/retrieval tests remain; obsolete button assertions now verify absence and unrelated economy tests use their existing actions directly.

`npx vitest run --project ui`: 33 files, 847 tests pass. `npm run check` and `npm run build` pass. `npm test`: 83 files, 1,674 passed, 2 skipped. `git diff --check` passes. The mechanical design scan reports incumbent layout-transition warnings and typography/radius advisories; no new animation or rounded control is introduced. Physical-device touch checking remains unavailable; this change introduces no new gesture.
