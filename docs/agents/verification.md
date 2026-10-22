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

**Manual practice is goal- and development-eligible, but never reward-eligible.** The criterion has two halves that need different cases: manual logs advance goals and development (`goals.test.ts` "manual logs complete goals between sessions", `habits.test.ts` "manual logs advance development without nous or charge"), and manual time earns no charge — a manual-only completion banks nothing ("a manual-only completion banks nothing", `goals.test.ts`), a mixed completion banks exactly the live share ("a half-live, half-manual completion banks exactly the live share of the k× multiple"). The #445 miss was the survival half: manual progress lost across a target edit, now pinned by "a target edit retains qualifying practice: 30 to 60 after 20 qualifying minutes" and "a large manual log preserves the live share earned before completion".

**A session crossing the calendar boundary.** Attribution must follow the local day, and an edit must split a session that straddles midnight without replaying credit: "a cadence edit splits live practice at midnight and never replays fuel", "daily goals reset at the local calendar day boundary", "a cadence edit to once reads from the goal's creation; daily reads from local midnight" (all `goals.test.ts`). The #445 miss — sessions misattributed across midnight — is invisible to a count: no test in the count straddled midnight, so green said nothing about the boundary.

**Removed goals keep their history identity.** Retirement moves a goal out of active controls without losing what history rows resolve: "removal, replacement, edits and reload preserve previous goal descriptions" and "retaining one row activates it with its record and retires the siblings to history" (`goals.test.ts`); "retired goals stay in history data without appearing in active goal controls or meters" and "session history resolves the full description of a retired migrated goal" (`focus.test.ts`). The #445 miss was identity loss behind a green suite: every active-path test passed because none revisited history after removal.

**Readouts hold through running, paused, and resumed states.** Live figures move during practice, freeze read-only while paused, and survive reload: "the PLAN reads stay live through practice, pause, resume, and goal completion" (`focus.test.ts`), "the unified door opens read-only Focus while running and paused" and "relaunching with a running session resumes it; the owed report fires, nothing auto-closes" (`app.session.test.ts`). The #447 miss was subtler than a missing test: the cases mapped to the criterion's live-read half asserted the goal row's *absence* while running and paused, demonstrating the lock half while contradicting the live half — and the suite stayed green.

## Worked completion record

The record for #447 as it should have read at implementation review — including the row that was actually mapped wrong. The criterion is quoted from the issue: *"During practice and pauses, goal and advancement reads remain available and live while habit selection, editing, and allocation remain locked."*

| Criterion (abridged) | Verification | Class |
| --- | --- | --- |
| Preparation reads the selected habit's goal and class summary | `focus.test.ts` "completed goals, a fresh pair, and the maximum level read on preparation" | automated |
| Goal controls only in Edit habit; allocation only in Develop | `focus.test.ts` "the goal section creates the habit's one goal; the form carries no habit select and no palette", "the tree repeats no advancement figures — the summary owns them" | automated |
| Preparation edge states (no habit, no goal, archived, long name, max level) | `focus.test.ts` "archived habits leave the chips and preparation; a long name reads whole" | automated |
| **Reads live during practice and pauses; controls locked** | **lock half only — the mapped locked-read tests assert `.habit-goal` is null while running and paused; the "available and live" half has no case (declared gap)** | **automated, partial** |
| Full journey: choose → plan → edit → develop → practice → history | `focus.test.ts` "the full journey: choose, plan, edit, develop, practice, pause, resume, inspect, finish, revisit" | automated |
| Desktop and phone evidence of hierarchy, focus, touch, non-color state | `docs/evidence/<slug>/` captures | manual |

The omission becomes visible to the reviewer without running anything: the criterion's words are *available and live* during practice and pauses, and the rows mapped against that half — the locked-read tests that predate f584530 — assert `.habit-goal` is null in both states. The assertions demonstrate the lock half and contradict the live half: the suite was green the whole while, and green never touched the question. Reading the assertions against the requirement's words is the whole check; nothing needs to run. The record after the fix (f584530) fills the row: "the PLAN reads stay live through practice, pause, resume, and goal completion" (`focus.test.ts`) asserts the goal figures and the advancement read present and moving during practice, frozen while paused, and completing on resume — mapped, automated, and no longer a gap.

## External follow-up

The shared `/implement` and `/code-review` skills live outside this repo and say nothing about this mapping. This workflow does not depend on them: the AGENTS.md pointer is always loaded here, so the record is owed on every acceptance-criteria change in this repository regardless of which skill drives the session. Upstream follow-up, tracked outside this repo: fold "map each criterion to named evidence while implementing" into `/implement` and "check the mapping against the originating requirement" into `/code-review`.
