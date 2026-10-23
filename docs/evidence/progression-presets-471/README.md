# Progression preset evidence (#471) — captures unavailable, server provenance and in-page demonstrations verified

The change adds three progression presets to the playtesting suite's
scenario catalog: `approaching-prestige`, `after-first-bank`, and
`world-enemy` — recipe checkpoints the runner walks into existence, each
carrying its declared recipe as provenance and asserting its situation
with named failures. The evidence pass for the changed surface (the dev
panel's suite entry select, which now offers five scenarios) is
**partially unavailable**: every server-side check passed and the full
in-page demonstration ran on the verified checkout, but the screenshot
pipeline could not capture the tab — the same failure class the #468 and
#469 passes recorded — and the phone viewport never landed.

## What is verified

- **Provenance** — the capture preflight accepted the served checkout
  twice: at `80a9bee` (before the checkpoint-terminal fix) and, after the
  fix commit, at `394df43` — served worktree, commit, and clean source
  verified each time (`provenance.json` beside this README records the
  final acceptance at `394df43` on `http://localhost:5173`). The dev
  server ran per [visual evidence](../../agents/visual-evidence.md).
- **Page health** — the tab answered `preview_evaluate` calls instantly
  throughout; `requestAnimationFrame` present, `document.hidden === false`,
  live viewport read 1280×800 on demand. The failure was confined to the
  snapshot/screenshot and viewport-set pipelines.
- **Catalog composition (in-page read)** — the suite select offers
  `fresh-start, approaching-prestige, after-first-bank, world-enemy,
  focus` under the app's own catalog; each progression preset declares
  origin `recipe checkpoint` and carries its full declared recipe
  (approaching: seed 468, prompt policy, baseline 2×25 schedule, 15-day
  budget; bank and enemy: seed 468, pushing policy, claim target 2, the
  declared 2×600 fixture schedule, 36-day budget) — the reachability
  evidence, readable by agents and humans alike. Fresh start and Focus
  carry no recipe and keep their prior origins.
- **Launches through the panel's select + Launch control (in-page runs)** —
  each preset installed in an isolated save and printed its ✓ line:
  - `Approaching prestige ✓ day 9 of the declared walk · fresh-start-s468-7599a40d · an established board with the first prestige door open (#471) · recipe checkpoint · isolated save` — board facts: 18 completed sessions, 16 placed modules, 0 prestiges, 0 Arete, upgrade mode.
  - `After first bank ✓ day 9 of the declared walk · fresh-start-s468-f5712c33 · immediately after the first prestige, its earned Arete unspent (#471) · recipe checkpoint · isolated save` — board facts: 1 prestige, 2 Arete unspent, era-earned 0, frontier 2, Catalog entry unowned, the starter Charge Blade waiting in the tray.
  - `World enemy ✓ day 15 of the declared walk · fresh-start-s468-3f6f27cf · a living discovered enemy with the placement decision unplayed (#471) · recipe checkpoint · isolated save` — board facts: w0 discovered and alive (hp 12), the blade unplaced, the Catalog entry owned, a Charge Column placed, the earned bank honestly empty.
  - Each launch's situation re-confirmed through `devScenarioAssert()`
    (returned clean all three times) — the assertion call ran in the same
    pass, so no unconfirmed setup passed silently.
- **Ordinary-save preservation (in-page reads, two page loads)** — with a
  preset installed, an explicit `save()` and a `beforeunload` write left
  the ordinary slot byte-identical both times; the walks never reached it.
- **Reinstall non-accumulation (in-page read)** — two back-to-back
  relaunches of `after-first-bank` produced byte-identical state JSON —
  the memoized walk hands out clones, so nothing accumulates.
- **Unknown id refused by name (in-page read)** —
  `devLaunchScenario("speedrun")` → `Dev: no scenario "speedrun" — the
  suite offers fresh-start, approaching-prestige, after-first-bank,
  world-enemy, focus.` and the installed setup stayed standing.
- **Scripted-run entry (in-page run)** —
  `devRunPlaythrough({ scenarioId: "after-first-bank", budgetDays: 1 })`
  returned run id `after-first-bank-s468-e0ce7159` from the walked bank
  state (1 prestige), its note line showing the run's honest World leg
  (`the chargeBlade — no free World cell beside a living discovered
  enemy`); the live state and the ordinary save were untouched.
- **Reload drops the scenario (in-page read)** — a plain reload booted
  without the dev panel; the suite select is absent on a normal
  instrument (the automated suite pins the boot-back-to-ordinary case).
- **Keyboard and touch reads (in-page)** — the select takes focus with a
  `:focus-visible` outline; the select, Launch, policy select,
  claim-target input, and run button all measure 44px tall (the grip is
  the drag handle, per ADR-0050).

## A fix the pass caught

The first pass, at `80a9bee`, **failed** the `world-enemy` launch in the
browser (`Playthrough checkpoint "world-enemy-active" was not reached
within the 36-day budget`) while the node suites passed — the
rediscovery and production-regain thresholds finish neck and neck, and
cross-engine float variance flipped their order, letting the pushing
run's recovery stop steal the walk's end. The fix (`394df43`) gives a
checkpoint walk its own declared terminal — it rides past the recovery
stop — and folds the checkpoint into the run identity. The re-pass at
`394df43` installed `world-enemy` cleanly (day 15, above). The failed
launch behaved correctly at the boundary: the ✗ line named the drift and
the previous install stayed standing.

## Unavailable checks

- **Desktop screenshots** — unavailable: `preview_snapshot` timed out
  after 15000 ms on every attempt (three on the first tab across
  status-verified retries, plus two on a fresh tab, with and without the
  image payload; `preview_status` reported the tab available, loaded,
  dialog-free, and on the verified URL throughout; the health check
  verified server provenance). The same failure class the #468/#469
  passes recorded; no local cause was found and none is fixable here.
- **Phone 390×844 pass** — unavailable: `preview_resize` echoed the
  requested `390×844` setting while the page's live size read
  1280×800 on every attempt (three on the first tab, one on a reloaded
  tab — each confirmed by an in-page size read). All phone-layout
  observations are therefore unverified in this pass; the automated
  suite's phone-entry cases (app.phone.test.ts, and the scenario-entry
  touch-floor and focus cases in app.scenarios.test.ts) remain the
  layout evidence.
