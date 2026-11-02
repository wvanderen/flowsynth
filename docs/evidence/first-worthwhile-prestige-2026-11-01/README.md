# The first worthwhile prestige — the journey note (issue #490)

Captured from the verified checkout at commit `a3980fc` (branch
`t3/issue-490`), served by `npm run dev` at `http://localhost:5173/`. The
capture preflight (`provenance.json` beside this README) verified the
served worktree, commit, and clean source before any capture attempt.
The demonstration was run twice: once at `315f5d25` and re-run in full at
`a3980fc` (the review-fix revision — the intervening source change
touches the evaluation harness and the artifact validator, not the
demonstrated surface; the preflight was re-accepted and the import
demonstration repeated at the new commit, marks asserted at both
viewports again). The PNG-capture unavailability below applies to both
passes.

## Changed surfaces

- **The dev panel's playthrough note** (and the terminal's run receipt,
  which render the same `playthroughNote`): the recovery read grew into
  the worthwhile-prestige journey read — `bank N`, the lasting purchase
  and its label, the blade and Column deployments, the rate and door
  recoveries, the frontier advance, each on both clocks, with an explicit
  `unreached` for every mark a run has not carried and a distinct
  `recovery — none: the door banked 0 Arete` line for the honest
  zero-claim door. A zero-claim prompt record prints the new none-line
  (pinned in `src/ui/app.playthrough.test.ts` "prestiges at first
  eligibility and banks the honest zero-Arete claim" via the note's
  claims read).
- **The World face's entry figure** now derives from the calibrated
  entry depth: the locked face's copy (`reopens at ${formatNumber(
  BALANCE.world.entryNous)} era-earned` and the legend's `reveals at
  …` title) reads `20M` instead of `1T`. Centrally derived — no literal
  in the surface (pinned in `src/ui/world.test.ts` through
  `BALANCE.world.entryNous`).

## The demonstration (in-page reads on the verified checkout)

The completed journey was loaded through the dev panel's own **Import**
control (the `#dev-import-file` file input, driven by the capture
harness's file upload — the same control a human clicks), importing the
pushing fixture's completed run artifact
([journey-artifact.json](journey-artifact.json), committed beside this
README; seed 468, one 600-minute daily session, claim target 2 — the
recipe `src/ui/app.playthrough.test.ts` "pushes past the first
eligibility, banks, spends, deploys the starter rig, recovers, and
advances the frontier" pins; run id `fresh-start-s468-e9c023b0`, engine
`22f19337`, runner v11). The panel's
note element then read, verbatim at both viewports:

> Imported · Pushing ✓ 10d · 6000m credited of 13565m elapsed · claim 3,
> 2/2 Arete · seed 468 · fresh-start · fresh-start-s468-e9c023b0 · spent
> Catalog entry + 1× Charge Column + 1× Hone (chargeBlade) · recovery —
> bank 3, purchase 0.0d/0m (Catalog entry), blade 3.0d/1800m, column
> 0.0d/0m, rate 3.0d/1800m, door 3.0d/1800m, frontier 5.0d/3000m
> (1862.58ν/s pre-reset) · The worthwhile-prestige journey completed at
> day 10 — the frontier advanced to 5 Arete.

Every journey mark was asserted present in the DOM note at both sizes:
`bank 3`, `purchase 0.0d/0m (Catalog entry)`, `blade 3.0d/1800m`,
`column 0.0d/0m`, `rate 3.0d/1800m`, `door 3.0d/1800m`,
`frontier 5.0d/3000m`, and the completion line. Viewports confirmed
in-page (`window.innerWidth/innerHeight`): 1280×800, then 390×844 with
the note scrolled into view.

## Standards checks

- **Non-color state**: the note is plain text; the journey marks carry
  their meaning in figures and words, not color. No state grammar
  changed.
- **Disclosure**: no tooltip, hover term, or disclosure was added or
  changed; the note is the panel's standing result line.
- **Touch floor**: the Import button measures 44px height at phone
  width; no new control was added.
- **Reduced motion**: the change adds no animation or glow — static text
  on the panel; trivially static.

## What is unavailable

**Desktop and phone PNG captures: unavailable — the preview screenshot
pipeline timed out on every attempt while the page itself stayed
healthy.** The raw failures and recovery attempts, in order:

1. First tab (`tab_9…`), 1280×800, journey imported, note verified
   in-page. `preview_snapshot` × 3 (each `Preview snapshot failed:
   Preview automation snapshot timed out after 15000ms`) with a
   `preview_status` read and a `preview_open` activation between
   attempts — status returned `available: true, loading: false,
   dialog: null`, verified URL, every time.
2. Fresh tab on the same verified URL (the recovery that served the
   #489 pass): preflight-class checks re-read clean, 1280×800 resize
   echoed and confirmed in-page, import re-run through the file control,
   note re-verified — `preview_snapshot` × 2 timed out again.
3. Phone pass on the same tab: resize to 390×844 returned, live size
   confirmed in-page, all journey marks re-read at phone width,
   `preview_snapshot` × 3 timed out.
4. `tools/evidence-healthcheck.mjs --url http://localhost:5173/
   --viewport 1280x800` ran during the stalls: the server/provenance
   side verified; the browser-side snapshot check is the failing one,
   i.e. the browser-snapshot class with no remaining recovery budget.

This is the same external stall class the #469 pass recorded
("captures unavailable, server provenance verified") and the #489 pass
recovered from only by a fresh tab — the fresh tab recovered nothing
this time. The page itself was never the cause: evaluates, file
uploads, resizes, and status reads all ran throughout, including
immediately between the failed snapshots.

**The `after-first-bank` preset's in-page preparation: unavailable —
pending indefinitely in this harness.** `app.devLaunchScenario
("after-first-bank")` was attempted on both tabs (bounded waits of
150s+): the note stayed `After first bank — preparing`. Diagnostics
recorded so the finding is precise, not vague:

- The walk itself is reachable in this browser: a synchronous
  3-day walk of the same declared recipe shape (2×600-minute sessions,
  seed 468, claim target 2) completed in 59s in-page and banked its
  first claim by day 3 — the checkpoint's halt point.
- The slicing pipeline runs at full speed while the preparation pends:
  16,812 MessageChannel slices in 3s with real arithmetic between them.
- Engine-side, the same preparation path (`preparePlaythroughCheckpoint`,
  the suite's own `beforeAll`) completes and the three walked presets
  pin their halts (`progression-presets.test.ts`).

The stall is therefore specific to the async preparation running inside
this harness's browser — not to the walk's reachability, not to the
engine, and not to this change's source (the preparation's walk halts
days earlier than it did before this ticket). It is recorded here as an
environment finding; the suite's engine-side pins remain the checkpoint
evidence.

## Suite

`npm run check` and the full suite at the final revision `a3980fc` —
recorded in the PR's verification section (the full suite green via the
JSON-reporter run; the default reporter's dropped-results behavior on
this machine recorded there with the main-branch comparison).
