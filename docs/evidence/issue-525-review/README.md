# #525 independent final review and disclosure revision

Reviewed baseline `a91128a08e8066161b1682bbc0cb45f845db47f3...81b974c` with independent Standards and Spec reviewers. This record supplements the parent mapping in `../issue-530/README.md`; it does not waive its acceptance blockers.

## Findings and disposition

- Standards: one required finding — Blade ordinary-draft effect omitted the Charge glossary disclosure. Resolved by routing World effect copy through the existing `forgeEffectHtml` helper and existing Forge tooltip wiring.
- Standards: optional possible repeated naming dispatch smell. Deferred; no additional abstraction introduced for this one-line correction.
- Spec: no additional actionable source-level defects or scope creep identified. Missing final desktop/phone visual/accessibility evidence remains a blocker.

The coordinator fixed the small finding directly. Preliminary revision review confirmed existing helper/wiring reuse and a candidate-specific interaction assertion before the final checks/source freeze. The regression initially matched a module's existing Charge disclosure; it was narrowed to the actual Blade candidate before recording the failing test.

## Named verification

`src/ui/app.mixed-draft.test.ts`: **Blade draft charge disclosure opens by focus and touch and dismisses without consuming the offer**. Fails on the old Blade effect (missing disclosure), passes after correction. Exercises focus, Escape, click/touch-equivalent activation, dismissal, and retained offer/no weapon grant. This is a simulated workflow, not physical touch or visual approval.

- Supported Node 22.23.4 preflight passed (host Node 26 was first rejected; selected the declared runtime with mise).
- `525-disclosure-red.log`: candidate-specific regression failed before correction.
- `525-disclosure-green.log`, `targeted-final.log`: mixed-draft workflows passed, 4 tests.
- Final `npm run check`: passed (`525-review-check.log`).
- Final `npm test`: 132 files passed, 2382 tests passed, 9 skipped (`525-review-test.log`). The log retains subprocess git-discovery diagnostics; the suite completed successfully.

## Evidence validity and acceptance

This source revision changes the Blade draft effect/disclosure. Earlier draft captures/workflows cannot establish this revision's final visual acceptance; affected evidence needs regeneration. Other historical records retain their recorded revisions and limitations, not a current-evidence relabel.

No new browser capture or prototype visual comparison was performed in this correction. Prior capture failures remain recorded in the slice records. Final desktop/phone composition, actual keyboard/touch/focus, non-color and reduced-motion judgment remain **unavailable and blocking**. Independent source review and simulated interaction tests do not replace those gates. PR #531 must remain draft and #525–530 must not be closed as accepted on this evidence. Historical calibration does not validate this acquisition economy.
