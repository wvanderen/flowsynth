# Catalog: products, not rungs — review evidence

Source: issue #310, working tree on `t3code/implement-issue-310` (diff against
`4fcc0e7147ffda72619fe60204e2c1295aed31b2`).
Launched this checkout with `npm run dev` at `http://localhost:5175/?dev=1`.
The provenance endpoint (`/-/dev/provenance`) returned this worktree and commit
before any capture, in the capturing tab itself. Desktop captures are a
1280×800 headless-Chromium viewport of that server; phone captures are 390×844
of the same server (the preview panel's own snapshot client could not run —
recorded unavailable — so captures came from the repo's cached Playwright
Chromium against the identical verified URL).

Dev fixtures set the board states (`window.__flowsynth`): mutator era, the
entry owned, illustrative balances and ladder positions.

## The renamed surfaces

- [Desktop nous](desktop-nous-poly-expander.png) and
  [phone nous](phone-nous-poly-expander.png): the capacity row is headed
  **Poly Expander**, the `1/3` figure beside it, no restating small-line — the
  blank-module preview (a bare chassis wearing `0/2`, the board's own
  used/total read) shows the purchase's outcome instead. Price rides the buy
  button alone, muted here (`0 ν` in the purse) with its practice countdown.
- [Desktop arete](desktop-arete-products.png) and
  [phone arete](phone-arete-products.png): the entries group by purchase
  target — **For every voice** (Rack Extenders `0/2` · 6 Arete; Chord
  Catalysts `0/2` · 3 Arete), **For the layer** (entry ACQUIRED, the inert
  Accelerator placeholder, Headroom), **For the rolls** (the pool join). Each
  product is one entry bought twice: owned figure once, next price on the
  button, effect line one line with hoverable terms. Headroom stands where
  the Horizon break stood; no mechanics word leads any name.
- [Mid-ladder](desktop-arete-mid-ladder.png): Rack Extenders at `1/2` with the
  rising next price (14 Arete) on the same entry — no second rung, no "Own
  the first…" lock state anywhere on the face.
- [Complete](desktop-arete-complete.png): `2/2` entries end in the engraved
  owned-words (`raised`, `catalyzed`); Headroom complete reads `open`; the
  price buttons are gone.

## Disclosure

- [Keyboard focus](desktop-nous-disclosure-focus.png): focusing the Poly
  Expander's ⓘ opens the one mechanics line ("One more whole chord for every
  current and future voice; prestige returns capacity to one.") — plain
  panel surface, hairline, no card outline. The suite covers Escape dismissal
  and the tap pin.
- [Term hover](desktop-arete-term-hover.png): the effect line's domain terms
  (`Harmonic capacity`, `memorized`) render hoverable over a dotted hairline;
  clicking pins the glossary body to the term. Persistence is never spelled
  out — the word rides the line, the hover carries the meaning.
- [Phone term pin](phone-arete-products.png): the pinned body portals over
  the sheet at phone width and dismisses on tap-away.
- The Accelerator's tooltip is deleted: the visible `(placeholder)` kind and
  the muted button carry the state; nothing restates it.

## Standards checks

- **Tooltip economy**: every remaining tooltip on the face is one mechanics
  line that restates nothing visible (Headroom's claim scaling, the pool
  join's unweighted entry, the Poly Expander's grant). The ladders carry no
  tooltips at all.
- **State grammar without color**: muted outline = unaffordable (600 ν, the
  placeholder), clear outline = available, engraved marks = acquired — visible
  in the captures above.
- [Reduced motion](desktop-arete-reduced-motion.png): the face renders
  identically under `prefers-reduced-motion: reduce` — the catalog adds no
  animation or glow of its own; states ride static outlines and engraved
  marks.
- Grayscale pass: unavailable in this headless capture; the non-color state
  cues (muted disabled, engraved words, inset tab marker) are the state
  grammar's own, reviewed in the code and the unit suite.
