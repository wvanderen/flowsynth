# Evidence — issue #372 (session-based production and burst delivery)

Captured from the verified checkout at `http://localhost:5173` (provenance
checked via the dev endpoint before every capture: worktree
`t3code-eb03e114`, branch `t3code/flowsynth-issue-372`, commit `5cb3531d`
— matching `git rev-parse HEAD` in the edited checkout, with a clean tree
at capture time; the commit below it adds only these evidence files).
The browser pass ran in a
Playwright-driven Chrome; the thread's inline preview screenshot transport
was unavailable (its snapshot client failed on every attempt), so the
captures below come from scripted Chrome against the same verified server.
The state was seeded through the dev harness (`?dev=1`): the two temporal
modules granted into the tray/board, the draft rigged to carry both types.

| Capture | What it shows |
| --- | --- |
| `forge-temporal-desktop.png` | The Forge draft with the Afterglow (uncommon) and Pulsewell (uncommon) candidates: effect lines name the niches, grade chips carry the comparable axes, and each temporal type's timing line says the curve directly — "×0.3 open · ×0.8 from 2 min · ×1.25 sustained from 5 min" and "×0.5 steady · ×2.5 burst, 30 s every 2 min". |
| `forge-grades-keyboard-desktop.png` | The Afterglow's BASE A chip keyboard-focused (visible focus ring) with the exact-coefficient disclosure open ("Base production ×1 · strong"); Escape dismissed it afterwards without closing the modal. |
| `hexdetail-glow-grades-desktop.png` | The Hex detail's module face with grade chips and the timing line under the placed Afterglow, beside its chord row. The face reads +0.04 ν/s — the opening factor, because the phase resets with every session and the detail was captured between sessions. The dev panel (dev-mode furniture docked over the detail's lower band) was hidden for this and the phone grades capture so the reviewed line is unoccluded. |
| `hexdetail-glow-flow-sustained-desktop.png` | The same detail read-only in flow at 05:10 (310 s — past the sustained mark): the face reads +0.18 ν/s live, and the focused chord-wave breakdown names "Warm-up ×1.25" as its own row and multiplies out to the pass's Final output (+0.18 ν/s). |
| `hexdetail-glow-flow-reduced-motion-desktop.png` | The same surface with `prefers-reduced-motion: reduce` emulated: the wave draws static and every readout stands. |
| `forge-temporal-phone.png` | The temporal draft at 390×844: both candidates' timing lines fit the tile column. |
| `forge-grades-touch-phone.png` | A tap pins the BASE A chip's disclosure at phone width ("Base production ×1 · strong"); tapping elsewhere dismissed it (asserted in the script). |
| `hexdetail-glow-grades-phone.png` | The detail at phone width: the face, chord row, and grade chips fit; the timing line sits just below the fold of this composition (the desktop capture shows the full stack). |
| `hexdetail-glow-flow-sustained-phone.png` | The phone detail in flow at 05:10: the face reads +0.18 ν/s — the same warmed figure as the desktop pass. The dev panel occludes the chip row in this one capture. |

## Checks performed in the live browser

- Timing is described directly, never graded: the timing line renders as
  plain text beside the chips, takes no letter, and the letter chips stay
  the fixed coefficient grades (Afterglow base A · boost B · chord B ·
  charge B; the Pulsewell carries the timing line alone — generators have
  no grade chips yet).
- Disclosure access: keyboard focus opens the exact-coefficient body and
  Escape dismisses it; a touch tap pins it and tap-away dismisses (both
  asserted programmatically in the capture script and visible in the
  captures).
- Production displays reflect the current temporal effect: the Afterglow's
  face read +0.04 ν/s between sessions (fresh-session opening factor) and
  +0.18 ν/s at 05:10 of flow (sustained), and the breakdown names
  "Warm-up ×1.25" as a row that multiplies out to the pass's final figure.
- Non-color state: the grade letter is the state in visible text and in
  each chip's accessible name; the timing line is plain text needing no
  state distinction.
- Reduced motion: captured with `prefers-reduced-motion: reduce` emulated —
  the wave draws static, the readouts and disclosure stand unchanged.

## Unavailable

- **The inline preview harness's screenshot transport.** Its snapshot
  client failed on every attempt (documented tool failure); the captures
  were taken with a scripted Chrome against the same provenance-verified
  server instead. Programmatic `.focus()` in that browser produces the
  same focusin a real tab produces; the keyboard path is additionally
  pinned by the app-fixture suites (`src/ui/profile.test.ts`,
  `src/ui/forge.test.ts`).
- **Pulsewell board emission capture.** The seeded board had no free cell
  for the Pulsewell, so its burst is evidenced by the draft tile's timing
  line and the engine suites (`src/engine/temporal.test.ts`), not by a
  live charge-lead capture. The charge leads read the same
  `emittedStrength` seam the engine walk spends, so no separate display
  path exists to capture.
