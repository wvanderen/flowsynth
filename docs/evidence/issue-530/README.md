# #530 completion record and #525 parent acceptance map

## Scope, provenance and status

Branch `t3/retire-legacy-mutators`. Prepared clean HEAD was `e7ba47da9f5e552794922405fae218e818677316`, the required `integration/525-world-progression` tip; ancestry check returned 0 before editing. #526–#529 implementation is integrated. Their open issues reflect unavailable visual acceptance, not missing implementation. Read #530/#525 bodies and empty comment lists with `gh`, AGENTS, CONTEXT, ADR-0043/0074/0079/0081/0086/0087, instrument standards and pinned `eb232c4` prototype source, checks/review/verification/visual-evidence/domain guides, and the four prior slice records. No subagents, issue closure or PR changes.

Implementation is not unconditional acceptance. Final visual checks were attempted at the revised freeze and are **unavailable**; they remain blockers without an authorized scope decision. Historical calibration is not current economy validation. The coordinator's independent final code review is separate and has not been claimed here.

## Legacy disposition audit

| Remnant | Disposition / public safety boundary |
| --- | --- |
| Saved placed and stored Mutator copies | Cleared by terminal load retirement. In-memory copies cannot affect power, received charge, chord factors, support grants or production: `mutatorAt` returns no live host. No conversion, refund or World rename. |
| Saved slots | Cleared; reshape no longer reads them; unlock action refuses. Ordinary cells/paid row gates and World placement remain. |
| Pending Mutator rolls | Cleared at load. Choice refuses without consumption/grant. Forge has no Mutator branch/fallback, badge or meter disclosure, even with retained in-memory queues/flags. Ordinary choices close normally when dry. |
| Mutator Forge modules/progress | Owned modules removed, meter reset to zero at load. Never backfilled by an ownership flag. Excluded from deployed economy; progress boundary banks zero. Lost retired fill/investment does not demand monetary recovery. No salvage/refund. |
| Already-generated ordinary/special offers containing Mutator Forge | Offer identity and candidates preserved, not rerolled. Retired candidate hidden and refused without consuming the offer, zero scrap valuation; remaining candidates work, Skip still resolves once. An all-retired offer can be skipped for zero. No additional replacements or entitlement invented. |
| Entry/pool ownership flags | False after load. Both compatibility purchase actions refuse. Neither fresh ordinary nor special pool reads the flags. Capacity, Warp Beam, Hone and reset remain entry-free. |
| Feats | Existing earned stamps and bonus remain history. Flags cannot award retired milestones anew. Historical rows explicitly say Retired rather than advertising a live purchase. |
| Actions/terminal | Old names remain compatibility refusals: entry, pool join, slot unlock, place, retrieve, roll choice, combine; combine preview returns null. No spending, grants, placement, consumption or ownership mutation. No new public test API. |
| UI | No entry screen (prior #526), Forge offer/branch or Accelerator; empty Module Types section removed. Modules and World are the live layers. The dev World grant no longer sets the legacy flag. |
| Runner and historical renderers | Current playthrough management no longer attempts entry/Mutator choices or gates spending on entry ownership. World discovery supplies its permanent policy door. Current lasting spending includes Rack Extenders, capacity offerings and Hone; current route probing never enumerates retired entry/Column purchases. Supplied historical records, historical board renderer, legacy type/glyph/price helpers and versioned fixtures remain interpretable; they are not live acquisition/production. Frozen arithmetic/artifacts remain historical. |
| Unrelated state | No retirement-era reset, no new refund, no schema bump. Current era nous/earned depth/levels/reserves, Arete/scrap, board, ordinary offers, World discovery/collection/placement/Hone and life/class/practice records retain their ordinary contracts. Historical pre-v13 conversion and v10 refunds remain confined to their original version gates before terminal retirement. |

## TDD and named verification key

Owner-confirmed seams are #525's Testing Decisions: application workflows first, engine actions and save round-trips for precision. Read the TDD skill and tests/mocking references. No additional seam interview was needed.

Observed red → green cycles (logs retained here):
1. Retirement action case failed on the old entry refusal reason rather than unconditional retirement; minimal refusal implementation passed.
2. Legacy load case failed because the Forge remained; terminal retirement passed while preserving era/World state and round-trip identity.
3. In-memory economy case failed with 0.30000000000000004 versus baseline 0.1; production/pool/progress retirement passed. An initial test field typo (`nousPerSecond`) was corrected to the actual public rate before the meaningful red.
4. Application legacy workflow failed on the still-visible Mutator Forge/Accelerator; removal passed. Initial reload setup was corrected because fixture release clears storage; the test now explicitly boots the serialized state.
5. Retained Forge skip case failed with 5,242,880 scrap versus the live candidates' 5; zero retired valuation passed. Initial expected literal 1 was corrected to the documented common-copy value 5 before the meaningful red.
6. Lost retired fill and then investment each failed by demanding monetary recovery; ignoring only retired fields passed. Live money recovery remains covered separately.
7. A retained in-memory Forge copy could still place through generic module actions; public lookup/deployment and bulk eligibility now exclude it. Placement/upgrade/bulk and whole-state invariants pass; a fed ordinary Forge control confirms production is still live.

Verification abbreviations below identify exact named cases, not suite counts. Prior-slice cases are inherited tests executed again by the final full run, not new #530 authorship:

| Key | Named automated verification |
| --- | --- |
| J | `src/ui/app.world-progression.test.ts`: **hides World until a confirmed positive prestige, then retains the usable kit across resets and reload** — extended here to pressure disclosure, a genuinely generated ordinary mixed offer, unplaced grant, placement, later reset and boot. Controlled era fixtures exercise transitions, not pacing or earned-time reachability. |
| L | `src/ui/app.retirement.test.ts`: **loading legacy pending mechanics exposes only live Catalog and Forge choices and preserves progression on reload** — live choice and tier, absent retired controls, preserved money/era and placed World collection/Hone across boot. |
| R | `src/engine/retirement.test.ts`: **retired Mutator actions refuse without spending, granting, placing or consuming pending choices**; **legacy load retires copies, slots, rolls, Forge and flags without resetting the era or refunding**; **retained Forge copies cannot place, upgrade, or join a bulk purchase**; **retained in-memory Mutators cannot affect production, forge progress, draft pools or reshape gates**; **retired Forge candidates cannot inflate a preserved offer's skip payout**; **lost retired Forge fill and investment do not force monetary recovery**. |
| D | `src/engine/world-progression.test.ts`: **zero bank, pending entitlement and Catalog ownership do not translate into World discovery**; **translates old %s eligibility once without resetting or refunding the era**; **later zero and positive prestiges preserve placement and never repeat either starter grant**; **Hone requires no entry, improves current and future Blades type-wide, and persists without refund**. |
| P | `src/ui/app.board.test.ts`: **ledger explains pre-unlock pressure with multiplicative sources and live deepening**; **ambient reset on desktop and phone explains eligibility and retains zero-yield confirmation**. |
| M | `src/engine/mixed-draft.test.ts`: **ordinary World replacement uses the exact quarter boundary and equal type split only after discovery**; **ordinary offers retain at least two weighted module candidates at chance %f**; **mixed replacement preserves the opening roll's oscillator guarantee**; **World selection grants repeated unplaced copies once and preserves pending offers on reload**; **unlock and old-save translation preserve existing offers while fresh special drafts retain every guarantee**; **mixed offers retain the module skip payout and refuse invalid or locked selection without grants**. |
| A | `src/ui/app.mixed-draft.test.ts`: **mixed drafts route repeated World choices through inventory inspection and placement at %ipx**; **reload preserves a pending mixed choice and the unlocked Catalog's special draft remains guaranteed**. |
| H | `src/ui/world.test.ts`: **carries a six-sided steel silhouette from board to inventory, drag artwork and detail without changing cell hits**; **switching layers alters no World or board state**; **arm-and-place lands a tray weapon on an open face, free**; **an occupied cell refuses; enemy cells refuse, cleared ones included**; **right-click retrieves to the tray; the arm's Esc cancels**. |
| W | `src/engine/world.test.ts`: **a positive bank permanently unlocks World and grants an unplaced starting kit**; **preserves the first positive entitlement at 20M independently of retired Column prices**; **the horizon line stays the prestige gate and is never rescaled by the World work**; **Columns cannot be purchased or refunded through the retired purchase action**; describe **multiplicative penalty stacking (issue #425, priority 3)** and existing charge/combat/claim cases. |
| F | `src/ui/forge.test.ts`: **legacy queues and flags cannot expose a Mutator branch or inflate the Forge badge**; **an empty ordinary queue never falls back to pending legacy rolls**; **ordinary picks close when dry despite retained legacy queues**; **discloses live effects without presenting a retained Mutator Forge candidate**. |
| C | `src/ui/app.catalog.test.ts`: **the Accelerator placeholder is absent even for legacy owners**; **the retired pool join and empty Module Types section are absent**; **the legacy pool offer cannot spend Arete for existing owners**; existing capacity/term/flow cases. |
| E | `src/engine/exciter.test.ts`, `chorus-sideband.test.ts`, `roster.test.ts`, `temporal.test.ts`: named **retired** power/charge/resonance cases verify unchanged support, chord, relay and temporal output. `achievements.test.ts`: **retired resonance cannot grant Power chord in progress, action or tick checks** and **live milestones commemorate their beats but retired ownership flags grant nothing**. |
| Q | `src/ui/app.playthrough.test.ts`: **pushes past the first eligibility, banks, spends, deploys the starter rig, recovers, and advances the frontier**; `src/engine/progression-presets.test.ts`: **stops the pushing walk at the living fight with the placement unplayed**. Current declared workflow, not a new calibration matrix or replacement for visual acceptance. |
| V | Final desktop/phone captures and keyboard/touch, non-color and reduced-motion judgment: **unavailable**, bounded attempts recorded below and in `browser-attempts.json`. Automated shape/accessibility checks do not satisfy V. |

## #530 criterion mapping

| Criterion, in ticket order | Verification / status |
| --- | --- |
| Audit copies/slots/pending/Forge/flags/actions/UI; no live revival | Audit above; R, L, F, C, E. Automated/source. |
| Remove obsolete offers/mechanics and Accelerator, no reskin/gates | R/L/F/C; source diff keeps World distinct and useful purchases entry-free. Automated/source. |
| No new era reset/refund; unrelated progress and World retained; idempotence | R whole-state/World and era invariants, D and L repeated boot; existing save/recovery cases deliberately updated only for terminal retirement. Historical migration gates retained. Automated. |
| Application + action/save legacy workflows prevent revived offers/gates/grants/effects/interactions | L, R, E, F, C; all public boundaries, no private mocks. Automated. |
| Integrated hidden-pressure → zero reset → positive bank/kit → mixed draft → unplaced grant → deploy → later prestige → reload | J; P precise pressure/ambient boundaries; M/A draft probability and routing; Q earned declared journey. Automated, not pacing/visual proof. |
| Reconcile domain including pending #527, retired contracts, deferred weapons, Columns, ledger, calibration limits | CONTEXT, ADR-0087 status, supersession notes on ADR-0043/0074/0079, instrument amendment, feedback brief and save-migration amendment. Source verification. |
| Parent-wide mapping and honest provenance/invalidation | Tables below plus prior provenance table. Source/manual record. |
| Preliminary review/fixes → freeze → final suites and desktop/phone evidence | Source gate below; final runs/captures recorded below. Missing visual evidence remains a blocker, not substituted by scripted workflows. |

## #525 stories — complete parent mapping

Each row is automated unless it explicitly names V; V remains the separate visual acceptance obligation even where automation passes.

| Story | Requirement | Named verification / limits |
| --- | --- | --- |
| 1 | Hide undiscovered World navigation/previews | J; `world.test.ts` (UI) **before discovery World has no navigation or map preview**, **before discovery flow has no World preview either**; V. |
| 2 | Combined pressure outside hidden map | P pressure case: two 20% penalties read 36.0%, not 40%; V. |
| 3 | Active-source breakdown | P pressure case: each source and ×0.800, defeated-source exclusion; V. |
| 4 | Disclose era deepening | P pressure case: standing explanation and 87.8% deepened read; V. |
| 5 | Teach positive prestige discovery | P and J explain before unlocking; D excludes pending/zero/spending; V. |
| 6 | Eligible versus positive-yield reset | P ambient case, J and D zero/positive transitions. |
| 7 | Explicit zero-yield confirmation | P ambient case and J; V confirmation. |
| 8 | Immediate positive-bank unlock | J and W positive-bank case. |
| 9 | Guaranteed unplaced Column/Blade | W positive-bank case, J. |
| 10 | Permanent later-era access | D later-zero/positive case, J boot. |
| 11 | Once-only starter kit | D repeat resets/reload, J. |
| 12 | Desktop ambient pending yield | P ambient case; V. |
| 13 | Phone ambient pending/reset without menu | P ambient case; V. |
| 14 | Single explicit ambient Reset era beside yield | P ambient case and source inspection (shared ledger remains established secondary flow); V. |
| 15 | Deliberate reset confirmation | P and J use real confirmation; V. |
| 16 | Discoverable unavailable reason | P checks focusable aria-disabled/reason and mode refusal; V actual appearance/input. |
| 17 | Distinct World hex faces | H silhouette case; V readability/composition. |
| 18 | Board/inventory/drag/detail consistency | H shared artwork, A workflows; V real drag and surfaces. |
| 19 | Unchanged placement/combat | H placement/state cases and W existing combat/charge cases; source no topology/combat rewrite. |
| 20 | Columns via ordinary drafts, no sale | M/A/J routing, W retired purchase and C Catalog absence. |
| 21 | Additional drafted Blades | M repeated acquisition, A both kinds. |
| 22 | At least two modules per ordinary offer | M deterministic boundary cases plus opening-rig protection. |
| 23 | One unplaced World reward, inspect/deploy | M action/save, A and J real UI grant/placement. |
| 24 | Repeated Column/Blade ownership eligible | M repeated copies case, A repeated picks. |
| 25 | Special draft guarantees | M special/pending case, A Catalog special workflow. |
| 26 | Existing offers preserved | M before/after unlock/translation/reload; R preserves old offer and refuses only retired Forge candidate. |
| 27 | Type-wide irreversible persistent Hone | D Hone current/future/reload case; J buys before discovery. |
| 28 | Preserve unrelated save progress and placed World | D translation, R, L. |
| 29 | Translate unlock/free Column once | D parameterized old-eligibility case; application **loading an eligible old save discovers World and adds exactly one free Column without rewriting progression** in `app.world-progression.test.ts`. |
| 30 | Retire Mutator gates/offers/mechanics/placeholder | R/L/F/C/E and audit. |
| 31 | Keyboard/touch accessible disclosure/confirm/reasons | P accessible states and Catalog term-handler regressions; **V physical input and appearance remain unavailable**, automation is partial only. |
| 32 | Reduced motion and non-color identity/action states | H state/artwork cases and existing static reduce CSS source review; **V visual judgment remains unavailable**, automation is partial only. |

## #525 implementation decisions — one row per requirement

| Decision | Named verification / source disposition |
| --- | --- |
| Prestige banks, spending differs; first positive bank is discovery | D zero/pending/spending exclusions, J, W bank case. |
| Preserve 7M/20M/curve/reset/grant; remove Blade price coupling | W horizon/20M cases; existing `prestige.test.ts` and frontier/claim-grant cases. No BALANCE/accumulator arithmetic changes. |
| Persist permanent discovery/once-only kit/placement | D later resets, J and R/L World retention. |
| Hide all pre-unlock surfaces; pressure exception only | J, UI World hidden cases, P; V. |
| Preserve enemy discovery/deepening/combat; disclose multiplicative active pressure | P concrete independent percentage/factor literals; W arithmetic/charge/combat cases, H unchanged-state test; V. |
| Desktop/phone ambient yield/reset, confirmation/mode/reason; Catalog spends; no horizon/every-figure actions | P ambient workflow, existing board/ledger/Catalog regressions and source inspection; V. |
| Distinct hex faces across four surfaces; unchanged hits/topology | H silhouette and placement cases; V actual pointer drag/composition. |
| Remove Column sale/row; keep irreversible type-wide Hone; no refunds | W retired action; D Hone; C/J Catalog, R no refund. |
| Existing ordinary draft boundary handles heterogeneous grants | M action/save and A/J actual Forge selection; separate World collection constructors. |
| 25% replacement, equal types, max one World/min two modules; weighting preserved | M deterministic exact-quarter/exact-half and weighted-module cases; existing `draft.test.ts`/`rolls.test.ts`. |
| World unplaced/no tier/repeats; special and existing offers unchanged | M/A, R retained Forge candidate disposition; no candidate reroll. |
| Shared Blade acquisition temporary; no weapon pool/Blacksmith | CONTEXT/ADR-0087 and source audit: existing draft dispatch only. |
| Retire all Mutator remnants/Accelerator, not reskin | Audit, R/L/F/C/E. |
| Existing-save retention/unlock/free Column idempotent, no new reset/refund | D translation/reload; R/L; pre-v13 historical conversion explicitly retained, not relabeled as retirement. |
| Reconcile domain; preserve historical calibration identity | Domain changes listed above, numeric baseline/recordings unmodified; limits below. |
| Instrument amendments, no new visual language | Pin/source comparison: existing clipped Catalog/Forge shells, open divisions, square controls, term disclosure, World steel hexes retained; **V still owed**. |

Parent Testing Decisions are exercised by J/L/A/Q (highest application seam), R/D/M/W/E (action/save precision), P/W (pressure arithmetic), H/W/D (placement/combat/Hone/reset regressions), deterministic M boundaries and special/pending preservation. Browser testing remains V, never replaced by those seams. Out-of-scope review: no new weapon pool/currency, topology/combat/merge or claim rebalance, general refunds, blanket era reset, unlocked-map preview, one-click reset, every-figure action or horizon bar.

## Earlier slice provenance and invalidation

| Slice | Recorded source and record | Current use / limits |
| --- | --- | --- |
| #526 | `bddde9aea7a60c3e6a44069f5a9466ff93ab2da4`, `../issue-526/README.md` | Prior authorship/provenance only. Archived `superseded-*` captures/results stay superseded. Old full-suite green is invalidated by later source; current inherited tests rerun at #530 freeze. Prior screenshots unavailable. |
| #527 | `e54b19b12dc8a3a841ef8ddf099da4441e8a12ba`, `../issue-527/README.md` | Prior implementation provenance. Its full suite was incomplete, not a green claim; no missing implementation inferred. Current P tests rerun at #530 freeze. Prior screenshots unavailable. |
| #529 | `f1e66f05`, `../529-world-hex/README.md` | Prior hex implementation/source comparison. Earlier full-suite/capture provenance is not current #530 evidence. Current H/combat regressions rerun; prior desktop snapshots and phone viewport failed. |
| #528 | `b143fa4e2aa2da1befad7ed7d809fc7956ce26e7`, `../issue-528/README.md` | Prior mixed-draft authorship, deterministic cases and evidence identity. Earlier checks/scripts are not current #530 acceptance. Current M/A rerun. Prior screenshots unavailable. |

All earlier suite/provenance/script artifacts describe their original commits. None is relabeled current. Final #530 suites regenerate automated evidence for inherited and changed tests together. Required parent visual evidence is regenerated/attempted at the frozen current checkout; unavailable old images never become current images. Historical opening/century/later-era recordings and frozen save-translation arithmetic retain their own identity and outstanding limitations. Removing the Column sink, removing legacy spending/effects and changing runner policy invalidate any claim that those recordings validate today's acquisition economy. No new calibration success, timing window or economic recoverability verdict is claimed here.

## Preliminary source/spec gate and freeze

Self-review (no delegates) reads diff, specification, instrument pin/amendments and this mapping before final evidence. Findings resolved together before freeze:
- Correctness: retained Forge candidates could pay retired scrap through Skip; made their valuation zero, with a meaningful red/green test.
- Correctness: lost retired fill/investment could demand monetary recovery; retired-only exclusion added, preserving live-money recovery tests.
- Reachability: runner still attempted entry/Mutator choices and used ownership gates; removed from current management and policy copy. Live route probing no longer offers a retired entry route. First lasting-purchase recovery now records Rack Extenders too: without the old entry gate, the declared row-expansion rule correctly spends the first three Arete there. An initial iteration incorrectly expected two Hone ranks, and the named policy tests rejected that assumption; assertions now describe the actual declared expansion rule. Historical supplied records and price arithmetic remain unchanged.
- In-memory safety: generic module lookup/deployment and bulk eligibility also exclude retired Forge copies, preventing placement, spending and reshape constraints even before a reload. The added red/green action test covers that boundary, with a live Forge production control.
- Domain/source accuracy: stale pending #527/#530 and active Mutator promises reconciled; legacy contract tests replaced with retirement invariants, not skipped. The obsolete `mutator.test.ts` positive-mechanics suite is removed; current R/E/achievement cases assert those effects cannot return. Historical price arithmetic tests remain for pinned refunds/provenance.
- Optional broad cleanup declined: deleting historical glyphs, types, board renderers and frozen fixtures would destroy interpretability without strengthening the live boundary. Compatibility names remain refusals, not a second progression system. No new renderer architecture or tuning introduced.

Second source/spec read checked these fixes, the parent/ticket mapping and named assertions; no further required source fixes were found. Final touched-area iteration passed 24 files/528 cases (`targeted.log`), policy iteration 2 named cases (`targeted-policy.log`), and route enumeration 1 named case (`targeted-routes.log`). These are targeted iteration, not the final full-suite or visual gate. `targeted-policy-obsolete.*` deliberately retains the rejected iteration, not a current result. Final suites/captures are **owed at freeze**, not claimed by the preliminary gate. Source freeze commit and final results are recorded below after commit. Independent final code review belongs to the coordinator after integration.

## Freeze/revision chronology and invalidated evidence

1. Initial source freeze `c49171bbceb99d3a66c34c1e27aefb1f19b7ca33` followed the preliminary source/spec gate and targeted checks. Merging `integration/525-world-progression` reported already up to date at `e7ba47d`.
2. Its final `npm run check` passed. Its final `npm test` **failed**: 8 failed files/cases, 124 passed files, 2373 passed cases, 9 existing skipped cases. These artifacts are retained as `check-c49171b-obsolete.*` and `test-c49171b-obsolete.*`, not current acceptance evidence.
3. The eight failures exposed stale contract expectations/fixtures outside the initial targeted set: dev grant ownership, scenario Arete after Rack Extenders, an unpersisted World fixture missing its permanent discovery bit, the removed Mutator Forge tab in scrap UI, live World-policy Hone spending, response support's removed power multiplier, removed Forge backfill in recovery, and Mutator fields deliberately absent from the allocation fingerprint. Required test-source revisions preserve the live contracts: explicit unlocked fixture, unchanged baseline output, no backfill/tab, no Mutator-driven allocation solve, and current declared spending. No production behavior or balance was changed by this revision.
4. Re-read all eight revisions against the retirement specification: they assert the new contract rather than skip cases or weaken unrelated checks. The initial final evidence is invalidated. The fresh targeted revision run passed all 8 named cases in 8 files (`targeted-revision.log`, 601.52s); other tests were filtered out, not a full-suite claim. Source freeze and final check/full suite are owed below. The initial clean-server preflight/provenance and log are archived as `*-c49171b-obsolete.*`; no screenshot or visual acceptance was produced at that revision. A mistaken `npm run evidence:health` invocation had no such script; `capture-health-command-error.log` records the command error, not a health result. The standing health command is `node tools/evidence-healthcheck.mjs`.

## Final checks and browser evidence

Revised source freeze: **`20c86cdd99e49e8d0d3e4ac323a7ad8088668a43`**. Merging `integration/525-world-progression` again reported already up to date at `e7ba47d`. All subsequent edits are evidence-only under this directory. The prior failed full run is not a green or a waiver.

| Final check | Result / artifact |
| --- | --- |
| Runtime/calendar/storage | PASS — `runtime-preflight-final.log`: declared/effective Node 22.23.4, America/Chicago UTC−06:00, happy-dom localStorage round-trip. Initial bare-host Node 26 rejection was corrected with `mise exec node@22.23.4`; supported check scripts select the pinned runtime. |
| `npm run check` | PASS — `check.log`, `check.exit`: strict tsc and recorder static gate, 5 scripts/no static defects. |
| `npm test` | PASS — `test.log`, `test.exit`: 132 files passed, 2381 cases passed, 9 reported skips (2390 total), 1018.33s, exit 0. No skipped case is used as acceptance evidence. Raw no-repository diagnostic stderr is retained verbatim in the log; there is no final failing case. |
| Capture preflight | PASS — exact URL `http://localhost:5174/`, verified worktree, branch, source commit above and clean source; `provenance.json`, `capture-preflight.log`, `server.log`. |
| Capture health server side | PASS — `capture-health.log`, using the standing `node tools/evidence-healthcheck.mjs --url ... --viewport 1280x900` command. This is not a browser pass. |
| Browser snapshot readiness | UNAVAILABLE — same verified, available, loaded, dialog-free tab; three `preview_snapshot(includeImage:true, save:true)` attempts each timed out after 15000ms, with `preview_status` between attempts. No further snapshots after the shared budget was exhausted. No image produced. |
| Visibility | UNAVAILABLE — activation and status kept reporting `visible:false`; loaded URL was confirmed, but the required successful same-tab confirmation snapshot was unavailable. |
| Phone 390×844 | The page size read reported 390×844 after resize, despite the resize response echoing 1280×800. Capture still UNAVAILABLE because the snapshot pipeline had exhausted its shared budget. Size alone is not visual evidence. |
| Desktop 1280×900 | UNAVAILABLE — three resize attempts echoed the requested setting but page reads remained 390×844 after each; status recovery between attempts confirmed the stale/mismatched viewport. No stale echo was treated as confirmation. |
| Keyboard/touch/focus, non-color, reduced motion, four-surface visual identity and prototype composition | UNAVAILABLE browser judgment. P/A/H/J/L provide named automated partial coverage, not visual acceptance. |

Full tool-result transcription is `browser-attempts.json`; the owned tab was closed after the bounded pass. No screenshot, capture, video, browser interaction judgment or visual approval is fabricated. Both desktop and phone visual acceptance remain open **blockers** for #530/#525 and inherited #526–#529; no issue is closed and no scope waiver is asserted.

No new balance calibration was run or claimed. The current declared policy cases are workflow verification only; historical matrices remain invalid as proof of today's economy. `npm run build` is not a separate local per-revision obligation under `docs/agents/checks.md`; no calendar boundary/schedule arithmetic changed, so no new `test:calendar` obligation was introduced. Install reported three existing high-severity dependency audit findings (`install.log`); dependency upgrades are outside this slice.

## Handoff disposition

Implementation and the revised final required automated checks are complete at source `20c86cd`. This completion record, its parent-wide mapping and raw evidence are committed in an evidence-only follow-up; those additions do not change tested/capture-attempted source. Final integration-tip confirmation still resolves to `e7ba47da9f5e552794922405fae218e818677316`; merging that tip into this branch reports already up to date. The branch descends from it.

**Acceptance remains blocked on unavailable desktop/phone visual evidence**, including keyboard/touch/focus, non-color, reduced-motion and instrument/prototype visual judgment. Scripted workflows, literal probability/pressure tests, live-size reads and historical recordings do not waive those blockers. Coordinator independent final review after integration is a separate pending gate. No subagents were used; no issue was closed and no PR was edited.
