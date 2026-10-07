# #273 — Mode directs Add, retrieval, door, and phone

Captured at this worktree's dev server (`npm run dev`, port 5175). Provenance
verified from the capture tab via `/-/dev/provenance` before staging:
worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-9243d257`, branch
`t3code/9243d257`, merge base `9957103` plus this ticket's working tree (the
server serves the working tree). Dev-scenario state was staged through the
`?dev=1` handle and hard-reset after the captures.

## What the captures show

- **desktop-pre-entry-locked-tab.png** — pre-entry upgrade mode: the board
  tabs stand with the Mutators face locked-but-visible — the muted outline
  plus the lock mark (`🔒 MUTATORS`); the mode rests on Modules.
- **desktop-entry-screen-from-locked-tab.png** — one click on the locked
  MUTATORS tab, pre-prestige: the Catalog opens directly on the ◇ entry
  screen (`Unlock Mutator Layer · 1 Arete`) as the preview of the future
  entry — the entry's price mutes (the button stands disabled; Arete cannot
  exist before the first reset, and the ledger's arete read shows the dim
  `— ◇` slot). The mode never flipped (asserted live: `ui.mutLayer` stayed
  `modules`).
- **desktop-mode-cancel.png** — mutator mode after a mode change that
  cancelled an armed cell purchase: the toast rode the status read
  (`Mode changed — cell purchase cancelled.`, asserted live), the cell arm is
  gone, and the Mutators face stands. The toast surface is the `sr-only`
  status read (the app's one toast channel), so the pixels show the mode,
  not the words.
- **desktop-door-arete-in-mutator-mode.png** — the Catalog door, pressed in
  mutator mode: it opened on the mode's ◇ face (Upgrades/Unlocks revealed) —
  mode wins over the last-face memory (asserted live: a staged `nous` memory
  did not survive the open).
- **sheet-locked-switch-entry.png** — the tray sheet's Modules/Mutators
  switch with the entry unowned: the Mutators segment wears the same muted
  outline + ◇, and its click lands on the ◇ entry screen with the mode
  unchanged (asserted live). **Disclosed constraint**: the viewport resize
  timed out at every size this session, so this capture shows the sheet's
  markup at desktop width (centered modal, not the portrait-phone bottom
  sheet). The phone composition itself is covered by the automated suite.

## Live-asserted behaviors (this server, this working tree)

- Mode-wins door: mutator mode → arete face; module mode → nous face even
  with a staged arete memory.
- Locked walk previews the entry screen at every progression state,
  pre-prestige included, with the entry's price muted; the door's own
  landing keeps the mode-wins rule.
- Mode change cancels armed actions with a toast: cell arm, mutator tray
  placement, module placement, slot unlock; a clean switch stays silent.
- Thumb-bar Add with the tray sheet open: the sheet is put away (modal
  closed) and the slot unlock arms on the visible board.
- Retrieval stays mode-bound: right-click on a placed mutator in mutator
  mode retrieves it; the mode never flips; the presence outline takes no
  pointers (`pointer-events: none` in the stylesheet).

## Automated checks

- `npm run check`: passed.
- `npm test`: 50 files, 1,090 tests passed. This machine needs
  `NODE_OPTIONS=--max-old-space-size=8192` for the full suite (the giant
  `src/ui/app.test.ts` OOMs at the default heap on the clean tree too);
  without it, full-file runs flake on moving tests that pass in isolation —
  reproduced on the clean tree before this ticket's diff.
- New/updated pins: the locked-but-visible tab pair and its entry-screen
  landing (board tab, sheet switch, defensive Add), the mode-wins door
  (superseding the last-face memory), and the mode-change cancel toast with
  the unchanged Esc walk (`app.test.ts`, `mutators.test.ts`).

## Unavailable checks

- **Phone-viewport capture (~390px)**: the preview resize timed out at
  every size (390×844 freeform, 546×877 freeform, iPhone XR preset — both a
  fresh and the existing tab), so no phone-width screenshot was captured.
  The phone surfaces (five-segment thumb bar, sheet toggle flipping the
  global mode, arming closing the sheet, the sheet's locked face) are
  pinned by the automated suite instead; the sheet markup itself was
  exercised live and captured at desktop width with disclosure above.
- **Reduced-motion emulation**: unavailable; the muted locked tab and the
  entry screen carry no animation, source-verified.
- **True touch input**: unavailable; the sheet-switch and thumb-bar paths
  were driven through programmatic clicks on the real bindings.
