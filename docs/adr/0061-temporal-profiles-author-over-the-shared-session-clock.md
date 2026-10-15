# 0061 — Temporal profiles author over the shared session clock

Date: 2026-10-15
Status: Accepted
Issue: #372 (parent #366)

## Context

The authored profiles so far carried only comparable coefficients — the
oscillators' four axes (ADR-0059) and the generators' earning table
(ADR-0060) — and delivery was uniformly steady. Two accepted niches from
the parent's sample need a timing rule instead: an oscillator whose
production rewards sustained practice (weak opening, strong sustained)
and a generator whose delivery arrives in predictable periodic bursts
drawn from earned reserves. Both need a clock that works in open-ended
sessions, excludes pauses, and cannot be manipulated by restarting
sessions or moving modules.

## Decision

1. **Temporal profiles read the shared session clock.** The clock is the
   running session's `elapsed` — every flow second since the session
   started, pauses excluded — the one figure `sessionClockOf` publishes.
   Away stretches run it (the session was live; reconciliation settles
   nous and practice credit, never the clock); a restart resets it to
   zero; no module owns any private timer, so placing, moving, or
   retrieving a temporal module can never preserve or manipulate its
   phase. Open-ended sessions work by construction: no curve reads a
   planned duration.

2. **Both curves are piecewise-constant steps on that clock, authored in
   `profiles.ts` as provisional tuning.** The Afterglow warms in three
   steps — ×0.30 to minute two, ×0.80 through minute five, then ×1.25
   sustained. The Pulsewell cycles: each two-minute cycle runs ninety
   seconds at ×0.5 and closes with a thirty-second ×2.5 burst, an exact
   ×1.00 average — the cycle shapes delivery without adding charge.
   Piecewise-constant steps keep every production span exact wherever it
   starts and ends.

3. **The advance walk splits at temporal boundaries.** The reserve- and
   goal-boundary walk gains one more earliest-boundary source per
   deployed temporal module, so each span between splits holds one
   constant factor. The walk uses an iterative loop so recurring cycle
   boundaries cannot overflow the stack during long away catch-up.
   Equivalent advancement intervals deliver
   equivalently — one 300-second span, four 75-second spans, or 300
   one-second steps price identically.

4. **The factor multiplies the type's whole term, outside power.** The
   rate pass folds the clock factor into the voice's base term and the
   emission strength multiplies by it — allocation weights, placement
   previews, charge delivery, and every readout speak one figure. Power
   (levels, tiers, mutators) scales around the condition and never moves
   the timing, so progression preserves the warmup and burst conditions
   exactly as it preserves profile proportions (ADR-0058/0059's rule).

5. **Faster emission spends the earned reserve faster, never more of
   it.** The burst factor rides `emittedStrength`, whose expenditure rule
   is unchanged (ADR-0060): reserve drains at the emitted strength, so a
   burst consumes proportionally more quantity. Restarts cannot
   accelerate production: a fresh session always opens mid-steady, the
   first burst waits ninety session seconds, and every burst draws from
   banked reserve — there is no opening grant of charge to time.

6. **Timing is described directly, never graded.** The temporal rule is
   not a comparable coefficient, so it takes no aptitude letter: the
   profile line renders one plain figure line beside the grade chips
   (`temporalTimingOf`), and the Hex detail's breakdown names the current
   factor as its own row while it moves. The memo keys the pass's inputs
   on the quantized phase — never the raw clock — so consecutive ticks
   share one solve while a boundary always re-solves.

7. **Both designs author uncommon** — the roster's first entries in the
   uncommon band (ADR-0058's fixed type rarity, the shared band table
   unchanged). The Pulsewell's earning profile is deliberately mixed:
   half of every specialist on every axis. Category-frequency control
   and per-type weights remain the draft-composition work (#378); the
   0.9% band share is the provisional scarcity figure.

## Consequences

- `afterglow` and `pulsewell` join the types, the roll pool (18 types),
  and the META/icons/grades surfaces; no save-shape change — the clock
  and the curves live in code, and a mid-session save round-trips its
  phase through the persisted `session.elapsed`.
- `profileAxesOf` stays the comparable-axes read; temporal types render
  their timing beside it, and the absent-chips case (the Pulsewell) now
  renders a profile line where non-profiled types render none.
- The capacity calibration's seeded walks can only shift when a slot
  draws the uncommon band (0.9% per slot); the always-on gate's median
  seed is re-checked and the re-record noted in
  docs/capacity-release-tuning.md.
- Later temporal waves author against the same tables without re-ranking
  anything; chance-based activation still requires an explicit profile
  and a meaningful tradeoff, as the parent reserves.
