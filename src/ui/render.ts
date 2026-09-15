import { chargedFactor, computeRates, deployed, deployedGenerators, levelCost, modulePower, wholeNous } from "../engine/economy";
import { deployedAt } from "../engine/economy";
import { adjacent, sameHex } from "../engine/hex";
import { forgeThreshold } from "../engine/rolls";
import { BALANCE, CATEGORY_OF, NEXT_RARITY } from "../engine/constants";
import { formatClock, formatDuration } from "../engine/clock";
import { canWriteNotes } from "../engine/notes";
import { activeHabit } from "../engine/habits";
import { goalCapacity, goalRequiredSeconds, goalSummary } from "../engine/goals";
import { isCarrier } from "../engine/state";
import type { GameState, Goal, Hex, ModuleInstance, RateSnapshot } from "../engine/types";
import type { App, AppPanel } from "./app";
import { moduleIcon } from "./icons";
import { updateSvg } from "./svg";
import { DURATION_OPTIONS, META, RARITY_LABEL, fmt, fmtWhole } from "./meta";

const HEX_RADIUS = 61;
const SPACING = 65;
const DRAG_THRESHOLD_PX = 6;
const boundCells = new WeakSet<SVGElement>();

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
// projected build rate while arranging in upgrade mode. Module panels preview
// charge separately via computeRates(state, true).
function currentSnapshot(state: GameState): RateSnapshot {
  return computeRates(state, state.mode === "flow");
}

function stat(label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono">${value}</span></div>`;
}

function statLive(id: string, label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono" data-live="${id}">${value}</span></div>`;
}

