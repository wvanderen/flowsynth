---
name: FlowSynth — The Rack
description: Studio-hardware instrument panels for a practice-driven incremental game; hex modules speak in color, panels stay quiet
colors:
  bg: "#111213"
  panel: "#1b1d1f"
  panel-soft: "#17191b"
  panel-deep: "#0d0f10"
  line: "#34383b"
  ink: "#e9eae8"
  muted: "#a4aaa9"
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
  control:
    fontFamily: '"Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", Arial, sans-serif'
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
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
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-square-hover:
    backgroundColor: "{colors.panel-deep}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  main-switch:
    backgroundColor: "{colors.switch}"
    textColor: "{colors.switch-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    size: "44px"
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
- **Rarity finishes** — common `#b4bdd8`, uncommon `#7fd0a8`, rare `#b39cf2`: a faint plate tint (4–14% mixed over the hex face), supplemented by the shared rarity shape marks below. Engraved rings belong to merge tier. Never glowing.
- **Chord annotations** (eleven hues in `src/ui/theme.ts`) name the seams — annotation, never category; they never ride a module face.
- **Goal palette** (six tokens, vermillion default): the GOALS face's swatches, worn by goal banner bars and tracks wherever a goal renders.

### Neutral

- **Background** (`#111213`): the neutral graphite substrate beneath everything.
- **Panel** (`#1b1d1f`) and **Panel Soft** (`#17191b`): the two resting instrument-panel surfaces; **Panel Deep** (`#0d0f10`) for wells, sheets, and pressed states.
- **Ink** (`#e9eae8`): cool near-white text and glyphs.
- **Muted** (`#a4aaa9`): secondary text, idle marks, unavailable-state labeling.
- **Line** (`#34383b`, soft `#292d30`, strong `#555c61`): the hairline rule family that divides every panel.
- **Danger** (`#e08a8a`): destructive actions and warnings, faint-mixed for washes.

### Named Rules

**The Register Rule.** A reserved resource hue anchors its producing category: modules wear the saturated LED register; the resource wears the luminous glow register of the same hue — generator ⇄ charge green, oscillator ⇄ nous indigo.

**The Monochrome Console Rule.** The console is graphite and ink; color is the board's language. The vermillion switch — and its session-strip expression — is the sole exception.

**The Finish Rule (amended 2026-10-18).** Rarity uses a faint plate tint plus a grey circle, green triangle, or blue diamond for common, uncommon, or rare. Category hue stays on category glyphs and rails; merge tier uses rings and Roman numerals. Rarity never glows.

**Glow is Charge.** Glow and motion are for charge and live activity only. Idle panels stay quiet; an animated element means something is live.

## Typography

**Display / Headline / Title Font:** "Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", Arial — the condensed technical face.
**Body Font:** system sans (`-apple-system, BlinkMacSystemFont, Segoe UI`).
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas` — tabular figures.

**Character:** Three faces, three jobs — condensed caps name and command, monospace figures measure, the plain sans carries notes and longer mechanics. No display/body pairing games; the hierarchy is weight, case, and tracking on one condensed voice.

### Hierarchy

The ramp is decided once (issue #353): sizes are steps on it, and steps are **whole pixels — a half-pixel size is drift**. The named stops, large to small:

- **Display** (600, 40px/1.05, +0.03em condensed): the chord sheet's stage name — the one large moment, reserved (24px on the phone's compact stage row).
- **Headline** (600, 19px/1.2, +0.06em, uppercase): the focus name and sheet titles. Modal titles and the drilled detail name take the stop's 19px size; their quieter voices (the modal's sentence case, the detail's sans lead) are those surfaces' own — the ramp fixes the size, not every surface's voice.
- **Control** (600, 15px condensed, +0.02em): the shared control's voice — the base button, face tabs. Prominent ledger figures run 15px mono beside their 15px marks.
- **Readout** (17): the prominent figure voice — board face readouts, ledger row leads, sheet section heads.
- **Title** (600, 13px/1.2, +0.05em, uppercase): control labels, compact buttons, nameplates, section heads.
- **Body** (400, 14px/1.5 sans): notes, longer mechanics, tooltip glosses when a sentence is unavoidable.
- **Label** (400, 11px mono, +0.02em, tabular): every figure, readout, and unit — rates, prices, clocks, chips.
- **Compact** (12, any of the three faces): the dense register — small chips and controls, secondary figures, quiet notes, compact form fields. Recorded here as the ramp's step (issue #353): the stylesheet's most-used size sits on the ramp rather than folding into its neighbors — its uses are genuine compact-register content across all three faces, and folding them would churn dense readouts for no visual gain.
- **Micro band** (8 / 9 / 10 mono caps, +0.08–0.16em): engraved marks, micro-labels, and board chrome words.

**Reserved moments.** A few large reads are the surfaces they headline and keep their own sizes: the display clock (36px mono; 28px narrow, 24px phone — the header-status brief's ladder, amending the old 28/22/20) and the summary's banked-nous figure (34px; 28px phone). Named here so they stay theirs — with them, the list above is the whole ramp; nothing else renders.

### Named Rules

**The Tabular Rule.** Every figure that can change renders in monospace with `font-variant-numeric: tabular-nums`. Readouts hold their size — layout never shifts as numbers tick.

**The Three-Jobs Rule.** Condensed caps for names and controls, mono for numbers, sans for prose. A face used outside its job is a review flag.

**The Whole-Step Rule.** Every font-size in the stylesheet is a step on this ramp, in whole pixels. A half-pixel size is drift; a size off the ramp is a review flag.

## Elevation

Flat by doctrine. Surfaces are flat instrument panels at rest; depth is carried by the panel tiers (bg → panel-soft → panel → panel-deep) and hairline rules, by consistent top-right/bottom-left cuts on floating outer panels. The one shadow token (`rgba(0, 0, 0, 0.6)`) serves the sheet/scrim layer (`rgba(8, 9, 10, 0.82)`) — modal sheets detach from the flat panels; ordinary furniture never casts. Charge light is glow, not elevation.

### Named Rules

**The Flat Panel Rule.** If a resting surface needs a shadow to read as a surface, the tier is wrong. Shadows belong to sheets over the board, nothing else.

## Components

Controls are square-cut — hairline border, condensed technical lettering, no radii (the controls sheet `d405ce2` pins the geometry). Every interactive element carries the full state set: muted outline = unavailable, clear outline = available, firm inset marker = selected, engraved mark = acquired.

### Buttons

- **Shape:** square-cut, zero radius, 1px hairline border.
- **Secondary/default:** panel surface, ink text, condensed 15px/600 (+0.02em), ~9×13px padding; hover drops to panel-deep; transitions 0.15s.
- **Primary:** the nous-indigo accent fill (`#cbcaff`) with substrate-ink text; reserved for the leading action of its group.
- **Danger:** the danger hue in text/border; destructive actions keep visible confirmation affordances.
- **Focus:** visible keyboard focus everywhere; 44px touch targets on coarse pointers.

