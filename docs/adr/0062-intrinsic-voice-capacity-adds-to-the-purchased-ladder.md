# 0062 — Intrinsic voice capacity adds to the purchased ladder

Date: 2026-10-15
Status: Accepted
Issue: #373 (parent #366)

## Context

Harmonic capacity was uniform: every voice — silent voices included —
owned exactly `1 + purchased` whole-chord units, clamped into the ceiling
the Arete offerings raise (ADR-0053/0055). The parent spec accepts
intrinsic capacity as one of the axes oscillator profiles author
(ADR-0059's category law): capacity should distinguish profiles beyond the
purchased Poly Expander ladder without changing the ladder's meaning —
"Intrinsic voice capacity plus purchased Poly Expander increments
determines final capacity; the purchased ceiling limits the ladder, not
final capacity."

## Decision

1. **Final capacity is intrinsic plus purchased; the ceiling clamps the
   purchases only.** `capacity.ts` splits the figure: `purchasedCapacityOf`
   is this era's Poly Expander rungs clamped into the ceiling, and a
   voice's budget is its type's intrinsic seats plus that shared figure.
   The Blaster (two seats) at the fully purchased standard ladder ends at
   five while the ceiling stands at four — a final capacity above the
   ladder's own reach, by design and not by corruption.

2. **Intrinsic capacity is authored per named type, in the profile
   table.** `OSCILLATOR_PROFILES` gains a required `capacity` figure — a
   discrete seat count, never an aptitude grade (the parent's grades
   summarize comparable coefficients only). Every launch oscillator
   authors one; the Blaster authors two, the representative distinction:
   the conversion producer holds a second chord seat — it sings and
   completes two voice-sets while every standard voice holds one — and its
   ×0 uncharged term pays for the extra chair. Every non-oscillator,
   silent voices included, reads the standard one, so the typeless read
   (`voiceCapacityOf(state)`) stays every board's floor and the ambient
   allowance (ADR-0056) keeps its meaning unchanged.

3. **Heterogeneous budgets ride inside the certified allocation.** The
   solver's per-voice params carry each voice's own budget; feasibility,
   the optimistic bound, and the suffix tables price every seat against
   its own figure. No heuristic is substituted and the certification flag
   is untouched — a solve over a heterogeneous board is proven optimal
   exactly as a uniform one is. The uniform whole-board override stays as
   the development board's and stress ladder's lever.

4. **No state conversion is necessary.** Capacity was never persisted per
   module: the save carries `capacityBought`/`capacityCeilings`/
   `capacityDiscounts` exactly as before, and a voice's intrinsic seats
   re-derive from its persisted type on every load. Existing purchase
   progress keeps its meaning rung for rung; prestige still zeroes the
   purchases while a profile's seats ride the reset out with the module
   (ADR-0039's boundary class). Older saves load unchanged.

5. **The per-voice readouts quote the voice's own budget.** The summary's
   allocation read carries the per-voice capacities beside the standard
   figure; the reserved readout, the Hex detail's chord row, and the
   placement preview read the moved voice's own budget, so a Blaster's
   used/available names its two seats while the ambient ledger read stays
   the one board-wide figure. The preview and the commit share the same
   authoritative pass, so agreement is structural (ADR-0054).

## Consequences

- The allocation summary gains a per-voice capacities read beside the
  standard scalar; UI consumers that quoted the scalar for a specific
  voice switched to the per-voice figure with the scalar as fallback.
- The solve memo keys the override basis (`fix N`) apart from the
  per-voice basis (`auto`), so a dev-board solve can never serve a live
  solve's result; the per-voice budgets themselves ride the existing
  input fingerprint.
- Later profile waves author capacity the same way — a table figure, not
  a grade — and category-level capacity traits (e.g. silent voices) can
  move the `intrinsicCapacityOf` fallback without touching the ladder.
- Balance remains provisional: the Blaster's two seats are the
  representative authored case, explicitly not a settled economy. The
  calibration fixtures and capacity comparisons keep quoting the uniform
  override.
