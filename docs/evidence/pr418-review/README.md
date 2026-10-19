# PR #418 review corrections

Source: `d6577588089d7e6125bee232e5704e984237d6d2`, 2026-10-19.

The preview at `http://localhost:5173/?dev` returned that commit and
`/Users/eggfam/.t3/worktrees/flowsynth/t3-ac126310` from
`/-/dev/provenance`. The Forge was populated with Release, Standby, and Tail
through the development app handle, using the production renderer.

## Checks

- Typecheck passed.
- Full suite: 85 files passed, 1,708 tests passed, 2 skipped.
- UI suite: 33 files and 850 tests passed.
- Tail regression now advances a real breather across the first warmth
  threshold, checks the piecewise earned total and allocation invalidation,
  then verifies save/reload and early-exit banking preserve warmth.
- Disclosure regression exercises keyboard focus, Escape, and click activation
  without selecting a draft candidate. In the browser, focus opened the rule
  gloss, a dispatched Escape dismissed it, click reopened it, and outside
  click dismissed it. Native keyboard and physical touch verification are
  unavailable; synthetic events are not a substitute for those checks.

## Visual evidence and limitations

Captured [desktop](desktop.png) at a measured 1280 × 900 CSS viewport and
[phone](phone.png) at 390 × 844. The screenshot service reports a fixed
1280 × 800 capture surface; captures are blurred and phone captures can
repeat the page horizontally. These artifacts document the attempt rather
than establish a pixel-accurate visual pass. Complete desktop/phone visual
approval is unavailable.

Source comparison against the instrument prototype and current amendments:
the correction retains open divisions and plain grade chips, adds the existing
term-disclosure control to effect/rule text, and removes Release's inaccurate
superlative. Rarity shapes and grade letters retain non-color information.
Dedicated greyscale and reduced-motion browser passes are unavailable; no
animation or color styles changed.
