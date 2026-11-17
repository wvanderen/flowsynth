// Evidence-only CDP capture. Requires this checkout's clean-source preflight.
// chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9438 --user-data-dir=/tmp/flowsynth-pr538-review-fix about:blank
import { writeFile } from 'node:fs/promises';
const out = new URL('./', import.meta.url);
const target = (await (await fetch('http://localhost:9438/json')).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const item = pending.get(message.id); pending.delete(message.id);
  message.error ? item.reject(new Error(JSON.stringify(message.error))) : item.resolve(message.result);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const next = ++id; pending.set(next, { resolve, reject }); ws.send(JSON.stringify({ id: next, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const assert = (value, label) => { if (!value) throw new Error(label); };
const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
const screenshot = async name => {
  await settle();
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(`${name}.png`, out), Buffer.from(result.data, 'base64'));
};
const activate = async (selector, mobile) => {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
  if (mobile) {
    const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  }
  await settle();
};
const records = [];
await send('Page.enable');
for (const [name, width, height, mobile] of [['desktop', 1280, 900, false], ['phone', 390, 844, true]]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: 'http://localhost:5174/?dev=1' });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate('!!window.__flowsynth')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await evaluate('window.__flowsynth.hardReset()');
  // Hide development-only instrumentation, never a shipped control.
  await evaluate("(() => { const s = document.createElement('style'); s.textContent = '#dev-panel { display: none !important; }'; document.head.append(s); })()");
  await settle();
  const initial = await evaluate("({ size: [innerWidth, innerHeight], modal: window.__flowsynth.ui.modal, marks: {...window.__flowsynth.state.encyclopedia}, capacityDisplay: getComputedStyle(document.getElementById('board-ledger')).display, overflow: document.documentElement.scrollWidth > innerWidth })");
  assert(initial.size[0] === width && initial.size[1] === height && !initial.overflow, `${name} viewport`);
  assert(initial.modal === null && initial.marks.charge === undefined, `${name} voluntary, no Charge encounter`);
  assert(initial.marks.chords === (mobile ? undefined : 'available'), `${name} capacity encounter`);
  assert((initial.capacityDisplay === 'none') === mobile, `${name} standing ledger visibility`);
  await screenshot(`${name}-fresh`);
  await activate('#console-encyclopedia', mobile);
  const initialTopics = await evaluate("document.getElementById('encyclopedia-results').textContent");
  assert(initialTopics.includes('Chords and harmonic capacity') === !mobile, `${name} topic availability`);
  await screenshot(`${name}-initial-topics`);
  await activate('#close-modal', mobile);
  assert(await evaluate('window.__flowsynth.ui.modal === null'), `${name} dismissal`);
  if (mobile) {
    await activate('#phone-ledger-overview', true);
    assert(await evaluate("window.__flowsynth.state.encyclopedia.chords === 'available' && !!document.getElementById('about-chords')"), 'phone visible capacity encounter');
    await evaluate("document.getElementById('about-chords').scrollIntoView({ block: 'center' })");
    await activate('#about-chords', true);
  } else {
    await activate('#console-encyclopedia', false);
    await activate('[data-entry="chords"]', false);
  }
  assert(await evaluate("window.__flowsynth.state.encyclopedia.chords === 'seen' && document.querySelector('.encyclopedia-entry h2').textContent === 'Chords and harmonic capacity'"), `${name} entry opens and marks seen`);
  await screenshot(`${name}-chords`);
  await activate('#close-modal', mobile);
  assert(await evaluate(`window.__flowsynth.ui.modal === ${mobile ? "'rate'" : 'null'}`), `${name} task restored`);
  records.push({ name, initial, initialTopics, entryOpened: true, taskRestored: true, reducedMotion: true });
}
await writeFile(new URL('observations.json', out), JSON.stringify(records, null, 2) + '\n');
await send('Page.close');
ws.close();
console.log('Desktop keyboard and phone emulated-touch encounter checks passed.');
