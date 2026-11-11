# #534 — Chords and harmonic capacity completion record

Parent #532; isolated branch based exactly on local integration tip `f2ce3b92bcfb0e899cf5857a430925369c70756b`. Before edits, HEAD equaled that tip and `git merge-base --is-ancestor f2ce3b9 HEAD` returned 0. Both issues were read through `gh issue view --json title,body,comments`; comments were empty. Charge handoff: `../issue-533/README.md`. No subagents or issue writes.

## Scope and encounters

One stable `chords` entry teaches the coupled recognition/activation/capacity mental model; splitting these would fragment the diagnosis. Shared catalog, available-only filtering, reader, save normalization, quiet marks and original-task navigation are reused. No allocator, rates, balance, transient chord readout or unrelated teaching is changed.

Fresh encounters: visible Catalog capacity offerings (regardless of funds or purchase), Ledger capacity inspection, chord Collection, a voice inspection, relevant owned nonstarter voices (including silent voices and tray copies), multiple voices, historical formed chord evidence, or purchased capacity progression. The opening Sine alone is not historical evidence. Inspecting it is an encounter. Retained availability never relocks.

Charge-era saves need a one-time new-entry migration even though they already contain an Encyclopedia map. A persisted catalog revision distinguishes those saves from saves already evaluated for this introduction. Relevant ownership, formed-chord history or purchased ladder receipts backfill as seen; absent evidence remains absent, and subsequent encounters are unseen. Existing valid marks win. Identity is independent of copy/title/balance, not a content hash.

## Criterion mapping (issue order)

UI tests: `src/ui/app.encyclopedia.test.ts`; lifecycle: `src/engine/encyclopedia.test.ts`.

| # | Criterion | Named verification / class |
|---|---|---|
| 1 | Encounter predicates, legacy evidence, unaffordable constraint, retention | **Automated:** “encounters visible unaffordable capacity, searches idle chords, and returns through related entries to the same Catalog”; “keeps hidden chord routes closed, then encounters an owned voice without opening and never relocks it”; “backfills the newly introduced chord lesson on Charge-era saves once, preserving later unseen encounters”; “backfills durable chord discovery evidence after the relevant formation is gone”. |
| 2 | Recognition/activation, whole chords, idle examples, actual constraint | **Automated:** “reads chords from voice inspection during flow and restores the selected layer and board view” checks static illustrative teaching. **Source verification:** authored two-chord/shared-capacity-1 versus capacity-2 example; all members spend one; fitting does not guarantee activation; actual Chord facts and Catalog remain authoritative. Compared with CONTEXT Allocation/Idle/Harmonic capacity and ADR-0052/0062. **Unavailable:** human comprehension; no participant. UI success does not prove understanding. |
| 3 | Retrieval, stable groups/aliases, available-only related/context | **Automated:** unaffordable/search journey; hidden-route/owned-voice case; existing flow Charge case now rejects hidden related chords and World/Prestige copy. Catalog and reader use the same availableEntries boundary. |
| 4 | Quiet marks, voluntary open, no rebadge | **Automated:** “starts empty, encounters the unaffordable visible shelf without opening, and clears the quiet mark only on reading” now checks aggregate mark remains until both entries are seen; owned-voice and flow cases check no auto-open; lifecycle “round trips available and seen identity through reload and prestige, without copy-based rebadging” covers both identities. **Source:** unchanged static dot, no content-version seen reset. |
| 5 | Original task, related Back/Close/Escape, flow continuity | **Automated:** Catalog journey traverses related entries and Back, restores contextual focus and funds; voice-inspection case advances the identical session and restores detail/layer/zoom/focus; parametrized “returns from the %s section door with its scroll and selection intact” covers Ledger and chord Collection. **Final desktop/phone keyboard/touch evidence owed at freeze.** |
| 6 | Replacement before removal, inventory, preserve decisions | **Source/manual inventory:** below. **Automated:** Catalog journey rejects redundant generic capacity disclosure while retaining the concrete +1 effect and purchase; standing catalog/Hex detail regressions exercise costs, capacity, factors and idle disclosures. Plain transient readout and allocator unchanged. |
| 7 | Parent persistence, spoiler, accessibility/presentation, narrow scope | **Automated:** both-entry prestige/reload case; import/export/full-reset/legacy-later-encounter journey; hidden-route and Charge related-filter cases. **Source:** no World/Prestige page, no new motion/exercise; shared reader and existing controls. **Final perceptual/accessibility judgments owed at freeze.** |
| 8 | Application fixture, save lifecycle, cross-entry, legacy/new entry | **Automated:** named cases above exercise agreed parent seams, including Charge-era versus new-revision migration and cross-entry navigation. No isolated catalog helper assertions or new test-only API. |
| 9 | Checks, preliminary review, freeze then evidence, honest limitations | Targeted/TDD and preliminary gate below. **Final standing checks and browser captures owed at freeze. Human comprehension unavailable:** tasks would be explain why a recognized chord can be idle, then locate each member’s actual capacity and the selected allocation facts. No understanding claim is made. |

