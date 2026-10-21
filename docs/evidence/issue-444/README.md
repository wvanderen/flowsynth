# Legacy build retirement — issue #444 evidence

Captured 2026-10-21 from the verified checkout (worktree `t3-45c077ab`, branch `t3/issue-444-implementation`, commit `aeeecdf` — the `/-/dev/provenance` endpoint matched `git rev-parse HEAD` at capture time; server `npm run dev`). The save is the shared dev localStorage on the serving port: its stale open session was ended through the app's own flow switch and its pending honesty report resolved through the report's own controls before capturing.

## What the capture shows

- **desktop-habit-detail.png** (1280×800) — the Focus sheet's HABIT face drilled into the long-practiced habit (47 h 52 min — past every retired build milestone, the shape that previously rendered the BUILD catalog): lifetime practice, sessions, last practiced, the Engineer class read (Level 4 · 2 tree points free), the next-level countdown, the practice-roll meter, the TREE section with its bounded-rank rows, and the tagged notes beneath. No BUILD section, no equip/unequip controls, no legacy node names, no milestone-hour unlock messaging. The class tree's locked rung reads "unlocks at class level 5" — the class layer's own prerequisite messaging, retained by design.

## DOM-level checks at 390×844 (phone pass)

The 390px pass ran with the sheet open on the same drilled detail. `window.innerWidth` 390 confirmed the viewport; the sheet renders single-column with the same hierarchy — head row, stat rows, class read, meter, TREE rows (Governor/Reed allocate buttons full-width), class-level unlock line, notes. No build section, no horizontal overflow. **The phone PNG capture itself is unavailable**: three capture attempts at this viewport returned a doubled-frame composite (a host screenshot-pipeline artifact — the live DOM probed single: one `#app`, one `#app-popover`, one `.habit-detail-read`). Per the evidence rules the viewport pass is recorded rather than claimed; fresh captures are owed when the pipeline is stable.

## Verified against the instrument standards

- Keyboard: the tree's allocate buttons take focus (`aria-label="Allocate Governor, rank 1 of 2"`, not disabled at 2 free points) and Tab reaches the row's term trigger next; the facetabs and back control are buttons.
- Non-color state: selection and rank ride the state grammar's marks (the firm inset facetab marker, `+1/2` rank marks, the `·` locked-rung mark, engraved check on the header's completed goal) — no state is color-only.
- Touch: the sheet's controls keep the pinned square geometry and full-width tree rows at 390px; no nested cards or explanatory filler entered with the retired section's space.
- Reduced motion: **unavailable as an emulated check** — the host exposes no `prefers-reduced-motion` emulation surface. The diff adds no animation; the only dynamic element near the changed surfaces is the practice-roll meter's width fill, and the retired build section carried no motion of its own.
- No new tooltips were added; the RITUAL gloss was shortened to fit the one-line ceiling (`The habit-keyed continuous charge receiver`).
