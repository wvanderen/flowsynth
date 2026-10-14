# Board-action identity and flow locks

Source: issue #336, working tree on `t3code/implement-issue-336`. Launched
this checkout with `npm run dev`; the provenance endpoint
(`/-/dev/provenance`) returned this worktree, branch, and commit
(`8fb5ff228c325e9b4059c890cb58fce2023cfc44`) before any capture, matching
`git rev-parse` in the checkout.

The T3 preview viewport resize timed out on all three attempts (the bounded
budget in [visual evidence](../../agents/visual-evidence.md)), so the phone
captures are a measured 390px `#app` container within the wider browser —
the app's own `@container` gates, the same phone layout a 390px viewport
serves — not mobile device emulation. The container was restored and the
desktop width re-verified after capture. True touch-level pointer checks and
grayscale/reduced-motion emulation remain unavailable; see the checks ledger.

## Upgrade mode — the rack-and-arrow door

- [Desktop upgrade](desktop-upgrade.png), with the
  [dock close-up](desktop-upgrade-dock.png): the Catalog door wears the
  square-cut rack carrying the upward arrow — board upgrades and unlocks —
  distinct from the layer legend's symbols docked below it, and from the
  retired stacked-layer glyph. The accessible label stays `Catalog`.
- [Phone upgrade](phone-upgrade.png), with the
  [thumb-bar close-up](phone-upgrade-thumbbar.png): the same mark on the
  Catalog segment; Add price-gated by affordability alone (muted, no lock
  mark — affordability is not a lock).

## Flow — locked, visible, unmistakable

- [Desktop flow](desktop-flow.png), with the
  [dock close-up](desktop-flow-dock.png): Catalog, Forge, and Add stay
  visible, glyph and word dimmed hard, each wearing the shared padlock chip
  — the same drawing the locked Mutators layer symbol wears — readable
  without color. The Forge pip keeps its meter read, dimmed; the tray
  column and layer legend stand down as before.
- [Phone flow](phone-flow.png), with the
  [thumb-bar close-up](phone-flow-thumbbar.png): Catalog, Forge, Add, and
  Inventory dimmed under the lock chip; Collection — never locked — stays
  full-strength beside them, the non-color contrast the four-way dim
  reads against.
- Live DOM read during the same flow session: every locked segment reports
  `disabled: true` with its accessible name intact (`Catalog`, `Forge`,
  `Add`, `Inventory`) and the lock chip present; Collection reports enabled
  with no chip. After Exit flow (and the session summary dismissed), every
  segment reported `disabled: false` with no chip — the browser-side
  confirmation of the restore the suite asserts.

## Checks ledger

- **Provenance**: verified before every capture (endpoint vs `git rev-parse`).
- **Desktop composition**: captured (1280px viewport).
- **Phone composition**: captured as a measured 390px `#app` container;
  true phone-viewport emulation unavailable (preview resize budget spent).
- **Keyboard disclosure**: the Forge meter detail's focus-open/Escape
  behavior is asserted by the UI suite (`app.board.test.ts`, "focus opens
  live meter details without moving focus"); not re-driven in the live
  browser this pass.
- **Locked activation**: native `disabled` refuses pointer, keyboard, and
  touch activation — asserted by the suite, including the refusal and
  restore round-trip ("locked board actions refuse activation, and upgrade
  mode restores them"); the live browser confirmed the restore click-path
  read-only (summary dismissal → enabled segments).
- **Non-color state**: the padlock chip carries the lock without color;
  verified in the captures (the chip survives the dimming that sits under
  it). Grayscale capture unavailable — not claimed.
- **Reduced motion**: this change adds no animation or glow; nothing to
  reduce. Not applicable.
