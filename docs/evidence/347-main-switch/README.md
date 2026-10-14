# #347 — Main switch: AA contrast in every state, state-tracking accessible name

Implemented and captured at this worktree's dev server (`npm run dev`, port 5174). Provenance verified via `/-/dev/provenance` before staging: worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-978113d3`, branch `t3code/issue-347`, commit `635d655` + this diff. Desktop captures: 1280 × 998 CSS px. **The phone viewport pass through the preview tool's resize timed out (three attempts, per the resize-flakiness budget) — recorded unavailable.** The phone captures below come from the same verified tab with the `#app` container itself constrained to 390px (`container: app / inline-size` drives the real phone composition), so every container query, hide, and re-dock is the production CSS; the method squeezes the app rather than the window, so anything anchored outside the container is out of frame.

## What the captures show

- **idle-desktop.png** — upgrade mode: the switch's idle state with the brightened vermillion text (`--switch-bright #dd6f49`, 5.18:1 on its faint wash over the console's panel-soft; was 4.27:1), dim-state border and hollow state dot unchanged.
- **live-desktop.png** — flow live: the deep vermillion fill (`--switch-deep #a94c2b`) under the cream ink (`--switch-ink`, 5.13:1; was 3.63:1), label reading **End flow** (was Exit flow — the Focus sheet's running-read vocabulary), bright session-vermillion border, breathing glow, lit state dot, and the session strip riding the console's bottom edge.
- **held-desktop.png** — paused: the fill holds bright but still, **Resume** on the sibling pause control, **End flow** unchanged, caption `paused`.
- **idle-phone.png / live-phone.png / held-phone.png** — the 390px composition: the visible span is `display: none`, and the switch's accessible name in the accessibility tree tracks state — **Enter flow** (idle) / **End flow** (live) / **End flow** (held), with **Pause**/**Resume** on the icon-only sibling — never the hover title. The name arrives via `aria-label`, present at every width.

## Automated checks

- `npm run check`: passed.
- `npm test`: 63 files, 1,338 tests passed, including the new `theme.test.ts` AA block (token-level WCAG contrast for idle, hover, live/held text ≥ 4.5:1 and the unchanged border/dot grammar ≥ 3:1, plus the stylesheet wiring) and the `app.test.ts` name-tracking block (state-tracking `aria-label`, name ≠ title, name = visible label's words).

## Contrast math (the token pairing)

WCAG luminance over the real backdrops — the idle wash is `color-mix(in srgb, var(--switch) 7%, transparent)` over the console's `--panel-soft`, hover 14%:

| pair | was | now |
| --- | --- | --- |
| idle text on 7% wash | 4.27:1 | **5.18:1** (`switch-bright`) |
| idle text on 14% hover wash | — | **4.80:1** |
| live/held ink on fill | 3.63:1 | **5.13:1** (`switch` fill → `switch-deep`) |
| `--switch` border on panel-soft (non-text) | 4.54:1 | unchanged |
| dim-state border (non-text, unchanged per non-goals) | 3.14:1 | unchanged |
| state dot ink on fill (non-text) | 3.63:1 | **5.13:1** |

## Disclosure and accessibility

- **Keyboard**: the switch is a native button; `app.modal-focus.test.ts`'s focus contracts untouched. No new disclosure in this change.
- **Non-color state**: the state dot, the fill depth, and the strip carry the mode without color-alone reliance; all static or token-driven, so the change adds no motion.
- **Reduced motion**: covered by the existing global reduce rule (`style.css`, `@media (prefers-reduced-motion: reduce) { * { animation: none !important; … } }`) — the breathing glow and strip pulse drop, the state grammar (fill, dot, strip presence) survives. A live `prefers-reduced-motion` emulation pass could not run in this environment's preview tooling — recorded unavailable; the rule is static CSS covered by the suite's stylesheet contract tests.
- **Unavailable**: a true 390px device-viewport pass (see the capture-method note above) and a screen-reader pass; the accessible-name behavior is asserted directly in `app.test.ts` (aria-label per state, never the title).

## Interpretation note (the "Pause" name)

The issue's name list — "Enter flow / Pause / End flow" — maps to the switch's own words **Enter flow** and **End flow** (the live click has always ended the session; naming the switch "Pause" would announce the opposite of its effect), with **Pause**/**Resume** carried by the dedicated pause control beside it, whose state-tracking names already exist and are unchanged. Every name in the list is now announced truthfully somewhere on the row in every state.
