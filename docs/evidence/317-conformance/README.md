# Standards conformance sweep — #317

Reviewed 2026-10-12 against `docs/instrument-standards.md`, the catalog
prototype at `eb232c498a54fd7defd23be1a82720c1fb229cf4`, and controls
variant A at `d405ce2b4d65ea411fe16c0665201aba674c5821`. The prototypes'
source was read with `git show`; placeholder content is not normative.
Scope is the retro implementation tickets #310–#314: catalog, PLAN,
goal bars/palette, retired door tiles, and every shared layer switch.
#315/#316's prototype/control implementation is the separate approval
round, used here as the shape reference rather than reopened.

## Provenance and fixtures

Started this checkout with `npm run dev`, serving localhost:5178/?dev.
The browser's `/-/dev/provenance` returned worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-7a5d8e8b`, branch
`t3code/implement-issue-317`, HEAD
`2a6b4ba770ae13050be7ccaabfa1577aad7547f9`, matching this checkout.
Checked provenance before the capture sequence and again afterwards.
Captures show that HEAD plus this ticket's working diff; `desktop-arete-final.png`
was captured after the upgrade-mode native-title corrections. `desktop-arete-flow.png` records the flow gate after the review correction at `b4d9a0b` plus that diff, with provenance rechecked. Earlier images establish
composition; title removal changes no visible layout.

Dev fixtures via `window.__flowsynth`: 20 Arete, catalog entry owned,
25-minute chosen target, two once goals (cyan 15/30 minutes and violet
complete at 20/20 minutes), and the cyan row's palette open. No fixture
or debug behavior was added to production.
The preview measured 1402×877 CSS pixels; its screenshot pipeline emits
1280×800 images. These are desktop evidence only.

## Surface results

| Surface | Amended criteria and result | Evidence |
| --- | --- | --- |
| #310 nous catalog | Poly Expander and module proper names; one concrete effect with hoverable charge/capacity; preview hexes; one price per offer; no capacity-restatement tooltip; open ruled divisions | `desktop-nous.png`; `capacityShopHtml`, `catalogNousFaceHtml` |
| #310 Arete catalog | Expansion Bays, Chord Catalysts, Headroom, Mutator Forge; collapsed product ladders; hoverable terms; each tooltip one hidden-mechanic gloss under 60 characters; Accelerator inert | `desktop-arete.png`, `desktop-arete-final.png`; `catalogAreteFaceHtml`, `CATALOG_TERMS` |
| #311 PLAN and console clock | 25:00 planned reads only in clock; preset/input values are controls, not a second readout; no sheet clock, chime prose, or extra start/end control; flow PLAN removes selection controls | `desktop-plan.png`; `planRowsHtml`, `renderConsoleSession`; app.session/focus suites |
| #312 banner and GOALS | Vertical height fills; completed word/engraved mark; six swatches with inset selected marker; color chosen/re-picked on GOALS, stored on goal, read by both surfaces; no goal-slots tooltip | `desktop-goals.png`; `goalSwatchesHtml`, `goalBarsOf`, `bannerReadsHtml`; focus/goals suites |
| #313 console/phone doors | Habit/goals tiles retired, Notes retained; no duplicated clock/control authority | Desktop live DOM: only `app-tile-notes`; phone source and app.phone suite; phone rendering unavailable |
| #314 board/tray/inventory switches | Mutators precedes Modules; board and tray share the legend; inventory uses same builder; catalog retains resource order ν first | Live board and inventory DOM each returned `[mutators, modules]`; `layerLegendHtml`; mutators suite |

The entry gate's `Unlock Mutator Layer` and acquired `Mutator layer` are
explicitly settled in CONTEXT.md and #310; they are not renamed by this sweep.
Goal re-picking is explicitly allowed by #312; “set once” means one color
authority, not immutable color. No second picker exists in the console.

## Drift disposition

- **Fixed here:** native catalog tooltips repeated visible face names,
  price figures (`Spend …`), affordability, and the Accelerator's visible
  placeholder label. Removed those `title`s and the gate titles that repeated the visible note in `render.ts`; the
  between-session purchase gate remains on its visible modal note. Live final Arete
  catalog had zero native titles, retaining all ten glossary/mechanics
  bodies. Live flow offers stayed disabled with the visible gate note. Prices, effects, disabled state and purchase behavior are intact.
