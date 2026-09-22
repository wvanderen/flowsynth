# Module catalog

The living design reference for board modules. Edit freely while developing
new types and game-design concepts — the engine keys and records live in code
(see [Adding a new type](#adding-a-new-type)), and this doc is where the
design thinking lives. The roster table reflects the code as of the last
update; when a type lands, update the table in the same change.

Last updated: 2026-09-21

## Roster

| Key | Name | Nameplate | Category | Hue | Glyph | Symbol | Origin | Face readout |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `carrier` | Carrier | CARRIER | synthesizer | `hue-carrier` (white — sole hue-law exception) | circle with rays | ◉ | Granted at the origin, pinned, never rolled or shelved | `+value` |
| `additive` | Additive Synthesizer | ADDITIVE | synthesizer | `hue-synthesizer` | plus cross | + | Starter shelf (40) and roll pool | `+value`, note `P«pitch»` |
| `conditional` | Conditional Synthesizer | CONDITIONAL | synthesizer | `hue-synthesizer` | saltire cross | × | Roll pool only | `+value`, note `P«pitch»` |
| `focusKeyed` | Focus-Keyed Generator | FOCUS-GEN | generator | `hue-generator` | shield with check | ⌁ | Starter shelf ("generator", 40) and roll pool | `⌁power` |
| `infusor` | Infusor | INFUSOR | infusor | `hue-infusor` | circle with rays | ✳ | Starter shelf (40) and roll pool | `+«%»` |
| `forge` | Forge | FORGE | forge | `hue-forge` | hex prism | ⬡ | Starter shelf (80) and roll pool | `«charge»/«threshold»` (charge register) |

All rollable types roll at 99% common / 0.9% uncommon / 0.1% rare
(`BALANCE.rarityProbability`); rarities combine upward at the Forge.

## Category laws

- **synthesizer** — contributes a harmonic term to the composite; pitch is
  hex distance from the Carrier + 1. Receives charge as continuous
  empowerment.
- **generator** — produces charge (the only producer). The focus-keyed rule
  (ADR-0018): banks a charge window at session end
  (`chargeWindowFraction` = 0.1 of live seconds), spends it during the next
  session's flow.
- **infusor** — no harmonic term; empowers adjacent modules' amplitude
  (`infusorBonus` = 0.2 × power × charge factor per adjacent infusor).
  Receives charge as continuous empowerment.
- **forge** — chargeable (ADR-0012): accumulates received charge toward a
  rolling threshold (initial 60, ×1.5 growth); crossing mints a roll offer.

Composite (ADR-0014): `rate = (carrier + Σ harmonics) × Π chord terms ×
empowerment × achievementBoost`. The live breakdown splits infusor uplift
into its own additive leg — the carrier and harmonic legs read as base
terms — so the chip multiplies out exactly:
`(carrier + harmonics + infusors) × Π chord terms × empowerment ×
achievementBoost`.

## Per-module notes

### Carrier (`carrier`)
The granted origin (ADR-0013): common, pinned at (0,0), immovable,
unsellable. Base term `carrierRate` = 0.1/s — the whole formula in session
one. Sets every cell's pitch globally by distance.

The face marks the pin with panel hardware (ADR-0016): a bare white lock
top-center above the engraved level and three chassis bolts at alternating
corners; a drag attempt refuses with a shake and the pinned sentence.

### Additive Synthesizer (`additive`)
The plain harmonic term: `additiveRate` = 0.05/s × amplitude. On the shelf so
the octave chord (Carrier + adjacent Additive) is teachable in session one.

### Conditional Synthesizer (`conditional`)
Amplitude term plus `conditionalPairBonus` = 0.1 per chord pair it
participates in. Roll-only — the shelf stays four offers.

### Focus-Keyed Generator (`focusKeyed`)
Emits charge at power while flow is live and window time remains; adjacent
receivers only (never charges generators, never itself).

### Infusor (`infusor`)
Empowers neighbors' amplitude, not the composite directly. Charge it to
sharpen its bonus (diminishing-returns curve).

### Forge (`forge`)
Accumulates received charge (`strength × power`) into the shared meter; a
threshold crossing banks a roll offer of three candidates.

## Glyph authoring notes

Signature glyphs are stroke-only SVG fragments (no fill) authored in a
±15 coordinate space centered on (0,0), in `src/ui/icons.ts` (`PATHS`).
On the face they render centered at `FACE_GLYPH_SCALE` (0.8, in
`src/ui/face.ts` alongside the face's nameplate/readout/note offsets),
stroke width 2 (pre-scale), in the category hue. The monitor
(`src/ui/monitor.ts`) reuses the same fragment at stroke width 1.6. Keep
geometry inside ±15 and remember the whole module face shares the hex —
the ±12 box the glyph occupies at 0.8 scale must not fight the nameplate
above or the readout below.

The `moduleSymbol` characters (◉ + × ⌁ ✳ ⬡) are text fallbacks, not the
face artwork.

Known flag: the infusor's glyph is a near-twin of the Carrier's — both
are a circle with eight rays, differing only in radii — while the two
wear cyan and white. ADR-0016 pairs every hue with a glyph, so
differentiate the infusor glyph before ship; log sketch iterations in
[Concepts](#concepts).

Design intent: hand-drawn glyphs, one per type, readable at board scale and
at inventory-tile scale. Log sketch iterations and rationale in
[Concepts](#concepts) until a glyph is settled.

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

1. `src/engine/types.ts` — add to the category union (`SynthesizerType`,
   `GeneratorType`, …) or mint a new category `Category` there.
2. `src/engine/constants.ts` — `CATEGORY_OF`, `MODULE_TYPES` (order is the
   roll pool minus the Carrier), `CHARGEABLE_CATEGORIES` /
   `CONTINUOUS_CHARGE_CATEGORIES` for the charge law, `SYNTH_BASE_RATE` in
   `src/engine/economy.ts` if it harmonics, shelf plumbing
   (`SHELF_TYPES` / `SHELF_MODULE` / `shelfPrices`) if it sells.
3. `src/ui/icons.ts` — `PATHS` glyph and `moduleSymbol` fallback.
4. `src/ui/meta.ts` — `META` name / nameplate short / role.
5. `src/ui/face.ts` — `HUE_TOKEN_OF`; the token must exist in
   `src/ui/theme.ts` and follow the category→hue law (`face.test.ts`
   asserts both).
6. Engine behavior — contribution math in `src/engine/economy.ts`, chord
   participation in `src/engine/chords.ts` if it pitches, actions/rolls as
   needed.
7. Update the roster table above in the same change.
