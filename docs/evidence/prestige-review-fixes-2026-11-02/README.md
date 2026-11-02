# Prestige review corrections

Source commit: `4c89e4f1620dc82bb23913ef515095fd5b0899fd`. The checkout was launched with `npm run dev`; `provenance.json` records the accepted capture preflight at `http://localhost:5173/` with clean source.

The live dev harness ran seed 23, pushing policy, seven baseline days. The resource-curves panel inspected the new eligibility milestone's own snapshot: 5h25m credited, zero prestiges, no banked claims. `read.json` records the event and runner provenance. This demonstrates eligibility independently of a reset, using the actual scheduled runner.

- `desktop.png`: 1280×800; the eligibility line and zero-prestige read are visible.
- `phone.png`: 390×844; the existing event list was scrolled to the eligibility line, which remains readable as plain text.
- The new line uses the existing open event-list composition and name/state readout, judged against `docs/instrument-standards.md` and its pinned prototype. The checkmark plus text communicates state without color. No control geometry, disclosure, or animation was added.
- Both captures use reduced motion. Separate keyboard/touch interaction checks are unavailable: this change adds a noninteractive event line, and the headless capture exercised the existing inspection through the dev handle rather than keyboard or touch.

Reproduce after launching and preflighting the checkout: `node docs/evidence/prestige-review-fixes-2026-11-02/capture.mjs` (requires installed `playwright-core` and `/usr/bin/chromium`).

Verification: `npm run check` passed on Node 22.23.4. The full `npm test -- --reporter=json --outputFile=/tmp/pr501-fixed-tests.json` report covers all 106 files with zero failures, including both review regression cases in `tools/first-prestige.test.ts` and `src/ui/app.playthrough.test.ts`. The process hung after writing the successful report and was terminated; this is recorded as a close-hang, not a clean exit. No second full suite was run on this revision.

## Matrix reproduction

The sequential gated matrix was cancelled while still running. Its replacement uses Vite's SSR loader to run the same `firstPrestigeRecipe`, `runPlaythrough`, and `firstPrestigeRow` functions independently per seed, then merges with `distributionOf`; no alternate simulation or balance overrides are involved. The merge asserts all 32 rows, currency integrity, prompt outcomes, eligibility agreement across policies, and every mark on each classified journey.

Run from the repository root on Node 22 (seed processes can run concurrently):

```sh
for seed in 42 468 157 2026 7 99 11 23; do
  node docs/evidence/prestige-review-fixes-2026-11-02/matrix-worker.mjs "$seed" &
done
wait
node docs/evidence/prestige-review-fixes-2026-11-02/matrix-worker.mjs merge
```

Each seed process writes `/tmp/pr501-seed-<seed>.json`; the merge writes `docs/first-prestige-results.json`. The original gated Vitest reproduction command in the findings document also remains supported.

Result: all eight seed processes completed successfully; the merge validated all 32 rows. The worthwhile timing distributions and bank hours are unchanged. Pushing eligibility now agrees with the corresponding prompt door, including seed 157 at 14.17h rather than its later 17.08h bank; the 60-minute seed 157 row also records eligibility despite never banking within budget. The regenerated report carries runner v12.
