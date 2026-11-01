// The #487 evidence capture script: the dev panel's run row with its
// response-curve select (#487), desktop and phone, from the verified
// checkout. Drives the panel's own controls — the curve select set to
// Bounded, a one-day seed-7 walk — so the capture shows the composed
// run and its note line, then captures both viewports.
//
// This session the preview automation's snapshot and recording pipelines
// timed out on every attempt (see README.md — the raw failures and the
// recovery attempts are recorded there), so the PNGs this script emits
// are absent; the in-page observations that did run are recorded in
// observations.json. Rerun this script against a working pipeline to
// produce them:
//
//   node tools/evidence-preflight.mjs --url http://localhost:PORT \
//     --record docs/evidence/487-response-curves/provenance.json
//   node docs/evidence/487-response-curves/capture.mjs --url http://localhost:PORT

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const url = process.argv[process.argv.indexOf("--url") + 1] ?? "http://localhost:5173/";
const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
];

for (const viewport of viewports) {
  // 1. Size the tab to the target and confirm the live size (a resize's
  //    own echo can be stale — read window.innerWidth/Height).
  await resize(viewport.width, viewport.height);
  const live = await evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  if (live.w !== viewport.width || live.h !== viewport.height) {
    throw new Error(`${viewport.name}: live viewport ${live.w}x${live.h} never matched ${viewport.width}x${viewport.height}`);
  }

  // 2. Reload at the target size so the panel mounts at its own metrics,
  //    then compose the run from the panel's own controls.
  await goto(`${url}?dev=1`);
  await evaluate(() => {
    const curve = document.getElementById("dev-playthrough-curve");
    const seedField = document.getElementById("dev-playthrough-seed");
    const budgetField = document.getElementById("dev-playthrough-budget");
    curve.value = "bounded";
    seedField.value = "7";
    budgetField.value = "1";
    document.querySelector('[data-dev="playthrough"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  // 3. Confirm the note names the curve, then capture.
  const note = await evaluate(() => document.getElementById("dev-playthrough-note")?.textContent ?? "");
  if (!note.includes("curve bounded")) throw new Error(`${viewport.name}: the note never named the curve — ${note}`);
  await screenshot(join(here, `${viewport.name}-curve-select.png`));
  console.log(`${viewport.name}: captured (${viewport.width}x${viewport.height}), note names "curve bounded".`);
}

// The harness calls are filled by the operator's preview automation
// (resize/goto/evaluate/screenshot over the tab tools); this script
// documents the deterministic setup each capture shares.
async function resize(width, height) { void width; void height; }
async function goto(to) { void to; }
async function evaluate(fn) { void fn; return { w: 0, h: 0 }; }
async function screenshot(path) { void path; }
