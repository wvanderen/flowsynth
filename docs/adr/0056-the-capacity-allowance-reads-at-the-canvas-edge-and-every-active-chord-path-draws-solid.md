# 0056 — The capacity allowance reads at the canvas edge, and every active chord path draws solid

Date: 2026-10-14
Status: Accepted; §3 retires the dashed silent-voice path styling that ADR-0052 §4 drew from ADR-0048's muted-participant convention
Issue: #333

## Context

The released allocation economy (ADR-0055) spends the per-voice whole-chord allowance on every tick, but the only standing read of it was local: a voice showed `(used/available)` in the reserved readout while hovered or selected, and nowhere else. A player arranging the board could not see the allowance their placements must fit — the figure lived behind a hover. The same pass left the board's path language carrying two distinctions: idle candidates drew dotted and dim (ADR-0052 §4), and any chord a silent voice sang in drew dashed and quiet — ADR-0048's muted-participant convention riding the seams. The 2026-10-13 play-feedback interview confirmed the amendment: the allowance should read persistently at the canvas edge, the selected voice's usage stays local, and the dashed silent-voice styling goes — solid means earning, dotted means idle, and silent-voice identity stays on the module glyphs.

## Decision

1. **The allowance is one ambient read at the canvas edge.** The board ledger carries `Harmonic capacity` as its fourth grouped resource — figure plus a canonical mark, the readout grammar's name-and-state shape — and the phone game-info strip carries the same read: the ledger's phone face per §7, so the allowance stands at the board's edge at every width, exactly once per screen. The figure is `voiceCapacityOf` and nothing else — the same accessor the authoritative economy spends — refreshed through the live-slot seam every render, so a Poly Expander purchase advances it with the pass that advances every voice. It is a read, never a door (the Catalog owns the shop), and never a board-wide used/total meter: usage belongs to voices, so the board-level read shows the allowance alone.

2. **Selected-voice usage stays local.** The reserved readout's `(used/capacity)` chip, the Hex detail's `Capacity used/available` figure, the rate details' Capacity leg, and the silent voice's effect line keep their jobs unchanged. Used counts active instances — a voice singing one chord at allowance two reads 1/2 — and every channel recomputes from the same snapshot, so a purchase moves the denominators in the same render as the ambient figure.

3. **The path language distinguishes earning from idle, never voicing.** The dashed silent-voice mark is retired outright: every active chord draws solid at full strength and joins the live pulse — a silent voice's chord is a full earning chord, its members' bonus riding the instance exactly as any other. The one quiet path is the idle candidate: dotted, dim, never pulsing (ADR-0052 §4 unchanged). Silent-voice identity stays where ADR-0048 put it — on the module glyphs and the voice's own readouts — and `ChordMark` loses its `muted` flag with its stylesheet rules, so no surface can resurrect the distinction by accident.

4. **The canonical mark speaks the board's own language.** The capacity mark is the hex chassis sealed by a chord's twin lines — the seam vocabulary the board already draws — so the ambient read, the reserved readout's capacity chip, and the product surfaces point at one concept with one glyph.

## Consequences

- The allowance is visible while arranging, so a placement that would overspend a voice's budget can be reasoned about before the drop; the placement preview (ADR-0054) remains the projection seam for the exact result.
- Ghost promises keep the dashed register — the promise language previews what does not yet exist, which is not a statement about who sings it.
- ADR-0052 §4's "idle candidates draw dotted, dim" stands; its implied two-class active styling (solid vs dashed silent) does not. The library's "singing now / heard — not singing" cards and the Hex detail's relationship waves are untouched: those surfaces answer discovery and relationship questions, not the board's earning question.
- The `muted` removal shrinks the chord overlay's contract; suites pin the retirement (no `chord-muted` anywhere, idle alone carries a quiet class) alongside the ambient read's purchase, failure, ceiling, save/reload, and prestige coverage.