## Selective-disclosure inventory / mistaken-choice test

| Affected surface before | After | Preserved live facts and removal-test judgment |
|---|---|---|
| Nous Catalog capacity header and repeated effect term both carry “Whole-chord budget per voice” | Plain header/term; one About chords door for the section | +1 for every voice, current/next allowance and ceiling, price, affordability/countdown, capped/complete and next-bay requirement, Poly Expander reset gloss all retained. A knowledgeable player loses no decision fact. |
| Ledger capacity row repeats a general budget definition | “Allowance / ceiling”, actual numeric read, one About chords door | Current allowance and ceiling remain; more accurate units identify the two figures. No cost/requirement removed. |
| Hex detail Chord facts | Adds one About chords route; no actual fact removed | Voice-specific used/available, certified/uncertified state, total factor, applied/measured Formation and scale, active names/factors and idle names/factors stay local. These are decision-critical, not redundant teaching. |
| Chord Collection | Adds one About chords section route | Stage selection, class discoveries, roots, current instances and discovery bonus remain intact. No silhouettes or discovery system altered. |
| Transient readout, rate roster, inventory, other concepts | Unchanged | No disclosures added to the plain transient readout; no inline calculations, Details controls, general catalog or allocator changes. Existing concrete product/reset/profile disclosures retained. |

## TDD / targeted iteration

Parent explicitly confirms app-fixture and save/action seams. New failing tests were run before each production slice: missing chords encounter, missing Charge-era migration, missing Hex detail door, missing related Back, missing discovery-history migration, missing Ledger/Collection doors, redundant capacity gloss, and solitary nonstarter ownership. Each red exposed the intended absent behavior rather than a private helper. Preflight accepted Node22.23.4, America/Chicago and UI storage after `npm install`.

Initial targeted run: 230 passed; one obsolete Catalog assertion still expected the two generic capacity glosses being deliberately migrated. Resolve in the review batch, retaining the product reset gloss and adding replacement-route verification. No calendar, balance or recorder changes; calendar/calibration recordings not owed.

## Preliminary source/spec gate — before freeze

Sequential self-review, shared implementation context, not independent review. Diff against `f2ce3b9`; source/spec gate only, no final evidence claimed. References: parent/child issues, confirmed brief, CONTEXT, instrument standards and pinned prototype (`eb232c4`) / controls (`d405ce2`), standing checks/review/verification/visual evidence guides.

### Standards

1. **Documented-standard accuracy:** confirmed docs still say chords/capacity remain planned. Reconcile status, without claiming visual/human acceptance.
2. **Optional duplication/generalization:** hardcoded `chords` migration exception and duplicated revision literal will burden the next slice. **Fix with batch:** catalog owns introduction revision and current revision; normalize by that metadata rather than identity.
3. Catalog regression still requires removed generic teaching. **Fix with batch:** assert retained reset gloss plus replacement section route. Actual decision assertions remain.

### Spec

1. **Correctness:** cross-entry history must clear with transient UI, like the existing reader origin. Fix with batch.
2. Final browser/human/perceptual evidence is not present. **Owed after freeze / human comprehension unavailable**, not a source-gate acceptance claim or waiver.

### Batch resolution / source freeze

All findings resolved before freeze: introduction revision is catalog metadata with one exported current revision; transient UI reset clears history; confirmed docs distinguish implemented slices from pending acceptance; the Catalog test now verifies the retained reset condition plus replacement door. The existing progression-scenario equality also required its explicit expected app encounter map to include chords for multi-voice presets: the targeted scenario run exposed that stale expectation, and the named “repeating a progression launch rebuilds the walked setup without accumulating” rerun passed after correction. No scenario recipe or runtime behavior was changed to satisfy the test.

Fix review (same-context, sequential): source matches the entry identity/availability/seen contract, preserves every decision fact listed above, and changes no engine allocation or plain transient-readout code. Predicate/migration evidence covers the nonstarter lone voice as well as multiple voices, historical discoveries and receipts. Shared reader navigation keeps its original origin across related Back and Topics. No further source finding remains. `git diff --check` passed. Eight-file affected-area rerun passed (254 cases); scenario rerun passed separately. The local integration merge reported Already up to date and its tip is an ancestor. Source freezes in the implementation commit containing this record; final standing checks and browser evidence follow, not precede, that commit.

Final acceptance remains blocked wherever required evidence is unavailable.
