Method: dual-agent (A: /root/design_review · B: /root/design_evidence)

## Scope and evidence

Planning input for [Define the visual and writing standards of the instrument](https://github.com/wvanderen/flowsynth/issues/243). Current source is authoritative. Browser evidence came from a sibling checkout on localhost:5173; desktop opening state only. Mobile, populated trays, and chord states were not visually verified. Browser automation became unavailable during Assessment B. No redesign decisions are settled by this review.

## Design review

The rack is specific to FlowSynth: hex panels, signature glyphs, patch leads, category hue, and charge light form a coherent instrument. Secondary surfaces need a shared geometry and hierarchy.

Provisional Nielsen scores, each out of four: system status 3; real-world match 3; control/freedom 3; consistency 3; error prevention 3; recognition 2; efficiency 3; minimalism 3; recovery 2; help 2. Total 27/40. Recovery and populated states were not exercised.

Strengths: board/console domain separation; independent category/rarity/charge channels; local production figures and practice countdowns.

Priorities:

- Identity disclosure for icon-only tools and tray items must work on hover, keyboard focus, and touch.
- Actionable labels and figures need a readable scale; several current labels use 9–11px.
- Catalog offers need visible effects, price, and purchase state; current prose carries most meaning.
- Chord feedback needs consistent non-color distinctions between formed, focused, potential, and muted states.
- Ledger, catalog, chords, trays, blooms, and console tools need explicit shared geometry and type roles.

Learning load comes from icon recall, economic vocabulary, and implicit placement/chord rules. Opening purchase choice count is modest. Calm idle state and the Enter flow switch support practice; first interaction is the likely confusion point. First-time and low-vision players face the largest friction.

## Detector and browser evidence

Static detector over src/ui reported four layout-transition warnings in style.css: line 759 (progress-track width), 1017 (SVG clip width), 1260 (stroke-width false positive), and 1374 (SVG y/height). The SVG warnings overstate document-layout risk; performance was not measured. No other rules were reported.

Desktop controls have meaningful accessible names. Several tools measure 38×38px, zoom controls 36×34px, and bulk controls 22px high; mobile target sizing remains unverified. Initial console showed only Vite connection messages.

## Run notes

Target slug: src-ui-render-ts. No ignore list found. Assessments were isolated. CLI detector completed; no parent rerun. Browser was hidden; no successful overlay injection. Assessment B's live server on port 8400 was stopped. No temporary source files or save mutations. Parent's attempted dev server failed because dependencies were absent; existing sibling server was used for supporting evidence. Prototype and human direction selection remain pending.
