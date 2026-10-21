# Focus and habit redesign

Confirmed interview decisions, 2026-10-21. Design brief only; production implementation is pending. [Instrument standards](instrument-standards.md) and their pinned prototypes govern presentation. Visitor mode: Operate.

## Intent and priorities

Opening Focus should make preparing the next practice session effortless. The player chooses a habit and duration, sees the habit's target and advancement, and starts. Development is understandable without making tree allocation part of session preparation.

Priorities, in order: clear session preparation; a coherent habit identity and goal; legible class advancement; deeper configuration and history on deliberate entry. Preserve the Rack's quiet, ruled, monochrome panel language, square controls, accessible state marks, and restrained functional habit color.

## Structure and one-place rules

- The first view prepares the session. Choosing a habit immediately selects it; it does not open an editor. Keep duration and session actions here. Retain unstructured practice without requiring a habit or goal.
- The selected habit's compact summary owns its goal read and class advancement: class name, level, XP progress toward the next level in practice-time units, free tree points, and **Next module roll**. Distinguish level progress from reward progress by label and unit. Do not repeat these facts in surrounding furniture.
- **Edit habit** opens name, color, and the optional single goal. Remove the separate Goals face. Goal controls belong only to the habit editor; the goal inherits habit color. Existing ambient header goal feedback remains governed by the instrument standards; it is not another editing destination.
- **Develop** opens the selected habit's class tree and its allocation, preset, and respec actions. Move tree controls out of session preparation. The compact summary remains the one advancement read for this view; do not duplicate its figures inside the tree.
- During practice, keep the habit's compact advancement and goal reads available and live. Editing, selection, and allocation remain locked throughout the session, including pauses. History remains a separate destination. Preserve practice records and tagged notes without appending their full contents to the preparation view.

## Domain decisions

Each habit owns its color and zero or one goal, independent of class. The target can recur daily or weekly, or run once. Goal completion is optional for practicing and has no role in class advancement. See [Habit, Goal, and Engineer](../CONTEXT.md) and [ADR-0075](adr/0075-unify-habit-development-and-own-one-goal-per-habit.md).

Engineer earns its **Next module roll** progress through credited practice. This is the existing practice-roll meter, not board or World charge. Class XP and reward progress remain distinct; manual logs and breathers advance neither under the existing class contract.

Retire the legacy habit build, its equipment, and its gameplay bonuses. Class development is the single development system per habit/class. Preserve lifetime practice, history, class XP, levels, allocation, and partial reward progress. Do not award compensatory XP or convert practice a second time. The existing v10-to-v11 migration already converts recorded habit seconds to Engineer XP at one XP per second; implementation must verify that old-save conversion still occurs once and current saves retain their class ledger.

## Goal edits and existing saves

- Retain qualifying practice when changing the target amount. Changing cadence recalculates progress from qualifying practice in the new period. Preserve the existing credited-practice eligibility boundary; manual practice must not newly become class or goal reward credit.
- Goal edits cannot replay completion fuel already awarded. Preserve the bounded goal-generator fuel rule across edits, replacement, cadence changes, and migration.
- Existing single-goal habits transfer directly; their goal color becomes habit color.
- For a habit with several existing goals, ask the player which to retain when they next edit that habit. Preserve prior goals in history; do not silently select, combine, or reinterpret them. Unresolved migration must not block session preparation or mint rewards from multiple legacy goals. Preserve the old records until the choice is made.
- Habits without goals remain usable and retain their existing/default color where available. Completed once-only goals remain completed until edited or replaced; recurring targets retain the existing calendar boundaries.

## Non-goals

No separate Goals tab, goal capacity purchase, multiple active targets per habit, legacy build section, new charge resource, new class, replacement game economy, or requirement to allocate points before practice. Do not add explanatory paragraphs, nested cards, or extra navigation merely to fill the sheet. Do not redesign the surrounding header, Notes, or World in this work.

## Implementation and verification handoff

Resolve production code against this brief rather than carrying both progression systems forward. Remove legacy effects at their authoritative economy sources as well as their controls. Reuse one live derivation for XP and roll progress; the current next-level countdown can become stale because it lacks a live patch target. Verify the maximum-level and zero-free-point states, fresh habits, no goal, completed goal, unstructured practice, archived habits, migration choice, long names, and session pause/resume.

Required implementation checks: typecheck, full tests, UI suite, and verified-checkout desktop and phone evidence per [visual evidence](agents/visual-evidence.md). Exercise keyboard focus, selection without color, touch targets, read-only session controls, live progress, and reduced motion against the pins. Test migrations and goal-fuel non-replay at their domain boundaries.

This planning round inspected current source and a historical committed Focus capture; that capture predates the current class UI and is not current visual verification. Live desktop/phone layout, keyboard/touch, and reduced-motion checks are unavailable in this planning round. No UI code was changed or runtime checks claimed.
