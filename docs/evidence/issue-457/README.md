# Issue #457 — browser evidence recovery, exercised through its failure classes

Controlled failure drills for the evidence health check
(`tools/evidence-healthcheck.mjs`) and the recovery workflow
(docs/agents/visual-evidence.md §5): every failure class is induced against
the real dev server and the real preview harness, driven to recovery or to
exhausted recovery exactly as the workflow prescribes, and the pass resumes
only after provenance and the live viewport are re-confirmed.

No product UI surface changed in this work — the changed surface is dev
tooling (a CLI) and agent documentation, so the instrument standards'
capture review does not apply to a product readout here. The two screenshots
below are not UI review evidence; they demonstrate that capture itself
resumed at the confirmed 390×844 viewport after recovery and after
exhaustion (780×1688 pixels = 390×844 at 2× DPR).

## Provenance

All drills ran against the verified checkout: worktree
`/Users/eggfam/.t3/worktrees/flowsynth/t3-df3775cc`, branch
`t3/issue-457-implementation`, served at `http://localhost:5173/`. The
drills themselves ran at commit `bd38bd8dc4d70b7fb1a176fd5c57ccf0d2522709`
(the implementation commit). After the drills, two refinements they
prompted (the live-viewport confirmation rule) were committed as
`e9f6365`; the capture preflight then re-accepted the same URL at that
commit with clean source, and [provenance.json](provenance.json) is that
final record — the worktree, URL, and server were unchanged throughout.
Raw CLI transcripts: [transcripts/](transcripts/) — A0 healthy baseline,
A1 the classified failure, A2 recovered, A3 preflight after recovery, D0
server-healthy during the browser stall, D1 preflight after the tab's
return, D2/D3 the final preflight and health check at HEAD.

## Drill A — server-provenance failure → recovery (transcripts A0–A3)

The server was killed (`kill $(lsof -ti :5173)`); the health check against
the same URL then answered (A1, verbatim):

```
  server    FAIL — server-provenance (unavailable)
  http://localhost:5173/-/dev/provenance is unreachable (ECONNREFUSED) — the server may have died.
```

with the class's bounded plan: relaunch `npm run dev`, repoint the tab if
the port changed, re-run the preflight; budget one relaunch. The relaunch
re-served the same URL and commit (`bd38bd8d`, source clean); the health
check answered `server OK` (A2) and the preflight re-accepted the URL
(A3) before anything was claimed. Recovery outcome: **resumed**.

## Drill B — browser-visibility (induced, partially observable)

A second, blank tab was opened so the verified tab was backgrounded; the
status read on the verified tab ran and reported its state (`available`,
`visible: false`, correct `url`, `loading: false`). The prescribed recovery
— activation via `preview_open` on the tab, closing the competing tab —
ran cleanly, and captures were unaffected. **Finding, recorded as an
external service limitation:** `visible` reported `false` on every status
read in this environment — including when the tab was the session's only,
current tab — so the flag does not track the hidden-tab condition here.
The usable visibility observables in this harness are `available`,
`loading`, `url`/title, and `dialog`; the hidden-tab capture hang of issue
#456 remains an external-service behavior that could not be forced.

## Drill C — browser-viewport: the confirm rule catches a stale echo

`preview_resize` to 390×844 returned `"setting": freeform 390×844` but
echoed `"viewport": 1280×800` — twice, attempt and retry. The status read
confirmed only the requested setting (`viewportSetting: 390×844`). The
workflow's confirmation rule (§5: a resize's own success is not a
confirmation) resolved it with the live read:

```js
({ w: window.innerWidth, h: window.innerHeight }) // → { w: 390, h: 844 }
```

The capture that followed ([phone-resumed-390x844.png](phone-resumed-390x844.png))
is 780×1688 — genuinely 390×844 at 2× DPR. The stale-echo hazard is now
pinned in §5 and in the health check's printed checks (asserted by
"never accepts a resize's own echo as the viewport confirmation — the live
page read decides").

## Drill D — exhausted recovery, controlled and reproducible

A local socket was opened on `127.0.0.1:54504` that accepts connections and
never responds; the tab was navigated to
`http://127.0.0.1:54504/never-responds`. The status read caught the stall
(`loading: true`, title `Loading http://127.0.0.1:54504/never-responds`)
while the server side stayed verified (D0: `server OK` — the browser class,
not the server class). The snapshot budget then ran exactly as §5
prescribes — status read between attempts, three attempts, stop:

```
attempt 1  Preview snapshot failed: Preview automation snapshot timed out after 15000ms.
           (recovery action: preview_status → loading: true)
attempt 2  Preview snapshot failed: Preview automation snapshot timed out after 15000ms.
           (recovery action: preview_status → loading: true)
attempt 3  Preview snapshot failed: Preview automation snapshot timed out after 15000ms.
```

