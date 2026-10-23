# Resource curves and historical inspection evidence (#470) — captures unavailable, server provenance verified

The change adds the resource-curve surface to the playtesting suite: the
run's trajectory plotted against simulated elapsed time or credited
practice, the purchase / unlock / session / breather / prestige markers,
the exact recorded snapshot behind every plotted sample and stamped
event, and the selection's board, balances, and recent decisions read
out through the shared inspection command. The evidence pass for the
changed dev-panel surface is **partially unavailable**: every server-side
check passed and the in-page demonstrations ran, but the screenshot
pipeline could not capture the tab — the same failure class the #468 and
#469 passes recorded.

## What is verified

- **Provenance** — the capture preflight accepted `http://localhost:5173/`
  at each of `b4cc3d8c`, `befaa09`, and the final `85cc7c4` (the record
  beside this README carries the last): served worktree, commit, and
  clean source all verified. The dev server for this worktree was
  launched with `npm run dev` per
  [visual evidence](../../agents/visual-evidence.md).
- **Page health** — in-page probe on the verified URL (`?dev=1`), tab at
  1280×800: `requestAnimationFrame` served in 0.4 ms, zero long tasks over
  1.2 s, `document.hidden === false` — the page was not the cause of the
  capture failures.
- **Panel composition (in-page reads, not captures)** — with a completed
  prompt run (`Prompt prestige ✓ 15d`, seed 7, `fresh-start-s7-0c1ca5c8`,
  91 snapshots, 61 plotted samples, 305 decisions) the curves panel
  carries: 61 sample pick targets, 17 purchase marks, 64 unlock marks,
  30 session hairlines, 30 breather ticks, 1 prestige hairline, the
  series/marker legend, the clock toggle (elapsed / credited), and the
  stepping controls. The selection readout names the snapshot, both
  clocks, and the rate (`sample 55/91 · sim day 9 1:00:00 · credited
  7 h 30 min · 94.83 ν/s`), the balance line follows, the board reads as
  13 voice rows, and the decisions list carries the moment's ✓/✗ lines.
- **Keyboard access** — a real Tab walk from the clock toggle's first
  button landed on the stepping controls (focus inside the panel) with a
  2px `:focus-visible` outline; the axis and stepping buttons meet the
  44px touch floor (measured 44×44 and 66×44).
- **Non-color state distinctions** — series carry distinct dash patterns
  (solid rate, `5 3` nous, `1 2.6` era, `7 2 1.5 2` arete, `2 2`
  charge, solid-width-2 credited) read off the live SVG; markers are
  distinct glyphs (▲ purchase, ◆ unlock, │ session, ┊ breather, ╌
  prestige); the selection wears the filled larger circle plus the dashed
  hairline; decisions distinguish ✓ from ✗ by glyph.
- **Selection wiring through the DOM path** — clicking a plotted circle,
  a session hairline, and the ◀ ▶ controls each moved the selection to
  the exact recorded snapshot (app-level `devInspected` read alongside),
  and the readout re-rendered; the suite pins the same at the boundary.
