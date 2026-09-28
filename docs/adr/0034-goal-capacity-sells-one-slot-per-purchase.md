# Goal capacity sells one slot per purchase, trailing the panel's slots

ADR-0012 sold console long goals as hand-paced beats — "one at a time … never grindable back-to-back" — and issue #42 rendered goal capacity as a labeled strip above the Goals panel's work. Living with it (issue #150, 2026-09-27) showed the strip competing with the tracking it serves: the CONSOLE LONG GOAL label and the capacity help text repeated what the slots line already said, the add form sat above the goals it creates, and the two-slots-per-purchase beat hid the price ladder's steps.

## Decision

- **Goal capacity adds exactly one slot per purchase**, and every purchase reveals the next price, much steeper — the geometric ladder's step is the whole pacing. ADR-0012's never-grindable-back-to-back clause is superseded: players may purchase successive slots whenever they can afford them, with no occupancy gate. The Goals app's activation and the upgrade-mode gate still hold.
- **The panel reads as a run of slots**: incomplete goals first, completed occurrences next, then the empty add-goal slot — habit, minutes, recurrence, Add.
- **The purchase trails the slots as one compact dashed row** — "one more goal slot" beside its price and its practice-minute countdown. The visible panel drops the CONSOLE LONG GOAL label and the capacity help text; the slots line already carries the count.

## Consequences

- ADR-0012's hand-paced, one-at-a-time provision is amended for goal capacity; the dashed-strip rendering survives in compact form (the redesign spec's §2.2 bullet is amended in the same change).
- Recurring resets and completed one-time goals keep their behavior untouched, as does the tracker's rolled-up state (ADR-0033) — it reads occurrences, never capacity.
- Saves carry `goalCapacityBought` as a purchase count; its per-purchase yield changes from two slots to one, so an existing v6 balance reads one slot short of what the same count bought before. Pre-release tuning, provisional throughout — no migration.
