# PR #404 review fixes

Verified the running server at http://localhost:5173/-/dev/provenance:
worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-d8796d0a`,
base commit `0f17d7d912289f4380853203e886dc1871f3e920` with these review
fixes in the working tree. `desktop.png` captures the final row at 1280px.
Compared with the pinned instrument prototype: open division, square
purchase control, compact current → next effect and one canonical balance.

The chance readout now quotes the current and next purchase outcome;
the purchase's accessible name also quotes the resulting chance. At the
end of the ladder only the owned chance and Tuned remain.

The merge tier term now lives directly in the visible effect line and
uses the existing glossary disclosure layer. The mechanic tooltip says
`Each candidate may mint one step higher`, avoiding an inaccessible nested
disclosure. Activation of the term opened its glossary (`aria-expanded`
true) in the browser. Keyboard focus and Escape verification were
inconclusive in this automation session and are recorded as unavailable.

Phone layout capture is unavailable: both 390px resize attempts timed out,
with preview_status between attempts. Native touch verification is
unavailable (`navigator.maxTouchPoints` is zero). No motion was added;
reduced motion is not applicable. Available/unavailable controls retain
the existing outline grammar, while Tuned is a textual completion state.
