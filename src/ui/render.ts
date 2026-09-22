import { chargedFactor, cellCost, computeRates, deployed, emittedStrength, isSource, levelCost, longGoalCost, modulePower, nominalContribution, wholeNous } from "../engine/economy";
import { deployedAt } from "../engine/economy";
import { adjacent, sameHex } from "../engine/hex";
import { forgeThreshold } from "../engine/rolls";
import { BALANCE, NEXT_RARITY, REFLECTION_SLIDER_NEUTRAL } from "../engine/constants";
import { formatClock, formatDuration } from "../engine/clock";
import { appActive, appLockNote, FOCUS_APPS, type FocusApp } from "../engine/apps";
import { isInFlowNote } from "../engine/notes";
import { activeHabit } from "../engine/habits";
import {
  habitRecordName,
  habitPracticeSummary,
  habitTaggedNotes,
  recordMissed,
  recordTargetHit,
  sessionRecordsNewestFirst,
} from "../engine/records";
import { poolOutstanding } from "../engine/trust";
import { goalCapacity, goalRequiredSeconds, goalSummary } from "../engine/goals";
import { achievementName } from "../engine/achievements";
import { isCarrier } from "../engine/state";
import type { GameState, Goal, Habit, Hex, ModuleInstance, NoteEntry, RateSnapshot } from "../engine/types";
import type { App } from "./app";
import { appIcon } from "./icons";
import { HEX_RADIUS, hexApothem, hexPoints, moduleFace } from "./face";
import { effectLine, faceReadout, PINNED_SENTENCE, typeProse, upgradeGain } from "./lexicon";
import { chargeGlow, chargeLeads } from "./leads";
import { chordOverlay } from "./chordlayer";
import { updateSvg } from "./svg";
import { APP_LABELS, HISTORY_PAGE_ROWS, META, RARITY_LABEL } from "./meta";
import { formatDate, formatInt, formatNumber, formatPracticeMinutes, practiceCountdown, secondsToMinutes } from "./format";
import { renderStatusMonitor } from "./monitor";
import { byId, escapeHtml } from "./dom";
import { bindPlanControls, planControlsHtml } from "./plan";
import { contextFor } from "./context";
import { honestyEventLine } from "./honesty";
import { renderModals } from "./modals";

const SPACING = 65;
const DRAG_THRESHOLD_PX = 6;
const boundCells = new WeakSet<SVGElement>();

function point({ q, r }: Hex): [number, number] {
  return [Math.sqrt(3) * SPACING * (q + r / 2), SPACING * 1.5 * r];
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
  // One context per render pass: the modals and monitor regions (and, as
  // each remaining region extracts, the rest) read state and fire intents
  // through it, with the shared derivations memoized per pass.
  const ctx = contextFor(app);
  renderConsoleSession(app);
  renderConsoleApps(app);
  renderConsoleReadout(app);
  renderTools(app);
  renderGrid(app);
  renderStatusMonitor(ctx);
  renderInspector(app);
  renderWelcome(app);
  renderModals(ctx);
  renderDev(app);
}

/* ── Welcome card (§5.1) ───────────────────────────── */

// The one-time opening card: the Carrier is granted and its first upgrade is
// already affordable. Unforced — it locks nothing, and acknowledging or
// dismissing it once (persisted in the save) keeps it away forever. It is an
// upgrade-mode surface: it stands down for live sessions.
function renderWelcome(app: App): void {
  const host = byId("welcome-card");
  if (!host) return;
  if (app.state.welcomeAcked || app.state.mode !== "upgrade") {
    host.hidden = true;
    delete host.dataset.renderKey;
    return;
  }
  host.hidden = false;
  if (host.dataset.renderKey === "open") return;
  host.dataset.renderKey = "open";
  host.innerHTML = `
    <div class="welcome-top">
      <span class="eyebrow">WELCOME</span>
      <button class="welcome-dismiss" id="welcome-dismiss" aria-label="Dismiss the welcome card">✕</button>
    </div>
    <p class="welcome-copy">Your <strong>Carrier</strong> is granted — its first upgrade is already affordable.</p>
    <button class="primary" id="welcome-cta">Upgrade the Carrier</button>
    `;
  byId("welcome-cta")?.addEventListener("click", () => app.ackWelcomeToCarrier());
  byId("welcome-dismiss")?.addEventListener("click", () => app.dismissWelcome());
}

/* ── Console (ADR-0012) ────────────────────────────── */

// The unplanned shape's two words (§6): the clock slot only ever holds clock
// text, so an unplanned plan wears a dash placeholder there, while captions
// and the Time tile's compact plan name the mode itself.
const CLOCK_PLACEHOLDER = "--:--";
const OPEN_ENDED_WORD = "open-ended";

// Session controls: the clock block plus the Enter/Exit main switch and the
// pause control. The switch is the console's sole session gate — sessions
// start and end through it — and the switch's vermillion is the one colored
// console element: the switch itself and, while a session runs, the progress
// strip along the header's bottom edge (issue #63).
function renderConsoleSession(app: App): void {
  const { state } = app;
  const host = byId("console-session");
  if (!host) return;

  const switchSvg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.2 6.6a8 8 0 1 0 11.6 0"/></svg>`;

  if (state.mode === "upgrade") {
    // Structural key: only rebuild when the shape of the section changes, so
    // control nodes (and in-flight clicks) survive clock ticks. The clock
    // wears the next session's target in flow's clock styles; an unplanned
    // open-ended shape wears a placeholder so the slot only ever holds
    // clock text, with "planned" (or "open-ended") naming the mode in the
    // caption slot. No session runs, so the header's progress strip stays
    // empty.
    const planned = app.ui.chosenTarget !== null;
    const key = `upgrade:${planned}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      host.innerHTML = `
        <div class="console-clock">
          <p class="session-clock mono">${planned ? formatClock(app.ui.chosenTarget!) : CLOCK_PLACEHOLDER}</p>
          <p class="clock-caption">${planned ? "planned" : OPEN_ENDED_WORD}</p>
        </div>
        <div class="session-actions">
          <button class="main-switch idle" id="flow-switch" title="Enter flow — the board locks and runs itself">
            ${switchSvg}<span>Enter flow</span><i class="switch-state" aria-hidden="true"></i>
          </button>
        </div>`;
      byId("flow-switch")?.addEventListener("click", () => app.startFlow());
    }
    renderSessionStrip(false);
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
        <p class="session-clock mono" id="session-clock"></p>
        <p class="clock-caption" id="session-caption"></p>
        <p class="clock-provisional" id="session-provisional" role="status"></p>
      </div>
      <div class="session-actions">
        <button id="pause-flow">${paused ? "Resume" : "Pause"}</button>
        <button class="main-switch ${paused ? "held" : "live"}" id="flow-switch" title="Exit flow — end the session and bank its production">
          ${switchSvg}<span>Exit flow</span><i class="switch-state" aria-hidden="true"></i>
        </button>
      </div>`;
    byId("pause-flow")?.addEventListener("click", () => (state.mode === "paused" ? app.resume() : app.pause()));
    byId("flow-switch")?.addEventListener("click", () => app.endFlow());
  }

  // Live values update in place; the controls above are never replaced by ticks.
  // Planned sessions count down what remains; open-ended ones count up, with
  // the header's progress strip pulsing calmly instead of filling.
  const set = (id: string, text: string) => {
    const node = byId(id);
    if (node && node.textContent !== text) node.textContent = text;
  };
  set("session-clock", formatClock(target !== null ? Math.max(0, target - elapsed) : elapsed));
  set("session-caption", sessionCaption(elapsed, target, paused));
  // The provisional bucket is visibly flagged while it holds (§2): the pool
  // minutes and the nous waiting on the honesty report, in the switch's
  // vermillion so it reads from across the room.
  const accounting = session?.accounting;
  set(
    "session-provisional",
    accounting && poolOutstanding(state)
      ? `${formatDuration(accounting.poolSeconds)} provisional · ${formatNumber(accounting.bucketNous)} ν held`
      : "",
  );
  renderSessionStrip(true, elapsed, target, paused);
}

