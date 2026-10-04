# Module catalog

The living design reference for board modules. Edit freely while developing
new types and game-design concepts — the engine keys and records live in code
(see [Adding a new type](#adding-a-new-type)), and this doc is where the
design thinking lives. The roster table reflects the code as of the last
update; when a type lands, update the table in the same change.

Last updated: 2026-10-04 (wave 5 Note/Goal generators, issue #232)

## Roster

| Key | Name | Nameplate | Category | Hue | Glyph | Origin | Face readout |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `additive` | Oscillator | OSC | oscillator | `hue-oscillator` | bare sine | Opening grant and roll pool | `+value`, note `P«pitch»` |
| `blaster` | Blaster | BLST | oscillator | `hue-oscillator` | bolt-cored sine | Roll pool only | `+value` (0 uncharged), note `P«pitch»` |
| `harmonizer` | Harmonizer | HARM | silent voice | `hue-voice` | diamond (muted tonehead) | Roll pool only | the pitch it sings, note `P«cell»` |
| `echo` | Echo | ECHO | silent voice | `hue-voice` | doubled waves | Roll pool only | the pitch it sings, note `P«cell»` |
| `bend` | Bend | BEND | silent voice | `hue-voice` | kinked line | Roll pool only | the pitch it sings, note `P«cell»` |
| `amplifier` | Amplifier | AMP | conduit | `hue-conduit` | through-flowing chevrons | Roll pool only | `⌁relayed` |
| `spacer` | Spacer | Spacer | spacer | `hue-spacer` | ring window (board) / wire | Roll pool only | `⌇` |
| `focusKeyed` | Focus Generator | FOCUS | generator | `hue-generator` | bolt, bare | Starter shelf ("generator", 40) and roll pool | `⌁power` |
| `noteKeyed` | Note Generator | NOTE | generator | `hue-generator` | bolt, double-line corner mark | Roll pool only | `⌁power` |
| `goalKeyed` | Goal Generator | GOAL | generator | `hue-generator` | bolt, check corner mark | Roll pool only | `⌁power` |
| `infusor` | Booster | BOOST | booster | `hue-booster` | outward chevrons around a center dot | Starter shelf (40) and roll pool | `+«%»` |
| `forge` | Forge | FORGE | forge | `hue-forge` | hex prism | Starter shelf (80) and roll pool | `«charge»/«threshold»` (charge register) |
| `mutatorForge` | Mutator Forge | MUT. FORGE | forge | `hue-forge` | seeded-hexagon core on the chassis | Mutator tree entry | `«charge»/«threshold»` (charge register) |

All rollable types roll at 99% common / 0.9% uncommon / 0.1% rare
(`BALANCE.rarityProbability`); rarities combine upward at the Forge.

## Category laws

- **oscillator** — contributes a synth term to the composite; pitch is the
  cell's own (ADR-0021: cell-owned, never persisted). Receives charge as
  continuous empowerment. Two producer roles (ADR-0048): the Oscillator's
  base term, and the Blaster's charge-sourced term — the conversion curve
  replaces the charge factor, and the Blaster sings and completes chords
  even uncharged at zero output.
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
  its reserve (ADR-0047) and spends 1 s/s of it while deployed. The
  focus-keyed rule (ADR-0018): banks at session end
  (`chargeWindowFraction` = 0.1 of live seconds). The Note Generator
  (issue #232) credits at the written-note fact — the stored text's
  character count × 1 s, 5-minute cap per note. The Goal Generator
  (issue #232) credits at the completion tick — k = 5 × the focus
  equivalent, prorated by the goal's live share. Every console fact
  credits each owned generator of its type, board or tray alike.
- **booster** — no synth term; empowers adjacent modules' amplitude
  (`infusorBonus` = 0.2 × power × charge factor per adjacent booster).
  Receives charge as continuous empowerment.
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

### Oscillator (`additive`)
The plain synth term: `synthRate` = 0.1/s × rarity power. From the opening
grant and rolls, so the first chord is teachable in session one.

### Blaster (`blaster`)
The oscillator category's second producer role (ADR-0048): converts
received charge into its synth term with the conversion curve
`strength/(1+strength)` — ×0 uncharged, ×1 at the asymptote — replacing
the charge factor entirely (no second empowerment pass). Chord membership
is structural: it sings and completes chords even uncharged at zero
output, and never starves cellmates (generators never divide output).

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

### Focus Generator (`focusKeyed`)
Emits charge at power while flow is live and its reserve holds; adjacent
receivers only (never charges generators, never itself). Session end
banks 0.1 × credited practice into every owned focus generator — board or
tray alike; prestige resets reserves.

### Note Generator (`noteKeyed`)
The written-note fact's generator (ADR-0047, issue #232): every note
written — in flow or between sessions, tagged or not — credits each owned
Note Generator's reserve the moment it lands, sized by the stored text's
character count (`noteCreditPerChar` = 1 s/char) under the per-note cap
(`noteCreditCapSeconds` = 300). No minimum, no per-day cap, no similarity
detection; notes are append-only, so a future delete never refunds.
Delivery is the family's shared shape — emission, burn, prestige, and
combination behave exactly as the Focus Generator's.

### Goal Generator (`goalKeyed`)
The completion tick's generator (ADR-0047, issue #232): completing a goal
of M minutes banks `goalReserveMultiple` (= 5) × the focus equivalent
(`chargeWindowFraction` × M) into each owned Goal Generator, prorated by
the live share of the goal's progress — manual-only completions bank
nothing, mixed practice banks its live share. Recurring goals credit once
per occurrence; overlapping completions each credit. Delivery is the
family's shared shape.

### Booster (`infusor`)
Empowers neighbors' amplitude, not the composite directly. Charge it to
sharpen its bonus (diminishing-returns curve).

### Forge (`forge`) / Mutator Forge (`mutatorForge`)
Accumulate received charge (`strength × power`) into their branch's
shared meter; a threshold crossing banks a roll offer — module rolls into
the one shared queue, mutator rolls into the Mutator tray.

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
the Focus Generator bare, the Note Generator with a double-line corner
mark, the Goal Generator with a check corner mark (issue #232) — the
Booster's outward chevrons around a center dot, and the Mutator Forge's
seeded-hexagon core on the Forge chassis. The roster wave added the
silent voices and the conduit (issue #229): the Echo's doubled waves (the
octave down it sings), the Bend's kinked line (the ♯/♭ shift), the
Blaster's bolt-cored sine (the charge inside the term), and the
Amplifier's through-flowing chevrons (charge in one side, out the other).
Two spacers' specials: the board face clips as a hexagonal ring window
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
   roll pool), `CHARGEABLE_CATEGORIES` / `CONTINUOUS_CHARGE_CATEGORIES` /
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
