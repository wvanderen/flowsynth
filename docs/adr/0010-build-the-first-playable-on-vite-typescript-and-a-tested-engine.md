# Build the first playable on Vite, TypeScript, and a tested engine

The first playable (issue #1) is a browser application that runs locally, works offline after setup, persists to local storage, and supports save export/import. ADR-0008 left the stack undecided; the approved prototype UX (layout D) settled interaction and visual direction but no technology. Two open implementation decisions were resolved with the maintainer on 2026-09-12 and are recorded here.

## Decisions

- **Stack: Vite + TypeScript + Vitest, vanilla DOM.** The game engine is a pure TypeScript library in `src/engine/` with no DOM or clock dependencies; the UI layer in `src/ui/` renders it. Vitest suites port the economy experiment's accounting checks (`tools/economy/test_simulate.py`) and extend them to sessions, store gating, combination refunds, rolls, and persistence. `npm run dev` serves locally; `npm run build` produces a static bundle that works offline from any static file server.
- **Engine arithmetic mirrors the accepted experiment.** Balance constants in `src/engine/constants.ts` mirror `tools/economy/baseline.json`. Upgrade costs use exact integer arithmetic (`ceil(10 × 1.6^level)` via BigInt rationals) so binary floats can never round a price up. Charged empowerment, the shared production formula, global meter thresholds, and burst queueing follow the issue #1 brief and ADR-0004/0009.
- **Interruption reconciliation: pause and confirm.** Ordinary background time counts automatically. If wall-clock time jumps by more than `RECONCILIATION_THRESHOLD_SECONDS` (120s) during flow, the session freezes and a dialog asks the player to confirm or discard the missing interval; rewards for that interval apply only after confirmation. The threshold is a single constant, chosen because throttled background tabs tick roughly once per minute; the brief leaves the exact value open and this is a tunable starting point, not a settled design.
- **Persistence: versioned localStorage with export/import.** One JSON save (`flowsynth.save.v1`) stores the full game state, including fractional nous, global meters, banked roll outcomes generated at earn time, queued generator bursts, and in-flow session state with a wall-clock anchor for reload recovery. Reloads never re-award banked rewards. Export/import round-trips the same file for backup and transfer.

## Consequences

- The engine stays deterministic and testable against the Python experiment; the UI layer is thin and disposable.
- The RNG for forge rolls is `Math.random` (the brief leaves the algorithm to implementation), injected so tests can pin outcomes; roll outcomes are persisted when earned, so RNG changes never alter banked rolls.
- Choosing a stack now does not settle economy tuning or production verification, and desktop packaging, accounts, and sync remain deferred per ADR-0008.
