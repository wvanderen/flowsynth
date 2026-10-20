# Header and ledger refinement

Preview: http://localhost:5174/ . Provenance endpoint verified the active checkout `/Users/eggfam/.t3/worktrees/flowsynth/t3-703e1f78`, branch `t3/ledger-board-ui-improvements`, base commit `d2ac8f2e4e33a97c259953ce1bc7b94255732e06`, with this working diff.

- [Desktop board](desktop-board.png): 1280px layout, logo at left; Resume, clock/Notes well, Finish in DOM and visual order. The session cluster centers at x640. The header remains 64px. Resource labels and values share baselines, Nous production sits directly below its pool, capacity reads 1 / 3. Resource columns reserve space independently of ticking values.
- [Phone board](phone-board.png): 390px layout. Logo, Resume, Notes, Finish and Settings remain visible. Resume/Finish/Notes have 44px targets. Document width is 390px without horizontal overflow. Nous pool/production share one group beside Arete and scrap.
- [Desktop ledger](desktop-ledger.png), [phone ledger](phone-ledger.png): production roster lives under Nous; capacity includes ceiling; Feats and Chords carry the canonical SVGs and counts. Phone modal scroll width equals client width (370px).

Compared against the Rack controls/presentation pins named in `docs/instrument-standards.md`, with the user's latest amendment: graphite wells, condensed labels, mono tabular values, square controls and clipped outer modal rim retained. The new shared native ledger button is the sole resource-area focus target; the existing hover roster and Feats/Chords destinations remain. Accessible labels distinguish Pause/Resume even without visible text. Existing disabled/live/held markers remain readable without color. No motion was added.

Physical touch/trackpad, OS reduced-motion, and exhaustive grayscale checks are unavailable. Viewport emulation verifies layout, not device hardware. Browser inspection was bounded to a desktop/phone batch and one confirmation batch.

Validation: typecheck and production build passed; full suite passed (87 files, 1,760 tests, 2 existing skips), including 815 UI checks. The layout detector returned no findings. `git diff --check` passed. Regression checks cover the shared ledger target and focus, resource live updates, ceiling changes, module picks, modal focus restoration, icon-only Resume and Finish naming.
