# Catalog: products, not rungs — review evidence

Source: issue #310, working tree on `t3code/implement-issue-310` (diff against
`4fcc0e7147ffda72619fe60204e2c1295aed31b2`, including the steering pass).
Launched this checkout with `npm run dev` at `http://localhost:5173/?dev=1`.
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
  [phone nous](phone-nous-poly-expander.png): the nous face in register —
  starter-shelf rows carry the simplified module preview (the tray tile's
  category-hued hex and glyph), the capacity row is headed **Poly
  Expander** with the mono delta `1/3 → 2/3` on its own line beside the
  blank-module preview, and the acquisition paragraph is gone — the Show
  acquired toggle's ⓘ glosses `Roll copies stay as combination material`.
  Price rides the buy button alone, muted here (`0 ν` in the purse) with
  its practice countdown.
- [Desktop upgrades](desktop-arete-upgrades.png) and
  [phone upgrades](phone-arete-upgrades.png): the face holds two sections —
  **Upgrades** (the entry's ACQUIRED rewards line, Expansion Bays, Chord
  Catalysts, Headroom, the inert Accelerator placeholder) and **Module
  Types**. Each product is one entry bought twice: owned figure on the
  heading, one effect line with hoverable terms, and the mono delta on its
  own line (`ceiling 3 → 4`, `prices −0% → −20%`, Headroom's honest
  `claim: +1 per prestige → + over-line score, cap 25` — the next era's
  over-line score is not knowable at purchase).
- [Module types](desktop-arete-module-types.png) and
  [phone module types](phone-arete-module-types.png): the section heading
  carries the ⓘ — `Rolled module types appear here unweighted` holds for
  everything the section collects — and the Mutator Forge join previews
  the simplified mark beside the one-line `Fill with charge → Mutator
  draft`; no mechanics prose paragraph.
- [Complete](desktop-arete-complete.png): sold-out ladders end in the
  engraved owned-words (`raised`, `catalyzed`); Headroom complete reads
  `open` and its delta stands down; the price buttons are gone.

## Disclosure

- [Keyboard focus](desktop-nous-disclosure-focus.png): focusing the Poly
  Expander's ⓘ opens the one gloss ("One more whole chord per voice") —
  floating text over the panel, no border, no shadow, no card. The suite
  covers Escape dismissal and the tap pin.
- [Term hover](desktop-arete-term-hover.png): the effect line's domain terms
  (`Harmonic capacity`, `memorized`) render hoverable over a dotted
  hairline; clicking pins the gloss (`Whole-chord budget per voice`,
  `Persists through arete reset`). Persistence is never spelled out — the
  word rides the line, the hover carries the meaning.
- [Phone term pin](phone-arete-upgrades.png): the pinned gloss portals over
  the sheet at phone width and dismisses on tap-away.
- The Accelerator's tooltip is deleted: the visible `(placeholder)` kind and
  the muted button carry the state; nothing restates it.
- A unit guardrail walks the catalog's rendered tooltips on both faces and
  asserts the gloss standard mechanically: ≤ 60 characters, no em dash,
  semicolon, or colon.

## Standards checks

- **State grammar without color**: muted outline = unaffordable (600 ν, the
  placeholder), clear outline = available, engraved marks = acquired —
  visible in the captures above.
- [Reduced motion](desktop-arete-reduced-motion.png): the face renders
  identically under `prefers-reduced-motion: reduce` — the catalog adds no
  animation or glow of its own; states ride static outlines and engraved
  marks, and the borderless gloss stays legible on the panel fill.
- Grayscale pass: unavailable in this headless capture; the non-color state
  cues (muted disabled, engraved words, inset tab marker) are the state
  grammar's own, reviewed in the code and the unit suite.
