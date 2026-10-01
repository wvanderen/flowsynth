# Bulk upgrades sweep partial and stay enabled

A late-game board multiplies per-module upgrade friction: after prestige re-levels every era (ADR-0039), raising a dense board one level at a time is the loop's dominant chore. The prototype contract (issue #173, approved across four iterations on `prototype/bulk-upgrade-controls`) settled what the bulk controls are; this ADR records the decided behavior they implement (issue #195, 2026-09-30).

## Decision

- **Three surfaces, one ladder.** Every bulk surface steps through the shared +1 / +5 / +10 / MAX ladder:
  - **Face button** — one button per closed, levelable face, covering the bottom corner as a trapezoid shaped to the hexagon's own taper. Click buys +1; holding shift flips every face button's label and tooltip to MAX board-wide (the Cookie Clicker pattern), and a shift-click buys every affordable level. The click's own shift state is the source of truth; the flip only shows the mode.
  - **Upgrade All cluster** — a plain bold UPGRADE ALL label (not a chip) beside the four quick-buy chips, docked at the board's lower edge (above the thumb bar on phone). +N buys up to N levels on every levelable module, cheapest modules first; MAX sweeps the whole bank into the globally cheapest next level until nothing is affordable — the max-all sweep, maintainer-confirmed. Equal next costs fall to the older module.
  - **Expanded-face dial** — the bloom's Upgrade button gains the ladder as a chip row (×1 / ×5 / ×10 / MAX·k) with the live total cost and the k-level benefit; MAX's label shows the affordable count.
- **Partial by design.** No bulk control ever disables. Every purchase buys what the bank covers, and the toast reports what landed ("UPGRADE ALL +5: 70 levels across the board · 552.9M ν"), not what was wanted. Full-N cost previews live in tooltips; the dial's MAX count and the face button's MAX tooltip read the real bank.
- **One pricing seam.** Bulk purchases charge the same per-level prices as the one-level action, summed exactly — preview and charge read one pure sweep plan, so they cannot disagree.
- **Eligibility.** Spacers are excluded everywhere (a level buys the silent wire nothing). Tray modules ride the sweeps — they wear no face button, so the cluster is their only bulk path. Deployed modules carry the face button; the lifted module's affordances ride its bloom.
- **Upgrade-mode-only.** All three surfaces are upgrade-mode furniture: in flow they vanish with the rest of the purchase furniture, and the shift mode drops with them.
- **Numbers are tuning.** The ×5/×10 steps, the sweep pacing, and the MAX iteration cap are provisional, per the map's tuning-fog line.

## Consequences

- The engine gains the bulk seam beside the one-level action: the per-module ladder and the board sweeps return what landed (levels, modules, spend), and feats sync at the action boundary as every state-mutating action does (ADR-0015).
- The bloom face's note footnotes deeper into the taper: the dial widens the button band, and the note yields the room.
- The one-level upgrade path survives only as the engine action behind the dial's ×1 — the UI no longer carries a separate upgrade control.
