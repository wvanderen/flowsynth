# Module grid refinement — 2026-10-18

User-approved direction: hide idle chord geometry even during inspection; strengthen active chords, emphasize related chords and dim unrelated chords on inspection; preserve category rail colors and rarity plates while charging uses a restrained green outline alone. Threshold-progress fill remains.

## Provenance

Served with `npm run dev` from `/Users/eggfam/.codex/worktrees/1661/flowsynth`, base commit `305e669f6e72b0b5b55fae1bcd4e792596e1a636`, with this working diff. Verified `http://localhost:5173/-/dev/provenance` before saved captures. Disposable production-renderer fixture: `/workbench.html?preview=flow`.

## Captures and review

- `desktop.png`: desktop flow board, category rail identity and rarity plates preserved, threshold fill retained, no receiving face wash or glow.
- `desktop-inspection.png`: keyboard inspection emphasizes the related active chord and dims the unrelated active chord. Idle count remains without idle board geometry.
- `phone-reduced-motion.png`: 390 × 844 phone composition. Reduced-motion emulation confirmed charge leads have `animation-name: none` and retain directional arrow markers.
- `phone-idle-disclosure.png`: idle facts remain in the Hex detail. Pointer activation opens the disclosure; Escape dismisses it.

Reviewed against the Rack identity and the explicit module-grid amendment in `docs/instrument-standards.md`: hex geometry, module hues and glyphs, quiet graphite substrate, behind-face chord geometry, plain disclosure layer. This scope amends historical pins on chord emphasis and charge presentation only. Historical pinned prototypes were not separately launched: that comparison is unavailable. No new controls or panel geometry introduced.

Non-color distinctions: charging increases outline weight; chord inspection increases seam weight as well as opacity; category glyphs and rarity rings remain. Browser grayscale capture unavailable. Real touch-input verification unavailable: the in-app browser rejects `Input.dispatchTouchEvent`; synthetic pointer-touch, keyboard focus, and hover behavior are covered by UI tests. Keyboard disclosure opening is covered by the domain test, and browser Escape dismissal was verified.

## Checks

- `npm run check`: passed.
- Full `npm test` with local networking permitted: 83 files passed; 1667 tests passed, 2 skipped.
- Final targeted UI checks after active-mark class cleanup: 4 files, 173 tests passed. The preceding complete UI pass found only the obsolete workbench glow assertion, which was updated and passed in both subsequent runs.
- `git diff --check`: passed.
- Impeccable detector ran once on the changed UI source files. It flagged existing stylesheet patterns, including SVG stroke/threshold transitions; reviewed as advisory against the pinned Rack language. No design-world drift repair included.
