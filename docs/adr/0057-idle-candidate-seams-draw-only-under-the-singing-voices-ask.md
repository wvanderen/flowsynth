# 0057 — Idle candidate seams draw only under the singing voice's ask

Date: 2026-10-14
Status: Accepted; amends ADR-0052 §4's always-on idle marks
Issue: #355

## Context

ADR-0052 §4 gave every recognized-but-unselected chord a standing board mark — dotted, dim, never pulsing — so the board showed every chord it sings and the active seams dominated. The whisper earned its keep when idle candidates were rare. With the released allocation economy (ADR-0055) nearly every chorded region carries one at capacity one, and the standing dotted work is the board's main noise: the layer stopped reading calm at rest. The 2026-10-14 design session settled the amendment — the chord layer should answer precisely when asked, never as ambient furniture.

## Decision

1. **The idle candidate is asked, not standing.** The grid's chord-marks group draws an idle candidate only while a voice that sings it is asked: pointer hover, keyboard focus (`focusin`), or touch tap on the voice — any module — plus the conducting spacer's containment ask, which reveals the idle candidates its wire conducts (the same `moduleChips` rule its readout reads, #201). Moving from the voice onto a revealed idle seam dismisses the reveal; idle seams never open their own ask or name an individual idle candidate in the transient readout. The ask rides the existing hover question's grammar unchanged; no new gesture, no persistent reveal state, no toggle, and one rule in every mode — flow and upgrade identical, like the seams they join.

2. **The ask reveals the asked voice's candidates whole.** Scope is the ask's module: marks whose `voices` include that module id, never board-wide — and the revealed candidate draws whole (all its seams, or its full note-corner outline) even where its other voices sit. The styling stays in the idle register — the `1.5 4` dash, never pulsing — lifted to the ask weight, the retired selection lift's idle register (~0.45 opacity, 4 width). ADR-0056's solid-earns / dotted-idles path language is untouched.

3. **The reveal is a board-draw question only.** The overlay's mark list stays complete: the reserved readout keeps its "N idle" count under the same ask (issue #334's grammar), and the Hex detail's chord row keeps its per-instance "· idle" chips with no hover live. The `chordReadoutCache` contract holds — no consumer of the mark list is starved by the draw gate. ADR-0054's projected-idle ghosts keep their gesture-scoped promise language unchanged.

4. **The casualty is accepted.** A hidden idle candidate can no longer be hover-asked directly — the voice's ask is the only door, and the per-instance names live one click away in the Hex detail's chord row (#334's disclosure doctrine).

## Consequences

- At rest the board carries no idle marks; hovering a voice with idle candidates shows exactly its own, dotted at the ask weight, and leaving stands them down. Hover changes patch the group in place — the active seams' pulse never restarts.
- The selection lift and chord-fade registers stay retired (#295): the ask weight is borrowed values, not a resurrected layer, and the orphaned `#chord-lift` idle rules leave the stylesheet with the at-rest whisper.
- Suites pin at-rest emptiness, the three ask paths plus containment, reveal scope, and the untouched surfaces (readout count, Hex detail chips, ghosts) in both modes.
