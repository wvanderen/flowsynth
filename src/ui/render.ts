import { chargedFactor, computeRates, isActive, isCore, levelCost, modulePower } from "../engine/economy";
import { deployedAt, deployedTime, chargeSecondsRemaining, chargeActive } from "../engine/economy";
import { adjacent, sameHex } from "../engine/hex";
import { forgeThreshold, expansionThreshold } from "../engine/rolls";
import { BALANCE } from "../engine/constants";
import { formatClock, formatDuration } from "../engine/clock";
import type { GameState, Hex, ModuleInstance } from "../engine/types";
import type { App } from "./app";
import { moduleIcon } from "./icons";
import { DURATION_OPTIONS, META, RARITY_LABEL, fmt, fmtWhole } from "./meta";

const HEX_RADIUS = 61;
const SPACING = 65;

function point({ q, r }: Hex): [number, number] {
  return [Math.sqrt(3) * SPACING * (q + r / 2), SPACING * 1.5 * r];
}

function hexPoints(radius: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 30) * Math.PI) / 180;
    return `${radius * Math.cos(a)},${radius * Math.sin(a)}`;
  }).join(" ");
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// The rate shown in the header, formula bar, and hexes: live during flow,
// idle build rate while arranging in upgrade mode. Module panels preview
// charge separately via computeRates(state, true).
function currentSnapshot(state: Parameters<typeof computeRates>[0]): ReturnType<typeof computeRates> {
  return computeRates(state, state.mode === "upgrade" ? false : undefined);
}

function el(html: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild as HTMLDivElement;
}

function stat(label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono">${value}</span></div>`;
}

function meterBar(progress: number, threshold: number, system: "forge" | "expansion", state: GameState): string {
  const text = system === "forge" ? "Next Forge roll" : "Next grid cell";
  const note =
    system === "forge"
      ? `All deployed Forges feed one shared meter · ${state.forge.earned} earned`
      : `All deployed expanders feed one shared meter · ${state.expansion.earned} earned`;
  return `<div class="overview-meter" title="${note}">${stat(text, `${fmt(Math.max(0, progress), 1)} / ${fmt(threshold, 1)}`)}
    <progress aria-label="${text}" value="${Math.min(1, Math.max(0, progress / threshold))}" max="1"></progress></div>`;
}

export function render(app: App): void {
  const { state } = app;
  renderSessionToolbar(app);
  renderAccounting(app);
  renderHeading(app);
  renderTools(app);
  renderGrid(app);
  renderFormula(app);
  renderInspector(app);
  renderModal(app);
  renderDev(app);
  const count = byId("cell-count");
  if (count) count.textContent = `${state.cells.length} cells`;
}

/* ── Top toolbar ───────────────────────────────────── */

function renderSessionToolbar(app: App): void {
  const { state } = app;
  const host = byId("session-toolbar");
  if (!host) return;
  const upgrade = state.mode === "upgrade";

  if (upgrade) {
    host.innerHTML = `
      <div class="toolbar-intro">
        <div class="eyebrow">NEXT PRACTICE</div>
        <p class="small muted" style="margin:2px 0 0">Pick a duration and enter flow. The grid locks while it runs.</p>
      </div>
      <div class="config">
        <label class="config-label" for="duration">Session duration</label>
        <select id="duration">${DURATION_OPTIONS.map(
          (o) => `<option value="${o.value === null ? "open" : o.value}" ${app.ui.chosenTarget === o.value ? "selected" : ""}>${o.label}</option>`,
        ).join("")}</select>
      </div>
      <div class="session-actions">
        <button class="primary" id="start-flow">Enter flow ↗</button>
      </div>`;
    const select = byId("duration");
    select?.addEventListener("change", () => {
      const v = (select as HTMLSelectElement).value;
      app.ui.chosenTarget = v === "open" ? null : Number(v);
      app.render();
    });
    byId("start-flow")?.addEventListener("click", () => app.startFlow());
    return;
  }

  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const caption = paused
    ? "Paused · progress preserved"
    : target === null
      ? "Open-ended practice"
      : elapsed >= target
        ? "Target reached · continue freely"
        : `of ${formatClock(target)} planned`;
  const banked = chargeSecondsRemaining(state);
  const dispensing = chargeActive(state) && !paused;

  host.innerHTML = `
    <div>
      <div class="eyebrow">CURRENT PRACTICE</div>
      <p class="session-clock mono" id="session-clock">${formatClock(elapsed)}</p>
      <p class="clock-caption">${caption}</p>
      <div class="time-track"><span style="width:${target ? Math.min(100, (elapsed / target) * 100) : 0}%"></span></div>
    </div>
    <div class="config">
      <span class="config-label">Charge bank</span>
      <strong class="mono" style="font-size:17px">${Math.ceil(banked)}s</strong>
      <p class="clock-caption">${dispensing ? "→ dispensing now" : paused ? "frozen while paused" : "waiting / banked"}</p>
    </div>
    <div class="session-actions">
      <button id="pause-flow">${paused ? "Resume" : "Pause"}</button>
      <button class="primary" id="end-flow">End flow</button>
    </div>`;
  byId("pause-flow")?.addEventListener("click", () => (paused ? app.resume() : app.pause()));
  byId("end-flow")?.addEventListener("click", () => app.endFlow());
}

function renderAccounting(app: App): void {
  const { state } = app;
  const host = byId("accounting");
  if (!host) return;
  const rate = currentSnapshot(state).rate;
  const mode = state.mode === "upgrade" ? "UPGRADE MODE" : state.mode === "paused" ? "FLOW PAUSED" : "FLOW LIVE";
  host.innerHTML = `
    <div><span class="eyebrow">Nous</span><strong id="nous-display">${fmtWhole(state.nous)}</strong></div>
    <div><span class="eyebrow">Production</span><strong>${fmt(rate)}<span class="unit"> ν/s</span></strong></div>
    <div><span class="eyebrow">Mode</span><strong style="font-size:11px;letter-spacing:.08em;padding-top:6px">${mode}</strong></div>`;
}

