# Visual evidence: launch the active checkout, verify provenance, capture

Screenshot evidence must come from the checkout whose diff it backs. Sibling worktrees are common in this repo, and a tab pointed at a neighbouring checkout's server silently reviews the wrong source — and even a tab on the right checkout can be displaying uncommitted code (issue #446 needed a full recapture for exactly that). The capture preflight (`tools/evidence-preflight.mjs`) is the one gate every capture passes.

## 1. Launch the checkout you are editing

Run `npm run dev` inside the active worktree. The launcher (`tools/dev-server.mjs`) picks an available port — so two sibling worktrees can serve concurrently at distinct URLs — and prints the actual URL beside the absolute worktree path, branch, commit, and a source-cleanliness read. Server output is teed to `.dev/server.log` in the same worktree. A printed URL confirms startup at that moment; if a long-running launch surfaces as a failed command, make a fresh provenance request as described below to check whether the server is still responding. Use the log for diagnostics: it appends across launches, and logging is best-effort.

## 2. Run the capture preflight before capturing anything

From the checkout you are editing, gate the exact URL you will screenshot:

```
node tools/evidence-preflight.mjs --url http://localhost:PORT --record docs/evidence/<slug>/provenance.json
```

The preflight queries the dev server's `/-/dev/provenance` and verifies, in order:

1. **Available** — the URL answers with FlowSynth provenance; a 404, a timeout, or a non-dev server rejects as `unavailable`.
2. **Worktree** — the served `worktree` equals `git rev-parse --show-toplevel` here; a sibling worktree's server rejects as `foreign-worktree`.
3. **Commit** — the served `commit` equals `git rev-parse HEAD` here; a server that predates the checkout's state rejects as `commit-mismatch`.
4. **Clean source** — the served `source.clean` is true: no tracked modification and no non-ignored untracked file may differ from that commit, or the browser may be displaying uncommitted code. Evidence outputs — everything under `docs/evidence/` and the dev log under `.dev/` — are products of capturing, not source: the endpoint reports them under `source.evidence` and they never taint the check (issue #454).

Any rejection exits 1 and names the fix: relaunch `npm run dev` in this worktree and repoint the tab, or commit/stash the listed changes — a new commit needs no relaunch, because the endpoint recomputes per request and the served commit moves with HEAD. Never capture from a URL that has not passed. Acceptance requires successfully writing a provenance record. `--record` selects its path (default: `docs/evidence/preflight/provenance.json` relative to the current directory); use the explicit path above to keep it beside the captures. On acceptance it exits 0 and writes the verified worktree, source commit, and cleanliness result beside the captures: commit that record with the evidence and cite it in the evidence README. Ad-hoc inspection can still read the endpoint (`curl http://localhost:PORT/-/dev/provenance`), but acceptance runs through the preflight.

## 3. Seed states through the dev harness

Open the verified URL with `?dev=1`: the flag exposes the dev panel and `window.__flowsynth`, the app handle exposed in `src/main.ts`. Its seeding helpers live in `src/ui/app.ts`. Use a script to make the evidence setup reproducible. Persisted board and session state survives reload; transient UI selections and the separate development-board scenario can reset.

For example, run this in the tab's console or a browser evaluate call to show the World era:

```js
const app = window.__flowsynth;
if (!app) throw new Error("Open the verified URL with ?dev=1 first.");
app.devWorldEra();
```

`devWorldEra()` switches to upgrade mode, grants the World-era setup, selects the World board layer, saves, and renders. It needs no separate mode change or render call. Other helpers have different prerequisites: `devSynth()` places a synth only in upgrade mode (otherwise it goes to inventory), while `devAdvance(seconds)` requires flow mode. Both render internally. Check the helper before rerunning a seed: grants such as `devSynth()` add another module and save it.

### The Focus evidence scenario (issue #456)

The Focus surfaces have one repeatable, save-isolated setup: `app.devFocusScenario()` installs a representative session-preparation state — the selected "Piano" habit with 15 h of seat time, its daily 60-minute goal 25 logged minutes into today's occurrence, Engineer level 3 with one spent Governor rank and two points free, a partial practice-roll meter with its banked rolls waiting, and one recorded session — from arbitrary prior development state (ADR-0077). The install detaches the tab from the player's save before it writes: repeating the setup rebuilds the state without accumulating, an ordinary save is never read or overwritten, and shared-save recovery cannot displace the setup with unrelated state. A reload drops the scenario and returns to the ordinary save.

Run it with its assertions, then open Focus through the real door:

```js
const app = window.__flowsynth;
if (!app) throw new Error("Open the verified URL with ?dev=1 first.");
app.devFocusScenario();       // installs in an isolated save, renders
app.devFocusScenarioAssert(); // re-confirms; throws a named failure if the setup drifted
app.showFocusFace("plan");    // opens the Focus sheet on the PLAN face
```

A pass prints the ✓ summary line in the dev panel (`Focus setup` readout) and returns from `devFocusScenarioAssert()`; a failure throws `Focus scenario: …` with the named reason and prints the ✗ line. Record both in the demonstration: the dev panel's line is visible in captures, and the assertion call belongs in the capture script so an unconfirmed setup cannot pass silently. The goal anchors to the install day — reinstall when the capture spans local midnight.

## 4. Capture desktop and phone against that same server

Verify and screenshot both a desktop and a ~390px phone viewport from the verified URL. A viewport pass that fails or cannot run is recorded as unavailable — never claimed as verified. The evidence backs a review against the [instrument standards](../instrument-standards.md), which also requires keyboard/touch disclosure checks, non-color state distinctions, and reduced-motion behavior where applicable.

### Resize flakiness

`preview_resize` fails most attempts at any viewport size — "Preview automation resize timed out after 15000ms" — while click/evaluate/snapshot on the same tab usually keep working. Get resizing done before captures, not during:

- Resize to each viewport **before** capturing at that size, and batch that viewport's whole capture pass before resizing again.
- After a timeout, call `preview_status` once (it often revives the viewport), then retry resize at most once more.
- Three failed attempts is the whole budget; beyond that, record the viewport pass as unavailable per the rule above.

A resize that lands after retries is still a good viewport — capture everything before touching the size again.

The launcher, its log, the provenance endpoint, and the preflight are development-only: `vite build` ships neither the endpoint nor any absolute local path (asserted by `tools/build-purity.test.ts`).
