## Agent skills

### Issue tracker

Issues live as GitHub issues in `wvanderen/flowsynth`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults: role name = label string (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Issue briefs

Briefs for implementation agents carry intent, priorities, non-goals, and one-place rules — never bare element lists. See `docs/agents/briefs.md`.

### Verification records

Work against acceptance criteria maps every criterion to a named test or recorded verification in one completion record; review checks the mapping, never the suite count. See `docs/agents/verification.md`.

## UI surfaces

When changing or reviewing a UI surface (panel, sheet, readout, control, or its copy), read `docs/instrument-standards.md` first and judge the changed surface against the pinned prototype there; record checks that cannot run as unavailable.

## Checks

Fresh worktrees carry no `node_modules` — run `npm install` before your first check. Then:

- `npm run check` — typecheck (tsc)
- `npm test` — the full suite: engine and UI projects in one run (UI files serially with isolation; engine files in parallel). It includes the UI project, so a green full run leaves nothing for a separate UI pass to find. An unchanged revision owes one `npm run check` and one `npm test`; a further full run needs a source change, a failure, or an unresolved concern since the last one.
- Targeted iteration: `npx vitest run <file> -t '<name>'` for one case, `npx vitest run --project ui` for the UI files alone while iterating. Any source change invalidates earlier runs — finish each revision with targeted reruns for the touched area, then one full pass.
- Browser evidence is a separate requirement, not a suite: when the change touches a UI surface, launch this checkout with `npm run dev` — it picks a free port, prints the served worktree, commit, source cleanliness, and URL, and tees logs to `.dev/server.log` — then run the capture preflight (`node tools/evidence-preflight.mjs --url <url>`) and capture desktop and phone evidence per `docs/agents/visual-evidence.md`.

The authoritative description of check selection, invalidation, and a worked UI example: `docs/agents/checks.md`.