function renderHeading(app: App): void {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  const eyebrow = byId("board-eyebrow");
  const title = byId("board-title");
  const caption = byId("board-caption");
  if (!eyebrow || !title || !caption) return;
  if (upgrade) {
    eyebrow.textContent = "YOUR INSTRUMENT";
    title.textContent = state.sessionsCompleted === 0 ? "Begin your first practice." : "Make room for the next idea.";
    caption.textContent = "Arrange, tune, and begin again. Banked charge is safe between sessions.";
  } else {
    eyebrow.textContent = `SESSION ${String(state.sessionIndex).padStart(2, "0")}`;
    title.textContent = "A quiet place for the work you want to do.";
    caption.textContent = state.mode === "paused" ? "Time and charge are frozen. Resume when you're back." : "The instrument runs. Your attention stays with your practice.";
  }
}

function renderTools(app: App): void {
  const { state } = app;
  const host = byId("board-tools");
  if (!host) return;
  const upgrade = state.mode === "upgrade";
  const storeReady = state.storeOpened;
  host.innerHTML = `
    <button class="small" id="tool-store" ${upgrade && storeReady ? "" : "disabled"} title="${storeReady ? "Starter copies" : "Opens after your first completed timed target"}">Store</button>
    <button class="small" id="tool-forge" ${upgrade ? "" : "disabled"}>Forge · ${state.bankedRolls.length}</button>
    <button class="small" id="tool-manage" ${upgrade ? "" : "disabled"}>Grid &amp; inventory</button>`;
  byId("tool-store")?.addEventListener("click", () => app.openModal("store"));
  byId("tool-forge")?.addEventListener("click", () => app.openModal("forge"));
  byId("tool-manage")?.addEventListener("click", () => (app.ui.managing ? app.stopManaging() : app.startManaging()));
}

/* ── Formula bar ───────────────────────────────────── */

function renderFormula(app: App): void {
  const { state } = app;
  const host = byId("rate-formula");
  if (!host) return;
  const snapshot = currentSnapshot(state);
  const term = (type: string, value: number) =>
    `<span class="formula-term" title="${META[type as keyof typeof META].name}" aria-label="${META[type as keyof typeof META].name}: ${fmt(value)}">
      <svg viewBox="-18 -18 36 36" aria-hidden="true" fill="none" stroke-width="1.6">${moduleIcon(type as never)}</svg>${fmt(value)}</span>`;
  const sum = (type: string) => {
    let total = 0;
    for (const c of snapshot.contributions.values()) if (c.type === type) total += c.value;
    return total;
  };
  host.innerHTML = `
    <div class="rate-equation">
      <span class="op">(</span>${term("enter", sum("enter"))}<span class="op">+</span>${term("additive", sum("additive"))}<span class="op">)</span>
      <span class="op">×</span><span class="op">(1 +</span>${term("time", sum("time"))}<span class="op">)</span>
      <span class="op">×</span><span class="op">(1 +</span>${term("conditional", sum("conditional"))}<span class="op">)</span>
      <span class="op">=</span><strong>${fmt(snapshot.rate)} ν/s</strong>
    </div>
    <p class="formula-note">${
      state.mode === "flow"
        ? chargeActive(state)
          ? "Live rate with charge flowing."
          : "Live rate; charge is not dispensing right now."
        : "Build rate preview — production is paused outside flow."
    } Full breakdown in the grid overview.</p>`;
}

/* ── Hex grid ──────────────────────────────────────── */

function renderGrid(app: App): void {
  const { state, ui } = app;
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg) return;
  const upgrade = state.mode === "upgrade";
  const showFrontier = upgrade && (ui.placing === "cell" || ui.reshape !== null);
  const frontier = showFrontier ? app.frontierCells() : [];
  const allCells = [...state.cells, ...frontier];
  const coords = allCells.map(point);
  const minX = Math.min(...coords.map((p) => p[0])) - 78;
  const maxX = Math.max(...coords.map((p) => p[0])) + 78;
  const minY = Math.min(...coords.map((p) => p[1])) - 82;
  const maxY = Math.max(...coords.map((p) => p[1])) + 82;
  svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);

  const time = deployedTime(state);
  const dispensing = state.mode === "flow" && chargeActive(state);
  const snapshot = currentSnapshot(state);
  const selectedModule = state.modules.find((m) => m.id === ui.selected) ?? null;

  let html = "";

  // Charge lines: live during flow, preview when the generator is selected in upgrade mode.
  if (time && isActive(state, time)) {
    const previewing = upgrade && selectedModule?.type === "time";
    if (dispensing || previewing) {
      for (const m of state.modules) {
        if (m.pos === null || !isActive(state, m) || m.id === time.id) continue;
        if (!adjacent(m.pos, time.pos!)) continue;
        const [x1, y1] = point(time.pos!);
        const [x2, y2] = point(m.pos);
        html += `<line class="${dispensing ? "charge-line" : "charge-preview-line"}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }
    }
  }

  // Source lines when a receiver is selected.
  if (upgrade && selectedModule && (selectedModule.type === "forge" || selectedModule.type === "expander") && selectedModule.pos && time && isActive(state, time) && time.pos && adjacent(selectedModule.pos, time.pos)) {
    const [x1, y1] = point(time.pos);
    const [x2, y2] = point(selectedModule.pos);
    html += `<line class="charge-preview-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }

  for (const pos of state.cells) {
    const [x, y] = point(pos);
    const module = deployedAt(state, pos);
    const isRemoval = ui.reshape?.removes.some((c) => sameHex(c, pos)) ?? false;
    let classes = "hex";
    if (isRemoval) classes += " remove-stage";
    if (!module && isTargetCell(app, pos)) classes += " target";
    html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}">
      <polygon class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>`;
    if (module) {
      html += moduleNode(app, module, pos, { dispensing, snapshot, selectedModule });
    } else if (state.mode !== "upgrade") {
      html += `<text y="6" text-anchor="middle" class="hex-sub" fill="#6d766c">—</text>`;
    }
    html += `</g>`;
  }

  if (showFrontier) {
    for (const pos of frontier) {
      const [x, y] = point(pos);
      const isAdd = ui.reshape?.adds.some((c) => sameHex(c, pos)) ?? false;
      html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}">
        <polygon class="hex ${isAdd ? "target" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
        ${isAdd ? `<text y="5" text-anchor="middle" fill="var(--accent)" font-size="20">+</text>` : ""}
      </g>`;
    }
  }

  svg.innerHTML = html;
  bindGridEvents(app, svg);
}

