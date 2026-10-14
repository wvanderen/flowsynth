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
that criterion. The structural change removes animated filter values and
stops offscreen glow animations; whether the browser composites these SVG
layers, and how much paint/compositor time is saved, remains unmeasured).

## Review correction: viewport culling

The SVG uses default `xMidYMid meet`, so its visible world rectangle includes
letterbox bands beyond its viewBox. Culling now includes those bands using
the rendered viewport size and refreshes on SVG resize, including container
changes that do not render game state. The observer disconnects on release.

Regression checks cover wide and tall letterboxing, viewport changes, and
observer cleanup. In the provenance-verified PR checkout, a 200×200 viewBox
in an 800×400 SVG with a hex at (280, 100) reproduced the bug: the hex was
fully visible but `off-view`. With the correction it remains visible and
is no longer `off-view`.

The before/after performance acceptance criterion is still unverified:
the collaborative preview exposes page evaluation and video capture, but
no DevTools tracing/profiling API. Video and frame timing alone would not
establish paint/compositor cost. Capture comparable fully charged boards
at the same viewport, zoom, live state, and duration on the parent and PR
commits, and report Paint/Composite time per frame from those traces before
claiming a measurable reduction.
