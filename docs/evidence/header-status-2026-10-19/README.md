# Header status display — evidence, 2026-10-19

Captured from the verified checkout: dev server `http://localhost:5177`, provenance `worktree = /Users/eggfam/.t3/worktrees/flowsynth/t3-9b9987fd`, branch `t3/redesign-focus-header`. Full-viewport captures (1280×800 desktop, 390×844 phone); the changed surface is the console header at the top of each.

Live state was staged through the real UI: habit "Piano" created, a daily 20-minute goal on it, a 20-minute plan run, and a 12-minute manual log between sessions.

## Desktop

- `desktop-upgrade-empty.png` — upgrade mode, no qualifying goal yet: display well with the 36px planned clock (`20:00` / `planned`), PIANO program block, and no meter (the slot closes).
- `desktop-flow-live-hover.png` — flow live: clock counting down, bare-target caption, meter ticking (4 segments lit, vermillion), and the hover gloss `Daily 20 min · 7 min to go` floating plain under the meter — no card, no border.
- `desktop-flow-focus-gloss.png` — the same read opened by keyboard focus (Tab reaches the meter's own stop inside the door): `focused` class, same gloss.
- `desktop-focus-ring.png` — focus-visible ring on the meter (keyboard access state).
- `desktop-paused-hold.png` — paused: caption `paused`, meter frozen mid-fill, session strip held.
- `desktop-upgrade-complete.png` — upgrade after completion: meter fully lit and flush at the well's edge, the engraved check riding the PIANO name, gloss `Daily 20 min · complete`.

## Phone (390×844)

- `phone-flow.png` — the display panel at its tightest: badge, well (clock / caption / PIANO / meter), End switch, doors. The meter rides where the banner never reached.
- `phone-flow-hover.png` — the gloss open over the phone row; the done check sits beside PIANO, the column stays at the edge.
- `phone-upgrade-complete.png` — upgrade mode, complete meter.

## Small-phone pass (the covered-controls fix)

- `phone-320-flow.png` — 320×568, flow live: the full ladder survives the floor — clock, PIANO with its done check, meter flush at the edge, then pause, End, and the doors, nothing covered. Below 380 the badge and chevron yield; below 360 the switch cluster and doors give up their slack. Measured clearances at 320/350/375/390: the well's edge sits 7–30px left of the pause button, meter never over it.

## Access checks run (against the fixed wiring)

- Hover opens the gloss; Escape dismisses it; the meter keeps focus after dismissal.
- Keyboard: Tab from the door reaches the meter; the gloss opens on focus and Escape dismisses without moving focus.
- Tap-away dismisses; the whole door still opens PLAN — the meter opens nothing (no nested controls, asserted by tests).

## Unavailable checks

- **Touch pin** was not exercised by the automation (no touch-pointer emulation in the harness); the tip rides the shared instrument layer whose touch path is pinned by the controls sheet, and the meter adds no trigger of its own. Recorded unavailable, not verified.
- **Reduced motion**: the harness cannot emulate `prefers-reduced-motion`. The meter adds no animation of its own — segment steps, marks, and illumination are static state — so the reduced-motion presentation matches the static captures by construction. Recorded unavailable, not verified.
