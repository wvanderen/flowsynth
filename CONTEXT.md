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
The function level of a board module — synthesizer, spacer, generator, infusor, or forge at launch. Category carries the module's hue.

**Module type**:
A specific module design within a category, such as the Additive Synthesizer or the focus-keyed generator, carrying its own glyph and nameplate. Forge choices contain distinct module types; different types may share the same category.

**Chargeable module**:
A supertype family above the category level whose members accumulate received charge toward thresholds that produce effects; the threshold fill is the family's shared rendering trait. The Module Forge is the launch instance. Continuous-charge categories (synthesizer, infusor) use received charge as continuous empowerment instead.

**Pitch**:
The absolute note a cell sounds — a property of the cell's position on the octave-stack lattice, derived from its coordinates and never persisted. Columns read as one note name; the horizontal axis walks the circle of fifths.
_Avoid_: harmonic number, distance-from-origin

**Chord**:
A named pitch set — octave, fifth, major triad, and kin — recognized by pitch content over a connected cluster of synthesizers, register-free: any voicing, any octave. Each chord instance multiplies only its member synthesizers; overlapping and repeated instances stack multiplicatively on their members, and distant modules are unchanged (ADR-0036). Adjacency alone is chordless.
_Avoid_: Named chord (the just-intonation-run sense), Chord pair

**Seam**:
The chord-colored line the board draws for a formed chord: center-to-center between a two-voice chord's adjacent voices; a chord the seams can't carry — three or more voices, or a spacer-bridged pair — draws its offset outline instead — a closed polygon behind the modules, edges riding the gaps between faces, corners just poking past. Always on, in every mode.
_Avoid_: Chord link, Pair link, Hull

**Chord readout**:
The reserved spot beside the board — the heading's right end — where a selected (or hovered) module's row stands: its final ν/s first — live during flow, present with no chord at all — then the names and multipliers of every chord it earns its bonus from. No board-wide +ν/s claims on any chord surface (ADR-0036). The selected module's row pins it; hovering a seam or a module asks. One spot, never floating over the board.
_Avoid_: Chord chip (the ambient-floating sense), Chord view

**Spacer**:
A silent wire module occupying one cell: it never sounds and never joins a pitch set, but conducts chord adjacency through chains of wired cells. Reaches the board only through module rolls.

**Octave row**:
One register of the board: the band of cells whose pitches sit in the same octave, stacked as a vertical shape.

**Start register**:
The octave row the opening board begins on; rows are finite, generous, and symmetric around it.

**Row gate**:
The one-time premium paid on the first purchase into each new octave row. It taxes acquisition only — moving owned cells between rows is free — and does not advance the cell purchase scaler.

**Expanded face**:
The module's own face opened by a click in upgrade mode — the compact face's UI enlarged, adding only what the face doesn't say: the production contribution and the Upgrade button with its benefit. It is the module's only surface (ADR-0026): the inspector sidebar and module panels are retired, and no second panel duplicates what the board already says.
_Avoid_: Move button, Return button, module panel, inspector sidebar

**Bloom**:
The expanded face's plate — a fixed regular hexagon nested onto the selected module (ADR-0024), presenting below, mirrored, only when the frame's top leaves no room. It pops only when it would actually enlarge the module; past that, the upgrade affordances ride the closed face as a floating card. On portrait phone it presents as a bottom sheet over the board's lower edge.
_Avoid_: pop-up, modal

**Lift-off**:
The popped bloom standing for its module: the origin cell renders vacated while the bloom stands, since the bloom repeats every line the face carries.

**Tray**:
The board-surface inventory as a collapsible column docked beside the action dock — the dock's Inventory icon toggles it, and a drag or an armed placement opens it for the gesture's duration. Drag a module off the board into it to retrieve — the chord-breaking gesture, shared with right-click retrieve — and click an item then a cell to place; occupied placement swaps. Its tiles wear the minimal mark: a hexagon outlined in the category hue with the glyph alone, the full face belonging to the board and the expanded face (ADR-0027). On portrait phone the tray hides and the thumb bar's Inventory segment taps the same inventory open as a sheet. There is no management view.
_Avoid_: inventory panel, management view

