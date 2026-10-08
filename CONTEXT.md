# FlowSynth

FlowSynth is an incremental game in which real-life practices drive a configurable hex board of modules — the board is the optimization game, and a console carries the focus tools.

## Language

### The board

**Board**:
The hex grid of modules where all nous production and charge production happen; sessions run it automatically. The board may read focus state as inputs to module effects, but no console resource ever crosses onto it.

**Cell**:
One hexagonal place on the board. Cells are bought with nous on a geometric scaler over total cells bought, then placed and reshaped in upgrade mode on a connected board.

**Module**:
A unit occupying one cell on the board, with gameplay effects derived from its category and, in many cases, a connection to a real-life practice or supporting interaction.

**Module category**:
The function level of a board module — oscillator, spacer, generator, booster, or forge at launch; the silent-voice and charge-conduit categories (working names, confirmed) joined with the roster iteration, and the habit-keyed ritual category — RITUAL, its one member — joins with the builds iteration. Categories take their display words from their modules (issue #219): the former synthesizer category is the oscillator category, the former infusor the booster category. Category carries the module's hue.

**Module type**:
A specific module design within a category, such as the Oscillator or the Focus Generator, carrying its own glyph and nameplate. Forge choices contain distinct module types; different types may share the same category.

**Chargeable module**:
A supertype family above the category level whose members accumulate received charge toward thresholds that produce effects; the threshold fill is the family's shared rendering trait. The Module Forge is the launch instance. Continuous-charge categories (oscillator, booster) use received charge as continuous empowerment instead.

**Pitch**:
The absolute note a cell sounds — a property of the cell's position on the octave-stack lattice, derived from its coordinates and never persisted. No module ever rewrites a cell's pitch; pitch modifiers sound derived pitches on their own voice only. Columns read as one note name; the horizontal axis walks the circle of fifths.
_Avoid_: harmonic number, distance-from-origin

**Chord**:
A named pitch set — octave, fifth, major triad, and kin — recognized by pitch content over a connected cluster of voices — oscillators and silent voices, register-free: any voicing, any octave. Each chord instance multiplies only its member oscillators; overlapping and repeated instances stack multiplicatively on their members, and distant modules are unchanged (ADR-0036). Adjacency alone is chordless.
_Avoid_: Named chord (the just-intonation-run sense), Chord pair

**Seam**:
The chord-colored line the board draws for a formed chord: center-to-center between a two-voice chord's adjacent voices; a chord the seams can't carry — three or more voices, or a spacer-bridged pair — draws its offset outline instead — a closed polygon behind the modules, edges riding the gaps between faces, corners just poking past. Always on, in every mode.
_Avoid_: Chord link, Pair link, Hull

**Chord readout**:
The reserved spot beside the board — the heading's right end — where a hovered module's row stands: its final ν/s first — live during flow, present with no chord at all — then the names and multipliers of every chord it earns its bonus from. No board-wide +ν/s claims on any chord surface (ADR-0036). Hovering a seam or a module asks; the module's own facts live in its Hex detail (issue #295). While a placement gesture hovers a valid target, the placement preview owns the spot (ADR-0054). One spot, never floating over the board.
_Avoid_: Chord chip (the ambient-floating sense), Chord view

**Harmonic capacity**:
The whole-chord budget every voice owns — silent voices included, uniform across the board, one through five on the development board. An active chord instance consumes one unit on every participating voice; no partial chord earns anything and no budget is exceeded. Development slice (ADR-0051, issue #257): the economy ladders — Catalog purchases, Arete ceilings, the prestige reset — are decided but not yet shipped.

**Allocation**:
The automatic selection of which recognized chord instances activate: it maximizes the summed final ν/s of the board's oscillators — charge, boosters, resonance, active build factors and silent-voice uplift included — with the empty allocation available whenever activating would reduce production. Equal-output allocations retain the previous active set, then fall back to a stable order. An unallocated voice keeps exactly ×1; the formation's quality multiplies only participants.
_Avoid_: Manual chord assignment

**Certified allocation**:
The allocator's honesty flag: the exact search completed within its budget, so the chosen allocation is proven optimal — never presumed. A budget that trips reports an incumbent and says so; candidates are never truncated and a heuristic is never silently substituted (ADR-0051).
_Avoid_: Heuristic allocation (as a silent substitute)

**Spacer**:
A silent wire module occupying one cell: it never sounds and never joins a pitch set, but conducts chord adjacency through chains of wired cells. Reaches the board only through module rolls.

**Silent voice**:
A silent pitched module of its own category: it produces no nous, but its pitch counts in clusters — it forms and completes chords and conducts them as a voice — and every chord instance it sings in gains a level-scaled bonus uplift landing on all singing members, stacking additively across silent voices. Confirmed working name (issue #219); its members are the Harmonizer, the Echo, and the Bend.
_Avoid_: Harmonizer (for the whole category)

**Harmonizer**:
The plain silent voice: it sings its own cell's pitch. Replaces the Conditional in place, retiring its per-instance chord-bonus mechanic.
_Avoid_: Conditional

**Echo**:
A silent voice singing an adjacent voice's pitch one octave down — a guaranteed Octave pairing that doubles the neighbor's chord content without touching its pitch or readout. Final name (issue #219; the Sub Bass direction).
_Avoid_: Sub Bass, Mirror voice (the working name)

**Bend**:
A silent voice singing its own pitch altered by a player-picked small interval — the ♯/♭ family, ±1 at launch; its selectable shift set grows with rarity, while level scales its uplift like every silent voice. Final name (issue #219; the Accidental direction, with FM folded in).
_Avoid_: Accidental, FM (a separate module), Shift voice (the working name)

**Charge conduit**:
A silent category of the charge economy whose members neither produce charge nor sing: they route received charge onward. Its launch member is the Amplifier. Working name.
_Avoid_: relay

**Amplifier**:
A charge conduit that re-broadcasts received charge to its other neighbors at received strength × a level-scaled gain; relayed charge counts fully as receiving charge everywhere, and a hop-depth cap guards cycles. It is not a generator and produces nothing.

**Octave row**:
One register of the board: the band of cells whose pitches sit in the same octave, stacked as a vertical shape.

**Start register**:
The octave row the opening board begins on; rows are finite, generous, and symmetric around it.

**Row gate**:
The one-time premium paid on the first purchase into each new octave row. It taxes acquisition only — moving owned cells between rows is free — and does not advance the cell purchase scaler.

**Expanded face**:
Retired vocabulary — the module bloom's face, superseded by the **Hex detail** (issue #295): the module's editing surface is the detail's Modules face now, and the only expanded presentation left is the detail tile.
_Avoid_: bloom, pop-up

**Hex detail**:
An owned board coordinate's full-stack cross-section, opened by any owned cell's idle click (issue #295) — the module bloom's successor. It stands where the grid stood, at every width, showing the fixed layer stack at that one cell: the Mutators face above the Modules face, both visible, never reordered. Each face reads name + state + concrete effect with its action costs; editing belongs to upgrade mode, and during flow the same cross-section opens read-only with live readouts. An explicit Return control and Escape give the grid back with its layer, position, and zoom intact; another Hex requires returning first.
_Avoid_: pop-up, modal, inspector, bloom

**Layer legend**:
The vertical strip of layer symbols at the board's left edge (issue #295) — the one Modules / Mutators switch, shared by the grid and the Hex detail: on the grid it flips the layer, in the detail it emphasizes the face, and it synchronizes with both. The selected face wears the firm inset marker; pre-entry the Mutators symbol stands locked-but-visible, its click walking to the Catalog's entry screen. Upgrade-mode furniture: flow shows neither legend nor layer.
_Avoid_: tabs, second switch

**Tray**:
The board-surface inventory as an always-open pinned column docked at the board's right edge in upgrade mode, dual-face under the layer legend's Modules/Mutators switch — the one switch, which the column carries no copy of (issue #272, the legend by issue #295). The Modules face holds the inventory: drag a module off the board into it to retrieve — the chord-breaking gesture, shared with right-click retrieve — and click an item then a cell to place; occupied placement swaps. The Mutators face is the Mutator tray (its own entry). Tiles wear the minimal mark: a hexagon outlined in the module's category hue, or the arete register for mutators, with the glyph alone — the full face belonging to the board and the expanded face (ADR-0027). Flow locks the board and hides the column with it; on portrait phone the column unfolds and the thumb bar's Inventory segment taps the same tray open as a scrimless dual-face sheet — the board behind stays live; the switch rides the sheet there, its tiles keep the gestures at one size, and a live drag carries between board and sheet both ways. There is no management view and no collapse.
_Avoid_: inventory panel, management view, collapsible tray, second switch

**Mutator Grid**:
The board lattice's second layer, mirroring it position for position, present only while activated by the Mutator tree's entry purchase. Each cell owns one Mutator slot; modules move freely across the board while slots stay put.
_Avoid_: enhancement grid, second board

**Mutator slot**:
One cell's place on the Mutator Grid — the cell's second face. Holds at most one mutator and modifies whatever module occupies the cell; vacant, it is inert. Slots unlock one at a time in upgrade mode and persist through prestige.
_Avoid_: socket, gem slot

**Mutator**:
An item of the Mutator Grid: typed, carrying rarity, sitting in a Mutator slot to modify its host module's corresponding term — power (the host's power), resonance (the host's chord factor, inert on a chordless host), charge (the strength the host receives). Two mutators of the same family and rarity combine into one of the next rarity. Retrieved and placed like modules, through the Mutator tray; placed mutators and the tray persist through prestige.
_Avoid_: enhancement (the pre-design name), gem, affix

**Mutator tray**:
The Mutator Grid's inventory — the tray column's Mutators face, switched by the layer legend: minted mutators wait here, a click then a slot places, and a drag or right-click retrieves. Pre-entry the face is locked-but-visible — a muted outline and the lock mark — and clicking it (tab, tray face, or Add) opens the Catalog on the entry screen as a preview of the future entry; it never flips the mode. On portrait phone the tray sheet's Mutators face carries the same tiles; no always-on strip stands there.
_Avoid_: second inventory, unlock card

### Resources and production

**Nous**:
The provisional name for the game's main progression resource, spent on permanent upgrades. It is produced only by the board formula.

**Nous production rate**:
The single final nous-per-second output: the sum of the oscillators' final figures — `(synths + boosters) × empowerment × achievementBoost`. Modules contribute terms to this shared rate rather than producing independent timed payouts.

**Final ν/s**:
One module's own production figure: its base term with its local booster, chord, charge, and achievement effects all included (ADR-0036). The displayed figures sum to the board's rate within rounding, a hovered module's final ν/s leads the reserved readout (the Hex detail's face carries it too, issue #295), and every oscillator's row in the rate details leads with it (ADR-0037).

**Composite**:
The board's summed uncharged amplitude: the synths leg plus the booster uplift, each carrying its members' local chord factors (ADR-0036). There is no board-wide chord multiplier over it.

**Formation quality**:
The connected formation's symbolic quality factor Q — one per formation, riding inside every producing member's chord factor beside the named-instance product (ADR-0036, ADR-0049). Scored over the formation's deduplicated pitch classes: `Q = clamp(1 + complexity − max(0, tension − A), Qmin, cap)` — pair-based tension by interval class, a per-class complexity offset, a tension allowance A forgiven to named formations, and a floor materially below neutral so chromatic density is priced down; chordless formations sit at exactly ×1.00. Read aloud as its own named term ("Formation ×1.12"). Production magnitudes — semitone 1.0 / tritone 0.5 / whole tone 0.2 tension, 0.06 complexity rate, A 0.70, Q ∈ [0.05, 1.25] — are provisional production tuning. The capacity allocator scores its own curve — its own magnitudes over the adopted Q ∈ [0.5, 1.5] range (ADR-0051, ADR-0054) — measuring every singing voice in the formation, inactive-chord voices included, while only active participants apply the term; an unallocated voice applies exactly ×1 (ADR-0054 splits the measured read from the applied one).
_Avoid_: harmony score, chord quality (the discovery-library sense)

**Placement preview**:
The transient projection a placement gesture paints while a valid target hovers — a drag over a cell, an armed placement's hover, a touch slide, or the tray under a carried module (the retrieval). The reserved readout carries it: the board's rate delta said outright, the moved voice's resulting rows in the selected row's own grammar — final ν/s, capacity, total chord factor, the applied Formation term on the quality scale, the chord chips — all from the one authoritative allocation and economy pass that commits the drop, discovery legs included, so a committed placement always agrees with what it previewed (ADR-0054). Cancel restores the standing row; the placed voice's selected row retains the previewed figures. The would-form ghosts classify by the same projection: a promise the capacity cannot afford says idle.
_Avoid_: placement tooltip, what-if mode

**Synth term**:
An oscillator's base contribution to the composite — level and rarity power, with the oscillator's own chord factor in (ADR-0036); one unified leg shared by every oscillator. The booster uplift rides in its own leg beside it. The leg keeps the historical "synth" name (ADR-0014).

**Oscillator**:
An oscillator-category board module contributing a synth term to the composite; no oscillator is spatially privileged. It is empowered while receiving charge and never produces charge. Renamed from Synthesizer with issue #219; the category follows the module.
_Avoid_: Synthesizer, Additive Synthesizer

**Blaster**:
An oscillator-category voice converting received charge into its synth term — the category's second producer role. It sings and forms chords even uncharged at zero output, takes chord factors and booster uplift, and takes no second charged-empowerment pass: the conversion curve replaces the charge factor.
_Avoid_: converter

**Charge**:
A habit-independent resource produced by generators that empowers or charges other modules; its state is preserved between flow sessions.

**Generator**:
A board module that produces charge. Remaining output belongs to the generator and follows it when moved; a console fact credits every owned generator of the matching type, board or tray. The Focus Generator is the launch generator (ADR-0018 retired the plain generator pre-release); the Note Generator and Goal Generator joined with the reserve iteration, reading the console's notes and goals through the board seam (ADR-0047).

**Charge window**:
A Focus Generator's charge budget, banked at session end into each owned Focus Generator, sized as a fraction of that session's credited practice time and spent as output during the next session's first minutes. Manual practice logs never create one.

**Note pool**:
A Note Generator's reserve, credited the moment a note is written — in flow or between sessions, tagged or not — sized linearly by the note's character count up to a per-note cap. Notes are append-only; a deleted note, if one ever can be, refunds nothing.

**Goal reserve**:
A Goal Generator's reserve, credited at a goal's completion: a multiple of the charge window the goal's practice duration would have banked, prorated by the live share of the goal's progress. Recurring goals credit once per occurrence; overlapping completions each credit.

**Output strength**:
The rate at which a generator delivers charge to each eligible adjacent module, without dividing output among neighbors. Strengths from simultaneously active generators add at each receiver.

**Remaining duration**:
The amount of live flow time for which a generator's output remains available; simultaneously active generators each use their own duration.

**Charged empowerment**:
An increase to a module's specified effect while receiving charge, increasing with received strength with diminishing returns. Its numerical curve remains to be balanced.

**Booster**:
A board module that improves a specified effect of eligible adjacent modules, with its bonus strengthened while receiving charge. Renamed from Infusor with issue #219 — rename-only; the uplift role is unchanged.
_Avoid_: Infusor, Infuser

**Booster term**:
A Booster's contribution to the composite: the local uplift it grants adjacent oscillators' amplitudes, named as its own additive leg in the live rate breakdown (ADR-0020).
_Avoid_: Infusor term

### Quality and acquisition

**Module upgrade**:
A purchased increase to a module's core power, paid for with nous in upgrade mode.

**Bulk upgrade**:
The shared +1 / +5 / +10 / MAX ladder over a module's level prices, purchasable from three upgrade-mode-only surfaces: the face button on each closed levelable face (click buys +1; shift flips every face button board-wide to MAX and a shift-click buys every affordable level), the Upgrade All cluster docked at the board's lower edge (the board-wide sweep; the tray modules' only bulk path), and the expanded face's dial (×1 / ×5 / ×10 / MAX·k with live total cost and k-level benefit). Partial by design: no control disables — a purchase buys what the bank covers and the toast reports what landed. Spacers are excluded everywhere (ADR-0045).
_Avoid_: buy max, upgrade all button (as the only surface)

**Rarity**:
A module quality shown as an engraved ring count and plate tint; it improves how purchased levels scale and strengthens secondary effects, rather than granting free levels.

**Combination**:
The consumption of two modules of the same type and rarity to produce one of the next rarity, retaining the higher input level and refunding the lower-level input's nous upgrade expenditure. It is initiated by dropping one copy onto the other (board or tray, either direction) and confirming the reviewed outcome; the result lands where the drop target was. The player chooses one input's secondary effects to retain with the new rarity's improvements. Mutators combine by the same gesture: two of the same family and rarity yield one mutator of the next rarity — mutators carry no levels, so nothing is retained or refunded.

**Forge**:
A chargeable module that accumulates received charge toward thresholds that mint rolls. The family splits in two — the Module Forge mints module rolls, the Mutator Forge mints mutator rolls.

**Module Forge**:
The launch Forge: the chargeable module whose thresholds mint module rolls. Its shared progress meter and banked rolls are the originals.

**Mutator Forge**:
The chargeable module whose thresholds mint mutator rolls into the Mutator tray. Catalog-exclusive until the Mutator tree's roll-pool purchase joins it; its branch keeps its own shared progress meter across deployed Mutator Forges.

**Forge progress**:
A branch's player-wide meter to which that branch's deployed Forges contribute according to received charge and progress efficiency — the Module Forge's and the Mutator Forge's meters are separate. Crossing a branch's globally scaling threshold banks a roll on that branch and carries excess progress forward, independently of any individual Forge's identity.

**RITUAL**:
A chargeable board module that amplifies the active habit's build effects while receiving charge; charge never crosses to the console, and the habit keys the module's behavior. Named and designed by issue #219 — the habit-cycle ring glyph in the switch vermillion; it arrives through the module-roll pool only.

**Module roll**:
A charge- or flow-earned choice of one module from three generated candidates; unchosen candidates disappear without consolation resources. The Forge branches and the flow meter bank into one shared queue of interchangeable rolls.
_Avoid_: forge roll (the pre-split name)

**Flow meter**:
The player-wide meter that fills with credited practice time — present and trusted time as it runs, honesty-credited provisional minutes at reconciliation — and banks a module roll each time it crosses its fixed cadence: a one-time fast opening fill, then flat forever, never scaling. The Forge branches' shared thresholds receive no practice contribution; the flow meter is a sibling of Forge progress, not a branch of the Forge family. Its fill and earned count persist through prestige. The dock's Forge pip shows its fill.
_Avoid_: practice meter, practice forge, flow forge, third branch

**Mutator roll**:
A choice of one mutator from two generated candidates, delivered to the Mutator tray; unchosen candidates disappear without consolation resources. Every roll is charge-earned except the first, which the Mutator tree's entry purchase itself performs.

**Catalog**:
The tabbed shop behind the labeled Catalog door on the dock (desktop) and thumb bar (phone): the `ν nous` face carries the starter shelf and — once the ladder has a tenant — app activations; the `◇ Arete` face is the Arete Catalog. Cells are no sheet row — the purchase arms from the dock's Add and commits on the board's frontier. The door opens on the mode's face — module mode on ν, mutator mode on ◇ — the mode wins over any last-face memory. The ◇ tab stands open from the start; before the first prestige it shows the entry purchase screen as the preview of the future entry, its price muted while no banked Arete can pay. The frame is fixed — a 620×600 clipped panel on desktop, a 74%-height bottom sheet on phone — and a face switch never resizes it: the switch and identity stay pinned while the body scrolls. Purchases act in upgrade mode only; prices mute when unaffordable or in flow. Module upgrades live on module panels, not the catalog (ADR-0018).

**Starter shelf**:
The catalog's one-time guaranteed offers — the Focus Generator, one Booster, and a Module Forge — hidden once acquired. It completes the non-oscillator landscape; oscillators come only from the opening grant and module rolls (ADR-0022).

### The console and focus apps

**Console**:
The pure control surface organized around the Enter/Exit main switch — the dominant, centered session gate, with the clock beside it and Settings at the far right. The main switch is the mode indicator — off, glowing live, held paused — and the clock is itself the plan affordance: a small disclosure chevron on it opens the Time app, which wears no tile (Habit, Notes, and Goals carry the console's consistently sized icon-only tiles; on portrait phone a compact launcher stands in their place and opens the same three apps from one control, its entries wearing the selected habit and the tracker's goals state — ADR-0033). While a session runs, a thin progress strip along the console's bottom edge shows its progress in the switch's vermillion — filling on planned sessions, pulsing on open-ended ones, held while paused. The board never moves or dims while the console is in use.

**Board ledger**:
One clipped instrument panel docked above the board — the board owns its production numbers. The resources group left: nous, rate, and the arete read, each value with its unit, no session read anywhere on it. The arete read wears the resource's color and its canonical mark; before the first prestige it stands as a dim `— ◇` slot — the unconditional telegraph that prestige will bank there. A hairline then separates the feats and chords chips, right-aligned as paired icon + count chips. The rate read is the door to the rate details: above the 760px breakpoint a hover or focus anywhere on the panel opens the module-linked roster as a ledger-wide popover (the rate read wears no inner border of its own — the panel is the affordance, not the figure); a tap on the rate read opens the same roster as a modal sheet at every width. (On portrait phone the door moves to the game-info strip's rate read.) Bonuses never ride the ledger — they show in the feats and chords sheets and in the rate details' Achievements and Discoveries legs (ADR-0037's one roster).

**Thumb bar**:
The console's re-docked form on portrait phone — a bottom bar of five segments: Catalog / Forge / Add / Inventory / **Collection**. The icon dock, the board-surface tray's tap access, and the ledger's feats and chords chips all fold into it — the two ledgers through Collection; nothing else changes.

**Game-info strip**:
The ledger's phone face on the board surface — the grouped resource reads (ν, rate, arete) and nothing else, where the idle tutorial helptext used to sit. Its rate read is the phone's door to the rate details sheet — the same module-linked roster the ledger's popover holds at wider widths — and its arete read keeps the dim pre-prestige slot. No feats or chords chips: Collection provides their sole phone entry. Phone only; the board ledger serves every other width.

**Collection**:
The phone thumb bar's launcher: one segment holding the feats and chords entries the ledger chips carry at wider widths — rows with icon and count opening their sheets, behind a "‹ Collection" back control. Its future scope — viewing all unlocked module and mutator types — is recorded as deferred, not built.

**Rate details**:
The module-linked disclosure behind the rate figures (ADR-0037): one roster shared by the ledger's popover and the tap-up sheet — the final total, one row per oscillator carrying its final ν/s and expanding into its base, chord, booster, charge, and achievement legs, and the nonproducing modules' effects with no ν/s of their own. Tapping an oscillator row selects its module on the board.

**Chord sheet**:
The chord discovery ledger's surface (issue #230, reworked by #278): an index of the eleven classes beside a large stage for the selected class. The index lists the classes discovered-first as compact rows — mini glyph, name (the dotted leader while undiscovered), and the live pip with its per-class instance count — and selecting a row puts that class on the stage: giant glyph, name in condensed lettering, the bonus figure beside it, the board's active read, and the roots history. The header reads `Chords (4/11) (+4% ν)` — the count with the discovery bonus parenthetical, no explanatory paragraph — and the deeper mechanics live in the tooltip layer: the discovery bonus, the instance stacking, the distinct-root history as the inline figure. Undiscovered classes render as solid, dimmed, hueless voice hexes with the dashed wire gaps kept as the spacer path and the sealing ring absent — modules and spacers distinct at a glance. The active read counts standing instances across the board and its tooltip names the classes ringing; the active pip pulses in the class's hue and sits static under reduced motion. The bonus reads ×n locally — each standing instance multiplies its member oscillators' output, instances stacking; no "while it sings," no board-wide claim (ADR-0036). On phone the stage and index become rows — a compact stage row on top, the full-width index below, scrolling within the sheet. The stage selection is light furniture, never saved.
_Avoid_: Chord library, field guide, card grid, roots-heard hairline, circle-of-fifths ring

**Zoom cluster**:
The +/−/fit cluster floating over the board's right edge, beside wheel zoom. The board pans by dragging outside the grid at any zoom (inside when zoomed in), clamped so the board can never leave the frame. On portrait phone the cluster rises above any open sheet so inspection never gets buried.

**Focus app**:
A fixed-function instrument hosted by the console — Habit, Time, Notes, and Goals at launch. Apps never grant, produce, or spend nous or charge; board modules may read their state as effect inputs.

**App activation**:
The permanent, player-wide unlock that enables a focus app, bought from the activation ladder and separate from anything the board sells. The four launch apps are active from the very first session; activation opens future apps such as Tasks.

**Activation ladder**:
The shared, scaling price sequence for app activations with free order — each rung costs more than the last regardless of which app it opens. It rests empty at launch, hidden until its first tenant (such as Tasks) is designed; its pricing is decided with that tenant.

**Console long goal**:
A purchase beat for a console upgrade such as goal capacity: each purchase adds one increment — one goal slot — and reveals the next price, much steeper. The price is the pacing: players may purchase successive increments whenever they can afford them, with no occupancy gate. Gated behind its app's activation, and rendered as one compact dashed row in the owning app's panel, trailing the slots it extends.
_Avoid_: CONSOLE LONG GOAL label (the visible panel drops it)

**Habit**:
A repeatable real-life practice, such as piano or cooking, that develops through credited practice time and manually logged practice time and can be selected for a flow session. Its development unlocks build nodes as practice time crosses milestones and is separate from nous.

**Habit build**:
The per-habit loadout of equipped build nodes, chosen from a shared catalog and re-pickable freely in upgrade mode; its effects apply only while that habit is the session's active habit. Builds persist through prestige.

**Build node**:
One effect option in the shared habit-build catalog, drawn from the charge/Forge branch or the nous branch; unlocked as its habit's practice time crosses milestones and equipped into the habit build's limited slots.
_Avoid_: habit upgrade, perk

**Habit app**:
The always-free focus app through which the player selects the active habit for a session, or practices unstructured. On phone, the launcher's entry names the selected practice inline and reads "none selected" when the next session would be unstructured (ADR-0033) — the UI's word for the unstructured choice.

**Habit development summary**:
The Habit app's per-habit view: lifetime practice time, sessions practiced, last practiced, and the habit's tagged notes. Its aggregates read the practice log — live sessions and manual logs together.

**Practice run**:
A stretch of consecutive days on which any credited practice was logged for a habit, live or manual; surfaced as its current and longest runs. Joins post-launch. _Avoid_: streak

**Practice calendar**:
The per-habit day-grid of logged practice minutes in the Habit app's development summary. Joins post-launch. _Avoid_: heatmap

**Time app**:
The focus app providing planned targets and timing tools, and the home of session history; active from the very first session, with no economy coupling.

**Planned target**:
A practice duration or milestone set within the Time app — a preset quick pick or free entry from 1 to 90 minutes in 1-minute steps — that a session can aim at and hit; hits are recorded in the session summary.

**Notes app**:
The focus app for recording notes — during a flow session or between sessions. Notes produce nothing themselves; a written note is the fact each owned Note Generator reads, crediting its reserve by the note's character count (ADR-0047). Tagged notes wear their habit as a chip.

**Habit-keyed note**:
A note tagged with the session's selected habit at capture, surfaced in that habit's development summary and chipped in the Notes stream. Unstructured and upgrade-mode notes go untagged.

**Goals app**:
The focus app for tracking goals; completion is the tracking itself, surfaced in the session summary. A completion is the fact each owned Goal Generator reads, crediting its reserve a multiple of the focus equivalent prorated by the goal's live share (ADR-0047). Its capacity grows through console long goals.

**Goal**:
A practice condition to fulfill, such as practicing piano for twenty minutes or practicing four specified habits in a day, accruing progress only while active. Goals may qualify practice by habit or other criteria, and a session may advance several goals.
_Avoid_: Task

**Goal slot**:
Capacity for one tracked goal within the Goals app; available slots limit the number of goals the player can track.

**Goal template**:
A configurable definition of valid practice conditions within the Goals app; players select habits and targets within the template.

**Recurring goal**:
A goal that retains its slot and resets on its configured schedule, awarding completion once per occurrence.

**One-time goal**:
A goal that rewards completion once and remains completed in its slot until replaced during upgrade mode.

**Manual practice log**:
A player-reported record of practice outside a running session that can satisfy goal conditions without retroactively producing nous or simulating charge activity.

### Sessions

**Shared save**:
The persisted game progress shared by the browser's tabs. A tab protects newer shared progress from being replaced by its older working copy, and adopts newer progress when it can safely reconcile its session.


**Flow session**:
A period of real-life practice during which the board runs automatically and the console supports focus activities such as taking notes.

**Unstructured practice**:
Starting a flow session with no habit selected; available at every session start, accruing no habit development, and leaving nous production unaffected.

**Open-ended session**:
A flow session without a planned duration.

**Paused session**:
A flow session whose elapsed time and board activity are frozen while its starting configuration remains locked; resuming continues the same session.

**Present time**:
The portion of a flow session during which the player is present. Always trusted: banks and credits live, before and after a planned target.

**Away time**:
The portion of a flow session during which the player is away, including whole-system sleep. Toward the target on planned sessions; provisional past it; all provisional on open-ended. Brief absences credit silently as present.

**Provisional bucket**:
The visibly flagged nous counter for provisional time; the minutes behind it form the provisional pool. Banked or dropped in one move when the honesty report resolves. Nothing already banked is ever taken back.

**Provisional pool**:
The minutes owed honesty behind the provisional bucket: away time past a planned target, and all away time on open-ended sessions beyond the reconciliation floor. The honesty report settles it together with the bucket.

**Honesty report**:
The mandatory adjudication presented when a session returns with provisional time outstanding, repeated until resolved. One answer banks or drops the bucket and sets how much of the provisional time credits: didn't practice, did what I planned, or practiced the whole time away — the middle option only where a plan exists.

**Credited practice time**:
A session's post-reconciliation practice total: live present and trusted time, plus provisional time as the honesty report credits it. Habit accrual, goal progress, the charge window, the flow meter, and session achievements all key off it.

**Honesty outcome**:
The per-reconciliation record — missed, planned, or full — from which a session's honesty summary and its miss row derive.

**Honesty event**:
One reconciliation's factual line in the session record: the away minutes and their honesty outcome ("22 min away · didn't practice").

**Overrun**:
The continued run of a planned session past its target: presence keeps banking live, away time turns provisional, and the tab title flips to done.

**Target-hit signals**:
The chime, browser notification, and tab-title flip fired together the first moment a session's wall clock reaches its planned target. Open-ended and paused sessions fire none.

**Upgrade mode**:
The period between flow sessions when the player configures and upgrades the board and console while charge state is paused and no production occurs. It is the only window for all nous spending.

**Session summary**:
The modal every flow session ends with in upgrade mode, after the honesty report when one is owed: the session's banked nous headline, credited practice minutes, the achieved rate with its breakdown, its honesty event lines as neutral factual lines, and any unlocks. The reflection rides in it above dismissal.

**Reflection**:
The optional insight capture in the session summary: free text plus a continuous valence slider (rough ↔ great), neutral middle default and end labels that brighten as the thumb nears. Recorded when either part is touched, absent otherwise; pure insight at launch — nothing reads it.

**Practice-minute countdown**:
The affordability estimate on upgrade-mode purchase surfaces, projecting the current board's next-session rate ("in ~3:40 of practice"); hidden when already affordable or when no rate exists. Never shown in-session or in the summary.

**Session record**:
The permanent per-session entry: when it ran, which habit, planned vs credited time, what banked, its honesty events, reflection, and goals advanced.

**Session history**:
The complete append-only run of session records, browsed in the Time app's list and drill-down.

**Miss marker**:
The muted list-row flag on session records carrying a missed honesty event. Muted grey, never red — accounting, not judgment.

### Progression

**Arete**:
The resource banked by prestige and by nothing else — never granted before the reset. Each prestige banks a claim that grows with the prestiges performed; once the horizon is broken, score beyond the horizon line raises the claim further, up to a hard cap. It spends on the Arete Catalog.

**Arete Catalog**:
The catalog's `◇ Arete` face. Its tab stands open from the start — the face never locks on the prestige count; before the Mutator tree's entry it is the single centered Unlock Mutator Layer purchase screen, shown from the first session as the preview of the future entry with its price muted (Arete arrives only through prestige, so the purchase cannot land early). The entry purchase reveals the Upgrades section (the entry's ACQUIRED rewards line, the inert Accelerator placeholder, the Horizon break) and the Unlocks section (the roll-pool join, empty once joined). Purchases are permanent, act in upgrade mode only, and survive prestige.
_Avoid_: prestige sheet, prestige tree, skill tree

**Mutator tree**:
The Arete Catalog's first tree. Its purchases are the entry (activates the Mutator Grid, grants the Mutator Forge module itself, unlocks the first Mutator slot, and performs the first Mutator roll) and the pricier purchase that joins the Mutator Forge type to the roll pool. Slot unlocks past the first are armed from the dock's Add in mutator mode — like a cell purchase, priced on the tree's escalating ladder. The type is otherwise Catalog-exclusive.
_Avoid_: enhancement tree, gem tree

**Row unlock**:
The board-side Arete purchase that opens one octave row beyond the launch band — one row above and one below this phase, sold in either order at escalating Arete. It renders in add-cell mode as the shaded next row behind a single unlock banner per side, one click buying outright, and its purchase stands in the row gate for the row it opens — cells inside then buy with nous as usual. The board caps at six octave rows this phase.
_Avoid_: Octave tree (retired), row expansion, vertical unlock

**Arete accumulator**:
The log-scale fill on the current era's nous earned toward the horizon line, drawn as the ambient horizon bar across the board's lower edge (ADR-0038); it rebases at each prestige while lifetime total nous earned stays the truth beneath. Its one figure is the bar's own log-scale percentage; no decade marks or countdown.

**Horizon bar**:
The Arete accumulator's surface: the ambient curved-scale fill riding the board's lower edge at every width, spanning most of the board's breadth (ADR-0038), pointer-transparent except for the prestige door its completed state hosts. Before the crossing it says its name and its one log-scale percentage and nothing else; complete, the percentage readout gives way to the "Prestige and Claim X Arete" button, locked outside upgrade mode. An open sheet may cover it, nothing dismisses it (ADR-0029).
_Avoid_: Arete pill

**Horizon line**:
The Arete accumulator's cap — the fixed prestige threshold and the horizon bar's far end, the same every era. Reaching it opens the prestige door; it mints nothing by itself.

**Prestige**:
The reset action: once the current era's fill reaches the horizon line, prestige banks the era's Arete claim and begins the next era — module levels, nous, and charge state reset while the board's modules, cells, and placement, the mutator layer (Catalog unlocks, Mutator slots, placed mutators, the Mutator tray), and the whole life record persist. Performed in upgrade mode through the horizon bar's door, behind a confirm.
_Avoid_: reset (as the player-facing verb)

**Horizon break**:
The one-time Arete Catalog purchase, standing alone beside the Mutator tree, that lets score beyond the horizon line raise the prestige claim — still banked only on reset. Until it is bought, the claim reads the prestiges performed alone and pushing past the horizon banks nothing extra.
_Avoid_: break infinity

**Achievement**:
A named feat that accelerates but never gates progress; each adds into the global achievementBoost term of the nous rate. Detection is live, storage is the save's `id → unlockedAt` map, definitions in code. "Feat" is the player-facing word for an achievement on every surface — headers, chips, dock labels, toasts; "achievement" stays the system term.

### Deferred vocabulary

The Tasks console app ships post-launch; its terms below stand as designed (ADR-0005) and join the activation ladder when built.

**Task**:
A concrete action whose size is estimated and whose completion is reported by the player, initially intended to be bite-sized. Tasks can be created or completed at any time.
_Avoid_: Goal

**Task app**:
The planned future focus app for capturing tasks and recognizing their completion, with unrestricted task capture and size-based rewards limited by practice time.

**Task reward allowance**:
A player-wide allowance earned through live flow-session time and consumed by task rewards according to estimated task size, carrying across habits and sessions without a cap or expiry. All task sizes share it; manual practice logs do not earn it, and no task-specific working status is required.

**Pending task reward**:
A reward for an already completed task that waits for full funding from task reward allowance in completion order. Task completion is recorded immediately regardless of available allowance.
