# FlowSynth

FlowSynth is an incremental game in which real-life practices drive a configurable grid of modules.

## Language

**Module**:
A unit occupying one cell on the hex grid, with gameplay effects and, in many cases, a connection to a real-life practice or supporting interaction.

**Module type**:
A specific module design, such as Additive Synthesizer or Conditional Synthesizer, rather than a broad functional category such as synthesizer. Forge choices contain distinct module types; different types may share the same function.

**Flow session**:
A period of real-life practice during which the grid runs automatically and the interface supports focus activities such as taking notes.

**Upgrade mode**:
The period between flow sessions when the player configures and upgrades the grid while its charge state is paused and no production occurs.

**Habit**:
A repeatable real-life practice, such as piano or cooking, that develops through live or manually logged practice time and can be selected for a flow session. Its development unlocks habit-specific customization options, separate from nous-funded Habit module upgrades.

**Habit module**:
A module through which the player selects one active habit for a session. Its upgrades and rarity are separate from the selected habit's development.

**Required module**:
A core module type with exactly one deployed copy that must remain on the board, freely movable during upgrade mode; inactive core modules reserve their cells without providing effects. Enter/Exit Flow, Time, Habit, Goals, Notes, and Tasks are required types, and duplicate copies may be held in inventory.

**Core activation**:
The permanent player-wide unlock that enables a core module type, separate from obtaining copies of it. Inactive copies provide no effects and neither receive nor produce charge; any previously held charge remains frozen until activation.

**Goal module**:
The unique required module in which the player tracks goals, with capacity increased through goal-slot upgrades rather than additional Goal modules.

**Goal**:
A practice condition to fulfill, such as practicing piano for twenty minutes or practicing four specified habits in a day, accruing progress only while active. Goals may qualify practice by habit or other criteria, and a session may advance several goals.
_Avoid_: Task

**Goal slot**:
Capacity for one tracked goal within the Goal module; available slots limit the number of goals the player can track.

**Task**:
A concrete action whose size is estimated and whose completion is reported by the player, initially intended to be bite-sized. Tasks can be created or completed at any time.
_Avoid_: Goal

**Task module**:
The unique required module for capturing tasks and recognizing their completion, with unrestricted task capture and size-based rewards limited by practice time.

**Task reward allowance**:
A player-wide allowance earned through live flow-session time and consumed by task rewards according to estimated task size, carrying across habits and sessions without a cap or expiry. All task sizes share it; manual practice logs do not earn it, and no task-specific working status is required.

**Pending task reward**:
A reward for an already completed task that waits for full funding from task reward allowance in completion order. Task completion is recorded immediately regardless of available allowance.

**Recurring goal**:
A goal that retains its slot and resets on its configured schedule, awarding completion once per occurrence.

**One-time goal**:
A goal that rewards completion once and remains completed in its slot until replaced during upgrade mode.

**Manual practice log**:
A player-reported record of practice outside a running session that can satisfy goal conditions without retroactively producing nous or simulating charge activity.

**Enter/Exit Flow module**:
The module used to start and end flow sessions, supplying baseline nous production while flow is live without requiring charge.

**Charge**:
A habit-independent resource produced by module activations that empowers or charges other modules; its state is preserved between flow sessions.

**Generator**:
A module that produces charge, including modules that also serve a focus function. Remaining output belongs to the generator and follows it when moved.

**Charged core bonus**:
An improvement to a core module's contribution to nous production while it receives charge. It does not improve charge generation; generator and synthesizer functions are distinct capabilities of a module.

**Charged empowerment**:
An increase to a module's specified effect while receiving charge, increasing with received strength with diminishing returns. Its numerical curve remains to be balanced.

**Output strength**:
The rate at which a generator delivers charge to each eligible adjacent module, without dividing output among neighbors. Strengths from simultaneously active generators add at each receiver.

**Remaining duration**:
The amount of live flow time for which a generator's output remains available; simultaneously active generators each use their own duration.

**Synthesizer**:
A module contributing to the shared nous production formula, whose effect is empowered while it receives charge.
_Avoid_: Synth (in domain documentation)

**Nous production rate**:
The single final nous-per-second output calculated from the combined Enter/Exit and additive synthesizer base contributions, then modified by production multipliers. Modules contribute terms to this shared rate rather than producing independent timed payouts.

**Chargeable module**:
A module that accumulates received charge toward thresholds that produce effects or rewards.

**Stored charge**:
Charge held by a receiving module, belonging to that module independently of its position on the grid.

**Time module**:
A module for session timing that contributes the same baseline running multiplier in timed and open-ended sessions and awards a duration-proportional charge burst once a planned target is reached. The multiplier is independent of planned duration and continues after the target until the session ends.

**Notes module**:
A required module for recording notes whose use qualifies session practice time for a charge burst banked at session end for the next session. Its bound is charge per minute of qualifying practice, increased by customization, rather than a per-session ceiling or a reward for entry count or first-note timing.

**Goal template**:
A configurable definition of valid practice conditions and their equipped benefit and completion-charge rules. Players select habits and targets within the template.

**Completion bonus**:
A reward for completing the planned session, withheld when the session ends early without removing production or habit progress already earned.

**Open-ended session**:
A flow session without a planned duration, earning progressive rewards without a completion bonus.

**Paused session**:
A flow session whose elapsed time and grid activity are frozen while its starting configuration remains locked; resuming continues the same session.

**Nous**:
The provisional name for the game's main progression resource, spent on permanent module upgrades.

**Module upgrade**:
A purchased increase to a module's core power, paid for with nous.

**Rarity**:
A module quality that improves how purchased levels scale and strengthens secondary effects, rather than granting free levels.

**Combination**:
The consumption of two modules of the same type and rarity to produce one of the next rarity, retaining the higher input level and refunding the lower-level input's nous upgrade expenditure. The player chooses one input's secondary effects to retain with the new rarity's improvements.

**Infusor**:
A module that improves a specified effect of eligible adjacent modules, with its bonus strengthened while receiving charge.
_Avoid_: Infuser

**Forge roll**:
A charge-earned choice of one module from three generated candidates; unchosen candidates disappear without consolation resources.

**Forge progress**:
A player-wide meter to which deployed Forges contribute according to received charge and progress efficiency. Crossing its globally scaling threshold banks a roll and carries excess progress forward, independently of any individual Forge's identity.

**Expansion progress**:
A player-wide meter to which deployed expanders contribute charge toward the next cell unlock. The next cost scales with total expansion earned, rather than resetting for each expander.
