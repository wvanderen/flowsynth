# Evidence: broad and player-targeted amplitude boosters (#374)

Captured from the verified checkout at commit `13d1195`
(`t3code/issue-374-implementation`), served by the worktree's own dev
server; provenance confirmed via `/-/dev/provenance` (worktree and commit
match `git rev-parse` in the editing checkout) before every capture. The
board was seeded through the dev surface (`?dev`) with the state the
ticket's surfaces need: one Spotlight deployed beside two oscillators.

## Desktop captures

- **spotlight-inactive-desktop.png** — the Hex detail on a fresh,
  unselected Spotlight: the face reads the state in words ("—", "inactive
  · pick a recipient"), and the rail's Recipient group carries the same
  verdict above the recovery chips (one per adjacent oscillator, named by
  note). Nothing auto-selected; no output-ranked guess.
- **spotlight-picked-desktop.png** — after picking C4: the face reads its
  live grant (+50%), the active chip carries `aria-pressed="true"`, the
  verdict is gone, and the toast names the landing. The uplift multiplies
  out in the wave breakdown (below).
- **spotlight-invalid-desktop.png** — the recipient moved out of range:
  the pick is remembered, the booster reads inactive on its own surfaces
  ("inactive · recipient not adjacent" on face and picker), and the
  remaining adjacent candidate (C5) stands as the one-click recovery.
  No silent retarget: the second oscillator earns nothing.
- **spotlight-breakdown-keyboard-desktop.png** — the charge wave's
  breakdown opened by keyboard focus (not hover): Base uplift +50% ×
  Host power × Charged empowerment → Booster uplift +50%, multiplying
  out to the face's figure. Escape dismissed it (verified; the capture
  holds the open state).
- **forge-tiles-desktop.png** — the Forge draft carrying the two new
  commons: the Field's doubled-chevron glyph with "Every adjacent
  oscillator +30% · charge boosts uplift", the Spotlight's beam glyph
  with "One recipient +50% · charge boosts uplift" — the
  coverage-versus-strength pair as the draft presents it.
- **board-spotlight-desktop.png** — the deployed Spotlight's board face:
  the beam identity mark and the live +50% readout.

## Interaction checks run against the verified server

- **Keyboard disclosure**: focusing the charge-wave trigger opens the
  breakdown; Escape dismisses it while the detail stands.
- **Keyboard activation**: the recipient chips are focusable buttons;
  focusing a chip and activating it (the click path) landed the pick in
  the engine and re-rendered the group with the chip pressed.
- **Non-color state**: the inactive Spotlight reads as words (the
  verdict line, the "—" readout) and `aria-pressed` on chips — the state
  survives greyscale; no figure is quoted where nothing receives it.
- **Allocation agreement**: the picker's re-pick re-solved the certified
  allocation immediately (engine-verified in `src/engine/boosters.test.ts`;
  the face figure followed the new pick in the browser without a reload).

## Unavailable checks

- **Phone (~390 px) captures**: the preview resize failed three times
  (the documented retry budget), so no phone viewport pass was captured.
  The phone sheet behavior of the detail (the same cross-section re-docked,
  picker included) is covered by the automated UI regressions
  (`src/ui/hexdetail.test.ts`), but the visual phone evidence is
  **unavailable** for this change — not claimed as verified.
- **Reduced motion**: not applicable — the change adds no animation or
  glow. The verdict and chips are static; the existing surfaces' motion
  behavior is untouched.