### Main Switch

- **Shape:** the console's dominant centered control — a chamfered key, square-cut with all four corners cut (the rack's answer to the round key: angle cuts, no curves), carrying the one power glyph in every state. The key rides the pause button's 44px square — one transport rhythm; the hairline is the plate path's own stroke, even on every edge.
- **The word leaves the key:** it reads on a console readout plate on the key's outer side — the key borders the display panel, the plate faces Settings — panel-deep, hairline, tabular mono caps lit in ink (`ENTER FLOW` / `EXIT FLOW` / `END BREATHER`). Sentence case in aria; uppercase in the display.
- **Live:** bright vermillion rim over the deep key face with a steady bottom light; **paused:** held — the same fill, the light rests; **idle:** dim rim, faint face, bright glyph.
- **The mode lamp:** the brand mark's filled core is the console's indicator light — vermillion flow (the one glow, earned by live activity), amber hold, charge-green breather, engraved core at standby. The session strip wears the same state color; the lamp, the strip, and the key's own state share the console's one `data-mode`.

### Display Well

- **Shape:** the Focus door's recessed display (the header-status brief) — panel-deep, 1px hairline border, square-cut; the hypercube badge and wordmark sit on the chassis beside it.
- **Composition:** the full-height display clock leads; the program block follows (habit name in condensed caps — completion's engraved check rides it when the displayed goal is done — caption, the vermillion provisional line while the honesty pool holds); the goal meter closes the well at its right edge.
- **Goal meter:** a vertical LED column, seven square segments lighting bottom-up in the shown goal's palette token; unlit segments engraved, a `·N` mono count for further goals in play, absent when nothing qualifies. The column stays flush at the edge in every state. A display-only tooltip trigger — hover and its own tab stop open the gloss; activation, including touch, opens PLAN with the rest of the door. Coarse pointers get a 44px hit area without widening the visible column.

### Goal Bars

- **Style:** vertical columns, fill by height, panel-deep wells, engraved completion mark on done.
- **State:** completion reads without color (engraved mark); each goal wears its chosen palette token.

### Tooltip Layer

- **Style:** floating plain text over the panel — panel-deep at most, hairline at most, no border card, no shadow, no radius. A boxed tooltip violates the open-divisions rule.
- **Copy:** a gloss, not a sentence — term + concrete effect, ~60 characters, one line. It exists only for a mechanic the surface cannot show; visible content is deleted, not relocated.
- **Access:** opens on hover, keyboard focus, and touch; dismissible by Escape and tap-away.

### Hex Module Face

- **Shape:** hexagonal chassis; engraved level and condensed nameplate above, the signature glyph as centered centerpiece, contribution readout beneath, narrow category-colored rail on the face edge.
- **Chargeable exception:** the prominent readout is charge-vs-threshold as a face fill, a brief rail accent at threshold crossing.
- **State:** merge tier as ring count + Roman numeral, rarity as plate tint + shape mark; received charge uses a restrained green outline; the rail retains its category hue.

### Panels and Sheets

- **Panels:** flat tier surfaces, hairline internal divisions, aligned rows — never nested cards, never `<details>` boxes. Floating outer panels use top-right/bottom-left cuts at every width; docked readouts and controls stay square.
- **Sheets (catalog, chords, focus):** fixed frames that never resize on face switch; body scrolls under a pinned identity. On phone, 74%-height bottom sheets over the scrim.

## Do's and Don'ts

### Do:

- **Do** keep the instrument standards and pinned prototypes authoritative; this file captures, that file decides.
- **Do** square-cut every control (0 radius, hairline border, condensed caps); use the four-state grammar with its non-color marks.
- **Do** set every readout in tabular mono figures with units; keep the name + state + effect readout compact (`Chords (4/11) +8% ν`).
- **Do** pair every category hue with a glyph, and mutators lead wherever modules and mutators co-list.
- **Do** earn every glow and animation with charge or live activity, and honor `prefers-reduced-motion` with fully static charge leads, marks, and illumination.

### Don't:

- **Don't** round anything — `border-radius` on buttons, pills, chips is the retired consumer voice.
- **Don't** nest cards or ship `<details>` expandables inside panels — open divisions and hairline rules only.
- **Don't** box a tooltip or give it shadow; the layer is floating plain text, and a tooltip that restates visible content is deleted, not moved.
- **Don't** name a purchase with a mechanics word ("First ceiling") — products carry proper names with one effect line.
- **Don't** use SaaS landing grammar: hero metrics, gradient text, eyebrow kickers, identical card grids — none of it belongs on the rack.
- **Don't** texture or bevel — flat-light discipline; the rack is a design language, not a texture budget.
- **Don't** let color alone carry state, and don't spend the console's monochrome on anything but the switch.

## Cohesion amendment (2026-10-17)

[ADR-0070](docs/adr/0070-refine-the-rack-around-quiet-practice-and-shared-surfaces.md) amends the historical palette and threshold cue: neutral graphite throughout the shell; a top-right/bottom-left clipped pair on floating outer panels at every width; shared open tabs; steady charge light with a narrow six-second modulation; no broad background or standing chord pulse. Reduced motion is fully static. Meaningful events may receive brief local accents. Existing choices and behavior remain; Focus simplification is parked in [#407](https://github.com/wvanderen/flowsynth/issues/407). The [design workbench](docs/design-workbench.md) compares production surfaces and component states.

## Module-grid amendment (2026-10-18)

Idle chords keep their readout and detail facts but draw no board geometry, including during inspection. Active chords read more clearly at rest; hover, keyboard focus, and touch inspection emphasize related active chords and dim the others. Charging uses a restrained green outline with the category rail and rarity plate preserved; no general face wash or glow. Chargeable threshold fill remains. See the instrument standards for the approved rule.

## Inventory amendment (2026-10-18)

The [confirmed inventory brief](docs/inventory-ux-brief.md) standardizes grey-circle common, green-triangle uncommon, and blue-diamond rare markers across module and mutator surfaces, with accessible rarity words. `Lv.` plus Arabic digits identifies module level; Roman numerals starting at I identify merge tier. Compact rows carry category hex, rarity mark, name, tier, aligned level, and a converging-branches Merge icon. Inventory inspection uses a centered identity glyph with finish and merge rings, and shows name and numeric state once below. The shared inventory stays available in Hex detail, whose enlarged faces support placement and retrieval; Place directly targets the opened cell; retrieval uses dragging into inventory, with no redundant Store/Retrieve button. Inventory overlays Hex detail without shifting its composition. The collapsed browser is a hypercube and stored count.

## Header display amendment (2026-10-19)

The [header-status brief](docs/header-status-brief.md) recomposes the Focus door as a display panel: recessed display well, full-height 36px display clock (reserved-moment ladder 36/28/24, amending this file's ramp), program block, and the selected habit's goal meter as a seven-segment vertical LED column wearing its goal's palette token. The five-bar all-goals banner retires from the header. The provisional line joins the program block in the switch's vermillion. The main logo — unchanged by the inventory amendment — is now provisionally the inventory hypercube with its filled core, adopted dated and cheap to reverse. See the brief for the pick rule and behavior matrix.

## Mode lamp and main-switch key amendment (2026-10-20)

The console's iteration on #441: the main switch rebuilds as a chamfered key — square-cut, all four corners cut, one power glyph in every state — with its word on a console readout plate beside it (`ENTER FLOW` / `EXIT FLOW` / `END BREATHER`; "Finish" retires for "Exit flow"). The switch's own state dot retires: the brand mark's filled core becomes the console's mode lamp — vermillion flow (the one glow), amber hold, charge-green breather, engraved core at standby — and the session strip wears the same state color (vermillion fill, amber frozen, green toward the allowance, empty at standby). The lamp, the strip, and the key share the console's one `data-mode`; the Monochrome Console Rule now reads "monochrome but for the switch and its mode expression" — the amber and green ride the sanctioned goal/charge tokens, and only the live state glows.
