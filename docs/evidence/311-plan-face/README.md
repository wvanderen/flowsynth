# PLAN face rework: one readout, compact controls, re-click starts flow

Source: issue #311 plus the header-authority pass on top of it, working tree
on `t3code/flowsynth-issue-implementation` (diff against
`479a83ac78e8c7c1ae2f3a39fc93cff5e76f0afd`, commit `697cabb` and after).
Launched this checkout with `npm run dev`; the provenance endpoint
(`/-/dev/provenance`) returned this worktree and commit before any capture.
Desktop captures are a 1280×800 headless-Chrome viewport of that server
(deviceScaleFactor 2); the phone capture is 390×844 (mobile emulation) of
the same server. The preview panel's own snapshot client could not run this
session — recorded unavailable — so captures came from headless Chrome over
CDP against the identical verified URL.

Dev fixtures set the scene (`window.__flowsynth`): habits Piano (selected)
and Cooking, a 25-minute plan armed, the sheet standing on PLAN.

## The reworked face

- [Desktop plan face](desktop-plan-face.png) and
  [phone plan face](phone-plan-face.png): the console clock reads
  `25:00 planned` — the planned duration's one readout; the sheet repeats
  it nowhere. The head's state read (`READY`) stands prominent beside the
  FOCUS name — the panel's own mode word, answering the clock and main
  switch. The plan read rows: the selected habit (`PIANO`) over
  `0 goals tracked`. The habit chip row: Piano pressed in the state
  grammar (ink outline + firm inset marker), Cooking available,
  `none selected` (the unstructured choice's UI word) and `+ Add habit`
  as dashed add-path chips — create and edit live behind it, on the HABIT
  face. The plan controls are one compact cluster: preset chips with 25
  pressed (inset marker), the custom entry inline (`25 min`), and the
  Open-ended toggle. The sheet adds no start control — the console
  header's main switch enters flow (its re-click commits the standing
  face) — and the chime fact is narrated nowhere: the "Planned practice"
  section and its tooltip are both gone, as are the figure row and any
  sheet clock.
- [Desktop plan face in flow](desktop-plan-flow.png): the head reads
  `RUNNING`, and the face is the plan read alone — the selected habit and
  the goals tracked. No selection UI, no time selection, no End flow
  control: the console header owns the clock, Pause, and Exit flow.

## Checks

- State without color: pressed chips wear the ink outline and the firm
  inset marker (computed style verified: `inset 0 -2px` ink), distinct
  from the dashed add-path chips and the clear-outline available chips.
- Reduced motion: the reworked surface introduces no animation or glow —
  nothing to reduce.
- Re-click starts flow, and the flow PLAN face's emptiness of duplicated
  controls: covered in `app.session.test.ts` and `focus.test.ts` — not
  visual checks.
