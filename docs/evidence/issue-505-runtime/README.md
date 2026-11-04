# Issue 505 — supported runtime: recorded demonstrations

Recorded 2026-11-04T12:32:33-06:00 in this checkout at commit `9601386e646b23fb037ae1e379acf6cdbe4322d4`.
The demonstrations below are the completion record's manual evidence:
the incompatible-environment failure, the selected-runtime acceptance,
the npm-script runtime selection, the recording metadata, and the
calendar regressions under both declared calendar bases. The
fresh-checkout demonstration is recorded further down (needs the
branch pushed first).

## 1. The incompatible-environment failure

The shell's ambient runtime is Node 26.7.0 (the machine's mise global
pin) — not the declared supported runtime. The preflight refuses, exit
1, with the fix in its output:

```

FlowSynth runtime preflight

  declared   22.23.4 (.node-version)
  effective  v26.7.0
  timezone   America/Chicago (UTC-06:00)
  storage    ok — happy-dom localStorage roundtrip
  calendar   the host's local calendar — goal days and schedule days follow this zone

  REJECT (version-mismatch) — fix the environment before running checks or recording evidence.
  supported runtime mismatch: effective v26.7.0, declared 22.23.4 (.node-version).
    select the declared runtime with your version manager, then rerun:
      mise install node@22.23.4 && mise exec node@22.23.4 -- npm test
      nvm install 22.23.4 && nvm use 22.23.4
      fnm install 22.23.4 && fnm use 22.23.4
    npm scripts select the declared runtime automatically (npm test, npm run check,
    npm run dev, npm run build) — run checks through them, not through a hand-built PATH.

exit code: 1
```

The suite's own guard gives the same refusal for a bare, unselected
invocation (here: a bare npx vitest run, before any test file loads):

```
Error: runtime preflight failed — the suite would not run correctly in this environment.
  declared 22.23.4 · effective v26.7.0 · timezone America/Chicago · storage ok
supported runtime mismatch: effective v26.7.0, declared 22.23.4 (.node-version).
  select the declared runtime with your version manager, then rerun:
    mise install node@22.23.4 && mise exec node@22.23.4 -- npm test
    nvm install 22.23.4 && nvm use 22.23.4
    fnm install 22.23.4 && fnm use 22.23.4
  npm scripts select the declared runtime automatically (npm test, npm run check,
  npm run dev, npm run build) — run checks through them, not through a hand-built PATH.
  (bare npx/node invocations must select the declared runtime first; the npm scripts do it automatically.)
 ❯ Object.runtimeGuard [as setup] tools/dev/runtime-guard.mjs:16:11
 ❯ TestProject._initializeGlobalSetup node_modules/vitest/dist/chunks/cli-api.B0Pz1_R7.js:10813:21
 ❯ Vitest.initializeGlobalSetup node_modules/vitest/dist/chunks/cli-api.B0Pz1_R7.js:13812:35
 ❯ node_modules/vitest/dist/chunks/cli-api.B0Pz1_R7.js:13655:6
 ❯ node_modules/vitest/dist/chunks/cli-api.B0Pz1_R7.js:13684:11
```

## 2. The selected-runtime acceptance

Under the declared runtime (`mise exec node@$(cat .node-version)`),
the preflight accepts:

```

FlowSynth runtime preflight

  declared   22.23.4 (.node-version)
  effective  v22.23.4
  timezone   America/Chicago (UTC-06:00)
  storage    ok — happy-dom localStorage roundtrip
  calendar   the host's local calendar — goal days and schedule days follow this zone

  ACCEPT — runtime, calendar zone, and UI storage are ready for checks and evidence.

exit code: 0
```

## 3. Ordinary checks select the runtime themselves

From the same Node 26 shell, `npm test` runs the suite under the
declared runtime via tools/run-supported.mjs — no PATH override, no
.npmrc workaround (the file-backed-storage shim is deleted). The
wrapper's self-demo answers with the runtime the entry runs under:

