# Annotate chords with the prototype's seams and a reserved readout

The board-redesign spec §6 decided always-on chord feedback: a colored outline hull and a name chip on every formed chord, the chip always visible. Building it (issue #137, 2026-09-26) and playing the result crossed three departures, each confirmed hands-on with the dev panel's synthesizer grant. This ADR records them as decided; the spec's §6 is rewritten in the same change.

## Decision

- **The prototype's seam language replaces hulls** (prototype #120): a two-voice chord draws chord-colored trimmed seams center-to-center between its adjacent voices; a chord the seams can't carry — three or more voices, or a spacer-bridged pair — draws a single offset outline — the prototype's triangle — rendered **under the modules**, its edges running straight through the gaps between faces just off the plates' facing edges (`apothem + 2.5`), its corners bevel-cut at `module radius + 8` so they only just poke past. A plain offset of a 60° corner spikes to twice the pad; the bevel is the tuned cut.
- **The name chip is not ambient**: it lives in a **reserved readout** beside the board — the board heading's right end, an absolutely positioned overlay layer, so it can never reflow the grid and never sits under the expanded face. The readout lists **every chord the module earns its bonus from**: the selected module's chords pin it; hovering a seam asks that chord; hovering a module asks all of its chords. Chips carry the ×multiplier always and the live ν/s contribution during a session.
- **Selection is the only emphasis**: the selected module's chords keep the focus register (wider stroke), every other chord fades; nothing dims chordless modules.
- **Flow pulse**: in a live session the seams and outlines pulse, each chord on its own period — the prototype's rhythm table. The board stays locked per the standing constraints, and clicking a module answers the lock ("The board is locked during flow.") instead of half-selecting: no selection, no bloom attempt mid-session.
- **Ghosts stay over the modules**: would-form previews draw dashed seams or outlines on top, each with its name chip at the would-be chord — the promise is the point, and drop targeting passes through.
- **The flow drone is retired**: sound is the formation strum and the target chime only, both behind the global mute. Any flow ambient soundscape must be designed on purpose before it ships; flow is otherwise silent.

## Rationale

- Ambient chips made every chord talk at once and moved as chords changed; play showed the board reading best with the numbers in one fixed place. The prototype variant the decision cites already hinted at this — its winning frame kept the board to line work.
- Floating chips collided with the expanded face (the bloom overlays the board), and the readout's first in-flow version reflowed the heading row and shifted the grid on hover. The overlay-pinned readout fixes both by construction: outside the board space, participating in no layout pass, above the bloom's layer.
- The outline-behind-modules is the liked prototype look: the cluster's shape reads without covering a single face, and the corners poking past the outer edges keep the triangle legible as a chord rather than a table border.
- Three-voice chords were invisible under the seam-only pass: a bridged triad's voices are not mutually adjacent, so no pair qualified. The outline annotates the whole cluster, bridged or not — which is also when triads form at all (m3 = 2 wires, M3 = 3, per the ADR-0022 ladder).
- The drone carried no information the seams don't, and over a session it grated. Sound stays event-driven: a chord forms (strum), a target hits (chime). Anything sustained is a design project, not a garnish.

## Consequences

- Amends board-redesign spec §6 (rewritten in the same change): "always-on annotation" now means always-on seam and outline line work with on-demand chips in the reserved readout; the drone clause is retired from §6's sound line.
- The retirement ledger gains rows for the ambient chips, the hull rendering, and the flow drone.
- Triad visibility no longer depends on adjacency: the outline wraps bridged clusters, so a spacer-wired triad announces itself the moment it forms.
- The outline's clearances and poke, the seam trims, the per-chord pulse periods, and the readout's placement offsets remain tuning, not spec.
