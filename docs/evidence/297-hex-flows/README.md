# The Hex detail's wave connections — review evidence

Source: issue #297 (this branch's working tree on top of commit
`cc05df21b9f0283a0dfcf55a2347d416eea0ce42` — the captures include the
uncommitted connection work). Launched this checkout with `npm run dev`;
the provenance endpoint's `worktree` and `commit` matched
`git rev-parse` in this checkout before every capture. States were staged
through the app's own save (a developed save exported from the dev tab and
reloaded in the ordinary tab, so the captures run the production
allocation gate); the dev tab's scenario panel was hidden for its two
captures only.

## Desktop (1402×877 viewport, screenshot pipeline crops to 1280)

- [Active connections](desktop-flows-active.png): the cross-section with
  all three relationships live — the Power mutator's solid arete wave
  bridging the faces and pointing at the module layer, incoming charge's
  solid green zigzag entering the module face's left vertex, the Octave's
  solid wave in the chord's own hue entering the right vertex. The faces
  keep their compact engraving (level, nameplate, ν/s with its unit,
  pitch); the waves carry no figures. The action rail (dial, upgrade
  cost and benefit) stays fully visible beside the stack.
- [Keyboard disclosure](desktop-breakdown-focus.png): keyboard focus on
  the charge wave opens the full breakdown — "Incoming charge ⌁1.2 ·
  Charged empowerment ×1.55 · Final output +0.36 ν/s" in ruled rows, the
  result stated once, the figures matching the live pass (verified in the
  capture session and pinned in hexflows.test.ts: the body's ⌁ and ×
  figures equal the snapshot's `chargeStrength` and `chargedFactor`).
  Escape dismissed it while the detail stayed open, a tap pinned it, and
  a tap elsewhere dismissed it — all three verified live.
- [Inert relationships](desktop-flows-inert.png): the quiet states — a
  resonance mutator over a chordless host, an uncharged receiver, a voice
  singing no chord. All three waves draw dashed and dimmed; the mutator
  face itself wears the engine's own "inert · no chord" verdict, and the
  chord wave draws in the muted wire hue — no specific chord implied.
  The solid/dashed distinction reads without color.
- [Read-only in flow](desktop-flow-readonly.png): the same composition in
  a live session — `FLOW LIVE · READ-ONLY`, no rail, no orbit controls,
  the three waves solid with the pulse path riding them (motion), the
  Octave chip in the chord row matching the chord wave's disclosure.

## Phone (390px via the #295 fallback)

The preview window's resize times out in this environment (recorded by
the #295 evidence too); `#app` was constrained to 390px so the app's own
container query re-docks the anatomy. The same gated composition drives
what a 390px device renders.

- [Detail as sheet](phone-flows-sheet.png): the bottom sheet keeps the
  fixed stack — the wave row between the faces, the side waves pulled in
  by the phone rule, everything inside the sheet's width with no
  horizontal scroll (the left wave's edge measured at x=43 of 390).
- [Touch disclosure](phone-breakdown-tap.png): a tap on the chord wave
  pins the full breakdown — "Chord factor ×1.15 · Octave ×1.15 · Final
  output +0.36 ν/s" — the same body the hover and focus paths open.

## State grammar, without color

The solid/dashed + dimmed/bright pair carries live/inert; the three wave
shapes (sine down, electrical zigzag in, formation wave in) and their
directions carry the relationship identity, so greyscale loses nothing
structural. A greyscale rendering pass is unavailable in this environment
(no filter emulation in the preview) — recorded, not claimed.

## Reduced motion

Unavailable as an emulation in this preview. Source-verified instead: the
pulse path paints nothing by default (`opacity: 0`), and its animation
rides `@media (prefers-reduced-motion: no-preference)` scoped to the
readonly scene's active waves — under reduced motion the static solid
wave remains, carrying the same information (hexflows.test.ts pins all
three rules). The captures above without flow show the static
presentation reduced motion gets everywhere.

## Automated checks

At capture time: `npm run check` clean; full suite 58 files / 1176 tests
green (20 new in hexflows.test.ts: active/inert coverage, calculation
consistency against the authoritative pass, disclosure access, empty and
locked places drawing nothing, the render key carrying the chord factor);
`npx vitest run --project ui` green.

## Unavailable checks

- Greyscale rendering pass (no emulation) — non-color distinctions are
  structural (dash, dim, direction, shape) and pinned in the stylesheet.
- Reduced-motion emulation — source-verified as above.
- True touch input — the tap path was exercised with pointer-level click
  events and the pin/dismiss behavior verified live; not claimed as a
  physical touch pass.
- Exact 390×844 viewport — resize times out; the container-query fallback
  documented with the #295 evidence drives the same rules.
