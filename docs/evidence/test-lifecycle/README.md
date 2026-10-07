# Test architecture evidence

2026-10-07. Checkout: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-a423c3cb`; branch `t3code/optimize-test-suite-performance`; starting commit `99571039ef2592877db50b91a09d438d1067e492`. Measurements and browser captures include the uncommitted lifecycle changes.

## Settled design

- App owns resource acquisition and release. `dispose()` is terminal, idempotent, and does not save.
- Global listeners, rendered handlers, the recurring timer, active module/mutator/placement/pan gestures, pending click suppression, tooltip bindings/portals, and the development worker release together.
- Rendered-handler records use weak references and prune disconnected descendants after rendering; registering handlers cannot retain every replaced node for the App's entire lifetime.
- Already-started file reads and clipboard callbacks cannot update a released App. Browser-created audio closes; borrowed audio stays under its adapter's control.
- The shared fixture tracks every App created by each scenario, mounts the real HTML skeleton without executing entry scripts, and restores its DOM, storage, visibility, and targeting overrides during teardown.
- An App whose grid was replaced stays available for explicit state assertions but does not handle browser events or timer ticks against the replacement instrument.
- One Collection test queried a detached row after rebuilding its sheet. It now queries the live row, matching a user's actual interaction.

## Measurements

Commands run after `npm install`, timed with macOS `/usr/bin/time -l`. `NODE_OPTIONS` is unset for the after runs.

| Run | Heap setting | Result | Wall time | Maximum resident memory |
| --- | --- | --- | --- | --- |
| Unchanged checkout, `npm test` | `--max-old-space-size=8192` | Stopped unfinished after reaching late App cases | 368.72 s | 2,676,539,392 bytes |
| Lifecycle change plus Collection correction, `npm test` | Default | 51 files / 1,099 tests passed | 44.34 s | 1,781,186,560 bytes |
| Final ownership paths and replacement-boot regression, `npm test` | Default | 51 files / 1,100 tests passed | 45.04 s | 1,741,275,136 bytes |
| Independent `npx vitest run src/ui/app.test.ts` | Default | 309 / 309 passed | 9.12 s | 2,064,842,752 bytes |

The final full-run App suite passed all 309 existing cases in 9.31 s; the independent repeat passed them in 7.19 s of test execution (9.12 s command wall time). `npm run check` passes. Thirteen new lifecycle cases cover release behavior, every fixture boot, replacement ownership, module/mutator/armed-placement/pan cancellation, click suppression, surviving rendered nodes, browser/borrowed audio, late worker messages, pending file reads, and tooltip cleanup.

The unchanged baseline was deliberately stopped after six minutes; it is not a passing baseline or a completed duration. Its App timers and tooltip listeners had concrete retaining roots, but no heap profile apportions the improvement among those roots, the shared fixture, and omitted entry-script execution. Other worktrees had concurrent test processes; timings are approximate. The reported default-heap OOM was not reproduced again in this checkpoint. The memory figures are the timed command's maximum resident size, not V8 heap usage.

Raw local logs: `/tmp/flowsynth-lifecycle-baseline.log`, `/tmp/flowsynth-lifecycle-final.log`, `/tmp/flowsynth-lifecycle-verified.log`, and `/tmp/flowsynth-lifecycle-app.log`.

## Browser checks

Launched this checkout with `npm run dev`, serving `http://localhost:5173/?dev`. Browser fetch of `/-/dev/provenance` matched the worktree and commit above before capture. The measured desktop CSS viewport was 1402×877; the preview screenshot raster is 1280×998. Requested resizing timed out, so the measured viewport is recorded rather than claiming the requested size.

- Catalog opens through its actual control. Keyboard focus opens Harmonic capacity disclosure; Escape hides the tooltip while leaving the catalog open. A click pins disclosure (`aria-expanded=true`); Escape dismisses it before the sheet. [Desktop focus evidence](desktop-focus.png).
- The clipped panel, rule-separated rows, figures/prices, selected tab marker, and unavailable purchase controls retain the presentation governed by `docs/instrument-standards.md`. No markup, copy, or stylesheet redesign was made. [Grayscale evidence](desktop-grayscale.png) records the same states without hue.
- In the live browser, release followed by visibility/focus/unload events and a 350 ms wait produced zero tick calls, no save-slot change, and no visible tooltip portal.
- **Unavailable:** phone browser capture. T3 preview freeform resize to 390×844 timed out. Desktop resize also timed out. Existing automated phone interaction cases passed; they do not substitute for browser layout evidence.
- **Unavailable:** physical touch and reduced-motion browser emulation; the preview exposes no corresponding control. Click pinning and keyboard access were verified. No animation or motion styles changed.

## Shared-save and domain-suite checkpoint

The second checkpoint keeps session reconciliation and save-attempt throttling in App. `SharedSave` owns fresh timestamp reads, guarded/forced writes, rejected-save accounting, and ownership after accepted writes. Its production adapter accesses browser storage lazily; its tests use memory storage and controlled time. Save format and reconciliation order remain unchanged (ADR-0019 and ADR-0032).

Seventeen module cases cover older/newest owners, ties, malformed or absent stamps, forced replacement, independent tabs, adoption, rejected versions/imports, and storage failures. Five direct save-policy UI cases moved to this suite. Browser events, import/reset, boot rejection, and reconciliation remain integration checks; an added integration assertion distinguishes failed-write throttling from refusal.

The 305 remaining App scenarios are distributed across six files, each with local fixture ownership:

| Domain | File | Tests |
| --- | --- | --- |
| Console and focus | `src/ui/app.test.ts` | 44 |
| Board and gestures | `src/ui/app.board.test.ts` | 113 |
| Catalog and progression | `src/ui/app.catalog.test.ts` | 34 |
| Session and save | `src/ui/app.session.test.ts` | 60 |
| Phone | `src/ui/app.phone.test.ts` | 32 |
| Capacity and placement | `src/ui/app.capacity.test.ts` | 22 |

An AST comparison against the lifecycle checkpoint confirmed that the only removed UI assertions are the five migrated policy cases; the throttle assertion is the only added App case. Signal recording, cell clicks, container width, and visibility helpers are shared without exporting mutable App state.

Vitest's `ui` project uses one thread with file isolation enabled. The `engine` project retains parallel forks. `npm test` runs both; `npx vitest run --project ui` runs all UI regressions. AGENTS.md now documents these commands.

| Run | Heap setting | Result | Wall time | Maximum resident memory |
| --- | --- | --- | --- | --- |
| Shared-save extraction and domain split, `npm test` | Default (`NODE_OPTIONS` unset) | 57 files / 1,113 tests passed | 48.78 s | 800,899,072 bytes |

Compared with the lifecycle-only checkpoint, measured maximum resident memory decreased by approximately 54%; command wall time increased by 3.74 s. This is one measurement under concurrent machine load, not a guaranteed speed or memory ratio. The full run includes a passing provenance test whose short-lived Vite server logged a dependency-scan shutdown warning; it did not fail a test or produce an unhandled test error. `npm run check` and `git diff --check` pass. Raw log: `/tmp/flowsynth-architecture-final.log`; focused policy/integration log: `/tmp/flowsynth-shared-save-focused.log`.

This checkpoint changes storage orchestration and test scheduling, with no further visual surface changes. The browser checks and unavailable phone evidence above remain the applicable visual evidence.
