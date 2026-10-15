# 0059 — Oscillator profiles are authored per named type, graded by fixed bands

Date: 2026-10-15
Status: Accepted
Issues: #369, #370 (parent #366)

## Context

The library expansion (#366) needs recognizable module identities: a
player who learns a name should be able to recognize its role in future
drafts. The launch roster's one plain oscillator gives generators of
oscillator drafts nothing to choose between, and the roster's growth
(#369 onward) would multiply names without multiplying decisions. The
accepted design separates a named type's fixed acquisition rarity
(ADR-0058) from a fixed authored profile, and adds a quick-comparison
shorthand that must never be confused with current output.

## Decision

1. **Profiles are fixed per named type, authored in code.**
   `OSCILLATOR_PROFILES: Record<OscillatorType, OscillatorProfile>` in
   `src/engine/profiles.ts` authors four coefficients per oscillator —
   base production (over the category's unified `synthRate`), booster
   response (how much of each adjacent booster's bonus the term
   receives), chord response (how much of every chord instance's bonus
   the term converts; the formation's Q rides outside it), and charge
   response (the multiplier on the charged-empowerment curve's delta
   above ×1) — plus the Blaster's structural `chargeConversion` marker
   (ADR-0048's replacement curve, unchanged). One defining behavior and
   at most two supporting tradeoffs per design; incidental coefficients
   stay neutral. Non-oscillators read neutral until their own waves
   author profiles. Coefficients are provisional tuning.

2. **The four waveform designs launch common, distinct by profile.**
   The `additive` key keeps its save identity and now reads "Sine" —
   strong base, half booster response. Triangle converts chord bonuses
   ×2.5 from a reduced base ×0.75; Square converts booster bonuses ×2.0
   with reduced chord response ×0.6 and base ×0.9; Saw converts the
   charge delta ×3.0 from the lowest base ×0.7. Each has a
   representative board where it is preferable: a naked board favors the
   Sine, one charged booster flips to the Square, a rich named chord
   flips to the Triangle, and a steadily charged board flips to the Saw.
   Waveform names identify individual designs, not physics.

3. **Every rate seam reads the one table.** The rate pass folds the base
   and response coefficients into the voice's legs (the effective
   booster bonus and charge term land in the contribution, so displayed
   breakdowns multiply out exactly); both chord passes fold the chord
   response per voice; the certified allocation objective prices each
   candidate seat with its own `1 + response × bonus` factor — a
   profile's niche sits inside the certified search, never beside it —
   and the independent exhaustive oracle re-implements the same
   per-voice math. Placement previews ride the same pass, so preview,
   commit, and displayed production agree.

4. **Progression scales the strengths, never the shape.** Levels, merge
   tiers, and mutators multiply the profile's outputs; the proportions
   between the axes, the defining conditions, and the relative
   weaknesses are untouchable. The chordless ×1.00 contract (ADR-0049)
   holds per profile — responses scale bonuses, never the un-chorded
   floor.

5. **Fixed aptitude grades give the quick comparison (issue #370).**
   Absolute coefficient bands per category — base production bands
   against the category standard (S ≥ 1.2, A ≥ 1.0, B ≥ 0.85,
   C ≥ 0.6, D > 0), response bands around neutral (S ≥ 1.4, A ≥ 1.1,
   B ≥ 0.8, C ≥ 0.5, D > 0) — map each axis to one letter: S
   exceptional, A strong, B standard, C reduced, D weak, and the
   absent mark for axes with no comparable coefficient (the Blaster's
   charge axis). Grades belong to the named type and never re-rank:
   levels, tiers, mutators, and live conditions move output, not
   grades; rare does not imply a higher grade on every axis. Grades
   summarize comparable numerical aptitudes only — temporal behavior
   and structural alternatives are described directly instead.

6. **Presentation keeps one home per fact.** The grade chips — the
   axis's short name with its letter, exact coefficient in the tooltip
   layer — render on the Forge candidate tiles (the draft decision) and
   the Hex detail's module face (the owned inspection), from one shared
   renderer. Live production stays in the existing readouts; the
   breakdown rows carry the profile-scaled figures. Types without
   authored profiles render no grade line.

7. **No save change.** New types join the roll pool's common band
   (sixteen commons, uniform); old saves carry none of them and need no
   conversion. `SAVE_VERSION` stays 9.

## Consequences

- The engine gains `src/engine/profiles.ts` (table, accessors, bands,
  `profileAxesOf`) as the single profile source; `economy.ts`,
  `chords.ts`, and `allocation.ts` read it, and the UI renderer reads
  `profileAxesOf` — no surface re-derives a coefficient.
- The roll pool holds sixteen types, all common; the oscillator category
  doubles its draft share until the draft-composition control (#378)
  weights categories separately from type count. The capacity
  calibration's pacing record is re-recorded (median ordinary era-1
  750 minutes, seed 42/23) in `docs/capacity-release-tuning.md`.
- The allocation solver's `Candidate.factor` became per-seat
  `factors[]`; the objective, bound, greedy evaluator, and analysis fold
  all read the seat's own factor. Certification semantics are unchanged.
- Later profile waves (generators, boosters, Afterglow/Sideband) author
  new table entries and axes against the same grade bands — adding
  roster entries never reranks an existing grade.
