import { chargedFactor, cellCost, computeRates, deployed, deployedGenerators, levelCost, modulePower, wholeNous } from "../engine/economy";
import { deployedAt } from "../engine/economy";
import { adjacent, sameHex } from "../engine/hex";
import { forgeThreshold } from "../engine/rolls";
import { BALANCE, CATEGORY_OF, EPS, NEXT_RARITY } from "../engine/constants";
import { formatClock, formatDuration } from "../engine/clock";
import { appActive, appLockNote, FOCUS_APPS, type FocusApp } from "../engine/apps";
import { canWriteNotes } from "../engine/notes";
import { activeHabit } from "../engine/habits";
import { goalCapacity, goalRequiredSeconds, goalSummary } from "../engine/goals";
import { isCarrier } from "../engine/state";
import type { GameState, Goal, Hex, ModuleInstance, RateSnapshot } from "../engine/types";
import { moduleIcon, appIcon } from "./icons";
import type { App } from "./app";
import { updateSvg } from "./svg";
import { DURATION_OPTIONS, META, RARITY_LABEL } from "./meta";
import { formatInt, formatNumber, practiceCountdown } from "./format";

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

// The focus-keyed generator's remaining window (§2.3), in the same
// remaining-duration vocabulary the generator spends it in.
function chargeWindowText(state: GameState): string {
  return formatDuration(Math.max(0, state.chargeWindow));
}

