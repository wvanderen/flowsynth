# 0060 — The layer legend stands in every mode; flow reads the layers read-only

Date: 2026-10-15
Status: Accepted; amends ADR-0025's locked-board click answer and the #295-era "flow shows neither legend nor layer" contract
Issue: #387 (parent spec #385)

## Context

The Mutator Grid's layer and its legend were classified as upgrade-mode
furniture (issue #199's doctrine, carried through #295): entering flow
cleared the layer, hid the legend, and reset the board to Modules, because
the board was locked and a locked switch seemed safest out of sight. The
cost was inspection: a player mid-session could not look at the Mutators
layer or flip layers at all without ending practice, and the Hex detail —
already read-only during flow — stood without its shared switch. The
2026-10-15 design session (parent spec #385) settled the amendment: the
lock guards editing, not looking.

## Decision

1. **The legend is every mode's furniture.** The strip renders through
   upgrade, flow, and pause. It remains the one Modules / Mutators switch:
   on the grid it flips the layer, in the Hex detail it emphasizes the
   face, and it synchronizes with both — the grid's layer follows the
   detail's emphasis in every mode, so the return lands on the face the
   player last read. No second switch appears anywhere.

2. **A session reads the layers; it never edits them.** Flow and pause
   alike read the board read-only. With the Mutators layer selected
   mid-session, the board draws the layer's own faces exactly as
   upgrade drew them (issue #386's one-face-per-owned-coordinate
   vocabulary), and an idle slot click opens the Hex detail read-only —
   the same answer the Modules layer's idle click already gave. Every
   editing resolution stands behind the existing mode gates: no placement,
   retrieval, swap, slot unlock, upgrade, or purchase can be armed, and a
   held mutator starts no drag. The engine's refusals are unchanged; the
   UI simply stopped hiding the read-only surfaces.

3. **The locked walk stands down mid-session.** Pre-entry, the legend's
   Mutator symbol stays locked-but-visible during a session, but its click
   no longer walks to the Catalog's entry screen — a purchase surface never
   opens mid-session, and the symbol's own gloss says so ("Arete is spent
   between sessions."). The refusal is the click's whole answer; upgrade
   mode keeps the walk.

4. **Flow entry still lands the board at rest on Modules.** Entering a
   session keeps resetting the layer and unwinding every armed gesture
   (issue #199's entry contract): the session never inherits upgrade's
   arrangement. What changed is only that the legend stands by to switch
   again, read-only, from there.

5. **Return and Escape gain no layer switch.** Closing the detail —
   explicitly or by Escape — restores the grid with its layer, position,
   and zoom exactly as the detail found them; the Esc walk's later
   Modules-step is untouched and only ever reached from the grid.

## Consequences

- `mutatorBoardLive` (mode-independent: entry owned + layer selected)
  drives the body class, the grid's layer ownership, and the faces;
  `mutatorLayerLive` (upgrade-only) keeps driving the edit furniture —
  the tray strip and the unlock pill never ride a session's layer.
- The board's drag entry guards the mode where both drag paths land, so
  the freshly visible session faces cannot start a carry.
- The tray column, tray sheet, and Mutator tray remain upgrade-mode
  surfaces; the small-screen redistribution of legend, dock, and detail
  is the parent spec's separate dependent ticket.
- CONTEXT.md's Layer legend and Mutator Grid entries carry the amended
  contract; suites pin flow layer switching, read-only slot clicks, the
  inert locked walk, and return/Escape restoration mid-session.
