# PR #286 review fixes: verification

Code reviewed and exercised at `182149c1ab6c6926cf93ca0386c56e6e2b007e97`.

## Automated checks

- `npm run check`: passed.
- `npm test`: 47 files, 1,018 tests passed, including the full `src/ui/app.test.ts` suite and the restored ordinary-economy horizon/prestige assertion.
- Regressions cover ordinary versus development actions, ticks, summaries, readouts, save/reload without a persisted development switch, wall-clock-independent allocation, resonance in achievement progress/action/tick detection, and uncertified UI disclosure.

## Browser provenance and desktop evidence

Launched this checkout with `npm run dev`. The final preview was `http://localhost:5175/?dev=1`; the browser fetched `/-/dev/provenance` and confirmed:

- Worktree: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-2cb88be0`.
- Branch: `fix/pr-286-review`.
- Commit: `182149c1ab6c6926cf93ca0386c56e6e2b007e97`.
- Reported browser viewport: 1,402 × 877 CSS px.

An ephemeral fixture used 24 oscillators in a connected chromatic formation (columns −5 through 6, rows 0 and 1). The real live development solve reported `certified: false`; the module readout and rate sheet named “Allocation uncertified.” Maximum production remains unproven on these boards; they remain development-only.

- [Keyboard disclosure](uncertified-keyboard.png): after focusing the browser, Tab/Shift+Tab opened the warning's tooltip with visible focus. Its deeper explanation sits in the tooltip layer.
- [Dismissed disclosure](uncertified-dismissed.png): Escape hid the explanation while the rate sheet stayed open. A pointer click also pinned the explanation and reported `aria-expanded="true"`.
- [Pinned prototype](pinned-prototype.png): rendered the exact `src/ui/instrument-standards.prototype.html` from `eb232c498a54fd7defd23be1a82720c1fb229cf4`, opening its catalog. Compared open rule-separated rows, condensed names, mono figures, and tooltip disclosure. The warning adds one purposeful state row, no nested card or explanatory paragraph in the default surface. Its explicit words and dashed readout treatment preserve the distinction without relying on color.

The earlier localhost:5174 preview cached stale assets after its server disappeared; its captures are excluded. A new server port loaded the current assets and provided the evidence above. The fixture was restored after capture.

## Unavailable checks

- Requested desktop resizing to 1,440 × 900 and an iPhone 12 Pro portrait preset both timed out after 10 seconds. The existing desktop viewport was exercised; phone composition remains unavailable.
- True touch disclosure: unavailable; pointer click is not claimed as a touch pass.
- Greyscale and reduced-motion browser emulation: unavailable. The new warning has explicit text and no animation; this source-level check is not a claimed emulation pass.