**Mutator Grid**:
The board lattice's second layer, mirroring it position for position, present only while activated by the Mutator tree's entry purchase. Each cell owns one Mutator slot; modules move freely across the board while slots stay put.
_Avoid_: enhancement grid, second board

**Mutator slot**:
One cell's place on the Mutator Grid — the cell's second face. Holds at most one mutator and modifies whatever module occupies the cell; vacant, it is inert. Slots unlock one at a time in upgrade mode and persist through prestige.
_Avoid_: socket, gem slot

**Mutator**:
An item of the Mutator Grid: typed, carrying rarity, sitting in a Mutator slot to modify its host module's corresponding term. Launch families: power, resonance, charge. Retrieved and placed like modules, through the Mutator tray; placed mutators and the tray persist through prestige.
_Avoid_: enhancement (the pre-design name), gem, affix

**Mutator tray**:
The Mutator Grid's inventory, mirroring the Tray's docks and gestures for mutators: minted mutators wait here, a click then a slot places, and a drag or right-click retrieves.
_Avoid_: second inventory

### Resources and production

**Nous**:
The provisional name for the game's main progression resource, spent on permanent upgrades. It is produced only by the board formula.

**Nous production rate**:
The single final nous-per-second output: the sum of the synthesizers' final figures — `(synths + infusors) × empowerment × achievementBoost`. Modules contribute terms to this shared rate rather than producing independent timed payouts.

**Final ν/s**:
One module's own production figure: its base term with its local infusor, chord, charge, and achievement effects all included (ADR-0036). The displayed figures sum to the board's rate within rounding, the selected module's final ν/s shows in the reserved readout, and every synthesizer's row in the rate details leads with it (ADR-0037).

**Composite**:
The board's summed uncharged amplitude: the synths leg plus the infusor uplift, each carrying its members' local chord factors (ADR-0036). There is no board-wide chord multiplier over it.

**Synth term**:
A synthesizer's base contribution to the composite — level and rarity power, with the synthesizer's own chord factor in (ADR-0036); one unified leg shared by every synthesizer. The infusor uplift rides in its own leg beside it.

**Synthesizer**:
A board module contributing a synth term to the composite; no synthesizer is spatially privileged. It is empowered while receiving charge and never produces charge.
_Avoid_: Synth (in domain documentation)

**Charge**:
A habit-independent resource produced by generators that empowers or charges other modules; its state is preserved between flow sessions.

**Generator**:
A board module that produces charge. Remaining output belongs to the generator and follows it when moved. The launch generator is the focus-keyed generator (ADR-0018 retired the plain generator pre-release); other generators with different requirements come later.

**Charge window**:
The charge budget banked at session end by the focus-keyed generator, sized as a fraction of that session's credited practice time and spent as output during the next session's first minutes. Manual practice logs never create one.

**Output strength**:
The rate at which a generator delivers charge to each eligible adjacent module, without dividing output among neighbors. Strengths from simultaneously active generators add at each receiver.

**Remaining duration**:
The amount of live flow time for which a generator's output remains available; simultaneously active generators each use their own duration.

**Charged empowerment**:
An increase to a module's specified effect while receiving charge, increasing with received strength with diminishing returns. Its numerical curve remains to be balanced.

**Infusor**:
A board module that improves a specified effect of eligible adjacent modules, with its bonus strengthened while receiving charge.
_Avoid_: Infuser

**Infusor term**:
An infusor's contribution to the composite: the local uplift it grants adjacent synthesizers' amplitudes, named as its own additive leg in the live rate breakdown.

### Quality and acquisition

**Module upgrade**:
A purchased increase to a module's core power, paid for with nous in upgrade mode.

**Rarity**:
A module quality shown as an engraved ring count and plate tint; it improves how purchased levels scale and strengthens secondary effects, rather than granting free levels.

**Combination**:
The consumption of two modules of the same type and rarity to produce one of the next rarity, retaining the higher input level and refunding the lower-level input's nous upgrade expenditure. It is initiated by dropping one copy onto the other (board or tray, either direction) and confirming the reviewed outcome; the result lands where the drop target was. The player chooses one input's secondary effects to retain with the new rarity's improvements.

**Forge**:
A chargeable module that accumulates received charge toward thresholds that mint rolls. The family splits in two — the Module Forge mints module rolls, the Mutator Forge mints mutator rolls.

