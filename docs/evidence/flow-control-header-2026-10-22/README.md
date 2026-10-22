# Flow control and header status verification

Source: `89466eba`, active checkout `/Users/eggfam/.t3/worktrees/flowsynth/t3-698b54ac`. Server `http://localhost:5174/?dev=1`; [accepted provenance](provenance.json). The user confirmed [the brief](../../flow-control-header-brief.md). Evidence was captured only after the source commit passed preflight. Evidence outputs are excluded from source cleanliness.

## Acceptance mapping

| Criterion | Named verification |
| --- | --- |
| Full text-only main action; no separate plate | `app.test.ts`: “the main switch's accessible name tracks its state and never falls back to the title (#347)”; all eight captures show text inside the control |
| Enter flow / Finish flow running and paused / End breather | Same test plus “names Breather status separately from its early-exit action”; all four modes captured at each viewport |
| Consistent vermillion, two matching clipped corners | `theme.test.ts`: “uses one readable vermillion treatment for every main action”; visual inspection of desktop paused and phone Breather confirms top-right/bottom-left silhouette |
| Wordmark above four-state status | Action-name test asserts upgrade, active, paused status; Breather test asserts Breather status; desktop captures show wordmark/status beside logo |
| Wordmark yields, status moves beneath single-row header | Phone captures at live `innerWidth=390`, `innerHeight=844`; measured header 390×64, status at y=63 with height 24; logo and all controls remain in one row. Desktop live viewport 1440×900 confirmed through evaluate |
| Existing controls and behavior preserved | Existing header tests retain Notes, Settings, Focus and Pause/Resume behavior; browser focus main action then real Enter changed mode to flow and status to Flow active |
| Keyboard access and non-color distinctions | Browser focus main action: activeElement flow-switch, solid outline with -4px inset. Four mode names carry state without color. Labels are native button text and match accessible names |
| Readable action contrast | Existing theme contrast test verifies switch-ink on switch-deep ≥4.5:1. Browser computed base: rgb(255,243,236) on rgb(169,76,43). Hover darkens toward panel-deep |
| Reduced motion | Source review: changed action/status introduce no animation; existing global reduce rule disables transitions/animations. Runtime reduced-motion emulation unavailable |

## Capture inventory

- Desktop: [upgrade](desktop-upgrade.png), [flow](desktop-flow.png), [paused](desktop-paused.png), [Breather](desktop-breather.png).
- Phone: [upgrade](phone-upgrade.png), [flow](phone-flow.png), [paused](phone-paused.png), [Breather](phone-breather.png).

## Reproducible setup

Open verified URL with `?dev=1`. Run `app = window.__flowsynth; app.devFocusScenario(); app.devFocusScenarioAssert()`. This isolates the save. Upgrade is the initial state. Set `app.ui.chosenTarget=1500; app.startFlow()` for flow; `app.pause()` for pause. For the presentation-only Breather capture, set `app.state.mode='breather'; app.state.breather={startedAt:Date.now(), allowanceSeconds:300, elapsed:0}; app.render()`. This directly seeds presentation and does not verify the summary-to-Breather journey. Reset with the scenario before each viewport. Browser keyboard check used focus on flow-switch followed by preview_press Enter.

## Instrument review and limits

Compared with the instrument standards' pinned control contract and the confirmed amendment: condensed control lettering, mono state readout, flat graphite surfaces, explicit readable state, and visible focus remain. The main button's paired clipping and the wordmark intentionally supersede the earlier square-control/logo-alone rules. No new boxed disclosure or explanatory copy was introduced. The historical pin was retrieved for source reference; a live side-by-side rendering of the pinned prototype was unavailable. Desktop screenshots are softer than phone screenshots; live viewport and computed geometry were confirmed separately.

Hardware touch activation, runtime reduced-motion emulation, grayscale device capture, long-habit stress capture, intermediate breakpoints, and widths below 390px are unavailable in this pass. No new disclosure was added; keyboard/touch disclosure regression evidence is unavailable here, with existing automated Focus/Notes paths retained. Browser preview reports visible=false although snapshots and evaluation succeed; visibility itself is unverified. No browser recovery failure occurred.

## Checks

- Targeted app/instrument/theme: 103 tests passed.
- `npm run check`: passed at final source revision.
- `npm test`: passed, 93 files; 1859 tests passed, 2 existing skips. Includes the UI project; no duplicate full UI run. The provenance fixture emitted Vite dep-scan diagnostics during its temporary-checkout exercise; the test and complete suite exited successfully.
