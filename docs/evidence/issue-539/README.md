# Issue #539 — Hex navigation and shortcut discovery

**Current offered source: `30e05759` on PR branch `feat/539-hex-navigation`; PR #540 review fixes accepted below.** The earlier `ad373d64` captures and suite results are superseded for the changed navigator; they remain historical evidence, not acceptance of the review fixes.

Spec: https://github.com/wvanderen/flowsynth/issues/539

## Preliminary source/spec gate

In-thread source review against the confirmed issue and instrument standards completed before freeze. Findings resolved together:
- Specification blocker: duplicate board-edge and detail selectors. Detail now uses the shared legend builder and hides the board-edge selector.
- Correctness blocker: the old `.ctx-navigation` desktop hiding rule suppressed the new compact map. Replaced with an always-visible compact navigation layout.
- Layout/accessibility blocker: reserve a separate column for the layer selector instead of shrinking the enlarged face; use 44px selector targets.
- Standard violation: Settings reference heading/default definition-list margins. Scoped to the existing condensed 13px ramp and aligned open rows.
- Focus continuity: preserve layer-selector focus across rebuilds and send cell-navigation focus to Return.
- Optional broad cleanup of historical two-face CSS/comments: declined outside the changed composition; no functional requirement depends on removing unused selectors.

Second source pass: shared builder, mode lamp, shortcut handler/reference, discovery gate, input/modifier/modal guards, expanded navigator lifecycle, and inventory/action wiring checked. No remaining source blockers identified. No independent reviewer used. Final visual evidence was owed at freeze, not claimed by this gate.

## Acceptance mapping

| Criterion | Named verification | Class |
| --- | --- | --- |
| Upgrade indigo lamp, other modes unchanged, readable status | Frozen browser mode-state inspection and desktop/phone captures (owed at freeze) | Manual evidence owed |
| L cycles available layers in board/detail; ignores typing/modifiers | `layer-navigation.test.ts`: “gates the shortcut before World discovery and cycles board and detail after discovery”; `shortcuts.test.ts`: both matcher cases | Automated |
| Settings reference shares handler definitions | `layer-navigation.test.ts`: “does not change layers under Settings and renders every shared binding there”; handlers import `SHORTCUTS`, including Space pan | Automated |
| One enlarged selected face and vertical selector; actions/inventory retained | `hexdetail.test.ts`: “shows only the selected enlarged face beside the shared vertical selector”, “the selected face and layer selector carry non-color state markers”, existing World, upgrade, and inventory cases; captures owed | Automated + manual owed |
| Desktop compact map directly navigates owned cells with local hover/focus, no default zoom/list | `layer-navigation.test.ts`: “navigates directly from miniature cells with click and keyboard without opening a dialog”; frozen browser hover/focus inspection owed | Automated + manual owed |
| Explicit expanded navigator remains accessible/dismissible | Existing `hexdetail.test.ts` context-map dialog navigation, Escape/focus restoration, and modal exclusion cases; browser keyboard/touch pass owed | Automated + manual owed |
| Checks, review, desktop/phone evidence | Source gate above; final check/full suite and provenance/captures owed at freeze | Automated/manual owed |

## Final evidence

Offered source revision: `398a7459` (following original freeze `c6d4b4fe`). The first full run was interrupted by its 200-second command limit; the next completed run exposed a heading-outline defect and a stale phone-selector regression. Freeze lifted, fixes batched and reviewed: Settings uses an h2 section under the existing h1 identity; the identity test scopes its no-duplicate-heading assertion to the modal top; the phone regression uses the visible detail selector. Targeted rerun: 164/164 passing. Original suite results and original provenance are superseded, not carried forward.

