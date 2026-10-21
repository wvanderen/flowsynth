# Interface refinement evidence — 2026-10-20

Review scope: approved compact centered console, Notes inside the dark well, ledger and prestige disclosure, board rotation/navigation, expanded context map, and reported surface defects. [Confirmed brief](../../interface-refinement-brief.md). Production code, not prototype HTML.

## Provenance

Launched with `npm run dev` from `/Users/eggfam/.t3/worktrees/flowsynth/t3-703e1f78`; served at `http://localhost:5174/?dev`. The `/-/dev/provenance` response matched that worktree, branch `t3/ledger-board-ui-improvements`, base commit `d2ac8f2e4e33a97c259953ce1bc7b94255732e06`, with this working diff. Browser used a separate incognito profile and illustrative fixture data. Dev controls were hidden for captures. The sample habit is deliberately long; resources and the high-level module exercise large figures.

## Captures

- [Desktop board](desktop-board.png), 1280 × 900 CSS pixels: the session group's center is x=640, exactly the viewport center; header remains 64px high. Notes stays in the well, Settings at the edge; no second title/navigation row.
- [Desktop ledger](desktop-ledger.png): one shared disclosure, open divisions, and the Arete prestige action.
- [Phone board](phone-board.png), 390 × 844 CSS pixels: no horizontal document overflow. Notes, Pause, and the main action measure 44 × 44px; habit/state reflows inside the console. The two-row ledger retains resources and production.
- [Phone context map](phone-context-map.png): visible Close, pan/zoom surface, and 44px-high cell destinations. Current cell has an inset marker, not color alone.
- [Phone ledger](phone-ledger.png): continuous diagonal corner hairline, shared sections, prestige eligibility read, production roster. Focus outline identifies the clicked section.
- [Phone Catalog](phone-catalog.png): close button fits inside the frame. Zoom's y-position stays 724px before and after opening Catalog.

Additional shared-rim captures: [phone Collection](phone-collection.png), [phone Feats](phone-feats.png), [phone Chords](phone-chords.png), [desktop Collection](desktop-collection.png), [desktop Feats](desktop-feats.png), [desktop Chords](desktop-chords.png). Each phone face measured no internal horizontal overflow. The [corrected phone detail](phone-detail-cost.png) records the cost wrap and ledger clearance.

Large-cost inspection: a level-160 module's exact upgrade cost (`4,562,440,617,622,195,000,000,000,000,000,000 ν`) wraps inside the phone action rail; scroll width and client width both measured 282px. The expanded phone ledger initially overlapped Return in this review; the correction places detail at y=188 below ledger bottom y=178. That correction was confirmed by measured geometry.

## Instrument standards review

Compared the served UI with the pinned presentation source `eb232c4` and controls sheet `d405ce2`, rendered from their exact git contents, using the graphite/cohesion and approved interface-refinement amendments. Square controls, tabular reads, clipped outer panels, and open internal divisions remain. The shared modal rim now uses two clipped plates, matching the pinned construction. The header keeps the incumbent identity and compactness. Hexes retain module identity; category hues, rarity, pitch, and chord semantics remain.

Verified:

- Native Enter opens Notes; composer receives focus; native Escape dismisses and returns focus to Notes.
- Native Enter expands the context map and activates an owned-cell button; overview closes, the focused layer survives, and Return receives focus.
- Automated UI coverage verifies modal dismissal, touch destination alternatives, focus surviving overview ticks, zero-claim confirmation, prestige gate during flow, fixed-decimal rate reads, slider/Reset, letterbox-aware pinch anchoring, coalesced wheel input, occupied-cell Space pan, two-pointer takeover from placement, and preserving Space activation/typing in controls.
- Browser checks confirm the long-cost containment, header/action geometry, no phone or desktop page overflow, and stable zoom position across sheets.
- Unavailability has disabled/lock marks; selection has inset or outline marks. These remain understandable without hue in the reviewed control shapes.

Unavailable: physical trackpad/pinch and multi-touch device testing; exhaustive grayscale review of all four states; OS reduced-motion device capture. No new animation is introduced; the existing global reduced-motion rule disables animation and transition. These are not claimed as device-verified.

## Checks

- `npm run check`: passed.
- `npm run build`: passed.
- `npm test`: 87 files passed, 1,760 tests passed, two existing skips.
- Final `npx vitest run --project ui`: 33 files passed, 815 tests passed.
- `git diff --check`: passed.

The two skipped engine calibration tests are existing opt-in coverage. No game-economy or save-schema changes are introduced.
