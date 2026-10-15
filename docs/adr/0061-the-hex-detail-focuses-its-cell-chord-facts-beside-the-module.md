# 0061 — The Hex detail focuses its cell: chord facts beside the module, one idle disclosure, local rails only

Date: 2026-10-15
Status: Accepted; amends ADR-0055's chord-row placement and rail scope, and ADR-0057 §3's per-instance idle chips
Issue: #388 (parent spec #385)

## Context

ADR-0055's frameless cross-section kept the chord row beneath the module
face, let Return sit in its own corner band above the stage, listed every
idle candidate as an inline "· idle" chip, and — a leftover of the
pre-#295 bloom — still offered a Catalog entry button on the locked
Mutators face. The costs compounded on dense boards and narrow stages: a
long chord row pushed the faces downward, the corner band spent vertical
space on one control, an idle-heavy readout displaced the earning chips,
and global destination buttons repeated what the surrounding navigation
already carried. Locked Mutator positions, meanwhile, explained their
refusal vaguely ("beside the patch only") where the board's own layer had
learned to name the prerequisite (issue #386). The 2026-10-15 design
session (parent spec #385) settled the refocus: the detail is the
selected cell's stage, the faces are the information voice, and everything
else earns its post.

## Decision

1. **Return floats; the stage keeps its height.** Return and the flow tag
   overlay the scene's top-left corner as quiet furniture — no dedicated
   band above the cross-section. The explicit Return and Escape keep the
   restoration contract untouched: layer, position, and zoom intact.

2. **Chord facts stand in their own column to the module's right.** The
   reserved readout's grammar leaves the faces' section: capacity, total
   chord factor, formation and its scale, and the named active instances
   mount in a column aligned with the Modules face, where width permits.
   Narrow stages reflow the column beneath the stack (the container
   query owns the breakpoint), and the phone sheet takes it as the
   column's last post — the faces and action rows never move to reach
   it, and detailed content scrolls.

3. **Idle candidates hide behind one "N idle" disclosure.** The detail's
   chord facts carry no inline idle list: one dashed, quiet trigger
   counts the candidates, and its body — the shared tooltip layer —
   lists each instance's name and factor. Hover, keyboard focus, and tap
   open it; Escape and tap-away dismiss it; the portaled body shifts no
   layout. The transient reserved readout keeps its plain "N idle" count
   under the ask, and no disclosure is added there (issue #334's plain
   rule stands). ADR-0057 §3's "no hover live" holds in its own sense:
   the board's ask still gates the draw, and the chord row never answers
   it — the facts live behind this one opening instead.

4. **Only cell-specific actions ride the rails.** The Catalog entry
   button leaves the detail — global destinations (Catalog, Forge) stay
   in the surrounding navigation: the dock's and thumb bar's doors, and
   the legend's locked walk. The rails keep the unlock ladder, Add, the
   upgrade band, and the orbiting swap/retrieve gestures.

5. **Locked Mutator positions wear the locked face.** A position the
   growth rule cannot reach yet — not adjacent to an unlocked Mutator
   slot — draws the same muted outline, lock mark, and LOCKED word the
   pre-entry layer lock wears, and its accessible help reads "Unlock an
   adjacent Mutator slot first". Eligible unpurchased cells keep the
   clear outline and the priced unlock; open slots keep the dashed
   chassis. Adjacency still means the patch — an unlocked slot, never a
   merely occupied module cell — and the first-slot exception, pricing,
   and affordability behavior are unchanged.

## Consequences

- The detail's grid gains a third post (stack, rail, chord column);
  read-only flow collapses to two, the reflow and the sheet to one.
  The inventory tray still overlays — opening it reflows nothing.
- ADR-0057 §3's "the Hex detail's chord row keeps its per-instance '·
  idle' chips" is amended: the same per-instance facts remain available,
  one opening away, with no hover live and no board-draw change.
- ADR-0055's composition line ("the chord row beneath the module face")
  is amended by this ADR; the frameless stack, both faces, the return-
  first model, and the one legend are untouched.
- CONTEXT.md's Hex detail and Idle candidate entries carry the amended
  contract; the Hex detail, Mutator, capacity, board, and phone suites
  pin the local-only rails, the floating Return, the column's post and
  reflow, the disclosure's access and dismissal, and the eligibility
  versus affordability distinction.