At `398a7459`:
- `npm run check`: passed typecheck and recorder static gate.
- `npm test`: 136 files passed; 2,427 tests passed, 9 skipped. Completed in 231.84 seconds. No calendar-adjacent or balance behavior changed; no calendar/balance/playthrough recording owed.
- Capture preflight: accepted exact checkout/commit with clean source; see [provenance.json](provenance.json).
- Live phone DOM checks and mode readings: [browser-checks.json](browser-checks.json). One enlarged face, hidden board-edge legend, 44px CSS selector targets, visible compact map, keyboard cell navigation with Return focus, explicit expanded dialog, Escape and focused-invoker restoration, Settings reference without horizontal overflow. Mode colors: indigo Upgrade, vermillion Flow, amber Paused; readable status retained. Because preview did not advance frames, final flow/paused colors were read after explicitly finishing CSS transitions; this does not verify motion.

### Browser failure and bounded recovery

Phone snapshot at 390×844 failed with: `Preview automation snapshot failed: The browser is not producing screenshot frames. For a desktop tab, show or restore the T3 Code window and try again.` Health check verified server provenance. Status: available, loaded, dialog-free, correct URL, initially not visible. Activated same tab; second snapshot failed identically. Status then reported visible; third snapshot still failed identically. Three-attempt snapshot budget exhausted. No screenshots were produced.

Desktop resize: three requests for 1280×800 returned a requested setting of 1280×800 but an actual viewport of 390×844. Intervening status and live `innerWidth/innerHeight` reads confirmed the mismatch. Resize budget exhausted. No desktop layout check is claimed.

**Unavailable:** desktop/phone screenshots and rendered judgment; desktop viewport composition; physical touch gesture validation; rendered hover appearance; reduced-motion emulation. DOM checks are not visual/touch evidence. Breather color is unchanged source but was not separately exercised in this browser pass.

## Final evidence gate

All automated criteria pass at the offered revision. The source fixes and tests are complete, but final acceptance remains **blocked** by unavailable desktop/phone visual and accessibility evidence. No scope waiver has been requested or assumed. Keep #539 open until a functioning browser can capture and judge these surfaces against the instrument standards. Evidence-only updates do not change the offered source revision.

---

## Owner-feedback refinement — current completion record

Owner amendment: https://github.com/wvanderen/flowsynth/issues/539#issuecomment-6961974678. Actual occupant miniatures replace generic layer symbols, clear of the charge wave; mobile opens the navigator by tapping the map, selects before navigating, has no cell list, and exposes Navigate / Navigate & close. Desktop retains direct mini-map navigation without a navigator door.

### Source review, freeze and recovery

In-thread preliminary source/spec pass checked the actual-occupant renderers, existing plain-tooltip wiring, availability gate, reserved wave spacing, desktop/mobile affordance split, selection/confirmation separation, both confirmation paths, Escape/focus lifecycle, and existing zoom/pan behavior. Targeted tests passed before freeze `f2ea3e4e`. No independent reviewer used. The first Chrome phone capture then exposed a real layout blocker: legacy left inset clipped the focus face and Return overlapped the upper preview. Freeze lifted; fixed together by restoring phone sheet width and reserving vertical room for Return, reviewed against those failures, then 109 targeted cases passed and source re-froze at `fbdb8ab3`. All f2ea3e4e suite/provenance/capture evidence is superseded; capture filenames were regenerated at fbdb8ab3, not relabeled.

At `fbdb8ab3`: `npm run check` passed; `npm test` passed 136 files, 2,428 tests, 9 skipped (238.36s). Supported-runtime preflight passed with Node 22.23.4 / America/Chicago / storage roundtrip. No balance or calendar behavior changed.

### Current acceptance mapping

