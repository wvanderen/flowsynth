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

## Special ability refinement

Source `dacffe4c569e95af830a57c6a31f20635a86c935`, verified through the same
provenance endpoint and worktree. User direction: distinguish fact-keyed
abilities from the normal graded allocations, and consolidate repeated
Breather disclosures within each module description.

- Standby and Tail now carry an outlined star with their ungraded calculation.
  The accessible prefix names it as a special ability. Standby's additive step
  is written `+0.1 per completion`; the BREATH chip still shows its base figure.
- Forge tiles have exactly one Breather glossary trigger each, confirmed at
  desktop (1280 × 900) and phone (390 × 844) CSS widths. Inventory descriptions
  share the first-occurrence treatment; standalone profile sections keep one
  disclosure of their own.
- Keyboard focus and dispatched Escape opened/dismissed the remaining trigger;
  click and outside click reopened/dismissed it. UI regressions verify that the
  trigger does not choose a draft candidate.
- Typecheck passed. Full suite: 1,709 passed, 2 skipped. UI: 851 passed.
- [Desktop attempt](ability-desktop.png) and [phone attempt](ability-phone.png)
  retain the screenshot-service limitations above: image dimensions do not
  follow measured CSS viewport dimensions and captures are blurred. Complete
  pixel-accurate visual, physical touch, native keyboard, greyscale, and
  reduced-motion checks remain unavailable. The star uses shape and accessible
  text, with no color dependency or animation.
