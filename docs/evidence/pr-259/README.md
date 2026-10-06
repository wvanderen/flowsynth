# Issue #259: the harmonic-capacity ladder — verification

Implemented and exercised on branch `t3code/implement-issue-259` in this worktree.

## Automated checks

- `npm run check`: passed.
- `npx vitest run`: 49 files, 1,041 tests passed (before the UI-suite addition; the ladder suites and the full `src/ui/app.test.ts` pass after it — see the commit's recorded run).
- New engine suite `src/engine/capacity.test.ts` pins the acceptance scenarios: exact whole-nous spend raising every current and future voice, the two-rung first-era ladder and its cap, flow-mode refusal, the Arete ceiling/discount ladders (order, prices, ceilings-above-discounts), save/reload with lenient zero defaults, corrupt-count degradation and ceiling clamping, prestige's reset-and-repurchase cycle, and the permanent offerings surviving it.
- New UI suite `the harmonic-capacity ladder (#259)` in `src/ui/app.test.ts`: ordinary play omits both capacity surfaces; the dev Catalog quotes figure, price, benefit, and the practice-minute estimate; a purchase lands and re-reads the row; the capped and complete states; the Arete sheet's two locked pairs, owned words, and flow-mode inertness; ladder ownership across the app's real save path.

## Browser provenance and desktop evidence

Launched this checkout with `npm run dev`. The preview was `http://localhost:5175/?dev=1`; the browser fetched `/-/dev/provenance` and confirmed:

- Worktree: `/Users/eggfam/.t3/worktrees/flowsynth/t3code-19350805`.
- Branch: `t3code/implement-issue-259`.
- Commit: `0ebcc3b74f7cb43cf9f440c9f314e25a86ba08a8` (working tree carries the implementation).

Captures, desktop 1,402 × 877 CSS px:

- [First rung](catalog-first-rung.png): the Catalog's development-only Harmonic capacity row — figure `1/3`, the whole-chord benefit and prestige-reset copy, and the quoted `600 ν` price button in the shop row grammar (open rows, condensed name, mono price).
- [Second rung](catalog-second-rung-countdown.png): after the purchase the figure reads `2/3`, the exact spend is visible in the balance (712 → 112 ν), and the next rung stands disabled with its practice-minute estimate (`in ~29h 14m of practice`).
- [Capped](catalog-capped.png): at `3/3` the buy button is replaced by the engraved `capped` word and the pointer note at the Arete sheet; no price exists to quote.
- [Offerings, locked pair](arete-offerings-locked.png): the Arete sheet's development-only section — two ceilings and two discounts, the second of each pair locked "After the first" with its `title` giving the why.
- [Ceiling owned](arete-ceiling-owned.png): after the first ceiling purchase the row reads `raised`, the second ceiling prices at `14 Arete`, and the Catalog's row reopens at `3/4` with the third rung quoted — the ladder and the sheet re-read each other through their rebuild keys.

State grammar: disabled price buttons (unavailable), engraved mono words (owned/capped/complete), and figure readouts carry the states without color; nothing on these rows animates. Tooltips ride the buttons' native `title`, matching the standing Arete sheet rows.

Ordinary play (no `?dev`): both Catalog surfaces render no Harmonic capacity section — DOM-verified in the same browser; the engine's dev gate owns the surface, matching ADR-0052.

## Unavailable checks

- Phone viewport: both the iPhone preset and freeform 390 px resizing timed out (15 s). The rows ride the existing shop-list/modal responsive furniture; no phone composition is claimed.
- True touch disclosure: unavailable; keyboard focus and pointer were exercised, not touch.
- Greyscale and reduced-motion emulation: unavailable. The new rows add no animation and no color-only state; this source-level note is not a claimed emulation pass.
