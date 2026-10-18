# Inventory feedback verification — 2026-10-18

The seven decisions and consolidated scope in [the inventory brief](../../inventory-ux-brief.md#inventory-feedback-amendment--2026-10-18) were explicitly confirmed before implementation. Reviewed in Operate mode against [instrument standards](../../instrument-standards.md), their pinned presentation/controls references, and the approved 2026-10-17 and 2026-10-18 amendments.

## Provenance

Launched this checkout with `npm run dev`; `http://localhost:5174/-/dev/provenance` returned worktree `/Users/eggfam/.codex/worktrees/a478/flowsynth` and commit `305e669f6e72b0b5b55fae1bcd4e792596e1a636`. Captures include this checkout's uncommitted implementation. Browser fixtures covered common/uncommon/rare modules, tiers I–III, levels 0–24, matching merge partners, and a non-levelable Spacer. Temporary review copies were removed afterward and the opening Sine returned to its original coordinate.

## Visual evidence

| Capture | Check |
| --- | --- |
| [Desktop browser](desktop-browse.jpg) | Compact open rows, all rarity shapes, Roman tiers, aligned Arabic levels, merge glyph |
| [Collapsed](desktop-collapsed.jpg) | Hypercube and stored count, no text header or extra expand glyph |
| [Inventory inspection](desktop-inspection.jpg) | Centered identity glyph and merge rings; name and numbers once below |
| [Shared Hex detail](desktop-hex-detail.jpg) | Main inventory beside the stack after successful drag placement; no separate Add/Swap tray |
| [Phone browser](phone-browse.jpg) | Same rows at 390 × 844; internal scrolling, no horizontal overflow |
| [Phone inspection](phone-inspection.jpg) | Identity face, intrinsic facts, reachable Place action |
| [Phone placement](phone-placement.jpg) | Place closes only inventory and targets the opened Hex |

Desktop uses 1440 × 960. The in-app browser's ordinary screenshot API cropped the desktop capture to its host panel; full viewport captures use CDP Page.captureScreenshot with the verified viewport rectangle. One initial batched visual inspection and one confirmation pass were performed.

## Interaction and accessibility

- Browser-verified module dragging from the enlarged face into inventory and from inventory onto the enlarged face; the empty destination receives the shared `drop-open` register before release.
- Browser-verified phone inspection → Place → opened-cell swap, preserving Hex detail.
- Browser-verified keyboard Merge label, Escape dismissal, and Enter opening pair review. UI regressions cover first-touch label / second-touch review, unavailable actions, and unique disclosure IDs when column and phone sheet coexist.
- UI regressions cover module and mutator placement/retrieval, matching-module drag review without consumption, direct click swaps without implicit merging, browsing state through detail/return, phone placement, slot affordability, and flow edit locking.
- Computed phone copy targets are 44px high; Merge targets are 44 × 44px. There is no horizontal document overflow.
- Rarity uses distinct shapes as well as color, with rarity words in accessible names. Common/uncommon/rare marks contrast 7.17:1 / 8.09:1 / 7.77:1 against the panel; ink contrasts 14.01:1. Category rails/glyphs retain their own hues.
- Emulated reduced motion reports no animations on inventory rows or Merge controls. This change introduces no animation.

Native touch injection is **unavailable**: the in-app browser does not support Input.dispatchTouchEvent. Touch behavior is covered by pointer-event UI tests; no physical-device touch check is claimed. Browser-level mutator dragging and live flow animation were not exercised; their current UI regression coverage passes.

Raw browser check summary: [browser-checks.json](browser-checks.json).

## Checks

- `npm install` completed before checks.
- `npm run check` passed.
- `npm test` passed: **83 files, 1,674 tests passed, 2 skipped**. The dev-server provenance tests require local socket access and ran with that permission.
- `npx vitest run --project ui` passed during implementation; the final full suite reruns all current UI suites, including the added touch and detail regressions. Targeted final detail/inventory checks also passed.
- `npm run build` passed.
- `git diff --check` passed.
- Impeccable detector ran once across the changed UI targets: four warnings concern pre-existing layout transitions; typography/radius advisories include established compact numeric sizes and unrelated incumbent styles. No new layout animation or rounded control was introduced. The known stale design sidecar was not regenerated as part of this work.
