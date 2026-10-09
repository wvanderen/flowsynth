# PR #307 Notes review fixes

Notes drafts survive a planned timer reaching its target and Pause/Resume
clicks. Timer rebuilds retain the composer's text, selection, scroll and
focus; Pause/Resume keeps the Notes sheet open. Capturing still saves once,
clears the composer and refocuses it. Issue #277, the instrument refit spec,
and ADR-0050 now omit the Note Generator disclosure requirement.

## Provenance

Launched this checkout with `npm run dev` at `http://localhost:5175/?dev`.
The browser fetched `/-/dev/provenance` and verified worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-34277c8d` and commit
`8be90d2cfcc0685ce3db4fcd5f35b1d76fe23b27`, with the review fixes in the
working tree. [Browser check results](browser-checks.json) record the
provenance and measured geometry. The development controls in the captures
belong to `?dev`; the Notes surface uses the production renderer.

T3 preview navigation and provenance verification worked, but viewport
resize timed out and the automation host disconnected. Evidence was then
captured using headless Chrome Canary through Playwright against the same
verified server.

## Composition and interaction

- [Desktop CAPTURE](desktop-capture.png) and [LOGGED](desktop-logged.png):
  1440 × 900, sheet width 560px, anchored under the clock.
- [Phone CAPTURE](phone-capture.png) and [LOGGED](phone-logged.png):
  390 × 844, sheet width 358px with 16px margins, entirely inside the viewport.
- [Phone LOGGED in greyscale](phone-logged-greyscale.png): the selected
  tab remains distinguishable by its outline and firm inset marker.

Compared with the pinned instrument prototype at `eb232c4`: the clipped
outer plate, open ruled rows, condensed controls and mono stamps preserve
its presentation language. The habit chip rides CAPTURE and the log rows;
notes remain readable sans text, with no explanatory furniture.

Browser assertions verified:

- At elapsed 59 seconds of a 60-second plan, advancing two seconds keeps
  the draft, backward selection and composer focus.
- Pause and Resume clicks preserve the draft and keep Notes standing.
- Keyboard focus plus Enter opens Notes; Escape dismisses it.
- Ctrl+Enter captures, clears and refocuses the composer.
- Emulated phone touch opens Notes through the launcher, switches faces,
  captures, closes and dismisses by tapping outside the sheet.
- The LOGGED stream is newest first, with the mono stamp and habit chip
  preceding the text.
- Under `prefers-reduced-motion: reduce`, the sheet computes animation
  `none` with duration `0s`; the selected tab retains its inset marker.
- No page errors occurred.

Touch checks used browser touch emulation, not a physical phone. This
surface adds no tooltip disclosure; the Note Generator requirement was
removed by the product decision during review.

## Automated checks

- `npm run check`: passed.
- `npx vitest run --project ui src/ui/app.notes.test.ts`: 13 passed,
  including the timer-boundary and Pause/Resume regression checks.
- `npx vitest run --project ui`: 24 files, 627 passed.
- `npm test`: 59 files passed; 1,242 tests passed and 2 skipped. Two
  development-tool tests hit the default five-second timeout (build purity
  and provenance serving). Both files passed on rerun with
  `npx vitest run --project engine tools/build-purity.test.ts tools/dev-provenance.test.ts --testTimeout 30000`
  (4 tests passed).
