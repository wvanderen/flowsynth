# PR #330 review corrections

- Restore Capacity, Formation, and uncertified-allocation glosses through the shared tooltip layer. Module keyboard focus asks the same readout; only disclosure triggers accept pointer input.
- Remove the opaque summary and row backgrounds, retaining aligned figures and the capacity rule. Compared the desktop composition with the pinned open instrument readout.
- Desktop: [capture](desktop.png) from `http://localhost:5179/?dev`. Provenance returned worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-f6b819f2`, commit `05cf9df86635b8317e96c24f55d49719e2974495`, with the review corrections present as working-tree changes.
- Browser focus opening, Escape dismissal, click pinning, and tap-away dismissal passed. Disclosure targets measured 44px tall. Actual touch-device input is unavailable; shared click behavior and automated regression coverage were verified.
- Phone composition unavailable: preview resize to 390 × 844 timed out after 15 seconds. Grayscale capture and reduced-motion emulation unavailable; these corrections add no animation.
- Typecheck passed; UI suite passed 658 tests. Full suite passed 1,274 tests with two skipped.
- Mechanical detector: four existing layout-transition warnings outside the changed styles; project-wide token advisories compare unrelated surfaces against the scoped readout design record.

## Spacing refinement

Requested by the user after reviewing the correction: capacity now shares the production headline as `(used/available)` plus the canonical chord glyph. Formation uses the same compact row spacing as active chords. Desktop trigger minimum height is removed; coarse-pointer layouts retain 44px targets. The capacity control keeps a complete accessible name and the budget gloss.

[Desktop composition](spacing-desktop.png) captured from the same verified checkout and URL, at `eaa6dfbcbb57e97bf3dffb01be160dc08800eabb` with this refinement in the working tree. Formation measured about 17px high rather than the previous 44px control. Phone resize again timed out after 15 seconds and remains unavailable.
