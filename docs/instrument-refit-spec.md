# The instrument refit: next-iteration spec

The implementation-ready design for the FlowSynth iteration charted by [Refine FlowSynth into a coherent visual instrument](https://github.com/wvanderen/flowsynth/issues/242). Every contract below traces to a resolved decision ticket and, where one exists, a recorded ADR amendment; the wave plan, persistence boundary, and acceptance-criteria shape were agreed on the assembly ticket [Assemble the resolved designs into the implementation-ready spec](https://github.com/wvanderen/flowsynth/issues/265). The approved visual standards and their pinned prototype stand in `docs/instrument-standards.md` and govern every surface here. This spec is the planning handoff; it does not implement the release.

## Scope and release boundary

All seven resolved clusters ship as **one coherent iteration**:

1. The instrument standards — panel geometry, disclosure, state grammar, typography ([#243](https://github.com/wvanderen/flowsynth/issues/243))
2. Milestone feats ([#244](https://github.com/wvanderen/flowsynth/issues/244))
3. Ledger and catalog navigation ([#245](https://github.com/wvanderen/flowsynth/issues/245))
4. Module/mutator mode, controls, and trays ([#246](https://github.com/wvanderen/flowsynth/issues/246))
5. The mutator entry sequence ([#247](https://github.com/wvanderen/flowsynth/issues/247))
6. The chord sheet ([#248](https://github.com/wvanderen/flowsynth/issues/248))
7. The console restructure and focus surfaces ([#249](https://github.com/wvanderen/flowsynth/issues/249), [#255](https://github.com/wvanderen/flowsynth/issues/255), ADR-0050)

**Not in this release**: replacing the core rack identity — the hex module chassis, signature glyphs, category hues, rarity finish, and charge light are preserved, and hexes keep describing modules and their relationships; any new progression, economy, or balance content (the Arete Accelerator ships as an inert placeholder; expose-only feat rewards per the amended ADR-0015); the larger Notes rework (a future milestone — only Notes' capture/browse launcher and sheet are here); everything under Deferred work. CONTEXT.md's surface-entry rewrites (catalog door, console, tray, launcher, ledger, chord sheet) land with their implementation waves.

## Sequence

Six waves, one release ([#265](https://github.com/wvanderen/flowsynth/issues/265)); the ordered backlog hangs off the assembly ticket:

| Wave | Delivers | Contract sources |
|---|---|---|
| 1 | Instrument-standards foundation (panel geometry, tooltip layer, state grammar) + the milestone feats registry, icons, and FEATS surfaces | #243, #244 |
| 2 | Ledger panel, tabbed catalog, the Catalog door, phone strip and Collection launcher | #245 |
| 3 | Mode unification: tray column, Add arming, board tabs, retrieval, pre-entry lock; the door opens on the mode's face | #246 |
| 4 | The mutator entry sequence | #247 |
| 5 | Console restructure: banner, Focus control sheet, Notes tabs, phone banner, drag handle | #249, #255, ADR-0050 |
| 6 | Chord sheet + the remaining standards retrofit (session summary, honesty report, Settings) + the confirmed prose cuts | #248, #249 |

Waves 2–3 stay adjacent: the mode (#246) directs the catalog door (#245) — mode wins over the door's face memory. Wave 4 sits on top of both. Wave 1 is display-layer foundation and carries no migration; this iteration carries **no** save version bump at all (see Persistence and migration).

## Contracts

### The instrument standards ([#243](https://github.com/wvanderen/flowsynth/issues/243)) — foundation

- Flat instrument panels with occasional clipped outer corners; open divisions and rules inside — never repeated rounded cards or nested boxes. Clipping defines the panel silhouette; it is not decoration applied to every control.
- Surface identity rides its resource color and canonical icon when context already makes the surface clear; no title or duplicated balance fills a header. The Arete prototype mark is provisional, not approved canonical art.
- Condensed technical lettering for names and controls; monospace/tabular figures for readouts; readable sans for notes and longer mechanics. Exact fonts are implementation tuning.
- Shared state grammar: muted outline unavailable, clear outline available, firm inset marker selected, engraved mark acquired — recognizable without color alone.
- Glow and motion are reserved for charge and live activity; idle panels stay quiet; reduced-motion preferences are respected and state information survives without animation.
- Readouts compress name + state + concrete effect (`Chords (4/11) +8% ν`); effects may ride a concise symbol or relation (`Fill with charge → Mutator draft`). Units identify figures; redundant labels, balances, explanatory paragraphs, repeated names, and generic furniture are removed. Elements absent from the intentional content outline do not exist.
- Deeper mechanics live in the tooltip layer — never expandable detail sections. Italics in spec prose mark tooltip content; italic text is not a visual convention. Tooltip access works with hover, keyboard focus, and touch, and stays dismissible; critical names, effects, prices, and purchase state stay visible without it.

### Milestone feats ([#244](https://github.com/wvanderen/flowsynth/issues/244))

- Five milestone feats join the registry (18 → 23): **Mutator entry** (`catalogEntryOwned`), **roll-pool join** (`rollPoolJoined`), **first prestige** (`prestiges >= 1`), **first row unlock** (either side), **shelf completion** (all three starter-shelf offers). Names are provisional per ADR-0015.
- One registry, split by a `milestone` flag. Milestones render as their own group, first in the list, each row reading like `Mutator entry · Mutator Grid on · +2% ν`; encouragers stay in the five category buckets with progress bars.
- The beat's gate stays owned by its own surface (the Arete Catalog, the board, the app) — no feat ever owns a gate (ADR-0015).
- Rewards stay expose-only: the single global achievementBoost term (+2% per feat) remains the only reward; a milestone's row names the beat's own existing unlock. No new economy.
- "Feat" is the player-facing word on every surface: modal header FEATS, chip `N/23 feats`, dock label, toast "Feat unlocked — …"; "achievement" stays the system term.
- Every feat row shows four facts: its unique icon, its name, its effect (`+2% ν`), and its state — an engraved done-mark, or progress `x / y` for encouragers. Un-crossed binary milestones read muted with the effect still visible; the tooltip names the gate.
- All 23 feats get unique icons in the instrument's glyph language.

### Ledger and catalog navigation ([#245](https://github.com/wvanderen/flowsynth/issues/245))

- **The ledger** (board ledger and phone game-info strip, one clipped instrument panel): the session read leaves. Resources group left — `1.24k ν · 18.6 ν/s · 6 ◇`, arete in its color with the canonical mark at 15px — on the desktop ledger, a hairline then separates Feats and Chords, right-aligned as paired icon + count chips (`[trophy] 6/23 · [hexagon] 4/11`) using the chips' existing marks. The phone strip carries resources only; Collection owns its feats and chords entries. Bonuses leave the ledger: they show inside the feats/chords sheets and in the rate details' Achievements/Discoveries legs (ADR-0037's one roster).
- **The pre-prestige telegraph slot is unconditional**: before the first Arete the ledger and strip carry a dim `— ◇` slot — the lock teaches that prestige will bank here.
- **One tabbed shop behind an explicit, labeled Catalog door** on the dock (desktop) and thumb bar (phone). The face switch reads `ν nous` / `◇ Arete` — never a second "Catalog" title, no duplicated balance inside. The door opens on **the mode's face** (mode wins — [#246](https://github.com/wvanderen/flowsynth/issues/246) supersedes the last-face memory), falling back to nous pre-prestige.
- **Fixed frame**: 620×600 clipped panel on desktop, 74%-height bottom sheet on phone; the face switch and identity stay pinned while the body scrolls — switching never resizes the frame.
- The shop appears at the **first banked Arete** (the prestige-count lock, unchanged engine behavior). Before Mutator entry the arete face is the single centered **Unlock Mutator Layer · 1 Arete** lock screen; purchase reveals Upgrades (the entry ACQUIRED with its rewards line, the Accelerator placeholder, Horizon break) and Unlocks (the roll-pool join with its "Will appear in future rolls" tooltip, the empty state after joining). Prices mute when unaffordable or in flow ("spent between sessions"). One feats surface per screen preserved (ADR-0030 unamended).
- **Phone**: the thumb bar holds five segments — Catalog / Forge / New cell / Inventory / **Collection**. Collection is the launcher absorbing the phone's feats and chords entries (rows with icon + count → their sheets, behind a "‹ Collection" back control). Its future scope — viewing all unlocked module and mutator types — is recorded, not built (Deferred work).

### Mode, controls, and trays ([#246](https://github.com/wvanderen/flowsynth/issues/246))

- **One upgrade-mode mode — Modules / Mutators — directs every surface**: the board tabs (presence outlines on Modules; slot faces, open slots, and unlock pulses on Mutators), **Add** (module mode arms the cell purchase; mutator mode arms the slot unlock — Arete slot unlocking lives in Add, not a tray bottom card), the **Catalog door** (opens on the mode's face), and the **tray's face**. The tray's MODULES/MUTATORS head and the board tabs are the same single switch; flipping either flips both — no independent tray peek.
- **Tray composition** (ADR-0027 amended): an always-open pinned column docked at the board's right edge in upgrade mode, dual-face under the head — category-hue module tiles and arete-register mutator tiles keep ADR-0027's minimal mark. The Inventory icon leaves the wide-surface dock (it reads Catalog / Forge / Add); the collapse toggle and the gesture-reopens rule retire. The board's bottom edge keeps the horizon bar and Upgrade All.
- **Armed actions**: Add arms like a cell purchase in both modes — one cost pill, pulsing targets (frontier hexes for cells; patch-adjacent cells for slot unlocks per ADR-0043's growth constraint, first slot free on the entry path). Placement is click-tile-then-cell/slot; occupied placement swaps. **Retrieval stays mode-bound**: right-click on the module board in module mode, on placed mutators in mutator mode — the presence outline never takes pointers, and no retrieve ever auto-switches the mode. Combining stays the drop-onto-twin gesture within a tray face.
- **Mode changes cancel armed actions** (cell arm, slot-unlock arm, tray placement) with a toast — the Esc walk stays Esc.
- **Pre-entry is locked-but-visible**: the MUTATORS tab and tray face wear a muted outline + ◇; clicking any of them (tab, tray face, or Add) opens the Catalog on the ◇ entry screen. No help paragraphs.
- **Phone**: the thumb bar stays five segments; Inventory opens the unified tray as a bottom sheet with the same toggle — the sheet's toggle flips the global mode, and arming from the thumb bar closes the sheet.

### The mutator entry sequence ([#247](https://github.com/wvanderen/flowsynth/issues/247))

- The entry purchase (1 Arete) now performs **one normal, unrigged Mutator roll** — its contents are *Mutator Grid activation + the Mutator Forge module (lands in the module tray, unchanged) + the free first slot + one performed roll*, generated at purchase by the normal two-candidate generator under the shared rarity table.
- The sequence is serial: purchase lands → the Arete sheet closes and the board flips to the Mutators layer (tray face follows) → **first-slot selection auto-arms from Add** (every owned cell pulses, the pill reads "free") → the moment the first slot lands, **the roll choice auto-opens in the existing Forge modal's mutator block** (no bespoke first-roll furniture) → choosing a candidate lands the mutator in the Mutator tray (the unchosen vanishes) and **auto-arms placement targeting the fresh slot**; Esc falls back to the tray.
- **Unrigged** — ADR-0043's "no first-roll rig" stands; a resonance- or charge-family first mutator is an accepted dud.
- **Cancellation**: Esc disarms the slot arm; closing the Forge modal banks the roll like any banked roll; the free first slot stays reachable through Add's normal arm. Nothing re-fires, nothing is lost.
- **Reload**: armed steps never persist; a reload mid-sequence lands on the standard surfaces — the banked roll waits in the Forge modal, the free slot via Add. The automation is not replayed after load.
- **Existing saves**: no retro-sequence, no retro roll — the new contents apply to purchases from now on; the forge-module backfill in `save.ts` stands unchanged. Zero owned cells is unreachable (the opening grant guarantees cells; prestige never removes them). Later charge-funded minting is untouched: 240 × 2ⁿ thresholds, shared queue, two candidates, silent banking.
- ADR-0040/0044 carry the amendment; the glossary's Mutator roll definition stretches (CONTEXT.md, done at spec assembly).

### The chord sheet ([#248](https://github.com/wvanderen/flowsynth/issues/248))

- **Composition — index beside a stage.** The index lists all eleven classes discovered-first as compact rows: mini glyph, name (undiscovered: dashes), live pip. Selecting a row puts that class on the stage: giant glyph, name large in condensed lettering, the bonus figure beside it, the active read, and the roots history. Discovered names lead.
- **Header**: `Chords (4/11) (+4% ν)` — the count with the discovery bonus parenthetical; no explanatory paragraph.
- **Phone**: the stage and index become rows — a compact stage row on top (small glyph at left, name, bonus, active, roots beside it), the index as a vertical list of full-width rows below, scrolling within the sheet.
- **Active read**: it counts standing instances — `4 active` — with the tooltip naming the classes ringing and stating that instances stack on their members. Per-class instance counts stay beside each discovered class (pip + `×n`).
- **Distinct-root history**: an inline mono figure (`5/12 roots`) in the tooltip layer, at every width. The circle-of-fifths ring is not taken; the hairline bar is retired.
- **Undiscovered glyphs**: solid, dimmed, hueless voice hexes with the dashed wire gaps kept as the spacer path and the sealing ring absent — no name, labels, or bonus. This replaces the overlapping dashed conventions and separates modules from spacers at a glance.
- **Active marker**: a pulsing pip in the class's hue beside the instance count; the dot stays static under reduced motion, so the state survives without animation.
- **Local semantics preserved**: the bonus reads `×1.75` with its tooltip carrying the only mechanics — each standing instance multiplies its member oscillators' output, instances stacking. No "while it sings," no board-wide claim (ADR-0036 stands).

### The console restructure and focus surfaces ([#249](https://github.com/wvanderen/flowsynth/issues/249), [#255](https://github.com/wvanderen/flowsynth/issues/255), ADR-0050)

- **Base presentation — the ruled folio** for every remaining surface: clipped plate, hairline-rule rows, names lead, figures right-aligned mono, deeper mechanics in the tooltip layer, no expandable detail sections.
- **The focus banner and Focus control sheet** follow ADR-0050: banner reads live during flow; the sheet's PLAN/HABIT/GOALS/HISTORY faces with the flow-mode rule (read live, capture freely, mutate nothing); add/log as on-demand action-button forms with rename/archive in the detail head; the banner's edge states (open-ended instant-start fallback, zero habits, completed-goal overflow with `+N`); the phone banner as bare launchers (clock, switch, focus, Notes, Settings); the dev console's ⠿ drag handle (pointer-capture grip, clamped to the stage).
- **Notes sheet**: tabbed CAPTURE | LOGGED in the Focus frame (560px), opening on CAPTURE; the live `· PIANO` tag chip rides the composer during flow (upgrade-mode notes untagged); stream rows lead with the mono stamp and habit chip; the Note Generator mechanic stays in the tooltip layer.
- **Session summary**: a `148 ν` headline over ruled readout rows — practice, rate (the breakdown as the RATE row's tooltip), rolls, unlocks with a NEW mark; honesty events as neutral factual lines; reflection unchanged; Continue.
- **Honesty report**: the readout leads (`22 min away · past your plan`, `150 ν held`); "Nothing already banked is taken back." stays visible; choices are full-width rows with mono consequence lines; understandable without tooltips.
- **Settings**: a session-start preference controls enter confirmation; with confirmation off, the main switch starts flow instantly using the last plan and active habit, falling back to an open-ended plan when none has been set and allowing an unstructured session when no habit is selected. With confirmation on, the Focus sheet opens on PLAN for the ready readout, habit selection (including unstructured), planned target, and Enter flow control. Eyebrow/title duplication dropped; the mute row's scope moves to a tooltip; "saves automatically on this device" stays as the one quiet line; reset wears the switch color.
- **Prose cuts confirmed**: Time's flow-mode paragraph, "Manual logs never produce nous or charge." (now a tooltip), the goals explainer, and empty-state furniture.

## Persistence and migration

Agreed on [#265](https://github.com/wvanderen/flowsynth/issues/265): **no save version bump — `SAVE_VERSION` stays 8.** Nothing in this iteration adds, removes, or reinterprets a persisted key, so the gate (v8 loads, v7 migrates, older rejects) and the lenient-default reads stand untouched.

- **Retired surfaces are all unsaved furniture.** The console tiles and popovers, the Inventory dock icon, the phone launcher, the tray collapse state, the catalog door's last-face memory (retired by mode-wins), and every armed action live in `UiState`, which is never saved. The `pendingGap`/`chargeWindow` delete precedent has no new tenants.
- **FocusApp ids and `activatedApps` keep their meaning** (`habit` / `time` / `notes` / `goals`) through the console restructure; the restructure is presentational.
- **Milestone feats need no migration**: definitions live in code; the ledger is the existing `id → unlockedAt` map. Already-satisfied milestones grant silently through an **eager achievement sync at resume** — `unlockedAt` stamps then, no toast, no "unlocked this session" row; the session-one guard stands.
- **The entry's new contents are forward-only** (#247): existing `catalogEntryOwned` saves get no retro-sequence and no retro roll; the forge-module backfill stands.
- **Banner edge states derive from existing state** — a fresh save's open-ended fallback is `plannedTarget: null`; no new key.
- **The chord sheet renders from persisted `chordDiscovery`**, unchanged.

## Acceptance criteria

Global — every surface passes the instrument standards' review criteria ([#243](https://github.com/wvanderen/flowsynth/issues/243)):

- Identity, actionable state, effect, and cost are understandable at a glance; every visible element has a purpose; module/category/resource semantics stay intact.
- Readable text, visible keyboard focus, adequate touch targets, non-color state distinctions, reduced-motion survival.
- Desktop and phone compositions are both composed — never a degraded afterthought.
- No paragraph explains behavior that controls or visuals show; tooltip mechanics reachable by hover, keyboard, and touch, dismissible, with critical state visible without them.
- Detector output alone is not validation; browser evidence per `docs/agents/visual-evidence.md` rides each wave.

Per-contract assertions (each traced to its ticket):

- **Standards**: no rounded-card furniture or nested boxes on reworked surfaces; state readable without color; glow/motion only on charge and live activity.
- **Feats**: five milestone rows present in their own first group with unique icons; a pre-existing save's satisfied milestones appear (count `N/23`) after load with no toast and no summary row; an un-crossed milestone reads muted with its effect visible.
- **Ledger/catalog**: no session read on the ledger; grouped `ν · ν/s · ◇` reads with the 15px arete mark; the `— ◇` slot before first prestige; the door opens on the mode's face with the nous fallback; tab switching never resizes the fixed frame; the entry lock screen covers the shop pre-purchase and reveals Upgrades/Unlocks after; paired feats/chords chips appear on the desktop ledger only; the phone strip has no feats/chords chips, with Collection providing their sole phone entry on the five-segment thumb bar.
- **Mode/trays**: one switch flips board tabs, tray face, Add arming, and the catalog door together; a mode change cancels armed actions with a toast; retrieval never auto-switches the mode; pre-entry MUTATORS controls open the ◇ entry screen; the dock reads Catalog / Forge / Add.
- **Entry sequence**: purchase lands on the Mutators layer with the free slot auto-armed; the slot landing auto-opens the Forge modal's roll choice; the chosen mutator auto-arms placement; Esc/reload fall back to standard surfaces with nothing re-fired; an existing save that already owns the entry boots to standard surfaces with no roll performed.
- **Chord sheet**: undiscovered classes render as solid dimmed hueless silhouettes, ring absent, no name; the header reads `Chords (4/11) (+4% ν)`; the active read counts standing instances; roots history is the inline tooltip figure; the pulsing pip is static under reduced motion.
- **Console**: the Settings session-start preference selects confirmation through PLAN or instant flow using the last plan and active habit; instant-start with no prior plan is open-ended, and zero habits never blocks entry; banner reads go live in flow and mutate nothing; habit add/log/goal create-delete lock in flow; the phone banner shows bare launcher icons only; the drag handle moves the console clamped to the stage; the confirmed prose are absent.

## Deferred work

- **Collection's future scope** — viewing all unlocked module and mutator types in place (inputs in #245/#246/#249; the vessel and name are shipped in wave 2).
- **The larger Notes rework** — a future milestone; only the capture/browse launcher and sheet ship in wave 5.
- **The Arete Accelerator** — an inert placeholder; any purchase that changes yield would amend ADR-0042's contract and is out of scope.
- **Mutator-mint toasts** — parked by #247; belongs to secondary-surface work if wanted at all.
- **Arrow-key nudging of the dev console** — an implementation nicety, not a blocker (#255).
- **Exact font choices** — implementation tuning under the standards' hierarchy (#243).

## Traceability

| Cluster | Tickets | ADRs | Prototype evidence |
|---|---|---|---|
| Instrument standards | #243 | — | `prototype/instrument-standards` (final 4988fb9); pinned in `docs/instrument-standards.md` |
| Milestone feats | #244 | ADR-0015 amended (spec assembly) | live grilling |
| Ledger/catalog | #245 | ADR-0030 preserved; ADR-0029, ADR-0037 carried | `prototype/ledger-catalog-navigation` (final 996d8a1) |
| Mode/trays | #246 | ADR-0027 amended (spec assembly); ADR-0043 stands | `prototype/tray-mode-unification` |
| Entry sequence | #247 | ADR-0040/0044 amended (spec assembly); ADR-0043 stands | live grilling |
| Chord sheet | #248 | ADR-0036 preserved | `prototype/chord-sheet-248` (final 2d36644) |
| Console/focus surfaces | #249, #255 | ADR-0050 created; ADR-0033 amended; ADR-0028 keeps clock/switch | `prototype/focus-surfaces` (9342e07…85e95de) |
| Spec assembly | #265 | — | this document |

CONTEXT.md amendments landed at spec assembly: the Achievement entry (feat vocabulary, storage wording), the Mutator roll and Mutator tree entries (the entry performs the first roll). Surface-entry rewrites (catalog door, console, tray, ledger, chord sheet) land with their implementation waves. Numerical balance is provisional tuning throughout; this iteration invents none.
