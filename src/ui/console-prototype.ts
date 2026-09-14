// THROWAWAY: three console structures on /?prototype=console&variant=A.
// Question (#20): what does the promoted top-bar console look and behave like
// in use — layout, app-panel interaction, locked/active/in-flow states, and
// how it reads as "higher level" than the board?
// Fixture only: values, rung prices, and the Enter/Exit hue are provisional.
// No game or save writes. The status-monitor slots are placeholders for #27.
const palette = {
  bg: "#0d1122", panel: "#141a30", soft: "#111627", line: "#2a3150",
  ink: "#e5e9f5", muted: "#929bb8",
  generator: "#238858", synthesizer: "#6360d4", infusor: "#cc603d", forge: "#bc9239",
  charge: "#9affa8", nous: "#cbcaff",
  graphite: "#16181d", graphiteSoft: "#111318", consoleLine: "#2f3440",
  consoleDim: "#5b6273", power: "#e6b445",
};
const names = ["A · Rack rail + popovers", "B · State strip + drawer", "C · Faceplate modal"];
const hints = [
  "Fixed graphite rail. App panels float as popovers over production; the board never moves or dims.",
  "Slim state strip. An app slides a full-width drawer down that pushes the board beneath it; one drawer at a time.",
  "Minimal top panel. An app raises a centered faceplate modal; the board dims and recedes while you operate the instrument.",
];
type AppKey = "habit" | "time" | "goals" | "notes";
const appMeta: Record<AppKey, { name: string; glyph: string; unlock: string }> = {
  habit: { name: "HABIT", glyph: "M0-8A8 8 0 1 1-6.9 3.9M-6.9 3.9l-3-1M-6.9 3.9l1.2 3", unlock: "FREE · ALWAYS ON" },
  time: { name: "TIME", glyph: "M0-8A8 8 0 1 1 0 8A8 8 0 0 1 0-8ZM0-4V0L3 2", unlock: "MILESTONE · AFTER FIRST SESSION" },
  goals: { name: "GOALS", glyph: "M-6-8V8M-6-7H6L3-3 6 1H-6", unlock: "RUNG 2 · PAID" },
  notes: { name: "NOTES", glyph: "M-7-8H7M-7-2H7M-7 4H2M5 7 8 4M5 7 3 8 4 5Z", unlock: "" },
};
const state = {
  live: true, paused: false, elapsed: 728, nous: 128,
  rung: 4, rungPrice: 45,
  active: { habit: true, time: true, goals: true, notes: false } as Record<AppKey, boolean>,
  panel: null as AppKey | null,
  capacity: 3, usedSlots: 2, habit: "Piano", target: "25:00",
  notesThisSession: 3,
};
const boardModules = [
  { name: "PULSE", category: "generator", value: "1.0 /s", glyph: "M-22 0h10v-16h14v32h14V0h9", x: 330, y: 255, rarity: 1 },
  { name: "ADDITIVE", category: "synthesizer", value: "+0.15", glyph: "M-24 0Q-12-30 0 0T24 0", x: 490, y: 162, rarity: 2 },
  { name: "CONDITIONAL", category: "synthesizer", value: "×1.20", glyph: "M-24 12 -12-12 0 12 12-12 24 12", x: 490, y: 348, rarity: 2 },
  { name: "INFUSOR", category: "infusor", value: "+20%", glyph: "M-22 0H0M0 0 20-18M0 0 20 18M0 0H25", x: 650, y: 255, rarity: 1 },
  { name: "FORGE", category: "forge", value: "42 / 60", glyph: "M0-24 24 0 0 24-24 0ZM0-13 13 0 0 13-13 0Z", x: 330, y: 441, rarity: 3 },
] as const;
const hex = (r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 + 30) * Math.PI) / 180;
    return `${Math.cos(a) * r},${Math.sin(a) * r}`;
  }).join(" ");
