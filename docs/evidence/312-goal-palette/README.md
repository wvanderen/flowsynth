# Goal bars vertical, a player palette — review evidence

Source: issue #312, working tree on `t3code/aaacb9bd` (diff against
`479a83a`). Launched this checkout with `npm run dev`; the provenance
endpoint (`/-/dev/provenance`) returned this worktree and commit
`479a83a` before every capture. Captures are headless-Chromium viewports
of that verified server — desktop 1280×800, phone 390×844 (the T3
preview panel's own resize and snapshot client could not run this pass —
recorded unavailable — so captures came from the repo's cached Playwright
Chromium against the identical verified URL, in both compositions).

Dev fixtures wrote the save directly (three goals: vermillion 20/30 min,
cyan 10/45 min, violet complete) so the palette reads on real state.

## The banner bars

- [Desktop console](desktop-console.png): the reads beside the switch —
  the habit name, then the vertical bars: vermillion at two-thirds fill,
  cyan at a quarter, the violet done bar at full height wearing the
  engraved ✓. In-progress vs complete reads without color (fill height +
  the mark), each goal wears its own picked color, and the `+N` chip
  answers past the five-bar budget (unit-covered).
- [Phone console](phone-console.png): the banner stays launchers-only —
  no habit name, no bars (ADR-0050's phone line, unchanged).

## The palette

- [Desktop create](desktop-goals-create.png) and
  [phone create](phone-goals-create.png): the GOALS face with the create
  form open — exactly six swatches, vermillion ringed by default, the
  goal rows' tracks wearing their goals' colors (the banner bars read the
  same tokens). The completed row reads through the `complete` status
  word and the muted name, never color alone.
- [Desktop re-pick](desktop-goals-repick.png) and
  [phone re-pick](phone-goals-repick.png): the palette's edit half — the
  row's color dot opens the same six swatches inline; a pick lands
  through the engine's upgrade-mode gate and the row, the face track, and
  the banner bar follow (unit-covered).

## Standards checks

- [Keyboard focus](desktop-goals-swatch-focus.png): the focused swatch
  (green) shows the visible focus ring beside the standing pick's inset
  marker — swatches are native buttons, reachable and operable from the
  keyboard.
- [Reduced motion](desktop-goals-reduced-motion.png): the composition
  renders identically under `prefers-reduced-motion: reduce` — the pass
  adds no animation; the fills, marks, and ring are static. (The face
  track's pre-existing width transition sits under the global
  reduced-motion kill.)
- [Grayscale](desktop-console-grayscale.png): the header converted to
  8-bit grey — the done bar still reads through full height plus the
  engraved ✓; the partial fills read as partial. State survives without
  color.
- State without color: the done bar's engraved mark and full height, the
  `complete` word, the aria label's counts ("2 in progress, 1 complete",
  the +N goals included as ", N more"), and the create/re-pick swatches'
  `aria-pressed` carry every state this pass touches.
