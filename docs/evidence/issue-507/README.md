# Issue #507 — the later-era evaluation recorded as one resumable job

Evidence for the resumable-recording work, including the completion record
(mirrored into the pull request's Verification section when the branch opens
as one).

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
