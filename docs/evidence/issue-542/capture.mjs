// After capture preflight against this worktree, run from the repo root:
// PLAYWRIGHT_MODULE=playwright CHROMIUM_BIN=/usr/bin/chromium node tools/run-supported.mjs docs/evidence/issue-542/capture.mjs http://localhost:5174/
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = fileURLToPath(new URL('.', import.meta.url));
const url = new URL('?dev=1', process.argv[2]).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN, headless: true });
const results = { url, browser: browser.version(), desktop: {}, phone: {}, errors: [] };
const shard = (q, r) => `[data-world-cell="${q},${r}"]`;
const image = (page, name) => page.screenshot({ path: join(output, `${name}.png`) });
async function launch(page) {
  page.on('pageerror', (error) => results.errors.push(error.message));
  await page.goto(url);
  await page.locator('#dev-scenario').selectOption('world-combat');
  await page.locator('[data-dev="scenario"]').click();
  return page.evaluate(() => {
    const app = window.__flowsynth;
    app.devScenarioAssert();
    return { note: app.devScenarioNote, viewport: [innerWidth, innerHeight], coarse: matchMedia('(pointer:coarse)').matches };
  });
}
async function hideConsole(page) {
  // Keep the declaration in desktop-launch.png; hide only the dev overlay in product compositions.
  await page.locator('#dev-panel').evaluate((panel) => { panel.style.visibility = 'hidden'; });
}
async function arrange(page, kind) {
  await page.evaluate((kind) => {
    const app = window.__flowsynth;
    const { proof, columns, weapons } = app.state.world;
    const rig = kind === 'strong'
      ? [[proof.creature.id, 0, 0], [proof.armor.id, -1, 1], [proof.conduit.id, 1, 0], [proof.spell.id, 0, 1], [columns[0].id, 1, 1], [weapons[0].id, 1, -1]]
      : [[proof.creature.id, 0, 0], [proof.conduit.id, 1, 0]];
    for (const [id, q, r] of rig) {
      const result = app.devActionWorldPlace(id, q, r);
      if (!result.ok) throw new Error(result.reason);
    }
  }, kind);
}
async function step(page, seconds, action) {
  await page.evaluate(({seconds, action}) => {
    const app = window.__flowsynth;
    const result = action === 'start' ? app.devActionStartSession(null)
      : action === 'end' ? app.devActionEndSession() : app.devActionAdvance(seconds);
    if (!result.ok) throw new Error(result.reason);
    if (action === 'end') app.closeModal();
    app.setBoardLayer('world');
  }, {seconds, action});
}
try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  desktop.setDefaultTimeout(6000);
  await desktop.clock.install({ time: new Date('2026-11-21T12:00:00Z') });
  results.desktop.launch = await launch(desktop);
  assert.deepEqual(results.desktop.launch.viewport, [1280, 800]);
  await image(desktop, 'desktop-launch');
  await hideConsole(desktop);
  await arrange(desktop, 'strong');
  await image(desktop, 'desktop-prepared');
  await desktop.locator(shard(1,0)).focus();
  await desktop.keyboard.press('Enter');
  const edge = desktop.locator('[data-world-edge="5"]');
  await edge.focus();
  await desktop.keyboard.press('Enter');
  results.desktop.outlet = await edge.evaluate((button) => ({
    pressed: button.getAttribute('aria-pressed'), focused: document.activeElement === button,
    marker: getComputedStyle(button).boxShadow, focus: getComputedStyle(button).outlineStyle,
    target: button.getBoundingClientRect().toJSON(),
  }));
  assert.equal(results.desktop.outlet.pressed, 'true');
  assert.equal(results.desktop.outlet.focused, true);
  assert.notEqual(results.desktop.outlet.marker, 'none');
  await image(desktop, 'desktop-outlet-keyboard');
  const tip = desktop.locator('[data-detail-face="world"]');
  await tip.focus();
  await desktop.waitForFunction(() => document.querySelector('[data-detail-face="world"]')?.getAttribute('aria-expanded') === 'true');
  await desktop.keyboard.press('Escape');
  results.desktop.keyboardDisclosure = { opened: true, dismissed: (await tip.getAttribute('aria-expanded')) === 'false' };
  assert.ok(results.desktop.keyboardDisclosure.dismissed);
  await desktop.locator('[data-world-edge="2"]').click();
  await desktop.getByRole('button', { name: 'Return', exact: true }).click();
  await step(desktop, 0, 'start');
  await step(desktop, 12, 'advance');
  results.desktop.flowPressure = await desktop.locator(shard(-1,0)).getAttribute('aria-label');
  await image(desktop, 'desktop-flow');
  await step(desktop, 19, 'advance');
  await step(desktop, 0, 'end');
  results.desktop.nextPressure = await desktop.locator(shard(2,-1)).getAttribute('aria-label');
  assert.match(results.desktop.nextPressure, /Basalt.*−35%/);
  await image(desktop, 'desktop-lifetime-clear');
  await desktop.emulateMedia({ reducedMotion: 'reduce' });
  results.desktop.reducedMotion = await desktop.evaluate(() => {
    window.__flowsynth.worldArmTray('guard-plate');
    const world = document.querySelector('[data-key="world-grid"]');
    return { enabled: matchMedia('(prefers-reduced-motion: reduce)').matches, armedTargets: world.querySelectorAll('.world-plate.pulse').length,
      worldAnimations: world.getAnimations({ subtree: true }).length };
  });
  assert.equal(results.desktop.reducedMotion.enabled, true);
  assert.ok(results.desktop.reducedMotion.armedTargets > 0);
  assert.equal(results.desktop.reducedMotion.worldAnimations, 0);

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  phone.setDefaultTimeout(6000);
  await phone.clock.install({ time: new Date('2026-11-21T12:00:00Z') });
  results.phone.launch = await launch(phone);
  assert.deepEqual(results.phone.launch.viewport, [390, 844]);
  assert.equal(results.phone.launch.coarse, true);
  await hideConsole(phone);
  await arrange(phone, 'weak');
  results.phone.desktopTrayHidden = await phone.locator('#world-tray').isHidden();
  assert.equal(results.phone.desktopTrayHidden, true);
  await image(phone, 'phone-board');
  await phone.locator(shard(-1,0)).tap();
  const touchTip = phone.locator('[data-detail-face="world"]');
  await touchTip.tap();
  await phone.waitForFunction(() => document.querySelector('[data-detail-face="world"]')?.getAttribute('aria-expanded') === 'true');
  results.phone.touchDisclosure = { opened: true, text: await touchTip.evaluate((trigger) => document.getElementById(trigger.getAttribute('aria-describedby'))?.textContent) };
  await image(phone, 'phone-pressure-disclosure');
  await phone.touchscreen.tap(378, 291);
  results.phone.touchDisclosure.dismissed = (await touchTip.getAttribute('aria-expanded')) === 'false';
  assert.ok(results.phone.touchDisclosure.dismissed);
  await phone.getByRole('button', { name: 'Return', exact: true }).tap();
  await phone.locator(shard(1,0)).tap();
  const route = phone.locator('[data-world-edge="5"]');
  await route.tap();
  results.phone.outletPressed = await route.getAttribute('aria-pressed');
  assert.equal(results.phone.outletPressed, 'true');
  await phone.getByRole('button', { name: 'Return', exact: true }).tap();
  await step(phone, 0, 'start');
  await step(phone, 16, 'advance');
  await step(phone, 0, 'end');
  const inventory = phone.locator('#thumb-bar').getByRole('button', { name: /Inventory/ });
  await inventory.tap(); // First touch reads the shared tool disclosure.
  assert.equal(await inventory.getAttribute('aria-expanded'), 'true');
  await inventory.tap(); // Second touch opens the Inventory sheet.
  results.phone.beforeInspection = await phone.evaluate(() => {
    const app = window.__flowsynth;
    return { mode: app.state.mode, layer: app.ui.boardLayer, modal: app.ui.modal, hp: app.state.world.proof.creature.hp, recovering: app.state.world.proof.creature.recovering, tray: document.getElementById('modal-content')?.innerText };
  });
  await phone.locator('#modal-content [data-world-tray="sentinel"]').tap();
  results.phone.recovering = await phone.locator('#modal-content .inventory-inspection').innerText();
  assert.match(results.phone.recovering, /0\/24 HP · Recovering/);
  assert.equal(await phone.locator('#modal-content [data-world-place="sentinel"]').isDisabled(), true);
  await image(phone, 'phone-recovering');
  assert.deepEqual(results.errors, []);
} finally {
  await writeFile(join(output, 'browser.json'), JSON.stringify(results, null, 2) + '\n');
  await browser.close();
}
