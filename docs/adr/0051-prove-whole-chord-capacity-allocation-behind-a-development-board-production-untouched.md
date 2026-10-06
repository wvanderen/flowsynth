# 0051 — Prove whole-chord capacity allocation behind a development board, production untouched

Date: 2026-10-06
Status: Accepted (development slice)
Issue: #257 (carrying the confirmed harmonic-capacity design; its own ADR lives in the design tree's numbering and the issue states the behavior independently)

## Context

ADR-0049 stacked named instances multiplicatively with no cap and recorded the alternative lever — capping how many chord terms one voice may stack — for implementation planning. The confirmed harmonic-capacity design adopts that lever: every voice, silent voices included, owns a finite budget; an active chord instance is one complete voice-set consuming one unit on every participating voice; selection is automatic and maximizes summed final oscillator production; the empty allocation stays available when activating would reduce it. Issue #257 asks for the authoritative allocation seam, proven on a development-only board at capacities one through five, **without changing ordinary gameplay yet**.

## Decision

1. **The seam is one parameter on the real rate pass.** `computeRates` takes an optional chord pass (default: today's uncapped `analyzeChords`); the allocator's result is a drop-in `ChordAnalysis`. The development board runs the real pass twice — chordless first, for per-voice weights that carry every non-chord leg (power, local boosters, charge, active build factors, achievements, discoveries; resonance rides beside the weight because it multiplies only participants), then allocated. No parallel rate path exists to drift.

2. **The solver is an exact branch-and-bound over the full candidate space.** Per connected formation (spacers conducting as always), every complete voice-set is materialized — nothing forced, nothing truncated, the silent-only sets counted as recognized but never activated (they grant nothing and spend budget). The search is include/exclude over a canonically ordered candidate list with a per-voice optimistic bound (each voice's remaining capacity filled with its largest remaining factors, Q and resonance folded, never below its idle value), an incumbent from two greedy passes plus a trim. A voice-set activates at most once; formation quality scores over every voice in the formation but multiplies only active participants; an unallocated voice keeps exactly ×1 — no Q, no resonance.

3. **Optimality is certified, never presumed.** The budget is a deterministic node cap plus a wall-clock valve; if either trips, the read says uncertified and carries the incumbent — no silent heuristic substitution. Small-instance optimality is certified by an independent exhaustive oracle in the suite (duplicate voices, shared silent voices, multiple roots, unequal power, disconnected formations, and a 60-trial randomized battery). The stress ladder repeats the comparison through the 72-voice upper size at capacities one through five, both in the suite and from the development board's stress button in the browser.

4. **Equal output retains, then falls back stably.** The incumbent comparison is (value, previous-active-set retention, lexicographic key list); the retention hint advances at each board mutation, and everything downstream of a deterministic budget makes recomputation and reload agree.

5. **The development board is dev-gated and ephemeral** (`?dev=1`, the DEV panel's `board` button): a deterministic scenario board — two disconnected formations, a doubled class, a shared silent voice, a booster, a charged generator — with capacity 1–5, per-voice power, placement moves, and the reads (active instances with exact member sets, used/available per voice, final ν/s, solver nodes/ms/certification). Nothing persists; the production path and its checks stay green with the default chord pass.

## Measured limits (the concrete contract)

Node run (STRESS_BUDGET: 250k nodes, 30s valve) and browser run agree in shape; browser timings ≈ 2–3× node timings.

- **Structured boards certify at every supported size**: doubled-triad formations, 6→72 voices (1→12 formations of 15 candidates each), capacities 1–5, ≤ ~35 ms per solve in Node, ≤ ~34 ms in the browser. This is the scalable path the economy's real boards travel.
- **The pathological monolith certifies where the empty allocation provably wins**: a fully chromatic connected 72-voice mass (60,660 candidates; Q floors at ×0.05) certifies empty at capacities 1–4 (~0.4 s Node / ~1.2 s browser); at capacity 5 — where deep stacking could pay — the node budget exhausts and the row reports an incumbent honestly. The same holds for the 48-voice monolith.
- **Chromatic-12 at capacity 5 and chromatic-24 at capacity 5** likewise exhaust the budget (incumbent). Everything smaller certifies at every capacity.

These are the documented limits issue #257 anticipated: exact, certified allocation is proven through the supported board size for structured formations and for monoliths in the regime where activation loses; a monolithic chromatic mass at high capacity remains incumbent-only within the responsive budget, reported as such, never claimed certified. Raising it wants either a tighter bound or an accepted latency, a tuning decision for the economy's ship ticket — not this slice.

## Consequences

- The production rate path is unchanged by default; the seam is opt-in and exercised by the development board and the suites.
- The capacity ladder's economy surfaces (nous Catalog purchases, Arete ceiling unlocks and discounts, prestige reset, discovery credit for recognized-but-inactive chords) are decided in the design and deliberately not wired here.
- `formationTension` is now exported from `chords.ts` — the allocator reads the same quality math the recognizer scores.
- The oracle in `allocation.test.ts` shares constants with the solver by design but re-implements recognition, quality, and evaluation; it certifies the search, not the recognizer (the recognizer's own suites carry that).
