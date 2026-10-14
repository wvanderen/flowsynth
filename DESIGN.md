---
name: FlowSynth — The Rack
description: Studio-hardware instrument panels for a practice-driven incremental game; hex modules speak in color, panels stay quiet
colors:
  bg: "#0d1122"
  panel: "#141a30"
  panel-soft: "#111627"
  panel-deep: "#0a0e1b"
  line: "#2a3150"
  ink: "#e5e9f5"
  muted: "#99a1c2"
  hue-generator: "#238858"
  hue-oscillator: "#6360d4"
  hue-spacer: "#8a93a8"
  hue-booster: "#1f95b5"
  hue-forge: "#bc9239"
  hue-voice: "#9d7bea"
  hue-conduit: "#d9b84a"
  hue-ritual: "#cc603d"
  charge: "#9affa8"
  nous: "#cbcaff"
  forge-glow: "#eecb82"
  arete: "#b994f5"
  accent: "#cbcaff"
  switch: "#cc603d"
  danger: "#e08a8a"
typography:
  display:
    fontFamily: '"Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", Arial, sans-serif'
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "0.03em"
  headline:
    fontFamily: '"Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", Arial, sans-serif'
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
  title:
    fontFamily: '"Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", Arial, sans-serif'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.02em"
rounded:
  control: "0"
spacing:
  row-gap: "5px"
  column-gap: "12px"
components:
  button-square:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  button-square-hover:
    backgroundColor: "{colors.panel-deep}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  main-switch:
    backgroundColor: "{colors.switch}"
    textColor: "{colors.switch-ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.control}"
    size: "76px"
  goal-bar:
    backgroundColor: "{colors.panel-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "10px"
    height: "64px"
  tooltip-plain:
    backgroundColor: "{colors.panel-deep}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
---

# Design System: FlowSynth — The Rack

## Overview

**Creative North Star: "The Rack"**

FlowSynth renders as a synthesizer instrument: a hex-grid board of panel-standard modules where color is functional — hue names the category, finish names the rarity, light names the charge — surrounded by flat, quiet instrument panels in condensed technical lettering with monospace tabular readouts. The player glances at it mid-practice; every surface is built to be read in a flick of attention, never studied. [Instrument standards](docs/instrument-standards.md) and their pinned prototypes (presentation `eb232c4`, controls sheet `d405ce2`) are authoritative; this file captures the system for generating new surfaces.

The system explicitly rejects the consumer-app voice: rounded controls, nested cards, `<details>` expandables, boxed tooltips, explanatory paragraphs, and mechanics words as product names. Depth is carried by panel tiers and hairlines, never shadows or texture; glow and motion are earned only by charge and live activity. Names come from studio hardware — Poly Expander, Expansion Bays, Rack Extenders — never from game mechanics.

**Key Characteristics:**

- Hexes are the module voice; panels are flat, open, and divided by hairlines
- Color is the board's language; console surfaces stay monochrome but for the vermillion switch
- One four-state grammar everywhere, recognizable without color
- Square-cut controls at zero radius, hairline borders, condensed caps
- Tabular monospace figures for every readout
- Compact name + state + effect readouts; deeper mechanics in a plain tooltip layer

## Colors

