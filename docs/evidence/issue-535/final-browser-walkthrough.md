# Browser evidence at 9a8d6fba33d35d5818c6804ba0dc0d5866531e54

Source commit: `9a8d6fba` (full hash in `provenance.json`), clean active checkout served by `npm run dev` at `http://localhost:5174`. Capture preflight accepted after integration merge. All PNGs and `browser-observations.json` here are from that source, not the superseded b512aaf walkthrough.

## Preview service failure (superseded source, no captures)

The T3 tab opened the correct URL with `available:true`, `loading:false`, no dialog, `visible:false`. Live page reads confirmed1280×900 and390×844. Scripted ledger → Prestige → Escape restored `about-prestige`, retained zero prestiges and the disabled reset. Phone DOM widths326px article/370px content did not overflow and the article had zero animations. These are observations at b512aaf only, not current evidence.

`preview_snapshot` failed with **“Preview snapshot failed: Preview automation snapshot timed out after 15000ms.”** three times. Health check (`browser-healthcheck.log`) verified server/provenance. Between failures the same-tab status was read; one activation attempt kept `visible:false`; repeated same-operation snapshots still failed. Snapshot budget exhausted; no screenshot was produced and no preview visual acceptance is claimed. The owned tab was closed. A page-evaluate attempt also reported `SyntaxError: Identifier 'app' has already been declared`; the subsequent scoped expression succeeded. No failed operation is counted as passing.

## Independent local-Chromium capture pass (current source)

The local installed Chromium provided a separate working capture pipeline. This is not a claim that the preview service recovered. Chromium155.0.8059.84 ran headless with a private temporary profile and localhost CDP port9335. `capture.mjs` uses Node22.23.4's WebSocket API against that browser. It opens the verified URL, uses the existing isolated `fresh-start` dev scenario, and asserts the results before saving captures. Run:

```
chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9335 --user-data-dir=/tmp/flowsynth-535-chromium about:blank
mise exec node@22.23.4 -- node docs/evidence/issue-535/capture.mjs
```

Capture setup iterations: first connection raced browser startup (`ECONNREFUSED`), then connection succeeded. An Enter sequence without its character event did not activate the native button (`Error: desktop opening`); supplying the complete CDP Enter key/character event succeeded. A first phone Close locator was incorrect (`Error: phone Close target`); corrected to the existing `#close-modal`. These were evidence-script errors, not application source changes or passes; the complete final script ran successfully afterward, with recorded assertions for both viewports. The log and observations describe the completed run.

Current artifacts:
- `desktop.png`:1280×900, Prestige example via native button Enter activation, static reduced-motion presentation, visible Close focus ring.
- `phone.png`:390×844, same entry via CDP-emulated touch on the actual contextual button.
- `phone-lower.png`: scroll reveals the remaining decision text; no mandatory animation or exercises. Close remains reachable by scrolling/keyboard.
- `desktop-confirmation.png`, `phone-confirmation.png`: actual zero-yield reset warning, losses/preservation, Not yet and explicit Prestige anyway remain local.
- `browser-observations.json`, `capture.log`: current-source assertions and exact text/viewport/return/session observations.

Both viewports emulate `prefers-reduced-motion: reduce` and observe it as true; article animation count0, no horizontal page or article overflow. Desktop Enter opens; Escape returns to the ledger's `about-prestige` focus, with reset still disabled and prestiges0. Phone emulated touch opens and closes via visible Close, restoring the same focus and ledger state. A subsequent scripted live session advances10 seconds through reading and closing, retains the identical session, remains flow, and cannot reset. These are browser automation results, not a human operating a physical device.

## Appearance review and limitations

Agent image inspection of the actual PNGs against the pinned instrument/controls language: clipped outer panel, square controls, open divisions, visible focus, readable sans prose and an explicitly illustrative example; no nested cards or added motion. Phone has vertical reading scroll rather than horizontal clipping; lower capture shows the complete final decision text. Confirmation keeps the zero claim, reset losses and preservation beside its controls. Non-color words carry unseen/seen state in the existing UI tests, and the shown Close focus ring is visible without relying on resource color.

**Unavailable:** human comprehension, representative-player explanation of enduring progression, human perceptual/accessibility approval, physical keyboard/touch device validation, screen-reader delivery and independent layout review. Automated touch/motion emulation and agent image inspection do not establish these. Final acceptance remains blocked on the required unavailable human/perceptual judgments; no scope waiver or issue closure is claimed.
