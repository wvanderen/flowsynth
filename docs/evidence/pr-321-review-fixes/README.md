# PR #321 review fixes

Captured the updated working tree at `/private/tmp/flowsynth-pr321-review`,
branch `fix/pr321-findings`, based on `fee5c986f114cdd08d4ec8eab4a14372c5d04ced`.
Launched with `npm run dev` at http://localhost:5175/ and verified the
`/-/dev/provenance` response matched this checkout and base commit.

[Desktop goal draft](desktop-goal-draft.png) shows the retained Piano,
30-minute, weekly draft after selecting amber. Browser inspection confirmed
that the pressed swatch retains focus, all six hit areas are 44×44 CSS px,
and the selected inset marker remains distinct from the color. The visual
swatches remain 24 px, within the larger buttons; the recolor trigger also
has a 44×44 minimum hit area, following the pinned instrument prototype.

The regression test enters fields before choosing amber, performs another
render, checks field/node/focus preservation and pressed state, then checks
that Add creates the chosen habit, minutes, schedule, and color.

Checks: `npm run check` passed; `npm test` passed (61 files, 1,263 tests,
2 skipped), including the UI project. The mechanical design scan reported
existing stylesheet patterns; no new motion is introduced by these fixes.

Unavailable: the T3 preview phone resize timed out (iPhone 12 Pro preset).
Phone screenshot and touch interaction were not verified. Grayscale and
reduced-motion browser passes were not performed in this fix pass.
