# Experiment-boundary evidence (#472)

The change opens the playtesting suite's experiment boundary: declared
tuning overrides in the recipe, terminal inspection and game-action
commands on the installed run, intervention recording with the modified
mark, and the dev panel's terminal row and tuning inputs. Captures are
from the verified checkout at the implementation commit.

## Provenance

The capture preflight accepted `http://localhost:5173/` at commit
`4b74b3c2` (this directory's `provenance.json` records it): served
worktree, commit, and clean source all verified. The dev server for this
worktree was launched with `npm run dev` per
[visual evidence](../../agents/visual-evidence.md).

## Captures

- `desktop-terminal.png` (1280×800) — the dev panel's terminal row after a
  live loop driven entirely through it: `help`, `launch fresh-start`,
  `inspect`, `start 25`, `advance 60`, `end`, `prestige`. The scrollback
  carries the ✓ outputs and the engine's own `✗ The horizon is not
  reached yet.`; the suite note reads `Fresh start ✓ … isolated save ·
  modified — 4 interventions`.
- `desktop-tuning.png` (1280×800) — the tuning inputs (openingGrant 60,
  seed 9, days 1) composed through the panel's Run control; the result
  note names the tuning: `… tuned openingGrant=60 …`.
- `desktop-invalid-override.png` (1280×800) — openingGrant 999 through the
  same control: the named rejection
  `Playthrough ✗ Playthrough recipe: override "openingGrant" must be a
  whole number 0–120 — found 999.`, no run replaces the standing record.
- `phone-terminal.png` (390×844) — the suite entry at phone width: the
  panel wraps inside the viewport (366px wide, no overflow), the terminal
  input is a full row with a ≥40px touch floor, the scrollback renders,
  and the scenario/policy/tuning controls stay reachable.

## In-page demonstrations on the verified URL

Read through tab evaluation at 1280×800 (`?dev=1`), all returning live:

- The terminal loop above, with the intervention count and modified mark
  visible in the suite note after four interventions.
- The tuned run note carrying `tuned openingGrant=60`, and the invalid
  override's named rejection through the same Run control.
- Phone layout probe at 390×844: panel box inside the viewport, terminal
  input visible at 173×44px, scrollback rendered.

## Criterion-to-evidence map

| Acceptance criterion (issue #472) | Verification | Class |
| --- | --- | --- |
| Terminal inspection and game-action commands through the established application boundary; visual controls and agents use the same contracts, validation, outcomes, errors | `src/ui/app.terminal.test.ts` — "plays a session loop through the same commands agents call", "reads the installed run's figures…", and "runs the same tuned playthrough from the terminal, the panel inputs, and the agent command" (one dispatcher, identical run ids and errors); `desktop-terminal.png` shows the loop live | automated + manual |
| Declared validated tuning parameters through terminal and visual recipe controls; overrides confined to isolated runs; unsupported/invalid/inapplicable rejected clearly | `src/ui/app.playthrough.test.ts` — "declares the tuning catalog…", "rejects unsupported, invalid, and inapplicable overrides by name…", "pays the declared opening grant…", "binds the declared claim base…", "never lets an override touch the live state or the ordinary save"; `desktop-tuning.png`, `desktop-invalid-override.png` | automated + manual |
| Recipe single owner of initial tuning; interventions recorded; run marked modified; baseline not silently rewritten | `src/ui/app.terminal.test.ts` — "performs real engine actions, records their outcomes, and marks the run modified", "keeps the baseline recipe untouched and rebuilds clean on relaunch", "records the quick grants as interventions on a run, and never on the ordinary save"; the tuned record names its overrides (`playthroughNote` assertions in `app.playthrough.test.ts`) | automated |
| Real action prerequisites and mode restrictions; clear command failures; ordinary-save contamination prevented | `src/ui/app.terminal.test.ts` — the session-clash, purchases-between-sessions, and horizon prerequisites asserted verbatim ("A session is already running.", "Purchases happen between sessions.", "The horizon is not reached yet."), the dev clock's flow-only rule, and the no-run refusal (`/ordinary save is not an experiment/`) with byte-identical localStorage | automated |
| Human/agent parity, valid and invalid overrides, intervention records, modified status, and isolation through the application fixture; desktop terminal/tuning capture and sensible phone entry/layout | All of the above run through the shared app fixture (`createAppFixture`); captures listed above; the phone layout probe recorded in "In-page demonstrations" | automated + manual |
| Parent stories 30–33; tuning-configuration portions of 11 and 38 | Story 30: terminal/agent command parity cases. Story 31: terminal `run`, panel tuning inputs, and agent command produce the same run id. Story 32: the named rejection cases. Story 33: the intervention/modified cases. Story 11 (overrides): the recipe carries validated `overrides` and rides the run id ("reproduces a tuned run…"). Story 38 (entry/layout): `phone-terminal.png` and the phone layout probe | automated + manual |

## Instrument-standards checks

- **Keyboard/touch disclosure** — the terminal is a native text input:
  focus and type on any platform, Enter runs the command (asserted in
  "plays a session loop…" by dispatching keyboard-level handling through
  the app's own listener); no hover-revealed content was added. Verified
  in the suite; a dedicated screen-reader pass is unavailable in this
  environment.
- **Non-color state** — command, ✓, and ✗ lines are distinguished by
  their glyph prefixes (`dev-terminal-line` classes carry color only as a
  supplement); the modified mark is a text suffix on the suite note.
- **Reduced motion** — no animation or transition was added by this
  change; nothing on the new surfaces moves.