// The header's bottom edge is the progress surface (issue #63): a thin strip
// pinned along it, wearing the switch's vermillion so flow reads from across
// the room. Planned sessions fill it left-to-right; open-ended ones pulse
// calmly at full width; paused holds it still; idle leaves it empty.
// Tick-safe — class and width update in place.
function renderSessionStrip(running: boolean, elapsed = 0, target: number | null = null, paused = false): void {
  const strip = byId("session-strip");
  const fill = byId("session-strip-fill");
  if (!strip || !fill) return;
  strip.classList.toggle("pulse", running && target === null && !paused);
  const width = !running ? "0%" : target === null ? "100%" : plannedFill(elapsed, target);
  if (fill.style.width !== width) fill.style.width = width;
}

// The running-session caption shared by the console clock block and the Time
// app's popover (§2.2). Every running state names itself — paused,
// open-ended, target reached, or what remains of the plan.
function sessionCaption(elapsed: number, target: number | null, paused: boolean): string {
  const reached = target !== null && elapsed >= target;
  return paused
    ? "paused"
    : target === null
      ? OPEN_ENDED_WORD
      : reached
        ? "target reached"
        : `of ${formatClock(target)}`;
}

// Share of a planned session already practiced, as a fill percentage.
function plannedFill(elapsed: number, target: number): string {
  return `${Math.min(100, (elapsed / target) * 100)}%`;
}

// Fill width for the Time app popover's local track; open-ended leaves it
// empty — the console header's strip is what pulses for those.
function sessionTrackWidth(elapsed: number, target: number | null): string {
  return target === null ? "0%" : plannedFill(elapsed, target);
}

// In-place text swap for a data-live node within a scope; tick-safe.
function liveText(scope: ParentNode, live: string, text: string): void {
  const node = scope.querySelector(`[data-live="${live}"]`);
  if (node && node.textContent !== text) node.textContent = text;
}

// Focus-app access (ADR-0012): one tile per app — the launch four live
// from minute 0 (ADR-0019), each wearing its live state, with its panel
// opening as a popover anchored directly beneath the tile. The locked-tile
// plumbing stays for a future ladder tenant; locked tiles would open
// nothing, and the board never moves, reflows, or dims while the console
// is used.
// (Display names live in meta.ts's APP_LABELS.)