export function render(app: App): void {
  const { state } = app;
  renderSessionToolbar(app);
  renderAccounting(app);
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

function durationOptionsHtml(app: App): string {
  return DURATION_OPTIONS.map(
    (o) => `<option value="${o.value === null ? "open" : o.value}" ${app.ui.chosenTarget === o.value ? "selected" : ""}>${o.label}</option>`,
  ).join("");
}

function bindDurationSelect(app: App, select: HTMLElement | null): void {
  select?.addEventListener("change", () => {
    const v = (select as HTMLSelectElement).value;
    app.ui.chosenTarget = v === "open" ? null : Number(v);
    app.render();
  });
}

// Focus-app access lives in the toolbar until the console arrives (ADR-0012).
const APP_BUTTONS: { key: AppPanel; label: string }[] = [
  { key: "habit", label: "Habit" },
  { key: "notes", label: "Notes" },
  { key: "goals", label: "Goals" },
];

function renderSessionToolbar(app: App): void {
  const { state } = app;
  const host = byId("session-toolbar");
  if (!host) return;

  const appButtons = () =>
    `<div class="app-buttons">${APP_BUTTONS.map(
      ({ key, label }) => `<button class="app-button ${app.ui.app === key ? "active" : ""}" id="app-${key}" aria-pressed="${app.ui.app === key}">${label}</button>`,
    ).join("")}</div>`;
  const bindAppButtons = () => {
    for (const { key } of APP_BUTTONS) {
      byId(`app-${key}`)?.addEventListener("click", () => app.openApp(key));
    }
  };

  if (state.mode === "upgrade") {
    // Structural key: only rebuild when the shape of the toolbar changes, so
    // button nodes (and in-flight clicks) survive clock ticks.
    const key = `upgrade:${app.ui.chosenTarget}:${app.ui.app ?? ""}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      host.innerHTML = `<div>
          <select id="toolbar-duration" aria-label="Session duration">${durationOptionsHtml(app)}</select>
          <p class="clock-caption">${app.ui.chosenTarget === null ? "Open-ended" : "Planned practice"}</p>
        </div>
        ${appButtons()}<div class="session-actions"><button class="primary" id="start-flow">Enter flow ↗</button></div>`;
      bindAppButtons();
      bindDurationSelect(app, byId("toolbar-duration"));
      byId("start-flow")?.addEventListener("click", () => app.startFlow());
    }
    return;
  }

  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const reached = target !== null && elapsed >= target;

  const key = `flow:${state.mode}:${target === null ? "open" : reached ? "reached" : "timed"}:${app.ui.app ?? ""}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `
      <div>
        <p class="session-clock mono" id="session-clock">${formatClock(elapsed)}</p>
        <p class="clock-caption" id="session-caption"></p>
        <div class="time-track"><span id="time-track-fill" style="width:0%"></span></div>
      </div>
      ${appButtons()}
      <div class="session-actions">
        <button id="pause-flow">${paused ? "Resume" : "Pause"}</button>
        <button class="primary" id="end-flow">End flow</button>
      </div>`;
    bindAppButtons();
    byId("pause-flow")?.addEventListener("click", () => (state.mode === "paused" ? app.resume() : app.pause()));
    byId("end-flow")?.addEventListener("click", () => app.endFlow());
  }

  // Live values update in place; the buttons above are never replaced by ticks.
  const caption = paused
    ? "Paused · progress preserved"
    : target === null
      ? "Open-ended practice"
      : reached
        ? "Target reached · continue freely"
        : `of ${formatClock(target)} planned`;
  const set = (id: string, text: string) => {
    const node = byId(id);
    if (node && node.textContent !== text) node.textContent = text;
  };
  set("session-clock", formatClock(elapsed));
  set("session-caption", caption);
  const track = byId("time-track-fill");
  const width = target ? `${Math.min(100, (elapsed / target) * 100)}%` : "0%";
  if (track && track.style.width !== width) track.style.width = width;
}

function renderAccounting(app: App): void {
  const { state } = app;
  const host = byId("accounting");
  if (!host) return;
  const rate = currentSnapshot(state).rate;
  const mode = app.managing ? "ARRANGING" : state.mode === "upgrade" ? "UPGRADE MODE" : state.mode === "paused" ? "FLOW PAUSED" : "FLOW LIVE";
  host.innerHTML = `
    <div><span class="eyebrow">Nous</span><strong id="nous-display">${fmtWhole(state.nous)}</strong></div>
    <div><span class="eyebrow">Production</span><strong>${fmt(rate)}<span class="unit"> ν/s</span></strong></div>
    <div><span class="eyebrow">Mode</span><strong style="font-size:11px;letter-spacing:.08em;padding-top:6px">${mode}</strong></div>`;
}

function renderTools(app: App): void {
  const { state, ui } = app;
  const host = byId("board-tools");
  if (!host) return;
  const upgrade = state.mode === "upgrade";
  const key = JSON.stringify([upgrade, state.bankedRolls.length, ui.managing]);
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  const forgeReady = upgrade && state.bankedRolls.length > 0;
  host.innerHTML = `
    <button class="small" id="tool-store" ${upgrade ? "" : "disabled"} title="${upgrade ? "The starter shelf: one-time offers for each category" : "Purchases happen between sessions"}">Store</button>
    <button class="small" id="tool-forge" ${forgeReady ? "" : "disabled"} title="${forgeReady ? `${state.bankedRolls.length} banked choice${state.bankedRolls.length === 1 ? "" : "s"}` : "No banked rolls — earn Forge progress from charge"}">Forge · ${state.bankedRolls.length}</button>
    <button class="small ${app.managing ? "active" : ""}" id="tool-manage" ${upgrade ? "" : "disabled"} aria-pressed="${app.managing}" title="${app.managing ? "Exit arranging (Esc)" : "Move modules"}">Grid &amp; inventory</button>`;
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
  const term = (type: ModuleInstance["type"], value: number) =>
    `<span class="formula-term" title="${META[type].name}" aria-label="${META[type].name}: ${fmt(value)}">
      <svg viewBox="-18 -18 36 36" aria-hidden="true" fill="none" stroke-width="1.6">${moduleIcon(type)}</svg>${fmt(value)}</span>`;
  const sum = (type: ModuleInstance["type"]) => {
    let total = 0;
    for (const c of snapshot.contributions.values()) if (c.type === type) total += c.value;
    return total;
  };
  host.innerHTML = `
    <div class="rate-equation">
      ${term("carrier", sum("carrier"))}
      <span class="op">+</span>${term("additive", sum("additive"))}
      <span class="op">+</span>${term("conditional", sum("conditional"))}
      <span class="op">=</span><strong>${fmt(snapshot.rate)} ν/s</strong>
    </div>`;
}

/* ── Hex grid ──────────────────────────────────────── */

function renderGrid(app: App): void {
  const { state, ui } = app;
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg) return;
  const upgrade = state.mode === "upgrade";
  const showFrontier = upgrade && ui.reshape !== null;
  const frontier = showFrontier ? app.frontierCells() : [];
  const allCells = [...state.cells, ...frontier];
  const coords = allCells.map(point);
  const minX = Math.min(...coords.map((p) => p[0])) - 78;
  const maxX = Math.max(...coords.map((p) => p[0])) + 78;
  const minY = Math.min(...coords.map((p) => p[1])) - 82;
  const maxY = Math.max(...coords.map((p) => p[1])) + 82;
  svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);

  const flow = state.mode === "flow";
  const generators = deployedGenerators(state);
  const emitting = flow && generators.length > 0;
  const snapshot = currentSnapshot(state);
  const selectedModule = state.modules.find((m) => m.id === ui.selected) ?? null;

  let html = "";

  // Charge leads: live during flow, previewed around the selected module.
  if (emitting) {
    for (const module of deployed(state)) {
      if (isSource(module) || module.pos === null) continue;
      if ((snapshot.chargeStrength.get(module.id) ?? 0) <= 0) continue;
      for (const generator of generators) {
        if (generator.pos === null || !adjacent(generator.pos, module.pos)) continue;
        const [x1, y1] = point(generator.pos);
        const [x2, y2] = point(module.pos);
        html += `<line data-key="charge-${generator.id}-${module.id}" class="charge-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }
    }
  } else if (upgrade && selectedModule) {
    if (isSource(selectedModule) && selectedModule.pos) {
      for (const module of deployed(state)) {
        if (module.id === selectedModule.id || isSource(module) || module.pos === null) continue;
        if (!adjacent(selectedModule.pos, module.pos)) continue;
        const [x1, y1] = point(selectedModule.pos);
        const [x2, y2] = point(module.pos);
        html += `<line data-key="charge-${selectedModule.id}-${module.id}" class="charge-preview-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }
    } else if (selectedModule.pos) {
      for (const generator of generators) {
        if (generator.pos === null || !adjacent(generator.pos, selectedModule.pos)) continue;
        const [x1, y1] = point(generator.pos);
        const [x2, y2] = point(selectedModule.pos);
        html += `<line data-key="charge-${generator.id}-${selectedModule.id}" class="charge-preview-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }
    }
  }

  for (const pos of state.cells) {
    const [x, y] = point(pos);
    const module = deployedAt(state, pos);
    const isRemoval = ui.reshape?.removes.some((c) => sameHex(c, pos)) ?? false;
    let classes = "hex empty";
    if (isRemoval) classes += " remove-stage";
    if (!module && isTargetCell(app, pos)) classes += " target";
    html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${module ? META[module.type].name : "Empty cell"}">
      ${module ? "" : `<polygon class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>`}`;
    if (module) {
      html += moduleNode(app, module, pos, { dispensing: emitting, snapshot, selectedModule });
    } else {
      html += `<path class="empty-plus" d="M-7-6H7M0-13V1"/><text y="24" text-anchor="middle" class="hex-sub">EMPTY CELL</text>`;
    }
    html += `</g>`;
  }

  if (showFrontier) {
    for (const pos of frontier) {
      const [x, y] = point(pos);
      const isAdd = ui.reshape?.adds.some((c) => sameHex(c, pos)) ?? false;
      html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Expand here">
        <polygon class="hex ${isAdd ? "target" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
        ${isAdd ? `<text y="5" text-anchor="middle" fill="var(--accent)" font-size="20">+</text>` : ""}
      </g>`;
    }
  }

  updateSvg(svg, html);
  bindGridEvents(app, svg);
}

// Generators are the sole charge source category (ADR-0012).
const isSource = (m: ModuleInstance) => CATEGORY_OF[m.type] === "generator";
interface RenderContext {
  dispensing: boolean;
  snapshot: ReturnType<typeof computeRates>;
  selectedModule: ModuleInstance | null;
}

function moduleNode(app: App, module: ModuleInstance, _pos: Hex, ctx: RenderContext): string {
  const { ui } = app;
  const selected = ui.selected === module.id;
  const charged = ctx.dispensing && (ctx.snapshot.chargeStrength.get(module.id) ?? 0) > 0;
  const emittingNow = ctx.dispensing && isSource(module);
  const contribution = ctx.snapshot.contributions.get(module.id);

  let classes = "hex";
  if (selected) classes += " selected";
  if (charged) classes += " charged";
  if (emittingNow) classes += " dispensing";

  // Highlight eligible receivers while a generator is selected in upgrade mode.
  let highlight = "";
  if (app.state.mode === "upgrade" && ctx.selectedModule && isSource(ctx.selectedModule) && module.id !== ctx.selectedModule.id && module.pos && ctx.selectedModule.pos && adjacent(module.pos, ctx.selectedModule.pos)) {
    highlight = `<polygon data-key="preview" class="highlight-ring" points="${hexPoints(HEX_RADIUS - 4)}"/>`;
  }

  // Water-fill: threshold progress rises inside the hexagon like liquid.
  let fill = "";
  if (module.type === "forge") {
    fill = waterFill(module.id, app.state.forge.progress / forgeThreshold(app.state.forge.earned));
  }

  let sub = "";
  if (module.type === "forge") {
    sub = `${fmt(Math.max(0, app.state.forge.progress), 0)}/${fmt(forgeThreshold(app.state.forge.earned), 0)}`;
  } else if (isSource(module)) {
    sub = `⌁${fmt(modulePower(module), 2)}`;
  } else if (module.type === "infusor") {
    sub = `+${fmt(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(ctx.snapshot.chargeStrength.get(module.id) ?? 0), 0)}%`;
  } else {
    sub = `+${fmt(contribution?.value ?? 0)} ν/s`;
  }

  const name = META[module.type].short;
  const levelTag = ` ${module.level}`;
  // The Carrier wears a pin: it is immovable and unsellable (§2.1).
  const pinned = isCarrier(module);
  const pin = pinned
    ? `<title>The Carrier — granted at the origin. Pinned: it never moves and never leaves the board.</title><g data-key="pin" class="module-pin" transform="translate(36,-33)"><circle cx="0" cy="-3.4" r="3.1"/><path d="M0-.4v7.4"/></g>`
    : "";

  return `<g class="module-node" data-rarity="${module.rarity}">${pin}
    <polygon data-key="hex" class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>${fill}${highlight}
    <g data-key="icon" transform="translate(0,-13)" class="hex-icon" fill="none" stroke-width="1.6">${moduleIcon(module.type)}</g>
    <text data-key="name" y="17" text-anchor="middle" class="hex-name">${name}${levelTag}</text>
    <text data-key="value" y="34" text-anchor="middle" class="hex-sub">${sub}</text>
    </g>`;
}

const FILL_INSET = 3;

function waterFill(moduleId: string, progress: number): string {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = HEX_RADIUS - FILL_INSET;
  const height = 2 * radius * clamped;
  const y = radius - height;
  const clipId = `water-${moduleId}`;
  return `<clipPath id="${clipId}"><polygon points="${hexPoints(radius)}"/></clipPath>
    <rect data-key="fill" clip-path="url(#${clipId})" class="water-fill" x="${-radius}" y="${y}" width="${2 * radius}" height="${height}"/>`;
}

function isTargetCell(app: App, pos: Hex): boolean {
  const { ui, state } = app;
  if (state.mode !== "upgrade") return false;
  if (ui.reshape) return false;
  if (ui.placing) {
    const module = state.modules.find((m) => m.id === ui.placing);
    if (!module) return false;
    const occupant = deployedAt(state, pos);
    return !occupant || !isCarrier(occupant);
  }
  return false;
}

function bindGridEvents(app: App, svg: SVGSVGElement): void {
  svg.querySelectorAll<SVGElement>("[data-cell]").forEach((node) => {
    if (boundCells.has(node)) return;
    boundCells.add(node);
    const position = () => {
      const [q, r] = node.getAttribute("data-cell")!.split(",").map(Number);
      return { q: q!, r: r! };
    };
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        app.pickCell(position());
      }
    });
    node.addEventListener("click", () => app.pickCell(position()));
    node.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      app.rightClickCell(position());
    });
    bindPointerDrag(app, node, () => deployedAt(app.state, position())?.id ?? null);
  });
}

// Shared pointer-drag binding for grid modules and inventory items: shows a
// ghost after a small threshold, then drops onto a cell (place, swap, or
// combine with a matching twin) or the inventory zone (return). Click-
// placement stays available without dragging.
function bindPointerDrag(app: App, element: Element, moduleId: string | (() => string | null)): void {
  element.addEventListener("pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || !app.ui.managing || app.state.mode !== "upgrade" || app.ui.reshape) return;
    const id = typeof moduleId === "function" ? moduleId() : moduleId;
    if (!id) return;
    const dragModule = app.state.modules.find((m) => m.id === id) ?? null;
    if (dragModule && isCarrier(dragModule)) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let ghost: HTMLDivElement | null = null;
    let hoverTarget: Element | null = null;
    const zone = document.getElementById("inventory-zone");
    const canCombineWith = (occupant: { id: string; type: string; rarity: string } | undefined): boolean =>
      !!dragModule &&
      !!occupant &&
      occupant.id !== dragModule.id &&
      occupant.type === dragModule.type &&
      occupant.rarity === dragModule.rarity &&
      NEXT_RARITY[dragModule.rarity] !== null;

    const setHoverTarget = (ev: PointerEvent) => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellNode = hit?.closest("[data-cell]") ?? null;
      if (cellNode !== hoverTarget) {
        hoverTarget?.querySelector(".hex")?.classList.remove("drop-target", "combine-target");
        hoverTarget = cellNode;
        const [q, r] = (hoverTarget?.getAttribute("data-cell") ?? "").split(",").map(Number);
        const occupant =
          hoverTarget && Number.isFinite(q) && Number.isFinite(r)
            ? app.state.modules.find((m) => m.pos !== null && m.pos.q === q && m.pos.r === r)
            : undefined;
        hoverTarget
          ?.querySelector(".hex")
          ?.classList.add(canCombineWith(occupant) ? "combine-target" : "drop-target");
      }
      const overZone = !!hit?.closest("#inventory-zone");
      zone?.classList.toggle("drag-over", overZone);
    };

    const suppressNextClick = () => {
      const suppress = (clickEvent: Event) => {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
      };
      document.addEventListener("click", suppress, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", suppress, true), 0);
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD_PX) {
        moved = true;
        const module = app.state.modules.find((m) => m.id === id);
        // The ghost is the module's own hex tile — what you carry is what you
        // drop — centered under the cursor.
        ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        if (module) ghost.dataset.rarity = module.rarity;
        ghost.innerHTML = module
          ? hexTileSvg(module)
          : `<svg viewBox="-75 -75 150 150" aria-hidden="true"><polygon class="hex" points="${hexPoints(HEX_RADIUS)}"/></svg>`;
        document.body.append(ghost);
        element.classList.add("dragging");
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        setHoverTarget(ev);
      }
    };
    const finish = (ev: PointerEvent, apply: boolean) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      ghost?.remove();
      element.classList.remove("dragging");
      hoverTarget?.querySelector(".hex")?.classList.remove("drop-target", "combine-target");
      hoverTarget = null;
      zone?.classList.remove("drag-over");
      if (!apply || !moved) return;
      suppressNextClick();
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellNode = target?.closest("[data-cell]");
      if (target?.closest("#inventory-zone")) {
        app.returnToInventory(id);
      } else if (cellNode) {
        const cell = cellNode.getAttribute("data-cell")!.split(",").map(Number);
        const pos = { q: cell[0]!, r: cell[1]! };
        const occupant = deployedAt(app.state, pos);
        if (canCombineWith(occupant)) app.dropCombine(id, occupant!.id, pos);
        else app.pickCellThenPlace(id, pos);
      }
    };
    const up = (ev: PointerEvent) => finish(ev, true);
    const cancel = () => finish(new PointerEvent("pointerup"), false);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
  });
}

/* ── Inspector ─────────────────────────────────────── */

function renderInspector(app: App): void {
  const host = byId("inspector");
  if (!host) return;
  const { state, ui } = app;
  const module = state.modules.find((m) => m.id === ui.selected);
  // Rebuild only when the panel's structure changes; per-tick values update
  // in place below so buttons and scroll position survive flow ticks.
  const key = JSON.stringify([
    state.mode,
    ui.managing,
    ui.selected,
    ui.app,
    ui.placing,
    ui.reshape,
    state.bankedRolls.length,
    state.notes.length,
    state.habits.map((h) => `${h.archived ? "·" : ""}${h.name}`).join("|"),
    state.activeHabitId,
    app.ui.editingHabitId,
    state.goals.length,
    state.goals.map((g) => (g.completed ? "1" : "0") + g.condition.minutes + (g.condition.habitId ?? "") + g.schedule.kind).join("|"),
    module?.level ?? null,
    module?.rarity ?? null,
    // Module moves (drag, place, return, combine) must refresh the manage
    // panel's hex inventory even when the selection itself never changes.
    state.modules.map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}:${m.pos ? `${m.pos.q},${m.pos.r}` : "-"}`).join("|"),
  ]);
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    // A newly captured note keeps the panel scrolled where the player is.
    const keepScroll = ui.app === "notes" && state.mode !== "upgrade";
    const scrollTop = host.scrollTop;
    if (ui.managing && state.mode === "upgrade") {
      renderManagePanel(app, host);
    } else if (module) {
      renderModulePanel(app, host, module);
    } else if (ui.app) {
      renderAppPanel(app, host, ui.app);
    } else {
      renderOverview(app, host);
    }
    if (keepScroll) host.scrollTop = scrollTop;
  }
  updateInspectorLive(app, host);
}

