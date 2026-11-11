# #535 — Prestige Encyclopedia slice

Parent #532; starting isolated branch `t3/606348e7`, HEAD and local integration tip `f2ce3b92bcfb0e899cf5857a430925369c70756b`. `git merge-base --is-ancestor f2ce3b9 HEAD` passed before edits. Both issues were read through `gh issue view --json title,body,comments`; both comments arrays were empty. Charge context: `docs/evidence/issue-533/README.md`. No subagents, issue edits, progression/economy changes, or chords/capacity implementation.

## Encounter and persistence contract

The shipped ambient Reset era control is visible from the opening board, including when unavailable. Therefore the first application render encounters Prestige, without waiting for eligibility, affordability, purchase or reset. It becomes available/unseen without opening anything. Full reset clears knowledge and the newly visible reset immediately receives its normal introduction again.

Legacy relevance requires positive era-earned nous, a prior prestige (including zero yield), or retained Arete. An untouched opening state is not historical evidence. The additive save-envelope `encyclopediaVersion: 1` marker uses the existing normalization boundary: older relevant saves without the marker, including Charge-era saves with an existing knowledge map, receive missing Prestige as seen. The frozen economy's global v13 and historical translation rules are unchanged. Current explicit marks, including an engine-only empty map, round trip unchanged. Repeat loads and copy changes never rebadge stable `prestige` identity. No separate store or historical monetary conversion was added.

## Criterion mapping (issue order)

UI cases are in `src/ui/app.encyclopedia.test.ts`; lifecycle cases in `src/engine/encyclopedia.test.ts` unless specified.

| # | Criterion | Named verification / class |
|---|---|---|
| 1 | First visible encounter before eligibility; legacy evidence; retention | **Automated:** “offers Prestige at the visible but ineligible reset, reads voluntarily, and returns to the ledger without resetting”; “backfills Prestige from earned-era or prior-reset evidence, including Charge-era saves, and never rebadges on reload”. |
| 2 | Example-led enduring progression, illustrative figures, no World spoilers | **Automated:** offers-Prestige case checks illustrative label and absence of World/map/combat/kit names. **Source review:** authored 3.4 → 3 example agrees with claim flooring and retained fraction; no dedicated World entry. **Unavailable:** human comprehension and perceptual readability, not inferred from tests. |
| 3 | Stable group, aliases, available related links and deliberate context route | **Automated:** “filters browse search related and contextual routes, and returns through related reading during live flow” searches Prestige/start over/reset/Arete, omits unavailable Charge relation, follows available Charge ↔ Prestige. **Source review:** Progression grouping, existing central catalog/filter and reader reused. |
| 4 | Quiet unseen, immediate seen, legacy seen without repeat backlog | **Automated:** offers-Prestige case; “starts with visible Prestige, encounters the unaffordable visible shelf without opening, and clears the quiet mark only on reading”; legacy case above. **Source review:** existing static aggregate dot, stable id not a content version. |
| 5 | Task/focus through Topics/related/Close/Escape, no accidental reset or interrupted flow | **Automated:** offers-Prestige Escape round trip; filters-browse related/Close round trip with 10 seconds of continuing flow and reset still disabled; “reads from confirmation without choosing, retains seen knowledge through zero and positive claims, export/import and full reset”. **Unavailable:** human/physical keyboard and touch judgment. |
| 6 | Keep actual reset facts and behavior; replacement before removal; inventory | **Source review:** inventory below; no reset handler/economy changed. **Automated:** reads-from-confirmation case retains purchased-capacity warning and requires explicit confirmation after reading. Existing prestige and World progression tests remain. |
| 7 | Knowledge survives real zero/positive prestige, reload/export/import/full reset | **Automated:** reads-from-confirmation case performs both reset types and checks World false/true respectively, preserves seen through import, full reset restores normal unseen; “round trips available and seen identity through reload and prestige, without copy-based rebadging” covers both identities and marks; backfill/reload case above. |
| 8 | App-fixture and focused lifecycle seam; spoiler routes | **Automated:** named cases above use existing fixture, modal controls, real game actions and serialize/deserialize. Search rejects World/combat/Column/Blade; related excludes hidden Charge, contextual entry body excludes World spoilers. **Source review:** no World catalog entry or links exist. |
| 9 | Checks, preliminary gate, freeze, desktop/phone keyboard/touch/static evidence | Targeted/source gate below. Final suites and browser evidence **owed at freeze**; missing human/perceptual judgment remains unavailable, never passed. |

## Disclosure inventory and mistaken-choice test

