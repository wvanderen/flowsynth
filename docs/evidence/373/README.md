# Evidence — issue #373 (intrinsic voice capacity)

Captured from the verified checkout at `http://localhost:5175` (provenance
checked via the dev endpoint before every capture: worktree
`t3code-9469175e`, branch `t3code/add-issue-373-feature`, commit
`38da5536` — matching `git rev-parse HEAD` in the edited checkout). The
captures show that checkout's working tree with this issue's changes
applied — exactly the source the commit below records; no other
difference stood in the tree at capture time. The
thread's inline preview harness dropped its browser host mid-pass, so the
captures come from scripted headless Chrome (Playwright) against the same
provenance-verified server. The state was seeded through the dev harness
(`?dev`): a Blaster at C4 with Sines at C5 and G4 — a Fifth and an Octave
that both run through the Blaster's two intrinsic seats — and two
Poly Expander purchases (ambient allowance 3).

| Capture | What it shows |
| --- | --- |
| `desktop-heterogeneous-readout.png` | The board ledger's ambient allowance reading `3 ⬡` — the standard voice's budget — while the reserved readout, asked by the Blaster's cell, reads `(2/4) ⬡`: two seats spent of its four (two authored + two purchased), singing Fifth ×1.3 and Octave ×1.15, Formation ×1.12. The Blaster wears the firm inset selected marker; the chord seams draw active. |
| `desktop-capacity-tooltip-keyboard.png` | The ambient capacity trigger keyboard-focused with its disclosure open: "Whole-chord budget per standard voice". Escape dismissed it afterwards without losing focus (asserted in the script). |
| `desktop-capacity-tooltip-touch.png` | A tap on the same trigger pins the disclosure open (`aria-expanded="true"`, asserted). |
| `phone-heterogeneous-readout.png` | The same seeded board at 390×844: the game-info strip carries the ambient `3 ⬡` read and the readout answers `(2/4) ⬡` with the same chord rows — the voice's own budget at every width. |
| `phone-capacity-tooltip-touch.png` | A tap pins the strip read's disclosure at phone width ("Whole-chord budget per standard voice", asserted). |

## Checks performed in the live browser

- Heterogeneous participation: the allocation ran both instances through
  the Blaster (used 2 of 4) while every standard voice sang one; the same
  board under a uniform one-seat override leaves the Blaster at zero and
  rates lower (pinned by `src/engine/capacity.test.ts`).
- The ambient read stays the standard figure on both faces (ledger and
  phone strip read `3` while the voice reads `4`) — one presentation home
  per fact: the board's floor at the canvas edge, the voice's own budget
  in the readouts.
- Disclosure access: keyboard focus opens the ambient read's gloss and
  Escape dismisses; a touch tap pins it at both widths (all asserted
  programmatically and visible in the captures).
- Non-color state: the capacity figure is the state — text and the
  button's accessible name ("Harmonic capacity 3"); the selected voice
  wears the firm inset marker, readable without color.
- Reduced motion: the ambient capacity read carries no animation or
  transition (`animation: none`, `transition: 0s`, asserted) — a static
  figure, so there is nothing to degrade; the chord glow and seam pulse
  behavior is unchanged by this issue and was evidenced in #372.

## Unavailable

- **The inline preview harness's screenshot transport.** The preview
  browser host became unavailable mid-pass (documented tool failure,
  after two resize attempts also timed out); the captures were taken with
  scripted headless Chrome against the same provenance-verified server.
  Programmatic focus in that browser produces the same focus a real tab
  produces; the keyboard path is additionally pinned by the app-fixture
  suite (`src/ui/app.capacity.test.ts`).
- **A live flow-mode emission capture.** The evidence was captured in
  upgrade mode (the purchase surface's own gate); the allocation's
  per-voice figures are the same pass flow reads, and the engine suites
  cover the flow path directly.
