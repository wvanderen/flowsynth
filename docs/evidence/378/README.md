# Evidence: draft composition and the Draft Loom (#378)

## Review-corrections pass

The review pass reshaped the row: the buy control's accessible name is
now `Improve the Draft Loom · ⟨price⟩ scrap` (the avoided "rung" wording
is gone from player-facing copy), the `memorized` term rides the row
itself as a hoverable term trigger glossing `Persists through arete
reset`, and the ⓘ tooltip carries only the mechanic the surface cannot
show (`Each candidate may mint one merge tier higher`). The capture
session for the corrections broke — the preview automation's snapshot
path failed on every attempt after the viewport resize storms, so no
post-correction screenshot exists and none is claimed. The corrected
row's reads were taken from the live verified page's DOM instead: the
row reads `Draft Loom · tier bonus 0% · memorized · ⓘ · Improve · 50 ⌗`,
the buy control's aria-label quotes the price, and both disclosure
triggers open from keyboard focus (`aria-expanded` true on each, Escape
dismissal dispatched). The captures below predate the corrections: the
row they show lacks the term chip and carries the older accessible name;
their layout, readout grammar, and purchase interaction are unchanged
except where this note says otherwise.

The original implementation evidence follows.

Captured from the verified checkout (`t3code/fix-issue-378`, worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-bf797c68`, commit
`6fe1b22`), served by the worktree's own dev server; the provenance
endpoint confirmed that worktree and commit against `git rev-parse`
before the captures. The board was seeded through a v10 save in the
served origin's localStorage: the opening Sine at C4 (level 1), a
`scrap` balance of 60, and one banked module roll carrying a common
Sine, a common Spacer, and an uncommon Chorus — the smallest state that
exercises the changed surface. The seed was written with the page's
`beforeunload` autosave silenced, since that handler otherwise re-saves
the pre-seed state over the file during the reload.

## Desktop captures

- **forge-loom-desktop.png** — the Forge's Modules face with the loom
  row beneath the candidates: `DRAFT LOOM · tier bonus 0% · ⓘ · Improve
  · 50 ⌗`, a hairline above it separating the purchase from the drafts,
  the meters below. The board ledger's resource group reads the one
  scrap balance (`60 ⌗`); the row quotes the price, never a second
  balance. The Skip control keeps its `+15` payout beside the choose
  cue (ADR-0066, unchanged).
- **forge-loom-bought-desktop.png** — after pressing the row's buy
  control: the ledger read moved 60 → 10 ⌗, the row's state line reads
  `tier bonus 15%`, and the button re-quotes the next rung
  (`Improve · 150 ⌗`) muted under the state grammar — 10 scrap cannot
  pay it. The purchase path and the re-quote ran on the live page.
- **forge-loom-focus-desktop.png** — the row at rest with the ⓘ trigger
  focused (the opened body had already dismissed in the capture pass;
  see the disclosure note below).

## Checks run against the verified server

- **Keyboard disclosure**: programmatic focus on the row's ⓘ trigger
  opened the tooltip — `aria-expanded` flipped to `true` and the body
  read `Each candidate may mint one merge tier higher · memorized`
  (pre-corrections copy; the corrections moved the term onto the row and
  re-verified the same reads on the live page, both triggers opening
  from focus). The trigger is a native button in the Tab order; the
  opened-state screenshot did not land (the body had dismissed by
  capture time), so the DOM read stands as the record, not a frame.
- **Purchase interaction**: the desktop pass above clicked the real
  control — the balance moved, the state line and price re-quoted, and
  the muted next price refused nothing (it was simply unaffordable).
- **Non-color state**: cost, chance, and price ride figures (`tier
  bonus 15%`, `Improve · 150 ⌗`); unavailable reads as the muted
  outline per the state grammar, tuned as the word `Tuned` (fixture-
  asserted), never hue alone. No animation or glow was added, so
  reduced motion has nothing to honor on this surface (not applicable).
- **Touch input**: unavailable in the capture path
  (`navigator.maxTouchPoints` is zero); the row is plain activation
  controls, and the touch target is pinned by the stylesheet read in
  `src/ui/app.draft.test.ts`.

## Phone captures

- **Unavailable.** The preview automation's viewport resize timed out
  on every attempt this session (preset and freeform paths, with the
  `preview_status` revive between), so no phone screenshot was captured
  and none is claimed. The phone rendering is covered in code by the
  automated UI regressions: `src/ui/app.draft.test.ts` drives the
  modal at 390px (row present, name and chance read, buy enabled and
  spending the canonical balance, 44px touch floor pinned in the
  stylesheet).

## Engine verification

The observable transitions live in the engine suites, not screenshots:
`src/engine/draft.test.ts` verifies the category-weighted boundary and
its independence from roster size (the Afterglow promotion probe),
distinct-candidate offers, the exact rng spend per offer, the tier
lift with its cap clamp, take-and-scrap versus skip equivalence on a
tiered candidate, purchase refusals (unaffordable, tuned, flow) with
the balance untouched, and prestige/save persistence with the
lenient-default clamp. `src/engine/rolls.test.ts` and
`src/engine/scrap.test.ts` carry the updated controlled-randomness
streams, and the capacity calibration re-records seed 42's era-1
figure (660 → 540 minutes) for the composition change.
