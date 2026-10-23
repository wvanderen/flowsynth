# PR #481 review fixes

Source revision `0241286`; `npm run dev` served this worktree at
`http://localhost:5173/?dev=1`. The capture preflight accepted clean source
and wrote `provenance.json` before capture.

- `desktop.png`, 1280×800: launch fresh-start, start 25, pause, resume,
  advance 60, end, and `action buyCapacity []`. The last action returns the
  engine's insufficient-nous reason. Opening grant is populated with 60;
  both tuning names remain visible.
- `phone.png`, 390×844: fresh-start entry with Opening grant populated.
  Both persistent labels fit inside the viewport (126px each). Terminal
  measures 172.8×44px and stays within the viewport.
- Live visual-path reproduction after the fix: `devLaunchScenario("fresh-start")`,
  then `beginFlow(null)`, yields mode flow, modified true, and one successful
  startSession intervention. The former unmarked visual mutation is fixed.

## Verification

All cases below are in `src/ui/app.terminal.test.ts` and use the application fixture.

- Visual recording, baseline rebuild, ordinary-save isolation: **records visual
  session actions and purchases without rewriting the baseline or ordinary save**.
- Pause/resume, provisional-time resolution, engine refusals: **offers pause,
  resume, honesty, and World actions with real engine outcomes**.
- Persistent tuning names after entering values: **keeps tuning names visible
  after values are entered**.
- Declared catalog, argument validation without mutation, habit actions,
  upgrades, exact recorded command arguments: **validates data arguments before
  mutation and exposes the remaining workspace actions**.
- Successful World placement/retrieval/purchase/honing: **records successful
  visual and terminal World actions with equivalent state**.

These supplement the original criterion map in [issue-472](../issue-472/README.md).
The PR's Verification section owns the complete criterion-to-evidence mapping.

## Instrument standards

Persistent visible labels replace placeholder-only identity; controls remain
square with open divisions, matching the pinned instrument/control references.
The labels are native wrapping labels (programmatically associated and included
in their inputs' accessible names). Command outcomes retain textual ✓/✗ and
modified status, so state does not depend on color. No motion was introduced.

Visibility confirmation is unavailable: the preview reports visible false while
same-tab snapshots and live geometry reads succeed. A dedicated screen-reader,
physical-touch, and reduced-motion emulation pass is unavailable; those are not
claimed as verified. Keyboard Enter dispatch is covered by the existing terminal
fixture case.
