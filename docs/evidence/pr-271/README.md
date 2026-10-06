# Tabbed catalog behind the Catalog door — review evidence

Source: PR for issue #271, working tree on `332e50b5059153a5763409d4f7e6b7686d7c1cfe`.
Launched this checkout with `npm run dev` at `http://localhost:5174/?dev=1`.
The provenance endpoint (`/-/dev/provenance`) returned this worktree and commit
before any capture. Desktop captures are the tab's 1280px viewport; phone
captures are a same-origin 390×844 iframe of the same server (the preview's
viewport resize could not run — recorded unavailable — and the iframe's own
viewport drives the media queries the modal layer responds to).

Dev fixtures set the board states (`window.__flowsynth`): first prestige
banked, entry owned/unowned, illustrative balances.

- [Desktop nous](desktop-nous.png) and [phone nous](phone-nous.png): the face
  switch reads `ν nous` / `◇ Arete` and is the sheet's only title — no
  "CATALOG" eyebrow, no balance line inside; the identity mark rides the
  active face's resource color. Fixed clipped frame, open rule-separated rows.
- [Desktop arete lock](desktop-arete-lock.png) and
  [phone arete lock](phone-arete-lock.png): pre-entry the arete face is the
  single centered `Unlock Mutator Layer · 1 Arete` lock screen; no
  Upgrades/Unlocks anywhere. Phone sheet measured 623px ≈ 74vh.
- [Desktop arete entered](desktop-arete-entered.png) and
  [phone arete entered](phone-arete-entered.png): the purchase reveals
  Upgrades (entry ACQUIRED with its rewards line, the inert Accelerator
  placeholder, the Horizon break) and Unlocks (the roll-pool join). With 6
  Arete banked the 10-Arete break and the placeholder price read muted while
  the 5-Arete join stays armed — the mute is the disabled state, not hue
  alone (muted color + disabled cursor + no hover fill).
- [Tooltip pinned by touch](desktop-tooltip-touch-pinned.png): the Horizon
  break's ⓘ tap pins the tooltip body (portaled, `aria-expanded=true`).
- Disclosure checks: the touch pin opened and Escape dismissed it (focus kept
  on the trigger); a real Tab keystroke then opened the join row's tooltip by
  keyboard focus (`inst-tip focused`, body shown). Programmatic focus without
  prior real input opens nothing — recorded here as the browser's unfocused-
  document limitation, covered by the unit suite's focus-path tests.
- Face switching never resizes the frame: both faces captured at both widths
  share one fixed extent (620×600 desktop, 74vh phone); only the body scrolls.
- Reduced motion: the catalog adds no animation or glow of its own — states
  ride static outlines, inset markers, and engraved marks; the modal layer's
  sheet transition dies under the global reduced-motion block. State survives
  without animation. A live reduced-motion viewport pass: unavailable.
- Grayscale pass: unavailable in this preview; the non-color state cues above
  (muted disabled, engraved ACQUIRED, inset tab marker) are the state
  grammar's own, reviewed in the code.

One feats surface per screen stands elsewhere (ADR-0030 unamended) — no feats
furniture enters the sheet.
