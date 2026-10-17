# Inventory UX verification — 2026-10-17

Implements the confirmed [brief](../../inventory-ux-brief.md), [ADR-0027 amendment](../../adr/0027-dock-the-tray-beside-the-action-row.md), and [ADR-0071](../../adr/0071-inventory-row-merges-preserve-the-chosen-copy.md).

## Checkout and captures

Launched with `npm run dev` from `/Users/eggfam/.codex/worktrees/3aab/flowsynth`, served at `http://localhost:5173/`. Browser fetch of `/-/dev/provenance` confirmed that worktree and commit `5b55bba1a2f0bba1c1df08aec6c6281ed6290be8` (the edited working tree on that base). [Recorded checks](checks.json) include provenance, scrolling geometry, disclosure results, and the empty browser-error list. The launcher log is `.dev/server.log` (development-only, not committed).

Chromium captures use a deterministic development fixture: multiple categories, differing purchased levels, three merge partners, generator reserve, and a populated mutator inventory. The browser's development app instance is seeded in memory; no player save is imported. Desktop is 1440×960; phone is a real 390×844 mobile/touch browser context. Both use reduced-motion preference.

| Surface | Desktop | Phone |
| --- | --- | --- |
| Browsing | [Rows, filters, sorting](desktop-browse.png) | [Sheet](phone-browse.png) |
| Copy inspection | [Full face and profile](desktop-detail.png) | [Full face and profile](phone-detail.png) |
| Merge review | [Partner, result, refund](desktop-merge-review.png) | Not separately captured |
| Scrap selection | [Selected count and payout](desktop-scrap-selection.png) | Exercised before review |
| Scrap review | [Whole selection and losses](desktop-scrap-review.png) | [Single selection and losses](phone-scrap-review.png) |
| Collapsed inventory | [Handle and count](desktop-collapsed.png) | Uses the existing Inventory entry and dismissible sheet |

One batched inspection and one confirmation pass were used. The first pass found the column overlapping the zoom lane; the confirmation captures show the corrected bounds. The initial phone access attempt performed only the existing dock's first, inspecting tap; the second tap opened the sheet for the confirmation pass. No phone viewport check is inferred from a desktop resize.

The captures precede the final reuse of the shared `hex-stack-face` class for correct SVG nameplate color and the singular “module” wording in one-copy scrap review. Those small corrections are covered by typecheck and the final UI suite, but a post-correction screenshot is unavailable within the two-pass visual budget.

## Instrument standards review

Compared with the pinned presentation prototype at `eb232c4`, controls guidance in the [standards](../../instrument-standards.md), and ADR-0070's graphite amendment: rows are open and hairline-separated; controls stay square and at least 44px tall; only the outer panel clips; hex glyphs and category colors remain the inventory mark. The column clears the zoom lane. Scroll geometry confirms a 509px list viewport over 1152px of rows, within the panel bounds. The phone sheet remains scrimless.

- **Disclosure:** keyboard focus opens a profile coefficient tooltip; Escape dismisses it. Touch opens it and tap-away dismisses it. Recorded booleans are true in `checks.json`.
- **Non-color state:** scrap selection has explicit check marks and an inset marker; unavailable Merge actions are disabled with muted outlines; counts and payout use text. Mutator/module switching retains its existing inset marker and order. Grayscale capture is unavailable; these persistent shapes and labels were inspected in the captures.
- **Reduced motion:** both captured contexts request reduced motion. The new inventory controls introduce no animation or charge glow. Existing board reduced-motion behavior remains covered by its tests.
- **Critical information:** identity, rarity, module tier/level, merge result/refund, scrap payout and irreversible losses remain visible. Inventory inspection supplies no invented board pitch, chord, host, or incoming charge.
- **Prototype limitation:** live step-through of the historical pins was not run; the pinned source and documented controls/presentation contract were used. The committed older tray screenshot was inspected as historical evidence, with its retired indigo/rounded presentation judged against the current amendment rather than copied.