function times(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function render(app: App): void {
  const { state } = app;
  renderConsoleSession(app);
  renderConsoleApps(app);
  renderConsoleReadout(app);
  renderTools(app);
  renderGrid(app);
  renderFormula(app);
  renderInspector(app);
  renderModal(app);
  renderDev(app);
  const count = byId("cell-count");
  if (count) count.textContent = `${state.cells.length} cells`;
}

/* ── Console (ADR-0012) ────────────────────────────── */

function durationOptionsHtml(app: App): string {
  return DURATION_OPTIONS.map(
    (o) => `<option value="${o.value === null ? "open" : o.value}" ${app.ui.chosenTarget === o.value ? "selected" : ""}>${o.label}</option>`,
  ).join("");
}

// The planned target is the Time app's instrument (§2.3), so the select lives
// in its popover; the console clock block displays the next session's shape.
function planText(chosenTarget: number | null): string {
  return chosenTarget === null ? "Open-ended" : `Planned · ${formatClock(chosenTarget)}`;
}

// Session controls: the clock block plus the Enter/Exit main switch and the
// pause control. The switch is the console's sole session gate — sessions
// start and end through it — and it is the one colored console element
// (vermillion; bright and animated while flow is live, dim when idle).
function renderConsoleSession(app: App): void {
  const { state } = app;
  const host = byId("console-session");
  if (!host) return;

  const switchSvg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.2 6.6a8 8 0 1 0 11.6 0"/></svg>`;

  if (state.mode === "upgrade") {
    // Structural key: only rebuild when the shape of the section changes, so
    // control nodes (and in-flight clicks) survive clock ticks.
    const timeOn = appActive(state, "time");
    const key = `upgrade:${app.ui.chosenTarget}:${timeOn}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      host.innerHTML = `
        <div class="console-clock">
          <p class="clock-plan-value mono">${planText(timeOn ? app.ui.chosenTarget : null)}</p>
          <p class="clock-caption">${timeOn ? "Next session — plan it in the Time app" : "Open-ended until Time unlocks"}</p>
        </div>
        <div class="session-actions">
          <button class="main-switch idle" id="flow-switch" title="Enter flow — the board locks and runs itself">
            ${switchSvg}<span>Enter flow</span>
          </button>
        </div>`;
      byId("flow-switch")?.addEventListener("click", () => app.startFlow());
    }
    return;
  }

  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const reached = target !== null && elapsed >= target;

  const key = `flow:${state.mode}:${target === null ? "open" : reached ? "reached" : "timed"}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `
      <div class="console-clock">
        <p class="session-clock mono" id="session-clock">${formatClock(elapsed)}</p>
        <p class="clock-caption" id="session-caption"></p>
        <div class="time-track"><span id="time-track-fill" style="width:0%"></span></div>
      </div>
      <div class="session-actions">
        <button id="pause-flow">${paused ? "Resume" : "Pause"}</button>
        <button class="main-switch ${paused ? "held" : "live"}" id="flow-switch" title="Exit flow — end the session and bank its production">
          ${switchSvg}<span>Exit flow</span>
        </button>
      </div>`;
    byId("pause-flow")?.addEventListener("click", () => (state.mode === "paused" ? app.resume() : app.pause()));
    byId("flow-switch")?.addEventListener("click", () => app.endFlow());
  }

  // Live values update in place; the controls above are never replaced by ticks.
  const set = (id: string, text: string) => {
    const node = byId(id);
    if (node && node.textContent !== text) node.textContent = text;
  };
  set("session-clock", formatClock(elapsed));
  set("session-caption", sessionCaption(elapsed, target, paused));
  const track = byId("time-track-fill");
  const width = sessionTrackWidth(elapsed, target);
  if (track && track.style.width !== width) track.style.width = width;
}

// The running-session readout shared by the console clock block and the Time
// app's popover: caption phrasing and track-fill width (§2.2).
function sessionCaption(elapsed: number, target: number | null, paused: boolean): string {
  const reached = target !== null && elapsed >= target;
  return paused
    ? "Paused · progress preserved"
    : target === null
      ? "Open-ended practice"
      : reached
        ? "Target reached · continue freely"
        : `of ${formatClock(target)} planned`;
}

function sessionTrackWidth(elapsed: number, target: number | null): string {
  return target ? `${Math.min(100, (elapsed / target) * 100)}%` : "0%";
}

// In-place text swap for a data-live node within a scope; tick-safe.
function liveText(scope: ParentNode, live: string, text: string): void {
  const node = scope.querySelector(`[data-live="${live}"]`);
  if (node && node.textContent !== text) node.textContent = text;
}

// Focus-app access (ADR-0012): one tile per app — greyed until activated,
// state LED when active — with its panel opening as a popover anchored
// directly beneath the tile. Locked tiles open nothing; the board never
// moves, reflows, or dims while the console is used.
const APP_LABELS: Record<FocusApp, string> = { habit: "Habit", time: "Time", goals: "Goals", notes: "Notes" };

function renderConsoleApps(app: App): void {
  const host = byId("console-apps");
  if (!host) return;
  const { state, ui } = app;
  const key = JSON.stringify([
    ui.app,
    state.mode,
    state.sessionsCompleted === 0,
    state.habits.map((h) => `${h.archived ? "·" : ""}${h.name}`).join("|"),
    state.activeHabitId,
    ui.editingHabitId,
    state.notes.length,
    state.goals.map((g) => (g.completed ? "1" : "0") + g.condition.minutes + (g.condition.habitId ?? "") + g.schedule.kind).join("|"),
    ui.chosenTarget,
  ]);
  if (host.dataset.renderKey === key) {
    updateAppPanelLive(app, host);
    return;
  }
  host.dataset.renderKey = key;
  // A newly captured note keeps the popover scrolled where the player is.
  const scrollTop = (host.querySelector("#app-popover") as HTMLElement | null)?.scrollTop ?? 0;
  const last = FOCUS_APPS[FOCUS_APPS.length - 1];
  const tiles = FOCUS_APPS.map((appKey) => {
    const active = appActive(state, appKey);
    const note = appLockNote(state, appKey);
    const open = ui.app === appKey;
    const label = APP_LABELS[appKey];
    const anchor = appKey === FOCUS_APPS[0] ? " first" : appKey === last ? " last" : "";
    const title = note ? `${label} — locked: ${note}` : `${label} app`;
    return `<div class="app-slot${anchor}">
      <button class="app-tile${active ? "" : " locked"}${open ? " open" : ""}" id="app-tile-${appKey}" aria-pressed="${open}"${active ? "" : ' aria-disabled="true"'} title="${title}">
        <span class="app-tile-glyph">
          <svg viewBox="-12 -12 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${appIcon(appKey)}</svg>
          <span class="app-led${active ? "" : " off"}" aria-hidden="true"></span>
        </span>
        <span class="app-tile-name">${label}</span>
        ${note ? `<span class="app-locknote">${note}</span>` : ""}
      </button>
      ${open ? `<div class="app-popover" id="app-popover">${popoverHtml(app, appKey)}</div>` : ""}
    </div>`;
  }).join("");
  host.innerHTML = `<div class="app-tiles">${tiles}</div>`;
  if (scrollTop > 0) (host.querySelector("#app-popover") as HTMLElement | null)?.scrollTo(0, scrollTop);
  for (const appKey of FOCUS_APPS) {
    byId(`app-tile-${appKey}`)?.addEventListener("click", () => app.openApp(appKey));
  }
  bindAppPanel(app, host);
  updateAppPanelLive(app, host);
}

function popoverHtml(app: App, panel: FocusApp): string {
  const label = APP_LABELS[panel];
  return `<div class="popover-head">
      <span class="eyebrow">${label.toUpperCase()} APP</span>
      <button class="popover-close" id="app-close" aria-label="Close the ${label} panel">✕</button>
    </div>
    ${appPanelBody(app, panel)}`;
}

const TROPHY_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
  <path d="M4 22h16"/>
  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
</svg>`;

// The console's readout end: the status strip (mode, live rate, and the
// trophy glyph slot that opens achievements once they exist), the nous
// balance, and the activation-ladder rung telegraph slot (issue #42 fills it).
// Static slots are built once; tick-moving values update in place.
function renderConsoleReadout(app: App): void {
  const { state } = app;
  const strip = byId("console-status");
  if (strip) {
    const mode = app.managing ? "ARRANGING" : state.mode === "upgrade" ? "UPGRADE" : state.mode === "paused" ? "PAUSED" : "LIVE";
    if (strip.dataset.renderKey !== mode) {
      strip.dataset.renderKey = mode;
      strip.innerHTML = `
        <div class="console-slot"><span class="eyebrow">Mode</span><strong class="mode-value mono">${mode}</strong></div>
        <div class="console-slot production-slot"><span class="eyebrow">Production</span><strong class="mono" data-live="rate"></strong></div>
        <div class="console-slot trophy-slot">
          <button class="trophy-glyph" disabled title="Achievements arrive with the progression work" aria-label="Achievements (not yet available)">${TROPHY_SVG}</button>
        </div>`;
    }
    const rateNode = strip.querySelector('[data-live="rate"]');
    const rateText = `${formatNumber(currentSnapshot(state).rate)} ν/s`;
    if (rateNode && rateNode.textContent !== rateText) rateNode.textContent = rateText;
  }
  const nous = byId("nous-balance");
  if (nous) {
    if (nous.childElementCount === 0) {
      nous.innerHTML = `<span class="eyebrow">Nous</span><strong class="mono" data-live="nous"></strong>`;
    }
    const amount = nous.querySelector('[data-live="nous"]');
    // The counter reads whole nous — what is actually spendable — so the
    // ticking decimals never flicker in and out of the readout.
    const text = formatInt(state.nous);
    if (amount && amount.textContent !== text) amount.textContent = text;
  }
  const telegraph = byId("telegraph-slot");
  if (telegraph && telegraph.childElementCount === 0) {
    telegraph.innerHTML = `<span class="eyebrow">Next rung</span><strong class="mono">—</strong>`;
    telegraph.title = "The activation ladder's next rung will show here";
  }
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
    <button class="small" id="tool-store" ${upgrade ? "" : "disabled"} title="${upgrade ? "The catalog: starter-shelf offers and board cells" : "Purchases happen between sessions"}">Catalog</button>
    <button class="small" id="tool-forge" ${forgeReady ? "" : "disabled"} title="${forgeReady
      ? `${state.bankedRolls.length} banked choice${state.bankedRolls.length === 1 ? "" : "s"}`
      : upgrade
        ? "No banked rolls — earn Forge progress from charge"
        : "Forge choices belong to upgrade mode"}">Forge · ${state.bankedRolls.length}</button>
    <button class="small ${app.managing ? "active" : ""}" id="tool-manage" ${upgrade ? "" : "disabled"} aria-pressed="${app.managing}" title="${app.managing ? "Exit arranging (Esc)" : upgrade ? "Move modules" : "The grid is locked during flow"}">Grid &amp; inventory</button>`;
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
    `<span class="formula-term" title="${META[type].name}" aria-label="${META[type].name}: ${formatNumber(value)}">
      <svg viewBox="-18 -18 36 36" aria-hidden="true" fill="none" stroke-width="1.6">${moduleIcon(type)}</svg>${formatNumber(value)}</span>`;
  const sum = (type: ModuleInstance["type"]) => {
    let total = 0;
    for (const c of snapshot.contributions.values()) if (c.type === type) total += c.value;
    return total;
  };
  const chordLines = [
    ...snapshot.namedChords.map((c) => `${c.name} ×${formatNumber(1 + c.bonus)}`),
    ...(snapshot.pairs.length > 0 ? [`${times(snapshot.pairs.length, "chord pair")} ×${formatNumber(1 + BALANCE.pairBonus)} each`] : []),
  ];
  const chordLabel =
    chordLines.length > 0 ? chordLines.join(" · ") : "no chords yet — adjacent synthesizers one pitch apart chord";
  const chargeActive = snapshot.empowerment > 1 + EPS;
  host.innerHTML = `
    <div class="rate-equation" title="Chords: ${chordLabel}${chargeActive ? ` · charge empowerment ×${formatNumber(snapshot.empowerment)}` : ""}">
      ${term("carrier", sum("carrier"))}
      <span class="op">+</span>${term("additive", sum("additive"))}
      <span class="op">+</span>${term("conditional", sum("conditional"))}
      <span class="op">×</span><span class="formula-term" title="${chordLabel}" aria-label="Chord terms: ×${formatNumber(snapshot.chordMultiplier)}">χ ${formatNumber(snapshot.chordMultiplier)}</span>
      <span class="op">=</span><strong>${formatNumber(snapshot.rate)} ν/s</strong>
    </div>`;
}

