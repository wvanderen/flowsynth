# Frozen-source integrated browser evidence

Source **3027445959f905703ea4be2b8f8c3de7fb631f64**, exact isolated worktree and clean source verified by `provenance.json` / `capture-preflight.log`. Started this checkout using `npm run dev`, URL `http://localhost:5173/`; log `.dev/server.log`. Evidence-only scripts/records do not dirty served source under the standing provenance rule.

## Browser and setup

Used the local Chromium CDP technique established by #535, directly rather than depending on the previously exhausted preview screenshot service. No new preview-service failure is claimed in this turn. `capture.mjs` is reproducible: dedicated headless Chromium155 profile `/tmp/flowsynth-536-chromium`, debug port9336, no shared preview tab or human save. `?dev=1`, `devLaunchScenario('fresh-start')` and `devScenarioAssert()` establish isolated app state. Catalog opens and closes normally to encounter all entries at zero purchases; then ordinary reader controls run.

Only **development instrumentation** is hidden by evidence-page CSS `#dev-panel { display: none !important; }`, after scenario assertion. This does not remove a shipped control, change reference content, alter gameplay state or replace the application stylesheet. Without this correction the dev panel overlays the phone inspection and intercepts touch. Early failures are retained, not transformed into successes:

1. `capture-first-attempt.log`: desktop completed; phone inspection failed with `Error: Missing [data-entry="charge"]` after touch did not open the entry.
2. `capture-second-attempt.log`: settled scroll/focus and separated touch actions to avoid gesture ambiguity; same failed phone inspection.
3. `capture-third-attempt.log`: explicitly reasserted viewport after flow setup; same failed phone inspection. Early diagnostic observed780×437 after the failed attempt, so that diagnostic image is not accepted as a390px phone pass.
4. `capture-instrumentation-obstruction.log` and `browser-observations-obstructed.json`: continued after recording phone inspection unavailable, preserving other viewport checks. `phone-inspection-unavailable.png` / `phone-inspection-attempt.png` are **failure diagnostics only**, not accepted phone return evidence. The first of those reveals the dev panel sitting over About chords. This is an evidence setup obstruction, not a demonstrated application regression.
5. Hid only that instrumentation, reran the same inspected transition on verified source: desktop and phone completed with no unavailable inspection branch. `capture.log` and final `browser-observations.json` contain the accepted run. Added an explicit before/after Catalog scroll equality assertion and reran the capture script; source unchanged. That final run is the one retained under the ordinary capture names.

No production source change occurred during this recovery, so the freeze and suite obligation did not change. This is bounded diagnostic recovery with a concrete corrected setup, not endless retries of an unexplained service operation.

## Accepted observable checks

Both actual layouts are read in page, not inferred from metric requests: **1280×900 desktop**, **390×844 phone**. Initial document and entry horizontal-overflow checks are false. Global book measures44×44 in both; separate Settings remains beside it and the primary vermillion flow action remains separate.

- Global book opens through **CDP Enter** after focus on desktop and **CDP emulated touch** on phone. Desktop Escape / phone visible Close dismiss. Global focus returns to `console-encyclopedia`.
- Grouped Topics shows Board mechanics (Charge / Chords and harmonic capacity) then Progression (Prestige). All three initial rows include the literal **Unseen**; no hidden entry, future-topic teaser or completion denominator appears.
- Each entry opens through the same input mode, becomes seen immediately before scrolling, and retains the global dot until Prestige, the final unseen entry, is opened. This is save-owned attention state, never a comprehension claim.
- All three pages contain labeled illustrative examples, zero running article animations under emulated `prefers-reduced-motion: reduce`, no exercise input/canvas/animate element and no horizontal overflow. Static arrows/full-strength labels in Charge communicate without animation or a color key. Chord capacity example and diagnostic route remain ordinary prose.
- Catalog About chords → related Charge → Back returns to Chords; dismissal returns to Catalog, focus `about-chords`, zero capacity purchases and **the exact scroll position measured immediately before opening**. The initial requested80 is clamped/adjusted by normal focus/scroll behavior, so the record compares the real before value rather than claiming80. Final JSON records desktop77→77, phone102→102.
- Actual Sine inspection opens during flow with zoom2 and pan(10,-20), then related Chords → Charge → Prestige. Advance10 seconds while reading, then dismiss. Same session object, same selected detail, Modules layer, zoom2 and pan(10,-20) remain; elapsed advances rather than pauses. Desktop/phone focus returns to `detail-about-chords`. The cell-opening setup uses the existing app/DOM seam; phone help/navigation/dismissal themselves use emulated touch. This is not a claim that every board gesture was physically exercised.
- Ledger About prestige returns to Ledger and focus `about-prestige`, no prestige executed.
- Confirmation About prestige returns to the same confirmation and focus `confirm-about-prestige`, still zero prestiges and explicit0-Arete warning. Reading did not choose Not yet or Prestige anyway.

