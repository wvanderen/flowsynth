# Instrument refit release verification sweep — #281

Reviewed 2026-10-12 against `docs/instrument-refit-spec.md` (the
acceptance-criteria section), `docs/instrument-standards.md` as amended
(the #317 handoff checklist in the issue body), the pinned catalog
prototype at `eb232c4`, and controls variant A at `d405ce2`. All
blockers #268–#280 are closed, as are #317 and #326. Fixed point:
task-start HEAD `cb734fe190fde18b33a9bed4318695f9ae44150e`; the working
diff this sweep adds is tooltip-economy copy trims (below), two test
assertions that pinned the removed copy, and this evidence directory.
No behavior, layout, or control-geometry change was introduced.

## Provenance and fixtures

Served this checkout with `npm run dev` at localhost:5176/?dev. The
browser's `/-/dev/provenance` returned worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-77163442`, branch
`t3code/77163442`, HEAD `cb734fe190fde18b33a9bed4318695f9ae44150e`,
matching `git rev-parse` in this checkout. Checked before the capture
sequence and rechecked after; captures show that HEAD plus the sweep's
working diff. The review pass's post-capture edits (removing two
Collection titles, the locked-node title, and reshaping the slot
refusal's gloss) changed hover-only copy — no visible layout changed. Preview measured 1402×877 CSS pixels; the screenshot
pipeline emits 1280×800.

Dev fixtures via the live `window.__flowsynth` instance: 20 Arete,
entry owned, first prestige banked, 40k nous, two unplaced modules and
a placed mutator for the tray faces, `mutator-entry` and
`first-prestige` stamped in the achievements ledger. The pre-entry and
pre-prestige checks ran against temporary state (entry not owned;
`prestiges: 0`) and were reverted. No fixture or debug behavior was
added to production.

## Release-boundary results

- **Save gate intact.** `SAVE_VERSION` is 8
  (`src/engine/constants.ts:443`). `deserialize` rejects every version
  older than v7 with the start-fresh message and migrates v7 in place;
  both behaviors are pinned by `src/engine/save.test.ts` ("rejects v6
  and every older version", the v7→v8 migration describe block). Full
  save suite green.
- **No persisted key added, removed, or reinterpreted.** The refit's
  new surfaces live in `UiState` (`src/ui/app.ts:185`), which
  `SaveFile` never carries — `confirmEntry`, `catalogFace` (mode wins
  at open; the door's last-face memory is gone), `mutLayer`, the armed
  actions (`buyingCell`, `mutArmedTray`, `mutUnlockArmed`, the entry
  sequence's pending automation), the Focus form/palette/notes-face
  furniture. `trayCollapsed`, `activatedApps` and a door-face memory
  have no code tenant at all; `save.ts` still drops the three retired
  legacy fields (`pendingGap`, `activatedApps`, `chargeWindow`) on
  load.
- **The Arete Accelerator ships inert**
  (`src/ui/render.ts` `catalogAreteFaceHtml`): the row renders
  "(placeholder)" with a disabled, unaffordable price; no purchase
  path exists. Verified live: `disabled: true`.

## Global criteria — amended checklist results

| Check | Result | Evidence |
| --- | --- | --- |
| Tooltip economy | Pass after drift fixes (below) | Full `title=` inventory (29 call sites) and every styled gloss adjudicated; static glosses measure 27–48 chars |
| Naming register | Pass | Catalog products carry studio-hardware names with one effect line and hoverable terms (`CATALOG_TERMS`, `CAPACITY_PRODUCTS`); no mechanics-word leads a name; #326 reverification below |
| `_Avoid:` entries | Pass | CONTEXT.md carries `_Avoid_` for Poly Expander (l.48), Expansion Bays (l.52), Chord Catalysts (l.56), Channel Strips (l.287), Headroom (l.449 region), Mutator Forge, and the rest of the named register |
| Co-list order | Pass | `layerLegendHtml` renders Mutators first (mutators.ts:187, "Mutators lead the pair"); #314's live board/inventory checks stand; catalog faces order ν nous first (live: switch reads `ν nous / Arete`) |
| One-place rules | Pass | #311's "console clock is the only planned-duration readout" test green; live GOALS face showed slots read, vertical `gbar` fills with the `.done` engraved mark, and recolor dots only on GOALS; one price per product (live per-row count) |
| New surfaces vs pinned sheets | Pass | Live comparisons below; square-cut controls, inset selected underline, plain tooltip layer, open ruled divisions |
| Visual evidence | Desktop captured; phone unavailable (below) | `desktop-board.png`, `desktop-catalog-arete.png`, `desktop-feats.png` |
| Keyboard/touch, non-color, reduced motion | Partially unavailable (below) | Escape dismissal live; suites cover the rest |

## Tooltip economy — drift found and fixed here
The sweep adjudicated every native `title=` in the ui sources — all 29
`title=`-bearing lines outside tests and prototypes, static and
dynamic — and every styled tooltip body encountered. The failure shape
is #317's precedent: a tooltip
that restates visible content. Fixed in this diff by deleting the
restated copy (never relocating it):

- Console clock (both modes): `"Plan — opens the Focus sheet"` /
  `"Session time — opens the Focus sheet"` → `"Opens the Focus sheet"`
  (the caption already names the clock's content).
- Main switch: `"Enter flow — …"` / `"Exit flow — …"` → the mechanic
  only (`"The board locks and runs itself"` /
  `"Ends the session and banks its production"`).
- Collection rows: removed both titles (`Feats — …` /
  `Chord library — …` and their mechanic halves restated the visible
  label and count).
- Habit list row and `+ Add habit`: removed (`Open ${name}` restated
  the row's own name; `Create or edit habits` restated Add).
- Build nodes: `Equip/Unequip ${name} — respec is free` →
  `"Build changes are free"`; the no-slot refusal →
  `"Unequip one to free a slot"` (the slots read is visible); the
  locked node's title removed (its small text already reads the same
  unlock figure).
- Channel Strips buy button: removed both titles — the flow-mode
  string restated the row's visible "between sessions" note and the
  upgrade-mode string restated the muted price (#317 removed catalog
  affordability titles for the same reason).
- Hex detail: Return and Cancel titles removed (labels carry them);
  tray/Add titles trimmed to the placement mechanic; the adjacency
  refusal trimmed to `"Each new slot neighbors an unlocked one"`;
  Catalog-entry rail title removed.
- Rate-details pick: `"${name} — show it on the board"` →
  `"Show it on the board"`. Prestige door → `"Begins the next era"`
  (the banking is the visible claim figure). The hex detail's styled
  unlock refusal lost its clause-joining dash+semicolon:
  `Not enough Arete · needs X ◇, have Y ◇`.

Judged pass, recorded: the arete telegraph's `"Unlocks at first Arete
Reset"` (the spec-required lock lesson), the sweep chips' projection
titles (legacy #195 surface; hidden cost projections over the working
ceiling, noted, not trimmed), glyph-only tiles whose titles carry the
whole hidden identity (inventory, tray, forge candidates — ~78 chars
worst case), icon-only legend buttons whose titles are their
accessible descriptions, and the feats sheet's framing lines (they
carry the never-gate mechanic and the bonus's landing in the rate
details, which no row shows). The styled layer: every static gloss
measures 27–48 characters against the ~60 ceiling; live computed style
of an open term body: `border: 0px`, `box-shadow: none`, panel
surface, and Escape dismissed it while focus stayed on the trigger.

## Per-contract assertions — evidence

Automated layer: full suite green after the sweep's edits (counts in
Validation). Live layer (this checkout, provenance above):

- **Standards**: live catalog/feats/chord sheets show clipped panels,
  hairline-rule rows, square-cut buttons, no rounded cards or nested
  boxes; un-crossed milestones read muted (`rgb(153,161,194)` at 0.8)
  with the `+2% ν` effect at full accent; glow/motion audit of
  `style.css`: every animation is charge or live activity, the
  reduce block kills all with the documented charge-flow exception,
  and the chord pip survives as a static dot.
- **Feats**: live sheet — Milestones group first; all five rows in the
  spec's exact `Name · unlock · +2% ν` shape; 23 unique icons, zero
  duplicates; crossed rows carry the engraved mark; gate ⓘ tooltips on
  un-crossed rows; head reads `2 of 23 feats.` after direct ledger
  stamps with no toast and no summary row (the eager resume sync is
  pinned by the achievements suite).
- **Ledger/catalog**: resources group left (`40,000 ν · 0.11 ν/s · 20
  ◇`), hairline, feats/chords chips right; the arete mark measures
  15px; the pre-prestige slot renders the dim `—` telegraph titled
  `"Unlocks at first Arete Reset"` (checked at `prestiges: 0`); the
  dock reads Catalog / Forge / Add; tab switch did not resize the
  620×600 frame (live before/after rect equal); the entry lock screen
  covers the arete face pre-purchase (`Unlock Mutator Layer · 1
  Arete` as the single centered offer); the ACQUIRED rewards line,
  one-price-per-product, and the inert Accelerator verified live.
- **Mode/trays**: legend order `[Mutators, Modules]`; legend flip
  moved `ui.mutLayer`; Add in mutator mode armed the slot unlock with
  the `free` pill; flipping the mode cancelled the arm with the toast
  `"Mode changed — slot unlock cancelled."`; pre-entry, the locked
  Mutators control opened the Catalog on the ◇ entry screen while the
  mode stayed modules, and the door then opened on the mode's face
  (nous).
- **Chord sheet**: header `Chords (1/11) (+1% ν)`; discovered-first
  index with dash-named locked rows; undiscovered glyphs solid
  (`panel-deep` fill) and hueless; stage shows glyph, name, `×1.3`
  with the local-semantics tooltip; `0 active` counts standing
  instances; `1/12 roots` rides the inline tooltip figure.
- **Console**: PLAN/HABIT/GOALS/HISTORY faces with the ready readout;
  flow started instantly from the switch path (`startFlow` — the
  switch's own listener calls it, render.ts:267) with the live banner
  and a ticking clock at `chosenTarget: null` (open-ended, no new
  key); exit returned to upgrade. Habit/goal flow locks, phone bare
  launchers, five-segment thumb bar, and the drag handle are pinned by
  the focus/app.phone/mutators suites (green).

## #326 reverification (naming conformance)

The goal-slot product is the **Channel Strips** (focus.ts): proper
name in the register, one effect line (`+1 goal slot`), the hoverable
term with the gloss `Successive purchases reveal steeper prices`
(42 chars — PR #328's disclosure), and CONTEXT.md's
`_Avoid_: One more goal slot, goal slot purchase, extra slot, slot
expander`. No mechanics-word name remains on the surface. Naming
conformance is complete.

## Disclosure and state checks

Live click on the Expansion Bays term opened the plain body (computed
`border: 0px`, `shadow: none`); Escape removed `.inst-show` with focus
retained on the trigger. Pointer clicks verify the pin path, not
physical touch. Programmatic focus did not visibly open a body in the
preview (same observation as #317); the shared instrument suite covers
focus opening, Escape, and tap-away, and it is green. Non-color state
was judged structurally against controls variant A: inset selected
underline on tabs and swatches, engraved words/marks for acquired and
completed, muted+disabled for unavailable, height fills for bars. No
grayscale rendering pass was performed.

## Unavailable checks

All of #317's unavailable checks were retried this sweep; each remains
unavailable in this environment and none is claimed as verified:

- **True phone composition**: freeform 390×844, the iphone-12-pro
  preset, a smaller 500×800 freeform, and a second tab all timed out;
  status kept reporting the desktop viewport (1402×877). Agent device
  access is disabled, so no simulator substitute exists. The phone
  contracts (five-segment thumb bar, Collection launcher, strip
  resources-only, bare banner launchers) rest on the app.phone suite
  and source audit (`render.ts` `collection-row`, thumb-bar segments,
  ADR-0050's nav row), not on a fresh visual pass. The prior waves'
  phone captures (e.g. #316's `phone-board.png`) are historical
  references.
- Physical touch input, native OS title painting, keyboard focus-only
  tooltip rendering, live focus-visible ring inspection.
- Reduced-motion rendering: no emulation in the preview tools; the
  source audit above and the instrument suite stand in. Bar
  transitions under the preference were not visually observed.
- Grayscale rendering and exhausted-state browser compositions:
  suite-covered branches, not fresh visual passes.

## Validation

`npm install` before checks. `npm run check` passed. Full suite after
the sweep's copy and test edits: 61 files, 1273 passed, 2 skipped.
`npx vitest run --project ui`: 24 files, 657 passed. `git diff
--check` clean. The stale `tools/ui/check-rendering.ts` browser helper
references removed fixture exports and cannot run; it is dev-only
console tooling, outside the suite, and was left untouched.
