# Frozen-source browser walkthrough and unavailable evidence

Source: `f9f91f5cb1d4e70dafc2013989fa660720407bb6`.
Server: `npm run dev` in this checkout, `http://localhost:5173/?dev=1`.
Gate: `provenance.json` accepted the exact checkout and clean frozen source before the pass. No captures exist; do not treat this record as screenshot evidence.

## Setup and successful observations (scripted DOM evidence only)

The preview tab loaded the verified URL. `window.__flowsynth.devLaunchScenario('fresh-start')` followed by `devScenarioAssert()` succeeded; this scenario isolates writes from the ordinary save. No actual player's progress was reset. The fresh state had `{}` Encyclopedia knowledge.

Phone live dimensions were confirmed with `innerWidth/innerHeight` as **390×844**, not assumed from the resize response. Measurements:
- Book utility target: x292, y6, width44, height44, separate from Settings and the primary transport.
- Body horizontal overflow: false.
- Reader modal width370; article width326.
- Empty library text named no locked or future topics and remained reachable through the global door.
- Zero-nous Catalog encounter made Charge available without automatically opening the reader.
- Contextual About charge opened the authored illustrative content and set `charge: 'seen'` immediately.
- The text exposed receiver A ← strength-2 generator → receiver B, each receiving strength2, explicitly labeled “Illustrative example — not your live board”; all following rules and decision prose were present in DOM text.
- No essential input, canvas or SVG animation appeared inside the article.
- Synthetic DOM Escape returned to Catalog and the About charge control. A subsequent settled synchronous Close walkthrough focused the help control with `preventScroll`, set Catalog scroll to30, opened the reader and closed it: original30, returned30, focus `about-charge`, modal `catalog`.

These observations were executed via `preview_evaluate` and DOM `.click()` / synthetic KeyboardEvent, **not physical touch, real keyboard or screenshots**. One early measurement set scroll before focusing the help control; normal browser focus scrolled it to8 before opening. The return was8. Repeating with focus-before-scroll confirmed the exact30 round trip above; no source change was required.

## Raw failures and bounded recovery

Tab id: `tab_1_7f9b83d7-5cf9-4bb5-8373-de883cba7ec5`.

1. `preview_open(open:true)` activation returned available:true, loading:false, dialog:null and the verified URL, but visible:false. `preview_status` confirmed those same values. Visibility confirmation remains unavailable.
2. Phone `preview_snapshot(includeImage:true,save:true)` attempt1 failed: **“Preview snapshot failed: Preview automation snapshot timed out after 15000ms.”**
3. Ran `node tools/evidence-healthcheck.mjs --url http://localhost:5173 --viewport 390x844`. Server/provenance was OK at f9f91f5 with clean source. Classified **browser-snapshot**.
4. `preview_status` still reported available, not loading, no dialog, correct URL. Same snapshot attempt2 failed with the same timeout.
5. Another status read gave the same ready state; same snapshot attempt3 failed with the same timeout. **Snapshot budget exhausted; no further snapshots attempted.**
6. `preview_act(click, selector:'#console-encyclopedia')` failed: **“Preview automation click timed out after 15000ms. The click may have happened; check the page before retrying. '#console-encyclopedia' still matches an element after the timeout.”** A subsequent DOM read found modal:null and no reader content; no pointer success claimed and no click retry performed.
7. Desktop resize to1280×900 returned that viewport setting but an inconsistent1280×800 viewport echo. Live DOM read remained390×844. A status read confirmed the actual390×844 viewport. A second resize to1280×900 again returned the setting/incorrect echo, while live DOM remained390×844. Desktop dimensions were **not verified**; no desktop capture/readability claim.
8. One evaluate using `await requestAnimationFrame` timed out after15000ms; synchronous evaluates still worked. No frame-dependent or animation/reduced-motion judgment is inferred from those synchronous reads.

## Unavailable judgments / final acceptance blockers

- Desktop and phone screenshots and visual comparison of the actual rendered composition with the pinned presentation language: **unavailable**, snapshot operation exhausted its three-attempt budget.
- Desktop verified viewport: **unavailable**, resize/live-size mismatch; no desktop pass claimed.
- Real keyboard navigation/focus trap and real touch opening/dismissal: **unavailable**, browser act pipeline timed out. Automated fixture coverage and synthetic DOM walkthrough are not relabeled as these checks.
- Actual reduced-motion emulation and greyscale/non-color visual judgment: **unavailable**. Source contains static text, a nonanimated dot and textual Unseen state, but that is not a completed perceptual assessment.
- Human comprehension (“explain why both receivers get full strength and choose a useful placement”): **unavailable**, no participant. No learned/completed claim is made.

These are missing acceptance evidence, not approved scope reductions or passes. The source self-review and automated suite cannot substitute for them. No acceptance or human visual approval is declared.