// Values that move during flow without rebuilding the panel.
function updateInspectorLive(app: App, host: HTMLElement): void {
  const { state } = app;
  const set = (id: string, text: string) => {
    const node = host.querySelector(`[data-live="${id}"]`);
    if (node && node.textContent !== text) node.textContent = text;
  };
  set("habit-session", `${formatClock(state.session?.elapsed ?? 0)} of practice`);
  for (const habit of state.habits) {
    const node = host.querySelector(`[data-habit-seconds="${habit.id}"]`);
    const display = formatDuration(habit.seconds);
    if (node && node.textContent !== display) node.textContent = display;
  }
  const habitDev = host.querySelector('[data-live="habit-development"]');
  const active = activeHabit(state);
  if (habitDev && active) {
    const display = formatDuration(active.seconds);
    if (habitDev.textContent !== display) habitDev.textContent = display;
  }
  for (const goal of state.goals) {
    const required = goalRequiredSeconds(goal);
    const bar = host.querySelector(`[data-goal-progress="${goal.id}"]`) as HTMLElement | null;
    const width = `${Math.min(100, (goal.progressSeconds / required) * 100)}%`;
    if (bar && bar.style.width !== width) bar.style.width = width;
    const minutes = host.querySelector(`[data-goal-minutes="${goal.id}"]`);
    const display = `${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · earned ×${goal.completedCount}` : ""}`;
    if (minutes && minutes.textContent !== display) minutes.textContent = display;
  }
  set("forge", `${fmt(Math.max(0, state.forge.progress), 1)} / ${fmt(forgeThreshold(state.forge.earned), 1)}`);
  set("rolls", String(state.bankedRolls.length));
  set("elapsed", state.session ? formatClock(state.session.elapsed) : "—");
  const forgeBar = host.querySelector('[data-live="forge-bar"]') as HTMLProgressElement | null;
  if (forgeBar) forgeBar.value = Math.min(1, Math.max(0, state.forge.progress / forgeThreshold(state.forge.earned)));
}

function forgeMeter(state: GameState): string {
  return `<div class="overview-meter" title="All deployed Forges feed one shared meter · ${state.forge.earned} earned">${statLive("forge", "Next Forge roll", `${fmt(Math.max(0, state.forge.progress), 1)} / ${fmt(forgeThreshold(state.forge.earned), 1)}`)}
    <progress data-live="forge-bar" aria-label="Next Forge roll" value="${Math.min(1, Math.max(0, state.forge.progress / forgeThreshold(state.forge.earned)))}" max="1"></progress></div>`;
}

function renderOverview(app: App, host: HTMLElement): void {
  const { state } = app;
  const deployedModules = deployed(state);
  host.innerHTML = `
    <div class="grid-overview">
      <div class="eyebrow">GRID OVERVIEW</div>
      <h2>Charge &amp; progress</h2>
      ${forgeMeter(state)}
      <div class="divider"></div>
      ${statLive("rolls", "Banked Forge choices", String(state.bankedRolls.length))}
      ${stat("Deployed modules", String(deployedModules.length))}
      ${stat("Empty grid cells", String(state.cells.length - deployedModules.length))}
      ${stat("Modules in inventory", String(state.modules.length - deployedModules.length))}
      ${stat("Sessions completed", String(state.sessionsCompleted))}
      ${stat("Total nous earned", fmt(state.totalEarned, 1))}
      <p class="small muted" style="margin-top:16px">${
        state.mode === "flow"
          ? "Rewards bank automatically. Nothing here needs your attention during practice."
          : state.mode === "paused"
            ? "Production is frozen while paused."
            : "Select a module to inspect or tune it. Store, Forge, and Grid & inventory manage the build."
      }</p>
      <section class="overview-formula">
        <h3>Nous / second</h3>
        <p>Carrier + harmonic terms, each scaled by level, rarity, adjacent infusors, and charge empowerment.</p>
        <p>Generators produce charge during flow: adjacent synthesizers and infusors are empowered continuously; the Forge banks the charge toward its next roll.</p>
        <p>Charge factor = 1 + strength / (1 + strength). Rarity growth per level: common ×1.2 · uncommon ×1.25 · rare ×1.3.</p>
      </section>
    </div>`;
}

function effectDescription(module: ModuleInstance): string {
  switch (module.type) {
    case "carrier":
      return "The granted origin synthesizer. Pinned at the origin: it never moves, never combines, never leaves the board, and plays the formula's carrier term.";
    case "additive":
      return "A plain harmonic term: adds production to the shared composite.";
    case "conditional":
      return "A harmonic term whose chord behavior deepens as the formula grows. For now it adds its term like Additive.";
    case "generator":
      return "Produces charge during flow. Adjacent synthesizers and infusors are empowered continuously; the Forge banks charge toward its next roll.";
    case "focusKeyed":
      return "A generator keyed to your focus: its charge window rule arrives with the charge rework. Until then it produces like a basic generator.";
    case "infusor":
      return "Boosts production contributions of adjacent modules. Receives charge as continuous empowerment.";
    case "forge":
      return "The chargeable launch module: banks received charge toward a threshold and mints a roll at each crossing.";
    default:
      return "A reserved module.";
  }
}

function nominalEffect(module: ModuleInstance, charged: boolean): { text: string; value: number } {
  const power = modulePower(module);
  const factor = charged ? chargedFactor(1) : 1;
  switch (module.type) {
    case "carrier":
      return { text: `+${fmt(BALANCE.carrierRate * power * factor)} ν/s`, value: BALANCE.carrierRate * power * factor };
    case "additive":
      return { text: `+${fmt(BALANCE.additiveRate * power * factor)} ν/s`, value: BALANCE.additiveRate * power * factor };
    case "conditional":
      return { text: `+${fmt(BALANCE.conditionalRate * power * factor)} ν/s`, value: BALANCE.conditionalRate * power * factor };
    case "generator":
    case "focusKeyed":
      return { text: `${fmt(power, 3)} charge strength while flowing`, value: power };
    case "infusor":
      return { text: `+${fmt(100 * BALANCE.infusorBonus * power * factor)}% to adjacent`, value: BALANCE.infusorBonus * power * factor };
    case "forge":
      return { text: `${fmt(power)} progress/s at strength 1`, value: power };
    default:
      return { text: "—", value: 0 };
  }
}

function renderModulePanel(app: App, host: HTMLElement, module: ModuleInstance): void {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  const meta = META[module.type];
  const preview = computeRates(state, true);
  const contribution = module.pos !== null ? preview.contributions.get(module.id) : null;
  const deployedHere = module.pos !== null;
  const chargeStrength = preview.chargeStrength.get(module.id) ?? 0;
  const effect =
    deployedHere && contribution && contribution.value !== 0
      ? { text: effectTextFor(module, contribution.value, chargeStrength), value: contribution.value }
      : nominalEffect(module, upgrade);
  const growth = BALANCE.rarityPower[module.rarity];
  const cost = levelCost(module.level);
  const affordable = wholeNous(state) >= cost;
  const partner = state.modules.find((m) => m.id !== module.id && m.type === module.type && m.rarity === module.rarity);
  const carrier = isCarrier(module);

  const focus = `<section class="focus-controls">
    <span class="eyebrow">${upgrade ? "NEXT SESSION PREVIEW" : "LIVE GRID"}</span>
    ${statLive("elapsed", "Session", state.session ? formatClock(state.session.elapsed) : "—")}
  </section>`;

  let chargeStats = "";
  if (module.type === "forge") {
    chargeStats = `
      ${statLive("forge", "Shared progress", `${fmt(Math.max(0, state.forge.progress), 1)} / ${fmt(forgeThreshold(state.forge.earned), 1)}`)}
      ${stat("Rolls earned", String(state.forge.earned))}
      ${stat("Charge source", deployedHere && chargeStrength > 0 ? "adjacent generator" : "no adjacent generator")}
      ${stat("Progress rate", `${fmt(contribution?.value ?? 0, 2)} /s while charged`)}`;
  } else if (isSource(module)) {
    chargeStats = `
      ${stat("Output strength", `${fmt(modulePower(module), 3)} per second of flow`)}
      ${stat("Receivers", deployedHere ? String(deployed(state).filter((m) => m.id !== module.id && m.pos !== null && module.pos !== null && adjacent(m.pos, module.pos)).length) : "—")}`;
  } else if (module.type === "infusor") {
    chargeStats = `
      ${stat("Bonus to adjacent", `+${fmt(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(chargeStrength), 1)}%`)}
      ${stat("Charge", chargeStrength > 0 ? `strength ${fmt(chargeStrength, 2)}` : "none")}`;
  } else {
    chargeStats = `
      ${stat("Charge", chargeStrength > 0 ? `strength ${fmt(chargeStrength, 2)} (×${fmt(chargedFactor(chargeStrength), 3)})` : "none")}`;
  }

  host.innerHTML = `
    <div class="module-heading">
      <button class="quiet small" id="back-overview">← Grid overview</button>
      <h1>${meta.name}</h1>
      <span class="rarity-chip ${module.rarity}">${RARITY_LABEL[module.rarity]}${carrier ? " · pinned" : ""}</span>
    </div>
    ${focus}
    <section>
      <div class="eyebrow">MODULE POWER</div>
      <div class="level-heading">Level <strong>${module.level}</strong><span class="level-effect">${effect.text}</span></div>
      <p class="small muted" style="margin:6px 0 0">${effectDescription(module)}</p>
      <button class="primary upgrade-cta" id="upgrade-module" ${upgrade && affordable ? "" : "disabled"}>
        <span>Upgrade
          <small class="upgrade-gain">+${fmt((growth - 1) * 100, 1)}% → ${nominalGainText(module)}</small>
        </span>
        <strong>${cost} ν</strong>
      </button>
      ${!upgrade ? `<p class="small muted">Upgrades happen between sessions.</p>` : ""}
      ${carrier ? `<p class="small muted">The Carrier is pinned: it upgrades in place and cannot be moved, combined, or shelved.</p>` : ""}
      ${upgrade && !carrier && partner && module.rarity !== "rare"
        ? `<button id="combine-pair">Combine with its ${RARITY_LABEL[module.rarity]} pair</button>`
        : ""}
    </section>
    <section>
      <div class="eyebrow">${upgrade ? "NEXT SESSION PREVIEW" : "LIVE GRID"}</div>
      ${stat("Position", module.pos ? `${module.pos.q}, ${module.pos.r}` : "inventory")}
      ${chargeStats}
    </section>`;

  byId("back-overview")?.addEventListener("click", () => app.select(null));
  byId("upgrade-module")?.addEventListener("click", () => app.upgrade(module.id));
  byId("combine-pair")?.addEventListener("click", () => app.combinePair(module.id));
}

/* ── Focus-app panels ──────────────────────────────── */

function renderAppPanel(app: App, host: HTMLElement, panel: AppPanel): void {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  let inner = "";

  if (panel === "habit") {
    const active = activeHabit(state);
    const live = !upgrade;
    const habits = state.habits.filter((h) => !h.archived);
    const rows = habits.map((habit) => {
      const editing = app.ui.editingHabitId === habit.id;
      return `<div class="habit-row ${state.activeHabitId === habit.id ? "selected" : ""}" data-habit="${habit.id}">
        ${editing
          ? `<input type="text" class="habit-rename-input" id="habit-rename-input" value="${escapeHtml(habit.name)}" maxlength="40" />
             <button class="primary small" id="habit-rename-save">Save</button>`
          : `<button class="habit-pick" data-pick="${habit.id}" title="Make this the active habit">
               <span class="habit-dot" aria-hidden="true"></span>
               <span class="habit-name">${escapeHtml(habit.name)}</span>
               <small class="mono" data-habit-seconds="${habit.id}">${formatDuration(habit.seconds)}</small>
             </button>
              <button class="quiet small" data-rename="${habit.id}" title="Rename">✎</button>
              <button class="quiet small icon-btn" data-archive="${habit.id}" title="Archive (keeps its development)">
                <svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M-7-6h14v3H-7Z"/><path d="M-5-3v8h10v-8"/><path d="M0 0v4"/><path d="m-2 2 2 2 2-2"/></svg>
              </button>`}
      </div>`;
    }).join("");
    if (live) {
      inner = `<section class="focus-controls">
        <span class="eyebrow">FOCUS CONTROLS</span>
        <p class="habit-active-name">${active ? escapeHtml(active.name) : "Unstructured practice"}</p>
        <p class="small muted" style="margin-top:4px">${active ? "Locked for this session — selected before entering flow." : "No habit selected; the session still counts as practice."}</p>
        ${active ? statLive("habit-session", "This session", `${formatClock(state.session?.elapsed ?? 0)} of practice`) : ""}
      </section>`;
    } else {
      inner = `<section class="focus-controls">
        <span class="eyebrow">FOCUS CONTROLS</span>
        <div class="habit-create">
          <input type="text" id="habit-name-input" placeholder="New habit (piano, cooking…)" maxlength="40" />
          <button class="primary small" id="habit-create">Add</button>
        </div>
        <div class="habit-list">
          ${rows || `<p class="empty-copy">No habits yet. Name what you practice.</p>`}
        </div>
        ${state.activeHabitId
          ? `<div class="habit-log">
              <label class="config-label" for="habit-log-minutes">Log practice for ${escapeHtml(active?.name ?? "")} manually</label>
              <div class="habit-create">
                <input type="number" id="habit-log-minutes" min="1" placeholder="minutes" />
                <button class="small" id="habit-log-add">Log</button>
              </div>
              <p class="small muted">Manual logs grow development and later count toward goals — they never produce nous or charge.</p>
            </div>`
          : `<p class="small muted">Select a habit to log practice manually; selection is locked during flow.</p>`}
      </section>`;
    }
  } else if (panel === "notes") {
    const recent = [...state.notes].slice(-8).reverse();
    const capture = canWriteNotes(state);
    inner = `<section class="focus-controls">
      <span class="eyebrow">FOCUS CONTROLS</span>
      ${capture
        ? `<textarea class="note-composer" id="note-composer" placeholder="What are you noticing?" maxlength="2000" rows="3"></textarea>
           <div class="session-actions" style="margin:10px 0 0"><button class="primary" id="note-save">Capture note</button></div>`
        : `<p class="small muted">Note capture happens during flow.</p>`}
      ${recent.length > 0 ? `<div class="note-list">${recent.map((n) => `<div class="note-entry"><span class="note-when mono">S${n.sessionId} · ${formatClock(n.atElapsed)}</span><p>${escapeHtml(n.text)}</p></div>`).join("")}</div>` : ""}
    </section>`;
  } else {
    const capacity = goalCapacity(state);
    const habitOptions = [`<option value="">Any habit</option>`]
      .concat(state.habits.filter((h) => !h.archived).map((h) => `<option value="${h.id}">${escapeHtml(h.name)}</option>`))
      .join("");
    const goalRow = (goal: Goal) => {
      const required = goalRequiredSeconds(goal);
      const fraction = Math.min(1, goal.progressSeconds / required);
      const status = goal.completed
        ? `<span class="goal-status done">complete${goal.schedule.kind === "once" ? "" : ` · resets ${goal.schedule.kind === "daily" ? "tomorrow" : "Monday"}`}</span>`
        : `<span class="goal-status">${formatClock(Math.max(0, required - goal.progressSeconds))} to go</span>`;
      return `<div class="goal-row ${goal.completed ? "done" : ""}" data-goal="${goal.id}">
        <div class="goal-head">
          <span class="goal-name">${escapeHtml(goalSummary(state, goal))}</span>
          ${status}
          ${upgrade ? `<button class="quiet small icon-btn" data-goal-delete="${goal.id}" title="Remove goal"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M-6-6 6 6M6-6-6 6"/></svg></button>` : ""}
        </div>
        <div class="goal-track"><span data-goal-progress="${goal.id}" style="width:${fraction * 100}%"></span></div>
        <small class="mono" data-goal-minutes="${goal.id}">${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · earned ×${goal.completedCount}` : ""}</small>
      </div>`;
    };
    inner = `<section class="focus-controls">
      <span class="eyebrow">FOCUS CONTROLS · ${state.goals.length}/${capacity} SLOTS${upgrade ? "" : " · LOCKED FOR THIS SESSION"}</span>
      ${upgrade && state.goals.length < capacity ? `
        <div class="goal-create">
          <select id="goal-habit" aria-label="Habit">${habitOptions}</select>
          <input type="number" id="goal-minutes" min="1" max="1440" placeholder="min" />
          <select id="goal-schedule" aria-label="Schedule">
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="once">once</option>
          </select>
          <button class="primary small" id="goal-add">Add</button>
        </div>` : ""}
      <div class="goal-list">
        ${state.goals.map(goalRow).join("") || `<p class="empty-copy">No goals yet. Goals track practice conditions.</p>`}
      </div>
      <p class="small muted" style="margin-top:10px">Progress counts only while a goal exists; earlier practice never counts retroactively. Manual logs count too.</p>
    </section>`;
  }

  host.innerHTML = `
    <div class="module-heading">
      <button class="quiet small" id="back-overview">← Grid overview</button>
      <h1>${panel === "habit" ? "Habit" : panel === "notes" ? "Notes" : "Goals"}</h1>
      <span class="rarity-chip common">app</span>
    </div>
    ${inner}`;

  byId("back-overview")?.addEventListener("click", () => app.closeApp());
  byId("habit-create")?.addEventListener("click", () => {
    const input = byId("habit-name-input") as HTMLInputElement | null;
    if (input) app.createHabitAction(input.value);
  });
  byId("habit-name-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      app.createHabitAction(input.value);
    }
  });
  host.querySelectorAll<HTMLElement>("[data-pick]").forEach((button) => {
    button.addEventListener("click", () => app.selectHabitAction(button.getAttribute("data-pick")));
  });
  host.querySelectorAll<HTMLElement>("[data-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      app.ui.editingHabitId = button.getAttribute("data-rename");
      app.render();
      const input = byId("habit-rename-input") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  });
  host.querySelectorAll<HTMLElement>("[data-archive]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-archive");
      if (id) app.archiveHabitAction(id);
    });
  });
  const renameInput = byId("habit-rename-input");
  renameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const id = app.ui.editingHabitId;
      if (id) app.renameHabitAction(id, (event.target as HTMLInputElement).value);
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      app.ui.editingHabitId = null;
      app.render();
    }
  });
  byId("habit-rename-save")?.addEventListener("click", () => {
    const id = app.ui.editingHabitId;
    const input = byId("habit-rename-input") as HTMLInputElement | null;
    if (id && input) app.renameHabitAction(id, input.value);
  });
  byId("habit-log-add")?.addEventListener("click", () => {
    const input = byId("habit-log-minutes") as HTMLInputElement | null;
    if (input && input.value) app.logPracticeAction(Number(input.value));
  });
  byId("goal-add")?.addEventListener("click", () => {
    const habitSelect = byId("goal-habit") as HTMLSelectElement | null;
    const minutesInput = byId("goal-minutes") as HTMLInputElement | null;
    const scheduleSelect = byId("goal-schedule") as HTMLSelectElement | null;
    if (!habitSelect || !minutesInput || !scheduleSelect || !minutesInput.value) return;
    app.createGoalAction(
      habitSelect.value === "" ? null : habitSelect.value,
      Number(minutesInput.value),
      scheduleSelect.value as "once" | "daily" | "weekly",
    );
  });
  host.querySelectorAll<HTMLElement>("[data-goal-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-goal-delete");
      if (id) app.deleteGoalAction(id);
    });
  });
  const composer = byId("note-composer") as HTMLTextAreaElement | null;
  const saveNote = () => {
    if (!composer) return;
    app.addNote(composer.value);
    // A successful save rebuilds the panel with a fresh composer; refocus it.
    const fresh = byId("note-composer") as HTMLTextAreaElement | null;
    if (fresh) fresh.focus();
  };
  byId("note-save")?.addEventListener("click", saveNote);
  composer?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      saveNote();
    }
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function effectTextFor(module: ModuleInstance, value: number, strength = 0): string {
  switch (module.type) {
    case "carrier":
    case "additive":
    case "conditional":
      return `+${fmt(value)} ν/s`;
    case "generator":
    case "focusKeyed":
      return `${fmt(modulePower(module), 2)} strength`;
    case "infusor":
      return `+${fmt(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(strength), 1)}% to adjacent`;
    default:
      return `${fmt(value, 2)} progress/s`;
  }
}

