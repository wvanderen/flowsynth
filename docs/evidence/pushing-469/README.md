# Pushing playthrough evidence (#469) — captures unavailable, server provenance verified

The change adds the pushing policy to the playtesting suite: the
configurable pending-claim target (recipe, dev-panel select and input,
agent input), the claim-target bank past the first eligibility, the
earned-Arete spending and World placement legs, and the two next-era
recovery measures. The evidence pass for the changed dev-panel surface is
**partially unavailable**: every server-side check passed and the in-page
demonstrations ran, but the screenshot pipeline could not capture the tab
— the same failure class the #468 pass recorded.

## What is verified

- **Provenance** — the capture preflight accepted `http://localhost:5173/`
  twice (before and after the capture attempts): served worktree, commit
  `606eb125`, and clean source all verified (`provenance.json` beside this
  README). The dev server for this worktree was launched with `npm run dev`
  per [visual evidence](../../agents/visual-evidence.md).
- **Page health** — in-page probe on the verified URL (`?dev=1`), tab at
  1280×800: `requestAnimationFrame` served in 0.2 ms, zero long tasks over
  1.2 s, `document.hidden === false` — the page was not the cause of the
  capture failures.
- **Panel composition (in-page reads, not captures)** — the dev panel
  carries the playthrough row's new controls: the policy select offering
  both declared policies (`Prompt prestige`, `Pushing` — the same
  descriptors `devPlaythroughPolicies()` returns), the seed and budget
  inputs, and the pending-claim target input (`claim ≥` placeholder,
  1–36). Keyboard focus reaches both new controls with `:focus-visible`
  outlines; the select, the target input, and the run button all meet the
  44px touch floor; the panel runs no animation (reduced motion is
  trivially static — nothing animates on this surface).
- **Human/agent parity through the panel controls (in-page run)** — with
  the select on `Pushing`, target `2`, seed `468`, budget `2`, clicking
  the panel's Run playthrough rendered the note line:
  `Pushing ✗ 2d · 100m credited of 1500m elapsed · claim none/2 Arete ·
  seed 468 · fresh-start · fresh-start-s468-5f171e6a · no Arete spent ·
  Feat unlocked — time-in-the-seat · The 2-day budget ended before the
  2-Arete claim or the recovery behind it. Last decline — levels on the
  infusor — Not enough whole nous for even one level.` — the same
  composition and note the agent command returns; the happy-dom wiring
  cases (`src/ui/app.playthrough.test.ts`, "the panel's visible wiring")
  assert the parity and the note element directly.
- **The complete demonstration's figures** — deterministic at the command
  boundary: the pushing fixture (one declared 600-minute daily session on
  the same five-minute breather, seed 468, claim target 2, budget 36)
  completes `recovered` at day 31 with claims `[2]`, spending `entry 1 +
  1 Charge Column` placed on a generator's charge line, both recovery
  marks measured (eligibility 3.0d/1800m, production 11.0d/6600m against
  a 15.07M ν/s pre-reset rate), and the no-grant ledger check passing.
  These are pinned by "the pushing policy > pushes past the first
  eligibility, banks its claim, spends it, and measures both recovery
  marks" and the half-recovery, unreached-claim, and reproducibility cases
  beside it.
- **Suite** — `npm run check` and the full `npm test` pass at `606eb125`
  (95 files, 1,901 tests).

## What is unavailable

**Desktop and phone captures: unavailable — the preview screenshot
pipeline timed out on every attempt while the page itself stayed healthy.**

Raw failures, in order:

1. `preview_snapshot` (tab `tab_n…`, 1280×800, verified URL) →
   "Preview automation snapshot timed out after 15000ms." Recovery per
   [visual evidence](../../agents/visual-evidence.md) §5: `preview_status`
   read (available, not loading, no dialog, verified URL), then attempts 2
   and 3 → same timeout each time. Tab budget exhausted.
2. Fresh tab `tab_o…` at the verified URL, resized to 1280×800 (resize
   returned; in-page read confirmed `innerWidth 1280, innerHeight 800`).
   Snapshot attempts 1–3 → same timeout each time. Budget exhausted.
3. Phone 390×844: `preview_resize` returned on every attempt but the live
   read stayed 1280×800 (status read and one retry between attempts) —
   three attempts, never landed. The phone pass is unavailable, and no
   phone capture or phone-viewport live read is claimed.
4. Visibility: the harness reported `visible: false` throughout on both
   tabs, including after activation — visibility confirmation is
   unavailable alongside the captures.
5. Diagnostic: the in-page health probe above ran clean on the tab the
   snapshots stalled on.

Not captured, and therefore **not claimed as verified**: desktop panel
composition with the policy select, target input, and the ✓/✗ result
note; phone (~390px) entry and control access; non-color state
presentation as pixels; the capture-side keyboard/touch disclosure
images. The suite's happy-dom wiring cases cover the elements, parity,
and the touch-floor geometry reads recorded above, but not presentation.
