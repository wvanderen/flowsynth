import { chargedFactor, cellCost, cellPurchasePrice, chargeDelivered, computeRates, emittedStrength, levelCost, longGoalCost, modulePower, wholeNous } from "../engine/economy";
import { newChordTerms, wouldFormPreview } from "../engine/chords";
import { combinePreview, type CombinePreview } from "../engine/actions";
import { deployedAt } from "../engine/economy";
import { adjacent, sameHex } from "../engine/hex";
import { forgeThreshold } from "../engine/rolls";
import { BALANCE, CATEGORY_OF, isSynthesizerType, REFLECTION_SLIDER_NEUTRAL, REFLECTION_SLIDER_POSITIONS, SHELF_MODULE } from "../engine/constants";
import { formatClock, formatDuration } from "../engine/clock";
import { cellNoteOf, positionInRange } from "../engine/lattice";
import { appActive, appLockNote, TILE_APPS, type FocusApp } from "../engine/apps";
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
import { arcCardDue } from "../engine/arc";
import { goalCapacity, goalRequiredSeconds, goalSummary, goalTrackerState, type GoalTrackerState } from "../engine/goals";
import { ACHIEVEMENTS, achievementName, type AchievementCategory, type AchievementContext, type AchievementDef } from "../engine/achievements";
import type { GameState, Goal, Habit, Hex, HonestyEvent, HonestyOutcome, ModuleInstance, NoteEntry, RateSnapshot } from "../engine/types";
import type { App, ChordHover, EnterKind, EnterSelection, ModalKind } from "./app";
import { suppressNextClick } from "./click";
import { appIcon, moduleIcon } from "./icons";
import { HEX_RADIUS, hexApothem, hexPoints, HUE_TOKEN_OF, moduleFace } from "./face";
import { bloomLayout, bloomPops, bloomSpan, viewMeet, viewPoint, type ViewFrame } from "./bloom";
import { chargeGlow, chargeLeads } from "./leads";
import { chordOverlay, chipWidth, type ChordMark } from "./chordlayer";
import { updateSvg } from "./svg";
import { PLAN_MIN_MINUTES, PLAN_MAX_MINUTES, PLAN_PRESET_MINUTES, APP_LABELS, HISTORY_PAGE_ROWS, META, RARITY_LABEL, SHELF_HINTS } from "./meta";
import { formatBalance, formatDate, formatInt, formatNumber, formatPracticeMinutes, chordTermLabel, practiceCountdown, secondsToMinutes } from "./format";
import { renderBoardLedger, renderHorizonBar, renderGameInfoStrip, rateDetailsHtml, updateRateDetailsLive, deployedRosterKey, unlockedCount, wireSynthPicks, FEATS_SVG } from "./ledger";
import { boardBounds, bindBoardNavigation, lensFrame, renderZoomCluster } from "./zoom";
import { containerWidth, RATE_DETAILS_BREAKPOINT_PX, isPhoneWidth, PHONE_MAX_PX } from "./container";
import { liveSet } from "./live";

const SPACING = 65;
// The adjacent-center distance the chord overlay's edge trace needs: on
// this pointy-top lattice every neighboring center sits exactly this far
// from its mate, whatever the direction.
const LATTICE_STEP = Math.sqrt(3) * SPACING;
const DRAG_THRESHOLD_PX = 6;
const boundCells = new WeakSet<SVGElement>();