let variant = Math.max(0, ["A", "B", "C"].indexOf(new URLSearchParams(location.search).get("variant") ?? "A"));
export function mountConsolePrototype() {
  const style = document.createElement("style");
  style.textContent = `
  :root {${Object.entries(palette).map(([k, v]) => `--p-${k}:${v}`).join(";")}}
  body {margin:0;background:var(--p-bg);color:var(--p-ink);font:14px system-ui}
  #app,.modal-backdrop{display:none}
  #cproto{min-height:100vh;display:flex;flex-direction:column;background:var(--p-bg)}
  #cproto *{box-sizing:border-box}
  #cproto button{font:inherit;color:var(--p-ink);background:var(--p-graphiteSoft);border:1px solid var(--p-consoleLine);padding:8px 14px;border-radius:4px;cursor:pointer}
  #cproto button:disabled{opacity:.45;cursor:not-allowed}
  #cproto button:focus-visible,#cproto .tile:focus-visible{outline:1px solid var(--p-ink)}
  .mono{font-family:monospace}
  .eyebrow{font:10px monospace;letter-spacing:2px;color:var(--p-consoleDim)}
  /* shared console atoms (monochrome per art direction; nous + power are the exceptions) */
  .led{width:5px;height:5px;border-radius:50%;background:var(--p-ink);box-shadow:0 0 5px var(--p-ink)}
  .led.off{background:var(--p-consoleDim);box-shadow:none}
  .powerbtn{display:flex;align-items:center;gap:10px;border-color:var(--p-power)!important}
  .powerbtn .pglyph{stroke:var(--p-power)!important}
  .live .powerbtn{border-color:var(--p-power);box-shadow:0 0 14px #e6b44555;animation:breathe 2.4s ease-in-out infinite}
  .live .powerbtn .pglyph{filter:drop-shadow(0 0 4px var(--p-power))}
  @keyframes breathe{50%{box-shadow:0 0 4px #e6b44522}}
  .nousnum{color:var(--p-nous);font:22px monospace;text-shadow:0 0 12px #cbcaff44}
  .clock{font:20px monospace;letter-spacing:1px}
  .smon{display:flex;flex-direction:column;gap:3px;min-width:170px}
  .smon .row{display:flex;align-items:center;gap:8px;font:10px monospace;letter-spacing:1px;color:var(--p-consoleDim)}
  .smon .formula{color:var(--p-ink);font:13px monospace}
  .smon .ghost{flex:1;height:6px;border:1px solid var(--p-consoleLine);border-radius:2px}
  .idle .smon .formula{color:var(--p-consoleDim)}
  /* app tiles */
  .tile{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 10px 7px;background:transparent;border:1px solid transparent;border-radius:5px;cursor:pointer;position:relative}
  .tile svg{display:block}
  .tile .glyph{stroke:var(--p-ink);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
  .tile.locked .glyph{stroke:var(--p-consoleDim)}
  .tile.locked .led{background:var(--p-consoleDim);box-shadow:none}
  .tile .tname{font:9px monospace;letter-spacing:1px;color:var(--p-consoleDim)}
  .tile.open{border-color:var(--p-consoleLine);background:var(--p-graphiteSoft)}
  .tile .rung{font:9px monospace;color:var(--p-consoleDim)}
  /* panel content (shared fixture) */
  .apname{font-size:19px;letter-spacing:2px;font-weight:600}
  .apstate{font:10px monospace;letter-spacing:1.5px;color:var(--p-consoleDim)}
  .prow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--p-consoleLine)}
  .prow:last-child{border-bottom:0}
  .pbar{height:5px;background:var(--p-consoleLine);border-radius:2px;overflow:hidden;flex:1}
  .pbar i{display:block;height:100%;background:var(--p-ink);opacity:.75}
  .buy{border-color:var(--p-consoleLine)!important;padding:7px 12px;font:12px monospace}
  .buy.ok:hover{border-color:var(--p-ink)}
  .longgoal{margin-top:12px;padding:11px;border:1px dashed var(--p-consoleLine);border-radius:4px}
  .longgoal .lgtitle{font:11px monospace;letter-spacing:2px;color:var(--p-ink)}
  .locknote{font:10px monospace;letter-spacing:1px;color:var(--p-consoleDim);margin-top:8px}
  /* variant A: rack rail + popovers */
  .rail{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:26px;height:66px;padding:0 26px;background:var(--p-graphite);border-bottom:1px solid var(--p-consoleLine);box-shadow:0 6px 24px #0009}
  .rail .apps{display:flex;gap:6px;flex:1}
  .popover{position:absolute;top:calc(100% + 12px);left:50%;transform:translateX(-50%);width:350px;background:var(--p-graphite);border:1px solid var(--p-consoleLine);border-radius:6px;padding:16px 18px;box-shadow:0 18px 50px #000c;z-index:9;animation:pop .14s ease-out}
  .tile.first .popover{left:0;transform:none}
  .tile.last .popover{left:auto;right:0;transform:none}
  @keyframes pop{from{opacity:0;transform:translateX(-50%) translateY(-5px)}}
  .tile.first .popover{animation-name:popL}.tile.last .popover{animation-name:popR}
  @keyframes popL{from{opacity:0;transform:translateY(-5px)}}
  @keyframes popR{from{opacity:0;transform:translateY(-5px)}}
  /* variant B: state strip + drawer */
  .strip{display:flex;align-items:center;gap:22px;height:56px;padding:0 26px;background:var(--p-graphite);border-bottom:1px solid var(--p-consoleLine)}
  .strip .apps{display:flex;gap:4px;flex:1}
  .strip .tile{padding:6px 8px 5px}
  .drawer{background:var(--p-graphite);border-bottom:1px solid var(--p-consoleLine);box-shadow:0 14px 40px #000a;animation:drop .18s ease-out}
  @keyframes drop{from{opacity:0;transform:translateY(-10px)}}
  .drawer .cols{display:grid;grid-template-columns:210px 1fr 250px;min-height:216px}
  .drawer .cid{padding:20px;border-right:1px solid var(--p-consoleLine);display:flex;flex-direction:column;gap:10px;align-items:flex-start}
  .drawer .cid .glyph{stroke:var(--p-ink);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;width:44px;height:44px}
  .drawer .ccontent{padding:20px 24px;min-width:0}
  .drawer .cup{padding:20px;border-left:1px solid var(--p-consoleLine);display:flex;flex-direction:column;gap:10px}
  .drawer .cup .eyebrow{margin-bottom:2px}
  /* variant C: faceplate modal */
  .toppanel{display:flex;align-items:center;gap:24px;height:58px;padding:0 26px;background:var(--p-graphite);border-bottom:1px solid var(--p-consoleLine)}
  .overlay{position:fixed;inset:0;background:#06080fcc;display:flex;align-items:center;justify-content:center;z-index:8;animation:fade .15s ease-out}
  .overlay.live{background:#06080f99;backdrop-filter:blur(2px)}
  @keyframes fade{from{opacity:0}}
  .faceplate{width:min(660px,92vw);background:var(--p-graphite);border:1px solid var(--p-consoleLine);border-radius:8px;padding:26px 30px;box-shadow:0 30px 80px #000d;animation:rise .18s ease-out}
  @keyframes rise{from{opacity:0;transform:translateY(10px)}}
  .faceplate .fphead{display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--p-consoleLine);padding-bottom:14px;margin-bottom:6px}
  .faceplate .glyph{stroke:var(--p-ink);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;width:40px;height:40px}
  .faceplate .slots{margin-top:16px;display:flex;gap:10px}
  .faceplate .slot{flex:1;border:1px dashed var(--p-consoleLine);border-radius:4px;padding:10px 12px;font:10px monospace;letter-spacing:1px;color:var(--p-consoleDim)}
  /* board + fixture chrome */
  .fxbar{display:flex;align-items:center;gap:14px;padding:12px 26px;border-bottom:1px solid var(--p-line);flex-wrap:wrap}
  .fxbar h1{font-size:15px;margin:0;letter-spacing:.5px}
  .fxbar .hint{color:var(--p-muted);font-size:12px;flex:1;min-width:240px}
  .boardwrap{flex:1;background:var(--p-soft);min-height:0}
  .boardwrap svg{width:100%;height:100%;min-height:430px;display:block}
  .lead{stroke:var(--p-charge);stroke-width:2;fill:none;opacity:.85}
  .moving{stroke-dasharray:3 19;stroke-width:4;animation:patch 2s linear infinite}
  .paused .lead{opacity:.2}.paused .moving{display:none}
  .charge-led{filter:drop-shadow(0 0 4px var(--p-charge))}
  .paused .charge-led{opacity:.15;filter:none}
  @keyframes patch{to{stroke-dashoffset:-44}}
  .legend{display:flex;gap:22px;font:10px monospace;letter-spacing:1px;color:var(--p-muted);padding:10px 26px;border-top:1px solid var(--p-line)}
  .switcher{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;gap:18px;align-items:center;padding:9px;background:var(--p-ink);color:var(--p-bg);border-radius:8px;box-shadow:0 8px 35px #0008;z-index:20}
  .switcher span{min-width:230px;text-align:center;font-size:13px}
  .switcher button{background:transparent;border:0;color:var(--p-bg);padding:4px 10px;font-size:15px}
  @media(prefers-reduced-motion:reduce){.moving,.live .powerbtn{animation:none}}
  @media(max-width:1000px){.drawer .cols{grid-template-columns:1fr}.drawer .cid,.drawer .cup{border:0;border-bottom:1px solid var(--p-consoleLine);flex-direction:row;align-items:center}.rail{gap:12px;overflow-x:auto}}
  `;
  document.head.append(style);
  const root = document.createElement("div");
  root.id = "cproto";
  document.body.append(root);
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as unknown as T;
  function render() {
    root.className = state.live && !state.paused ? "live" : "idle";
    root.innerHTML = `${variant === 0 ? railConsole() : variant === 1 ? stripConsole() + drawer() : topConsole()}
      ${fixtureBar()}
      <div class="boardwrap ${state.live && !state.paused ? "" : "paused"}" data-act="close">
        <svg viewBox="120 35 690 550" role="group" aria-label="Fixture board: five modules with charge routing">
          <defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".7" fill="var(--p-line)"/></pattern></defs>
          <rect x="120" y="35" width="690" height="550" fill="url(#dots)"/>
          ${[1, 2, 4].map((i) => `<path class="lead" d="M330 255 L${boardModules[i].x} ${boardModules[i].y}"/><path class="lead moving" d="M330 255 L${boardModules[i].x} ${boardModules[i].y}"/>`).join("")}
          ${boardModules.map((m) => panelC(m)).join("")}
          ${boardModules.map((m) => `<circle cx="${m.x}" cy="${m.y}" r="5" fill="var(--p-bg)" stroke="var(--p-charge)" class="charge-led"/>`).join("")}
        </svg>
      </div>
      <div class="legend"><span>HUE / category</span><span>ENGRAVED RINGS / rarity</span><span>GREEN LIGHT / charge</span><span>CONSOLE / monochrome graphite — nous &amp; power excepted</span><span>STATUS SLOTS RESERVED FOR #27</span></div>
      <div class="switcher"><button id="prev" aria-label="Previous variant">←</button><span>${names[variant]}</span><button id="next" aria-label="Next variant">→</button></div>
      ${variant === 2 && state.panel ? modalOverlay() : ""}`;
    $("#prev").addEventListener("click", () => cycle(-1));
    $("#next").addEventListener("click", () => cycle(1));
    root.querySelectorAll<HTMLElement>("[data-act]").forEach((el) => {
      const act = el.dataset.act;
      if (act === "close") {
        el.addEventListener("click", (e) => {
          if (e.target === el && state.panel) {
            state.panel = null;
            render();
          }
        });
        return;
      }
      el.addEventListener("click", () => doAct(act!, el.dataset));
    });
  }
  function doAct(act: string, ds: DOMStringMap) {
    if (act === "toggle-live") {
      state.live = !state.live;
      if (state.live) state.elapsed = 0;
      state.paused = false;
      if (!state.live) state.panel = null;
    } else if (act === "pause") {
      state.paused = !state.paused;
    } else if (act === "open") {
      state.panel = state.panel === (ds.app as AppKey) ? null : (ds.app as AppKey);
    } else if (act === "close-panel") {
      state.panel = null;
    } else if (act === "activate-notes" && !state.live && state.nous >= state.rungPrice) {
      state.nous -= state.rungPrice;
      state.active.notes = true;
      state.rungPrice = 90;
      state.rung = 5;
    } else if (act === "buy-capacity" && !state.live && state.nous >= 1200) {
      state.nous -= 1200;
      state.capacity = 4;
    } else if (act === "grant") {
      state.nous += 2000;
    } else if (act === "reset") {
      Object.assign(state, { live: true, paused: false, elapsed: 728, nous: 128, rung: 4, rungPrice: 45, panel: null, capacity: 3, usedSlots: 2, habit: "Piano", target: "25:00", notesThisSession: 3 });
      (state.active as Record<AppKey, boolean>).habit = true;
      state.active.time = true;
      state.active.goals = true;
      state.active.notes = false;
    } else if (act === "habit" && !state.live && ds.habit) {
      state.habit = ds.habit;
    } else if (act === "target" && ds.target) {
      state.target = ds.target;
    }
    render();
  }
  function cycle(delta: number) {
    variant = (variant + delta + 3) % 3;
    const url = new URL(location.href);
    url.searchParams.set("variant", ["A", "B", "C"][variant]);
    history.replaceState(null, "", url);
    render();
  }
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest("input,textarea,select,[contenteditable]")) return;
    if (e.key === "Escape" && state.panel) {
      state.panel = null;
      render();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      cycle(e.key === "ArrowLeft" ? -1 : 1);
    }
  });
  window.setInterval(() => {
    if (state.live && !state.paused) {
      state.elapsed++;
      root.querySelectorAll("[data-clock]").forEach((el) => (el.textContent = clock()));
    }
  }, 1000);
  render();
}
const clock = () => `${String(Math.floor(state.elapsed / 60)).padStart(2, "0")}:${String(state.elapsed % 60).padStart(2, "0")}`;
const glyphSvg = (g: string, size = 22) => `<svg width="${size}" height="${size}" viewBox="-12 -12 24 24" aria-hidden="true"><path class="glyph" d="${g}"/></svg>`;
const powerGlyph = '<svg width="20" height="20" viewBox="-12 -12 24 24" aria-hidden="true"><path class="glyph pglyph" d="M0-9V-2M6.4-6.4A9 9 0 1 1-6.4-6.4" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>';
const powerControl = () => `<button class="powerbtn" data-act="toggle-live" aria-label="${state.live ? "End flow session" : "Enter flow"}">${powerGlyph}<span class="mono" style="font-size:11px;letter-spacing:2px">${state.live ? "END FLOW" : "ENTER FLOW"}</span></button>${state.live ? `<button data-act="pause" style="padding:8px 10px" aria-label="Pause session">${state.paused ? "▶" : "❙❙"}</button>` : ""}`;
const clockBlock = () => `<div><div class="eyebrow">${state.paused ? "PAUSED" : state.live ? "IN FLOW" : "IDLE"}</div><div class="clock" data-clock>${clock()}</div></div>`;
const nousBlock = () => `<div style="text-align:right"><div class="eyebrow">NOUS</div><div class="nousnum">${state.nous.toLocaleString("en-US")}</div><div class="eyebrow" style="margin-top:2px">NEXT RUNG ${state.rungPrice} · ANY APP</div></div>`;
const statusMonitor = () => `<div class="smon"><div class="row"><span class="formula">${state.live ? "1.85 NOUS/S" : "LAST 1.85 NOUS/S"}</span><span>NOW</span></div><div class="row"><span class="ghost"></span><span>FORGE · #27</span></div><div class="row"><span class="ghost"></span><span>ARETE · #27</span></div></div>`;
function tile(k: AppKey, extra = "") {
  const m = appMeta[k];
  const on = state.active[k];
  const open = state.panel === k;
  return `<div class="tile ${on ? "" : "locked"} ${open ? "open" : ""} ${extra}" tabindex="0" role="button" data-act="open" data-app="${k}" aria-label="${m.name} app, ${on ? "active" : `locked, rung ${state.rung}`}">
    ${glyphSvg(m.glyph)}<span class="led ${on ? "" : "off"}"></span><span class="tname">${m.name}</span>${on ? "" : `<span class="rung">${state.rungPrice}</span>`}
    ${variant === 0 && open ? `<div class="popover" data-panel-root>${appPanel(k)}</div>` : ""}
  </div>`;
}
function appPanel(k: AppKey) {
  const m = appMeta[k];
  const head = `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px"><span class="apname">${m.name}</span><span class="apstate">${onLabel(k)}</span></div>`;
  if (!state.active[k]) {
    return `${head}<p style="color:var(--p-muted);line-height:1.55;margin:0 0 12px">${k === "notes" ? "Record notes mid-flow. Qualifying practice banks a charge burst at session end. Permanent player-wide unlock — the board never needs a slot for it." : ""}</p>
      <div class="prow"><span style="color:var(--p-muted)">APP ACTIVATION · RUNG ${state.rung}</span><button class="buy ${!state.live && state.nous >= state.rungPrice ? "ok" : ""}" data-act="activate-notes" ${state.live || state.nous < state.rungPrice ? "disabled" : ""}>ACTIVATE · ${state.rungPrice} NOUS</button></div>
      <div class="locknote">${state.live ? "READ-ONLY IN FLOW · BUY IN UPGRADE MODE" : state.nous < state.rungPrice ? `NEED ${(state.rungPrice - state.nous).toLocaleString("en-US")} MORE · ~2 PRACTICE-MIN` : "SHARED LADDER · FREE ORDER · NEXT RUNG 90"}</div>`;
  }
  if (k === "habit") {
    return `${head}${["Piano", "Cooking", "Stretching"].map((h) => `<div class="prow"><span>${h}${h === state.habit ? " · SELECTED" : ""}</span><button class="buy" data-act="habit" data-habit="${h}" ${state.live || h === state.habit ? "disabled" : ""}>${h === state.habit ? "●" : "SELECT"}</button></div>`).join("")}<div class="locknote">${state.live ? "HABIT LOCKED FOR THIS SESSION" : "FREE · ALWAYS ON — NO RUNG, NO LEVELS"}</div>`;
  }
  if (k === "time") {
    return `${head}<div class="prow"><span>PLANNED TARGET</span><span class="mono">${["20:00", "25:00", "45:00", "OPEN"].map((t) => `<button class="buy" data-act="target" data-target="${t}" style="padding:5px 9px;margin-left:4px;${t === state.target ? "border-color:var(--p-ink)" : ""}">${t}</button>`).join("")}</span></div>
      <div class="prow"><span>COMPLETION BONUS</span><span class="mono">${state.target === "OPEN" ? "—" : "ON TARGET · +CHARGE BURST"}</span></div><div class="locknote">MILESTONE UNLOCK — FREE AFTER YOUR FIRST SESSION</div>`;
  }
  if (k === "goals") {
    return `${head}<div class="prow"><span>SLOTS</span><span class="mono">${state.usedSlots} / ${state.capacity}</span></div>
      <div class="prow"><span>Piano 20:00 <span class="eyebrow">RECURRING</span></span><span style="display:flex;align-items:center;gap:8px;flex:1;max-width:170px"><span class="pbar"><i style="width:60%"></i></span><span class="mono">60%</span></span></div>
      <div class="prow"><span>4 habits today <span class="eyebrow">ONE-TIME</span></span><span style="display:flex;align-items:center;gap:8px;flex:1;max-width:170px"><span class="pbar"><i style="width:50%"></i></span><span class="mono">50%</span></span></div>
      <div class="longgoal"><div class="lgtitle">CONSOLE LONG GOAL · ONE AT A TIME</div><div class="prow" style="border:0;padding:8px 0 0"><span>GOAL CAPACITY III<br><span class="eyebrow">${state.capacity} → ${state.capacity + 1} SLOTS</span></span><button class="buy ${!state.live && state.nous >= 1200 ? "ok" : ""}" data-act="buy-capacity" ${state.live || state.nous < 1200 || state.capacity > 3 ? "disabled" : ""}>${state.capacity > 3 ? "OWNED" : "1,200 NOUS"}</button></div></div>`;
  }
  return `${head}<div class="prow"><span>NOTES THIS SESSION</span><span class="mono">${state.notesThisSession}</span></div><div class="prow"><span>BANKED BURST</span><span class="mono">2.4 CHARGE / MIN</span></div><div class="locknote">ACTIVATED · RUNG 4 · NEXT RUNG (ANY APP) ${state.rungPrice}</div>`;
}
const onLabel = (k: AppKey) => (state.active[k] ? (k === "habit" ? appMeta.habit.unlock : k === "time" ? appMeta.time.unlock : k === "goals" ? appMeta.goals.unlock : `ACTIVATED · RUNG 4`) : `LOCKED · RUNG ${state.rung}`);
function railConsole() {
  return `<header class="rail">${powerControl()}${clockBlock()}<div class="apps">${tile("habit", "first")}${tile("time")}${tile("goals")}${tile("notes", "last")}</div>${statusMonitor()}${nousBlock()}</header>`;
}
function stripConsole() {
  return `<header class="strip">${powerControl()}${clockBlock()}<div class="apps">${tile("habit", "first")}${tile("time")}${tile("goals")}${tile("notes", "last")}</div>${statusMonitor()}${nousBlock()}</header>`;
}
function drawer() {
  if (!state.panel) return "";
  const k = state.panel;
  const m = appMeta[k];
  return `<section class="drawer" data-panel-root><div class="cols">
    <div class="cid">${glyphSvg(m.glyph, 44)}<div><div class="apname" style="font-size:16px">${m.name}</div><div class="apstate">${onLabel(k)}</div></div><div class="eyebrow" style="margin-top:auto">CONSOLE DRAWER · PATCH BAY</div></div>
    <div class="ccontent">${appPanel(k)}</div>
    <div class="cup"><div class="eyebrow">PERMANENT UPGRADES</div>${state.active[k] ? `<div style="font-size:12px;color:var(--p-muted);line-height:1.5">Hand-paced <b style="color:var(--p-ink)">console long goals</b> live here — one at a time, priced past the current build-out.${k === "goals" ? " Current: GOAL CAPACITY III." : " Nothing offered for this app yet."}</div>` : `<div style="font-size:12px;color:var(--p-muted)">Upgrades appear once the app is activated.</div>`}<button class="buy" data-act="close-panel" style="align-self:flex-start;margin-top:auto">CLOSE DRAWER · ESC</button></div>
  </div></section>`;
}
function topConsole() {
  return `<header class="toppanel">${powerControl()}${clockBlock()}<div class="apps" style="display:flex;gap:4px;flex:1">${tile("habit", "first")}${tile("time")}${tile("goals")}${tile("notes", "last")}</div>${statusMonitor()}${nousBlock()}</header>`;
}
function modalOverlay() {
  const k = state.panel!;
  const m = appMeta[k];
  return `<div class="overlay ${state.live ? "live" : ""}" data-act="close"><div class="faceplate" data-panel-root>
    <div class="fphead">${glyphSvg(m.glyph, 40)}<div><div class="apname">${m.name}</div><div class="apstate">${onLabel(k)} · CONSOLE INSTRUMENT</div></div><button class="buy" data-act="close-panel" style="margin-left:auto">CLOSE · ESC</button></div>
    ${appPanel(k)}
    ${state.active[k] ? `<div class="slots"><div class="slot">OPTION SLOT · CONSOLE LONG GOALS LIVE IN THE APP PANEL ABOVE</div><div class="slot">OPTION SLOT · RESERVED</div></div>` : ""}
  </div></div>`;
}
function fixtureBar() {
  return `<div class="fxbar"><div><div class="eyebrow">THROWAWAY / CONSOLE UX STUDY · #20</div><h1>${names[variant].split("·")[1].trim()}</h1></div>
  <span class="hint">${hints[variant]}</span>
  <button class="buy" data-act="toggle-live">${state.live ? "SWITCH TO UPGRADE MODE" : "ENTER LIVE SESSION"}</button>
  <button class="buy" data-act="grant">GRANT +2,000 NOUS (FIXTURE)</button>
  <button class="buy" data-act="reset">RESET FIXTURE</button></div>`;
}
function panelC(m: (typeof boardModules)[number]) {
  const color = `var(--p-${m.category})`;
  const text = (x: number, y: number, s: string, size = 10, fill = "var(--p-ink)") => `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-family="monospace" font-size="${size}">${s}</text>`;
  return `<g transform="translate(${m.x} ${m.y})"><polygon points="${hex(103)}" fill="var(--p-panel)" stroke="var(--p-line)"/>
  ${Array.from({ length: m.rarity }, (_, r) => `<polygon points="${hex(97 - r * 5)}" fill="none" stroke="var(--p-muted)" stroke-opacity=".4" stroke-width="1"/>`).join("")}
  <path d="M-63-30V30" stroke="${color}" stroke-width="7"/>${text(0, -48, m.name, 10)}${text(8, -12, m.value, 23)}<path d="${m.glyph}" transform="translate(34 36) scale(.55)" fill="none" stroke="${color}" stroke-width="2.5"/>${text(-18, 48, String(m.category).toUpperCase(), 7, "var(--p-muted)")}</g>`;
}
