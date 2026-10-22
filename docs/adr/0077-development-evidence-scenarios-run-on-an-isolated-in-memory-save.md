# Development evidence scenarios run on an isolated in-memory save

Browser evidence capture seeds app state through dev helpers (`?dev=1`, `window.__flowsynth`). Every existing helper — `devSynth()`, `devWorldEra()`, the time warp — mutates the tab's live state and saves into the real slot, so a capture pass inherits whatever earlier development state the slot holds, and shared-save recovery (ADR-0032) can resurrect that unrelated state mid-capture: during the goal-ownership round's evidence work, a recovered save replaced the seeded setup and forced a reset (issue #456, 2026-10-22).

## Decision

- **A scenario install detaches before it writes.** `devFocusScenario()` swaps the app's `SharedSave` for one over a private in-memory slot (`memorySaveStorage()`) before any state lands. The scenario's writes — install, boundary throttles, unload — reach only that slot; the player's `flowsynth.save.v1` is never read for the scenario and never overwritten by it. Ordinary saves and shared-save ownership (ADR-0032) are unchanged: a reload boots from the ordinary save, and a scenario tab cannot see another tab's writes because it no longer shares a slot with anyone.
- **The scenario rebuilds; it never mutates.** One module (`src/engine/focus-scenario.ts`) owns the setup — builder and assertion. The builder maps nothing but its own constants through the real creation seams onto a fresh state, so repeating an install cannot accumulate grants, habits, goals, or progress. The one assertion restates the intended setup; the install runs it on the candidate before touching the app, and capture passes re-run it against live state.
- **Scenario setup stays out of the engine's accrual rules.** The builder writes the class pair's figures as load-facts (exactly how `normalizeHabitClasses` treats them at load) and banks the practice-roll meter's crossings through the real banking leg — `accrueClassDevelopment` remains credited time's one seam, and manual logs stay the only way logged minutes move goals.

## Consequences

- **Scenario assertions are the isolation proof.** A recovered unrelated state cannot silently masquerade as the setup: `devFocusScenarioAssert()` fails with a named reason, and the automated suite drives the recovery path to show adoption cannot touch an installed scenario.
- **Dev helpers stay two-tier by intent.** Quick grants (`+100ν`, `World era`) keep mutating the live save for convenience; repeatable evidence setups must follow this pattern instead. The tier is a property of the helper's purpose, not its surface.
- The scenario's goal anchors to the install day — the occurrence is what makes the preparation read live — so a capture spanning local midnight re-rolls the occurrence; the assertion reports it rather than hiding it.
- No fixture catalog, no scenario manifest, no second save format: one slot shape, one builder, one assertion. A second scenario joins the same module pattern.
