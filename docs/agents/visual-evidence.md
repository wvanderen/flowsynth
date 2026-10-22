# Visual evidence: launch the active checkout, verify provenance, capture

Screenshot evidence must come from the checkout whose diff it backs. Sibling worktrees are common in this repo, and a tab pointed at a neighbouring checkout's server silently reviews the wrong source.

## 1. Launch the checkout you are editing

Run `npm run dev` inside the active worktree. The launcher (`tools/dev-server.mjs`) picks an available port — so two sibling worktrees can serve concurrently at distinct URLs — and prints the actual URL beside the absolute worktree path, branch, and commit. Server output is teed to `.dev/server.log` in the same worktree. A printed URL confirms startup at that moment; if a long-running launch surfaces as a failed command, make a fresh provenance request as described below to check whether the server is still responding. Use the log for diagnostics: it appends across launches, and logging is best-effort.

## 2. Verify provenance before capturing evidence

From the exact URL you will screenshot, confirm which checkout is being served:

```
curl http://localhost:PORT/-/dev/provenance
```

or, in that tab's browser console:

```
await fetch("/-/dev/provenance").then((r) => r.json())
```

The response's `worktree` must equal `git rev-parse --show-toplevel` in the checkout you are editing, and its `commit` must equal `git rev-parse HEAD` there. A mismatch — or a 404, which means the tab landed on a stale or foreign server — is a stop: relaunch and repoint the tab before capturing anything.

## 3. Seed states through the dev harness

Open the verified URL with `?dev=1`: the flag exposes the dev panel and `window.__flowsynth`, the app handle exposed in `src/main.ts`. Its seeding helpers live in `src/ui/app.ts`. Use a script to make the evidence setup reproducible. Persisted board and session state survives reload; transient UI selections and the separate development-board scenario can reset.

For example, run this in the tab's console or a browser evaluate call to show the World era:

```js
const app = window.__flowsynth;
if (!app) throw new Error("Open the verified URL with ?dev=1 first.");
app.devWorldEra();
```

`devWorldEra()` switches to upgrade mode, grants the World-era setup, selects the World board layer, saves, and renders. It needs no separate mode change or render call. Other helpers have different prerequisites: `devSynth()` places a synth only in upgrade mode (otherwise it goes to inventory), while `devAdvance(seconds)` requires flow mode. Both render internally. Check the helper before rerunning a seed: grants such as `devSynth()` add another module and save it.

## 4. Capture desktop and phone against that same server

Verify and screenshot both a desktop and a ~390px phone viewport from the verified URL. A viewport pass that fails or cannot run is recorded as unavailable — never claimed as verified. The evidence backs a review against the [instrument standards](../instrument-standards.md), which also requires keyboard/touch disclosure checks, non-color state distinctions, and reduced-motion behavior where applicable.

### Resize flakiness

`preview_resize` fails most attempts at any viewport size — "Preview automation resize timed out after 15000ms" — while click/evaluate/snapshot on the same tab usually keep working. Get resizing done before captures, not during:

- Resize to each viewport **before** capturing at that size, and batch that viewport's whole capture pass before resizing again.
- After a timeout, call `preview_status` once (it often revives the viewport), then retry resize at most once more.
- Three failed attempts is the whole budget; beyond that, record the viewport pass as unavailable per the rule above.

A resize that lands after retries is still a good viewport — capture everything before touching the size again.

The launcher, its log, and the provenance endpoint are development-only: `vite build` ships neither the endpoint nor any absolute local path (asserted by `tools/build-purity.test.ts`).