The palette is a functional instrument table, not a decorative ramp: every color is bound to a meaning, and the bindings are structural (ADR-0016, amended by the roster's reserved hues).

### Primary

- **Nous Indigo** (`#cbcaff`): the game's main resource and the interactive accent — pale luminous register of the oscillator's hue. Buttons, selection, meter fills, the accent family mixed via `color-mix`.
- **Charge Green** (`#9affa8`): the luminous resource register of the generator hue; patch leads, charge fills, empowerment. Glow and animation belong here first.

### Secondary

- **Switch Vermillion** (`#cc603d`): the console's one colored element — the Enter/Exit main switch, its dim state `#96562f`, the live session strip, RITUAL's hue. Bright = session live; dim = idle.
- **Arete Violet** (`#b994f5`): the prestige resource's own register, producing from no category. Wears every Arete surface; derivatives mix from the one token.

### Tertiary

- **Category hues** — generator `#238858`, oscillator `#6360d4`, spacer `#8a93a8`, booster `#1f95b5`, forge `#bc9239`, silent voice `#9d7bea`, charge conduit `#d9b84a`, ritual `#cc603d`. Mid-lightness, full-chroma LED registers; hue = category, per-type identity rides the glyph and nameplate. Every hue is paired with a glyph — colorblind safety is structural.
- **Rarity finishes** — common `#b4bdd8`, uncommon `#7fd0a8`, rare `#b39cf2`: engraved ring count plus a faint plate tint (4–14% mixed over the hex face). Never glowing, never a category hue.
- **Chord annotations** (eleven hues in `src/ui/theme.ts`) name the seams — annotation, never category; they never ride a module face.
- **Goal palette** (six tokens, vermillion default): the GOALS face's swatches, worn by goal banner bars and tracks wherever a goal renders.

### Neutral

- **Background** (`#0d1122`): the dark indigo-blue substrate beneath everything.
- **Panel** (`#141a30`) and **Panel Soft** (`#111627`): the two resting instrument-panel surfaces; **Panel Deep** (`#0a0e1b`) for wells, sheets, and pressed states.
- **Ink** (`#e5e9f5`): cool near-white text and glyphs.
- **Muted** (`#99a1c2`): secondary text, idle marks, unavailable-state labeling.
- **Line** (`#2a3150`, soft `#222841`, strong `#414a75`): the hairline rule family that divides every panel.
- **Danger** (`#e08a8a`): destructive actions and warnings, faint-mixed for washes.

### Named Rules

**The Register Rule.** A reserved resource hue anchors its producing category: modules wear the saturated LED register; the resource wears the luminous glow register of the same hue — generator ⇄ charge green, oscillator ⇄ nous indigo.

**The Monochrome Console Rule.** The console is graphite and ink; color is the board's language. The vermillion switch — and its session-strip expression — is the sole exception.

**The Finish Rule.** Rarity is a finish, not a color: engraved rings plus a faint plate tint, never glowing, never taking a hue.

**Glow is Charge.** Glow and motion are for charge and live activity only. Idle panels stay quiet; an animated element means something is live.

## Typography

**Display / Headline / Title Font:** "Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", Arial — the condensed technical face.
**Body Font:** system sans (`-apple-system, BlinkMacSystemFont, Segoe UI`).
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas` — tabular figures.

**Character:** Three faces, three jobs — condensed caps name and command, monospace figures measure, the plain sans carries notes and longer mechanics. No display/body pairing games; the hierarchy is weight, case, and tracking on one condensed voice.

### Hierarchy

- **Display** (600, 40px/1.05, +0.03em): the chord sheet's stage name — the one large moment, reserved.
- **Headline** (600, 19px/1.2, +0.06em, uppercase): the focus name and sheet titles.
- **Title** (600, 13px/1.2, +0.05em, uppercase): control labels, buttons, nameplates, section heads.
- **Body** (400, 14px/1.5): notes, longer mechanics, tooltip glosses when a sentence is unavoidable.
- **Label** (400, 11px mono, +0.02em, tabular): every figure, readout, and unit — rates, prices, clocks, chips. Micro-labels run 8–10px mono caps at +0.08–0.16em.

### Named Rules

**The Tabular Rule.** Every figure that can change renders in monospace with `font-variant-numeric: tabular-nums`. Readouts hold their size — layout never shifts as numbers tick.

**The Three-Jobs Rule.** Condensed caps for names and controls, mono for numbers, sans for prose. A face used outside its job is a review flag.

## Elevation

Flat by doctrine. Surfaces are flat instrument panels at rest; depth is carried by the panel tiers (bg → panel-soft → panel → panel-deep) and hairline rules, occasionally by clipped outer corners defining a panel's silhouette. The one shadow token (`rgba(2, 4, 12, 0.6)`) serves the sheet/scrim layer (`rgba(5, 8, 19, 0.82)`) — modal sheets detach from the flat panels; ordinary furniture never casts. Charge light is glow, not elevation.

### Named Rules

**The Flat Panel Rule.** If a resting surface needs a shadow to read as a surface, the tier is wrong. Shadows belong to sheets over the board, nothing else.

## Components

Controls are square-cut — hairline border, condensed technical lettering, no radii (the controls sheet `d405ce2` pins the geometry). Every interactive element carries the full state set: muted outline = unavailable, clear outline = available, firm inset marker = selected, engraved mark = acquired.

### Buttons

- **Shape:** square-cut, zero radius, 1px hairline border.
- **Secondary/default:** panel surface, ink text, condensed caps 13px/600 (+0.05em), ~7×14px padding; hover drops to panel-deep; transitions 0.15s.
- **Primary:** the nous-indigo accent fill (`#cbcaff`) with substrate-ink text; reserved for the leading action of its group.
- **Danger:** the danger hue in text/border; destructive actions keep visible confirmation affordances.
- **Focus:** visible keyboard focus everywhere; 44px touch targets on coarse pointers.

### Main Switch

- **Shape:** the console's dominant centered control, square-cut.
- **Live:** switch-vermillion fill, glowing (`switch-glow`), 2.2s breathing animation; **paused:** held, not glowing; **idle:** dim `#96562f`.
- The mode indicator — its state says what the session is doing; the thin session strip along the console's bottom edge is its expression, never a second colored element.

### Goal Bars

- **Style:** vertical columns, fill by height, panel-deep wells, engraved completion mark on done.
- **State:** completion reads without color (engraved mark); each goal wears its chosen palette token.

### Tooltip Layer

- **Style:** floating plain text over the panel — panel-deep at most, hairline at most, no border card, no shadow, no radius. A boxed tooltip violates the open-divisions rule.
- **Copy:** a gloss, not a sentence — term + concrete effect, ~60 characters, one line. It exists only for a mechanic the surface cannot show; visible content is deleted, not relocated.
- **Access:** opens on hover, keyboard focus, and touch; dismissible by Escape and tap-away.

### Hex Module Face

- **Shape:** hexagonal chassis; engraved level and condensed nameplate above, the signature glyph as centered centerpiece, contribution readout beneath, narrow category-colored rail on the face edge.
- **Chargeable exception:** the prominent readout is charge-vs-threshold as a face fill, flashing at threshold crossing.
- **State:** rarity as ring count + plate tint; receiving charge brightens the rail toward the luminous register.

### Panels and Sheets

- **Panels:** flat tier surfaces, hairline internal divisions, aligned rows — never nested cards, never `<details>` boxes. Occasional clipped outer corners on the outer silhouette only.
- **Sheets (catalog, chords, focus):** fixed frames that never resize on face switch; body scrolls under a pinned identity. On phone, 74%-height bottom sheets over the scrim.

## Do's and Don'ts

### Do:

- **Do** keep the instrument standards and pinned prototypes authoritative; this file captures, that file decides.
- **Do** square-cut every control (0 radius, hairline border, condensed caps); use the four-state grammar with its non-color marks.
- **Do** set every readout in tabular mono figures with units; keep the name + state + effect readout compact (`Chords (4/11) +8% ν`).
- **Do** pair every category hue with a glyph, and mutators lead wherever modules and mutators co-list.
- **Do** earn every glow and animation with charge or live activity, and honor `prefers-reduced-motion` with state surviving intact.

### Don't:

- **Don't** round anything — `border-radius` on buttons, pills, chips is the retired consumer voice.
- **Don't** nest cards or ship `<details>` expandables inside panels — open divisions and hairline rules only.
- **Don't** box a tooltip or give it shadow; the layer is floating plain text, and a tooltip that restates visible content is deleted, not moved.
- **Don't** name a purchase with a mechanics word ("First ceiling") — products carry proper names with one effect line.
- **Don't** use SaaS landing grammar: hero metrics, gradient text, eyebrow kickers, identical card grids — none of it belongs on the rack.
- **Don't** texture or bevel — flat-light discipline; the rack is a design language, not a texture budget.
- **Don't** let color alone carry state, and don't spend the console's monochrome on anything but the switch.