function nominalGainText(module: ModuleInstance): string {
  const now = nominalEffect(module, false);
  const growth = BALANCE.rarityPower[module.rarity];
  if (isSource(module)) {
    return `+${fmt(now.value * (growth - 1), 3)} strength`;
  }
  if (module.type === "forge") {
    return `${fmt(now.value * (growth - 1), 3)} progress/s`;
  }
  return `+${fmt(now.value * (growth - 1), 4)} effect`;
}

/* ── Grid & inventory panel ────────────────────────── */

// A canvas-style hex tile — icon, name, level, rarity accent — shared by the
// inventory grid and the live drag ghost so a carried tile looks identical to
// the one waiting in inventory (candidate-tile pattern from the Forge).
function hexTileSvg(module: ModuleInstance): string {
  return `<svg viewBox="-75 -75 150 150" aria-hidden="true">
    <polygon class="hex" points="${hexPoints(HEX_RADIUS)}"/>
    <g transform="translate(0,-16)" class="hex-icon" fill="none" stroke-width="2.2">${moduleIcon(module.type)}</g>
    <text y="24" text-anchor="middle" class="hex-name">${META[module.type].short}</text>
    <text y="-46" text-anchor="middle" class="hex-level">Lv ${module.level}</text>
    <text y="44" text-anchor="middle" class="hex-sub">${RARITY_LABEL[module.rarity]}</text>
  </svg>`;
}

