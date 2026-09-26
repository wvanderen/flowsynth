import { chargedFactor, cellCost, cellPurchasePrice, chargeDelivered, computeRates, deployed, emittedStrength, levelCost, longGoalCost, modulePower, wholeNous } from "../engine/economy";
import { deployedAt } from "../engine/economy";
import { newChordTerms, wouldFormPreview } from "../engine/chords";
import { adjacent, sameHex } from "../engine/hex";
import { forgeThreshold } from "../engine/rolls";
import { BALANCE, CATEGORY_OF, REFLECTION_SLIDER_NEUTRAL, REFLECTION_SLIDER_POSITIONS, SHELF_MODULE } from "../engine/constants";
import { formatClock, formatDuration } from "../engine/clock";
import { cellNoteOf, noteNameOf, octaveRowOf, positionInRange } from "../engine/lattice";
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
import { ACHIEVEMENTS, achievementName, type AchievementCategory, type AchievementContext, type AchievementDef } from "../engine/achievements";
import type { GameState, Goal, Habit, Hex, HonestyEvent, HonestyOutcome, ModuleInstance, NoteEntry, RateSnapshot } from "../engine/types";
import type { App, EnterKind } from "./app";
import { appIcon } from "./icons";
import { HEX_RADIUS, hexApothem, hexPoints, moduleFace } from "./face";
import { BLOOM_WIDTH, bloomLayout, bloomPops, viewMeet, viewPoint } from "./bloom";
import { chargeGlow, chargeLeads } from "./leads";
import { chordOverlay } from "./chordlayer";
import { updateSvg } from "./svg";
import { PLAN_MIN_MINUTES, PLAN_MAX_MINUTES, PLAN_PRESET_MINUTES, APP_LABELS, HISTORY_PAGE_ROWS, META, RARITY_LABEL, SHELF_HINTS } from "./meta";
import { formatDate, formatInt, formatNumber, formatPracticeMinutes, chordTermLabel, practiceCountdown, secondsToMinutes } from "./format";
import { renderStatusMonitor } from "./monitor";
import { prototypeVariant, ledgerHtml, updateLedgerLive, featsChipHtml, unlockedCount, FEATS_SVG, TOOL_ICONS } from "./variant";

const SPACING = 65;
const DRAG_THRESHOLD_PX = 6;
const boundCells = new WeakSet<SVGElement>();

