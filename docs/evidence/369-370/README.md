# Evidence — issues #369/#370 (waveform profiles, aptitude grades)

Captured from the verified checkout at `http://localhost:5173` (provenance
checked via the dev endpoint before every capture: worktree
`t3code-c3c3688a`, branch `t3code/issue-366-implementation`, commit
`f56ed66` — the served worktree and commit matched `git rev-parse` in the
edited checkout, and the tree was clean at capture time).

| Capture | What it shows |
| --- | --- |
| `forge-grades-tooltip-desktop.png` | The Forge draft with three waveform candidates, each wearing its fixed grade chips; the Sine's BASE A chip pinned open with the exact coefficient ("Base production ×1 — strong"). |
| `hexdetail-grades-desktop.png` | The Hex detail's module face with the grade line under the placed Sine (base A · boost C · chord B · charge B). |
| `board-sine-desktop.png` | The opening board face wearing the SINE nameplate and bare-sine glyph. |

## Checks performed in the live browser (desktop, 1402×877 viewport)

- Grade chips render on Forge candidate tiles and the Hex detail module
  face; non-profile types (Spacer) render no grade line.
- Disclosure access: a tap pins the exact-coefficient tooltip
  (aria-expanded true); tapping elsewhere dismisses it; Escape dismisses
  the tooltip while the Forge modal stays open; the offer is untouched by
  any disclosure interaction (still banked, three candidates).
- Non-color state: the grade letter is the state, carried in visible text
  and in each chip's accessible name ("Booster response: S, exceptional").

## Unavailable

- **Phone (~390 px) captures.** The preview harness's viewport resize
  timed out on three attempts (the documented retry budget); no phone
  evidence is claimed. The grades line is a plain flex row inside the
  existing modal/detail surfaces, which carry the app's own phone layouts
  (covered by the UI regression project).
- **Live keyboard-focus event on a chip.** The preview window is
  unfocused, so programmatic `.focus()` produced no native focus event;
  the keyboard path was verified by the app-fixture suite
  (`src/ui/profile.test.ts`, `src/ui/forge.test.ts`) and in the live
  browser by dispatching the same focusin event a real tab produces —
  open, Escape-dismiss, and tap-pin all behaved as asserted there.
- **Reduced-motion.** The grade chips add no animation (state survives
  without motion by construction); no reduced-motion capture was taken.
