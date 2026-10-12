# Mutators lead every co-list — review evidence

Source: issue #314. Captured on this branch's working tree on top of
commit `36dec6c66d00fb64c3e21c3b34926674613cc111` plus the follow-up
ⓘ removal (issue #314 review decision, same working tree). Launched
this checkout with `npm run dev`; the provenance endpoint's `worktree`
and `commit` matched `git rev-parse` in this checkout before every
capture.

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

Follow-up (same issue, review decision): the locked symbol's ⓘ
disclosure is cut — the padlock's own native tooltip ("Mutators —
locked; unlocks with the Mutator entry") carries the mechanic, per the
tooltip doctrine (a disclosure that restates the tooltip goes). The
legend is two symbols, nothing else; the strip and sheet carry no
`.inst-tip` at all.

## Desktop (1402×877 viewport, screenshot pipeline crops to 1280)

- [Board legend](desktop-legend.png): the strip at the board's left
  edge — the locked Mutators symbol (padlock) on top, the Modules
  symbol beneath, no ⓘ between or beside. Verified live:
  `#layer-legend`'s `[data-legend-layer]` buttons read
  `["mutators", "modules"]`, zero `.inst-tip-trigger`s.
- **Tab walk** (no screenshot — order is the evidence): Tab from the
  Mutators symbol landed directly on "Modules layer" — keyboard order
  equals visual order, read from `document.activeElement` after a real
  Tab press. The locked symbol's title was read live:
  "Mutators — locked; unlocks with the Mutator entry".

## Phone (~390px)

The preview window's resize times out in this environment (recorded by
the #295/#297/#298 evidence too); `#app` was constrained to 390px so
the app's own container query re-docks the anatomy. The same gated
composition drives what a 390px device renders — except the body-level
modal layer, which stays on `@media` by design and therefore keeps the
desktop frame in the sheet capture (recorded under unavailable checks).

- [Board legend](phone-legend.png): the strip re-pinned above the thumb
  bar — padlock (Mutators) then Modules, no ⓘ.
- [Sheet switch](phone-sheet-switch.png): the inventory sheet's
  `.tray-switch` — locked Mutators symbol leftmost, Modules to its
  right; the same two symbols the board strip hosts, read
  `["mutators", "modules"]` live, zero `.inst-tip-trigger`s.

## Non-color state distinctions

Unchanged by the reorder and visible in the captures: selected layer =
firm inset marker; locked layer = muted outline + padlock mark. The
strip carries no animation or glow — nothing to guard under reduced
motion (source-verified: no `animation`/`transition` on
`.layer-legend`, `.legend-symbol`); motion on this surface remains the
hover background swap only. The locked mechanic reads from the title
tooltip on hover/focus of the symbol itself; the ⓘ's former
focus-open/tap-open paths are gone with it (pinned by tests).

## Automated checks

At capture time: `npm run check` clean; full suite 61 files / 1265
tests green (2 skipped). mutators.test.ts pins the new order ("mutators
lead every co-list") and the ⓘ-less contract ("the locked symbol
carries its mechanics on its own tooltip — no ⓘ disclosure rides strip
or sheet"): `["mutators", "modules"]` on the strip pre-entry and in the
mutator era, plus the sheet's `.tray-switch`, the no-`tabindex`
assertion keeping tab order pinned to DOM order, and the title
assertion keeping the lock mechanic on the symbol.

## Unavailable checks

- True phone viewport (resize times out) — the `#app` container-query
  fallback was used; the sheet's body-level modal keeps its desktop
  frame in [phone-sheet-switch.png] by design (viewport media query).
  The switch and its order are the same objects the phone frame hosts
  (pinned by app.phone.test.ts).
- Native-title rendering pass — the browser's hover tooltip for the
  `title` attribute is OS chrome, not page content; the attribute's
  presence and copy were verified live and pinned by tests instead.
- Physical touch input — the sheet paths were exercised with
  synthesized pointer events in earlier passes; this pass changes no
  touch behavior (the removed ⓘ was its only touch target besides the
  two symbols).
- Greyscale rendering pass (no filter emulation) — non-color state is
  structural (inset marker, padlock, words) and pinned in the
  stylesheet.
