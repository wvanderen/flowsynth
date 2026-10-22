# Issue #456 — the Focus evidence scenario, installed and asserted

Demonstration of the repeatable, save-isolated Focus evidence setup
(ADR-0077): the scenario installs a representative session-preparation
state from arbitrary prior development state, its assertions confirm the
setup, and the ordinary save is never touched.

## Provenance

Captured from the verified checkout: worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3-044753d5`, branch `t3/issue-456`,
commit `7da622456a09e730b492614de6fc64f6f9dd9e9a`, served at
`http://localhost:5175/` with clean source. The capture preflight accepted
the URL immediately before the captures; its record is
[provenance.json](provenance.json) beside these files.

## The demonstration

The tab opened at `http://localhost:5175/?dev=1` carrying an ordinary
earlier development save — a paused open-ended session on a "Piano" habit
with fractional nous (`mode: "paused"`, `nous ≈ 20.67`): arbitrary prior
development state, exactly the starting condition the issue names. The
documented script (docs/agents/visual-evidence.md §3) ran in the tab:

```js
const app = window.__flowsynth;
app.devFocusScenario();
app.devFocusScenarioAssert(); // returned normally — assertions passed
app.showFocusFace("plan");
```

`devFocusScenarioAssert()` returned and the dev panel printed:

```
focus ✓ Piano · daily 60m · 25m logged · Engineer Lv 3 · isolated save
```

with the console status line `Dev: Focus scenario assertions passed.` The
dev panel's `Focus setup` readout is visible in every capture below.

The failure form ran in the same verified tab, same pass, after the ✓
captures: with the scenario installed, the capture script emptied the
goal list (`app.state.goals.length = 0`) and re-ran
`devFocusScenarioAssert()`, which threw

```
Focus scenario: expected the active goal on "Piano" — none found.
```

and the dev panel's readout flipped to

```
focus ✗ Focus scenario: expected the active goal on "Piano" — none found.
```

The reinstall then restored the intended setup and the ✓ line. A
screenshot of the ✗ readout was not captured: the browser screenshot
pipeline began timing out on every snapshot (evaluate and clicks stayed
responsive) after the ✓ captures, on two tabs, and the pass is recorded
unavailable per the evidence rules — the transcript above is the
demonstration's record, and the ✗ readout's rendering is the same dev
panel line the captures show for ✓.

### The setup's reads (exact DOM text at capture time)

- Session host: `Focus controls, Piano, --:-- open-ended`; header goal
  meter `Goal progress: daily 60 min, 35 minutes to go`.
- PLAN: `1 goal tracked`; the `Piano` chip pressed (firm inset marker);
  GOAL row `60 min a day` · `35:00 to go` · `25 min / 1 h 0 min`.
- Class summary: `Engineer · Level 3 · 2 tree points free`; `Next level —
  13h of practice to level 4`; `NEXT MODULE ROLL — 13:48 / 27:36 — next
  roll in ~13:48 of practice`.
- HABIT → TREE: `1 spent · 2 is free`; `Governor` ranked, `Reed +0/2`,
  `Punch card — unlocks at class level 5`; presets `Default / Draft
  control / Plying`.

### The isolation read, from the live tab after the captures

```js
localStorage.getItem("flowsynth.save.v1") →
  { slotMode: "paused", slotHabits: ["Piano"], slotSavedAtIsBeforeInstall: true,
    liveStateIsScenario: true, scenarioWriteReachedSlot: false }
```

The slot still holds the pre-install paused save byte-for-byte while the
live state is the scenario: the install, the boundary throttles, and the
unload save all landed in the private in-memory slot (ADR-0077). A reload
of this tab returns to the ordinary save; the automated counterpart is
`src/ui/app.focusscenario.test.ts` ("produces the intended state from an
arbitrary prior save and leaves that save untouched", which also reloads a
second `App` and reads the ordinary save back) and ("shared-save recovery
cannot replace the scenario with unrelated state", which drives the
storage-event and visible-return recovery paths against an installed
scenario, with a pre-install control proving the recovery path was live).

## Captures

Desktop is 1280×800; phone is 390×844.

| File | Viewport | Reads shown |
| --- | --- | --- |
| [desktop-plan.png](desktop-plan.png) | 1280×800 | The PLAN face over the console: goal row, class summary, roll meter, dev panel ✓ line |
| [desktop-habit-tree.png](desktop-habit-tree.png) | 1280×800 | The HABIT face's TREE: level, spent rank, free points, node prerequisites, presets |
| [phone-plan.png](phone-plan.png) | 390×844 | The PLAN face at phone width: the same goal and advancement reads, dev panel ✓ line |
| [phone-habit-tree.png](phone-habit-tree.png) | 390×844 | The HABIT face's TREE at phone width |

## Verified against the instrument standards

The changed surface is dev-only furniture: the dev panel's `Focus setup`
button and its one-line assertion readout.

- Keyboard: the readout is a real `<button>` in tab order like its
  neighbors, and the readout is plain text — no interactive terms, no
  disclosures. Verified in the captures' DOM (a native button; the dev
  panel's listeners are the existing per-button click wiring).
- Touch: the button uses the dev panel's existing geometry (44px row);
  no new gesture was introduced. Verified by inspection of the rendered
  panel; no separate touch pass was run.
- Non-color state: the readout distinguishes pass and failure by the `✓`
  / `✗` glyph and the named text, never color alone. Both forms ran in
  the verified tab (transcripts above); only the ✓ form has a screenshot —
  the ✗ capture pass is recorded unavailable above. The automated case
  ("assertions fail clearly when the setup drifts, and reinstall restores
  it") additionally asserts the ✗ readout's content after a drift and the
  ✓ line after a reinstall.
- Square controls, condensed mono lettering, open divisions: the button
  inherits the dev panel's existing control style; the readout is one
  plain mono line. Verified in the captures.
- Reduced motion: nothing new moves — the readout is static text.
  Not emulated here; no motion was added (unavailable, by design
  irrelevant).
- The floating dev panel overlaps the session-action row at phone width;
  it is draggable dev furniture that never ships (`tools/build-purity.test.ts`
  keeps the dev surface out of production builds). The player surface
  beneath is unchanged.

## Scope

No fixture catalog, no Focus redesign: one builder and one assertion in
`src/engine/focus-scenario.ts`, one dev entry point
(`devFocusScenario` / `devFocusScenarioAssert`), one storage helper
(`memorySaveStorage()`), and the dev-panel readout. The scenario can be
run independently by any capture pass through the documented script above
with the standard preflight → capture flow.
