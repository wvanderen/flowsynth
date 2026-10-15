# PR #394 review corrections

Captured from `npm run dev` in `/Users/eggfam/.t3/worktrees/flowsynth/t3code-f9fcfed8`, served at `http://localhost:5173/?dev`. The provenance endpoint confirmed that worktree and parent commit `bed4af2a03c1486e2462375a2c1b854ef8288ec3` with these working-tree corrections applied. A fresh fixture contains an invested tray Harmonizer and its higher-level deployed twin (one combine, 10 ν refund).

- `desktop-refund.png`: separate refund disclosure opened without consuming copies. Action and disclosure targets measure 44px high. Keyboard Tab opens the disclosure; Escape dismisses it; returning with Shift+Tab/Tab reopens it. Separate click opens the same layer. The count and eligibility remain in accessible names.
- `desktop-sheet.png`: inventory sheet with the same action and disclosure, both 44px high. Compared with the pinned instrument and controls-sheet references: square action, open divisions, compact readout, existing plain tooltip, and a non-color eligibility pip.
- Phone composition and real touch disclosure: unavailable. Both freeform 390×844 and iPhone preset resize attempts timed out after the prescribed status/retry sequence. App fixtures at width 390 verify the sheet control and separate disclosure activation, dismissal, and unchanged engine state.
- Grayscale browser emulation: unavailable; the existing solid eligibility pip remains a shape independent of hue. Accessible names now explicitly say “Eligible to merge.”
- Reduced motion: no animation or glow added; the existing tooltip layer is reused. Dedicated browser reduced-motion emulation unavailable.

Validation: `npm run check`, full `npm test`, and `npx vitest run --project ui`. Regression coverage exercises focus, Escape, click/tap-style disclosure, tap-away, preserved count/eligibility, and no merge caused by disclosure on both surfaces.
