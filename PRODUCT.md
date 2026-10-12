# Product

Synthesized from the repo's own records: [CONTEXT.md](CONTEXT.md), [ADR-0016](docs/adr/0016-adopt-the-rack-identity.md), the [instrument standards](docs/instrument-standards.md), and the [2026-10-10 retro](docs/retro-2026-10-10.md).

## Register

product

## Users

Players of FlowSynth: people practicing real-life skills (piano, cooking, reading) who run timed flow sessions with the game open beside their practice. They configure the hex board and purchase upgrades in upgrade mode between sessions, and consult a quiet console — clock, notes, goals, habit — while practicing. Sessions are long-lived and calm; the player glances, never studies.

## Product Purpose

An incremental game in which real-life practice drives a configurable hex board of modules — the board is the optimization game, and a console carries the focus tools. Success is production the player can read at a glance (rates, chords, charge) and focus tools that never interrupt the practice they credit.

## Brand Personality

The Rack (ADR-0016): a synthesizer instrument, not a game HUD. Studio-hardware register — flat instrument panels, condensed technical lettering, monospace tabular readouts, engraved markings. Three words: precise, quiet, machined. Color is the board's language (hue = category, rarity = finish, charge = light); console surfaces stay monochrome. The instrument reads as alien-but-legible hardware, system-speak is banned from its voice.

## Anti-references

- Rounded legacy controls — `border-radius` on buttons, pills, chips; the SaaS/consumer-app voice (retired by decision, 2026-10-10; kept only as rejected contrast).
- Nested cards and `<details>` expandables inside panels — open divisions and hairline rules instead.
- Verbose system-speak: explanatory paragraphs for behavior the controls show, tooltips that restate visible content, mechanics words as product names ("First ceiling").
- SaaS landing grammar: hero metrics, gradient text, eyebrow kickers, identical card grids.
- Skeuomorphic textures and fake metal — flat-light discipline, the rack is a design language, not a texture budget.

## Design Principles

- **The pinned prototype is the reference.** Surfaces are built and reviewed against the approved prototype pins in [docs/instrument-standards.md](docs/instrument-standards.md); where a review disagrees with that file, the file wins.
- **Show, don't tell.** No paragraph explains behavior the controls or visuals already display; deeper mechanics live in an earning tooltip layer, and redundant information is cut, not relocated.
- **One state grammar everywhere.** Muted outline = unavailable, clear outline = available, firm inset marker = selected, engraved mark = acquired — recognizable without color alone.
- **Identity rides context.** Hexes speak for modules; surrounding surfaces are flat instrument panels with occasional clipped outer corners as silhouette, never decoration on inner controls.
- **Calm by default.** Glow and motion are for charge and live activity only; reduced motion is respected and state survives without animation.

## Accessibility & Inclusion

State is never color alone (the state grammar's non-color marks); readable text and visible keyboard focus everywhere; 44px touch targets; tooltips open on hover, keyboard focus, and touch, and stay dismissible (Escape, tap-away); `prefers-reduced-motion` honored wherever surfaces animate or glow.
