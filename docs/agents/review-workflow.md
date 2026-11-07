# The review workflow: resolve source before the final expensive evidence

The failure this closes: the final expensive evidence — the multi-hour balance recordings and the browser capture passes — kept being invalidated by source changes a source review would have resolved earlier. Recent tickets correctly regenerated evidence after late source changes (#507's full re-record through the resumable job; PR #514's byte-for-byte restoration after review fixes), but optional cleanup and staggered review fixes repeatedly moved the revision after or under the recordings, spending hours of evidence on revisions no one was offering for acceptance. The priorities, in order: retain acceptance rigor first; avoid preventable evidence invalidation second; keep agent instructions small and authoritative third.

This file is the authoritative description of the stage order. AGENTS.md summarizes it for the always-loaded context. The standing obligations are unchanged — [checks](checks.md) owns check selection, [verification records](verification.md) own the completion record, [visual evidence](visual-evidence.md) owns captures, and [recordings](recordings.md) is the one guide to balance-calibration and playthrough recording. This file orders them; it does not restate them.

## The stage order

One change moves through six stages, in order:

1. **Implement with targeted checks.** Iterate with the targeting tools per [checks](checks.md); targeted runs carry no recording duty and no evidence claim. Build the [completion record](verification.md) as criteria gain cases, not at hand-off.
2. **Preliminary review — the source gate.** One complete review pass over the source and the specification, before any final evidence exists: the diff against the issue's criteria and non-goals, the documented standards, and the record's mapping so far. The record at this point claims only what the revision shows — evidence rows for recordings and captures are written as **owed at the freeze**, never as satisfied. The preliminary review cannot declare completion, and it never claims unavailable final evidence exists.
3. **Resolve the findings together.** The preliminary review reports every finding at once — it is one complete pass, not a stream. The fixes land as one revision with targeted reruns for the touched areas, and the reviewer's second pass reads the fixes. Staggered fixes — one finding per round, each round a new revision — are the defect this workflow exists to kill: every staggered round spends the final evidence again.
4. **Source freeze.** The resolved revision is committed; that commit is the offered revision. Source changes after this point take the recovery path below, not the ordinary path.
5. **Final evidence.** At the frozen revision, once: the required suites per [checks](checks.md)' once-per-revision rule; the recordings per [recordings](recordings.md) when the ticket's acceptance criteria demand recorded evaluation; the captures per [visual evidence](visual-evidence.md) when it touches a UI surface. Final evidence exists for the offered revision — its fingerprint, its commit, its provenance records — and only after the source gate has passed.
6. **Final acceptance — the evidence gate.** Review reads the completion record beside the issue with the final evidence in hand — [verification](verification.md)'s mapping check — and accepts the offered revision or blocks it.

The two gates are different gates, not alternative ways to declare completion. Stage 2 judges source against the spec so that expensive evidence is spent on a revision worth recording; stage 6 judges the offered revision against its criteria with evidence only stage 5 could produce. Passing the source gate is not acceptance; acceptance cannot pass on a record that never resolved the preliminary gate's findings.

## What reviewers classify

Every finding from either gate names its class, and each class carries its own disposition:

- **Blocker — correctness or specification.** The change is wrong against the issue's criteria, contradicts a pinned decision (an ADR, a frozen baseline, a one-place rule), or a criterion's mapping fails review. It blocks the freeze at stage 3 or the acceptance at stage 6, and its resolution is a source fix.
- **Documented-standard violation.** The change works but breaks a documented standard — the [instrument standards](../instrument-standards.md) on a UI surface, the checks' required passes, the recording provenance obligations. Standards are records of decisions, so a violation blocks like a blocker and is fixed, not waived by the reviewer who found it.
- **Optional refactoring suggestion.** No behavior, no criterion, no documented standard touched. It still gets an explicit disposition, recorded beside the finding: **fix with the batch** (only before the freeze, as part of stage 3's one revision), **declined** (with a reason), or **filed** as a follow-up issue. Silence is not a disposition, and an optional suggestion never becomes a late mandatory source edit by insistence — a cleanup arriving after the freeze is a new decision weighed against the evidence it would invalidate, not a review fix.

## A required source fix after the freeze

A genuine blocker found after stage 4 — at the evidence gate, or in review of the offered revision — lifts the freeze, and the recovery is explicit:

1. The fix lands with its targeted checks as one revision, under the same no-staggering rule as stage 3.
2. The evidence at the old revision is invalidated by the rules that already exist, and regenerated honestly: per [checks](checks.md), every suite result at the old revision is invalidated and one new full pass runs at the new revision; per [visual evidence](visual-evidence.md), captures re-run through the capture preflight at the new commit and the old captures are named superseded; per the recording identity rules ([ADR-0083](../adr/0083-the-later-era-evaluation-records-as-one-resumable-job.md)), the new fingerprint re-executes exactly the invalidated units and composition refuses stale ones — the recovery is the resumable job, not a workaround.
3. Re-freeze at the new revision, re-run stage 5's evidence there once, and let stage 6 accept at that revision.

What never happens: a behavior-neutral assertion (one that would pass identically before and after the fix), a reviewer waiver, or a scope note quietly relabeling the old revision's evidence as current. Old evidence is either re-recorded at the new revision or named as superseded in the record — never relabeled.

## An unmet acceptance criterion

A criterion the evidence demonstrates false — or a declared gap the mapping check cannot accept — is a blocker at stage 6. It stays a blocker unless the authorized user (the issue's author or the maintainer) approves a scope change, explicitly, in a recorded decision on the issue. Writing the miss down in the completion record, deferring it to a later ticket, or noting it in the PR documents the blocker; none of those approve the change. The recorded pattern to follow is [later-era-productivity](../later-era-productivity.md)'s: the unmet criterion stayed a named merge blocker alongside "no such scope decision is recorded here".

## Worked example: a balance ticket through both gates

An illustrative reconstruction in the shape of [checks](checks.md)' worked example — not a historical record. The ticket: retune two World balance figures so mature boards reach the calibrated opening-era window. It touches `BALANCE.world`, the frozen baseline artifact compiled beside it ([ADR-0079](../adr/0079-the-calibrated-century-baseline-is-frozen-for-save-translation.md)), the suite's frozen-figure comparison, and the one Catalog line where a retuned figure reads — a UI surface, so captures are owed.

1. **Implement with targeted checks.** Constants, baseline artifact, and the frozen-figure expectations change in one edit; targeted runs chase the frozen-figure and classification cases. Nothing is owed yet: recording the 80-walk matrix now would produce evidence for a revision no one has reviewed.
2. **Preliminary review (the source gate).** The reviewer reads the diff against the issue and the standards and the record's mapping so far. The record's rows at this point: the automated cases by name, the recording row **owed at the freeze**, the capture rows **owed at the freeze** — nothing claims evidence that does not exist. Findings, reported all at once: **(1) Blocker:** the new band also shifts the entry depth, which the spec pins untouched; **(2) Documented-standard violation:** the retuned figure is asserted in the suite but not compiled into the frozen artifact, so the baseline would drift from the shipped constants; **(3) Optional suggestion:** the ladder-walk helper two cases share could be extracted. Dispositions: (1) and (2) block the freeze; (3) is **filed** as a follow-up issue — bundling it would be a second source change between the checks and the evidence, for no behavioral gain.
3. **Resolve the findings together.** One revision: the band gated below the entry depth, the artifact re-frozen, the expectations matching. Targeted reruns for the touched area; the second review pass reads the fixes and adds nothing — the pass was complete, not a stream.
4. **Source freeze.** The fixes commit; that commit is the offered revision F.
5. **Final evidence, once at F.** `npm run check`, then `npm test` — the once-per-revision rule; the interim targeted runs carry nothing forward. The Catalog line changed, so the capture preflight runs at F and desktop plus phone captures follow it. The recording follows [recordings](recordings.md) to its recorder, and the resumable job's units carry F's fingerprint; composition verifies every unit against F.
6. **Final acceptance (the evidence gate).** The record beside the issue, one row per criterion, with the obligations they demonstrate still standing:

   | Criterion (abridged) | Verification | Class |
   | --- | --- | --- |
   | Mature boards reach the opening-era window | the composed report's per-era durations at F, cited in the record | manual evidence (recording) |
   | Retuned figures re-freeze beside the change | "matches every frozen figure to the committed save-translation baseline" (`tools/century.test.ts`) at F | automated |
   | The Catalog line reads the retuned figure | desktop and phone captures at F with provenance records, judged against the instrument standards | manual evidence |
   | The ordinary checks hold at the offered revision | `npm run check`, then `npm test`, once, at F | automated |

   Acceptance is declared at F, from evidence that exists at F. The walkthrough's obligations are the standing ones, unchanged: one full pass per revision, provenance-verified captures.

**The genuine post-freeze blocker.** The acceptance reviewer reads the composed report and finds three of eight seeds push the opening era past its window — a specification blocker at stage 6, not a taste note. The freeze lifts: the fix lands with targeted checks as revision F′; per [checks](checks.md) one new full pass runs at F′ and F's green carries nothing; per [visual evidence](visual-evidence.md) the preflight runs at F′ and captures re-run, F's named superseded; per the identity rules the job re-executes the invalidated units and refuses stale ones, and the record cites F′'s composed report while naming F's artifacts superseded — no behavior-neutral assertion, no reviewer waiver, and no "later ticket" note relabels F's evidence as current. The stage-2 cleanup stays filed: the blocker fix is the fix, not a vehicle for it. Re-freeze at F′, re-run stage 5's evidence there once, and stage 6 accepts at F′.

Each revision's evidence was spent exactly once, at the revision it describes.