**Module Forge**:
The launch Forge: the chargeable module whose thresholds mint module rolls. Its shared progress meter and banked rolls are the originals.

**Mutator Forge**:
The chargeable module whose thresholds mint mutator rolls into the Mutator tray. Catalog-exclusive until the Mutator tree's roll-pool purchase joins it; its branch keeps its own shared progress meter across deployed Mutator Forges.

**Forge progress**:
A branch's player-wide meter to which that branch's deployed Forges contribute according to received charge and progress efficiency — the Module Forge's and the Mutator Forge's meters are separate. Crossing a branch's globally scaling threshold banks a roll on that branch and carries excess progress forward, independently of any individual Forge's identity.

**Module roll**:
A charge-earned choice of one module from three generated candidates; unchosen candidates disappear without consolation resources.
_Avoid_: forge roll (the pre-split name)

**Mutator roll**:
A charge-earned choice of one mutator from three generated candidates, delivered to the Mutator tray; unchosen candidates disappear without consolation resources.

**Catalog**:
The permanent upgrade-mode purchase surface: app activations, starter-shelf offers while available, and cells. Its activation section appears only once the ladder has a tenant. Module upgrades live on module panels, not the catalog (ADR-0018).

**Starter shelf**:
The catalog's one-time guaranteed offers — the generator, one infusor, and a Module Forge — hidden once acquired. It completes the non-synthesizer landscape; synthesizers come only from the opening grant and module rolls (ADR-0022).

### The console and focus apps

**Console**:
The pure control surface organized around the Enter/Exit main switch — the dominant, centered session gate, with the clock beside it and Settings at the far right. The main switch is the mode indicator — off, glowing live, held paused — and the clock is itself the plan affordance: a small disclosure chevron on it opens the Time app, which wears no tile (Habit, Notes, and Goals carry the console's consistently sized icon-only tiles; on portrait phone a compact launcher stands in their place and opens the same three apps from one control, its entries wearing the selected habit and the tracker's goals state — ADR-0033). While a session runs, a thin progress strip along the console's bottom edge shows its progress in the switch's vermillion — filling on planned sessions, pulsing on open-ended ones, held while paused. The board never moves or dims while the console is in use.

