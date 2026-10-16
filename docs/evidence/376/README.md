# Evidence: charge-response support across the charge behaviors (#376)

Captured from the verified checkout (`t3code/issue-376-implementation`,
worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-e7b5d9d9`), served
by the worktree's own dev server; provenance confirmed via
`/-/dev/provenance` (worktree matches `git rev-parse --show-toplevel` in
the editing checkout) before the captures. The board was seeded through a
v10 save in the served origin's localStorage: the opening Sine at C4, a
second Sine at G4 (the Fifth's second voice), the Exciter at the shared
seat, and a charged Flywheel beside the G voice — the smallest board that
exercises the design. Captures ran in upgrade mode, where the Exciter
reads its authored share and the Flywheel emits nothing (charge state is
upgrade-frozen), so the condition is stated by the copy, not faked by the
mode.

Capture note: the preview automation's resize path failed session-wide
(every viewport change timed out), so the phone passes below are recorded
as unavailable; the desktop captures rode the standard snapshot path.

## Desktop captures

- **board-desktop.png** — the deployed board. The Exciter reads `+50%`
  with its term named beneath ("charge response") and the two inward
  charge zigzags flanking the Booster's dot; the Fifth's seam runs
  C4–G4 beside it.
- **exciter-detail-desktop.png** — the Hex detail's module face: the
  enlarged Exciter at full engraving, and the level dial's effect line
  reading `+15% charge response` (the ×1.3 rare power's gain over the
  authored 0.5 share, quoted from the pass's own table) — the single
  primary effect named, no grade chips (a booster carries no oscillator
  axes).
- **exciter-charge-breakdown-keyboard-desktop.png** — the same face's
  charge wave, opened by keyboard focus: Incoming charge ⌁0 → **Base
  charge response +50%** → Host power ×1 → Charged empowerment ×1 →
  **Charge response +50%**. The generalized labels name the design's
  authored term; the rows multiply out to the face's readout.
- **forge-tiles-desktop.png** — the draft carrying the design: the
  Exciter (rare plate) with "Neighbors' charge response +50% · charge
  boosts share · needs charged recipients", no grade chips, beside the
  Triangle whose fixed grade signature (`base C · boost B · chord S ·
  charge B`) shows the contrast the booster tiles deliberately lack.
- **forge-term-gloss-keyboard-desktop.png** — the same draft with the
  "charge" term's gloss open from keyboard focus ("Generator output that
  powers other modules"), the focus outline riding the term trigger.

## Phone captures

- **Unavailable.** The preview automation's viewport resize timed out on
  every attempt this session (freeform and preset paths, fresh tab
  included), and the evidence rules forbid claiming a viewport pass that
  cannot run. The phone rendering of the changed surfaces is covered in
  code by the automated UI regressions (`src/ui/app.phone.test.ts`,
  `src/ui/face.test.ts`), which passed; no phone screenshot was captured
  and none is claimed.

## Interaction checks run against the verified server

- **Keyboard disclosure**: the Hex detail's charge breakdown and the
  Forge tile's term gloss both open from keyboard focus alone (real
  focus events, no pointer), and Escape dismisses the gloss without
  closing the draft — the shared instrument layer's existing contract,
  verified live; the open states are the captured PNGs. The
  Escape-suppression semantics are additionally asserted by
  `src/ui/profile.test.ts`.
- **Non-color state**: the Exciter's term is carried by the note word
  ("charge response"), the breakdown's row labels, and the effect line's
  copy — never by hue alone; the face readout keeps the amplitude
  boosters' `+«%»` shape with the term named beneath, exactly the
  Chorus's precedent.
- **Touch disclosure**: **unavailable** — no touch input in the capture
  path (`navigator.maxTouchPoints` is zero); the tap-to-pin path is
  covered by the automated UI regressions, but no physical tap check was
  performed and none is claimed.
- **Reduced motion**: not applicable — the change adds no animation or
  glow; the glyph, readouts, and breakdown rows are static, and the
  existing surfaces' motion behavior is untouched.
- **Allocation/preview agreement**: verified by the engine suite, not a
  screenshot — `src/engine/exciter.test.ts` asserts the certified
  allocation prices the deepened terms and that a moved Exciter's
  previewed drop equals the committed board's read.
