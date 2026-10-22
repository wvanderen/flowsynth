# Verification records: every acceptance criterion maps to named evidence

The failure this closes: reviews passed on suite size while regressions shipped. The goal-ownership round ([#445](https://github.com/wvanderen/flowsynth/issues/445)) declared victory on 1,777 passing tests while losing manual progress across edits, misattributing sessions across midnight, and losing removed-goal history identity. The session-preparation round ([#447](https://github.com/wvanderen/flowsynth/issues/447)) passed its implementation review while the live goal read during practice — a written acceptance criterion — had no case exercising it. A green suite is evidence about the cases it contains and about nothing else. The fix is a workflow, not a framework: implementation identifies a concrete behavioral test or recorded verification per criterion; review checks that mapping against the requirement, not the test count.

## The completion record

One completion record per change, in one reviewable place: the pull request's **Verification** section, or the closing issue comment when no PR is opened. It lists every acceptance criterion from the originating issue beside its named verification. Built while implementing — a criterion is mapped when its case exists, not at hand-off. A criterion with no case at the end of implementation is written down as a gap in the record; review then either accepts the declared gap or blocks on it. A criterion silently absent from the record is the failure mode this workflow exists to kill.

Trivial documentation edits don't owe a table: a one-line record — "the diff reads as the intent" — satisfies this. What never satisfies it: "the suite passes", a test count, or the pass of a neighboring test. Counts are review decoration, not evidence.

## The three classes of verification

The record tags every mapping with one of:

- **Automated check** — a named test, cited by file and test name, whose assertions would fail if the behavior regressed. The name promises the behavior; the assertions are what review reads.
- **Manual evidence** — verification recorded outside the suite: captured desktop and phone evidence per [visual evidence](visual-evidence.md), a scripted walkthrough of the served checkout, a run log. Cited at its location.
- **Unavailable** — the check cannot run here (no harness for the environment, a capture pass that failed, reduced motion that cannot be emulated). Recorded as unavailable with the reason, per the [instrument standards'](../instrument-standards.md) evidence rules — never claimed as verified and never dropped.

Every criterion lands in one of the three. "Should work" is not a class. A mapping can be automated and still partial — a case that demonstrates part of a criterion leaves the rest a declared gap in the same cell.

## Implementation: choose cases, not counts

Prioritize behavioral fidelity and boundary cases over test volume. Before writing code, read each criterion as a question — *what observable behavior would be different if this were broken?* — and answer it with a case:

- **Boundaries first.** The calendar edge, the paused state, the removed-then-retained row, the empty selection. Happy paths already have coverage; regressions live at edges.
- **State transitions.** Anything that changes over a session — running, paused, resumed, reloaded — needs its case per state, not one case in one state.
- **Existing regressions are the template.** When a similar behavior already has a boundary test, the new work matches its shape. The worked examples below are all existing tests in this repo's suites.

## Review: check the mapping against the requirement

Review reads the record beside the originating issue and asks, per criterion:

1. **Is it mapped?** Every criterion from the issue appears in the record — including the ones the implementation didn't touch.
2. **Does the named case actually demonstrate it?** Read the test's assertions, not its name. A test named for the behavior that asserts something weaker does not demonstrate the behavior.
3. **Does the case hold at the boundaries the criterion implies?** A criterion about progress across edits that is only demonstrated without an edit in between fails here.
4. **What would this mapping miss if the behavior broke tomorrow?** If the honest answer is the criterion itself, the mapping fails and the criterion is a gap — declared or not.

Review never accepts a suite count in place of any of these. The reviewed goal-ownership round is the contrast case: every number was green and three behaviors were wrong.

## Worked examples from the regressions

These are existing tests, cited as the shape a mapping should name — each pins a boundary or a session state that a count-only record would have missed.

**Manual practice advances goals and practice history; credited flow earns class progress and goal fuel.** Manual logs complete goals (`src/engine/goals.test.ts` "manual logs complete goals between sessions") and accrue history without class experience or roll progress (`src/engine/classes.test.ts` "manual practice logs advance neither class experience nor roll progress", consistent with [ADR-0074](../adr/0074-world-progression-gives-board-power-a-purpose-without-demanding-session-attention.md)). Manual-only goal completion banks no fuel ("a manual-only completion banks nothing", `src/engine/goals.test.ts`); mixed completion banks exactly the live share ("a half-live, half-manual completion banks exactly the live share of the k× multiple"). Survival across edits needs its own case: "a cadence edit recalculates from qualifying practice in the new period" includes a manual log before the edit and asserts that its time remains in goal progress but outside live credit. "a target edit retains qualifying practice: 30 to 60 after 20 qualifying minutes" demonstrates live practice surviving a target edit; it does not demonstrate manual progress surviving that edit. That specific manual-plus-target boundary remains a gap in this example's mapping.

**A session crossing the calendar boundary.** Attribution must follow the local day, and an edit must split a session that straddles midnight without replaying credit: "a cadence edit splits live practice at midnight and never replays fuel", "daily goals reset at the local calendar day boundary", "a cadence edit to once reads from the goal's creation; daily reads from local midnight" (all `goals.test.ts`). The #445 miss — sessions misattributed across midnight — is invisible to a count: no test in the count straddled midnight, so green said nothing about the boundary.

**Removed goals keep their history identity.** Retirement moves a goal out of active controls without losing what history rows resolve: "removal, replacement, edits and reload preserve previous goal descriptions" and "retaining one row activates it with its record and retires the siblings to history" (`goals.test.ts`); "retired goals stay in history data without appearing in active goal controls or meters" and "session history resolves the full description of a retired migrated goal" (`focus.test.ts`). The #445 miss was identity loss behind a green suite: every active-path test passed because none revisited history after removal.

**Readouts hold through running, paused, and resumed states.** Goal figures move during practice, freeze read-only while paused, and complete after resume: "the PLAN reads stay live through practice, pause, resume, and goal completion" (`focus.test.ts`). Session restoration has separate coverage in `src/ui/app.session.test.ts` "relaunching with a running session resumes it; the owed report fires, nothing auto-closes", but that case does not assert restored goal or advancement readouts; those readouts after reload remain a gap in this mapping. The #447 miss was subtler than a missing test: the cases mapped to the criterion's live-read half asserted the goal row's *absence* while running and paused, demonstrating the lock half while contradicting the live half — and the suite stayed green.

## Worked completion record

An illustrative reconstruction of #447's implementation-review record, with one row per acceptance criterion (abridged, in issue order). This is an assertion audit, not a claim that historical checks or captures were rerun. Test names below refer to `src/ui/focus.test.ts`; the live-read row explicitly uses the pre-f584530 assertions. Gaps remain visible even where another part of a row has automated evidence. The criterion is quoted from the issue: *"During practice and pauses, goal and advancement reads remain available and live while habit selection, editing, and allocation remain locked."*

| Criterion (abridged) | Verification | Class |
| --- | --- | --- |
| Focus opens preparation; picking a habit selects it without an editor | "opening Focus lands on preparation; picking a habit selects it without opening an editor" asserts the destination and authoritative selection | automated |
| Duration and session actions preserve all capabilities, including unstructured practice | "the full journey: choose, plan, edit, develop, practice, pause, resume, inspect, finish, revisit" exercises a 25-minute session and its actions; **gap: all duration capabilities and unstructured practice are not demonstrated by this case** | automated, partial |
| Optional goal and class summary; deliberate Edit habit and Develop | "the selected habit's goal and compact class summary stand in one hierarchy, controls absent" and "Edit habit enters the editor destination; Develop enters the tree; each returns" assert reads and destinations | automated |
| Goal controls only in Edit habit; allocation only in Develop; separate History; no Goals or legacy build surface | "the selected habit's goal and compact class summary stand in one hierarchy, controls absent" checks controls absent in preparation; "Edit habit enters the editor destination; Develop enters the tree; each returns" checks controls at their destinations and allocation absent on return; the full-journey case opens History separately. **Gap: exclusivity across all other surfaces and absence of legacy destinations are not established by these cases** | automated, partial |
| Figures once in summary; statistics and tagged notes accessible without crowding preparation | "the selected habit's goal and compact class summary stand in one hierarchy, controls absent" asserts one summary; "the tree repeats no advancement figures — the summary owns them" checks the tree. **Gap: statistics and tagged-note access and preparation hierarchy need their own evidence** | automated, partial |
| Preparation edge states: no selection, no goal, fresh/archived, long name, completed, max level, zero points, unresolved choice | "preparation stands for no selected habit, no goal, and an unresolved carried-over choice"; "completed goals, a fresh pair, and the maximum level read on preparation" (also asserts zero tree points); "archived habits leave the chips and preparation; a long name reads whole" | automated |
| **Reads live during practice and pauses; controls locked** | **lock half only — the mapped locked-read tests assert `.habit-goal` is null while running and paused; the "available and live" half has no case (declared gap)** | **automated, partial** |
| Full journey: choose → duration → edit target/color → Develop → practice/pause/resume → progress → history | "the full journey: choose, plan, edit, develop, practice, pause, resume, inspect, finish, revisit" exercises these actions and visible results | automated |
| Verified desktop/phone evidence: hierarchy, session actions, focus, touch, non-color selection, reduced motion | No historical capture artifacts or run results identified in this reconstruction; a placeholder directory would not establish any of these checks | unavailable — historical evidence not established |
| Scope exclusions: balance, extra classes, charge resources, duration limits/presets, header/Notes/World redesign | No historical scope audit recorded in this reconstruction; review the original implementation diff against these exclusions | unavailable — historical verification not recorded (gap) |

The omission becomes visible to the reviewer without running anything: the criterion's words are *available and live* during practice and pauses, and the rows mapped against that half — the locked-read tests that predate f584530 — assert `.habit-goal` is null in both states. The assertions demonstrate the lock half and contradict the live half: the suite was green the whole while, and green never touched the question. Reading the assertions against the requirement's words is the whole check; nothing needs to run. The post-fix mapping (f584530) fills the live-read gap: "the PLAN reads stay live through practice, pause, resume, and goal completion" (`focus.test.ts`) asserts goal figures and advancement reads during practice and pauses, goal figures frozen while paused, and goal completion after resume — mapped, automated, and no longer a gap.

## External follow-up

The shared `/implement` and `/code-review` skills live outside this repo and say nothing about this mapping. This workflow does not depend on them: the AGENTS.md pointer is always loaded here, so the record is owed on every acceptance-criteria change in this repository regardless of which skill drives the session. Upstream follow-up, tracked outside this repo: fold "map each criterion to named evidence while implementing" into `/implement` and "check the mapping against the originating requirement" into `/code-review`.
