# Issue #352: square-cut the round remnants

The last pills lose their radii — the habit chip, the history chips, and
the console tool's count badge take the state grammar's square-cut chrome.
The remaining circular state lights square too (the main switch's mode
light, the ledger rate hint's ⓘ mark, the chord library's live pip, the
habit dot): the ticket's second criterion leaves no radius in the
stylesheet beyond zero and the two sanctioned marks, and the intent line
names the circular shape as a rejected contrast.

All captures from `http://localhost:5173/` in this worktree, branch
`t3code/issue-352-implementation`, commit `edf67ea` + the change in the
working tree. Provenance verified before capturing: the endpoint returned
this worktree's path and the served commit matched `git rev-parse HEAD`.

- Computed-style probe over the live DOM: `.habit-chip`, `.history-chip`,
  `.tool-badge`, `.switch-state`, `.rate-hint`, `.chord-pip`, and
  `.habit-dot` all measure `border-radius: 0`; hairline borders survive
  where the element kept one (the badge and the pip never carried one).
- [Console, desktop](console-desktop.png): the ledger strip's ⓘ rate hint
  and the main switch's square mode light read as square-cut marks; the
  rate hint keeps its hairline and its hover/focus ink state.
- [Notes CAPTURE, desktop](notes-capture-desktop.png): the live tag chip
  (`· SCALES`) rides the capture row square-cut, hairline and faint
  accent wash kept.
- [Notes LOGGED, desktop](notes-logged-desktop.png): the stream's habit
  chip beside the mono stamp is square-cut.
- [History face, desktop](history-desktop.png): rows render square-cut;
  no chip appears in either staged session — an open-ended session and an
  early-ended planned session derive neither hit nor miss (the row's
  `0 / 10 min` figure carries the miss read instead, per the face's
  design). The chip's shape is pinned by the stylesheet contract and the
  computed-style probe; staging a real `missed` honesty event needs
  tab-away time this automation could not produce honestly.
- [Habit face, desktop](habit-desktop.png): the habit row's activity dot
  is square-cut (8px, 1.5px hairline, accent fill when active).
- Tool count badge: the badge renders only with banked rolls or a stocked
  mutator tray — economy progress this fresh save could not reach — so
  its live render is unavailable; shape verified by the computed-style
  probe and the stylesheet contract test.

## Unavailable

- **Phone viewport**: all three `preview_resize` attempts to 390×844
  timed out after 15s; the resize budget is spent, so the phone pass is
  recorded as unavailable, not verified.
- **Reduced-motion**: no new motion in this change (the pip's pre-existing
  pulse stays behind `prefers-reduced-motion: no-preference`, and the
  reduce block's global animation kill is asserted by the suite).
- **Disclosure**: unchanged by this diff; the ⓘ rings keep their
  hover/focus/touch wiring (#267, #351) untouched.

## Checks

- `npm run check` (tsc) passed.
- `npx vitest run --project ui` passed 742 tests.
- Full suite passed 1,367 tests (2 skipped).
- The instrument-standards detector's new radius sweep resolves the
  stylesheet's advisories to exactly the sanctioned set:
  `["999px", "14px", "14px"]`.