| Before | After | Local facts / decision-critical test |
|---|---|---|
| Generic Prestige gloss on developer chart legend/count (“Ends the era and banks its pending Arete claim”) | Plain labeled prestige; explanation available globally and via ledger/confirmation | Actual plotted events, count and balances unchanged. Generic definition contains no live consequence or current number; no materially different choice is hidden by its removal. |
| Ledger Arete section: banked balance, current pending claim/action, eligibility reason | Same facts plus one About prestige section route | Exact yield, upgrade-mode restriction and horizon requirement remain local. No teaching replaces action facts. |
| Reset confirmation: zero/positive yield, module-level/capacity/nous/charge losses; board/tray/rolls/progress/feats/life/Arete/scrap/lifetime-nous/World retention; Not yet and confirm | All original copy/actions retained, plus one About prestige route | All these facts can change the reset choice and must remain local. No conceptual paragraph is deleted merely to reduce copy. Reading does not choose either action. Existing unfamiliar-action labels, Hone glossary and accessible names remain. |
| Unrelated glosses and chords/capacity surfaces | Unchanged | No blanket purge, Details or rate-roster expansion. |

## TDD / targeted checks

Confirmed seams are already specified by #532: existing running application fixture and save serialization/deserialization plus real actions. Red → green recorded during implementation: missing Prestige availability; missing legacy seen backfill; missing confirmation route; missing Charge → Prestige related navigation. The first three app/lifecycle cases then passed independently. The additive envelope marker distinguishes a missing pre-feature entry from an explicit current engine state, preserving byte-for-byte save round trips.

Initial direct preflight rejected Node26.13.0. `mise exec node@22.23.4 -- npm run preflight` accepted the pinned runtime, America/Chicago and UI storage. npm scripts select the supported runtime for checks. No calendar/balance/recorder behavior changed; no calibration recording or calendar rerun owed.

Targeted run of Encyclopedia, scenarios, modal-focus, World-progression and prestige files: scenarios and UI passed; one engine serialization regression exposed unversioned backfill. Fixed at v14 boundary. Save-focused rerun then exposed two literal version expectations; updated to current14/future15. Earlier scenarios command timed out at200s without a result; a completed retry and subsequent six-file run used a longer timeout. No timeout is counted as passing.

## Preliminary source/spec review — before freeze

Sequential self-review with shared implementation context; no independence claim. Standards pass examined instrument standards and pinned prototype/controls language, checks/review/verification/evidence rules and shared module seams. Spec pass compared the complete diff against #535/#532 and Charge context.

**Standards findings:** stale instrument migration status needed reconciliation; fixed. Browser/perceptual judgments cannot be inferred from DOM assertions; final evidence remains owed and human judgments unavailable. No new visual geometry is invented: existing square contextual controls and shared reader are reused. Final comparison against the pinned appearance remains an evidence-gate task, not a source-review pass claim.

**Spec findings, fixed together before freeze:** unversioned missing-entry backfill modified current engine save round trips; fixed by the reference marker's older-save-only boundary and regression checks. Application scenario equality expectations omitted the newly visible reset encounter; updated without changing the recipe, seeded progress or scenario isolation assertions. Capacity and reset warnings remain untouched. Stable identity preserves copy-edit behavior without introducing a content hash. Existing reader Topics navigation and available related links retain the originating task.

**Optional:** a generic per-entry introduction-version abstraction is declined; only this migration requires the existing version boundary, and speculative catalog machinery would complicate the independent slice.

Fix review: all source findings above resolved as one pre-freeze revision. Final suite/capture rows are still owed, not acceptance. No unavailable criterion has been waived.

## Post-freeze recovery and second source gate

Initial freeze `cd431db` used a global v14 bump. Its completed full run failed14 cases across5 files (`superseded-cd431db-full-test.log`); it is not a passing run. Most failures were literal global-version expectations, including the frozen century baseline. That baseline must not change for a reference feature. One recovery case also assumed no retained opening snapshot despite visible discovery now legitimately persisting it.

Freeze lifted. One revision replaces the global bump with an additive reference-envelope marker, leaving `SAVE_VERSION=13`, every frozen economy figure and all historical translation arithmetic untouched. The recovery test now proves both primary and retained-original slots remain byte-for-byte unchanged through offer/decline, rather than incorrectly requiring an absent backup. Both changes were source/spec reviewed together with shared context: marker absence identifies older exports, explicit marks still win, fresh-default legacy evidence is not guessed, and no recovery behavior was changed. Targeted10-file run passed228 cases (`revision-targeted.log`); `npm run check` passed. Source gate resolved; no independent-review claim.

Earlier suite/typecheck evidence at cd431db is explicitly superseded, not relabeled as current. No captures existed there. New full checks and captures are owed at the re-frozen revision. Final acceptance is not claimed by this preliminary record.
