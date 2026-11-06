# Issue #507 — the later-era evaluation recorded as one resumable job

Evidence for the resumable-recording work. The completion record lives in the
pull request's Verification section; this directory holds the recorded
demonstration the record cites.

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
