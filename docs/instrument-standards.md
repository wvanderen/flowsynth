# Instrument standards: the approved presentation language for UI surfaces

The authoritative reference for how FlowSynth's surfaces look, read, and disclose — the visual language and writing rules every UI surface is built and reviewed against. Decided by the final resolution of [#243](https://github.com/wvanderen/flowsynth/issues/243#issuecomment-5987438972), agreed through live prototype review on 2026-10-04. [#249](https://github.com/wvanderen/flowsynth/issues/249) applies these standards to the surfaces that predate them; this file carries the decisions, not that redesign effort.

Where a review disagrees with this file, this file wins; where this file is silent, consult the #243 resolution and the pinned prototype before inventing a new pattern.

Amended 2026-10-10 through the intent-drift [retro](retro-2026-10-10.md): the disclosure doctrine, hoverable terms, the naming register, the co-listing order, and matching review criteria. Controls pinned 2026-10-12 through the controls round ([#315](https://github.com/wvanderen/flowsynth/issues/315)): the sheet below is the one reference for control shape. Amended 2026-10-14 through the play-feedback round ([#334](https://github.com/wvanderen/flowsynth/issues/334)): the transient readout is plain — no interactive terms, no dotted disclosure underlines, deeper chord facts a click away in the Hex detail. The interview's inline-calculation exception to the tooltip-only doctrine was narrowed the same day by review: the rate roster ships without expansion controls for now, and the doctrine stands unexceptioned until a disclosure door reachable at every width earns the calculation back.

Scope note: [validated prototype UX](validated-prototype-ux.md) records the first playable's accepted interaction layout ([issue #1](https://github.com/wvanderen/flowsynth/issues/1)) and stands for behavior, not presentation; this file is the single source for how surfaces present.

## Primary source: the pinned prototype

- **Prototype**: [`src/ui/instrument-standards.prototype.html` at `eb232c4`](https://github.com/wvanderen/flowsynth/blob/eb232c498a54fd7defd23be1a82720c1fb229cf4/src/ui/instrument-standards.prototype.html) on branch `prototype/instrument-standards`. The pin is the baseline: later edits on the prototype branch do not move it, and moving the pin requires a new explicit approval round.
- **Controls sheet**: [`src/ui/controls-sheet.prototype.html` at `d405ce2`](https://github.com/wvanderen/flowsynth/blob/d405ce2b4d65ea411fe16c0665201aba674c5821/src/ui/controls-sheet.prototype.html) (approval branch `prototype/controls-sheet`, review corrections on `t3code/implement-issue-315-ui`) — approved 2026-10-12 through the controls round ([#315](https://github.com/wvanderen/flowsynth/issues/315)) and the one reference for control shape: button geometry, the vertical goal-bar column, the tooltip layer's plain styling, and the six goal-palette swatches rendered as controls. Variant A won the round: slim banner-density columns, the firm inset underline marker for selection. Its rejected contrasts — the rounded legacy button, the horizontal legacy track, the boxed tooltip, the circular swatch — are the shapes reviews flag; variant B (framed columns, inset ring) stands in the sheet's step-through as the runner-up. The round approved the sheet at `6e08478`; review fixes (term touch targets, tooltip access state) landed before the pin moved — no shape changed. The user-authorized PR #324 review corrections advance the reference to `d405ce2`: Mutators precedes Modules; tooltip visibility and accessibility state share one state, and Escape suppresses hovered disclosure without removing keyboard focus. The approved variant A geometry is unchanged.
- **What is approved**: the presentation decisions below — panel geometry, open divisions, type hierarchy, state grammar, disclosure behavior, and the compact readout shape. Run the pinned checkout with `python3 -m http.server` and step the variants; the catalog (entry gate and open catalog) embodies the decisions.
- **What is not approved**: the prototype's placeholders. The Arete mark, the Arete Accelerator offering, and every figure in it are provisional; existing claim behavior is unchanged. The `Chords (4/11) +8% ν` example illustrates presentation shape, not economy balance.
- The first review round's three compositions survive in branch history at `89ee2e1` — catalog entries as expandable `<details>` boxes — kept as the contrast case the resolution rejected.
- The independent critique that motivated the round: `git show eb232c4:.impeccable/critique/src-ui-render-ts/wayfinder-review.md` (on the pinned commit and on main).

## Visual language

**2026-10-18 module-grid amendment:** Idle chords have no board geometry, even under hover, keyboard focus, or touch inspection; their readout counts and Hex detail disclosures remain. Active chords are clearer at rest; inspecting a module emphasizes its active chords and dims unrelated active chords, behind the module faces. Continuous received charge uses a restrained green chassis outline alone: category rails retain their hue, rarity plates retain their finish, and the general green face wash and glow are removed. Chargeable threshold-progress fill and directional charge leads remain. This supersedes ADR-0057's idle-path reveal and ADR-0016's green category-rail override.

**2026-10-17 cohesion amendment:** [ADR-0070](adr/0070-refine-the-rack-around-quiet-practice-and-shared-surfaces.md) preserves the Rack identity and main layout, adopts a neutral graphite substrate family, and narrows clipping to floating outer panels with top-right/bottom-left cuts at every width. Controls and internal divisions stay square; the phone Catalog's sloping top edge is retired by this decision. Flow activity should read on deliberate inspection through steady low light and subtle local modulation. These approved changes amend the historical pins only on those points; the current refinement is verified against this amendment as recorded in [the review evidence](evidence/cohesion-2026-10-17/README.md), with unavailable checks called out there.

- **Hexes stay the module voice** (Rack identity, [ADR-0016](adr/0016-adopt-the-rack-identity.md)): the hex chassis, signature glyphs, category hues, rarity finish, and charge light are existing approved identity; hexes describe modules and their relationships.
- **Surrounding surfaces are flat instrument panels.** Floating outer panels carry top-right/bottom-left clipped corners consistently at every width; controls and internal divisions stay square. Clipping identifies that surface family, never decoration applied to every control.
- **Inside a panel, open divisions and rules** — hairline separations, aligned rows — never repeated rounded cards or nested boxes.
- **Controls are square-cut** — hairline border, condensed technical lettering, no radii; the rounded legacy style is retired. The controls sheet pins the geometry: buttons, the vertical goal-bar column (fill by height, engraved completion, never color alone), the plain tooltip layer (hairline and panel surface, never a card), and the goal-palette swatches in the state grammar.
- **Identity rides context.** A surface whose context already says what it is takes its resource color and canonical icon, and no header: do not add a title or repeat a resource balance to fill a header.
- **Wherever modules and mutators co-list, mutators lead** — board tabs, tray switch, inventory switch, every shared list. Resource faces order by resource instead: the catalog stays `ν nous` first.
- **Type hierarchy**: condensed technical lettering for names and controls, monospace tabular figures for readouts, readable sans for notes and longer mechanics. Exact fonts are implementation tuning; the pinned prototype demonstrates the hierarchy.
- **One state grammar everywhere**: muted outline = unavailable, clear outline = available, firm inset marker = selected, engraved completion mark = acquired. State stays recognizable without color alone.
- **Glow and motion are for charge and live activity only.** Flow activity reads on deliberate inspection: steady low illumination and subtle local modulation, without broad background breathing or strong repeated flashes. Meaningful events may receive a brief local accent; continuous charging stays subdued. Idle surrounding panels stay quiet. Reduced-motion presentation is fully static, including charge leads; persistent marks and illumination preserve charge and direction information.

### Inventory notation amendment — 2026-10-18

Follow-up layout correction: full faces show `Lv. 0` above a single rarity mark + name + Roman-tier line. Compact inventory name/tier text shares a baseline; level readouts retain the `Lv.` prefix. The hypercube center carries a small filled hexagon for the requested visual trial.

The confirmed [inventory feedback brief](inventory-ux-brief.md#inventory-feedback-amendment--2026-10-18) standardizes rarity as a grey circle (common), green triangle (uncommon), or blue diamond (rare), retaining plate finish and category hue/glyph identity. Shapes carry rarity without color; accessible names retain the rarity word. Merge tier retains engraved rings and uses Roman numerals starting at I; module level uses Arabic digits prefixed by `Lv.`. Mutators share rarity marks but have neither module level nor merge tier. This amends older descriptions that assign rings to rarity or reserve rarity entirely for finish/words.

Inventory rows are compact open lines; collapse leaves a hypercube symbol and stored count. Inventory inspection uses an identity face with name and numeric state shown once below. The same browser works in Hex detail; its enlarged faces accept the normal placement/retrieval gestures, with direct Place retained. The redundant Store/Retrieve button is removed; opening inventory overlays the stage without shifting the detail composition. The unfamiliar Merge glyph has a plain action-name tooltip as an explicit exception to the mechanic-only rule below; first touch names it, second touch opens review.

## Writing and disclosure

- **The readout is name + state + concrete effect**, compact: `Chords (4/11) +8% ν`. An effect may be a concise symbol or relation when it communicates the concrete outcome: `Fill with charge → Mutator draft`.
- **Units identify figures.** Cut redundant labels, repeated balances, repeated names, generic furniture, and every explanatory paragraph for behavior the controls or visuals already show; filler absent from the intentional content outline goes.
- **Deeper mechanics live in the tooltip layer**, not expandable Details sections. *Amended 2026-10-14 (issue #334): the transient chord readout carries no disclosures at all — plain chips only, no interactive terms, no dotted disclosure underlines — with the deeper facts a click away in the Hex detail. The play-feedback interview's inline-calculation exception for the rate roster was narrowed by same-day review: no expansion controls ship for now (an arrow on the hover-disclosed popover reads as a hover affordance, not an accessible door), and the tooltip doctrine stands unexceptioned.*
- **A tooltip exists only for a mechanic the surface cannot show and a player might actually query.** It never restates visible content; information already on the surface is deleted, not relocated. When in doubt, cut the tooltip. Reads that cannot be opened wear no hover cues.
- **Tooltip copy is a gloss, not a sentence**: term + concrete effect in one short line, ~60 characters as the working ceiling; no em dash, semicolon, or colon joining clauses; never a second sentence that re-says the first. Canonical: the `memorized` term glosses as `Persists through arete reset`. The layer's styling is plain — floating text over the panel, no border, no shadow, no card; a boxed tooltip violates the open-divisions rule.
- **Domain terms are the disclosure primitive.** A term defined in CONTEXT.md renders hoverable wherever it appears — on the surface or inside another tooltip — and its hover opens the glossary meaning. Write `memorized`, never `memorized (does not reset on era-reset)`; the term carries the definition, so description prose never grows.
- **Italics are not part of the standard.** The italics in the #243 discussion marked which text belonged in tooltips; italic type is not a styling requirement and not an affordance convention. (Correction recorded in the final resolution.)
- **Tooltip access**: hover, keyboard focus, and touch all open it, and it stays dismissible (Escape, tap-away). Critical names, effects, prices, and purchase state remain visible without opening anything.

## Naming and voice

- **Purchases are products, not mechanics.** Every purchasable thing carries a terse proper name from the studio-hardware register — equipment or process in the synth world, building on the module voice (Flywheel, Harmonizer, Bend). Canonical examples: Poly Expander, Expansion Bays, Rack Extenders, Chord Catalysts, Headroom.
- **Mechanics words never lead a name.** Ceiling, rung, discount, capacity, unlock may appear in the effect line and the hoverable term layer — never as the player-facing name. "First ceiling" is the failure shape.
- **One concrete effect line rides the name**; longer descriptions do not exist — the terms in the line hover to their CONTEXT.md meanings.
- **Ownership**: implementers coin freely within the register; a name that sets taste — new metaphor territory — returns to a design session for confirmation. Named purchases get `_Avoid:` entries in CONTEXT.md like every named thing.

## Review criteria

Compare the changed surface with the pinned prototype. A surface passes when:

- identity, actionable state, effect, and cost are readable at a glance;
- every visible element has a purpose — nothing rides along as furniture;
- module, category, and resource semantics stay intact (hexes are modules; hues are categories and resources);
- no paragraph is needed to explain behavior the controls or visuals show;
- every tooltip earns its existence — it shows a mechanic the surface cannot, and it restates nothing visible — and its copy holds the gloss standard;
- every purchasable thing is named per the register: proper name, one effect line, hoverable terms;
- domain terms in copy hover to their CONTEXT.md meanings;
- wherever modules and mutators co-list, mutators lead.

Judged specifically on: clipped outer panels where the silhouette calls for them, open internal divisions instead of nested cards, control shape against the controls sheet (square-cut controls, the vertical goal bars, the plain tooltip layer, the swatch grammar), purposeful visible content, compact name/state/effect/cost readouts, tooltip economy, product naming, and usable disclosure. Critical prompts stay (dismissal affordances, destructive-action warnings), as does accessibility: readable text, visible keyboard focus, touch targets, non-color state distinctions, reduced motion.

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

- **Explanatory prose — flagged.** The honesty report's reassurance line (render.ts:3744): "Nothing is final until you answer — only the time past your plan is waiting. What already banked stays banked." The two adjudication buttons already show what is held and what is banked; the paragraph narrates behavior the controls display. The criteria cut it; a consequence detail the rows cannot show gets one mechanics line in the tooltip layer, and only if a player would query it — text is deleted before it is relocated.
- **Dismissal — visible controls (#335).** Forge replaces its former bottom dismissal paragraph with visible Close and Esc affordances. Outside click still dismisses without choosing, and the compact docked panel leaves the board inspectable. The draft states `Choose 1 of 3` (or `Choose 1 of 2`) beside the choices. Forge uses horizontal progress tracks; the pinned goal bars remain vertical.
- **Nested cards and expandable Details — flagged, with the fix demonstrated in history.** The first prototype round (`git show 89ee2e1:src/ui/instrument-standards.prototype.html`) rendered catalog entries as three `<details>` expandables inside the panel. The pinned catalog replaces them with rule-separated open rows plus the tooltip layer — zero `<details>` remain at the pin. That delta is the shape these criteria demand from production surfaces.
