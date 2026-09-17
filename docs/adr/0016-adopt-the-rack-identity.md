# Adopt the Rack identity

Modules once differed only by logo. The visual effort — references (issue #14), art direction (issue #15, 2026-09-14), the module-face prototype (issue #16, 2026-09-15), and the category taxonomy (issue #22, 2026-09-14) — converged on a concrete direction for the "light futuristic instrument identity" ADR-0008 named but never specified.

## Decision

- **The board renders as a synthesizer rack**: panel-standard hex modules — shared chassis, per-type glyph and nameplate — with charge flowing as glowing patch leads between cells, executed with **flat-light discipline**. No skeuomorphic textures, no fake metal; the rack is a design language, not a texture budget. Anchors: Mutable Instruments' panel standard, The Signal State's leads, Elektron's machine color coding.
- **Three orthogonal color channels**: **hue = category** (the taxonomy's category level; per-type identity rides the glyph and nameplate); **rarity = finish** — engraved ring count (1/2/3) plus a subtle plate tint, never glowing, never taking a hue; **charge = light and motion**.
- **The register rule**: a reserved resource hue anchors its producing category — modules wear the saturated LED register (mid-lightness, full chroma); the resource/state wears the luminous glow register of the same hue. Binds: **generator ⇄ charge green; synthesizer ⇄ nous indigo**.
- **The category hue table** (hexes provisional):

  | Role | Hue | Hex (provisional) |
  |---|---|---|
  | Generator | deep LED green | `#238858` |
  | Synthesizer | deep LED indigo | `#6360d4` |
  | Infusor | LED cyan | `#1f95b5` |
  | Forge | amber | `#bc9239` |
  | Charge light (resource) | luminous green | `#9affa8` |
  | Nous (resource) | pale luminous indigo | `#cbcaff` |
  | Console Enter/Exit main switch | vermillion | `#cc603d` |

  Bright/animated switch = session live, dim = idle. **Yellow and violet stay unbound** for future categories. The **Carrier wears white** — the sole exception to the category→hue law, the neutral register.
- **The console is monochrome** — graphite surface, glyphs, state light; color is the board's language. The Enter/Exit switch is the sole colored exception.
- **Module faces are readout panels** (issue #16, variant C): a prominent contribution readout first, a compact type nameplate, a smaller geometric signature, and a narrow category-colored rail. The chargeable face-hierarchy exception: a chargeable module's prominent readout is **charge-vs-threshold**, rendered as a threshold fill on its face with a flash/pulse at crossing.
- **Charge rendering**: uniform green patch leads, center-to-center, directional — animated in live sessions, dim static routing previews in upgrade mode; a receiving module brightens its rail toward the luminous green register with received strength.
- **Panel language**: geometric synthesis-derived glyphs (waveform, ring, fork — consistent line weight, no literal pictograms), condensed technical caps nameplates, monospace numerals for all readouts. **Every hue is paired with a glyph** — colorblind safety is structural, not a theme variant.
- **Theme architecture**: all colors live in one data-defined **token table** (hue table, substrate, reserved hues); themes are table swaps. The default theme is the dark indigo-blue substrate — bg `#0d1122`, panel `#141a30`, panel-soft `#111627`, lines `#2a3150`, cool near-white ink `#e5e9f5`. The legacy palette is retired.

## Consequences

- **Supersedes ADR-0008's visual-identity provision** — the "light futuristic instrument identity" intent survives ("light" = lightweight, not light-mode), sharpened into this direction — and the current stylesheet's rarity-as-hue coding. Retires the retheme prototype's provisional vermillion infusor fixture (vermillion migrates to the Enter/Exit switch).
- **The monochrome rule's colored set grows by one expression (issue #63, 2026-09-16)**: while a session runs, the console header's bottom-edge session progress strip wears the switch's vermillion. It is the switch's expression at the header's edge — bright with live flow, holding when paused, absent when idle — not a second colored element; upgrade mode stays strictly monochrome.
- Exact glyph art, plate tints, typefaces, and all hexes remain prototype tuning; category assignments and the visual mapping law are the taxonomy decision's record (issue #22).
- Out of scope for this effort: swappable themes, a colorblind-tuned variant, a light theme, and per-source lead tinting (deferred until legibility demands it). The token table and hue-glyph pairing make them cheap later.