function renderManagePanel(app: App, host: HTMLElement): void {
  const { state, ui } = app;
  const inventory = state.modules.filter((m) => m.pos === null);
  const reshaping = ui.reshape !== null;
  const validity = reshaping ? app.reshapeValidity() : null;
  host.innerHTML = `
    <div class="detail-head">
      <h1>Grid &amp; inventory</h1>
      <button class="primary small" id="manage-done">Done</button>
    </div>
    <p class="small muted">${
      reshaping
        ? "Reshaping: click empty cells to remove and frontier outlines to add; they must balance."
        : ui.placing
          ? "Choose a destination cell. Occupied modules swap."
          : "Tiles are raised and movable. Drag them between cells or into the inventory; drop one onto a matching twin to combine. The Carrier stays pinned."
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
        : `<button id="reshape-start">Reshape board</button>`}
    </div>
    <section class="inventory-drop" id="inventory-zone">
      <h3>Inventory</h3>
      <p class="small muted">Drop a raised tile here to store its module, or click one to place it.</p>
      <div class="inventory-hexes" id="inventory-list">
        ${inventory.map((m) => {
          return `<button class="inventory-tile" data-inv="${m.id}" data-rarity="${m.rarity}" title="${META[m.type].name} · ${RARITY_LABEL[m.rarity]}">
            ${hexTileSvg(m)}
          </button>`;
        }).join("") || `<p class="empty-copy">Inventory is empty. Drag a tile here to store it.</p>`}
      </div>
    </section>`;

  byId("manage-done")?.addEventListener("click", () => app.stopManaging());
  byId("reshape-start")?.addEventListener("click", () => app.startReshape());
  byId("reshape-apply")?.addEventListener("click", () => app.applyReshape());
  byId("reshape-cancel")?.addEventListener("click", () => app.cancelReshape());
  host.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach((button) => {
    const id = button.getAttribute("data-inv")!;
    button.addEventListener("click", () => app.beginPlacing(id));
    bindPointerDrag(app, button, id);
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
    delete content.dataset.renderKey;
    return;
  }
  const extra =
    kind === "forge"
      ? app.state.bankedRolls.at(-1)?.id ?? null
      : kind === "store"
        ? [app.ui.showAcquired, wholeNous(app.state), JSON.stringify(app.state.purchased)]
        : null;
  const renderKey = JSON.stringify([kind, app.ui.importError, app.state.pendingGap, extra]);
  // Clock ticks must not replace a save textarea or steal dialog focus.
  if (!backdrop.hidden && content.dataset.renderKey === renderKey) return;
  backdrop.hidden = false;
  content.dataset.renderKey = renderKey;
  if (kind === "settings") renderSettingsModal(app, content);
  else if (kind === "store") renderStoreModal(app, content);
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

function renderSettingsModal(app: App, content: HTMLElement): void {
  content.innerHTML = `${modalTop("PREFERENCES")}<h2 id="modal-title">Settings</h2>
    <p class="lead">Progress saves automatically on this device.</p>
    <div class="modal-actions"><button id="settings-export">Export save</button><button id="settings-import">Import save</button><button id="settings-reset">Reset progress</button></div>`;
  for (const kind of ["export", "import", "reset"] as const) {
    byId(`settings-${kind}`)?.addEventListener("click", () => app.openModal(kind));
  }
  wireClose(app);
}

function renderStoreModal(app: App, content: HTMLElement): void {
  const { state, ui } = app;
  const shelfTypes = Object.keys(BALANCE.shelfPrices) as (keyof typeof BALANCE.shelfPrices)[];

  // One-time shelf offers on top; acquired items demote below the checkbox.
  const openShelf = shelfTypes.filter((type) => !state.purchased[type]);
  const ownedShelf = shelfTypes.filter((type) => state.purchased[type]);

  content.innerHTML = `
    ${modalTop("STORE")}
    <h2 id="modal-title">Shape what comes next.</h2>
    <p class="lead">The starter shelf: one offer per category, once each. ${fmtWhole(state.nous)} ν available.</p>
    ${openShelf.length > 0 ? `
      <h3 class="store-section-title">Starter shelf</h3>
      <div class="shop-list">${openShelf.map((type) => {
        const price = BALANCE.shelfPrices[type];
        const affordable = wholeNous(state) >= price;
        return `<div class="shop-item">
          <div><h3>${META[type].name}</h3><small>${META[type].role}</small></div>
          <button class="primary" data-buy="${type}" ${affordable ? "" : "disabled"}>${price} ν</button>
        </div>`;
      }).join("")}</div>` : ""}
    ${openShelf.length === 0 ? `<p class="empty-copy">The shelf is empty. New modules come from the Forge.</p>` : ""}
    <label class="store-toggle"><input type="checkbox" id="store-show-acquired" ${ui.showAcquired ? "checked" : ""}/> Show acquired (${ownedShelf.length}/${shelfTypes.length})</label>
    ${ui.showAcquired && ownedShelf.length > 0 ? `
      <h3 class="store-section-title">Acquired</h3>
      <div class="shop-list store-owned">
        ${ownedShelf.map((type) => `<div class="shop-item owned"><div><h3>${META[type].name}</h3><small>${META[type].role}</small></div><span class="activation-owned mono">Acquired</span></div>`).join("")}
      </div>` : ""}
    <p class="modal-note">Shelf offers are one-time. Copies from Forge rolls do not remove these offers — they can become combination material.</p>`;
  content.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) => {
    button.addEventListener("click", () => {
      app.buyShelf(button.getAttribute("data-buy") as keyof typeof BALANCE.shelfPrices);
    });
  });
  byId("store-show-acquired")?.addEventListener("change", (event) => {
    app.ui.showAcquired = (event.target as HTMLInputElement).checked;
    app.render();
  });
  wireClose(app);
}

