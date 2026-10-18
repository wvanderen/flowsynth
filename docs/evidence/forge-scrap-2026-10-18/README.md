# Forge batch drafting + catalog scrap face — 2026-10-18

Evidence for the confirmed feedback rounds (this worktree, commit `7c5f67959a9df50d7bce12f8adbf954af904cd25` at capture time, provenance verified via `/-/dev/provenance` against `git rev-parse HEAD`). Decisions recorded in CONTEXT.md the same day: scrap purchases sell on the catalog's `⛏ scrap` face; every draft choice mints unplaced and the Forge walks both queues until they run dry; the Forge carries no ⓘ icons; the candidate tile's rarity notation mark reads at its notation size.

Second round, same day: the scrap face moved onto the catalog-row grammar the `ν nous` face sells through (name + note left, price affordance right); the Forge's candidate tiles swapped the full 112px faces for the inventory's simple marks (the identity reads in the name and readout beneath); the Skip control stands centered beneath the draft; the cue reads `Choose a new module` / `Choose a new mutator`; the candidate scaling line dropped its `upgrades from 10 ν` tail; and the peek wears the two-layer rim so the hairline follows its clipped corners.

Third round, same day: the player-facing verb became **Roll** (CONTEXT.md's Special draft entry amended, `weaving` retired to its Avoid line); each row's Roll control stands visible-but-muted until an entitlement is held, on one line with the scrap price; the Jacquard Card's category picks became the categories' own hex symbols (their launch designs' glyphs in the category hue, word beneath), live only while a Card is held; a rolled offer wears its product's name and guarantee in the Forge (`special` tag on the offer, persisted); and the face split into **Draft Loom** / **Special Drafts** sections, trimming the `One draft,` prefix off every special's note.

Fourth round, same day: the held count renders on every row — `0 held` included — so no row changes height as entitlements come and go; the scrap register's `.price.scrap:disabled` override makes the Roll's unavailable state actually read muted (its register color previously out-specificed the shared disabled mute); and the category picks became a vertical list of horizontal chips — icon left, word right, each chip framed in its own category hue (live picks), soft-bordered with dimmed marks while no Card is held.

Fifth round, same day: the Draft Loom moved under a **Forge Upgrades** section as a row level with the special drafts, its note reading the owned rung in the inventory's `Lv.` notation (`Lv. 2 · merge tier bonus 30% → 50% · memorized`); and the Jacquard Card's category symbols render only while a Card is held — unowned, the face stays compact.

## Captures

| File | Surface |
|---|---|
| `desktop-forge-modules.png` | Forge peek, Modules face: rim hairline following the clipped corners, cue, three simple-mark tiles with readouts, centered Skip, meters |
| `desktop-forge-special-note.png` | The Forge on a rolled Jacquard offer: `Jacquard Card · Spacer draft` beneath the cue, all three candidates honoring the category |
| `desktop-catalog-scrap.png` | Catalog `⛏ scrap` face, nothing held: `0 held` counts, muted Roll controls, the category list dimmed |
| `desktop-catalog-scrap-held.png` | The same face with entitlements held: live hue-framed category chips, enabled Rolls, held counts |
| `phone-forge-modules.png` | 390px Forge peek: simple-mark rows, centered Skip, meters |
| `phone-catalog-scrap.png` | 390px catalog bottom sheet on the scrap face: rows wrap, price buttons single-line, body scrolls |

## Behavioral checks run against the live server

- **Batch walk** (desktop, driven through the real controls): pick → next banked offer renders on the same face (`placing` stays null, toast `Harmonizer added to inventory. 1 more choice wait in the Forge.`); the pick that empties the modules queue auto-switches to Mutators; the pick that empties both queues closes the Forge and the mints sit in inventory unplaced.
- **Skip chains** the same walk (covered by `src/ui/app.scrap.test.ts`).
- **Disclosure**: a scrap-face term opens on keyboard focus and Escape dismisses the gloss without closing the sheet; touch/click activation covered by `src/ui/app.special-draft.test.ts`. The removed ⓘ icons left no bare triggers — the only disclosures on the face are hoverable domain terms.
- **Price affordance**: the scrap price buttons share the `.price` grammar (44px floor, mono figure, scrap mark beside the figure on one line); muted by the shared disabled state at an empty balance or in flow.
- **State without color**: rarity is shape mark + accessible word; the Tuned ladder state reads as the engraved acquisition word; muted controls carry the outline grammar.
- **Reduced motion**: the changed surfaces carry no animation or glow — static fills, static text — so the static presentation is the only one.

Unavailable: none. All four captures came from the verified checkout at the commit above.
