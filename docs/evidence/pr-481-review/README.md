# PR #481 review evidence

Reviewed source: `2cb540744a75e854582cbdb28107cae673beb951` against
`99b4b564053e2483e9a68f4abd47a73122086df9`.

Launched this checkout with `npm run dev`; capture preflight accepted
`http://localhost:5173` with clean source (see `provenance.json`).

- `desktop.png`: 1280×800, terminal launch fresh-start, inspect, start 25,
  advance 60, end, prestige. The last command reports the horizon prerequisite.
- `phone.png`: 390×844 after reload and launch fresh-start; terminal input
  measured 172.8×44px and remained inside the viewport.
- Live reproduction: launch fresh-start then invoke the visual start path
  `beginFlow`; mode becomes flow while `devScenarioModified` remains false
  and `devInterventions` remains empty.

The preview reports visibility false despite successful same-tab snapshots;
visibility confirmation is unavailable. Dedicated keyboard/touch disclosure,
screen-reader, and reduced-motion passes were unavailable in this review.
The Standards reviewer compared the committed captures and changed code with
both pinned prototypes through git show.
