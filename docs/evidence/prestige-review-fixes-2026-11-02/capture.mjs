import { chromium } from '../../../node_modules/playwright-core/index.mjs';
import { writeFile } from 'node:fs/promises';
const dir=new URL('.', import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 await page.goto('http://localhost:5173/?dev=1');
 await page.waitForFunction(()=>window.__flowsynth);
 const result=await page.evaluate(()=>{
  const app=window.__flowsynth;
  const record=app.devRunPlaythrough({seed:23,policyId:'pushing',budgetDays:7});
  const event=record.events.find(e=>e.label==='First prestige eligibility reached');
  if(!event) throw Error('Missing eligibility milestone');
  app.devToggleCurves();
  app.devInspectPlaythrough(event.snapshot);
  return {event,claims:record.claims,source:record.source};
 });
 await page.getByText('First prestige eligibility reached',{exact:false}).last().waitFor();
 await page.screenshot({path:dir+'/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.getByText('First prestige eligibility reached',{exact:false}).last().scrollIntoViewIfNeeded();
 await page.screenshot({path:dir+'/phone.png'});
 await writeFile(dir+'/read.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {await browser.close();}
