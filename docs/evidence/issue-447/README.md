# Session preparation composition — issue #447 evidence

Captured 2026-10-21 from the verified checkout (worktree `t3-ecb137bf`, branch `t3/issue-447-implementation`; the `/-/dev/provenance` endpoint matched `git rev-parse HEAD` at capture time with a clean tree; server `npm run dev`). Desktop shots were captured at commit `d0b92af` (the composition commit), phone shots at `e2bc156` (the review-fix commit); the commits between them change no rendered markup — a private drill extraction, an option rename, and an unreachable-state precedence alignment — so both sets depict the final checkout's output, re-verified by the unchanged selectors the later phone pass drove. The dev-localStorage save carried two habits: Piano drilled to Engineer level 3 (one spent rank, partial roll meter, a daily 60-minute goal at 23:39 with one completion banked, one recorded session) and Sketching left fresh; the goal was raised 20 → 60 minutes through the editor, retaining its progress.

## Desktop (1280×800)

- **desktop-preparation.png** — the sheet the clock door opens: `FOCUS READY`, the PLAN tab standing, `PIANO — 1 goal tracked` as the ready read, the habit chips (Piano wearing the firm inset marker, Sketching, dashed `none selected` and `+ Add habit`), the duration row, then the selected habit's context — `GOAL — 60 min a day · 20 min / 1 h 0 min · ×1 completed · 40:00 to go`, the compact summary (`Engineer · Level 3 · 1 tree point free`, `Next level — 28h of practice to level 4`, the `NEXT MODULE ROLL` track with its `7:00 / 30:00` line), and `EDIT HABIT · DEVELOP` closing the hierarchy. Session actions stay in the console header beside the sheet.
- **desktop-unstructured.png** — `none selected`: the ready read drops the name, the whole habit context disappears, and the chips and duration carry preparation alone; the header reads `none selected`.
- **desktop-edit-habit.png** — the Edit habit destination: the drilled detail with the SELECTED head mark, rename/archive, lifetime figures, the six-swatch palette, the goal section with its edit and remove controls, the compact summary with its Develop action, and tagged notes beneath.
- **desktop-develop-tree.png** — the Develop destination: `← SUMMARY` back, the TREE rows (Governor at `+0/2`, Reed at `+1/2`, Punch card locked naming `unlocks at class level 5`), `1 spent · respec is free`, and the respec/preset row. No advancement figures repeat in the view.
- **desktop-tooltip-keyboard.png** — the Reed term trigger opened by keyboard focus (not hover), `aria-expanded="true"`, its gloss in the plain tooltip layer.
- **desktop-flow-live-read.png** — the running session's HABIT face: the locked active read with the live summary beneath (the countdown and meter line stepped from `28h`/`7:00` to `27h 58m`/`8:14` while the same DOM nodes stood), no Develop action, no class controls.

## Phone (390×844, `window.innerWidth` 390 confirmed)

- **phone-preparation.png** — the full hierarchy at phone width: chips wrap to two rows, the duration row wraps, and the goal read, summary, and meter hold their lanes; the sheet scrolls to the actions.
- **phone-preparation-actions.png** — the scrolled sheet: `EDIT HABIT · DEVELOP` fully in frame beneath the summary, touch-sized.
- **phone-edit-habit.png** — the editor destination at phone width: SELECTED head, swatches as square 44px controls, the goal row with its edit/remove controls.
- **phone-develop-tree.png** — the Develop view at phone width: full-width tree rows, the locked rung named in text, respec and presets as square controls.
- **phone-flow-live-read.png** — the running session's live read at phone width: countdown and meter line moving in place (`27h 56m` → `27h 55m`, `10:39` → `11:43` across the staged ticks), no Develop, selection locked.

## Verified against the instrument standards

- Keyboard: every staged move was driven through the controls' own events — the clock door, facetabs, chips, Edit habit/Develop actions, the tree's back controls, and the main switch are buttons reachable by Tab; the term trigger discloses on `focusin` with `aria-expanded` reporting state (captured in desktop-tooltip-keyboard.png); Escape tears the sheet down (tested in `src/ui/focus.test.ts`).
- Touch: all preparation controls — habit chips, preset chips, the open-ended toggle, Edit habit, Develop — measure a 44px touch lane at 390px (measured via `getBoundingClientRect` during the pass); the phone staging was driven by pointer events with no horizontal overflow at any captured view.
- Non-color state: the selected chip wears the firm inset marker with the ink outline and `aria-pressed="true"`; the drilled head wears the SELECTED word; goal completion rides the engraved bar and the `complete` word; the locked tree rung is the muted `·` mark naming its level — no state is color-only.
- Live updates: with the sheet held open during running sessions at both widths, the XP countdown and the roll meter's track/line stepped in place while the same nodes persisted; the goal figures and the header's seven-segment meter moved with them.
- Reduced motion: **unavailable as an emulated check** — the host exposes no `prefers-reduced-motion` emulation surface. The diff adds no animation or transition: the changed CSS is layout-only (margins, flex alignment), the meter fill and goal bar are instant style writes, and the meter's track carries no transition rule.
- Unavailable checks: none beyond reduced motion. Both viewports captured from the same verified server, keyboard and touch exercised, and the flow lock verified with the sheet open during running sessions at both widths.