- **Reduced-motion emulation** — unavailable (the harness exposes
  color-scheme emulation only). The select and its launch control are
  static square-cut controls; nothing on the surface animates.
- **Greyscale pass** — unavailable for the same reason. Non-color state:
  every launch's ✓/✗ read is text in the panel's note line; the select's
  choice is its own label.
- **The select's open dropdown** (native picker) — a platform surface,
  not captured (consistent with the #467 pass).

## Criterion-to-evidence record

One mapping per acceptance criterion of issue #471, each to a named
check, recorded evidence, or an explicit unavailable check. Automated
names cite assertions that would fail if the behavior regressed.

1. *Extend the scenario selector and shared commands with
   approaching-first-prestige, post-first-prestige-with-Arete, and
   active-enemy presets.* — Automated: `src/ui/app.scenarios.test.ts`
   "the suite's catalog > declares the openings, the progression
   presets, and the Focus setup…" (five ids, origins, situations,
   recipes) and "the launch command > launching the progression presets
   installs each walked situation in an isolated save" (all three
   installed, asserted, isolated); `src/engine/progression-presets.test.ts`
   "the walked presets" (each stop's situation pinned). Manual: the
   in-page catalog read and the three panel-driven ✓ lines above.
   Unavailable: the captures that would show the select itself.
2. *Prefer checkpoints from a declared playthrough recipe; preserve
   recipe and origin provenance; never fabricate earned Arete or imply
   reachability from a constructed setup.* — Automated:
   `progression-presets.test.ts` "the declared checkpoint recipes" (the
   declared inputs) and "stops the pushing walk immediately after its
   first earned bank" (the 2 Arete are the walk's own claim —
   `record.claims` equals the state's bank); "carries the recipe and
   origin provenance on each preset descriptor" (origin
   `recipe checkpoint`, recipe on the descriptor, absent elsewhere).
   Manual: the in-page recipe JSON read. No constructed setup exists in
   this slice — the origins are the shipped opening, the walked
   checkpoints, and the pre-existing Focus fixture.
3. *Explicitly classified constructed setups for targeted
   debugging/evidence; each preset declares and asserts its intended
   situation with named failures when assumptions drift.* — Automated:
   `app.scenarios.test.ts` "asserts a walked preset by its own named
   facts, and relaunch restores it" (spending the claim fails
   `After first bank: expected the earned 2-Arete claim unspent`);
   `progression-presets.test.ts` "fails the build with a named reason
   when the recipe cannot reach its checkpoint". Manual: the first
   pass's browser-side drift failure named the checkpoint and the
   budget while the previous install stood (recorded above); the
   re-pass confirmed the fix. The Focus fixture's constructed-fixture
   classification is unchanged from #467.
4. *Every preset isolated, repeatable, playable, inspectable, usable as
   a scripted-run starting state; fresh-start and Focus stay
   available.* — Automated: "repeating a progression launch rebuilds
   the walked setup without accumulating"; "a scripted run starts from
   a progression preset through the same run command";
   `progression-presets.test.ts` "rebuilds the same stopped state from
   nothing on every read" and "starts a declared run from a checkpoint
   preset through the same composition seam"; the catalog case pins
   fresh-start and Focus availability. Manual: the in-page
   reinstall-identical and scripted-run reads above; all three
   installs playable upgrade-mode boards.
5. *Verify reinstall non-accumulation, ordinary-save preservation,
   setup assertions, source/origin reporting, and scripted-run entry
   through the existing shared boundary; record scenario selection
   browser evidence.* — Automated: the boundary cases above (the launch
   cases' byte-identity reads, the assertion case, the catalog's
   origin/recipe reporting, the scripted-run case) — all through
   `devLaunchScenario`/`devScenarioAssert`/`devRunPlaythrough`, the same
   methods the panel and `window.__flowsynth` share. Manual: this pass
   (the in-page reads and runs above, from the verified checkout).
   Unavailable: the captures themselves (above).
6. *Cover parent stories 3, 8–10, and the additional-preset portions of
   5–7.* — Story 3: the four progression situations of the parent's
   preset list now exist (fresh start from #467 plus the three here).
   Story 8 (recipe-generated checkpoints, assessable reachability): the
   descriptors carry the declared recipes (catalog case + in-page
   read). Story 9 (constructed setups identified): origins on every
   descriptor; the checkpoints are `recipe checkpoint`, distinct from
   the Focus fixture's `constructed fixture`. Story 10 (inspect or play
   a preset and start a scripted run from it): the launches produce
   playable boards and the scripted-run cases start from
   `after-first-bank`. Stories 5–7's preset portions: the assertion
   case (5), the launch-isolation cases (6), and the reinstall case
   (7) now cover a walked preset alongside fresh-start and Focus.

Review corrections: none recorded yet — see the pull request's
Verification section for the final mapping at review time.