- **Human/agent parity** — the same inspection the panel performs runs
  through the shared command: the demonstration seeded, selected, and
  stepped via `app.devRunPlaythrough`, `app.devInspectPlaythrough`,
  `app.devStepCurves`, and `app.devSetCurvesAxis` — the identical methods
  the controls call. The happy-dom wiring cases
  (`src/ui/app.playthrough.test.ts`, "the curves surface's visible
  wiring") assert the parity, the selection, and the readout directly.
- **Reduced motion** — the surface runs no animation or transition;
  `getAnimations()` on the open panel returned 0 and the stylesheet
  forces static presentation under `prefers-reduced-motion`.
- **Suite** — `npm run check` and the full `npm test` pass at `85cc7c4`
  (95 files, 1,910 tests). The composition reads above were taken at
  `befaa09`; the review fixes after it (world placements plotting no
  purchase marker, dedupe, docs) do not touch the demonstrated prompt
  run's panel — the run carried no World placements — and the suite
  re-ran green at the final commit.

## Criterion-to-evidence mapping

Each acceptance criterion from the issue beside its named verification.

| Criterion (issue #470) | Verification | Class |
| --- | --- | --- |
| Plot balances and rates against simulated elapsed time, distinguish credited practice, mark purchases, unlocks, session boundaries, prestige | "records a frozen snapshot for every plotted sample and every event's exact moment" + "classifies curve markers, and declined attempts and unlisted actions plot none" (`src/ui/app.playthrough.test.ts`); the plotted series, both clocks (axis toggle), and the five marker classes read off the live panel (composition reads above) | automated + manual evidence |
| Snapshots consistent with plotted samples and action events; no interpolated or mismatched board as an exact recorded state | the same snapshot test: every event's snapshot stamp equals the event's stamp, every sample resolves to its exact recorded state whose recomputed rate equals the plotted figure; deep-frozen states | automated |
| Selection reveals matching board/state and recent decisions through the visual workspace and shared commands; read-only; cannot mutate the active run | "selection reveals the matching board, state, and recent decisions through the shared command" and "inspection never mutates the active run, the save, or the recorded state" (`src/ui/app.playthrough.test.ts`); the panel's selection wiring through the DOM path (circle, hairline, stepping) read in-page (above). "Recent" reads as the decisions stamped at the selected moment — the action record's own granularity | automated + manual evidence |
| The action record sole owner of decision reasons; historical selection sole owner of the inspected board/state; no second explanation store | the inspection's events are the record's own event objects filtered by stamp (asserted equal in the selection test); the selection is the one `devInspected` field and the inspected board is the record's own snapshot — no copy or second store exists | automated |
| Verify selection/state correspondence, numerical trajectory outcomes, non-mutation at the shared application boundary; desktop/phone/keyboard/touch/non-color/reduced-motion evidence | correspondence, trajectory numbers, and non-mutation: the three snapshot/inspection tests above, driven through `app.devRunPlaythrough`/`app.devInspectPlaythrough`. Keyboard walk, touch floors, non-color dash/glyph distinctions, reduced-motion probe: in-page reads (above). Desktop and phone captures: **unavailable** (recorded below) | automated + manual evidence, captures unavailable |
| Cover parent stories 27–29 and the historical portions of 18, 26, 30, 38; no historical resume/fork | 27/28: the plot, markers, and selection tests; 29: the read-only tests; 18: decisions with reasons asserted since #468 and revealed per moment here; 26: both clocks per sample ("reports both clocks per sample, and the axes switch"); 30: the shared commands (`devInspectPlaythrough`, `devStepCurves`, `devSetCurvesAxis`) are the panel's own calls; 38: phone layout **unavailable** in this pass (below). No resume/fork exists — nothing in the diff writes historical state back into a run | automated, phone partial |

## What is unavailable

**Desktop and phone captures: unavailable — the preview screenshot
pipeline timed out on every attempt while the page itself stayed healthy.**

Raw failures, in order, across three tabs (each a fresh pass at the
verified URL):

1. Tab 1 (1280×800, verified URL, seeded demonstration): `preview_snapshot`
   → "Preview automation snapshot timed out after 15000ms." Recovery per
   [visual evidence](../../agents/visual-evidence.md) §5: `preview_status`
   read (available, not loading, no dialog, verified URL), then attempts 2
   and 3 → same timeout each time. Tab budget exhausted.
2. Tab 2 (fresh tab, resized to 1280×800 — live read confirmed
   `innerWidth 1280, innerHeight 800`, demonstration re-seeded):
   snapshot attempts 1–3 → same timeout each time. Budget exhausted.
   The in-page health probe above ran clean on this tab.
3. Tab 3 (fresh tab, 1280×800 confirmed, demonstration re-seeded):
   snapshot attempts 1–3 → same timeout each time. Budget exhausted.
4. Phone 390×844: `preview_resize` returned on every attempt but the
   live read stayed 1280×800 across all three attempts (in-page read
   between attempts) — the phone pass is unavailable, and no phone
   capture or phone-viewport live read is claimed. The phone-layout
   composition of the panel is therefore **unverified in this pass**;
   its contract (panel width `min(640px, 100vw − 24px)`, the plot
   scrolling horizontally at its 600-unit drawing width, all controls
   at the 44px floor) is recorded here as the implementation's claim,
   not as evidence.
5. Visibility: the harness reported `visible: false` throughout on all
   tabs, including after activation — visibility confirmation is
   unavailable alongside the captures.

## Observation recorded, no claim made

While re-verifying the served source after the marker fix, this harness's
tab kept serving the previous module content to a full page reload even
though the dev server answered `?raw` requests with the current file
(server-side `curl` confirmed the new content; the page's own behavior
only caught up across a new tab). The provenance fingerprint mechanism
itself is pinned at the boundary ("records engine content provenance and
identifies a changed source",
`src/ui/app.playthrough.test.ts`); no dev-mode freshness claim for the
fingerprint is made by this record in either direction.
