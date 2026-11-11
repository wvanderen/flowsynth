# #528 completion record — mixed ordinary drafts

## Scope and baseline

Issue #528, parent #525, ADR-0087. Both issues and their empty comment lists were read via `gh`. Before editing, clean branch `t3/980acac7` was at `f8978eea6ba49064ebb19deec6b9723a8db80c6c`, also the current local `integration/525-world-progression` tip. This includes #526 implementation and the #527/#529 slices. #526's open visual-acceptance gate is not treated as missing implementation. No subagents, issue closure, or PR changes.

Only #528 is implemented here. No dedicated weapon pool, new currency, Blacksmith, additional weapon types, claim tuning, or #530 Mutator retirement. Shared Blade drafting is explicitly temporary. Historical calibration artifacts remain unchanged and do not validate this changed acquisition economy.

## Implementation and TDD

Owner-confirmed seams in #525: application workflows, engine actions and save round-trips, deterministic random input. Read the TDD skill and its tests/mocking references. Observed red → green cycles:

1. `ordinary World replacement uses the exact quarter boundary and equal type split only after discovery`: failed because unlocked offers remained module-only; passed after generation policy. The initial worked-example module literals were corrected from observed existing weighting before implementation.
2. `World selection grants repeated unplaced copies once and preserves pending offers on reload`: failed because World rewards were minted into modules; passed after dispatch to existing World constructors.
3. Application `mixed drafts route repeated World choices through inventory inspection and placement at %ipx`: after correcting fixture setup, failed in actual Forge rendering on missing module metadata; passed after heterogeneous rendering and selection announcements. Fixture placement was corrected to use an open cell and retrieve between copies, preserving normal World occupancy rules.
4. `mixed replacement preserves the opening roll's oscillator guarantee`: failed when replacement erased the rig; passed after protecting the sole oscillator.

The World candidate is a separate union member with no module tier/rarity/level. Module draws retain the existing rarity/category/type and tier policy. A final independent quarter-chance draw applies only to fresh ordinary offers after discovery; its type draw splits at one half. Normally the third slot is replaced; the opening rig's sole oscillator is protected by replacing the first slot instead. Existing offers are never regenerated. Special generation remains module-only. Skip values only module candidates; World copies introduce no scrap/refund schedule. Existing simulation consumers narrow module predicates before reading module metadata; no policy recalibration or historical recording is claimed.

## Preliminary source/spec self-review (before freeze)

Read the complete diff against #528 and scoped #525 requirements, relevant domain/ADR descriptions, instrument standards and pinned `eb232c4` synthesis, and the criterion mapping below. Source gate completed before final evidence.

Findings/dispositions, resolved together before freeze:
- **Correctness:** all module-only consumers must narrow the heterogeneous union, including skip valuation and simulation selection. Resolved in the implementation; strict typecheck passes.
- **Contract preservation:** the opening rig cannot lose its only oscillator. Resolved and demonstrated by its observed red/green case.
- **Domain accuracy:** old text called all candidates modules and still described mixed acquisition as pending. Updated draft/roll, Column and Blade descriptions; #530 stays pending.
- **Optional cleanup declined:** do not remove legacy Mutator paths or redesign Forge branch navigation in this slice. Existing fixture-only module tests use a checked module-offer wrapper around the actual generator, not a cast or alternate generation path.

Second read of the resolutions found no additional source/spec blocker. Source freeze and final evidence results are recorded below when available. At the source gate, final suites and desktop/phone captures were **owed at freeze**, not claimed complete.

## Criterion-to-named-verification mapping

| #528 criterion | Named verification | Class / status |
| --- | --- | --- |
| Before discovery modules only; after discovery a fresh ordinary three-choice offer has 25% replacement chance | `src/engine/mixed-draft.test.ts`: **ordinary World replacement uses the exact quarter boundary and equal type split only after discovery**; **ordinary offers retain at least two weighted module candidates at chance %f** (0, just below, exactly at, just above 0.25, and near 1) | Automated |
| Equal Column/Blade split; at most one World, at least two modules; existing module weighting | Same boundary case checks below/exact half; weighted-module cases compare retained type/tier outcomes against the existing module policy. Existing `draft.test.ts` category boundary cases and `rolls.test.ts` band/type cases retained. **mixed replacement preserves the opening roll's oscillator guarantee** | Automated |
| Real candidate identity/selection consumes once; one unplaced World copy, never a module/tier | **World selection grants repeated unplaced copies once and preserves pending offers on reload**; **mixed offers retain the module skip payout and refuse invalid or locked selection without grants**; `src/ui/app.mixed-draft.test.ts`: **mixed drafts route repeated World choices through inventory inspection and placement at %ipx** (1280 and 390) | Automated |
| Repeated Column/Blade acquisition, collection browsing, inspection and normal placement | Same engine case chooses two of each with unique ids and no module grants; same application workflows click each actual inventory row and Place, use normal placement and retrieval, then boot the serialized collection | Automated |
| Special module guarantees; generated offers preserved through unlock/translation/reload | **unlock and old-save translation preserve existing offers while fresh special drafts retain every guarantee**; application **reload preserves a pending mixed choice and the unlocked Catalog's special draft remains guaranteed**; existing special-draft actions/UI regression files | Automated |
| Deterministic boundaries plus action/save/application coverage of routing, repeated ownership, pending preservation and specials | All named cases above; no statistical-only assertions, private-helper tests, RNG call-count assertions or test-only application API | Automated |
| Desktop/phone affected draft and inventory evidence; no extra systems, temporary shared Blade drafting | Captures and browser checks **owed at freeze**. Source audit: only existing Forge and World collection paths extended; `CONTEXT.md` explicitly records temporary Blade drafting and pending #530 | Manual evidence owed; source review completed |

## Checks and final evidence

- `npm install` completed; dependencies unchanged. Supported Node 22.23.4 preflight accepted (America/Chicago, happy-dom storage round-trip OK).
- Pre-freeze targeted run: 11 files, 217 cases passed (`targeted.log`); iteration typecheck and recorder static gate passed. These are iteration results, not final suite evidence.
- No calendar arithmetic touched; dual-zone calendar pass not owed.
- No new balance recording acceptance requested in #528; no existing recording is relabeled as mixed-economy validation.
- Final source commit, integration merge check, required check/test run and browser evidence: pending at the source gate.

## Acceptance limitations

Required visual acceptance is not waived by automated checks. Desktop/phone captures, keyboard/touch and non-color/reduced-motion visual judgment must be recorded at the frozen source or explicitly marked unavailable after bounded recovery. This record does not close #528, #525, #526, or #530.
