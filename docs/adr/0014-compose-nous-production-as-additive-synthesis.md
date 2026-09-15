# Compose nous production as additive synthesis

The old formula — `(enter + additive) × (1 + time) × (1 + conditional)` — leaned on focus modules the board no longer hosts. Issues #23 (2026-09-14) and #29 (2026-09-15) decided the replacement: a static additive-synthesis shape with a pinned carrier, pitch-placed harmonics, and named just-intonation chords.

## Decision

```
rate      = composite × empowerment × achievementBoost
composite = (carrier + Σ harmonic terms) × Π chord terms
```

- **Exactly one carrier**: the granted Carrier, pinned to the grid's origin cell, immovable and unsellable — the tuning fork the board is built around, not a piece. At game start the whole formula is the single carrier term; teaching happens by solitude.
- **Pitch** is a synthesizer's harmonic number: hex distance from the carrier + 1 (adjacent sings the 2nd harmonic). Pure hex distance — no relaying; the readout never lies. Cell purchases deepen achievable pitch, coupling the cell economy to formula depth.
- **Chord pairs**: adjacent synthesizers at consecutive pitches each multiply the composite by a small bonus, stacking multiplicatively and uncapped — the board's finite cell budget is the cap. Identical pitches stack amplitude with no chord; skipped pitches are legal, just chordless; bonuses only, no dissonance penalties.
- **Named chords, thin launch vocabulary**: octave 1:2, fifth 2:3, major triad 4:5:6, and blues triad 5:6:7, recognized over free-floating connected clusters of adjacent synthesizers. The carrier sets every cell's pitch globally, but chords need no path back to it — deep chords are free-standing islands. A named chord's term **replaces** its member pairs' bonuses; overlapping named chords (e.g. a 4·5·6·7 run) stack multiplicatively. Because adjacent cells always differ by exactly one ring, every chord is a consecutive run — the textbook minor triad 10:12:15 is geometrically impossible on this board; 5:6:7 is the minor-ish run. Bridge modules that would unlock gapped ratios are deferred future work.
- **Launch synthesizer types**: **Additive** is the plain harmonic term — amplitude at its pitch, full stop. **Conditional** is amplitude plus a bonus per chord pair it participates in — the adjacency legacy re-pointed at chords. All rolled synthesizers are strictly harmonics.
- **Amplitude inputs unchanged**: level and rarity set amplitude; infusors add local bonuses; charge empowers a module's contribution with the existing diminishing-returns curve. Generators, the Forge meter, and cells are out of the formula. The `achievementBoost` term is ADR-0015's.
- **Board-only**: no session-time stage. Session earnings are exactly what the board produced during practice — session rewards are retired (ADR-0012).
- **Waves are the math's shape, not motion in the number**: the rate stays one honest ticking number.

## Consequences

- **Supersedes ADR-0004** while keeping two of its legs: diminishing-returns charge empowerment, and readability-as-constraint. The constraint's enforcement surface is the **live rate breakdown** (carrier, harmonics, chords, empowerment, achievements → rate) and module tooltips; the static formula explainer panel dies in favor of progressive disclosure on the status monitor's formula chip (ADR-0015).
- The carrier's pin supersedes the board-model decision's "freely removable like any copy" provision for this one module (issue #10, amended by #23).
- New synthesizer types (octave/sub carriers, chain-relay pitch, player-chosen waveforms) and the transmit-style infusor remain named future work, extending ADR-0004's readable-mathematical-roles lineage.
- All bonus sizes, the horizon-interaction of pitch depth, and per-type values are tuning, not spec.
