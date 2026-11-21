// Reproduce with Node, Playwright + Chromium and ImageMagick, after the
// repository's capture preflight. Fresh, independent browser contexts each run.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const out = fileURLToPath(new URL('.', import.meta.url));
const provenance = JSON.parse(await readFile(join(out, 'provenance.json'), 'utf8'));
const served = await (await fetch(new URL('/-/dev/provenance', provenance.url))).json();
assert.equal(served.worktree, provenance.worktree);
assert.equal(served.commit, provenance.commit);
assert.equal(served.source.clean, true);
const temp = await mkdtemp(join(tmpdir(), 'flowsynth-546-browser-'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = { source: served.commit, url: provenance.url, chromium: browser.version() };
const specimens = [];
const selector = layer => `.detail-layer-preview[data-legend-layer="${layer}"]`;
const board = (layer, cell) => `#grid [data-${layer === 'world' ? 'world-cell' : 'cell'}="${cell}"]`;
const plate = layer => layer === 'world' ? '.world-plate' : '.hex';

async function shape(locator) {
  return locator.evaluate(el => ({ points: el.getAttribute('points'), viewBox: el.ownerSVGElement.getAttribute('viewBox'), strokeWidth: getComputedStyle(el).strokeWidth }));
}

async function specimen(loc, name) {
  const path = join(temp, `${name}.png`);
  await loc.screenshot({ path, scale: 'css' });
  return path;
}

async function matched(page, moduleSelector, worldSelector, name) {
  const modules = await shape(page.locator(moduleSelector));
  const world = await shape(page.locator(worldSelector));
  assert.ok(modules.points);
  assert.deepEqual(world, modules, name);
  return { modules, world };
}

async function hitAt(page, at, y) {
  const target = await page.locator(board('world', at)).evaluate((element, offsetY) => {
    const p = new DOMPoint(0, offsetY).matrixTransform(element.getScreenCTM());
    return { x: p.x, y: p.y, cell: document.elementFromPoint(p.x, p.y)?.closest('[data-world-cell]')?.getAttribute('data-world-cell') };
  }, y);
  assert.equal(target.cell, at, `real hit test, outside the old flat-crowned artwork (${at})`);
  return target;
}

async function motion(page, where, animation, { checkPerimeter = false } = {}) {
  const read = () => page.locator(where).first().evaluate(el => ({
    animation: getComputedStyle(el).animationName,
    strokeWidth: getComputedStyle(el).strokeWidth,
    opacity: getComputedStyle(el).opacity,
    fillWidth: el.getAttribute('width'),
  }));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const normal = await read();
  assert.equal(normal.animation, animation);
  if (checkPerimeter) {
    await page.waitForTimeout(700); // half of the existing 1.4s arm pulse
    assert.equal((await read()).strokeWidth, normal.strokeWidth);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await read();
  assert.equal(reduced.animation, 'none');
  assert.equal(reduced.strokeWidth, normal.strokeWidth);
  if (normal.fillWidth !== null) {
    assert.ok(Number(reduced.fillWidth) > 0);
    assert.equal(reduced.fillWidth, normal.fillWidth);
    assert.equal(reduced.opacity, '0.7');
  }
  return { normal, reduced };
}

async function evidence({ viewport, phone, name }) {
  const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce', recordVideo: { dir: temp, size: viewport } });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  const missingFavicons = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const { url } = msg.location();
    (url.endsWith('/favicon.ico') ? missingFavicons : errors).push(`${url}: ${msg.text()}`);
  });
  const video = page.video();
  const screenshot = path => page.screenshot({ path: join(out, `${name}-${path}.png`), scale: 'css' });
  const beat = () => page.waitForTimeout(620); // pace the visible walkthrough
  const activate = loc => phone ? loc.tap() : loc.click();
  const openPhoneTray = async () => {
    const inventory = page.getByRole('button', { name: 'Inventory', exact: true });
    await inventory.tap(); // tool disclosure, then activate
    await page.locator('#thumb-bar-inventory-detail').waitFor({ state: 'visible' });
    await inventory.tap();
  };
  const layerButton = layer => page.locator(`#layer-legend [data-legend-layer="${layer}"]`);
  const trayContent = page.locator(phone ? '#modal-content' : '#world-tray');
  const worldRow = trayContent.locator('[data-world-tray]').first();
  const moduleRow = page.locator(phone ? '#modal-content [data-inv]' : '#inventory-zone [data-inv]').first();
  const tip = page.locator('#detail-layer-world-tip');
  const detail = page.locator('.hex-detail-scene');

  await page.goto(new URL('?dev=1', provenance.url).href);
  await page.waitForFunction(() => Boolean(window.__flowsynth));
  const seed = await page.evaluate(async () => {
    const { give } = await import('/src/engine/fixtures.ts');
    const app = window.__flowsynth;
    await app.devLaunchScenario('fresh-start');
    app.devWorldEra();
    // Constructed visual fixture, not a claim about ordinary progression.
    give(app.state, 'additive', { q: 1, r: 0 }, 4);
    give(app.state, 'additive', null, 2);
    app.state.world.enemies.w0 = { discovered: true, hp: 8 };
    app.state.world.enemies.w1 = { discovered: true, hp: 0 };
    app.state.world.weapons.find(w => w.pos).store = 12;
    app.say('');
    app.setBoardLayer('modules');
    await document.fonts.ready;
    return { width: innerWidth, height: innerHeight, touch: matchMedia('(pointer: coarse)').matches };
  });
  assert.deepEqual(seed, { ...viewport, touch: phone });
  // Dev-only display furniture, not an application control or faceplate.
  await page.addStyleTag({ content: '#dev-panel { display: none !important; }' });
  const intro = page.locator('#arc-card-dismiss');
  if (await intro.isVisible()) await activate(intro);
  const r = results[name] = { viewport: seed, errors, missingFavicons };
  const coord = '1,0';
  const moduleCell = page.locator(board('modules', coord));
  r.layers = await matched(page, '#layer-legend [data-legend-layer="modules"] polygon', '#layer-legend [data-legend-layer="world"] polygon', 'board symbols');
  const moduleBoard = await shape(moduleCell.locator('.hex'));
  r.moduleCenter = await moduleCell.getAttribute('transform');
  const modulesBoardSnap = !phone && await specimen(moduleCell.locator('.hex'), 'board-modules');
  if (phone) await openPhoneTray();
  const moduleTile = await shape(moduleRow.locator('.tile-hex'));
  const modulesRowSnap = !phone && await specimen(moduleRow.locator('.inventory-mark'), 'inventory-modules');
  const drag = async start => {
    const a = await start.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(810, 435, { steps: 8 });
  };
  let moduleGhost, modulesGhostSnap;
  if (!phone) {
    await drag(moduleRow.locator('.inventory-mark'));
    moduleGhost = await shape(page.locator('.drag-ghost .tile-hex'));
    modulesGhostSnap = await specimen(page.locator('.drag-ghost'), 'drag-modules');
    await page.mouse.move(70, 35);
    await page.mouse.up();
  }
  await activate(moduleRow);
  const moduleInspect = await shape(page.locator(`${phone ? '#modal-content' : '#inventory-zone'} .inventory-detail-face .hex`));
  const modulesInspectSnap = !phone && await specimen(page.locator('#inventory-zone .inventory-detail-face'), 'inspection-modules');
  if (phone) {
    await activate(page.locator('#modal-content [data-legend-layer="world"]'));
  } else {
    await activate(layerButton('world'));
  }
  const worldTile = await shape(worldRow.locator('.world-tile-plate'));
  assert.deepEqual(worldTile, moduleTile);
  r.inventoryRows = { moduleTile, worldTile };
  if (!phone) specimens.push(['Inventory row', modulesRowSnap, await specimen(worldRow.locator('.inventory-mark'), 'inventory-world')]);
  if (phone) await screenshot('inventory');
  await activate(worldRow);
  const worldInspect = await shape(trayContent.locator('.inventory-detail-face .world-tile-plate'));
  assert.deepEqual(worldInspect, moduleInspect);
  r.inventoryInspection = { moduleInspect, worldInspect };
  if (!phone) specimens.push(['Inventory inspection', modulesInspectSnap, await specimen(trayContent.locator('.inventory-detail-face'), 'inspection-world')]);
  await activate(trayContent.locator('[data-world-back]'));
  if (phone) {
    await activate(page.locator('#close-modal'));
    await page.touchscreen.tap(185, 310); // blank board margin, dismiss tool disclosure
  }

  const worldCell = page.locator(board('world', coord));
  const worldBoardPlate = worldCell.locator('..').locator('.world-plate');
  const worldBoard = await shape(worldBoardPlate);
  assert.equal(worldBoard.points, moduleBoard.points);
  assert.equal(worldBoard.strokeWidth, moduleBoard.strokeWidth);
  r.worldCenter = await worldCell.locator('..').getAttribute('transform');
  const parseCenter = text => text.match(/-?[\d.]+/g).map(n => Number(n).toFixed(2));
  assert.deepEqual(parseCenter(r.worldCenter), parseCenter(r.moduleCenter));
  assert.equal(await worldCell.getAttribute('aria-label'), 'World cell at G4');
  assert.equal(await worldCell.getAttribute('points'), worldBoard.points);
  const boardStates = await page.locator('#grid .world-plate').evaluateAll(els => els.map(el => [el.getAttribute('class'), el.getAttribute('points')]));
  assert.deepEqual([...new Set(boardStates.map(([, points]) => points))], [moduleBoard.points]);
  const verticalClearance = (element, { above, below }) => {
    const top = element.querySelector(above).getBoundingClientRect();
    const bottom = element.querySelector(below).getBoundingClientRect();
    return bottom.top - top.bottom;
  };
  const spacing = {
    enemyGlyphToHp: await page.locator('[data-key="world-w0"]').evaluate(verticalClearance, { above: '.world-glyph', below: '.world-fig' }),
    bladeChargeToAttack: await worldCell.locator('..').evaluate(el => {
      // SVG text client rects include unused font padding; measure line ink.
      const [charge, attack] = el.querySelectorAll('.world-fig');
      const canvas = document.createElement('canvas').getContext('2d');
      const ink = text => {
        canvas.font = getComputedStyle(text).font;
        return canvas.measureText(text.textContent);
      };
      return attack.getStartPositionOfChar(0).y - ink(attack).actualBoundingBoxAscent
        - charge.getStartPositionOfChar(0).y - ink(charge).actualBoundingBoxDescent;
    }),
  };
  await screenshot('board');
  for (const [pair, clearance] of Object.entries(spacing)) assert.ok(clearance > 0, `${name}: ${pair} clearance ${clearance}px`);
  r.board = { moduleBoard, worldBoard, states: [...new Set(boardStates.map(([state]) => state))], spacing };
  if (!phone) specimens.push(['Board occupant', modulesBoardSnap, await specimen(worldBoardPlate, 'board-world')]);
  await beat();
  r.taperHit = await hitAt(page, coord, -51);
  if (phone) await page.touchscreen.tap(r.taperHit.x, r.taperHit.y);
  else {
    await worldCell.focus();
    await page.keyboard.press('Enter');
  }
  assert.equal(await detail.getAttribute('data-face'), 'world');
  const worldDetailOutline = await shape(page.locator('[data-detail-face="world"] .world-plate'));
  const worldMini = await shape(page.locator(`${selector('world')} .world-plate`));
  const moduleMini = await shape(page.locator(`${selector('modules')} .hex`));
  assert.deepEqual(worldMini, moduleMini);
  const worldMiniSnap = !phone && await specimen(page.locator(selector('world')), 'mini-world');
  const moduleMiniSnap = !phone && await specimen(page.locator(selector('modules')), 'mini-modules');
  const worldDetailSnap = !phone && await specimen(page.locator('[data-detail-face="world"] svg'), 'detail-world');
  await screenshot('detail');
  if (phone) {
    // Tap the already selected miniature, not hover. Tap a blank point to dismiss.
    await activate(page.locator(selector('world')));
  } else {
    await page.locator('#hex-detail-return').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.legendLayer), 'world');
  }
  await tip.waitFor({ state: 'visible' });
  r.inspect = { tooltip: await tip.textContent(), bounds: await page.locator(selector('world')).boundingBox(), method: phone ? 'emulated Chromium touch tap' : 'Tab from Return' };
  assert.ok(r.inspect.bounds.width >= 44 && r.inspect.bounds.height >= 44);
  await beat();
  await screenshot('inspection');
  if (phone) {
    const layout = await page.locator('.hex-detail-focus').boundingBox();
    await page.touchscreen.tap(layout.x + 120, layout.y + 8); // blank between the faces
  } else await page.keyboard.press('Escape');
  await tip.waitFor({ state: 'hidden' });
  assert.equal(await detail.getAttribute('data-face'), 'world');
  r.inspect.dismissed = phone ? 'tap-away, detail remains World' : 'Escape, detail remains World';
  if (phone) await activate(page.locator(selector('modules')));
  else {
    assert.equal(await page.evaluate(() => document.activeElement.dataset.legendLayer), 'world');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.legendLayer), 'modules');
    await page.keyboard.press('Enter');
  }
  assert.equal(await detail.getAttribute('data-face'), 'modules');
  const moduleDetailOutline = await shape(page.locator('[data-detail-face="modules"] .hex'));
  assert.deepEqual(worldDetailOutline, moduleDetailOutline);
  r.detail = { moduleMini, worldMini, moduleDetailOutline, worldDetailOutline };
  if (!phone) {
    specimens.push(['Occupied miniature', moduleMiniSnap, worldMiniSnap]);
    specimens.push(['Hex detail', await specimen(page.locator('[data-detail-face="modules"] svg'), 'detail-modules'), worldDetailSnap]);
  }
  await beat();
  await activate(page.locator('#hex-detail-return'));
  if (await layerButton('world').getAttribute('aria-pressed') !== 'true') await activate(layerButton('world'));
  const openCoord = '0,0';
  const beforeNous = await page.evaluate(() => window.__flowsynth.state.nous);
  const oldHit = await hitAt(page, openCoord, -51);
  const id = await (phone ? (async () => {
    await openPhoneTray();
    return worldRow.getAttribute('data-world-tray');
  })() : worldRow.getAttribute('data-world-tray'));
  if (!phone) {
    await drag(worldRow.locator('.inventory-mark'));
    const ghost = page.locator('.world-ghost');
    const worldGhost = await shape(ghost.locator('.world-tile-plate'));
    assert.deepEqual(worldGhost, moduleGhost);
    r.drag = { moduleGhost, worldGhost };
    specimens.push(['Drag preview', modulesGhostSnap, await specimen(ghost, 'drag-world')]);
    await screenshot('drag');
    await beat();
    await page.mouse.move(oldHit.x, oldHit.y, { steps: 8 });
    await page.mouse.up();
  } else {
    await activate(worldRow);
    await activate(trayContent.locator('[data-world-place]'));
    r.armed = await motion(page, '#grid .world-plate.pulse', 'world-pulse', { checkPerimeter: true });
    const armHit = await hitAt(page, openCoord, -51);
    await page.touchscreen.tap(armHit.x, armHit.y);
  }
  r.placement = await page.evaluate(id => {
    const app = window.__flowsynth;
    return { placed: app.state.world.weapons.find(w => w.id === id).pos, previousOccupant: app.state.world.weapons.find(w => w.id !== id).pos, armed: app.ui.worldArmed, nous: app.state.nous };
  }, id);
  assert.deepEqual(r.placement.placed, { q: 0, r: 0 });
  assert.deepEqual(r.placement.previousOccupant, { q: 1, r: 0 });
  assert.equal(r.placement.armed, null);
  assert.equal(r.placement.nous, beforeNous);
  r.placement.spentNous = beforeNous - r.placement.nous;
  await beat();

  if (!phone) {
    // Keep a fed World Blade on the real board to exercise the other existing animation.
    await page.evaluate(async () => {
      const { give } = await import('/src/engine/fixtures.ts');
      const { startSession } = await import('/src/engine/actions.ts');
      const app = window.__flowsynth;
      app.state.modules[0].pos = { q: 0, r: 1 };
      give(app.state, 'focusKeyed', { q: 0, r: 0 }).reserve = 10;
      for (const weapon of app.state.world.weapons) weapon.store = 12;
      startSession(app.state, 600);
      app.render();
    });
    r.fed = await motion(page, '#grid .world-bar-fill.live', 'world-breath');
  }
  assert.deepEqual(errors, []);
  await context.close();
  await video.saveAs(join(out, `${name}-walk.webm`));
}

