// Run after committing the source and recording documents:
// node docs/evidence/491-review-fixes/capture.mjs http://localhost:PORT
// Uses a private, temporary headless Chromium profile; no user tab/save.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2];
if (!base) throw new Error("Pass the URL printed by npm run dev");
const evidence = "docs/evidence/491-review-fixes";
execFileSync(process.execPath, ["tools/evidence-preflight.mjs", "--url", base, "--record", `${evidence}/provenance.json`], { stdio: "inherit" });
const profile = await mkdtemp(join(tmpdir(), "flowsynth-491-browser-"));
const chrome = spawn("chromium", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Chromium startup timed out")), 20_000);
    chrome.stderr.on("data", bytes => {
      const match = String(bytes).match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    chrome.once("error", reject);
  });
  const port = new URL(endpoint).port;
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    if (!pending.has(message.id)) return;
    const { resolve, reject, timeout } = pending.get(message.id);
    clearTimeout(timeout);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
  });
  const send = (method, params = {}, ms = 30_000) => new Promise((resolve, reject) => {
    const request = ++id;
    const timeout = setTimeout(() => { pending.delete(request); reject(new Error(`${method} timed out`)); }, ms);
    pending.set(request, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async (expression, ms) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, ms);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Page load timed out")), 30_000);
    const listener = ({ data }) => {
      if (JSON.parse(String(data)).method !== "Page.loadEventFired") return;
      clearTimeout(timeout);
      socket.removeEventListener("message", listener);
      resolve();
    };
    socket.addEventListener("message", listener);
  });
  await send("Page.navigate", { url: new URL("/?dev=1", base).href });
  await loaded;
  await evaluate(`new Promise((resolve, reject) => { const end = Date.now() + 30000; const poll = () => window.__flowsynth ? resolve(true) : Date.now() > end ? reject(Error('App did not load')) : setTimeout(poll, 50); poll(); })`);
  const setup = await evaluate(`(() => {
    const app = window.__flowsynth;
    const live = JSON.stringify(app.state);
    const saved = JSON.stringify(Object.entries(localStorage));
    const record = app.devRunPlaythrough({ seed: 23, policyId: 'pushing', budgetDays: 10,
      schedule: { sessionsPerDay: 1, sessionMinutes: 600, breatherMinutes: 5 } });
    const crossing = record.events.find(event => event.label.includes("prior frontier's depth passed"));
    if (!crossing) throw Error('The walk did not carry a crossing');
    const inspection = app.devInspectPlaythrough(crossing.snapshot);
    if (inspection.credited !== crossing.credited) throw Error('Crossing and inspection clocks disagree');
    if (!app.devCurvesOpen) app.devToggleCurves();
    app.devSetCurvesAxis('credited');
    return { event: crossing.label, credited: crossing.credited, inspectionCredited: inspection.credited,
      snapshot: crossing.snapshot, runId: record.runId, source: record.source,
      liveSaveUntouched: JSON.stringify(app.state) === live,
      ordinarySaveUntouched: JSON.stringify(Object.entries(localStorage)) === saved };
  })()`, 600_000);
  assert.equal(setup.liveSaveUntouched, true);
  assert.equal(setup.ordinarySaveUntouched, true);
  const views = [];
  for (const [name, width, height, mobile] of [["desktop", 1280, 800, false], ["phone", 390, 844, true]]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await evaluate(`document.querySelector('[data-devcurveaxis="credited"]').focus({ preventScroll: true })`);
    for (const modifiers of [0, 8]) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers });
    }
    const view = await evaluate(`(() => {
      const target = document.querySelector('.dev-curves-read');
      if (!target) throw Error('No inspection readout');
      const control = document.querySelector('[data-devcurveaxis="credited"]');
      const keyboardFocus = document.activeElement === control;
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
      const event = [...document.querySelectorAll('.dev-curve-event')].find(element => element.textContent.includes("prior frontier's depth passed"));
      if (!event) throw Error('The crossing is missing from the displayed decisions');
      event.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const style = getComputedStyle(target);
      const bounds = control.getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, readout: target.innerText, keyboardFocus,
        focusVisible: control.matches(':focus-visible'), statusRole: target.getAttribute('role'),
        crossingRead: event.innerText, controlWidth: bounds.width, controlHeight: bounds.height,
        staticReadout: style.animationName === 'none' && style.transitionDuration === '0s',
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        policyOptions: [...document.querySelector('#dev-playthrough-policy').options].map(option => option.text) };
    })()`);
    assert.equal(view.width, width);
    assert.equal(view.height, height);
    assert.equal(view.keyboardFocus, true);
    assert.equal(view.focusVisible, true);
    assert.equal(view.statusRole, "status");
    assert.equal(view.staticReadout, true);
    assert.ok(view.controlWidth >= 44 && view.controlHeight >= 44);
    assert.equal(view.reducedMotion, true);
    await new Promise(resolve => setTimeout(resolve, 200));
    const png = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile(`${evidence}/${name}-crossing.png`, Buffer.from(png.data, "base64"));
    views.push({ name, ...view });
  }
  await writeFile(`${evidence}/verification.json`, JSON.stringify({ setup, views }, null, 2));
  console.log(JSON.stringify({ setup, views }, null, 2));
} finally {
  socket?.close();
  if (chrome.exitCode === null) {
    const exit = new Promise(resolve => chrome.once("exit", resolve));
    chrome.kill("SIGTERM");
    await exit;
  }
  await rm(profile, { recursive: true, force: true });
}
