# Mutators lead every co-list — review evidence

Source: issue #314. Captured on this branch's working tree on top of
commit `b65e95c9519bc3be0a27f261feba016d77bc3c7b`. Launched this
checkout with `npm run dev`; the provenance endpoint's `worktree` and
`commit` matched `git rev-parse` in this checkout before every capture.

## The change

One order rule, one place: the shared `layerLegendHtml` builder
(src/ui/mutators.ts) now emits the Mutators entry before the Modules
symbol, so the board layer legend, the tray column's switch (the same
`#layer-legend` — the column carries no second one, per #272/#295), and
the inventory sheet's switch (`.tray-switch`, render.ts) all lead with
Mutators. Native buttons tab in DOM order and the symbols carry no
`tabindex`, so sight and keyboard agree by construction; the per-button
aria strings ride their own symbols and are unchanged. The catalog
keeps `ν nous` first (the recorded resource-order exception), the
default layer stays modules, and no tray content reordered.

## Desktop (1402×877 viewport, screenshot pipeline crops to 1280)

- [Board legend](desktop-legend.png): the strip at the board's left
  edge — the locked Mutators symbol (padlock) on top, the ⓘ beneath it,
  the Modules symbol last. Verified live: `#layer-legend`'s
  `[data-legend-layer]` buttons read `["mutators", "modules"]`.
- [Disclosure by keyboard focus](desktop-legend-focus-tooltip.png):
  focusing the ⓘ opens "Unlocks with the Mutator entry"; Escape
  dismissed it (verified live in the same session).
- **Tab walk** (no screenshot — order is the evidence): Tab from the
  Mutators symbol landed on "About unlocking Mutators" ⓘ, then on
  "Modules layer" — keyboard order equals visual order, read from
  `document.activeElement` after real Tab presses.

## Phone (~390px)

The preview window's resize times out in this environment (recorded by
the #295/#297/#298 evidence too); `#app` was constrained to 390px so
the app's own container query re-docks the anatomy. The same gated
composition drives what a 390px device renders — except the body-level
modal layer, which stays on `@media` by design and therefore keeps the
desktop frame in the sheet capture (recorded under unavailable checks).

- [Board legend](phone-legend.png): the strip re-pinned above the thumb
  bar, still Mutators (padlock) → ⓘ → Modules.
- [Sheet switch](phone-sheet-switch.png): the inventory sheet's
  `.tray-switch` — locked Mutators symbol leftmost, ⓘ beneath, Modules
  to its right; the same two symbols the board strip hosts, read
  `["mutators", "modules"]` live.
- **Touch disclosure**: tapping the sheet switch's ⓘ opened the
  "Unlocks with the Mutator entry" body (`aria-expanded` true), a tap
  away dismissed it (`aria-expanded` false) — verified live with
  synthesized pointer events, not a physical touch pass.

## Non-color state distinctions

Unchanged by the reorder and visible in the captures: selected layer =
firm inset marker; locked layer = muted outline + padlock mark; the ⓘ
disclosure is present in both states. The strip carries no animation or
glow — nothing to guard under reduced motion (source-verified: no
`animation`/`transition` on `.layer-legend`, `.legend-symbol`,
`.legend-entry`); motion on this surface remains the hover background
swap only.

## Automated checks

At capture time: `npm run check` clean; full suite 61 files / 1265
tests green (2 skipped). mutators.test.ts pins the new order ("mutators
lead every co-list"): `["mutators", "modules"]` on the strip pre-entry
and in the mutator era, plus the sheet's `.tray-switch`, with the
no-`tabindex` assertion keeping tab order pinned to DOM order.

## Unavailable checks

- True phone viewport (resize times out) — the `#app` container-query
  fallback was used; the sheet's body-level modal keeps its desktop
  frame in [phone-sheet-switch.png] by design (viewport media query).
  The switch and its order are the same objects the phone frame hosts
  (pinned by app.phone.test.ts).
- Physical touch input — the tap paths were exercised with synthesized
  pointer events and verified live; not claimed as a physical pass.
- Greyscale rendering pass (no filter emulation) — non-color state is
  structural (inset marker, padlock, words) and pinned in the
  stylesheet.
