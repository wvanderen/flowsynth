# Issue #260: formation quality and live placement outcomes — verification

Implemented on branch `t3code/f27a4d5d` in this worktree, from the acceptance criteria of #260 (blocked-by #258 closed).

## Automated checks

- `npm run check` (tsc): passed.
- Full suite: 49 files, 1,077 tests passed — 774 across every suite except `src/ui/app.test.ts`, plus all 303 tests in `src/ui/app.test.ts` (run with a raised node heap; the file has a pre-existing flaky OOM near the default 4 GB worker limit on this machine, reproduced on pristine `main` before this branch's changes).
- New engine suite `src/engine/placement-preview.test.ts` (9 tests) pins:
  - the allocation Q curve over its own BALANCE magnitudes: the organized ladder climbs octave ×1.00 → fifth ×1.12 → triad ×1.24 → dominant ×1.36 → lush ≥ ×1.48, chromatic density floors at the adopted ×0.5, shipped bounds stay `{floor: 0.5, cap: 1.5}`;
  - ADR-0049's three-way balance under capacity-one economics (dominant and major sevenths each outproduce a clean triad per voice; the chromatic mass loses);
  - the cap-2 experimental comparison (every representative formation reads identically at an upper bound of two — the magnitudes shape the posture, not the cap — and the default stays 1.5);
  - measured vs applied: an unallocated oscillator inside an actively singing formation keeps chord factor exactly ×1 with applied formation ×1 while `formationMeasuredQ` carries the measurement; an all-idle formation measures the floor and applies ×1;
  - preview == commit: `projectPlacement` equals the post-`placeModule`/`returnModule` display snapshot across move, swap, tray placement, and retrieval, in both the development and ordinary economies, without touching live state.
- New UI suite `placement previews with capacity-aware production (#260)` (6 tests) pins: the preview panel's chip row and quality scale on an armed hover; cancel (pointerleave and Esc) restoring the readout with the board unmoved; the committed placement agreeing with the preview with the selected row retaining the figures; per-instance ghost classification (idle promises say "· idle", earning promises don't); the capacity-driven ♭7-over-Fifth replacement previewing honestly and committing with exactly one idle mark and no duplicate active claim; the tray-drag retrieval preview and its delivery; an unrelated selection surviving another module's placement.
- The existing #258/#259 suites pass unchanged apart from re-anchoring the dev readout's Formation figures to `BALANCE.allocationComplexityRate` (the retuned curve).

## Browser provenance

Launched this checkout with `npm run dev`; the preview was `http://localhost:5175/?dev=1` (the launcher picked 5175 — 5173/5174 were in use). `/-/dev/provenance` confirmed:

- Worktree: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-f27a4d5d` (equals `git rev-parse --show-toplevel`).
- Branch: `t3code/f27a4d5d`; commit `8809d3e34fbcfefd0f63e90799fc70ee250018f4` (equals `git rev-parse HEAD`; the working tree's uncommitted edits are what Vite served live).

## Captures

Desktop 1,402 × 877 and phone 390 × 844 CSS px, headless Chromium against that server; the boards were seeded through the running app (`window.__flowsynth` in dev), and every screenshot was taken only after a DOM wait asserted the surface's state — those waits are the readable claims below. The agent could not visually inspect the PNGs (no image input available to this model); each capture's content is vouched by its pre-shot DOM guard plus a live re-verification pass, and the files are included for human review.

- [desktop-selected-readout.png](desktop-selected-readout.png): G4 selected on the C4·G4·C5 board — the readout row `+0.15 ν/s`, `Capacity 1/1`, the prominent `×1.46` total factor, `Formation ×1.12`, then the chord chips (`Fifth ×1.3`, `Fifth ×1.3 · idle`), with the quality scale's marker at ×1.12 between the taller neutral tick and the ×1.5 end.
- [desktop-placement-preview.png](desktop-placement-preview.png): the armed tray oscillator hovering the B♭ cell — the preview panel (`Placement +0.31 ν/s`, the moved voice's `+0.19 ν/s`, `Capacity 1/1`, `×1.8`, `Formation ×1.24`, active and idle ♭7 chips) and the earning ghost over the wire; the board's seams still show the current Fifth beneath.
- [desktop-preview-cancelled.png](desktop-preview-cancelled.png): after the pointer leaves the cell, the `Placement` row is gone and the standing (hidden) readout restored — the board unchanged.
- [desktop-after-replacement.png](desktop-after-replacement.png): after committing the B♭ drop, G4 selected — the displaced Fifth reads `Fifth ×1.3 · idle` exactly once, with no active Fifth claim beside it.
- [desktop-idle-ghosts.png](desktop-idle-ghosts.png): the C4·G4 board with the armed oscillator hovering C5 — both newcomers (the doubled Fifth and the Octave) draw as dotted idle ghosts with "· idle" chips at capacity one.
- [phone-selected-readout.png](phone-selected-readout.png) and [phone-placement-preview.png](phone-placement-preview.png): the same selected row (with scale) and the same placement preview panel at 390 px, over the phone furniture.

Live DOM re-verification (same server) recorded: the selected row exactly `["+0.15 ν/s", "Capacity 1/1", "×1.46", "Formation ×1.12", "Fifth ×1.3", "Fifth ×1.3 · idle"]`; the preview row exactly `["Placement +0.31 ν/s", "+0.19 ν/s", "Capacity 1/1", "×1.8", "Formation ×1.24", "Flat seventh ×1.45", "Flat seventh ×1.45 · idle"]` with the tooltip "Placed: the board reads 0.7 ν/s after, 0.39 ν/s now"; the scale marker at x=57.1 against the neutral tick at x=50.0 (positions, not color, carry the read).

## Instrument-standards notes

The preview panel and the scale are flat chip rows in the reserved readout's own grammar — no nested cards, no new headers; figures are mono, names condensed. The scale reads by marker position and tick height (greyscale-safe), and nothing in the preview animates (glow/motion stay reserved for charge and live activity). Deeper mechanics ride native `title` tooltips, matching the standing readout. Keyboard disclosure of cells (Enter placement) is covered by the existing suite; the drag/touch flows are exercised by pointer-event dispatch in the suites.

## Unavailable checks

- Visual inspection of the captured PNGs by the agent: unavailable (no image input); DOM guards and the included files stand in for human review.
- Reduced-motion and greyscale browser emulation: unavailable; the source-level notes above (position/weight-carried reads, no preview animation) are not a claimed emulation pass.
- True physical touch and drag gestures: unavailable in this environment; phone captures are real 390 px viewport renders driven by the same pointer events the touch path binds.
