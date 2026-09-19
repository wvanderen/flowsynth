# Current implementation survey (issue #18)

Baseline of the FlowSynth codebase as of commit `694d514` ("Fix missing Grid & inventory tool button", branch `t3code/wayfinder-planning`), surveyed 2026-09-13. Every claim cites the file that owns it; line numbers refer to that commit. Purpose: the redesign spec can state its delta from this baseline instead of rediscovering it.

Verification: `npx vitest run` → 11 files, 104 tests, all passing; `npm run check` (tsc strict) is the typecheck.

## 1. Stack and repo layout

- Vite 6 + TypeScript 5.8, no UI framework, no runtime dependencies (`package.json`). Vitest 3 for engine tests, node environment (`vite.config.ts`). Strict tsc with `exactOptionalPropertyTypes`, `verbatimModuleSyntax` (`tsconfig.json`).
- `src/engine/` — pure library, no DOM imports. `src/ui/` — framework-free DOM rendering. `src/main.ts` — bootstrap + global key handling. `index.html` — static shell.
- `tools/economy/` — stdlib Python economy simulator (`simulate.py`, `report.py`, `test_simulate.py`, `baseline.json`) that produced `docs/economy-report.md` / `docs/economy-results.json`; the engine arithmetic mirrors it (`README.md:25`).
- `tools/ui/check-rendering.ts` — manual browser regression script run against `/?dev=1` via `window.__flowsynth` (charge-pulse animation and water-fill survival across re-renders, save restore). Not wired into `npm test`.
- Docs: `CONTEXT.md` (domain glossary), `docs/adr/0001–0011`, `docs/first-playable-brief.md`, `docs/validated-prototype-ux.md`, `docs/reflection-module-idea.md` (captured future idea, explicitly not accepted).

## 2. Domain model and state shape

`GameState` (`src/engine/types.ts:117-146`) is one serializable object; engine functions mutate it in place and return result structs. Fields: `mode`, `sessionIndex`, `sessionsCompleted`, `nous`, `totalEarned`, `modules[]`, `cells[]`, `cellTokens`, `forge`/`expansion` meters (`{progress, earned}`), `bankedRolls[]`, `purchased[StarterType]`, activation flags (`timeActive`, `notesActive`, `goalsActive`, `tasksActive`), `notes[]`, `habits[]`, `activeHabitId`, `practiceLog[]`, `tasks[]`, `allowance`, `taskCompletionCounter`, `storeOpened`, `session` (`{target, elapsed, burstAwarded}` or null), `pendingGap`, `nextId`.

- `ModuleInstance` = `{id, type, rarity, level, invested, pos: Hex|null, bursts[]}` (`types.ts:19-27`). `pos: null` means inventory. `invested` tracks total upgrade spend for combination refunds. `bursts` is the module's stored charge queue (only Time ever holds bursts in practice).
- Module types (`types.ts:3-7`): six **core** types — `enter`, `time`, `habit`, `notes`, `goals`, `tasks` — and five **gameplay** types — `additive`, `conditional`, `infusor`, `forge`, `expander`. Rarity: `common | uncommon | rare`.
- Modes (`types.ts:115`): `upgrade | flow | paused`. All purchase/rearrange actions gate on `mode === "upgrade"` (`actions.ts`).
- Activation economy (ADR-0007/0011): `enter` and `habit` are always active (`economy.ts:35-36`); `time` activates automatically after the first session ends (`actions.ts:40`); `notes`/`goals`/`tasks` are permanent store purchases (20/30/25 ν, `constants.ts:39`, `actions.ts:76-89`). Inactive core copies deploy (reserving their cell), produce nothing, neither receive nor dispense charge, and cannot be upgraded (`economy.ts:30-39`, `actions.ts:96`); a spare core copy can only replace its deployed matching twin (`actions.ts:163-168`).
- Initial state (`state.ts:4-49`): 8 cells — the 6 ring hexes around origin, origin itself, and `(2,0)` — with the six required cores pre-deployed at fixed positions. `nextId` is a single monotonic counter for all entity ids.

## 3. Implemented game systems

### 3.1 Hex grid / board

