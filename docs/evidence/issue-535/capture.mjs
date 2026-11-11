// Independent local-Chromium evidence pass after preview snapshot service exhaustion.
// Run with Node supporting WebSocket; Chromium CDP must listen on localhost:9335.
import { writeFile } from 'node:fs/promises';
const out = new URL('./', import.meta.url);
const targets = await (await fetch('http://localhost:9335/json')).json();
const target = targets.find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = event => { const msg = JSON.parse(event.data); if (!msg.id) return; const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); };
const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id:n, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true }); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const assert = (value, label) => { if(!value) throw new Error(label); };
await send('Page.enable');
await send('Page.navigate', { url:'http://localhost:5174/?dev=1' });
for(let n=0;n<100;n++) { if(await evaluate('!!window.__flowsynth')) break; await new Promise(r => setTimeout(r,100)); }
const records=[];
for(const [name,width,height,mobile] of [['desktop',1280,900,false],['phone',390,844,true]]) {
  await send('Emulation.setDeviceMetricsOverride', { width,height,deviceScaleFactor:1,mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled:mobile, maxTouchPoints:1 });
  await send('Emulation.setEmulatedMedia', { features:[{ name:'prefers-reduced-motion', value:'reduce' }] });
  await evaluate("(async()=>{const a=window.__flowsynth; await a.devLaunchScenario('fresh-start'); a.openLedger('arete'); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); document.getElementById('about-prestige').focus();})()");
  if(mobile) {
    const point=await evaluate("(()=>{const r=document.getElementById('about-prestige').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[point]});
    await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
  } else {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  }
  await new Promise(r=>setTimeout(r,100));
  const read=await evaluate("(()=>{const a=window.__flowsynth,e=document.querySelector('.encyclopedia-entry');return {size:[innerWidth,innerHeight],title:e?.querySelector('h2').textContent,seen:a.state.encyclopedia.prestige,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,animations:e?.getAnimations({subtree:true}).length,overflow:document.documentElement.scrollWidth>innerWidth,articleOverflow:e?.scrollWidth>e?.clientWidth,text:e?.innerText,prestiges:a.state.prestiges};})()");
  console.log(name, JSON.stringify(read));
  assert(read.title==='Prestige' && read.seen==='seen' && read.reduced && read.prestiges===0, name+' opening');
  assert(!read.overflow && !read.articleOverflow && read.animations===0,name+' static/layout metrics');
  assert(!/World|combat|Column|Blade/.test(read.text),name+' spoilers');
  const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(new URL(name+'.png',out),Buffer.from(image.data,'base64'));
  if(mobile) {
    await evaluate("document.querySelector('.encyclopedia-entry').lastElementChild.scrollIntoView({block:'end'})");
    const lower=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(new URL('phone-lower.png',out),Buffer.from(lower.data,'base64'));
    await evaluate("document.getElementById('close-modal').scrollIntoView({block:'start'})");
    const point=await evaluate("(()=>{const r=document.querySelector('#close-modal')?.getBoundingClientRect();return r ? {x:r.x+r.width/2,y:r.y+r.height/2} : null;})()");
    assert(point,'phone Close target');
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  } else {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  }
  await new Promise(r=>setTimeout(r,100));
  const returned=await evaluate("({modal:window.__flowsynth.ui.modal,focus:document.activeElement.id,disabled:document.getElementById('prestige-door')?.disabled,prestiges:window.__flowsynth.state.prestiges})");
  assert(returned.modal==='rate' && returned.focus==='about-prestige' && returned.disabled && returned.prestiges===0,name+' return');
  const flow=await evaluate("(()=>{const a=window.__flowsynth; a.closeModal(); a.devActionStartSession(10); a.openLedger('arete'); document.getElementById('about-prestige').focus(); document.getElementById('about-prestige').click(); const session=a.state.session; a.devAdvance(10); a.closeModal(); return {mode:a.state.mode,elapsed:a.state.session?.elapsed,sameSession:a.state.session===session,disabled:document.getElementById('prestige-door').disabled,prestiges:a.state.prestiges};})()");
  assert(flow.mode==='flow' && flow.sameSession && flow.elapsed>=10 && flow.disabled && flow.prestiges===0,name+' flow continuity');
  await evaluate("(async()=>{const a=window.__flowsynth; await a.devLaunchScenario('fresh-start'); a.state.eraEarned=7000000; a.render(); a.openPrestigeConfirm(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()");
  const confirmImage=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(new URL(name+'-confirmation.png',out),Buffer.from(confirmImage.data,'base64'));
  records.push({name,read,returned,flow,input:mobile?'CDP emulated touch open/Close':'CDP Enter/Escape keyboard',physicalHuman:false});
}
await writeFile(new URL('browser-observations.json',out),JSON.stringify(records,null,2)+'\n');
ws.close();
console.log(JSON.stringify(records,null,2));