**Board ledger**:
The strip docked above the board carrying Nous, Rate, and Session as one instrument, with the feats chip beside it — the board owns its production numbers. The Rate cell shows the final total and is the only door to the rate details: hover or focus opens the module-linked roster above the 760px breakpoint, and a tap opens the same roster as a modal sheet at every width. (On portrait phone the door moves to the game-info strip's rate read.)

**Thumb bar**:
The console's re-docked form on portrait phone — a bottom bar of Catalog / Forge / New cell / Inventory / Feats. The icon dock, the board-surface tray's tap access, and the feats chip all fold into it; nothing else changes.

**Game-info strip**:
The pill on the board surface, directly below the phone nav, carrying ν, rate, and session — production reads where the idle tutorial helptext used to sit. Its rate read is the phone's door to the rate details sheet — the same module-linked roster the Rate cell's popover holds at wider widths. Feats appears once on phone, riding the thumb bar. Phone only; the board ledger serves every other width.

**Rate details**:
The module-linked disclosure behind the rate figures (ADR-0037): one roster shared by the Rate cell's popover and the tap-up sheet — the final total, one row per synthesizer carrying its final ν/s and expanding into its base, chord, infusor, charge, and achievement legs, and the nonproducing modules' effects with no ν/s of their own. Tapping a synthesizer row selects its module on the board.

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
A repeatable real-life practice, such as piano or cooking, that develops through credited practice time and manually logged practice time and can be selected for a flow session. Its development unlocks habit-specific customization options and is separate from nous.

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
The focus app for recording notes — during a flow session or between sessions. Notes carry no charge or economy effect; tagged notes wear their habit as a chip.

**Habit-keyed note**:
A note tagged with the session's selected habit at capture, surfaced in that habit's development summary and chipped in the Notes stream. Unstructured and upgrade-mode notes go untagged.

**Goals app**:
The focus app for tracking goals; completion is the tracking itself, surfaced in the session summary. Its capacity grows through console long goals.

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
A session's post-reconciliation practice total: live present and trusted time, plus provisional time as the honesty report credits it. Habit accrual, goal progress, the charge window, and session achievements all key off it.

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
The optional insight capture in the session summary: free text plus a five-position valence slider (rough ↔ great), neutral middle default. Recorded when either part is touched, absent otherwise; pure insight at launch — nothing reads it.

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
The resource banked by prestige and by nothing else — never granted before the reset. Its base yield is one per prestige at the horizon line, and it spends on the Arete Catalog.

**Arete Catalog**:
The board-side shop of Arete purchases: a chip on the board ledger, appearing with the first banked Arete, opening the prestige sheet — production stays grouped on the board, and the console never touches Arete. Organized as trees of offerings; each tree enters at one Arete and escalates within. Purchases are permanent and survive prestige. The launch trees are the Mutator tree and the Octave tree.
_Avoid_: prestige tree, skill tree

**Mutator tree**:
The Arete Catalog's first tree. Its entry purchase activates the Mutator Grid, grants the Mutator Forge module itself, and unlocks the first Mutator slot; later purchases add slots at escalating Arete, and a pricier purchase then joins the Mutator Forge type to the roll pool. The type is otherwise Catalog-exclusive.
_Avoid_: enhancement tree, gem tree

**Octave tree**:
The Arete Catalog's second tree: one octave row above and one below the launch band, sold in either order at escalating Arete. Its purchase stands in the row gate for the row it opens — cells inside then buy with nous as usual — and the board caps at six octave rows this phase.
_Avoid_: row expansion, vertical unlock

**Arete accumulator**:
The log-scale fill on the current era's nous earned toward the horizon line, drawn as the ambient horizon bar across the board's lower edge (ADR-0038); it rebases at each prestige while lifetime total nous earned stays the truth beneath. Its one figure is the bar's own log-scale percentage; no decade marks or countdown.

**Horizon bar**:
The Arete accumulator's surface: the ambient curved-scale fill riding the board's lower edge at every width, spanning most of the board's breadth (ADR-0038), pointer-transparent except for the prestige door its completed state hosts. Before the crossing it says its name and its one log-scale percentage and nothing else; complete, the percentage readout gives way to the "Prestige and Claim X Arete" button, locked outside upgrade mode. An open sheet may cover it, nothing dismisses it (ADR-0029).
_Avoid_: Arete pill

**Horizon line**:
The Arete accumulator's cap — the fixed prestige threshold and the horizon bar's far end, the same every era until the horizon breaks. Reaching it opens the prestige door; it mints nothing by itself.

**Prestige**:
The reset action: once the current era's fill reaches the horizon line, prestige banks the era's Arete claim and begins the next era — module levels, nous, and charge state reset while the board's modules, cells, and placement, the mutator layer (Catalog unlocks, Mutator slots, placed mutators, the Mutator tray), and the whole life record persist. Performed in upgrade mode through the horizon bar's door, behind a confirm.
_Avoid_: reset (as the player-facing verb)

**Achievement**:
A named feat that accelerates but never gates progress; each adds into the global achievementBoost term of the nous rate. Detection is live, storage is the v5 save's `id → unlockedAt` map. "Feat" is flavor individual names may carry, never a second term.

### Deferred vocabulary

The Tasks console app ships post-launch; its terms below stand as designed (ADR-0005) and join the activation ladder when built. The horizon break is deferred to its own decision; what Arete buys is now settled — the Arete Catalog.

**Horizon break**:
The planned future act that lets score beyond the horizon line scale the prestige claim — still banked only on reset. Its unlock, curve, and surface are the horizon break's own decision.

**Task**:
A concrete action whose size is estimated and whose completion is reported by the player, initially intended to be bite-sized. Tasks can be created or completed at any time.
_Avoid_: Goal

**Task app**:
The planned future focus app for capturing tasks and recognizing their completion, with unrestricted task capture and size-based rewards limited by practice time.

**Task reward allowance**:
A player-wide allowance earned through live flow-session time and consumed by task rewards according to estimated task size, carrying across habits and sessions without a cap or expiry. All task sizes share it; manual practice logs do not earn it, and no task-specific working status is required.

**Pending task reward**:
A reward for an already completed task that waits for full funding from task reward allowance in completion order. Task completion is recorded immediately regardless of available allowance.