/* ── Hex grid ──────────────────────────────────────── */

function renderGrid(app: App): void {
  const { state, ui } = app;
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg) return;
  const upgrade = state.mode === "upgrade";
  const showFrontier = upgrade && (ui.reshape !== null || ui.buyingCell);
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
    const price = cellCost(state.cellsBought);
    const affordable = wholeNous(state) >= price;
    for (const pos of frontier) {
      const [x, y] = point(pos);
      if (ui.buyingCell) {
        // The purchase arm: every frontier hex carries its price; the buy
        // lands only where clicked (ADR-0013).
        html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Buy cell here for ${formatInt(price)} nous">
          <polygon class="hex ${affordable ? "buy-here" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
          <text y="-24" text-anchor="middle" class="hex-sub">NEW CELL</text>
          ${affordable ? `<text y="8" text-anchor="middle" fill="var(--accent)" font-size="22">+</text>` : ""}
          <text y="${affordable ? 34 : 8}" text-anchor="middle" class="hex-sub">${formatInt(price)} ν</text>
        </g>`;
      } else {
        const isAdd = ui.reshape?.adds.some((c) => sameHex(c, pos)) ?? false;
        html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Expand here">
          <polygon class="hex ${isAdd ? "target" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
          ${isAdd ? `<text y="5" text-anchor="middle" fill="var(--accent)" font-size="20">+</text>` : ""}
        </g>`;
      }
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
    sub = `${formatNumber(Math.max(0, app.state.forge.progress))}/${formatNumber(forgeThreshold(app.state.forge.earned))}`;
  } else if (isSource(module)) {
    sub = `⌁${formatNumber(modulePower(module))}`;
  } else if (module.type === "infusor") {
    sub = `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(ctx.snapshot.chargeStrength.get(module.id) ?? 0))}%`;
  } else {
    // Synthesizers wear their pitch: hex distance from the Carrier + 1.
    const pitch = contribution?.pitch ?? null;
    sub = `${pitch !== null ? `P${pitch} ` : ""}+${formatNumber(contribution?.value ?? 0)} ν/s`;
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
    if (event.button !== 0 || !app.ui.managing || app.state.mode !== "upgrade" || app.ui.reshape || app.ui.buyingCell) return;
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
  // Focus apps render in console popovers, never here.
  const key = JSON.stringify([
    state.mode,
    ui.managing,
    ui.selected,
    ui.placing,
    ui.reshape,
    state.bankedRolls.length,
    module?.level ?? null,
    module?.rarity ?? null,
    // Module moves (drag, place, return, combine) must refresh the manage
    // panel's hex inventory even when the selection itself never changes.
    state.modules.map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}:${m.pos ? `${m.pos.q},${m.pos.r}` : "-"}`).join("|"),
  ]);
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    if (ui.managing && state.mode === "upgrade") {
      renderManagePanel(app, host);
    } else if (module) {
      renderModulePanel(app, host, module);
    } else {
      renderOverview(app, host);
    }
  }
  updateInspectorLive(app, host);
}

// Values that move during flow without rebuilding the panel.
function updateInspectorLive(app: App, host: HTMLElement): void {
  const { state } = app;
  liveText(host, "forge", `${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(forgeThreshold(state.forge.earned))}`);
  liveText(host, "rolls", String(state.bankedRolls.length));
  liveText(host, "elapsed", state.session ? formatClock(state.session.elapsed) : "—");
  liveText(host, "window", chargeWindowText(state));
  // The upgrade CTA and its practice-minute countdown keep themselves current
  // between rebuilds: the projected rate moves with the board, the balance
  // with purchases, so affordability can flip while the panel stands.
  const selected = state.modules.find((m) => m.id === app.ui.selected);
  if (selected) {
    const cost = levelCost(selected.level);
    const countdownNode = host.querySelector('[data-live="countdown"]');
    if (countdownNode) {
      const text = upgradeCountdown(app, cost) ?? "";
      if (countdownNode.textContent !== text) countdownNode.textContent = text;
    }
    const cta = byId("upgrade-module") as HTMLButtonElement | null;
    if (cta) cta.disabled = !(state.mode === "upgrade" && wholeNous(state) >= cost);
  }
  const forgeBar = host.querySelector('[data-live="forge-bar"]') as HTMLProgressElement | null;
  if (forgeBar) forgeBar.value = Math.min(1, Math.max(0, state.forge.progress / forgeThreshold(state.forge.earned)));
}

// The upgrade-mode countdown for a price on this board: phrased against the
// board's projected next-session rate (the charged preview, whatever the
// current mode); null (hidden) when affordable or rateless.
function upgradeCountdown(app: App, cost: number): string | null {
  return practiceCountdown(cost, wholeNous(app.state), computeRates(app.state, true).rate);
}

function forgeMeter(state: GameState): string {
  return `<div class="overview-meter" title="All deployed Forges feed one shared meter · ${state.forge.earned} earned">${statLive("forge", "Next Forge roll", `${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(forgeThreshold(state.forge.earned))}`)}
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
      ${stat("Total nous earned", formatNumber(state.totalEarned))}
      <p class="small muted" style="margin-top:16px">${
        state.mode === "flow"
          ? "Rewards bank automatically. Nothing here needs your attention during practice."
          : state.mode === "paused"
            ? "Production is frozen while paused."
            : "Select a module to inspect or tune it. Store, Forge, and Grid & inventory manage the build."
      }</p>
      <section class="overview-formula">
        <h3>Nous / second</h3>
        <p>rate = (carrier + Σ harmonics) × Π chord terms × charge empowerment. Pitch is hex distance from the Carrier + 1; adjacent synthesizers one pitch apart multiply the composite by a chord-pair bonus — stacking is multiplicative and uncapped.</p>
        <p>Named chords — octave 1:2, fifth 2:3, major triad 4:5:6, blues triad 5:6:7 — replace their member pairs' bonuses with one bigger term, and overlaps stack. Conditionals add a bonus per chord pair they sing.</p>
        <p>Generators produce charge during flow: adjacent synthesizers and infusors are empowered continuously; the Forge banks the charge toward its next roll. The focus-keyed generator emits only while its charge window lasts — every session end banks fraction × live practice time as window minutes. Charge factor = 1 + strength / (1 + strength). Rarity growth per level: common ×1.2 · uncommon ×1.25 · rare ×1.3.</p>
      </section>
    </div>`;
}

function effectDescription(module: ModuleInstance): string {
  switch (module.type) {
    case "carrier":
      return "The granted origin synthesizer. Pinned at the origin: it never moves, never combines, never leaves the board, and plays the formula's carrier term.";
    case "additive":
      return "A plain harmonic term: amplitude at its pitch. Adjacent synthesizers one pitch apart form chord pairs whose bonuses multiply the whole composite.";
    case "conditional":
      return "Amplitude at its pitch, plus a bonus for every chord pair it participates in — a named chord counts once, however many of its pairs the module shares in.";
    case "generator":
      return "Produces charge during flow. Adjacent synthesizers and infusors are empowered continuously; the Forge banks charge toward its next roll.";
    case "focusKeyed":
      return "A generator keyed to your focus: every session end banks a charge window — a slice of that session's live practice time — and the generator spends it as output during the next session's first minutes.";
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
      return { text: `+${formatNumber(BALANCE.carrierRate * power * factor)} ν/s`, value: BALANCE.carrierRate * power * factor };
    case "additive":
      return { text: `+${formatNumber(BALANCE.additiveRate * power * factor)} ν/s`, value: BALANCE.additiveRate * power * factor };
    case "conditional":
      return { text: `+${formatNumber(BALANCE.conditionalRate * power * factor)} ν/s · +${formatNumber(100 * BALANCE.conditionalPairBonus)}% per chord pair`, value: BALANCE.conditionalRate * power * factor };
    case "generator":
      return { text: `${formatNumber(power)} charge strength while flowing`, value: power };
    case "focusKeyed":
      return { text: `${formatNumber(power)} charge strength while its charge window lasts`, value: power };
    case "infusor":
      return { text: `+${formatNumber(100 * BALANCE.infusorBonus * power * factor)}% to adjacent`, value: BALANCE.infusorBonus * power * factor };
    case "forge":
      return { text: `${formatNumber(power)} progress/s at strength 1`, value: power };
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
      ${statLive("forge", "Shared progress", `${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(forgeThreshold(state.forge.earned))}`)}
      ${stat("Rolls earned", String(state.forge.earned))}
      ${stat("Charge source", deployedHere && chargeStrength > 0 ? "adjacent generator" : "no adjacent generator")}
      ${stat("Progress rate", `${formatNumber(contribution?.value ?? 0)} /s while charged`)}`;
  } else if (isSource(module)) {
    chargeStats = `
      ${stat("Output strength", `${formatNumber(modulePower(module))} per second of flow`)}
      ${module.type === "focusKeyed" ? statLive("window", "Charge window", chargeWindowText(state)) : ""}
      ${stat("Receivers", deployedHere ? String(deployed(state).filter((m) => m.id !== module.id && m.pos !== null && module.pos !== null && adjacent(m.pos, module.pos)).length) : "—")}`;
  } else if (module.type === "infusor") {
    chargeStats = `
      ${stat("Bonus to adjacent", `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(chargeStrength))}%`)}
      ${stat("Charge", chargeStrength > 0 ? `strength ${formatNumber(chargeStrength)}` : "none")}`;
  } else {
    const named = preview.namedChords.filter((c) => c.moduleIds.includes(module.id)).map((c) => c.name);
    const pairCount = preview.pairs.filter((p) => p.a === module.id || p.b === module.id).length;
    const chordSummary =
      named.length > 0
        ? `${named.join(" + ")}${pairCount > 0 ? ` + ${times(pairCount, "pair")}` : ""}`
        : pairCount > 0
          ? times(pairCount, "chord pair")
          : "chordless";
    const pitch = contribution?.pitch ?? null;
    chargeStats = `
      ${stat("Pitch", pitch !== null ? `P${pitch} — ${pitch - 1} hex${pitch === 2 ? "" : "es"} from the Carrier` : "—")}
      ${stat("Chords", chordSummary)}
      ${stat("Charge", chargeStrength > 0 ? `strength ${formatNumber(chargeStrength)} (×${formatNumber(chargedFactor(chargeStrength))})` : "none")}`;
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
          <small class="upgrade-gain">+${formatNumber((growth - 1) * 100)}% → ${nominalGainText(module)}</small>
        </span>
        <strong>${formatInt(cost)} ν</strong>
      </button>
      ${upgrade ? `<p class="countdown mono" data-live="countdown">${upgradeCountdown(app, cost) ?? ""}</p>` : ""}
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

/* ── Focus-app panels (popover bodies, ADR-0012) ───── */

function appPanelBody(app: App, panel: FocusApp): string {
  const { state } = app;
  const upgrade = state.mode === "upgrade";

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
      return `<section class="focus-controls">
        <span class="eyebrow">FOCUS CONTROLS</span>
        <p class="habit-active-name">${active ? escapeHtml(active.name) : "Unstructured practice"}</p>
        <p class="small muted" style="margin-top:4px">${active ? "Locked for this session — selected before entering flow." : "No habit selected; the session still counts as practice."}</p>
        ${active ? `<div class="stat-row"><span>This session</span><span class="mono" data-live="habit-session">${formatClock(state.session?.elapsed ?? 0)} of practice</span></div>` : ""}
      </section>`;
    }
    return `<section class="focus-controls">
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

  if (panel === "time") {
    if (upgrade) {
      return `<section class="focus-controls">
        <span class="eyebrow">PLANNED TARGET</span>
        <div class="time-plan">
          <select id="console-duration" aria-label="Session duration">${durationOptionsHtml(app)}</select>
          <p class="clock-caption">${app.ui.chosenTarget === null ? "Open-ended" : "Planned practice"}</p>
        </div>
        <p class="small muted" style="margin-top:10px">The next session aims at the planned target; open-ended sessions run until you exit flow.</p>
      </section>`;
    }
    const elapsed = state.session?.elapsed ?? 0;
    const target = state.session?.target ?? null;
    const paused = state.mode === "paused";
    return `<section class="focus-controls">
      <span class="eyebrow">THIS SESSION</span>
      <p class="session-clock mono" data-live="time-clock">${formatClock(elapsed)}</p>
      <p class="clock-caption" data-live="time-caption">${sessionCaption(elapsed, target, paused)}</p>
      <div class="time-track wide"><span data-live="time-track" style="width:${sessionTrackWidth(elapsed, target)}"></span></div>
      <p class="small muted" style="margin-top:10px">Timing rides with your practice; the session itself starts and ends at the console switch.</p>
    </section>`;
  }

  if (panel === "notes") {
    const recent = [...state.notes].slice(-8).reverse();
    const capture = canWriteNotes(state);
    return `<section class="focus-controls">
      <span class="eyebrow">FOCUS CONTROLS</span>
      ${capture
        ? `<textarea class="note-composer" id="note-composer" placeholder="What are you noticing?" maxlength="2000" rows="3"></textarea>
           <div class="session-actions" style="margin:10px 0 0"><button class="primary" id="note-save">Capture note</button></div>`
        : `<p class="small muted">Note capture happens during flow.</p>`}
      ${recent.length > 0 ? `<div class="note-list">${recent.map((n) => `<div class="note-entry"><span class="note-when mono">S${n.sessionId} · ${formatClock(n.atElapsed)}</span><p>${escapeHtml(n.text)}</p></div>`).join("")}</div>` : ""}
    </section>`;
  }

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
      <small class="mono" data-goal-minutes="${goal.id}">${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · ×${goal.completedCount} completed` : ""}</small>
    </div>`;
  };
  return `<section class="focus-controls">
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

