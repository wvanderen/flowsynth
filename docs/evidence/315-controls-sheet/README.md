# Evidence: the controls sheet and its approval round (#315)

All captures from the verified checkout at `7adb388` (`src/ui/controls-sheet.prototype.html`), served by `tools/dev-server.mjs` with provenance confirmed against `git rev-parse HEAD`.

## The round

Held 2026-10-12 over the live sheet. Outcome: **variant A approved** — slim banner-density goal-bar columns, the firm inset underline marker for selected controls. The pin moved to `7adb388` on `prototype/controls-sheet` (see [instrument standards](../../instrument-standards.md), "Primary source").

## Captures

- `desktop-variant-a.png` / `desktop-variant-b.png` — desktop, both step-through variants (A the approved shape, B the runner-up).
- `phone-variant-a.png` / `phone-variant-b.png` — 390px-wide compositions, both variants.
- `desktop-tooltip-open.png` — the plain tooltip open on `Harmonic capacity`: hairline rule and panel surface, no card, directly above the rejected boxed contrast.
- `desktop-reduced-motion.png` — `--force-prefers-reduced-motion` render; layout and state unaffected.

## Checks

- **Disclosure**: tooltips open by click, keyboard focus (`focus-within`), and hover; dismissed by Escape and tap-away — verified in the served page (`aria-expanded` syncs on all three paths).
- **Exclusive selection**: the Modules/Mutators switch pair and the six swatches hold one pressed control.
- **Phone layout**: at 390 CSS px the media query applies and `scrollWidth` equals the viewport (no horizontal overflow); sections stack; the six swatches hold one row.
- **Reduced motion**: the sheet's only transition (bar fill) is suppressed under `prefers-reduced-motion`.

## Unavailable

- **Live `:focus-visible` ring matching**: the automation browser never matches `:focus-visible`, even on real Tab presses, so the ring could not be observed rendering. The rule is present (`button:focus-visible`, 2px ink outline, 3px offset — same pattern as both shipped prototypes). Recorded unavailable per [visual evidence](../agents/visual-evidence.md), never claimed as verified.
- **Touch-device tap checks**: no touch device in this environment; tap paths verified by synthesized clicks only.