function point({ q, r }: Hex): [number, number] {
  return [Math.sqrt(3) * SPACING * (q + r / 2), SPACING * 1.5 * r];
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

export function render(app: App): void {
  renderConsoleSession(app);
  renderConsoleApps(app);
  renderConsoleReadout(app);
  renderBoardLedger(app);
  renderTools(app);
  renderGrid(app);
  renderInventoryTray(app);
  renderBloom(app);
  renderStatusMonitor(app);
  renderInspector(app);
  renderModal(app);
  renderDev(app);
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
    const variant = prototypeVariant();
    const key = `upgrade:${planned}:${variant ?? "base"}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      // PROTOTYPE (issue #119, variant C): the clock block is itself the
      // plan affordance — clicking it opens the Time app, so planning has
      // one home and the console clock points at it.
      const clockBlock = `
          <p class="session-clock mono">${planned ? formatClock(app.ui.chosenTarget!) : CLOCK_PLACEHOLDER}</p>
          <p class="clock-caption">${planned ? "planned" : OPEN_ENDED_WORD}</p>`;
      host.innerHTML =
        variant === "c"
          ? `<button class="console-clock clock-opens-time" id="clock-plan" title="Plan — opens the Time app">${clockBlock}</button>
        <div class="session-actions">
          <button class="main-switch idle" id="flow-switch" title="Enter flow — the board locks and runs itself">
            ${switchSvg}<span>Enter flow</span><i class="switch-state" aria-hidden="true"></i>
          </button>
        </div>`
          : `<div class="console-clock">
          ${clockBlock}
        </div>
        <div class="session-actions">
          <button class="main-switch idle" id="flow-switch" title="Enter flow — the board locks and runs itself">
            ${switchSvg}<span>Enter flow</span><i class="switch-state" aria-hidden="true"></i>
          </button>
        </div>`;
      if (variant === "c") byId("clock-plan")?.addEventListener("click", () => app.openApp("time"));
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

// The achievements page (ADR-0015): the always-visible full list — all
// seventeen feats with progress bars, none hidden, grouped by the launch
// buckets the ADR names. Spark's progress rides the charge preview; it
// reads zero between sessions, as charge does.
const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  practice: "Practice capstones",
  console: "Console encouragers",
  board: "Board & economy",
  formula: "Formula & horizon",
  ladder: "Counter ladder",
};

const ACHIEVEMENT_CATEGORY_ORDER: readonly AchievementCategory[] = ["practice", "console", "board", "formula", "ladder"];

function achievementContextOf(app: App): AchievementContext {
  return { chargeDelivered: app.state.mode === "flow" && chargeDelivered(computeRates(app.state, true)) };
}

// The open page's refresh signature: each feat's progress quantized to a
// percent, so a rebuild only happens when a bar visibly moves.
function achProgressKey(app: App): string {
  const ctx = achievementContextOf(app);
  return ACHIEVEMENTS.map((def) => {
    const { current, goal } = def.progress(app.state, ctx);
    return String(Math.round((Math.min(1, goal > 0 ? current / goal : 1)) * 100));
  }).join(",");
}

function achRowHtml(app: App, def: AchievementDef, ctx: AchievementContext): string {
  const unlockedAt = app.state.achievements[def.id];
  const { current, goal } = def.progress(app.state, ctx);
  const fraction = Math.min(1, goal > 0 ? current / goal : 1);
  const readout = unlockedAt !== undefined ? "done" : `${formatNumber(current)} / ${formatNumber(goal)}`;
  return `<div class="ach-row${unlockedAt !== undefined ? " unlocked" : ""}">
    <div class="ach-head">
      <span class="ach-name">${def.name}</span>
      <span class="ach-readout mono">${readout}</span>
    </div>
    <p class="ach-desc">${def.description}</p>
    <div class="ach-track" aria-hidden="true"><i style="width:${(fraction * 100).toFixed(1)}%"></i></div>
  </div>`;
}

function renderAchievementsModal(app: App, content: HTMLElement): void {
  const ctx = achievementContextOf(app);
  const count = Object.keys(app.state.achievements).length;
  const sections = ACHIEVEMENT_CATEGORY_ORDER.map((category) => {
    const feats = ACHIEVEMENTS.filter((def) => def.category === category);
    if (feats.length === 0) return "";
    return `<section class="ach-section">
      <h3 class="catalog-section-title">${ACHIEVEMENT_CATEGORY_LABEL[category]}</h3>
      <div class="ach-grid">${feats.map((def) => achRowHtml(app, def, ctx)).join("")}</div>
    </section>`;
  }).join("");
  content.innerHTML = `
    ${modalTop("ACHIEVEMENTS")}
    <h2 id="modal-title">${count} of ${ACHIEVEMENTS.length} feats.</h2>
    <p class="lead">Every feat speeds the rate a little — they accelerate, never gate. Each one adds into the Achievements line of the live rate breakdown.</p>
    ${sections}`;
  wireClose(app);
}

// The console's readout end: production (rate with the session total
// beneath) and the nous balance — bare values; the main switch carries the
// mode. Static slots are built once; tick-moving values update in place.
// PROTOTYPE (issue #119): variant A replaces the scattered slots with the
// production ledger — stock, rate, and session as one instrument — and
// retires the trophy from the console (feats join the board action row).
// Variants B and C retire the readout end entirely; production reads from
// the monitor footer (B) or the board ledger strip (C).
function renderConsoleReadout(app: App): void {
  const { state } = app;
  const variant = prototypeVariant();
  if (variant === "b" || variant === "c") return;
  const strip = byId("console-status");
  if (strip) {
    if (strip.childElementCount === 0) {
      if (variant === "a") {
        strip.innerHTML = ledgerHtml();
      } else {
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
    }
    if (variant === "a") {
      updateLedgerLive(strip, state, currentSnapshot(state).rate);
      return;
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
  if (nous && variant !== "a") {
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

// PROTOTYPE (issue #119): variant C's board-ledger strip — the production
// ledger and the feats chip docked directly above the board, outside the
// console. The console keeps only control; the board owns its numbers. The
// host is created here so the production document never carries it.
function renderBoardLedger(app: App): void {
  if (prototypeVariant() !== "c") return;
  let host = document.getElementById("board-ledger");
  if (!host) {
    host = document.createElement("div");
    host.className = "board-ledger";
    host.id = "board-ledger";
    document.querySelector(".board-heading")?.before(host);
  }
  const count = unlockedCount(app.state);
  const key = `c:${count}`;
  if (host.dataset.protoKey !== key) {
    host.dataset.protoKey = key;
    host.innerHTML = `${ledgerHtml()}${featsChipHtml(count)}`;
    byId("feats-chip")?.addEventListener("click", () => app.openModal("achievements"));
  }
  updateLedgerLive(host, app.state, currentSnapshot(app.state).rate);
}

const CELL_TOOL_SVG = `<svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0-6v12M-6 0h12"/></svg>`;

function renderTools(app: App): void {
  const variant = prototypeVariant();
  const { state, ui } = app;
  const host = byId("board-tools");
  if (!host) return;
  const upgrade = state.mode === "upgrade";
  const feats = variant ? unlockedCount(state) : 0;
  const key = JSON.stringify([variant, upgrade, state.bankedRolls.length, ui.buyingCell, ui.showChords, feats]);
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    const forgeReady = upgrade && state.bankedRolls.length > 0;
    const forgeCount = state.bankedRolls.length;
    // PROTOTYPE (issue #119): the legend leaves the heading row to the
    // standardized action row — every action the same anatomy, so nothing
    // reads as a different kind of thing. A wears icon + label; B and C
    // wear icons alone. Feats joins the row (A, B) where the legend sat;
    // C's dock stays five actions and feats reads from the board ledger.
    // Arrange is gone everywhere (§5): dragging is already live in upgrade
    // mode, so no move mode exists to enter.
    if (variant === "a") {
      host.innerHTML = `
        <button class="small" id="tool-catalog" ${upgrade ? "" : "disabled"} title="${upgrade ? "The catalog: starter-shelf offers and board cells" : "Purchases happen between sessions"}">${TOOL_ICONS.catalog}<span>Catalog</span></button>
        <button class="small tool-forge" id="tool-forge" ${forgeReady ? "" : "disabled"} title="">${TOOL_ICONS.forge}<span>Forge${forgeCount > 0 ? ` · ${forgeCount}` : ""}</span><i class="forge-pip" aria-hidden="true"><i data-live="forge-pip"></i></i></button>
        <button class="small tool-cell${ui.buyingCell ? " active" : ""}" id="tool-cell" ${upgrade ? "" : "disabled"} aria-pressed="${ui.buyingCell}" title="">${CELL_TOOL_SVG}<span>Cell</span></button>
        <button class="small${ui.showChords ? " active" : ""}" id="tool-chords" aria-pressed="${ui.showChords}" title="Show chords — light the chord voices, link the pairs, outline and label named chords · C">${TOOL_ICONS.chords}<span>Chords</span></button>
        <span class="tool-sep" aria-hidden="true"></span>
        <button class="small" id="tool-feats" title="Achievements — every feat, and how close the next one is">${FEATS_SVG}<span>Feats</span></button>`;
    } else if (variant === "b" || variant === "c") {
      type IconArgs = { id: string; svg: string; label: string; extra?: string; disabled?: string; pressed?: string; active?: string };
      const icon = ({ id, svg, label, extra = "", disabled = "", pressed = "", active = "" }: IconArgs) =>
        `<button class="small tool-icon${active}" id="${id}" aria-label="${label}" title="${label}" ${disabled} ${pressed}>${svg}${extra}</button>`;
      const forgeTitle = forgeReady
        ? "Forge — banked choices wait"
        : "Forge — charge feeds it toward the next choice";
      host.innerHTML =
        icon({ id: "tool-catalog", svg: TOOL_ICONS.catalog, label: upgrade ? "Catalog — starter-shelf offers and board cells" : "Catalog — purchases happen between sessions", disabled: upgrade ? "" : "disabled" }) +
        icon({ id: "tool-forge", svg: TOOL_ICONS.forge, label: forgeTitle, extra: forgeCount > 0 ? `<b class="tool-badge mono">${forgeCount}</b>` : "", disabled: forgeReady ? "" : "disabled" }) +
        icon({ id: "tool-cell", svg: CELL_TOOL_SVG, label: "New cell", disabled: upgrade ? "" : "disabled", pressed: `aria-pressed="${ui.buyingCell}"`, active: ui.buyingCell ? " active" : "" }) +
        icon({ id: "tool-chords", svg: TOOL_ICONS.chords, label: "Show chords — light the chord voices, link the pairs, outline and label named chords · C", pressed: `aria-pressed="${ui.showChords}"`, active: ui.showChords ? " active" : "" }) +
        (variant === "b" ? icon({ id: "tool-feats", svg: FEATS_SVG, label: "Achievements — every feat, and how close the next one is", extra: feats > 0 ? `<b class="tool-badge mono">${feats}</b>` : "" }) : "");
      host.classList.add("tool-icon-row");
    } else {
      host.innerHTML = `
        <button class="small" id="tool-catalog" ${upgrade ? "" : "disabled"} title="${upgrade ? "The catalog: starter-shelf offers and board cells" : "Purchases happen between sessions"}">Catalog</button>
        <button class="small tool-forge" id="tool-forge" ${forgeReady ? "" : "disabled"} title="">
          <span>Forge${state.bankedRolls.length > 0 ? ` · ${state.bankedRolls.length}` : ""}</span>
          <i class="forge-pip" aria-hidden="true"><i data-live="forge-pip"></i></i>
        </button>
        <button class="small tool-cell${ui.buyingCell ? " active" : ""}" id="tool-cell" ${upgrade ? "" : "disabled"} aria-pressed="${ui.buyingCell}" title="">${CELL_TOOL_SVG}</button>
        <button class="small${ui.showChords ? " active" : ""}" id="tool-chords" aria-pressed="${ui.showChords}" title="Show chords — light the chord voices, link the pairs, outline and label named chords · C">Chords</button>`;
    }
    byId("tool-catalog")?.addEventListener("click", () => app.openModal("catalog"));
    byId("tool-forge")?.addEventListener("click", () => app.openModal("forge"));
    byId("tool-cell")?.addEventListener("click", () => (app.ui.buyingCell ? app.cancelCellPurchase() : app.armCellPurchase()));
    byId("tool-chords")?.addEventListener("click", () => app.toggleChords());
    byId("tool-feats")?.addEventListener("click", () => app.openModal("achievements"));
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
  // The drop preview is session-bound light state: with no drag carried and
  // no placement armed, no hover can be live — stale state never survives a
  // render.
  if (!app.dragging && !ui.placing) ui.dropHover = null;
  const upgrade = state.mode === "upgrade";
  // The frontier stops at the finite octave-row band (ADR-0022): the
  // fifths axis runs free, the rows do not.
  const frontier = upgrade && ui.buyingCell ? app.frontierCells().filter(positionInRange) : [];
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

  // The chord view (issue #62, reworked for the carrierless board): a
  // display-only read of the board's pitch-set chord terms — the same named
  // chords the formula chip names, drawn where they live as hulls over the
  // connected voices. Chord voices stay lit; everything else dims. Purely
  // cosmetic: no gating, no gameplay effect, available in every mode.
  const deployedById = new Map(state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m]));
  const overlay = ui.showChords
    ? chordOverlay({
        namedChords: snapshot.namedChords,
        posOf: (id) => deployedById.get(id)?.pos ?? null,
        point,
        radius: HEX_RADIUS,
        pad: 5,
        labelFor: chordTermLabel,
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

  for (const pos of state.cells) {
    const [x, y] = point(pos);
    const module = deployedAt(state, pos);
    const drop = dropRegister(app, pos);
    let classes = "hex empty";
    if (drop) classes += ` ${dropClass(drop)}`;
    if (!module && isTargetCell(app)) classes += " target";
    // The lattice reads on every cell (board-redesign spec §2): each cell
    // is an absolute note — note name under the readout for modules, on the
    // face for empty cells — so columns read as one note name and octave
    // rows stack visibly.
    html += `<g class="${nodeClass(module?.id ?? null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${module ? `${META[module.type].name} at ${cellNoteOf(pos)}` : `Empty cell · ${cellNoteOf(pos)}`}">
      ${module ? "" : `<polygon class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>`}`;
    if (module) {
      html += moduleNode(app, module, pos, { snapshot, selectedModule, drop });
    } else {
      html += `<path class="empty-plus" d="M-7-6H7M0-13V1"/><text y="10" text-anchor="middle" class="hex-note">${cellNoteOf(pos)}</text><text y="24" text-anchor="middle" class="hex-sub">EMPTY CELL</text>`;
    }
    html += `</g>`;
  }

  if (frontier.length > 0) {
    // The octave-row gate rides the quoted price (ADR-0022): a frontier hex
    // in a row whose one-time gate is unpaid carries cell price + premium —
    // the same cellPurchasePrice seam the buy action charges.
    const basePrice = cellCost(state.cellsBought);
    for (const pos of frontier) {
      const [x, y] = point(pos);
      const total = cellPurchasePrice(state, pos);
      const affordable = wholeNous(state) >= total;
      if (ui.buyingCell) {
        // The purchase arm: every frontier hex carries its price; the buy
        // lands only where clicked (ADR-0013).
        html += `<g class="${nodeClass(null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Buy cell here for ${formatInt(total)} nous">
          <polygon class="hex ${affordable ? "buy-here" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
          <text y="-24" text-anchor="middle" class="hex-sub">NEW CELL</text>
          ${affordable ? `<text y="8" text-anchor="middle" fill="var(--accent)" font-size="22">+</text>` : ""}
          <text y="${affordable ? 34 : 8}" text-anchor="middle" class="hex-sub">${formatInt(total)} ν${total > basePrice ? " · gated" : ""}</text>
        </g>`;
      } else {
        html += `<g class="${nodeClass(null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Expand here">
          <polygon class="hex future" points="${hexPoints(HEX_RADIUS)}"/>
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

  // The would-form ghosts (§5–§6): dashed hulls over the chords the hovered
  // drop or placement would form, one per forming chord. Rebuilt from the
  // live preview state so a re-render never strands a ghost.
  html += `<g data-key="ghost-chords">${ghostMarksHtml(app)}</g>`;

  updateSvg(svg, html);
  bindGridEvents(app, svg);
}

// Generators are the sole charge source category (ADR-0012).
const isSource = (m: ModuleInstance) => CATEGORY_OF[m.type] === "generator";

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
  // The live drop register over this cell (§5): amber for occupied, green
  // for open. Null away from the hover.
  drop: DropRegister | null;
}

// A module face's readout (ADR-0016): the prominent value beneath the
// signature — the same glanceable line whether compact, in the tray, or
// enlarged on the expanded face. Shared by the board node and the bloom;
// the bloom takes the contribution with its unit, since the enlarged face
// is where the ν/s figure is added (no second readout beside it).
function faceReadoutFor(state: GameState, module: ModuleInstance, pos: Hex | null, snapshot: ReturnType<typeof computeRates>, withUnits = false): { readout: string; readoutClass?: string; note?: string } {
  const contribution = snapshot.contributions.get(module.id);
  if (module.type === "forge") {
    // The face's glanceable readout rounds; the inspector keeps exact values.
    return {
      readout: `${formatNumber(Math.floor(Math.max(0, state.forge.progress)))}/${formatNumber(Math.round(forgeThreshold(state.forge.earned)))}`,
      readoutClass: "charge",
    };
  }
  if (isSource(module)) return { readout: `⌁${formatNumber(modulePower(module))}` };
  if (module.type === "infusor") {
    return { readout: `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(snapshot.chargeStrength.get(module.id) ?? 0))}%` };
  }
  if (module.type === "spacer") {
    // The spacer is silent wire: it never sounds, never joins a pitch set —
    // its face says so and names the cell it wires.
    return pos ? { readout: "⌇", note: cellNoteOf(pos) } : { readout: "⌇" };
  }
  // Synthesizers wear their contribution with the cell's note beneath it:
  // pitch lives in the cell (ADR-0021).
  const unit = withUnits ? " ν/s" : "";
  return pos
    ? { readout: `+${formatNumber(contribution?.value ?? 0)}${unit}`, note: cellNoteOf(pos) }
    : { readout: `+${formatNumber(contribution?.value ?? 0)}${unit}` };
}

function moduleNode(app: App, module: ModuleInstance, pos: Hex, ctx: RenderContext): string {
  const { ui, state } = app;
  const selected = ui.selected === module.id;
  // Charge is session-bound: the snapshot is flow-gated, so any strength it
  // reports is live. Receivers brighten with their received strength, and a
  // generator lights only while it actually emits (a spent charge window
  // emits nothing).
  const strength = ctx.snapshot.chargeStrength.get(module.id) ?? 0;
  const charged = strength > 0;
  const emittingNow = state.mode === "flow" && isSource(module) && emittedStrength(state, module, true) > 0;

  let hexClass = "";
  if (selected) hexClass += " selected";
  if (charged) hexClass += " charged";
  if (emittingNow) hexClass += " dispensing";
  if (ctx.drop) hexClass += ` ${dropClass(ctx.drop)}`;

  // Highlight eligible receivers while a generator is selected in upgrade mode.
  let highlight = "";
  if (app.state.mode === "upgrade" && ctx.selectedModule && isSource(ctx.selectedModule) && module.id !== ctx.selectedModule.id && module.pos && ctx.selectedModule.pos && adjacent(module.pos, ctx.selectedModule.pos)) {
    highlight = `<polygon data-key="preview" class="highlight-ring" points="${hexPoints(HEX_RADIUS - 4)}"/>`;
  }

  const { readout, readoutClass, note } = faceReadoutFor(state, module, pos, ctx.snapshot);

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
      under: module.type === "forge" ? waterFill(module.id, state.forge.progress / forgeThreshold(state.forge.earned)) : "",
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

function isTargetCell(app: App): boolean {
  const { ui, state } = app;
  if (state.mode !== "upgrade") return false;
  if (ui.placing) {
    // No module is spatially privileged (ADR-0021): every cell is a legal
    // drop, occupied or not — a swap, never a refusal.
    return true;
  }
  return false;
}

/* ── Live drop preview (§5–§6) ───────────────────────────────────────────
   While a drag crosses the board, or an armed placement hovers a cell, the
   target wears its drop register — amber over an occupied cell (a swap is
   coming), green over an open one — and the would-form ghosts draw as
   dashed hulls, one per forming chord. The hover itself lives in UiState;
   only the class/layer refresh happens here, never a re-render. */

type DropRegister = "open" | "occupied";

// The register's class: green for open, amber for occupied — every cell
// that shows the register wears one of exactly these two.
function dropClass(register: DropRegister): string {
  return register === "open" ? "drop-open" : "drop-occupied";
}

// The register a drop onto `pos` would take: occupied (amber) whenever a
// module sits there — a swap is coming, never a confirmation — green when
// open. Null away from the hover, in flow, or onto the carried module's
// own cell.
function dropRegister(app: App, pos: Hex): DropRegister | null {
  const hover = app.ui.dropHover;
  if (!hover || app.state.mode !== "upgrade") return null;
  if (!sameHex(hover.pos, pos)) return null;
  const occupant = deployedAt(app.state, pos);
  if (occupant && occupant.id !== hover.moduleId) return "occupied";
  if (occupant) return null;
  return "open";
}

// Hover state changes refresh the preview in place — classes on the target
// hex plus the ghost layer — never a full render.
function setDropHover(app: App, moduleId: string | null, pos: Hex | null): void {
  app.ui.dropHover = moduleId && pos ? { moduleId, pos } : null;
  refreshDropPreview(app);
}

function refreshDropPreview(app: App): void {
  const svg = document.getElementById("grid");
  if (!svg) return;
  svg.querySelectorAll(".hex.drop-open, .hex.drop-occupied").forEach((node) => node.classList.remove("drop-open", "drop-occupied"));
  const hover = app.ui.dropHover;
  if (hover) {
    const register = dropRegister(app, hover.pos);
    if (register) {
      svg.querySelector(`[data-cell="${hover.pos.q},${hover.pos.r}"] .hex`)?.classList.add(dropClass(register));
    }
  }
  const layer = svg.querySelector('[data-key="ghost-chords"]');
  if (layer) layer.innerHTML = ghostMarksHtml(app);
}

// The would-form ghost markup (§6): dashed hulls with name chips, one per
// chord the drop would newly form, drawn over the voices' would-be
// positions. What breaks is expressed by what disappears — breaking is
// never previewed.
function ghostMarksHtml(app: App): string {
  const hover = app.ui.dropHover;
  if (!hover || app.state.mode !== "upgrade") return "";
  const module = app.state.modules.find((m) => m.id === hover.moduleId);
  if (!module) return "";
  const conducts = CATEGORY_OF[module.type] === "synthesizer" || module.type === "spacer";
  if (!conducts) return "";
  const current = computeRates(app.state, true).namedChords;
  const preview = wouldFormPreview(app.state, hover.moduleId, hover.pos);
  const newcomers = newChordTerms(current, preview.chords);
  if (newcomers.length === 0) return "";
  const deployedById = new Map(app.state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m]));
  const posOf = (id: string): Hex | null => (id === hover.moduleId ? hover.pos : preview.positions.get(id) ?? deployedById.get(id)?.pos ?? null);
  const overlay = chordOverlay({
    namedChords: newcomers,
    posOf,
    point,
    radius: HEX_RADIUS,
    pad: 5,
    labelFor: chordTermLabel,
  });
  return overlay.marks
    .map(
      (mark, index) =>
        `<g data-key="ghost-${index}"><polygon class="chord-hull ghost-hull" points="${mark.points}"/><text class="chord-label mono" x="${mark.labelX}" y="${mark.labelY}">${escapeHtml(mark.label)}</text></g>`,
    )
    .join("");
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
    // The armed placement previews on hover (§5–§6): ghosts over the
    // would-form chords, the drop register over the hovered cell.
    node.addEventListener("pointerenter", () => {
      if (app.dragging || app.state.mode !== "upgrade") return;
      setDropHover(app, app.ui.placing, position());
    });
    node.addEventListener("pointerleave", () => {
      if (app.dragging || app.state.mode !== "upgrade") return;
      if (app.ui.dropHover && sameHex(app.ui.dropHover.pos, position())) setDropHover(app, null, null);
    });
    bindPointerDrag(app, node, () => deployedAt(app.state, position())?.id ?? null);
  });
}

// Shared pointer-drag binding for grid modules and tray items: holding the
// face starts a live drag in upgrade mode — no arrange mode exists — the
// bloom collapses into the ghost, and the drop lands as a placement (an
// occupied target swaps immediately, never confirms) or a retrieval into
// the tray. Click-placement stays available without dragging. No module
// refuses the drag — nothing is pinned on the carrierless board (ADR-0021).
function bindPointerDrag(app: App, element: Element, moduleId: string | (() => string | null)): void {
  element.addEventListener("pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || app.state.mode !== "upgrade" || app.ui.buyingCell) return;
    const id = typeof moduleId === "function" ? moduleId() : moduleId;
    if (!id) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let ghost: HTMLDivElement | null = null;
    let hoverTarget: Element | null = null;
    const zone = document.getElementById("inventory-zone");

    const setHoverTarget = (ev: PointerEvent) => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellNode = hit?.closest("[data-cell]") ?? null;
      const overZone = !!hit?.closest("#inventory-zone");
      zone?.classList.toggle("drag-over", overZone);
      if (cellNode !== hoverTarget) {
        hoverTarget = cellNode;
        const [q, r] = (hoverTarget?.getAttribute("data-cell") ?? "").split(",").map(Number);
        const pos = Number.isFinite(q) && Number.isFinite(r) ? { q: q!, r: r! } : null;
        setDropHover(app, id, pos);
      }
      if (!cellNode) setDropHover(app, id, null);
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
        app.dragging = id;
        const module = app.state.modules.find((m) => m.id === id);
        // Holding the face starts the live drag (§5): the expanded face
        // collapses into the ghost, and a drop leaves it closed.
        if (app.ui.selected === id) {
          app.ui.selected = null;
          app.render();
        }
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
      app.dragging = null;
      ghost?.remove();
      element.classList.remove("dragging");
      hoverTarget = null;
      setDropHover(app, null, null);
      zone?.classList.remove("drag-over");
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

/* ── Expanded face + board tray (§5) ───────────────── */

// The upgrade benefit (§5): what one level buys, in the module's own units —
// the `Upgrade · +0.5 ν/s · 180 ν` shape. The silent wire buys nothing with
// a level, so it wears no button at all.
function upgradeBenefit(module: ModuleInstance): string | null {
  const gain = modulePower(module) * (BALANCE.rarityPower[module.rarity] - 1);
  switch (module.type) {
    case "additive":
    case "conditional":
      return `+${formatNumber(BALANCE.synthRate * gain)} ν/s`;
    case "infusor":
      return `+${formatNumber(100 * BALANCE.infusorBonus * gain)}% uplift`;
    case "focusKeyed":
      return `+${formatNumber(gain)} strength`;
    case "forge":
      return `+${formatNumber(gain)} progress/s`;
    case "spacer":
      return null;
  }
}

// The production contribution (§5): what the compact face doesn't say — the
// effect with its units, the bloom's one added line beside the Upgrade
// button.
function bloomContribution(state: GameState, module: ModuleInstance): string {
  const preview = computeRates(state, true);
  const strength = preview.chargeStrength.get(module.id) ?? 0;
  switch (module.type) {
    case "additive":
    case "conditional":
      return `+${formatNumber(preview.contributions.get(module.id)?.value ?? 0)} ν/s`;
    case "spacer":
      return "silent — conducts chords, produces nothing";
    case "focusKeyed":
      return `${formatNumber(modulePower(module))} charge strength while its window lasts`;
    case "infusor":
      return `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(strength))}% to adjacent`;
    case "forge":
      return `${formatNumber(preview.contributions.get(module.id)?.value ?? 0)} progress/s while charged`;
  }
}

// The expanded face: the module's own hex lifted off the grid toward the
// camera — the face itself IS the bloom, enlarged to fill it, its content
// shifted up to make room for the Upgrade button in the lower band. The
// ν/s unit rides the face's own readout, so nothing repeats. Opens only on
// click, only in upgrade mode, only for a deployed module; closes on
// outside click, Esc, or selecting elsewhere; holding the face starts the
// live drag.
//
// The pop only happens when it would actually enlarge the module: zoomed
// far in (few cells filling the wrap), the on-screen module already
// out-sizes the fixed bloom, and the affordances ride the closed face
// instead — a floating upgrade card anchored over the module's lower band.
// The host persists (the app creates it once); only the content rebuilds.
function renderBloom(app: App): void {
  const host = byId("module-bloom");
  if (!host) return;
  const { state, ui } = app;
  const module = state.modules.find((m) => m.id === ui.selected) ?? null;
  const open = state.mode === "upgrade" && module !== null && module.pos !== null;
  if (!open || !module || module.pos === null) {
    if (!host.hidden) {
      host.hidden = true;
      host.innerHTML = "";
      delete host.dataset.renderKey;
    }
    return;
  }
  const svg = document.getElementById("grid");
  const viewBox = (svg?.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const view = { x: viewBox[0] ?? 0, y: viewBox[1] ?? 0, width: viewBox[2] ?? 0, height: viewBox[3] ?? 0 };
  const box = { width: svg?.clientWidth ?? 0, height: svg?.clientHeight ?? 0 };
  const meet = viewMeet(view, box);
  // Ride the closed face when the pop would shrink the module.
  const inline = !bloomPops(meet, HEX_RADIUS);
  const snapshot = computeRates(state, true);
  const benefit = upgradeBenefit(module);
  const cost = levelCost(module.level);
  const affordable = wholeNous(state) >= cost;
  // The Forge's face readout moves per tick; its face tracks it.
  const forgeTick = module.type === "forge" ? Math.floor(state.forge.progress) : 0;
  const key = JSON.stringify([module.id, module.level, module.rarity, benefit, affordable, forgeTick, inline]);
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.classList.toggle("inline", inline);
    const readouts = `
      <div class="bloom-readouts">
        ${inline ? `<p class="bloom-contribution mono">${bloomContribution(state, module)}</p>` : ""}
        ${
          benefit
            ? `<button class="bloom-upgrade" id="bloom-upgrade" ${affordable ? "" : "disabled"} title="${affordable ? "Upgrade this module" : "Not enough whole nous"}">
                <span>Upgrade · <small class="mono">${benefit}</small></span>
                <strong class="mono">${formatInt(cost)} ν</strong>
              </button>`
            : ""
        }
      </div>`;
    if (inline) {
      host.innerHTML = readouts;
    } else {
      // The face fills the bloom hexagon exactly (viewBox = the hexagon's
      // bounding box). The engraving alone shifts up to make room for the
      // button — the chassis hexagon and its rings stay welded to the plate
      // edge — and the enlarged readout carries the ν/s unit itself. No
      // button, no need for the room: the face sits nearer its natural
      // layout.
      const face = faceReadoutFor(state, module, module.pos, snapshot, true);
      host.innerHTML = `
        <div class="bloom-plate" data-type="${module.type}" data-rarity="${module.rarity}">
          <svg class="bloom-face" viewBox="-52.8282 -61 105.6563 122" preserveAspectRatio="none" aria-hidden="true">${moduleFace({
            type: module.type,
            rarity: module.rarity,
            readout: face.readout,
            ...(face.readoutClass ? { readoutClass: face.readoutClass } : {}),
            ...(face.note ? { note: face.note } : {}),
            level: module.level,
            contentShift: benefit ? -20 : -12,
          })}</svg>
          ${readouts}
        </div>`;
      // Holding the face starts the live drag: the bloom collapses into the
      // ghost, and a drop leaves it closed (§5).
      const faceNode = host.querySelector(".bloom-face");
      if (faceNode) bindPointerDrag(app, faceNode, module.id);
    }
    byId("bloom-upgrade")?.addEventListener("click", () => app.upgrade(module.id));
  }
  // Position over the module's cell on every render — the board may have
  // grown or reflowed since the last one.
  const [cx, cy] = viewPoint(point(module.pos), view, box);
  if (inline) {
    // The card rides the closed face's lower band: centered, its body over
    // the taper below the face's note — hanging past the tip a little at
    // threshold zooms, where the taper is too tight to hold it.
    const width = box.width > 0 ? Math.min(BLOOM_WIDTH, box.width) : BLOOM_WIDTH;
    const halfHeight = meet * HEX_RADIUS;
    const left = Math.min(Math.max(cx - width / 2, 0), Math.max(0, box.width - width));
    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(cy + halfHeight * 0.85 - 34)}px`;
    host.style.width = `${width}px`;
    host.style.height = "auto";
    host.classList.remove("below");
  } else {
    const layout = bloomLayout(point(module.pos), HEX_RADIUS, view, box);
    host.hidden = false;
    host.classList.toggle("below", layout.below);
    host.style.left = `${Math.round(layout.left)}px`;
    host.style.top = `${Math.round(layout.top)}px`;
    host.style.width = `${layout.width}px`;
    host.style.height = `${layout.height}px`;
  }
  host.hidden = false;
}