function bindAppPanel(app: App, scope: HTMLElement): void {
  scope.querySelector("#app-close")?.addEventListener("click", () => app.closeApp());
  const duration = scope.querySelector("#console-duration");
  duration?.addEventListener("change", () => {
    const v = (duration as HTMLSelectElement).value;
    app.ui.chosenTarget = v === "open" ? null : Number(v);
    app.render();
  });
  scope.querySelector("#habit-create")?.addEventListener("click", () => {
    const input = scope.querySelector("#habit-name-input") as HTMLInputElement | null;
    if (input) app.createHabitAction(input.value);
  });
  const nameInput = scope.querySelector("#habit-name-input");
  nameInput?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      app.createHabitAction(input.value);
    }
  });
  scope.querySelectorAll<HTMLElement>("[data-pick]").forEach((button) => {
    button.addEventListener("click", () => app.selectHabitAction(button.getAttribute("data-pick")));
  });
  scope.querySelectorAll<HTMLElement>("[data-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      app.ui.editingHabitId = button.getAttribute("data-rename");
      app.render();
      const input = scope.querySelector("#habit-rename-input") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-archive]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-archive");
      if (id) app.archiveHabitAction(id);
    });
  });
  const renameInput = scope.querySelector("#habit-rename-input");
  renameInput?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      const id = app.ui.editingHabitId;
      if (id) app.renameHabitAction(id, (event.target as HTMLInputElement).value);
    }
    if ((event as KeyboardEvent).key === "Escape") {
      event.stopPropagation();
      app.ui.editingHabitId = null;
      app.render();
    }
  });
  scope.querySelector("#habit-rename-save")?.addEventListener("click", () => {
    const id = app.ui.editingHabitId;
    const input = scope.querySelector("#habit-rename-input") as HTMLInputElement | null;
    if (id && input) app.renameHabitAction(id, input.value);
  });
  scope.querySelector("#habit-log-add")?.addEventListener("click", () => {
    const input = scope.querySelector("#habit-log-minutes") as HTMLInputElement | null;
    if (input && input.value) app.logPracticeAction(Number(input.value));
  });
  scope.querySelector("#goal-add")?.addEventListener("click", () => {
    const habitSelect = scope.querySelector("#goal-habit") as HTMLSelectElement | null;
    const minutesInput = scope.querySelector("#goal-minutes") as HTMLInputElement | null;
    const scheduleSelect = scope.querySelector("#goal-schedule") as HTMLSelectElement | null;
    if (!habitSelect || !minutesInput || !scheduleSelect || !minutesInput.value) return;
    app.createGoalAction(
      habitSelect.value === "" ? null : habitSelect.value,
      Number(minutesInput.value),
      scheduleSelect.value as "once" | "daily" | "weekly",
    );
  });
  scope.querySelectorAll<HTMLElement>("[data-goal-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-goal-delete");
      if (id) app.deleteGoalAction(id);
    });
  });
  const composer = scope.querySelector("#note-composer") as HTMLTextAreaElement | null;
  const saveNote = () => {
    if (!composer) return;
    app.addNote(composer.value);
    // A successful save rebuilds the panel with a fresh composer; refocus it.
    const fresh = scope.querySelector("#note-composer") as HTMLTextAreaElement | null;
    if (fresh) fresh.focus();
  };
  scope.querySelector("#note-save")?.addEventListener("click", saveNote);
  composer?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter" && ((event as KeyboardEvent).metaKey || (event as KeyboardEvent).ctrlKey)) {
      event.preventDefault();
      saveNote();
    }
  });
}

