# 0051 — Prove whole-chord capacity allocation behind a development board, production untouched

Date: 2026-10-06
Status: Accepted (development slice — the board's production path was released onto the allocation economy by ADR-0055, issue #262; the development board survives as the dev panel and stress board)
Issue: #257 (carrying the confirmed harmonic-capacity design; its own ADR lives in the design tree's numbering and the issue states the behavior independently)

## Context

ADR-0049 stacked named instances multiplicatively with no cap and recorded the alternative lever — capping how many chord terms one voice may stack — for implementation planning. The confirmed harmonic-capacity design adopts that lever: every voice, silent voices included, owns a finite budget; an active chord instance is one complete voice-set consuming one unit on every participating voice; selection is automatic and maximizes summed final oscillator production; the empty allocation stays available when activating would reduce it. Issue #257 asks for the authoritative allocation seam, proven on a development-only board at capacities one through five, **without changing ordinary gameplay yet**.

## Decision

1. **The seam is one parameter on the real rate pass.** `computeRates` takes an optional chord pass (default: today's uncapped `analyzeChords`); the allocator's result is a drop-in `ChordAnalysis`. The development board runs the real pass twice — chordless first, for per-voice weights that carry every non-chord leg (power, local boosters, charge, active build factors, achievements, discoveries; resonance rides beside the weight because it multiplies only participants), then allocated. No parallel rate path exists to drift.

2. **The solver is an exact branch-and-bound over the full candidate space.** Per connected formation (spacers conducting as always), every complete voice-set is materialized — nothing forced, nothing truncated, the silent-only sets counted as recognized but never activated (they grant nothing and spend budget). The search is include/exclude over a canonically ordered candidate list with a per-voice optimistic bound (each voice's remaining capacity filled with its largest remaining factors, Q and resonance folded, never below its idle value), an incumbent from two greedy passes plus a trim. A voice-set activates at most once; formation quality uses the adopted Q ∈ [0.5, 1.5] range from #257 (the default production recognizer retains its existing bounds), scores over every voice in the formation but multiplies only active participants; an unallocated voice keeps exactly ×1 — no Q, no resonance.

3. **Optimality is certified, never presumed.** The budget is a deterministic node cap plus a wall-clock valve; if either trips, the read says uncertified and carries the incumbent — no silent heuristic substitution. Small-instance optimality is certified by an independent exhaustive oracle in the suite (duplicate voices, shared silent voices, multiple roots, unequal power, disconnected formations, and a 60-trial randomized battery). The stress ladder repeats the comparison through the 72-voice upper size at capacities one through five, both in the suite and in a dedicated browser worker. Each completed solve streams a row to the development board; its controls remain usable during the run. The stress button cancels a running worker, and closing or resetting the board terminates it. Late messages from a cancelled run cannot populate a new board.

4. **Equal output retains, then falls back stably.** The incumbent comparison is (value, previous-active-set retention, lexicographic key list); the retention hint advances at each board mutation, and everything downstream of a deterministic budget makes recomputation and reload agree.

5. **The development board is dev-gated and ephemeral** (`?dev=1`, the DEV panel's `board` button): a deterministic scenario board — two disconnected formations, a doubled class, a shared silent voice, a booster, a charged generator — with capacity 1–5, per-voice power, placement moves, and the reads (active instances with exact member sets, used/available per voice, final ν/s, solver nodes/ms/certification). Nothing persists; the production path and its checks stay green with the default chord pass.

## Measured limits (the concrete contract)

The review correction applies #257's adopted Q bounds of **0.5–1.5**. The earlier measurements at the production floor of 0.05 do not establish this development contract and are superseded below. STRESS_BUDGET remains 250k nodes with a 30s safety valve; reported values are observations, not latency guarantees.

| Fixture family | Sizes | Certification at capacities 1–5 | Observed Node / browser worker timing |
| --- | --- | --- | --- |
| Doubled-triad formations, uniform and unequal | 6–72 voices | All certified | ≤ 35 ms / ≤ 5 ms per solve |
| Small chromatic monolith | 6 and 12 voices | All certified | ≤ 220 ms / ≤ 165 ms per solve |
| Large chromatic monolith, uniform | 24 and 48 voices | Incumbents at every capacity | ≤ 0.9 s / ≤ 0.5 s per solve |
| Chromatic monolith, uniform, unequal, silent mix | 72 voices, 60,660 candidates | Incumbents at every capacity | ≤ 2.2 s / ≤ 1.3 s per solve |

At the adopted 0.5 floor, activation can pay even at capacity one. Large chromatic monoliths therefore no longer certify empty allocations at low capacities. Exact maximization is proven for the structured fixtures through 72 voices and the small chromatic fixtures; **it remains unproven for 24–72-voice chromatic monoliths at every capacity within this budget**. The slice establishes and reports this concrete limit; it does not establish universal certified allocation for shipping the new economy.

Browser interaction was exercised through the real board and worker: a capacity change landed while the ladder was at 41/65 rows; all 65 rows arrived incrementally. A 25ms UI heartbeat had a largest observed interval of 95ms, compared with the reviewed synchronous runner's 6.57s blocking task. These measurements were captured while the test suite was also running, so they are not comparative hardware benchmarks.

## Review verification

- Browser provenance: `/private/tmp/flowsynth-pr284-review`, base commit `79fe09e` with the review fixes applied, served by its own `npm run dev` at `localhost:5174`.
- Desktop: captured the module hexes and glyphs, category hues, capacity state, voice state, and streamed stress results. Cells measure 44×58 CSS px; selected voice rows have a firm inset marker. Selection exposes `aria-pressed`; keyboard focus survives recomputation.
- Phone composition and true touch interactions: **unavailable**. Both freeform 390px and iPhone preset resizing timed out. The six-column grid and its stagger fit the intended 390px width by construction; that is not a claimed browser phone pass.
- New surface has no animated/glowing activity or deeper disclosure layer. Greyscale and reduced-motion browser emulation were unavailable; the selected inset and glyphs provide non-color distinctions in the implementation.

## Consequences

- The production rate path is unchanged by default; the seam is opt-in and exercised by the development board and the suites.
- The capacity ladder's economy surfaces (nous Catalog purchases, Arete ceiling unlocks and discounts, prestige reset, discovery credit for recognized-but-inactive chords) are decided in the design and deliberately not wired here.
- `formationTension` is now exported from `chords.ts` — the allocator reads the same quality math the recognizer scores.
- The oracle in `allocation.test.ts` shares constants with the solver by design but re-implements recognition, quality, and evaluation; it certifies the search, not the recognizer (the recognizer's own suites carry that).
