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
