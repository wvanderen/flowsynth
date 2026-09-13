import { chargedFactor, computeRates, isActive, isCore, levelCost, modulePower, wholeNous } from "../engine/economy";
import { deployedAt, deployedTime, chargeSecondsRemaining, chargeActive } from "../engine/economy";
import { adjacent, sameHex } from "../engine/hex";
import { forgeThreshold, expansionThreshold } from "../engine/rolls";
import { BALANCE } from "../engine/constants";
import { formatClock, formatDuration } from "../engine/clock";
import { canWriteNotes, projectedNotesBurst, sessionNoteCount } from "../engine/notes";
import { activeHabit, developmentRate } from "../engine/habits";
import { goalCapacity, goalRequiredSeconds, goalSummary, goalsActive } from "../engine/goals";
import { allowanceRate, taskCost, tasksActive, type TaskSize } from "../engine/tasks";import type { CoreActivationType, Goal, GameState, Hex, ModuleInstance, RateSnapshot } from "../engine/types";
import type { App } from "./app";
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
// idle build rate while arranging in upgrade mode. Module panels preview
// charge separately via computeRates(state, true).
function currentSnapshot(state: GameState): RateSnapshot {
  return computeRates(state, state.mode === "upgrade" ? false : undefined);
}

function stat(label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono">${value}</span></div>`;
}

function statLive(id: string, label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono" data-live="${id}">${value}</span></div>`;
}