try {
  await evidence({ viewport: { width: 1280, height: 800 }, phone: false, name: 'desktop' });
  await evidence({ viewport: { width: 390, height: 844 }, phone: true, name: 'phone' });
  // Actual Chromium crops, equal display boxes and greyscale conversion only.
  // The board fit naturally changes by layer; normalize the two crops to
  // the same height here to compare the cut, not the chosen zoom level.
  const font = execFileSync('fc-match', ['-f', '%{file}', 'sans-serif'], { encoding: 'utf8' });
  const rows = specimens.map(([label, left, right], i) => {
    const row = join(temp, `${i}.png`);
    const normalize = extent => ['-colorspace', 'Gray', '-filter', 'Lanczos', '-resize', extent, '-background', '#171717', '-gravity', 'center', '-extent', '176x176'];
    execFileSync('magick', ['(', left, ...normalize(label === 'Board occupant' ? '146x146' : '154x154'), ')', '(', right, ...normalize(label === 'Board occupant' ? '146x146' : '154x154'), ')', '+append', '-gravity', 'northwest', '-background', '#171717', '-splice', '0x26', '-fill', 'white', '-font', font, '-pointsize', '13', '-annotate', '+10+18', label, row]);
    return row;
  });
  execFileSync('magick', ['-background', '#171717', '-fill', 'white', '-font', font, '-pointsize', '15', 'label:           Modules                     World', '-gravity', 'center', '-extent', '352x32', ...rows, '-append', join(out, 'monochrome-comparison.png')]);
  await writeFile(join(out, 'browser-checks.json'), JSON.stringify(results, null, 2) + '\n');
} finally {
  await browser.close();
  await rm(temp, { recursive: true, force: true });
}
