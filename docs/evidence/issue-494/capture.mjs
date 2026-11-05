// Run after evidence-preflight, with chromedriver on :9517 and npm run dev.
// All state is synthetic (the committed lost-money seed); this tab owns its
// localStorage and is closed at exit.
import assert from "node:assert/strict";
import { readFile, writeFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const url = process.env.FLOWSYNTH_EVIDENCE_URL ?? "http://localhost:5173/";
const out = new URL("./", import.meta.url);
const original = "flowsynth.save.original.v1";
const primary = "flowsynth.save.v1";
const archive = "flowsynth.save.original.pre-v13";
const seed = JSON.stringify(JSON.parse(await readFile(new URL("seed-lost-v12.json", import.meta.url), "utf8")));
const downloadPath = await mkdtemp(join(tmpdir(), "flowsynth-494-download-"));
const checks = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, body, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`http://127.0.0.1:9517${path}`, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok || result.value?.error) throw new Error(JSON.stringify(result));
  return result.value;
}
const session = await request("/session", { capabilities: { alwaysMatch: { browserName: "chrome", "goog:chromeOptions": { binary: "/usr/bin/chromium", args: ["--headless=new", "--disable-gpu", "--no-first-run", "--window-size=1280,1200"] } } } });
const id = session.sessionId;
const cmd = (path, body, method) => request(`/session/${id}${path}`, body, method);
const cdp = (name, params = {}) => cmd("/goog/cdp/execute", { cmd: name, params });
async function evaluate(script, ...args) {
  const result = await cmd("/execute/async", { script: `const done = arguments[arguments.length - 1]; const args = Array.from(arguments).slice(0, -1); Promise.resolve().then(async () => { ${script} }).then(value => done({ok:true,value}), error => done({ok:false,error:String(error.stack ?? error)}));`, args });
  assert.equal(result.ok, true, result.error);
  return result.value;
}
async function go(path = "") { await cmd("/url", { url: new URL(path, url).href }); }
async function click(selector) {
  const el = await cmd("/element", { using: "css selector", value: selector });
  await cmd(`/element/${el["element-6066-11e4-a52e-4f735466cecf"]}/click`, {});
}
async function wait(script) {
  for (let i = 0; i < 40; i++) { if (await evaluate(script)) return; await pause(100); }
  throw new Error(`Timed out: ${script}`);
}
async function shot(name) {
  await writeFile(new URL(`${name}.png`, out), Buffer.from(await cmd("/screenshot"), "base64"));
}
async function seedBoot(text = seed) {
  await go("?dev=1");
  await evaluate(`window.__flowsynth.dispose(); localStorage.clear(); localStorage.setItem(args[0], args[1]);`, primary, text);
  await go();
}
try {
  await cmd("/timeouts", { script: 30000 });
  await cdp("Page.setDownloadBehavior", { behavior: "allow", downloadPath });

  // Desktop: the offer stands at boot, both slots intact, no duplicate
  // load-failure notice beside it.
  await seedBoot();
  await wait(`return !!document.getElementById('recovery-apply');`);
  assert.equal(await evaluate(`return document.getElementById('status').textContent.includes('Could not load');`), false);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, primary), seed);
  assert.equal(await evaluate(`return localStorage.getItem(args[0])?.length ?? 0;`, original), 0);
  checks.push("Boot presented the recovery offer at the load destination; both slots kept their exact bytes and no load-failure notice rode beside the offer.");

  // The unavailable figures named verbatim; the disclosure layer works.
  const lostShown = await evaluate(`return document.getElementById('modal-content').textContent.includes('modules[0].invested');`);
  assert.equal(lostShown, true);
  await evaluate(`document.querySelector('[aria-label="Arete — what it means"]').focus();`);
  await wait(`return document.querySelector('[aria-label="Arete — what it means"]').getAttribute('aria-expanded') === 'true';`);
  await shot("desktop-recovery-offer");
  await shot("desktop-recovery-disclosure");
  await cmd("/actions", { actions: [{ type: "key", id: "keyboard", actions: [{ type: "keyDown", value: "\uE00C" }, { type: "keyUp", value: "\uE00C" }] }] });
  assert.equal(await evaluate(`return document.querySelector('[aria-label="Arete — what it means"]').getAttribute('aria-expanded');`), "false");
  assert.equal(await evaluate(`return !!document.getElementById('recovery-apply');`), true);
  checks.push("The offer named the lost paths verbatim; the Arete disclosure opened with keyboard focus and dismissed with Escape without closing the offer.");

  for (const [term, name] of [["memorized", "memorized"], ["Warp Beam", "warp-beam"]]) {
    await evaluate(`document.querySelector('[aria-label="' + args[0] + ' — what it means"]').focus();`, term);
    await wait(`return document.querySelector('[aria-label="${term} — what it means"]').getAttribute('aria-expanded') === 'true';`);
    await shot(`desktop-recovery-${name}`);
    await cmd("/actions", { actions: [{ type: "key", id: "keyboard", actions: [{ type: "keyDown", value: "\uE00C" }, { type: "keyUp", value: "\uE00C" }] }] });
    assert.equal(await evaluate(`return document.querySelector('[aria-label="' + args[0] + ' — what it means"]').getAttribute('aria-expanded');`, term), "false");
  }
  checks.push("Memorized and Warp Beam both disclose their glossary meanings on keyboard focus and dismiss with Escape.");

  // Download the original: the file is the exact source bytes.
  await click("#recovery-original");
  for (let i = 0; i < 40 && !(await readdir(downloadPath)).includes("flowsynth-original.json"); i++) await pause(100);
  assert.equal(await readFile(join(downloadPath, "flowsynth-original.json"), "utf8"), seed);
  checks.push("Download the original produced a file exactly equal to the stored source bytes.");

  // Applying lands the calibrated economy; the source bytes become the
  // lineage's original; the slot carries the recovered v13 file.
  await click("#recovery-apply");
  await wait(`return !document.getElementById('recovery-apply');`);
  await pause(400);
  const stored = JSON.parse(await evaluate(`return localStorage.getItem(args[0]);`, primary));
  assert.equal(stored.version, 13);
  assert.ok(stored.state.nous > 0 && stored.state.nous < 100);
  assert.ok(stored.state.modules.every(m => m.invested === 0));
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, original), seed);
  await shot("desktop-recovered-board");
  checks.push("Recovery landed the calibrated economy (opening grant, levels cleared, finite v13 bytes) and retained the exact source bytes as the original.");

  // The recovered save reloads silent: no re-offer, no migration.
  await go();
  await pause(1200);
  assert.equal(await evaluate(`return !!document.getElementById('recovery-apply');`), false);
  assert.equal(await evaluate(`return !!document.getElementById('migration-continue');`), false);
  checks.push("Reload of the recovered v13 save presented neither the recovery offer nor the migration again.");

  // Declining: both slots intact, the fresh instrument beneath, and the
  // next boot offers again.
  await seedBoot();
  await wait(`return !!document.getElementById('recovery-decline');`);
  await click("#recovery-decline");
  await pause(300);
  assert.equal(await evaluate(`return !!document.getElementById('recovery-apply');`), false);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, primary), seed);
  assert.equal(await evaluate(`return localStorage.getItem(args[0])?.length ?? 0;`, original), 0);
  await shot("desktop-recovery-declined");
  await go();
  await wait(`return !!document.getElementById('recovery-apply');`);
  checks.push("Declining kept both slots intact over the fresh instrument, and the next boot offered the same choice again.");

  // Primary-only quota denial must undo the backup writes and leave
  // both working state and the offer available for retry.
  await seedBoot();
  await go("?dev=1");
  await wait(`return !!document.getElementById('recovery-apply');`);
  await evaluate(`
    localStorage.setItem(args[0], 'earlier original');
    localStorage.setItem(args[1], 'earlier archive');
    window.__recoveryBefore = JSON.stringify(window.__flowsynth.state);
    window.__recoverySetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === args[2]) throw new DOMException('Injected primary quota denial', 'QuotaExceededError');
      return window.__recoverySetItem.call(this, key, value);
    };
  `, original, archive, primary);
  await click("#recovery-apply");
  assert.equal(await evaluate(`return window.__flowsynth.ui.modal;`), "recovery");
  assert.equal(await evaluate(`return JSON.stringify(window.__flowsynth.state) === window.__recoveryBefore;`), true);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, primary), seed);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, original), "earlier original");
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, archive), "earlier archive");
  assert.ok(await evaluate(`return document.querySelector('.import-error').textContent.includes('could not be saved');`));
  await evaluate(`document.getElementById('recovery-apply').scrollIntoView({block:'center'});`);
  await shot("desktop-recovery-write-failed");
  await evaluate(`Storage.prototype.setItem = window.__recoverySetItem;`);
  await click("#recovery-apply");
  await wait(`return !document.getElementById('recovery-apply');`);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, original), seed);
  assert.equal(await evaluate(`return JSON.parse(localStorage.getItem(args[0])).version;`, primary), 13);
  checks.push("Injected primary-write denial preserved the offer, working state, primary, original, and archive byte-for-byte; restoring storage and retrying committed v13 successfully.");

  // The import destination: a pasted lost save offers recovery there;
  // declining hands the screen back to the import walk, adopting nothing.
  await go("?dev=1");
  await evaluate(`window.__flowsynth.dispose(); localStorage.clear();`);
  await go();
  await pause(400);
  await click("#console-settings");
  await click("#settings-import");
  await evaluate(`document.getElementById('import-text').value = args[0];`, seed);
  await click("#import-apply");
  await wait(`return !!document.getElementById('recovery-apply');`);
  assert.equal(await evaluate(`return localStorage.getItem(args[0])?.length ?? 0;`, original), 0);
  await shot("desktop-import-recovery");
  await click("#recovery-decline");
  await wait(`return !!document.getElementById('import-apply');`);
  assert.ok(await evaluate(`return document.getElementById('modal-content').textContent.includes('recovery');`));
  assert.equal(await evaluate(`return localStorage.getItem(args[0])?.length ?? 0;`, original), 0);
  checks.push("A pasted lost save offered recovery at the import destination; declining returned to the import walk with its message, adopting nothing.");
  // Applying from the import: exact source retained first, then adopted.
  await evaluate(`document.getElementById('import-text').value = args[0];`, seed);
  await click("#import-apply");
  await wait(`return !!document.getElementById('recovery-apply');`);
  await click("#recovery-apply");
  await wait(`return !document.getElementById('recovery-apply');`);
  await pause(400);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, original), seed);
  assert.equal(await evaluate(`return JSON.parse(localStorage.getItem(args[0])).version;`, primary), 13);
  checks.push("The import's recovery retained its exact source bytes before the recovered v13 state saved.");

  // Phone: the same journey at 390x844 with touch emulation and reduced
  // motion active.
  await cmd("/window/rect", { width: 390, height: 987, x: 0, y: 0 });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await seedBoot();
  await wait(`return !!document.getElementById('recovery-apply');`);
  assert.equal(await evaluate(`return matchMedia('(prefers-reduced-motion: reduce)').matches;`), true);
  assert.equal(await evaluate(`return document.getAnimations().filter(a => a.playState === 'running').length;`), 0);
  const viewport = await evaluate(`return {width:innerWidth,height:innerHeight};`);
  assert.equal(viewport.width, 390);
  checks.push(`Phone viewport verified at ${viewport.width}×${viewport.height}, with reduced motion active and no running animation on the offer.`);
  await shot("phone-recovery-offer");
  await evaluate(`document.querySelector('[aria-label="Arete — what it means"]').scrollIntoView({block:'center',behavior:'instant'});`);
  await pause(200);
  const rect = await evaluate(`const el=document.querySelector('[aria-label="Arete — what it means"]'); const r=el.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; return {x,y,hit:document.elementFromPoint(x,y)?.getAttribute('aria-label')};`);
  assert.equal(rect.hit, "Arete — what it means");
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rect.x, y: rect.y }] });
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(`return document.querySelector('[aria-label="Arete — what it means"]').getAttribute('aria-expanded') === 'true';`);
  await shot("phone-recovery-touch");
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 50, y: 210 }] });
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.equal(await evaluate(`return document.querySelector('[aria-label="Arete — what it means"]').getAttribute('aria-expanded');`), "false");
  checks.push("The offer's disclosure opened by emulated touch and dismissed by tap-away.");
  for (const [term, name] of [["memorized", "memorized"], ["Warp Beam", "warp-beam"]]) {
    const position = await evaluate(`const el=document.querySelector('[aria-label="' + args[0] + ' — what it means"]'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};`, term);
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [position] });
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await wait(`return document.querySelector('[aria-label="${term} — what it means"]').getAttribute('aria-expanded') === 'true';`);
    await shot(`phone-recovery-${name}`);
    await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 20, y: 200 }] });
    await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.equal(await evaluate(`return document.querySelector('[aria-label="' + args[0] + ' — what it means"]').getAttribute('aria-expanded');`, term), "false");
  }
  checks.push("Memorized and Warp Beam both opened by emulated touch and dismissed by tap-away at phone width.");
  await evaluate(`document.getElementById('recovery-apply').scrollIntoView({block:'center'});`);
  await shot("phone-recovery-actions");
  await click("#recovery-apply");
  await wait(`return !document.getElementById('recovery-apply');`);
  await pause(400);
  await shot("phone-recovered-board");
  assert.equal(await evaluate(`return JSON.parse(localStorage.getItem(args[0])).version;`, primary), 13);
  checks.push("Phone recovery landed the calibrated economy and wrote finite v13 bytes.");

  await writeFile(new URL("checks.json", out), JSON.stringify({ url, seedBytes: seed.length, checks, unavailable: ["Physical-device touch was not exercised; Chromium touch emulation was used.", "The backup-denial failure path is covered by automated cases (app.recovery.test.ts); it was not reproduced in-browser, which would require denying storage writes to the origin."] }, null, 2) + "\n");
  console.log(checks.join("\n"));
} finally {
  await cmd("", undefined, "DELETE");
  await rm(downloadPath, { recursive: true, force: true });
}
