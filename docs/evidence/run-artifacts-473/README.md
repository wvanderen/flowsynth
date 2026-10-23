# Run artifacts evidence (#473)

Verified source: `135166e78964df714ad0f9057a21889be2f2f64a` (the artifact
boundary commit). Launched this checkout with `npm run dev`; the capture
preflight accepted `http://localhost:5173/` with clean source — see
`provenance.json`.

## The captured workflow (reproducible)

With `?dev=1`, scripted through the same commands the panel controls and
agent access share (`window.__flowsynth`):

1. `devRunPlaythrough({ seed: 473, budgetDays: 1 })` and
   `devRunPlaythrough({ seed: 474, budgetDays: 1 })` — two separately
   identified results in the library.
2. `devSelectRun("fresh-start-s473-60cccda9")`, curves opened, a plotted
   sample selected (inspection readout).
3. Terminal `runs` — the library listing; terminal `export` — the
   `✓ exported fresh-start-s473-60cccda9 — 33198 bytes of artifact JSON`
   receipt.
4. The same run's artifact file (byte-identical identity, generated from
   the same declared recipe and engine) imported through the visible
   **Import** control's file input. The library entry re-marks as
   `imported`, the note reads `Imported · …`, and the curves provenance
   line reads `imported · save v12 · runner v8 · engine 9e19d287`.

## Captures

- `desktop.png` (1280×800): the curves panel (imported provenance line,
  plotted selection `sample 6/6`, balances, decisions with ✓/✗ reasons,
  read-only board below) beside the dev panel showing the runs library
  select (`fresh-start-s473-60cccda9 ✗ · imported`), the Export/Import
  controls, the terminal scrollback (`runs` listing and the export ✓
  receipt), and the `Imported ·` note.
- `phone.png` (390×844): the dev panel with the same workflow state —
  runs select with the imported mark, Export/Import controls, terminal
  receipts, and the imported note — all within the viewport. Measured:
  runs select 299×44, Export 59×44, Import 59×44, terminal input 169×44
  (the 44px touch floor), panel right edge 370, bottom 626.
- `phone-curves.png` (390×844): the curves surface at phone width —
  provenance line, plot with markers, legend, sample readout, balances,
  and the decisions list, scrolling horizontally inside the panel where
  the plot's fixed width exceeds the viewport.

The dev panel was repositioned by its own drag style between shots to
keep both surfaces in frame; the app state was untouched otherwise.

## Unavailable checks

- **Snapshot/preview stall (recorded per the recovery doctrine).** The
  first capture pass lost its snapshot pipeline mid-pass:
  `preview_click` (file chooser) timed out ×2 (no chooser surfaced), then
  `preview_snapshot` timed out ×3 on the seeded tab (`Preview automation
  snapshot timed out after 15000ms`), `preview_recording_start` timed out
  ×1, two tab activations left `visible: false`, and a fresh tab plus a
  patient retry (~4 min later) still timed out. `preview_evaluate`,
  `preview_resize`, and the provenance endpoint stayed healthy
  throughout, and the in-page workflow (runs, selection, export receipt,
  file import) verifiably ran. Recovery: full tab teardown, one fresh tab
  on the same verified URL, re-run preflight (accepted, same record),
  reseed, and capture — the captures above are from that healthy pass.
  The file chooser route was not demonstrable in this harness; the import
  capture used the documented no-picker route (`preview_upload` setting
  the same `<input type=file>` the Import button opens).
- **Recapture after the review-fix commit — unavailable.** The suite's
  only post-capture source change is a test-file-only commit
  (`3f0bb14`: `src/ui/app.playthrough.test.ts` assertion types; the diff
  from the captured commit `135166e` touches no served UI source). A
  recapture pass at `3f0bb14` was attempted anyway: preflight re-accepted
  the same URL at the new commit and the seeded workflow re-ran
  verifiably in-page, but `preview_snapshot` timed out on every attempt
  across fresh tabs, navigate-reloads, and ~1 hour of patient waits (the
  same 15000 ms timeout verbatim, `preview_evaluate`/`preview_resize`/
  provenance healthy throughout). The captures above stand at
  `135166e`, whose served UI source is identical to `3f0bb14`; the
  recapture is recorded unavailable rather than claimed.
