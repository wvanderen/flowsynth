# Evidence: scrap recovery and draft skipping (#377)

## PR #403 review corrections

The review pass adds a visible `Scrap` action name and separates its
control from the placement tile rather than overlapping the tile. Both
Scrap and Skip now have a 44px minimum height, matching the pinned
controls sheet (`d405ce2`); Scrap also has a 44px minimum width.

Captured with the review changes applied over `87f3b1e`, from
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-15c4e3e8` at
`http://localhost:5173/?dev`. The provenance endpoint confirmed that
worktree and base commit before capture. The development fixture holds a
tray Chorus and a module roll whose best candidate pays 15 scrap.

- `review-board-desktop.png`: visible Scrap label, payout, and separate
  placement target. DOM bounds measured the Scrap control at 48.4 × 44px.
- `review-forge-desktop.png`: Skip retains its visible payout and measured
  90.8 × 44px. Programmatic focus succeeded; keyboard focus-ring and
  activation checks were not repeated in this pass.
- Phone layout and touch input: unavailable. Both 390 × 844 resize
  attempts timed out, including the retry after `preview_status`.
- Non-color identity: action names and numeric payouts remain visible.
  Flow locking retains native disabled state; no motion was added.
- Validation: typecheck, full suite, and UI regressions run for the review
  corrections. No engine behavior changed.

The original implementation evidence below predates these corrections.

Captured from the verified checkout (`t3code/issue-377`, worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-cb8e9048`), served by the
worktree's own dev server; provenance confirmed via `/-/dev/provenance`
(worktree and commit match `git rev-parse` in the editing checkout)
before the captures. The board was seeded through a v10 save in the
served origin's localStorage: the opening Sine at C4 (level 1), a Chorus
and a tier-2 Harmonizer waiting in the tray, a `scrap` balance of 20,
and one banked module roll carrying a common Sine, a common Spacer, and
an uncommon Chorus — the smallest state that exercises every changed
surface. The seed was written with the page's `beforeunload` autosave
silenced, since that handler otherwise re-saves the pre-seed state over
the file during the reload.

Capture note: the preview automation's resize and screenshot paths both
failed session-wide (every viewport change timed out on the freeform and
preset paths, in a fresh tab as well; the snapshot capture then failed on
every retry), so the passes below are limited to what landed before the
breakage and are recorded honestly; nothing is claimed that could not
run.

## Desktop captures

- **board-desktop.png** — the board with the two changed library
  surfaces. The board ledger's resource group reads `40 ν · 0.12 ν/s ·
  — ◇ · 20 ⌗ · 1 ⌗`: the scrap balance sits between the arete read and
  the capacity read, in its own amber register under the chipped-hex
  mark — the balance's one home. The tray column carries the two tiles
  with their scrap chips cornered at each tile's lower edge: `⌗ +15` on
  the uncommon Chorus, `⌗ +10` on the tier-2 Harmonizer (a tier-1 copy
  of a common — the doubled base the valuation schedule promises). The
  figures differ per rarity and tier exactly as ADR-0066's table reads.
- **forge-skip-desktop.png** — the draft carrying the skip control: the
  cue row reads `Choose 1 of 3` with `Skip ⌗ +15` beside it — the offer's
  payout quoting its best candidate (the uncommon Chorus), the same
  figure the tray chip pays for a copy of that type. The control is
  square-cut, hairline-bordered, in the scrap register; the mutators
  face carries no skip (the no-consolation contract stands).

## Phone captures

- **Unavailable.** The preview automation's viewport resize timed out on
  every attempt this session (freeform and preset paths, fresh tab
  included), and the snapshot path broke immediately after, so no phone
  screenshot was captured and none is claimed. The phone rendering of
  the changed surfaces is covered in code by the automated UI
  regressions: `src/ui/app.scrap.test.ts` drives the tray sheet at 390px
  (chips present, tier-doubled figure, flow lock, scrap lands once) and
  `src/ui/app.phone.test.ts` pins the game-info strip's read structure;
  both passed.

## Interaction checks run against the verified server

- **Keyboard**: the skip control took real keyboard focus (`Tab`-order
  native button) and activated from `Enter` alone — the balance moved
  20 → 35 in the ledger read, the toast read `Roll skipped · +15
  scrap.`, and the consumed offer left no skip control (the panel
  showed the emptied queue). The tray chips are native buttons with
  `aria-label` carrying name and payout (`Scrap Chorus · +15 scrap`),
  verified in the DOM; a focused-chip screenshot was not captured (the
  snapshot path broke) — the focus ring is the shared `:focus-visible`
  rule, unchanged.
- **Non-color state**: payouts are carried by figures (`+15`, `+10`)
  and the mark's shape, never hue alone; the chips are square-cut
  hairline controls in the available state, and the flow-locked chip
  mutes per the state grammar (asserted by the fixture test's
  `disabled` read).
- **Touch disclosure**: **unavailable** — no touch input in the capture
  path (`navigator.maxTouchPoints` is zero); the chips are plain
  activation buttons, not disclosures, and the tap path is covered by
  the automated UI regressions. No physical tap check was performed and
  none is claimed.
- **Reduced motion**: not applicable — the change adds no animation or
  glow; the chips, skip control, and ledger read are static, and
  existing surfaces' motion behavior is untouched.
- **Payout equivalence**: verified by the engine suite, not a
  screenshot — `src/engine/scrap.test.ts` asserts skip payout equals
  the take-and-scrap round trip on a controlled draw, merge
  conservation, single consumption, flow locks, and prestige/save
  persistence.
