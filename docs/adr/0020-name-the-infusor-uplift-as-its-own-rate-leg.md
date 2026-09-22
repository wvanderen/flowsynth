# Name the infusor uplift as its own rate leg

The live rate breakdown (ADR-0014) folded each infusor's uplift into the touched synthesizer's amplitude, so the monitor could show "the synth grew" but never name the infusor as the cause. The uplift was already exact — the rate multiplied out either way — so the fix is naming, not math: the composite's amplitude gains a third additive leg.

## Decision

```
rate      = (carrier + harmonics + infusors) × Π chord terms × empowerment × achievementBoost
composite = (carrier + harmonics + infusors) × Π chord terms
```

- **Carrier and harmonic legs hold the synths' base terms** — `base rate × power × chord terms`, level and rarity only. The uplift each synth receives from adjacent infusors rides in the **infusors leg**, also uncharged. The three legs sum back to each synth's full amplitude, so every line multiplies out exactly. The split regroups the same factors rather than rebalancing anything: rates are unchanged to floating-point rounding — regrouping can move the last bits, but no balance relationship moves.
- **Charge still empowers whole contributions**: the empowerment leg divides the charged sum back out, and the diminishing-returns curve is untouched (ADR-0014's charge provisions stand).
- **The leg is named only when uplift reaches a synth**: the monitor chip and breakdown grow an Infusors row when `infusors > 0` — an infusor empowering a generator shows nothing — and the session summary lists `infusors +… ν/s` when present.

## Consequences

- **Amends ADR-0014**: the composite's `Σ harmonic terms` becomes base-only harmonics plus the infusors leg, and the breakdown's leg list gains "infusors" between harmonics and chords. The additive-synthesis shape, pitch, chords, and charge provisions stand.
- `CONTEXT.md` is reconciled: Composite and Harmonic term are rewritten for the base/uplift split, and Infusor term joins the glossary.
- Future amplitude effects (the transmit-style infusor remains ADR-0014's named future work) follow the same pattern: their own additive leg inside the same parentheses, named when nonzero.
