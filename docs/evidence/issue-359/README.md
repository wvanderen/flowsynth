# Issue #359 evidence: the Forge draft choice's hover coat

The reported bug: hovering a candidate tile anywhere except its glossary
terms hid the hex and every readout line, leaving only the underlined
term(s). Root cause: the generic `button:hover:not(:disabled)` coat
(opaque `--hover-bg`) outranked the bare `.candidate-pick:hover`
transparent override — (0,2,1) over (0,2,0) — and the pick is a
positioned overlay above the static face.

Fix: `a22012d` — the override mirrors the guard
(`.candidate-pick:hover:not(:disabled)`), plus the stylesheet assertion
in `src/ui/forge.test.ts`.

Captured from the verified checkout (`/-/dev/provenance` matched
`git rev-parse HEAD`) at `http://localhost:5173/?dev=1`, desktop
1402×877 CSS px.

- `user-report-devtools.png` — the report's own capture on the pre-fix
  build: DevTools force-`:hover` on `button.candidate-pick`, the losing
  `.candidate-pick:hover` struck through, and the tile gone dark with
  only the term visible.
- `desktop-before-hover-coat.png` — the right-hand tile with the
  pre-fix cascade's computed value applied to its pick
  (`background: var(--hover-bg); border-color: var(--line-strong)`,
  the exact declarations the generic rule won with): an opaque coat
  covers the mutator face completely; the left tile is unaffected.
- `desktop-after-real-hover.png` — after the fix, a **real** pointer
  `:hover` on the left tile's pick (`pick.matches(":hover") === true`,
  parked by choosing the previous draft — a mutator choice re-renders
  the offer in place): the full face stays readable under hover.

Unavailable, recorded as such per the evidence rules: the phone (~390px)
viewport pass — `preview_resize` timed out on three attempts. The fix is
viewport-independent (one rule, no media-query interaction), and the
≤600px single-column candidate layout is covered by the passing UI suite
(718 tests), but no phone screenshot was captured, so none is claimed.
