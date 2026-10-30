# #485 — purchase integrity: final-revision refusal, recovery, and boundary quotes

Recaptured on 2026-10-30 from the verified checkout in `provenance.json`:
source commit `e78cebebe9cf3b7e5811a5c26b27bd4ad2f58ff5`, clean source, after
all purchase-control changes. Desktop is 1280×800; phone is 390×844. Later
commits in this pass change only evidence or test setup, not application source.

## Reproduce

`capture.mjs` launches the fresh-start scenario, calls its assertion, drives
real controls, checks state, and writes screenshots plus `observations.json`.
It uses an isolated save, never the player's persistent save.

Launch this checkout with `npm run dev`, then:

```sh
node tools/evidence-preflight.mjs --url http://localhost:5173/ --record docs/evidence/485-purchase-integrity/provenance.json
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core node docs/evidence/485-purchase-integrity/capture.mjs
```

Chromium defaults to `/usr/bin/chromium`; `CHROMIUM_PATH` and `EVIDENCE_URL`
override browser and URL. The script confirms the live viewport dimensions
and reduced-motion preference. A capture-only stylesheet hides the dev
console so it cannot obscure the purchase controls; production surfaces
are unchanged. The asserted fresh-start declaration is in `observations.json`.

## Captures and recorded results

Every row has a `desktop-` and a `phone-` PNG.

| Suffix | Flow and verification |
| --- | --- |
| `nonfinite-balance.png` | NaN bank on a fresh isolated save; the ledger reads `— ν`. |
| `refusal.png` | Activate the real face buy control: desktop focus + Enter; phone tap. The module stays level 0, invested stays 0, and the bank stays NaN. |
| `recovery.png` | Set a valid 1,000 ν bank on the same save and activate the same face control: level 1, balance 990 ν. |
| `boundary-quote.png` | Fresh level-0 synth plus a tray module at level 1506, bank 10 ν. The +1 chip's exact title is `+1 on all 1 modules · 10 ν (buys cheapest-first if broke)`. |
| `boundary-purchase.png` | Activate that +1 chip: desktop Enter, phone tap. The synth reaches level 1, the ceiling module stays 1506, and the bank becomes 0 ν. |
| `detail.png` | Open the upgraded synth's cell. The current hex detail buy column remains present on desktop and phone. |

The refusal reports through the existing `#status` live region
(`role="status"`, `aria-live="polite"`). Its text after both refusal
activations is exactly: `The purchase cannot be charged safely, so nothing
was bought.` No new visible warning surface is introduced. The text and
state assertions are recorded in `observations.json`, not inferred from
screenshots of a screen-reader-only region.

## Instrument-standard review and unavailable checks

- Reviewed the captures against `docs/instrument-standards.md` and its
  pinned presentation/control references (`eb232c4`, `d405ce2`): existing
  square-cut controls, open detail divisions, monospace resource figures,
  and selection/focus outlines remain unchanged. The quote fix adds no
  panel, prose block, warning, or duplicate disclosure surface.
- Keyboard purchase activation and visible face/cluster focus are captured
  on desktop; actual touch activation and detail opening run on phone.
- The failure uses explicit text; unchanged level and balance are asserted.
  Corrected quotes name module count and price, not a color-only distinction.
- Reduced motion is emulated for both passes and confirmed by
  `matchMedia("(prefers-reduced-motion: reduce)").matches === true`.
- Unavailable: screen-reader speech output, color-vision simulation, and
  keyboard/touch disclosure of browser-native `title` tooltips. Exact title
  text is DOM-verified; the screenshots do not claim to show native tooltips.

## Later-step overflow coverage

`purchase-integrity.test.ts` now includes the parameterized public-action
case `a %s-level operation refuses whole when only its later step overflows`
for `2` and `max`. It proves the first level alone succeeds and the next
level overflows the invested ledger. Both the per-module ladder and the
board-wide action must instead refuse the combined operation without
changing any level, ledger, or bank. This supplements the existing case
whose first proposed level already overflows; it does not relabel that
older case as within-operation rollback evidence.