function point({ q, r }: Hex): [number, number] {
  return [Math.sqrt(3) * SPACING * (q + r / 2), SPACING * 1.5 * r];
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// The in-place patchers' one text write: touch the node only when its
// content actually changes (#115).
function setText(node: Element | null | undefined, text: string): void {
  if (node && node.textContent !== text) node.textContent = text;
}

// The rate shown in the ledger, hexes, and rate details: live during flow,
// projected build rate while arranging in upgrade mode. Module panels preview
// charge separately via computeRates(state, true).
function currentSnapshot(state: GameState): RateSnapshot {
  return computeRates(state, state.mode === "flow");
}

function stat(label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono">${value}</span></div>`;
}

export function render(app: App): void {
  // One rate computation per pass, both bases (§7): the display basis —
  // live during flow, projected build rate while arranging — and the
  // charge-projected basis the panels, bloom, and countdowns preview.
  // Every surface below reads the pass's snapshot; none recomputes.
  const live = currentSnapshot(app.state);
  const projected = computeRates(app.state, true);
  renderConsoleSession(app);
  renderConsoleApps(app, projected);
  renderBoardLedger(app, live);
  renderTools(app, projected);
  renderGrid(app, live, projected);
  renderInventoryTray(app);
  renderArcCard(app);
  renderBloom(app, projected);
  renderZoomCluster(app);
  renderHorizonBar(app);
  renderGameInfoStrip(app, live);
  renderModal(app, live, projected);
  renderDev(app);
}

/* ── Console (ADR-0012) ────────────────────────────── */

// The unplanned shape's two words (§6): the clock slot only ever holds clock
// text, so an unplanned plan wears a dash placeholder there, while captions
// and the Time app's compact plan name the mode itself.
const CLOCK_PLACEHOLDER = "--:--";
const OPEN_ENDED_WORD = "open-ended";

// The clock is itself the plan affordance (§7): clicking it opens the Time
// app. Both console shapes wear the same wiring; the clock anchor counts as
// "inside" for the popover click-away closer (app.ts), so the click that
// opens the Time popover never closes it in the same gesture.
function wireClockPlan(app: App): void {
  byId("clock-plan")?.addEventListener("click", () => {
    app.openApp("time");
  });
}

// The upgrade-mode console clock's plan texts (#114, #115): the slot only
// ever holds clock text, so a plan change swaps the two text nodes in place
// — the clock button itself never leaves the DOM, keeping any interaction
// with it (and the strip around it) untouched.
function refreshConsoleClockPlan(app: App): void {
  if (app.state.mode !== "upgrade") return;
  const chosen = app.ui.chosenTarget;
  const time = chosen !== null ? formatClock(chosen) : CLOCK_PLACEHOLDER;
  const word = chosen !== null ? "planned" : OPEN_ENDED_WORD;
  const clock = document.querySelector("#console-session .session-clock");
  setText(clock, time);
  const caption = document.querySelector("#console-session .clock-caption");
  setText(caption, word);
}

// Session controls (issue #148): the clock with its Time disclosure, then
// the Enter/Exit main switch — the console's visual center of gravity and
// its sole session gate — with pause beside it during flow. The switch's
// vermillion is the one colored console element: the switch itself and,
// while a session runs, the progress strip along the header's bottom edge
// (issue #63). The console is pure control (§7): the clock is itself the
// plan affordance — its disclosure opens the Time app — and no production
// readout lives here.
function renderConsoleSession(app: App): void {
  const { state, ui } = app;
  const host = byId("console-session");
  if (!host) return;

  const switchSvg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.2 6.6a8 8 0 1 0 11.6 0"/></svg>`;
  const pauseSvg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5v14M15 5v14"/></svg>`;
  const resumeSvg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5.5v13l10.5-6.5Z"/></svg>`;
  const discloseSvg = `<svg class="clock-disclose" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 4.5 3.5 3.5 3.5-3.5"/></svg>`;

  // The clock block: digits with the small disclosure chevron riding beside
  // them, the caption beneath — one stable two-line stack in both modes, so
  // the live clock never shifts vertically. The provisional line (flow only)
  // sits beside the stack within the clock anchor (see the flow markup
  // below): the header stays one row and nothing below it ever moves. The
  // id attributes ride in only on the flow side, where the tick patcher
  // addresses the nodes directly.
  const clockButton = (title: string, clockAttrs = "", captionAttrs = ""): string => `
      <button class="console-clock clock-opens-time" id="clock-plan" title="${title}">
        <span class="clock-stack">
          <span class="clock-row">
            <span class="session-clock mono"${clockAttrs}></span>
            ${discloseSvg}
          </span>
          <span class="clock-caption"${captionAttrs}></span>
        </span>
      </button>`;

  // The Time popover anchors beneath the clock's own disclosure (issue #148):
  // Time wears no tile, so the popover lives in the session cluster, under
  // the affordance that opened it. Its signature rides the rebuild key; the
  // body is only string-built when that key changes (every flow tick takes
  // the patch path below).
  const popoverKey = ui.app === "time" ? `time|${appPanelKey(app)}` : "shut";
  const bindPopover = (scrollTop: number): void => {
    if (ui.app !== "time") return;
    bindAppPanel(app, host);
    restorePopoverScroll(host, scrollTop);
  };

  if (state.mode === "upgrade") {
    // Static structure: nothing here depends on light state any more, so
    // control nodes (and in-flight clicks) survive everything in upgrade
    // mode. The clock wears the next session's target in flow's clock
    // styles; an unplanned open-ended shape wears a placeholder so the slot
    // only ever holds clock text, with "planned" (or "open-ended") naming
    // the mode in the caption slot. The plan's own values patch in place
    // below (#115) — a plan pick never rebuilds the console session. No
    // session runs, so the header's progress strip stays empty.
    const key = `upgrade|${popoverKey}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      const scrollTop = popoverScroll(host);
      host.innerHTML = `
        <div class="clock-anchor">
          ${clockButton("Plan — opens the Time app")}
          ${appPopoverHtml(app, "time")}
        </div>
        <div class="session-actions">
          <button class="main-switch idle" id="flow-switch" title="Enter flow — the board locks and runs itself">
            ${switchSvg}<span>Enter flow</span><i class="switch-state" aria-hidden="true"></i>
          </button>
        </div>`;
      wireClockPlan(app);
      byId("flow-switch")?.addEventListener("click", () => app.startFlow());
      bindPopover(scrollTop);
    }
    refreshConsoleClockPlan(app);
    renderSessionStrip(false);
    syncClockDisclosure(app);
    return;
  }

  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const reached = target !== null && elapsed >= target;

  const key = `flow:${state.mode}:${target === null ? "open" : reached ? "reached" : "timed"}|${popoverKey}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    const scrollTop = popoverScroll(host);
    host.innerHTML = `
      <div class="clock-anchor">
        ${clockButton("Session time — opens the Time app", ' id="session-clock"', ' id="session-caption"')}
        <span class="clock-provisional" id="session-provisional" role="status"></span>
        ${appPopoverHtml(app, "time")}
      </div>
      <div class="session-actions">
        <button id="pause-flow" aria-label="${paused ? "Resume" : "Pause"}" title="${paused ? "Resume the session" : "Pause the session"}">${paused ? resumeSvg : pauseSvg}<span aria-hidden="true">${paused ? "Resume" : "Pause"}</span></button>
        <button class="main-switch ${paused ? "held" : "live"}" id="flow-switch" title="Exit flow — end the session and bank its production">
          ${switchSvg}<span>Exit flow</span><i class="switch-state" aria-hidden="true"></i>
        </button>
      </div>`;
    wireClockPlan(app);
    byId("pause-flow")?.addEventListener("click", () => (state.mode === "paused" ? app.resume() : app.pause()));
    byId("flow-switch")?.addEventListener("click", () => app.endFlow());
    bindPopover(scrollTop);
  }

  // Live values update in place; the controls above are never replaced by ticks.
  // Planned sessions count down what remains — past the target the clock
  // counts the overrun up instead of freezing at 0:00 (#193) — and
  // open-ended ones count up, with the header's progress strip pulsing
  // calmly instead of filling.
  const set = (id: string, text: string) => {
    const node = byId(id);
    if (node && node.textContent !== text) node.textContent = text;
  };
  set("session-clock", formatClock(sessionClockSeconds(elapsed, target)));
  set("session-caption", sessionCaption(elapsed, target, paused));
  // The provisional bucket is visibly flagged while it holds (§2): the pool
  // minutes and the nous waiting on the honesty report, in the switch's
  // vermillion so it reads from across the room. It rides beside the clock
  // stack — the header keeps its one row and the clock keeps its alignment.
  const accounting = session?.accounting;
  set(
    "session-provisional",
    accounting && poolOutstanding(state)
      ? `${formatDuration(accounting.poolSeconds)} provisional · ${formatNumber(accounting.bucketNous)} ν`
      : "",
  );
  renderSessionStrip(true, elapsed, target, paused);
  syncClockDisclosure(app);
}

// The clock's disclosure state: expanded while its Time popover is open.
// Patched in place on the tick path, where the key is unchanged; opening
// and closing the popover rebuilds the cluster with the popover itself.
function syncClockDisclosure(app: App): void {
  byId("clock-plan")?.setAttribute("aria-expanded", String(app.ui.app === "time"));
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
// open-ended, the overrun it counts, or what remains of the plan.
function sessionCaption(elapsed: number, target: number | null, paused: boolean): string {
  const reached = target !== null && elapsed >= target;
  return paused
    ? "paused"
    : target === null
      ? OPEN_ENDED_WORD
      : reached
        ? "overrun"
        : `of ${formatClock(target)}`;
}

// The clock's figure (§2.2, #193): remaining on a planned session, the
// elapsed overrun once the target is behind it — never a frozen 0:00 — and
// plain elapsed on open-ended.
function sessionClockSeconds(elapsed: number, target: number | null): number {
  if (target === null) return elapsed;
  return elapsed >= target ? elapsed - target : Math.max(0, target - elapsed);
}

// Share of a planned session already practiced, as a fill percentage.
function plannedFill(elapsed: number, target: number): string {
  return `${Math.min(100, (elapsed / target) * 100)}%`;
}

// Focus-app access (ADR-0012): one icon-only tile per tile app — Habit,
// Notes, Goals, consistently sized (issue #148) — with its panel opening as
// a popover anchored directly beneath the tile. Time wears no tile: the
// console clock's disclosure opens its popover instead. The locked-tile
// plumbing stays for a future ladder tenant; locked tiles would open
// nothing, and the board never moves, reflows, or dims while the console
// is used. (Display names live in meta.ts's APP_LABELS.)

// A popover's scroll rides its host's rebuild (#115): captured before the
// innerHTML swap, restored once the fresh panel binds. Shared by the clock's
// Time popover, the tiles' popovers, and the launcher's (issue #148, #149) —
// one shape, one spelling. One popover stands per host at a time, but which
// anchor hosts it depends on the width (the tiles above the 600px line, the
// launcher below), so the query reads the shared class, not either id.
function popoverScroll(host: HTMLElement): number {
  return host.querySelector<HTMLElement>(".app-popover")?.scrollTop ?? 0;
}

function restorePopoverScroll(host: HTMLElement, scrollTop: number): void {
  const popover = host.querySelector<HTMLElement>(".app-popover");
  if (popover && scrollTop > 0) popover.scrollTo(0, scrollTop);
}

// The popover a tile or the clock anchors: present only while its app is
// open, its body built fresh with the host.
function appPopoverHtml(app: App, panel: FocusApp): string {
  return app.ui.app === panel ? `<div class="app-popover" id="app-popover">${appPanelBody(app, panel)}</div>` : "";
}

// The app-panel popover's rebuild signature: everything an app body shows,
// hashed. The chosen plan is deliberately absent (issue #115): a plan pick
// patches state in place instead of rebuilding — the open popover, its
// focus, and its scroll all survive. Shared by the tiles' popovers and the
// clock's Time popover (issue #148), so both react to the same state.
function appPanelKey(app: App): string {
  const { state, ui } = app;
  return JSON.stringify([
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
    // The history surfaces (§9): the list view, its page, the drilled
    // record, and the expanded habit summary each rebuild the popover.
    ui.historyOpen,
    ui.drillSession,
    ui.historyLimit,
    ui.summaryHabitId,
    state.sessionRecords.length,
  ]);
}

// The one focus-app glyph every access point shares — tiles, launcher
// entries — so the spelling can never drift between them.
function appGlyphSvg(appKey: FocusApp): string {
  return `<svg viewBox="-12 -12 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${appIcon(appKey)}</svg>`;
}

// The facts every access point reads for a tile app: its display label,
// whether it's active, its lock note, and the launcher entry's inline
// state (issue #149) — Goals' tracker state, Habit's selected practice,
// else a lock note. Tiles and launcher entries compose their names from
// this one shape, so the two spellings can never drift.
interface AppEntryFacts {
  label: string;
  active: boolean;
  note: string | null;
  // The pip class for the Goals readout; null on the other entries.
  tracker: GoalTrackerState | null;
  stateText: string;
}

function appEntryFacts(state: GameState, appKey: FocusApp): AppEntryFacts {
  const label = APP_LABELS[appKey];
  const note = appLockNote(state, appKey);
  const tracker = appKey === "goals" ? goalTrackerState(state) : null;
  const stateText =
    tracker !== null
      ? GOAL_TRACKER_WORDS[tracker]
      : appKey === "habit"
        ? activeHabit(state)?.name ?? "none selected"
        : note
          ? `locked: ${note}`
          : "";
  return { label, active: appActive(state, appKey), note, tracker, stateText };
}

// The qualified name the launcher entry reads: the label with its state
// word, or the bare label when it has none.
function appEntryName({ label, stateText }: AppEntryFacts): string {
  return stateText ? `${label} — ${stateText}` : label;
}

function renderConsoleApps(app: App, projected: RateSnapshot): void {
  const host = byId("console-apps");
  if (!host) return;
  const { state, ui } = app;
  const phone = isPhoneWidth();
  const key = `${phone ? "phone" : "wide"}|${ui.launcherOpen ? "launcher" : "docked"}|${appPanelKey(app)}`;
  if (host.dataset.renderKey === key) {
    updateAppPanelLive(app, host, projected);
    return;
  }
  host.dataset.renderKey = key;
  // A newly captured note keeps the popover scrolled where the player is.
  const scrollTop = popoverScroll(host);
  // One panel body, one anchor: below the 600px line the tiles are docked
  // out, so their popovers would land where no one can see them — the
  // launcher hosts the panel there (issue #149), the tiles everywhere else.
  // The gate reads the same container width the stylesheet's phone rules
  // respond to; the bloom's sheet shape already rides it.
  const tiles = TILE_APPS.map((appKey) => {
    const facts = appEntryFacts(state, appKey);
    const open = ui.app === appKey;
    const title = facts.note ? `${facts.label} — locked: ${facts.note}` : `${facts.label} app`;
    return `<div class="app-slot">
      <button class="app-tile${facts.active ? "" : " locked"}${open ? " open" : ""}" id="app-tile-${appKey}" aria-pressed="${open}" aria-label="${facts.label}"${facts.active ? "" : ' aria-disabled="true"'} title="${title}">
        <span class="app-tile-glyph">
          ${appGlyphSvg(appKey)}
        </span>
      </button>
      ${phone ? "" : appPopoverHtml(app, appKey)}
    </div>`;
  }).join("");
  host.innerHTML = `<div class="app-tiles">${tiles}</div>${appLauncherHtml(app, phone)}`;
  restorePopoverScroll(host, scrollTop);
  for (const appKey of TILE_APPS) {
    byId(`app-tile-${appKey}`)?.addEventListener("click", () => app.openApp(appKey));
    byId(`app-launcher-${appKey}`)?.addEventListener("click", () => app.openApp(appKey));
  }
  byId("app-launcher")?.addEventListener("click", () => app.launcherActivate());
  bindAppPanel(app, host);
  updateAppPanelLive(app, host, projected);
}

// The phone launcher (issue #149): one compact control that keeps Habit,
// Notes, and Goals reachable below the 600px line — the tiles stay docked
// out there, the clock keeps the Time entry, and the header holds its one
// row. Closed, a single icon button; open, a compact menu whose Goals entry
// wears the tracker's rolled-up state (none tracked / in progress / all
// complete — a state, never an aggregate percentage; the header stays pure
// control). Picking an entry swaps the menu for that app's panel popover,
// anchored beneath the launcher itself at the row's far end — the same
// .app-popover body the tiles open, carrying the launcher's own id so the
// desktop tile copies never collide. Desktop never sees any of it: CSS
// docks the slot out above the phone line, where the tiles stand.
const LAUNCHER_GLYPH = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="4" width="6.4" height="6.4" rx="1.6"/><rect x="13.6" y="4" width="6.4" height="6.4" rx="1.6"/><rect x="4" y="13.6" width="6.4" height="6.4" rx="1.6"/><rect x="13.6" y="13.6" width="6.4" height="6.4" rx="1.6"/></svg>`;

const GOAL_TRACKER_WORDS: Record<GoalTrackerState, string> = {
  none: "none tracked",
  open: "in progress",
  complete: "all complete",
};

function appLauncherHtml(app: App, phone: boolean): string {
  const { state, ui } = app;
  // The panel anchors here only on phone (issue #149): above the line the
  // tiles host their own popovers, so the launcher carries just the button.
  const panelApp = phone && ui.app !== null && TILE_APPS.includes(ui.app) ? ui.app : null;
  const expanded = ui.launcherOpen || panelApp !== null;
  const entries = TILE_APPS.map((appKey) => {
    const facts = appEntryFacts(state, appKey);
    const { label, active, tracker, stateText } = facts;
    // Each entry's inline readout rides the launcher's one word style:
    // Goals wears the tracker's rolled-up state (issue #149), Habit names
    // the practice a session would start. The accessible name carries the
    // same words, so the two can never drift.
    const ariaLabel = appEntryName(facts);
    let readout = "";
    if (tracker !== null) {
      readout = `<span class="launcher-goal-state ${tracker}" aria-hidden="true"><i class="launcher-pip"></i><span class="launcher-state-word">${stateText}</span></span>`;
    } else if (appKey === "habit") {
      readout = `<span class="launcher-habit-state" aria-hidden="true"><span class="launcher-state-word">${stateText}</span></span>`;
    }
    return `<button class="app-launcher-item"${active ? "" : " disabled"} id="app-launcher-${appKey}" aria-label="${ariaLabel} app">
      ${appGlyphSvg(appKey)}
      <span class="app-launcher-word">${label}</span>
      ${readout}
    </button>`;
  }).join("");
  const body = panelApp !== null
    ? `<div class="app-popover" id="app-launcher-popover">${appPanelBody(app, panelApp)}</div>`
    : ui.launcherOpen
      ? `<div class="app-launcher-menu" id="app-launcher-menu" aria-label="Focus apps">${entries}</div>`
      : "";
  return `<div class="app-launcher-slot" id="app-launcher-slot">
    <button class="app-launcher" id="app-launcher" aria-haspopup="true" aria-expanded="${expanded}" aria-label="Focus apps" title="Habit, Notes, and Goals">${LAUNCHER_GLYPH}</button>
    ${body}
  </div>`;
}

// The plan mode's caption word, shared by the planner markup and its
// in-place patcher so the two can never drift.
function planCaptionWord(open: boolean): string {
  return open ? "Open-ended" : "Planned practice";
}

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

function achievementContextOf(app: App, projected: RateSnapshot): AchievementContext {
  return { chargeDelivered: app.state.mode === "flow" && chargeDelivered(projected) };
}

// The open page's refresh signature: each feat's progress quantized to a
// percent, so a rebuild only happens when a bar visibly moves.
function achProgressKey(app: App, projected: RateSnapshot): string {
  const ctx = achievementContextOf(app, projected);
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

function renderAchievementsModal(app: App, content: HTMLElement, projected: RateSnapshot): void {
  const ctx = achievementContextOf(app, projected);
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
    <p class="lead">Every feat speeds the rate a little — they accelerate, never gate. Each one adds into the Achievements leg of every synthesizer row in the rate details.</p>
    ${sections}`;
  wireClose(app);
}

// ── The action row (§7): a left-edge icon dock ──────

const CELL_TOOL_SVG = `<svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0-6v12M-6 0h12"/></svg>`;

const INVENTORY_TOOL_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>`;

// The action definitions the dock and the thumb bar are both built from:
// Catalog / Forge (count badge + charge pip) / New cell / Inventory
// everywhere, with Feats folded into the phone's thumb bar (§7). Arrange
// has no job anywhere — dragging is already live (§5) — and the canvas
// legend is gone: its encodings belong to the surfaces that use them.
// Inventory presents twice: on phone the thumb bar taps open the sheet;
// at every other width the dock icon toggles the tray column beside it.
interface ToolAction {
  op: string;
  svg: string;
  label: string;
  run: (app: App) => void;
  title: (app: App) => string;
  // The count badge over the icon (forge's banked rolls, feats, tray).
  badge?: (app: App) => string;
  // A static node riding the icon (forge's charge pip).
  media?: string;
  // The thumb bar's word, when it carries a count the bare label doesn't.
  word?: (app: App) => string;
  disabled?: (app: App) => boolean;
  active?: (app: App) => boolean;
}

function toolActions(): ToolAction[] {
  return [
    {
      op: "catalog",
      svg: TOOL_CATALOG_SVG,
      label: "Catalog",
      run: (app) => app.openModal("catalog"),
      title: (app) => (app.state.mode === "upgrade" ? "Catalog — starter-shelf offers and board cells" : "Catalog — purchases happen between sessions"),
      disabled: (app) => app.state.mode !== "upgrade",
    },
    {
      op: "forge",
      svg: TOOL_FORGE_SVG,
      label: "Forge",
      run: (app) => app.openModal("forge"),
      badge: (app) =>
        app.state.bankedRolls.length > 0 ? `<b class="tool-badge mono">${app.state.bankedRolls.length}</b>` : "",
      media: `<i class="forge-pip" aria-hidden="true"><i data-live="forge-pip"></i></i>`,
      title: (app) =>
        app.state.bankedRolls.length > 0
          ? `Forge progress ${formatNumber(Math.max(0, app.state.forge.progress))} / ${formatNumber(forgeThreshold(app.state.forge.earned))} · ${app.state.bankedRolls.length} banked choice${app.state.bankedRolls.length === 1 ? "" : "s"}`
          : `Forge progress ${formatNumber(Math.max(0, app.state.forge.progress))} / ${formatNumber(forgeThreshold(app.state.forge.earned))} — practice and charge feed it`,
      disabled: (app) => app.state.mode !== "upgrade" || app.state.bankedRolls.length === 0,
    },
    {
      op: "cell",
      svg: CELL_TOOL_SVG,
      label: "New cell",
      run: (app) => {
        if (app.ui.buyingCell) app.cancelCellPurchase();
        else app.armCellPurchase();
      },
      title: (app) => (app.state.mode !== "upgrade" ? "New cell — purchases happen between sessions" : app.ui.buyingCell ? "Pick a frontier hex · Esc cancels" : "New cell"),
      disabled: (app) => app.state.mode !== "upgrade",
      active: (app) => app.ui.buyingCell,
    },
    {
      op: "inventory",
      svg: INVENTORY_TOOL_SVG,
      label: "Inventory",
      run: (app) => {
        // Phone folds the tray into a sheet; every other width toggles the
        // tray column beside the dock.
        if (isPhoneWidth()) app.openModal("inventory");
        else {
          app.ui.trayOpen = !app.ui.trayOpen;
          app.render();
        }
      },
      badge: (app) => {
        const trayCount = app.state.modules.filter((m) => m.pos === null).length;
        return trayCount > 0 ? `<b class="tool-badge mono">${trayCount}</b>` : "";
      },
      word: (app) => `Inventory · ${app.state.modules.filter((m) => m.pos === null).length}`,
      title: (app) =>
        app.state.mode !== "upgrade"
          ? "Inventory — the board is locked during flow"
          : isPhoneWidth()
            ? "Inventory — the board-surface tray, tapped open"
            : app.ui.trayOpen
              ? "Inventory — close the tray"
              : "Inventory — open the tray",
      // Gated in flow like Catalog/Forge/New cell (#193): the tray hides
      // with the board locked, so the button arms nothing a placement
      // could never land.
      disabled: (app) => app.state.mode !== "upgrade",
      active: (app) => !isPhoneWidth() && app.ui.trayOpen,
    },
    {
      op: "feats",
      svg: FEATS_SVG,
      label: "Feats",
      run: (app) => app.openModal("achievements"),
      badge: (app) => {
        const feats = unlockedCount(app.state);
        return feats > 0 ? `<b class="tool-badge mono">${feats}</b>` : "";
      },
      word: (app) => `Feats · ${unlockedCount(app.state)}/${ACHIEVEMENTS.length}`,
      title: () => "Achievements — every feat, and how close the next one is",
    },
  ];
}

const TOOL_CATALOG_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/></svg>`;
const TOOL_FORGE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.8 3.2-3.2 4.6-3.2 8.4a3.2 3.2 0 0 0 6.4 0c0-1.4-.6-2.3-1.1-2.9 1.9.5 3.4 2 3.4 4.3a5.5 5.5 0 0 1-11 0C6.5 7.6 10.8 6.4 12 3Z"/></svg>`;

// The left-edge icon dock (§7): Catalog / Forge (count badge + charge pip)
// / New cell, floating over the board's left edge. Hidden on portrait
// phone, where the same actions ride the bottom thumb bar.
function renderTools(app: App, projected: RateSnapshot): void {
  const { state, ui } = app;
  const host = byId("board-tools");
  const thumb = byId("thumb-bar");
  const actions = toolActions();
  const dockActions = actions.filter((action) => action.op !== "feats");
  const feats = unlockedCount(state);
  const forgeCount = state.bankedRolls.length;
  const trayCount = state.modules.filter((m) => m.pos === null).length;
  const key = JSON.stringify(["dock", state.mode, forgeCount, ui.buyingCell, feats, trayCount]);

  for (const [target, list] of [
    [host, dockActions],
    [thumb, actions],
  ] as const) {
    if (!target) continue;
    if (target.dataset.renderKey !== key) {
      target.dataset.renderKey = key;
      target.innerHTML = list
        .map((action) => {
          const extra = (action.badge?.(app) ?? "") + (action.media ?? "");
          const label = action.word?.(app) ?? action.label;
          return `<button class="tool-icon${action.active?.(app) ? " active" : ""}" data-op="${action.op}" aria-label="${action.label}" title="${action.title(app)}"${action.disabled?.(app) ? " disabled" : ""} aria-pressed="${action.active?.(app) ?? false}">${action.svg}${extra}<small class="tool-word">${label}</small></button>`;
        })
        .join("");
      target.querySelectorAll<HTMLButtonElement>("[data-op]").forEach((button) => {
        button.addEventListener("click", () => {
          actions.find((action) => action.op === button.getAttribute("data-op"))!.run(app);
        });
      });
    }
  }

  // Live under the structural rebuild: the Forge pip tracks the shared
  // meter, and the cell icon wears the current price and affordability.
  const cap = forgeThreshold(state.forge.earned);
  for (const target of [host, thumb]) {
    if (!target) continue;
    const pip = target.querySelector<HTMLElement>('[data-live="forge-pip"]');
    const pipWidth = `${(Math.min(1, Math.max(0, state.forge.progress / cap)) * 100).toFixed(1)}%`;
    if (pip && pip.style.width !== pipWidth) pip.style.width = pipWidth;
    const forgeButton = target.querySelector<HTMLButtonElement>('[data-op="forge"]');
    if (forgeButton) {
      const action = actions.find((a) => a.op === "forge")!;
      forgeButton.title = action.title(app);
      forgeButton.disabled = action.disabled?.(app) ?? false;
    }
    const cellButton = target.querySelector<HTMLButtonElement>('[data-op="cell"]');
    if (cellButton && state.mode === "upgrade") {
      const action = actions.find((a) => a.op === "cell")!;
      cellButton.title = action.title(app);
      cellButton.classList.toggle("active", ui.buyingCell);
      cellButton.setAttribute("aria-pressed", String(ui.buyingCell));
      if (ui.buyingCell) {
        cellButton.disabled = false;
      } else {
        const price = cellCost(state.cellsBought);
        const countdown = practiceCountdown(price, wholeNous(state), projected.rate);
        cellButton.title = `New cell — ${formatInt(price)} ν${countdown ? ` · ${countdown}` : ""}`;
        cellButton.disabled = wholeNous(state) < price;
      }
    }
  }
}

/* ── Hex grid ──────────────────────────────────────── */

function renderGrid(app: App, live: RateSnapshot, projected: RateSnapshot): void {
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
  // The lens's base (§7): the board's own bounds with breathing room —
  // the top pad carries the chord chips, which float ~1.2 hex radii above
  // the top row's faces (§6). Zoom and pan play across it; the world
  // itself never moves.
  const bounds = boardBounds(coords, 78, 100, 82);
  app.boardBounds = bounds;
  const lens = lensFrame(ui.zoom, ui.pan, bounds);
  svg.setAttribute("viewBox", lens.viewBox);
  bindBoardNavigation(app, svg);

  const flow = state.mode === "flow";
  const snapshot = live;
  const selectedModule = state.modules.find((m) => m.id === ui.selected) ?? null;
  // One frame for every bloom placement question: the lens's world view
  // plus the wrap's css-pixel size, read together (§5).
  const frame: ViewFrame = {
    view: lens.view,
    box: { width: svg.clientWidth, height: svg.clientHeight },
  };
  // The lift-off (§5): when the expanded face pops, it IS the module's hex
  // lifted toward the camera — the origin cell renders vacated while the
  // bloom stands, since the bloom repeats every line the face carries.
  const bloomLifts = selectedModule !== null && bloomPops(viewMeet(frame), HEX_RADIUS);

  // The chord annotation is always on (§6, #137): every formed chord wears
  // its colored seams — no chord view, no toggle. The name chips live in
  // the reserved readout beside the board (the selected module's chord, or
  // the hovered seam/voice's), carrying names and multipliers only — never
  // a board-wide +ν/s claim (ADR-0036). The selected module's final ν/s
  // rides the same spot, live during flow and present with no chord at all.
  // Selection (§6) is the one emphasis: the selected module's chords stay
  // focused and the rest fade.
  const deployedById = new Map(state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m]));
  const focusIds = selectedModule?.pos ? [selectedModule.id] : [];
  const overlay = chordOverlay({
    namedChords: snapshot.namedChords,
    posOf: (id) => deployedById.get(id)?.pos ?? null,
    point,
    radius: HEX_RADIUS,
    step: LATTICE_STEP,
    labelFor: chordTermLabel,
    focusIds,
  });
  chordReadoutCache.set(app, { marks: overlay.marks, snapshot });

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

  // Named-chord marks (§6): the outline polygons and seams draw UNDER the
  // modules — the prototype's triangle behind the faces, visible only in
  // the gaps between them and at the poking corners. With a selection
  // standing, the selected module's chords stay focused and the rest fade
  // (§6); in live sessions the stylesheet pulses the focused marks while
  // the board stays locked. The readout refreshes with the same marks: a
  // selection pins its chord's chips.
  html += `<g data-key="chord-marks">${overlay.marks
    .map((mark) => chordMarkHtml(mark, "formed"))
    .join("")}</g>`;

  for (const pos of state.cells) {
    const [x, y] = point(pos);
    const module = deployedAt(state, pos);
    // The lift-off (§5): with a popped bloom standing for the selected
    // module, its own cell renders vacated — the bloom repeats every line
    // the face carries, so the doubled face beneath adds nothing.
    const lifted = bloomLifts && module !== undefined && module.id === ui.selected;
    const drop = dropRegister(app, pos);
    const label = module ? `${META[module.type].name} at ${cellNoteOf(pos)}` : `Empty cell · ${cellNoteOf(pos)}`;
    if (module && !lifted) {
      html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${label}">`;
      html += moduleNode(app, module, pos, { snapshot, selectedModule, drop });
      html += `</g>`;
      continue;
    }
    // Vacated by the lift, or genuinely empty: an owned cell reads as owned
    // space — the dashed outline and its note, no add-button plus or EMPTY
    // CELL prompt. Only armed-mode hints remain (board-redesign spec §7,
    // #151); New cells stay the purchase entry point.
    let classes = "hex empty";
    if (lifted) classes += " lifted";
    if (drop) classes += ` ${dropClass(drop)}`;
    if (!module && !lifted && isTargetCell(app)) classes += " target";
    html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${label}">
      <polygon class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>
      <text y="3" text-anchor="middle" class="hex-note">${cellNoteOf(pos)}</text></g>`;
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
        html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Buy cell here for ${formatInt(total)} nous">
          <polygon class="hex ${affordable ? "buy-here" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
          <text y="-24" text-anchor="middle" class="hex-sub">NEW CELL</text>
          ${affordable ? `<text y="8" text-anchor="middle" fill="var(--accent)" font-size="22">+</text>` : ""}
          <text y="${affordable ? 34 : 8}" text-anchor="middle" class="hex-sub">${formatInt(total)} ν${total > basePrice ? " · gated" : ""}</text>
        </g>`;
      } else {
        html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Expand here">
          <polygon class="hex future" points="${hexPoints(HEX_RADIUS)}"/>
        </g>`;
      }
    }
  }

  // The would-form ghosts (§5–§6): dashed seams and outlines over the
  // chords the hovered drop or placement would form, one per forming
  // chord — these stay OVER the modules (the promise reads on top).
  // Rebuilt from the live preview state so a re-render never strands a
  // ghost.
  html += `<g data-key="ghost-chords">${ghostMarksHtml(app, projected)}</g>`;

  updateSvg(svg, html);
  bindGridEvents(app, svg);
  updateChordReadout(app);
}

// One chord mark's markup (§6, prototype language #120): a two-voice chord
// draws colored seams between its voices; a chord the seams can't carry
// draws the offset outline polygon — the prototype's triangle, rendered
// behind the modules so only the gaps and the poking corners show. The
// mark's hue rides `--cc` and its pulse period `--seam-dur`. Ghost marks
// preview would-form chords and wear their chip at the anchor, since the
// promise belongs where the chord would land. `keyPrefix` keeps the two
// layers' DOM keys apart.
function chordMarkHtml(mark: ChordMark, keyPrefix: "formed" | "ghost"): string {
  const ghost = keyPrefix === "ghost";
  const emphasis = ghost ? " ghost-mark" : mark.focused ? " chord-focus" : " chord-fade";
  const style = `--cc:var(--${mark.colorVar});--seam-dur:${mark.duration}s`;
  const lines = mark.outline
    ? `<polygon class="chord-seam chord-loop" points="${mark.outline}"/>`
    : mark.seams
        .map(
          (s) =>
            `<line class="chord-seam${ghost ? " ghost-seam" : ""}" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`,
        )
        .join("");
  const chip = ghost
    ? `<rect class="chord-chip" x="${(mark.chipX - chipWidth(mark.label) / 2).toFixed(2)}" y="${(mark.chipY - 11.5).toFixed(2)}" width="${chipWidth(mark.label).toFixed(2)}" height="15" rx="4"/><text class="chord-label mono" x="${mark.chipX}" y="${mark.chipY}">${escapeHtml(mark.label)}</text>`
    : "";
  return `<g data-key="${keyPrefix}-${escapeHtml(mark.key)}" class="chord-mark${emphasis}"${ghost ? "" : ` data-chord="${escapeHtml(mark.key)}" data-voices="${escapeHtml(mark.voices.join(" "))}"`} style="${style}">${lines}${chip}</g>`;
}

// The mark index the hover questions read: the render's chord marks keyed
// by mark key, plus the render-time snapshot the module's final-ν/s chip
// reads — the tick refreshes both, so a hover between renders is never
// stale by more than one frame of the board.
interface ChordReadoutCache {
  marks: ChordMark[];
  snapshot: RateSnapshot;
}
const chordReadoutCache = new WeakMap<App, ChordReadoutCache>();

// The reserved readout (§6): the chips, in one place — the selected
// module's chip row wins, else what the pointer rests on (a seam names its
// chord; a module names every chord it sings in). A selected or hovered
// synthesizer's final ν/s leads the row — live during flow, present with no
// chord at all (ADR-0036). Only synthesizers carry the figure: nothing else
// produces nous, and the Forge's progress-per-second is not ν/s. Hidden when
// nothing asks. HTML beside the board, so the expanded face can never cover
// it and it never moves.
function updateChordReadout(app: App): void {
  const host = byId("chord-readout");
  if (!host) return;
  const cache = chordReadoutCache.get(app);
  const marks = cache?.marks ?? [];
  const snapshot = cache?.snapshot;
  const selected = app.state.modules.find((m) => m.id === app.ui.selected && m.pos !== null) ?? null;
  const hover = app.ui.chordHover;
  const hovered =
    hover?.kind === "module" ? (app.state.modules.find((m) => m.id === hover.moduleId) ?? null) : null;
  // Every chord the module earns its bonus from — not just the first.
  const chosen = selected
    ? marks.filter((m) => m.voices.includes(selected.id))
    : chordChipsForHover(app);
  const focus = selected ?? hovered;
  const contribution = focus && snapshot ? snapshot.contributions.get(focus.id) : undefined;
  const valueChip =
    focus && contribution && isSynthesizerType(focus.type)
      ? `<span class="chord-readout-chip chord-readout-value mono">+${formatNumber(contribution.value)} ν/s</span>`
      : "";
  if (!valueChip && chosen.length === 0) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  host.hidden = false;
  host.innerHTML =
    valueChip +
    chosen
      .map(
        (mark) =>
          `<span class="chord-readout-chip mono" style="--cc:var(--${mark.colorVar})">${escapeHtml(mark.label)}</span>`,
      )
      .join("");
}

// The chips a hover asks for: a seam names its one chord, a module names
// every chord it sings in.
function chordChipsForHover(app: App): ChordMark[] {
  const hover = app.ui.chordHover;
  if (!hover) return [];
  const marks = chordReadoutCache.get(app)?.marks ?? [];
  return hover.kind === "chord"
    ? marks.filter((m) => m.key === hover.key)
    : marks.filter((m) => m.voices.includes(hover.moduleId));
}

// The hover question (§6): what the pointer rests on. Null clears. Never a
// re-render — the readout updates in place.
function setChordHover(app: App, hover: ChordHover | null): void {
  const next = hover ?? null;
  if (sameChordHover(app.ui.chordHover, next)) return;
  app.ui.chordHover = next;
  updateChordReadout(app);
}

function sameChordHover(a: ChordHover | null, b: ChordHover | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "chord" && b.kind === "chord") return a.key === b.key;
  if (a.kind === "module" && b.kind === "module") return a.moduleId === b.moduleId;
  return false;
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

// The engraved level every upgrading module's face carries (#193): the
// spacer's level buys nothing — it is silent wire, forever unupgraded — so
// its face never wears the engraving, and "LV 0" is never seen on it.
function faceLevel(module: ModuleInstance): number | undefined {
  return module.type === "spacer" ? undefined : module.level;
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
      level: faceLevel(module),
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

type DropRegister = "open" | "occupied" | "combine";

// Whether a drop of `id` onto `twinId` offers the combine instead of the
// gesture's usual landing (issue #152): a real other module, matching type
// and rarity, short of the highest tier. The one predicate both the hover
// register and the release read — they can never disagree.
function combinesWith(app: App, id: string, twinId: string | null | undefined): twinId is string {
  return twinId != null && twinId !== id && combinePreview(app.state, id, twinId) !== null;
}

// The release-side half of the combine offer (issue #152): a matching twin
// under the release point opens the review instead of the gesture's usual
// landing — board-to-board, tray-to-board, board-to-tray, tray-to-tray.
// True when the offer opened and the gesture is done.
function offerCombineDrop(app: App, id: string, twinId: string | null | undefined): boolean {
  if (!combinesWith(app, id, twinId)) return false;
  app.offerCombine(id, twinId);
  return true;
}

// The register's class: green for open, amber for occupied — every cell
// that shows the register wears one of exactly these three.
function dropClass(register: DropRegister): string {
  return register === "open" ? "drop-open" : register === "combine" ? "drop-combine" : "drop-occupied";
}

// The register a drop onto `pos` would take: occupied (amber) whenever a
// module sits there — a swap is coming, never a confirmation — green when
// open, and the combine register when the occupant is the dragged module's
// matching twin under a live drag (issue #152): its own tint, its own
// confirmation. Null away from the hover, in flow, or onto the carried
// module's own cell.
function dropRegister(app: App, pos: Hex): DropRegister | null {
  const hover = app.ui.dropHover;
  if (!hover || app.state.mode !== "upgrade") return null;
  if (!sameHex(hover.pos, pos)) return null;
  const occupant = deployedAt(app.state, pos);
  if (occupant && occupant.id !== hover.moduleId) {
    if (app.dragging !== null && combinesWith(app, hover.moduleId, occupant.id)) return "combine";
    return "occupied";
  }
  if (occupant) return null;
  return "open";
}

// Hover state changes refresh the preview in place — classes on the target
// hex plus the ghost layer — never a full render.
function setDropHover(app: App, moduleId: string | null, pos: Hex | null): void {
  app.ui.dropHover = moduleId && pos ? { moduleId, pos } : null;
  refreshDropPreview(app);
}

// A gesture that commits on pointerup kills the browser's synthetic click,
// so the release never re-fires what the drag already did (e.g. a placement
// opening the face it must leave closed, §5) — click.ts holds the one
// suppressor both drag paths share.

function refreshDropPreview(app: App): void {
  const svg = document.getElementById("grid");
  if (!svg) return;
  svg.querySelectorAll(".hex.drop-open, .hex.drop-occupied, .hex.drop-combine").forEach((node) =>
    node.classList.remove("drop-open", "drop-occupied", "drop-combine"),
  );
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
// never previewed. The render pass hands its projected snapshot over; the
// drag-hover path (no pass in flight) computes its own.
function ghostMarksHtml(app: App, projected?: RateSnapshot): string {
  const hover = app.ui.dropHover;
  if (!hover || app.state.mode !== "upgrade") return "";
  const module = app.state.modules.find((m) => m.id === hover.moduleId);
  if (!module) return "";
  const conducts = CATEGORY_OF[module.type] === "synthesizer" || module.type === "spacer";
  if (!conducts) return "";
  // A combine offer previews no swap: the drop won't rearrange voices, it
  // will consume the twin under the pointer (issue #152).
  if (dropRegister(app, hover.pos) === "combine") return "";
  const current = (projected ?? computeRates(app.state, true)).namedChords;
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
    step: LATTICE_STEP,
    labelFor: chordTermLabel,
  });
  return overlay.marks.map((mark) => chordMarkHtml(mark, "ghost")).join("");
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
    // The hover question rides the svg-level delegation (bindSeamHover):
    // resting on a module or a seam asks that chord into the readout.
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
    // Placement rides the pointer too (§5–§6): a touch press has no hover
    // phase before its tap, so pressing an open cell while a placement is
    // armed previews live as the finger slides, and the release places. A
    // quick tap still places on the click — nothing here fires before the
    // drag threshold.
    node.addEventListener("pointerdown", (baseEvent: Event) => {
      const event = baseEvent as PointerEvent;
      if (event.button !== 0 || app.state.mode !== "upgrade" || app.ui.buyingCell) return;
      if (!app.ui.placing || app.dragging) return;
      if (deployedAt(app.state, position())) return;
      const id = app.ui.placing;
      const startX = event.clientX;
      const startY = event.clientY;
      let previewing = false;
      const cellAt = (ev: PointerEvent): Hex | null => {
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-cell]") ?? null;
        const [q, r] = (hit?.getAttribute("data-cell") ?? "").split(",").map(Number);
        return Number.isFinite(q) && Number.isFinite(r) ? { q: q!, r: r! } : null;
      };
      const move = (ev: PointerEvent) => {
        if (!previewing && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD_PX) previewing = true;
        if (previewing) setDropHover(app, id, cellAt(ev));
      };
      const finish = (ev: PointerEvent, apply: boolean) => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", cancel);
        const pos = cellAt(ev);
        setDropHover(app, null, null);
        if (!apply || !previewing) return;
        suppressNextClick();
        if (pos) app.pickCellThenPlace(id, pos);
      };
      const up = (ev: PointerEvent) => finish(ev, true);
      const cancel = (ev: PointerEvent) => finish(ev, false);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
    });
    bindPointerDrag(app, node, () => deployedAt(app.state, position())?.id ?? null);
  });
  bindSeamHover(app, svg);
}

// The grid never replaces its svg across renders, so the chord-hover
// question binds once, delegating: over a chord's seam, that chord; over a
// module cell, every chord the module sings in; anywhere else, none. Ghost
// marks never answer — they promise chords that don't exist yet.
const boundGrids = new WeakSet<SVGSVGElement>();

function bindSeamHover(app: App, svg: SVGSVGElement): void {
  if (boundGrids.has(svg)) return;
  boundGrids.add(svg);
  svg.addEventListener("pointerover", (event) => {
    if (app.dragging) return;
    const target = event.target as Element;
    const mark = target.closest?.(".chord-mark:not(.ghost-mark)");
    const key = mark?.getAttribute("data-chord");
    if (mark && key) {
      setChordHover(app, { kind: "chord", key });
      return;
    }
    const cellNode = target.closest?.("[data-cell]");
    const [q, r] = (cellNode?.getAttribute("data-cell") ?? "").split(",").map(Number);
    const id = cellNode && Number.isFinite(q) ? deployedAt(app.state, { q: q!, r: r! })?.id ?? null : null;
    setChordHover(app, id ? { kind: "module", moduleId: id } : null);
  });
  svg.addEventListener("pointerleave", () => {
    if (app.dragging) return;
    setChordHover(app, null);
  });
}

// Shared pointer-drag binding for grid modules and tray items: holding the
// face starts a live drag in upgrade mode — no arrange mode exists — the
// bloom collapses into the ghost, and the drop lands as a placement (an
// occupied target swaps, except a matching twin: that drop offers the
// combine, reviewed before anything is consumed, issue #152) or a
// retrieval into the tray. Click-placement stays available without
// dragging. No module refuses the drag — nothing is pinned on the
// carrierless board (ADR-0021).
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
          ? inventoryTileSvg(module)
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
      setChordHover(app, null);
      zone?.classList.remove("drag-over");
      if (!apply || !moved) return;
      suppressNextClick();
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellNode = target?.closest("[data-cell]");
      const tileNode = target?.closest("[data-inv]");
      // A matching twin under the release point offers the combine instead
      // (issue #152); every other drop keeps its gesture — occupied cells
      // swap immediately, the tray retrieves.
      if (cellNode) {
        const cell = cellNode.getAttribute("data-cell")!.split(",").map(Number);
        const pos = { q: cell[0]!, r: cell[1]! };
        const occupant = deployedAt(app.state, pos);
        if (offerCombineDrop(app, id, occupant?.id)) return;
        app.pickCellThenPlace(id, pos);
        return;
      }
      if (tileNode && offerCombineDrop(app, id, tileNode.getAttribute("data-inv"))) return;
      if (target?.closest("#inventory-zone")) {
        app.returnToInventory(id);
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

// The expanded face's two effect lines (§5), one entry per module type —
// the single place a type's face phrasing lives. The Upgrade button's
// benefit states what one level buys at that level's gain; the production
// contribution states what the compact face doesn't say, at live values.
// The silent wire buys nothing with a level, so its benefit is null and it
// wears no button at all.
interface BloomEffectInput {
  gain: number;
  power: number;
  value: number;
  strength: number;
}

// The synth benefit is exact at every local effect: value/power is the
// module's per-power ν/s (chord factor, infusor uplift, charge, and
// achievements all in — ADR-0036), so one level's power gain scales it
// directly instead of quoting a bare-term figure chords would understate.
const synthBloomLines = ({ gain, power, value }: BloomEffectInput): { benefit: string | null; contribution: string } => ({
  benefit: `+${formatNumber((value / power) * gain)} ν/s`,
  contribution: `+${formatNumber(value)} ν/s`,
});

const BLOOM_EFFECTS: Record<ModuleInstance["type"], (input: BloomEffectInput) => { benefit: string | null; contribution: string }> = {
  additive: synthBloomLines,
  conditional: synthBloomLines,
  spacer: () => ({ benefit: null, contribution: "silent — conducts chords, produces nothing" }),
  focusKeyed: ({ gain, power }) => ({
    benefit: `+${formatNumber(gain)} strength`,
    contribution: `${formatNumber(power)} charge strength while its window lasts`,
  }),
  infusor: ({ gain, power, strength }) => ({
    benefit: `+${formatNumber(100 * BALANCE.infusorBonus * gain)}% uplift`,
    contribution: `+${formatNumber(100 * BALANCE.infusorBonus * power * chargedFactor(strength))}% to adjacent`,
  }),
  forge: ({ gain, value }) => ({
    benefit: `+${formatNumber(gain)} progress/s`,
    contribution: `${formatNumber(value)} progress/s while charged`,
  }),
};

// The expanded face: the module's own hex lifted off the grid toward the
// camera — the face itself IS the bloom, enlarged to fill it, its content
// shifted up to make room for the Upgrade button in the lower band. The
// ν/s unit rides the face's own readout, so nothing repeats. Opens only on
// click, only in upgrade mode, only for a deployed module; closes on
// outside click, Esc, or selecting elsewhere; holding the face starts the
// live drag.
//
// On portrait phone (§7) the bloom presents as a bottom sheet docked over
// the board's lower edge — same content, re-docked — and the zoom cluster
// rises above it so inspection never gets buried.
//
// The pop only happens when it would actually enlarge the module: zoomed
// far in (few cells filling the wrap), the on-screen module already
// out-sizes the fixed bloom, and the affordances ride the closed face
// instead — a floating upgrade card anchored over the module's lower band.
// The host persists (the app creates it once); only the content rebuilds.
function renderBloom(app: App, projected: RateSnapshot): void {
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
    document.body.classList.remove("bloom-sheet-open");
    return;
  }
  const phone = isPhoneWidth();
  const snapshot = projected;
  const lines = BLOOM_EFFECTS[module.type]({
    gain: modulePower(module) * (BALANCE.rarityPower[module.rarity] - 1),
    power: modulePower(module),
    value: snapshot.contributions.get(module.id)?.value ?? 0,
    strength: snapshot.chargeStrength.get(module.id) ?? 0,
  });
  const benefit = lines.benefit;
  const cost = levelCost(module.level);
  const affordable = wholeNous(state) >= cost;
  // The Forge's face readout moves per tick; its face tracks it.
  const forgeTick = module.type === "forge" ? Math.floor(state.forge.progress) : 0;
  const shape = phone ? "sheet" : "pop";
  const key = JSON.stringify([shape, module.id, module.level, module.rarity, benefit, lines.contribution, affordable, forgeTick]);
  // One frame read for both the pop question and the positioning below.
  const svg = document.getElementById("grid");
  const viewBox = (svg?.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const frame: ViewFrame = {
    view: { x: viewBox[0] ?? 0, y: viewBox[1] ?? 0, width: viewBox[2] ?? 0, height: viewBox[3] ?? 0 },
    box: { width: svg?.clientWidth ?? 0, height: svg?.clientHeight ?? 0 },
  };
  const upgradeButton = benefit
    ? `<button class="bloom-upgrade" id="bloom-upgrade" ${affordable ? "" : "disabled"} title="${affordable ? "Upgrade this module" : "Not enough whole nous"}">
        <span class="bloom-upgrade-title">Upgrade · <strong class="mono">${formatInt(cost)} ν</strong></span>
        <small class="bloom-upgrade-benefit mono">${benefit}</small>
      </button>`
    : "";
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.classList.toggle("sheet", phone);
    document.body.classList.toggle("bloom-sheet-open", phone);
    if (phone) {
      // The bottom sheet (§7): the face tile beside the readout column,
      // the upgrade action at its end — same content, re-docked.
      const face = faceReadoutFor(state, module, module.pos, snapshot, true);
      host.innerHTML = `<div class="bloom-sheet" data-type="${module.type}" data-rarity="${module.rarity}">
        <svg class="bloom-sheet-tile" viewBox="-70 -70 140 140" aria-hidden="true">${moduleFace({
          type: module.type,
          rarity: module.rarity,
          readout: face.readout,
          ...(face.readoutClass ? { readoutClass: face.readoutClass } : {}),
          ...(face.note ? { note: face.note } : {}),
          level: faceLevel(module),
        })}</svg>
        <div class="bloom-sheet-col">
          <span class="bloom-sheet-name">${faceLevel(module) !== undefined ? `${META[module.type].name} · LV ${module.level}` : META[module.type].name}</span>
          <small class="bloom-sheet-note mono">${cellNoteOf(module.pos)}</small>
          <small class="bloom-sheet-contrib mono">${lines.contribution}</small>
        </div>
        ${upgradeButton}
      </div>`;
      byId("bloom-upgrade")?.addEventListener("click", () => app.upgrade(module.id));
      host.hidden = false;
      return;
    }
    // Ride the closed face when the pop would shrink the module. (No layout
    // yet — hidden or unmeasured — degrades to unit scale by design; the
    // plate repositions on the next render once the wrap measures.)
    const inline = !bloomPops(viewMeet(frame), HEX_RADIUS);
    host.classList.toggle("inline", inline);
    const readouts = `
      <div class="bloom-readouts">
        ${inline ? `<p class="bloom-contribution mono">${lines.contribution}</p>` : ""}
        ${upgradeButton}
      </div>`;
    if (inline) {
      host.innerHTML = readouts;
    } else {
      // The face fills the bloom hexagon exactly (viewBox = the hexagon's
      // bounding box), re-proportioned for the bloom: the engraving
      // recenters over the full-width band, the cell note footnotes into
      // the taper, and the button band sits between readout and taper. The
      // enlarged readout carries the ν/s unit itself, so nothing repeats.
      const face = faceReadoutFor(state, module, module.pos, snapshot, true);
      host.innerHTML = `
        <div class="bloom-plate" data-type="${module.type}" data-rarity="${module.rarity}">
          <svg class="bloom-face" viewBox="-52.8282 -61 105.6563 122" preserveAspectRatio="none" aria-hidden="true">${moduleFace({
            type: module.type,
            rarity: module.rarity,
            readout: face.readout,
            ...(face.readoutClass ? { readoutClass: face.readoutClass } : {}),
            ...(face.note ? { note: face.note } : {}),
            level: faceLevel(module),
            variant: "bloom",
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
  if (phone) {
    host.hidden = false;
    return;
  }
  // Position over the module's cell on every render — the board may have
  // grown or reflowed since the last one.
  const [cx, cy] = viewPoint(point(module.pos), frame);
  if (host.classList.contains("inline")) {
    // The card rides the closed face's lower band: centered, its body over
    // the taper below the face's note — hanging past the tip a little at
    // threshold zooms, where the taper is too tight to hold it. The same
    // clamp as the popped plate (bloomSpan).
    const { left, width } = bloomSpan(cx, frame);
    const halfHeight = viewMeet(frame) * HEX_RADIUS;
    host.style.left = `${Math.round(left)}px`;
    host.style.top = `${Math.round(cy + halfHeight * 0.85 - 34)}px`;
    host.style.width = `${width}px`;
    host.style.height = "auto";
    host.classList.remove("below");
  } else {
    const layout = bloomLayout(point(module.pos), HEX_RADIUS, frame);
    host.hidden = false;
    host.classList.toggle("below", layout.below);
    host.style.left = `${Math.round(layout.left)}px`;
    host.style.top = `${Math.round(layout.top)}px`;
    host.style.width = `${layout.width}px`;
    host.style.height = `${layout.height}px`;
  }
  host.hidden = false;
}

// The board-surface tray (§5): the inventory as a collapsible column docked
// beside the action dock. The dock's Inventory icon toggles it; a drag or
// an armed placement opens it for the moment regardless, so the
// chord-breaking gesture always has a visible target. Retrieve by dropping
// a module onto it, place by clicking an item then a cell (occupied
// placement swaps). On portrait phone the tray hides — the thumb bar's
// Inventory segment taps the same inventory open as a sheet.
function renderInventoryTray(app: App): void {
  const tray = byId("inventory-zone");
  if (!tray) return;
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  // Explicit open wins; a carried module or an armed placement opens the
  // column for the gesture's duration whatever the toggle says.
  const open = upgrade && (ui.trayOpen || app.dragging !== null || ui.placing !== null);
  tray.classList.toggle("off", !open);
  const inventory = state.modules.filter((m) => m.pos === null);
  const key = JSON.stringify([upgrade, open, inventory.map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}`)]);
  if (tray.dataset.renderKey === key) return;
  tray.dataset.renderKey = key;
  tray.innerHTML = `<span class="tray-label">TRAY</span>
    <div class="tray-items">${
      inventory
        .map(
          (m) =>
            `<button class="inventory-tile" data-inv="${m.id}" data-rarity="${m.rarity}" data-type="${m.type}" title="${META[m.type].name} · ${RARITY_LABEL[m.rarity]} — click, then a cell">${inventoryTileSvg(m)}</button>`,
        )
        .join("") || `<span class="tray-empty">drag a module here to store it</span>`
    }</div>`;
  tray.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach((button) => {
    const id = button.getAttribute("data-inv")!;
    button.addEventListener("click", () => app.beginPlacing(id));
    bindPointerDrag(app, button, id);
  });
}

// The opening arc's one pop-up (§8, issue #138): after the second
// synthesizer is acquired, a single dismissible card — place it beside
// your first; the dashed ghost previews the chord it would form; the × is
// what the pair earns together. Upgrade-mode furniture over the board's
// top edge, clear of the dock, the horizon bar, and the zoom cluster; the ✕
// dismisses once, ever (arcCardSeen persists). No goals, no steps, no
// tutorial state — one card.
function renderArcCard(app: App): void {
  const card = byId("arc-card");
  if (!card) return;
  const due = app.state.mode === "upgrade" && arcCardDue(app.state);
  card.hidden = !due;
  if (!due) return;
  if (card.dataset.renderKey) return;
  card.dataset.renderKey = "arc";
  card.innerHTML = `<p class="arc-copy"><strong>Place it beside your first.</strong>
    The dashed preview shows the chord they'd form; the <span class="mono">×</span> in the chord readout is what the pair earns together.</p>
    <button class="arc-dismiss" id="arc-card-dismiss" aria-label="Dismiss — this card never returns">✕</button>`;
  document.getElementById("arc-card-dismiss")?.addEventListener("click", () => app.dismissArcCard());
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

// Slot order (issue #150): incomplete goals first, completed occurrences
// next; stable within each band, so creation order holds.
function openGoalsFirst(a: Goal, b: Goal): number {
  return Number(a.completed) - Number(b.completed);
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
    // Planning lives only in the Time app (§7): in upgrade mode the panel
    // owns the plan affordances the console clock points at; in flow the
    // console clock keeps the live session and this panel holds the
    // history — the popover never repeats the console's readout.
    if (upgrade) {
      return `<section class="focus-controls">
        ${planControlsHtml(app)}
        <button class="quiet small time-history" id="time-history">History</button>
      </section>`;
    }
    return `<section class="focus-controls">
      <p class="small muted">The console clock keeps session time — the Time app holds the history.</p>
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
  // The first console long goal (ADR-0012 as amended by ADR-0034, issue
  // #150): goal capacity sold as one compact row below the slots — one
  // more slot per purchase, every price far past the last. Read-only in
  // flow.
  const longGoalPrice = longGoalCost(state.goalCapacityBought);
  const longGoalAffordable = wholeNous(state) >= longGoalPrice;
  const longGoalCountdown = upgrade ? practiceCountdown(longGoalPrice, wholeNous(state), computeRates(state, true).rate) : null;
  const longGoalRow = `
    <div class="long-goal-row">
      <span class="long-goal-name">One more goal slot</span>
      ${shopBuyHtml({
        attrs: `id="long-goal-buy" title="${upgrade ? (longGoalAffordable ? "Buy one more goal slot" : "Not enough nous yet") : "Purchases happen between sessions"}"`,
        small: true,
        price: longGoalPrice,
        affordable: upgrade && longGoalAffordable,
        countdown: longGoalCountdown,
        ...(upgrade ? { live: "long-goal-countdown" } : { note: "between sessions" }),
      })}
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
  // The panel reads as a run of slots (issue #150): tracked goals first —
  // open work above finished occurrences — then the empty add-goal slot,
  // and the capacity purchase trails the slots.
  const orderedGoals = [...state.goals].sort(openGoalsFirst);
  return `<section class="focus-controls">
    <p class="goal-slots mono">${state.goals.length}/${capacity} slots${upgrade ? "" : " · locked for this session"}</p>
    <div class="goal-list">
      ${orderedGoals.map(goalRow).join("") || `<p class="empty-copy">No goals yet. Goals track practice conditions.</p>`}
    </div>
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
    ${longGoalRow}
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
    <p class="clock-caption">${planCaptionWord(open)}</p>
  </div>`;
}

// The plan surfaces a control-driven change must reach without a render
// (#115): the controls themselves and the console clock. Every patch is an
// in-place text/class/attribute swap on surviving nodes, so focus, open
// dropdowns, and scroll all ride through untouched.
function refreshPlanState(app: App): void {
  refreshPlanControls(app);
  refreshConsoleClockPlan(app);
}

// The plan controls' pressed/disabled/value state, patched in place within
// whatever scope carries them (the Time popover or the enter prompt).
function refreshPlanControls(app: App): void {
  const chosen = app.ui.chosenTarget;
  const open = chosen === null;
  const minutes = chosen === null ? null : Math.round(chosen / 60);
  for (const chip of document.querySelectorAll<HTMLButtonElement>("[data-plan]")) {
    const active = minutes !== null && minutes === Number(chip.getAttribute("data-plan"));
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", String(active));
  }
  const input = byId("plan-minutes") as HTMLInputElement | null;
  if (input) {
    const value = minutes !== null ? String(minutes) : "";
    if (input.value !== value) input.value = value;
    input.disabled = open;
  }
  const openButton = byId("plan-open");
  openButton?.classList.toggle("active", open);
  openButton?.setAttribute("aria-pressed", String(open));
  for (const caption of document.querySelectorAll(".time-plan .clock-caption")) {
    setText(caption, planCaptionWord(open));
  }
}

// The plan affordances' binding within any scope (the Time popover or the
// enter modal): chips pick a preset, the free entry takes any whole minute
// from 1 to 90 (clamped, one-minute steps), and open-ended is its own mode
// toggle. Each acceptance patches the affected surfaces in place (#115) —
// never a render, so the popover keeps its DOM identity, focus stays on the
// control, and an open native select is never disrupted mid-gesture.
function bindPlanControls(app: App, scope: HTMLElement): void {
  scope.querySelectorAll<HTMLButtonElement>("[data-plan]").forEach((chip) => {
    chip.addEventListener("click", () => {
      app.ui.chosenTarget = Number(chip.getAttribute("data-plan")) * 60;
      refreshPlanState(app);
    });
  });
  const planInput = scope.querySelector("#plan-minutes") as HTMLInputElement | null;
  planInput?.addEventListener("change", () => {
    const minutes = Math.round(Number(planInput.value));
    if (Number.isFinite(minutes) && planInput.value !== "") {
      app.ui.chosenTarget = Math.min(PLAN_MAX_MINUTES, Math.max(PLAN_MIN_MINUTES, minutes)) * 60;
      refreshPlanState(app);
    }
  });
  scope.querySelector("#plan-open")?.addEventListener("click", () => {
    app.ui.chosenTarget = null;
    refreshPlanState(app);
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

// Values that move during flow without rebuilding the popover: practice
// tallies and goal progress. (The Time panel no longer repeats the
// console's live session, so no clock lives here — §7.)
function updateAppPanelLive(app: App, scope: ParentNode, projected: RateSnapshot): void {
  const { state } = app;
  liveSet(scope, "habit-session", `${formatClock(state.session?.elapsed ?? 0)} of practice`);
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
  // The long-goal row's affordability moves with the balance between
  // rebuilds: the buy button and its practice-minute countdown keep
  // themselves current, like the module upgrade CTA (§7).
  const longGoalBuy = scope.querySelector("#long-goal-buy") as HTMLButtonElement | null;
  if (longGoalBuy) {
    const price = longGoalCost(state.goalCapacityBought);
    longGoalBuy.disabled = !(state.mode === "upgrade" && wholeNous(state) >= price);
    const countdown = practiceCountdown(price, wholeNous(state), projected.rate) ?? "";
    liveSet(scope, "long-goal-countdown", countdown);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Grid & inventory panel ────────────────────────── */

// The inventory tile's minimal mark: a hexagon outlined in the category hue
// with the module's glyph alone. The full readout face belongs to the board
// and the expanded face — at tile size the engraving is noise — and the
// tooltip carries the details the mark leaves off. Shared by the tray, the
// phone inventory sheet, and the live drag ghost, so what you carry is
// what waits in the tray.
function inventoryTileSvg(module: ModuleInstance): string {
  const hue = `var(--${HUE_TOKEN_OF[module.type]})`;
  return `<svg viewBox="-70 -70 140 140" aria-hidden="true">
    <polygon class="tile-hex" points="${hexPoints(HEX_RADIUS)}" fill="none" stroke="${hue}" stroke-width="4.5"/>
    <g class="tile-glyph" fill="none" stroke="${hue}" stroke-width="3.5" transform="scale(1.55)">${moduleIcon(module.type)}</g>
  </svg>`;
}

/* ── Modals ────────────────────────────────────────── */

// The modal content's rebuild key: what a modal shows, hashed. The
// control-driven in-place patchers (the enter prompt's, issue #115) re-stamp
// it after patching, so the patched DOM and the guard stay in agreement and
// a later render never rebuilds what a patch already brought current.
function modalKey(app: App, kind: ModalKind, extra: unknown): string {
  return JSON.stringify([kind, app.ui.importError, app.state.session?.accounting.poolSeconds ?? 0, app.state.mode, extra]);
}

// The enter prompt's light-state input to its rebuild key (#95, #115),
// shared by the render guard and the in-place patchers' re-stamp so the
// two can never drift apart.
function enterModalExtra(app: App): [number | null, EnterSelection] {
  return [app.ui.chosenTarget, app.ui.enter];
}

function renderModal(app: App, live: RateSnapshot, projected: RateSnapshot): void {
  const backdrop = byId("modal");
  const content = byId("modal-content");
  if (!backdrop || !content) return;
  // A dead combine offer — the pair dissolved under the review (mode
  // flipped, a twin gone) — drops before the dispatch, so the dialog always
  // has terms to present and no render pass ever nests a closeModal render
  // inside itself.
  if (app.ui.modal === "combine" && combineOfferTerms(app) === null) {
    app.ui.modal = null;
    app.ui.combineOffer = null;
  }
  const kind = app.ui.modal;
  if (!kind) {
    backdrop.hidden = true;
    backdrop.classList.remove("sheet");
    backdrop.classList.remove("peek");
    document.body.classList.remove("modal-sheet-open");
    delete content.dataset.renderKey;
    return;
  }
  // The rate sheet's own gate (§7): below the 760px container breakpoint
  // it presents as a sheet over the scrim. The modal layer is body-level —
  // outside the #app container — so the gate's decision arrives as a class
  // the stylesheet can act on, not a container rule. On portrait phone the
  // viewport media query sheets every modal, so the cluster's rise reads
  // the wider of the two (§7, ADR-0029: the cluster alone reacts to open
  // sheets, and inspection never buries it).
  const sheet = (kind === "rate" && containerWidth() < RATE_DETAILS_BREAKPOINT_PX) || window.innerWidth < PHONE_MAX_PX;
  backdrop.classList.toggle("sheet", kind === "rate" && containerWidth() < RATE_DETAILS_BREAKPOINT_PX);
  // The scrimless peek (#193, decided in #174): a pending module roll never
  // blocks board inspection — the backdrop drops entirely and the pointer
  // passes through it, so the board stays visible, hoverable, and
  // selectable while the roll waits. Outside clicks, Esc, and ✕ dismiss.
  backdrop.classList.toggle("peek", kind === "forge");
  backdrop.setAttribute("aria-modal", kind === "forge" ? "false" : "true");
  document.body.classList.toggle("modal-sheet-open", sheet);
  const extra =
    kind === "forge"
      ? app.state.bankedRolls.at(-1)?.id ?? null
      : kind === "honesty"
        ? [app.exitPending, app.state.session?.accounting.poolSeconds ?? 0, app.state.session?.accounting.bucketNous ?? 0]
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
              ? achProgressKey(app, projected)
              // The enter prompt's own selection state (issue #95): the plan
              // and the kind-first picks re-render the modal the moment they
              // change — chips highlight on pick, never a stale footer.
              : kind === "enter"
                ? enterModalExtra(app)
                // The rate sheet reprices only when its roster or feats
                // count changes — the figures themselves ride live slots
                // the tick fills in place, so clock ticks never rebuild
                // (and collapse) an expanded row.
                : kind === "rate"
                  ? [deployedRosterKey(app.state), unlockedCount(app.state)]
                : kind === "inventory"
                  ? app.state.modules.filter((m) => m.pos === null).map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}`)
                  // The combine review's identity: the offered pair (issue
                  // #152). The terms are read fresh on rebuild.
                  : kind === "combine"
                    ? [app.ui.combineOffer?.dragId ?? null, app.ui.combineOffer?.targetId ?? null]
                    : null;
  const renderKey = modalKey(app, kind, extra);
  // Clock ticks must not replace a save textarea or steal dialog focus.
  if (!backdrop.hidden && content.dataset.renderKey === renderKey) {
    // The rate sheet's figures ride the same live slots the popover fills:
    // the tick fills them in place on this no-rebuild path, so an expanded
    // row survives the clock (ADR-0037).
    if (kind === "rate") updateRateDetailsLive(content, app.state, live);
    return;
  }
  backdrop.hidden = false;
  content.dataset.renderKey = renderKey;
  if (kind === "settings") renderSettingsModal(app, content);
  else if (kind === "catalog") renderCatalogModal(app, content);
  else if (kind === "forge") renderForgeModal(app, content);
  else if (kind === "achievements") renderAchievementsModal(app, content, projected);
  else if (kind === "export") renderExportModal(app, content);
  else if (kind === "import") renderImportModal(app, content);
  else if (kind === "reset") renderResetModal(app, content);
  else if (kind === "honesty") renderHonestyModal(app, content);
  else if (kind === "enter") renderEnterModal(app, content);
  else if (kind === "summary") renderSummaryModal(app, content);
  else if (kind === "rate") renderRateModal(app, content, live);
  else if (kind === "inventory") renderInventorySheetModal(app, content);
  else if (kind === "combine") renderCombineModal(app, content);
  const firstButton = content.querySelector("button:not([disabled])");
  (firstButton as HTMLElement | null)?.focus();
}

// The rate sheet (§7): the module-linked rate details — the total plus one
// row per synthesizer and the other modules' effects — as a modal sheet
// over a scrim below the 760px breakpoint, opened by tapping the Rate cell
// or the strip's rate read at every width. The same roster the Rate cell's
// hover popover owns above the breakpoint, built the same way: live slots
// the tick fills, so an expanded row survives the clock. A synthesizer
// row's tap closes the sheet and selects the module, so the answer lands
// on the board it names.
function renderRateModal(app: App, content: HTMLElement, live: RateSnapshot): void {
  // The same basis every rate figure wears — live during flow, projected
  // while arranging — so the sheet can never disagree with the ledger it
  // discloses.
  const snapshot = live;
  content.innerHTML = `
    ${modalTop("RATE")}
    <h2 id="modal-title">What makes the rate.</h2>
    <div class="rate-details-sheet">${rateDetailsHtml(app.state, snapshot, true)}</div>`;
  updateRateDetailsLive(content, app.state, snapshot);
  const sheet = content.querySelector(".rate-details-sheet");
  if (sheet) wireSynthPicks(sheet, (id) => {
    app.closeModal();
    app.select(id);
  });
  wireClose(app);
}

// The inventory sheet (§7): the board-surface tray, re-docked for touch on
// portrait phone where the thumb bar's Inventory segment taps it open.
// Clicking an item arms the placement; the tray itself keeps the drag
// gestures at every width. Gated with the dock (#193): in flow the board is
// locked, so the sheet reads but never arms — a phone placement can never
// land mid-session.
function renderInventorySheetModal(app: App, content: HTMLElement): void {
  const inventory = app.state.modules.filter((m) => m.pos === null);
  const locked = app.state.mode !== "upgrade";
  content.innerHTML = `
    ${modalTop("INVENTORY")}
    <h2 id="modal-title">Waiting for a cell.</h2>
    <p class="lead">${locked ? "The board is locked during flow — placements wait for the session's end." : "Tap a module, then a cell — dropping on an occupied cell swaps."}</p>
    <div class="inventory-sheet-grid">${
      inventory
        .map(
          (m) =>
            `<button class="inventory-tile" data-inv="${m.id}" data-rarity="${m.rarity}" data-type="${m.type}"${locked ? " disabled" : ""} title="${META[m.type].name} · ${RARITY_LABEL[m.rarity]}${locked ? " — locked during flow" : " — tap, then a cell"}">${inventoryTileSvg(m)}</button>`,
        )
        .join("") || `<p class="empty-copy">Nothing in the tray. Drag a module off the board to store it here.</p>`
    }</div>`;
  content.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach((button) => {
    button.addEventListener("click", () => {
      if (app.state.mode !== "upgrade") return;
      const id = button.getAttribute("data-inv")!;
      app.closeModal();
      app.beginPlacing(id);
    });
  });
  wireClose(app);
}

function modalTop(label: string): string {
  return `<div class="modal-top"><span class="eyebrow">${label}</span><button id="close-modal" aria-label="Close dialog">✕</button></div>`;
}

// The combine review's terms (issue #152), read fresh: null whenever the
// offer is gone or its pair can no longer combine — mode flipped, a twin
// taken. The one read both the modal dispatch and the dialog use, so a
// dead offer can never reach the dialog's markup.
function combineOfferTerms(
  app: App,
): { drag: ModuleInstance; target: ModuleInstance; preview: CombinePreview } | null {
  const offer = app.ui.combineOffer;
  const drag = offer ? app.state.modules.find((m) => m.id === offer.dragId) : undefined;
  const target = offer ? app.state.modules.find((m) => m.id === offer.targetId) : undefined;
  const preview = offer && drag && target ? combinePreview(app.state, offer.dragId, offer.targetId) : null;
  return offer && drag && target && preview ? { drag, target, preview } : null;
}

// The combine review (issue #152): the drop's terms — resulting rarity,
// the retained higher level, the refund — laid out before either copy is
// consumed. Cancel (button, ✕, backdrop, Esc) lands in closeModal and
// leaves both modules exactly as they were; confirm performs the combine
// and the result lands where the drop target was.
function renderCombineModal(app: App, content: HTMLElement): void {
  // renderModal drops a dead offer before the dispatch, so the terms are
  // always readable here — the render pass stays free of a nested
  // closeModal render.
  const { drag, target, preview } = combineOfferTerms(app)!;
  const pairLine = (module: ModuleInstance) => `${META[module.type].name} · ${RARITY_LABEL[module.rarity]} · LV ${module.level}`;
  const destination = target.pos === null ? "The combined copy waits in the tray." : `The combined copy holds ${cellNoteOf(target.pos)}.`;
  content.innerHTML = `
    ${modalTop("COMBINE")}
    <h2 id="modal-title">Combine these two?</h2>
    <p class="lead">${pairLine(drag)}<br />+ ${pairLine(target)}</p>
    <div class="combine-terms">
      <div class="stat-row"><span>Resulting rarity</span><span class="mono">${RARITY_LABEL[preview.nextRarity]}</span></div>
      <div class="stat-row"><span>Retained level</span><span class="mono">LV ${preview.level}</span></div>
      <div class="stat-row"><span>Upgrade refund</span><span class="mono">${formatInt(preview.refund)} ν</span></div>
    </div>
    <p class="lead muted">${destination}</p>
    <div class="modal-actions">
      <button id="combine-cancel">Keep both</button>
      <button id="combine-confirm" class="primary">Combine</button>
    </div>`;
  byId("combine-cancel")?.addEventListener("click", () => app.closeModal());
  byId("combine-confirm")?.addEventListener("click", () => app.confirmCombine());
  wireClose(app);
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

// The upgrade-mode countdown for a price on this board: phrased against the
// board's projected next-session rate (the charged preview, whatever the
// current mode); null (hidden) when affordable or rateless.
function upgradeCountdown(app: App, cost: number): string | null {
  return practiceCountdown(cost, wholeNous(app.state), computeRates(app.state, true).rate);
}

// The one purchase affordance every buy row wears (§7, issue #150): the
// price button — disabled until affordable, its tooltip carrying the why —
// over its practice-minute countdown in the shop-buy column. `live` keeps
// an empty countdown slot standing for the control-driven patchers to fill;
// `note` swaps the countdown for static copy (the flow-side "between
// sessions").
function shopBuyHtml(options: {
  attrs?: string;
  small?: boolean;
  price: number;
  affordable: boolean;
  countdown?: string | null;
  live?: string;
  note?: string;
}): string {
  const button = `<button class="primary${options.small ? " small" : ""}" ${options.attrs ?? ""}${options.affordable ? "" : " disabled"}>${formatInt(options.price)} ν</button>`;
  const small = options.note
    ? `<small class="shop-countdown">${options.note}</small>`
    : options.live || options.countdown
      ? `<small class="shop-countdown mono"${options.live ? ` data-live="${options.live}"` : ""}>${options.countdown ?? ""}</small>`
      : "";
  return `<span class="shop-buy">${button}${small}</span>`;
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
    <p class="lead"><span title="${formatInt(state.nous)}">${formatBalance(state.nous)}</span> ν available.</p>
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
          ${shopBuyHtml({ attrs: `data-buy="${type}"`, price, affordable, countdown })}
        </div>`;
      }).join("")}</div>` : ""}
    ${openShelf.length === 0 ? `<p class="empty-copy">The shelf is empty.</p>` : ""}
    <h3 class="catalog-section-title">Cells</h3>
    <div class="shop-list">
      <div class="shop-item">
        <div><h3>Board cell</h3><small>Empty hexes to place modules on — you choose where it touches the board.</small></div>
        ${shopBuyHtml({
          attrs: `id="buy-cell" title="${cellAffordable ? "Arm the purchase — pick a frontier hex on the board" : "Not enough nous"}"`,
          price: cellPrice,
          affordable: cellAffordable,
          countdown: cellCountdown,
        })}
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
    ${modalTop(`FORGE · ${banked} banked`)}
    <h2 id="modal-title" class="sr-only">Forge choice</h2>
    ${offer ? `<div class="candidates">
      ${offer.candidates.map((candidate) => `
        <button class="candidate-tile" data-choice="${candidate.id}" data-offer="${offer.id}" data-rarity="${candidate.rarity}" data-type="${candidate.type}" title="Take the ${RARITY_LABEL[candidate.rarity]} ${META[candidate.type].name}">
          <svg viewBox="-70 -70 140 140" aria-hidden="true">
            ${moduleFace({ type: candidate.type, rarity: candidate.rarity, readout: candidateReadout(candidate.type) })}
          </svg>
          <span class="rarity">${RARITY_LABEL[candidate.rarity]}</span>
          <span class="candidate-scaling">+${formatNumber((BALANCE.rarityPower[candidate.rarity] - 1) * 100)}% / level · upgrades from 10 ν</span>
          <span class="candidate-effect">${forgeEffect(candidate.type, state)}</span>
        </button>`).join("")}
    </div>` : `<p class="empty-copy">No Forge choices available.</p>`}
    <p class="modal-note">The board stays live behind this card — inspect freely; click outside, ✕ or Esc puts the choice away.</p>`;
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
// carries the duration pointer to the Time app (ADR-0019, §6–7), with
// session-one's steer riding above. Since #115 the prompt's own picks patch
// in place — tabs flip, the pane swaps, the footer follows — so the modal
// node, the tabs, and the focused control all survive the interaction; the
// render key is re-stamped after each patch so the rebuild guard never
// disagrees with the DOM it guards.
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

// The pane's markup starts below; the footer's refresh writes the
// footprint's raw strings with textContent, so user-typed names can never
// become markup.

// The picked kind's pane body — the one part of the prompt a kind switch
// replaces; the tabs, footer, and modal shell persist around it.
function enterPaneHtml(app: App): string {
  const { state, ui } = app;
  const enter = ui.enter;
  const habits = state.habits.filter((h) => !h.archived);
  if (enter.kind === "habit") {
    return habits.length === 0
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
  }
  if (enter.kind === "new") {
    return `<div class="enter-create">
      <input type="text" id="enter-habit-name" placeholder="Name it (piano, cooking…)" maxlength="40" aria-label="Name a new habit and start the session with it" value="${escapeHtml(enter.newName)}" />
    </div>
    <p class="mode-explain">A brand-new habit starts its clock with this session.</p>`;
  }
  return `<p class="mode-explain">No habit attached — the session runs, and nous is unaffected.</p>`;
}

// The footer band's current content, written onto the surviving nodes: the
// #95 contract (never a stale footer) without a rebuild (#115). The
// summary and CTA carry user-typed names; textContent keeps them as text.
function refreshEnterFooter(app: App, content: HTMLElement): void {
  const next = enterFootprint(app);
  const summary = content.querySelector(".cta-summary");
  const beginButton = content.querySelector("#enter-begin") as HTMLButtonElement | null;
  setText(summary, next.summary);
  if (beginButton) {
    setText(beginButton, next.cta);
    beginButton.disabled = !next.armed;
  }
}

// The prompt's rebuild guard, re-stamped after every in-place patch so a
// later render pass sees the patched DOM as current and skips the rebuild.
function stampEnterKey(app: App, content: HTMLElement): void {
  content.dataset.renderKey = modalKey(app, "enter", enterModalExtra(app));
}

function refreshEnterTabs(app: App, content: HTMLElement): void {
  for (const button of content.querySelectorAll<HTMLButtonElement>("[data-enter-kind]")) {
    const active = button.getAttribute("data-enter-kind") === app.ui.enter.kind;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function refreshEnterChoices(app: App, content: HTMLElement): void {
  const picked = app.ui.enter.habitId;
  for (const button of content.querySelectorAll<HTMLButtonElement>("[data-enter-habit]")) {
    const selected = button.getAttribute("data-enter-habit") === picked;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
}

// The kind switch's structural half: the pane swaps, the pane's own controls
// rebind, the footer follows, the guard re-stamps. The tabs and footer nodes
// themselves never leave the DOM, so focus on them survives the swap.
function swapEnterPane(app: App, content: HTMLElement): void {
  const pane = content.querySelector(".mode-pane");
  if (!pane) return;
  pane.innerHTML = enterPaneHtml(app);
  bindEnterPane(app, content);
  refreshEnterFooter(app, content);
  stampEnterKey(app, content);
}

// The pane-scoped bindings: a habit choice and the new-habit name field.
// Rebound after every pane swap; each acceptance patches in place.
function bindEnterPane(app: App, content: HTMLElement): void {
  content.querySelectorAll<HTMLElement>("[data-enter-habit]").forEach((button) => {
    button.addEventListener("click", () => {
      app.ui.enter.habitId = button.getAttribute("data-enter-habit");
      refreshEnterChoices(app, content);
      refreshEnterFooter(app, content);
      stampEnterKey(app, content);
    });
  });
  const nameInput = content.querySelector("#enter-habit-name") as HTMLInputElement | null;
  // Typing never rebuilds the modal (nothing renders in the background while
  // the console sits in upgrade mode): the name rides ui state and the
  // footer refreshes in place, so the caret keeps its place while the CTA
  // arms.
  nameInput?.addEventListener("input", () => {
    app.ui.enter.newName = nameInput.value;
    refreshEnterFooter(app, content);
    stampEnterKey(app, content);
  });
  nameInput?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      beginEnter(app);
    }
  });
}

// The shared resolution arms the action: a typed name rides the new-habit
// path; otherwise the target is the picked habit's id, with null meaning
// unstructured rides beginFlow directly.
function beginEnter(app: App): void {
  const target = enterTarget(app);
  if (!target.armed) return;
  if (target.newName) app.beginFlowNewHabit(target.newName);
  else app.beginFlow(target.habitId);
}

function renderEnterModal(app: App, content: HTMLElement): void {
  content.innerHTML = `
    ${modalTop("ENTER FLOW")}
    <div class="enter-body">
      <h2 id="modal-title">What are you practicing?</h2>
      <div class="mode-tabs" role="group" aria-label="What kind of session is this?">
        ${kindTab("habit", "A habit", app)}${kindTab("new", "New habit", app)}${kindTab("unstructured", "Unstructured", app)}
      </div>
      <div class="mode-pane">${enterPaneHtml(app)}</div>
      ${app.state.sessionsCompleted === 0 ? `<p class="enter-steer small muted">A first try can be short — five minutes or so, then exit and see what the session banked.</p>` : ""}
      ${
        // Planning lives only in the Time app (§7): the prompt carries a
        // pointer, not a second copy of the controls — the console clock
        // opens the Time app where the plan is set.
        `<p class="enter-plan-hint small muted">Planning lives in the Time app — set it there (or tap the clock), or enter open-ended.</p>`
      }
    </div>
    <div class="footer-band">
      <button id="enter-cancel" class="small">Back</button>
      <span class="cta-summary"></span>
      <button id="enter-begin" class="primary"></button>
    </div>`;
  refreshEnterFooter(app, content);
  bindPlanControls(app, content);
  content.querySelectorAll<HTMLButtonElement>("[data-enter-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      app.ui.enter.kind = button.getAttribute("data-enter-kind") as EnterKind;
      refreshEnterTabs(app, content);
      swapEnterPane(app, content);
    });
  });
  bindEnterPane(app, content);
  byId("enter-begin")?.addEventListener("click", () => beginEnter(app));
  byId("enter-cancel")?.addEventListener("click", () => app.closeModal());
  wireClose(app);
}

const kindTab = (kind: EnterKind, label: string, app: App): string =>
  `<button class="mode-tab${app.ui.enter.kind === kind ? " active" : ""}" data-enter-kind="${kind}" aria-pressed="${app.ui.enter.kind === kind}">${label}</button>`;

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
  // Chords are local (ADR-0036): the summary never claims a board-wide
  // chord multiplier — the synths leg already carries each voice's chords.
  const synthOnly = summary.infusors === 0 && summary.empowerment === 1;
  const breakdown = synthOnly
    ? `the synth terms alone — ${formatNumber(summary.synths)} ν/s is the whole formula`
    : [
        `synths +${formatNumber(summary.synths)} ν/s`,
        ...(summary.infusors > 0 ? [`infusors +${formatNumber(summary.infusors)} ν/s`] : []),
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
    <button data-dev="nous">+100ν</button>
    <button data-dev="synth">+synth</button>`;
  panel.querySelectorAll<HTMLButtonElement>("[data-dev]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-dev")!;
      if (key === "target") app.devToTarget();
      else if (key === "nous") app.devNous();
      else if (key === "synth") app.devSynth();
      else app.devAdvance(Number(key));
    });
  });
}
