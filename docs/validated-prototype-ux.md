# Validated first-playable UX

The user accepted the prototype’s game feel and UX on 2026-09-12. The exploration question—how to make the hex grid feel like a focus instrument while keeping between-session management understandable—is settled for the first playable.

## Accepted design

- Layout D: compact top focus toolbar, central hex canvas, attached right inspector. The floating inspector alternative was rejected.
- Module panel hierarchy: module name, focus controls, then level and gameplay upgrades, then concise stats. Header shortcuts open core module panels. Focus panels remain accessible during flow; gameplay changes are disabled.
- Grid overview when nothing is selected: charge, shared progress, banked rewards, module counts, and the full nous calculation explanation.
- Compact hexes: module icon and short name with level, rarity accents, one lock symbol. Receiving charge uses mint; an actively dispensing source uses amber and remaining duration.
- Grid & inventory replaces the inspector. Dragging is available in this mode; selected hexes expose Move and Return actions. Required cores stay deployed. Inventory and cell expansion share this mode.
- Store, Forge, and Grid & inventory remain visible but disabled during flow, preserving canvas dimensions.
- Single-row bottom formula: module icons identify summed contributions; the expression ends with = value ν/s. Larger text and tighter padding. Legend in the canvas corner; full formulas in Grid overview.
- Level displays its concrete current effect. Upgrade CTA displays percentage and absolute effect increase alongside its nous cost.
- Charge information is terse: trigger, strength, duration formula, and target burst, grouped with stats below upgrades.

## Implementation boundary

This approval validates the interaction and visual direction, not production readiness or final economy balance. Build the first playable separately from the throwaway HTML. No application stack is selected by this prototype.

The prototype uses staged state, in-memory outcomes, a visible-page clock, and only a subset of focus modules. Production work still needs durable local saves, import/export, sleep/recovery handling, a reliable clock, real onboarding, and the scoped engine from the first-playable brief. Pointer dragging is implemented but has not been manually exercised; click-based placement, inventory return, and swaps were checked. On-grid focus quick actions and the remaining core focus tools are recorded future direction, not silently added to the minimum scope.

## Primary source

Preserved on local branch `codex/prototype-ux-approved`, at `prototypes/flow-instrument.prototype.html`, with its walkthrough in `prototypes/README.md`. Implementation issue: https://github.com/wvanderen/flowsynth/issues/1.