## Automated checks

- `npm install` completed before checks.
- `npm run check` passed.
- `npx vitest run --project ui` passed: **33 files, 849 tests**. Covers inspect/Place, retained filter and scroll, sorting, inventory-only pair review, stale partner refusal, mutator inspection/merge, batch selection across filters, cancel, locks, payout, and temporary drag opening/restored collapse. Existing board, phone, capacity, and detail tests use the new explicit Place step.
- `npm test` exercised all projects: **1,673 passed, 2 skipped**, with two provenance tests blocked by sandbox localhost socket permission. A rerun with socket access passed all three provenance tests and the three new inventory engine tests (**6 passed**). UI checks were then rerun after the final UI changes as recorded above.
- Engine regression tests verify selected-copy secondary-effect retention, inheritance of the higher level/investment, lower-level refund, inventory-only scope, atomic stale-batch refusal, duplicate-id deduplication, replay refusal, and flow locks.
- `npm run build` passed.
- `git diff --check` passed.
- The Impeccable detector ran once over the changed UI targets. It reported 89 findings across the scanned files: 83 font-ramp warnings, four existing layout transitions, and two existing radius warnings. Three font-ramp warnings fall in the new inventory CSS (12px compact payout/loss/review text, matching the existing instrument support-copy scale); the rest concern existing code outside the changed surface. Detector findings are retained as review input, not treated as visual approval.

“Newest” uses durable collection insertion order; no acquisition timestamps or save migration were added. Filters, sorting, scroll, and collapse are visit-local UI preferences.

## Follow-up — outlined clipped corners

The user identified the missing diagonal outlines. The inventory column and its mutator face now use the shared `inst-panel` / `inst-panel-face` rim-and-face construction instead of clipping a rectangular CSS border. The phone inventory modal uses the same two-layer construction. Drag-over highlights color the rim without filling the interior with the rim color.

A fresh bounded browser pass verified the same checkout/provenance at 1440×960 and 390×844 with reduced motion: [expanded inventory](desktop-outlined-corners.png), [collapsed handle](desktop-outlined-collapsed.png), [mutator inventory](desktop-outlined-mutators.png), and [phone inventory sheet](phone-outlined-corners.png). All show a continuous hairline around both diagonal cuts. These supplement the earlier functional/disclosure captures, which retain their historical pre-outline appearance. Typecheck and 125 focused inventory/phone/mutator/theme tests passed; the full UI rerun passed all 849 tests across 33 files. The detector reported the same existing findings described above, with no added corner-frame findings.

## PR preparation verification

On branch `codex/inventory-ux`, after the outlined-corner fix, `npm run build` and a complete `npm test` run with localhost socket access passed: **83 files, 1,676 tests passed, 2 skipped**. The skipped tests are the suite's existing capacity-calibration skips. This supersedes the earlier sandbox-limited full-run result; the final UI subset remains **849 passed**.

## PR #409 review corrections

Inventory inspection now uses the shared glossary term renderer for Harmonic capacity. Generator earning coefficients and base delivery strength, and booster effect magnitudes, read the authoritative engine values with the owned copy's level and merge tier; neighbor, mutator, and habit effects are excluded. Module hex marks reserve touch gestures for placement, while row text remains available for native list scrolling. Mouse dragging remains available across the row.

Typecheck and production build passed. Regression checks cover scaled generator and booster values, capacity disclosure opening on focus and dismissal with Escape, and existing board/inventory drag interactions. The complete suite passed except the two sandbox-blocked provenance socket tests; those passed separately with socket access. The existing two capacity-calibration skips remain.

Browser verification was attempted from this checkout on port 5174, but the browser call stalled and the fixture failed to initialize. Fresh desktop/phone screenshots, native touch drag/scroll, touch disclosure, grayscale, and reduced-motion checks are unavailable for these corrections. Presentation was assessed in source against the pinned instrument contract: existing open rows, square controls, and clipped panel frame are retained; intrinsic values use compact readouts.
