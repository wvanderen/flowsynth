# The calibrated save migration's flow — issue #493

Captured from the verified checkout: served by `npm run dev` at
`http://localhost:5173/`, gated by the capture preflight —
`provenance.json` records worktree `/home/lem/dev/flowsynth`, branch
`t3/issue-493`, commit `de51fe7` (the review-fixes commit; the
translation itself is `1bc08fe`, contained in it), clean source. All
captures are headless-Chromium screenshots of that server
(chromedriver session, window 1280×1200 desktop / 390×987 phone,
screenshots at the viewport's CSS pixels: 1280×1057 and 390×844).

The journey under capture: a finite overpowered v12 save
(`seed-v12.json` — the anonymized supplied-board shape built by
`suppliedBoardState()` with the era measure a runaway left
representable, banked Arete 6, one claimed frontier step) is placed in
the save slot; the app boots, converts once at the boundary, explains
the movement, retains the exact original bytes, and lands on the
calibrated economy. The seeded bytes are committed beside the captures
so the journey re-runs byte-for-byte (`capture.sh` holds the full
sequence; it asserts the retained-original length on the import path
and the silent reload after the explanation is read).

## Captures

| File | What it shows |
| --- | --- |
| `desktop-migration-explainer.png` | The boot migration report at desktop width: the SAVE MIGRATION modal's full composition — the stands/rebased folio rows with the report's own figures (6 Arete banked; 35 modules return to base; nous 8.2B replaced by the opening grant; the era's 400T earned ν rebased; the claimed frontier restarting at the calibrated curve), the retained-original line, and both actions. The dismissed board behind is the retained collection at Lv. 0 on its kept placement. |
| `desktop-migration-disclosure.png` | The disclosure standard: the "Claimed frontier" term trigger under keyboard focus (visible outline) with its tooltip layer open — plain floating text, no card — reading the glossary line ("The entitlement already claimed through prestige"). |
| `desktop-migrated-board.png` | The outcome after Continue: the calibrated economy on the retained collection — every module at Lv. 0 with its merge tier (Roman numerals) and placement standing, nous at the opening grant (12 ν), 6 Arete kept, Harmonic capacity returned to 1/3, finite 4.15 ν/s. |
| `desktop-import-explainer.png` | The same explanation standing after an applied import of the v12 bytes (the import modal closed on apply; the run log asserts the imported source bytes were retained at their exact 7634 bytes before adoption). |
| `phone-migration-explainer.png` | The boot report at phone width (390×844): the same rows at the phone composition, the modal face scrolling internally. |
| `phone-migration-disclosure.png` | The term disclosure opened by focus at phone width. |
| `phone-migrated-board.png` | The migrated outcome on phone: the ledger (12 ν, 6 Arete), the retained placed collection, the phone tab bar. |

## Assertions the run made beside the captures

From `capture.sh`'s run log: the imported source bytes were retained at
exactly 7634 bytes before adoption; after Continue, a reload of the
converted save presents no explanation (the one-time report). The
retained-original download is wired to the same slot the captures
assert (`retainedOriginal()`); its click-through (a browser download)
was not exercised headless — recorded unavailable.

## Unavailable checks

- **Touch-opened disclosure**: the tooling drives a mouse-pointer
  browser; touch targets were verified structurally (the term trigger
  is a `<button>`, focus/touch share the open path per the terms
  layer's wiring) but not by an emulated touch pass. Recorded
  unavailable.
- **Reduced-motion**: the modal animates nothing; the standing board's
  charge activity behind it is unchanged existing behavior. No
  reduced-motion pass was run (no emulation in this pipeline) —
  recorded unavailable.
- **The download affordance's click-through**: a headless browser
  cannot demonstrate a file download; the button's wiring shares the
  export modal's mechanism (`Blob` + object URL). Recorded unavailable.

## Standard checks against the pinned prototype

Square-cut controls (the actions carry no radii), clipped outer panel
silhouette on the modal, open ruled divisions (folio rows, no nested
cards), condensed lettering for the eyebrow and keys, mono figures for
every number, one state grammar (the Continue primary, the plain
secondary), no duplicate ambient warning surface — the modal is the
one place the adjustment is explained, and it owns no aggregation or
penalty readout.
