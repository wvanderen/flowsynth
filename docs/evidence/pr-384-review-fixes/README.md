# PR #384 review fixes

Verified `http://localhost:5173/?dev` through `/-/dev/provenance` before
capture: worktree `/Users/eggfam/.t3/worktrees/flowsynth/t3code-efcbac44`,
branch `fix/pr-384-grade-disclosures`, commit `6242e85582d342010e5c852f6fcaf21b8191b569`
with the review fixes applied as uncommitted changes.

`forge-disclosure-desktop.png` captures the Square's booster disclosure
after a browser click at the desktop layout (1402×877 CSS pixels).
Hit testing at the center of every Forge grade chip now returns that chip,
with computed `pointer-events: auto`. Clicking the Square's booster chip
sets `aria-expanded=true` and leaves the banked offer intact.

Compared with the pinned instrument prototype (`eb232c4`) and controls
sheet (`d405ce2`): square-cut controls, plain tooltip disclosure, and visible
grade letters retain the approved presentation. The coarse-pointer rule
now gives every grade control a 44px minimum width and height.

Validation: typecheck and full suite passed (66 files, 1,410 tests passed,
2 skipped), including UI regressions and the new app-fixture interaction
distinguishing weak D (×0.25) from absent — without consuming the offer.

Unavailable: phone capture (two preview resize timeouts), native touch and
coarse-pointer measurement (desktop pointer only), native keyboard-focus
capture, and reduced-motion capture. Keyboard focus and tap disclosure
paths are covered by app fixtures; these changes add no motion. Grade
letters distinguish state without color; no separate greyscale capture.
