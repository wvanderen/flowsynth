# Term hairlines hug their words — review evidence

Review-fix pass: the hoverable term triggers (`.term-trigger`) drew
their engraved hairline with `box-shadow: inset 0 -1px` — which lands on
the padding box's bottom edge. The approved touch-target padding
(`12px 8px`, the controls-sheet correction) pushed that edge twelve
pixels below the words, so every catalog term wore a floating underline
that collided with the figures row beneath. The hairline is the term's
own decoration now (`text-decoration: underline`, 1px, offset 3px,
skip-ink off) — it hugs the text; the touch padding is untouched. The
trigger drops the shared trigger's `inline-flex` (which blocks
text-decoration); it blockifies inside its wrapper exactly as before.

Source: user review against `edb70e2`. Captures from the repo-cached
Playwright Chromium (headless shell) against this checkout's dev server;
the provenance endpoint (`/-/dev/provenance`) returned this worktree and
commit before every capture. The T3 preview panel's resize could not run
this pass — recorded unavailable. Dev fixtures staged an Arete Catalog
with the Upgrades section standing (entry owned, roll pool joined).

- [Desktop Arete](desktop-arete-hairline.png): every term — Expansion
  Bays, Harmonic capacity, memorized, Chord Catalysts, Poly Expander,
  Headroom, nous, Arete claim — wears its hairline tight under the
  words; nothing floats into the `ceiling 3 → 4` / `prices −0%` figure
  rows. The hovered `memorized` shows the hover half: the hairline and
  term take the nous hue and the plain gloss body opens ("Persists
  through arete reset").
- [Phone Arete](phone-arete-hairline.png): the same read at 390px —
  hairlines hug the terms across wrapped lines; no collision with the
  prices.
- [Keyboard focus](desktop-arete-term-focus.png): a focused term opens
  its gloss ("Ceiling purchases persist through arete reset") — the
  disclosure access states ride the same trigger as before; only the
  hairline's drawing moved.
- Reduced motion: the hairline adds no animation — the term's color
  transition sits under the global reduced-motion kill, and the open
  gloss is static. Recorded from the mechanism; no dedicated capture.
- State without color: the hairline is a positional affordance (present
  under every term at rest), never a hue-only signal; hover/focus still
  distinguish by opening the gloss, not by color alone.
