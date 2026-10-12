# Evidence: the approved control geometry applied to production (#316)

All captures from the verified checkout at `aa115e0`, served by `tools/dev-server.mjs` (localhost:5176) with provenance confirmed against `git rev-parse HEAD` immediately before each capture — `worktree` equal to this checkout, `commit` equal to `aa115e0`. The phone composition was captured through a true 390×844 viewport frame on the same server, so both container and viewport queries apply natively.

## Captures

- `desktop-board.png` — the console (square-cut switch, doors, ledger), the left dock with the meter as a shared bar column, square-cut sweep chips, the prestige horizon.
- `desktop-goals-swatches.png` — the GOALS face: the shared bar column at each row's lead filling by height, the done bar at full height under the engraved ✓, the six swatches as square-cut controls with the standing pick under the firm inset marker, the unaffordable slot purchase in the muted unavailable voice.
- `desktop-catalog.png` — the clipped catalog plate: outline-voice price buttons, term triggers on their engraved hairlines, the NOUS face tab in the selected voice.
- `desktop-tooltip-open.png` — the `charge` term's tooltip opened by keyboard Tab: floating text over a hairline rule, no border, no card.
- `phone-board.png` — 390px composition: bare console doors, square-cut switch, the game-info strip's clipped plate, the thumb bar's doors, zoom cluster, sweep chips.
- `phone-goals.png` — the focus sheet at 390px: bars, swatches, facetab marker as on desktop.

## Checks

- **Disclosure**: the tooltip opens by keyboard Tab (captured) and by the click/pin path (sheet doors, swatch picker, and recolor rows exercised by click in the served page); Escape dismisses the disclosure while keyboard focus stays on the term — DOM-verified on the served page.
- **State distinctions without color**: selected = the firm inset underline (facetabs, swatch pick, catalog face tab — visible in greyscale in the captures); unavailable = muted lettering on the soft hairline (the goals slot's 62,500 ν buy); acquired = the engraved ✓ on the done goal bar.
- **Shared shapes**: the bar column, swatch, and button geometry render identically across console, sheet, catalog, and phone — one implementation each, asserted by the stylesheet-contract suite (`instrument.test.ts`, "the controls sheet's stylesheet contract").
- **Checks + types**: `npm run check` and `npm test` green at `aa115e0` (61 files, 1271 passed, 2 skipped).

## Unavailable

- **Reduced-motion rendering pass**: the preview environment cannot force `prefers-reduced-motion`. The sweep introduces no animation — the bar fill's 400ms height transition is the only motion it touches, and the global reduce-motion kill (asserted by the suite's reduced-motion test) suppresses it; not observed rendering, recorded unavailable per [visual evidence](../../agents/visual-evidence.md).
- **Live `:focus-visible` ring matching**: the automation browser does not match `:focus-visible` even on real Tab presses (same limitation recorded in the #315 round). The rule is present — 2px ink outline, 3px offset — and pinned by the stylesheet contract; recorded unavailable.
- **Touch-device taps**: no touch device here; tap paths verified by synthesized clicks only.
- **Pixel comparison against the pinned sheet**: the controls sheet is a throwaway prototype with its own placeholder density; conformance was judged shape-by-shape (square-cut, hairline, fill-by-height, inset marker, plain layer) against `src/ui/controls-sheet.prototype.html` variant A, not pixel-diffed.

## Interpretations recorded

- **Icon furniture keeps its reviewed sizes** (dock 38, zoom 34, legend 34, inline ✕ 28): the sheet's 44px floor governs its text controls; these glyph controls take the sheet's square-cut, hairline, and state grammar while retaining the geometry their own review rounds pinned. Explicit `min-height` preserves each against the shared floor.
- **Achievement bars carry no second ✓**: the row's engraved `ACH_MARK` is the one acquired mark; the bar states completion by holding full fill in the accent register — two engraved checks per row would be furniture.
- **The dock's meter reads the shared column at pip scale** (4×11 inside a 38px door): one shape implementation, sized in context — the sheet itself sizes columns per context.
