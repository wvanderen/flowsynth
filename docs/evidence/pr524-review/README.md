# PR #524 review follow-up

## Disposition and criterion mapping

| Finding / criterion | Named verification | Disposition |
| --- | --- | --- |
| Standards: unrepresentable claim grant must refuse before any reset mutation (ADR-0086; #484 story 34) | `src/engine/prestige.test.ts`: “an unrepresentable claim grant refuses prestige without changing state or serialized save bytes” invokes public `prestige` with a stress-only declared claim base of 2000, asserts the specific refusal, full state equality, byte-identical serialization, and successful unchanged reload | Fixed. This boundary is beyond ordinary reachable frontiers; no shared constants or production behavior changed. |
| Spec: raw fixture narrative must agree with its recorded outcome | `docs/century-fixture-raw.json`, `row.claims`, `row.frontiers`, and `row.eras`: one successful claim of 428 after one credited hour, followed by 99 familiar hours in an open era | Fixed in `docs/century-calibration.md`. The fixture is not overflow-refusal evidence. |
| Spec: later productive eras generally occupy 5–10 credited hours (#484 story 26) | `docs/later-era-productivity.md` and `docs/later-era-results.json`: 47/115 closed eras in-window, including 10/59 closed eras on 25-minute schedules (denominator corrected by the [pacing diagnosis](../../../research/later-era-pacing-diagnosis.md)) | The numerical requirement remains unmet. The [maintainer-approved scope change](https://github.com/wvanderen/flowsynth/issues/484#issuecomment-6748062967) explicitly removes the 5–10h range as a release gate for this hands-on playtest, without relabeling the misses as passes. Safety, migration/backup/recovery, and tested no-refund routes remain required. |

## Source gate and evidence scope

Sequential self-review of this revision: the new test calls the real transaction, checks both mutation and persistence boundaries, and deliberately uses an extreme declared claim rather than changing shared constants. Documentation matches the committed artifact. The original review found pacing blocked; the later maintainer decision changes the playtest's acceptance scope explicitly, rather than a reviewer silently waiving it. No production engine, runner, evaluation, or recorder inputs changed; only a test and documentation changed. `playthrough.ts` explicitly excludes `*.test.ts` from the compiled engine fingerprint. The existing recordings retain their original provenance and measured outcomes; no recording is relabeled or newly claimed. No UI surface or calendar behavior changed, so captures and calendar-specific checks are not owed.

The narrow verification addition and narrative correction passed the checks below. The subsequent approved playtest scope decision resolves the pacing-only release blocker; further ideal-tuning experiments are deferred. The [pacing diagnosis](../../../research/later-era-pacing-diagnosis.md) and [banking experiment](../../../research/later-era-banking-experiment/README.md) are historical exploratory work, not new acceptance recordings. Their contemporary blocker statements predate the scope decision.

## Checks

- Supported-runtime preflight: passed under Node v22.23.4, America/Chicago, storage roundtrip available.
- Targeted: `npm test -- src/engine/prestige.test.ts` — 16 passed.
- Source freeze: `8b81776` (test/documentation-only revision).
- Final `npm run check`: passed, including the recorder static gate (5 scripts).
- Final `npm test`: 127 files passed; 2394 tests passed, 9 skipped. Both engine and UI projects ran once at the source freeze. This evidence-only update does not change the checked source.
