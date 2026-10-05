## Agent skills

### Issue tracker

Issues live as GitHub issues in `wvanderen/flowsynth`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults: role name = label string (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Checks

Fresh worktrees carry no `node_modules` — run `npm install` before your first check. Then:

- `npm run check` — typecheck (tsc)
- `npm test` — full suite (~30s); `src/ui/app.test.ts` is the slow file, so iterate one failing test with `npx vitest run <file> -t '<name>'`
- UI regressions: run `npx vitest run src/ui/app.test.ts` for current rendering and interaction checks. For browser layout and animation checks, inspect `npm run dev` opened at `/?dev=1`.
