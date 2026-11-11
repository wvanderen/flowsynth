# #536 — integrated Encyclopedia acceptance / parent #532 completion mapping

## Identity, scope and disposition

Issues #536 and #532 were read in full through `gh issue view --repo wvanderen/flowsynth --json title,body,comments`; both comments arrays were empty. Isolated checkout starts at **ca50f1536057e457bc4a23a7c14235b71ce4c867**, exactly the requested local `integration/532-encyclopedia` tip. `git merge-base --is-ancestor ca50f15 HEAD` passed. Branch/worktree inspection found the prior acceptance branch `t3/integrated-encyclopedia-acceptance` also at ca50f15: no extra committed work to adopt. No sibling checkout was modified or treated as completed acceptance. No subagents or issue mutations.

All three implementation slices are already integrated. This revision adds only an app-seam mixed-state regression and strengthens the non-default board-view assertion; no production behavior, balance, save translation, allocator or disclosure contract changes. No production defect was exposed, so there is no invented red/green fix claim. TDD is the required method for any discovered production defect; the added combined regression passed immediately and is explicitly a coverage check, not a witnessed regression repair.

**Final acceptance is not established by source/tests.** Human comprehension, physical-device and independent perceptual/accessibility judgments are unavailable; no scope waiver is recorded. Final suite/capture results are recorded below after execution. Historical “owed at freeze” wording in the gate/mapping tables describes the pre-evidence stage; final B rows resolve through the final evidence disposition, not through a relabeling of old slice captures.

## Verification key (exact named cases)

Unless noted, U = `src/ui/app.encyclopedia.test.ts`, E = `src/engine/encyclopedia.test.ts`.

- **U-mixed:** “preserves mixed three-topic knowledge across legacy import, repeated loading, real prestige and a full restart”. New combined boundary: Charge seen / Chords unseen / legacy Prestige backfilled seen, repeated import, actual positive reset, grouped browsing, final unseen clearance, hard reset and normal reintroduction. No isolated helper test or private catalog assertion.
- **U-dots:** “starts with visible Prestige, encounters the unaffordable visible shelf without opening, and clears the quiet mark only on reading”.
- **U-search:** “searches canonical and familiar words without hidden previews and returns from a contextual catalog detour”.
- **U-related:** “encounters visible unaffordable capacity, searches idle chords, and returns through related entries to the same Catalog”.
- **U-filter:** “filters browse search related and contextual routes, and returns through related reading during live flow”.
- **U-hidden:** “keeps hidden chord routes closed, then encounters an owned voice without opening and never relocks it”.
- **U-flow:** “encounters an owned tray generator during flow without opening and keeps the live session running while reading”.
- **U-inspect:** “reads chords from voice inspection during flow and restores the selected layer and board view”. Strengthened to zoom 2 / pan (10,-20), rather than only defaults.
- **U-focus:** “returns keyboard focus and the selected board task after inspection reading, with static teaching and no exercises”.
- **U-sections:** parametrized “returns from the %s section door with its scroll and selection intact” (rate/library).
- **U-reset:** “reads from confirmation without choosing, retains seen knowledge through zero and positive claims, export/import and full reset”.
- **U-import:** “imports and exports save-owned marks, clears them on full reset, and gives later encounters normal unseen marks after legacy migration”.
- **U-prestige:** “offers Prestige at the visible but ineligible reset, reads voluntarily, and returns to the ledger without resetting”.
- **U-empty:** “does not infer a Charge encounter from inspecting an empty cell”.
- **E-marks:** “round trips available and seen identity through reload and prestige, without copy-based rebadging”.
- **E-prestige:** “backfills Prestige from earned-era or prior-reset evidence, including Charge-era saves, and never rebadges on reload”.
- **E-chords:** “backfills the newly introduced chord lesson on Charge-era saves once, preserving later unseen encounters”.
- **E-owned:** parametrized “backfills the owned %s charge mechanic even in inventory”.
- **E-history:** “backfills durable chord discovery evidence after the relevant formation is gone”.
- **E-fresh:** “backfills owned Charge mechanics as seen, but never guesses exposure from the opening oscillator”.
- **E-invalid:** “normalizes malformed and unknown entries without exposing hidden knowledge”.
- **W-boundary:** `src/ui/app.world-progression.test.ts`, “hides World until a confirmed positive prestige, then retains the usable kit across resets and reload”.
- **Local facts:** `src/ui/app.catalog.test.ts`, “shelf rows carry the simplified module preview and one description line”; `src/ui/forge.test.ts`, “opens the section Charge reference without choosing and returns to the same draft”; `src/ui/app.mixed-draft.test.ts`, “Blade draft retains its effect and the section Charge reference returns without consuming the offer”; `src/ui/app.migration.test.ts`, “the explanation names what was kept and what moved, and offers the retained original”. Detailed actual-state coverage remains in the existing Hex detail/Catalog suites, not a new parallel framework.