Budget exhausted: **recorded, not retried.** The exhausted record for this
drill: three raw snapshot timeouts (verbatim above), the status reads
between attempts, and the unavailable checks — any screenshot of the
stalled page (none exists or is claimed), and any capture from the tab
while its URL was not the verified one. The server-healthy checks from D0
stand as run; nothing from the stalled tab was claimed.

Recovery then closed the loop: the socket was killed, the tab navigated
back to the verified URL (`loading: false`), the preflight re-accepted the
URL (D1 — the tab had changed, so provenance was re-validated before
claiming), and the next snapshot succeeded
([phone-after-exhaustion-recovered.png](phone-after-exhaustion-recovered.png),
again 390×844 at 2× DPR).

## External service limitations (explicit)

- **The #456-style hang could not be forced.** The real preview-service
  snapshot hangs (which outlived two tabs in the issue #456 pass) are not
  reproducible on demand and are not fixable from this repo. Drill D
  forces the same observable shape — three 15,000 ms snapshot timeouts
  with status reads between — from a locally hung socket, so the budget
  and the exhausted record are exercised end-to-end; the cause differs
  and is named here.
- **`visible` is not a hidden-tab oracle in this harness** (drill B): it
  reported `false` on every read, including for the session's only,
  current tab. Visibility classification here rests on `available`,
  `loading`, `url`/title, and `dialog`.
- **`preview_resize` echoes a stale viewport** and **`preview_status`
  carries the requested setting, not the live viewport** (drill C): both
  are why §5 and the health check require the in-page
  `window.innerWidth/innerHeight` read before a viewport is claimed.

## Verification record

| Acceptance criterion | Verification | Class |
| --- | --- | --- |
| Health check distinguishes server/provenance failure from browser snapshot, visibility, and viewport failure | `tools/evidence-healthcheck.test.ts` "maps every preflight rejection reason onto the server-provenance class with its reason", "classifies an unreachable server as server-provenance…", the parameterized foreign-worktree/commit-mismatch/dirty-source/unavailable CLI cases, and "prints the three precise checks and names the class each failure maps to"; live: drill A1 names `server-provenance (unavailable)`, drill D separates a healthy server (D0) from a browser-side stall | automated + manual |
| Recovery covers visible-tab activation, snapshot retry, viewport fallback with an explicit retry budget consistent with the browser tooling rules | "recovers browser-visibility by activating the tab, twice at most, each confirmed", "recovers browser-snapshot with a status read and a retry of the same snapshot, three attempts", "recovers browser-viewport with the documented resize budget: status once, retry once more", "carries the shared retry budget…"; budget consistency with the doc is pinned by the "one authoritative recovery workflow" cases ("Three failed attempts is the whole budget", "two activation attempts"); live: drills A (relaunch budget), B (activation), C (status-once + retry-once-more) | automated + manual |
| Successful recovery resumes the pass and confirms the actual viewport and source before claiming verification | "resume steps… re-runs the preflight on the exact URL and confirms the live viewport before resuming" and "never accepts a resize's own echo as the viewport confirmation"; live: A2+A3 (health check OK, preflight ACCEPT after relaunch), drill C's in-page read `390×844` before [phone-resumed-390x844.png](phone-resumed-390x844.png), D1 (preflight after the tab's return) before [phone-after-exhaustion-recovered.png](phone-after-exhaustion-recovered.png) | automated + manual |
| Exhausted recovery records the raw failure, attempted recovery, and exact unavailable checks without claiming they passed | "gives every failure class an observed failure, bounded recovery, budget, and an exhausted record" (all four classes assert `Record` + `unavailable`), "recovers server-provenance…" asserts "Nothing from this pass may be claimed as verified"; live: drill D's verbatim record above — three raw timeouts, the reads between, the unavailable screenshots named, nothing claimed from the stalled tab | automated + manual |
| Reproducible demonstration or controlled failure exercise covers both recovery and exhausted-recovery outcomes; external service limitations documented explicitly | This directory: drills A–D (recovery: A, B, C; exhausted: D), scripted by §5 and rerunnable per drill; the automated cases pin the exhausted record's required content for every class; limitations above and in §5's "External limits" (also asserted by "documents the external service limitation explicitly") | manual + automated |
| Works with existing evidence setup and provenance, without depending on other retro tickets | The health check reads provenance through the same shared code as the capture preflight (`fetchProvenance`/`verifyCaptureProvenance` in `tools/dev/provenance.mjs` — the preflight's own 25 CLI/unit cases stayed green through the refactor); every drill ran against the existing `npm run dev` launcher, `/-/dev/provenance` endpoint, and preflight; no dependency on other retro tickets | automated + manual |

Unavailable checks, named: the ✗-style *screenshot* of a stalled tab in
drill D (screenshots of the stalled page are the unavailable checks the
exhausted record names — none was captured or claimed), and the live
forcing of the external preview-service snapshot hang (not possible from
this repo; its observable shape was exercised locally instead).