interface RenderContext {
  dispensing: boolean;
  snapshot: ReturnType<typeof computeRates>;
  selectedModule: ModuleInstance | null;
}

function moduleNode(app: App, module: ModuleInstance, _pos: Hex, ctx: RenderContext): string {
  const { state, ui } = app;
  const active = isActive(state, module);
  const selected = ui.selected === module.id;
  const charged = ctx.dispensing && (ctx.snapshot.chargeStrength.get(module.id) ?? 0) > 0;
  const dispensingNow = ctx.dispensing && module.type === "time" && state.timeActive;
  const contribution = ctx.snapshot.contributions.get(module.id);

  let classes = "hex";
  if (selected) classes += " selected";
  if (charged) classes += " charged";
  if (dispensingNow) classes += " dispensing";
  if (!active) classes += " locked";

  // Highlight eligible receivers while the generator is selected in upgrade mode.
  let highlight = "";
  if (state.mode === "upgrade" && ctx.selectedModule?.type === "time" && active && module.type !== "time") {
    const time = deployedTime(state);
    if (time?.pos && module.pos && adjacent(module.pos, time.pos)) {
      highlight = `<circle class="highlight-ring" r="70"/>`;
    }
  }

  let ring = "";
  if (module.type === "forge") {
    const p = state.forge.progress / forgeThreshold(state.forge.earned);
    ring = ringShape(p);
  } else if (module.type === "expander") {
    const p = state.expansion.progress / expansionThreshold(state.expansion.earned);
    ring = ringShape(p);
  }

  let sub = "";
  if (!active) {
    sub = "Locked";
  } else if (module.type === "time") {
    sub = dispensingNow ? `→ ${Math.ceil(ctx.snapshot.chargeSeconds)}s` : `×${fmt(1 + (contribution?.value ?? 0), 2)}`;
  } else if (module.type === "forge") {
    sub = `${fmt(Math.max(0, state.forge.progress), 0)}/${fmt(forgeThreshold(state.forge.earned), 0)}`;
  } else if (module.type === "expander") {
    sub = `${fmt(Math.max(0, state.expansion.progress), 0)}/${fmt(expansionThreshold(state.expansion.earned), 0)}`;
  } else if (module.type === "conditional") {
    sub = `×${fmt(1 + (contribution?.value ?? 0), 2)}`;
  } else if (module.type === "infusor") {
    sub = `+${fmt(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(ctx.snapshot.chargeStrength.get(module.id) ?? 0), 0)}%`;
  } else {
    sub = `+${fmt(contribution?.value ?? 0)} ν/s`;
  }

  const name = META[module.type].short;
  const levelTag = module.level > 0 ? ` ·${module.level}` : "";
  const managing = ui.managing && state.mode === "upgrade";
  const actions =
    managing && selected
      ? `<g class="hex-actions" transform="translate(-34,-86)">
          <g data-hex-action="move" transform="translate(0,0)"><rect width="32" height="16"/><text x="16" y="11" text-anchor="middle">MOVE</text></g>
          ${isCore(module) ? "" : `<g data-hex-action="return" transform="translate(38,0)"><rect width="38" height="16"/><text x="19" y="11" text-anchor="middle">RETURN</text></g>`}
        </g>`
      : "";

  return `${highlight}${ring}
    <g transform="translate(0,-13)" class="hex-icon" fill="none" stroke-width="1.6">${moduleIcon(module.type)}</g>
    <text y="17" text-anchor="middle" class="hex-name">${name}${levelTag}</text>
    <text y="31" text-anchor="middle" class="hex-sub">${sub}</text>
    ${active ? "" : `<g transform="translate(30,-34)" stroke="var(--muted)" fill="none" stroke-width="1.4"><path d="M-3 0v-2.5a3 3 0 0 1 6 0V0"/><rect x="-5" y="0" width="10" height="8" rx="1.5" fill="none"/></g>`}
    ${actions}`;
}

function ringShape(progress: number): string {
  const r = 47;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return `<circle class="ring-track" r="${r}"/><circle class="ring-progress" r="${r}" stroke-dasharray="${clamped * circumference} ${circumference}"/>`;
}

function isTargetCell(app: App, pos: Hex): boolean {
  const { ui, state } = app;
  if (state.mode !== "upgrade") return false;
  if (ui.reshape) return false;
  if (ui.placing && ui.placing !== "cell") {
    const module = state.modules.find((m) => m.id === ui.placing);
    if (!module) return false;
    const occupant = deployedAt(state, pos);
    if (isCore(module)) {
      if (module.pos !== null) return true;
      return occupant?.type === module.type;
    }
    return !occupant || !isCore(occupant);
  }
  return false;
}

