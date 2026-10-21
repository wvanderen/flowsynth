# Habit goal and color editor evidence · issue #445

Served by `npm run dev` at `http://localhost:5173/`. Before capture, `/-/dev/provenance` confirmed worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3-d7ce1cee`, branch `t3/issue-445-implementation`, commit `f0eec048bacbb01c837f9951237ecf6686910a03` — the same commit `git rev-parse HEAD` reports in the edited checkout. Captures drive the production App through its real UI (a fresh save per pass: the seeded state is a Piano habit with a 30-minute daily goal, 12 logged minutes, and the cyan pick).

## Visual review

Desktop captures use a verified 1280 × 800 viewport; phone captures use 390 × 844 with touch emulation. Judged against the instrument standards and the controls sheet's pin: square-cut swatches and controls, open ruled rows (no nested cards), the firm inset marker for the standing color, and no explanatory prose.

- [Desktop habit editor](desktop-habit-editor.png): the drilled habit detail — the COLOR row's six swatches with cyan under the inset marker, the GOAL section's row (inherited cyan track at 40%, `12 min / 30 min`, edit and remove controls), the sheet head reading three faces (PLAN / HABIT / HISTORY — the GOALS face gone), and the display well's meter wearing the habit's cyan.
- [Desktop goal edit](desktop-goal-edit.png): the goal form standing in the habit editor — minutes prefilled from the goal, the cadence select, Apply; Escape puts it away (exercised by the capture pass).
- [Desktop plan meter](desktop-plan-meter.png): the PLAN face's ready read with the display well's cyan goal meter at the clock's side.
- [Desktop swatch focus](desktop-swatch-focus.png): keyboard Tab onto a swatch — `:focus-visible` confirmed on the focused control (`aria-label: indigo`, `focusVisible: true`) beside the selected cyan, so selection and focus read without color.
- [Desktop reduced motion](desktop-reduced-motion.png): captured under `prefers-reduced-motion: reduce` emulation. The changed surfaces carry no animation of their own (static swatch row, LED column, progress bar); nothing moved between the normal and reduced captures.
- [Phone habit editor](phone-habit-editor.png): the same editor at 390px — swatches wrap to two rows, the goal row keeps its figures and controls, touch-sized targets throughout.
- [Phone goal edit](phone-goal-edit.png): the goal form at phone width.
- [Phone plan meter](phone-plan-meter.png): the session group carries the habit name and the meter rides the display well at phone width (ADR-0050 amended, #331).

## Unavailable checks

- **Physical touch**: captures ran through Playwright with touch emulation (`isMobile`, `hasTouch`), not real hardware. Pointer-sized targets were verified by geometry (the controls sheet's 44px squares) and the interaction suite; a physical touch pass was not performed.
- **Grayscale simulation**: non-color state distinctions (inset marker, focus ring, engraved completion) were verified individually, but no full-browser grayscale pass was run.
- **Long-name and multi-habit compositions**: the suite covers long habit names and archived habits in tests; these captures show one habit. The migration-choice row set is exercised by `focus.test.ts`'s pending-choice tests rather than a capture here.
