# Longer-horizon playtest release (#484 / PR #524)

## Approved release scope

The [issue author's explicit approval](https://github.com/wvanderen/flowsynth/issues/484#issuecomment-6748062967) supersedes the earlier pacing-only acceptance blocker for this playtest. Ship the current calibration for hands-on play with known timing variability; do not wait for another coefficient search, banking-target change, or improved simulated player.

The 5–10 credited-hour later-era range remains a measured hypothesis. Only 47/115 closed eras meet it (10/59 at 25m, 37/56 at 60m); those misses are not passes. Stable-board play—keep a working layout, scrap drafts, Upgrade All, work toward goals—is intended. Frequent optimization is not a release prerequisite. The [pacing diagnosis](../../../research/later-era-pacing-diagnosis.md) and [banking comparison](../../../research/later-era-banking-experiment/README.md) remain exploratory notes, not acceptance recordings.

Unchanged gates: valid-save preservation, finite transactional arithmetic, original-byte backup, one-time migration and explicit recovery, honest zero-claim resets, and affordable no-refund routes at the tested states. The original [criterion mapping on #484](https://github.com/wvanderen/flowsynth/issues/484#issuecomment-6726428891) and [review follow-up](../pr524-review/README.md) identify those cases and recordings. No safety exception is approved.

## Verification and source scope

Production engine/UI/runner source has not changed since the checked revision `8b81776`; later work is documentation and isolated research, not a shipped tuning change. Existing recordings keep fingerprint `ed2bd449` and their original provenance. No recording is relabeled as a newly measured result, and the packaged experiment is not a second production simulator.

- At `8b81776`: `npm run check` passed; full `npm test` passed, 127 files, 2394 tests passed, 9 skipped.
- Release supported-runtime preflight: passed, Node v22.23.4, America/Chicago, UI-storage roundtrip available.
- Focused migration/recovery verification: `npm test -- src/engine/save.test.ts src/engine/save-recovery.test.ts src/ui/app.migration.test.ts src/ui/app.recovery.test.ts tools/save-migration.test.ts tools/save-recovery.test.ts` — 6 files passed, 112 tests passed, 2 skipped. These exercise finite migration, backup/failure preservation, reload/idempotence and explicit corrupt-save recovery. Skipped recorded tiers are not newly claimed as executed; their original evidence stays at its original provenance.
- Release `npm run check`: passed, including the 5-script recorder static gate.
- Release `npm run build`: passed; Vite reports the existing >500kB bundle-size advisory (not an integrity failure).
- Research experiment audit and script syntax check passed, as recorded in the experiment README; no additional economic experiments were run for release.
- No UI surface changed. New browser captures are not owed; no access to the player's actual browser save is claimed. The player should export a separate backup before loading the new version; the application's migration retains original bytes independently.

## Publication

Release authorization: the existing production destination documented in the repository README, `https://flowsynth.vercel.app`.

At preparation time, this environment has no authenticated Vercel session (`vercel whoami`: logged out), no linked `.vercel` project, and no Vercel token in the environment. Build is ready, but production publication requires deployment authorization. Do not claim the build is live until the deployment and production alias are verified. PR merge/CI and deployment results will be recorded as they become available.

Keep #484 open for hands-on feedback until the playtest is actually delivered and its remaining assessment is resolved; numerical ideal tuning is not asserted complete.
