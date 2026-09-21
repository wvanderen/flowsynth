# FlowSynth

FlowSynth is an incremental game in which real-life practices drive a configurable hex board of modules — the board is the optimization game, and a console above it hosts the focus tools.

## Language

### The board

**Board**:
The hex grid of modules where all nous production and charge production happen; sessions run it automatically. The board may read focus state as inputs to module effects, but no console resource ever crosses onto it.

**Cell**:
One hexagonal place on the board. Cells are bought with nous on a geometric scaler over total cells bought, then placed and reshaped in upgrade mode on a connected board.

**Module**:
A unit occupying one cell on the board, with gameplay effects derived from its category and, in many cases, a connection to a real-life practice or supporting interaction.

**Module category**:
The function level of a board module — synthesizer, generator, infusor, or forge at launch. Category carries the module's hue.

**Module type**:
A specific module design within a category, such as the Additive Synthesizer or the focus-keyed generator, carrying its own glyph and nameplate. Forge choices contain distinct module types; different types may share the same category.

**Module lexicon**:
The single voice for what each module type does — the effect wording shared by the inspector, the face-tile readouts, and forge-roll candidates. Wording lives in one UI module; every derived number is delegated to the economy, so a balance retune never touches a sentence.

**Chargeable module**:
A supertype family above the category level whose members accumulate received charge toward thresholds that produce effects; the threshold fill is the family's shared rendering trait. The Forge is the launch instance. Continuous-charge categories (synthesizer, infusor) use received charge as continuous empowerment instead.

**Carrier**:
The unique granted origin module that plays the formula's carrier role; pinned to the origin cell, immovable and unsellable, wearing white. All other synthesizers are strictly harmonics.
_Avoid_: starter synth

**Pitch**:
A synthesizer's harmonic number, equal to its hex distance from the Carrier plus one.

**Chord pair**:
Two adjacent synthesizers at consecutive pitches; each pair multiplies the composite by a small bonus, stacking multiplicatively and uncapped. Identical pitches add amplitude without forming a chord; skipped pitches are legal but chordless.

**Named chord**:
A just-intonation chord recognized over a connected cluster of adjacent synthesizers — at launch: octave 1:2, fifth 2:3, major triad 4:5:6, and blues triad 5:6:7. A named chord's term replaces its member pairs' bonuses; overlapping named chords stack multiplicatively.

### Resources and production

**Nous**:
The provisional name for the game's main progression resource, spent on permanent upgrades. It is produced only by the board formula.

**Nous production rate**:
The single final nous-per-second output: `composite × empowerment × achievementBoost`. Modules contribute terms to this shared rate rather than producing independent timed payouts.

**Composite**:
The board's summed and chord-multiplied amplitude: the Carrier plus all harmonic terms, times every chord term.

**Harmonic term**:
A synthesizer's contribution to the composite — its amplitude at its pitch, plus a per-chord-pair bonus for Conditional types.

**Synthesizer**:
A board module contributing a harmonic term to the composite, whose effect is empowered while it receives charge. Synthesizers never produce charge.
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

### Quality and acquisition

**Module upgrade**:
A purchased increase to a module's core power, paid for with nous in upgrade mode.

**Rarity**:
A module quality shown as an engraved ring count and plate tint; it improves how purchased levels scale and strengthens secondary effects, rather than granting free levels.

**Combination**:
The consumption of two modules of the same type and rarity to produce one of the next rarity, retaining the higher input level and refunding the lower-level input's nous upgrade expenditure. The player chooses one input's secondary effects to retain with the new rarity's improvements.

**Forge**:
The launch chargeable module; it accumulates received charge toward thresholds that mint forge rolls.

**Forge progress**:
A player-wide meter to which deployed Forges contribute according to received charge and progress efficiency. Crossing its globally scaling threshold banks a roll and carries excess progress forward, independently of any individual Forge's identity.

**Forge roll**:
A charge-earned choice of one module from three generated candidates; unchosen candidates disappear without consolation resources.

**Catalog**:
The permanent upgrade-mode purchase surface: app activations, starter-shelf offers while available, and cells. Its activation section appears only once the ladder has a tenant. Module upgrades live on module panels, not the catalog (ADR-0018).

**Starter shelf**:
The catalog's one-time guaranteed offers — an Additive Synth, the generator, one infusor, and a Forge — hidden once acquired. It completes the category landscape and seeds chord play (ADR-0018); everything else comes from rolls.

### The console and focus apps

**Console**:
The surface structurally above the board, carrying the Enter/Exit main switch, the clock, pause, one tile per focus app, the status strip, and the nous balance. The main switch is the mode indicator — off, glowing live, held paused. While a session runs, a thin progress strip along the console's bottom edge shows its progress in the switch's vermillion — filling on planned sessions, pulsing on open-ended ones, held while paused. The board never moves or dims while the console is in use.

**Focus app**:
A fixed-function instrument hosted by the console — Habit, Time, Notes, and Goals at launch. Apps never grant, produce, or spend nous or charge; board modules may read their state as effect inputs.

**App activation**:
The permanent, player-wide unlock that enables a focus app, bought from the activation ladder and separate from anything the board sells. The four launch apps are active from the very first session; activation opens future apps such as Tasks.

**Activation ladder**:
The shared, scaling price sequence for app activations with free order — each rung costs more than the last regardless of which app it opens. It rests empty at launch, hidden until its first tenant (such as Tasks) is designed; its pricing is decided with that tenant.

**Console long goal**:
A hand-paced, one-at-a-time purchase beat for a console upgrade such as goal capacity; priced past the current build-out, gated behind its app's activation, and rendered as a dashed strip in the owning app's panel.

**Habit**:
A repeatable real-life practice, such as piano or cooking, that develops through credited practice time and manually logged practice time and can be selected for a flow session. Its development unlocks habit-specific customization options and is separate from nous.

**Habit app**:
The always-free focus app through which the player selects the active habit for a session, or practices unstructured.

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
The resource minted when the Arete accumulator fills. What mints it in quantity and what it spends on are prestige design, not yet decided.

**Arete accumulator**:
The status monitor's log-scale fill on lifetime total nous earned toward the horizon line; its decade graduations are visible but inert.

**Horizon line**:
The Arete accumulator's cap — the first prestige threshold — with a reserved, inert prestige button beneath it at launch.

**Status monitor**:
The full-width rail beneath the board carrying the live formula chip and the Arete accumulator; Forge progress rides the toolbar's Forge pip (ADR-0018).

**Achievement**:
A named feat that accelerates but never gates progress; each adds into the global achievementBoost term of the nous rate. Detection is live, storage is the v5 save's `id → unlockedAt` map. "Feat" is flavor individual names may carry, never a second term.

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
