// The console region (ADR-0012): the surface structurally above the board —
// the welcome card, the session block (clock, captions, provisional flag,
// the Enter/Exit main switch and pause), the focus-app tiles and their
// popover shell, the readout end (rate, session total, nous, trophy), and
// the board toolbar. Renders from the RenderContext; every write is an
// intent.
import { appActive, appLockNote, FOCUS_APPS } from "../engine/apps";
import { activeHabit } from "../engine/habits";
import { cellCost, wholeNous } from "../engine/economy";
import { forgeThreshold } from "../engine/rolls";
import { poolOutstanding } from "../engine/trust";
import { formatClock, formatDuration } from "../engine/clock";
import { formatInt, formatNumber } from "./format";
import { APP_LABELS } from "./meta";
import { appIcon } from "./icons";
import { byId, escapeHtml } from "./dom";
import { keyedRegion } from "./region";
import { OPEN_ENDED_WORD, plannedFill, sessionCaption } from "./clockface";
import { projectedCountdown, type RenderContext } from "./context";
import { appPanelBody, bindAppPanel, panelKeyFacts, updateAppPanelLive } from "./panels";

/* ── Welcome card (§5.1) ───────────────────────────── */

// The one-time opening card: the Carrier is granted and its first upgrade is
// already affordable. Unforced — it locks nothing, and acknowledging or
// dismissing it once (persisted in the save) keeps it away forever. It is an
// upgrade-mode surface: it stands down for live sessions.
export function renderWelcome(ctx: RenderContext): void {
  const host = byId("welcome-card");
  if (!host) return;
  if (ctx.state.welcomeAcked || ctx.state.mode !== "upgrade") {
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
  byId("welcome-cta")?.addEventListener("click", () => ctx.intents.ackWelcomeToCarrier());
  byId("welcome-dismiss")?.addEventListener("click", () => ctx.intents.dismissWelcome());
}

/* ── Session block (§5.2) ──────────────────────────── */

// The unplanned shape's two words (§6): the clock slot only ever holds clock
// text, so an unplanned plan wears a dash placeholder there, while captions
// and the Time tile's compact plan name the mode itself.
const CLOCK_PLACEHOLDER = "--:--";

// Session controls: the clock block plus the Enter/Exit main switch and the
// pause control. The switch is the console's sole session gate — sessions
// start and end through it — and the switch's vermillion is the one colored
// console element: the switch itself and, while a session runs, the progress
// strip along the header's bottom edge (issue #63).
export function renderConsoleSession(ctx: RenderContext): void {
  const { state, ui } = ctx;
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
    const planned = ui.chosenTarget !== null;
    keyedRegion(host, `upgrade:${planned}`, () => {
      host.innerHTML = `
        <div class="console-clock">
          <p class="session-clock mono">${planned ? formatClock(ui.chosenTarget!) : CLOCK_PLACEHOLDER}</p>
          <p class="clock-caption">${planned ? "planned" : OPEN_ENDED_WORD}</p>
        </div>
        <div class="session-actions">
          <button class="main-switch idle" id="flow-switch" title="Enter flow — the board locks and runs itself">
            ${switchSvg}<span>Enter flow</span><i class="switch-state" aria-hidden="true"></i>
          </button>
        </div>`;
      byId("flow-switch")?.addEventListener("click", () => ctx.intents.startFlow());
    });
    renderSessionStrip(false);
    return;
  }

  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const reached = target !== null && elapsed >= target;

  keyedRegion(host, `flow:${state.mode}:${target === null ? "open" : reached ? "reached" : "timed"}`, () => {
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
    byId("pause-flow")?.addEventListener("click", () => (state.mode === "paused" ? ctx.intents.resume() : ctx.intents.pause()));
    byId("flow-switch")?.addEventListener("click", () => ctx.intents.endFlow());
  });

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

/* ── Focus-app tiles and popover shell (ADR-0012) ──── */

// Focus-app access (ADR-0012): one tile per app — the launch four live
// from minute 0 (ADR-0019), each wearing its live state, with its panel
// opening as a popover anchored directly beneath the tile. The locked-tile
// plumbing stays for a future ladder tenant; locked tiles would open
// nothing, and the board never moves, reflows, or dims while the console
// is used.
// (Display names live in meta.ts's APP_LABELS.)

// The Time tile's compact plan: the clock, or the mode word for open-ended.
function planShort(chosenTarget: number | null): string {
  return chosenTarget === null ? OPEN_ENDED_WORD : formatClock(chosenTarget);
}

export function renderConsoleApps(ctx: RenderContext): void {
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

/* ── Readout end (§7) ───────────────────────────────── */

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
export function renderConsoleReadout(ctx: RenderContext): void {
  const { state } = ctx;
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
      byId("trophy-button")?.addEventListener("click", () => ctx.intents.openModal("achievements"));
    }
    // One production readout (§7: rates per-second everywhere): the ν/s
    // figure matches the formula chip — projected in upgrade mode, ticking
    // with the board in flow — and the flow session appends what it made.
    const rate = ctx.memo.snapshot().rate;
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

/* ── Board toolbar ──────────────────────────────────── */

const CELL_TOOL_SVG = `<svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0-6v12M-6 0h12"/></svg>`;

export function renderTools(ctx: RenderContext): void {
  const { state, ui } = ctx;
  const host = byId("board-tools");
  if (!host) return;
  const upgrade = state.mode === "upgrade";
  const managing = ui.managing;
  const key = JSON.stringify([upgrade, state.bankedRolls.length, managing, ui.buyingCell, ui.showChords]);
  keyedRegion(host, key, () => {
    const forgeReady = upgrade && state.bankedRolls.length > 0;
    host.innerHTML = `
      <button class="small" id="tool-store" ${upgrade ? "" : "disabled"} title="${upgrade ? "The catalog: starter-shelf offers and board cells" : "Purchases happen between sessions"}">Catalog</button>
      <button class="small tool-forge" id="tool-forge" ${forgeReady ? "" : "disabled"} title="">
        <span>Forge${state.bankedRolls.length > 0 ? ` · ${state.bankedRolls.length}` : ""}</span>
        <i class="forge-pip" aria-hidden="true"><i data-live="forge-pip"></i></i>
      </button>
      <button class="small ${managing ? "active" : ""}" id="tool-manage" ${upgrade ? "" : "disabled"} aria-pressed="${managing}" title="${managing ? "Exit arranging (Esc)" : upgrade ? "Move modules" : "The grid is locked during flow"}">Grid &amp; inventory</button>
      <button class="small tool-cell${ui.buyingCell ? " active" : ""}" id="tool-cell" ${upgrade ? "" : "disabled"} aria-pressed="${ui.buyingCell}" title="">${CELL_TOOL_SVG}</button>
      <button class="small${ui.showChords ? " active" : ""}" id="tool-chords" aria-pressed="${ui.showChords}" title="Show chords — light the chord voices, link the pairs, outline and label named chords · C">Chords</button>`;
    byId("tool-store")?.addEventListener("click", () => ctx.intents.openModal("store"));
    byId("tool-forge")?.addEventListener("click", () => ctx.intents.openModal("forge"));
    byId("tool-manage")?.addEventListener("click", () => (managing ? ctx.intents.stopManaging() : ctx.intents.startManaging()));
    byId("tool-cell")?.addEventListener("click", () => (ui.buyingCell ? ctx.intents.cancelCellPurchase() : ctx.intents.armCellPurchase()));
    byId("tool-chords")?.addEventListener("click", () => ctx.intents.toggleChords());
  });
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
      const countdown = projectedCountdown(ctx, price);
      cellButton.title = `New cell — ${formatInt(price)} ν${countdown ? ` · ${countdown}` : ""}`;
      cellButton.disabled = wholeNous(state) < price;
    }
  }
}
