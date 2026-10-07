## Agent skills

### Issue tracker

Issues live as GitHub issues in `wvanderen/flowsynth`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults: role name = label string (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## UI surfaces

When changing or reviewing a UI surface (panel, sheet, readout, control, or its copy), read `docs/instrument-standards.md` first and judge the changed surface against the pinned prototype there; record checks that cannot run as unavailable.

## Checks

Fresh worktrees carry no `node_modules` — run `npm install` before your first check. Then:

- `npm run check` — typecheck (tsc)
- `npm test` — full suite (UI files run serially with isolation; engine files run in parallel); iterate one failing test with `npx vitest run <file> -t '<name>'`
- UI regressions: run `npx vitest run --project ui` for current rendering and interaction checks across the domain suites. For browser layout and animation checks, launch this checkout with `npm run dev` — it picks a free port, prints the served worktree, commit, and URL, and tees logs to `.dev/server.log` — then confirm the preview's provenance and capture desktop and phone evidence per `docs/agents/visual-evidence.md`.
