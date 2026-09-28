# Make chord bonuses local

Playing with the reserved readout exposed an honesty gap (issue #153, 2026-09-27): the rate formula multiplied the whole board's amplitude by a single global chord multiplier, so a chord's chip claimed a board-wide +ν/s that included production from modules the chord never touched. A selected module had no honest final figure of its own to show. This ADR records the shape that landed.

## Decision

- **Each chord instance multiplies only its member synthesizers.** Overlapping instances (shared voices) and repeated instances (doubled voices) stack multiplicatively on the voices that sing them; a distant or disconnected module is unchanged. The board-wide `chordMultiplier` and the `composite` leg die with the claim they carried.
- **Every synthesizer carries its own chord factor** — the product of `(1 + bonus)` over every instance it sings in — inside its term. A Conditional keeps its separate per-instance bonus (ADR-0022) on top of the factor; the spacer still conducts and never sounds.
- **A module's final ν/s includes everything local.** The contribution read is `synthRate × power × chordAmp × chordFactor × (1 + infusor) × chargeFactor × achievementBoost`, and the displayed figures sum to the board's rate within rounding. The breakdown still multiplies out exactly: `rate = (synths + infusors) × empowerment × achievementBoost`, with the synths and infusor legs carrying the chord factors.
- **The formula surfaces lose the χ operand.** The Rate cell's equation and the formula sheet read `(synths + infusors) × emp × ach = rate`; the breakdown's Chords row names the terms and their multipliers ("Fifth ×1.3 · Octave ×1.15 ×3") with no board-wide multiplier or +ν/s value. Chord chips everywhere — reserved readout, ghost previews — carry names and multipliers only.
- **The reserved readout leads with the module's final ν/s.** A selected or hovered module's row opens with its final figure — live during flow, present with no chord at all — then its chords' name chips. A chordless module finally has a readout.
- **Power chord asks one voice.** The feat's bar is now a single synthesizer reaching a participating chord multiplier of ×2 — disjoint clusters stacking on separate voices no longer clear it. The id, and every already-earned unlock, persists; the ledger is never re-evaluated downward.
- **Session summaries drop the global chord claim.** The summary's breakdown names the synths leg (local chords included) and the infusor uplift; there is no "chords ×N" row to claim a multiplier the formula no longer applies.

## Consequences

- Supersedes ADR-0022's rate model clause (`rate = (synths + infusors) × Π chord terms × empowerment × achievementBoost`) and board-redesign spec §4's composite line; the leg naming of ADR-0020 survives with chord factors folded into the synths leg.
- Stacking economics change shape: repeated voices now spend their instances on the members that sing them instead of amplifying the whole board, so concentrated chords pay their singers more and their strangers exactly nothing. Balance numbers (bonus tiers) are untouched tuning.
- `analyzeChords` returns per-voice multipliers and participation instead of a board multiplier; the achievements' chord read, the would-form preview, and the chord chips all key off the per-voice view.
- The rate equation is one operand shorter; the Chords breakdown row's value is the named-terms summary itself.
