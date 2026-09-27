# The Arete pill floats at every width and is never dismissed

The spec is explicit that the Arete accumulator floats as a translucent pill over the board's bottom edge at every width, and that only the zoom cluster reacts to open sheets ("the zoom cluster rises above any open sheet"). The first build nevertheless faded the pill out while a phone bloom sheet was open — a kindness to the sheet that silently broke the "at all widths" promise: the prestige readout and the practice countdown vanished whenever a module was inspected. The spec review of PR #143 (2026-09-26) flagged it; the fix landed the same round. This ADR records the rule so the fade is not re-added as polish later.

## Decision

- **Nothing ever hides the pill.** No opacity, no display toggle, no sheet-open state dismisses it — at any width, in any mode.
- **An open sheet covers it instead.** The bloom's bottom sheet stacks above the pill (bloom z 20, pill z 14), so inspection covers the board's lower edge — the pill included — exactly as it covers the board, and the pill re-emerges untouched on close. Overlap is geometry; dismissal would be a state change the spec never asked for.
- **The zoom cluster alone reacts to sheets**, rising above them so inspection never buries it (§7). It shares the pill's lane on phone without competing: the pill's phone geometry leaves the cluster's lane clear.

## Consequences

- The prestige button and the practice beat are readable at every width whenever no surface physically covers them.
- Any future sheet that opens over the board's lower edge inherits the same rule: cover, never dismiss.
