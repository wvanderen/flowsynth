# Evidence — issue #389 (redistribute controls on small and short screens)

Captured from the verified checkout served at `http://localhost:5173`:
the dev endpoint's provenance was checked in the capture script before
every pass and matched `git rev-parse HEAD` in the edited worktree —
branch `t3code/fix-issue-389`, commit `cf774f4` (the implementation
commit; the commit after it adds only these evidence files). The thread's
inline preview screenshot transport was unusable: every viewport resize
attempt timed out (five attempts across two tabs, including the retry
after `preview_status`), so the captures below come from a
Playwright-driven Chrome against the same provenance-verified server, at
true viewports — 1280×800 desktop, 390×844 phone, 390×560 short phone.

The state was seeded through the dev harness (`?dev=1`): the dev
scenario's chord geometry (two formations plus extra voices, so the C4
detail carries five idle candidates behind its disclosure), an owned
Mutator patch (occupied, open, and eligible positions), and flow entered
through the real `beginFlow` path. The dev console (dev-mode furniture
docked over the lower band) was held out of frame for every capture.

| Capture | What it shows |
| --- | --- |
| `desktop-grid-upgrade.png` | The desktop reference composition, unchanged: dock and legend sharing the left edge, sweep row and zoom cluster on the lower edge, the Arete arc readable. |
| `desktop-grid-flow.png` | The same grid in flow: the legend stands, the sweep row stands down. |
| `desktop-detail-upgrade.png` | The Hex detail at width: faces centered, rail beside, chord facts in their own column, Return floating. Unchanged by this issue. |
| `desktop-detail-flow.png` | The read-only detail in flow with live readouts and the idle disclosure. |
| `phone-grid-upgrade.png` | The redistributed phone band: the legend at the left edge mid-height (the dock's old post), the sweep row above the horizon lane with its right edge clear of the zoom cluster, the Arete arc and word fully visible, all five thumb-bar segments intact. |
| `phone-grid-flow.png` | Flow: the sweep row stands down, the lower lanes hold the arc, the legend, and the cluster without shared pixels. |
| `phone-detail-upgrade.png` | The Hex detail sheet on phone: the left inset clears the legend's gutter (as the desktop stage hugs its left chrome); Return, faces, dial, upgrade band, and chord facts compose inside the sheet. |
| `phone-detail-flow.png` | The dense read-only sheet: Capacity, ×2.17, Formation + scale, Major triad, and the "5 idle" disclosure all visible with nothing covering them — the pre-fix composition had the legend strip standing on this row. |
| `phone-short-grid-upgrade.png` | 390×560: the same lanes hold; the sweep row clears the cluster and the arc, the legend stays mid-left, board space above remains pannable. |
| `phone-short-grid-flow.png` | 390×560 in flow. |
| `phone-short-detail-upgrade.png` | 390×560 with the detail sheet: the gutter holds, the content scrolls. |
| `phone-short-detail-flow.png` | 390×560 read-only detail in flow. |
| `phone-detail-flow-idle-keyboard.png` | Keyboard disclosure: the scrolled "5 idle" trigger wears its focus ring and the portaled body lists the candidates' names and factors (Major triad ×1.75/×1.85, Fifth ×1.3/×1.4) — asserted open programmatically before the capture. |
| `phone-detail-flow-idle-touch.png` | Touch disclosure: a tap pins the same body (asserted open), a tap-away dismisses it (asserted closed) — the capture shows the open state. |
| `phone-grid-upgrade-legend-focus.png` | The relocated legend strip with the Mutators symbol keyboard-focused: the visible focus outline stands at the new post. |
| `phone-detail-upgrade-tray.png` | The detail's tray overlay on phone (opened from the vacant slot's Add mutator): Cancel reachable, the legend's emphasized Mutators symbol beside the sheet, no overlap. |
| `phone-detail-flow-reduced-motion.png` | The same flow sheet with `prefers-reduced-motion: reduce` emulated: the open lift and charge glow rest, every readout and the disclosure stand. |

## Checks performed in the live browser

A scripted geometry pass ran against the same server at the same commit,
covering the eight phone/short compositions (390×844 and 390×560, grid
and Hex detail, upgrade and flow) plus two arc-card-visible grid passes —
74 assertions, all passing:

- **No overlaps**: bounding-box intersection checks on the real layout —
  legend vs sheet, legend vs thumb bar, legend vs sweep row, sweep row vs
  zoom cluster, sweep row vs horizon-bar lane, cluster vs thumb bar, and
  (with the one-time arc card standing) card vs legend, card vs cluster,
  card vs sweep row. The sweep row's right edge clears the cluster's
  coarse lane (the row ends at x≈312, the cluster starts at x≈322); the
  sheet starts at x≈70 beside the legend's 42px strip.
- **Scroll reachability**: the dense chord column scrolls (scrollHeight
  782 vs 660 client on phone, 782 vs 376 short); after scrolling to the
  end, the idle disclosure sits fully inside the sheet's box and Return
  is still visible; the faces and rails never leave the composition.
- **Disclosure access**: the idle disclosure opened by keyboard focus
  and by touch tap, dismissed by tap-away (asserted before the
  screenshots above). Escape dismissal rides the shared tooltip layer's
  contract, pinned by `src/ui/hexdetail.test.ts`.
- **Destinations stay in the navigation**: no Catalog or Forge buttons
  exist anywhere in the open detail; the thumb bar holds catalog, forge,
  cell, inventory, collection.
- **Non-color state**: the legend's selected face wears the firm inset
  marker (visible in `phone-detail-upgrade-tray.png` on the emphasized
  Mutators symbol); the idle trigger is a dashed outline trigger; the
  flow tag reads as text; the coarse-floor 44px targets are untouched —
  nothing shrank to make the layout fit.

## Suite checks

- `npm run check` (typecheck), `npm test` (70 files, 1501 passed,
  2 skipped), `npx vitest run --project ui` (28 files, 796 passed) at
  commit `cf774f4`.
- The phone suite's new "small-screen composition (issue #389)" block
  pins the lane contract (the #350 pattern: bar lane, sweep-row dock,
  cluster clearance, legend gutter and centering transform, sheet inset,
  arc-card left) and the interaction seams: legend taps in grid, detail,
  and flow — grid layers included mid-session — the re-docked sweep
  buying from its lane, the dense chord case composing into the sheet's
  last post with Return outside the scroller, and the
  no-duplicate-destinations rule. happy-dom has no layout engine, so
  those pins hold the stylesheet contract between runs; the physical
  proof is the geometry pass and captures above.

## Unavailable

- **The inline preview harness's viewport transport.** Every resize
  attempt timed out (documented tool failure, five attempts across two
  tabs including the `preview_status` retry); the captures and geometry
  pass therefore ran in scripted Chrome at true viewport sizes against
  the provenance-verified server. Real-finger touch ergonomics beyond
  the 44px floor and the `pointer: coarse` media presentation were not
  separately captured — the coarse floor is pinned by the suite
  (`src/ui/app.phone.test.ts`, issue #350 block) and no target size
  changed in this diff.
- **Prototype pixel-diff comparison.** The pinned instrument and
  controls prototypes pin control shape; this diff introduces no new
  control shape — it re-docks existing controls (legend symbols, sweep
  chips) whose geometry the sheet already pins. Comparison was made by
  inspection against those pins, not by a pixel-diff run.
