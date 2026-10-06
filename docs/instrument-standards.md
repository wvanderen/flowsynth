# Instrument standards: the approved presentation language for UI surfaces

The authoritative reference for how FlowSynth's surfaces look, read, and disclose — the visual language and writing rules every UI surface is built and reviewed against. Decided by the final resolution of [#243](https://github.com/wvanderen/flowsynth/issues/243#issuecomment-5987438972), agreed through live prototype review on 2026-10-04. [#249](https://github.com/wvanderen/flowsynth/issues/249) applies these standards to the surfaces that predate them; this file carries the decisions, not that redesign effort.

Where a review disagrees with this file, this file wins; where this file is silent, consult the #243 resolution and the pinned prototype before inventing a new pattern.

Scope note: [validated prototype UX](validated-prototype-ux.md) records the first playable's accepted interaction layout ([issue #1](https://github.com/wvanderen/flowsynth/issues/1)) and stands for behavior, not presentation; this file is the single source for how surfaces present.

## Primary source: the pinned prototype

- **Prototype**: [`src/ui/instrument-standards.prototype.html` at `eb232c4`](https://github.com/wvanderen/flowsynth/blob/eb232c498a54fd7defd23be1a82720c1fb229cf4/src/ui/instrument-standards.prototype.html) on branch `prototype/instrument-standards`. The pin is the baseline: later edits on the prototype branch do not move it, and moving the pin requires a new explicit approval round.
- **What is approved**: the presentation decisions below — panel geometry, open divisions, type hierarchy, state grammar, disclosure behavior, and the compact readout shape. Run the pinned checkout with `python3 -m http.server` and step the variants; the catalog (entry gate and open catalog) embodies the decisions.
- **What is not approved**: the prototype's placeholders. The Arete mark, the Arete Accelerator offering, and every figure in it are provisional; existing claim behavior is unchanged. The `Chords (4/11) +8% ν` example illustrates presentation shape, not economy balance.
- The first review round's three compositions survive in branch history at `89ee2e1` — catalog entries as expandable `<details>` boxes — kept as the contrast case the resolution rejected.
- The independent critique that motivated the round: `git show eb232c4:.impeccable/critique/src-ui-render-ts/wayfinder-review.md` (on the pinned commit and on main).

## Visual language

- **Hexes stay the module voice** (Rack identity, [ADR-0016](adr/0016-adopt-the-rack-identity.md)): the hex chassis, signature glyphs, category hues, rarity finish, and charge light are existing approved identity; hexes describe modules and their relationships.
- **Surrounding surfaces are flat instrument panels.** Occasional clipped outer corners define the panel silhouette; clipping is geometry, not decoration — never applied to every control.
- **Inside a panel, open divisions and rules** — hairline separations, aligned rows — never repeated rounded cards or nested boxes.
- **Identity rides context.** A surface whose context already says what it is takes its resource color and canonical icon, and no header: do not add a title or repeat a resource balance to fill a header.
- **Type hierarchy**: condensed technical lettering for names and controls, monospace tabular figures for readouts, readable sans for notes and longer mechanics. Exact fonts are implementation tuning; the pinned prototype demonstrates the hierarchy.
- **One state grammar everywhere**: muted outline = unavailable, clear outline = available, firm inset marker = selected, engraved completion mark = acquired. State stays recognizable without color alone.
- **Glow and motion are for charge and live activity only.** Idle surrounding panels stay quiet. Reduced-motion preferences are respected, and state information survives without animation.

## Writing and disclosure

- **The readout is name + state + concrete effect**, compact: `Chords (4/11) +8% ν`. An effect may be a concise symbol or relation when it communicates the concrete outcome: `Fill with charge → Mutator draft`.
- **Units identify figures.** Cut redundant labels, repeated balances, repeated names, generic furniture, and every explanatory paragraph for behavior the controls or visuals already show; filler absent from the intentional content outline goes.
- **Deeper mechanics live in the tooltip layer**, not expandable Details sections.
- **Italics are not part of the standard.** The italics in the #243 discussion marked which text belonged in tooltips; italic type is not a styling requirement and not an affordance convention. (Correction recorded in the final resolution.)
- **Tooltip access**: hover, keyboard focus, and touch all open it, and it stays dismissible (Escape, tap-away). Critical names, effects, prices, and purchase state remain visible without opening anything.

## Review criteria

Compare the changed surface with the pinned prototype. A surface passes when:

- identity, actionable state, effect, and cost are readable at a glance;
- every visible element has a purpose — nothing rides along as furniture;
- module, category, and resource semantics stay intact (hexes are modules; hues are categories and resources);
- no paragraph is needed to explain behavior the controls or visuals show.

Judged specifically on: clipped outer panels where the silhouette calls for them, open internal divisions instead of nested cards, purposeful visible content, compact name/state/effect/cost readouts, and usable disclosure. Critical prompts stay (dismissal affordances, destructive-action warnings), as does accessibility: readable text, visible keyboard focus, touch targets, non-color state distinctions, reduced motion.

Automated detector output supplements this judgment; it is never the validation.

## Evidence requirements

Visual review evidence follows [visual evidence](agents/visual-evidence.md) — captured from the verified checkout — and must cover:

- **Desktop and phone** compositions of the changed surface;
- **Disclosure** opened and dismissed by keyboard focus and by touch, not hover alone;
- **State distinctions** readable without color (the four-state grammar out of greyscale context);
- **Reduced-motion** behavior wherever the surface animates or glows.

A check that cannot run — or a viewport pass that fails — is recorded as unavailable in the review, never claimed as verified.

## Sample review

Surveyed at commit `491771f` (`src/ui/render.ts`), demonstrating the criteria on current code. Fixes belong to #249 and follow-ups, not to this file.

- **Explanatory prose — flagged.** The honesty report's reassurance line (render.ts:3744): "Nothing is final until you answer — only the time past your plan is waiting. What already banked stays banked." The two adjudication buttons already show what is held and what is banked; the paragraph narrates behavior the controls display. The criteria cut it; any consequence detail worth keeping moves to the tooltip layer.
- **Critical prompt — preserved.** The forge sheet's note (render.ts:3588): "The board stays live behind this card — inspect freely; click outside, ✕ or Esc puts the choice away." No control shows the dismissal behavior; without the note it is undiscoverable. Critical prompts stay.
- **Nested cards and expandable Details — flagged, with the fix demonstrated in history.** The first prototype round (`git show 89ee2e1:src/ui/instrument-standards.prototype.html`) rendered catalog entries as three `<details>` expandables inside the panel. The pinned catalog replaces them with rule-separated open rows plus the tooltip layer — zero `<details>` remain at the pin. That delta is the shape these criteria demand from production surfaces.
