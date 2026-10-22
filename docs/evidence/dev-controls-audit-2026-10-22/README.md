# Dev controls audit evidence — issue #466, 2026-10-22

Captured from the verified checkout: worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3-842f793a`, branch `t3/implement-issue-466`, source commit `35ebf22bf0181063cf711d2d329a6a6ecaf6bc3a`, clean source — see `provenance.json`, written by the capture preflight before the first capture. URL: `http://localhost:5174/?dev=1`.

## Desktop (1280×800)

1. `01-desktop-fresh-dev-panel.png` — a fresh dev boot: the dev panel bottom-left with the grip and all eight controls (`+1m`, `+10m`, `→ target`, `+100ν`, `+synth`, `World era`, `Focus setup`, `board`), upgrade mode.
2. `02-desktop-dev-clock-flow.png` — after `devAdvance(60)` in a 10-minute flow (evaluate read: `elapsed 60`, `creditedSeconds 60`, status live region "Dev clock +60s."): the clock reads 09:00 minus the wall seconds ticking live, header "Flow active", the board locked.
3. `03-desktop-target-jump-overrun.png` — after `devToTarget()` (evaluate read: `elapsed 600`, then `tick()` → `targetSignaled true`, title "done · FlowSynth"): the clock at the plan's end, overrun counting up, "done" caption. Signals fire on the wake-up, not the jump (focus-tool spec §4 contract).
4. `04-desktop-world-era-grant.png` — after `devNous()` then `devWorldEra()` (evaluate read: +100 ν banked into the slot at once, `eraEarned 1.5× entry`, `arete 20`): the World board layer with the deployed Charge Blade and Charge Column, the tray twins in the Workbench panel, ledger reading 174 ν / 20 Arete.
5. `05-desktop-focus-scenario-plan.png` — after `devFocusScenario()` + `devFocusScenarioAssert()` + `showFocusFace("plan")`: the PLAN face over the Piano scenario (60-min goal 25 minutes in, Engineer Lv 3), the panel's own-row note reading `focus ✓ Piano · daily 60m · 25m logged · Engineer Lv 3 · isolated save`.
6. `06-desktop-allocation-board.png` — `devToggleBoard()` + capacity 3: solver line "6 inst · 9 cands · 33 nodes · 0.3 ms · certified" (`certified: true` in the read), capacity row with the inset-underline selection, scenario grid, active instances, per-voice budget and ν/s rows. The Focus sheet stands behind it — the board overlays without disturbing it.

## Phone (390×844, live viewport confirmed by in-page read)

7. `07-phone-allocation-board.png` — the board fits 390 px by construction: six-column grid, 44 px+ capacity/reset/stress controls, instances and voice rows readable.
8. `08-phone-dev-panel-focus-note.png` — the dev panel wraps to two rows with the grip leading, all controls at touch size, and the `focus ✓ …` assertion note wrapped onto its own rows beneath (text, not color, carries the state).
9. `09-phone-grip-keyboard-focus.png` — keyboard disclosure: one Tab lands on `#dev-grip` (evaluate read: `firstStop BUTTON#dev-grip`) and the capture shows its clear rectangular focus ring.
10. `10-phone-panel-dragged.png` — the drag contract under real layout: a pointer gesture on the grip moved the panel 130 px up (642 → 512, evaluate read) and the capture shows it clamped mid-stage, focus ring intact. Gesture driven with synthetic pointer events through the browser's real boxes; a human-finger touch pass was not available (see unavailable checks).

## Behavior reads recorded during the pass (evaluate, not captures)

- **World-era refusal (the repair):** with a timed flow live, `devWorldEra()` refused — mode stayed `flow`, zero weapons, board layer unchanged, live-region message "World era needs upgrade mode — end the running session or breather first."
- **Quick-grant persistence (the repair):** `devNous()` wrote the ordinary slot immediately (stored `totalEarned` rose by 100 in the same tick); a full reload of the tab returned `totalEarned` including the grant, and the Focus scenario was dropped by the reload exactly as ADR-0077 promises — the isolated setup never leaks into the ordinary save.

## Unavailable checks

- **Reduced-motion emulation:** unavailable — the capture harness exposes color-scheme emulation only, no `prefers-reduced-motion` media emulation. The dev panel and board are static panels with no animation or glow of their own (charge glow lives on the board layer beneath, unchanged by this work), so no surface-specific reduced-motion behavior existed to verify.
- **Greyscale pass:** unavailable for the same reason (no media emulation). The surfaces' non-color state evidence is in the captures: the ✓/✗ assertion note is text, capacity and voice selection wear the inset underline marker plus `aria-pressed`, and the focus ring is a hairline rectangle.
- **Human-finger touch pass:** not available in this harness. The drag contract's real evidence is the automated pointer-capture suite (app.board.test.ts "the dev console's drag handle") plus capture 10's synthetic-pointer gesture through real layout boxes.

## Source-state note

Captures 1–10 and the behavior reads were taken at source commit `35ebf22` with the tab reloaded between behavior groups where noted. The Focus scenario capture (5) predates the board captures by minutes on the same install; the assertion was re-run at capture time and read `focus ✓` (`devFocusScenarioNote`).
