# Final browser evidence at 9a72a69

Source: `9a72a6941a601390a38b78fbe7ffdc2f58e57470` (re-freeze after the test reconciliation batch).

The capture preflight accepted the active checkout at this exact commit with clean source; see `provenance.json`. `browser-healthcheck.log` also confirms the server/provenance side. `browser-walkthrough.md` is the earlier, superseded f9f91f5 pass and is not relabeled as this revision's evidence.

## Current scripted observations

Opened the verified `http://localhost:5173/?dev=1`, installed `fresh-start` via `devLaunchScenario`, and called `devScenarioAssert()` successfully. Used the existing isolated scenario, not a real user's save.

**Desktop:** navigation applied the requested1280×900 viewport, confirmed by a live DOM dimension read. The global book measured44×44 at x1172/y9.5. Opening About charge from Catalog produced the expected Encyclopedia dialog and `charge:'seen'`. The reader article measured467.15625px wide; the body had no horizontal overflow. These are DOM geometry observations, not a screenshot/readability judgment.

**Phone:** resizing and navigating applied390×844, confirmed by the live DOM. Book measured44×44 at x292/y6; article width326; no body horizontal overflow. The diagram's full illustrative caption, receiver A ← generator → receiver B, strength2 on each receiver and the no-connection sentence were present in rendered DOM text. Zero-nous Catalog → contextual reader → synthetic DOM Escape returned to Catalog, focus `about-charge`, scroll30 →30. Opening marked the entry seen immediately. No scrolling or acknowledgment of the lesson was required.

All scripted openings above used DOM `.click()` and the last dismissal used a synthetic KeyboardEvent. These observations do **not** prove real keyboard/touch interaction or human comprehension.

## Current capture/control failures and recovery

- `preview_open(open:true)` returned available:true, loading:false, dialog:null, correct URL, but visible:false. Visibility confirmation remains unavailable.
- At1280×900, three current-source `preview_snapshot(includeImage:true,save:true)` attempts failed with **“Preview snapshot failed: Preview automation snapshot timed out after 15000ms.”** Status was read between attempts and consistently reported available:true, loading:false, no dialog, correct URL and viewport. Health check verified the clean current-source server. This is **browser-snapshot**; the three-attempt budget is exhausted. No screenshots exist for either viewport.
- A `preview_act(press,key:'Escape')` call returned without error, but the subsequent DOM read still showed modal:'encyclopedia', focus:'close-modal'. Therefore no real keyboard Escape success is claimed. The automation delivery is unavailable/unconfirmed; the synthetic DOM escape and fixture tests are separately identified rather than substituted for it.
- Phone resize initially echoed a stale viewport; subsequent navigation and live `innerWidth/innerHeight` verified390×844. No screenshot pass was retried after the snapshot budget was exhausted.

## Acceptance disposition

**Unavailable / outstanding:** desktop/phone screenshot composition and actual visual comparison with the pinned prototype; real keyboard/tab/focus and real touch judgments; reduced-motion emulation; greyscale/non-color perception; human comprehension. Static text/no exercise controls and the textual Unseen state are source/DOM observations only. These unavailable judgments remain acceptance blockers unless completed or explicitly scoped by the authorized maintainer; no scope reduction is recorded.

**No human learning, visual approval, or final acceptance is claimed.**
