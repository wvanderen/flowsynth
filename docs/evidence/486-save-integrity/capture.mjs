import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";

// The save-integrity failure path (issue #486): every changed failure copy
// — the save failure line, the export refusal, the refused update's line —
// captured on desktop and phone from the verified checkout, with the
// recovery read that follows a valid update. The scenario install keeps
// the walk on an isolated in-memory save; the player's persistent save is
// never read or written.

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const url = process.env.EVIDENCE_URL || "http://localhost:5173/";
const output = new URL("./", import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true });
const records = [];

const SAVE_FAILED = "Saving failed — your last valid save stands untouched.";
const EXPORT_REFUSED = "These figures exceed what a save can hold — nothing was exported.";
const ADVANCE_REFUSED = "The board's figures outran the instrument's range — the refused update left nothing behind.";
const HONESTY_REFUSED = "The provisional nous cannot bank safely, so nothing was credited.";

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

    // The save failure line: a state serialization refuses, the write
    // fails, and the live region says so — claiming no recovery.
    const saveFailure = await page.evaluate(() => {
      const app = window.__flowsynth;
      app.state.nous = Number.NaN;
      app.save();
      app.render();
      return { status: document.querySelector("#status").textContent, bank: app.state.nous };
    });
    assert.equal(saveFailure.status, SAVE_FAILED);
    assert.equal(Number.isNaN(saveFailure.bank), true); // nothing fabricated a recovery
    await page.screenshot({ path: new URL(`${name}-save-failure.png`, output).pathname });

    // The export refusal: the real settings door, the export entry, and a
    // modal that refuses without offering a file.
    await page.locator("#console-settings").click();
    await page.locator("#settings-export").click();
    const exportRefusal = await page.evaluate(() => ({
      lead: document.querySelector("#modal-content .lead")?.textContent ?? "",
      textarea: Boolean(document.getElementById("export-text")),
      download: Boolean(document.getElementById("export-download")),
    }));
    assert.equal(exportRefusal.lead, EXPORT_REFUSED);
    assert.equal(exportRefusal.textarea, false);
    assert.equal(exportRefusal.download, false);
    await page.screenshot({ path: new URL(`${name}-export-refusal.png`, output).pathname });
    await page.keyboard.press("Escape");

    // The refused update: a live session whose board rate left the range
    // refuses the span, the live region names it, and the balance carries
    // nothing from the refused update.
    const advanceRefusal = await page.evaluate(async () => {
      const app = window.__flowsynth;
      const { startSession } = await import("/src/engine/actions.ts");
      app.state.nous = 0;
      startSession(app.state, null);
      app.state.modules[0].level = 5000; // 1.2^5000 leaves the double range
      const result = app.devAdvance(60);
      return {
        fault: result.fault ?? null,
        status: document.querySelector("#status").textContent,
        nous: app.state.nous,
        elapsed: app.state.session.elapsed,
      };
    });
    assert.ok(advanceRefusal.fault, "the refused update reports its fault");
    assert.equal(advanceRefusal.status, ADVANCE_REFUSED);
    assert.equal(advanceRefusal.nous, 0);
    assert.equal(advanceRefusal.elapsed, 0);
    await page.screenshot({ path: new URL(`${name}-advance-refusal.png`, output).pathname });

    // The honesty report's refusal: an unrepresentable bucket refuses the
    // whole settlement before it credits a minute — the pool stays
    // outstanding, and the live region says what refused.
    const honestyRefusal = await page.evaluate(() => {
      const app = window.__flowsynth;
      app.state.session.accounting.poolSeconds = 3600;
      app.state.session.accounting.bucketNous = Number.POSITIVE_INFINITY;
      app.resolveHonesty("full");
      return {
        status: document.querySelector("#status").textContent,
        pool: app.state.session.accounting.poolSeconds,
        credited: app.state.session.accounting.creditedSeconds,
        bucketUnrepresentable: !Number.isFinite(app.state.session.accounting.bucketNous),
      };
    });
    assert.equal(honestyRefusal.status, HONESTY_REFUSED);
    assert.equal(honestyRefusal.pool, 3600);
    assert.equal(honestyRefusal.credited, 0);
    assert.equal(honestyRefusal.bucketUnrepresentable, true); // dropped by no answer — waiting, unbanked
    await page.screenshot({ path: new URL(`${name}-honesty-refusal.png`, output).pathname });

    // The recovery read: the board back inside the range, the next update
    // banks, and the dev clock's own line ends the refusal streak.
    const recovery = await page.evaluate(() => {
      const app = window.__flowsynth;
      app.state.modules[0].level = 4;
      const result = app.devAdvance(60);
      return { fault: result.fault ?? null, status: document.querySelector("#status").textContent, nous: app.state.nous };
    });
    assert.equal(recovery.fault, null);
    assert.equal(recovery.status, "Dev clock +60s.");
    assert.ok(recovery.nous > 0);
    await page.screenshot({ path: new URL(`${name}-recovery.png`, output).pathname });

    records.push({ viewport: name, ready, saveFailure, exportRefusal, advanceRefusal, honestyRefusal, recovery });
    await context.close();
  }
  await writeFile(new URL("observations.json", output), `${JSON.stringify(records, null, 2)}\n`);
  console.log(JSON.stringify(records, null, 2));
} finally {
  await browser.close();
}
