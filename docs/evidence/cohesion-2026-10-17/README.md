# Cohesion refinement evidence · 2026-10-17

Served by `npm run dev` at `http://localhost:5173/`. Before capture, `/-/dev/provenance` confirmed worktree `/Users/eggfam/.codex/worktrees/75bb/flowsynth` and base commit `0398039cd5b8a33f61be45aff46c21c579946365`; the reviewed changes were uncommitted on that base. Every instrument capture uses `/workbench.html?preview=…`, which mounts the production App, skeleton, CSS, theme, and engine against an isolated memory save.

## Visual review

Desktop screenshots use a verified 1124 × 900 viewport; phone screenshots use 390 × 844. Compared against the instrument standards and their historical pinned references, with ADR-0070's approved palette, geometry, and motion amendments taking precedence. Main layout and existing choices remain; floating panels clip top-right/bottom-left, docked readouts meet square rails, and Focus/Catalog share open tabs with inset selection.

- [Desktop live flow](desktop-flow.jpg): graphite substrate, quiet grouped utility rails, semantic category/resource color, populated board.
- [Desktop Catalog](desktop-catalog.jpg) and [Focus](desktop-focus.jpg): floating panel silhouette and shared tabs.
- [Phone Catalog](phone-catalog.jpg) and [Focus](phone-focus.jpg): same clipped pair at 390px. Focus document width and scroll width both measured 390px; no horizontal page overflow.
- [Components](components.jpg): current production tokens/classes, non-color state marks, floating panel, disclosure, shared module-face renderer. Specimen charge lighting is explicitly illustrative; full instrument previews use real engine charge.
- [Phone keyboard disclosure](phone-disclosure-keyboard.jpg): Tab/Shift+Tab opens the Harmonic capacity term, `aria-expanded=true`; Escape dismisses it with `aria-expanded=false` while focus remains on its trigger.
- [Phone reduced-motion flow](phone-flow-reduced-motion.jpg): actual `prefers-reduced-motion: reduce` browser emulation, not the workbench's static override. Computed charge-lead animation was `none`, with its directional arrow marker retained; glow animation was `none` with steady opacity `0.18`. After clearing emulation, normal charge glow reported `charge-breathe` at 6s and leads `charge-flow` at 5s, opacity 0.45. Browser preference/viewport overrides were restored afterward.

Disabled outlines, selected inset marks, acquired engraving, and directional arrowheads are visually distinct independently of hue in the specimens. Full browser grayscale simulation was not performed. Touch disclosure is **unavailable**: the in-app browser rejects CDP `Input.dispatchTouchEvent`; a mouse click was not substituted as evidence of touch. Existing interaction tests cover shared disclosure behavior but do not replace a physical touch pass. No screenshot establishes long-duration peripheral comfort; that remains player judgment.

## Automated checks

- `npm run check`: passed.
- `npm test`: 1,669 passed, two skipped, two failed solely because the sandbox denied localhost binding in `tools/dev-provenance.test.ts`.
- `npx vitest run tools/dev-provenance.test.ts` with localhost permission: all three tests passed. All 82 test files therefore passed across the full run and the targeted environment-corrected rerun (1,671 passing tests, two skipped).
- `npm run build`: passed; production build-purity test also passed. The development workbench is not a production build entry.
- New workbench tests verify that interactive sessions, forced saves, storage events, and unload cannot read/adopt/overwrite the player's save, and that live/paused fixtures use production charge rendering.

No UI redesign was performed after this bounded review. The confirmation pass corrected specimen labeling and a workbench static-preview off-view glow override, then refreshed final desktop/component captures. The preview is left running for review; the workbench tab is retained as the deliverable.
