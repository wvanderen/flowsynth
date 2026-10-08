# #279 — Session summary and honesty report as ruled folios

Implemented and captured at this worktree's dev server (`npm run dev`, port 5176). Provenance verified from the capture tab via `/-/dev/provenance` before staging:

- Worktree: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-5c91918e` (= `git rev-parse --show-toplevel`)
- Branch: `t3code/5c91918e`, commit `dd351b58` plus this ticket's working tree (the server serves it)
- Desktop captures: 1,402 × 877 CSS px window (screenshot pipeline crops at 1,280px); phone captures: the app composed in a true 390 × 844 viewport

## What the captures show

- **summary-desktop.png** — the summary folio: the `63.04 ν` headline figure (the readout is the identity, `BANKED · SESSION 1` beside it) over hairline-ruled rows — `PRACTICE 10 min`, `RATE ⓘ 6.06 ν/min`, `ROLLS 1 roll · 1 from practice`, `UNLOCKED First light NEW` (the engraved NEW mark in the charge hue) — then the REFLECT slot above Continue.
- **summary-rate-tooltip-desktop.png** — the RATE row's tooltip open (keyboard focus pins it): the breakdown (`the synth terms alone — 0.1 ν/s is the whole formula`) lives in the tooltip layer; the `6.06 ν/min` figure stays visible in the row without it.
- **honesty-desktop.png** — the report's readout leads (`22 min away · past your plan` with `150 ν held` engraved at the row's end), "Nothing already banked is taken back." stays visible, and the three choices are full-width rule-line rows with mono consequence lines. No tooltip layer exists on the surface.
- **summary-honesty-line-desktop.png** — after settling the report as a miss and exiting: the summary's `HONESTY 22 min away · didn't practice` neutral factual line, per the one-voice rule shared with the report.
- **summary-phone.png / honesty-phone.png** — the same surfaces at the 390px viewport: the summary as a bottom-sheet folio (narrowed key column, rows intact), the report's readout row wrapping with the held figure held at the row's end.

## Staging disclosure

The honesty report requires away time past a plan. It was staged by writing a session with `poolSeconds: 1320 / bucketNous: 150` into the save slot between the app's own saves (the write guard holds the slot for the capture window), then reloading — the production boot path that re-presents the report. The summary captures came from real sessions run against the dev clock.

## Automated checks

- `npm run check`: passed.
- `npm test`: 57 files, 1,132 tests passed — including the new `the ruled folio surfaces (#279)` block (headline over ruled rows, breakdown in the RATE tooltip, NEW marks, the report's leading readout, mono consequence rows, no-tooltip honesty) and the updated reflection/rolls assertions.

## Disclosure and accessibility

- **Keyboard disclosure**: verified live — focusing the RATE trigger opens the portaled body; Escape dismisses it and the summary stays. Tap-away and the touch pin ride the shared `wireTooltips` wiring covered by `instrument.test.ts`.
- **No-color state**: the NEW mark is the engraved underline mark (charge hue as reinforcement); the report's choices carry no color-only state; both surfaces are static — reduced motion takes nothing (source-verified; no animation on either surface).
- **Unavailable**: a true touch-device pass (pointer-level taps only, in a desktop browser); the touch pin's behavior is covered by the automated tooltip tests rather than claimed as a touch pass.
- **Viewport control**: the preview tool's viewport resize was unavailable (timed out); phone compositions were captured from the app inside a same-origin 390 × 844 iframe — a real viewport for the phone media queries — instead of a resized window.
