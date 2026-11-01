# #487 — the dev panel's response-curve select

Captured on 2026-10-31 from the verified checkout in `provenance.json`:
source commit `9374907`, clean source. Desktop is 1280×800; phone is
390×844. The changed surface is the dev panel's run row, which gained
the response-curve candidate select between the policy select and the
seed field — the same catalog the recipe validates against, composing
the same input the agent command and the terminal's `run curve=…` take.

## Captures

Both viewports are captured and verified. `capture.mjs` sizes each
viewport, confirms the live size, reloads so the panel mounts at its own
metrics, operates the select **from the keyboard** (no pointer),
composes the Bounded seed-7 one-day run through the panel's own
controls, asserts the note names `curve bounded`, and only then takes
the screenshot. The contexts launch reduced-motion and the script
asserts it.

| File | What it shows |
| --- | --- |
| `desktop-curve-select.png` | The run row at 1280×800: Fresh start · Launch · Prompt prestige · **Bounded** · seed 7 · days 1 · the tuning inputs · Run playthrough, with the note line reading `… · no Arete spent · curve bounded · Feat unlocked — spark · …`. |
| `phone-curve-select.png` | The same composition at 390×844 with the row wrapped; the note's `curve bounded` text fully legible; square-cut hairline controls per the controls sheet. |

Every capture's pre-screenshot assertions — live viewport, reduced
motion, the select's option list and aria-label, keyboard operation,
and the note's curve name — are in `observations.json` beside the
recorded observations.

## First session's unavailable pass (history)

The first evidence session could not capture: the preview automation's
snapshot and recording pipelines timed out on every attempt across
three passes and two fresh tabs (seven snapshot calls, one recording
call; status observables passed throughout). That session's raw
failures, ordered recovery attempts, and the in-page observations that
did run are preserved in `observations.json` under `history` and were
committed as the record at `5035912` — the captures were never claimed.
The review round made `capture.mjs` runnable in the repo's playwright
pattern, and the captures above were produced with it the same day.

## Reproduce

```
npm run dev
node tools/evidence-preflight.mjs --url http://localhost:PORT \
  --record docs/evidence/487-response-curves/provenance.json
node docs/evidence/487-response-curves/capture.mjs --url http://localhost:PORT
```

`playwright-core` resolves from `node_modules` when installed
(`npm i --no-save playwright-core`); `PLAYWRIGHT_MODULE` and
`CHROMIUM_PATH` override, matching the #486 capture's conventions.
