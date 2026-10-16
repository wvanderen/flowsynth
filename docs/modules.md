# Module catalog

The living design reference for board modules. Edit freely while developing
new types and game-design concepts — the engine keys and records live in code
(see [Adding a new type](#adding-a-new-type)), and this doc is where the
design thinking lives. The roster table reflects the code as of the last
update; when a type lands, update the table in the same change.

Last updated: 2026-10-16 (charge-response support — the Exciter, issue #376)

## Roster

| Key | Name | Nameplate | Category | Rarity | Profile axes (base · boost · chord · charge) | Voices | Timing | Hue | Glyph | Origin | Face readout |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `additive` | Sine | SINE | oscillator | common | A · C · B · B | 1 | — | `hue-oscillator` | bare sine | Opening grant and roll pool | `+value`, note `P«pitch»` |
| `blaster` | Blaster | BLST | oscillator | common | A · B · B · — (conversion) | 2 | — | `hue-oscillator` | bolt-cored sine | Roll pool only | `+value` (0 uncharged), note `P«pitch»` |
| `triangle` | Triangle | TRI | oscillator | common | C · B · S · B | 1 | — | `hue-oscillator` | triangle trace | Roll pool only | `+value`, note `P«pitch»` |
| `square` | Square | SQR | oscillator | common | B · S · C · B | 1 | — | `hue-oscillator` | square trace | Roll pool only | `+value`, note `P«pitch»` |
| `saw` | Saw | SAW | oscillator | common | C · B · B · S | 1 | — | `hue-oscillator` | saw trace | Roll pool only | `+value`, note `P«pitch»` |
| `afterglow` | Afterglow | GLOW | oscillator | uncommon | A · B · B · B | 1 | ×0.3 open · ×0.8 from 2 min · ×1.25 sustained from 5 min | `hue-oscillator` | swelling wave | Roll pool only | `+value` (× the current warmup step), note `P«pitch»` |
| `sideband` | Sideband | SIDE | oscillator | rare | D · B · S · — (conversion) | 1 | — | `hue-oscillator` | side-flanked sine | Roll pool only | `+value`, note `P«pitch»` |
| `harmonizer` | Harmonizer | HARM | silent voice | common | — | 1 | — | `hue-voice` | diamond (muted tonehead) | Roll pool only | the pitch it sings, note `P«cell»` |
| `echo` | Echo | ECHO | silent voice | common | — | 1 | — | `hue-voice` | doubled waves | Roll pool only | the pitch it sings, note `P«cell»` |
| `bend` | Bend | BEND | silent voice | common | — | 1 | — | `hue-voice` | kinked line | Roll pool only | the pitch it sings, note `P«cell»` |
| `amplifier` | Amplifier | AMP | conduit | common | — | — | — | `hue-conduit` | through-flowing chevrons | Roll pool only | `⌁relayed` |
| `ritual` | RITUAL | RITUAL | ritual | common | — | — | — | `hue-ritual` | habit-cycle ring | Roll pool only | `×amp` while charged |
| `spacer` | Spacer | Spacer | spacer | common | — | — | — | `hue-spacer` | ring window (board) / wire | Roll pool only | `⌇` |
| `focusKeyed` | Flywheel | FLYW | generator | common | — | — | — | `hue-generator` | bolt, bare | Starter shelf ("generator", 40) and roll pool | `⌁power` |
| `noteKeyed` | Scribe | SCRB | generator | common | — | — | — | `hue-generator` | bolt, double-line corner mark | Roll pool only | `⌁power` |
| `goalKeyed` | Milestone | MILE | generator | common | — | — | — | `hue-generator` | bolt, check corner mark | Roll pool only | `⌁power` |
| `pulsewell` | Pulsewell | PLSW | generator | uncommon | — | — | ×0.5 steady · ×2.5 burst, 30 s every 2 min | `hue-generator` | bolt, burst corner mark | Roll pool only | `⌁power` (× the current cycle factor when emitting) |
| `infusor` | Booster | BOOST | booster | common | — | — | — | `hue-booster` | outward chevrons around a center dot | Starter shelf (40) and roll pool | `+«%»` |
| `field` | Field | FIELD | booster | common | — | — | — | `hue-booster` | doubled outward chevrons around a center dot | Roll pool only | `+«%»` |
| `spotlight` | Spotlight | SPOT | booster | common | — | — | — | `hue-booster` | dot with one focused beam | Roll pool only | `+«%»`, or the inactive verdict |
| `chorus` | Chorus | CHOR | booster | uncommon | — | — | — | `hue-booster` | dot fronting three voice lines | Roll pool only | `+«%»`, note `chord response` |
| `exciter` | Exciter | EXCT | booster | rare | — | — | — | `hue-booster` | dot between two inward charge zigzags | Roll pool only | `+«%»`, note `charge response` |
| `forge` | Forge | FORGE | forge | common | — | — | — | `hue-forge` | hex prism | Starter shelf (80) and roll pool | `«charge»/«threshold»` (charge register) |
| `mutatorForge` | Mutator Forge | MUT. FORGE | forge | common | — | — | — | `hue-forge` | seeded-hexagon core on the chassis | Mutator tree entry | `«charge»/«threshold»` (charge register) |

Rarity is each type's fixed acquisition rarity (`TYPE_RARITY`, ADR-0058) —
authored in code, never rolled per copy. A roll draws the rarity band
(shared `rarityProbability` table), then a type inside the band: the
roll pool's eighteen common types sample uniformly, the uncommon band
holds three designs — the two temporal designs (#372) and the
chord-response booster (#375) — and the rare band holds two — the
Sideband (#375) and the charge-response booster (#376); the Mutator
Forge's common entry joins the pool only with
the roll-pool purchase (ADR-0043). Duplicate
progress lives on the per-copy merge tier: two copies of the same type
and tier combine into one at the next tier, up to the finite unlocked cap
(`mergeCap`, 2 — three tiers, Arete raises it later, #380). The plate
tint and rarity word read the type; the engraved rings read the tier.
Mutator rarity is separate and unchanged (ADR-0043).

The profile axes column (issues #369/#370, ADR-0059) is each oscillator's
fixed aptitude grades over the four comparable axes — base production,
booster response, chord response, charge response — from the absolute
coefficient bands in `src/engine/profiles.ts` (S exceptional, A strong,
B standard, C reduced, D weak, — absent). Grades never re-rank: levels,
tiers, mutators, and live conditions move output, not grades. Types
without authored profiles (every non-oscillator, until their waves land)
show no axes and carry no grade line.

The Voices column (issue #373, ADR-0062) is each type's intrinsic
capacity — the whole-chord seats it owns at zero purchases, authored in
the profile table like the coefficients but never graded. One for every
standard design; the Blaster authors two. A voice's final Harmonic
capacity is its intrinsic seats plus the Poly Expander's shared purchased
rungs, and the Expansion Bays' ceiling clamps the purchases only — so a
two-seat Blaster at a fully purchased standard ladder reads 5 against the
ladder's own reach of 4. Intrinsic seats survive the arete reset with the
module; the readouts show each voice's own used/available figure, a
discrete number, never a letter.

The timing column (issue #372, ADR-0061) is the temporal profiles'
authored curves over the shared session clock — the session's elapsed
active focus time, pauses excluded, reset by every restart. A timing
rule is not a comparable coefficient: it takes no grade, and
presentation says the figures directly. The advance walk splits at every
curve mark, so production is exact across the steps; power (levels,
tiers, mutators) scales around the condition and never moves the timing.


Progression scales a profile whole: purchased levels multiply the type's
whole term by its rarity power (`rarityPower` per level, ADR-0058) and
each merge tier by `tierPower` (×1.5) — every axis together, so the
coefficients' proportions, conditions, and relative weaknesses are the
same at level 0 tier 0 as at level 6 tier 2.

## Category laws

- **oscillator** — contributes a synth term to the composite; pitch is the
  cell's own (ADR-0021: cell-owned, never persisted). Receives charge as
  continuous empowerment, each named type's authored profile (issue #369,
  ADR-0059) scaling the leg's pieces: base production over the unified
  rate, how much of each adjacent booster's bonus the term receives, how
  much of every chord instance's bonus it converts (the formation's Q
  rides outside the response — the chordless ×1.00 contract holds per
  profile), and the multiplier on the charge curve's delta above ×1 —
  plus the type's intrinsic voice capacity (issue #373, ADR-0062)
  authoring its whole-chord seats beside the purchased ladder.
  Producer roles: the four waveform designs (Sine, Triangle, Square, Saw)
  share the base term, the Blaster's conversion curve replaces the
  charge factor entirely — the conversion is the charge, its charge axis
  takes the absent grade — the Sideband (issue #375, ADR-0064) converts
  received charge into its chord response instead (the same replacement
  rule on the chord axis, its charge factor reading exactly ×1), and the
  Afterglow (issue #372, ADR-0061) multiplies the whole term by its
  session-clock warmup step.
- **silent voice** — produces no nous; its derived pitch counts in
  formations (forms and completes chords, conducts as a voice). Category
  trait (ADR-0048): a level-scaled uplift (+5%/LV, tuning) to every chord
  instance's bonus it sings in, additive across silent voices, landing on
  all singing members. Silent voices do not receive charge.
- **conduit** — receives charge and re-broadcasts it onward at received
  strength × a level-scaled gain (+20%/LV, tuning); relayed charge counts
  fully at receivers; a hop-depth cap (4, tuning) guards cycles. Produces
  nothing (ADR-0048).
- **spacer** — silent wire: never sounds, never joins a pitch set,
  conducts chord adjacency through chains of wired cells (ADR-0021).
- **generator** — produces charge (the only producer). Each generator owns
  its reserve (ADR-0047) — a store of charge quantity (issue #371,
  ADR-0060) — and spends it at its emission rate while deployed, reaching
  every adjacent eligible receiver at full strength whatever the neighbor
  count. Each named design reads every practice fact through its authored
  earning profile (`GENERATOR_PROFILES`, issue #371): focus charge per
  credited practice second, banked at session end (reconciliation seconds
  included); note-character and note-creation credit at the written-note
  fact; and a multiple on the goal-completion base at the completion
  tick — the last three immediate. The creation bonus fires once per
  newly created note of at least `noteCreationMinChars` (20, tuning);
  character earning caps per note (`noteCharCreditCap`, 300 charge). The
  Flywheel is focus-heavy (0.1/s), the Scribe note-heavy (1/char + 30
  creation), the Milestone goal-heavy (×5) — modest cross-axes on the
  others — and the Pulsewell (issue #372) is mixed (half of every
  specialist on every axis), delivered on its burst cycle. Every console
  fact credits each owned generator, board or tray alike, at the module's
  power — the same multiplier delivery scales.
- **booster** — no synth term; empowers adjacent oscillators through one
  primary effect per design: amplitude (the Booster 0.2, the Field 0.3,
  the Spotlight 0.5), the chord response (the Chorus 0.5, issue #375,
  ADR-0064 — added to the recipients' chord-response term, never the
  amplitude leg, so it is inert without an active chord), or the charge
  response (the Exciter 0.5, issue #376, ADR-0065 — added to the
  recipients' authored charge response, the conversion types'
  alternatives included, reading nothing on an uncharged recipient) —
  all × power × charge factor per booster, tuning. Support is
  oscillator-only:
  generators, the Forge family, and silent voices read none of it.
  Grants to the same term add. Receives charge as continuous
  empowerment — the charge strengthens the booster's own grant (issue
  #374, ADR-0063). The Spotlight's grant follows the player's selected
  recipient (see its per-module note); every other design spreads to
  all adjacent oscillators.
- **forge** — chargeable (ADR-0012): accumulates received charge toward a
  rolling threshold (initial 60, ×1.5 growth); crossing mints a roll
  offer. The Mutator Forge is the second branch (ADR-0043), its own meter.

Composite (ADR-0014; leg naming per ADR-0020 as amended by ADR-0036 and
ADR-0049): `rate = (synths + boosters) × empowerment × achievementBoost`,
with each producer's chord factor — the formation's named-instance product
× its quality Q — riding its own term. Q is its own named term per member
("Formation ×1.12") in the readout and rate details; chordless formations
sit at exactly ×1.00 (ADR-0049).

## Per-module notes

### Sine (`additive`)
The strong independent producer: full base term (`synthRate` = 0.1/s × the
×1.0 base profile), converting only half of every adjacent booster's bonus.
From the opening grant and rolls, so the first chord is teachable in
session one. The `additive` key predates the profiles and stays the save's
key for the Sine, like `focusKeyed` before it.

### Triangle (`triangle`)
The chord specialist (issue #369): every chord instance's bonus counts
×2.5 toward its term — the formation's Q rides outside the response —
paid for with a reduced base (×0.75). Overtakes the Sine once a rich chord
actually rings; chordless boards are not its home.

### Square (`square`)
The booster-fed producer (issue #369): adjacent boosters' bonuses count
×2.0 toward its term, paid for with a reduced chord response (×0.6) and a
slightly reduced base (×0.9). One charged booster flips it past the Sine;
chord-heavy builds leave it behind.

### Saw (`saw`)
The charge specialist (issue #369): the charged-empowerment delta counts
×3.0 — uncharged it sits at exactly ×1 like everyone, and a steadily
charged board (one adjacent generator's worth of strength or more) flips
it past the Sine — paid for with the lowest uncharged base (×0.7).

### Blaster (`blaster`)
The oscillator category's second producer role (ADR-0048): converts
received charge into its synth term with the conversion curve
`strength/(1+strength)` — ×0 uncharged, ×1 at the asymptote — replacing
the charge factor entirely (no second empowerment pass). Chord membership
is structural: it sings and completes chords even uncharged at zero
output, and never starves cellmates (generators never divide output).
Two intrinsic voices (issue #373, ADR-0062): the category's
representative capacity distinction — the Blaster sings and completes two
voice-sets while every standard voice holds one, paid for by the ×0
uncharged term. Provisional tuning, like every coefficient here.

### Afterglow (`afterglow`)
The session-clocked producer (issue #372, ADR-0061): no authored tradeoff
on the comparable axes — the category's standard base (×1.0, grading A
beside the Sine's identical figure) and standard responses — and the
warmup curve on the shared session clock is the whole identity — ×0.30
for the first two minutes, ×0.80 through minute five, then ×1.25
sustained for as long as the session keeps running. Weak opening, strong
sustained: below the Sine until the board has practiced five minutes,
above it after. The clock is the session's own — pauses never move it, a
restart resets it, and the module holds no private timer, so moving or
re-placing it cannot preserve a phase. All figures are provisional
tuning.

### Sideband (`sideband`)
The chord-centered alternative charge (issue #375, ADR-0064): received
charge scales its authored chord response — ×2.0 uncharged (S strong,
second only to the Triangle), toward ×4.0 at the conversion curve's
asymptote — instead of applying any empowerment: its charge factor reads
exactly ×1, always, and its charge axis takes the absent mark. The
D-weak base (×0.5) is the whole price: chordless boards leave it behind
whatever the charge reads, and a charged chordless Sideband earns
exactly its uncharged value — the conversion has nothing to strengthen.
Its niche is the charged chord board: the response compounds per chord
instance, so the richer and the more charged the board, the further it
climbs — past the generalists from one generator's strength, past the
Saw's flat empowerment on rich boards from two generators' strength,
while the charged Triangle keeps the chord crown. Provisional tuning,
like every coefficient here.

### Harmonizer (`harmonizer`)
The plain silent voice (ADR-0048): sings its own cell's pitch, produces
nothing. Transformed in place from the `conditional` at the v8 boundary —
the per-instance chordAmp mechanic died with it. Its level buys the
category's chord-instance uplift.

### Echo (`echo`)
Sings an adjacent voice's derived pitch one octave down — a guaranteed
Octave pairing that doubles the neighbor's chord content without touching
its pitch or readout. Lowest-id adjacent voice when several qualify;
sings nothing when no voice is adjacent; echo chains descend octave by
octave and a cycle sings nothing.

### Bend (`bend`)
Sings its own cell's pitch altered by its player-picked shift — ♯/♭ ±1 at
launch, ±2 joining at rare; the selectable set grows with rarity only
(`BALANCE.bendShifts`). The pick lives on the expanded face and re-pitches
the voice instantly; a shift landing in a vocabulary recipe earns named
value like any voice.

### Amplifier (`amplifier`)
The conduit category's launch member (ADR-0048): receives from adjacent
generators and strictly-lower-hop amplifiers, re-broadcasts at received ×
(1 + 0.20 × level) to its other neighbors. Relayed charge counts fully as
receiving charge everywhere — empowerment, Forge thresholds. The hop cap
(4) bounds chains; equal-depth amplifiers never feed each other.

### Flywheel (`focusKeyed`)
The focus specialist (issue #371, ADR-0060): banks 0.1 charge per
credited practice second at session end — the family's full window —
with modest note (0.2/char + 5 creation) and goal (×1) credit, so
specialized focus practice stays viable without owning the other tools.
Emits at power while flow is live and its reserve holds; adjacent
receivers only (never charges generators, never itself). The
`focusKeyed` key predates the profiles and stays the save's key, like
`additive` for the Sine.

### Scribe (`noteKeyed`)
The note specialist (issue #371): the distinct character coefficient
(1 charge/char, capped at 300 charge per note) and creation bonus (30
charge once per newly created note of at least 20 stored characters —
never on re-saves; notes are append-only), plus modest focus credit
(0.02/s, banked at session end) and a ×1 goal axis. Delivery is the
family's shared shape — quantity emission, prestige, and combination
behave exactly as the Flywheel's.

### Milestone (`goalKeyed`)
The goal specialist (issue #371): ×5 the completion base (the focus
equivalent, prorated by the goal's live share — manual-only completions
bank nothing) at the completion tick, plus modest focus (0.02/s) and
note (0.2/char + 5 creation) credit. Recurring goals credit once per
occurrence; overlapping completions each credit. Delivery is the
family's shared shape.

### Pulsewell (`pulsewell`)
The burst-delivery generator (issue #372, ADR-0061): a mixed earning
profile — half of every specialist on every axis (0.05 focus, 0.5/char +
15 creation, ×2.5 goals) — so mixed practice earns steadily without
requiring or wasting any tool. Delivery rides a two-minute cycle on the
shared session clock: ninety seconds at ×0.5, then a thirty-second ×2.5
burst — an exact ×1.00 average that shapes delivery without adding
charge, and a session always opens mid-steady, so no restart lands a
free opening burst. Faster emission spends the earned reserve
proportionally faster. The clock is the session's own — no private
timer, no movement leverage. All figures are provisional tuning.

### Booster (`infusor`)
Empowers neighbors' amplitude, not the composite directly. Charge it to
sharpen its bonus (diminishing-returns curve).

### Field (`field`)
The broad booster (issue #374, ADR-0063): its moderate share (0.3 ×
power × charge factor, tuning) lands on every adjacent oscillator at
once. Coverage traded against strength — a cluster of producers wants
the Field; a single elite producer does not. The launch Booster shares
this shape at its 0.2 baseline — the shelf's starter, sold before any
roll; separating the pair's niches is explicit balance work under the
parent (#366), not silently decided here.

### Spotlight (`spotlight`)
The narrow booster (issue #374, ADR-0063): a stronger share (0.5 ×
power × charge factor, tuning) lands on the one adjacent oscillator the
player picked — by identity, never by output ranking. The pick lives on
the expanded face (one chip per adjacent oscillator, named by note) and
re-aims the moment it lands. An invalid pick — nothing chosen, the
recipient gone, or adjacency lost — leaves the booster inactive with a
verdict in words on its own surfaces; the pick is remembered and support
resumes when adjacency returns. A melted recipient drops the pick; a
Spotlight merge keeps the surviving copy's own pick. One Spotlight beats
one Field leg; two Field neighbors beat one Spotlight.

### Chorus (`chorus`)
The chord-response booster (issue #375, ADR-0064) — the category's first
design whose primary effect is not amplitude: its share (0.5 × power ×
charge factor, tuning) adds to every adjacent oscillator's chord-response
term and never to the amplitude leg. Inert without an active chord, by
construction: the response scales only named-instance bonuses, so a
chordless board reads the same rate with or without one. Same-term grants
add — two Choruses beside one voice contribute ×1.0 of response between
them — and received charge strengthens the grant itself (the charged
curve over the Chorus's own received strength). A standard voice reads
×1.5 response beside one charged Chorus; the Triangle pairs with it
toward ×3.0. Provisional tuning.

### Exciter (`exciter`)
The charge-response booster (issue #376, ADR-0065) — the category's
second non-amplitude design: its share (0.5 × power × charge factor,
tuning) adds to every adjacent oscillator's authored charge response —
the coefficient that scales the charged curve above ×1 — and never to
the amplitude leg, so it adds neither base production nor a second
charge behavior. It needs charged recipients, structurally: the grant
rides a coefficient the charge curve's delta multiplies, and an
uncharged voice's delta is zero, so no mutator or progression can make
a charge-starved board read differently with one placed. The grant
strengthens whatever behavior the recipient authors — the Saw's ×3
delta deepens toward ×3.5 at one generator's strength beside one
charged Exciter, the Blaster's conversion rides the effective response
on its promoted delta (×0 uncharged preserved), and the Sideband's
charge-to-chord scaling deepens while its charge leg stays exactly ×1.
Same-term grants add, and received charge strengthens the grant itself.
Provisional tuning.

### Forge (`forge`) / Mutator Forge (`mutatorForge`)
Accumulate received charge (`strength × power`) into their branch's
shared meter; a threshold crossing banks a roll offer — module rolls into
the one shared queue, mutator rolls into the Mutator tray.

## Demonstration boards

Two reference boards demonstrating the chord-centered wave's niches
(issue #375). The figures below are the engine suite's own reads on the
provisional coefficients — balance work may retune every number without
touching the shapes.

**The charged chord board (Sideband).** Six voices — C·G across three
octave rows (three stacked Fifth instances per voice, one Octave beside)
— with two generators charging the G column. Uncharged, the Triangle
leads every G seat and the Sideband's D-weak base trails. Charge the
seats and the order flips beneath the specialist: the Sideband's
response compounds per instance (past the Sine from one generator's
strength, past the Saw's flat empowerment once a seat rides two
generators), while the charged Triangle keeps the crown and a charged
chordless Sideband earns exactly its uncharged value. The lesson: charge
is the fuel, chord richness is the multiplier, and neither pays without
the other.

**The chord-response support board (Chorus).** A single Fifth (C4 + G4)
with a Chorus at the shared seat: both voices read the standard ×1.0
response lifted to ×1.5, the Fifth's bonus landing larger on each term —
and the board's composite leg never moves, because the Chorus grants no
amplitude. Remove the chord (either voice to the tray) and the same
Chorus reads exactly the bare rate: inert without an active chord. Swap
it for a Field at the same seat and the amplitude leg moves instead —
+30% to the one adjacent voice's term, no chord term. The lesson: the
Chorus is the piece a chord build buys, and only then.

**The charge-response support board (Exciter).** A single Saw beside one
generator with an Exciter over the pair: the Saw's authored ×3 delta
reads ×3.5 at one generator's strength, the whole gain landing on the
charge leg — the chord and amplitude legs never move. Drain the
generator's reserve and the same board reads the same rate with or
without the Exciter: the grant multiplies a zero delta, so a
charge-starved board gains nothing. Swap the Saw for a Sideband at the
same seat and the deepening lands in its charge-to-chord scaling while
its charge leg holds exactly ×1 — the ordinary and the alternative
behaviors share the one support. The lesson: the Exciter is the piece a
charge-fed build buys, and only while the charge flows.

## Glyph authoring notes

Signature glyphs are stroke-only SVG fragments (no fill) authored in a
±15 coordinate space centered on (0,0), in `src/ui/icons.ts` (`PATHS`).
On the face they render centered at `FACE_GLYPH_SCALE` (0.8, in
`src/ui/face.ts` alongside the face's nameplate/readout/note offsets),
stroke width 2 (pre-scale), in the category hue. Keep geometry inside ±15
and remember the whole module face shares the hex — the ±12 box the glyph
occupies at 0.8 scale must not fight the nameplate above or the readout
below.

The D-set glyph family (issue #219, lifted from
`prototype/module-identity-glyphs`) settled the launch marks: the
Oscillator's bare sine, the Harmonizer's diamond, the generators' bolt —
the Flywheel bare, the Scribe with a double-line corner
mark, the Milestone with a check corner mark (issue #232; named in
issue #371) — the
Booster's outward chevrons around a center dot, and the Mutator Forge's
seeded-hexagon core on the Forge chassis. The roster wave added the
silent voices and the conduit (issue #229): the Echo's doubled waves (the
octave down it sings), the Bend's kinked line (the ♯/♭ shift), the
Blaster's bolt-cored sine (the charge inside the term), and the
Amplifier's through-flowing chevrons (charge in one side, out the other).
The profile wave (issue #369) added the waveform traces: the Triangle's
zigzag, the Square's steps, the Saw's ramps — identity marks for the four
named designs, not mechanically prescribed waveform families. The
temporal wave (issue #372) added the Afterglow's swelling trace (the
warmup curve drawn as its own envelope) and the Pulsewell's burst corner
mark on the generator bolt. The booster wave (issue #374) spoke over the
Booster's dot: the Field's doubled chevrons (the breadth it covers) and
the Spotlight's single beam (the one chosen recipient). The
chord-centered wave (issue #375) added the Sideband's side-flanked trace
(the converted charge riding beside the note, never in it) and the
Chorus's three voice lines fronting the Booster's dot (the choir it
conducts). The charge-response wave (issue #376) added the Exciter's
inward charge zigzags flanking the Booster's dot (the charge responses
it deepens, fed by the charged recipients it needs). Two
spacers' specials: the board face clips as a hexagonal ring window
(chassis minus inner hexagon, nameplate at y −40), and the tray tile
wears an unfilled inner hexagon (`inventoryTileSvg` special case) instead
of the wire glyph.

## Concepts

Scratch space for new types and design ideas — nothing here is implemented
until it moves into the roster table with a landed change.

<!-- Template:
### Concept name (`proposedKey`)
- Category / charge family:
- Harmonic or support role:
- Glyph sketch:
- Balance sketch:
- Notes:
-->

## Adding a new type

The `Record<ModuleType, …>` maps make the type checker enumerate most
touchpoints — add the key and follow the compile errors:

1. `src/engine/types.ts` — add to the category union (`OscillatorType`,
   `SilentVoiceType`, …) or mint a new category `Category` there.
2. `src/engine/constants.ts` — `CATEGORY_OF`, `MODULE_TYPES` (order is the
   roll pool), `TYPE_RARITY` (its acquisition rarity, ADR-0058),
   `CHARGEABLE_CATEGORIES` / `CONTINUOUS_CHARGE_CATEGORIES` /
   `CHARGE_RECEIVING_CATEGORIES` for the charge law, `BALANCE` for its
   magnitudes, shelf plumbing (`SHELF_TYPES` / `SHELF_MODULE` /
   `shelfPrices`) if it sells.
3. `src/engine/chords.ts` — if it sings: a derived-pitch case in
   `voicePitchOf`.
4. `src/ui/icons.ts` — `PATHS` glyph.
5. `src/ui/meta.ts` — `META` name / nameplate short / role.
6. `src/ui/face.ts` — `HUE_TOKEN_OF`; the token must exist in
   `src/ui/theme.ts` and follow the category→hue law (`face.test.ts`
   asserts both).