| Criterion | Verification at offered revision | Class |
| --- | --- | --- |
| Indigo Upgrade core; other mode semantics remain; text identifies state | `refinement-phone.png`, `refinement-desktop-hover.png`: visible Upgrade mode label and static indigo core; previous unchanged flow/paused selectors retained, current full suite passes | Automated + manual |
| L cycles available board/detail layers, ignores input/modifiers/modal contexts | `layer-navigation.test.ts`: “gates the shortcut before World discovery and cycles board and detail after discovery”, “does not change layers under Settings and renders every shared binding there”; both `shortcuts.test.ts` cases | Automated |
| Shared Settings binding reference, no main-UI key badges | Same Settings case; source imports `SHORTCUTS` in handlers, layer tooltips and Settings; current captures carry no shortcut badges | Automated + manual |
| Actual occupant miniatures with basic name/level/output tooltip | `layer-navigation.test.ts`: “layer previews show the coordinate's real faces and basic facts instead of generic symbols”; `refinement-desktop-hover.png`, `refinement-phone-tooltip.png`, `refinement-touch-tooltip.json` | Automated + manual |
| One focused face, vertical selector, no charge-wave overlap; actions/inventory preserved | `hexdetail.test.ts` selected-face, selector, World/actions/inventory cases; desktop and phone captures visually inspected. Phone preview right edge x108, charge trigger left x145.09; desktop preview right x340, charge trigger left x364.31 | Automated + manual |
| Desktop mini-map direct navigation, individual hover/focus, no navigator entry | `layer-navigation.test.ts` direct navigation case; desktop screenshot and `refinement-desktop-interactions.json`; `.ctx-touch` computed display none at 1280×800 | Automated + manual |
| Mobile map itself opens navigator, no extra button or exhaustive cell list; selected note/coordinates | `refinement-phone-navigator.png`, `refinement-navigator-snapshot.txt`, `refinement-selection-before.json`; `hexdetail.test.ts`: “selects a map destination on phone without a cell list and confirms before navigating” | Automated + manual |
| Selection does not navigate until confirmation; Navigate stays open; Navigate & close returns | Updated `hexdetail.test.ts` map navigation case; `refinement-selection-before.json`, `refinement-navigation-kept-open.json`, `refinement-navigation-closed.json` exercise actual CLI clicks | Automated + manual |
| Keyboard/dismissal/focus, touch access, reduced motion, non-color state | `refinement-dismissal-motion.json`, phone touch-emulated CLI activation and tooltip capture; selected layer underline and map outline visible without hue. Chrome emulated prefers-reduced-motion reduce and reported no active named animations. Keyboard cell navigation and Escape exercised | Automated + manual |
| Final checks and provenance-verified desktop/phone evidence | Check/full-suite results above; `refinement-provenance.json`, screenshots and interaction records listed here | Automated + manual |

### Capture setup and judgment

Used the user-installed `agent-browser` Chrome DevTools CLI with its dedicated Chrome profile, page ID 3 (closed when finished; other pages untouched). URL `http://localhost:5173/?dev=1`; exact checkout/clean source verified by `refinement-provenance.json`. Desktop 1280×800; phone 390×844 with mobile/touch emulation. Both used reduced-motion emulation. Re-seeded after viewport changes because mobile emulation reloads the page.

Reproducible setup: `app.devLaunchScenario('fresh-start'); app.devWorldEra(); app.state.world.weapons[0].pos={q:0,r:0}; app.openDetail({q:0,r:0},'modules')`. The weapon placement is an explicit constructed evidence fixture, not a progression claim. Hid only `#dev-panel` via page style after seeding so development controls do not obscure product UI; collapsed the World tray through its visible Collapse control for the hover capture. No product surface was hidden. Phone map was scrolled into view, then opened by CLI clicking its map-shaped button. Selected G4, verified underlying detail was still C4, clicked Navigate, verified G4 with dialog still open; selected C4 and clicked Navigate & close, verified Return focus. Reopened via focused map, pressed Escape, verified invoker focus restoration.

Visually inspected `refinement-desktop.png`, `refinement-desktop-hover.png`, `refinement-phone.png`, `refinement-phone-tooltip.png`, and `refinement-phone-navigator.png` with the image reader. Selected miniature has a firm underline; real glyphs/face finishes preserve identity; name, level and output appear in the plain tooltip. Preview targets are 72px, not generic 34px symbols. Incoming charge disclosure is visibly separate. Phone face is no longer clipped and Return clears previews. Navigator has a calm map stage, selected note/coordinates, one zoom slider and two explicit confirmation actions; no grid-cell roster. Desktop has no navigator button. Existing rack panels, type hierarchy and state grammar are retained. `refinement-console.txt` / `refinement-network.txt` record browser diagnostics.

