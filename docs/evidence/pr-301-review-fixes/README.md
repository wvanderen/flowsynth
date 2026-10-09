# PR #301 review fixes

Captured on 2026-10-08 from the active checkout:

- Worktree: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-21b5b094`
- Branch: `fix/pr301-review`; base commit: `c32d212332e9ffc32626125670eb6f5ebd616a98`, with the review fixes applied.
- Server: `npm run dev`, `http://localhost:5176/?dev`.
- Provenance: the exact URL's `/-/dev/provenance` returned the worktree and commit above before capture.

## Evidence

- `desktop-detail.png`: desktop composition and focused Modules disclosure. The face's accessible description now includes level and concrete live readout.
- `phone-detail.png`: same-origin 390×844 iframe of the same served checkout, showing the fixed stack and enlarged upgrade-count controls. The sheet scrolls to its remaining controls. This is a composition check, not device emulation.
- Browser computed styles confirmed `height: 44px` and `min-height: 44px` for upgrade-count chips. Bend shift chips use the same minimum.

Compared against `docs/instrument-standards.md` and the pinned prototype: the frameless stack and open action rail remain; the new touch-target sizing follows the prototype's 44px minimum. The existing inset face marker continues to distinguish selection independently of hue.

## Checks

- `npm run check`: passed.
- `npm test`: 1133 tests passed across 57 files.
- `npx vitest run --project ui`: 531 tests passed across 21 files.
- Added regressions verify a non-voice charge readout and glow update, its accessible description updates, unchanged flow renders preserve Return/disclosure nodes and focus, and changed live values preserve disclosure focus while retiring the old tooltip portal.
- Keyboard focus opened the Modules disclosure in the browser. Shared tooltip behavior has interaction coverage in the UI suite.

## Unavailable checks

Preview viewport resizing timed out; phone evidence uses the iframe described above. Physical touch, greyscale, and reduced-motion passes were unavailable and are not claimed as verified. No new motion was introduced.
