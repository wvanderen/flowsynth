# Interface refinement — design interview

Status: Interview and revised compact prototype approved; production implementation authorized. Instrument standards: [reference](instrument-standards.md). Domain language: [CONTEXT.md](../CONTEXT.md).

## Intent and priorities

Make the clock and session controls the clear visual anchor, retain the board as the main workspace, and make Notes a persistent, recognizable action. Navigation destinations need not receive equal visual emphasis. Recomposition of the navbar, session group, and ledger is allowed.

1. Keep session actions visible, consistently sized, and reachable across states.
2. Make the board easy to inspect and navigate on desktop and phone.
3. Keep live figures stable and resource explanations easy to reach.
4. Make progression management coherent with the current Arete mechanics.

## Settled direction — first interview round

- Session controls gain presence through proportion, spacing, typography, and state within the square-control standard. A shape exception requires further review if that approach fails.
- The ledger's standing job is balances and production. Clicking any score opens the relevant explanation. Prestige becomes an explicit action within the opened surface, showing its current Arete payout. Exact routing and grouping remain open.
- The context map may expand into a navigable board overview with pan and pinch zoom. The layer legend remains the layer switch. Retiring the native Open hex picker depends on a replacement that works for touch and keyboard.
- Game mechanics remain unchanged, including prestige timing, payout, and reset consequences.
- Treat overflowing Hex detail costs, bouncing figures, lock/count boxes, missing panel hairlines, Catalog dismissal overflow, and Breather copy as defects.

## One-place rules and non-goals

- Notes has an icon button with accessible name and tooltip inside the dark console well; its existing capture/logged behavior is preserved.
- Prestige payout belongs to the prestige action and confirmation; the Arete section owns it.
- Do not hide session actions or change their size as session state changes.
- Do not introduce hexagonal or clipped controls by default; current instrument standards govern.
- Do not alter resource earning, purchases, pitch, adjacency, or prestige mechanics as a presentation fix.

## Settled direction — second interview round

- Rotate the board arrangement 60 degrees clockwise to make octave bands approximately horizontal. Text and glyphs remain upright. Preserve coordinates, pitches, adjacency, economy, and saves; this is a presentation transform.
- Remove the ambient horizon bar. Banked Arete remains in the ledger. The Arete section of the shared ledger disclosure carries “Prestige now for X Arete,” retaining existing eligibility and confirmation. Do not add a replacement progress meter.
- Resource figures open one shared ledger surface at the clicked resource's section. Feats and Chords retain separate destinations. Standing figures group resources (nous, Arete, scrap) and board performance (production rate, harmonic capacity).
- Desktop: Space + drag pans from anywhere over the board; two-finger trackpad scrolling pans; pinch zooms. Ordinary clicks and placement retain their meaning. Add continuous zoom with a slider, displayed percentage, and Reset.
- Phone: two-finger movement pans and pinch zooms even over modules. One-finger background dragging still pans; module gestures retain their existing meaning.
- Phone: clock and consistently sized session actions occupy the first line; habit/state wraps below when needed within the same Focus door. Notes uses an icon touch surface inside the dark console well (latest review amendment).
- Board zoom controls have a stable board location and do not jump above menus.
- The focus readout labels the break phase “Breather” alone, alongside its clock and applicable exit action.

## Settled direction — third interview round

- The miniature context map opens a temporary expanded navigation surface. Choosing an owned cell opens its Hex detail and closes the overview. Provide visible Close, Escape, keyboard cell navigation, and large touch targets. Retire Open hex only after these paths work reliably.
- Zoom remains 80–300%, relative to the fitted board. Reset recenters and returns to 100%. Desktop pinch anchors at the pointer; touch pinch anchors at the gesture midpoint.
- Phone ledger: nous balance and production rate lead in the primary row; Arete and scrap occupy a compact second row. Harmonic capacity, Feats, and Chords remain directly reachable through the shared ledger surface. Desktop retains the separate Feats/Chords destinations. Reserve numeric lanes so decimal and magnitude changes never move adjacent figures.
- Prototype desktop and phone compositions before production implementation: session/navigation, ledger, zoom controls, board rotation, and expanded context-map interaction. Review these together, then implement the approved composition and defects.

## Next gate

The user approved the revised compact centered-console direction and authorized implementation.

## Prototype review criteria

- Session controls read as the anchor; Notes is visible and named. Running, paused, idle, and Breather states retain consistent action sizing and visible applicable controls.
- Desktop and phone compositions demonstrate long habit names, large resource figures, whole/decimal transitions, and zero/positive prestige claims without layout movement or overflow.
- Board rotation demonstrates horizontal octave bands, upright engraving, and unchanged cell relationships.
- Navigation demonstrates pan starting over occupied cells, pinch zoom, repeatable percentage selection, and Reset. Space-pan does not consume typing gestures in text fields.
- Context-map expansion demonstrates choosing a cell, dismissal, keyboard access, and touch-sized targets; the existing picker remains until replacement access is verified.
- Ledger disclosure demonstrates opening at each clicked score's section and a single prestige action with its payout. Existing prestige confirmation and eligibility remain.
- Floating panels retain their clipped-corner hairline at phone widths; locked marks and counts have no accidental nested boxes; Hex detail costs and Catalog dismissal fit.
- Compare against instrument standards and pinned references. Record desktop/phone, keyboard/touch, non-color states, and reduced-motion checks as verified or unavailable, with evidence from the served checkout.