function renderConsoleApps(app: App): void {
  const host = byId("console-apps");
  if (!host) return;
  const { state, ui } = app;
  const key = JSON.stringify([
    ui.app,
    state.mode,
    state.sessionsCompleted === 0,
    state.activatedApps.join("|"),
    state.goalCapacityBought,
    state.habits.map((h) => `${h.archived ? "·" : ""}${h.name}`).join("|"),
    state.activeHabitId,
    ui.editingHabitId,
    state.notes.length,
    state.goals.map((g) => (g.completed ? "1" : "0") + g.condition.minutes + (g.condition.habitId ?? "") + g.schedule.kind).join("|"),
    ui.chosenTarget,
    // The history surfaces (§9): the list view, its page, the drilled
    // record, and the expanded habit summary each rebuild the popover.
    ui.historyOpen,
    ui.drillSession,
    ui.historyLimit,
    ui.summaryHabitId,
    state.sessionRecords.length,
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
    // The tile wears the app's live state instead of its name: the Habit
    // tile shows the selected habit (or that none is), the Time tile the
    // current plan; Notes and Goals are icon-only. Nothing is locked at
    // launch (ADR-0019) — no tile is spotlighted, none greyed.
    let stateText: string | null = null;
    if (appKey === "habit") {
      stateText = activeHabit(state)?.name ?? "no habit";
    } else if (appKey === "time") {
      stateText = planShort(ui.chosenTarget);
    }
    const title =
      stateText !== null && active
        ? `${label} app`
        : note
          ? `${label} — locked: ${note}`
          : `${label} app`;
    return `<div class="app-slot${anchor}">
      <button class="app-tile${active ? "" : " locked"}${open ? " open" : ""}" id="app-tile-${appKey}" aria-pressed="${open}"${active ? "" : ' aria-disabled="true"'} title="${title}">
        <span class="app-tile-glyph">
          <svg viewBox="-12 -12 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${appIcon(appKey)}</svg>
        </span>
        ${stateText ? `<span class="app-tile-state">${escapeHtml(stateText)}</span>` : ""}
      </button>
      ${open ? `<div class="app-popover" id="app-popover">${appPanelBody(app, appKey)}</div>` : ""}
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

// The Time tile's compact plan: the clock, or the mode word for open-ended.
function planShort(chosenTarget: number | null): string {
  return chosenTarget === null ? OPEN_ENDED_WORD : formatClock(chosenTarget);
}

const TROPHY_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
  <path d="M4 22h16"/>
  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
</svg>`;

// The console's readout end: production (rate with the session total
// beneath) and the nous balance — bare values; the main switch carries the
// mode. Static slots are built once; tick-moving values update in place.
function renderConsoleReadout(app: App): void {
  const { state } = app;
  const strip = byId("console-status");
  if (strip) {
    if (strip.childElementCount === 0) {
      strip.innerHTML = `
        <div class="console-slot production-slot">
          <strong class="mono" data-live="rate"></strong>
          <small class="mono session-total" data-live="session"></small>
        </div>
        <div class="console-slot trophy-slot">
          <button class="trophy-glyph" id="trophy-button" title="Achievements — every feat, and how close the next one is" aria-label="Achievements">${TROPHY_SVG}</button>
        </div>`;
      byId("trophy-button")?.addEventListener("click", () => app.openModal("achievements"));
    }
    // One production readout (§7: rates per-second everywhere): the ν/s
    // figure matches the formula chip — projected in upgrade mode, ticking
    // with the board in flow — and the flow session appends what it made.
    const rate = currentSnapshot(state).rate;
    const session = state.session;
    const rateNode = strip.querySelector('[data-live="rate"]');
    const rateText = `${formatNumber(rate)} ν/s`;
    if (rateNode && rateNode.textContent !== rateText) rateNode.textContent = rateText;
    const sessionNode = strip.querySelector('[data-live="session"]');
    const sessionText = session ? `${formatNumber(session.earned)} ν this session` : "";
    if (sessionNode && sessionNode.textContent !== sessionText) sessionNode.textContent = sessionText;
  }
  const nous = byId("nous-balance");
  if (nous) {
    if (nous.childElementCount === 0) {
      nous.innerHTML = `<strong class="mono" data-live="nous"></strong>`;
    }
    const amount = nous.querySelector('[data-live="nous"]');
    // The counter reads whole nous — what is actually spendable — so the
    // ticking decimals never flicker in and out of the readout.
    const text = `${formatInt(state.nous)} ν`;
    if (amount && amount.textContent !== text) amount.textContent = text;
  }
}

const CELL_TOOL_SVG = `<svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0-6v12M-6 0h12"/></svg>`;

function renderTools(app: App): void {
  const { state, ui } = app;
  const host = byId("board-tools");
  if (!host) return;
  const upgrade = state.mode === "upgrade";
  const key = JSON.stringify([upgrade, state.bankedRolls.length, ui.managing, ui.buyingCell, ui.showChords]);
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    const forgeReady = upgrade && state.bankedRolls.length > 0;
    host.innerHTML = `
      <button class="small" id="tool-store" ${upgrade ? "" : "disabled"} title="${upgrade ? "The catalog: starter-shelf offers and board cells" : "Purchases happen between sessions"}">Catalog</button>
      <button class="small tool-forge" id="tool-forge" ${forgeReady ? "" : "disabled"} title="">
        <span>Forge${state.bankedRolls.length > 0 ? ` · ${state.bankedRolls.length}` : ""}</span>
        <i class="forge-pip" aria-hidden="true"><i data-live="forge-pip"></i></i>
      </button>
      <button class="small ${app.managing ? "active" : ""}" id="tool-manage" ${upgrade ? "" : "disabled"} aria-pressed="${app.managing}" title="${app.managing ? "Exit arranging (Esc)" : upgrade ? "Move modules" : "The grid is locked during flow"}">Grid &amp; inventory</button>
      <button class="small tool-cell${ui.buyingCell ? " active" : ""}" id="tool-cell" ${upgrade ? "" : "disabled"} aria-pressed="${ui.buyingCell}" title="">${CELL_TOOL_SVG}</button>
      <button class="small${ui.showChords ? " active" : ""}" id="tool-chords" aria-pressed="${ui.showChords}" title="Show chords — light the chord voices, link the pairs, outline and label named chords · C">Chords</button>`;
    byId("tool-store")?.addEventListener("click", () => app.openModal("store"));
    byId("tool-forge")?.addEventListener("click", () => app.openModal("forge"));
    byId("tool-manage")?.addEventListener("click", () => (app.ui.managing ? app.stopManaging() : app.startManaging()));
    byId("tool-cell")?.addEventListener("click", () => (app.ui.buyingCell ? app.cancelCellPurchase() : app.armCellPurchase()));
    byId("tool-chords")?.addEventListener("click", () => app.toggleChords());
  }
  // Live under the structural rebuild: the Forge pip tracks the shared
  // meter, and the cell icon wears the current price and affordability.
  const cap = forgeThreshold(state.forge.earned);
  const pip = host.querySelector<HTMLElement>('[data-live="forge-pip"]');
  const pipWidth = `${(Math.min(1, Math.max(0, state.forge.progress / cap)) * 100).toFixed(1)}%`;
  if (pip && pip.style.width !== pipWidth) pip.style.width = pipWidth;
  const forgeButton = byId("tool-forge");
  if (forgeButton) {
    forgeButton.title =
      state.bankedRolls.length > 0
        ? `Forge progress ${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(cap)} · ${state.bankedRolls.length} banked choice${state.bankedRolls.length === 1 ? "" : "s"}`
        : `Forge progress ${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(cap)} — charge feeds it`;
  }
  const cellButton = byId("tool-cell") as HTMLButtonElement | null;
  if (cellButton && upgrade) {
    const price = cellCost(state.cellsBought);
    if (ui.buyingCell) {
      cellButton.title = "Pick a frontier hex · Esc cancels";
    } else {
      const countdown = practiceCountdown(price, wholeNous(state), computeRates(state, true).rate);
      cellButton.title = `New cell — ${formatInt(price)} ν${countdown ? ` · ${countdown}` : ""}`;
      cellButton.disabled = wholeNous(state) < price;
    }
  }
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
  svg.classList.toggle("chord-view", ui.showChords);

  const flow = state.mode === "flow";
  const snapshot = currentSnapshot(state);
  const selectedModule = state.modules.find((m) => m.id === ui.selected) ?? null;

  // The chord view (issue #62): a display-only read of the board's chord
  // terms — the same pairs and named chords the formula chip names, drawn
  // where they live. Chord voices stay lit; everything else dims; pair links
  // and named-chord hulls wear the chord register. Purely cosmetic: no
  // gating, no gameplay effect, available in every mode.
  const deployedById = new Map(state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m]));
  const overlay = ui.showChords
    ? chordOverlay({
        pairs: snapshot.pairs,
        namedChords: snapshot.namedChords,
        posOf: (id) => deployedById.get(id)?.pos ?? null,
        point,
        radius: HEX_RADIUS,
        pad: 5,
        labelFor: (chord) => `${chord.name} ×${formatNumber(1 + chord.bonus)}`,
      })
    : null;
  const nodeClass = (moduleId: string | null): string =>
    ui.showChords ? `cell-node ${moduleId !== null && overlay!.participants.has(moduleId) ? "chord-lit" : "chord-dim"}` : "cell-node";

  // Charge leads (§8, #41): uniform green patch leads, center-to-center,
  // directional generator → receiver. Leads in live flow animate; everything
  // else — paused, upgrade mode (charge pauses between sessions, ADR-0001),
  // or a generator whose charge window is spent — sits dim and static as
  // wiring previews (ADR-0002).
  let html = CHARGE_LEAD_DEFS;
  for (const { generator, receiver, emitting } of chargeLeads(state, flow)) {
    if (generator.pos === null || receiver.pos === null) continue;
    const [x1, y1] = point(generator.pos);
    const [x2, y2] = point(receiver.pos);
    const cls = emitting ? "charge-line" : "charge-preview-line";
    html += `<line data-key="charge-${generator.id}-${receiver.id}" class="${cls}" ${leadSegment(x1, y1, x2, y2)}/>`;
  }

  // Chord pair links: seam bridges beneath the faces, in the chord register
  // — the wiring language, re-register for the board's optimization game.
  if (overlay) {
    html += `<g data-key="chord-links">${overlay.links
      .map((link) => `<line data-key="pair-${link.key}" class="chord-link" x1="${link.x1}" y1="${link.y1}" x2="${link.x2}" y2="${link.y2}"/>`)
      .join("")}</g>`;
  }

  for (const pos of state.cells) {
    const [x, y] = point(pos);
    const module = deployedAt(state, pos);
    const isRemoval = ui.reshape?.removes.some((c) => sameHex(c, pos)) ?? false;
    let classes = "hex empty";
    if (isRemoval) classes += " remove-stage";
    if (!module && isTargetCell(app, pos)) classes += " target";
    html += `<g class="${nodeClass(module?.id ?? null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${module ? META[module.type].name : "Empty cell"}">
      ${module ? "" : `<polygon class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>`}`;
    if (module) {
      html += moduleNode(app, module, pos, { snapshot, selectedModule });
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
        html += `<g class="${nodeClass(null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Buy cell here for ${formatInt(price)} nous">
          <polygon class="hex ${affordable ? "buy-here" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
          <text y="-24" text-anchor="middle" class="hex-sub">NEW CELL</text>
          ${affordable ? `<text y="8" text-anchor="middle" fill="var(--accent)" font-size="22">+</text>` : ""}
          <text y="${affordable ? 34 : 8}" text-anchor="middle" class="hex-sub">${formatInt(price)} ν</text>
        </g>`;
      } else {
        const isAdd = ui.reshape?.adds.some((c) => sameHex(c, pos)) ?? false;
        html += `<g class="${nodeClass(null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Expand here">
          <polygon class="hex ${isAdd ? "target" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
          ${isAdd ? `<text y="5" text-anchor="middle" fill="var(--accent)" font-size="20">+</text>` : ""}
        </g>`;
      }
    }
  }

  // Named-chord marks: a hull wrapping each chord's voices plus its
  // formula-chip label, drawn over the faces so a chord names itself.
  if (overlay) {
    html += `<g data-key="chord-marks">${overlay.marks
      .map(
        (mark) =>
          `<g data-key="${mark.key}"><polygon class="chord-hull" points="${mark.points}"/><text class="chord-label mono" x="${mark.labelX}" y="${mark.labelY}">${escapeHtml(mark.label)}</text></g>`,
      )
      .join("")}</g>`;
  }

  updateSvg(svg, html);
  bindGridEvents(app, svg);
}