function meterBar(system: "forge" | "expansion", state: GameState, progress: number, threshold: number): string {
  const text = system === "forge" ? "Next Forge roll" : "Next grid cell";
  const note =
    system === "forge"
      ? `All deployed Forges feed one shared meter · ${state.forge.earned} earned`
      : `All deployed expanders feed one shared meter · ${state.expansion.earned} earned`;
  return `<div class="overview-meter" title="${note}">${statLive(system, text, `${fmt(Math.max(0, progress), 1)} / ${fmt(threshold, 1)}`)}
    <progress data-live="${system}-bar" aria-label="${text}" value="${Math.min(1, Math.max(0, progress / threshold))}" max="1"></progress></div>`;
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

function renderSessionToolbar(app: App): void {
  const { state } = app;
  const host = byId("session-toolbar");
  if (!host) return;
  const upgrade = state.mode === "upgrade";

  const shortcut = `<button class="module-shortcut" id="time-shortcut" aria-label="Open Time module" title="Time settings"><svg viewBox="-18 -18 36 36" aria-hidden="true">${moduleIcon("time")}</svg></button>`;
  const bindShortcut = () => {
    byId("time-shortcut")?.addEventListener("click", () => {
      app.ui.selected = deployedTime(state)?.id ?? null;
      app.ui.managing = false;
      app.ui.placing = null;
      app.render();
    });
    byId("notes-shortcut")?.addEventListener("click", () => {
      const notes = app.state.modules.find((m) => m.type === "notes" && m.pos !== null);
      app.ui.selected = notes?.id ?? null;
      app.ui.managing = false;
      app.ui.placing = null;
      app.render();
    });
    byId("habit-chip")?.addEventListener("click", () => {
      const habit = app.state.modules.find((m) => m.type === "habit" && m.pos !== null);
      app.ui.selected = habit?.id ?? null;
      app.ui.managing = false;
      app.ui.placing = null;
      app.render();
    });
  };
  const notesShortcut = state.notesActive
    ? `<button class="module-shortcut" id="notes-shortcut" aria-label="Open Notes module" title="Notes"><svg viewBox="-18 -18 36 36" aria-hidden="true">${moduleIcon("notes")}</svg></button>`
    : "";
  // Habit access is always in the header: a named chip when a habit is
  // selected, the plain module shortcut otherwise.
  const habitShortcut = (habitName: string) =>
    habitName
      ? `<button class="habit-chip" id="habit-chip" title="Open the Habit module"><svg viewBox="-18 -18 36 36" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">${moduleIcon("habit")}</svg><span>${escapeHtml(habitName)}</span></button>`
      : `<button class="module-shortcut" id="habit-chip" aria-label="Open Habit module" title="Choose a habit"><svg viewBox="-18 -18 36 36" aria-hidden="true">${moduleIcon("habit")}</svg></button>`;
  const activeHabitName = () => {
    const habit = activeHabit(state);
    return habit ? habit.name : "";
  };

  if (upgrade) {
    // Structural key: only rebuild when the shape of the toolbar changes, so
    // button nodes (and in-flight clicks) survive clock ticks.
    const key = `upgrade:${app.ui.chosenTarget}:${state.notesActive}:${state.activeHabitId ?? ""}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      host.innerHTML = `<div><p class="session-clock mono">${app.ui.chosenTarget === null ? "∞" : formatClock(app.ui.chosenTarget)}</p><p class="clock-caption">${app.ui.chosenTarget === null ? "Open-ended" : "Planned practice"}</p></div>
        ${shortcut}${notesShortcut}${habitShortcut(activeHabitName())}<div class="session-actions"><button class="primary" id="start-flow">Enter flow ↗</button></div>`;
      bindShortcut();
      byId("start-flow")?.addEventListener("click", () => app.startFlow());
    }
    return;
  }

  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const reached = target !== null && elapsed >= target;

  const key = `flow:${state.mode}:${target === null ? "open" : reached ? "reached" : "timed"}:${state.notesActive}:${state.activeHabitId ?? ""}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `
      <div>
        <p class="session-clock mono" id="session-clock">${formatClock(elapsed)}</p>
        <p class="clock-caption" id="session-caption"></p>
        <div class="time-track"><span id="time-track-fill" style="width:0%"></span></div>
      </div>
      ${shortcut}${notesShortcut}${habitShortcut(activeHabitName())}
      <div class="session-actions">
        <button id="pause-flow">${paused ? "Resume" : "Pause"}</button>
        <button class="primary" id="end-flow">End flow</button>
      </div>`;
    bindShortcut();
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
  const storeReady = state.storeOpened;
  const key = JSON.stringify([upgrade, storeReady, state.bankedRolls.length, state.cellTokens, ui.managing]);
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  const cellBadge = state.cellTokens > 0 ? ` · ${state.cellTokens}` : "";
  const forgeReady = upgrade && state.bankedRolls.length > 0;
  host.innerHTML = `
    <button class="small" id="tool-store" ${upgrade && storeReady ? "" : "disabled"} title="${storeReady ? "Activations and starter copies" : "Opens after your first session"}">Store</button>
    <button class="small" id="tool-forge" ${forgeReady ? "" : "disabled"} title="${forgeReady ? `${state.bankedRolls.length} banked choice${state.bankedRolls.length === 1 ? "" : "s"}` : "No banked rolls — earn Forge progress from charge"}">Forge · ${state.bankedRolls.length}</button>
    <button class="small ${ui.managing ? "active" : ""}" id="tool-manage" ${upgrade ? "" : "disabled"} aria-pressed="${ui.managing}" title="${ui.managing ? "Exit arranging (Esc)" : "Move modules, place earned cells"}>Grid &amp; inventory${cellBadge}</button>
    <button class="small" id="tool-settings">Settings</button>`;
  byId("tool-settings")?.addEventListener("click", () => app.openModal("settings"));
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
    </div>`;
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
        html += `<line data-key="charge-${m.id}" class="${dispensing ? "charge-line" : "charge-preview-line"}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }
    }
  }

  // Source lines when a receiver is selected.
  if (upgrade && selectedModule && (selectedModule.type === "forge" || selectedModule.type === "expander") && selectedModule.pos && time && isActive(state, time) && time.pos && adjacent(selectedModule.pos, time.pos)) {
    const [x1, y1] = point(time.pos);
    const [x2, y2] = point(selectedModule.pos);
    html += `<line data-key="charge-${selectedModule.id}" class="charge-preview-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
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
      html += moduleNode(app, module, pos, { dispensing, snapshot, selectedModule });
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
      highlight = `<polygon data-key="preview" class="highlight-ring" points="${hexPoints(HEX_RADIUS - 4)}"/>`;
    }
  }

  // Water-fill: threshold progress rises inside the hexagon like liquid.
  let fill = "";
  if (module.type === "forge" || module.type === "expander") {
    const progress = module.type === "forge" ? state.forge.progress : state.expansion.progress;
    const threshold = module.type === "forge" ? forgeThreshold(state.forge.earned) : expansionThreshold(state.expansion.earned);
    fill = waterFill(module.id, progress / threshold);
  } else if (module.type === "goals" && state.goalsActive && state.goals.length > 0) {
    // Show the goal closest to completion; a fully complete set fills fully.
    const fractions = state.goals.map((g) => Math.min(1, g.progressSeconds / goalRequiredSeconds(g)));
    fill = waterFill(module.id, state.goals.every((g) => g.completed) ? 1 : Math.max(...fractions));
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
  } else if (module.type === "habit") {
    const habit = activeHabit(state);
    sub = habit ? habit.name : "no habit";
  } else if (module.type === "notes") {
    sub = state.notesActive ? `${state.notes.length} notes` : "Locked";
  } else if (module.type === "goals") {
    sub = state.goalsActive ? `${state.goals.length}/${goalCapacity(state)} goals` : "Locked";
  } else if (module.type === "tasks") {
    sub = state.tasksActive ? `${state.tasks.filter((t) => !t.done).length} open` : "Locked";
  } else {
    sub = `+${fmt(contribution?.value ?? 0)} ν/s`;
  }

  const name = META[module.type].short;
  const levelTag = active ? ` ${module.level}` : "";

  return `<g class="module-node ${active ? "" : "locked"}" data-rarity="${module.rarity}">
    <polygon data-key="hex" class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>${fill}${highlight}
    <g data-key="icon" transform="translate(0,-13)" class="hex-icon" fill="none" stroke-width="1.6">${moduleIcon(module.type)}</g>
    <text data-key="name" y="17" text-anchor="middle" class="hex-name">${name}${levelTag}</text>
    ${active ? `<text data-key="value" y="34" text-anchor="middle" class="hex-sub">${sub}</text>` : ""}
    ${active ? "" : `<g data-key="lock" transform="translate(0,31)" stroke="var(--muted)" fill="none" stroke-width="1.4"><path d="M-3 0v-2.5a3 3 0 0 1 6 0V0"/><rect x="-5" y="0" width="10" height="8" rx="1.5" fill="none"/></g>`}
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
// ghost after a small threshold, then drops onto a cell (place) or the
// inventory zone (return). Click-placement stays available without dragging.
function bindPointerDrag(app: App, element: Element, moduleId: string | (() => string | null)): void {
  element.addEventListener("pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || !app.ui.managing || app.state.mode !== "upgrade" || app.ui.reshape) return;
    const id = typeof moduleId === "function" ? moduleId() : moduleId;
    if (!id) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let ghost: HTMLDivElement | null = null;
    let hoverTarget: Element | null = null;

    const setHoverTarget = (ev: PointerEvent) => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const under = hit?.closest("[data-cell]") ?? null;
      if (under !== hoverTarget) {
        hoverTarget?.querySelector(".hex")?.classList.remove("drop-target");
        hoverTarget = under;
        hoverTarget?.querySelector(".hex")?.classList.add("drop-target");
      }
      document.getElementById("inventory-zone")?.classList.toggle("drag-over", !!hit?.closest("#inventory-zone"));
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
      hoverTarget?.querySelector(".hex")?.classList.remove("drop-target");
      hoverTarget = null;
      document.getElementById("inventory-zone")?.classList.remove("drag-over");
      if (!apply || !moved) return;
      suppressNextClick();
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellNode = target?.closest("[data-cell]");
      if (target?.closest("#inventory-zone")) {
        app.returnToInventory(id);
      } else if (cellNode) {
        const cell = cellNode.getAttribute("data-cell")!.split(",").map(Number);
        app.pickCellThenPlace(id, { q: cell[0]!, r: cell[1]! });
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
    ui.placing,
    ui.reshape,
    state.storeOpened,
    state.bankedRolls.length,
    state.cellTokens,
    state.notes.length,
    state.habits.map((h) => `${h.archived ? "·" : ""}${h.name}`).join("|"),
    state.activeHabitId,
    app.ui.editingHabitId,
    state.goals.length,
    state.goals.map((g) => (g.completed ? "1" : "0") + g.condition.minutes + (g.condition.habitId ?? "") + g.schedule.kind).join("|"),
    state.goalsActive,
    state.tasks.length,
    state.tasks.map((t) => `${t.done ? "d" : ""}${t.paid ? "p" : ""}${t.text}`).join("|"),
    state.tasksActive,
    app.ui.editingTaskId,
    module?.level ?? null,
    module?.rarity ?? null,
    // Module moves (drag, place, return, combine) must refresh the manage
    // panel's hex inventory even when the selection itself never changes.
    state.modules.map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}:${m.pos ? `${m.pos.q},${m.pos.r}` : "-"}`).join("|"),
  ]);
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    // A newly captured note keeps the panel scrolled where the player is.
    const keepScroll = module?.type === "notes" && state.mode !== "upgrade";
    const scrollTop = host.scrollTop;
    if (ui.managing && state.mode === "upgrade") {
      renderManagePanel(app, host);
    } else if (!module) {
      renderOverview(app, host);
    } else {
      renderModulePanel(app, host, module);
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
  set("charge", `${Math.ceil(chargeSecondsRemaining(state))}s`);
  set("queued", `${fmt(chargeSecondsRemaining(state), 1)}s`);
  set("notes-projection", `${fmt(projectedNotesBurst(state), 1)}s of charge`);
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
  set("task-allowance", `${fmt(state.allowance, 1)} pts`);
  set("forge", `${fmt(Math.max(0, state.forge.progress), 1)} / ${fmt(forgeThreshold(state.forge.earned), 1)}`);
  set("expansion", `${fmt(Math.max(0, state.expansion.progress), 1)} / ${fmt(expansionThreshold(state.expansion.earned), 1)}`);
  set("rolls", String(state.bankedRolls.length));
  set("cells", String(state.cellTokens));
  set("elapsed", state.session ? formatClock(state.session.elapsed) : "—");
  const forgeBar = host.querySelector('[data-live="forge-bar"]') as HTMLProgressElement | null;
  if (forgeBar) forgeBar.value = Math.min(1, Math.max(0, state.forge.progress / forgeThreshold(state.forge.earned)));
  const expansionBar = host.querySelector('[data-live="expansion-bar"]') as HTMLProgressElement | null;
  if (expansionBar) expansionBar.value = Math.min(1, Math.max(0, state.expansion.progress / expansionThreshold(state.expansion.earned)));
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
      ${statLive("charge", upgrade ? "Banked charge" : "Charge remaining", `${Math.ceil(chargeSecondsRemaining(state))}s`)}
      ${stat("Active modules", `${active.length} / ${deployedModules.length} deployed`)}
      ${meterBar("forge", state, state.forge.progress, forgeThreshold(state.forge.earned))}
      ${meterBar("expansion", state, state.expansion.progress, expansionThreshold(state.expansion.earned))}
      <div class="divider"></div>
      ${statLive("rolls", "Banked Forge choices", String(state.bankedRolls.length))}
      ${statLive("cells", "Cells ready to place", String(state.cellTokens))}
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
    case "notes":
      return "Captures thoughts during flow. A session with at least one note banks a charge burst at session end, sized by its practice minutes.";
    case "habit":
      return "Names what you practice. The selected habit locks for the session and develops from live practice and manual logs; its level speeds development.";
    case "goals":
      return "Tracks practice conditions in limited slots. Completions queue a charge burst; the module's level strengthens those bursts.";
    case "tasks":
      return "Captures bite-sized steps any time. Live practice funds an allowance that pays task rewards fully, in completion order.";
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
    case "notes":
      return { text: `${fmt(BALANCE.notesChargePerMinute * power)}s charge / qualifying minute`, value: BALANCE.notesChargePerMinute * power };
    case "habit":
      return { text: `×${fmt(power, 3)} habit development rate`, value: power };
    case "goals":
      return { text: `${fmt(BALANCE.goalBurstSecondsPerPracticeMinute * power, 3)}s burst / required minute`, value: BALANCE.goalBurstSecondsPerPracticeMinute * power };
    case "tasks":
      return { text: `${fmt(power, 3)} allowance pts / live minute`, value: power };
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
  const affordable = wholeNous(state) >= cost;
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
        ${durationOptionsHtml(app)}
      </select>
      ${!upgrade && state.session ? statLive("elapsed", "Elapsed", formatClock(state.session.elapsed)) : ""}
    </section>`;
  } else if (module.type === "habit") {
    const active = activeHabit(state);
    const live = state.mode !== "upgrade";
    const habits = state.habits.filter((h) => !h.archived);
    if (live) {
      focus = `<section class="focus-controls">
        <span class="eyebrow">FOCUS CONTROLS</span>
        <p class="habit-active-name">${active ? escapeHtml(active.name) : "Unstructured practice"}</p>
        <p class="small muted" style="margin-top:4px">${active ? "Locked for this session — selected before entering flow." : "No habit selected; the session still counts as practice."}</p>
        ${active ? statLive("habit-session", "This session", `${formatClock(state.session?.elapsed ?? 0)} of practice`) : ""}
      </section>`;
    } else {
      focus = `<section class="focus-controls">
        <span class="eyebrow">FOCUS CONTROLS</span>
        <div class="habit-create">
          <input type="text" id="habit-name-input" placeholder="New habit (piano, cooking…)" maxlength="40" />
          <button class="primary small" id="habit-create">Add</button>
        </div>
        <div class="habit-list">
          ${habits.map((habit) => {
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
          }).join("") || `<p class="empty-copy">No habits yet. Name what you practice.</p>`}
        </div>
        ${state.activeHabitId
          ? `<div class="habit-log">
              <label class="config-label" for="habit-log-minutes">Log practice for ${escapeHtml(active?.name ?? "")} manually</label>
              <div class="habit-create">
                <input type="number" id="habit-log-minutes" min="1" max="600" placeholder="minutes" />
                <button class="small" id="habit-log-add">Log</button>
              </div>
              <p class="small muted">Manual logs grow development and later count toward goals — they never produce nous or charge.</p>
            </div>`
          : `<p class="small muted">Select a habit to log practice manually; selection is locked during flow.</p>`}
      </section>`;
    }
  } else if (module.type === "goals") {
    const capacity = goalCapacity(state);
    const live = state.mode !== "upgrade";
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
          ${live ? "" : `<button class="quiet small icon-btn" data-goal-delete="${goal.id}" title="Remove goal"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M-6-6 6 6M6-6-6 6"/></svg></button>`}
        </div>
        <div class="goal-track"><span data-goal-progress="${goal.id}" style="width:${fraction * 100}%"></span></div>
        <small class="mono" data-goal-minutes="${goal.id}">${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · earned ×${goal.completedCount}` : ""}</small>
      </div>`;
    };
    if (!goalsActive(state)) {
      focus = `<section class="focus-controls"><span class="eyebrow">FOCUS CONTROLS</span><p class="small muted">Activation is a store purchase — the cheapest way to open up.</p></section>`;
    } else if (live) {
      focus = `<section class="focus-controls">
        <span class="eyebrow">FOCUS CONTROLS · LOCKED FOR THIS SESSION</span>
        ${state.goals.map(goalRow).join("") || `<p class="empty-copy">No goals tracked. Create some between sessions.</p>`}
      </section>`;
    } else {
      focus = `<section class="focus-controls">
        <span class="eyebrow">FOCUS CONTROLS · ${state.goals.length}/${capacity} SLOTS</span>
        ${state.goals.length < capacity ? `
          <div class="goal-create">
            <select id="goal-habit" aria-label="Habit">${habitOptions}</select>
            <input type="number" id="goal-minutes" min="1" max="1440" placeholder="min" />
            <select id="goal-schedule" aria-label="Schedule">
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="once">once</option>
            </select>
            <button class="primary small" id="goal-add">Add</button>
          </div>` : `<p class="small muted">All slots in use — upgrade the module or remove a goal.</p>`}
        <div class="goal-list">
          ${state.goals.map(goalRow).join("") || `<p class="empty-copy">No goals yet. Goals track practice conditions and reward charge bursts.</p>`}
        </div>
        <p class="small muted" style="margin-top:10px">Progress counts only while a goal exists; earlier practice never counts retroactively. Manual logs count too.</p>
      </section>`;
    }
  } else if (module.type === "tasks") {
    if (!tasksActive(state)) {
      focus = `<section class="focus-controls"><span class="eyebrow">FOCUS CONTROLS</span><p class="small muted">Activation is a store purchase — the cheapest way to open up.</p></section>`;
    } else {
      const open = state.tasks.filter((t) => !t.done);
      const pending = state.tasks.filter((t) => t.done && !t.paid);
      const paid = state.tasks.filter((t) => t.paid);
      const next = pending[0];
      focus = `<section class="focus-controls">
        <span class="eyebrow">FOCUS CONTROLS · CAPTURE ANY TIME</span>
        <div class="task-create">
          <input type="text" id="task-text-input" placeholder="A small concrete step…" maxlength="120" />
          <select id="task-size" aria-label="Size">
            <option value="small">small · 3 ν</option>
            <option value="medium">medium · 8 ν</option>
            <option value="large">large · 15 ν</option>
          </select>
          <button class="primary small" id="task-add">Add</button>
        </div>
        <div class="task-list">
          ${open.map((task) => {
            const editing = app.ui.editingTaskId === task.id;
            return `<div class="task-row" data-task="${task.id}">
              <span class="task-size mono">${task.size}</span>
              ${editing
                ? `<input type="text" class="task-rename-input" id="task-rename-input" value="${escapeHtml(task.text)}" maxlength="120" />
                   <button class="primary small" id="task-rename-save">Save</button>`
                : `<span class="task-text">${escapeHtml(task.text)}</span>
                   <button class="quiet small icon-btn" data-task-rename="${task.id}" title="Edit task"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M-8 8 8-8M-1-7h8v8"/></svg></button>
                   <button class="small" data-task-done="${task.id}" title="Mark complete">Done</button>`}
              <button class="quiet small icon-btn" data-task-delete="${task.id}" title="Delete task"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M-6-6 6 6M6-6-6 6"/></svg></button>
            </div>`;
          }).join("") || `<p class="empty-copy">No open tasks. Capture the bite-sized things as they come.</p>`}
        </div>
        ${pending.length > 0 ? `
          <h3 class="store-section-title">Awaiting allowance</h3>
          <div class="task-list">
            ${pending.map((task) => `
              <div class="task-row pending">
                <span class="task-size mono">${task.size}</span>
                <span class="task-text">${escapeHtml(task.text)}</span>
                <small class="mono" data-live="task-next-cost">${fmt(Math.max(0, taskCost(task.size) - (next && task.id === next.id ? state.allowance : 0)), 1)} pts to go</small>
                <button class="quiet small icon-btn" data-task-delete="${task.id}" title="Delete task (forfeits its unfunded reward)"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M-6-6 6 6M6-6-6 6"/></svg></button>
              </div>`).join("")}
          </div>` : ""}
        ${paid.length > 0 ? `<p class="small muted" style="margin-top:10px">${paid.length} task${paid.length === 1 ? "" : "s"} paid out.</p>` : ""}
      </section>`;
    }
  } else if (module.type === "notes") {
    const recent = [...state.notes].slice(-8).reverse();
    const noteCount = sessionNoteCount(state);
    const capture = canWriteNotes(state);
    focus = `<section class="focus-controls">
      <span class="eyebrow">FOCUS CONTROLS</span>
      ${capture
        ? `<textarea class="note-composer" id="note-composer" placeholder="What are you noticing?" maxlength="2000" rows="3"></textarea>
           <div class="session-actions" style="margin:10px 0 0"><button class="primary" id="note-save">Capture note</button></div>
           ${noteCount > 0 ? statLive("notes-projection", "Banks at session end", `${fmt(projectedNotesBurst(state), 1)}s of charge`) : `<p class="small muted" style="margin-top:10px">One note during this session turns its practice minutes into a banked charge burst.</p>`}`
        : `<p class="small muted">${state.notesActive ? "Note capture happens during flow; the burst is banked when the session ends." : "Activation is a store purchase — the cheapest way to open up."}</p>`}
      ${recent.length > 0 ? `<div class="note-list">${recent.map((n) => `<div class="note-entry"><span class="note-when mono">S${n.sessionId} · ${formatClock(n.atElapsed)}</span><p>${escapeHtml(n.text)}</p></div>`).join("")}</div>` : ""}
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
      ${statLive("queued", "Queued output", `${fmt(queued, 1)}s`)}
      ${state.timeActive ? "" : stat("Status", "activates after your first session")}`;
  } else if (module.type === "forge" || module.type === "expander") {
    const isForge = module.type === "forge";
    const progress = isForge ? state.forge.progress : state.expansion.progress;
    const threshold = isForge ? forgeThreshold(state.forge.earned) : expansionThreshold(state.expansion.earned);
    const eligible = time?.pos && module.pos && adjacent(module.pos, time.pos) && state.timeActive;
    chargeStats = `
      ${statLive(isForge ? "forge" : "expansion", "Shared progress", `${fmt(Math.max(0, progress), 1)} / ${fmt(threshold, 1)}`)}
      ${stat("Rewards earned", String(isForge ? state.forge.earned : state.expansion.earned))}
      ${stat("Charge source", eligible ? "adjacent to active Time" : "not adjacent to active Time")}
      ${stat("Progress rate", `${fmt(contribution?.value ?? 0, 2)} /s while charged`)}`;
  } else if (module.type === "notes") {
    chargeStats = `
      ${stat("Session notes", String(sessionNoteCount(state)))}
      ${statLive("notes-projection", "Banks at session end", `${fmt(projectedNotesBurst(state), 1)}s of charge`)}
      ${stat("Notes captured", String(state.notes.length))}
      ${state.notesActive ? "" : stat("Status", "activation available in the store")}`;
  } else if (module.type === "habit") {
    const habit = activeHabit(state);
    chargeStats = `
      ${stat("Active habit", habit ? escapeHtml(habit.name) : "unstructured")}
      ${habit ? statLive("habit-development", "Development", formatDuration(habit.seconds)) : ""}
      ${stat("Development rate", `×${fmt(developmentRate(state), 3)} per practice minute`)}
      ${stat("Habits tracked", String(state.habits.filter((h) => !h.archived).length))}
      ${stat("Practice entries logged", String(state.practiceLog.length))}`;
  } else if (module.type === "goals") {
    const completed = state.goals.filter((g) => g.completed).length;
    chargeStats = `
      ${stat("Goal slots", `${state.goals.length} / ${goalCapacity(state)}`)}
      ${stat("Completed this occurrence", `${completed} / ${state.goals.length}`)}
      ${stat("Total completions", String(state.goals.reduce((sum, g) => sum + g.completedCount, 0)))}
      ${stat("Burst per completion", `${fmt(BALANCE.goalBurstSecondsPerPracticeMinute * modulePower(module), 3)}s of charge per required minute`)}
      ${state.goalsActive ? "" : stat("Status", "activation available in the store")}`;
  } else if (module.type === "tasks") {
    const open = state.tasks.filter((t) => !t.done).length;
    const pending = state.tasks.filter((t) => t.done && !t.paid).length;
    chargeStats = `
      ${statLive("task-allowance", "Allowance", `${fmt(state.allowance, 1)} pts`)}
      ${stat("Accrual", `${fmt(allowanceRate(state), 3)} pts / live minute`)}
      ${stat("Open tasks", String(open))}
      ${stat("Pending payouts", String(pending))}
      ${stat("Paid out", String(state.tasks.filter((t) => t.paid).length))}
      ${state.tasksActive ? "" : stat("Status", "activation available in the store")}`;
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
  bindDurationSelect(app, byId("panel-duration"));
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
  byId("task-add")?.addEventListener("click", () => {
    const textInput = byId("task-text-input") as HTMLInputElement | null;
    const sizeSelect = byId("task-size") as HTMLSelectElement | null;
    if (textInput && sizeSelect && textInput.value.trim()) {
      app.addTaskAction(textInput.value, sizeSelect.value as TaskSize);
    }
  });
  byId("task-text-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const textInput = event.target as HTMLInputElement;
      const sizeSelect = byId("task-size") as HTMLSelectElement | null;
      if (textInput.value.trim() && sizeSelect) app.addTaskAction(textInput.value, sizeSelect.value as TaskSize);
    }
  });
  host.querySelectorAll<HTMLElement>("[data-task-done]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-task-done");
      if (id) app.completeTaskAction(id);
    });
  });
  host.querySelectorAll<HTMLElement>("[data-task-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-task-delete");
      if (id) app.deleteTaskAction(id);
    });
  });
  host.querySelectorAll<HTMLElement>("[data-task-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      app.ui.editingTaskId = button.getAttribute("data-task-rename");
      app.render();
      const input = byId("task-rename-input") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  });
  const taskRenameInput = byId("task-rename-input");
  taskRenameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const id = app.ui.editingTaskId;
      if (id) app.renameTaskAction(id, (event.target as HTMLInputElement).value);
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      app.ui.editingTaskId = null;
      app.render();
    }
  });
  byId("task-rename-save")?.addEventListener("click", () => {
    const id = app.ui.editingTaskId;
    const input = byId("task-rename-input") as HTMLInputElement | null;
    if (id && input) app.renameTaskAction(id, input.value);
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
  if (module.type === "forge" || module.type === "expander") {
    return `${fmt(now.value * (growth - 1), 3)} progress/s`;
  }
  if (module.type === "notes") {
    return `+${fmt(now.value * (growth - 1), 3)}s / minute`;
  }
  if (module.type === "habit") {
    return `×${fmt(growth, 3)} → ×${fmt(now.value * growth, 3)} development`;
  }
  if (module.type === "goals") {
    return `+${fmt(now.value * (growth - 1), 3)}s per minute`;
  }
  if (module.type === "tasks") {
    return `+${fmt(now.value * (growth - 1), 3)} pts / minute`;
  }
  return `+${fmt(now.value * (growth - 1), 4)} effect`;
}

/* ── Grid & inventory panel ────────────────────────── */

// A canvas-style hex tile — icon, name, level, rarity accent — shared by the
// inventory grid and the live drag ghost so a carried tile looks identical to
// the one waiting in inventory (candidate-tile pattern from the Forge).
function hexTileSvg(module: ModuleInstance, locked = false): string {
  return `<svg viewBox="-75 -75 150 150" aria-hidden="true">
    <polygon class="hex" points="${hexPoints(HEX_RADIUS)}"/>
    <g transform="translate(0,-16)" class="hex-icon" fill="none" stroke-width="2.2">${moduleIcon(module.type)}</g>
    <text y="24" text-anchor="middle" class="hex-name">${META[module.type].short}</text>
    <text y="-46" text-anchor="middle" class="hex-level">Lv ${module.level}</text>
    ${locked
      ? `<g transform="translate(0,36)" stroke="var(--muted)" fill="none" stroke-width="1.4"><path d="M-3 0v-2.5a3 3 0 0 1 6 0V0"/><rect x="-5" y="0" width="10" height="8" rx="1.5" fill="none"/></g>`
      : `<text y="44" text-anchor="middle" class="hex-sub">${RARITY_LABEL[module.rarity]}</text>`}
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
          ? "Choose a destination cell. Occupied gameplay modules swap."
          : "Tiles are raised and movable. Drag between cells or into the inventory; required cores stay deployed."
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
      <p class="small muted">Drop a raised tile here to store its module, or click one to place it.</p>
      <div class="inventory-hexes" id="inventory-list">
        ${inventory.map((m) => {
          const spareCore = isCore(m) && !isActive(state, m);
          return `<button class="inventory-tile ${spareCore ? "locked" : ""}" data-inv="${m.id}" data-rarity="${m.rarity}" title="${META[m.type].name} · ${RARITY_LABEL[m.rarity]}${spareCore ? " · spare core: places by replacing its deployed match" : ""}">
            ${hexTileSvg(m, spareCore)}
          </button>`;
        }).join("") || `<p class="empty-copy">Inventory is empty. Drag a gameplay tile here to store it.</p>`}
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
        ? [app.ui.showAcquired, wholeNous(app.state), JSON.stringify(app.state.purchased), app.state.notesActive, app.state.goalsActive, app.state.tasksActive]
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
  const starterTypes = Object.keys(BALANCE.starterPrices) as (keyof typeof BALANCE.starterPrices)[];
  const activationTypes = Object.keys(BALANCE.coreActivationPrices) as CoreActivationType[];
  const activationActive = (type: CoreActivationType) =>
    type === "notes" ? state.notesActive : type === "goals" ? state.goalsActive : state.tasksActive;

  // Purchasable groups on top; already-owned items demote below the checkbox
  // and appear only when it is checked — cores and starters alike.
  const openActivations = activationTypes.filter((type) => !activationActive(type));
  const openStarters = starterTypes.filter((type) => !state.purchased[type]);
  const ownedStarters = starterTypes.filter((type) => state.purchased[type]);
  const ownedActivations = activationTypes.filter(activationActive);
  const acquiredCount = ownedStarters.length + ownedActivations.length;
  const totalCount = starterTypes.length + activationTypes.length;

  const activationRow = (type: CoreActivationType) => `
    <div class="shop-item activation">
      <div><h3>Activate ${META[type].name}</h3><small>${META[type].role} · permanent</small></div>
      <button class="primary" data-activate="${type}" ${wholeNous(state) >= BALANCE.coreActivationPrices[type] ? "" : "disabled"}>${BALANCE.coreActivationPrices[type]} ν</button>
    </div>`;

  content.innerHTML = `
    ${modalTop("STORE")}
    <h2 id="modal-title">Shape what comes next.</h2>
    <p class="lead">Core activations are the cheapest way to open the instrument up. ${fmtWhole(state.nous)} ν available.</p>
    ${openActivations.length > 0 ? `
      <h3 class="store-section-title">Core activations</h3>
      <div class="shop-list store-activations">${openActivations.map(activationRow).join("")}</div>` : ""}
    ${openStarters.length > 0 ? `
      <h3 class="store-section-title">Starter modules</h3>
      <div class="shop-list">${openStarters.map((type) => {
        const price = BALANCE.starterPrices[type];
        const affordable = wholeNous(state) >= price;
        return `<div class="shop-item">
          <div><h3>${META[type].name}</h3><small>${META[type].role}</small></div>
          <button class="primary" data-buy="${type}" ${affordable ? "" : "disabled"}>${price} ν</button>
        </div>`;
      }).join("")}</div>` : ""}
    ${openActivations.length === 0 && openStarters.length === 0 ? `<p class="empty-copy">Everything is acquired. New copies come from the Forge.</p>` : ""}
    <label class="store-toggle"><input type="checkbox" id="store-show-acquired" ${ui.showAcquired ? "checked" : ""}/> Show acquired (${acquiredCount}/${totalCount})</label>
    ${ui.showAcquired && acquiredCount > 0 ? `
      <h3 class="store-section-title">Acquired</h3>
      <div class="shop-list store-owned">
        ${ownedActivations.map((type) => `<div class="shop-item activation owned"><div><h3>Activate ${META[type].name}</h3><small>${META[type].role} · permanent</small></div><span class="activation-owned mono">Active</span></div>`).join("")}
        ${ownedStarters.map((type) => `<div class="shop-item owned"><div><h3>${META[type].name}</h3><small>${META[type].role}</small></div><span class="activation-owned mono">Acquired</span></div>`).join("")}
      </div>` : ""}
    <p class="modal-note">Activations and starter offers are one-time. Copies from Forge rolls do not remove these offers — they can become combination material.</p>`;
  content.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) => {
    button.addEventListener("click", () => {
      app.buy(button.getAttribute("data-buy") as keyof typeof BALANCE.starterPrices);
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-activate]").forEach((button) => {
    button.addEventListener("click", () => {
      app.buyActivation(button.getAttribute("data-activate") as CoreActivationType);
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
    case "enter": return `+${fmt(BALANCE.baseRate)} ν/s base production<br>+${fmt(BALANCE.baseRate * charged)} ν/s at charge strength 1`;
    case "additive": return `+${fmt(BALANCE.additiveRate)} ν/s base production<br>+${fmt(BALANCE.additiveRate * charged)} ν/s at charge strength 1`;
    case "time": return `×${fmt(1 + BALANCE.timeBonus)} production during flow<br>Timed completion: strength 1 for ${fmt(BALANCE.chargeSecondsPerPracticeSecond * 60)}s per planned minute`;
    case "notes": return `Bank a strength-1 charge burst at session end<br>${fmt(BALANCE.notesChargePerMinute)}s per qualifying practice minute (any note qualifies the session)`;
    case "habit": return `Locks one habit for the session; live and logged practice develop it<br>Development rate ×${fmt(1, 3)}, improved by level and rarity`;
    case "goals": return `Track practice conditions in limited slots<br>Each completion banks a charge burst; levels strengthen bursts`;
    case "tasks": return `Capture bite-sized steps any time<br>Live practice funds rewards: small 3, medium 8, large 15`;
    case "conditional": return `+${fmt(BALANCE.conditionalBonusPerActiveCore * 100)}% production per adjacent active core<br>+${fmt(BALANCE.conditionalBonusPerActiveCore * charged * 100)}% at charge strength 1`;
    case "infusor": return `+${fmt(BALANCE.infusorBonus * 100)}% to adjacent production contributions<br>+${fmt(BALANCE.infusorBonus * charged * 100)}% at charge strength 1`;
    case "forge": return `1 Forge progress per charge<br>Next roll: ${fmt(forgeThreshold(state.forge.earned))} progress`;
    case "expander": return `1 expansion progress per charge<br>Next cell: ${fmt(expansionThreshold(state.expansion.earned))} progress`;
    default: return "Not yet active";
  }
}

function candidateHeadline(type: ModuleInstance["type"]): string {
  switch (type) {
    case "enter":
      return `+${fmt(BALANCE.baseRate)} ν/s`;
    case "additive":
      return `+${fmt(BALANCE.additiveRate)} ν/s`;
    case "time":
      return `×${fmt(1 + BALANCE.timeBonus)}`;
    case "notes":
      return `${fmt(BALANCE.notesChargePerMinute)}s/min burst`;
    case "habit":
      return "×1 development";
    case "goals":
      return "2 slots";
    case "tasks":
      return "3/8/15 ν rewards";
    case "conditional":
      return `+${fmt(BALANCE.conditionalBonusPerActiveCore * 100)}%/core`;
    case "infusor":
      return `+${fmt(BALANCE.infusorBonus * 100)}%`;
    case "forge":
      return "1 roll meter";
    case "expander":
      return "1 cell meter";
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
    panel = document.createElement("div");
    panel.className = "dev-panel";
    panel.id = "dev-panel";
    document.body.append(panel);
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
