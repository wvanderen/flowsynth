# Hex detail — ADR-0072 composition evidence

Captured 2026-10-18 from the verified checkout (worktree `t3/refine-hex-detail-ui`, commit `362f4cd` — provenance endpoint matched `git rev-parse` at capture time). Server `npm run dev`, `?dev` panel used only to seed a chord partner (a second Sine) and the mutator era; the dev panel itself is hidden in the captures. Viewports: desktop 1280×800, phone 390×844.

## Captures

The four PNGs below are the **first-round** captures, taken before the same-day review revisions landed; they show the pre-revision context map (twin seam lines), chip tooltips, chip-row chord facts, and centered stage. A re-capture of the revised surface was attempted the same session but the browser host's screenshot pipeline went down mid-review; the revisions were verified functionally against the live server (evaluate probes: chord link drawn, three ruled fact rows with the capacity mark, column-width scale present, zero chip tooltips, context-map navigation opening the target coordinate, stage top at 151px against the ledger's 136px baseline, and the upgrade title rendering `688 ν` without overflow). Fresh captures are owed when the pipeline is stable.

- **desktop-modules-focus.png** — the default open on the Sine at C4 (first round): the locked Mutators face as the identity thumbnail, the Sine face at full scale and engraving, the action rail below the stack, and the details column — context map, PROFILE chips (`base ×1 (A)` …), CHORD FACTS.
- **desktop-chord-breakdown-open.png** — the chord-bonus wave's breakdown opened by click (pin), the plain floating layer with ruled rows and the result row; the action rail fully visible beneath the stack.
- **desktop-mutators-focus.png** — after the mutator era: the POWER mutator face at full scale in the arete register, the Sine face reduced to its identity thumbnail (chassis, rail, glyph — no text), the mutator→module wave between them, the details column dimmed with the MUTATOR section carrying `Power · +50% to this module's power`.
- **phone-sheet.png** — the 390px bottom sheet: same posts in one column — faces with the focus scale intact, then the ruled sections scrolling, the context map last (CSS `order`).

## Revisions verified after these captures (2026-10-18 review round)

- Two-note chords register on the context map: active chords draw as center-to-center hue links between their voices (`ctx-link`), replacing the board's twin edge lines that fell inside one stroke width at miniature scale.
- The context map navigates: owned cells are SVG buttons (`data-ctx-cell`, click / Enter / Space) opening that coordinate's Hex detail at the current face; the opened cell stays the marker.
- Profile chips are self-contained plain text — the tooltip disclosure (which restated the visible figure) is retired everywhere the shared chip renders.
- Chord facts speak in the breakdown's ruled-row grammar: capacity led by its canonical mark, the total factor, the formation term with its quality scale drawn at column width; instances remain chips with the one idle disclosure.
- The composition hangs from the stage's top (grid `align-content: start`, 14px top pad) — no dead band between the ledger and the cross-section.
- Exact prices wrap rather than clip: the upgrade title and unlock action drop `white-space: nowrap`; dial chips ellipsize with the full figure in the tooltip.

## Verified against the instrument standards

- Identity, actionable state, effect, and cost readable at a glance; the ν/s figure stays on the face, never re-spoken in the column.
- Non-color state: the selected marker (ink outline) on the focused face and the context map's opened hex; the muted/dashed/occupied outline grammar survives at thumbnail scale; the idle trigger is dashed.
- Disclosure opened by click and by keyboard focus (focus-open verified in `profile.test.ts` / `hexdetail.test.ts` suites); Escape dismisses (unit-tested).
- Reduced motion: the composition adds no new animation; the focus scale swap is an instantaneous class flip (deliberate — state survives without animation), and the existing wave-pulse rules remain gated on `prefers-reduced-motion`.

## Unavailable checks

- Greyscale pass and a live reduced-motion capture could not run in this session (the browser host's screenshot pipeline was down for part of it; the four captures above predate the revisions). The unit suites pin the state grammar's non-color marks and the revised grammar; fresh desktop/phone captures and the greyscale review are owed before calling the surface fully validated.
- Touch-target walk on the phone sheet performed by inspection only (44px min-heights are pinned in CSS and asserted in the controls-sheet round; the map's cell buttons inherit the board grid's 44px-plus hit pattern).
