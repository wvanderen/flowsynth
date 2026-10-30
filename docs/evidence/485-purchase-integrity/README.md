# #485 — upgrade purchases at the numeric limits: refusal and recovery evidence

Captured from the verified checkout per `provenance.json` (commit `73234e6`,
clean source) on 2026-10-30, both viewports, through the real purchase
controls on the fresh-start scenario's isolated save.

## What the captures show

The purchase-integrity refusal rides the existing failure surface: the
`sr-only` `role="status"` live region (`index.html:115`), the same channel
every action refusal uses. No new warning surface was added. The visible
✗ line comes from the existing dev terminal (dev-only).

| capture | viewport | flow |
| --- | --- | --- |
| `desktop-nonfinite-balance.png` | 1280×800 | NaN bank seeded on the isolated save; the ledger reads `— ν` |
| `desktop-refusal.png` | 1280×800 | real face button `+1 level · 10 ν` clicked and `action upgradeAll ["max"]` run: level stays 0, balance unchanged; terminal prints `✗ The purchase cannot be charged safely, so nothing was bought.` |
| `desktop-recovery.png` | 1280×800 | valid bank (1,000 ν) set on the same save: the same face button buys level 1, ledger reads 990 ν, rate +0.12 ν/s |
| `phone-refusal.png` | 414×896 | the same face control clicked with the NaN bank: `✗ The purchase cannot be charged safely, so nothing was bought.`, module unchanged, `modified — 4 interventions` |
| `phone-recovery.png` | 414×896 | valid bank (100 ν): the same control buys level 2, rate +0.14 ν/s, `modified — 5 interventions` |

## Recorded reads (same session, verbatim)

- Status live region after each refusal click: `The purchase cannot be
  charged safely, so nothing was bought.` (single/mode-level refusals on
  both viewports).
- Dev interventions (engine ok/reason verbatim): `upgradeModuleLevels`
  `ok:false` with the reason above (desktop face click, phone face click),
  `upgradeAll ["max"]` `ok:false` with the same reason (dev terminal), then
  `upgradeModuleLevels` `ok:true` after each valid bank was set — the
  subsequent valid purchase stays usable on both viewports.
- State reads: module level and invested unchanged across every refusal;
  `nous` preserved as `NaN` until a valid bank replaced it; successful
  purchases charged exactly the quoted price (10 ν, 16 ν).

## Verification notes and unavailable checks

- Keyboard focus: the captures show the purchase controls holding visible
  focus rings while activated (the focus-driven clicks); the refusal is
  announced through the `aria-live` status region, confirmed by the DOM
  reads above.
- Reduced-motion behavior was not emulated in this pass — unavailable.
- The ✗ line's red tint is color-only decoration on a glyph (`✗`) plus
  text; the refusal reads without color. Not separately verified with
  color simulation — unavailable.

The dev console was moved out of the capture area on the phone viewport
(same pointer-gesture path its own tests drive); it is capture scaffolding,
not part of the verified surface.
