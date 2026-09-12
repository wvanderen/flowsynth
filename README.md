# flowsynth

FlowSynth is an incremental focus game whose configurable hex grid runs during real-life practice.

- [First-playable design brief](docs/first-playable-brief.md): accepted scope, provisional balance, and unresolved implementation decisions.
- [Economy experiment report](docs/economy-report.md): deterministic route comparisons, upgrade sensitivity, and combination tradeoffs.
- [Run the economy experiment](tools/economy/README.md): standard-library Python commands and assumptions.
- [Validated prototype UX](docs/validated-prototype-ux.md): approved layout, interactions, and prototype source reference.
- [Domain glossary](CONTEXT.md) and [design decisions](docs/adr/).

## First playable (issue #1)

A browser application implementing the first playable: Enter/Exit Flow, Time, two synthesizers, the basic infusor, Forge, and expansion on an eight-cell board, with the starter store, forge rolls, combination, local saves, export/import, and interruption reconciliation. Stack and implementation decisions are in [ADR-0010](docs/adr/0010-build-the-first-playable-on-vite-typescript-and-a-tested-engine.md).

```sh
npm install
npm run dev       # play at the printed local URL (append ?dev=1 for the dev clock panel)
npm test          # engine test suite (ported economy accounting checks and session rules)
npm run build     # typecheck + static bundle in dist/ for offline use
npm run preview   # serve the built bundle
```

Saves live in your browser's local storage. Use Export/Import in the bottom bar for backups or moving between machines; Reset starts a fresh instrument.

The engine in `src/engine/` is a pure library whose arithmetic mirrors the accepted economy experiment; the UI in `src/ui/` follows the approved prototype UX. Economy numbers are provisional balance pending playtesting.