## Every parent user-story obligation (#532, original numbering)

A = automated named case; S = recorded source verification; B = final browser evidence owed at freeze; X = unavailable judgment. Source review is not browser or comprehension evidence.

| # | Parent obligation | Verification / limitation |
|---|---|---|
| 1 | Relevant introductions | A U-dots/U-hidden/U-prestige/U-empty/E-owned; encounter inventory below. |
| 2 | Voluntary reading | A U-dots/U-flow/U-prestige; no auto reader. |
| 3 | Flow notice without interruption | A U-flow/U-inspect/U-filter. |
| 4 | Global independent door | A U-dots (separate Settings round trip); S index.html utility book door. B desktop composition owed. |
| 5 | Phone global access, no hover dependence | B phone global door/touch owed; X physical phone validation. |
| 6 | One quiet aggregate dot, no count | A U-dots/U-mixed; S static six-pixel persistent dot, no animation/toast/sound/count. |
| 7 | Individual unseen marks | A U-dots/U-mixed; text “Unseen”, not color alone. B owed. |
| 8 | Immediate seen on opening | A U-dots/U-mixed, before scroll/time. |
| 9 | Seen does not claim learned | S catalog/reader state and copy only “available”, “seen”, “Unseen”; no learning/completion claim. |
| 10 | Stable topic groups | A U-mixed literal ordered Board mechanics/Progression; S grouping by catalog group, not availability timestamp. |
| 11 | Title/keyword search | A U-search/U-related/U-filter. |
| 12 | Familiar aliases | A battery/power/Flywheel; idle/budget/recognition; start over/reset/Arete in same cases. |
| 13 | Hidden omitted browse/search | A U-hidden/U-filter/U-search. |
| 14 | Available-only related links | A U-flow/U-filter/U-related. |
| 15 | No locked silhouettes or denominator | S reader renders only available catalog results, no total or completion UI; unrelated Chord Collection denominator intentionally unchanged. |
| 16 | Deliberate contextual door | A U-search/U-sections/U-inspect/U-prestige; S one route per relevant section. |
| 17 | Context shares availability, no help-trigger unlock | A U-hidden/U-empty; S availableEntries gates routes and opener before mutation. Prestige always encountered at visible reset before render. |
| 18 | Short concept/behavior/decision explanation | S three authored catalog entries reviewed; X whether explanations actually teach humans. |
| 19 | Spatial charge example | A U-flow/U-focus static illustrative content; S strength 2 to two adjacent receivers, full strength each; B readable phone diagram owed; X comprehension. |
| 20 | Recognized versus active/idle | A U-inspect illustrative whole-chord text; S two-chord capacity-1/2 example agrees with Allocation; X human explanation. |
| 21 | Find actual capacity constraint | S entry directs participating hex Chord facts, every member, used/available, active/idle and certification; local surfaces retained. X representative player locating actual constraint. |
| 22 | Enduring purpose of prestige | A U-prestige; S authored banks whole claim / memorized upgrades / frontier example; X comprehension. |
| 23 | Actual reset losses/preservation local | A U-reset; S full confirmation diff retains all existing losses/preservation/warnings. B confirmation compositions owed. |
| 24 | Illustrative not live figures | A U-flow/U-related/U-prestige; S all figures explicitly labeled “Illustrative example — not your live …”. |
| 25 | General rules agree with engine | S catalog against CONTEXT Charge/Allocation/Idle/Harmonic capacity/Prestige and ADR-0051/0052/0060/0062, claim flooring and frontier; examples not live predictions or optimality guarantees. |
| 26 | No real-board lesson actions/exercises | A U-inspect/U-focus; S authored static HTML, only navigation controls. |
| 27 | Keyboard/static essentials without precise gestures | A U-focus/U-inspect; B CDP keyboard/touch/static-reduced-motion owed. X physical accessibility/screen-reader judgment. |
| 28 | Close/Escape inspection return | A U-focus/U-inspect incl nondefault pan/zoom; B viewport checks owed. |
| 29 | Related Back retains original task | A U-related/U-filter; S history stays transient and clears on transient reset. |
| 30 | Phone return continuity | B phone touch Close/task restoration owed; X physical phone. |
| 31 | No flow pause/end/mutation | A U-flow/U-inspect/U-filter identical session, advancing elapsed; B combined reading flow owed. Seen state intentionally changes. |
| 32 | Knowledge through prestige/reload | A U-mixed/U-reset/E-marks. |
| 33 | Export/import continuity | A U-mixed/U-import/U-reset/E-marks; persisted knowledge not UI context. |
| 34 | Full reset clears knowledge | A U-mixed/U-import; visible reset immediately gets normal new-game introduction, not an empty app map. |
| 35 | Relevant legacy entries seen, no backlog | A E-owned/E-fresh/E-chords/E-prestige/U-mixed. |
| 36 | Later genuinely new entries unseen | A U-import/U-hidden/E-chords; normalization alone does not invent a future encounter. |
| 37 | Copy/support/balance edits do not rebadge | A E-marks; S stable IDs and valid marks win, no content hash; introduction revision only backfills missing older entries. No speculative copy mutation API. |
| 38 | Distinct mental model can have identity | S catalog owns stable charge/chords/prestige identities with per-entry introduction; Chords/capacity intentionally coupled, not one-page-per-noun. No additional topics invented. |
| 39 | Actual costs/effects/requirements/exceptions local | S consolidated inventory below; A Local facts/U-related/U-reset. |
| 40 | Replacement/access before removing gloss | S slice history and inventories below; entry/relevance/context routes precede deletion in integrated source; no help gap. |
| 41 | No World spoiler before discovery | A U-filter/U-flow/U-prestige/W-boundary; S no World catalog page/links, prestige speaks limited visible consequences only. |
| 42 | Improves concrete decisions, not just page views | X human tasks below; explicitly outstanding acceptance blocker. |