Limitations: touch is Chrome mobile/touch emulation, not a physical handset; no physical-device or pinch-gesture claim. The old preview-service unavailable record remains historical, not current evidence. The first failing phone capture was discarded and regenerated after the source fix.

**Final evidence gate:** current issue criteria and owner amendments map to the named tests and reviewed captures above. Accepted in-thread at `fbdb8ab3`; no remaining implementation or browser-evidence blocker identified.

## Resting ownership visibility — 4889ffc1

Owner feedback: ownership was not apparent on touch without hover. Expanded navigator now renders owned cells with a persistent neutral fill and solid muted-ink outline; unowned context has faint dashed outlines. Selection retains a stronger white outline and a brighter selected fill. The compact desktop map is intentionally unchanged.

Preliminary in-thread source/spec review before freeze: checked selector scoping to `.context-overview`, contrast/state hierarchy at rest, dashed-versus-solid non-color distinction, selected-rule specificity and unchanged navigation behavior. No source findings; no independent reviewer. Targeted `hexdetail.test.ts` passed 63 cases before freeze. Its phone-selection case now asserts one owned face per owned cell and persistent owned/unowned/selected styling independent of hover.

At source freeze `4889ffc1`: `npm run check` passed; `npm test` passed 136 files / 2,428 tests, 9 skipped (238.33s). New suite results supersede prior revision's results. No engine/calendar changes.

Evidence: `ownership-provenance.json` verifies clean source and this checkout. Chrome DevTools CLI page 2, closed afterward; desktop 1280×800 and phone 390×844 mobile/touch emulation, reduced-motion reduce. Setup: `app.devLaunchScenario('fresh-start'); app.openDetail({q:0,r:0},'modules')`, hide development console only, then tap-equivalent activation of `.ctx-touch` on phone. No pointer hover was used to establish ownership styling. `ownership-states.json` records resting computed styles. Visually read `ownership-phone.png`: the three owned cells are clearly solid outlined against the faint dashed surrounding grid; selected current cell retains the strongest white perimeter. Visually read `ownership-desktop.png`: compact map remains unchanged and navigator opener is absent (`display:none`).

Mapping: resting touch ownership → phone capture + computed styles + named phone-selection test; non-color distinction → solid/filled versus dashed state in capture; selection preserved → existing navigation assertions and stronger selected CSS; desktop non-regression → desktop capture and scoped CSS. Prior `refinement-phone-navigator.png` is historical and superseded for ownership appearance by `ownership-phone.png`, not relabeled. Earlier interaction checks remain historical; the current full suite re-verifies selection and confirmation behavior.

Final in-thread acceptance at `4889ffc1`: requested ownership signal is visible at rest without hover, selection remains distinct, and no source/evidence blocker identified. Touch remains emulated, not a physical-device claim.

## PR preparation on current main — ad373d64

The original integration branch had already been squash-merged as #538. Created `feat/539-hex-navigation` from `origin/main` (`d490e40`) and cherry-picked only the eight #539 commits, without conflicts. Source/spec integration pass checked the resulting diff against main: only the intended UI/navigation, tests, instrument amendment and evidence. Existing main corrections are retained; no unrelated Encyclopedia source is in this PR.

Old commit hashes above remain historical, not relabeled. At the new offered source `ad373d64`: supported-runtime preflight passed; `npm run check` passed; full `npm test` passed 136 files / 2,424 tests, 9 skipped (235.95s). The count differs from the older branch because this branch starts from merged main; criterion cases remain present and pass.

