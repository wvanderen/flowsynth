# PR #308 drag-handle review fixes

Served from `/Users/eggfam/.t3/worktrees/flowsynth/t3code-db49f9ca` at
`http://localhost:5174/?dev=1`, branch `fix-pr-308`, commit
`c28c7b217025cf8bff1d2497547b542e8d462add` plus the review fixes in this commit.
The preview's `/-/dev/provenance` response matched this checkout and HEAD.

- Desktop: actual CSS viewport 1402×877; console 522.66×50 at (12,771), fully inside the stage. See `desktop-console.png`.
- Narrow stage: browser viewport resizing timed out twice. As a supplemental layout check, set `#app` to 390px wide in the same browser. After the next tick, console width was 366px, height 82.5px, left 12px, right 378px; computed `flex-wrap` was `wrap`. Every control remained visible inside the stage. See `narrow-stage-console.png`. This is container-width evidence, not a verified phone viewport.
- Automated regressions cover capture assigned to the persistent panel across renders, lost-capture cancellation, and clamping at a 390px stage.
- Unavailable: actual phone viewport, native held-pointer/touch capture across a tick, keyboard/touch disclosure, grayscale and reduced-motion browser checks. The preview exposes no held-pointer gesture tool. The changed console adds no animation or disclosure.

The changed layout retains one panel, the existing controls, and open spacing, consistent with the pinned instrument prototype; it adds no nested cards or explanatory copy.
