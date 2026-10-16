# 0063 — Narrow boosters follow the player's selected recipient

Date: 2026-10-15
Status: Accepted
Issue: #374 (parent #366)

## Context

The booster category had one member: the Booster, whose amplitude uplift
lands on every adjacent oscillator alike. The parent spec accepts coverage
versus strength as a booster axis ("boosters that trade coverage for
strength") and a targeting contract alongside it: players select a narrow
booster's adjacent recipient, unavailable recipients leave a visible
inactive state with a recovery action, remembered recipients resume when
adjacency returns, and the engine never silently retargets by output
ranking. The accepted sample names the pair: the Field (moderate support
to all adjacent oscillators) and the Spotlight (stronger support to one
player-selected adjacent oscillator).

## Decision

1. **Coverage and strength are authored per booster type; support is
   oscillator-only.** The wave's shares ride the balance table beside the
   Booster's baseline: the Field grants `fieldBonus` (0.3, provisional) to
   every adjacent oscillator, the Spotlight `spotlightBonus` (0.5,
   provisional) to its one recipient — coverage traded against strength,
   so one Spotlight beats one Field leg while two Field neighbors beat one
   Spotlight. Every booster's grant lands on oscillator terms only; the
   booster wave does not reach generators, the Forge family, or silent
   voices, and grants to the same term add exactly as the Booster's did.

2. **The recipient is the player's pick, stored as identity.** The
   Spotlight carries a `target` — the selected module's id, `null` until
   the player picks (a fresh Spotlight is inactive, never a guess). The
   pick never consults output: a weaker oscillator stays the recipient
   while the player says so. Received charge strengthens each design's
   primary effect through the continuous-charge curve, exactly as the
   Booster's does.

3. **Validity is a live read, invalidity is a state, never a retarget.**
   One engine read (`spotlightRecipientOf`) resolves the selected module
   to null unless it exists, sings (an oscillator), stands deployed, and
   sits adjacent to the booster. Every consumer — the rate pass, the face
   readout, the Hex detail's picker — shares it, so no surface can
   disagree about whether a Spotlight is active; the inactive verdict is
   the wording layer that classifies *why* the read went null (nothing
   picked, the recipient gone, adjacency lost, the booster undeployed).
   An invalid pick leaves the booster inactive with that verdict in words
   on the booster's own surfaces; the pick is remembered through
   invalidity and support resumes by itself when adjacency returns. The
   presentation home for target failure is the affected booster — its
   face readout and its picker — never a duplicated explanation on the
   rate roster or the preview.

4. **Transitions are explicit.** Placement: a fresh Spotlight starts
   unselected and inactive. Removal: a recipient returned to the tray (or
   the booster itself) keeps the pick and stops the support. Merge: the
   kept copy keeps its own pick, the melted copy's pick dies with it, and
   a melted *recipient* drops every pick that pointed at it — no stale
   ids survive a combination. Save/load: the id persists with the module;
   load normalization drops a target id that resolves to nothing, the
   same lenient-default discipline as the rest of the per-module surface.
   Recomputation keys the allocation memo on the target, so a re-pick
   re-solves — the same authoritative pass computes previews, allocation,
   and committed output.
