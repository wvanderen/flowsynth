# The charge breathe's glow layer

Issue #348, commit `1018958` on `t3code/implement-issue-348`. Launched
this checkout with `npm run dev` at http://localhost:5173/?dev. Before
capture, the provenance endpoint confirmed worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-9360261d` and commit
`1018958f0bfbfb0bb01135947e7ba9b56abe6034`.

[Desktop charged board](desktop-charged-breathe.png), captured with the
breathe animations pinned at their 50% keyframe (`getAnimations` →
`currentTime = 1200`), shows the light reading at a glance as charge: the
dispensing Focus Generator wears the amber halo in its own register, the
two charged receivers wear the green charge halo, and the glow sits under
each chassis as its own layer — a static blur the breathe animates by
opacity alone. The 2.4s rhythm, hue, and 60% peak are the old
drop-shadow light's; blur(3.5px) is its 7px radius.

Browser checks on the same verified checkout:

- An uncharged face renders no glow layer at all; the layer exists only
  on charged and dispensing faces (the old breathe's exact scope).
- Zoomed in and panned past the lit faces, every off-view glow reports
  `animation: none; opacity: 0`; fitting the board resumes
  `charge-breathe`. Panning re-lenses the glow mid-gesture, before the
  release's render.
- The charged chassis fill and rail still carry the inline
  received-strength glow, unchanged.

Stylesheet contract tests pin the rest: a brace-matched scan asserts no
`@keyframes` in the stylesheet animates `filter:`; the reduced-motion
block rests `.hex-glow` lit at `opacity: 0.6` (a static lit state, charge
readable without animation) while `.hex-glow.off-view` stays dark.

Unavailable: phone viewport capture (preview resize automation failed on
every attempt — 3 in the primary tab, 1 in a fresh tab; phone behavior
remains covered by the passing `app.phone.test.ts` board suites), a live
reduced-motion capture (no `prefers-reduced-motion` emulation in the
preview tooling; pinned by the stylesheet contract test), and before/after
devtools performance profiles (not runnable with this tooling — a
reviewer with devtools open on a fully charged board is the check for
that criterion; the mechanism is structural: per-frame work per lit hex
drops from a filter re-rasterization to an opacity composite, and
off-lens hexes drop to zero).