- **Filed:** GOALS' `One more goal slot` is a mechanics name, not a product.
  [#326](https://github.com/wvanderen/flowsynth/issues/326) is a
  `ready-for-agent` brief with intent, priorities, non-goals, one-place
  rules and acceptance criteria. This surface is not claimed fully conformant
  until that brief lands.

## Disclosure and state checks

Live click on Harmonic capacity opened `Whole-chord budget per voice`;
computed border was `0px`, shadow `none`. `desktop-disclosure.png` records
that plain layer. Escape removed every `.inst-show` while focus remained
on Harmonic capacity. Pointer clicks verify the pin path, not physical touch.
Native Tab moved from Harmonic capacity to memorized. Focus-only opening
could not be observed in this preview (no visible body after Tab or direct
focus); recorded unavailable, not a keyboard-disclosure pass. The shared
instrument suite covers focus opening, Escape and tap-away.

State without color was judged structurally against controls variant A:
selected tabs/swatches have an inset underline, acquired rows have words,
completed bars have a mark, unavailable prices are disabled/muted, partial
bars fill by height. No grayscale rendering pass was performed.

## Unavailable checks

- True phone composition: freeform 390×844 and iphone-12-pro resize each
  timed out; status still reported the desktop viewport. No container-only
  substitute is labelled phone evidence. Existing #310–#314 phone captures
  are historical references, not verification of this checkout.
- Physical touch input, native OS title painting, keyboard focus-only
  tooltip rendering and live focus-visible ring inspection.
- Reduced-motion rendering: preview tools provide no reduced-motion
  emulation. Source/global suppression and the instrument suite pass;
  bar transitions under that preference were not visually observed.
- Grayscale rendering pass and exhausted-state browser compositions:
  existing suites cover these branches; not claimed as fresh visual passes.

## Validation

`npm install` before checks. `npm run check` passed. UI regression suite:
24 files, 656 tests passed. Full suite before title corrections: 61 files,
1272 passed, 2 skipped. Final catalog/type/full-suite results are recorded
below after the corrections. No new test seam was agreed; the existing
public rendering/interaction suites validate this small copy removal.

## Release handoff

#281's body now carries the amended criteria as explicit unchecked release
checks, including native titles, one-place rules, evidence availability,
and closure/reverification of #326. This sweep does not certify #281's
save-version or other release-boundary contracts.

Final validation after the review correction: typecheck passed; catalog
suite 41/41 passed; full suite 61 files passed, 1272 tests passed,
2 skipped (72.44s). `git diff --check` clean.

## Original implementation review

Fixed point: task-start HEAD `2a6b4ba770ae13050be7ccaabfa1577aad7547f9`.
Two independent reviewers checked the committed diff and live #281/#326
handoff. Both flagged the same remaining flow-title duplication; removed
it and re-reviewed at `4961ee5` before this results-only amendment.

- **Standards:** 0 remaining findings; no baseline smell findings.
- **Spec (original review):** 0 remaining findings; handoff and explicit unavailable checks
  satisfy the issue's requirements. Goal-slot naming remains filed in #326,
  not misreported as fixed.

## PR #327 disclosure correction

The independent PR review found a missed sweep requirement: Poly Expander,
Expansion Bays and Chord Catalysts are CONTEXT.md terms, but their headings
were plain text. The earlier catalog conformance rows did not account for
this drift. All three headings now use the existing term disclosure layer;
the capped Poly Expander row also discloses its Expansion Bays reference.
The short glosses explain reset persistence, which the visible effect lines
do not show. Prices, purchase gates and product effects are unchanged.

Fresh desktop evidence: `desktop-nous-disclosure-fix.png` and
`desktop-arete-disclosure-fix.png`. Served with `npm run dev` at
localhost:5178/?dev from
`/Users/eggfam/.t3/worktrees/flowsynth/t3code-6017c8b1`, branch
`fix/pr327-disclosure`, HEAD `489a846398d006963976e72fddf33b907b2fdeaf`
plus the correction diff. The browser provenance endpoint matched before
capture. Measured viewport 1402×877; screenshot output 1280×800.
Compared with the pinned prototype's open rows and controls sheet's plain
term layer; no layout, control geometry or animation change was introduced.

Browser clicks opened the three product glosses and Escape dismissed them.
Poly Expander's body had zero border and no shadow. Programmatic focus did
not visibly open its body in the preview, so focus-only browser verification
remains unavailable; catalog interaction tests verify focus opening and
Escape dismissal. Physical touch, grayscale and reduced-motion rendering
remain unavailable. A fresh 390×844 resize timed out, so phone composition
remains unavailable and these images are desktop evidence only.

Validation after correction: `npm run check` passed; catalog suite 41/41
passed; full suite 61 files, 1272 tests passed, 2 skipped (48.78s),
including all UI suites. `git diff --check` clean. The mechanical detector
reported no findings for `src/ui/render.ts`.
