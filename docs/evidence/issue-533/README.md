# #533 — Charge Encyclopedia completion record

Parent: #532. Scope: Charge only; no Chords/capacity, Prestige or World teaching pages.

## Provenance and confirmed references

The starting branch and local `integration/532-encyclopedia` both resolved to `73ed4aab76ee270985f810052db05937f52f270c`; `git merge-base --is-ancestor 73ed4aa HEAD` passed before edits. Both issues were read with `gh issue view --json title,body,comments`; both comment lists were empty. The confirmed brief, instrument amendment and CONTEXT definitions are present in that starting commit, not assumed from a remote or uncommitted sibling. GitHub has no remote branch by that integration name; the local integration ref is authoritative for the requested final merge.

Confirmed testing seams: the parent explicitly approves the existing running-app fixture and save serialization/deserialization plus game actions. No new test-only API or low-level catalog suite. No subagents.

## Concrete encounter and migration rules

Charge is meaningfully encountered when the starter shelf is visible (even at zero nous), a charge-bearing module profile is inspected, the Forge charge meter is visible, or a relevant module is owned in board/tray. Relevant ownership covers generators, boosters, Forge, conduits, RITUAL, and the explicitly charge-dependent Blaster, Sideband and Saw. The fresh Sine alone is not evidence of historical exposure; inspecting its charge-response profile is a real encounter. Empty cells and silent wire do not discover Charge.

Legacy saves without the knowledge field backfill those ownership/purchased-shelf facts as **seen** after existing conversions and normalization. No ownership/receipt evidence means no guessed backfill. The written empty map distinguishes an upgraded save from a legacy save; future encounters remain **available/unseen**. Both marks are durable and title-independent. Unknown/corrupt records cannot expose another topic.

## Named acceptance mapping (issue order)

UI cases below live in `src/ui/app.encyclopedia.test.ts`; lifecycle cases in `src/engine/encyclopedia.test.ts`.

| # | Criterion | Verification and class |
|---|---|---|
| 1 | Meaningful encounter, owned items, unaffordable visible mechanic, retention | **Automated:** “starts empty, encounters the unaffordable visible shelf without opening, and clears the quiet mark only on reading”; “encounters an owned tray generator during flow without opening and keeps the live session running while reading”; “does not infer a Charge encounter from inspecting an empty cell”; parametrized “backfills the owned %s charge mechanic even in inventory”. |
| 2 | Stable accessible desktop/phone book door, independent of Settings, layout review | **Automated:** first UI case opens through the accessible global door and subsequently verifies Settings' separate focus round trip. **Manual evidence owed at freeze:** desktop/phone layout and touch-size judgment. |
| 3 | One availability rule for browse/search/context/related, absent hidden pages, usable empty library | **Automated:** empty-library case and “searches canonical and familiar words without hidden previews and returns from a contextual catalog detour”. **Source review:** catalog filtered once by `availableEntries`, context and related destinations use that same list; only Charge exists, no locked pages or denominator. Multiple related topics are deliberately not fabricated for this slice. |
| 4 | Voluntary reading, quiet aggregate dot, immediate per-entry seen | **Automated:** first and flow UI cases check no automatic open, the unseen dot and label, immediate seen transition without scroll, and dot clearance. **Source review:** dot is static with no animation, counts, notifications or learned/completed claims. |
| 5 | Useful authored spatial Charge example, exact rules, static essentials | **Automated:** inspection and flow cases assert the illustrative content remains present and no exercise inputs/canvas/animation are required. **Source review:** worked strength-2 generator reaches two flanking receivers at full strength each; no splitting, additive incoming sources and reserve expenditure agree with economy and ADR-0060. **Human comprehension unavailable:** no human participant; opening a page proves no understanding. Final readability judgment owed at freeze. |
| 6 | Selective context routes, Close/Escape restores task/focus, flow continues | **Automated:** contextual Catalog case restores focus and scroll at unchanged balance; inspection case retains detail/zoom through Topics → Charge → Escape; flow case advances 10 seconds during reading and retains the identical live session. **Manual evidence owed:** real keyboard/touch desktop/phone. |
| 7 | Reload/export/import/prestige/reset, legacy seen and future unseen, idempotence | **Automated:** “imports and exports save-owned marks, clears them on full reset, and gives later encounters normal unseen marks after legacy migration”; “round trips available and seen identity through reload and prestige, without copy-based rebadging”; “backfills owned Charge mechanics as seen, but never guesses exposure from the opening oscillator”; parametrized owned cases and malformed-record case. Existing save/conversion regression files run targeted and are included in the full suite. |
| 8 | Stable identity, copy never re-badges, reversible navigation | **Automated:** save round-trip literal `charge` identity and inspection Topics round trip. **Source review:** seen records depend only on stable id, never a content/title/version hash; back navigation retains the original task. Cross-entry navigation is filtered and preserves that origin; its multi-entry exercise belongs to later slices as explicitly allowed by #533. |
| 9 | Replacement before removal; preserve decision facts; before/after inventory | **Source review/manual record:** inventory below. **Automated:** updated “shelf rows carry the simplified module preview and one description line” (`src/ui/app.catalog.test.ts`) retains the precise Flywheel effect and requires a section route instead of a redundant charge tooltip. Standing Hex detail, inventory, wave/effect and Catalog tests retain actual facts. |
| 10 | Reconcile confirmed refs; no Details, roster calculations, live-board lessons or purge | **Source review:** references reconciled above; only the `charge` generic term migrates, all unrelated term glosses and actual effect disclosures remain. Entry illustration is authored, not a second live inspector. |
| 11 | App-fixture behavior and focused save/action lifecycle tests | **Automated:** named cases above use the agreed seams, existing fixture, modal and normal UI actions; no private catalog tests. |
| 12 | Targeted/standing checks; source gate before freeze/evidence; honest unavailable judgments | Targeted checks and source review below. **Final checks/captures owed at freeze. Human comprehension unavailable**, not inferred. |

