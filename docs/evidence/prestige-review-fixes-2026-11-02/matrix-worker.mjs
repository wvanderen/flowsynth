import { pathToFileURL } from 'node:url';
const root=process.cwd();
const { createServer }=await import(pathToFileURL(`${root}/node_modules/vite/dist/node/index.js`));
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
const server=await createServer({root,server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
const m=await server.ssrLoadModule('/tools/first-prestige.ts');
if(process.argv[2]==='probe'){ console.log(typeof m.firstPrestigeRow); }
else if(process.argv[2]==='merge'){
 const runs=(await Promise.all(m.FIRST_PRESTIGE_SEEDS.map(s=>readFile(`/tmp/pr501-seed-${s}.json`,'utf8').then(JSON.parse)))).flat();
 const sorted=[25,60].flatMap(minutes=>['prompt','pushing'].flatMap(policy=>m.FIRST_PRESTIGE_SEEDS.map(seed=>runs.find(r=>r.seed===seed&&r.sessionMinutes===minutes&&r.policy===policy))));
 if(sorted.some(r=>!r)||sorted.some(r=>!r.noGrant)) throw Error('Incomplete matrix or currency mismatch');
 for (const row of sorted) {
  assert.equal(row.noGrant,true);
  const prompt=sorted.find(r=>r.seed===row.seed&&r.sessionMinutes===row.sessionMinutes&&r.policy==='prompt');
  assert.equal(row.eligibilityHours,prompt.eligibilityHours);
  if(row.policy==='prompt') {
   assert.equal(row.stopKind,'prestige'); assert.equal(row.claims.length,1);
   assert.equal(row.worthwhileClass,row.claims[0]===0?'unreached':'bank-only');
  }
  if(['in-window','under','over'].includes(row.worthwhileClass)) {
   assert.equal(row.complete,true);assert.equal(row.stopKind,'recovered');
   for(const mark of ['lastingPurchaseHours','weaponDeployedHours','columnDeployedHours','productionRegainedHours','eligibilityReachedHours','frontierAdvancedHours']) assert.notEqual(row.journey[mark],null);
  }
 }
 const {playthroughSource}=await server.ssrLoadModule('/src/engine/playthrough.ts');
 const report={target:{minHours:8,maxHours:12,centeredHours:10},seeds:m.FIRST_PRESTIGE_SEEDS,budgets:{baselineDays:m.BASELINE_BUDGET_DAYS,longDays:m.LONG_BUDGET_DAYS},source:playthroughSource(),runs:sorted,distributions:[25,60].flatMap(minutes=>['pushing','prompt'].map(policy=>m.distributionOf(sorted.filter(r=>r.sessionMinutes===minutes&&r.policy===policy))))};
 await writeFile(`${root}/docs/first-prestige-results.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.distributions));
} else {
 const seed=Number(process.argv[2]); const {runPlaythrough}=await server.ssrLoadModule('/src/engine/playthrough.ts');
 const runs=[];
 for(const minutes of [25,60]) for(const policy of ['prompt','pushing']){
  runs.push(m.firstPrestigeRow(seed,minutes,runPlaythrough(m.firstPrestigeRecipe(seed,minutes,policy))));
  console.log(`seed ${seed}: ${minutes}m ${policy} complete`);
 }
 await writeFile(`/tmp/pr501-seed-${seed}.json`,JSON.stringify(runs));
}
} finally {await server.close();}
