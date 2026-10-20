# PR #437 review corrections

Verified server provenance at `http://localhost:5173/-/dev/provenance`:
worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3-1e41eb46`, base commit
`282e691e9c4b2b0a617d7f4fa619b29e09707bb8`, with these uncommitted corrections.
Used an incognito preview with the development fixture at 1T era-earned.

- Desktop 1280×800: `desktop-hone.png` shows the prestige confirmation and
  focused Hone disclosure. Keyboard focus opened it (`aria-expanded=true`);
  Escape dismissed it. Shared instrument tooltip markup and wiring preserve
  the pinned prototype's plain disclosure and square control grammar.
- Phone: CSS viewport confirmed at 390px. Simulated touch pointer/click opened
  Hone; tapping the heading dismissed it (`aria-expanded=false`). Native touch
  hardware verification is unavailable.
- Phone visual capture is unavailable: the preview returned a 1280×800 image
  with duplicated narrow compositions despite reporting `innerWidth=390`.
  `phone-capture-unavailable.png` preserves that failed capture, not a passing
  phone layout check.
- Grayscale and reduced-motion browser passes are unavailable. This change adds
  no purchase states or animation; the disclosure uses an underline and visible
  keyboard focus, rather than color alone.

Regression coverage checks charge before attacks in both trusted walks, reshape
protection for both World occupant kinds, and keyboard disclosure/dismissal.
