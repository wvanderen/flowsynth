# Compact class summary and Develop — issue #446 evidence

Captured 2026-10-21 from the verified checkout (worktree `t3-725246a3`, branch `t3/issue-446`, commit `52745af` — the `/-/dev/provenance` endpoint matched `git rev-parse HEAD` at capture time, with the working tree clean; server `npm run dev`). The dev-localStorage save carried two Piano habits: one drilled to Engineer level 3 (one spent rank, meter part-filled, credited sessions banked through the app's own flow switch and report controls), one left fresh — the fresh-pair edge state.

## Desktop (1280×800)

- **desktop-habit-detail-summary.png** — the drilled habit's development read: lifetime/sessions/last-practiced, color, goal section, then the compact class summary — `Engineer · Level 3 · 1 tree point free`, `Next level — 13h 51m of practice to level 4`, and `NEXT MODULE ROLL` with its track and `8:22 / 30:00 — next roll in ~21:37 of practice` line — with the one DEVELOP action beneath. No tree, build, or duplicated figures on this surface.
- **desktop-develop-tree.png** — the Develop view the action opens: `← SUMMARY` back, the TREE rows (Governor fully ranked, Reed half-ranked with its allocate button, Punch card locked naming `unlocks at class level 5`), `1 spent · respec is free`, and the respec/preset row. No level, point, XP, or roll figures stand anywhere in the view — the summary owns the advancement read.
- **desktop-tooltip-keyboard.png** — the Develop view with the Reed term trigger opened by keyboard focus (not hover), its gloss floating in the plain tooltip layer.
- **desktop-flow-live-read.png** — the running session's HABIT face: active habit with the locked-selection note, the live session clock, and the same compact summary live beneath — countdown and meter moving with credited practice, no Develop action, no class controls.

## Phone (390×844, `window.innerWidth` 390 confirmed)

- **phone-flow-live-read.png** — the running session's active read at phone width: same hierarchy, single column, the meter line wrapping within its lane; the thumb bar's board actions stand locked behind the session.
- **phone-habit-detail-fresh.png** — the fresh pair's edge state: `Level 0 · 0 tree points free`, `2h of practice to level 1` (the opening fill), meter at `0:00 / 3:00`.
- **phone-habit-detail-summary.png** — the developed habit's detail: SELECTED head mark, the stats, color, goal, and the compact summary with DEVELOP.
- **phone-develop-tree.png** — the Develop view at phone width: full-width tree rows, touch-sized allocate buttons, the locked rung named in text, respec and presets as square controls.

## Verified against the instrument standards

- Keyboard: the DEVELOP and `← SUMMARY` controls are buttons reachable by Tab; the term triggers disclose on `focusin` (captured in desktop-tooltip-keyboard.png) with `aria-expanded` reporting the open state, and Escape/focus-out dismisses. The summary's `Next module roll` trigger opens the gloss `Practice-earned, separate from class XP and board charge` — the XP/roll distinction in the tooltip layer.
- Touch: the DEVELOP journey was driven by pointer taps at 390px; tree allocate buttons keep the 44px touch lane; no horizontal overflow at any captured width.
- Live updates: with the sheet held open during a running session, the countdown and meter line stepped in place while the same DOM nodes persisted (in-place patches, no structural rerender); a level threshold crossing rebuilds the summary with the new level and re-based track. Covered in tests by the same-node assertions in `src/ui/focus.test.ts`.
- Non-color state: selection wears the state grammar's marks (SELECTED word, firm inset markers), ranks read as `+1/2` figures with the equipped border, the locked rung is the muted `·` mark with its level named in text, and completion's check stays on the header — no state is color-only.
- Reduced motion: **unavailable as an emulated check** — the host exposes no `prefers-reduced-motion` emulation surface. The diff adds no animation or transition: the changed surfaces are static rows, and the meter fill is an instant width write (no transition rule on `.class-meter-track i`).
- Unavailable checks: none beyond reduced motion. Both viewports captured, disclosure exercised by keyboard and touch, and the flow lock verified with the sheet open during a running session.
