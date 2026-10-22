# Flow control and header status

Confirmed by the user; implementation authorized. Operate surface: the player must recognize the current session state and its main action at a glance during practice.

## Confirmed decisions

- Replace the power key plus separate action readout with one full text button. Its silhouette has two clipped corners. This deliberately reopens the square-control rule for this main action only; hexagonal and four-corner-clipped alternatives are rejected.
- To the right of the logo, show the FlowSynth wordmark above a state readout: `Upgrade mode`, `Flow active`, `Flow paused`, or `Breather active`.
- When width becomes constrained, hide the wordmark before the status. Compact visible status remains a priority on phone alongside reachable session controls.
- The header reports the current state; the button names the action it performs.
- Clip the main button's top-right and bottom-left corners, matching the outer-panel corner pair. The button contains text alone, with no power or completion icon; its words remain visible on phone.
- Action labels are `Enter flow` in upgrade mode, `Finish flow` while running or paused, and `End breather` during a Breather. Existing action behavior remains unchanged.
- Use a consistent vermillion action treatment across modes, with clear hover and keyboard-focus responses. The status readout carries the mode distinction rather than dim-idle/bright-live button styling.

## Responsive layout

- Preserve a single-row header. Hide the FlowSynth wordmark first when space is constrained. If the status cannot fit beside the controls, move it directly below the header rather than wrapping the header into two rows.
- Keep the complete status wording and main action label readable, with usable touch targets. Preserve the existing clock, Notes, Pause/Resume, and Settings actions and the desktop centered-console composition.
- Choose the responsive thresholds from actual content fit during implementation, including long habit names; no fixed breakpoint is approved by this interview.

## Existing contracts to reconcile

- Instrument standards and ADR-0070 reserve clipping to floating outer panels, with top-right/bottom-left cuts. The main action will need an explicit scoped exception after the design is confirmed.
- The header-and-ledger follow-up in `docs/interface-refinement-brief.md` specifies logo alone with no wordmark. The confirmed wordmark/status direction supersedes that choice for this surface.
- Current production labels are Enter flow, Exit flow, and End breather. Earlier documentation says Finish for the live action. The confirmed `Finish flow` label resolves that discrepancy; update the affected presentation records alongside implementation.

## Verification status

Current behavior inspected in source. Browser comparison against the pinned prototype, desktop/phone layout, keyboard/touch access, non-color distinctions, and reduced-motion verification have not run and are unavailable at this interview stage. The user confirmed the complete design and authorized implementation.

## Scope and completion

This is a focused refinement of the existing Rack identity. Preserve session behavior, the separate Pause/Resume control, clock and habit information, and all unrelated surfaces. The main button is the sole scoped exception to square control geometry. Update affected presentation contracts with implementation; these choices introduce no new domain terms or hard-to-reverse architectural decision, so no new glossary or ADR is needed.

Completion requires the repository checks and recorded desktop/phone evidence for all four modes, narrow-width status fallback, keyboard focus, touch access, non-color status readability, and reduced motion. Compare the changed surface against instrument standards with the explicit shape and wordmark amendments above. Record unavailable checks honestly.


## Phone header trial — 2026-10-22

The user requested a two-row phone layout after reviewing the compact implementation. Below 600px, the first row carries logo, FlowSynth with mode status, and Settings; the second carries Pause/Resume, the clock/Notes well, and the labeled main action. The wordmark and status now fit within the header. This supersedes the single-row phone constraint and below-header status fallback on phones only; desktop and intermediate-width presentation remain unchanged. Session behavior and the clipped vermillion action remain unchanged.
