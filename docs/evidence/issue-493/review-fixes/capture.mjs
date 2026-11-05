// Run after evidence-preflight, with chromedriver on :9517 and npm run dev.
// All seeds are synthetic; this tab owns its localStorage and is closed at exit.
import assert from "node:assert/strict";
import { readFile, writeFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const url = process.env.FLOWSYNTH_EVIDENCE_URL ?? "http://localhost:5173/";
const out = new URL("./", import.meta.url);
const original = "flowsynth.save.original.v1";
const primary = "flowsynth.save.v1";
const archive = "flowsynth.save.original.pre-v13";
const earlier = '{"earlier":"synthetic retained lineage"}';
const source = JSON.parse(await readFile(new URL("../seed-v12.json", import.meta.url), "utf8"));
source.state.world.frontier = 1;
const seed = JSON.stringify(source);
const downloadPath = await mkdtemp(join(tmpdir(), "flowsynth-516-download-"));
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
  await evaluate(`window.__flowsynth.dispose(); localStorage.clear(); localStorage.setItem(args[0], args[1]); localStorage.setItem(args[2], args[3]);`, primary, text, original, earlier);
  await go();
}
try {
  await cmd("/timeouts", { script: 30000 });
  await cdp("Page.setDownloadBehavior", { behavior: "allow", downloadPath });
  await seedBoot();
  await wait(`return !!document.getElementById('migration-original');`);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, original), seed);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, archive), earlier);
  checks.push("Boot retained exact pre-conversion bytes and archived the existing lineage backup.");
  await shot("desktop-migration");
  await evaluate(`document.querySelector('[aria-label="Catalog — what it means"]').focus();`);
  await wait(`return document.querySelector('[aria-label="Catalog — what it means"]').getAttribute('aria-expanded') === 'true';`);
  await shot("desktop-catalog-keyboard");
  await cmd("/actions", { actions: [{ type: "key", id: "keyboard", actions: [{ type: "keyDown", value: "\uE00C" }, { type: "keyUp", value: "\uE00C" }] }] });
  assert.equal(await evaluate(`return document.querySelector('[aria-label="Catalog — what it means"]').getAttribute('aria-expanded');`), "false");
  checks.push("Catalog disclosure opened with keyboard focus and dismissed with Escape without closing the migration.");
  await click("#migration-original");
  for (let i = 0; i < 40 && !(await readdir(downloadPath)).includes("flowsynth-original.json"); i++) await pause(100);
  assert.equal(await readFile(join(downloadPath, "flowsynth-original.json"), "utf8"), seed);
  checks.push("Download the original produced a file exactly equal to the current pre-conversion source, not the older backup.");
  await click("#migration-continue");
  await shot("desktop-outcome");
  await go();
  assert.equal(await evaluate(`return !document.getElementById('migration-continue');`), true);
  checks.push("Reload of the converted v13 save presented no migration again.");
  await click("#console-settings");
  await click("#settings-import");
  await evaluate(`document.getElementById('import-text').value = args[0];`, seed);
  await click("#import-apply");
  await wait(`return !!document.getElementById('migration-continue');`);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, original), seed);
  await shot("desktop-import-migration");
  checks.push("Applied finite import retained its exact source and presented the same migration explanation.");

  // Real engine production creates the old provisional bucket; no estimated money.
  await go("?dev=1");
  const bucketSeed = await evaluate(`
    const {createInitialState} = await import('/src/engine/state.ts');
    const {startSession} = await import('/src/engine/actions.ts');
    const {advance} = await import('/src/engine/advance.ts');
    const state = createInitialState(); state.modules[0].level = 100;
    startSession(state, null); const result = advance(state, 600, () => 0.4, 'provisional');
    if (result.fault) throw new Error(result.fault);
    return JSON.stringify({app:'flowsynth',version:12,savedAt:Date.now(),state});
  `);
  await seedBoot(bucketSeed);
  await wait(`return !!document.querySelector('[data-honesty="full"]');`);
  await click('[data-honesty="full"]');
  await wait(`return !!document.getElementById('migration-continue');`);
  await shot("desktop-cleared-bucket");
  const settled = await evaluate(`return JSON.parse(localStorage.getItem(args[0])).state;`, primary);
  assert.ok(settled.session.accounting.creditedSeconds >= 600);
  assert.equal(settled.session.accounting.bucketNous, 0);
  assert.ok(settled.eraEarned < 1000000);
  checks.push("A real level-100 provisional bucket converted to zero; honesty retained at least 600 credited seconds without restoring its old-era claim.");

  // A lost-money boot must not replace either slot, even via a forced save.
  const lost = JSON.parse(seed); lost.state.nous = null; lost.state.arete = null;
  const lostText = JSON.stringify(lost);
  await seedBoot(lostText);
  await wait(`return document.getElementById('status').textContent.includes('explicit recovery');`);
  await click("#console-settings");
  await click("#settings-import");
  await evaluate(`document.getElementById('import-text').value = args[0];`, lostText);
  await click("#import-apply");
  await shot("desktop-recovery-refusal");
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, primary), lostText);
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, original), earlier);
  checks.push("Lost-money boot preserves both slots; its rejected import visibly names explicit recovery without replacing either slot.");

  await cmd("/window/rect", { width: 390, height: 987, x: 0, y: 0 });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await seedBoot();
  await wait(`return !!document.getElementById('migration-continue');`);
  assert.equal(await evaluate(`return matchMedia('(prefers-reduced-motion: reduce)').matches;`), true);
  assert.equal(await evaluate(`return document.getAnimations().filter(a => a.playState === 'running').length;`), 0);
  const viewport = await evaluate(`return {width:innerWidth,height:innerHeight};`);
  assert.equal(viewport.width, 390);
  checks.push(`Phone viewport verified at ${viewport.width}×${viewport.height}, with reduced motion active.`);
  await shot("phone-migration");
  const rect = await evaluate(`const el=document.querySelector('[aria-label="Hone — what it means"]'); el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};`);
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rect.x, y: rect.y }] });
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await wait(`return document.querySelector('[aria-label="Hone — what it means"]').getAttribute('aria-expanded') === 'true';`);
  await shot("phone-hone-touch");
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 50, y: 210 }] });
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.equal(await evaluate(`return document.querySelector('[aria-label="Hone — what it means"]').getAttribute('aria-expanded');`), "false");
  checks.push("Hone disclosure opened by emulated touch and dismissed by tap-away.");
  await evaluate(`document.getElementById('migration-continue').scrollIntoView({block:'center'});`);
  await shot("phone-migration-actions");
  await click("#migration-continue");
  await shot("phone-outcome");
  await seedBoot(lostText);
  await wait(`return document.getElementById('status').textContent.includes('explicit recovery');`);
  await click("#console-settings");
  await click("#settings-import");
  await evaluate(`document.getElementById('import-text').value = args[0];`, lostText);
  await click("#import-apply");
  await shot("phone-recovery-refusal");
  assert.equal(await evaluate(`return localStorage.getItem(args[0]);`, primary), lostText);
  checks.push("Phone lost-money refusal also preserved the exact source bytes.");
  await writeFile(new URL("checks.json", out), JSON.stringify({ url, checks, unavailable: ["Physical-device touch was not exercised; Chromium touch emulation was used."] }, null, 2) + "\n");
  console.log(checks.join("\n"));
} finally {
  await cmd("", undefined, "DELETE");
  await rm(downloadPath, { recursive: true, force: true });
}