function forgeEffect(type: ModuleInstance["type"], state: GameState): string {
  const charged = chargedFactor(1);
  switch (type) {
    case "carrier": return `The granted origin module — never rolled<br>+${fmt(BALANCE.carrierRate * charged)} ν/s at charge strength 1`;
    case "additive": return `+${fmt(BALANCE.additiveRate)} ν/s harmonic term<br>+${fmt(BALANCE.additiveRate * charged)} ν/s at charge strength 1`;
    case "conditional": return `+${fmt(BALANCE.conditionalRate)} ν/s harmonic term<br>+${fmt(BALANCE.conditionalRate * charged)} ν/s at charge strength 1`;
    case "generator": return `${fmt(1, 0)} charge strength per second of flow<br>empowers adjacent modules continuously`;
    case "focusKeyed": return `A generator keyed to your focus<br>charge-window rule arrives with the charge rework`;
    case "infusor": return `+${fmt(BALANCE.infusorBonus * 100)}% to adjacent production contributions<br>+${fmt(BALANCE.infusorBonus * charged * 100)}% at charge strength 1`;
    case "forge": return `1 Forge progress per received charge strength<br>Next roll: ${fmt(forgeThreshold(state.forge.earned))} progress`;
    default: return "Not yet active";
  }
}

function candidateHeadline(type: ModuleInstance["type"]): string {
  switch (type) {
    case "carrier":
      return `+${fmt(BALANCE.carrierRate)} ν/s`;
    case "additive":
      return `+${fmt(BALANCE.additiveRate)} ν/s`;
    case "conditional":
      return `+${fmt(BALANCE.conditionalRate)} ν/s`;
    case "generator":
      return "1× charge while flowing";
    case "focusKeyed":
      return "focus-keyed charge";
    case "infusor":
      return `+${fmt(BALANCE.infusorBonus * 100)}%`;
    case "forge":
      return "rolls at threshold";
    default:
      return "";
  }
}

