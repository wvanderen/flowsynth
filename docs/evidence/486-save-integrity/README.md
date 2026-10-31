# #486 — save integrity: the failure path's copy, refusals, and recovery

Captured on 2026-10-31 from the verified checkout in `provenance.json`:
source commit `15f7bdb`, clean source, after the refusal-boundary review
fixes for buffered practice, reserve earning, and mandatory backup retention. Desktop is
1280×800; phone is 390×844. The capture script drives the real settings
door for export, the dev clock for the live update, the honesty report's
answer, and installs the fresh-start scenario on an isolated in-memory
save — the player's persistent save is never read or written.

## Reproduce

`capture.mjs` launches the fresh-start scenario, calls its assertion, drives
the failure path, checks state, and writes screenshots plus
`observations.json`. Launch this checkout with `npm run dev`, then:

```sh
node tools/evidence-preflight.mjs --url http://localhost:5173/ --record docs/evidence/486-save-integrity/provenance.json
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core node docs/evidence/486-save-integrity/capture.mjs
```

Chromium defaults to `/usr/bin/chromium`; `CHROMIUM_PATH` and `EVIDENCE_URL`
override browser and URL. The script confirms the live viewport dimensions
and reduced-motion preference. A capture-only stylesheet hides the dev
console so it cannot obscure the surfaces; production surfaces are
unchanged. The asserted fresh-start declaration is in `observations.json`.

## Captures and recorded results

Every row has a `desktop-` and a `phone-` PNG.

| Suffix | Flow and verification |
| --- | --- |
| `save-failure.png` | A NaN bank on the isolated save; `app.save()` refuses (JSON would write null) and the ledger reads `— ν` — the figure that refused is what stands. |
| `export-refusal.png` | Settings → Export save with the unrepresentable state: the modal's lead reads `These figures exceed what a save can hold — nothing was exported.`, with the technical path beneath; the textarea and download button are absent. |
| `advance-refusal.png` | A live session whose board rate left the range (the synth at Lv. 5000): `devAdvance(60)` refuses the span — the clock stays 00:00, the balance 0 ν, the rate `— ν/s`. The refused update left nothing behind, visible on the face. |
| `honesty-refusal.png` | The honesty report's answer against an unrepresentable bucket: the settlement refuses whole — the header's session line reads `1 h 0 min provisional · — ν` (the pool stays outstanding), no minute credited. |
| `recovery.png` | After explicitly rejecting the injected invalid provisional bucket, the board back at Lv. 4 banks 12.44 ν. A forced save succeeds and its stored balance equals the recovered balance (`savedNous` in observations). |
| `import-refusal.png` | Backup storage rejects the imported original. The existing import modal reads `The original save could not be retained. Nothing was imported.`; the balance stays 12 ν and the modal remains open. Keyboard activation on desktop and touch activation on phone drive the settings/import/apply controls. |
| `finish-refusal.png` | An overflowing tray generator refuses session finish; the session remains in flow with 60 credited seconds. The live region reports `The generator charge cannot bank safely, so the session is still open.` |
| `note-refusal.png` | The same generator refuses note credit before the note is appended; the live region reports `The generator charge cannot bank safely, so nothing was written.` |
| `log-refusal.png` | A mixed live/manual goal completion refuses overflowing reserve credit. The live minute and its existing practice row remain, and the failed manual entry adds nothing. The live region reports `The generator charge cannot bank safely, so nothing was logged.` |

Failure lines report through the existing `#status` live region
(`role="status"`, `aria-live="polite"`, visually `sr-only`). Their exact
texts after the actions are recorded in `observations.json`, not inferred
from screenshots of a screen-reader-only region:

- `Saving failed — your last valid save stands untouched.`
- `These figures exceed what a save can hold — nothing was exported.` (modal lead)
- `The board's figures outran the instrument's range — the refused update left nothing behind.`
- `The provisional nous cannot bank safely, so nothing was credited.`

None claims a recovery happened.

## Instrument-standard review and unavailable checks

- Reviewed the captures against `docs/instrument-standards.md` and its
  pinned presentation references: the export refusal reuses the modal's
  existing composition (heading, lead, the import modal's error line
  style), clipped panel, square close control; no new panel, warning
  surface, or disclosure furniture was introduced. The refusal copy is one
  concrete effect line; the technical detail is a single path figure.
- Keyboard path exercised on desktop (settings button focus + click,
  Escape closes); touch tap on phone for the same doors. Reduced motion is
  emulated for both passes and confirmed by
  `matchMedia("(prefers-reduced-motion: reduce)").matches === true`.
- The failure uses explicit text; the unchanged clock, balance, and rate
  are visible on the advance-refusal captures. Non-color state: the ledger
  reads `— ν`, not a color change.
- Unavailable: screen-reader speech output, color-vision simulation. The
  live region's text is DOM-verified in `observations.json` instead.

## Review-fix coverage

The capture assertions establish the visible import denial and DOM live-region
copy for session finish, notes, and manual logs. Automated regression cases in
`src/engine/save-integrity.test.ts` additionally pin exact state preservation,
absence retry after save/reload, split-plan rollback, and successful valid
operations after correcting the overflowing generator. Backup-denial and retry
cases are in `src/ui/shared-save.test.ts` and `src/ui/app.savefailure.test.ts`.
The PR Verification table is the single acceptance-criterion completion record.