Regenerated evidence rather than carrying old captures forward: `pr-provenance.json` verifies this exact clean revision; `pr-desktop.png` (1280×800), `pr-phone.png` and `pr-phone-navigator.png` (390×844 mobile/touch), all with reduced-motion emulation. Reused the documented constructed fixture and hid only development controls. Visually inspected all three images: recognizable occupant miniatures, plain tooltip and focus outline, clearance from charge trigger, phone face/Return layout, persistent filled owned cells versus dashed unowned context, no cell roster, note/coordinates and both confirmation controls. Desktop opener computed display none. `pr-interactions.json` rechecks selection before navigation, Navigate keeping the dialog open, Navigate & close dismissing with Return focus. Browser page 3 closed afterward. Evidence-only commit does not change offered source.

Current criterion mapping is the refinement/ownership mapping above, with all automated results replaced by this full run, visual composition replaced by the three `pr-*.png` captures, and confirmation behavior replaced by `pr-interactions.json`. Earlier gesture/focus records are historical supporting checks, not newly executed hardware evidence. In-thread source and evidence gate: no remaining blocker; physical touch/pinch limitations remain explicit.

## PR #540 review recovery — source gate

Two P2 findings lifted the prior source freeze: the roster-free phone navigator left undersized cell targets, and Navigate kept the original voice's chord geometry after changing destination. Resolved together:

- The expanded map computes its minimum zoom from the rendered viewport and cell geometry so each cell's inscribed diameter is at least 44 CSS px. Slider, wheel and pinch share that floor; resize recomputes it, tall boards retain additional zoom range, and keyboard focus pans offscreen destinations into view. The compact desktop map is unchanged; no roster or extra navigation door returns.
- Navigate obtains the destination's current chord marks after the detail render and refreshes map contents in the existing SVG root. Dialog controls, pan/zoom and focus remain intact; delegated selection works after every refresh, including empty-to-occupied navigation.

Preliminary in-thread source/spec review read both fixes against #539 and its amendments, the instrument standards/controls pin, retained ADR-0072 context semantics, ownership styles, focus/dismissal lifecycle and named regression assertions. Resize cleanup and keyboard visibility were checked as part of the same revision. No remaining source blocker; no independent reviewer. Targeted `hexdetail`, `layer-navigation`, and `shortcuts` run: 74 passed. Final check/full suite and fresh desktop/phone captures are **owed at the new source freeze**. All earlier suite results are invalidated; prior navigator captures do not demonstrate these fixes.

| Review requirement | Named verification | Class/status at source gate |
| --- | --- | --- |
| Touch-sized map destinations without a roster | `hexdetail.test.ts`: “keeps navigator cells at least 44px at minimum zoom and after resize” at 320/390/768px and a tall board; asserts geometry, zoom-out floor, resize, keyboard centering and observer cleanup | Automated; rendered phone evidence owed |
| Destination-dependent formation refresh with Navigate kept open | `hexdetail.test.ts`: “refreshes kept-open map chords for empty and occupied destinations without resetting navigation”; asserts chord removal/restoration, marker/selection, zoom, button focus and dismissal restoration | Automated; browser interaction evidence owed |
| Existing direct desktop navigation, phone confirmation, ownership and layer behavior | Existing `hexdetail.test.ts` and `layer-navigation.test.ts` cases; targeted pass above | Automated; desktop/phone composition evidence owed |
| Final check, full suite, provenance and acceptance | Owed after source freeze | Automated/manual owed |

### Frozen-source final evidence and acceptance — 30e05759

Source froze at `30e05759` after the source gate above. No subsequent source changes. Supported-runtime preflight accepted Node 22.23.4 / America/Chicago / UI storage roundtrip. At the freeze: `npm run check` passed (tsc plus recorder static gate); one full `npm test` passed 136 files / **2,429 tests, 9 skipped** (238.12s). This replaces all earlier suite results. No engine, calendar, balance, save or recording changes are involved.

Capture setup: `npm run dev` served this worktree at `http://localhost:5173/?dev=1`; [review-provenance.json](review-provenance.json) accepted the exact checkout, commit and clean source before capture. Chrome DevTools CLI page 2 was created for this pass and closed afterward; existing page 1 was untouched. Desktop 1280×800; phone 390×844 and small phone 320×740, with mobile/touch emulation on phones and reduced-motion emulation throughout. Actual `innerWidth`/`innerHeight` were checked.

