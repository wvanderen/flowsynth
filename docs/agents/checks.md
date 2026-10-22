# Checks: one full pass per revision, targeted runs while iterating

The failure this closes: implementations and reviews ran the full suite and then the entire UI project again on an unchanged revision ([#458](https://github.com/wvanderen/flowsynth/issues/458)). The evidence READMEs record the pattern — a green `npm test`, which already executes every UI file, followed by `npx vitest run --project ui` re-executing those same files with no source change in between. The rerun proves nothing the first run didn't: vitest's projects partition one suite, and `npm test` runs both of them. Required coverage was never the problem; the duplicate execution is. This file is the authoritative description of check selection. The AGENTS.md Checks section summarizes it for the always-loaded context, and related guidance points here rather than restating the rules.

## What each command establishes

| Command | Establishes |
| --- | --- |
| `npm run check` | Typecheck: the repository compiles under strict tsc. |
| `npm test` | Every automated regression in the repository, in one run. Vitest executes two projects: `engine` (`src/engine` and `tools`, parallel forks) and `ui` (`src/ui`, serially with file isolation). The UI project is inside this run — a green full run is a green UI run. |
| `npx vitest run --project ui` | The same UI files, alone. A targeting tool for iteration; not an additional required suite. |
| `npx vitest run <file> -t '<name>'` | One named test in one file. The narrowest targeting tool. |
| `npm run build` | Typecheck plus the static bundle. CI runs it on pushes to main and on every pull request (`.github/workflows/ci.yml`: check → test → build), and deploys run it locally; it is not a separate per-revision local obligation beyond that. |
| Browser evidence | Not a suite at all. When a change touches a UI surface, desktop and phone captures from the verified checkout are owed per [visual evidence](visual-evidence.md), judged against the [instrument standards](../instrument-standards.md). No vitest run substitutes for it, and it never substitutes for the suite. |

## Required once per revision; targeted while iterating

Final verification of a revision is one successful execution of each required suite at that revision — `npm run check` and `npm test` — plus the capture pass when the change touches a UI surface. Both halves of that sentence bind: *once* is the requirement, and *at that revision* is the operative bound. These runs are the last thing before hand-off, at the commit being offered for review.

While iterating, targeted runs are the tool and carry no recording duty: rerun the failing file, chase one case with `-t`, sanity-check UI work against its project with `--project ui`. None of that obliges a matching rerun later — the full pass at the end supersedes the interim state.

## When a result is invalidated

A green run is evidence about the exact source it executed. Anything that changes tracked source afterward invalidates it — your own edit, a rebase, a merge. The recovery is targeted, then full: rerun the suites for the area you touched while working, and finish the revision with one full pass again. Old green never carries across a source change, and a new revision owes the full pass exactly once.

A further full rerun — the whole suite, or the whole UI project on top of a green full suite — is justified by exactly three things:

1. **A source change** since the run in question.
2. **A failure in the run**, including files the environment blocked. The recurring case is a sandbox denying localhost sockets to `tools/dev-provenance.test.ts`: the full run still covered every other file at that revision, so a targeted rerun of the blocked files with the permission granted completes coverage, and the record cites both runs.
3. **An unresolved concern** about what the run covered — a flake, a skipped block, a doubt about a file's inclusion.

Absent all three, the rerun is waste: it re-executes files that just passed, at the same commit, and can only differ by flake.

## Worked example: a UI change, full coverage, no duplicate UI run

The change edits the Focus goal readout (`src/ui/focus.ts`) and adds cases to `src/ui/focus.test.ts`:

1. **Iterate targeted.** `npx vitest run src/ui/focus.test.ts` until green; `-t '<name>'` to chase an individual failing case; optionally `--project ui` once mid-stream to see the file against its project siblings. Nothing here needs recording.
2. **Capture browser evidence.** The change touches a UI surface, so desktop and phone evidence from the verified checkout is owed per [visual evidence](visual-evidence.md). This is a separate required item, not a suite; run it after the code settles, before hand-off.
3. **Commit.**
4. **Final verification, once, at that commit:** `npm run check`, then `npm test`. The full suite just executed every UI file, the new cases included — a `--project ui` rerun would repeat identical work at an unchanged revision.
5. **Review asks for a fix?** That is a new source change: steps 1–4 again — targeted first, then the single full pass at the new revision. The old green doesn't carry over, and the new pass doesn't re-earn the old runs.

Total: two commands at the final revision, one capture pass, zero duplicate full runs.

## For review

A green full suite at the reviewed commit satisfies the UI project; do not request or perform a second full UI run on an unchanged revision. If the concern is coverage, the tool is the [completion record](verification.md) — which named case demonstrates the criterion — not which command ran how many times. The converse also holds: results recorded before the revision's last source change do not cover it, so the record must cite runs at the revision under review, and captures must come from the verified checkout whose commit matches it (the capture preflight enforces that match).
