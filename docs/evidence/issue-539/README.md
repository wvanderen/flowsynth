# Issue #539 — Hex navigation and shortcut discovery

Spec: https://github.com/wvanderen/flowsynth/issues/539

## Preliminary source/spec gate

In-thread source review against the confirmed issue and instrument standards completed before freeze. Findings resolved together:
- Specification blocker: duplicate board-edge and detail selectors. Detail now uses the shared legend builder and hides the board-edge selector.
- Correctness blocker: the old `.ctx-navigation` desktop hiding rule suppressed the new compact map. Replaced with an always-visible compact navigation layout.
- Layout/accessibility blocker: reserve a separate column for the layer selector instead of shrinking the enlarged face; use 44px selector targets.
- Standard violation: Settings reference heading/default definition-list margins. Scoped to the existing condensed 13px ramp and aligned open rows.
- Focus continuity: preserve layer-selector focus across rebuilds and send cell-navigation focus to Return.
- Optional broad cleanup of historical two-face CSS/comments: declined outside the changed composition; no functional requirement depends on removing unused selectors.

Second source pass: shared builder, mode lamp, shortcut handler/reference, discovery gate, input/modifier/modal guards, expanded navigator lifecycle, and inventory/action wiring checked. No remaining source blockers identified. No independent reviewer used. Final visual evidence was owed at freeze, not claimed by this gate.

## Acceptance mapping

| Criterion | Named verification | Class |
| --- | --- | --- |
| Upgrade indigo lamp, other modes unchanged, readable status | Frozen browser mode-state inspection and desktop/phone captures (owed at freeze) | Manual evidence owed |
| L cycles available layers in board/detail; ignores typing/modifiers | `layer-navigation.test.ts`: “gates the shortcut before World discovery and cycles board and detail after discovery”; `shortcuts.test.ts`: both matcher cases | Automated |
| Settings reference shares handler definitions | `layer-navigation.test.ts`: “does not change layers under Settings and renders every shared binding there”; handlers import `SHORTCUTS`, including Space pan | Automated |
| One enlarged selected face and vertical selector; actions/inventory retained | `hexdetail.test.ts`: “shows only the selected enlarged face beside the shared vertical selector”, “the selected face and layer selector carry non-color state markers”, existing World, upgrade, and inventory cases; captures owed | Automated + manual owed |
| Desktop compact map directly navigates owned cells with local hover/focus, no default zoom/list | `layer-navigation.test.ts`: “navigates directly from miniature cells with click and keyboard without opening a dialog”; frozen browser hover/focus inspection owed | Automated + manual owed |
| Explicit expanded navigator remains accessible/dismissible | Existing `hexdetail.test.ts` context-map dialog navigation, Escape/focus restoration, and modal exclusion cases; browser keyboard/touch pass owed | Automated + manual owed |
| Checks, review, desktop/phone evidence | Source gate above; final check/full suite and provenance/captures owed at freeze | Automated/manual owed |

## Final evidence

Pending source freeze. No balance or calendar behavior changed; no balance/playthrough or calendar recording required by this issue.
