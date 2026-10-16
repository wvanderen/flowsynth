# PR #405 review fixes

Captured from `npm run dev` in `/Users/eggfam/.t3/worktrees/flowsynth/t3code-88d65d9c`, served at `http://localhost:5174/?dev`. The provenance endpoint confirmed that worktree, branch `fix/pr405-findings`, and HEAD `cd48552f0eecdc0ac4a05a57fc48785a4a072a0e` with the review fixes applied as uncommitted changes. Fixture: 400 scrap, one entitlement per product, no banked module offers.

`desktop-category-disclosure.png` shows the new paired category disclosure and Weave controls, with the Oscillator gloss open. The open divisions, condensed lettering, square-cut controls, and plain glossary layer preserve the instrument prototype (`eb232c4`) and controls-sheet (`d405ce2`) grammar. Each category pair measures 44px high; no horizontal overflow in the pick strip at the measured 1402px desktop viewport.

Keyboard: focus/Enter opens the category gloss, Escape dismisses it while keeping the Forge open, Enter reopens it. The held entitlement remains one. The app regression additionally verifies that glossary activation does not bank an offer and that the separate Weave control consumes the entitlement and banks its category guarantee.

Phone browser composition: unavailable. Resize to 390×844 timed out; after `preview_status`, the one retry also timed out. The 390px app fixture passes but performs no browser layout. Real touch input and dedicated reduced-motion emulation are unavailable. Click activation exercises the shared touch disclosure path; no animation or glow was added. Category names, separate Weave labels, textual held counts, and disabled controls retain non-color state distinctions.

Validation: typecheck, full test suite, and UI regression suite run for these fixes; results recorded in the PR handoff.
