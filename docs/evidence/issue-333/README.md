# Issue #333: canvas-edge capacity read and solid active chord paths — verification

Implemented on branch `t3code/issue-333-implementation` in this worktree, from the acceptance criteria of #333. The amendment retires ADR-0052 §4's dashed silent-voice styling (ADR-0056 records the decision); the allocation and purchase economy is untouched.

## Automated checks

- `npm run check` (tsc): passed.
- Full suite: 61 files, 1,295 tests passed, 2 skipped.
- UI regression suite (`npx vitest run --project ui`): 679 passed — including the new `chordlayer` pin that the overlay carries no muted distinction, and the re-anchored #258/#260 suites.
- New UI suite `src/ui/app.capacity.test.ts` — `the canvas-edge capacity read (#333)` (7 tests) and `solid chord paths (#333)` (2 tests) — pins:
  - the allowance reads once at the canvas edge: `.ledger-capacity` on the board ledger (desktop composition) and `.info-capacity` on the phone game-info strip, both live slots fed by `voiceCapacityOf` — the economy's own figure;
  - buying Poly Expander advances the ambient read and the selected-voice denominator in the same pass, and a newly acquired voice opens on the same allowance (`(0/2)` placed alone);
  - purchase failure (insufficient nous) and the flow-mode restriction change nothing, with the engine's own reasons on the status line;
  - the first-era ceiling holds the ambient read at three and refuses the purchase; an Expansion Bay opens the next rung and the read follows to four;
  - the allowance rides the real save/reload path (`capacityBought` persisted, the rebooted read shows it);
  - the arete reset returns the read to one through the app's own prestige confirm;
  - selected-voice usage stays accurate when allocation leaves capacity unused (one Fifth sung at allowance two reads `(1/2)`);
  - an active chord involving a silent voice (the Harmonizer's G4·D5 Fifth) draws solid — no `chord-muted` anywhere in the document — while idle candidates keep their dotted quiet class.

## Browser provenance

Launched this checkout with `npm run dev`; the server picked `http://localhost:5175/` (5173/5174 were in use). `/-/dev/provenance` confirmed worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-079634c7` (equals `git rev-parse --show-toplevel`), branch `t3code/issue-333-implementation`, commit `22ff5a7` (equals `git rev-parse HEAD`; Vite serves the working tree's uncommitted edits). The provenance check was re-run from inside the capture pages before any screenshot.

## Captures

Desktop 1,402 × 877 CSS px (collaborative preview tab against the verified server) and phone 390 × 844 CSS px, deviceScaleFactor 2 (headless Chrome against the same server, `window.__flowsynth` seeding). Every capture was gated by a DOM wait asserting the surface's state before the shot; the boards were seeded with the C4 opening module plus common-level modules through the dev hook.

- [desktop-allowance-before-purchase.png](desktop-allowance-before-purchase.png): the C4·G4 board at allowance one — the ledger reads `12ν · 0.29ν/s · — ◇ · 1 ⬡` (the new capacity read with its hex-and-seal mark) and the active Fifth draws solid.
- [desktop-capacity-purchase.png](desktop-capacity-purchase.png): the nous Catalog's Poly Expander row (`Raises Harmonic capacity by one for all voices`, `1/3 → 2/3`, `600 ν`) with the pre-purchase ambient `1 ⬡` standing behind the sheet.
- [desktop-silent-voice-chord.png](desktop-silent-voice-chord.png): after the purchase and a Harmonizer at D5 — the ledger reads `2 ⬡`, the three-voice C4·G4·D5 Suspended fourth (a silent-voice chord) draws solid with no dashed mark anywhere, and G4's asked row reads `(2/2)` locally with both chord chips solid.
- [desktop-active-vs-idle.png](desktop-active-vs-idle.png): at allowance one, the C5 newcomer's Octave and doubled Fifth stand idle — dotted and dim beneath the solid active Fifth — with C5's asked row reading `2 idle` and its local `(0/1)`.
- [desktop-active-vs-idle-greyscale.png](desktop-active-vs-idle-greyscale.png): the same frame with a full-page `grayscale(1)` filter — the solid-versus-dotted distinction and the idle chips read without color.
- [phone-capacity-read.png](phone-capacity-read.png): 390 px — the game-info strip carries the ambient read (`… · 2 ⬡`) after the purchase, the ledger dissolved, and the same solid silent-voice chord with the local `(2/2)` row above the board.
- [phone-active-vs-idle.png](phone-active-vs-idle.png): 390 px — allowance `1 ⬡` on the strip; the active G4·C5 seam solid, the C4·G4 Fifth and C4·C5 Octave candidates dotted and dim, the asked row reading `1 idle`.

Live DOM guards recorded at capture time (desktop session): ambient `1` → `2` across the purchase with toast "Harmonic capacity raised — every voice carries one more chord."; the silent-voice ask exactly `["+0.25 ν/s", "(2/2)", "Suspended fourth ×1.55", "Fifth ×1.3", "Formation ×1.24", "1 idle"]`; the idle ask `["+0.1 ν/s", "(0/1)", "2 idle"]`; zero `.chord-idle` marks on the purchased board's active set and no `chord-muted` rule in any stylesheet.

## Instrument-standards notes

- The ambient read rides the ledger's grouped-resource grammar — figure + canonical mark, native-title gloss ("Whole-chord budget per voice", the term's canonical CONTEXT.md gloss), no header, no explanatory paragraph — mirroring the arete read's shape; the mark is the board's own hex-chassis-with-chord-seal language. The canonical mark also replaces the library glyph on the reserved readout's capacity chip, so one glyph names one concept everywhere it appears.
- The allowance appears exactly once per screen at every width (ledger ≥600px, game-info strip below); the selected voice's used/available stays in the reserved readout and Hex detail — no board-wide fill meter was added.
- State distinctions hold without color: active solid vs idle dotted/dim is a stroke pattern, and the greyscale capture demonstrates it. Purchase state figures (`1/3 → 2/3`) live in the Catalog row as shipped.
- The surfaces are static reads; no new animation joins them (glow and motion stay with charge and live activity). Reduced-motion behavior is unchanged from the standing seam pulse rules — idle marks never pulse, and the read never animates.

## Unavailable checks

- Physical touch gesture verification on a real device: unavailable; phone captures are real 390 px viewport renders, and touch disclosure of the reserved readout's capacity chip is pinned by the suite (`readout disclosures open by focus and tap` — focus-open, Escape-dismiss, tap-open, tap-away-dismiss).
- Live `prefers-reduced-motion` media emulation during capture: unavailable; the source-level notes above (no new motion; idle never pulses; the pulse rules unchanged) are not a claimed emulation pass.
- The keyboard path to the ledger's capacity read: it is a read, not a control (like the arete read), so there is no focusable door to exercise; its gloss rides the native title like every grouped read on the strip.