// Values that move during flow without rebuilding the popover: clocks,
// practice tallies, and goal progress.
function updateAppPanelLive(app: App, scope: ParentNode): void {
  const { state } = app;
  const elapsed = state.session?.elapsed ?? 0;
  const target = state.session?.target ?? null;
  const paused = state.mode === "paused";
  liveText(scope, "habit-session", `${formatClock(elapsed)} of practice`);
  liveText(scope, "time-clock", formatClock(elapsed));
  liveText(scope, "time-caption", sessionCaption(elapsed, target, paused));
  const track = scope.querySelector('[data-live="time-track"]') as HTMLElement | null;
  const width = sessionTrackWidth(elapsed, target);
  if (track && track.style.width !== width) track.style.width = width;
  for (const habit of state.habits) {
    const node = scope.querySelector(`[data-habit-seconds="${habit.id}"]`);
    const display = formatDuration(habit.seconds);
    if (node && node.textContent !== display) node.textContent = display;
  }
  for (const goal of state.goals) {
    const required = goalRequiredSeconds(goal);
    const bar = scope.querySelector(`[data-goal-progress="${goal.id}"]`) as HTMLElement | null;
    const barWidth = `${Math.min(100, (goal.progressSeconds / required) * 100)}%`;
    if (bar && bar.style.width !== barWidth) bar.style.width = barWidth;
    const minutes = scope.querySelector(`[data-goal-minutes="${goal.id}"]`);
    const display = `${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · ×${goal.completedCount} completed` : ""}`;
    if (minutes && minutes.textContent !== display) minutes.textContent = display;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function effectTextFor(module: ModuleInstance, value: number, strength = 0): string {
  switch (module.type) {
    case "carrier":
    case "additive":
    case "conditional":
      return `+${formatNumber(value)} ν/s`;
    case "generator":
    case "focusKeyed":
      return `${formatNumber(modulePower(module))} strength`;
    case "infusor":
      return `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(strength))}% to adjacent`;
    default:
      return `${formatNumber(value)} progress/s`;
  }
}

function nominalGainText(module: ModuleInstance): string {
  const now = nominalEffect(module, false);
  const growth = BALANCE.rarityPower[module.rarity];
  if (isSource(module)) {
    return `+${formatNumber(now.value * (growth - 1))} strength`;
  }
  if (module.type === "forge") {
    return `${formatNumber(now.value * (growth - 1))} progress/s`;
  }
  return `+${formatNumber(now.value * (growth - 1))} effect`;
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
        ? [app.ui.showAcquired, wholeNous(app.state), JSON.stringify(app.state.purchased), app.state.cellsBought]
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

  // Cells (ADR-0013): the permanent catalog row. The price is not quoted
  // here — it lives where the purchase commits, on the board's frontier.
  const cellPrice = cellCost(state.cellsBought);
  const cellAffordable = wholeNous(state) >= cellPrice;
  const cellCountdown = upgradeCountdown(app, cellPrice);

  content.innerHTML = `
    ${modalTop("CATALOG")}
    <h2 id="modal-title">Shape what comes next.</h2>
    <p class="lead">The starter shelf: one offer per category, once each — plus board cells, always. ${formatInt(state.nous)} ν available.</p>
    ${openShelf.length > 0 ? `
      <h3 class="store-section-title">Starter shelf</h3>
      <div class="shop-list">${openShelf.map((type) => {
        const price = BALANCE.shelfPrices[type];
        const affordable = wholeNous(state) >= price;
        const countdown = upgradeCountdown(app, price);
        return `<div class="shop-item">
          <div><h3>${META[type].name}</h3><small>${META[type].role}</small></div>
          <span class="shop-buy">
            <button class="primary" data-buy="${type}" ${affordable ? "" : "disabled"}>${formatInt(price)} ν</button>
            ${countdown ? `<small class="shop-countdown mono">${countdown}</small>` : ""}
          </span>
        </div>`;
      }).join("")}</div>` : ""}
    ${openShelf.length === 0 ? `<p class="empty-copy">The shelf is empty. New modules come from the Forge.</p>` : ""}
    <h3 class="store-section-title">Cells</h3>
    <div class="shop-list">
      <div class="shop-item">
        <div><h3>Board cell</h3><small>Empty hexes to place modules on — you choose where it touches the board.</small></div>
        <span class="shop-buy">
          <button class="primary" id="buy-cell" ${cellAffordable ? "" : "disabled"} title="${cellAffordable ? "Arm the purchase — pick a frontier hex on the board; the price shows there" : "Not enough nous"}">Buy cell</button>
          ${cellCountdown}
        </span>
      </div>
    </div>
    <p class="small muted" style="margin-top:6px">Each cell bought raises the next price — the board shows it before you commit.</p>
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
  byId("buy-cell")?.addEventListener("click", () => app.armCellPurchase());
  byId("store-show-acquired")?.addEventListener("change", (event) => {
    app.ui.showAcquired = (event.target as HTMLInputElement).checked;
    app.render();
  });
  wireClose(app);
}