## Parent implementation/testing obligations (not reduced to stories)

| Obligation | Verification / classification |
|---|---|
| Existing app/UI/domain/save seams; no second help framework | S integrated diff `git diff 73ed4aa...HEAD` plus current test diff: existing App/render/modal/focus/save boundaries; static authored reader only. A U/E cases. |
| One authoritative catalog for identity/group/keywords/content/relevance/relations | S `src/engine/encyclopedia.ts`; `availableEntries` reused for browse/search/context/related/opener. UI transient reading fields not saved. |
| Per-entry concrete encounter/legacy evidence; visible unaffordable and owned mechanics | A U-dots/U-prestige/U-related/U-hidden/E-owned/E-history/E-fresh/E-chords/E-prestige; inventory below. |
| Fresh retention/no auto opening in upgrade and flow; immediate aggregate/per-entry marks | A U-dots/U-hidden/U-flow/U-mixed, both modes; E-marks. |
| Save normalization after historical conversions, idempotence, no separate device store/economy disturbance | A E cases/U-mixed/U-import; S normalizeEncyclopedia at existing readSave normalization end; global SAVE_VERSION remains13; no historical arithmetic changed. |
| Browse/search/related/context spoiler boundaries, no checklist | A U-filter/U-hidden/U-search; S available-only renderer, W-boundary. |
| Inspection/browsing/ledger return, selections/scroll/layer/pan/zoom as applicable | A U-search (Catalog scroll85/focus/funds), U-sections (scroll72/chord stage), U-inspect (detail/layer/zoom2/pan10,-20/live session), U-prestige/U-reset; B phone/desktop owed. |
| Meaningful static examples and accurate general rules | S three entry bodies versus domain/ADRs; A U-inspect/U-flow/U-prestige. B readability owed; X comprehension. |
| Selective disclosure one-place/removal test; unrelated contracts unchanged | S consolidated inventory and integrated source review; A Local facts. No Details/rate roster expansion or transient chord-control changes. |
| Desktop/phone compositions, keyboard/touch/dismiss/focus, non-color, reduced motion | B final pass owed; X physical-device, screen-reader and independent perceptual judgment. Prior #535 images show Prestige only and are not relabeled as complete integrated acceptance. |
| Standing process and honest unavailable results | Preliminary gate below; final check/test/capture owed after freeze, once. No calendar or economy source touched: calendar/calibration reruns not owed. |
| Human comprehension tasks | X no representative human participant, tasks below. UI success is not understanding. |
| Non-goals | S no extra topics/World page, global purge, mandatory actions/quizzes/tours/checklist, live-board lesson, balance/reset-economy change, inline calculations or unrelated interaction change. |

