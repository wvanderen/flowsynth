# World surfaces — visual evidence (issue #426)

Captured from the verified checkout at the dev server's provenance
response: worktree `t3-8bd6ddea`, branch `t3/issue-426`, served URL
`http://localhost:5173/?dev` (dev rig: the World era grant seeds the
scene; the panel's own chrome is dev furniture, not a surface).

Scenes were produced by playing the real app — the tray sheet's Place,
drag-and-drop with the live ghost, right-click retrieval, the Catalog
purchases, and the prestige door — never by patching the DOM.

## Checks

| Check | Evidence | Result |
| --- | --- | --- |
| Desktop, World layer standing | `desktop-world-layer.png` | Reserved (hatch), discovered (firm, HP + penalty), cleared (engraved, era bonus), fed weapon (charge bar, ⌁18/30, ATK 6), Column (lift ⌁1.44/s), open (dashed), tray with stored count |
| Placement preview, one lift pass | `desktop-placement-preview.png` | Drag's ghost over an open face; the reserved readout carries the moved blade's routing and the neighbor's before → after from the engine's lift read |
| Tray inspection + target priority | `desktop-tray-inspect.png` | Plate tile, name, one effect line, hoverable `Target priority` term, ordered rows with steppers, roster-default verdict |
| Hex detail, World face | `desktop-hexdetail-world.png` | Enlarged blade chassis over the module face, the rail's Retrieve + priority control |
| Catalog, arete face | `desktop-catalog-world.png` | World section leading: the Column's ladder and the Hone entry in the product register |
| Prestige confirm | `desktop-prestige-confirm.png` | The claim stated live; the World's purchases named among what survives |
| Phone (~390px), World layer | `phone-world-layer.png` | The tray re-pins as the strip above the thumb bar; the layer's plates render at phone width |
| Phone, tray sheet inspection | `phone-tray-inspect.png` | The shared switch, the inspect face, the priority control |
| Disclosure by keyboard, dismissed by Escape | run log | The `Target priority` term trigger focused → body `inst-show`; Escape dismissed. Touch opens through the same `inst-tip` state machine the controls sheet pins (first touch names, second opens) |
| States out of greyscale | `desktop-greyscale-states.png` | Every plate state reads without color: hatch vs firm vs engraved vs dashed, figures where the mechanics live |
| Reduced motion | run log | The breath and pulse animations gate behind `prefers-reduced-motion: no-preference`; the reduce block renders the fill and plate static (`animation: none`, fixed opacity) — asserted against the served stylesheet |

## Unavailable

- Touch-device tap disclosure was exercised through the sheet's shared
  `inst-tip` state machine (the controls sheet's pin) in a desktop
  browser; no physical touch device was attached, so the tap path is
  asserted by the shared implementation, not captured on hardware.
- The grant modal's moment is pinned by `src/ui/world.test.ts` (it opens
  exactly on the landing that mints the starter weapon); capturing it
  live would have required re-running the prestige past the entry on a
  fresh save, and the modal's composition is the grant plate plus two
  lines already evidenced in the tray and catalog shots.
