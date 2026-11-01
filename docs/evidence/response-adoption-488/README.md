# The adopted response-support progression — inspection evidence

Issue #488 adopted the bounded response-support progression for the
Chorus and Exciter: the grant's level term is now
`1 + share·level/(level + saturation)` from `BALANCE`
(`responseShare` 3, `responseSaturation` 20), read through
`economy.ts:responseSupportPowerOf` — the same shared result the rate
pass, the allocator, and the decomposition apply. The inspection
surfaces that previously derived their figures from the retired
exponential module power were switched to that shared read; this pass
captured each changed surface from the verified checkout.

Source: commit `91aac67f` (the adoption commit). Captured with the
repo-cached Playwright Chromium headless shell against this checkout's
dev server after `tools/evidence-preflight.mjs` accepted
`docs/evidence/response-adoption-488/provenance.json` (worktree, commit,
and clean-source verified). The dev panel was hidden at capture time —
it is development furniture, not a reviewed surface. The staged state
(the dev panel's own line named it during the run): the `fresh-start`
scenario installed on its isolated slot, seeded with a level-100 tier-II
Chorus beside the opening, a charged Focus-keyed generator, a level-50
tray Chorus, and a Forge offer carrying Chorus/Exciter/Sine candidates.
The T3 preview panel's snapshot pipeline timed out on this machine
(three attempts per its budget, `preview_status` healthy throughout) —
the captures were taken through the same verified URL with Playwright
instead; no claim below rests on the preview panel.

Changed surfaces and their figures (all computed by the shared seam, so
the capture cannot drift from production):

- [Hex detail, desktop](hexdetail-chorus-desktop.png) and
  [phone](hexdetail-chorus-phone.png): the levelled Chorus's face
  readout `+428.78%` — the authored 50% share × the adopted term ×3.5 ×
  the tier-II 1.5 × the charge-projected 1.63 — where the retired
  exponential power would have quoted an astronomic figure; the upgrade
  column quotes `+0.31% chord response` for the next level, the term's
  own 100→101 step (0.5 × 1.5 × (3.50413 − 3.5)), saturating instead of
  compounding.
- [Charge breakdown, desktop](breakdown-chorus-desktop.png) and
  [phone](breakdown-chorus-phone.png): the decomposition rows now read
  `Base chord response +50% · Response power ×5.25 · Charged empowerment
  ×1.63 → Chord response +428.78%` — the power row quotes the shared
  read and the rows multiply out to the outcome exactly. The former row
  label was "Host power", quoting the exponential module power.
- [Breakdown by keyboard focus, desktop](breakdown-chorus-focus-desktop.png)
  and [phone](breakdown-chorus-focus-phone.png): the same disclosure
  opened by focusing the wave trigger — the disclosure access states
  ride the shared trigger, unchanged by this work.
- [Forge draft, desktop](forge-candidates-desktop.png) and
  [phone](forge-candidates-phone.png): the Chorus and Exciter candidates
  carry the scaling chip `response ×1 → ×4 with level` — the saturation
  span from `BALANCE.responseShare` — in place of the retired
  `+25% / level` rarity claim; the Sine candidate beside them keeps its
  unchanged `+20% / level` chip, so the contrast is on the surface.
- [Inventory inspection, desktop](inventory-chorus-desktop.png) and
  [phone](inventory-chorus-phone.png): the tray Chorus's intrinsic share
  reads `+157.14% chord response` at level 50 — 0.5 × (1 + 150/70) — the
  shared term, where `modulePower` would have read `0.5 × 1.25^50`.

Checks recorded from the mechanism rather than a dedicated capture:

- Reduced motion: every changed surface is static text on the existing
  panels — no animation or glow was added; the breakdown disclosure and
  the charge wave's reduced-motion behavior are the existing contracts,
  untouched by this work.
- State without color: the changed figures ride existing text/mono
  readouts and the four-state grammar; the scaling chip is plain text.
  No new distinction is carried by hue alone.
- Touch: the disclosed breakdown opened by the same tap target on the
  phone viewport (the phone breakdown captures are click-opened, the
  same pointer path touch takes).

The engine-side behavior (grant parity, marginal growth, capacities,
merge tiers, certification, the Tail's untouched foundation) is covered
by the named automated cases in the completion record; this pass covers
the inspection surfaces only.
