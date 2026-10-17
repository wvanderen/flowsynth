# Design workbench

Run `npm run dev` in this checkout, then open `/workbench.html` at the URL printed by the launcher. The workbench is a development HTML entry; the normal production build ships only the instrument.

**Instrument** mounts the real App, DOM skeleton, engine, and renderers inside isolated frames. Choose the opening board, populated board, live flow, paused, Hex detail, Catalog, Forge, Focus Plan/Habit/Goals, or Notes. View one surface at desktop or 390px phone width, or compare both. Reset fixture reconstructs its disposable state. Every frame has its own in-memory save and silent signal channels, so interacting with it never reads, adopts, or overwrites the player's local save and never plays sound or sends notifications.

**Components** shows the actual theme tokens, production control/state classes, shared open tabs, floating-panel geometry, tooltip behavior, and module faces from `moduleFace` with authoritative readouts. The threshold-preview control plays the production local rail accent. These are specimens; full interaction and economy validation belong to Instrument and the domain tests.

Static preview is a workbench CSS override, not browser preference emulation. Test `prefers-reduced-motion: reduce` separately in browser/OS settings: production must have no animated leads or pulses, with charge and direction readable from static marks. Compare non-color states in grayscale and exercise disclosure through keyboard focus, Escape, and touch as well as hover.

## Adding coverage

Add coherent fixture data in `src/ui/workbench/fixtures.ts` and mount the existing surface through `main.ts`. Reuse production renderers and selectors; do not maintain another implementation of a panel in the workbench. Add isolated component specimens only when they illuminate a reusable state or geometry. Use the whole-instrument view to judge whether combinations remain calm; a good-looking isolated control does not establish a cohesive screen.

This deliberately starts as a Vite workbench without a new UI framework or Storybook dependency. It supplies both comparison and isolated-development coverage using this repository's existing DOM/CSS architecture. A later hosting change must preserve real renderers, disposable persistence, desktop/phone coverage, and motion examples.

[Instrument standards](instrument-standards.md) remain authoritative. [ADR-0070](adr/0070-refine-the-rack-around-quiet-practice-and-shared-surfaces.md) records this round's geometry, palette, motion, and scope decisions. Practice-setup simplification, including the Habits sheet, is parked in [#407](https://github.com/wvanderen/flowsynth/issues/407).
