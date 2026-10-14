# Forge glossary correction — PR #342

2026-10-14. Checked against the instrument presentation pin `eb232c4` and controls pin `d405ce2`. Preserves the open hex choices, compact readouts, and selected-branch underline; adds the shared term disclosure layer to effect text. Choice buttons and term triggers are siblings, preserving the full choice target without nesting interactive controls.

Launched `npm run dev` in `/Users/eggfam/.t3/worktrees/flowsynth/t3code-a5430c61`. The server and `/-/dev/provenance` both reported that worktree, branch `t3code/review-pull-request-342`, base commit `79df9a9c4b1ab71a7704717d29f0d0d513c939ae`, with the correction uncommitted. Captured the same server at `http://localhost:5173/?dev` with temporary module candidates (Harmonizer, Forge, Oscillator).

- Desktop: [pitch disclosure](desktop-pitch.png), 1402×877 CSS viewport (preview image is 1280×800). Open divisions, full names, effects, scaling/cost, branch controls, and numeric horizontal tracks remain readable.
- Keyboard: focused the first choice, pressed Tab into pitch; the glossary opened. Escape hid it while Forge stayed open and the bank remained at one roll.
- Pointer: clicking pitch opened/pinned its definition without choosing. Existing shared tooltip behavior supplies hover and tap-away; regression coverage checks focus, click pinning, Escape, tap-away, unchanged banks, and subsequent choice placement.
- No new animation or color-dependent state was added. Underlined terms and keyboard focus identify disclosure without color.

Unavailable: phone capture (both iPhone 12 Pro preset and explicit 390×844 resize timed out after 10 seconds; measured viewport remained 1402×877). Actual touch input, greyscale capture, and reduced-motion emulation were unavailable. Phone layout and touch behavior are not claimed browser-verified.

Validation: `npm run check` passed; `npm test` passed 1,300 tests with 2 skipped; `npx vitest run --project ui` passed 684 tests. After correcting the habit-build gloss to match CONTEXT.md, typecheck and the seven Forge tests passed again. Browser choice activation also consumed the module roll, closed Forge, and armed board placement.