Reproducible constructed fixture: `app.devLaunchScenario('fresh-start')`; clone the starter module with `structuredClone`, set the copy's id to `review-voice` and position to `{q:1,r:0}`, push it into `app.state.modules`, then `app.openDetail({q:0,r:0},'modules')`. The pair forms a Fifth; `{q:0,r:1}` is empty. This is a constructed test fixture, not earned progression. For desktop, set `app.state.world.unlocked=true` to retain both layer previews and collapse inventory through its visible control. Only `#dev-panel` was hidden by page style; no product surface was hidden. For the tall-board boundary, add row 30 to `unlockedRows` and owned cell `{q:0,r:30}`, rerender, reopen, then focus its map cell and press Enter.

| Requirement | Frozen-source evidence | Class |
| --- | --- | --- |
| Touch-sized cell selection without a roster | The named geometry regression above passes at 320/390/768px and on a tall board. [review-phone-targets.json](review-phone-targets.json): all three cells are 44.17×51.00px at the minimum zoom. [review-small-phone-targets.json](review-small-phone-targets.json): 44.10×50.92px at 320px, no page overflow. [review-tall-board.json](review-tall-board.json): 44.04×50.86px after Ctrl-wheel zoom-out, dynamically increased zoom range, distant keyboard target fully visible. | Automated + manual |
| Navigate refreshes destination formation, preserving the dialog and viewport | Named refresh regression above plus actual CLI cell/button clicks: [review-before-confirm.json](review-before-confirm.json) retains C4 before confirmation; [review-empty-destination.json](review-empty-destination.json) navigates to C5 with zero chord links; [review-occupied-destination.json](review-occupied-destination.json) navigates from empty C5 to G4 and restores one link. Both Navigate results retain the identical viewBox and focused Navigate button. | Automated + manual |
| Selection, dismissal and focus remain accessible | [review-confirm-close.json](review-confirm-close.json): Navigate & close dismisses and focuses Return. [review-dismissal.json](review-dismissal.json): Escape dismisses and restores the focused map invoker. [review-keyboard-selection.json](review-keyboard-selection.json): Enter selects remote `{0,30}` without navigating the underlying detail. | Automated + manual |
| Desktop retains direct navigation with no expanded-map door | [review-desktop-navigation.json](review-desktop-navigation.json): actual compact-cell click opens empty C5 directly, no dialog, Return focused, touch opener display none. [review-desktop-disclosure.json](review-desktop-disclosure.json): focus-opened miniature tooltip dismisses with Escape while detail stays open. | Automated + manual |
| Desktop/phone composition and non-color state | Visually inspected [review-desktop.png](review-desktop.png), [review-phone.png](review-phone.png), [review-phone-refreshed.png](review-phone-refreshed.png) and [review-small-phone.png](review-small-phone.png) with the image reader. Larger owned faces retain solid outlines/fill; unowned context remains dashed/faint; selected/opened perimeter is strongest; C4→G4 updates the marker, label and chord context. Buttons fit at 390px and wrap at 320px without clipping. The desktop mini-map and selected-face composition remain intact. | Manual |
| Reduced motion, diagnostics and final checks | Reduced-motion emulation confirmed in `review-dismissal.json`; map updates have no added animation. [review-console.txt](review-console.txt) records diagnostics. Preflight, check and full-suite results above. | Automated + manual |

**Final evidence gate:** both review findings are resolved against the named assertions and fresh rendered evidence at `30e05759`. Accepted in-thread; no remaining source or evidence blocker identified. All `review-*` artifacts were produced at this freeze, not relabeled from earlier captures. Physical-handset touch and physical pinch testing remain unavailable; touch is Chrome emulation, and no physical-device claim is made. The automated minimum-zoom assertions cover slider/wheel and the shared zoom clamp, not a hardware pinch gesture.