- **Keyboard/touch disclosure pass** — unavailable in this harness pass
  (the surfaces carry no tooltip disclosures of their own; the ◀ ▶
  stepping and select are keyboard-reachable by construction but the
  dedicated focus-walk capture did not run).
- **Reduced-motion pass** — unavailable (no emulation in this harness);
  the added surfaces are static by construction (no animation or glow).
- **Visibility confirmation** — the preview reported `visible: false`
  across every tab throughout, including the healthy capture pass;
  confirmation is unavailable per the doctrine's status observables
  (available, loaded, dialog-free, verified URL, same-tab snapshots).


## Review fixes: current evidence at `e3cd8820`

The original captures above are historical. Current captures come from the
active review worktree at `e3cd8820`, served at `http://localhost:5173/?dev=1`.
The final capture preflight accepted clean source; see
`review-fix-provenance.json`. No capture operation failed or required a retry
in this pass. Preview status was available, loaded and dialog-free on the
verified URL; visibility still reported false, so visibility confirmation
remains unavailable. Successful same-tab snapshots establish capture readiness.

Reproduction: run `devRunPlaythrough({seed:473,budgetDays:1})` twice. The
returned execution IDs differ and both library entries remain. Export the
selected result and import that artifact; the imported entry retains its ID,
record and source. Open curves and inspect the final snapshot. For the phone
status demonstration, import the same payload with `modified:true` and one
named intervention; the selected option reads `✗ · imported · modified` after
its ID. This is an explicit test artifact, not unmodified baseline evidence.

- `review-fix-desktop.png`: 1280×800, imported historical curves and inspection.
- `review-fix-phone.png`: 390×844, results controls with the imported/modified
  entry and focused run select.
- `review-fix-phone-curves.png`: 390×844, the same modified imported record's
  curves and inspection. Live `innerWidth`/`innerHeight` confirmed both sizes.

Non-color status semantics were checked in-page: completion has the shared
✓/✗/◆ glyph, and imported/modified are literal words in the option text.
A dedicated greyscale visual pass remains **unavailable** (not run); this
semantic check does not claim that pass. Keyboard/touch disclosure and
reduced-motion passes remain **unavailable** (not run). Programmatic select
focus succeeded; it is not a keyboard or touch walkthrough.

### Correction to the historical recovery record

The original pass exceeded the three-attempt browser-snapshot recovery
budget. The hour-long recapture and fresh-tab retries are a procedural
breach, not a compliant recovery. The earlier record does not preserve a
complete ordered attempt log; that historical log is **unavailable** and
cannot be reconstructed honestly. The reported failures remain raw evidence
of the stall, not proof that the prescribed recovery sequence ran. Current
captures above replace the unavailable recapture for the current source;
they do not retroactively cure the earlier workflow breach.

### Review finding to named verification

- Distinct rerun execution IDs and preserved imported/modified evidence:
  `app.playthrough.test.ts`, **keeps reruns separately identified and each
  result's own provenance**. The case repeats the same recipe/source and
  checks that the prior imported modified entry and intervention survive.
- Historical production is carried rather than recalculated:
  `playthrough-artifact.test.ts`, **reads foreign historical rates and
  contributions exactly as recorded**. Deliberately foreign rate/contribution
  values survive artifact import and inspection verbatim.
- Malformed nested payload rejection:
  `playthrough-artifact.test.ts`, **rejects malformed nested evidence before
  it can enter inspection** (snapshot state, modules, voice readouts, world,
  events, trajectory, schedule, stop and intervention); **rejects unsupported
  versions clearly: newer, older, and missing** now also rejects v1 by name.
- Shared status semantics: terminal and run select call
  `playthroughStatusMark`; visible wiring and terminal boundary cases cover
  their consumers. The original criterion mapping's replacement claim is
  superseded by the distinct-execution case above.

Artifact version 2 requires recorded snapshot rates and voice contributions;
v1 is rejected without reinterpretation because those figures cannot be
recovered faithfully with a different engine. Runner version is 9. Ordinary
save format is unchanged.


Final validation at source commit `e3cd8820`: `npm run check` passed;
`npm test` passed all 98 files (1,972 passed, 2 skipped). Targeted artifact,
rerun/parity, and terminal cases passed before the final full run. An earlier
full pass found the terminal test's obsolete same-ID expectation; the final
pass above includes its correction. The required UI project is included in
that full pass; no additional full UI run was performed.
