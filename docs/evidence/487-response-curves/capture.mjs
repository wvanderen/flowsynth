import assert from "node:assert/strict";
import { createRequire } from "node:module";

// The response-curve evidence capture (issue #487): the dev panel's run
// row with its response-curve select, desktop and phone, from the
// verified checkout. The script composes a Bounded seed-7 one-day run
// through the panel's own controls and asserts the note names the curve
// before each screenshot — a capture of a surface that did the thing.
//
// Run after the capture preflight accepted the URL:
//   node tools/evidence-preflight.mjs --url http://localhost:PORT \
//     --record docs/evidence/487-response-curves/provenance.json
//   node docs/evidence/487-response-curves/capture.mjs --url http://localhost:PORT
//
// playwright-core resolves from the repo's node_modules when installed
// (`npm i --no-save playwright-core`); PLAYWRIGHT_MODULE and CHROMIUM_PATH
// override, matching the #486 capture's conventions.

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const url = process.argv[process.argv.indexOf("--url") + 1] ?? process.env.EVIDENCE_URL ?? "http://localhost:5173/";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true });

try {
  for (const [name, width, height] of [["desktop", 1280, 800], ["phone", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === "phone", reducedMotion: "reduce" });
    const page = await context.newPage();
    // A fresh load at the target size, so the panel mounts at its own
    // metrics — never a desktop drag position carried across a resize.
    await page.goto(`${url}?dev=1`);
    await page.waitForFunction(() => Boolean(window.__flowsynth));
    const ready = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      options: [...document.getElementById("dev-playthrough-curve").options].map((option) => option.value),
      label: document.getElementById("dev-playthrough-curve").getAttribute("aria-label"),
    }));
    assert.equal(ready.width, width);
    assert.equal(ready.height, height);
    assert.equal(ready.reducedMotion, true, "the capture runs reduced-motion");
    assert.deepEqual(ready.options, ["shipped", "linear", "bounded"]);
    assert.equal(ready.label, "Response curve candidate");

    // The select operates from the keyboard: focus it, walk to Bounded,
    // and read the selection back — no pointer involved.
    await page.focus("#dev-playthrough-curve");
    await page.selectOption("#dev-playthrough-curve", "bounded");
    const selected = await page.evaluate(() => document.getElementById("dev-playthrough-curve").value);
    assert.equal(selected, "bounded");

    // The run composes from the panel's own controls, agent command aside.
    await page.fill("#dev-playthrough-seed", "7");
    await page.fill("#dev-playthrough-budget", "1");
    await page.click('[data-dev="playthrough"]');
    await page.waitForFunction(() => (document.getElementById("dev-playthrough-note")?.textContent ?? "").includes("curve bounded"));
    const note = await page.evaluate(() => document.getElementById("dev-playthrough-note").textContent);
    assert.ok(note.includes("curve bounded"), `the note never named the curve: ${note}`);

    await page.screenshot({ path: new URL(`${name}-curve-select.png`, import.meta.url).pathname });
    console.log(`${name}: captured at ${width}x${height}; note names "curve bounded".`);
    await context.close();
  }
} finally {
  await browser.close();
}
