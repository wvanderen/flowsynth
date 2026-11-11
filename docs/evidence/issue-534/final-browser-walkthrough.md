# Final browser evidence attempt — #534

Source: `a3caf9b107a9466d8171875613917c9c4da3549f`, clean active worktree. URL `http://localhost:5173/?dev=1`. Capture preflight accepted before the attempt and again after recovery (`provenance.json`). Server launched with `npm run dev` from this checkout; it printed the same worktree, branch and commit.

## Reproducible setup

In the developer URL:

```js
const app = window.__flowsynth;
app.devLaunchScenario('fresh-start'); // isolated in-memory scenario
app.devScenarioAssert();
app.openModal('catalog');
```

Observed available marks `{charge:'available', chords:'available'}`, with Catalog still open and the About chords section button present. This is not automatic reader opening.

## Desktop keyboard observations (not perceptual acceptance)

- Desktop resize requested1280×900; in-page `innerWidth/innerHeight` confirmed1280×900 (initial tool response had stale1280×800).
- About chords bounding box: x353, y637, width129.09375, height44. This establishes a geometric target, not a touch-usability judgment.
- Focused the section door via DOM, then sent real browser `preview_act` key Enter. Observed Encyclopedia, heading “Chords and harmonic capacity”, mark `chords:'seen'` while Charge remained available. Caption “Illustrative example — not your live board” was present. No exercise input/canvas/animate elements; document scrollWidth equaled1280. Static essentials exist in source and DOM, not an animation-dependent lesson.
- Sent browser key Escape. Observed modal `catalog`, focus id `about-chords`, capacityBought0 and unchanged opening nous12. No purchase was made.
- These are scripted browser keyboard/DOM observations. No screenshot could confirm visible focus or readable composition; no human keyboard/perceptual acceptance is claimed.

## Capture failure and bounded recovery

Failure class **browser-snapshot**. Each of the three same-tab snapshot attempts used `includeImage:true, save:true` and failed verbatim:

> Preview snapshot failed: Preview automation snapshot timed out after 15000ms.

After the first failure, ran `node tools/evidence-healthcheck.mjs --url http://localhost:5173 --viewport 1280x900` (`browser-healthcheck.log`). `preview_status` showed available true, loading false, no dialog, correct verified URL, but visible false. Reactivated the existing tab with `preview_open({tabId,open:true})`, then status again: visible still false, otherwise ready. Retried the same snapshot (failure2). Read status again (same ready URL and dimensions), retried the same snapshot (failure3). Budget exhausted; **no screenshot artifact exists**. Visibility/perceptual readiness is unavailable: no successful confirmation snapshot, so the DOM observations above are not presented as a capture pass. No alternate server or foreign-worktree evidence was substituted.

## Phone viewport failure

Failure class **browser-viewport**. Requested390×844 with `preview_resize`, then checked real in-page dimensions. On each of three attempts the tool returned a390×844 setting but live dimensions remained1280×900. Read `preview_status` between attempts: available true, loaded, dialog-free, same verified URL; `viewportSetting`390×844 and actual viewport1280×900. The misleading resize responses also echoed1280×800. Repeated the exact resize within the three-attempt budget, checking `innerWidth/innerHeight` after each; all remained1280×900. Ran the phone health check (`phone-healthcheck.log`) and reaccepted capture preflight. **Phone390×844 is unavailable**; no desktop observation is relabeled phone evidence, and no phone snapshot was attempted at a false viewport.

## Explicit unavailable judgments

- Desktop screenshot/composition/readability, visible keyboard focus and non-color perceptual state distinctions: snapshot service timeout ×3.
- Phone screenshot/layout/keyboard/touch: live viewport never matched390×844 after ×3 resize attempts.
- Actual touch delivery: not established by geometric targets or mouse clicks; no touch-device session available.
- Reduced-motion emulation/perceptual judgment: queried media state was false and the preview API has no reduced-motion override. Source/DOM static teaching is observed, but emulated reduced-motion acceptance is unavailable.
- Human comprehension: no participant. Proposed task: explain why two recognized chords sharing a capacity-1 voice cannot both activate, explain why fitting is not a promise of activation, then locate the actual constraint across participating hexes. Opening a reader or marking seen demonstrates none of this comprehension.

Final evidence-gate disposition: automated and source portions verified; **final acceptance blocked on unavailable required browser/perceptual/touch/reduced-motion and human judgments**. No issue closure is authorized or performed. Preview tab closed after the attempt.