## Combined encounter and migration inventory

- **Charge:** visible starter shelf (zero funds included), inspected charge-bearing profile, visible Forge meter, owned generators/boosters/Forge/conduits/RITUAL or Blaster/Sideband/Saw in board/tray; purchased generator/booster/Forge receipts. Empty cell/silent wire do not qualify. Solitary default Sine is not legacy exposure; actual inspection is an encounter.
- **Chords/capacity:** visible capacity offering/Ledger/Collection, inspected voice, relevant owned nonstarter voice (including silent voice/tray), multiple voices, formed-chord history, purchased ladder/ceiling/discount receipts. Solitary default Sine is not legacy exposure.
- **Prestige:** visible ambient reset from opening render, including ineligible/flow. Legacy evidence requires earned era nous, prior reset (zero included) or banked Arete, not untouched defaults.
- Available and seen knowledge never relocks. Catalog introductions1/2/3 backfill missing older relevant entries as seen, keep explicit mixed valid marks, then write current reference revision. Current empty records do not gain an engine-only backlog; later app encounters remain unseen. Repeated loads are idempotent. Unknown identities/invalid marks do not expose hidden topics. Full reset clears then visible new-game mechanics introduce normally.

## Consolidated before/after disclosure inventory and mistaken-choice test

This consolidates `../issue-533/README.md`, `../issue-534/README.md`, `../issue-535/README.md`; their historical suite/capture results retain their own source identities, not current-source passes. Every removed fact below is reusable explanation, not a live decision fact. Test applied: could a concept-aware player make a materially mistaken choice without it?

| Surface / before | Integrated after | Retained facts / removal-test result |
|---|---|---|
| Starter shelf repeated generic charge tooltip | Plain charge, one section About charge plus global entry | Exact Flywheel earning/Booster/Forge effects, cost, countdown, funds/acquired state stay. Generic “generator output powers modules” changes no current choice: safe removal. |
| Module offer effects, charge chart axis, reset conversion report generic charge links | Plain charge, global/Forge/inspection reference | Candidate profile coefficients/effects, plotted actual values and explicit “charge empties” remain. Definition adds no live fact: safe removal. |
| Inspection profile/inventory/Forge | Adds relevant section route; teaching spatial example lives once | Actual received strength, reserve, response, resulting production, costs and draft choice remain. No live facts removed; reading cannot consume draft. |
| Nous Catalog capacity header/effect repeated generic budget explanation | Plain names/effect and one About chords section route | +1 every voice, current/next allowance/ceiling, price/countdown, affordability, capped/next-bay conditions, Poly Expander reset gloss stay. A concept-aware player can still judge purchase: safe removal. |
| Ledger capacity generic budget definition | Allowance / ceiling, actual figures, About chords | Current constraint retained locally; units clarified. General definition adds no live decision information: safe replacement. |
| Hex detail Chord facts / Collection | Adds one section About chords route | Actual per-voice used/available, certification, factors, Formation, active/idle names remain; Collection stage, roots/current instances/discovery bonuses unchanged. No decision facts removed. |
| Developer chart generic Prestige gloss | Plain Prestige with global/ledger/confirmation access | Actual plotted resets/count/balances unchanged. Generic reset definition adds no current consequence: safe removal. |
| Ledger Arete and reset confirmation | Adds About prestige; no loss/preservation copy removed | Actual bank/yield, mode/horizon restriction, zero warning, module levels/capacity/nous/charge losses; board/tray/rolls/progress/feats/life/Arete/scrap/lifetime nous/World preservation remain. All can alter reset choice and remain local. |
| Other terms, inventory capacity short gloss, transient chord readout, rate roster, World contracts | Unchanged narrow contracts | No global purge, inline roster calculations, Details or new transient controls. Short useful local disclosures remain allowed. |

