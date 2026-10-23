# Final workflow evidence (#474) — in-page demonstrations verified, captures and phone viewport unavailable

The ticket's own browser-evidence requirement, executed against the
verified checkout. The full five-stage workflow ran live on the verified
URL twice (once per pass below), but the screenshot pipeline stalled on
every attempt — the same external failure class the #468, #469, #470,
and #471 passes recorded — and the phone viewport never landed. Every
server-side check passed; the page stayed healthy throughout.

## Provenance

`npm run dev` served this worktree at `http://localhost:5174/`, commit
`194eeb76`, clean source. The capture preflight ACCEPTed twice — once at
the start of the first pass and again after the bounded fresh-tab
restart (same URL, same record): served worktree, commit, and clean
source verified (`provenance.json` beside this README). The health check
(`tools/evidence-healthcheck.mjs`) confirmed server provenance OK while
classifying the snapshot stall.

## What ran on the verified checkout (in-page, `?dev=1`)

The whole workflow thread of `src/ui/app.workflow.test.ts`, live:

1. **Scenario selection** — suite select set to `fresh-start`, the
   panel's Launch control clicked: `Fresh start ✓ 12ν grant · one synth
   · upgrade mode · the shipped opening board · initial state · isolated
   save`; `devScenarioAssert()` re-confirmed clean.
2. **Configured scripted run** — policy `Pushing`, claim target 2, seed
   474, budget 1 day, Run clicked:
   `Pushing ✗ 1d · 50m credited of 60m elapsed · claim none/2 Arete ·
   seed 474 · fresh-start · fresh-start-s474-e66b195c-… · no Arete
   spent · Feat unlocked — spark · The 1-day budget ended before the
   2-Arete claim or the recovery behind it. Last decline — levels on the
   focusKeyed — Not enough whole nous for even one level.` — the honest
   incomplete outcome.
3. **Interventions** — the panel's +100ν plus the terminal's `inspect`,
   `start 25`, `advance 60`, `end`, `prestige`: five recorded
   interventions (`✓ Dev grant — +100ν`, `✓ Start a 25-minute session`,
   `✓ Dev clock +60s`, `✓ End the session`, `✗ Prestige`), the engine's
   own refusal verbatim (`✗ The horizon is not reached yet.`), and the
   suite note reading `modified — 5 interventions`.
4. **Historical inspection** — curves opened on the run; the mid-run
   sample selected; the provenance line read
   `walked here · save v12 · runner v9 · engine c90dceff`.
5. **Export/import** — terminal `runs` listing, `✓ exported … 34316
   bytes of artifact JSON`, and `✓ imported — fresh-start-s474-… ·
   artifact v2 · unmodified · source save v12, runner v9, engine
   c90dceff`; the run note became `Imported · Pushing ✗ …` and the
   provenance line `imported · save v12 · runner v9 · engine c90dceff`.

Second pass (fresh tab, re-preflighted): identical thread, execution id
`fresh-start-s474-e66b195c-913533a5-…`, same outcomes.

## In-page instrument-standards reads (desktop pass, live 1280×800)

- **Keyboard disclosure** — the curves panel's `nous — what it means`
  term button opens on keyboard focus (`aria-expanded` true), closes on
  Escape, reopens on click. The terminal input takes focus with a 2px
  outline and Enter runs the command (the whole stage-3 loop was driven
  through it).
- **Touch floors** — scenario select 175×44, Launch 59×44, policy select
  141×44, Run 121×44, runs select 552×44, Export 59×44, Import 59×44,
  terminal input 163×44, ◀▶ stepping 44×44 — all at the 44px floor. The
  term disclosure buttons are the existing 38×35 primitive (#373's
  recorded sizes; unchanged by this work).
- **Non-color states** — completion and refusal ride ✓/✗ glyphs in the
  notes and the terminal scrollback (`✗ The horizon is not reached
  yet.`); imported and modified are literal words (`Imported ·`,
  `modified — 5 interventions`, the provenance line's `imported`); the
  walked/imported distinction is a word, never color alone.
- **Reduced motion** — zero animations across every dev surface
  (`getAnimations()` = 0 on the curves panel and the sum across all
  `dev-*` surfaces); the suite is static by construction.
- **Ordinary save** — untouched by the whole thread (the automated
  workflow cases assert byte identity end to end; the in-page pass ran
  the same operations).

## Unavailable checks

- **Desktop captures: unavailable.** `preview_snapshot` timed out after
  15000 ms on every attempt. First pass: 3 attempts (the third after a
  `preview_status` read) on tab 2 — budget exhausted per
  [visual evidence](../../agents/visual-evidence.md) §5. One bounded
  fresh-tab restart (the documented recovery): full teardown, new tab,
  preflight re-ACCEPTed (same record), workflow re-seeded and verified
  in-page — then 3 more snapshot attempts, each after a status read
  showing the tab available, loaded, dialog-free, on the verified URL.
  Budget exhausted; recorded, not retried further. `preview_evaluate`,
  `preview_resize` (1280×800), the provenance endpoint, and the health
  check stayed healthy throughout — the page was not the cause.
- **Phone 390×844 pass: unavailable.** `preview_resize` returned the
  390×844 setting on every attempt but the live in-page read stayed
  1280×800 (three attempts, status read between) — the browser-viewport
  class, budget exhausted. No phone capture or phone-layout read is
  claimed. The phone-entry evidence stands on the prior slices'
  verified-checkout captures: `docs/evidence/scenario-suite-2026-10-22/`
  (05, 06), `docs/evidence/issue-472/phone-terminal.png`, and
  `docs/evidence/run-artifacts-473/` (phone captures with measured
  44 px floors), plus the phone suites
  (`src/ui/app.phone.test.ts`, the scenario-entry touch cases in
  `app.scenarios.test.ts`).
- **Visibility confirmation** — the harness reported `visible: false`
  across both tabs throughout, including after activation; per the
  doctrine this is recorded unavailable, with capture readiness
  established by the status observables and the in-page reads above.
- **Greyscale pass** — unavailable (no emulation in this harness); the
  non-color semantics above are the DOM-level checks, not a greyscale
  visual pass.