```
v22.23.4
```

And a bare vitest run on the unselected runtime fails at the guard
(demonstration 1), while the npm-script path succeeds — here a targeted
run from the Node 26 shell:

```
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  12:32:35
   Duration  1.25s (transform 644ms, setup 0ms, import 794ms, tests 81ms, environment 0ms)

```

## 4. A real recording carries its environment

The cheap gated recording (growth report) writes
`recordingEnvironment` beside its figures:

```
   Start at  12:32:37
   Duration  1.25s (transform 645ms, setup 0ms, import 793ms, tests 108ms, environment 0ms)

recordingEnvironment: {'node': 'v22.23.4', 'timeZone': 'America/Chicago', 'utcOffsetMinutes': -360}
```

Legacy recordings (all results committed before this change) carry no
`recordingEnvironment` field — identifiable as legacy, never fabricated:

```
docs/balance-baseline-results.json: recordingEnvironment present = False
docs/balance-growth-results.json: recordingEnvironment present = False
docs/century-slice-60-prompt.json: recordingEnvironment present = False
```

## 5. Calendar regressions under both declared calendar bases

```
=== calendar regressions under TZ=UTC ===
      Tests  46 passed (46)
=== calendar regressions under TZ=America/Chicago ===
      Tests  46 passed (46)
calendar regressions passed under UTC and America/Chicago.
```

## 6. The fresh-checkout setup and preflight demonstration

A pristine clone of branch `t3/issue-505` from GitHub, in
`/tmp/fs-fresh-505` — no node_modules, the shell's ambient runtime
Node 26.7.0. The documented sequence (README): version-manager
install, npm install, preflight, checks. Commands are prefixed with
`mise exec node@22.23.4` the way an interactive mise shell selects
the runtime from .node-version automatically (this capture shell has
no per-directory hook, so the selection is spelled out); the npm
scripts guarantee the same runtime without any prefix.

```
$ cat .node-version
22.23.4

$ mise exec node@22.23.4 -- npm install   (fresh worktree; installs dependencies)

Run `npm audit` for details.

$ mise exec node@22.23.4 -- npm run preflight

> flowsynth@0.1.0 preflight
> node tools/runtime-preflight.mjs


FlowSynth runtime preflight

  declared   22.23.4 (.node-version)
  effective  v22.23.4
  timezone   America/Chicago (UTC-06:00)
  storage    ok — happy-dom localStorage roundtrip
  calendar   the host's local calendar — goal days and schedule days follow this zone

  ACCEPT — runtime, calendar zone, and UI storage are ready for checks and evidence.

exit code: 0

$ mise exec node@22.23.4 -- npm run check
> node tools/run-supported.mjs node_modules/typescript/bin/tsc --noEmit

exit code: 0

$ npm test -- src/engine/calendar.test.ts   (ambient Node 26 shell — the scripts select 22.23.4)
      Tests  7 passed (7)
   Start at  12:34:02
   Duration  1.19s (transform 610ms, setup 0ms, import 755ms, tests 80ms, environment 0ms)


$ npm run test:calendar   (ambient Node 26 shell)
=== calendar regressions under TZ=UTC ===
      Tests  46 passed (46)
=== calendar regressions under TZ=America/Chicago ===
      Tests  46 passed (46)
calendar regressions passed under UTC and America/Chicago.
```

And the preflight run from the unselected ambient runtime in the same
fresh clone refuses, with the fix (demonstration 1's behavior holds in
a fresh checkout):

```
  declared   22.23.4 (.node-version)
  effective  v26.7.0
  REJECT (version-mismatch) — fix the environment before running checks or recording evidence.
  supported runtime mismatch: effective v26.7.0, declared 22.23.4 (.node-version).
    select the declared runtime with your version manager, then rerun:
    npm scripts select the declared runtime automatically (npm test, npm run check,
exit code: 1
```

## Completion record: acceptance criteria → named verification

