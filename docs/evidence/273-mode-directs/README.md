# #273 — Mode directs Add, retrieval, door, and phone

Captured at this worktree's dev server (`npm run dev`, port 5175). Provenance
verified from the capture tab via `/-/dev/provenance` before staging:
worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-9243d257`, branch
`t3code/9243d257`, merge base `9957103` plus this ticket's working tree (the
server serves the working tree). Dev-scenario state was staged through the
`?dev=1` handle and hard-reset after the captures.

- **store-arete-tab-open-from-start.png** — the #292 store review's decision
  (ADR-0044 amendment): on a fresh, never-prestiged save the Catalog's
  arete tab stands enabled, and its face is the entry purchase screen —
  `Unlock Mutator Layer · 1 Arete` with the price muted (asserted live:
  buy disabled, tab enabled, ν⇄◇ switching answers both ways). The ledger's
  dim `— ◇` telegraph and the board's row-unlock banners keep their
  first-reset gate; only the tab opened.

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
- The dev era grant ("mutator era" button) grants a coherent era — the
  entry implies the first prestige — so the Catalog's arete tab stands
  enabled under the grant and both face switches answer (asserted live
  after the review fix; pinned by the catalog-door suite).
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


## Review fixes — 2026-10-07

The follow-up fixes replace the locked-tab native title with the shared
instrument disclosure on both board and sheet, and add visible six-second
mode-cancellation feedback alongside the existing live-region announcement.
A repeated cancellation resets the display time; clean switches stay silent.

Captured from `http://localhost:5176/`, with `/-/dev/provenance` verified
in the capture browser: worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-2adb91c4`, branch
`t3code/review-pr-292`, commit `e1b4436` plus the review-fix working tree.

- `desktop-locked-disclosure-review.png`: the locked Modules/Mutators pair
  and its open shared disclosure.
- `desktop-visible-cancel-review.png`: the visible cancellation notice.
- `phone-frame-locked-disclosure-review.png`: the bottom sheet, locked
  face, and open disclosure at 390×844 CSS pixels.
- `phone-frame-entry-review.png`: the locked sheet action opens the entry
  screen while the mode stays Modules.
- `phone-frame-visible-cancel-review.png`: the cancellation notice above
  the five-segment thumb bar at phone width.

**Phone capture method:** native preview resizing still timed out. A local,
same-origin iframe (`.dev/phone-review.html`, development-only and ignored)
ran the actual app from this checkout at `innerWidth=390`, `innerHeight=844`.
The screenshot retains the enclosing desktop canvas and labels the phone
frame explicitly. This verifies the phone CSS composition, including real
media and container queries; native device emulation and true touch input
remain unavailable. The original phone-evidence gap is now supplemented by
these phone-frame captures, rather than treating desktop sheet markup as a
phone pass.

Live assertions verified entry landing without changing mode, five thumb
segments, the notice's visible text and bounds, and disclosure focus-event
opening, Escape dismissal without closing the sheet, and click opening.
Desktop keyboard traversal was also verified using native Tab/Shift-Tab:
trusted focus events observed the tooltip displayed. The preview loses focus
between automation calls, so this was recorded during the focus event rather
than inferred from a later screenshot. True touch gestures remain unavailable.
Automated integration tests cover focus and tap/click bindings, Escape and
tap-away dismissal, and preservation of the entry action.
The new notice and locked controls do not animate; reduced-motion emulation
and greyscale checks remain unavailable.

Checks: `npm run check` passed; `NODE_OPTIONS=--max-old-space-size=8192 npm test`
passed all 50 files and 1,093 tests, including both UI regression files.
The mechanical design detector reported only incumbent styles outside the
changed rules. The new notice preserves the flat panel style, readable ink,
quiet motion, and pointer-dead feedback; the disclosure uses the pinned
prototype's instrument tooltip layer with a 44px touch target.
