# PR #514 review fixes — completion record

## Scope and evidence limits

The code fixes address the two Standards findings and the five Spec findings from the review of `996be79...71d3ad5`. No game UI or balance figure changed. The original checkout and its untracked recordings were not used as writable implementation state.

The missing evidence is restored, **not re-recorded**. All 22 canonical calibration JSON files are byte-for-byte copies of `a6349820e80d4e2e399f54cd320d7e210e8aca28` (`9601386^`), with the original source fingerprint `8790c6cb` and original recording commits where those existed. [restoration.json](restoration.json) records a SHA-256 per restored blob. Every original recording commit was checked as an ancestor of the PR head. No runtime, zone, or missing commit was invented. The PR-head's newer single prompt slice is preserved separately as [century-slice-60-prompt-at-71d3ad5.json](century-slice-60-prompt-at-71d3ad5.json), unchanged.

**Unresolved verification gap:** the restored century records use the old inter-decision-only gap reader. They do not prove that start or terminal waits stay below two hours. The 80 full centuries and two retained-board continuations have not been re-recorded with the corrected reader in this fix session: that is a multi-hour explicit calibration tier, not the ordinary suite. This is an unavailable current-source verification, not a successful calibration or a scope waiver. #492's current long-gap verdict remains incomplete; #491's pre-existing new-frontier-effort blocker remains unchanged. Source/fingerprint checks and `measurementVersion: 2` prevent the new composer from silently accepting the restored summaries as current measurements. Reproduction, including both fixture commands, is in [the calibration record](../../century-calibration.md#reproduction-and-source-provenance).

## Findings → named verification

| Finding | Fix and verification | Class |
| --- | --- | --- |
| Stale domain definition | `CONTEXT.md` describes `2 + 4·log10(x)` and distinguishes calibrated curve figures from the remaining World hypotheses; ADR-0079 withdraws the unsupported zero-long-wait conclusion. Read against `BALANCE.world` and the preserved baseline. | manual documentation audit |
| Repeated fixture validation | Both recording and composition call the same `assertFixtureRecord` in `tools/record-century.mjs`; no separate copy of the raw/reset validation remains. | manual code audit; full fixture walks unavailable as above |
| Missing published matrix/baseline/rechecks | Exact-blob restoration manifest; `tools/calibration-evidence.test.ts`: “ships every century slice and the full matrix instead of only citing absent files”, “ships the two retained-board continuations separately from acquisition pacing”, and “ships the opening and later-era rechecks and their six source slices”. These cases check the files, matrix identities, slice/report agreement, and separation of continuations. | automated + recorded restoration audit; historical, not current calibration |
| Missing boundary waits | `tools/century.test.ts`, “decision gaps at observation boundaries”: decision-free century, wait to first decision, wait after last decision, closed-era clipping, and an uninterrupted wait across prestige. Whole-run gaps cross banks; per-era gaps are clipped, so their counts need not sum. A reached stop can still carry `decisionGapsOk: false`. | automated |
| Tautological freeze check | `tools/century.test.ts`: “matches every frozen figure to the committed save-translation baseline” compares the full compiled numeric/schema set to the on-disk artifact, excluding recording-source identity only. Mutation experiment: temporarily changed `BALANCE.responseShare` from 3 to 3.01; the named case failed on `frozen responseSupport`, expected share 3 versus actual 3.01. Mutation reverted before final checks. | automated + recorded mutation |
| Composed provenance overwritten | `tools/runtime.test.ts`, “composed recording provenance”: mixed Chicago/UTC/legacy inputs retain their per-slice/fixture environment and original commit absence; an all-legacy report stays unidentified. Both composers use `composeRecordingPayload`; composer environment and freshly measured route-probe environment are explicitly separate fields. | automated |
| Direct recorder bypasses runtime gate | `tools/recording-entrypoints.test.ts`: each recorder refuses an incompatible declared runtime from a non-repository directory before Git checks, compilation, or input loading. Actual ambient-runtime refusal is recorded with final checks below. | automated + manual |

## Original acceptance-criteria mapping

- **#505 runtime pin/local-CI parity and fresh setup:** `.node-version` and CI's `node-version-file` are unchanged. `tools/run-supported.test.ts` covers selection and refusal; the original fresh-checkout evidence remains in [issue-505-runtime](../issue-505-runtime/README.md). Current fresh-clone setup and preflight are recorded below.
- **#505 cheap runtime/zone/storage gate and actionable incompatible failure:** existing `tools/runtime.test.ts` and `tools/runtime-preflight.test.ts`, plus both standalone recorder cases above; supported preflight and actual ambient-node refusal below.
- **#505 ordinary checks without private PATH/storage workaround:** final `npm run check` and `npm test` from the ambient shell use the existing selector. No `.npmrc` or PATH override was added.
- **#505 actual recording environment; legacy remains legacy:** mixed/all-legacy composition cases above, existing `recordingEnvironment`/`recordingPayload` tests, and the restored blobs' missing metadata left untouched. The multi-hour new-recording demonstration remains unavailable, rather than synthesized from legacy data.
- **#505 targeted UTC/DST regressions:** `npm run test:calendar` runs the existing calendar and goals files in UTC and America/Chicago; final result below.
- **#505 criterion completion record:** this record supplements the original per-criterion table; gaps are explicit rather than inferred from a suite count.
- **#492 all seven criteria:** [the calibration completion table](../../century-calibration.md#every-acceptance-criterion-beside-its-evidence) maps matrix execution, stress fixtures, decision gaps/combat/investments, tuning/rechecks, finite/serialized reads, reproducibility, and baseline freezing. Restored artifacts establish historical availability only; current long-tier and boundary-aware conclusions are unavailable as stated above. Fast boundary, artifact-availability, and freeze guards are automated.

## Final checks

Pending final verification at the committed source revision. Results and source identity will be recorded here before push. Browser evidence is not applicable: no player-facing UI surface changed.