| Criterion (issue #505) | Verification | Class |
| --- | --- | --- |
| The project pins its CI-compatible supported Node runtime; a fresh checkout has a documented, reproducible way to select it; CI consumes the same declaration | `.node-version` (one concrete semver, `22.23.4`) is the single declaration: CI installs it via `actions/setup-node` `node-version-file` (`.github/workflows/ci.yml`); version managers read it; `tools/runtime.test.ts` "reads the one authoritative declaration, trimmed" and "refuses a malformed declaration by name"; the fresh-checkout demonstration (section 6) selects and installs from it | automated + manual |
| A cheap preflight reports the effective runtime and timezone, checks the UI harness's storage capabilities, and fails an incompatible environment before expensive work with actionable diagnostics | `tools/runtime-preflight.mjs` via `tools/dev/runtime.mjs`; `tools/runtime-preflight.test.ts` (acceptance, version-mismatch refusal with the fix, missing-declaration refusal, unknown-argument usage); storage probe: `tools/runtime.test.ts` "refuses when the UI harness's storage capability is unavailable" + the real-probe case; demonstrations 1 (Node 26 → REJECT, exit 1) and 2 (ACCEPT) above; the suite guard repeats the check (`tools/dev/runtime-guard.mjs`, wired as vitest `globalSetup`), shown in demonstration 1's bare-invocation refusal | automated + manual |
| Ordinary supported-runtime checks work without a private PATH override or the Node 26 file-backed-storage workaround; any remaining workaround has an explicit supported purpose | `.npmrc` deleted (the workaround is gone, none remains); `tools/run-supported.mjs` selects the declared runtime for every npm script — `tools/run-supported.test.ts` (layout coverage, override, located-binary verification, refusal diagnostics) + demonstration 3 (`npm test` from the Node 26 shell passing, wrapper self-demo answering `v22.23.4`) + demonstration 6 (fresh clone, ambient 26 shell, scripts pass) | automated + manual |
| New balance recording metadata identifies the runtime and timezone actually used; legacy recordings remain identifiable as legacy; missing metadata is not fabricated | `recordingEnvironment()` (`tools/runtime.test.ts` "names the runtime and timezone actually used — never fabricated values"); wired into every writer: `tools/balance-growth.test.ts`, `tools/first-prestige.test.ts`, `tools/response-comparison.test.ts`, `tools/record-century.mjs` (slices, fixture, composed results), `tools/record-later-eras.mjs` (slices, composed results); demonstration 4 shows a real recording carrying `{node, timeZone, utcOffsetMinutes}` and the legacy results files carrying no field | automated + manual |
| Targeted calendar-sensitive regressions run under UTC and a DST-observing zone and establish intended calendar behavior without a duplicate full suite | `src/engine/calendar.test.ts` (zone-invariant cases: offset-derived midnights including the fall-back day's two-midnight pick, the Monday start, a DST-shortened-day midnight split, host-calendar recipe declaration/rejection, DST day-length fit/refusal, a real walk's day-boundary stamps); `tools/calendar-regression.test.ts` pins the targeting (two files, UTC + a DST zone); demonstration 5: both legs green (46 + 46 cases); the pin bites — a UTC-day mutation of `localDayStart` fails the daily-occurrence case (mutation checked and reverted during development) | automated + manual |
| The calendar basis is declared rather than silently changed | Gameplay semantics unchanged (local calendar); the declaration lives in `docs/adr/0080-the-supported-runtime-and-calendar-basis-are-declared-not-discovered.md`, the glossary's "Host calendar" entry, the preflight's `calendar` report line (demonstrations 1–2, 6), and `src/engine/calendar.test.ts`'s header | manual (documentation) |

Executed checks at the offered revision (`9175b66` source + evidence-only additions): `npm run check` passed; `npm test` passed (113 files, 2,155 tests, 7 explicit long-recording gates skipped); `npm run test:calendar` passed under both zones. Browser evidence: not applicable — no game UI surface changed (development-tooling, CI, and documentation only; no panel, sheet, readout, or control copy touched).
