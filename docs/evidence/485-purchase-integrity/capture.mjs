import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const url = process.env.EVIDENCE_URL || "http://localhost:5173/";
const output = new URL("./", import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true });
const records = [];

try {
  for (const [name, width, height] of [["desktop", 1280, 800], ["phone", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: name === "phone", reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(`${url}?dev=1`);
    await page.waitForFunction(() => Boolean(window.__flowsynth));
    await page.addStyleTag({ content: "#dev-panel { display: none !important; }" });
    const ready = await page.evaluate(async () => {
      const app = window.__flowsynth;
      await app.devLaunchScenario("fresh-start");
      app.devScenarioAssert();
      return { width: innerWidth, height: innerHeight, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches, scenario: app.devScenarioNote };
    });
    assert.equal(ready.width, width);
    assert.equal(ready.height, height);
    assert.equal(ready.reducedMotion, true);
    await page.evaluate(() => {
      window.__flowsynth.state.nous = Number.NaN;
      window.__flowsynth.render();
    });
    await page.screenshot({ path: new URL(`${name}-nonfinite-balance.png`, output).pathname });
    const face = page.locator(".face-buy").first();
    if (name === "phone") await face.tap();
    else {
      await face.focus();
      await page.keyboard.press("Enter");
    }
    const refusal = await page.evaluate(() => ({
      status: document.querySelector("#status").textContent,
      level: window.__flowsynth.state.modules[0].level,
      invested: window.__flowsynth.state.modules[0].invested,
      bankIsNaN: Number.isNaN(window.__flowsynth.state.nous),
      focused: document.activeElement?.classList.contains("face-buy"),
    }));
    assert.equal(refusal.status, "The purchase cannot be charged safely, so nothing was bought.");
    assert.equal(refusal.level, 0);
    assert.equal(refusal.invested, 0);
    assert.equal(refusal.bankIsNaN, true);
    if (name === "desktop") assert.equal(refusal.focused, true);
    await page.screenshot({ path: new URL(`${name}-refusal.png`, output).pathname });
    await page.evaluate(() => {
      window.__flowsynth.state.nous = 1000;
      window.__flowsynth.render();
    });
    if (name === "phone") await face.tap();
    else {
      await face.focus();
      await page.keyboard.press("Enter");
    }
    const recovery = await page.evaluate(() => ({ level: window.__flowsynth.state.modules[0].level, bank: window.__flowsynth.state.nous }));
    assert.deepEqual(recovery, { level: 1, bank: 990 });
    await page.screenshot({ path: new URL(`${name}-recovery.png`, output).pathname });
    await page.evaluate(async () => {
      const app = window.__flowsynth;
      await app.devLaunchScenario("fresh-start");
      app.devScenarioAssert();
      const { give } = await import("/src/engine/fixtures.ts");
      const ceiling = give(app.state, "additive", null, 0);
      ceiling.level = 1506;
      app.state.nous = 10;
      app.render();
    });
    const chip = page.locator('#upgrade-all [data-sweep="1"]');
    const quote = await chip.getAttribute("title");
    assert.match(quote, /\+1 on all 1 modules · 10 ν/);
    await chip.focus();
    await page.screenshot({ path: new URL(`${name}-boundary-quote.png`, output).pathname });
    if (name === "phone") await chip.tap();
    else await page.keyboard.press("Enter");
    const boundary = await page.evaluate(() => ({ level: window.__flowsynth.state.modules[0].level, ceiling: window.__flowsynth.state.modules[1].level, bank: window.__flowsynth.state.nous }));
    assert.deepEqual(boundary, { level: 1, ceiling: 1506, bank: 0 });
    await page.screenshot({ path: new URL(`${name}-boundary-purchase.png`, output).pathname });
    await page.locator('[data-cell="0,0"]').click();
    assert.equal(await page.locator("#detail-upgrade").count(), 1);
    await page.screenshot({ path: new URL(`${name}-detail.png`, output).pathname });
    records.push({ viewport: name, ready, refusal, recovery, quote, boundary, detailBuyPresent: true });
    await context.close();
  }
  await writeFile(new URL("observations.json", output), `${JSON.stringify(records, null, 2)}\n`);
  console.log(JSON.stringify(records, null, 2));
} finally {
  await browser.close();
}
