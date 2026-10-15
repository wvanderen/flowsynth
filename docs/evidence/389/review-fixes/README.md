# PR #397 review corrections

Verified implementation: `6aef7d5e1b058f68df02d4063ba67d5bbfc9229a`.
Server launched with `npm run dev` from `/private/tmp/flowsynth-review-397`
at `http://localhost:5174`; every capture pass checked the provenance endpoint
against that worktree and commit. This directory is added after the verified
implementation commit.

Below 360px, the shared sweep label reads ALL. UPGRADE remains visually hidden
and available to assistive technology. All four buttons retain their existing
sizes and board-wide purchase behavior. Wider layouts retain UPGRADE ALL.

Headless Chromium captures cover desktop 1280×800 and phones 390×844,
390×560, 360×560, and 320×560. `geometry.json` records actual button and lane
bounds, provenance, and successful purchases for each viewport. Assertions
checked button containment, separation from zoom on phone, existing target
sizes, and a successful +1 purchase through the real button. Screenshots show
MAX keyboard focus. Phone contexts used touch capability and reduced motion.
The dev console and dismissed onboarding card are absent from the captures.

The corrected 320px MAX button ends before the zoom lane, with all four buttons
inside the sweep row. Desktop and phone captures were inspected against the
pinned instrument and controls sources (`eb232c4`, `d405ce2`): square-cut
controls, open composition, concise labeling, and visible focus are preserved.
The correction introduces no animation or new tooltip.

The new #389 CSS declaration and child-order tests were replaced with observable
purchase checks at 320/360/390px and idle disclosure/Return interaction checks.
Existing #350 touch-floor tests remain outside this correction's scope.

Unavailable: collaborative preview resizing timed out twice, including a retry
after preview_status; physical geometry and captures therefore use headless
Chromium. Real-device ergonomics, screen-reader output, prototype pixel diffs,
and a new keyboard/touch dismissal pass for unchanged disclosures were not
verified. Existing disclosure tests and the original evidence remain applicable.

Validation at the implementation commit: `npm run check` passed; `npm test`
passed (70 files, 1501 tests passed, 2 skipped); `npx vitest run --project ui`
passed (28 files, 796 tests). Dependencies installed before checks.