## Selective-disclosure inventory and mistaken-choice test

| Surface before | After | Facts deliberately retained locally / removal-test result |
|---|---|---|
| Starter shelf wraps every “charge” in the generic “Generator output that powers other modules” tooltip | Plain charge words; one “About charge” route for the shelf | Flywheel earning description, Booster and Forge effects, costs, countdown, affordability and acquired state remain unchanged. Knowing the concept plus these local facts still supports the same purchase choice. The removed gloss adds no current decision fact. |
| Generic `charge` term disclosures in module offer effects, chart charge axis and reset conversion report | Plain word; global reference and relevant Forge/inspection routes | Candidate effects and profile coefficients, actual chart figures, charge-clears reset/report consequences remain intact. The generic definition adds no numeric or exceptional fact and its removal cannot conceal a different current choice. |
| Board/inventory module inspection already has actual profile and current incoming wave facts | One section-level About charge route, not links on each term | Current received strength, per-design charge response, resulting production, reserve, costs, requirements and warnings remain in the existing face/wave/profile/action surfaces. None of their concrete facts are moved into the reference. |
| Unrelated terms (including Chords, capacity, Prestige and World-specific names) | Unchanged disclosures | Not migrated, not purged. No new inline rate calculation or expandable Details. |

## TDD and targeted checks

Red → green witnessed through the public seams:
- legacy backfill test first failed for absent `encyclopedia` field;
- first app journey failed for absent accessible global door;
- empty-cell regression failed when it incorrectly unlocked Charge;
- contextual Catalog regression failed with scroll 0 instead of 85;
- subsequent Settings focus regression failed by returning to the stale book invoker.
Each was resolved and rerun before continuing. Later cases cover the delivered slice rather than a speculative horizontal framework.

Environment: initial direct preflight correctly refused Node 26.13.0. `mise exec node@22.23.4 -- npm run preflight` accepted Node 22.23.4, America/Chicago and UI storage. npm test/check select the pinned runtime automatically.

Targeted command: `npm test -- src/ui/app.encyclopedia.test.ts src/engine/encyclopedia.test.ts src/ui/app.modal-focus.test.ts src/ui/app.catalog.test.ts src/ui/app.inventory.test.ts src/ui/hexdetail.test.ts src/ui/hexflows.test.ts src/ui/instrument.test.ts src/engine/save.test.ts src/engine/save-integrity.test.ts src/engine/save-recovery.test.ts src/engine/prestige.test.ts` — passed before source review; final touched-area rerun follows the review batch. No calendar behavior changed; calendar-specific rerun not owed. No balance or recorder behavior changed; expensive calibration recordings not owed.

## Preliminary source/spec review (before freeze)

Self-review in two sequential passes sharing implementation context, not an independent review. Compared source against issues #533/#532, the confirmed local references, instrument prototype/controls policy and standing verification rules. Final captures and standing suites were **owed**, not claimed at this gate.

**Standards findings:**
1. Breakpoint overrides must preserve the established 1100/900/600 header composition rather than introduce 1000/760 thresholds. **Documented-standard violation; fix with batch.**
2. Local confirmed documents still described every part as unimplemented. **Accuracy correction; fix with batch**, distinguishing implemented Charge from planned later slices and pending visual/human acceptance.

**Spec findings:**
1. Reading origin must be cleared with transient UI, and a direct common-modal opener must use the same reader route. **Correctness; resolved in implementation and retained in batch.**
2. No seen marker may claim comprehension; human understanding and final visual layout are not established by automated tests. **Evidence limitation, not a waiver:** record human comprehension unavailable and perform post-freeze browser checks; acceptance remains limited accordingly.

**Optional suggestion:** delegate search result clicks at the stable result host rather than retain detached-button listeners until the next app render. **Fix with batch** (small locality improvement before evidence).

Fix review: all findings above are resolved in one pre-freeze batch. Breakpoints now match the established header composition, documents distinguish Charge implementation from remaining slices and acceptance, and search uses one delegated listener on its disposable navigation host. Transient origin clearing and common-modal routing are present; no independent-review claim. The final targeted command above passed again (337 cases across the named files); `npm run check` and `git diff --check` passed. `git merge integration/532-encyclopedia` reported already up to date before freeze. No issue closure or parent change is authorized or performed.

Source freeze: the commit carrying this record and the implementation is the frozen source revision. Its exact SHA, final standing suites, browser evidence and acceptance limitations will be appended in an evidence-only commit. Source is now ready for final evidence, not yet accepted.
