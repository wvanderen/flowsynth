# Recordings: the guide to balance-calibration and playthrough recording

A recording is the scheduled playthrough runner invoking real engine actions — no second simulator, no grant, no shared-balance mutation — publishing its slices and composed report beside the evaluation record in `docs/`, each artifact carrying its recording commit, the compiled engine fingerprint, and per-unit provenance. Recordings are the repository's most expensive evidence, which is why [the review workflow](review-workflow.md) runs them only at the frozen revision (stage 5): a source change under a recording spends the whole job again. This file is the one navigation point for recording work — AGENTS.md points here conditionally and never restates the commands or the job lifecycle.

## Before any recording

- **Recordings are final evidence.** They run at the source-frozen revision, after the source gate has resolved its findings — stage 5 of [the review workflow](review-workflow.md), never before it.
- **Runtime gate first.** Every recorder runs through the supported runtime selector (`node tools/run-supported.mjs tools/record-<name>.mjs …`); an incompatible runtime refuses before compiling or loading inputs ([ADR-0080](../adr/0080-the-supported-runtime-and-calendar-basis-are-declared-not-discovered.md)). Recordings carry the runtime and calendar zone they ran on; legacy artifacts missing that metadata stay legacy — absence is never invented.
- **Smoke tier to validate the pipeline.** Each recorder's `smoke` commands drive the real command surface with bounded walks in seconds — prove a recorder change there before spending the multi-hour job (issue #506).

## The recorders

| Recorder | Evaluation | Where its commands live |
| --- | --- | --- |
| `tools/record-century.mjs` | the century calibration ([ADR-0079](../adr/0079-the-calibrated-century-baseline-is-frozen-for-save-translation.md)) | [century-calibration](../century-calibration.md), "Reproduction and source provenance" |
| `tools/record-later-eras.mjs` | later-era productivity, recorded as one resumable job | [later-era-productivity](../later-era-productivity.md), "Reproduction and source provenance"; the job contract is [ADR-0083](../adr/0083-the-later-era-evaluation-records-as-one-resumable-job.md) |
| the first-prestige matrix's vitest gate (`FLOWSYNTH_FIRST_PRESTIGE_REPORT`) | the opening calibration | [first-worthwhile-prestige](../first-worthwhile-prestige.md) |
| `tools/record-profile.mjs` | the profiler's measurement | its usage line and [ADR-0084](../adr/0084-long-batch-recordings-retain-bounded-histories-and-a-batch-record-is-not-an-interactive-artifact.md) |

The evaluation records own their matrices, budgets, and reproduction commands; this guide navigates to them and does not restate them.

## Rules the recorders share — each owned in one place

- **Identity decides reuse, not presence** ([ADR-0083](../adr/0083-the-later-era-evaluation-records-as-one-resumable-job.md)): a stored unit is reused only when its full behavior-affecting identity — the compiled source fingerprint, the recipe, the evaluation version, the runtime — matches what this checkout would run now. A source change re-records honestly; this is the recovery path [the review workflow](review-workflow.md) names after a post-freeze fix, and the reason recordings wait for the freeze.
- **Composition verifies and never walks.** Fingerprint byte-for-byte, every unit's recording commit an ancestor of the composing checkout, the declared matrices complete — stale or missing units are refused, never accepted.
- **Publication honesty.** Publish only verified units; missing environment metadata stays missing; superseded artifacts are named superseded, never relabeled as current ([the review workflow](review-workflow.md)'s recovery rule).

Browser captures are a separate, cheaper evidence kind with their own gate — [visual evidence](visual-evidence.md) owns them; this guide does not.