// The board-surface tray (§5): the inventory docked over the board's bottom
// edge. Retrieve by dragging off the board into it — the chord-breaking
// gesture — place by clicking an item then a cell (occupied placement
// swaps). Hidden while the flow board is locked.
function renderInventoryTray(app: App): void {
  const tray = byId("inventory-zone");
  if (!tray) return;
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  tray.classList.toggle("off", !upgrade);
  const inventory = state.modules.filter((m) => m.pos === null);
  const key = JSON.stringify([upgrade, inventory.map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}`)]);
  if (tray.dataset.renderKey === key) return;
  tray.dataset.renderKey = key;
  tray.innerHTML = `<span class="tray-label">TRAY</span>
    <div class="tray-items">${
      inventory
        .map(
          (m) =>
            `<button class="inventory-tile" data-inv="${m.id}" data-rarity="${m.rarity}" data-type="${m.type}" title="${META[m.type].name} · ${RARITY_LABEL[m.rarity]} — click, then a cell">${hexTileSvg(m)}</button>`,
        )
        .join("") || `<span class="tray-empty">drag a module here to store it</span>`
    }</div>`;
  tray.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach((button) => {
    const id = button.getAttribute("data-inv")!;
    button.addEventListener("click", () => app.beginPlacing(id));
    bindPointerDrag(app, button, id);
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
    ui.selected,
    ui.placing,
    state.bankedRolls.length,
    module?.level ?? null,
    module?.rarity ?? null,
    // Module moves (drag, place, return, combine) must refresh the panel's
    // read even when the selection itself never changes.
    state.modules.map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}:${m.pos ? `${m.pos.q},${m.pos.r}` : "-"}`).join("|"),
  ]);
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    if (module) {
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

function effectDescription(module: ModuleInstance): string {
  switch (module.type) {
    case "additive":
      return "One unified synth term: base rate at its cell's note, scaled by level and rarity. Chords are named pitch sets recognized over connected synthesizers — any voicing, any octave — and every instance multiplies the whole composite.";
    case "conditional":
      return "A synth term plus a bonus for every chord instance it belongs to — a doubled cluster counts each complete voice-set it sings in.";
    case "spacer":
      return "Silent wire: it never sounds, never joins a pitch set, and produces nothing — it conducts chord adjacency through chains of wired cells, so bridged chords match by pitch content across the connection.";
    case "focusKeyed":
      return "The generator (ADR-0018: the launch generator is focus-keyed). It never drips live: every session end banks a charge window — a tenth of that session's live practice time — and the generator spends it as output during the next session's first minutes. Charge is a reserve you carry between sessions.";
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
    case "additive":
      return { text: `+${formatNumber(BALANCE.synthRate * power * factor)} ν/s`, value: BALANCE.synthRate * power * factor };
    case "conditional":
      return { text: `+${formatNumber(BALANCE.synthRate * power * factor)} ν/s · +${formatNumber(100 * BALANCE.conditionalChordBonus)}% per chord instance`, value: BALANCE.synthRate * power * factor };
    case "spacer":
      return { text: "silent — conducts chords, produces nothing", value: 0 };
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
  const partner = state.modules.find((m) => m.id !== module.id && m.type === module.type && m.rarity === module.rarity);

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
      ${stat("Bonus to adjacent", `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(chargeStrength))}%`)}
      ${stat("Charge", chargeStrength > 0 ? `strength ${formatNumber(chargeStrength)}` : "none")}`;
  } else if (module.type === "spacer") {
    chargeStats = `
      ${stat("Note", module.pos !== null ? cellNoteOf(module.pos) : "—")}
      ${stat("Conducts", "chord adjacency through wired-cell chains")}
      ${stat("Charge", "never — the wire is silent")}`;
  } else {
    const named = preview.namedChords.filter((c) => c.moduleIds.includes(module.id));
    const chordSummary =
      named.length > 0
        ? named.map((c) => (c.instances > 1 ? `${c.name} ×${c.instances}` : c.name)).join(" + ")
        : "chordless";
    const pitch = contribution?.pitch ?? null;
    const row = module.pos !== null ? octaveRowOf(module.pos) : null;
    chargeStats = `
      ${stat("Note", pitch !== null && row !== null ? `${noteNameOf(pitch)} — octave row ${row >= 0 ? "+" : ""}${row}` : "—")}
      ${stat("Chords", chordSummary)}
      ${stat("Charge", chargeStrength > 0 ? `strength ${formatNumber(chargeStrength)} (×${formatNumber(chargedFactor(chargeStrength))})` : "none")}`;
  }

  // The module panel is an information surface (§5): upgrades live on the
  // expanded face, so no upgrade CTA appears here — in either mode.
  host.innerHTML = `
    <div class="module-heading">
      <button class="quiet small" id="back-overview">← Back</button>
      <h1>${meta.name}</h1>
      <span class="rarity-chip ${module.rarity}">${RARITY_LABEL[module.rarity]}</span>
    </div>
    ${focus}
    <section>
      <div class="eyebrow">MODULE POWER</div>
      <div class="level-heading">Level <strong>${module.level}</strong><span class="level-effect">${effect.text}</span></div>
      <p class="small muted" style="margin:6px 0 0">${effectDescription(module)}</p>
      ${!upgrade ? `<p class="small muted">Upgrades happen between sessions.</p>` : ""}
      ${upgrade && partner && module.rarity !== "rare"
        ? `<button id="combine-pair">Combine with its ${RARITY_LABEL[module.rarity]} pair</button>`
        : ""}
    </section>
    <section>
      <div class="eyebrow">${upgrade ? "NEXT SESSION PREVIEW" : "LIVE GRID"}</div>
      ${stat("Position", module.pos ? `${cellNoteOf(module.pos)} · ${module.pos.q}, ${module.pos.r}` : "inventory")}
      ${chargeStats}
    </section>`;

  byId("back-overview")?.addEventListener("click", () => app.select(null));
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
    // PROTOTYPE (issue #119): de-duplicating planned time. Every variant
    // gives the console clock the live session — the popover no longer
    // repeats it. Variants differ on where PLANNING lives: A plans at the
    // enter prompt; B and C plan here, in the Time app.
    const variant = prototypeVariant();
    if (upgrade) {
      if (variant === "a") {
        return `<section class="focus-controls">
          <p class="small muted">Planning happens at Enter flow — the armed plan shows in the console's clock block.</p>
          <button class="quiet small time-history" id="time-history">History</button>
        </section>`;
      }
      return `<section class="focus-controls">
        ${planControlsHtml(app)}
        <button class="quiet small time-history" id="time-history">History</button>
      </section>`;
    }
    if (variant) {
      return `<section class="focus-controls">
        <p class="small muted">The console clock keeps session time — the Time app holds the history.</p>
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

// The planned-target affordances (§6), shared by the Time app's panel and
// the enter prompt: preset chips as quick picks, free 1–90 minute entry in
// one-minute steps — and open-ended as its own mode, never a duration
// choice. They ride the very first start (ADR-0019), visible but unpushed:
// the resting plan is open-ended, and only a picked plan ever arms the
// target signals (§4).
function planControlsHtml(app: App): string {
  const open = app.ui.chosenTarget === null;
  const chosen = app.ui.chosenTarget;
  const minutes = chosen === null ? null : Math.round(chosen / 60);
  return `<div class="time-plan">
    <div class="plan-chips" role="group" aria-label="Planned session length in minutes">
      ${PLAN_PRESET_MINUTES.map(
        (option) =>
          `<button class="plan-chip${minutes === option ? " active" : ""}" data-plan="${option}" aria-pressed="${minutes === option}">${option}</button>`,
      ).join("")}
    </div>
    <div class="plan-free">
      <input type="number" id="plan-minutes" min="${PLAN_MIN_MINUTES}" max="${PLAN_MAX_MINUTES}" step="1" placeholder="1–90"
        value="${minutes ?? ""}" ${open ? "disabled" : ""} aria-label="Custom session length, 1 to 90 minutes" />
      <span class="plan-unit">min</span>
    </div>
    <button id="plan-open" class="plan-open${open ? " active" : ""}" aria-pressed="${open}">Open-ended</button>
    <p class="clock-caption">${open ? "Open-ended" : "Planned practice"}</p>
  </div>`;
}

// The plan affordances' binding within any scope (the Time popover or the
// enter modal): chips pick a preset, the free entry takes any whole minute
// from 1 to 90 (clamped, one-minute steps), and open-ended is its own mode
// toggle.
function bindPlanControls(app: App, scope: HTMLElement): void {
  scope.querySelectorAll<HTMLButtonElement>("[data-plan]").forEach((chip) => {
    chip.addEventListener("click", () => {
      app.ui.chosenTarget = Number(chip.getAttribute("data-plan")) * 60;
      app.render();
    });
  });
  const planInput = scope.querySelector("#plan-minutes") as HTMLInputElement | null;
  planInput?.addEventListener("change", () => {
    const minutes = Math.round(Number(planInput.value));
    if (Number.isFinite(minutes) && planInput.value !== "") {
      app.ui.chosenTarget = Math.min(PLAN_MAX_MINUTES, Math.max(PLAN_MIN_MINUTES, minutes)) * 60;
      app.render();
    }
  });
  scope.querySelector("#plan-open")?.addEventListener("click", () => {
    app.ui.chosenTarget = null;
    app.render();
  });
}

function bindAppPanel(app: App, scope: HTMLElement): void {
  bindPlanControls(app, scope);
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

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function effectTextFor(module: ModuleInstance, value: number, strength = 0): string {
  switch (module.type) {
    case "additive":
    case "conditional":
      return `+${formatNumber(value)} ν/s`;
    case "spacer":
      return "silent — conducts chords";
    case "focusKeyed":
      return `${formatNumber(modulePower(module))} strength`;
    case "infusor":
      return `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(strength))}% to adjacent`;
    default:
      return `${formatNumber(value)} progress/s`;
  }
}

/* ── Grid & inventory panel ────────────────────────── */

// A canvas-style face tile — the same readout panel the board renders, with
// nominal values for the module's level — shared by the inventory grid and
// the live drag ghost so a carried tile looks identical to the one waiting in
// inventory (candidate-tile pattern from the Forge).
function hexTileSvg(module: ModuleInstance): string {
  return `<svg viewBox="-70 -70 140 140" aria-hidden="true">
    ${moduleFace({ type: module.type, rarity: module.rarity, readout: nominalReadout(module), level: module.level })}
  </svg>`;
}

// The face's prominent readout from nominal (uncharged) values.
function nominalReadout(module: ModuleInstance): string {
  const power = modulePower(module);
  switch (module.type) {
    case "additive":
      return `+${formatNumber(BALANCE.synthRate * power)}`;
    case "conditional":
      return `+${formatNumber(BALANCE.synthRate * power)}`;
    case "spacer":
      return "⌇";
    case "focusKeyed":
      return `⌁${formatNumber(power)}`;
    case "infusor":
      return `+${formatNumber(100 * BALANCE.infusorBonus * power)}%`;
    case "forge":
      return `${formatNumber(power)}/s`;
  }
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
      : kind === "honesty"
        ? [app.exitPending, app.state.session?.accounting.poolSeconds ?? 0, app.state.session?.accounting.bucketNous ?? 0]
        // The summary's identity: a fresh session's summary must never
        // reuse the previous one's already-rendered content.
        : kind === "summary"
          // The summary's identity: a fresh session's summary must never
          // reuse the previous one's already-rendered content.
          ? [app.state.summary?.sessionNumber ?? null, app.state.summary?.earned ?? null]
          : kind === "catalog"
            ? [
                app.ui.showAcquired,
                wholeNous(app.state),
                JSON.stringify(app.state.purchased),
                app.state.cellsBought,
                app.state.activatedApps.join("|"),
                // Module-upgrade rows reprice with levels, moves, and the roster.
                app.state.modules.map((m) => `${m.id}:${m.level}:${m.rarity}:${m.pos ? "d" : "i"}`).join("|"),
              ]
            : kind === "achievements"
              // Quantized progress: an open page refreshes when a bar visibly
              // moves, not on every clock tick.
              ? achProgressKey(app)
              // The enter prompt's own selection state (issue #95): the plan
              // and the kind-first picks re-render the modal the moment they
              // change — chips highlight on pick, never a stale footer.
              : kind === "enter"
                ? [app.ui.chosenTarget, app.ui.enter]
                : null;
  const renderKey = JSON.stringify([kind, app.ui.importError, app.state.session?.accounting.poolSeconds ?? 0, app.state.mode, extra]);
  // Clock ticks must not replace a save textarea or steal dialog focus.
  if (!backdrop.hidden && content.dataset.renderKey === renderKey) return;
  backdrop.hidden = false;
  content.dataset.renderKey = renderKey;
  if (kind === "settings") renderSettingsModal(app, content);
  else if (kind === "catalog") renderCatalogModal(app, content);
  else if (kind === "forge") renderForgeModal(app, content);
  else if (kind === "achievements") renderAchievementsModal(app, content);
  else if (kind === "export") renderExportModal(app, content);
  else if (kind === "import") renderImportModal(app, content);
  else if (kind === "reset") renderResetModal(app, content);
  else if (kind === "honesty") renderHonestyModal(app, content);
  else if (kind === "enter") renderEnterModal(app, content);
  else if (kind === "summary") renderSummaryModal(app, content);
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
    <div class="pref-row">
      <input type="checkbox" id="pref-mute" ${app.state.muted ? "checked" : ""} />
      <label for="pref-mute">Mute all sound</label>
      <small class="muted">silences every sound, the target chime included</small>
    </div>
    <div class="modal-actions"><button id="settings-export">Export save</button><button id="settings-import">Import save</button><button id="settings-reset">Reset progress</button></div>`;
  byId("pref-mute")?.addEventListener("change", (event) => {
    app.setMuted((event.target as HTMLInputElement).checked);
  });
  for (const kind of ["export", "import", "reset"] as const) {
    byId(`settings-${kind}`)?.addEventListener("click", () => app.openModal(kind));
  }
  wireClose(app);
}

function renderCatalogModal(app: App, content: HTMLElement): void {
  const { state, ui } = app;
  const shelfTypes = Object.keys(BALANCE.shelfPrices) as (keyof typeof BALANCE.shelfPrices)[];

  // One-time shelf offers on top; acquired items demote below the checkbox.
  const openShelf = shelfTypes.filter((type) => !state.purchased[type]);
  const ownedShelf = shelfTypes.filter((type) => state.purchased[type]);

  // The activation ladder (ADR-0013) rests empty at launch, so the catalog
  // omits its activation section entirely (ADR-0019): no telegraph row, no
  // pricing — after session one the hinted generator pull is the only spend
  // path. The section returns with the ladder's first tenant, priced by
  // that tenant's effort; the rung markup is not preserved here.

  // Cells (ADR-0013): the permanent catalog row. The price is not quoted
  // here — it lives where the purchase commits, on the board's frontier.
  const cellPrice = cellCost(state.cellsBought);
  const cellAffordable = wholeNous(state) >= cellPrice;
  const cellCountdown = upgradeCountdown(app, cellPrice);

  content.innerHTML = `
    ${modalTop("CATALOG")}
    <h2 id="modal-title">Shape what comes next.</h2>
    <p class="lead">${formatInt(state.nous)} ν available.</p>
    ${openShelf.length > 0 ? `
      <h3 class="catalog-section-title">Starter shelf</h3>
      <div class="shop-list">${openShelf.map((type) => {
        const price = BALANCE.shelfPrices[type];
        const affordable = wholeNous(state) >= price;
        const countdown = upgradeCountdown(app, price);
        const hint = SHELF_HINTS[type];
        const moduleMeta = META[SHELF_MODULE[type]];
        return `<div class="shop-item">
          <div><h3>${moduleMeta.name}</h3><small>${moduleMeta.role}</small>${hint ? `<em class="shop-hint">${hint}</em>` : ""}</div>
          <span class="shop-buy">
            <button class="primary" data-buy="${type}" ${affordable ? "" : "disabled"}>${formatInt(price)} ν</button>
            ${countdown ? `<small class="shop-countdown mono">${countdown}</small>` : ""}
          </span>
        </div>`;
      }).join("")}</div>` : ""}
    ${openShelf.length === 0 ? `<p class="empty-copy">The shelf is empty.</p>` : ""}
    <h3 class="catalog-section-title">Cells</h3>
    <div class="shop-list">
      <div class="shop-item">
        <div><h3>Board cell</h3><small>Empty hexes to place modules on — you choose where it touches the board.</small></div>
        <span class="shop-buy">
          <button class="primary" id="buy-cell" ${cellAffordable ? "" : "disabled"} title="${cellAffordable ? "Arm the purchase — pick a frontier hex on the board" : "Not enough nous"}">${formatInt(cellPrice)} ν</button>
          ${cellCountdown ? `<small class="shop-countdown mono">${cellCountdown}</small>` : ""}
        </span>
      </div>
    </div>
    <p class="small muted" style="margin:6px 0 0">Each purchase raises the next price.</p>
    <label class="catalog-toggle"><input type="checkbox" id="catalog-show-acquired" ${ui.showAcquired ? "checked" : ""}/> Show acquired (${ownedShelf.length}/${shelfTypes.length})</label>
    ${ui.showAcquired && ownedShelf.length > 0 ? `
      <h3 class="catalog-section-title">Acquired</h3>
      <div class="shop-list catalog-owned">
        ${ownedShelf.map((type) => `<div class="shop-item owned"><div><h3>${META[SHELF_MODULE[type]].name}</h3><small>${META[SHELF_MODULE[type]].role}</small></div><span class="activation-owned mono">in inventory</span></div>`).join("")}
      </div>` : ""}
    <p class="modal-note">Shelf offers hide once acquired; roll copies stay, as combination material.</p>`;
  content.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) => {
    button.addEventListener("click", () => {
      app.buyShelf(button.getAttribute("data-buy") as keyof typeof BALANCE.shelfPrices);
    });
  });
  byId("buy-cell")?.addEventListener("click", () => app.armCellPurchase());
  byId("catalog-show-acquired")?.addEventListener("change", (event) => {
    app.ui.showAcquired = (event.target as HTMLInputElement).checked;
    app.render();
  });
  wireClose(app);
}

function forgeEffect(type: ModuleInstance["type"], state: GameState): string {
  const charged = chargedFactor(1);
  switch (type) {
    case "additive": return `+${formatNumber(BALANCE.synthRate)} ν/s unified synth term<br>+${formatNumber(BALANCE.synthRate * charged)} ν/s at charge strength 1`;
    case "conditional": return `+${formatNumber(BALANCE.synthRate)} ν/s synth term<br>+${formatNumber(100 * BALANCE.conditionalChordBonus)}% per chord instance it belongs to`;
    case "spacer": return `Silent wire — never sounds, never joins a pitch set<br>conducts chord adjacency through chains of wired cells`;
    case "focusKeyed": return `The generator — keyed to your focus<br>each session end banks a charge window (a tenth of its live practice time), spent as its output next session`;
    case "infusor": return `+${formatNumber(BALANCE.infusorBonus * 100)}% to adjacent production contributions<br>+${formatNumber(BALANCE.infusorBonus * charged * 100)}% at charge strength 1`;
    case "forge": return `1 Forge progress per received charge strength<br>Next roll: ${formatNumber(forgeThreshold(state.forge.earned))} progress`;
    default: return "Not yet active";
  }
}

function candidateReadout(type: ModuleInstance["type"]): string {
  switch (type) {
    case "additive":
      return `+${formatNumber(BALANCE.synthRate)}`;
    case "conditional":
      return `+${formatNumber(BALANCE.synthRate)}`;
    case "spacer":
      return "⌇";
    case "focusKeyed":
      return "⌁1";
    case "infusor":
      return `+${formatNumber(BALANCE.infusorBonus * 100)}%`;
    case "forge":
      return "1/s";
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
        <button class="candidate-tile" data-choice="${candidate.id}" data-offer="${offer.id}" data-rarity="${candidate.rarity}" data-type="${candidate.type}" title="Take the ${RARITY_LABEL[candidate.rarity]} ${META[candidate.type].name}">
          <svg viewBox="-70 -70 140 140" aria-hidden="true">
            ${moduleFace({ type: candidate.type, rarity: candidate.rarity, readout: candidateReadout(candidate.type), level: 0 })}
          </svg>
          <span class="rarity">${RARITY_LABEL[candidate.rarity]}</span>
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
    <p class="lead">Copy, or download as a file.</p>
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
    <p class="lead">Replaces the current instrument.</p>
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
    <p class="lead">Erases everything. Export first for a backup.</p>
    <div class="modal-actions">
      <button id="reset-cancel">Keep playing</button>
      <button id="reset-confirm" class="primary" style="background:var(--danger);border-color:var(--danger)">Erase everything</button>
    </div>`;
  byId("reset-cancel")?.addEventListener("click", () => app.closeModal());
  byId("reset-confirm")?.addEventListener("click", () => app.hardReset());
  wireClose(app);
}

// The honesty report (focus-tool spec §2): the mandatory adjudication when
// a session returns with provisional time outstanding. One surface, both
// uses — mid-session and at exit (framing copy differs) — never merged into
// the dismissible summary. The away minutes and the bucket are stated up
// top; each option carries its consequences inline as its label; the answer
// banks or drops the bucket in one move. Non-dismissible (ADR-0019): it
// settles, or the player leaves and the next return re-presents it,
// recalculated.
function renderHonestyModal(app: App, content: HTMLElement): void {
  const session = app.state.session;
  const pool = session?.accounting.poolSeconds ?? 0;
  const bucket = session?.accounting.bucketNous ?? 0;
  const target = session?.target ?? null;
  const planned = target !== null;
  const hold = `${formatNumber(bucket)} ν held in the bucket`;
  const head = planned
    ? `${formatDuration(pool)} away past your plan — ${hold}.`
    : `${formatDuration(pool)} away — ${hold}.`;
  const options: { outcome: "missed" | "planned" | "full"; label: string; consequence: string }[] = [
    {
      outcome: "missed",
      label: outcomeLabel("missed"),
      consequence: `the ${formatNumber(bucket)} ν drop; those minutes don't count`,
    },
    ...(planned
      ? [
          {
            outcome: "planned" as const,
            label: outcomeLabel("planned"),
            consequence: `credit rises to your ${formatClock(target)} plan; the ν banks`,
          },
        ]
      : []),
    {
      outcome: "full",
      label: outcomeLabel("full"),
      consequence: `all ${formatDuration(pool)} count; the ν banks`,
    },
  ];
  content.innerHTML = `
    <div class="modal-top"><span class="eyebrow">${app.exitPending ? "BEFORE YOU WRAP UP" : "HONESTY REPORT"}</span></div>
    <h2 id="modal-title">While you were away</h2>
    <p class="lead">${head}</p>
    <p class="small muted">Nothing is final until you answer${planned ? " — only the time past your plan is waiting" : ""}. What already banked stays banked.</p>
    <div class="honesty-choices">
      ${options
        .map(
          (option) => `<button class="honesty-choice" data-honesty="${option.outcome}">
        <span class="honesty-label">${option.label}</span>
        <small class="honesty-consequence">${option.consequence}</small>
      </button>`,
        )
        .join("")}
    </div>`;
  content.querySelectorAll<HTMLButtonElement>("[data-honesty]").forEach((button) => {
    button.addEventListener("click", () => {
      app.resolveHonesty(button.getAttribute("data-honesty") as "missed" | "planned" | "full");
    });
  });
}

/* ── Session modals (§5.5, §5.7) ───────────────────── */

// The enter prompt's decided shape (issue #92, built by #95): selection is
// kind-first — a segmented `A habit | New habit | Unstructured` control, a
// pane serving the picked kind, and a sticky footer band (Back / live
// summary / `Begin — {kind} · {duration}`) whose CTA arms per the kind's
// requirement: a habit picked, a name typed, or always for unstructured. It
// carries the duration affordances from the very first start (ADR-0019,
// §6–7) — preset chips + free 1–90 entry, open-ended resting, session-one's
// steer riding above — and the renderKey fix: the modal's key rides the plan
// and the selection state, so picks re-render immediately.
// The one resolution of the selection — the only place that switches on the
// kind. The kind's requirement (a habit picked, a name typed, or nothing for
// unstructured) decides whether the session may start, and resolves its
// target: the picked habit's id, or the trimmed new-habit name.
function enterTarget(app: App): { armed: boolean; habitId: string | null; newName: string } {
  const { ui, state } = app;
  if (ui.enter.kind === "habit") {
    const habit = ui.enter.habitId === null ? undefined : state.habits.find((h) => h.id === ui.enter.habitId && !h.archived);
    return { armed: habit !== undefined, habitId: habit?.id ?? null, newName: "" };
  }
  if (ui.enter.kind === "new") {
    const newName = ui.enter.newName.trim();
    return { armed: newName !== "", habitId: null, newName };
  }
  return { armed: true, habitId: null, newName: "" };
}

interface EnterFootprint {
  armed: boolean;
  summary: string;
  cta: string;
}

// The footer band's current content, read off the shared resolution.
function enterFootprint(app: App): EnterFootprint {
  const duration = app.ui.chosenTarget === null ? "open-ended" : `${Math.round(app.ui.chosenTarget / 60)} min`;
  const target = enterTarget(app);
  if (!target.armed) {
    return app.ui.enter.kind === "new"
      ? { armed: false, summary: "name it to arm the start", cta: "Name your new habit" }
      : { armed: false, summary: "no habit picked yet", cta: "Select a habit" };
  }
  const what = target.newName
    ? target.newName
    : target.habitId === null
      ? "unstructured"
      : (app.state.habits.find((h) => h.id === target.habitId)?.name ?? "unstructured");
  return { armed: true, summary: `${what} · ${duration}`, cta: `Begin — ${what} · ${duration}` };
}

// The footprint's summary and CTA carry user-typed names; anything these
// strings feed as markup must escape them (the in-place footer refresh sets
// textContent, which must stay raw).
const escapeFootprint = (footprint: EnterFootprint): EnterFootprint => ({
  ...footprint,
  summary: escapeHtml(footprint.summary),
  cta: escapeHtml(footprint.cta),
});

function renderEnterModal(app: App, content: HTMLElement): void {
  const { state, ui } = app;
  const enter = ui.enter;
  const habits = state.habits.filter((h) => !h.archived);
  const footprint = escapeFootprint(enterFootprint(app));
  const kindTab = (kind: EnterKind, label: string) =>
    `<button class="mode-tab${enter.kind === kind ? " active" : ""}" data-enter-kind="${kind}" aria-pressed="${enter.kind === kind}">${label}</button>`;
  let pane = "";
  if (enter.kind === "habit") {
    pane = habits.length === 0
      ? `<p class="mode-explain">No habits yet — the New habit tab names your first.</p>`
      : `<div class="enter-choices">
      ${habits
        .map(
          (habit) => `<button class="enter-choice${enter.habitId === habit.id ? " selected" : ""}" data-enter-habit="${habit.id}" aria-pressed="${enter.habitId === habit.id}">
        <span class="dot"></span>
        <span class="enter-choice-name">${escapeHtml(habit.name)}</span>
        <small class="mono">${formatDuration(habit.seconds)}</small>
      </button>`,
        )
        .join("")}
    </div>
    <p class="mode-explain">Pick the habit this session counts toward.</p>`;
  } else if (enter.kind === "new") {
    pane = `<div class="enter-create">
      <input type="text" id="enter-habit-name" placeholder="Name it (piano, cooking…)" maxlength="40" aria-label="Name a new habit and start the session with it" value="${escapeHtml(enter.newName)}" />
    </div>
    <p class="mode-explain">A brand-new habit starts its clock with this session.</p>`;
  } else {
    pane = `<p class="mode-explain">No habit attached — the session runs, and nous is unaffected.</p>`;
  }
  content.innerHTML = `
    ${modalTop("ENTER FLOW")}
    <div class="enter-body">
      <h2 id="modal-title">What are you practicing?</h2>
      <div class="mode-tabs" role="group" aria-label="What kind of session is this?">
        ${kindTab("habit", "A habit")}${kindTab("new", "New habit")}${kindTab("unstructured", "Unstructured")}
      </div>
      <div class="mode-pane">${pane}</div>
      ${state.sessionsCompleted === 0 ? `<p class="enter-steer small muted">A first try can be short — five minutes or so, then exit and see what the session banked.</p>` : ""}
      ${
        // PROTOTYPE (issue #119): A plans at the enter prompt; B and C plan
        // in the Time app beforehand, so the prompt carries a pointer, not
        // a second copy of the controls.
        prototypeVariant() === "b" || prototypeVariant() === "c"
          ? `<p class="enter-plan-hint small muted">Planning lives in the Time app — set it there, or enter open-ended.</p>`
          : planControlsHtml(app)
      }
    </div>
    <div class="footer-band">
      <button id="enter-cancel" class="small">Back</button>
      <span class="cta-summary">${footprint.summary}</span>
      <button id="enter-begin" class="primary" ${footprint.armed ? "" : "disabled"}>${footprint.cta}</button>
    </div>`;
  bindPlanControls(app, content);
  // The same shared resolution arms the action: a typed name rides the
  // new-habit path; otherwise the target is the picked habit's id, with null
  // meaning unstructured rides beginFlow directly.
  const begin = () => {
    const target = enterTarget(app);
    if (!target.armed) return;
    if (target.newName) app.beginFlowNewHabit(target.newName);
    else app.beginFlow(target.habitId);
  };
  content.querySelectorAll<HTMLButtonElement>("[data-enter-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      enter.kind = button.getAttribute("data-enter-kind") as EnterKind;
      app.render();
    });
  });
  content.querySelectorAll<HTMLElement>("[data-enter-habit]").forEach((button) => {
    button.addEventListener("click", () => {
      enter.habitId = button.getAttribute("data-enter-habit");
      app.render();
    });
  });
  const nameInput = byId("enter-habit-name") as HTMLInputElement | null;
  // Typing never rebuilds the modal (nothing renders in the background while
  // the console sits in upgrade mode): the name rides ui state and the
  // footer refreshes in place, so the caret keeps its place while the CTA
  // arms. The next interaction that does render rebuilds with the name kept.
  const refreshFootprint = () => {
    const next = enterFootprint(app);
    const summary = content.querySelector(".cta-summary");
    const beginButton = byId("enter-begin");
    if (summary) summary.textContent = next.summary;
    if (beginButton) {
      beginButton.textContent = next.cta;
      (beginButton as HTMLButtonElement).disabled = !next.armed;
    }
  };
  nameInput?.addEventListener("input", () => {
    enter.newName = nameInput.value;
    refreshFootprint();
  });
  nameInput?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      if (enterTarget(app).armed) begin();
    }
  });
  byId("enter-begin")?.addEventListener("click", begin);
  byId("enter-cancel")?.addEventListener("click", () => app.closeModal());
  wireClose(app);
}

