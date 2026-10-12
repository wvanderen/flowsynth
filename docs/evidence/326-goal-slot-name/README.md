# The goal-slot purchase named — review evidence

Source: issue #326, working tree on `t3code/implement-issue-326` (diff
against `839fd36`). Launched this checkout with `npm run dev`; the
provenance endpoint (`/-/dev/provenance`) returned this worktree and
commit `839fd36` before every capture. Desktop 1280×800 captures came
from the T3 preview panel against the verified URL. The panel's viewport
resize could not run this pass — recorded unavailable — so the phone
390×844 composition, the reduced-motion pass, and the grayscale pass came
from the repo-cached Playwright Chromium (headless shell) against the
identical verified URL, provenance-gated in the driver script.

Dev fixtures wrote the save directly (upgrade mode, empty tracker) so the
row reads on real state. The "before" row (`One more goal slot`) stands in
[`docs/evidence/317-conformance/desktop-goals.png`](../317-conformance/desktop-goals.png).

## The named row

- [Desktop GOALS](desktop-goals.png): the face's trailing row reads
  `Channel Strips · +1 goal slot · 500 ν` — product name leading, one
  compact effect line, the next price on the purchase button alone. The
  affordance state is the button's clear outline (enabled, affordable).
- [Phone GOALS](phone-goals.png): the same read on the 390px sheet —
  name, effect, and price hold one line at that width, the row trailing
  the slots it extends.

Pinned-prototype comparison: the pin pins the presentation language, not
this face, so the row was judged against the pinned prototype's decisions
as the captures show them — a hairline-ruled open row (no nested card, no
expandable), the condensed name leading, the effect line in muted mono
figures, the square-cut price button right — the same grammar the pin's
catalog embodies. A row-for-row comparison against a pinned GOALS-face
mock is not available — the pin carries no such mock; recorded
unavailable.

## Behavior preserved

- [Purchased](desktop-goals-purchased.png): the buy landed through the
  keyboard (Enter on the focused button) — slots `0/2 → 0/3`, the next
  steeper price (2,500 ν) on the button, the toast naming the product
  and its concrete effect ("Channel Strip added — one more goal slot.").
  The escalating ladder, the upgrade-only gate, and the occupancy-free
  purchase are the engine's own, unchanged.
- [Unaffordable](desktop-goals-unaffordable.png): the disabled price
  reads muted against the enabled capture — the state distinction does
  not ride color — and the button keeps its "Not enough nous yet"
  prompt. In flow the row reads "between sessions" and the prompt
  becomes "Purchases happen between sessions" (unit-covered,
  `focus.test.ts` "the flow-mode rule").

## Standards checks

- [Keyboard focus](desktop-goals-focus.png): the tab-reached buy button
  wears the visible focus ring; Enter bought through it (above).
- [Reduced motion](desktop-goals-reduced-motion.png): the face renders
  identically under `prefers-reduced-motion: reduce` — the row adds no
  animation; name, effect, price, and countdown are static text.
- [Grayscale](desktop-goals-grayscale.png): the face converted to
  8-bit grey — the enabled outline, the name, the effect line, and the
  price all read; no state rides hue alone.
- Disclosure at the initial implementation — recorded not applicable: the changed row carries no
  tooltip layer, so there is nothing to open or dismiss by keyboard or
  touch; the name, the +1 effect, and the price are all visible at rest.
  The only hover prompts left are the disabled/flow state explanations
  (critical prompts, kept). The former affordable-state tooltip ("Buy
  one more goal slot") restated the row and is deleted.
- Touch: real touch hardware was not available this pass — recorded
  unavailable. The buy is a native button at the sheet's standing touch
  size; its tap path is the same click handler the keyboard and pointer
  paths exercised.

The PR #328 review supersedes the initial disclosure assessment above:
Channel Strips is a glossary term and now opens its price-ladder gloss.
See [the correction evidence](../pr-328-disclosure/README.md).
