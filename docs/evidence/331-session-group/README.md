# Session group: habit, duration, and Start read where the player starts

Source: issue #331, working tree on `t3code/implement-issue-331` (commit
`68dd40df2a7e747fcb584518fe121d0f3b859226`). Launched this checkout with
`npm run dev`; the provenance endpoint (`/-/dev/provenance`) returned this
worktree, branch, and commit before any capture. The preview panel's resize
could not settle against the app's 100 ms tick — recorded unavailable — so
captures came from headless Chrome Canary over CDP against the identical
verified URL: desktop at a 1280×800 viewport (deviceScaleFactor 2), phone at
390×844 with mobile emulation. The save was seeded (habits Piano — selected —
and Cooking) through `Page.addScriptToEvaluateOnNewDocument` before any app
script ran; the 25-minute plan was armed through the app's own clock
disclosure and PLAN chip, then the sheet closed.

## The session group

- [Desktop session group](desktop-session-group.png) and
  [phone session group](phone-session-group.png): habit, duration, and Start
  as one contiguous group at both widths — `Piano` leading, the clock's
  `25:00 planned` beside it, the main switch closing it. The group is one
  structural element (`session-group`, `role="group"` labelled "Session"),
  so the contiguity is not a layout accident. The phone row carries the
  name ADR-0050's phone line used to drop (amended by #331); only the goal
  bars stay docked out below the 600px line. DOM order verified:
  `session-group → banner-reads`, the door a 44px-touch-floor button at
  both widths.
- [Desktop habit door](desktop-habit-door.png) and
  [phone habit door](phone-habit-door.png): activating the habit name opens
  the Focus sheet directly on the HABIT face (head `FOCUS PIANO`, HABIT tab
  pressed) at both widths; the opening click never closes the standing
  sheet, and a re-press never toggles it shut (facetab radio-like rule).
- [Desktop none selected](desktop-none-selected.png) and
  [phone none selected](phone-none-selected.png): the unstructured edge
  state reads the roster's word — `none selected`, muted (computed color
  `rgb(153, 161, 194)` = `--muted`, distinct from a chosen name's ink) —
  without bars or furniture.
- [Phone one-click start](phone-flow.png): with both locks set, the switch's
  single activation began the session — no sheet stood between; the clock
  counts `24:59 of 25:00`, the switch reads Exit flow live, and the habit
  name is now a plain read (`SPAN`), editing locked for the run.

## Checks

- Lock combinations: both locks → one activation (confirmation preference
  notwithstanding); habit-only and time-only → the PLAN face stays the
  confirmation's home with the re-click commit; preference off → instant as
  before. Covered in `app.session.test.ts` ("the session group's one-click
  start").
- Keyboard disclosure: the door was focused and pressed with a real Enter
  key event over CDP — the sheet opened on HABIT (door state dumped in the
  run log). Touch disclosure: the phone door's tap path ran through its
  click handler over CDP; pointer-level tap emulation was not run —
  recorded unavailable.
- State without color: the unstructured read is distinguished by its muted
  ink (not hue), the door by the hairline hover face; the sheet-open state
  rides the established focus-door inset marker.
- Reduced motion: under `prefers-reduced-motion: reduce`, the session
  group's controls compute `animation: none` — the change introduces no
  animation of its own (the switch's live glow and the strip pulse pre-date
  it and respect the same preference).
- The interaction checks (door opens HABIT, one-click start, flow-mode
  inertness, paused read) are asserted in `app.session.test.ts` and
  `app.phone.test.ts` — not visual checks.