function bindGridEvents(app: App, svg: SVGSVGElement): void {
  svg.querySelectorAll<SVGElement>("[data-cell]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const action = (event.target as Element).closest("[data-hex-action]");
      if (action) {
        const cell = node.getAttribute("data-cell")!.split(",").map(Number);
        const module = deployedAt(app.state, { q: cell[0]!, r: cell[1]! });
        if (!module) return;
        const kind = action.getAttribute("data-hex-action");
        if (kind === "move") app.beginPlacing(module.id);
        if (kind === "return") app.returnToInventory(module.id);
        return;
      }
      const cell = node.getAttribute("data-cell")!.split(",").map(Number);
      app.pickCell({ q: cell[0]!, r: cell[1]! });
    });
  });
  if (app.ui.managing && app.state.mode === "upgrade") {
    svg.querySelectorAll<SVGGElement>(".cell-node").forEach((node) => {
      const cell = node.getAttribute("data-cell")!.split(",").map(Number);
      const module = deployedAt(app.state, { q: cell[0]!, r: cell[1]! });
      if (module) bindDrag(app, node, module.id);
    });
  }
}

function bindDrag(app: App, node: Element, id: string): void {
  node.addEventListener("pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || (event.target as Element).closest("[data-hex-action]")) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let ghost: HTMLDivElement | null = null;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
        moved = true;
        ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        ghost.textContent = META[app.state.modules.find((m) => m.id === id)!.type].name;
        document.body.append(ghost);
        node.classList.add("dragging");
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
      }
    };
    const finish = (ev: PointerEvent, apply: boolean) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      ghost?.remove();
      node.classList.remove("dragging");
      if (!apply || !moved) return;
      document.addEventListener("click", suppressClick, { capture: true, once: true });
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const zone = target?.closest("#inventory-zone");
      const cellNode = target?.closest("[data-cell]");
      if (zone) {
        app.returnToInventory(id);
      } else if (cellNode) {
        const cell = cellNode.getAttribute("data-cell")!.split(",").map(Number);
        app.pickCellThenPlace(id, { q: cell[0]!, r: cell[1]! });
      }
    };
    const up = (ev: PointerEvent) => finish(ev, true);
    const cancel = () => finish(new PointerEvent("pointerup"), false);
    const suppressClick = (clickEvent: Event) => {
      clickEvent.preventDefault();
      clickEvent.stopImmediatePropagation();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
  });
}

/* ── Inspector ─────────────────────────────────────── */

function renderInspector(app: App): void {
  const host = byId("inspector");
  if (!host) return;
  if (app.ui.managing && app.state.mode === "upgrade") {
    renderManagePanel(app, host);
    return;
  }
  const module = app.state.modules.find((m) => m.id === app.ui.selected);
  if (!module) {
    renderOverview(app, host);
    return;
  }
  renderModulePanel(app, host, module);
}

function renderOverview(app: App, host: HTMLElement): void {
  const { state } = app;
  const deployedModules = state.modules.filter((m) => m.pos !== null);
  const active = deployedModules.filter((m) => isActive(state, m));
  const upgrade = state.mode === "upgrade";
  host.innerHTML = `
    <div class="grid-overview">
      <div class="eyebrow">GRID OVERVIEW</div>
      <h2>Charge &amp; progress</h2>
      ${stat(upgrade ? "Banked charge" : "Charge remaining", `${Math.ceil(chargeSecondsRemaining(state))}s`)}
      ${stat("Active modules", `${active.length} / ${deployedModules.length} deployed`)}
      ${meterBar(state.forge.progress, forgeThreshold(state.forge.earned), "forge", state)}
      ${meterBar(state.expansion.progress, expansionThreshold(state.expansion.earned), "expansion", state)}
      <div class="divider"></div>
      ${stat("Banked Forge choices", String(state.bankedRolls.length))}
      ${stat("Cells ready to place", String(state.cellTokens))}
      ${stat("Empty grid cells", String(state.cells.length - deployedModules.length))}
      ${stat("Modules in inventory", String(state.modules.length - deployedModules.length))}
      ${stat("Sessions completed", String(state.sessionsCompleted))}
      ${stat("Total nous earned", fmt(state.totalEarned, 1))}
      <p class="small muted" style="margin-top:16px">${
        state.mode === "flow"
          ? "Rewards bank automatically. Nothing here needs your attention during practice."
          : state.mode === "paused"
            ? "Time and charge are frozen while paused."
            : "Select a module to inspect or tune it. Store, Forge, and Grid & inventory manage the build."
      }</p>
      <section class="overview-formula">
        <h3>Nous / second</h3>
        <p>(Flow + additive) × (1 + Time bonus) × (1 + adjacency bonus).</p>
        <p>Each contribution = base effect × rarity growth<sup>level</sup> × (1 + Σ adjacent infusor bonuses) × charge factor.</p>
        <p>Charge factor = 1 + strength / (1 + strength); only strength 1 exists today (+50%).</p>
        <p>Base effects: Flow 0.1 ν/s · additive 0.05 ν/s · Time +0.2 · adjacency +0.1 per adjacent active core · infusor +20%.</p>
        <p>Forge and expansion progress = received strength × progress efficiency; infusors and charge empowerment do not apply to them.</p>
        <p>Rarity growth per level: common ×1.2 · uncommon ×1.25 · rare ×1.3.</p>
      </section>
    </div>`;
}