// One voice for both honesty surfaces (§2, §8–9): the report's option
// labels and the summary's factual event lines phrase each outcome the same
// way, so the report's promise and the summary's record can never drift.
const OUTCOME_PHRASES: Record<HonestyOutcome, string> = {
  missed: "didn't practice",
  planned: "did what I planned",
  full: "practiced the whole time away",
};

const outcomeLabel = (outcome: HonestyOutcome): string => {
  const phrase = OUTCOME_PHRASES[outcome];
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

// The honesty event's neutral factual line (§8–9), the history list's
// format: accounting, not judgment — "22 min away · didn't practice".
function honestyEventLine(event: HonestyEvent): string {
  return `${secondsToMinutes(event.awaySeconds)} min away · ${OUTCOME_PHRASES[event.outcome]}`;
}

// The loud summary (§5.7, §8): shown once per session end, however the
// session ended — final numbers only. The headline is banked nous; practice
// time shows credited minutes in the history list's format; the honesty
// events sit beneath as neutral factual lines, where a dropped bucket's
// drop is visible — and there is no raw wall-duration row. The reflection's
// reserved slot rides above dismissal: free text plus a five-position
// rough–great slider, end labels only, middle neutral and the default. It
// records as either field is touched and stays absent otherwise, so every
// dismissal path — Continue, ✕, backdrop, Esc — logs the same.
function renderSummaryModal(app: App, content: HTMLElement): void {
  const summary = app.state.summary;
  if (!summary) {
    content.innerHTML = `${modalTop("SESSION SUMMARY")}<h2 id="modal-title">No session to summarize.</h2>`;
    wireClose(app);
    return;
  }
  const synthOnly = summary.infusors === 0 && summary.chordMultiplier === 1 && summary.empowerment === 1;
  const breakdown = synthOnly
    ? `the synth term alone — ${formatNumber(summary.synths)} ν/s is the whole formula`
    : [
        `synths +${formatNumber(summary.synths)} ν/s`,
        ...(summary.infusors > 0 ? [`infusors +${formatNumber(summary.infusors)} ν/s`] : []),
        ...(summary.chordMultiplier > 1 ? [`chords ×${formatNumber(summary.chordMultiplier)}`] : []),
        ...(summary.empowerment > 1 ? [`empowerment ×${formatNumber(summary.empowerment)}`] : []),
      ].join(" · ");
  // The "unlocked this session" row (ADR-0015): in-session unlocks queue
  // here instead of toasting, whatever the exit path.
  const unlocked = (summary.achievements ?? []).map(achievementName);
  const unlockRow = unlocked.length > 0
    ? `<div class="summary-row unlock">
        <span class="summary-label">Unlocked this session</span>
        <strong>${unlocked.join(" · ")}</strong>
      </div>`
    : "";
  const events = (summary.honestyEvents ?? [])
    .map((event) => `<p class="summary-event">${honestyEventLine(event)}</p>`)
    .join("");
  const reflection = summary.reflection;
  content.innerHTML = `
    ${modalTop(`SESSION ${summary.sessionNumber} · SUMMARY`)}
    <h2 id="modal-title" class="summary-headline">This session earned <strong class="mono">${formatNumber(summary.earned)}</strong> nous</h2>
    <div class="summary-rows">
      <div class="summary-row">
        <span class="summary-label">Practice time</span>
        <strong class="mono">${formatPracticeMinutes(summary.seconds, summary.plannedTarget ?? null)}</strong>
      </div>
      <div class="summary-row">
        <span class="summary-label">Rate achieved</span>
        <strong class="mono">${formatNumber(summary.ratePerMinute)} ν <small>per practice minute</small></strong>
        <small class="summary-note">${breakdown}</small>
      </div>
      ${unlockRow}
      ${summary.timeUnlocked
        ? `<div class="summary-row unlock">
        <span class="summary-label">New feature unlocked</span>
        <strong>Time your flow sessions</strong>
        <small class="summary-note">The Time app is live.</small>
      </div>`
        : ""}
    </div>
    ${events ? `<div class="summary-events">${events}</div>` : ""}
    <div class="summary-reflection">
      <span class="summary-label">How did it go?</span>
      <input type="text" id="summary-reflection-text" aria-label="Reflect on the session in words" value="${escapeHtml(reflection?.text ?? "")}" />
      <div class="reflection-slider">
        <span class="reflection-end">rough</span>
        <input type="range" id="summary-reflection-slider" min="1" max="${REFLECTION_SLIDER_POSITIONS}" step="1" value="${reflection?.slider ?? REFLECTION_SLIDER_NEUTRAL}" aria-label="How the session went, rough to great" />
        <span class="reflection-end">great</span>
      </div>
    </div>
    <div class="modal-actions"><button id="summary-continue" class="primary">Continue</button></div>`;
  byId("summary-reflection-text")?.addEventListener("input", (event) => {
    app.recordReflectionText((event.target as HTMLInputElement).value);
  });
  byId("summary-reflection-slider")?.addEventListener("input", (event) => {
    app.recordReflectionSlider(Number((event.target as HTMLInputElement).value));
  });
  byId("summary-continue")?.addEventListener("click", () => app.dismissSummary());
  wireClose(app);
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
