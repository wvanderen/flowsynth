# Adopt the core activation economy

The first playable auto-activated Notes and Goals when the starter store opened (ADR-0008 prototype pacing). Playtest feedback wanted the game to "feel like it's opening up as you're learning the ropes", which is ADR-0007's activation economy: core activations are the cheapest store offers, and the player chooses what opens next. Decided with the maintainer on 2026-09-13.

## Decision

- **Notes (20 ν) and Goals (30 ν) activations are store purchases**, permanent and player-wide, listed above the starter copies and hidden once acquired (like other one-time offers). They are the cheapest items in the store — cheaper than every gameplay starter.
- **Habit stays free and always active**: selecting what you practice is onboarding, not a build choice (issue #5 decision, validated in play).
- **Time keeps its milestone activation** (after the first session ends, ADR-0008) — the first session remains free of store decisions.
- **Rolled copies still never bypass activation** (ADR-0007): inactive core copies from Forge rolls are combination material only.
- **Existing saves are grandfathered**: saves from before this change (save version < 4) that already opened the store load with Notes and Goals active. From version 4 on, activation flags load exactly as stored.

## Consequences

- The opening gains a real first decision: after the second session (132 ν), the player can afford one activation plus a starter (Notes 20 + additive 40, or save toward Forge), instead of everything arriving at once.
- Goal slot capacity stays at the base two; how slots expand is a deferred design question (issue #6) — the Goals module's level now strengthens completion bursts via the standard power curve like other modules.
- If future focus modules (Tasks, issue #7) gate on activation, they join this economy rather than auto-activating.
