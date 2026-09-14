// THROWAWAY: three module-face hierarchies on /?prototype=retheme&variant=A.
// Fixture only: category assignments and values are provisional. No game or save writes.
const palette = { bg: '#0d1122', panel: '#141a30', soft: '#111627', line: '#2a3150', ink: '#e5e9f5', muted: '#929bb8', generator: '#238858', synthesizer: '#6360d4', infusor: '#cc603d', forge: '#bc9239', charge: '#9affa8', nous: '#cbcaff' };
const names = ['A · Signature plates', 'B · Instrument diagrams', 'C · Readout panels'];
const modules = [
  { name:'PULSE', category:'generator', value:'1.0 /s', glyph:'M-22 0h10v-16h14v32h14V0h9', x:330,y:255 },
  { name:'ADDITIVE', category:'synthesizer', value:'+0.15', glyph:'M-24 0Q-12-30 0 0T24 0', x:490,y:162 },
  { name:'CONDITIONAL', category:'synthesizer', value:'×1.20', glyph:'M-24 12 -12-12 0 12 12-12 24 12', x:490,y:348 },
  { name:'INFUSOR', category:'infusor', value:'+20%', glyph:'M-22 0H0M0 0 20-18M0 0 20 18M0 0H25', x:650,y:255 },
  { name:'FORGE', category:'forge', value:'42 / 60', glyph:'M0-24 24 0 0 24-24 0ZM0-13 13 0 0 13-13 0Z', x:330,y:441 },
] as const;
const hex = (r:number) => Array.from({length:6},(_,i)=>{const a=(i*60+30)*Math.PI/180;return `${Math.cos(a)*r},${Math.sin(a)*r}`}).join(' ');
let variant = Math.max(0, ['A','B','C'].indexOf(new URLSearchParams(location.search).get('variant') ?? 'A'));
let live = true, rarity = 2, selected = 1;
export function mountRethemePrototype() {
  const style = document.createElement('style');
  style.textContent = `
  :root {${Object.entries(palette).map(([k,v])=>`--p-${k}:${v}`).join(';')}}
  body {margin:0;background:var(--p-bg);color:var(--p-ink);font:14px system-ui} #app,.modal-backdrop{display:none}
  #retheme {min-height:100vh;box-sizing:border-box;padding:0 32px 110px;background:var(--p-bg)}
  #retheme *{box-sizing:border-box} #retheme button,#retheme select{font:inherit;color:var(--p-ink);background:var(--p-panel);border:1px solid var(--p-line);padding:9px 15px;border-radius:4px;cursor:pointer}
  #retheme header{height:88px;display:flex;align-items:center;gap:30px;border-bottom:1px solid var(--p-line)}
  #retheme .brand{font-size:21px;letter-spacing:-1px;color:var(--p-nous)} #retheme nav{display:flex;gap:8px;flex:1}
  #retheme .balance{color:var(--p-nous);font:22px monospace} #retheme .eyebrow{font:11px monospace;letter-spacing:2px;color:var(--p-muted)}
  #retheme .heading{display:flex;justify-content:space-between;align-items:center;padding:30px 0 14px} #retheme h1{font-size:25px;margin:8px 0} #retheme h2{font-size:21px;margin:12px 0}
  #retheme .layout{display:grid;grid-template-columns:minmax(580px,1fr) 280px;border:1px solid var(--p-line)}
  #retheme .board{background:var(--p-soft);min-width:0} #retheme svg{width:100%;display:block} #retheme aside{padding:25px;border-left:1px solid var(--p-line)}
  #retheme p{line-height:1.6;color:var(--p-muted)} #retheme .stat{padding:15px 0;border-bottom:1px solid var(--p-line);display:flex;justify-content:space-between} #retheme .stat b{font-family:monospace}
  #retheme .legend{padding:18px;display:flex;gap:20px;font:11px monospace;color:var(--p-muted);border-top:1px solid var(--p-line)}
  #retheme .switcher{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;gap:18px;align-items:center;padding:9px;background:var(--p-ink);color:var(--p-bg);border-radius:8px;box-shadow:0 8px 35px #0008;z-index:10} #retheme .switcher span{min-width:210px;text-align:center}
  #retheme .controls{display:flex;align-items:center;gap:12px} #retheme .module{cursor:pointer;outline:none} #retheme .module:focus .selection{stroke:var(--p-ink)}
  #retheme .lead{stroke:var(--p-charge);stroke-width:2;fill:none;opacity:.85} #retheme .moving{stroke-dasharray:3 19;stroke-width:4;animation:patch 2s linear infinite} #retheme .paused .lead{opacity:.2} #retheme .paused .moving{display:none}
  #retheme .charge-led{filter:drop-shadow(0 0 4px var(--p-charge))} #retheme .paused .charge-led{opacity:.15;filter:none}
  @keyframes patch{to{stroke-dashoffset:-44}} @media(prefers-reduced-motion:reduce){#retheme .moving{animation:none}} @media(max-width:1000px){#retheme .layout{grid-template-columns:1fr}#retheme aside{border-left:0;border-top:1px solid var(--p-line)}#retheme header{gap:15px}#retheme nav{display:none}}
  `;
  document.head.append(style);
  const root = document.createElement('div'); root.id='retheme'; document.body.append(root);
  function render() {
    const m = modules[selected];
    root.innerHTML = `<header><div class="brand">⬡ FlowSynth</div><nav><button>Habit · Piano</button><button>Time · 12:08</button><button>Goals</button><button>Notes</button></nav><div class="balance">128 <small>nous</small></div></header>
    <div class="heading"><div><div class="eyebrow">THROWAWAY / MODULE IDENTITY STUDY</div><h1>Your practice, in circuit.</h1></div><div class="controls"><label>Rarity <select id="rarity"><option value="1">1 · Common</option><option value="2">2 · Uncommon</option><option value="3">3 · Rare</option></select></label><button id="live">${live?'Pause charge':'Run charge'}</button></div></div>
    <div class="layout"><div class="board ${live?'':'paused'}"><svg viewBox="120 35 690 550" role="group" aria-label="Five modules comparing category, type, rarity and charge">
    <defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".7" fill="var(--p-line)"/></pattern></defs><rect x="120" y="35" width="690" height="550" fill="url(#dots)"/>
    ${modules.map((m,i)=>panel(m,i)).join('')}
    ${[1,2,4].map(i=>`<path class="lead" d="M330 255 L${modules[i].x} ${modules[i].y}"/><path class="lead moving" d="M330 255 L${modules[i].x} ${modules[i].y}"/>`).join('')}
    ${modules.map(m=>`<circle cx="${m.x}" cy="${m.y}" r="5" fill="var(--p-bg)" stroke="var(--p-charge)" class="charge-led"/>`).join('')}
    </svg><div class="legend"><span>HUE / category</span><span>ENGRAVED RINGS / rarity</span><span>GREEN LIGHT / charge</span></div></div>
    <aside><div class="eyebrow">SELECTED MODULE</div><h2>${m.name}</h2><p>${m.category} · ${['Common','Uncommon','Rare'][rarity-1]}</p><div class="stat"><span>Contribution</span><b>${m.value}</b></div><div class="stat"><span>Charge preview</span><b>${live?'Live':'Paused'}</b></div><div class="stat"><span>Frame rings</span><b>${rarity}</b></div><p>${['Glyph first. Broad category nameplate, large signature, compact lower readout.','Diagram first. The face describes a signal with a schematic rail and smaller technical labels.','Value first. Oversized contribution readout, side signature and narrow category rail.'][variant]}</p><p>Compare Additive and Conditional: same category hue, different signatures.</p><p class="eyebrow">FIXTURE · NO SAVE WRITES</p><p>Infusor vermillion and Forge amber are provisional; taxonomy remains open. Values are illustrative.</p></aside></div>
    <div class="switcher"><button id="prev" aria-label="Previous variant">←</button><span>${names[variant]}</span><button id="next" aria-label="Next variant">→</button></div>`;
    (root.querySelector('#rarity') as HTMLSelectElement).value=String(rarity);
    root.querySelector('#rarity')!.addEventListener('change',e=>{rarity=Number((e.target as HTMLSelectElement).value);render()});
    root.querySelector('#live')!.addEventListener('click',()=>{live=!live;render()});
    root.querySelector('#prev')!.addEventListener('click',()=>cycle(-1));root.querySelector('#next')!.addEventListener('click',()=>cycle(1));
    root.querySelectorAll<SVGGElement>('[data-module]').forEach(el=>{const pick=()=>{selected=Number(el.dataset.module);render()};el.addEventListener('click',pick);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}})});
  }
  function panel(m:typeof modules[number],i:number) {
    const color=`var(--p-${m.category})`;
    const text=(x:number,y:number,s:string,size=10,fill='var(--p-ink)')=>`<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-family="monospace" font-size="${size}">${s}</text>`;
    const glyph=(x:number,y:number,scale=1)=>`<path d="${m.glyph}" transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="2.5"/>`;
    return `<g class="module" data-module="${i}" tabindex="0" role="button" aria-label="Select ${m.name}" transform="translate(${m.x} ${m.y})"><polygon points="${hex(103)}" fill="var(--p-panel)" stroke="var(--p-line)"/>
    ${Array.from({length:rarity},(_,r)=>`<polygon points="${hex(97-r*5)}" fill="none" stroke="var(--p-muted)" stroke-opacity=".4" stroke-width="1"/>`).join('')}
    <polygon class="selection" points="${hex(106)}" fill="none" stroke="${selected===i?'var(--p-ink)':'transparent'}" stroke-dasharray="3 6"/>
    ${variant===0?`<rect x="-52" y="-57" width="104" height="19" fill="${color}"/>${text(0,-44,m.name,10)}${glyph(0,-10,1.1)}${text(0,40,m.value,18)}${text(0,58,m.category.toUpperCase(),8,'var(--p-muted)')}`:variant===1?`${text(0,-53,m.name,11)}<path d="M-62-30V25H62V-30M-62 15H-40M40 15H62" stroke="${color}" fill="none" stroke-width="2"/>${glyph(0,-15,.8)}<circle cx="-60" cy="-30" r="4" fill="${color}"/><circle cx="60" cy="-30" r="4" fill="${color}"/>${text(0,46,m.value,16)}${text(0,62,m.category.toUpperCase(),8,'var(--p-muted)')}`:`<path d="M-63-30V30" stroke="${color}" stroke-width="7"/>${text(0,-48,m.name,10)}${text(8,-12,m.value,23)}${glyph(34,36,.55)}${text(-18,48,m.category.toUpperCase(),7,'var(--p-muted)')}`}</g>`;
  }
  function cycle(delta:number){variant=(variant+delta+3)%3;const url=new URL(location.href);url.searchParams.set('variant',['A','B','C'][variant]);history.replaceState(null,'',url);render()}
  document.addEventListener('keydown',e=>{if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();cycle(e.key==='ArrowLeft'?-1:1)}});
  render();
}
