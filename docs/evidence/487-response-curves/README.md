# #487 — the dev panel's response-curve select

Captured against the verified checkout recorded in `provenance.json`:
source commit `32b3b80`, clean source, at `http://localhost:5173/?dev=1`.
The changed surface is the dev panel's run row, which gained the
response-curve candidate select between the policy select and the seed
field — the same catalog the recipe validates against, composing the
same input the agent command and the terminal's `run curve=…` take.

## Capture status

**The desktop and phone PNGs are unavailable this session, and are not
claimed.** The preview automation's snapshot and recording pipelines
timed out on every attempt across two fresh tabs and both viewports —
six snapshot calls and one recording call, each with the documented
recovery actions (status reads that passed every observable, tab
activations, a full fresh-tab pass) between them. The raw failures,
attempt by attempt, are in `observations.json`. The health check's
check 1 (status observables) passed throughout; the server-provenance
and viewport classes never failed. The final `preview_evaluate` calls
degraded the same way, ending the pass.

What did run — named as run, never presented as the missing captures —
is recorded beside them:

- the select's option list (`shipped`, `linear`, `bounded`) and its
  place in the run row;
- the panel composing a Bounded run through its own controls, the note
  reading `… · curve bounded · …`;
- both viewport passes confirmed by live in-page reads (including the
  stale resize echo the health check warns about);
- the phone composition measured on a fresh 390×844 load: the select
  inside the viewport at 86×44 (touch-sized), the run button inside.

Marked unavailable beside them: the visual half of the disclosure,
non-color state, and reduced-motion checks — no animation was added and
the control is a native select with an `aria-label`, but none of that is
claimed as verified without a capture.

## Reproduce

```
npm run dev
node tools/evidence-preflight.mjs --url http://localhost:PORT \
  --record docs/evidence/487-response-curves/provenance.json
node docs/evidence/487-response-curves/capture.mjs --url http://localhost:PORT
```

`capture.mjs` sizes each viewport, confirms the live size, reloads so
the panel mounts at its own metrics, composes the Bounded seed-7 one-day
run from the panel's own controls, asserts the note names the curve, and
emits `desktop-curve-select.png` / `phone-curve-select.png` — the two
files this session could not produce.
