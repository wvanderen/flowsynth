# FlowSynth board redesign spec

The carrierless harmonic board, direct manipulation, board-owned production, and responsive play — assembled for implementation.

**Status**: produced by the playtest-driven board redesign map ([issue #116](https://github.com/wvanderen/flowsynth/issues/116)); every decision below was validated by a playable prototype and is final for this effort, traceable to its deciding ticket. Exact numbers are **provisional tuning** unless a source says otherwise. Companion records: ADR-0021…0023 (supersessions) and the rewritten `CONTEXT.md` (glossary). Where this spec and an ADR disagree, the ADR wins; where both are silent, consult the linked ticket.

**Precedence over the older specs**: this document supersedes the [redesign spec](redesign-spec.md) for every board-facing system — board geometry and pitch, chords, the module roster, the economy, interaction, chord feedback, console anatomy, responsive composition, the opening, persistence, and vocabulary — and supersedes the [focus-tool spec](focus-tool-spec.md)'s opening beat-sheet (its §6) only where the opening learning arc below replaces a beat; the trust model, session accounting, history, and reflection stand untouched. Still in force from the older specs: the number display scheme (redesign spec §7), the achievements framework and launch set (redesign spec §6.3), the Rack visual identity (redesign spec §8, minus its Carrier clauses), the board/console boundary rule and the four focus apps (redesign spec §2.3 via the focus-tool spec), and the charge-reserve and console-refinement provisions of ADR-0018 that this redesign does not touch.

**The success test** this redesign was played against: in the opening minutes, a player can place a few synthesizers, discover or intentionally form a basic chord, perceive its effect, and rearrange the board — without understanding a Carrier, harmonic distance, or a separate chord-management view.

---

## 1. Baseline: what the playtest invalidated

The shipped board (redesign spec §2–§5, ADR-0013/0014) opened on a Carrier-centered distance field: a pinned origin module set every cell's pitch as hex distance + 1, chords were consecutive pitch runs, and hands-on playtesting showed new players had to learn that spatial-origin metaphor before their first chord. The playtests also surfaced [two independent focus-control defects](https://github.com/wvanderen/flowsynth/issues/115), tracked outside this map ([Planned time stops updating after repeated changes](https://github.com/wvanderen/flowsynth/issues/114)).

## 2. The board: a carrierless octave-stack lattice

*Decided by [Harmonic board geometry, #117](https://github.com/wvanderen/flowsynth/issues/117) and [Isomorphic layout choice, #126](https://github.com/wvanderen/flowsynth/issues/126) via the board-geometry and isomorphic-layout prototypes; recorded in ADR-0021.*

- **Pitch lives in the cell.** The board is an isomorphic lattice — the **octave-stack** layout, Wicki–Hayden kin — rendered in **12-TET**: every cell is an absolute note, each note appearing exactly once per octave row. Columns read as one note name; the horizontal axis walks the circle of fifths; octaves stack along one direction as playable vertical shapes. The fundamental is nothing: no origin, no Carrier, nothing to learn before the first chord.
- **Shape = chord, movable everywhere**: slide a shape, transpose its chord. Power chords and fourth shells are tight wedges; major and minor triads are deliberately *not* sequential-cell shapes (§3).
- **Exactness is de-prioritized, on the record.** Just intonation is not a requirement; the 5-limit Tonnetz and 7-limit lattices were prototyped and rejected ("exact musical correctness matters much less than playing around and making combinations"). "Key" is a reading of the columns, not a tuning. Chord feedback and sound must be perceptible, never exact.
- **The octave is playable** — vertical pairs, stacked wedges, registers as places. It is the economy's gatable axis (§4), the one shape the octave-folded boards lacked.
- **Module landscape**: synthesizer (Additive, Conditional), **spacer** (new, §3), generator (focus-keyed), infusor, Forge. The Carrier type is deleted. Hue and glyph for the spacer category are open design work.

## 3. Chords and the spacer

*Chord model decided with the geometry ([#117](https://github.com/wvanderen/flowsynth/issues/117), [#122](https://github.com/wvanderen/flowsynth/issues/122)); the spacer by [Spacer module, #130](https://github.com/wvanderen/flowsynth/issues/130) via the spacer prototype.*

- **Chords are register-free pitch sets**: a named chord (octave, fifth, major triad, and kin) is recognized by *pitch content* over a connected cluster of synthesizers — any voicing, any octave. Anonymous adjacency bonuses are gone: adjacency alone is chordless, matching what the board shows (§6).
- **The spacer is a wire**: a silent module occupying one cell that never sounds and never joins a pitch set, but conducts chord adjacency through chains of wired cells. Chords match by pitch content over the connected cluster, so bridged chords are pitch-set matches, not fixed shapes. Placement and movement follow the standard module language (§5); routing wire around existing modules is part of the puzzle.
- **The difficulty ladder is geometry**: on this lattice a ♭7 sits one wire cell out, m3/M6 two, M3/m6 three — harder chords literally cost more board and earn bigger multipliers (tiers: tuning). The ladder runs inverse to conservatoire intuition by design; typed-interval and fixed-gap spacers were prototyped and rejected.
- **Accepted risks**, revisited only if consolidation-stage playtesting trips on them: pitch-content matching can complete chords the player didn't intend, and shared wire merges clusters.

## 4. Production and cell economy

*Decided by [Production and cell economy, #122](https://github.com/wvanderen/flowsynth/issues/122) across two grilling rounds; the opening grant settled by [#123](https://github.com/wvanderen/flowsynth/issues/123); recorded in ADR-0022.*

```
rate      = (synths + infusor uplift) × Π chord terms × empowerment × achievementBoost
composite = (synths + infusor uplift) × Π chord terms
```

- **One unified synth leg**: every synthesizer shares one base rate scaled by `rarityPower^level`; the carrier/harmonics split dies. The infusor uplift stays its own named leg (ADR-0020's pattern). Formula chip and session-summary legs rename `carrier` + `harmonics` → `synths`. Charge empowerment and `achievementBoost` carry over unchanged.
- **Chord value**: named pitch-set chords only; doubled voices automatically form Octave instances that stack like any overlap (no suppression special case); disjoint same-chord clusters stack multiplicatively. The Conditional's bonus becomes +10% per chord instance it belongs to (constant: tuning). Bonus tiers track the spacer ladder's construction cost (tiers: tuning).
- **Cells gate registers, not depth**: the geometric purchase-count scaler stays, plus a **one-time row gate** — the first *purchase* into each new octave row pays a gate premium (escalating with row distance: tuning) on top of the cell price. Gates tax acquisition only: moving owned cells between rows is always free and never gated, and gate spend never advances the purchase scaler. Rows are finite, generous, symmetric around the start register (count: tuning); the fifths axis is ungated; height carries **no inherent per-row rate bonus**.
- **What expansion buys**: horizontal = new pitch classes = implicit chord-vocabulary access (no tech tree); vertical = registers, voicing freedom, gate-paced beats; area = simultaneous voices and multi-chord stacking.
- **Spacer economy**: forge-roll pool only — never the starter shelf; priced like a cheap synth, no upkeep. Real estate is the bill.

## 5. Direct manipulation: bloom, dragging, inventory

*Model decided by [Direct board interaction, #118](https://github.com/wvanderen/flowsynth/issues/118); the bloom's composition by [In-place module bloom, #127](https://github.com/wvanderen/flowsynth/issues/127); refinements adopted across all widths by [#121](https://github.com/wvanderen/flowsynth/issues/121).*

- **Selecting a module opens its expanded face**: the module's own hex lifts off the grid toward the camera (scale + rise + drop shadow; easing/duration: tuning), keeping the compact face's existing UI enlarged — glyph, level, short name, cell note — and adding only what the face doesn't say: the production contribution (ν/s) and the **Upgrade button with its benefit** (`Upgrade · +0.5 ν/s · 180 ν` shape). No repeated readouts; no Move or Return buttons.
- **Dragging is always live in upgrade mode.** No select-then-move, no Move command. Dropping onto an occupied cell **swaps immediately, without confirmation**; the target previews as occupied (amber) during drag, empty destinations as open (green).
- **Inventory stays on the board surface**: retrieve by dragging onto the inventory dock, place by clicking an inventory item then a cell (occupied placement swaps too). Right-clicking a module retrieves it by the same gesture. No management view exists.
- **Bloom rules, adopted everywhere**: a fixed-size regular hexagon (prototype 224×258: tuning), content centered; opens **only on click** — never for a drag or a drop, and a drop leaves it closed; **nests onto the selected module** (ADR-0024) — its center one module-radius above the module's center, both bottom corners resting on the module's upper edges, presenting below instead, mirrored onto the lower edges, only when the frame's top leaves no room (the toward-camera metaphor); pops only when it would actually enlarge the module — zoomed in past that, the affordances ride the closed face as a floating card (ADR-0024); closes on outside click or Esc; expansion caps to available width and clamps inside the board wrap; holding the face starts a live drag — the bloom collapses into the ghost. On portrait phone it presents as a bottom sheet (§7).
- **Dismissal restores scanability**: selection elsewhere, outside click, or Esc returns the compact face. There is no leftover chrome.

## 6. Chord feedback: always-on annotation

*Decided by [Chord feedback on the board, #120](https://github.com/wvanderen/flowsynth/issues/120) via the chord-feedback prototype ("A is clear winner"); supersedes issue #62's chord-view toggle.*

- **Formed**: every formed chord wears a colored **outline hull** and a **name chip** (`Octave ×1.15`; live ν/s contribution during a session), always visible — chords read at a glance with no chord view and no dock toggle.
- **Overlap**: hulls nest and chips stack, validated on seeded regions where a power chord contains its octave and fifth.
- **Possible**: while dragging or placing, would-form chords preview as **dashed ghost hulls** with name chips (one per forming chord). What breaks is expressed by what disappears, never previewed.
- **Selected**: the selected module's chords emphasize; other chords fade. The bloom adds no chord line — the hull is the callout.
- **Sounding**: in a flow session hulls pulse and chips carry live contribution; the board stays locked per the standing constraints.
- **Sound is opt-in garnish** — the drone plus a formation strum. Chord perception is visual-first; this effort carries no further sound-design work.

## 7. Console hierarchy and responsive composition

*Console hierarchy decided by [Console hierarchy, #119](https://github.com/wvanderen/flowsynth/issues/119) via the console-hierarchy prototype (variant E: "the E layout now looks good. We can accept this"); responsive composition by [Responsive composition, #121](https://github.com/wvanderen/flowsynth/issues/121) via the responsive prototype (B · Thumb dock for portrait phone, merged as PR #132).*

**Desktop and half-width — variant E, the board owns its production:**

- The **board ledger strip** docks directly above the board: Nous / Rate / Session as one bordered instrument, with the **feats chip** (`N/17`) beside it. The console's readout end — status strip, trophy, nous balance — is retired entirely.
- The **console slims to pure control**: main switch, clock, pause, app tiles. The clock is itself the plan affordance — clicking it opens the Time app; the Time popover no longer repeats the console's live session. Planning lives only in the Time app.
- The action row is a **left-edge icon dock**: Catalog / Forge (count badge + charge pip) / New cell. The canvas legend is gone (its encodings belong to the surfaces that use them); the Chords toggle is gone (§6); **Arrange is removed** — dragging is already live (§5).
- **The formula is disclosed only from the Rate cell**: on non-mobile it is ambient-but-collapsed — the Rate cell carries the operand chain ending in the live total, and that collapsed equation *is* the rate display (no separate ν/s figure). Below the 760px container breakpoint the equation hides, the bare total stands alone, and tapping Rate opens the full formula — equation plus value breakdown — as a modal sheet over a scrim.
- The **status monitor dissolves**. The Arete accumulator — rail, graduations, beat head, reserved prestige button — detaches and floats as a **translucent pill over the board's bottom edge**, half-width included. Forge progress keeps riding the dock's Forge pip.
- Half-width is a **fully featured first-class layout**: identical anatomy with in-place container compaction only. Nothing re-docks, nothing hides.

**Portrait phone — thumb dock:**

- The top nav holds **session controls only** (clock, pause, enter/exit — the clock stays the plan affordance).
- Production reads (ν, rate, session, feats) live in a **game-info strip** directly below the nav, on the board surface where the tutorial helptext used to sit.
- The console is a **bottom thumb bar**: Catalog / Forge / New cell / Inventory / Feats.
- The bloom presents as a **bottom sheet**; the zoom cluster rises above any open sheet so inspection never gets buried.

**Board navigation, everywhere**: the board pans by dragging outside the grid at any zoom (inside when zoomed in), clamped so a full or larger-than-screen board stays reachable; the zoom cluster (+/−/fit) plus wheel zoom remain.

**Deleted outright**: the idle tutorial helptext line, in every variant and width. Only armed-mode hints remain (placing, would-form, new-cell). A real tutorial exists only as the opening learning arc (§8) — there is no tutorial state machine.

## 8. The opening learning arc

*Decided by [Opening learning arc, #123](https://github.com/wvanderen/flowsynth/issues/123) via the opening-arc prototype (rev 2, "single-synth earned arc with the one pop-up hint", merged as PR #133); supersedes the older beat sheets (redesign spec §5, focus-tool spec §6) where they conflict.*

- **The player starts with exactly one synth**, pre-placed at C4 on the three-cell opening footprint (the old triangle's geometry retained; its Carrier rationale gone), plus a nous grant that makes the first upgrade affordable. The tray starts empty.
- **Everything else is earned through play.** Practice fills the forge (placeholder pacing ≈ 2 minutes); crossing the threshold offers the synth it made — the opening's first roll yields a synthesizer candidate (rigging: tuning); taking it puts the synth in the tray for placement. Upgrades and new cells are paid from banked nous. **No synth purchases exist outside the forge loop in the opening**; the starter shelf sells the generator, one infusor, and the Forge.
- **One earned pop-up, once, ever**: after the second synth is acquired, a single dismissible card — *place it beside your first; the dashed hull previews the chord it would form; the × is what the pair earns together*. The totally-silent alternative was built and played on the same branch and not chosen.
- **No goals, no steps, no ambient hints, no tutorial state machine.** The deleted idle helptext stays deleted.
- **Interaction facts the arc rides on**: pitch lives in the cell, so a swap of identical synths can never break a chord — the chord-breaking gesture is *drag off the board into the tray* (right-click retrieves by the same gesture, §5); the dashed would-form ghost (§6) is what makes the first placement intentional.
- Exact pacing numbers (forge fill, threshold, grant size) are tuning, not spec.

## 9. Persistence: v5 → v6, hybrid migration

*Decided by [Save and vocabulary migration, #124](https://github.com/wvanderen/flowsynth/issues/124) across two grilling rounds; recorded in ADR-0023.*

- `SAVE_VERSION` = 6. **V5 saves convert once inside `deserialize`** — a hybrid migration, not a clean cut: the life record carries over, the board resets to the new opening. Anything older than v5, and future versions, hard-rejects with the start-fresh message (ADR-0017's gate stands). Exported `.json` saves follow the same rule.
- **Preserved** (life record + lifetime meta): `habits`, `practiceLog`, `notes`, `goals`, `activeHabitId`, `sessionRecords`, `achievements`, `sessionsCompleted`, `unstructuredSessions`, `plannedSessionsCompleted`, `sessionIndex`, `combinations`, `muted`, `notificationAsked`, `activatedApps`, `goalCapacityBought`, `totalEarned`, `arete`, `horizonAcknowledged`. Preserved counters keep the `syncAchievements` session-one guard from re-firing — feats can unlock from the first post-migration session.
- **Reset to the new opening**: `modules` (Carrier row included), `cells`, `cellsBought`, `forge`, `bankedRolls`, `chargeWindow`, `purchased`, `welcomeAcked` (deleted by the loader), `session`, `summary`, `nextId`, and `nous` → the new opening grant. Rationale: balance was earned under the invalidated formula and scaler. `totalEarned`/`arete` persist as the Arete accumulator's lifetime truth.
- **Mid-flow boundary**: a v5 save captured in `flow` or `paused` discards the live session uncredited — landing in upgrade mode on the fresh board.
- **New persisted state**: `gatedRows: number[]` (lenient-default `[]`); the `"spacer"` module category (roll-pool only); the `synths` leg rename (infusor uplift stays its own leg); `"carrier"` dropped from `SynthesizerType`; pitch stays derived from coordinates, never persisted.

## 10. Retirement ledger

| Retired | Was | Now |
|---|---|---|
| Carrier | granted origin module; pinned, immovable, unsellable, white | deleted; pitch lives in cells (ADR-0021) |
| Pitch as distance | harmonic number = hex distance from Carrier + 1 | absolute pitch per cell on the octave-stack lattice |
| Chord pair | adjacency bonus per consecutive-pitch pair | pitch-set chords only; adjacency alone is chordless |
| JI named-chord vocabulary | octave 1:2, fifth 2:3, major 4:5:6, blues 5:6:7 as ring runs | register-free pitch-class sets, exactness de-prioritized |
| Amplitude-only duplicates | identical pitches never formed a chord | doubling forms an Octave instance, stacks (ADR-0022) |
| Cell depth gating | purchases deepened achievable pitch | octave-row gates; fifths ungated |
| Carrier grant, grant = first upgrade price | opening economy (ADR-0013) | one plain synth + a grant affording the first upgrade |
| Shelf-sold Additive Synth | chord play guaranteed before the first roll | synthesizers come only from the forge loop |
| Opening triangle as Carrier rationale | generator→Forge and Carrier-adjacent chord reach | three-cell footprint retained, re-rationaled by §8 |
| Status monitor | two-element rail under the board | dissolved; board ledger above (§7) + floating Arete pill |
| Console production readouts | status strip, trophy, nous balance on the console | the board ledger strip |
| Chords toggle | dock mode for chord display | always-on hulls and chips (§6) |
| Separate chord view | display-only highlight mode (#62) | always-on annotation |
| Move / Return commands | explicit move flow, bloom buttons | dragging always live; drop on inventory dock to return |
| Drag-onto-twin combine | dropping on an identical twin offered a merge | occupied drops swap, always — pitch lives in the cell; combine stays a panel button |
| Swap confirmation | confirm-or-preview on occupied drops | swap immediately; amber preview during drag |
| Arrange action | dock button | removed everywhere; dragging is the move |
| Canvas legend | encoding legend | encodings live on the surfaces that use them |
| Module panels as a separate upgrade surface | panel-based upgrades (ADR-0018) | the expanded face carries the Upgrade button |
| Idle tutorial helptext | ambient instruction line | deleted; opening arc + armed hints only |
| `welcomeAcked` | save flag for the Carrier's upgrade CTA | retired; deleted by the v6 loader |
| Formula legs `carrier` + `harmonics` | split breakdown legs | one `synths` leg (ADR-0022) |

## 11. Deferred and out of scope

**Deferred beyond this map** — the longer-term synthesizer vocabulary and progression possibilities that become visible only now that geometry and production are settled; whether the redesigned interaction language suggests broader changes to non-synthesizer module behavior (revisit once direct manipulation and responsive composition are proven in the real game).

**Out of scope** — exact production values, prices, pacing, and balance curves; new focus apps, prestige design, accounts, backend services, cross-device sync; broad new module-content design beyond what validates the board model and opening arc; fixing the two tracked focus-control defects (#114, #115).

## 12. Handoff notes for implementation sessions

- **Read order**: this spec → ADR-0021…0023 → the linked tickets for any section's rationale → the rewritten `CONTEXT.md` for vocabulary → redesign spec §6.3/§7/§8 and the focus-tool spec for what still stands → `research/implementation-survey.md` §7 for the coupled-code map.
- **Suggested sequencing** (one vertical at a time, engine-first): (1) lattice, pitch, chord analysis, spacer, formula legs, row-gate economy, and the v6 save with its hybrid migration (ADR-0021/0022/0023); (2) the opening learning arc and forge pacing (§8); (3) direct manipulation — expanded face, always-live dragging, inventory dock (§5); (4) chord feedback — hulls, chips, ghosts (§6); (5) console and responsive anatomy — ledger strip, icon dock, Rate-cell disclosure, Arete pill, thumb dock (§7). Each step lands with its test suite reworked; the existing engine tests are the baseline to consciously retire or port.
- **Tuning fronts** (numbers, not spec): cell prices and the purchase scaler; gate premiums and row count; chord bonus tiers and the Conditional constant; forge fill pacing and threshold; the opening grant; spacer prices; bloom size and easing; the 760px disclosure breakpoint; achievement #11's thresholds.
- **Open design work**: hue and glyph for the spacer category.
- **Prototype assets** (throwaway, branches/PRs): `prototype/board-geometry`, `prototype/direct-board-interaction`, `prototype/isomorphic-layout-126`, `prototype/module-bloom-127`, `prototype/spacer-module-130`, `prototype/chord-feedback-120`, `prototype/console-hierarchy-119`, PR #132 (responsive, merged), PR #133 (opening arc, merged) — reference for intent, not code to keep.
