# The horizon break scales the prestige claim with resets and capped decades

ADR-0039 fixed the first prestige loop — a flat 1 Arete at an unmoving horizon — and deferred the break; the strategic-additions ticket (issue #176) pulled the break into the prestige iteration and required the pre-break stretch to show progress. Grilling the break contract (issue #181, 2026-09-30) settled it on Revolution Idle's Break-Infinity shape, with one redirect: yield grows from the resets themselves, not from Catalog purchases.

## Decision

- **The break is a standalone one-time Catalog purchase.** It stands alone beside the trees in the Arete Catalog — not a third tree (ADR-0040's rule holds) — visible from the first banked Arete so the goalpost shows through the whole pre-break stretch. Price is tuning.
- **The claim counts the resets.** The nth prestige banks n Arete: claim grows linearly with prestiges performed, pre-break by definition and forever as the base. Catalog purchases give power only. This supersedes ADR-0039's flat-yield clause ("never from resetting repeatedly") and the letter of #176's scope note (purchases raising the claim).
- **Post-break, per-era overfill scales the claim in log decades under a hard cap.** With R = current era's earned nous ÷ horizon line (R ≥ 1, the bar's own rebased measure), claim = min(n × (1 + log₁₀ R), CAP), the scale floored at 1 so an at-threshold reset banks exactly n. CAP is a fixed tuning constant this iteration — one juiced era banks no more than CAP, and past the ceiling resets bank CAP until future work raises it. Pre-break the cap never bites.
- **The prestige door is the only surface.** The completed bar keeps hosting "Prestige and Claim X Arete" with X live (ADR-0038's one-figure discipline holds; no new bar furniture); a one-time beat (visual + toast, tuning) marks the break moment.
- **One new feat: breaking the horizon** — an encourager, accelerating and never gating (ADR-0015). No prestige-ladder feat this iteration; the reset count reads through the door's claim.
- **The horizon line never moves.** The break changes what claiming does beyond it — nothing else. "Eyes on the horizon" keeps its lifetime predicate.

## Consequences

- ADR-0039's flat-base-yield clause is amended; its other clauses (claim on reset only, per-era bar, reset boundary) stand.
- Pre-break there is deliberately no reason to push past the horizon — the intended cadence is reset-ASAP, with each cycle banking more than the last.
- The engine's prestige count becomes economy-bearing state, not just a future surface.
- The break's numbers — purchase price, CAP, the decade coefficient, claim rounding — stay tuning (map fog).
- Parked as a named lever for a future effort: Revolution-Idle-style Infinity-Achievements (reset-counted feats granting power) as the granular replacement if linear-claim Arete ever needs pacing help — on the map's out-of-scope pickup list, never this iteration.
