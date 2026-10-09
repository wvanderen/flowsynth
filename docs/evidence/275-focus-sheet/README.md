# #275 — The Focus control sheet with the flow-mode rule

Implemented and captured at this worktree's dev server (`npm run dev`, port 5178). Provenance verified via `/-/dev/provenance` before staging: worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-69cb69d0`, branch `t3code/69cb69d0`. Desktop captures: 1280 × 800 CSS px; phone captures: a true 390 × 844 viewport. (The collaborative preview tool's snapshot/resize calls timed out in this environment — recorded unavailable; captures came from a scripted headless Chromium pointed at the verified server instead.)

## What the captures show

- **plan-desktop.png** — the sheet's PLAN face in the ruled folio: the clipped plate (`inst-panel`) under the clock's disclosure, the FOCUS head with the face's state word and ✕, the PLAN/HABIT/GOALS/HISTORY facetabs (standing face wearing the firm inset marker), the ready row (`READY · PIANO`, `20:00 planned · 2 goals tracked`, the vermillion Enter flow), the session habit ⓘ row, the preset chips, the custom entry beside Open-ended, and the planned-practice read (figure only — the sub names the mode solely when none is set).
- **plan-flow-desktop.png** — the flow-mode rule on the PLAN face: the running read (`PIANO`, `session 1`, live `12:34 of 20:00`), End flow mirroring the main switch, and the targets visibly disabled (chips, custom entry, Open-ended all muted, non-interactive).
- **habit-desktop.png** — the head word reading the selected practice (`PIANO`), the figure-led list (`13 h 0 min · 0× · Piano`, active dot, drill arrow) with add and log as on-demand action buttons; no inline inputs at rest.
- **habit-log-tooltip-focus.png** — the log form revealed by its action button; the manual-log boundary (`Credits practice without a session. Manual logs never produce nous or charge.`) reachable only through the ⓘ body, opened here by keyboard focus — no visible prose carries it.
- **goals-desktop.png** — the GOALS face: the head word wearing the tracker's rolled-up state (`IN PROGRESS` — the one Goals-state read, desktop-only per ADR-0033 amended; the phone nav's entries carry no state words), the slots ⓘ read (`2/2 slots`), ruled goal rows (name leads, status right, track bar, mono figures, delete at the row's end), the capacity purchase trailing with its price and practice-minute countdown.
- **history-desktop.png** — the HISTORY face's list (empty state factual: `No sessions yet.`); rows and the drill ride the same folio.
- **plan-phone.png / habit-phone.png / goals-phone.png** — the same frame at 390px: the sheet pinned to the container's own margins (fixed under the 56px console), faces intact, rows readable, the full tracker hiding the create action.

## Staging disclosure

The captures seed a habit, a plan, and two goals (one complete) through the dev handle and the app's own save, then open faces through the production `showFocusFace` path. The flow capture ran a real `beginFlow` + dev-clock advance.

## Automated checks

- `npm run check`: passed.
- `npm test`: 59 files, 1,203+ tests passed, including the new `src/ui/focus.test.ts` block (24 tests: face rendering, the flow lock riding the engine's gates, the open-ended fallback, zero-habits entry, the +N overflow derivation, and the no-new-persistence assertions).

## Disclosure and accessibility

- **Keyboard disclosure**: verified live — focusing the log tooltip's ⓘ opens the portaled body (`habit-log-tooltip-focus.png`); Escape and tap-away dismiss ride the shared `wireTooltips` wiring covered by `instrument.test.ts`.
- **Non-color state**: the standing face wears the inset marker; the active habit wears the dot; disabled flow targets read muted with `disabled` semantics — all static, so reduced motion takes nothing (the sheet carries no animation of its own; the popover's entrance is disabled for the plate).
- **Touch targets**: facetabs 38px+, action rows and inputs 40px+; the sheet's controls are native buttons and inputs.
- **Unavailable**: a true touch-device pass (pointer-level taps only, in a desktop browser); the touch pin's behavior is covered by the automated tooltip tests rather than claimed as a touch pass.
