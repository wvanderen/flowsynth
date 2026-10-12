---
name: FlowSynth — Chord readout
description: Scoped record of the built module and seam hover readout
colors:
  accent: "#cbcaff"
  panel-deep: "#0a0e1b"
  line: "#2a3150"
  ink: "#e5e9f5"
  muted: "#99a1c2"
typography:
  title:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "0"
  label:
    fontFamily: '"Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", Arial, sans-serif'
    fontSize: "12px"
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  readout: "0"
spacing:
  row-gap: "5px"
  column-gap: "12px"
components:
  hover-summary:
    backgroundColor: "transparent"
    rounded: "{rounded.readout}"
    padding: "8px 10px"
    width: "220px"
---

# Design System: FlowSynth — Chord readout

## Overview

**Creative North Star: "The Rack"**

This records the built module/seam hover readout and shared detailed-readout styling only. The established instrument is precise, quiet, and machined: open divisions, technical names, and tabular figures. It does not establish a new product-wide visual direction. [Instrument standards](docs/instrument-standards.md) and their pinned prototypes remain authoritative; [the surface brief](docs/module-hover-readout-design.md) owns this readout's content contract.

**Key Characteristics:**

- One reserved reading beside the board.
- Output hierarchy and aligned chord figures.
- Open rows with explicit state text and silent-participation markings.

## Colors

### Primary

The luminous nous accent identifies the module's final production and placement projection. Named chords retain their existing annotation hues from `src/ui/theme.ts`; annotation hues do not become module-category colors.

### Neutral

The board remains visible behind the open readout, the line token separates capacity, and muted ink carries capacity, formation, idle status, and certification. Silent participation also carries a dashed underline; state must remain understandable without hue.

## Typography

Condensed technical lettering names the compact rows; monospace tabular figures align multipliers and carry the strongest final-output reading. The title and label roles above describe this surface, not global heading roles. Detailed figures retain their existing monospace register, with the aggregate chord factor carrying more weight than capacity or certification.

## Layout

The summary is one fixed-width open column constrained to the viewport. Names may wrap within their column; numbers cannot shrink. A quiet rule separates capacity from the active chord rows. Its host stays absolutely positioned beside the board and pointer-transparent; only the existing term-disclosure controls receive pointer input. The readout cannot move the grid.

The existing phone rule places the host below the information strip. Phone composition is unavailable for this round; the CSS constraint is implementation evidence, not a verified phone capture.

## Elevation & Depth

The readout and its rows are transparent, without enclosing borders, shadows, or glow. It adds no motion. Glow and motion remain reserved for charge and live activity under the instrument standards.

## Shapes

Shared text readouts have square corners and no enclosing border. There are no repeated pills or row boxes. The existing measured-quality scale remains a distinct instrument scale with ticks and a firm marker, rather than a text-row container.

## Components

### Compact module summary

Final oscillator output leads. Every active chord instance follows as an aligned name/multiplier row, including repeated instances; harmonic capacity and relevant status follow quietly. Nonneutral applied formation remains visible. Inactive instances appear as an aggregate idle count. Allocation uncertified remains explicit. Silent voices retain participation and capacity without an invented output; spacers retain their conducting chords without a voice-capacity truncation.

### Seam summary

One chord name and multiplier, with explicit idle text when inactive. A seam makes no claim about module output or capacity.

### Shared detailed readouts

The flatter shared row styling also reaches Hex detail and placement preview, but compact-summary omissions do not. Hex detail retains individual idle names, aggregate chord factor, measured quality, and applied formation; module output remains on the face. Placement preview retains its complete required projection. Silent participation retains a dashed underline in these contexts too, restoring the distinction that a zero-width dashed border could not express.

### Disclosure and precedence

Hover lifetime and the existing Hex-detail entry remain unchanged. Placement preview takes precedence in the reserved host; opening Hex detail hides that host. Capacity, Formation, and uncertified allocation retain compact glosses through the shared disclosure layer. Module focus also asks the readout; the disclosure controls support keyboard focus, touch pinning, Escape, and tap-away. Existing detailed mechanic disclosures retain their keyboard-focus and touch contract.

Desktop evidence: [.impeccable/review/module-hover-readout/desktop.png](.impeccable/review/module-hover-readout/desktop.png). Independent finish verdict: ship after the shared silent-participation marker was restored; targeted regressions passed (176 tests). Phone composition, browser keyboard/touch disclosure, grayscale capture, and reduced-motion emulation were unavailable and are not claimed verified.

## Do's and Don'ts

- **Do** keep the instrument standards and pinned prototypes authoritative.
- **Do** align figures, preserve every active instance, and make idle and uncertified states explicit.
- **Do** preserve complete Hex-detail and placement-preview facts when reusing shared styling.
- **Don't** introduce enclosing pills, nested row boxes, or decorative glow in this readout.
- **Don't** repeat the aggregate chord multiplier in ordinary module hover.
- **Don't** treat unavailable browser checks as verified evidence.
