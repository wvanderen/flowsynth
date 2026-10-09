# PR #305 keyboard review fix

Covered empty cells now leave the Mutators layer entirely with `display:
none` on their parent cell node. This removes the invisible, inert keyboard
button while retaining the visible slot control. Modules restores the
original cell and its keyboard interaction.

Launched this checkout with `npm run dev` at `http://localhost:5175/?dev`.
The provenance endpoint matched worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-bb4e01e8` and base commit
`b63e3b06cafd2fd89d0981b1504ed6deadc95b3a` with the fix in the working tree.

Browser verification staged an unlocked slot on an empty module cell:

- Mutators: the covered cell computed `display: none` and calling its
  `focus()` did not move focus to it.
- The visible slot accepted focus.
- Modules: the original cell computed `display: inline` and accepted focus.

[Desktop composition](desktop-mutators.png) preserves the quiet slot faces
and lattice, judged against the instrument standards' pinned presentation.
The change adds no visible content or motion.

Unavailable: the true 390px phone viewport resize timed out after 10 seconds;
native Tab traversal, physical touch, grayscale and reduced-motion emulation
were not verified in this pass. The browser focus check used `focus()`.

Checks passed: `npm run check`; `npm test` (59 files, 1,207 passed,
2 skipped); `npx vitest run --project ui` (22 files, 590 passed).
