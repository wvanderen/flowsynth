# Next-iteration spec: habit specialization, musical modules, and playtest polish

The implementation-ready design for the FlowSynth iteration charted by [Habit specialization and musical modules: next iteration decision map](https://github.com/wvanderen/flowsynth/issues/212). Every contract below traces to a resolved decision ticket and, where one exists, a recorded ADR; the tracker backlog carries the sequence. Numerical balance is provisional tuning throughout — one table, at the bottom, holds every starting magnitude. This spec is the planning handoff; it does not implement the release.

## Scope and release boundary

All seven clusters ship as **one coherent iteration** ([Choose the first release](https://github.com/wvanderen/flowsynth/issues/221)):

1. Habit builds + RITUAL (ADR-0046)
2. Note/Goal generators (ADR-0047)
3. The roster — Harmonizer/Echo/Bend replacing the Conditional, Amplifier, Blaster (ADR-0048)
4. Harmony Q scoring (ADR-0049, #217)
5. The chord discovery library (#218)
6. Module identity — names, glyphs, palette (#219)
7. Playtest polish + the copy policy (#220)

**Not in this release**: a tutorial (surfaces teach under the copy policy; discovery silhouettes pull), starter-shelf changes (unchanged; the scale-back idea stays parked), any new guaranteed offering (all new types arrive through the module-roll pool only), and everything under Deferred work.

## Sequence

Five waves, polish continuous but closing ([#221](https://github.com/wvanderen/flowsynth/issues/221)); the ordered backlog hangs off the assembly ticket [#222](https://github.com/wvanderen/flowsynth/issues/222):

| Wave | Delivers | Contract sources |
|---|---|---|
| 1 | Module identity — renames, glyph family, category palette | #219 |
| 2 | Roster + harmony scoring, carrying the v8 migration | ADR-0048, ADR-0049, #217, #216 |
| 3 | Chord discovery library | #218 |
| 4 | Habit builds + RITUAL | ADR-0046 |
| 5 | Note/Goal generators | ADR-0047 |
| 6 | Playtest polish + the copy purge | #220 |

Waves 2–3 stay adjacent: the music stack carries the save migration. Wave 1 is display-layer only and performs no migration; wave 2 performs the iteration's **only** save version bump, front-loading every surface waves 3–5 build on.

## Contracts

### Module identity (#219)

Decided live on `prototype/module-identity-glyphs` (throwaway branch; lift from it).

| Module (was) | Name | Faceplate |
|---|---|---|
| Additive Synthesizer | **Oscillator** | `OSC` |
| Blaster | **Blaster** | `BLST` |
| Infusor | **Booster** | `BOOST` |
| Focus-keyed generator | **Focus Generator** | `FOCUS` |
| Note generator | **Note Generator** | `NOTE` |
| Goal generator | **Goal Generator** | `GOAL` |
| Harmonizer (ex-Conditional) | **Harmonizer** | `HARM` |
| Mirror voice | **Echo** | `ECHO` |
| Shift voice | **Bend** | `BEND` |
| Amplifier | **Amplifier** | `AMP` |
| RITUAL | **RITUAL** | `RITUAL` |

- **Glyphs**: Oscillator bare sine; Blaster square pulse; generators the bolt (Note: double-line corner mark; Goal: check corner mark); Booster outward chevrons around a center dot; Harmonizer diamond, Echo two-node link, Bend kinked arrow; Amplifier double chevron on a lead line; RITUAL the habit-cycle ring around a sustained wave; Mutator Forge chassis with a seeded-hexagon core; Spacer a hexagonal ring window.
- **Category hues**: silent voice → `--hue-voice` `#9d7bea`, charge conduit → `--hue-conduit` `#d9b84a`, RITUAL → `--hue-ritual` `#cc603d` (the switch vermillion — the one habit-keyed board module wears the session color). The renamed categories take their display words from their modules (oscillator, booster); the two new categories keep their working names.
- **Implementation notes carried from the prototype**: `face.ts` bloom `FACE_LAYOUT` glyph −12 / readout 16 (the shipped −7/11 overlaps at bloom scale); the spacer face clips as an evenodd chassis-minus-inner-hex ring with the nameplate at y −40; `inventoryTileSvg` gains the spacer special case (unfilled inner hexagon tile).
- **Renames are display-layer**: storage type keys unchanged, no migration in this wave.

### Roster (ADR-0048)

Foundation: ADR-0021 stands — pitch is cell-owned; every pitch modifier sounds a derived pitch on its own voice.

- **Silent-voice category** (working name): silent pitched modules, no nous, counting in chord clusters — they form and complete chords and conduct as voices. Category trait: a level-scaled uplift to every chord instance's bonus a silent voice sings in, landing on all singing members, stacking additively across silent voices. Differentiated only by pitch source:
  - **Harmonizer** sings its own cell's pitch — **the Conditional transformed in place** (v8 migration); the per-instance chordAmp-on-own-production mechanic dies (supersedes ADR-0036's Conditional clause).
  - **Echo** sings an adjacent voice's pitch one octave down — a guaranteed Octave pairing doubling the neighbor's chord content, touching neither its pitch nor its readout.
  - **Bend** sings its own pitch altered by a player-picked ♯/♭ shift (±1 at launch); the selectable shift set grows with **rarity only**, level scales its uplift like every silent voice.
- **Charge-conduit category** (working name): **Amplifier**, sole launch member — receives charge from generators or other amplifiers, re-broadcasts to its other neighbors at received strength × level-scaled gain. Relayed charge counts fully everywhere (empowerment, Forge thresholds, RITUAL, build effects). Cycle safety by hop-depth cap. Not a generator; produces nothing.
- **Blaster** — the oscillator category's second producer role: converts received charge into its synth term on the existing synths leg (rate equation unchanged). Chord membership is structural (sings and completes chords even uncharged, at zero output); its charge-sourced output takes chord factors and booster uplift, and takes **no second charged-empowerment pass** — the conversion curve replaces the charge factor. Never starves cellmates.
- **Acquisition**: every new type arrives through the module-roll pool only — no new guaranteed offers.
- One honest visual convention marks silent voices as muted participants in hulls, seams, and the readout — decided during implementation, kept consistent.

### Harmony scoring (ADR-0049, on the shape of #217; evidence: #216)

Musical quality scores **the connected formation** — the existing chord cluster (oscillators and silent voices sounding; spacers conducting, never sounding), each connected component scored separately — with a symbolic model. Acoustic roughness and composite perceptual predictors are out of scope (the cue is the per-chord just-intonation strum); shared-reference harmonicity is rejected on paper (ADR-0049).

- **Production shape** (#217 stands): each producing member's chord factor is `Π(1 + named bonus per sung instance) × Q` — one Q per formation, applied once per member, chord-sourced production only, exactly ×1.00 when the formation names no chord.
- **The formula**: `Q = clamp(1 + complexity − max(0, tension − A), Qmin, cap)` over the formation's **deduplicated pitch classes** — pair-based symbolic tension by interval class, linear complexity per class past the first, a tension allowance A forgiven to **named** formations before the clamp, and a floor materially below neutral so chromatic density is priced down. (Supersedes #217's never-below-neutral floor.)
- **Readability**: Q displays as its own named term per member ("Formation ×1.12") in the readout and rate details; chips stay names-and-multipliers; displayed figures still sum to the board rate; Q counts toward the Power chord feat's ×2.
- **Stacking**: resonance mutators multiply the whole chord factor including Q (one contract, unchanged wording); voice multiplicity stays untouched for named-chord instances; no register or acoustic terms; no temperament mechanic — the tuning incentive is positional on the circle-of-fifths lattice.
- **The acceptance check is the three-way balance** (below): tense-but-organized and lush organized must each outproduce a clean major triad per voice; the bridged chromatic mass must lose to it.
- Recorded for implementation planning (ADR-0049 consequences): the near-zero floor is blunt against multiplicative stacking (the ×67 hexad voice) — a per-voice stacking cap is the untested alternative lever, not adopted this iteration; subset matching names nearly every 3+-class cluster, so "tension only" lands mostly on two-class accidental pairs; confining Q to named singers is an implementation-tuning option.

### Chord discovery library (#218)

Decided across three prototype rounds on `prototype/chord-library-218` (throwaway; the board-exact glyph math is there to lift).

- **A field guide of class-only cards.** Discovery keys on the chord class alone: the first **live** formation of a class (would-form ghosts never discover) names it forever. Save: `class → { formed, firstFormedAt, rootsHeard }`, an ACHIEVEMENTS-style map on the v8 surface, surviving prestige like the feats ledger.
- **Undiscovered = glyph only**: dashed silhouette with counted wire gaps — no name, no labels, no value, no copy; the roots-heard hairline at the card's bottom edge.
- **Glyph language**: the game's own pointy-top hexes and `boardPoint` mapping (face.ts); voices at canonical cheapest placements; every 2+-voice chord draws the offset-outline polygon (capsule for pairs, hull for 3+); wire gaps render as empty dashed hex outlines; labels carry no accidentals (root wears its note name, other voices their half-step counts — R·4·7, R·10); equal-distance ties break by euclidean closeness to the root. Chord hues ride `--chord-*`; undiscovered and candidate glyphs are hueless.
- **Vocabulary**: all six candidates enter `NAMED_CHORDS` — Suspended fourth (0,5,7), Diminished triad (0,3,6), Augmented triad (0,4,8), Minor seventh (0,3,7,10), Dominant seventh (0,4,7,10), Major seventh (0,4,7,11) — eleven classes with the existing five. Bend ±1 content landing in these recipes earns named value; anything outside bears tension only.
- **Discovery bonus**: +1% per discovered class, permanent (tuning); door on the board ledger beside the feats chip; card = glyph, name, bonus, hairline — nothing else. **Scale the glyph aggressively**; the prototype's 176px box must not survive as a ceiling.

### Habit builds and RITUAL (ADR-0046)

- **A habit build** is a per-habit loadout of build nodes from one shared, habit-agnostic catalog, freely re-pickable (free respec) in upgrade mode. Each habit picks independently; differentiation comes from the picks, not locked classes.
- **Two branches at launch** — charge/Forge progress and nous production — keeping the workout/dev contrast sharp; every chord-touching lever belongs to the harmony contracts above, so the catalog carries no chord nodes.
- **Milestones**: nodes unlock as the habit's credited practice time (live, honesty-credited, and manual-log — the same stream as habit development) crosses them, derived idempotently at load from `habit.seconds` (wave 2's v8 surface; no later version bump). Unlocks are free; the **equip slot count** is the permanent decision point, growing with development. Time buys options; slots force choices.
- **Active-only**: build effects apply while that habit is the session's active habit — never as always-on cross-habit bonuses; unstructured sessions run no build; habit and build are read-only during flow (ADR-0001); builds and unlocks persist through prestige (the ADR-0041 principle: real-life time is never un-earned).
- **RITUAL** — a chargeable-family board module amplifying the active habit's equipped build effects **while receiving charge** (continuous empowerment, the family's synthesizer/infusor mode, not threshold fill). Arrives through the module-roll pool only. Habit-keyed: switch-vermillion hue, habit-cycle ring glyph.
- **The boundary**: ADR-0012 was deliberately revisited and stands unsuperseded — charge never crosses to the console; the module receives charge board-side and reads focus state as input. Manual logs feed time-side milestones only. The compared alternatives (joint time+charge gates, separate pools, charge spend) are rejected.
- The launch node catalog is drafted in the tuning table below — the structure is contract, every magnitude provisional.

### Note and Goal generators (ADR-0047)

- **Each generator owns its reserve**; every console fact credits all owned generators of the matching type, board and tray alike (tray copies hold until placed). Copy-count multiplication is deliberate strategy. The save's player-wide charge-window scalar generalizes to per-module reserve state (v8), which is what ADR-0002 always described.
- **Focus stays as it is**: the Focus Generator banks 0.1 × credited practice time at session end (provisional), live practice only; amplification lives in habit-build nodes (ADR-0046), never in an upgrade path on the fraction. N copies each bank their own window.
- **Note Generator**: every note written — in flow or between sessions, tagged or not — credits output time = linear character count × 1 s, capped at 5 min per note. No minimum, no per-day cap, no similarity detection; notes stay append-only, a future delete never refunds. (Char-count farming, if it shows, gets a diminishing curve — not caps.)
- **Goal Generator**: completing a goal of M minutes banks k × (0.1 × M); recurring goals credit per occurrence; overlapping completions each credit; no size floor. **Manual logs prorate**: completions bank × liveShare — manual-only banks nothing, mixed practice isn't forfeited.
- **Bank at the fact**: note at creation; goal at its completion tick (live or reconciliation); focus at session end (its basis is the session total). Level, rarity, and mutators scale **delivery strength only** — banked duration is flat, never double-counted. Reserves burn 1 s/s during flow even without receivers, reset at prestige, and the consumed module's reserve is forfeited on combination.
- Sizing keys off minutes only; richer goal criteria stay deferred and would carry a nominal-minutes value chosen at creation.

### Playtest polish and the copy policy (#220)

Decided on `prototype/playtest-polish-220` (throwaway; the validated contracts land via the backlog):

1. **Unaffordable face upgrades — zero reads zero**: `+1`→`+0`, `MAX`→`MAX·0` on faces and the dial; every unaffordable tooltip leads with the shortfall ("+0 — 1,240 ν short of one level"). Nothing disables — ADR-0045's partial-by-design stands.
2. **Rate disclosure — the whole ledger is the door**: hover/focus anywhere on the board ledger opens the roster popover, ledger-wide (`min(560px, ledger width)`, `min(76vh, 640px)`); the rate cell loses its inner border and hover fill; the ⓘ ring sits static-transparent, brightening on ledger hover; the global `button`-border leak is dead. Below 760px nothing changes; the ledger hover keeps the synth-row pick wiring.
3. **Forge in flow — sheet locked, not peekable**: the dock button disables in flow; its tooltip carries the live meter read plus the lock reason ("… · 2 banked choices — choices settle between sessions."); banked badge and pip stay visible; the old "pick a cell" toast dies.
4. **Reflection — continuous, ends respond**: the 1–5 range stays, `step=any` (saved ints remain valid — no migration); the engine clamp stores decimals; the rough/great end labels brighten as the thumb nears; history's valence tail keeps its bands.

**Copy policy**: every line of player-visible copy pays for its place with a rule, a cost, a consequence, a lock reason, or an instruction. The test: *what does the player do differently, or know concretely, after reading this?* No answer → delete. Never a second sentence that only softens the first. Audit scope: all player-visible strings in `render.ts`, `ledger.ts`, `mutators.ts`, `meta.ts`, classified keep/purge/rewrite in a table on the polish backlog issue; the purge lands as one copy-only PR. Flagged starters: the Forge flow note (keep the lock reason, drop "the board stays live behind this card"), the Forge upgrade note ("inspect freely" goes; the ✕/Esc instruction stays), the feats lead ("they accelerate, never gate" goes; the rate consequence and pointer stay).

## Persistence and migration (#221)

- **One bump: v7 → v8, one-time in-place migration** (the ADR-0017 pattern; pre-v7 saves keep today's hard-reject). **The life record is never wiped.** Wave 2 carries the whole bump; waves 3–5 only build on its surfaces:
  - Conditional → Harmonizer transformed in place (ADR-0048).
  - The charge-window scalar generalizes to per-module reserve state, mapped onto the sole Focus Generator (ADR-0047).
  - Chord discovery state defaults empty (`class → { formed, firstFormedAt, rootsHeard }`, #218).
  - Build-node unlock derivation defaults from `habit.seconds` (ADR-0046) — computed retroactively and idempotently at load, so earned milestones appear immediately and wave 4 needs no second bump.
- **Reset persistence**: reserves are charge state — note pools, goal reserves, and charge windows reset at prestige. Builds/unlocks, discovery state, and the RITUAL module persist, as do the board's modules, cells, placement, the mutator layer, and the whole life record; levels, nous, and charge reset as today.
- **No tutorial.** Learning happens through existing surfaces under the copy policy, with discovery silhouettes as pull. Pacing (milestone cadence, roll-pool weights) is tuning, not contract.

## Provisional tuning

Every magnitude below is provisional — expected to move; implementation must not treat any of it as contract. The launch habit-build node catalog is drafted here per [#221](https://github.com/wvanderen/flowsynth/issues/221); it is the table's one new content decision, everything else records values already settled as provisional.

| Group | Constant | Provisional value |
|---|---|---|
| Harmony Q | Tension weights by interval class | semitone 1.0 / tritone 0.5 / whole tone 0.2; thirds, fifths 0 |
| Harmony Q | Complexity rate | 0.06 per distinct class past the first |
| Harmony Q | Allowance A / floor Qmin / cap | 0.70 / 0.05 / 1.25 |
| Harmony Q | Named-chord tiers (six new classes) | sus4 0.55 / dim 0.65 / aug 0.65 / m7 0.90 / dom7 0.95 / maj7 1.05 |
| Roster | Silent-voice uplift | level-scaled; start 5%/level, additive across silent voices |
| Roster | Bend shift set | ±1 at launch; rarity ≥ rare adds ±2; each further step at the next rarity |
| Roster | Amplifier gain | level-scaled; start +20%/level over received strength |
| Roster | Amplifier hop-depth cap | 4 |
| Roster | Blaster conversion | the existing charged-empowerment curve as reference, replacing the charge factor |
| Discovery | Bonus per discovered class | +1%, permanent |
| Generators | Focus window fraction | 0.1 × credited practice time |
| Generators | Note credit | 1 s/char, 5 min per-note cap |
| Generators | Goal multiple k | 5 (× the focus equivalent), prorated by live share |
| Generators | Reserve burn | 1 s per live flow second, receivers or not |
| Habit builds | Milestones (credited practice per habit) | 1h, 5h, 15h, 40h, 80h, 150h |
| Habit builds | Equip slots | 1 at first unlock; +1 at 15h, 80h, 150h — max 4 |
| Habit builds · charge branch | Charge tap | +10% Focus Generator window bank (1h) |
| Habit builds · charge branch | Steady conduit | +1 output strength, owned generators (5h) |
| Habit builds · charge branch | Forge hand | +10% Forge progress efficiency (15h) |
| Habit builds · charge branch | Charge tap II | +15% window bank, stacks (40h) |
| Habit builds · charge branch | RITUAL attunement | +25% RITUAL amplification (80h) |
| Habit builds · charge branch | Forge hand II | +15% Forge efficiency, stacks (150h) |
| Habit builds · nous branch | Weights | +5% synth term (1h) |
| Habit builds · nous branch | Pitch ear | +10% named-chord instance bonuses (5h) |
| Habit builds · nous branch | Steady hand | +10% booster uplift (15h) |
| Habit builds · nous branch | Weights II | +10% synth term, stacks (40h) |
| Habit builds · nous branch | Feat resonance | +10% achievementBoost (80h) |
| Habit builds · nous branch | Deep practice | +15% named-chord bonuses, stacks (150h) |
| Polish | Rate popover | `min(560px, ledger width)` × `min(76vh, 640px)` |

All build effects are active-only (while the habit is the session's active habit); stacking entries stack with their base node. Roll-pool weights, roster costs, and rarity scaling are pacing tuning set at implementation.

## Acceptance criteria

**The three-way balance (ADR-0049) — the harmony release gate**, re-runnable from the prototype's harness: a dominant seventh and a major seventh must each outproduce a clean major triad per voice; the bridged C+D♭ chromatic mass must lose to it. Prototyped magnitudes pass (per-voice ×7.09 / ×5.25 / ×1.50 against ×2.35).

**The four polish contracts (#220)** behave exactly as decided at every width the prototype covered; the copy audit table exists on the polish issue with every string classified and every flagged starter resolved; the purge ships as a single copy-only diff; partial purchases still buy what the bank covers everywhere.

**Playtest-ready definition of done** — the next playtest is a failure of balance, not of build, when:

- [ ] A v7 save migrates in place: the Conditional is a Harmonizer, reserves/discovery/build surfaces exist and are empty-or-derived, and the life record is intact; a pre-v7 save still hard-rejects.
- [ ] The board reads the new identity everywhere — names, glyphs, category hues; tray tiles match faces; bloom faces don't collide.
- [ ] A Harmonizer sweetens or tenses its formation; an Echo doubles a neighbor into an Octave without touching its readout; a Bend shift landing in a recipe earns named value; an Amplifier relays charge across a hop-capped chain; an uncharged Blaster sings at zero output and produces when charged.
- [ ] The ledger door opens the field guide: first live formation names a class; undiscovered cards are glyph-only silhouettes at real size; the six new chords enter the vocabulary; the +1%/class bonus reads and sums.
- [ ] A practiced habit unlocks nodes, equips within its slots, and its effects move Forge progress / generator delivery / nous production only while it is active; respec is free; prestige keeps builds.
- [ ] RITUAL, drawn from the roll pool, amplifies the active build while receiving charge and never crosses anything to the console.
- [ ] A note credits owned Note Generators board and tray; a goal completion banks the k× multiple prorated by live share; manual-only banks nothing; reserves reset at prestige.
- [ ] The four polish contracts hold, and every surviving line of copy pays its place.

## Deferred work

- Habit-build progression feeds beyond practice-time milestones (consistency, notes, goal completion) — deferred by ADR-0046; watch that differentiated habits stay worth practicing.
- Starter-shelf scale-back (one-time guaranteed offerings may shrink) — parked by ADR-0046; unchanged this release.
- A per-voice chord-stacking cap as the alternative density lever — recorded, untested, by ADR-0049.
- Richer goal criteria (multi-habit days, sizes) carrying a nominal-minutes value — deferred by ADR-0047.
- A note-deletion affordance (refund-free) — notes stay append-only this iteration (ADR-0047).
- The Tasks app and the activation ladder's first tenant — unchanged deferred vocabulary (CONTEXT.md).
- Any balance work: happens in play, not in this backlog.

## Traceability

| Contract | Decision source | ADR |
|---|---|---|
| Habit builds, RITUAL, the boundary | [#213](https://github.com/wvanderen/flowsynth/issues/213) | ADR-0046 |
| Generator reserves, credit timing, sizing | [#214](https://github.com/wvanderen/flowsynth/issues/214) | ADR-0047 |
| Roster roles, pitch ownership, renames direction | [#215](https://github.com/wvanderen/flowsynth/issues/215) | ADR-0048 |
| Harmony evidence | [#216](https://github.com/wvanderen/flowsynth/issues/216) (research artifact on `research/musical-harmony-scoring`) | — |
| Harmony scoring shape | [#217](https://github.com/wvanderen/flowsynth/issues/217) | ADR-0036 extended |
| Discovery library | [#218](https://github.com/wvanderen/flowsynth/issues/218) | — |
| Module identity | [#219](https://github.com/wvanderen/flowsynth/issues/219) | — |
| Polish contracts, copy policy | [#220](https://github.com/wvanderen/flowsynth/issues/220) | ADR-0045 upheld |
| Release boundary, migration, waves | [#221](https://github.com/wvanderen/flowsynth/issues/221) | — |
| Harmony formula | [#226](https://github.com/wvanderen/flowsynth/issues/226) | ADR-0049 |
| Ordered backlog | [#222](https://github.com/wvanderen/flowsynth/issues/222) and its children | — |

Upheld without change: ADR-0001 (habit fixed at session start), ADR-0002 (module-owned charge), ADR-0004 (distinct roles), ADR-0012 (the board/console seam), ADR-0021 (cell-owned pitch), ADR-0041 (practice-earned rolls), ADR-0045 (partial bulk upgrades). Superseded: #217's neutral floor (by ADR-0049), ADR-0036's Conditional clause (by ADR-0048).
