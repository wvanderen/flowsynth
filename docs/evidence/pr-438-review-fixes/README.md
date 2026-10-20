# PR #438 review corrections

Reviewed against `docs/instrument-standards.md`, its pinned control geometry,
and the approved World plate composition. The corrections retain square-cut
plates, open divisions, plain transient readouts, and the existing motion rules.

## Provenance

Launched with `npm run dev` in
`/Users/eggfam/.t3/worktrees/flowsynth/t3-66dfe05c` at
`http://localhost:5173/?dev`. The served provenance endpoint confirmed this
worktree and base commit `4befa8a08b2bc658731f44645a776f1dcdd95bd9`;
these captures include the uncommitted review corrections. Used an incognito
preview after a default-profile tab adopted another tab's save. Scenes use the
World era dev grant and actual tray/board controls.

## Checks

- At 390px CSS width, target-priority buttons measured 46 × 46px including
  borders, retaining square controls and open rows.
- An armed open cell accepts keyboard focus and displays
  `this BLADE: unfed → unfed` before placement. Escape cancels the gesture.
- Inspection with Hex detail open displays the supply projection before Place.
- Unfed plates retain `ATK 4` alongside `UNFED` and stored charge.
- Regression tests cover pointer/focus preview, render persistence, exit cleanup,
  detail placement preview, unfed grid/detail ATK, and hover figure ownership.

## Capture limitations / unavailable checks

The browser screenshot output is blurred; phone output is sometimes tiled into
an image whose dimensions differ from the measured CSS viewport. The files here
record the capture attempts, not a successful crisp visual-composition pass.
Desktop and phone composition approval is therefore unavailable. DOM readings
above were independently observed at 1280px and 390px; they do not substitute
for visual approval. Physical touch disclosure, greyscale, and OS reduced-motion
passes were unavailable. No disclosure or animation rules changed.

## Automated validation

`npm run check` passed. The final complete `npm test` run passed 87 files:
1,746 tests passed and 2 skipped. The separate final `--project ui` run passed
all 816 UI tests. `git diff --check` passed.