Teaching is materially reduced by removal of repeated generic charge/Prestige term controls and the two repeated Catalog capacity definitions; the three reusable examples live once in catalog entries. Help routes are section-level rather than controls on every occurrence. This is a source/inventory judgment, not proof of human comprehension or perceptual economy.

## Preliminary integrated source/spec gate (before freeze)

Sequential self-review, shared implementation context, **no independent review claim**. Standards pass then spec pass. Reviewed integrated runtime diff against pre-feature73ed4aa, the new test diff against requested ca50f15, #536/#532 in full, TDD/testing guidance, CONTEXT and relevant ADR rules, instrument standards and pinned prototype/controls source (`eb232c4`, `d405ce2`), checks/review/verification/visual-evidence instructions.

**Standards:** shared catalog/app/save boundaries preserved; square controls/open divisions/static reader, no new decorative UI or broad purge. No documented source violation found. Optional extraction of repeated help-button wrappers is **declined**: existing tiny typed routes are clear, generalization has no acceptance benefit and would needlessly invalidate working source.

**Spec:** prior tests did not combine a legacy mixed three-topic map with an actual positive reset and final-unseen clearance, and board-return assertion used default pan/zoom. These are **verification gaps**, resolved together by U-mixed and strengthened U-inspect before freeze; both pass. No production correctness defect exposed; no runtime edit or false red claim. Existing cases cover hidden routes/later encounters/zero reset and shared reader origin. Copy-based seen identity verified by source plus lifecycle tests, not a fake content rewrite.

**Outstanding evidence obligations:** final suites/captures owed at freeze. Human comprehension and physical/independent perceptual checks unavailable, never inferred from UI tests. These block final acceptance without an authorized waiver, not the source freeze. No source defect remains from this review; fix-review read of both test edits confirms approved seams and observable transitions. `targeted.log`: four files56 passed. `git diff --check` passed. Initial preflight refused Node26.13.0; `mise exec node@22.23.4 -- npm run preflight` accepted pinned22.23.4, America/Chicago and UI storage. Fresh worktree ran npm install first. No repeated green full run performed.

## #536 criterion mapping (original order)

| # | Integrated criterion | Verification |
|---|---|---|
| 1 | Fresh/backfill/mixed/later/retention/no automatic opening/final unseen | A U-mixed/U-dots/U-import/U-hidden/U-flow; E migration cases. |
| 2 | Stable browse/search/related/context/hidden/World | A U-mixed/U-search/U-related/U-filter/U-hidden/W-boundary. |
| 3 | Reload/export/import/real reset/full reset/idempotence/copy stability | A U-mixed/U-reset/U-import/E-marks/E-prestige/E-chords; S stable identity. |
| 4 | Return focus/selections/scroll/layer/view, ongoing flow | A U-search/U-sections/U-focus/U-inspect/U-filter/U-flow; B viewport evidence owed. |
| 5 | Consolidated removal inventories and all local facts | S consolidated table above plus Local facts named tests. |
| 6 | Targeted approved seams only / no repeated green full suites | U-mixed covers unresolved combined boundary, U-inspect strengthens nondefault assertion. No private seam/new API. Final once-per-revision run owed. |
| 7 | Preliminary review/fix/freeze then final evidence | Gate above, freeze and final evidence below. |
| 8 | Final desktop/phone keyboard/touch/focus/non-color/static | B owed at freeze; physical/human/independent judgments X. |
| 9 | Representative comprehension tasks or honest unavailable | X tasks below, no participant. |
| 10 | Every parent obligation mapped, status honest, no issue edits | This record covers42 stories plus architecture/testing/non-goals and10 integrated criteria; no issue closure/edit. |

## Human tasks — unavailable, not passes

No representative human participant or physical-device observer is available here. Do not substitute scripted page views or the agent's knowledge.

