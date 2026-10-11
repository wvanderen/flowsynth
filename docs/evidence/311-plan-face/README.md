# PLAN face rework: one readout, compact controls, re-click starts flow

Source: issue #311, working tree on `t3code/flowsynth-issue-implementation`
(diff against `479a83ac78e8c7c1ae2f3a39fc93cff5e76f0afd`). Launched this
checkout with `npm run dev` at `http://localhost:5173/?dev`; the provenance
endpoint (`/-/dev/provenance`) returned this worktree and commit before any
capture. Desktop captures are a 1280×800 headless-Chrome viewport of that
server (deviceScaleFactor 2); the phone capture is 390×844 (mobile
emulation) of the same server. The preview panel's own snapshot client
could not run this session — recorded unavailable — so captures came from
headless Chrome over CDP against the identical verified URL.

Dev fixtures set the scene (`window.__flowsynth`): habits Piano (selected)
and Cooking, a 25-minute plan armed, the sheet standing on PLAN.

## The reworked face

- [Desktop plan face](desktop-plan-face.png) and
  [phone plan face](phone-plan-face.png): the console clock reads
  `25:00 planned` — the planned duration's one readout; the sheet repeats
  it nowhere. The ready row reads `Ready · Piano` over `0 goals tracked`.
  The habit chip row: Piano pressed in the state grammar (ink outline +
  firm inset marker), Cooking available, `none selected` (the unstructured
  choice's UI word) and `+ Add habit` as dashed add-path chips — create
  and edit live behind it, on the HABIT face. The plan controls are one
  compact cluster: preset chips with 25 pressed (inset marker), the
  custom entry inline (`25 min`), and the Open-ended toggle; the figure
  row and the "Planned practice" section are gone.
- [Desktop tooltip](desktop-plan-tooltip.png): the dead section's one live
  fact rides the controls that arm the target as a one-line tooltip —
  `The chime, notification and tab title fire at the target` — pinned by
  tap (the touch path; the keyboard focus path is wired by the shared
  instrument layer and asserted in `focus.test.ts`).

## Checks

- State without color: pressed chips wear the ink outline and the firm
  inset marker (computed style verified: `inset 0 -2px` ink), distinct
  from the dashed add-path chips and the clear-outline available chips.
- Reduced motion: the reworked surface introduces no animation or glow —
  nothing to reduce; the flow-mode running read is untouched.
- Re-click starts flow: covered by `app.session.test.ts` ("the re-click
  starts flow with what the PLAN face shows") — not a visual check.