// Directional tips for the patch leads, in the charge register: full for
// live flow, dimmed for everything that only previews the wiring.
const leadMarker = (id: string, cls: string): string =>
  `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path class="${cls}" d="M0 0 10 5 0 10Z"/></marker>`;
const CHARGE_LEAD_DEFS = `<defs data-key="charge-defs">${leadMarker("fs-lead-tip", "lead-tip")}${leadMarker("fs-lead-tip-dim", "lead-tip-dim")}</defs>`;

// A lead runs center-to-center beneath the faces, trimmed to the chassis:
// the pad is the face's apothem plus a hair, so the lead spans the seam
// between neighboring hexes and the directional tip lands on the receiver's
// edge rather than vanishing under it.
const LEAD_PAD = Math.round(hexApothem(HEX_RADIUS)) + 1;

function leadSegment(x1: number, y1: number, x2: number, y2: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  return `x1="${(x1 + ux * LEAD_PAD).toFixed(2)}" y1="${(y1 + uy * LEAD_PAD).toFixed(2)}" x2="${(x2 - ux * LEAD_PAD).toFixed(2)}" y2="${(y2 - uy * LEAD_PAD).toFixed(2)}"`;
}

interface RenderContext {
  snapshot: ReturnType<typeof computeRates>;
  selectedModule: ModuleInstance | null;
}

