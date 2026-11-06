# Issue #507 — the later-era evaluation recorded as one resumable job

Evidence for the resumable-recording work. The authoritative criterion-to-evidence
completion record is in [PR #519's Verification section](https://github.com/wvanderen/flowsynth/pull/519);
the original mapping and recorded demonstration are retained below.

## Completion record: every #507 criterion beside its evidence

| Criterion (issue #507) | Named verification | Class |
| --- | --- | --- |
| Each completed seed persisted atomically; termination cannot forge partial evidence | `writeJsonAtomic` (serialize → exclusive temporary → fsync → rename, `tools/dev/runtime.mjs`); `a killed writer leaves the previous bytes or nothing, never a partial target` and `never lets a concurrent reader observe a partial write` (`tools/recording-job.test.ts`); the real SIGKILLs below left exactly the completed unit files and nothing partial | automated + recorded |
| Reuse only on matching behavior-affecting inputs; identity covers engine/runner source, recipe and seed, evaluation logic, calendar/runtime assumptions, solver settings; report-format changes distinguished | `covers exactly the behavior-affecting inputs, and nothing report-shaped`, `rejects reuse when any behavior-affecting input moves` (engine digest, runner version, seed, schedule, timeZone, evaluation version, solver budgets, runtime node), `a forward is invalidated by its parent's identity, not only its own inputs`, `a rebuilt plan keeps its derived units exactly while the parent identity holds` — the identity block contains no report-shaped field, so format changes never discard evidence | automated |
| Demonstrated interruption + restart does not repeat valid seeds; changed inputs invalidate; corrupt/duplicate rejected | The real demonstration below (crash + two SIGKILLs, `supervisor-log-excerpts.log`); `an interrupted run keeps completed evidence and finishes only the rest`, `rejects a corrupt unit by preserving its bytes and re-executing it`, `rejects a duplicate claim — a unit that does not name its own key` | automated + recorded |
| Separate worker processes, bounded concurrency, explicit resource budget; completion/failure/cancellation/restart defined; tool-call timeout destroys nothing | `executes every unit on separate worker processes and publishes once complete`, `bounds concurrency: no more workers start than the budget allows` (event-log ordering), `a failing worker fails its unit and the job, with the diagnostic recorded`, `cancellation > SIGTERM cancels in-flight workers, records the durable state, and fires the notification` (exit 143, resume completes), `took over the stale lock` after kill -9; `--jobs` and `--worker-mb` (worker `--max-old-space-size`) recorded in the durable status | automated + recorded |
| Interface exposes completed/remaining, failures, elapsed time, worker memory, logs, durable final status; completion-notification handoff | `reports completed and remaining units, failures, elapsed time, and worker memory`; `job-status.json` written atomically at every transition; per-unit logs plus the supervisor event log; `the completion notification fires exactly once at the terminal state` with the handoff lines on `--detach`; `notification.log` in the job directory recorded both terminal states | automated + recorded |
| Composition verifies completeness and provenance, generates the report without hidden walks or continuations; continuations are explicit persisted units | `compose` verifies each input's fingerprint byte for byte, every unit commit's ancestry, the full seed matrix, and every persisted forward, then writes the report — no walk in the path (`compose` ran in 1.2 s after the 69-unit job); the forwards executed as worker units under their own identities; `publishes the probe evidence from the walk and its persisted forwards`, `refuses a forward that disagrees with the walk's enumeration`, smoke compose drives the same pipeline | automated + recorded |
| Reports keep assertions/schema or a documented migration; tiny cases run normally; a recorded end-to-end demonstration | Slice payloads keep their published shape with additive `unitProvenance` (`publishes a slice from its eight seed units, with per-unit provenance`; compose's `assertSliceRows` unchanged); the migration (compose reads persisted probe evidence; smoke single-flight refusal wording) is documented in [ADR-0083](../../adr/0083-the-later-era-evaluation-records-as-one-resumable-job.md) and the #506 race test's updated refusal expectation; the tiny interruption/resume, invalidation, cancel, and detach cases run in ordinary CI through the smoke tier; the recorded demonstration is this directory | automated + recorded |
| Guidance documents the one interface and its validity rules; the completion record maps the criteria | `docs/later-era-productivity.md`'s "Reproduction and source provenance" rewritten around `run`/`status`/`compose` and the validity rules; ADR-0083; this table is the mapping | recorded |

One recorded observation, not a defect: the status line's elapsed time spans
the job's first start through its terminal state, including downtime between
launches — wall time of the recording effort. Each unit's own `elapsedMs`
measures its worker's compute.

## The recorded end-to-end demonstration

The full declared evaluation — 48 seed walks, the probe walk, and 20 derived
route forwards (69 units) — was recorded at fingerprint `ccab0a92` (runner 15)
through `node tools/record-later-eras.mjs run --detach --jobs 5 --notify …`,
published as the six slices, `docs/later-era-probe.json`, and composed into
`docs/later-era-results.json` at commit `6727d04`.

The run spanned several launches, and the interruptions were real:

1. **An unplanned crash.** The supervisor died mid-job on a plan-validation
   defect (`supervisor-log-excerpts.log`, first entry). The two units already
   persisted survived; the relaunch reused them.
2. **Two deliberate hard kills** — `kill -9` of the whole detached process
   group while walks were in flight. After each kill the job directory held
   exactly the completed units (8 unit files after the first kill — no
   partial writes), the in-flight workers were gone, and the stale lock was
   left behind. The relaunches logged
   `took over the stale lock of pid …`, reused every completed unit
   (attempts unchanged), re-executed only the units that had been in flight,
   and — after the derive-on-resume fix — derived all 20 forwards from the
   reused probe walk (`derived 20 follow-on units from probe-walk`).
3. **A genuine failure surfaced as designed.** One launch failed fast on a
   premature publication attempt and the durable status recorded `failed`,
   with the completion notification firing for the failure too.
4. **Full reuse.** The final relaunch after the fixes re-executed nothing:
   the invocation took 1.5 s wall (69/69 reused, zero worker starts in the
   supervisor log's final section) and republished every artifact.
5. **The completion notification handoff.** `notification.log` in the job
   directory records both terminal states the agent was told about without
   keeping any shell wait alive: the failure, then `complete`.

The job directory itself (`.recording/later-era/evaluation/`) is working
state and stays out of the checkout; these excerpts are its record.

## PR #519 review fixes

`tools/recording-review.test.ts` adds regressions at the production boundaries:

| Finding | Named verification | Class |
| --- | --- | --- |
| A forward-only budget change reused obsolete descriptors | `rebuilds resumed forwards with the current budget, not the old descriptor` changes the actual compiled budget declaration from 30 to 15 while preserving the parent identity; the rebuilt plan carries 15 and rejects the old forward identity | automated |
| Composition lost evaluation identities | `publishes recorded identities and refuses stale evaluation evidence at composition` publishes the workers' identities, then changes the actual compiled evaluation version; both slice and probe validation refuse the old evidence despite an unchanged engine digest | automated |
| A supervisor-only kill left overlapping workers and unsafe cleanup | `waits for an orphan worker before cleanup and reuses it (cancel recovery: false)` kills a real supervisor while its worker is computing, resumes at one worker, checks one worker start and untouched live temporaries, and verifies reuse with one attempt plus restored elapsed/memory metrics; the `true` case additionally cancels recovery, checks its notification, and safely resumes again | automated |
| A refused detached launch overwrote the live bundle | `refuses a detached second launch without touching the live bundle` exercises production and smoke CLI launches against a held lock and checks an existing bundle dependency is unchanged | automated |
| Incomplete or duplicate route evidence and missing provenance composed | `requires every affordable order exactly once and complete identity provenance` rejects a missing order, duplicate order, empty/missing provenance, and an unexpected unit | automated |
| Relative job paths failed during import | `accepts a relative job directory through the real CLI` records the bounded slice through a relative `--dir` and checks durable completion | automated |
| The env-gated slice assertion still called the removed command | `tools/later-eras.test.ts` now invokes `run <slice>`; `the slice recording command validates budgets before walking` checks the production slice command parses and refuses a bad budget before any work | automated + source inspection |
| The completion record was absent from the PR | PR #519's Verification section carries all eight #507 criteria and their named evidence | recorded |

The new regression command was first run red: four selected cases failed on
obsolete budgets, accepted incomplete evidence, live-bundle deletion, and
relative imports. The completed regression file also covers evaluation-version
changes and supervisor-only kills (including cancellation during recovery).

### Identity recovery, not re-recording

The seven published inputs were regenerated through `sliceGroup` / `probeGroup`
from the original `.recording/later-era/evaluation/units/` files. Every one of the
69 units passed the current identity and payload checks. Before writing any
artifact, the migration asserted deep equality of **every field except the new
identity metadata**, and checked each original per-unit commit/environment
against its persisted worker provenance. No walk or continuation ran. The
SHA-256 of the `[artifact path, rows-or-banks]` payloads before and after is
`9f1499ed7f8978b2ce8b8ef9cb224c28b8a18db91dfb8e5070f0aeaa48727d79`.
This deliberately tightens the published schema; identity-less evidence must
be re-published from its original units or re-recorded, never stamped from
current inputs. See ADR-0083 for the migration and pre-lease worker boundary.

### Final verification at source `91da43c`

- Supported Node `22.23.4` preflight — passed (`America/Chicago`, storage roundtrip available).
- Targeted recording pass — 101 passed, one explicit-tier skip across `recording-review`, `recording-job`, `recording-smoke`, and `later-eras`.
- `npm run check` — passed, including the four-script recorder static gate.
- `npm test` — 124 files passed; 2,337 tests passed, nine skipped. No second full UI run.
- Production `compose`, with output isolated under `/tmp`, verified 48 matrix walks and 20 persisted forwards without running walks. All measured report data is unchanged. The regenerated report updates only its composition commit and the seven input publication commits (the old report predated their existing `dd01701` publication stamps); it matches the actual composed bytes.
- No UI or calendar-engine behavior changed, so browser evidence and the separate calendar suite are not owed. The full multi-hour recording was not repeated; its original units, identities, commits, environments, and results are retained.

The final follow-up commit contains only this evidence record and the composed
report's metadata; it does not change the verified source.

## CI timezone regression

[CI run 42269786923](https://github.com/wvanderen/flowsynth/actions/runs/42269786923)
failed `rejects reuse when any behavior-affecting input moves` on its UTC host.
The test assigned `UTC` to a recipe already using `UTC`: no input changed, so
accepting reuse was correct. The same targeted command reproduced the failure
locally with `TZ=UTC`. The test now chooses a different calendar zone and asserts
that every tamper actually changes the original identity before checking refusal.
There is no production matcher or calendar-engine change.

- `TZ=UTC npm test -- tools/recording-job.test.ts -t 'rejects reuse when any behavior-affecting input moves'` — failed before the fix, passed after.
- The same targeted case under `TZ=America/Chicago` — passed after the fix.
- `TZ=UTC npm test -- tools/recording-job.test.ts` — all 39 cases passed.
- Final full checks and CI readiness for this follow-up are recorded in PR #519's authoritative Verification record.

## Automated checks

`tools/recording-job.test.ts` (39 cases) demonstrates the boundaries at
seconds scale through the same machinery: atomic persistence under a killed
writer, identity-checked reuse and per-input invalidation, corrupt and
duplicate rejection with byte preservation, bounded concurrency read off the
event log, worker failure isolation, the derive fan-out (including from a
reused parent), the publication gates (lazy unit ids, derive-gated readiness,
never claiming complete without every declared artifact), the plan-merge
invalidation, the CLI lifecycle (detach handoff, single-flight refusal,
completion notification, SIGTERM cancellation with exit 143 and a resuming
relaunch), and composition's probe-evidence verification.

`tools/recording-smoke.test.ts` drives the smoke tier through the same job
pipeline; `tools/later-eras.test.ts` pins the domain reads and the probe
split (`prepareProbeOrder` / `probeForwardFor`) against real walks.
