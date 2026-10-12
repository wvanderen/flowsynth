# Evidence: the approved control geometry applied to production (#316)

## PR #325 term-target review fix

The shared `.term-trigger` now matches the approved `d405ce2` sheet's
`padding: 12px 8px; margin: -12px -8px`, enlarging the inline disclosure
hit area while preserving its layout footprint. `desktop-term-target-fix.png`
shows the catalog with this fix applied on top of `7901028`, served from
`/private/tmp/flowsynth-pr325-review` at localhost:5178; the page's provenance
matched the worktree and HEAD before capture. Browser measurements confirmed
42px-high targets for `charge` and `Harmonic capacity`, with the approved
padding and margins. Desktop composition was inspected against the pinned
sheet's source. Typechecking and all UI suites passed after the fix.

Phone evidence is unavailable for this follow-up: the preview resize timed out,
then the automation host disconnected. Touch and keyboard disclosure checks
and reduced-motion rendering were also unavailable in this follow-up; the
earlier evidence below does not verify this change.

All captures from the verified checkout at `a17b064`, served by `tools/dev-server.mjs` (localhost:5176) with provenance confirmed against `git rev-parse HEAD` immediately before each capture — `worktree` equal to this checkout, `commit` equal to the captured commit (earlier surfaces re-captured at `2f8907d`; only the dock pip changed between those commits). The phone composition was captured through a true 390×844 viewport frame on the same server, so both container and viewport queries apply natively.

## Captures

- `desktop-board.png` — the console (square-cut switch, doors, ledger), the left dock with the meter as a shared bar column, square-cut sweep chips at the dock's compact scale, the square layer-legend strip, the square dashed inventory tray, the prestige horizon.
- `desktop-goals-swatches.png` — the GOALS face: the shared bar column at each row's lead filling by height, the done bar at full height under the engraved ✓, the six swatches as square-cut controls with the standing pick under the firm inset marker, the unaffordable slot purchase in the muted unavailable voice.
- `desktop-catalog.png` — the clipped catalog plate: outline-voice price buttons, term triggers on their engraved hairlines, the NOUS face tab in the selected voice.
- `desktop-tooltip-open.png` — the `charge` term's tooltip opened by keyboard Tab: floating text over a hairline rule, no border, no card.
- `desktop-feats-sheet.png` — the Feats sheet: the square-cut modal plate, the shared bar columns leading the capstone rows, engraved ✓ acquired marks.
- `phone-board.png` — 390px composition: bare console doors, square-cut switch, the game-info strip's clipped plate, the thumb bar's doors, zoom cluster, sweep chips.
- `phone-goals.png` — the focus sheet at 390px: bars, swatches, facetab marker as on desktop, the popover shell square-cut.

## Checks

- **Disclosure**: the tooltip opens by keyboard Tab (captured) and by the click/pin path (sheet doors, swatch picker, and recolor rows exercised by click in the served page); Escape dismisses the disclosure while keyboard focus stays on the term — DOM-verified on the served page.
- **State distinctions without color**: selected = the firm inset underline (facetabs, swatch pick, catalog face tab — visible in greyscale in the captures); unavailable = muted lettering on the soft hairline (the goals slot's 62,500 ν buy); acquired = the engraved ✓ on the done goal bar.
- **Shared shapes**: the bar column, swatch, and button geometry render identically across console, sheet, catalog, and phone — one implementation each, asserted by the stylesheet-contract suite (`instrument.test.ts`, "the controls sheet's stylesheet contract").
- **Checks + types**: `npm run check` and `npm test` green at `2f8907d` (61 files, 1271 passed, 2 skipped); the stylesheet contract now pins the container surfaces square-cut too.

## Unavailable

- **Reduced-motion rendering pass**: the preview environment cannot force `prefers-reduced-motion`. The sweep introduces no animation — the bar fill's 400ms height transition is the only motion it touches, and the global reduce-motion kill (asserted by the suite's reduced-motion test) suppresses it; not observed rendering, recorded unavailable per [visual evidence](../../agents/visual-evidence.md).
- **Live `:focus-visible` ring matching**: the automation browser does not match `:focus-visible` even on real Tab presses (same limitation recorded in the #315 round). The rule is present — 2px ink outline, 3px offset — and pinned by the stylesheet contract; recorded unavailable.
- **Touch-device taps**: no touch device here; tap paths verified by synthesized clicks only.
- **Pixel comparison against the pinned sheet**: the controls sheet is a throwaway prototype with its own placeholder density; conformance was judged shape-by-shape (square-cut, hairline, fill-by-height, inset marker, plain layer) against `src/ui/controls-sheet.prototype.html` variant A, not pixel-diffed.

## Interpretations recorded

- **Icon furniture keeps its reviewed sizes** (dock 38, zoom 34, legend 34, inline ✕ 28): the sheet's 44px floor governs its text controls; these glyph controls take the sheet's square-cut, hairline, and state grammar while retaining the geometry their own review rounds pinned. Explicit `min-height` preserves each against the shared floor.
- **Achievement bars carry no second ✓**: the row's engraved `ACH_MARK` is the one acquired mark; the bar states completion by holding full fill in the accent register — two engraved checks per row would be furniture.
- **The dock's charge pip keeps its horizontal strip** — a direction taken in review: the retired shape was the rounded track, and the pip returns as a square-cut strip filling by width beneath the forge glyph, clear of it. Goal, achievement, and forge-modal meters stay vertical columns.