Axiomatic axial coords `Hex {q, r}`, adjacency via 6 directions, flood-fill connectivity check (`hex.ts`). Board mutations, all upgrade-mode only: `placeCell` (spend a `cellToken`, attach adjacent to existing board, `actions.ts:189-197`), `reshapeCells` (same cell count, unique, connected, every deployed module keeps a cell — `actions.ts:199-212`), `placeModule` (swap/replace semantics per core rules, `actions.ts:149-177`), `returnModule` (gameplay modules only; cores are pinned, `actions.ts:179-187`).

### 3.2 Production formula (nous)

Single shared rate, no per-module payout clocks (`economy.ts:117-188` `computeRates`, mirrors brief §"Single production formula"):

```
nous/s = (Σ enter + Σ additive) × (1 + Σ time bonus) × (1 + Σ conditional bonus)
contribution_i = baseRate(type) × rarityPower^level × (1 + Σ adjacent infusor bonuses) × chargedFactor(strength_i)
```

- Base rates: enter 0.1 ν/s, additive 0.05, time +0.2, conditional +0.1 per adjacent **active core** (counted at the conditional's position, `economy.ts:107-115`), infusor +20% (`constants.ts:26-47`).
- `chargedFactor(s) = 1 + s/(1+s)` (`economy.ts:5-7`) — only s = 0 and 1 are ever exercised (+50%).
- `computeRates` returns a `RateSnapshot` with per-module contributions, charge strengths, forge/expansion rates, and remaining charge seconds — the UI renders directly from it.

### 3.3 Charge

**Time is the only charge generator in the implementation.** Bursts queue on the Time module (`time.bursts`); only a module adjacent to a deployed, active Time receives the dispensing strength, full strength to each neighbor, no division (`economy.ts:89-94` `receivedStrength`). Sources of bursts, all pushed at strength 1 (`advance.ts:74`, `notes.ts:69`, `goals.ts:136`, dev panel):

- Time completion burst: reaching a timed target awards `target × 0.1s` of charge per minute (i.e. 6s per planned minute, `BALANCE.chargeSecondsPerPracticeSecond = 0.1`, `advance.ts:67-77`). Once per session (`session.burstAwarded`); continuing past target earns nothing more.
- Notes session-end burst (below).
- Goal completion bursts (below).

Bursts drain only during live flow in queue order; equal-strength bursts merge (`pushBurst`, `advance.ts:9-16`), different strengths would queue. `resolveStrength` supports a `chargeOverride` so upgrade mode can preview "what if charged" (`economy.ts:82-87`). Charge state survives sessions, pause, and reconfiguration (ADR-0001/0002). ADR/glossary language about generic multiple generators is aspirational — nothing else dispenses.

### 3.4 Upgrades, levels, rarity, combination

- `levelCost(level) = ceil(10 × (8/5)^level)` via bigint math (`economy.ts:9-14`, `constants.ts:33-35`); `modulePower = rarityPower[ rarity ]^level` with 1.2 / 1.25 / 1.3 (`constants.ts:36`). Upgrades: upgrade mode + store opened + module active (`actions.ts:91-103`).
- Rarity exists only as power-curve scaling and roll odds (99% / 0.9% / 0.1%, `constants.ts:37`). **No secondary-effect strengthening per rarity is implemented**, despite the glossary promising it.
- Combination (`actions.ts:111-147`): two modules of same type + rarity → one of next rarity (rare is terminal). Keeps the higher-level input's level and bursts, refunds the lower input's full `invested` nous, survivor takes the merged position. UI adds drag-to-combine onto a matching twin (`app.ts:351-363`) and a panel button.

### 3.5 Forge and expansion (shared meters)

Both are player-wide meters fed by received charge × module power (`rolls.ts:33-55`); infusors and charged empowerment explicitly do not apply (forge/expander contributions are `strength × power`, `economy.ts:156-163`).

- Forge: threshold `60 × 1.5^earned`; each crossing banks a 3-candidate `RollOffer` drawn without replacement from all 11 module types (cores included), rarity rolled per candidate (`rolls.ts:7-43`, `constants.ts:53`). Unchosen candidates vanish; no consolation. `chooseRoll` spawns the module at level 0 (`actions.ts:214-224`).
- Expansion: threshold `60 × 2^earned`; each crossing grants a `cellToken` spent via `placeCell`.

### 3.6 Sessions (start / pause / resume / end / reconciliation)

`startSession` (locks mode + chosen target, `actions.ts:23-30`), `pauseSession`/`resumeSession` (freeze elapsed + production, `actions.ts:50-60`), `endSession` (`actions.ts:32-48`): increments `sessionsCompleted`, activates Time after the first, opens the store at the same moment, banks the Notes burst, writes the live practice-log entry, rolls goal occurrences. Ending early keeps earned production and only withholds the completion burst (per brief; there is no separate completion-bonus number beyond the Time target burst).

Tick/reconciliation (`clock.ts`, `app.ts:231-257`): a 500 ms wall-clock interval; gaps ≤ 120 s are applied wholesale (`RECONCILIATION_THRESHOLD_SECONDS`, `constants.ts:59`), longer gaps become `state.pendingGap` and a "Were you practicing?" modal — confirm applies the whole interval through `advance`, discard throws it away (`app.ts:721-742`). Same path on load/import of a save captured mid-flow (`app.ts:138-150`).

The `advance` step loop (`advance.ts:18-80`) integrates in sub-steps bounded by burst exhaustion and target crossing, accumulating nous, forge/expansion progress, live habit development, goal progress, and task allowance.

**Known stale bit:** `AdvanceResult.storeOpened` is initialized false and never set (`advance.ts:24`); the store actually opens in `endSession` (`actions.ts:43`), so the UI toast branch for it (`app.ts:261`) is dead code left over from the pre-ADR-0011 design.

### 3.7 Habits

`habits.ts`: create/rename/archive/select (upgrade mode only; selection locks for the session, `habits.ts:78-85`); one active habit or unstructured practice. Development = practice seconds × `modulePower(habit module)` (`habits.ts:36-40`); accrues live in `advance` (`habits.ts:115-120`) and via manual practice logs (`habits.ts:90-112`), which also advance goal conditions but **never produce nous or charge** (ADR-0001). `practiceLog` records one `live` entry per session at end (`habits.ts:124-134`) plus one entry per manual log. Habit development has no spend sink — "customization unlocks that spend development are deferred" (`habits.ts:10-11`). Note: `habitsActive()` (`habits.ts:32-34`) is an unused export with a non-null assertion that would throw if the Habit module were undeployed — latent hazard, never hit because cores are pinned.

### 3.8 Notes

`notes.ts`: capture only during non-upgrade modes (i.e. flow *or* paused) with module active; notes are stamped with session id + elapsed. Any note in a session qualifies it; at `endSession` the burst is banked for the **next** session: `elapsed/60 × 1 s/min × notesPower` (`notes.ts:61-71`, `BALANCE.notesChargePerMinute`). `projectedNotesBurst` powers the live UI readout.

### 3.9 Goals

`goals.ts`: conditions are only `{kind: "habit-minutes", habitId | null, minutes}` (`types.ts:85-89`). Schedules `once | daily | weekly` with local-calendar occurrence keys (Monday-start weeks, `goals.ts:44-73`); occurrences reset progress and completed flag. Capacity fixed at `goalBaseSlots = 2` **regardless of level** — slot expansion is an explicitly deferred design question (`goals.ts:26-31`). Completions queue a Time burst of `minutes × 0.5 s/min × goal-module power`, once per occurrence; **completion requires a deployed Time module** (`goals.ts:133`). Progress accrues only forward (no retroactive credit), from the active habit during flow and from manual logs.

### 3.10 Tasks

`tasks.ts` (ADR-0005): capture any time (even mid-flow), sizes small/medium/large with cost = reward = 3/8/15 ν. One player-wide `allowance` accrues at `modulePower(tasks)` points per live-flow minute (`tasks.ts:96-100`); manual logs earn nothing. Completion is recorded immediately; rewards pay in `completionOrder`, fully or not at all, and underfunded ones wait as pending (`settlePendingRewards`, `tasks.ts:79-92`). Deleting a pending task forfeits its unfunded reward. Rename/delete allowed any time; completed tasks are immutable history.

### 3.11 Save / persistence / migration

`save.ts`: `SaveFile = {app: "flowsynth", version, savedAt, state}` as pretty JSON. `SAVE_VERSION = 4` (`constants.ts:61`). `deserialize` validates, rejects newer versions, runs `migrate` (pre-v4 saves with the store open are grandfathered with Notes+Goals activated; missing arrays default in), then **merges over a fresh `createInitialState()`** so newly added fields default forward (`save.ts:30-67`). `STORAGE_KEY = "flowsynth.save.v1"` in localStorage; autosave every 5 s during flow, on every successful action, on `visibilitychange`→hidden, and on `beforeunload` (`app.ts:152-159, 219-229, 255`). Export = textarea + `.json` download; import = paste or file picker, replaces state and reuses the resume/reconcile path. Reset = fresh initial state. There is no save schema versioning *within* `state` beyond the file-level version + merge defaults.

## 4. UI structure

Static shell (`index.html`): dark `color-scheme`; header `.topbar` = brand, `#session-toolbar`, `#accounting`, settings gear; `main.workspace` = `.board-panel` (board tools, arrange banner, `#grid` SVG, legend + `#rate-formula` footer) + `#inspector` aside; `#status` sr-only live region; single modal backdrop. `src/main.ts` wires element ids, `?dev=1`, modal backdrop click, and Escape (modal → cancel placing → exit arranging → deselect).

`src/ui/app.ts` (826 lines) is the single controller: owns `state` + `UiState` (`selected`, `placing`, `managing`, `reshape`, `modal` ∈ {settings, store, forge, export, import, reset, reconcile}, import text/error, chosen target, show-acquired, habit/task edit ids), the tick loop, save/export/import/reset, and one thin method per engine action that calls `act()` → status line message + save + render.

`src/ui/render.ts` (1637 lines) renders everything as `innerHTML` template strings, with two DOM-stability tricks:

- **Render keys**: toolbar/inspector/modals skip rebuilds when a structural key is unchanged, and update live values in place via `data-live` attributes, so buttons, focus, scroll position, and in-flight clicks survive the 500 ms ticks (`render.ts:134-189, 583-631, 1339-1341`).
- **Keyed SVG diffing** (`src/ui/svg.ts`): the grid is re-diffed by `data-cell`/`data-key` so CSS animations (charge pulse) and transitions persist across renders (`render.ts:250-323`).

Regions:

- **Top bar** (`render.ts:91-202`): upgrade mode shows the chosen-duration clock, module shortcut buttons (Time, Notes when active, Habit chip with name), Enter flow. Flow shows elapsed clock, progress track, caption ("of X planned" / "Target reached · continue freely" / "Open-ended"), Pause/Resume + End flow. `#accounting` shows nous, current ν/s, and mode label (UPGRADE MODE / FLOW LIVE / FLOW PAUSED / ARRANGING).
- **Board tools** (`render.ts:204-222`): Store, Forge · N (badge = banked rolls), Grid & inventory (badge = cell tokens) — visible but disabled during flow, per the validated UX.
- **Canvas** (`render.ts:250-579`): hexes at 65 px spacing; module hexes show icon, short name + level, one live stat line (ν/s, ×multiplier, meter progress, habit name, open task count…), water-fill progress for Forge/Expander meters and the nearest-goal fraction, rarity accent, lock overlay for inactive cores, core pins during arranging, charge lines Time→neighbors (live in flow; previewed when Time/forge/expander selected in upgrade mode). Frontier outlines appear when placing cells or reshaping. Pointer-drag (arrange mode only) raises a ghost tile: drop on a cell to place/swap, on a matching twin to combine, on the inventory zone to store (cores refuse with explanation) (`render.ts:466-579`). Right-click returns a gameplay module to inventory.
- **Formula bar** (`render.ts:226-246`): single-row `(Flow + Additive) × (1 + Time) × (1 + Conditional) = X ν/s` with icon-identified terms.
- **Inspector** (`render.ts:583-1319`): three panels. *Grid overview* — charge seconds, active/deployed counts, both shared meters with progress bars, banked rolls/cells, session stats, and the full formula explainer. *Module panel* — heading + rarity chip, per-module "focus controls" (session start/pause/end on Enter; duration select on Time; habit create/rename/archive/select + manual log; goal create/progress/delete with slots; task capture/sizes/complete/pending queue; note composer with ⌘/Ctrl+Enter and recent notes), then Module Power (level, concrete current effect, upgrade CTA with % and absolute gain + cost, combine button), then stats (position, adjacency, charge trigger/strength/duration, meter progress…). *Grid & inventory panel* — Add cell (tokens), Reshape board (staged −/+ with validity probe against a cloned state), inventory hex tiles.
- **Modals** (`render.ts:1323-1606`): settings hub; store (core activations above one-time starter copies, acquired items demoted behind a "Show acquired" checkbox); forge (three candidate tiles with rarity, scaling line, effect text — **only the newest banked offer is rendered**, older banked offers surface one at a time after each choice, though the engine accepts any offer id); export/import/reset; the reconcile "practice check" dialog.
- **Dev panel** (`render.ts:1610-1637`, `?dev=1`): +1m/+10m/→target/+60s charge/+100ν, plus `window.__flowsynth` for console access (`main.ts:19-23`).

Visual identity: one hand-written stylesheet (`src/ui/style.css`, 597 lines), CSS custom properties, dark instrument aesthetic, mint = receiving charge / amber = dispensing. No fonts/asset pipeline; icons are inline SVG paths (`src/ui/icons.ts`), labels/names in `src/ui/meta.ts`.

## 5. Test coverage

Engine-only, node environment (`vite.config.ts`): 104 tests / 11 files, all green — `formula` (9, rate math incl. charge/infusor stacking), `session` (12, start/pause/resume/end/target/burst/reconciliation), `actions` (12, store/activation/upgrade/placement/cell rules), `combine` (6), `notes` (10), `habits` (9), `goals` (15), `tasks` (13), `save` (8, round-trip, migration, rejection), `meters` (6, forge/expansion thresholds), `rolls` (4, offer generation with stubbed RNG). Shared fixtures: `fixtures.ts` (`fresh`, `give`, `grantBurst`, `stubRng`, `setActive`). **The UI layer has no automated tests** — only the manual `tools/ui/check-rendering.ts` browser script. Python economy tools have their own test file.

## 6. Half-built, stubbed, or explicitly deferred

- **Goal slot capacity is hard-coded to 2**; module level affects only burst size (`goals.ts:26-31`, ADR-0011 consequences).
- **Only charge strengths 0 and 1 exist**; the empowerment curve `1 + s/(1+s)` is provisional and only half-exercised (brief §formula, `CONTEXT.md:76`).
- **Rarity has no secondary effects** — only power scaling and roll odds, despite the glossary ("strengthens secondary effects", `CONTEXT.md:121-122`).
- **Generators are conceptually general but Time is the sole dispenser**; forge/expander "generating charge" in glossary terms is really receiving it.
- **Habit development has no sink** — customization unlocks deferred (`habits.ts:10-11`).
- **Goal conditions**: only `habit-minutes`; "other criteria" from the glossary are future (`types.ts:85-89`).
- **Forge modal shows only the newest banked offer** (`render.ts:1487`); queue drains LIFO via re-render, engine supports arbitrary offers (`actions.ts:214`).
- **Dead code**: `AdvanceResult.storeOpened` never set; its toast branch unreachable (`advance.ts:24`, `app.ts:261`). `habitsActive()` unused + non-null assertion (`habits.ts:32-34`).
- **No completion-bonus payout distinct from the Time target burst** despite glossary "Completion bonus" entry — the burst *is* the bonus.
- **No UI tests in CI**; rendering regressions rely on a manual script.
- **Reflection module** exists only as a captured idea doc (`docs/reflection-module-idea.md`).
- Balance constants are declared provisional throughout (`constants.ts:26-47`, brief §balance).

## 7. Redesign-relevant deltas (what the spec will be diffing against)

Per the ticket context, the redesign touches: decoupling focus modules from the board (today: every focus function lives in a required, pinned, cell-reserving core module — `actions.ts:149-187`, `state.ts:35-42`), a new opening economy (today: first session → Time auto-activates + store opens; activations Notes 20 / Goals 30 / Tasks 25; one-time starters additive 40 / conditional 60 / infusor 40 / forge 80 / expander 80 — `actions.ts:38-48`, `constants.ts:38-39`), progression direction (today: single shared nous rate → upgrades via `10 × 1.6^level`, combination → rarity, forge rolls → more modules, expansion → more cells), and visual identity (today: hand-written dark CSS, inline SVG icons, keyed-diff DOM, no framework — §4 above). Any redesign that moves focus tools off-board must also rework: the activation economy and its save flags (`types.ts:50`, `economy.ts:30-39`), the place/return/reshape rules that assume pinned cores, `SAVE_VERSION` migration (v4 merge-over-fresh approach extends but activation/pinned-core assumptions are baked into saves), and the tests that assert core pinning and activation gating (session/actions/goals suites).
