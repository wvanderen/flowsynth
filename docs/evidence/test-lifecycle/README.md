# App lifecycle checkpoint

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

## Next design decisions

Lifecycle and fixture ownership resolve the immediate test blocker. Further work should earn its depth through locality and navigation, rather than assume it is needed to fix memory.

For candidate 2, shared-save ownership is a more cohesive module than all session/save orchestration: concentrate stamp validation, rejected-save accounting, guarded writes, and accepted-write bookkeeping; preserve App's one resume/reconciliation path and adoption sequencing (ADR-0019 and ADR-0032). Keep browser-event wiring cases as integration checks and test policy through memory storage and controlled time adapters.

For candidate 3, the shared fixture is already established. Splitting the large suite by board/gestures, console/focus, catalog/progression, session/save, phone, and capacity/placement improves navigation; file parallelism and aggregate worker memory need measurement if scheduling changes.
