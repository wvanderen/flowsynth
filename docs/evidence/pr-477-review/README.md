# PR 477 review evidence

Reviewed 18f1add0069155939f53dff27fff862477b4b2e3 against 081d0ea6ce77da66112c3a3be71554f86ae7da6c. Preflight accepted this checkout at http://localhost:5173; see provenance.json.

npm install completed. npm run check passed. npm test passed: 95 files, 1889 passed, 2 existing skips.

Desktop 1440×900 and phone 390×844 live viewport dimensions confirmed through in-page reads. desktop.png and phone.png show the one-day run result after setting the visible budget control to 1 and invoking its button. Preview screenshots may have different pixel dimensions from CSS viewport dimensions. Phone shows the run button outside the visible viewport; keyboard/touch reachability and disclosure checks unavailable (not exercised). Reduced-motion checks unavailable (not exercised). No complete presentation pass claimed. Controls were compared by the independent standards reviewer with the pinned prototype source.

Application-boundary reproduction:

```js
const r = window.__flowsynth.devRunPlaythrough({
  budgetDays: 2,
  schedule: { sessionsPerDay: 8, sessionMinutes: 1, breatherMinutes: 600 }
});
({ elapsed: r.elapsedSeconds, credited: r.creditedSeconds,
   backward: r.events.some((e, i) => i && e.at < r.events[i-1].at) });
// elapsed: 338880; credited: 960; backward: true
```

A default one-day run begins events at 1767603600 rather than 0, reproducing the elapsed-clock origin defect. No implementation edits or GitHub comments made.
