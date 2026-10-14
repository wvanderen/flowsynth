# Product

Synthesized from the repo's own records: [CONTEXT.md](CONTEXT.md), [ADR-0016](docs/adr/0016-adopt-the-rack-identity.md), the [instrument standards](docs/instrument-standards.md) (with the 2026-10-12 controls pin and the 2026-10-14 #334 amendment), and the [2026-10-10 retro](docs/retro-2026-10-10.md).

## Register

product

## Users

Players of FlowSynth: people practicing real-life skills (piano, cooking, reading) who run timed flow sessions with the game open beside their practice. They configure the hex board and purchase upgrades in upgrade mode between sessions, and consult a quiet console — clock, notes, goals, habit — while practicing. Sessions are long-lived and calm; the player glances, never studies.

## Product Purpose

An incremental game in which real-life practice drives a configurable hex board of modules — the board is the optimization game, and a console carries the focus tools. Success is production the player can read at a glance (rates, chords, charge) and focus tools that never interrupt the practice they credit.

## Brand Personality

The Rack (ADR-0016): a synthesizer instrument, not a game HUD. Studio-hardware register — flat instrument panels, condensed technical lettering, monospace tabular readouts, engraved markings. Three words: precise, quiet, machined. Color is the board's language (hue = category, rarity = finish, charge = light); console surfaces stay monochrome. The instrument reads as alien-but-legible hardware; system-speak is banned from its voice — purchases are products, not mechanics.

## Anti-references

- Rounded legacy controls — `border-radius` on buttons, pills, chips; the SaaS/consumer-app voice (retired by decision, 2026-10-10; kept only as rejected contrast).
- Nested cards and `<details>` expandables inside panels — open divisions and hairline rules instead.
- Boxed tooltips and interactive terms in transient readouts — the tooltip layer is floating plain text, and the transient chord readout carries no disclosures at all (#334).
- Verbose system-speak: explanatory paragraphs for behavior the controls show, tooltips that restate visible content, mechanics words as product names ("First ceiling").
- SaaS landing grammar: hero metrics, gradient text, eyebrow kickers, identical card grids.
- Skeuomorphic textures and fake metal — flat-light discipline, the rack is a design language, not a texture budget.

## Design Principles

- **The pinned prototypes are the reference.** Surfaces are built and reviewed against the approved pins in [docs/instrument-standards.md](docs/instrument-standards.md) — the presentation prototype and the controls sheet — where a review disagrees with that file, the file wins.
- **Show, don't tell.** No paragraph explains behavior the controls or visuals already display; deeper mechanics live in an earning tooltip layer, and redundant information is cut, not relocated.
- **One state grammar everywhere.** Muted outline = unavailable, clear outline = available, firm inset marker = selected, engraved mark = acquired — recognizable without color alone, and every hue is paired with a glyph.
- **Purchases are products, not mechanics.** Every purchasable thing carries a terse proper name from the studio-hardware register with one concrete effect line; mechanics words never lead a name.
- **Mutators lead.** Wherever modules and mutators co-list — board tabs, tray switch, inventory, every shared list — the mutator face stands first.
- **Identity rides context.** Hexes speak for modules; surrounding surfaces are flat instrument panels with occasional clipped outer corners as silhouette, never decoration on inner controls.
- **Calm by default.** Glow and motion are for charge and live activity only; reduced motion is respected and state survives without animation.

## Accessibility & Inclusion

State is never color alone (the state grammar's non-color marks, the hue–glyph pairing); readable text and visible keyboard focus everywhere; 44px touch targets; tooltips and disclosures open on hover, keyboard focus, and touch, and stay dismissible (Escape, tap-away); `prefers-reduced-motion` honored wherever surfaces animate or glow.
