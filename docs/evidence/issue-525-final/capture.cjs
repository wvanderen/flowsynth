// Run: NODE_PATH=/tmp/525-capture/node_modules node docs/evidence/issue-525-final/capture.cjs
// Isolated constructed fixtures, not earned progression or physical-device testing.
const {chromium}=require('playwright'); const fs=require('fs');
const out=__dirname; const results=[]; const manifest=[];
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
for(const [name,width,height] of [['desktop',1280,900],['phone',390,844]]){
const context=await browser.newContext({viewport:{width,height},hasTouch:name==='phone',isMobile:name==='phone',reducedMotion:'reduce'}); const page=await context.newPage();
page.on('pageerror',e=>results.push({name,error:String(e)}));
await page.goto('http://localhost:5174/?dev=1'); await page.waitForFunction(()=>window.__flowsynth); const live=await page.evaluate(()=>({width:innerWidth,height:innerHeight,url:location.href,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches})); if(live.width!==width||live.height!==height)throw Error('viewport mismatch');
const ev=fn=>page.evaluate(fn); const snap=async(label)=>{await page.screenshot({path:`${out}/${name}-${label}.png`});manifest.push({file:`${name}-${label}.png`,source:'fede163',...live});fs.writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2));};
const check=async(label,fn)=>{const value=await ev(fn); results.push({name,label,value});fs.writeFileSync(`${out}/observations.json`,JSON.stringify(results,null,2));};
await ev(async()=>{const a=window.__flowsynth;await a.devLaunchScenario('fresh-start');a.devScenarioAssert();a.dev=false;a.state.world.enemies.w0={discovered:true,hp:100};a.state.world.enemies.w1={discovered:true,hp:100};a.render();});
await check('hidden World',()=>!document.querySelector('[data-legend-layer="world"]'));await snap('pre-unlock');
const reset=name==='phone'?'#phone-reset':'#ambient-reset';
await page.locator(reset).focus(); await snap('unavailable-focus');
await ev(()=>{window.__flowsynth.openLedger('nous')});await snap('pressure');await check('pressure',()=>document.querySelector('#ledger-pressure')?.textContent);await ev(()=>window.__flowsynth.closeModal());
await ev(()=>{const a=window.__flowsynth;a.state.mode='flow';a.render()});await snap('outside-upgrade');await ev(()=>{const a=window.__flowsynth;a.state.mode='upgrade';a.state.eraEarned=7000000;a.render()});await page.locator(reset).click();await snap('zero-confirm');await page.locator('#prestige-confirm').click();await check('zero stays hidden',()=>!window.__flowsynth.state.world.unlocked);
await ev(()=>{const a=window.__flowsynth;a.state.eraEarned=20000000;a.render()});await snap('positive-pending');await page.locator(reset).click();await page.locator('#prestige-confirm').click();await snap('starter-grant');await ev(()=>window.__flowsynth.closeModal());
await check('starter kit',()=>{const s=window.__flowsynth.state;return {unlocked:s.world.unlocked,columns:s.world.columns,weapons:s.world.weapons,arete:s.arete}});
await ev(()=>{const a=window.__flowsynth;a.openModal('catalog')});await page.locator('[data-catalog-face="arete"]').click();await snap('catalog');await check('retired rows absent',()=>({entry:!!document.querySelector('#buy-arete-entry'),column:!!document.querySelector('#buy-world-column'),forge:document.querySelector('#modal-content').textContent.includes('Mutator Forge'),hone:!!document.querySelector('#buy-world-hone')}));
await ev(()=>window.__flowsynth.closeModal());
for(const type of ['column','chargeBlade']){
// deterministic ordinary mixed offer, matching prior slice browser checks
await page.evaluate(async(type)=>{const a=window.__flowsynth;const {generateOffer}=await import('/src/engine/rolls.ts');const draws=[...Array(9).fill(.5),0,type==='column'?0:.5];a.state.bankedRolls=[];a.state.bankedRolls.push(generateOffer(a.state,()=>draws.shift()??.5));a.openModal('forge')},type);
await snap(`mixed-${type}`);
if(type==='chargeBlade'){
const term=page.locator('.candidate-tile').filter({hasText:'Charge Blade'}).locator('.term-trigger').first();
if(await term.count()){
await term.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await snap('blade-keyboard-disclosure');await page.keyboard.press('Escape');await check('Escape hides glossary',()=>[...document.querySelectorAll('.inst-tooltip.inst-show')].length);
if(name==='phone'){await term.tap();await snap('blade-touch-disclosure');await page.touchscreen.tap(10,300);await snap('blade-touch-dismissed');}
}}
await page.evaluate(type=>{const a=window.__flowsynth;a.openModal('forge');const c=a.state.bankedRolls[0].candidates.find(c=>c.type===type);document.querySelector(`[data-choice="${c.id}"]`).click();a.setBoardLayer('world');a.ui.inventory.collapsed=false;a.render();if(innerWidth<600)a.openModal('inventory')},type);
await snap(`inventory-${type}`);await page.locator('[data-world-tray]').last().click();await snap(`detail-${type}`);
await page.locator('[data-world-place]').last().click();await snap(`armed-${type}`);await ev(()=>{const a=window.__flowsynth;a.worldPickCell(a.state.cells.find(p=>![...a.state.world.columns,...a.state.world.weapons].some(w=>w.pos?.q===p.q&&w.pos?.r===p.r)))});await ev(()=>window.__flowsynth.closeModal());await snap(`board-${type}`);
}
await ev(()=>{const a=window.__flowsynth;a.state.eraEarned=7000000;a.render()});await page.locator(reset).click();await page.locator('#prestige-confirm').click();await check('later reset retains exact collection',()=>({columns:window.__flowsynth.state.world.columns.length,weapons:window.__flowsynth.state.world.weapons.length,unlocked:window.__flowsynth.state.world.unlocked}));
await ev(()=>{const a=window.__flowsynth;a.save(Date.now(),true)});
await check('final reduced motion and World state',()=>({reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,world:window.__flowsynth.state.world,animations:document.getAnimations().filter(a=>a.playState==='running').length}));
await context.close();}
await browser.close();fs.writeFileSync(`${out}/observations.json`,JSON.stringify(results,null,2));})().catch(e=>{fs.writeFileSync(`${out}/failure.txt`,e.stack);console.error(e);process.exit(1)});
