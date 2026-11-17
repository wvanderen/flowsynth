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

Offered source revision: `398a7459` (following original freeze `c6d4b4fe`). The first full run was interrupted by its 200-second command limit; the next completed run exposed a heading-outline defect and a stale phone-selector regression. Freeze lifted, fixes batched and reviewed: Settings uses an h2 section under the existing h1 identity; the identity test scopes its no-duplicate-heading assertion to the modal top; the phone regression uses the visible detail selector. Targeted rerun: 164/164 passing. Original suite results and original provenance are superseded, not carried forward.

At `398a7459`:
- `npm run check`: passed typecheck and recorder static gate.
- `npm test`: 136 files passed; 2,427 tests passed, 9 skipped. Completed in 231.84 seconds. No calendar-adjacent or balance behavior changed; no calendar/balance/playthrough recording owed.
- Capture preflight: accepted exact checkout/commit with clean source; see [provenance.json](provenance.json).
- Live phone DOM checks and mode readings: [browser-checks.json](browser-checks.json). One enlarged face, hidden board-edge legend, 44px CSS selector targets, visible compact map, keyboard cell navigation with Return focus, explicit expanded dialog, Escape and focused-invoker restoration, Settings reference without horizontal overflow. Mode colors: indigo Upgrade, vermillion Flow, amber Paused; readable status retained. Because preview did not advance frames, final flow/paused colors were read after explicitly finishing CSS transitions; this does not verify motion.

### Browser failure and bounded recovery

Phone snapshot at 390×844 failed with: `Preview automation snapshot failed: The browser is not producing screenshot frames. For a desktop tab, show or restore the T3 Code window and try again.` Health check verified server provenance. Status: available, loaded, dialog-free, correct URL, initially not visible. Activated same tab; second snapshot failed identically. Status then reported visible; third snapshot still failed identically. Three-attempt snapshot budget exhausted. No screenshots were produced.

Desktop resize: three requests for 1280×800 returned a requested setting of 1280×800 but an actual viewport of 390×844. Intervening status and live `innerWidth/innerHeight` reads confirmed the mismatch. Resize budget exhausted. No desktop layout check is claimed.

**Unavailable:** desktop/phone screenshots and rendered judgment; desktop viewport composition; physical touch gesture validation; rendered hover appearance; reduced-motion emulation. DOM checks are not visual/touch evidence. Breather color is unchanged source but was not separately exercised in this browser pass.

## Final evidence gate

All automated criteria pass at the offered revision. The source fixes and tests are complete, but final acceptance remains **blocked** by unavailable desktop/phone visual and accessibility evidence. No scope waiver has been requested or assumed. Keep #539 open until a functioning browser can capture and judge these surfaces against the instrument standards. Evidence-only updates do not change the offered source revision.