## Documentation follow-through

After confirmation and prototype approval, amend existing CONTEXT entries and affected ADR presentation contracts alongside implementation. Preserve the canonical terms Context map, Layer legend, Breather, and Prestige. These decisions introduce no new domain terms; do not create a parallel glossary. UI geometry and brief-level tuning stay in this brief and instrument standards rather than in glossary definitions.

## Existing decisions to reconcile before implementation

- ADR-0021/0022 and CONTEXT describe the board's current visual axes.
- ADR-0031 requires stable tight readouts; extend the constraint to the revised ledger.
- ADR-0029/0038 and CONTEXT place prestige at the ambient horizon; the confirmed direction removes that surface and moves prestige into the ledger disclosure. ADR-0029 also requires zoom controls to rise above sheets; the confirmed stable location replaces that behavior.
- ADR-0050 governs the shared Focus door and independent Notes modal.
- ADR-0072's accessibility correction added Open hex for reliable phone/coarse-pointer navigation; replacement must retain that access.

## Evidence

Interview-stage facts were checked in code. Production evidence and explicit verification limits are recorded in [the implementation review](evidence/interface-refinement-2026-10-20/README.md).

## Prototype handoff

- Source: `src/ui/interface-refinement.prototype.html`, served by `npm run dev` at `/src/ui/interface-refinement.prototype.html?variant=A`. A = centered console; B = full-width header; C = side console. The existing Rack identity is preserved across all three. Operate mode: a player glancing at a quiet instrument during practice.
- Development-only, standalone HTML following the existing prototype convention; illustrative in-memory data. The production app and saved games are untouched.
- Controls demonstrate session states, long content, old/new board orientation, ledger routing, prestige confirmation, Notes capture, Hex detail/context-map expansion, pan, zoom, and Reset. Other destinations are labeled placeholders.
- Prototype geometry is representative; production module faces, chord links, actual economy, and module placement are not integrated. Hardware trackpad/touch gestures, map target sizing at high density, focus retention during map rebuilds, and exact pinch anchoring remain implementation validation work.
- Browser interaction checks: A/B/C switching, ledger prestige door, and 19 keyboard-focusable context-map cells passed at 390px with no document horizontal overflow. The prototype is static and has no animation. Full touch, non-color-state, and reduced-motion device review are unavailable.
- Served-checkout provenance verified: `/Users/eggfam/.t3/worktrees/flowsynth/t3-703e1f78`, commit `d2ac8f2e4e33a97c259953ce1bc7b94255732e06`. Phone evidence: `/Users/eggfam/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mvh48k8p-2ec777fd.png`.
- This is a review artifact, not an accepted presentation amendment. On selection, preserve the prototype on a throwaway branch and update the affected domain/presentation contracts before production implementation.

## Selected composition — latest review amendment

A's centered console is selected, but preserve the current implementation's compact one-row header. The prior title/menu row is rejected because it reduces grid space. Center the session console on desktop independently of the Settings action at the edge. Notes lives as an icon button/touch surface within the dark console well, beside the Focus door; it has its own accessible name, focus target, and action, never nested inside the Focus button. No separate Goals button: goals belong with habits. Preserve the current header's identity, habit-linked goal read, and compactness when implementing; this prototype's generic faces and missing goal meter are not instructions to remove incumbent details. On phone, habit/state may reflow inside the console while the header stays a single row and controls stay reachable. This supersedes the earlier explicit Notes text-label requirement and utility-row proposal. The user approved this direction and authorized implementation.

## Prototype archive

The reviewed study and its interview brief are preserved on `prototype/interface-refinement-2026-10-20`, commit `b049a181e07230f6f3530e29ea8d436125de809c`. The throwaway HTML is removed from this implementation checkout; the production UI replaces the prototype as the review surface.

## Implementation handoff

The approved direction is implemented, with unchanged economy/save contracts. [Evidence and verification](evidence/interface-refinement-2026-10-20/README.md) records desktop/phone checks, keyboard paths, test results, and unavailable device checks.

## Header and ledger follow-up

The user's latest refinement supersedes the brand-in-Focus composition: keep the logo alone at the far left of the header, with no wordmark. Put the icon-only Pause/Resume control before the dark console; keep Notes inside it and the main action after it. The live action is Finish, with a save-and-check mark, retaining existing session completion behavior.

Group Nous pool and production in the banner and the ledger. One native button covers the whole banner resource area; resource spans introduce no extra focus stops or independent actions. Feats and Chords retain their own destinations. Align resource labels and values, reserve stable numeric lanes, and display harmonic capacity as allowance / ceiling. In the modal, put the production roster under Nous and carry Feats/Chords icons and totals over from the banner. This is an Operate surface and preserves the Rack identity. [Follow-up evidence](evidence/header-ledger-refinement-2026-10-20/README.md).


## Flow control and status amendment — 2026-10-22

The confirmed [flow-control/header brief](flow-control-header-brief.md) replaces the power key and separate readout with a text-only vermillion button: Enter flow, Finish flow (running or paused), and End breather. Top-right/bottom-left clipping is an explicit exception for this primary control only; other controls remain square. Beside the logo, FlowSynth sits above a readable mode status: Upgrade mode, Flow active, Flow paused, or Breather active. Hide the wordmark first as width tightens, then move status directly below the single-row header when needed. Labels and touch targets remain readable on phone. This supersedes logo-alone and earlier Finish/Exit presentation contracts; behavior is unchanged.
