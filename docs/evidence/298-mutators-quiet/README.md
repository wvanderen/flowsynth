# The quiet Mutators grid — review evidence

Source: issue #298 (captures begin on this branch's working tree on top
of commit `81dee00490e41150c4703b95d57a75f0e6acf71d` and finish on top
of `afd561167335feab0d69fd679d8f036e46620a2d` — the quiet-layer work
plus its follow-up fix hiding a covered cell's empty chassis and note
beneath the slot face, so nothing ghosts through the face's own words).
Launched this checkout with `npm run dev`;
the provenance endpoint's `worktree` and `commit` matched `git rev-parse`
in this checkout before every capture (checked again from the tab itself
via `fetch("/-/dev/provenance")`). States were staged through the app's
own save path: a mutator-era save built with the engine's own
constructors, written to `localStorage` under the app's storage key, and
loaded by the production boot (9 cells, 4 modules, 4 slots, a tray twin;
one vacant slot and one hostless-slot case among them).

## The change

While the Mutators layer stands, the module board no longer rests greyed
beneath — it is gone: module faces, chord marks, and charge leads never
draw (`display: none`, so the module cell-nodes also leave the keyboard
tab order), and the owned lattice's quiet dashed cells stay pointer-dead
under the slot faces. The slot faces stop speaking the host line: the
overview shows the mutator alone (family, glyph, rarity ticks, effect)
plus its own inert verdicts; the accessible name and the reserved
readout's hover ask keep the host, and the Hex detail supplies the
relationship (the stack itself plus the mutator wave's authoritative
breakdown). Two defects on the same surface fell out of the review and
are fixed in the same diff: the unlocked Mutators legend symbol's
accessible name no longer claims "locked" (issue #298), and the unlock
pulse now keeps a reduced-motion guard (static dashed target, `animation:
none` under `prefers-reduced-motion: reduce`).

## Desktop (1402×877 viewport, screenshot pipeline crops to 1280)

- [Quiet Mutators layer](desktop-mutators-layer.png): the slot faces in
  the arete register — POWER/RESONANCE/CHARGE with glyphs, ticks, and
  effect shorts; the vacant slot dashed with "OPEN SLOT · inert · no
  host" — over the quiet dashed lattice. No module faces, no chord
  marks, no charge leads. The empty cells' notes stay as orientation.
- [Modules layer unchanged](desktop-modules-layer.png): the same board
  one symbol away — module faces, the Fifth's seam brackets between C4
  and G4, charge leads, and the hosted mutators' thin arete presence
  outlines. Layer switching moved the legend's firm inset marker and the
  tray's face with it.
- [Unlock armed](desktop-unlock-armed.png): Add on the Mutators layer
  arms the unlock — the pill ("Unlock Mutator slot · 8 Arete · Cancel ·
  Esc") over five pulsing eligible cells. Escape dismissed it live
  (pill hidden, pulses cleared, verified in the same session); the
  pill's Cancel click is bound to the same landing.
- [Slot ask](desktop-slot-ask.png): hovering the Power slot asks the
  full declaration into the reserved readout — "Power · +50% to this
  module's power — hosts Oscillator · C4" — the host information the
  quiet face no longer paints, kept on the explicit ask.
- [Breakdown](desktop-detail-breakdown.png): the slot's Hex detail on
  the Mutators face — the stack itself is the host relationship (the
  module face sits directly below), and the mutator wave's disclosure,
  opened on the keyboard path (the trigger's focus event; real-keyboard
  disclosure is pinned in hexflows.test.ts), reads the authoritative
  rows: "Folded into power 1 → 1.5 · Host power ×1.5 · Chord factor
  ×1.46 … Final output +0.22 ν/s" — host and external-bonus facts with
  no neighboring network drawn, only the three local waves. Escape
  dismissed it and Return restored the grid with the layer and the
  exact zoomed viewBox (`-91.58 -129.64 352.03 241.28` before and
  after, verified live).
- [Detail Add](desktop-detail-add-tray.png): "Add mutator" on a vacant
  slot opens the detail's tray beside the stack; the tile's click placed
  the mutator straight into the slot (save verified), and the orbit
  Retrieve returned it to the tray — the full grid → detail → Add /
  retrieve → return walk exercised live with layer, position, and zoom
  intact.
- [Explicit Combine + cancellation](desktop-detail-breakdown.png session,
  screenshot unavailable): a placed power mutator drag-released onto its
  tray twin opened the drop-and-confirm review ("Combine these two? ·
  Resulting rarity uncommon · Family Power — Mutators carry no levels —
  nothing is retained or refunded"); Cancel landed with both mutators
  unchanged (save verified), the drag was repeated, and Keep-both's
  counterpart Confirm landed the pair as one uncommon power mutator in
  the Mutator tray (save verified). The screenshot client wedged while
  the review stood and did not recover for the rest of the session —
  recorded unavailable rather than claimed; the review's markup and its
  two exits are pinned in mutators.test.ts.
- [Pre-entry Catalog access](screenshot unavailable — same wedge): from
  a pre-entry save the locked legend symbol (padlock mark, accessible
  name "Mutators layer — locked; open Catalog entry") walked to the
  Catalog's ◇ entry screen with the purchase muted
  (`buy-arete-entry` disabled at 0 ◇) — verified live in the session;
  the composition's captures stand in the #295 evidence
  (`desktop-legend-focus-tooltip.png`, `desktop-detail-locked-entry.png`).

## Phone (~390px)

The preview window's resize times out in this environment (recorded by
the #295 and #297 evidence too; both preset and freeform retries timed
out for this pass); `#app` was constrained to 390px so the app's own
container query re-docks the anatomy. The same gated composition drives
what a 390px device renders — except the body-level modal layer, which
stays on `@media` by design and therefore keeps the desktop frame in
these captures (recorded under unavailable checks).

- [Mutators layer](phone-mutators-layer.png): the quiet grid re-docked —
  game-info strip, thumb bar, zoom cluster above the bar, slot faces at
  phone scale, the hostless POWER slot wearing its own "inert · no
  host" verdict.
- [Sheet disclosure](phone-sheet-disclosure.png): the tray sheet's tile
  ⓘ pinned by tap — "Power · common · +50% to this module's power —
  tap, then a slot" — and dismissed by a tap away (both verified live;
  synthesized pointer events, not a physical touch pass).
- [Detail as sheet](phone-detail-sheet.png): the cross-section as the
  bottom sheet — RESONANCE face above, the arete wave pointing at the
  OSC face below (the host relationship), charge and chord waves at the
  sides, the chord row chips, Return at the top-left. Return restored
  the grid live.

## Symbol-only layer navigation (issue #298 evaluation)

The vertical legend is two symbols: the hex chassis (modules) and the
arete mark (mutators) — evaluated for discoverability as shipped:

- **What carries the names today**: a native `title` tooltip per symbol
  ("Modules — the production grid" / "Mutators — the slots over the
  modules"), accessible names (`aria-label`, now state-correct), the
  firm inset marker for the selected face, and pre-entry the padlock
  mark with an ⓘ disclosure (its focus/tap evidence stands in the #295
  capture `desktop-legend-focus-tooltip.png`).
- **Desktop**: discoverable — hovering either symbol names it before
  the first flip, and a flip is cheap and reversible, so exploration is
  safe.
- **Limitation (recorded, accepted for this pass)**: on touch there is
  no hover, and the unlocked symbols carry no inline disclosure — a
  touch player learns the symbols only by flipping (safe and instantly
  reversible, and the tray sheet's faces label themselves by content).
  The locked face's ⓘ pattern is the template if a round ever wants
  inline disclosure on the unlocked symbols too; not built here.

## Non-color state distinctions

- Selected layer: firm inset marker (visible on both legend captures);
  locked layer: muted outline + padlock, never color alone.
- Slot states: solid chassis = occupied, dashed = open/eligible,
  "OPEN SLOT / inert · no host" verdicts in words; unlock targets pulse
  (static under reduced motion), always dashed.
- Wave states in the detail: solid = live relationship, dashed + dim =
  inert (pinned in hexflows.test.ts and shown in the #297 evidence).

## Reduced motion

Unavailable as an emulation in this preview. Source-verified and
served-verified: the unlock pulse's animation rides `@media
(prefers-reduced-motion: reduce) { .mut-pulse { animation: none; } }`
(new in this diff — the pulse previously animated unconditionally),
leaving the static dashed target; the rule's presence in the served
stylesheet was confirmed from the live tab. All other motion on the
surface (the detail's one-time lift, flow-wave pulses) already carried
their guards from #295/#297.

## Automated checks

At capture time: `npm run check` clean; full suite 59 files / 1207 tests
green (mutators.test.ts pins the quiet face, the hostless aria name, and
the stylesheet contract — hidden module cell-nodes, hidden marks and
leads, no greyscale remnant — plus the unlocked legend name);
`npx vitest run --project ui` green (22 files / 590 tests).

## Unavailable checks

- Screenshot captures of the combine review and the pre-entry entry
  screen — the browser snapshot client wedged mid-session (recorded
  above); both walks were verified live through the app's own save, and
  pinned compositions exist in mutators.test.ts and the #295 evidence.
- True phone viewport (resize times out) — the board-level captures use
  the #app container-query fallback; the tray sheet's body-level modal
  keeps its desktop frame in [phone-sheet-disclosure.png] by design
  (viewport media query). The sheet's content, switch, tiles, and
  gestures are the same objects the phone frame hosts (pinned by
  app.phone.test.ts).
- Physical touch input — the tap paths were exercised with synthesized
  pointer events and verified live; not claimed as a physical pass.
- Greyscale rendering pass (no filter emulation) — non-color state is
  structural (inset marker, dash, words) and pinned in the stylesheet.
- Reduced-motion emulation — source- and served-verified as above.
