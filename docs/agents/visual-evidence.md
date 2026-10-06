# Visual evidence: launch the active checkout, verify provenance, capture

Screenshot evidence must come from the checkout whose diff it backs. Sibling worktrees are common in this repo, and a tab pointed at a neighbouring checkout's server silently reviews the wrong source.

## 1. Launch the checkout you are editing

Run `npm run dev` inside the active worktree. The launcher (`tools/dev-server.mjs`) picks an available port — so two sibling worktrees can serve concurrently at distinct URLs — and prints the actual URL beside the absolute worktree path, branch, and commit. Server output is teed to `.dev/server.log` in the same worktree.

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

## 3. Capture desktop and phone against that same server

Verify and screenshot both a desktop and a ~390px phone viewport from the verified URL. A viewport pass that fails or cannot run is recorded as unavailable — never claimed as verified. The evidence backs a review against the [instrument standards](../instrument-standards.md), which also requires keyboard/touch disclosure checks, non-color state distinctions, and reduced-motion behavior where applicable.

The launcher, its log, and the provenance endpoint are development-only: `vite build` ships neither the endpoint nor any absolute local path (asserted by `tools/build-purity.test.ts`).