function moduleNode(app: App, module: ModuleInstance, _pos: Hex, ctx: RenderContext): string {
  const { ui, state } = app;
  const selected = ui.selected === module.id;
  // Charge is session-bound: the snapshot is flow-gated, so any strength it
  // reports is live. Receivers brighten with their received strength, and a
  // generator lights only while it actually emits (a spent charge window
  // emits nothing).
  const strength = ctx.snapshot.chargeStrength.get(module.id) ?? 0;
  const charged = strength > 0;
  const emittingNow = state.mode === "flow" && isSource(module) && emittedStrength(state, module, true) > 0;
  const contribution = ctx.snapshot.contributions.get(module.id);

  let hexClass = "";
  if (selected) hexClass += " selected";
  if (charged) hexClass += " charged";
  if (emittingNow) hexClass += " dispensing";

  // Highlight eligible receivers while a generator is selected in upgrade mode.
  let highlight = "";
  if (app.state.mode === "upgrade" && ctx.selectedModule && isSource(ctx.selectedModule) && module.id !== ctx.selectedModule.id && module.pos && ctx.selectedModule.pos && adjacent(module.pos, ctx.selectedModule.pos)) {
    highlight = `<polygon data-key="preview" class="highlight-ring" points="${hexPoints(HEX_RADIUS - 4)}"/>`;
  }

  // The chargeable face-hierarchy exception: the Forge's prominent readout is
  // charge-vs-threshold, rendered as a threshold fill with a flash at crossing.
  let under = "";
  let readout: string;
  let readoutClass: string | undefined;
  let note: string | undefined;
  if (module.type === "forge") {
    under = waterFill(module.id, app.state.forge.progress / forgeThreshold(app.state.forge.earned));
    // The face's glanceable readout rounds; the inspector keeps exact values.
    readout = `${formatNumber(Math.floor(Math.max(0, app.state.forge.progress)))}/${formatNumber(Math.round(forgeThreshold(app.state.forge.earned)))}`;
    readoutClass = "charge";
  } else if (isSource(module)) {
    readout = `⌁${formatNumber(modulePower(module))}`;
  } else if (module.type === "infusor") {
    readout = `+${formatNumber(100 * nominalContribution(module, ctx.snapshot.chargeStrength.get(module.id) ?? 0))}%`;
  } else {
    // Synthesizers wear their contribution, pitch beneath it: hex distance
    // from the Carrier + 1.
    readout = `+${formatNumber(contribution?.value ?? 0)}`;
    const pitch = contribution?.pitch ?? null;
    note = pitch !== null ? `P${pitch}` : undefined;
  }

  // The threshold-crossing flash fires for a moment after a roll is minted.
  const crossed = module.type === "forge" && app.forgeFlashUntil > Date.now();

  return `<g class="module-node${crossed ? " forge-crossed" : ""}" data-type="${module.type}" data-rarity="${module.rarity}">
    ${moduleFace({
      type: module.type,
      rarity: module.rarity,
      readout,
      ...(readoutClass ? { readoutClass } : {}),
      ...(note ? { note } : {}),
      level: module.level,
      hexClass: hexClass.trim(),
      under,
      pinned: isCarrier(module),
      ...(charged ? { chargeGlow: chargeGlow(strength) } : {}),
    })}${highlight}
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

// The canonical pinned sentence (#94): the inspector's note and the drag
// refusal's toast say exactly the same thing, once worded.

// The pinned face's visible refusal: a short shake on the module node (which
// only grid cells carry — the Carrier can never reach inventory). The
// translate property keeps the arranging lift intact, and the class restarts
// cleanly on repeat attempts.
function refusePinnedDrag(element: Element): void {
  const node = element.querySelector(".module-node");
  if (!node) return;
  node.classList.remove("pin-refused");
  node.getBoundingClientRect(); // flush style so re-adding restarts the shake
  node.classList.add("pin-refused");
  node.addEventListener("animationend", () => node.classList.remove("pin-refused"), { once: true });
}

// Shared pointer-drag binding for grid modules and inventory items: shows a
// ghost after a small threshold, then drops onto a cell (place, swap, or
// combine with a matching twin) or the inventory zone (return). Click-
// placement stays available without dragging. The pinned Carrier refuses the
// drag at the threshold — a face shake plus the canonical sentence.
function bindPointerDrag(app: App, element: Element, moduleId: string | (() => string | null)): void {
  element.addEventListener("pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || !app.ui.managing || app.state.mode !== "upgrade" || app.ui.reshape || app.ui.buyingCell) return;
    const id = typeof moduleId === "function" ? moduleId() : moduleId;
    if (!id) return;
    const dragModule = app.state.modules.find((m) => m.id === id) ?? null;
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
    let refused = false;
    const move = (ev: PointerEvent) => {
      if (!moved && !refused && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD_PX) {
        if (dragModule && isCarrier(dragModule)) {
          refused = true;
          app.say(PINNED_SENTENCE);
          refusePinnedDrag(element);
          suppressNextClick();
          return;
        }
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
      renderDissolvedOverview(host);
    }
  }
  updateInspectorLive(app, host);
}

// Values that move during flow without rebuilding the panel.
function updateInspectorLive(app: App, host: HTMLElement): void {
  const { state } = app;
  liveText(host, "forge", `${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(forgeThreshold(state.forge.earned))}`);
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
}

// The upgrade-mode countdown for a price on this board: phrased against the
// board's projected next-session rate (the charged preview, whatever the
// current mode); null (hidden) when affordable or rateless.
function upgradeCountdown(app: App, cost: number): string | null {
  return practiceCountdown(cost, wholeNous(app.state), computeRates(app.state, true).rate);
}

// The grid overview dissolved into the status monitor (issue #38): the
// expansion meter and cell tokens retired, banked rolls moved to the Forge
// surface, charge info to board and module surfaces, counts to the views
// that describe them, and the static formula explainer to the monitor's
// formula chip. When nothing is selected the inspector only points.
function renderDissolvedOverview(host: HTMLElement): void {
  host.innerHTML = `
    <div class="inspector-empty">
      <div class="eyebrow">INSPECTOR</div>
      <p class="small muted" style="margin-top:10px">Select a module to inspect or tune it.</p>
    </div>`;
}

function renderModulePanel(app: App, host: HTMLElement, module: ModuleInstance): void {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  const meta = META[module.type];
  const preview = computeRates(state, true);
  const contribution = module.pos !== null ? preview.contributions.get(module.id) : null;
  const deployedHere = module.pos !== null;
  const chargeStrength = preview.chargeStrength.get(module.id) ?? 0;
  const effectText =
    deployedHere && contribution && contribution.value !== 0
      ? effectLine(module, { value: contribution.value, strength: chargeStrength })
      : effectLine(module, null, upgrade);
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
      ${statLive("window", "Charge window", chargeWindowText(state))}
      ${stat("Receivers", deployedHere ? String(deployed(state).filter((m) => m.id !== module.id && m.pos !== null && module.pos !== null && adjacent(m.pos, module.pos)).length) : "—")}`;
  } else if (module.type === "infusor") {
    chargeStats = `
      ${stat("Bonus to adjacent", `+${formatNumber(100 * nominalContribution(module, chargeStrength))}%`)}
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
      <button class="quiet small" id="back-overview">← Back</button>
      <h1>${meta.name}</h1>
      <span class="rarity-chip ${module.rarity}">${RARITY_LABEL[module.rarity]}${carrier ? " · pinned" : ""}</span>
    </div>
    ${focus}
    <section>
      <div class="eyebrow">MODULE POWER</div>
      <div class="level-heading">Level <strong>${module.level}</strong><span class="level-effect">${effectText}</span></div>
      <p class="small muted" style="margin:6px 0 0">${typeProse(module.type)}</p>
      <button class="primary upgrade-cta" id="upgrade-module" ${upgrade && affordable ? "" : "disabled"}>
        <span>Upgrade
          <small class="upgrade-gain">+${formatNumber((growth - 1) * 100)}% → ${upgradeGain(module)}</small>
        </span>
        <strong>${formatInt(cost)} ν</strong>
      </button>
      ${upgrade ? `<p class="countdown mono" data-live="countdown">${upgradeCountdown(app, cost) ?? ""}</p>` : ""}
      ${!upgrade ? `<p class="small muted">Upgrades happen between sessions.</p>` : ""}
      ${carrier ? `<p class="small muted">${PINNED_SENTENCE}</p>` : ""}
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

// One habit row (§9): the pick/rename/archive controls plus the development
// summary toggle. An archived habit loses the selection controls but keeps
// its summary — archiving hides a habit from selection only.
function habitRowHtml(app: App, habit: Habit, selectable: boolean): string {
  const { state, ui } = app;
  const editing = selectable && app.ui.editingHabitId === habit.id;
  const expanded = ui.summaryHabitId === habit.id;
  const chevron = `<button class="quiet small icon-btn summary-toggle" data-summary="${habit.id}" aria-pressed="${expanded}" title="Development summary">${expanded ? "▾" : "▸"}</button>`;
  const controls = editing
    ? `<input type="text" class="habit-rename-input" id="habit-rename-input" value="${escapeHtml(habit.name)}" maxlength="40" />
       <button class="primary small" id="habit-rename-save">Save</button>${chevron}`
    : selectable
      ? `<button class="habit-pick" data-pick="${habit.id}" title="Make this the active habit">
           <span class="habit-dot" aria-hidden="true"></span>
           <span class="habit-name">${escapeHtml(habit.name)}</span>
           <small class="mono" data-habit-seconds="${habit.id}">${formatDuration(habit.seconds)}</small>
         </button>
         <button class="quiet small" data-rename="${habit.id}" title="Rename">✎</button>
         <button class="quiet small icon-btn" data-archive="${habit.id}" title="Archive (keeps its development)">
           <svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M-7-6h14v3H-7Z"/><path d="M-5-3v8h10v-8"/><path d="M0 0v4"/><path d="m-2 2 2 2 2-2"/></svg>
         </button>${chevron}`
      : `<span class="habit-pick archived">
           <span class="habit-name">${escapeHtml(habit.name)}</span>
           <small class="mono" data-habit-seconds="${habit.id}">${formatDuration(habit.seconds)}</small>
         </span>${chevron}`;
  const selected = selectable && state.activeHabitId === habit.id ? " selected" : "";
  return `<div class="habit-row${selected}" data-habit="${habit.id}">${controls}</div>${expanded ? habitSummaryHtml(app, habit) : ""}`;
}

// The note stamp both note surfaces share (§9): the date where known, then
// the in-session mark — or the between-sessions marker when the note was
// written outside any session.
function noteStampHtml(note: NoteEntry): string {
  return `${note.at > 0 ? `${formatDate(note.at)} · ` : ""}${
    isInFlowNote(note) ? `S${note.sessionId} · ${formatClock(note.atElapsed)}` : "between sessions"
  }`;
}

// The habit-keyed chip (§9): a tagged note wears its habit, resolved at
// render — renames and archiving never rewrite the stream. Untagged notes
// (unstructured, between sessions) wear none.
function habitChipHtml(state: GameState, note: NoteEntry): string {
  return note.habitId !== null ? `<span class="habit-chip">${escapeHtml(habitRecordName(state, note.habitId))}</span>` : "";
}

// The development summary (§9): lifetime practice (the development total),
// sessions practiced and last practiced — aggregates off the practice log,
// live sessions and manual logs together — and the habit's tagged notes
// beneath, newest first, each with its date and in-session stamp.
function habitSummaryHtml(app: App, habit: Habit): string {
  const { state } = app;
  const { sessions, lastPracticed } = habitPracticeSummary(state, habit.id);
  const notes = habitTaggedNotes(state, habit.id);
  const noteRows = notes
    .map((note) => `<div class="note-entry"><span class="note-when mono">${noteStampHtml(note)}</span><p>${escapeHtml(note.text)}</p></div>`)
    .join("");
  return `<div class="habit-summary" data-summary-for="${habit.id}">
    ${stat("Lifetime practice", formatDuration(habit.seconds))}
    ${stat("Sessions practiced", String(sessions))}
    ${stat("Last practiced", lastPracticed !== null && lastPracticed > 0 ? formatDate(lastPracticed, true) : "—")}
    ${noteRows ? `<div class="note-list">${noteRows}</div>` : `<p class="small muted">No tagged notes yet.</p>`}
  </div>`;
}

// The Time app's history list (§9): flat, newest first, ~20 rows with a
// show-more tail — date · habit (or "unstructured") · credited minutes · a
// hit chip or the muted miss marker. No day grouping, charts, or calendars;
// a row drills into the full record. One chip per row, the miss marker
// winning when both derive: the "X / Y min" figure already shows the hit.
function historyListHtml(app: App): string {
  const records = sessionRecordsNewestFirst(app.state);
  const shown = records.slice(0, app.ui.historyLimit);
  const rows = shown
    .map((record) => {
      const habit = record.habitId === null ? "unstructured" : escapeHtml(habitRecordName(app.state, record.habitId));
      return `<button class="history-row" data-drill="${record.sessionNumber}" title="Session ${record.sessionNumber}">
        <span class="history-when mono">${formatDate(record.startedAt)}</span>
        <span class="history-habit">${habit}</span>
      <span class="history-min mono">${formatPracticeMinutes(record.creditedSeconds, record.plannedTarget)}</span>
      ${recordMissed(record) ? `<span class="history-chip miss">miss</span>` : recordTargetHit(record) ? `<span class="history-chip hit">hit</span>` : ""}
      </button>`;
    })
    .join("");
  return `<section class="focus-controls history-panel">
    <button class="quiet small" id="history-back">← Time</button>
    ${rows || `<p class="empty-copy">No sessions yet.</p>`}
    ${
      records.length > shown.length
        ? `<button class="quiet small show-more" id="history-more">Show ${Math.min(HISTORY_PAGE_ROWS, records.length - shown.length)} more</button>`
        : ""
    }
  </section>`;
}

// The drill-down (§9): the full record — when, mode and target, credited
// vs planned, earned nous, each honesty event as a factual line, the
// reflection if present, goals advanced, achievements unlocked. Notes and
// the rate breakdown stay out: this is about practice, not economy replay.
function historyDrillHtml(app: App): string {
  const { state } = app;
  const record = state.sessionRecords.find((r) => r.sessionNumber === app.ui.drillSession);
  if (!record) {
    return `<section class="focus-controls history-panel">
      <button class="quiet small" id="history-back">← History</button>
      <p class="empty-copy">That session record is gone.</p>
    </section>`;
  }
  const habit = record.habitId === null ? "Unstructured practice" : escapeHtml(habitRecordName(state, record.habitId));
  const plan = record.mode === "planned" ? `Planned · ${formatClock(record.plannedTarget!)}` : "Open-ended";
  const events = record.honestyEvents.map((event) => `<p class="history-line">${honestyEventLine(event)}</p>`).join("");
  const reflection = record.reflection;
  const reflectionLine =
    reflection === null
      ? `<p class="history-line muted">No reflection.</p>`
      : `<p class="history-line">"${escapeHtml(reflection.text)}"${reflectionValence(reflection.slider)}</p>`;
  const goals =
    record.goalsAdvanced
      .map(({ goalId, seconds }) => {
        const goal = state.goals.find((g) => g.id === goalId);
        return `<p class="history-line">${secondsToMinutes(seconds)} min · ${goal ? escapeHtml(goalSummary(state, goal)) : "a since-removed goal"}</p>`;
      })
      .join("") || `<p class="history-line muted">No goals advanced.</p>`;
  const achievements =
    record.achievements.map((id) => `<p class="history-line">${escapeHtml(achievementName(id))}</p>`).join("") ||
    `<p class="history-line muted">Nothing unlocked.</p>`;
  return `<section class="focus-controls history-panel">
    <button class="quiet small" id="history-back">← History</button>
    <h3 class="history-title">Session ${record.sessionNumber} · ${habit}</h3>
    <div class="stat-row"><span>When</span><span class="mono">${formatDate(record.startedAt, true)} – ${formatDate(record.endedAt, true)}</span></div>
    <div class="stat-row"><span>Plan</span><span class="mono">${plan}</span></div>
    <div class="stat-row"><span>Practice time</span><span class="mono">${formatPracticeMinutes(record.creditedSeconds, record.plannedTarget)}</span></div>
    <div class="stat-row"><span>Earned</span><span class="mono">${formatNumber(record.earned)} ν</span></div>
    <div class="history-section">Honesty</div>
    ${events || `<p class="history-line muted">Nothing to reconcile.</p>`}
    <div class="history-section">Reflection</div>
    ${reflectionLine}
    <div class="history-section">Goals advanced</div>
    ${goals}
    <div class="history-section">Unlocked</div>
    ${achievements}
  </section>`;
}

// The reflection's valence tail: the untouched neutral field reads as
// nothing at all.
function reflectionValence(slider: number): string {
  if (slider === REFLECTION_SLIDER_NEUTRAL) return "";
  return ` · felt ${slider < REFLECTION_SLIDER_NEUTRAL ? "rough" : "great"}`;
}

function appPanelBody(app: App, panel: FocusApp): string {
  const { state } = app;
  const upgrade = state.mode === "upgrade";

  if (panel === "habit") {
    const active = activeHabit(state);
    const live = !upgrade;
    const habits = state.habits.filter((h) => !h.archived);
    const rows = habits.map((habit) => habitRowHtml(app, habit, true)).join("");
    if (live) {
      return `<section class="focus-controls">
        <p class="habit-active-name">${active ? escapeHtml(active.name) : "Unstructured practice"}</p>
        ${active ? `<div class="stat-row"><span>This session</span><span class="mono" data-live="habit-session">${formatClock(state.session?.elapsed ?? 0)} of practice</span></div>` : ""}
      </section>`;
    }
    const archived = state.habits.filter((h) => h.archived);
    return `<section class="focus-controls">
      <div class="habit-create">
        <input type="text" id="habit-name-input" placeholder="New habit (piano, cooking…)" maxlength="40" />
        <button class="primary small" id="habit-create">Add</button>
      </div>
      <div class="habit-list">
        ${rows || `<p class="empty-copy">No habits yet. Name what you practice.</p>`}
      </div>
      ${
        archived.length > 0
          ? `<div class="habit-archived"><span class="eyebrow">ARCHIVED</span>${archived.map((habit) => habitRowHtml(app, habit, false)).join("")}</div>`
          : ""
      }
      ${state.activeHabitId
        ? `<div class="habit-log">
            <label class="config-label" for="habit-log-minutes">Log practice</label>
            <div class="habit-create">
              <input type="number" id="habit-log-minutes" min="1" placeholder="minutes" />
              <button class="small" id="habit-log-add">Log</button>
            </div>
            <p class="small muted">Manual logs never produce nous or charge.</p>
          </div>`
        : `<p class="small muted">Selection is locked during flow.</p>`}
    </section>`;
  }

  if (panel === "time") {
    if (app.ui.historyOpen) {
      return app.ui.drillSession !== null ? historyDrillHtml(app) : historyListHtml(app);
    }
    if (upgrade) {
      // Strangler bridge: the panels region still renders from App; the
      // plan affordances take the context, so build one here until this
      // region extracts (its own pass will thread the render pass's ctx).
      return `<section class="focus-controls">
        ${planControlsHtml(contextFor(app))}
        <button class="quiet small time-history" id="time-history">History</button>
      </section>`;
    }
    const elapsed = state.session?.elapsed ?? 0;
    const target = state.session?.target ?? null;
    const paused = state.mode === "paused";
    return `<section class="focus-controls">
      <p class="session-clock mono" data-live="time-clock">${formatClock(elapsed)}</p>
      <p class="clock-caption" data-live="time-caption">${sessionCaption(elapsed, target, paused)}</p>
      <div class="time-track"><span data-live="time-track" style="width:${sessionTrackWidth(elapsed, target)}"></span></div>
      <button class="quiet small time-history" id="time-history">History</button>
    </section>`;
  }

  if (panel === "notes") {
    // The full stream (§9): everything kept, newest first — no cap on what
    // is shown, matching the engine's no-pruning rule.
    const stream = [...state.notes].reverse();
    return `<section class="focus-controls">
      <textarea class="note-composer" id="note-composer" placeholder="What are you noticing?" maxlength="2000" rows="3"></textarea>
      <div class="session-actions" style="margin:10px 0 0"><button class="primary" id="note-save">Capture note</button></div>
      ${stream.length > 0 ? `<div class="note-list">${stream.map((n) => `<div class="note-entry"><span class="note-when mono">${noteStampHtml(n)}</span>${habitChipHtml(state, n)}<p>${escapeHtml(n.text)}</p></div>`).join("")}</div>` : ""}
    </section>`;
  }

  const capacity = goalCapacity(state);
  const habitOptions = [`<option value="">Any habit</option>`]
    .concat(state.habits.filter((h) => !h.archived).map((h) => `<option value="${h.id}">${escapeHtml(h.name)}</option>`))
    .join("");
  // The first console long goal (ADR-0012, issue #42): goal capacity as a
  // dashed strip in the owning app's panel — one at a time, each purchase
  // pricing the next past the build-out. Read-only in flow.
  const longGoalPrice = longGoalCost(state.goalCapacityBought);
  const longGoalAffordable = wholeNous(state) >= longGoalPrice;
  const longGoalCountdown = upgrade ? practiceCountdown(longGoalPrice, wholeNous(state), computeRates(state, true).rate) : null;
  const longGoalStrip = `
    <div class="long-goal-strip">
      <div class="long-goal-info">
        <span class="eyebrow">CONSOLE LONG GOAL · ${state.goalCapacityBought + 1}</span>
        <p class="long-goal-name">Goal capacity <span class="mono">+${BALANCE.goalSlotsPerLongGoal} slots</span></p>
        <small class="mono" style="color:var(--muted)">${capacity} → ${capacity + BALANCE.goalSlotsPerLongGoal} slots</small>
      </div>
      <span class="shop-buy">
        <button class="primary small" id="long-goal-buy" ${upgrade && longGoalAffordable ? "" : "disabled"}
          title="${upgrade ? (longGoalAffordable ? "Buy the next beat of goal capacity" : "Not enough nous yet") : "Purchases happen between sessions"}">${formatInt(longGoalPrice)} ν</button>
        ${upgrade ? `<small class="shop-countdown mono" data-live="long-goal-countdown">${longGoalCountdown ?? ""}</small>` : `<small class="shop-countdown">between sessions</small>`}
      </span>
    </div>`;
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
    <p class="goal-slots mono">${state.goals.length}/${capacity} slots${upgrade ? "" : " · locked for this session"}</p>
    ${longGoalStrip}
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
  </section>`;
}