Save migration/export/import/actual prestige and hard reset are covered by the named app/save automated cases in README, not falsely claimed as browser gestures here.

## Capture inventory / agent image inspection

All ordinary PNG names below were regenerated by the final script on the frozen source; failure-named images are excluded from acceptance evidence.

| Surface | Desktop | Phone |
|---|---|---|
| Global door and static dot, primary action separate | `desktop-global.png` | `phone-global.png` |
| Stable groups and non-color unseen text | `desktop-topics.png` | `phone-topics.png` |
| Charge spatial example and decision prose | `desktop-charge.png` | `phone-charge.png`, `phone-charge-lower.png` |
| Recognition/activation/capacity example and diagnosis | `desktop-chords.png` | `phone-chords.png`, `phone-chords-lower.png` |
| Prestige purpose, illustrative claim, decision | `desktop-prestige.png` | `phone-prestige.png`, `phone-prestige-lower.png` |
| Flow inspection return / focus | `desktop-inspection-return.png` | `phone-inspection-return.png` |
| Actual reset warning/preservation and explicit actions | `desktop-confirmation.png` | `phone-confirmation.png` |

Agent inspected these compositions against instrument standards and the pinned prototype/controls language: clipped outer panel, square44px controls, open divisions, no nested cards or expandable Details, visible close/focus ring, legible example labels and text, not relying on color to identify Unseen. Phone reader intentionally scrolls; its Close is at the top rather than sticky and remains reachable by scrolling. Lower captures demonstrate otherwise offscreen teaching and related destinations; no essential lesson action is hidden behind an illustration gesture.

**Visual concern, not approved:** the phone inspection-return composition is scrolled to the help/profile area and its upper Return/status area visually overlaps the standing ledger region. Reader focus/task continuity succeeds, but this record does not approve that overall existing inspection composition or infer its usability from state equality. No evidence establishes it as an Encyclopedia-specific regression. Independent layout/accessibility judgment remains outstanding. Likewise this agent's image inspection is not an independent perceptual approval or a human readability test.

The confirmation retains its existing World-preservation/Hone names before discovery; #532 expressly requires retaining actual local reset consequences. The **Prestige teaching entry** itself has no World/map/combat/kit terms; do not confuse preserved consequential warning copy with a new spoiler teaching page.

## Unavailable judgments / final evidence disposition

**Verified:** scripted desktop keyboard and phone emulated-touch access/navigation/dismissal/focus, all-three-topic non-color marks, static/reduced-motion article content, viewport captures, same-session continuation and recorded task state/scroll return on this source.

**Unavailable:** representative human comprehension for all three tasks; physical phone/keyboard/touch behavior; screen-reader delivery; independent perceptual/accessibility/layout approval (including the phone inspection concern). Programmatic focus before Enter does not claim an exhaustive natural Tab-order or assistive-technology audit. Emulated touch is not real hardware. No perception or understanding is inferred from assertions, screenshots or page views.

These remain outstanding final acceptance judgments. No scope waiver is recorded and this evidence does not authorize closing #532/#536.
