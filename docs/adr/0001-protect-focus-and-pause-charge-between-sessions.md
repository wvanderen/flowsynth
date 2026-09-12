# Protect focus and pause charge between sessions

FlowSynth should reward real-life practice without rewarding attention to the game during that practice. Strategic configuration and upgrades belong between flow sessions; during a session, gameplay runs automatically and the interface emphasizes useful focus interactions. Charge state pauses between sessions so players can take breaks and rearrange their grid without losing charge, including charge awarded at session completion.

Useful focus interactions may confer gameplay benefits, but checking the game or timing a gameplay action during flow must not improve the outcome. Notes provide a bounded session benefit rather than rewards per entry or word; players can invest in increasing that bound through customization.

The initial Notes benefit is a charge burst banked at session end for the next session, independent of when the first note was written. The Time module supplies a running multiplier during timed practice and a duration-proportional charge burst once the target is reached; exact rates remain for balancing.

Notes rewards scale with session practice time, bounded by charge per qualifying minute rather than a per-session ceiling, so restarting does not reset reward capacity. The Time multiplier is independent of chosen duration, applies equally to timed and open-ended sessions, and persists after a planned target is reached; the completion burst scales with duration.

There is no production between sessions in the current design. Ending a session early preserves production and habit progress already earned, but withholds its completion bonus.

The grid, active habit, and planned duration are fixed at session start; changing them requires ending the session, while notes and progress logging remain available during flow. Open-ended sessions are supported without completion bonuses; customizations specifically benefiting them remain a future possibility.

Equipped goals are also locked during a session. Task creation and completion remain available at any time; task size uses a few player-estimated tiers with bounded rewards, and their gameplay payoff is banked for the next session. Rewards draw from live-time-earned task reward allowance, with unfunded rewards deferred as described in ADR-0005.

Goals are automatically evaluated from recorded practice, including manual practice logs; manual logs do not retroactively simulate nous production or charge activity. Recurrence is explicit: recurring goals retain their slot and reset on schedule, while one-time goals remain completed until replaced in upgrade mode, with one completion reward per occurrence.

Goals accrue progress only while active; earlier practice does not retrospectively advance a newly created goal. Editing its condition starts a new reward-eligible occurrence.

Automatic goal completion during flow immediately queues its charge burst; completion between sessions banks it for the next session, with one reward per occurrence. Recurring goal definitions remain locked during a session, but occurrences reset on schedule, allocating practice to the appropriate day while retaining the same equipped production effect and requiring no player action.

Reaching a planned duration awards its completion bonus once without ending flow: progressive rewards continue, and awarded charge can act immediately. Players may pause a session, freezing its time and grid while keeping its configuration locked; entering upgrade mode ends the session.

Chargeable modules automatically bank threshold rewards and continue charging with excess charge carried forward. Forge rolls and unlocked cells are used during upgrade mode, so filling a module never requires attention during practice.
