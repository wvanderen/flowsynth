import { chargedFactor, cellCost, computeRates, deployed, deployedAt, emittedStrength, isSource, levelCost, modulePower, nominalContribution, wholeNous } from "../engine/economy";
import { adjacent, sameHex } from "../engine/hex";
import { forgeThreshold } from "../engine/rolls";
import { BALANCE, NEXT_RARITY } from "../engine/constants";
import { formatClock, formatDuration } from "../engine/clock";
import { appActive, appLockNote, FOCUS_APPS } from "../engine/apps";
import { activeHabit } from "../engine/habits";
import { poolOutstanding } from "../engine/trust";
import { isCarrier } from "../engine/state";
import type { GameState, Hex, ModuleInstance, RateSnapshot } from "../engine/types";
import type { App } from "./app";
import { appIcon } from "./icons";
import { HEX_RADIUS, hexApothem, hexPoints, moduleFace } from "./face";
import { effectLine, faceReadout, PINNED_SENTENCE, typeProse, upgradeGain } from "./lexicon";
import { chargeGlow, chargeLeads } from "./leads";
import { chordOverlay } from "./chordlayer";
import { updateSvg } from "./svg";
import { APP_LABELS, META, RARITY_LABEL } from "./meta";
import { formatInt, formatNumber, practiceCountdown } from "./format";
import { renderStatusMonitor } from "./monitor";
import { byId, escapeHtml, stat, statLive } from "./dom";
import { keyedRegion, liveText, liveWidth } from "./region";
import { OPEN_ENDED_WORD, plannedFill, sessionCaption, sessionClock } from "./clockface";
import { appPanelBody, bindAppPanel, panelKeyFacts, updateAppPanelLive } from "./panels";
import { contextFor, type RenderContext as UiContext } from "./context";
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
  renderConsoleApps(ctx);
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

  const clock = sessionClock(state);
  const reached = clock.target !== null && clock.elapsed >= clock.target;

  const key = `flow:${state.mode}:${clock.target === null ? "open" : reached ? "reached" : "timed"}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `
      <div class="console-clock">
        <p class="session-clock mono" id="session-clock"></p>
        <p class="clock-caption" id="session-caption"></p>
        <p class="clock-provisional" id="session-provisional" role="status"></p>
      </div>
      <div class="session-actions">
        <button id="pause-flow">${clock.paused ? "Resume" : "Pause"}</button>
        <button class="main-switch ${clock.paused ? "held" : "live"}" id="flow-switch" title="Exit flow — end the session and bank its production">
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
  set("session-clock", formatClock(clock.target !== null ? Math.max(0, clock.target - clock.elapsed) : clock.elapsed));
  set("session-caption", sessionCaption(clock.elapsed, clock.target, clock.paused));
  // The provisional bucket is visibly flagged while it holds (§2): the pool
  // minutes and the nous waiting on the honesty report, in the switch's
  // vermillion so it reads from across the room.
  const accounting = state.session?.accounting;
  set(
    "session-provisional",
    accounting && poolOutstanding(state)
      ? `${formatDuration(accounting.poolSeconds)} provisional · ${formatNumber(accounting.bucketNous)} ν held`
      : "",
  );
  renderSessionStrip(true, clock.elapsed, clock.target, clock.paused);
}

// The header's bottom edge is the progress surface (issue #63): a thin strip
// pinned along it, wearing the switch's vermillion so flow reads from across
// the room. Planned sessions fill it left-to-right; open-ended ones pulse
// calmly at full width; paused holds it still; idle leaves it empty.
// Tick-safe — class and width update in place.
function renderSessionStrip(running: boolean, elapsed = 0, target: number | null = null, paused = false): void {
  const strip = byId("session-strip");
  if (!strip) return;
  strip.classList.toggle("pulse", running && target === null && !paused);
  const width = !running ? "0%" : target === null ? "100%" : plannedFill(elapsed, target);
  liveWidth(document, "#session-strip-fill", width);
}


// Focus-app access (ADR-0012): one tile per app — the launch four live
// from minute 0 (ADR-0019), each wearing its live state, with its panel
// opening as a popover anchored directly beneath the tile. The locked-tile
// plumbing stays for a future ladder tenant; locked tiles would open
// nothing, and the board never moves, reflows, or dims while the console
// is used.
// (Display names live in meta.ts's APP_LABELS.)

function renderConsoleApps(ctx: UiContext): void {
  const host = byId("console-apps");
  if (!host) return;
  const { state, ui } = ctx;
  const key = JSON.stringify([
    ui.app,
    state.mode,
    state.sessionsCompleted === 0,
    state.activatedApps.join("|"),
    state.goalCapacityBought,
    state.habits.map((h) => `${h.archived ? "·" : ""}${h.name}`).join("|"),
    state.activeHabitId,
    // The panels region's scratch gates this rebuild too: the rename input,
    // the history view, and the expanded summary (§9).
    ...panelKeyFacts(),
    state.notes.length,
    state.goals.map((g) => (g.completed ? "1" : "0") + g.condition.minutes + (g.condition.habitId ?? "") + g.schedule.kind).join("|"),
    ui.chosenTarget,
    state.sessionRecords.length,
  ]);
  keyedRegion(host, key, (host) => {
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
        ${open ? `<div class="app-popover" id="app-popover">${appPanelBody(ctx, appKey)}</div>` : ""}
      </div>`;
    }).join("");
    host.innerHTML = `<div class="app-tiles">${tiles}</div>`;
    if (scrollTop > 0) (host.querySelector("#app-popover") as HTMLElement | null)?.scrollTo(0, scrollTop);
    for (const appKey of FOCUS_APPS) {
      byId(`app-tile-${appKey}`)?.addEventListener("click", () => ctx.intents.openApp(appKey));
    }
    bindAppPanel(ctx, host);
  });
  updateAppPanelLive(ctx, host);
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
  keyedRegion(host, key, () => {
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
  });
  // Live under the structural rebuild: the Forge pip tracks the shared
  // meter, and the cell icon wears the current price and affordability.
  const cap = forgeThreshold(state.forge.earned);
  const pipWidth = `${(Math.min(1, Math.max(0, state.forge.progress / cap)) * 100).toFixed(1)}%`;
  liveWidth(host, '[data-live="forge-pip"]', pipWidth);
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
