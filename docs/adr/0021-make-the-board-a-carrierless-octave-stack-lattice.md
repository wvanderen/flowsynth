# Make the board a carrierless octave-stack lattice

Hands-on playtesting failed to validate the shipped Carrier-centered distance field: a new player had to learn a spatial-origin metaphor — pinned Carrier, pitch as distance, ring arithmetic — before any chord. The geometry, isomorphic-layout, spacer, and chord-feedback playtests (issues #117, #126, #130, #120; 2026-09-23) reversed the geometry leg of issue #29, which had rejected the isomorphic layout.

## Decision

- **Pitch lives in the cell.** The board plays an isomorphic lattice — the **octave-stack** layout, Wicki–Hayden kin, rendered in 12-TET: every cell is an absolute note, each note appearing exactly once per octave; columns read as one note name; the horizontal axis walks the circle of fifths; octaves stack along one direction as playable vertical shapes. The fundamental is nothing — no origin, no carrier. Shapes travel: slide a shape, transpose its chord.
- **The Carrier is deleted** as a module type and as a concept: no pinned origin module, no immovability, no white register, no grant specialness. No module is spatially privileged and nothing must be learned before the first chord.
- **Exactness is explicitly de-prioritized.** Just intonation is off the table as a requirement: the 5-limit Tonnetz and 7-limit lattices were prototyped and rejected — "exact musical correctness matters much less than playing around and making combinations." "Key" is a reading of the columns, not a tuning. Chord feedback and sound need only be perceptible, never exact.
- **Chords are register-free pitch sets** matched by pitch content over connected clusters — not cell shapes and not just-intonation runs. The chord-pair bonus and the JI launch vocabulary die with the distance field.
- **The Spacer is the counterweight.** The octave-stack deliberately puts major/minor thirds out of sequential reach — the accepted cost of dropping exact ratios — so a new silent wire module (its own category, not a synthesizer) conducts chord adjacency through chains of wired cells, making harder chords literally cost more board: ♭7 one wire cell, m3/M6 two, M3/m6 three (counts are lattice geometry; prices are tuning). Typed-interval and fixed-gap spacer models were prototyped and rejected.

## Consequences

- **Supersedes ADR-0014's carrier, pitch-as-distance, chord-pair, and JI-vocabulary legs**; its additive-synthesis skeleton, charge-empowerment curve, board-only clause, and wave clause survive. Supersedes the Carrier provisions of ADR-0013 (granted origin module, pinned, immovable, unsellable), ADR-0016's Carrier-white clause and its pin-marking and bolt consequences, and ADR-0018's opening-triangle leg — the triangle's Carrier-adjacency rationale dies, though the opening still opens on a three-cell footprint (board redesign spec §8). The consecutive-run law and thin-vocabulary analysis were distance-field artifacts and lapse with it.
- **Chord feedback is always-on board annotation** (issue #120): colored hulls and name chips, no chord view — supersedes issue #62's display-only toggle. Sound stays opt-in garnish; this decision carries no further sound-design work.
- The costs consciously accepted and converted into design space: every chord is available at once (pitch is where you buy, so cells no longer gate harmonic depth — the economy re-anchors in ADR-0022), and major/minor triads need wiring rather than falling out of a wedge.
- The octave is playable — vertical pairs, stacked wedges, registers as places — the one economy-relevant shape the folded boards lacked.
- Prototype assets (throwaway branches): `prototype/board-geometry`, `prototype/isomorphic-layout-126`, `prototype/spacer-module-130`, `prototype/chord-feedback-120`.