1. **Charge:** without coaching, explain which adjacent receivers receive supply in the authored diagram, whether adding one divides supply, then identify actual received strength/reserve on their own build.
2. **Chords/capacity:** explain recognition versus activation for an idle recognized chord, inspect all participating voices and locate the actual used/available capacity and allocation/certification facts; do not assume every idle chord lacks capacity.
3. **Prestige:** explain enduring Arete/frontier purpose, then state this actual confirmation's yield/losses/preserved value and decide whether to proceed without relying on illustrative3.4.

Record participant responses and errors, not “opened successfully”. All three comprehension results remain **unavailable and outstanding**. Physical touch/keyboard, screen-reader delivery and independent perceptual/accessibility approval are likewise unavailable. No approved scope reduction is recorded.

## Freeze and final evidence

Frozen source: **3027445959f905703ea4be2b8f8c3de7fb631f64**. The preliminary gate and verification-gap revision preceded this commit; final suites and captures followed it. Only evidence artifacts change afterward. No production source fix or lifted freeze was required.

- **Passed — type/static:** `npm run check`, `check.log`; strict tsc and recorder static gate (five scripts, no static defects).
- **Interrupted, not passed:** the first `npm test` command was terminated by the tool's1000-second timeout before summary/exit. `interrupted-full-test.log` retained. Process inspection confirmed no surviving test process; it was not silently left running or called green.
- **Passed — completed full suite:** durable retry `npm test`, `full-test.log`, `test.exit` =0;134 files,2414 passed,9 skipped,1015.95s. Existing skip count unchanged; no new skip. The emitted git-not-a-repository diagnostic lines are test output, not failed cases. This retry is justified by interruption, not repetition of a green full suite. No separate full UI rerun.
- **Passed — targeted affected area:** `targeted.log`, four files56 cases; U-mixed plus app/save knowledge, modal focus and World boundaries. Earlier single U-mixed targeted pass in `mixed-targeted.log` is characterized accurately; no runtime fix was needed.
- **Passed — verified capture source:** `provenance.json` and `capture-preflight.log` accept the exact clean active checkout30274459 at `http://localhost:5173`.
- **Passed — scripted browser portions of every B row:** final `capture.log`, `capture.mjs`, `browser-observations.json` and PNGs indexed in **`final-browser-walkthrough.md`**. Actual desktop1280×900 / phone390×844; all-three-topic grouped/non-color unseen state and final-dot clearance; CDP keyboard Enter/Escape and emulated touch/Close; static reduced-motion articles; Catalog related Back, exact measured scroll return and no purchase; ledger/confirmation focus without reset; inspection same detail/layer/pan/zoom and same ongoing flow session after10 seconds. These are current integrated evidence, not rebranded #533/#534/#535 images.
- **Failed setup attempts retained:** early local-CDP phone inspection touches were intercepted by the development instrumentation. Failure logs/images and the diagnostic correction are explicitly separated from the successful final pass in the walkthrough. Only the dev panel is hidden for final evidence; no shipped surface or lesson content is changed. No preview failure is invented for this turn.
- **Unavailable / still blocking final acceptance:** the three representative-human comprehension tasks above; physical device/keyboard/touch and screen-reader validation; independent perceptual/accessibility/layout approval. The phone inspection-return image also leaves an explicit overall composition concern (scrolled Return/status overlaps standing ledger region) for that judgment; state/focus continuity is verified, visual usability is not inferred. No Encyclopedia-specific production regression was established by this concern and no source workaround is smuggled into evidence.

### Final evidence gate and integration

Mapping audit read all42 parent stories, the architecture/testing/non-goal obligations, and all10 #536 criteria beside the named assertions, source inventory and final browser artifacts. Automated/source and scripted-browser portions are verified; unavailable understanding and independent visual/accessibility judgments remain explicit **acceptance blockers**, not passes or approved deferrals. There is no recorded scope waiver. This record does not authorize closing #532 or #536.

Latest local integration merge was actually attempted with `git merge integration/532-encyclopedia`: **Already up to date**; tip **ca50f1536057e457bc4a23a7c14235b71ce4c867**. `git merge-base --is-ancestor integration/532-encyclopedia HEAD` passed. Final check is repeated immediately before reporting; no sibling checkout, integration ref or GitHub issue was modified. Evidence-only commit retains frozen source identity30274459 and owes no redundant full-suite rerun.
