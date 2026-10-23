# Resource curves: PR #479 review corrections

Source: `74f92ba0038b7f3ad1e87f84bb1f9bb3c9665c82` (see the full commit in `provenance.json`), runner version 6. The capture preflight accepted this checkout at http://localhost:5175 with clean source. This record supersedes the original pass's exact-moment-only decision history and unavailable desktop/phone captures.

## Acceptance criteria and verification

All named tests below live in `src/ui/app.playthrough.test.ts` and drive the shared `App` commands.

| Issue #470 criterion | Named verification | Class |
| --- | --- | --- |
| Plot balances/rates against elapsed time, distinguish credited practice, mark purchases/unlocks/sessions/prestige | “records a frozen snapshot for every plotted sample and every event's exact moment”, “classifies curve markers, and declined attempts and unlisted actions plot none”, “reports both clocks per sample, and the axes switch”; desktop/phone plot captures | automated + manual |
| Exact historical snapshots consistent with samples and events | Snapshot test above recomputes plotted rates; “binds recovery milestones at their own stamp before recovered exit” and “… before budget exit” assert terminal recovery milestones have their own matching elapsed/credited stamp and state, rather than `snapshot: -1` | automated |
| Matching read-only board/state and recent reasons, shared visual/agent inspection | “draws the selected board layers and exposes the same frozen state without editing the live board” verifies cell correspondence, a rare power mutator, Column, weapon charge, enemy HP, and no editing controls; “keeps preparation decisions at a session boundary without future or stale sessions” verifies preceding decisions remain through the session and its breather, excluding older sessions/future decisions; “inspection never mutates the active run, the save, or the recorded state” | automated |
| Action record owns reasons; selection owns inspected board/state; no conflicting store | Selection tests assert `inspection.state` is the selected record's frozen state by identity and each decision belongs to `record.events`. Recent means the latest completed session and its preparation, through the selected snapshot; before the first session, all recorded preparation so far. No explanation copies or independently mutable board are created | automated |
| Shared-boundary numerical outcomes, correspondence, non-mutation, desktop/phone and applicable accessibility evidence | Tests above; keyboard Enter advances selection from 1 to 2 and retains Next focus; glossary focus opens, Escape closes (`aria-expanded` true → false); phone click opens Arete's portaled gloss; capture/limitations below | automated + manual, touch/reduced-motion emulation unavailable |
| Stories 27–29 and historical parts of 18, 26, 30, 38; no resume/fork | Plot, clock, historical board, decision-history and non-mutation cases above; actual desktop and phone layouts below. Existing commands remain the selection boundary; inspection does not install a historical state into the live game | automated + manual |

## Presentation corrections and captures

- **Clipped floating panel:** the shared `inst-panel` / `inst-panel-face` pair draws the top-right/bottom-left cuts and continuous hairline. Both layers' computed clip is the shared 14px polygon. Square controls and open internal divisions match the pinned instrument/controls prototypes and current amendments.
- **Glossary disclosure:** resource legends, balances, prestige/breather marks and World heading use `termTipHtml` and `wireTooltips`. The board-layer test also exercises focus, Escape and click disclosure. The original roster is replaced by board geometry; module faces retain the shared glyphs, rarity/tier/level notation and exact preview ν/s. Mutators precede Modules; World uses square plates. All layers have keyboard-focusable scroll regions and tray contents when present.
- **Desktop 1280×900:** `desktop.png` shows curves, recent reasons, clipped rim and Mutators; `desktop-boards.png` scrolls through Mutators, Modules and World. Both captures use the same verified source and tab.
- **Phone 390×844:** `phone.png`, `phone-boards.png` and `phone-disclosure.png` show the bounded panel, scrollable plots/boards and portaled Arete gloss. In-page reads confirmed `innerWidth=390`, `innerHeight=844`, panel x=12, width=366, bottom=832. The desktop dimensions were likewise confirmed through `innerWidth`/`innerHeight`, not the stale resize response.
- **Non-color:** axis selection has an inset underline and `aria-pressed`; series use dash patterns, markers use glyphs, selected samples fill, and decisions show ✓/✗. Board identity uses hexagons, module glyphs, rarity marks and World square plates.
- **Motion:** no element in the curves panel had a running CSS animation (`animationName !== 'none'` count 0). Existing button hover transitions remain. The panel's reduced-motion media rule disables both transitions and animations; actual reduced-motion emulation is unavailable in this browser tool, so that mode is not claimed as exercised.

## Reproduction

Open the verified server at `?dev=1`, then:

```js
const app = window.__flowsynth;
const record = app.devRunPlaythrough({ budgetDays: 1, seed: 7 });
app.devToggleCurves();
app.devInspectPlaythrough(record.events.find(e => e.kind === 'session' && e.ok).snapshot);
```

The first desktop capture is at boundary 2/6. Focus Next and press Enter to select sample 3/6; focus a glossary trigger, then Escape to dismiss without losing focus. The remaining captures use that selection. Scroll `.dev-curves-face` to 560 (desktop boards) or 650 (phone boards). The phone disclosure capture clicks the Arete trigger in `.dev-curves-line2`.

Real touch input was unavailable: phone click verifies the shared click/pin path but is not presented as a device touch test. Visibility confirmation is unavailable because the preview reported `visible:false`, though navigation, evaluation and same-tab captures succeeded. No screenshot or viewport attempt failed in the final pass.

## Final checks

At source `74f92ba0038b7f3ad1e87f84bb1f9bb3c9665c82`, `npm run check` passed and one final full `npm test` passed: 95 files, 1,914 passing tests, two skipped. The final targeted historical-inspection/curves pass also passed (11 cases). An earlier full run was stopped when the first browser pass exposed the board-bounds correction; it is not counted as final verification. No implementation source changed after the final captures and final full pass.