function renderForgeModal(app: App, content: HTMLElement): void {
  const { state } = app;
  const offer = state.bankedRolls[state.bankedRolls.length - 1];
  const banked = state.bankedRolls.length;
  content.innerHTML = `
    <div class="modal-top"><span class="eyebrow">FORGE</span><span class="small muted">${banked} banked</span></div>
    <h2 id="modal-title" class="sr-only">Forge choice</h2>
    ${offer ? `<div class="candidates">
      ${offer.candidates.map((candidate) => `
        <button class="candidate-tile" data-choice="${candidate.id}" data-offer="${offer.id}" data-rarity="${candidate.rarity}" title="Take the ${RARITY_LABEL[candidate.rarity]} ${META[candidate.type].name}">
          <svg viewBox="-75 -75 150 150" aria-hidden="true">
            <polygon class="hex" points="${hexPoints(HEX_RADIUS)}"/>
            <g transform="translate(0,-16)" class="hex-icon" fill="none" stroke-width="2.2">${moduleIcon(candidate.type)}</g>
            <text y="22" text-anchor="middle" class="hex-name">${META[candidate.type].short}</text>
            <text y="42" text-anchor="middle" class="hex-sub">${candidateHeadline(candidate.type)}</text>
            <text y="-46" text-anchor="middle" class="hex-level">Lv 0</text>
          </svg>
          <span class="rarity" style="color:var(--rarity-${candidate.rarity})">${RARITY_LABEL[candidate.rarity]}</span>
          <span class="candidate-scaling">+${fmt((BALANCE.rarityPower[candidate.rarity] - 1) * 100)}% / level · upgrades from 10 ν</span>
          <span class="candidate-effect">${forgeEffect(candidate.type, state)}</span>
        </button>`).join("")}
    </div>` : `<p class="empty-copy">No Forge choices available.</p>`}`;
  content.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      app.chooseCandidate(button.getAttribute("data-offer")!, button.getAttribute("data-choice")!);
    });
  });
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
    <p class="lead">This erases the current instrument: modules, nous, progress, and banked rolls. Export first if you want a backup.</p>
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
    panel = document.createElement("div");
    panel.className = "dev-panel";
    panel.id = "dev-panel";
    document.body.append(panel);
  }
  panel.innerHTML = `<span>DEV</span>
    <button data-dev="60">+1m</button>
    <button data-dev="600">+10m</button>
    <button data-dev="target">→ target</button>
    <button data-dev="nous">+100ν</button>`;
  panel.querySelectorAll<HTMLButtonElement>("[data-dev]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-dev")!;
      if (key === "target") app.devToTarget();
      else if (key === "nous") app.devNous();
      else app.devAdvance(Number(key));
    });
  });
}
