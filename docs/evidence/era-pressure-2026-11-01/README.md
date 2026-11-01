# Era pressure — the depth bands (issue #489)

Captured from the verified checkout at commit `f4d22b48` (branch `t3/issue-489`),
served by `npm run dev` at `http://localhost:5173/`. The capture preflight
(`provenance.json`) verified the served worktree, commit, and clean source
before the first capture and again after the mid-pass tab recovery below.

## Changed surfaces

The issue's UI delta is the penalty figure three surfaces read — the World
layer's enemy plate, the Hex detail's World chassis, and the Hex detail's
World line — now showing the era's current depth-band pressure instead of the
authored discovery-band constant. No new surface was added.

## Seeding (reproducible)

In a tab opened at the verified URL with `?dev=1`, against
`window.__flowsynth`:

```js
const app = window.__flowsynth;
if (!app) throw new Error("Open the verified URL with ?dev=1 first.");
app.devWorldEra();
const s = app.state;
s.eraEarned = 1e14;                     // two bands past w0's reveal
s.world.enemies.w0 = { discovered: true, hp: 7 };
s.world.enemies.w1 = { discovered: true, hp: 18 };
s.world.enemies.w2 = { discovered: true, hp: 24 };
s.cells.push({ q: -1, r: 0 });          // the enemy coordinate owned: its cross-section opens
app.save();
```

The tab was then reloaded without `?dev=1` (the seeding persisted in the
ordinary save) so the captures show the shipped surfaces with no dev console.
The World layer switch and the enemy plate click ran through the real
controls (layer legend button; the plate's own click handler opening the
cross-section on the World face).

The era figure puts w0 two bands deep (−50% ν), w1 one band deep (−35% ν),
w2 at its discovery band (−20% ν), and w3–w8 still reserved — the three
figures on screen are three different depth bands read off the one shared
`enemyPenaltyOf`.

## Captures

| File | Viewport | Surface |
| --- | --- | --- |
| `desktop-world-layer.png` | 1280×800 (fill) | The World face: w0 `HP 7/12 · −50% ν`, w1 `−35% ν`, w2 `−20% ν`, reserved plates silent |
| `desktop-hexdetail-world.png` | 1280×800 (fill) | The cross-section at F3: the World face focused (`ENEMY · HP 7/12 · −50% ν`) and the details column's World line `Enemy · −50% ν while it stands` |
| `phone-world-layer.png` | 390×844 | The same face at phone width; the deepened figures read on the plates |
| `phone-hexdetail-world.png` | 390×844 | The same cross-section at phone width; chassis figure and World line both read |

## Standards checks

- **Non-color state**: the pressure figure is text (`−50% ν`) on the plate
  and line; the plate's state grammar (firm/engraved/reserved) is unchanged
  and reads in greyscale.
- **Disclosure**: no tooltip or disclosure was added or changed; the enemy
  chassis tip (`Enemy · attacked by adjacent weapons on their cadence`) is
  pre-existing copy. Nothing new to open or dismiss.
- **Reduced motion**: the change adds no animation or glow; the surfaces are
  static. Not applicable beyond the unchanged presentation.
- **No aggregate surface**: the ledger, rate roster, and header carry no new
  pressure read — the criterion's "no ambient aggregate penalty surface"
  holds on screen as in code.

## Recovery record

The phone pass on the first tab stalled: three `preview_snapshot` attempts at
390×844 timed out after 15000 ms each (`browser-snapshot` class; the page
itself stayed responsive — an evaluate read the live 390×844 size, the open
detail, and the line figure between attempts), and the health check
(`tools/evidence-healthcheck.mjs`) verified the server/provenance side clean.
A fresh tab on the same verified URL recovered the pipeline; its first
resize echo reported a stale 1280×800 while the page's own boxes read
390×844, and both phone captures succeeded on that tab. The capture
preflight was re-run and accepted after the recovery.
