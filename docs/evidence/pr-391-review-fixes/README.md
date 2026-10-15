# PR #391 review fixes

Captured `desktop-forge.png` from `http://localhost:5173/?dev` after verifying
`/-/dev/provenance`: worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-af8c74cf`, branch
`t3code/pr391-fixes`, HEAD `76242ac0b7edcbfb73ac74bada30c5b1ecf54112`
with the review fixes uncommitted. The Forge was seeded through the existing
development app with the three generator candidates.

The desktop composition retains the pinned instrument prototype's open
panel divisions, square controls, name/effect/state hierarchy, and text rarity.
Scribe now shows its 20-character creation minimum and the separate
300-charge character cap. Milestone shows charge per live goal minute,
credited at completion, rather than an unexplained completion base. All
figures derive from the existing earning coefficients and scale with tier.

The engine regression banks charge through public practice actions at level
40, then compares a single delivery interval with one split just before
exhaustion. Both exhaust the reserve, preserve delivered charge, and credit
the same elapsed time, including the tiny final delivery span.

Validation: `npm run check` passed; `npm test` passed (67 files,
1,428 tests passed, 2 skipped); `npx vitest run --project ui` passed
(27 files, 761 tests).

Unavailable: phone composition (both native preview resize attempts timed
out); reliable native keyboard disclosure verification (the inspection
failed during activation); native touch, grayscale, and reduced-motion
captures. Existing disclosure interaction tests pass; no new motion or
state styling was introduced. These unavailable checks are not claimed as
verified.
