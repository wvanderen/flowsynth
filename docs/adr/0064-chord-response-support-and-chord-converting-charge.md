# 0064 — Chord-response support and chord-converting charge

Date: 2026-10-15
Status: Accepted
Issue: #375 (parent #366)

## Context

The booster category granted amplitude only, and the oscillator category's
alternative charge behaviors had one shape: the Blaster's conversion into
its own synth term (ADR-0048). The parent's accepted sample names the
chord-centered pair that opens the remaining axes: the Chorus, a booster
"improv[ing] chord response; no amplitude bonus and no benefit without an
active chord", and the Sideband, an oscillator whose "charge improves
chord response instead of direct empowerment", over "weak standalone
production". The parent's contract fixes the algebra: each booster has one
primary effect; contributions to the same response term add; distinct
terms interact per the authoritative production contract; received charge
strengthens a booster's own primary effect; and an alternative charge
never grants both effects at once.

## Decision

1. **The chord response is a booster primary effect.** The Chorus authors
   `chorusBonus` (0.5, provisional) and grants it to every adjacent
   oscillator — coverage as the Booster's and the Field's, the term
   different. The grant lands on the recipients' chord-response term and
   never on the amplitude leg, so a Chorus is inert by construction
   without an active chord (the response scales only named-instance
   bonuses) and adds nothing to any board's composite on a chordless
   board. Same-term grants add: two Choruses beside one voice contribute
   ×1.0 of response between them.

2. **The effective response is one engine read.** The chord pass reads a
   per-voice effective chord response the rate pass computes: the authored
   coefficient, scaled by the Sideband's charged conversion, plus the
   Chorus grants. The capacity allocator receives the same figure in its
   per-voice params, so the certified objective prices exactly the
   response production applies — allocation, previews, committed
   placement, and readouts all ride the one read.

3. **Charge converting into chord response replaces empowerment.** The
   Sideband (rare, per the accepted sample) authors a `chordConversion`
   profile flag beside the Blaster's `chargeConversion`: received charge
   scales its authored chord response by 1 + the conversion curve — ×1
   uncharged, ×2 at the asymptote — and its charge factor reads exactly
   ×1, always. No second empowerment pass, and no chordless harvest: with
   no active chord the conversion has nothing to strengthen, so a charged
   chordless Sideband earns exactly its uncharged value. The charge axis
   takes the absent mark; the replacement is stated in the disclosure
   words (the effect line and the role), as the Blaster's is.

4. **Received charge strengthens the Chorus's own primary effect.** The
   grant rides the continuous-charge curve over the Chorus's own received
   strength × its host power, exactly as every booster's grant does
   (ADR-0063's law, one axis over). Mutators keep their families: power
   scales the grant through the host power, resonance multiplies the
   boosted chord factor and stays inert chordless, charge feeds the
   Sideband's conversion through the strength it receives. Levels, tiers,
   and mutators scale the strengths — never the conditions or the
   proportions.

## Consequences

The roster gains its first rare and third uncommon entries, so the roll's
uncommon band holds three designs and the rare band one. Chord-centered
builds gain a support module and a producer whose charge compounds per
chord instance — on rich charged boards the Sideband's seat passes every
non-specialist producer, while the charged Triangle keeps the chord crown
and chordless boards leave the Sideband behind at its D-weak base.
Coefficients, rarities, and the demonstration boards are provisional
tuning under the parent (#366); balance work may retune every figure
without touching this contract.