function effectDescription(module: ModuleInstance): string {
  switch (module.type) {
    case "enter":
      return "Supplies the baseline nous production while flow is live. It never generates charge.";
    case "time":
      return "Applies the running ×1.2 multiplier and awards the completion burst when a timed target is reached.";
    case "additive":
      return "Adds its production directly to the shared base rate.";
    case "conditional":
      return "Adds a multiplier bonus for every adjacent active core module.";
    case "infusor":
      return "Boosts production contributions of eligible adjacent modules. Never affects charge generation or meter progress.";
    case "forge":
      return "Feeds the shared Forge meter while receiving charge. Threshold crossings bank a roll.";
    case "expander":
      return "Feeds the shared expansion meter while receiving charge. Threshold crossings earn grid cells.";
    default:
      return "A reserved focus module. It holds its cell and activates in a later version.";
  }
}

function nominalEffect(module: ModuleInstance, charged: boolean): { text: string; value: number } {
  const power = modulePower(module);
  const factor = charged ? chargedFactor(1) : 1;
  switch (module.type) {
    case "enter":
      return { text: `+${fmt(BALANCE.baseRate * power * factor)} ν/s`, value: BALANCE.baseRate * power * factor };
    case "additive":
      return { text: `+${fmt(BALANCE.additiveRate * power * factor)} ν/s`, value: BALANCE.additiveRate * power * factor };
    case "time":
      return { text: `+${fmt(100 * BALANCE.timeBonus * power)}% multiplier`, value: BALANCE.timeBonus * power };
    case "conditional":
      return { text: `+${fmt(100 * BALANCE.conditionalBonusPerActiveCore * power)}% per adjacent core`, value: BALANCE.conditionalBonusPerActiveCore * power };
    case "infusor":
      return { text: `+${fmt(100 * BALANCE.infusorBonus * power * factor)}% to adjacent`, value: BALANCE.infusorBonus * power * factor };
    case "forge":
    case "expander":
      return { text: `${fmt(power)} progress/s at strength 1`, value: power };
    default:
      return { text: "—", value: 0 };
  }
}