function forgeEffect(type: ModuleInstance["type"], state: GameState): string {
  const charged = chargedFactor(1);
  switch (type) {
    case "carrier": return `The granted origin module — never rolled<br>+${formatNumber(BALANCE.carrierRate * charged)} ν/s at charge strength 1`;
    case "additive": return `+${formatNumber(BALANCE.additiveRate)} ν/s harmonic term<br>+${formatNumber(BALANCE.additiveRate * charged)} ν/s at charge strength 1`;
    case "conditional": return `+${formatNumber(BALANCE.conditionalRate)} ν/s harmonic term<br>+${formatNumber(BALANCE.conditionalRate * charged)} ν/s at charge strength 1`;
    case "generator": return `${formatNumber(1)} charge strength per second of flow<br>empowers adjacent modules continuously`;
    case "focusKeyed": return `A generator keyed to your focus<br>every session end banks a charge window of practice time — spent as its output next session`;
    case "infusor": return `+${formatNumber(BALANCE.infusorBonus * 100)}% to adjacent production contributions<br>+${formatNumber(BALANCE.infusorBonus * charged * 100)}% at charge strength 1`;
    case "forge": return `1 Forge progress per received charge strength<br>Next roll: ${formatNumber(forgeThreshold(state.forge.earned))} progress`;
    default: return "Not yet active";
  }
}

function candidateHeadline(type: ModuleInstance["type"]): string {
  switch (type) {
    case "carrier":
      return `+${formatNumber(BALANCE.carrierRate)} ν/s`;
    case "additive":
      return `+${formatNumber(BALANCE.additiveRate)} ν/s`;
    case "conditional":
      return `+${formatNumber(BALANCE.conditionalRate)} ν/s`;
    case "generator":
      return "1× charge while flowing";
    case "focusKeyed":
      return "charge from focus time";
    case "infusor":
      return `+${formatNumber(BALANCE.infusorBonus * 100)}%`;
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
          <span class="rarity" style="color:var(--finish-${candidate.rarity})">${RARITY_LABEL[candidate.rarity]}</span>
          <span class="candidate-scaling">+${formatNumber((BALANCE.rarityPower[candidate.rarity] - 1) * 100)}% / level · upgrades from 10 ν</span>
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
