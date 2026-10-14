# Issue #355: idle candidate seams draw only under the singing voice's ask — verification

Implemented on branch `t3code/issue-355-implementation` in this worktree, from the acceptance criteria of #355. The amendment retires ADR-0052 §4's always-on idle marks (ADR-0057 records the decision); the allocation economy, the mark list, and the readout grammar are untouched.

## Automated checks

- `npm run check` (tsc): passed.
- Full suite: 62 files, 1,309 tests passed, 2 skipped (final run after the review fixes; the refactor and the ghost-scope fix are behavior-neutral for these pins).
- New UI suite `src/ui/app.board.test.ts` — `the idle ask (ADR-0057)` (8 tests) — pins:
  - at-rest emptiness: the grid's chord-marks group carries the earning seams alone, no `.chord-idle` marks, active seams and paint order unchanged;
  - the three ask paths — pointer hover, keyboard `focusin`, touch tap (a `pointerType: "touch"` pointerover) — reveal the same candidates, whole, and standing down clears them;
  - reveal scope: C5's ask reveals exactly its two candidates; C4's ask names only its own Octave, never the doubled fifth whose voices C4 is absent from;
  - the conducting spacer's containment ask reveals the idle candidate its wire conducts (the wired Octave's run passes through the spacer's cell) while the doubled fifth — whose work crosses no wire — stays hidden;
  - the reveal is a board-draw question only: the reserved readout keeps its "N idle" count under the same ask, and the Hex detail's chord row keeps its per-instance "· idle" chips with no hover live;
  - one rule in every mode: flow asks like upgrade, and the flow tick's re-render holds the asked reveal;
  - the ask weight is scoped `:not(.ghost-mark)` — the projected-idle promise keeps the base seam width (the #260 register pinned against the regression a shared selector would cause).
- Updated pins: the #258 board pin now lives in the idle-ask suite (at-rest emptiness plus the whole reveal in the chord hues); the `solid chord paths (#333)` idle test asserts the ask-gated draw with the active set un-muted. The `#260` ghost tests pass unchanged — projected-idle ghosts keep their gesture-scoped promise language.

## Browser provenance

Launched this checkout with `npm run dev`; the server picked `http://localhost:5176/` (5173–5175 were in use). `/-/dev/provenance` confirmed worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-edf3173e` (equals `git rev-parse --show-toplevel`), branch `t3code/issue-355-implementation`, commit `d762309` (equals `git rev-parse HEAD`; Vite serves the working tree's uncommitted edits). The provenance check was re-run from inside each capture page before any screenshot.

## Captures

Desktop 1,402 × 877 CSS px and phone 390 × 844 CSS px (headless Chrome against the verified server), seeded through the dev panel's `+synth` grant — the C4 opening module plus G4 and C5, the power-chord region. Every capture was gated by DOM waits asserting the surface's state before the shot.

- [desktop-rest.png](desktop-rest.png): at rest the group carries the earning Fifth's brackets alone — no dotted marks anywhere; the readout sits empty.
- [desktop-ask.png](desktop-ask.png): the C5 voice's ask reveals both candidates whole — the Octave and the doubled fifth, dotted at the ask weight — with the readout reading `+0.1 ν/s · (0/1) · 2 idle`.
- [desktop-focus-ask.png](desktop-focus-ask.png): the same ask by keyboard focus — the C5 cell wears the visible focus outline, the reveal and the count identical to the hover's.
- [phone-rest.png](phone-rest.png): 390 px at rest — the same calm board, no idle marks.
- [phone-ask.png](phone-ask.png): 390 px under the ask — the dotted candidates in both gaps, the count standing.
- [phone-focus-ask.png](phone-focus-ask.png): 390 px, the focus ask — the same reveal with the count.

Live DOM guards recorded at capture time (both viewports): `.chord-idle` count `0` at rest, `2` under the hover ask with the readout exactly `+0.1 ν/s(0/1) 2 idle`, and `2` again under the focus ask with `document.activeElement` on the asked cell.

## Instrument-standards notes

- The board reads calm at rest — the idle whisper is never ambient furniture; it answers precisely when asked (#201's quiet-at-rest rule, now literal).
- The revealed register stays dotted (`1.5 4` dash) and never pulses: the distinction from the solid active seams is a stroke pattern, so it survives greyscale; the ask weight (0.45 opacity, 4 width) is the retired selection lift's idle register, borrowed values, not a resurrected layer.
- No new motion joins the surface: the seam pulse rules are unchanged, idle marks were and remain excluded, and the reveal enters and leaves without animation.

## Unavailable checks

- The collaborative preview tab's snapshot pipeline failed on every attempt (a fresh tab included), so the captures were taken with headless Chrome against the same verified server and provenance-checked in-page; the interactive tab pass is recorded as unavailable.
- Physical touch gesture on a real device: unavailable; the touch path is pinned by the suite's `pointerType: "touch"` ask and the browser's tap-synthesized pointerover is the same delegation.
- Keyboard dismissal capture: the ask follows focus — a null ask is reached by focusing an empty cell or the pointer's leave (suite-pinned via `standDown`); this board's three owned cells all carry modules, so no empty-cell focus capture exists. Recorded unavailable rather than claimed.
- Live `prefers-reduced-motion` media emulation during capture: unavailable; no new animation was added and the idle register never pulses (source-level notes above, not a claimed emulation pass).

## PR #357 review correction

The voice-to-idle-seam transition now clears the ask and removes the idle
marks, rather than keeping a seam standing and naming it in the transient
readout. The board regression suite covers that transition, the subsequent
render, and the unchanged direct ask on an earning seam. The forwarding
`chordChipsForHover` alias was removed; ADR-0057 now matches the issue's
voice-only reveal rule.

Fresh desktop/phone browser captures, physical touch, keyboard dismissal,
and reduced-motion emulation for this correction were unavailable. This
correction changes ask resolution only; the existing dotted styling and
pinned prototype presentation remain unchanged.

Validation after the correction: `npm run check` passed; `npm test` passed
all 62 files, with 1,311 tests passed and 2 skipped.