function renderModulePanel(app: App, host: HTMLElement, module: ModuleInstance): void {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  const active = isActive(state, module);
  const meta = META[module.type];
  const preview = upgrade && active ? computeRates(state, true) : computeRates(state);
  const contribution = module.pos !== null ? preview.contributions.get(module.id) : null;
  const deployed = module.pos !== null;
  const effect = deployed && contribution && contribution.value !== 0 ? { text: effectTextFor(module, contribution.value, preview.chargeStrength.get(module.id) ?? 0), value: contribution.value } : nominalEffect(module, upgrade);
  const growth = BALANCE.rarityPower[module.rarity];
  const cost = levelCost(module.level);
  const canUpgrade = upgrade && active && state.storeOpened;
  const affordable = Math.floor(state.nous + 1e-9) >= cost;
  const partner = state.modules.find((m) => m.id !== module.id && m.type === module.type && m.rarity === module.rarity);
  const time = deployedTime(state);
  const neighborStrength = deployed && time?.pos && module.pos && state.timeActive && active && adjacent(module.pos, time.pos)
    ? (state.mode === "flow" && chargeActive(state) ? 1 : state.mode === "upgrade" ? 1 : 0)
    : 0;

  let focus = "";
  if (module.type === "enter") {
    focus = `<section class="focus-controls">
      <span class="eyebrow">FOCUS CONTROLS</span>
      <div class="session-actions">
        ${upgrade ? `<button class="primary" id="panel-flow">Enter flow ↗</button>` : `<button id="panel-pause">${state.mode === "paused" ? "Resume" : "Pause"}</button><button class="primary" id="panel-end">End flow</button>`}
      </div>
    </section>`;
  } else if (module.type === "time") {
    focus = `<section class="focus-controls">
      <span class="eyebrow">FOCUS CONTROLS</span>
      <label class="config-label" for="panel-duration">Session duration</label>
      <select id="panel-duration" ${upgrade ? "" : "disabled"}>
        ${DURATION_OPTIONS.map((o) => `<option value="${o.value === null ? "open" : o.value}" ${app.ui.chosenTarget === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
      </select>
      ${!upgrade && state.session ? stat("Elapsed", formatClock(state.session.elapsed)) : ""}
    </section>`;
  } else if (isCore(module)) {
    focus = `<section class="focus-controls"><span class="eyebrow">FOCUS CONTROLS</span><p class="small muted">This module reserves its cell. Its focus tool arrives in a later version.</p></section>`;
  }

  let chargeStats = "";
  if (module.type === "time") {
    const queued = chargeSecondsRemaining(state);
    chargeStats = `
      ${stat("Trigger", "Timed target complete")}
      ${stat("Burst strength", "1× to each eligible adjacent module")}
      ${stat("Burst duration", "6s × target minutes")}
      ${stat("Next target burst", state.session?.target === null || !state.session ? (app.ui.chosenTarget === null ? "0s (open-ended)" : `${Math.round(app.ui.chosenTarget * BALANCE.chargeSecondsPerPracticeSecond)}s`) : `${Math.round(state.session.target! * BALANCE.chargeSecondsPerPracticeSecond)}s`)}
      ${stat("Queued output", `${fmt(queued, 1)}s`)}
      ${state.timeActive ? "" : stat("Status", "activates after your first session")}`;
  } else if (module.type === "forge" || module.type === "expander") {
    const isForge = module.type === "forge";
    const progress = isForge ? state.forge.progress : state.expansion.progress;
    const threshold = isForge ? forgeThreshold(state.forge.earned) : expansionThreshold(state.expansion.earned);
    const eligible = time?.pos && module.pos && adjacent(module.pos, time.pos) && state.timeActive;
    chargeStats = `
      ${stat("Shared progress", `${fmt(Math.max(0, progress), 1)} / ${fmt(threshold, 1)}`)}
      ${stat("Rewards earned", String(isForge ? state.forge.earned : state.expansion.earned))}
      ${stat("Charge source", eligible ? "adjacent to active Time" : "not adjacent to active Time")}
      ${stat("Progress rate", `${fmt(contribution?.value ?? 0, 2)} /s while charged`)}`;
  } else {
    chargeStats = `
      ${stat("Banked charge", `${Math.ceil(chargeSecondsRemaining(state))}s (on Time)`)}
      ${stat("Neighbor strength", neighborStrength > 0 ? `${neighborStrength}×` : "—")}`;
  }

  host.innerHTML = `
    <div class="module-heading">
      <button class="quiet small" id="back-overview">← Grid overview</button>
      <h1>${meta.name}</h1>
      <span class="rarity-chip ${module.rarity}">${RARITY_LABEL[module.rarity]}${isCore(module) ? " · core" : ""}</span>
    </div>
    ${focus}
    <section>
      <div class="eyebrow">MODULE POWER</div>
      <div class="level-heading">Level <strong>${module.level}</strong><span class="level-effect">${active ? effect.text : "Inactive"}</span></div>
      <p class="small muted" style="margin:6px 0 0">${effectDescription(module)}</p>
      <button class="primary upgrade-cta" id="upgrade-module" ${canUpgrade && affordable ? "" : "disabled"}>
        <span>Upgrade
          <small class="upgrade-gain">+${fmt((growth - 1) * 100, 1)}% → ${nominalGainText(module)}</small>
        </span>
        <strong>${cost} ν</strong>
      </button>
      ${!state.storeOpened ? `<p class="small muted">Upgrades unlock with the store after your first completed timed target.</p>` : ""}
      ${!active ? `<p class="small muted">Inactive core modules cannot take power upgrades.</p>` : ""}
      ${!upgrade && state.storeOpened ? `<p class="small muted">Upgrades happen between sessions.</p>` : ""}
      ${upgrade && active && partner && module.rarity !== "rare"
        ? `<button id="combine-pair">Combine with its ${RARITY_LABEL[module.rarity]} pair</button>`
        : ""}
    </section>
    <section>
      <div class="eyebrow">${upgrade ? "NEXT SESSION PREVIEW" : "LIVE GRID"}</div>
      ${stat("Position", module.pos ? `${module.pos.q}, ${module.pos.r}` : "inventory")}
      ${module.type === "conditional" && module.pos ? stat("Adjacent active cores", String(contribution?.adjacentActiveCores ?? 0)) : ""}
      ${chargeStats}
    </section>`;

  byId("back-overview")?.addEventListener("click", () => app.select(null));
  byId("upgrade-module")?.addEventListener("click", () => app.upgrade(module.id));
  byId("combine-pair")?.addEventListener("click", () => app.combinePair(module.id));
  byId("panel-flow")?.addEventListener("click", () => app.startFlow());
  byId("panel-end")?.addEventListener("click", () => app.endFlow());
  byId("panel-pause")?.addEventListener("click", () => (state.mode === "paused" ? app.resume() : app.pause()));
  const duration = byId("panel-duration");
  duration?.addEventListener("change", () => {
    const v = (duration as HTMLSelectElement).value;
    app.ui.chosenTarget = v === "open" ? null : Number(v);
    app.render();
  });
}

function effectTextFor(module: ModuleInstance, value: number, strength: number): string {
  switch (module.type) {
    case "enter":
    case "additive":
      return `+${fmt(value)} ν/s`;
    case "time":
    case "conditional":
      return `+${fmt(value * 100)}% (×${fmt(1 + value, 3)})`;
    case "infusor":
      return `+${fmt(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(strength), 1)}% to adjacent`;
    default:
      return `${fmt(value, 2)} progress/s`;
  }
}

function nominalGainText(module: ModuleInstance): string {
  const now = nominalEffect(module, false);
  const growth = BALANCE.rarityPower[module.rarity];
  if (module.type === "enter" || module.type === "additive" || module.type === "time" || module.type === "conditional" || module.type === "infusor") {
    return `+${fmt(now.value * (growth - 1), 4)} effect`;
  }
  return `${fmt(now.value * (growth - 1), 3)} progress/s`;
}

/* ── Grid & inventory panel ────────────────────────── */

function renderManagePanel(app: App, host: HTMLElement): void {
  const { state, ui } = app;
  const inventory = state.modules.filter((m) => m.pos === null);
  const reshaping = ui.reshape !== null;
  const validity = reshaping ? app.reshapeValidity() : null;
  host.innerHTML = `
    <div class="detail-head">
      <h1>Grid &amp; inventory</h1>
      <button id="manage-done">Done</button>
    </div>
    <p class="small muted">${
      reshaping
        ? "Reshaping: click empty cells to remove and frontier outlines to add; they must balance."
        : ui.placing
          ? "Choose a destination cell. Occupied gameplay modules swap."
          : "Drag modules between cells, or select one for Move and Return actions. Required cores stay deployed."
    }</p>
    <div class="manage-actions">
      ${reshaping
        ? `<div class="reshape-panel">
            <h3>Reshape board</h3>
            <p class="small muted">Staged: −${ui.reshape!.removes.length} / +${ui.reshape!.adds.length}. Count must stay equal; shape must stay connected.</p>
            <p class="reshape-valid ${validity!.ok ? "ok" : "bad"}">${validity!.message}</p>
            <div class="reshape-actions">
              <button class="primary small" id="reshape-apply" ${validity!.ok ? "" : "disabled"}>Apply</button>
              <button class="small" id="reshape-cancel">Cancel</button>
            </div>
          </div>`
        : `<button id="add-cell" ${state.cellTokens > 0 ? "" : "disabled"}>Add cell · ${state.cellTokens} earned</button>
           <button id="reshape-start">Reshape board</button>`}
    </div>
    <section class="inventory-drop" id="inventory-zone">
      <h3>Inventory</h3>
      <p class="small muted">Drop a gameplay module here to store it, or click one to place it.</p>
      <div class="inventory-list" id="inventory-list">
        ${inventory.map((m) => `<button class="inventory-item" data-inv="${m.id}"><span>${META[m.type].name}${m.level > 0 ? ` ·${m.level}` : ""}</span><small>${RARITY_LABEL[m.rarity]}</small></button>`).join("") || `<p class="empty-copy">Inventory is empty.</p>`}
      </div>
    </section>`;

  byId("manage-done")?.addEventListener("click", () => app.stopManaging());
  byId("add-cell")?.addEventListener("click", () => app.beginCellPlacement());
  byId("reshape-start")?.addEventListener("click", () => app.startReshape());
  byId("reshape-apply")?.addEventListener("click", () => app.applyReshape());
  byId("reshape-cancel")?.addEventListener("click", () => app.cancelReshape());
  host.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach((button) => {
    const id = button.getAttribute("data-inv")!;
    button.addEventListener("click", () => app.beginPlacing(id));
    bindInventoryDrag(app, button, id);
  });
  const zone = byId("inventory-zone");
  zone?.addEventListener("dragover", (e) => e.preventDefault());
}

function bindInventoryDrag(app: App, button: HTMLButtonElement, id: string): void {
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let ghost: HTMLDivElement | null = null;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
        moved = true;
        ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        ghost.textContent = META[app.state.modules.find((m) => m.id === id)!.type].name;
        document.body.append(ghost);
        button.classList.add("dragging");
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
      }
    };
    const finish = (ev: PointerEvent, apply: boolean) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      ghost?.remove();
      button.classList.remove("dragging");
      if (!apply || !moved) return;
      document.addEventListener("click", suppressClick, { capture: true, once: true });
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellNode = target?.closest("[data-cell]");
      if (cellNode) {
        const cell = cellNode.getAttribute("data-cell")!.split(",").map(Number);
        app.pickCellThenPlace(id, { q: cell[0]!, r: cell[1]! });
      }
    };
    const up = (ev: PointerEvent) => finish(ev, true);
    const cancel = () => finish(new PointerEvent("pointerup"), false);
    const suppressClick = (clickEvent: Event) => {
      clickEvent.preventDefault();
      clickEvent.stopImmediatePropagation();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
  });
}

/* ── Modals ────────────────────────────────────────── */

function renderModal(app: App): void {
  const backdrop = byId("modal");
  const content = byId("modal-content");
  if (!backdrop || !content) return;
  const kind = app.ui.modal;
  if (!kind) {
    backdrop.hidden = true;
    return;
  }
  backdrop.hidden = false;
  if (kind === "store") renderStoreModal(app, content);
  else if (kind === "forge") renderForgeModal(app, content);
  else if (kind === "export") renderExportModal(app, content);
  else if (kind === "import") renderImportModal(app, content);
  else if (kind === "reset") renderResetModal(app, content);
  else if (kind === "reconcile") renderReconcileModal(app, content);
  const firstButton = content.querySelector("button:not([disabled])");
  (firstButton as HTMLElement | null)?.focus();
}

function modalTop(label: string): string {
  return `<div class="modal-top"><span class="eyebrow">${label}</span><button id="close-modal" aria-label="Close dialog">✕</button></div>`;
}

function wireClose(app: App): void {
  byId("close-modal")?.addEventListener("click", () => app.closeModal());
}

function renderStoreModal(app: App, content: HTMLElement): void {
  const { state } = app;
  content.innerHTML = `
    ${modalTop("STORE")}
    <h2 id="modal-title">Shape what comes next.</h2>
    <p class="lead">One guaranteed common copy of each starter module. ${fmtWhole(state.nous)} ν available.</p>
    <div class="shop-list">
      ${(Object.keys(BALANCE.starterPrices) as (keyof typeof BALANCE.starterPrices)[])
        .map((type) => {
          const price = BALANCE.starterPrices[type];
          const owned = state.purchased[type];
          const affordable = Math.floor(state.nous + 1e-9) >= price;
          return `<div class="shop-item">
            <div><h3>${META[type].name}</h3><small>${META[type].role}</small></div>
            <button class="primary" data-buy="${type}" ${owned || !affordable ? "disabled" : ""}>${owned ? "Acquired" : `${price} ν`}</button>
          </div>`;
        })
        .join("")}
    </div>
    <p class="modal-note">Each offer is one-time. Copies from Forge rolls do not remove these offers — they can become combination material.</p>`;
  content.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) => {
    button.addEventListener("click", () => {
      app.buy(button.getAttribute("data-buy") as keyof typeof BALANCE.starterPrices);
    });
  });
  wireClose(app);
}

function renderForgeModal(app: App, content: HTMLElement): void {
  const { state } = app;
  const offer = state.bankedRolls[state.bankedRolls.length - 1];
  content.innerHTML = `
    ${modalTop("FORGE / MODULE SELECTION")}
    <h2 id="modal-title">${offer ? "A new possibility." : "Your next possibility is charging."}</h2>
    <p class="lead">${offer ? "Choose one module for your collection. The other two fall away." : "Connect a Forge to active Time and complete timed practice to earn charge."}</p>
    <div class="candidates">
      ${(offer?.candidates ?? []).map((candidate) => `
        <div class="candidate">
          <span class="rarity" style="color:var(--rarity-${candidate.rarity})">${RARITY_LABEL[candidate.rarity]} · level 0</span>
          <span class="symbol">${META[candidate.type].name.charAt(0)}</span>
          <h3>${META[candidate.type].name}</h3>
          <p>${META[candidate.type].role}</p>
          <button class="primary" data-choice="${candidate.id}" data-offer="${offer!.id}">Choose module ↗</button>
        </div>`).join("")}
    </div>
    <p class="modal-note">${state.bankedRolls.length} saved ${state.bankedRolls.length === 1 ? "choice" : "choices"}. Outcomes were fixed when each roll was earned and survive reloads.</p>`;
  content.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      app.chooseCandidate(button.getAttribute("data-offer")!, button.getAttribute("data-choice")!);
    });
  });
  wireClose(app);
}

function renderExportModal(app: App, content: HTMLElement): void {
  const text = app.exportText();
  content.innerHTML = `
    ${modalTop("EXPORT SAVE")}
    <h2 id="modal-title">Take your progress with you.</h2>
    <p class="lead">Copy this save text, or download it as a file. Import it on any machine running FlowSynth.</p>
    <textarea class="save-textarea" id="export-text" readonly>${text}</textarea>
    <div class="modal-actions">
      <button id="export-copy">Copy to clipboard</button>
      <button id="export-download" class="primary">Download .json</button>
    </div>`;
  byId("export-copy")?.addEventListener("click", async () => {
    const textarea = byId("export-text") as HTMLTextAreaElement | null;
    if (!textarea) return;
    textarea.select();
    try {
      await navigator.clipboard.writeText(textarea.value);
      app.say("Save copied to the clipboard.");
    } catch {
      document.execCommand("copy");
      app.say("Save selected — copy it with ⌘C / Ctrl+C.");
    }
  });
  byId("export-download")?.addEventListener("click", () => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flowsynth-save.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });
  wireClose(app);
}

function renderImportModal(app: App, content: HTMLElement): void {
  content.innerHTML = `
    ${modalTop("IMPORT SAVE")}
    <h2 id="modal-title">Bring progress back.</h2>
    <p class="lead">Paste a FlowSynth save here, or choose a save file. This replaces the current instrument.</p>
    <textarea class="save-textarea" id="import-text" placeholder='{"app":"flowsynth", ...}'></textarea>
    <div class="modal-actions">
      <input type="file" id="import-file" accept="application/json,.json" style="display:none" />
      <button id="import-browse">Choose file…</button>
      <button id="import-apply" class="primary">Import</button>
    </div>
    ${app.ui.importError ? `<p class="import-error">${app.ui.importError}</p>` : ""}`;
  const textarea = byId("import-text") as HTMLTextAreaElement | null;
  const file = byId("import-file") as HTMLInputElement | null;
  byId("import-browse")?.addEventListener("click", () => file?.click());
  file?.addEventListener("change", async () => {
    const fileItem = file.files?.[0];
    if (!fileItem || !textarea) return;
    textarea.value = await fileItem.text();
  });
  byId("import-apply")?.addEventListener("click", () => {
    if (textarea) app.importText(textarea.value);
  });
  wireClose(app);
}

function renderResetModal(app: App, content: HTMLElement): void {
  content.innerHTML = `
    ${modalTop("RESET")}
    <h2 id="modal-title">Start over?</h2>
    <p class="lead">This erases the current instrument: modules, nous, charge, progress, and banked rolls. Export first if you want a backup.</p>
    <div class="modal-actions">
      <button id="reset-cancel">Keep playing</button>
      <button id="reset-confirm" class="primary" style="background:var(--danger);border-color:var(--danger)">Erase everything</button>
    </div>`;
  byId("reset-cancel")?.addEventListener("click", () => app.closeModal());
  byId("reset-confirm")?.addEventListener("click", () => app.hardReset());
  wireClose(app);
}

function renderReconcileModal(app: App, content: HTMLElement): void {
  const gap = app.state.pendingGap;
  const minutes = Math.floor((gap?.seconds ?? 0) / 60);
  content.innerHTML = `
    ${modalTop("PRACTICE CHECK")}
    <h2 id="modal-title">Were you practicing?</h2>
    <p class="lead">FlowSynth lost contact with the browser for a while. Confirm the interval to keep its rewards, or discard it.</p>
    <p class="reconcile-gap">${formatDuration(gap?.seconds ?? 0)}</p>
    <p class="small muted">${minutes > 0 ? `About ${minutes} minute${minutes === 1 ? "" : "s"} of wall-clock time.` : ""} Nothing was finalized yet; rewards apply only after you confirm.</p>
    <div class="modal-actions">
      <button id="gap-discard">Discard interval</button>
      <button id="gap-confirm" class="primary">Count this practice</button>
    </div>`;
  byId("gap-confirm")?.addEventListener("click", () => app.confirmGap());
  byId("gap-discard")?.addEventListener("click", () => app.discardGap());
}

/* ── Dev panel ─────────────────────────────────────── */

function renderDev(app: App): void {
  let panel = byId("dev-panel");
  if (!app.dev) {
    panel?.remove();
    return;
  }
  if (!panel) {
    panel = el(`<div class="dev-panel" id="dev-panel"><span>DEV</span></div>`);
    document.body.append(panel!);
  }
  panel.innerHTML = `<span>DEV</span>
    <button data-dev="60">+1m</button>
    <button data-dev="600">+10m</button>
    <button data-dev="target">→ target</button>
    <button data-dev="charge">+60s charge</button>
    <button data-dev="nous">+100ν</button>`;
  panel.querySelectorAll<HTMLButtonElement>("[data-dev]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-dev")!;
      if (key === "target") app.devToTarget();
      else if (key === "charge") app.devCharge();
      else if (key === "nous") app.devNous();
      else app.devAdvance(Number(key));
    });
  });
}