function bindAppPanel(app: App, scope: HTMLElement): void {
  // Strangler bridge (see appPanelBody): the context here is fresh to this
  // binding; the plan controls write through intents either way.
  bindPlanControls(contextFor(app), scope);
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
  // The development summary toggle (§9): one habit expanded at a time.
  scope.querySelectorAll<HTMLElement>("[data-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-summary");
      if (id) app.toggleHabitSummary(id);
    });
  });
  // The history surfaces (§9): the affordance swaps the Time panel body to
  // the list; rows drill in; the tail pages; back unwinds one level — out of
  // the drill-down to the list, out of the list to the Time panel itself.
  scope.querySelector("#time-history")?.addEventListener("click", () => app.openHistory());
  scope.querySelector("#history-back")?.addEventListener("click", () => {
    if (app.ui.drillSession !== null) app.closeDrill();
    else app.closeHistory();
  });
  scope.querySelector("#history-more")?.addEventListener("click", () => app.moreHistory());
  scope.querySelectorAll<HTMLElement>("[data-drill]").forEach((row) => {
    row.addEventListener("click", () => {
      const number = Number(row.getAttribute("data-drill"));
      if (Number.isFinite(number)) app.openDrill(number);
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
  scope.querySelector("#long-goal-buy")?.addEventListener("click", () => app.buyGoalCapacityAction());
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
  // The long-goal strip's affordability moves with the balance between
  // rebuilds: the buy button and its practice-minute countdown keep
  // themselves current, like the module upgrade CTA (§7).
  const longGoalBuy = scope.querySelector("#long-goal-buy") as HTMLButtonElement | null;
  if (longGoalBuy) {
    const price = longGoalCost(state.goalCapacityBought);
    longGoalBuy.disabled = !(state.mode === "upgrade" && wholeNous(state) >= price);
    const countdown = practiceCountdown(price, wholeNous(state), computeRates(state, true).rate) ?? "";
    liveText(scope, "long-goal-countdown", countdown);
  }
}


/* ── Grid & inventory panel ────────────────────────── */

// A canvas-style face tile — the same readout panel the board renders, with
// nominal values for the module's level — shared by the inventory grid and
// the live drag ghost so a carried tile looks identical to the one waiting in
// inventory (candidate-tile pattern from the Forge).
function hexTileSvg(module: ModuleInstance): string {
  return `<svg viewBox="-70 -70 140 140" aria-hidden="true">
    ${moduleFace({ type: module.type, rarity: module.rarity, readout: faceReadout(module), level: module.level })}
  </svg>`;
}


function renderManagePanel(app: App, host: HTMLElement): void {
  const { state, ui } = app;
  const inventory = state.modules.filter((m) => m.pos === null);
  const deployedCount = state.modules.length - inventory.length;
  const reshaping = ui.reshape !== null;
  const validity = reshaping ? app.reshapeValidity() : null;
  host.innerHTML = `
    <div class="detail-head">
      <h1>Grid &amp; inventory</h1>
      <button class="primary small" id="manage-done">Done</button>
    </div>
    <p class="small muted">${
      reshaping
        ? "Reshaping — removals and additions must balance."
        : ui.placing
          ? "Choose a destination cell. Occupied modules swap."
          : "Drag tiles between cells or into the inventory; drop onto a twin to combine."
    }</p>
    <p class="manage-counts mono">${deployedCount} deployed · ${state.cells.length - deployedCount} empty · ${inventory.length} in inventory</p>
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
      <p class="small muted">Drop a tile here to store it; click to place.</p>
      <div class="inventory-hexes" id="inventory-list">
        ${inventory.map((m) => {
          return `<button class="inventory-tile" data-inv="${m.id}" data-rarity="${m.rarity}" title="${META[m.type].name} · ${RARITY_LABEL[m.rarity]}">
            ${hexTileSvg(m)}
          </button>`;
        }).join("") || `<p class="empty-copy">Inventory is empty.</p>`}
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
