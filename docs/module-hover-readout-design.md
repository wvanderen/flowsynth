# Module hover readout design

Confirmed 2026-10-12 through the design interview. This is the implementation brief. Implemented in the module/seam hover readout.

## Intent and priorities

Help the player judge a hovered module's contribution in one glance, without decoding several visually identical indicators.

1. Honest local output and active effects come first.
2. Stable placement and aligned typography make the relationship between figures immediately readable.
3. Capacity and exceptions remain discoverable without competing with output.
4. Detailed diagnosis belongs in Hex detail; placement keeps its complete projection.

## Non-goals and one-place rules

Do not add floating labels over individual modules, enclosing cards, new module-category summaries, explanatory paragraphs, or new interaction doors. Do not change production, allocation, chord recognition, or placement semantics.

Within ordinary module hover, final output appears once, each active chord instance appears once, and inactive instances appear only as their aggregate count. The aggregate chord multiplier, measured-quality scale, and individual idle names belong to the fuller Hex detail rather than the hover summary. Placement preview remains a separate context with its required complete figures. In Hex detail, output stays on the module face and is not repeated in the chord row.

Use the canonical [domain vocabulary](../CONTEXT.md): Chord readout, Harmonic capacity, Hex detail, and Certified allocation.

## Confirmed intent

- A module hover primarily helps the player judge its contribution to the board. For an oscillator, final nous output leads, with contributing factors subordinate.
- Hover carries a compact summary of important facts. Hex detail carries the complete breakdown.
- The compact summary keeps named active chords, used/available harmonic capacity, and relevant warnings. It omits the aggregate chord multiplier.
- This round changes module and seam hover first. Related readouts may share the revised styling, but Hex detail and placement previews retain their required facts.
- The surface operates within the pinned instrument language in [instrument standards](instrument-standards.md): open divisions, aligned readouts, and a clear type hierarchy.

## Current facts

- The reserved chord readout is one fixed spot beside the board. The scattered impression comes from a vertical stack of differently sized, right-aligned pills.
- Final oscillator output, harmonic capacity, total chord factor, and individual chord terms share the same pill anatomy. A single chord can repeat its multiplier as both a constituent and the total.
- Silent voices disclose chord participation without nous output; spacers disclose chords they conduct. Most other module categories have no current hover readout.
- Hex detail and placement previews share readout builders. Placement preview requirements are separately established by ADR-0054.

## Composition and disclosure

- One open vertical readout occupies the existing reserved spot beside the board. No enclosing pill, panel box, or repeated row boxes. Hover must not shift the grid.
- Final oscillator output is the strongest figure. Named active chord instances follow as aligned name/multiplier rows, retaining their chord hues. Capacity shares the output row as `(used/available)` followed by the canonical chord glyph; status sits beneath in quieter typography.
- Every active chord instance remains represented, including repeated instances. Shipped voices can participate in up to five active chords. A spacer's conducting read is not bounded by voice capacity; it must not silently truncate its active chords.
- Show the applied `Formation ×…` term whenever it differs from ×1. The measured-quality scale belongs in Hex detail, where its distinction from the applied term remains explicit.
- Summarize inactive chord instances as `1 idle` or `2 idle`, omitting the row when there are none. Count instances, not unique names; the individual idle names remain in Hex detail.
- Keep `Allocation uncertified` explicit whenever applicable. State must remain legible without color alone.
- A seam hover names only its own chord and multiplier, with an explicit `idle` state when inactive. It never claims module output or capacity.
- Silent voices retain participation and capacity without a fictitious nous output. Spacers retain their conducting chord read. This round does not introduce hover summaries for other module categories.

## Interaction and responsive constraints

- Preserve current hover lifetime, placement-preview precedence, and Hex-detail entry behavior. Do not add a new hover-only door or require interacting with the summary to obtain critical facts.
- Preserve the reserved location at narrow widths, below the existing phone information strip. Names may wrap within their label column; figures stay aligned and intact. The readout must fit the viewport without shifting the board or intercepting its gestures.
- Opening Hex detail replaces the grid and hides the reserved readout as today. Its complete figures remain available through the existing detail interaction, including on touch devices.
- Typography supplies hierarchy: technical names, monospace tabular figures, quieter state text. Shared styling may change related readouts, but their content and interaction contracts remain intact.

## Contract boundary

ADR-0025's fixed reserved spot and ADR-0036's local output remain authoritative. This brief amends ADR-0054's requirement that a standing voice repeat the placement preview's complete metric inventory: ordinary hover becomes the compact summary; placement preview retains the full projection, and Hex detail retains the fuller chord facts. The amendment is recorded in ADR-0054; its projection and economy requirements remain intact.

No new glossary term is needed. `Chord readout`, `Harmonic capacity`, `Hex detail`, and `Certified allocation` retain their existing meanings in CONTEXT.md. This presentation decision is captured here rather than adding an ADR for a readily reversible layout choice.

## Acceptance

- The supplied one-octave example reads as final output, one named Octave multiplier, and capacity; no duplicate total multiplier remains in hover.
- Check chordless output, silent voice, spacer, repeated active chords, maximum voice capacity, many idle candidates, nonneutral applied formation, measured/applied divergence, uncertified allocation, and active/idle seam hover.
- Confirm Hex detail and placement preview retain their required figures and disclosures, including measured versus applied formation quality.
- Compare desktop and phone captures against the pinned instrument language. Verify provenance, keyboard and touch access to retained disclosures, grayscale state distinctions, and reduced motion where applicable. Record any unavailable check explicitly.

## Evidence

Reviewed the supplied screenshot, current readout code, relevant ADRs, and the locally available pinned prototype source. Implementation verification: `npm run check` passed; the UI project passed 657 tests; the full suite passed 1,273 tests with two skipped. Regression coverage verifies compact output/chord ordering, idle counts, omitted neutral/aggregate metrics, and retention of the complete measured-quality and chord figures in Hex detail after placement.

Desktop evidence was captured from the verified worktree at `http://localhost:5179/?dev`, commit `9f1523fec280feedd2db3fa60ecf7b85e48d3fc9`. The reviewed composition has output hierarchy, aligned rows, quiet capacity, and no repeated pill borders. The independent finish review found the lost dashed silent-participation mark in detailed readouts; a dashed underline restores that non-color distinction.

Phone browser composition is unavailable: both preview resize attempts timed out and disconnected the automation host. Browser keyboard/touch disclosure, grayscale capture, and reduced-motion emulation are also unavailable. The summary adds neither interactive controls nor animation, and the existing disclosure tests pass. The detector reported four pre-existing layout-transition warnings outside the changed styles.

PR #330 review corrections restore the compact capacity, formation, and certification glosses through the existing disclosure layer and remove the enclosing tonal background. Module keyboard focus asks the readout; disclosure controls alone receive pointer input. Updated verification is recorded in [review evidence](evidence/pr-330-review-fixes/README.md).

Spacing refinement requested after review: capacity shares the production headline as `(used/available)` plus the chord symbol. Remove the capacity divider and the desktop disclosure controls’ excess height; formation follows the active chords with the same row spacing. Touch layouts retain their target-height floor.
