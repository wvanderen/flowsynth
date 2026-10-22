# Playthrough evidence (#468) — captures unavailable, server provenance verified

The change adds the playtesting suite's run boundary (recipe, prompt-prestige
runner, dev-panel run control, result note). The evidence pass for the UI
surface is **partially unavailable**: every server-side check passed and the
in-page seeding demonstrations ran, but the screenshot pipeline could not
capture the tab.

## What is verified

- **Provenance** — the capture preflight accepted `http://localhost:5173/`
  twice: at the implementation commit `ebd27b5` and, after the review-fix
  commit, at `7146910` (the commit this directory's `provenance.json`
  records): served worktree, commit, and clean source all verified. The dev
  server for this worktree was launched with `npm run dev` per
  [visual evidence](../../agents/visual-evidence.md).
- **Page health and the agent command path** — read through in-page
  evaluation on the verified URL (`?dev=1`), tab at 1280×800:
  - `window.__flowsynth.devPlaythroughRecipe()` returned the declared
    default recipe (fresh-start, seed 468, prompt, 2×25 min + 5 min
    breather, 30-day budget, empty overrides).
  - `devRunPlaythrough({})` completed: note line
    `Prompt prestige ✓ 10d · 450m credited of 11580m elapsed · claim 0
    Arete · seed 468 · fresh-start · fresh-start-s468-df361e85 · First
    prestige at day 10.`, `claims: [0]`, and `#dev-playthrough-note`
    visible with that text.
  - Same-recipe runs in the browser and in the node test environment
    produced identical outcomes (credited 27000 s, 10 days, identical
    event streams), demonstrating the recipe's reproducibility at the
    shipped commit.
- **Suite** — `npm run check` and the full `npm test` pass at `7146910`;
  the visible-wiring cases (`src/ui/app.playthrough.test.ts`, "the panel's
  visible wiring") assert the run control, the inputs, the result note
  element, and agent-command parity in happy-dom.

## What is unavailable

**Desktop and phone captures: unavailable — the preview screenshot
pipeline timed out on every attempt while the page itself stayed healthy.**

Raw failures, in order:

1. `preview_snapshot` (tab `tab_k…`, 1280×800, verified URL) →
   "Preview automation snapshot timed out after 15000ms."
2. Recovery per [visual evidence](../../agents/visual-evidence.md) §5:
   `preview_status` read (available, not loading, no dialog, verified URL),
   `preview_open` activation, status re-read → snapshot attempt 2 → same
   timeout. Attempt 3 after a status read → same timeout.
   Tab budget exhausted.
3. Fresh tab `tab_l…` opened at the verified URL, resized to 1280×800
   (resize returned; in-page read confirmed `innerWidth 1280,
   innerHeight 800`). Snapshot attempts 1–3 with status reads between →
   same timeout each time. Budget exhausted.
4. Diagnostic: `preview_snapshot` without image transfer → same timeout,
   so the failure is the capture, not the transfer.
5. In-page health probe (evaluation, same tab): `requestAnimationFrame`
   served in 0.4 ms, zero long tasks over 1.5 s, `document.hidden ===
   false`, verified URL — the page was not the cause.
6. A fresh preflight at `7146910` (ACCEPT) followed by one more snapshot
   attempt and the no-image diagnostic → same timeouts. All recovery
   budgets spent; per §5 the pass is recorded, not retried further.
7. `browser-visibility`: the harness reported `visible: false` throughout,
   including after activation attempts; visibility confirmation is
   therefore unavailable alongside the captures.

Not captured, and therefore **not claimed as verified**: desktop panel
composition with the ✓/✗ result note, phone (~390px) entry and control
access, keyboard/touch disclosure behavior, non-color state presentation,
and reduced-motion presentation for the changed dev-panel surface. The
suite's happy-dom wiring cases cover the elements and parity but not
presentation.
