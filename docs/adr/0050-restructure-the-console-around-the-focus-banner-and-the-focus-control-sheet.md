# Restructure the console around the focus banner and the Focus control sheet

The instrument map's focus-surfaces review ([#242](https://github.com/wvanderen/flowsynth/issues/242), ticket [#249](https://github.com/wvanderen/flowsynth/issues/249), resolved on the focus-surfaces prototype) found the console's tiles-and-launcher furniture fighting the instrument standards: generic rounded cards, hidden reads, a launcher standing in for navigation. The build-out grilling ([#255](https://github.com/wvanderen/flowsynth/issues/255), four prototype iterations) settled the replacement. This ADR records the console's new shape; the apps-off-the-board placement (ADR-0012) stands, ADR-0033's launcher and its Goals-state read are amended, and the presentation follows the ruled folio confirmed in #249.

## Decision

- **The console's face is the focus banner**: a figure-led strip over the board's head reading the session state — the clock beside the main switch, habit and plan reads, and three goal-progress bars that bias in-progress goals (nearest complete first, completed fill the remaining slots) with a `+N` overflow count chip. Reads go live during flow: the clock reads elapsed, bars fill, the habit name reads the active habit.
- **The Focus control sheet** unifies Plan, Habit, Goals, and History in one frame behind the banner, carrying the enter confirmation. The flow-mode rule is *read live, capture freely, mutate nothing*: PLAN becomes the running read (live elapsed, End flow mirroring the main switch, targets visibly disabled); HABIT opens on a figure-led list whose rows drill into development detail, with add and log as on-demand action-button forms, locked during flow; GOALS shows live progress with create and delete locked during flow; HISTORY is unaffected.
- **Notes leaves the console** for its own launcher entry and a tabbed CAPTURE | LOGGED sheet in the Focus frame, opening on CAPTURE; the live habit tag chip rides the composer during flow (upgrade-mode notes untagged), and the Note Generator mechanic stays in the tooltip layer. The larger Notes rework remains a future milestone.
- **The phone banner is launchers only**: the nav row drops the habit name and goal bars entirely for the clock, the switch, and bare uncarded icons — focus, Notes, Settings — with the inset marker as the sheet-open state. The compact launcher retires; this amends ADR-0033, whose Goals-state read survives on desktop only.
- **The dev console wears a drag handle**: a pointer-capture grip, clamped to the stage; arrow-key nudging while focused is an implementation nicety, not a blocker.
- **Edge states**: no plan ever set with confirmation off → instant-start falls back open-ended; zero habits → no blocking, the select reads "none selected"; every goal complete → full bars hold in the charge green until slots are replaced.

## Consequences

- ADR-0033's compact launcher and its phone-side habit/goal reads retire; ADR-0028's session-controls-only phone nav keeps the clock and switch it named.
- The console tiles and their popovers, as furniture, retire without save impact — the banner's edge states derive from existing session state, and no new persisted key is introduced.
- The instrument standards (#243) govern the banner's and sheet's presentation; the resolved prose cuts (flow-mode paragraph, goals explainer, manual-log line as tooltip) land with implementation.
