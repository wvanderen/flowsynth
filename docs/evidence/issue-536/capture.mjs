// Local Chromium CDP evidence; no preview service dependency. Evidence-only tool.
// chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=9336 --user-data-dir=/tmp/flowsynth-536-chromium about:blank
// node docs/evidence/issue-536/capture.mjs (after capture preflight)
import { writeFile } from 'node:fs/promises';
const out = new URL('./', import.meta.url);
const target = (await (await fetch('http://localhost:9336/json')).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject) => {ws.onopen=resolve;ws.onerror=reject;});
let id=0; const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const assert=(v,label)=>{if(!v)throw new Error(label);};
const settle=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
const screenshot=async name=>{await settle();const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name+'.png',out),Buffer.from(r.data,'base64'));};
const key=async (key,code,n)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:n,...(key==='Enter'?{text:'\r'}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:n});await settle();};
const act=async (selector,mobile)=>{
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});e.focus();})()`);
  await settle();
  const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  const before=await evaluate("({catalogScroll:document.getElementById('catalog-body')?.scrollTop})");
  if(mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,400));await settle();}
  else await key('Enter','Enter',13);
  return before;
};
const records=[];
await send('Page.enable'); await send('Page.navigate',{url:'http://localhost:5173/?dev=1'});
for(let i=0;i<100;i++){if(await evaluate('!!window.__flowsynth'))break;await new Promise(r=>setTimeout(r,100));}
for(const [name,width,height,mobile] of [['desktop',1280,900,false],['phone',390,844,true]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:1});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate("(async()=>{const a=window.__flowsynth;await a.devLaunchScenario('fresh-start');a.devScenarioAssert();a.openModal('catalog');a.closeModal();})()");
  // Hide only development instrumentation, not a shipped control or reference surface.
  // The panel overlays the phone inspection and otherwise intercepts its touch.
  await evaluate("(()=>{let s=document.getElementById('capture-hide-dev');if(!s){s=document.createElement('style');s.id='capture-hide-dev';s.textContent='#dev-panel { display: none !important; }';document.head.append(s);}})()");
  await settle();
  const initial=await evaluate("({size:[innerWidth,innerHeight],modal:window.__flowsynth.ui.modal,marks:window.__flowsynth.state.encyclopedia,book:(()=>{const r=document.querySelector('#console-encyclopedia').getBoundingClientRect();return [r.width,r.height,r.x,r.y]})(),dot:!document.querySelector('.encyclopedia-dot').hidden,overflow:document.documentElement.scrollWidth>innerWidth})");
  assert(initial.size[0]===width&&initial.size[1]===height&&!initial.overflow,name+' viewport');
  assert(initial.modal===null&&initial.dot&&Object.values(initial.marks).every(m=>m==='available'),name+' voluntary all-unseen');
  assert(initial.book[0]>=44&&initial.book[1]>=44,name+' book target');
  await screenshot(name+'-global');
  await act('#console-encyclopedia',mobile);
  await screenshot(name+'-topics');
  const browse=await evaluate("({groups:[...document.querySelectorAll('#encyclopedia-results h2')].map(e=>e.textContent),rows:[...document.querySelectorAll('[data-entry]')].map(e=>e.textContent),text:document.getElementById('modal-content').innerText})");
  assert(JSON.stringify(browse.groups)===JSON.stringify(['Board mechanics','Progression']),name+' groups');
  assert(browse.rows.length===3&&browse.rows.every(t=>t.includes('Unseen'))&&!/World|locked|% complete/.test(browse.text),name+' browse noncolor/spoiler');
  const reads=[];
  for(const entry of ['charge','chords','prestige']){
    await act(`[data-entry="${entry}"]`,mobile);
    const read=await evaluate("(()=>{const a=window.__flowsynth,e=document.querySelector('.encyclopedia-entry');return {title:e.querySelector('h2').textContent,text:e.innerText,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,animations:e.getAnimations({subtree:true}).length,overflow:e.scrollWidth>e.clientWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth,marks:{...a.state.encyclopedia},dot:!document.querySelector('.encyclopedia-dot').hidden,controls:[...e.querySelectorAll('input,canvas,animate')].length};})()");
    assert(read.marks[entry]==='seen'&&read.reduced&&read.animations===0&&!read.overflow&&!read.pageOverflow&&!read.controls,name+' '+entry+' static/seen');
    assert(read.text.includes('Illustrative example')&&!/World|combat|Column|Blade/.test(read.text),name+' '+entry+' example/spoilers');
    assert(read.dot===(entry!=='prestige'),name+' last unseen only');
    await screenshot(name+'-'+entry);
    if(mobile){await evaluate("document.querySelector('.encyclopedia-entry').lastElementChild.scrollIntoView({block:'end'})");await screenshot(name+'-'+entry+'-lower');}
    reads.push(read);
    if(entry!=='prestige')await act('#encyclopedia-back',mobile);
  }
  if(mobile)await act('#close-modal',true);else await key('Escape','Escape',27);
  const globalReturn=await evaluate("({modal:window.__flowsynth.ui.modal,focus:document.activeElement.id})");
  assert(globalReturn.modal===null&&globalReturn.focus==='console-encyclopedia',name+' global focus');
  // Contextual Catalog task with scroll and related history, no purchase.
  await evaluate("(()=>{const a=window.__flowsynth;a.openModal('catalog');document.getElementById('catalog-body').scrollTop=80;})()");
  const catalogBefore=await act('#about-chords',mobile);
  await act('[data-entry="charge"]',mobile);await act('#encyclopedia-previous',mobile);
  assert(await evaluate("document.querySelector('.encyclopedia-entry h2').textContent==='Chords and harmonic capacity'"),name+' related Back');
  if(mobile)await act('#close-modal',true);else await key('Escape','Escape',27);
  const catalogReturn=await evaluate("({modal:window.__flowsynth.ui.modal,focus:document.activeElement.id,scroll:document.getElementById('catalog-body').scrollTop,capacityBought:window.__flowsynth.state.capacityBought})");
  assert(catalogReturn.modal==='catalog'&&catalogReturn.focus==='about-chords'&&catalogReturn.capacityBought===0&&catalogReturn.scroll===catalogBefore.catalogScroll,name+' catalog task/scroll');
  // Relevant inspection while live; all three concepts traversed, pan/zoom retained.
  let inspectionReturn;
  try {
  await evaluate("(()=>{const a=window.__flowsynth;a.closeModal();a.ui.zoom=2;a.ui.pan={x:10,y:-20};a.devActionStartSession(10);document.querySelector('[data-cell=\"0,0\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));window.__536session=a.state.session;window.__536detail=JSON.stringify(a.ui.detail);})()");
  // Reassert the viewport after the flow setup; record live dimensions, not requested metrics.
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await settle();
  assert(await evaluate(`innerWidth===${width}&&innerHeight===${height}`),name+' inspection viewport');
  await act('#detail-about-chords',mobile);
  await act('[data-entry="charge"]',mobile);await act('[data-entry="prestige"]',mobile);
  await evaluate('window.__flowsynth.devAdvance(10)');
  if(mobile)await act('#close-modal',true);else await key('Escape','Escape',27);
  inspectionReturn=await evaluate("(()=>{const a=window.__flowsynth;return {mode:a.state.mode,elapsed:a.state.session.elapsed,sameSession:a.state.session===window.__536session,sameDetail:JSON.stringify(a.ui.detail)===window.__536detail,pan:a.ui.pan,zoom:a.ui.zoom,layer:a.ui.boardLayer,focus:document.activeElement.id};})()");
  assert(inspectionReturn.mode==='flow'&&inspectionReturn.elapsed>=10&&inspectionReturn.sameSession&&inspectionReturn.sameDetail&&inspectionReturn.zoom===2&&inspectionReturn.pan.x===10&&inspectionReturn.pan.y===-20&&inspectionReturn.focus==='detail-about-chords',name+' live inspection return');
  await screenshot(name+'-inspection-return');
  } catch (error) {
    if (!mobile) throw error;
    inspectionReturn={unavailable:String(error),actual:await evaluate("({size:[innerWidth,innerHeight],modal:window.__flowsynth.ui.modal,detail:document.querySelector('.hex-detail')?.className,button:document.querySelector('#detail-about-chords')?.getBoundingClientRect().toJSON()})")};
    console.log('phone inspection unavailable',JSON.stringify(inspectionReturn));
    await screenshot('phone-inspection-unavailable');
  }
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await settle();
  // Ledger and destructive confirmation remain a separate deliberate decision.
  await evaluate("(async()=>{const a=window.__flowsynth;await a.devLaunchScenario('fresh-start');a.state.eraEarned=7000000;a.render();a.openLedger('arete');})()");
  await act('#about-prestige',mobile);
  if(mobile)await act('#close-modal',true);else await key('Escape','Escape',27);
  const ledgerReturn=await evaluate("({modal:window.__flowsynth.ui.modal,focus:document.activeElement.id,prestiges:window.__flowsynth.state.prestiges})");
  assert(ledgerReturn.modal==='rate'&&ledgerReturn.focus==='about-prestige'&&ledgerReturn.prestiges===0,name+' ledger return');
  await evaluate('window.__flowsynth.openPrestigeConfirm()');
  await act('#confirm-about-prestige',mobile);
  if(mobile)await act('#close-modal',true);else await key('Escape','Escape',27);
  const confirmation=await evaluate("({modal:window.__flowsynth.ui.modal,focus:document.activeElement.id,prestiges:window.__flowsynth.state.prestiges,text:document.getElementById('modal-content').innerText})");
  assert(confirmation.modal==='prestige'&&confirmation.focus==='confirm-about-prestige'&&confirmation.prestiges===0&&confirmation.text.includes('0 Arete'),name+' confirmation return');
  await screenshot(name+'-confirmation');
  records.push({name,initial,browse,reads,globalReturn,catalogBefore,catalogReturn,inspectionReturn,ledgerReturn,confirmation,input:mobile?'CDP emulated touch':'CDP keyboard Enter/Escape',physicalHuman:false});
  await writeFile(new URL('browser-observations.json',out),JSON.stringify(records,null,2)+'\n');
  console.log(name+' completed');
}
ws.close();
