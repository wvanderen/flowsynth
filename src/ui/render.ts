import { chargedFactor, cellCost, cellPurchasePrice, chargeDelivered, computeRates, displayedRates, emittedStrength, affordableLevels, levelCost, levelsCost, projectPlacement, voiceCapacityOf, wholeNous, type PlacementProjection } from "../engine/economy";
import { ALLOCATION_QUALITY_BOUNDS, idleTermsOf, summaryTermsOf } from "../engine/allocation";
import { claimOf } from "../engine/accumulator";
import { newChordTerms, wouldFormPreview } from "../engine/chords";
import { combinePreview, combineMutatorsPreview, levelable, type CombinePreview, upgradeAllPreview } from "../engine/actions";
import { deployedAt } from "../engine/economy";
import { sameHex } from "../engine/hex";
import { forgeThreshold, flowThreshold, mutatorForgeThreshold } from "../engine/rolls";
import { BALANCE, CATEGORY_OF, isOscillatorType, isVoiceType, NAMED_CHORDS, REFLECTION_SLIDER_MIN, REFLECTION_SLIDER_NEUTRAL, REFLECTION_SLIDER_POSITIONS, SHELF_MODULE } from "../engine/constants";
import { catalogOpen, rowUnlockCost, unlockableRows } from "../engine/catalog";
import { capacityCeiling, capacityDiscountShare, nextCapacityPrice, nextCeilingPrice } from "../engine/capacity";
import { formatClock, formatDuration } from "../engine/clock";
import { cellNoteOf, noteNameOf, octaveRowOf, positionInRange } from "../engine/lattice";
import { appActive, appLockNote, TILE_APPS, type FocusApp } from "../engine/apps";
import { activeBuildFactors } from "../engine/builds";
import { habitRecordName } from "../engine/records";
import { poolOutstanding } from "../engine/trust";
import { arcCardDue } from "../engine/arc";
import { ACHIEVEMENTS, achievementName, type AchievementCategory, type AchievementContext, type AchievementDef } from "../engine/achievements";
import type { DeployedModule, GameState, Hex, ModuleInstance, MutatorInstance, NoteEntry, NamedChordTerm, Rarity, RateSnapshot } from "../engine/types";
import { DEV_BOARD_CAPACITIES, type App, type ChordHover, type EnterKind, type EnterSelection, type ModalKind } from "./app";
import {
  bindFocusSheet,
  escapeHtml,
  focusSheetHtml,
  focusSheetKey,
  goalBarsOf,
  honestyEventLine,
  noteStampHtml,
  outcomeLabel,
  refreshConsoleClockPlan,
  sessionCaption,
  setText,
  updateFocusSheetLive,
} from "./focus";
import { activeHabit } from "../engine/habits";
import { startPointerDrag } from "./pointer-drag";
import { appIcon } from "./icons";
import { HEX_RADIUS, hexApothem, hexPoints, moduleFace, boardPoint, SPACING, spacerClipPath, forgeBranchOf, faceReadoutFor, faceLevel, waterFill, zeroBuyRead, isSource, inventoryTileSvg } from "./face";
import { renderHexDetail } from "./hexdetail";
import { chargeGlow, chargeLeads } from "./leads";
import { chordOverlay, chordMarkCovers, chipWidth, CHORD_HUES, type ChordMark } from "./chordlayer";
import { updateSvg } from "./svg";
import { APP_LABELS, META, RARITY_LABEL, SHELF_HINTS } from "./meta";
import { formatCountdown, formatInt, formatNumber, formatPracticeMinutes, chordTermLabel, practiceCountdown } from "./format";
import { renderBoardLedger, renderHorizonBar, renderGameInfoStrip, rateDetailsHtml, updateRateDetailsLive, deployedRosterKey, unlockedCount, wireSynthPicks, FEATS_SVG, LIBRARY_SVG, ARETE_SVG } from "./ledger";
import { closeTooltips, wireTooltips } from "./instrument";
import { instancesByClass, instancesKeyOf, libraryHeaderHtml, libraryIndexRowHtml, libraryStageHtml } from "./library";
import { discoveryCount, discoveryBoostOf, rootsHeardOf } from "../engine/library";
import { boardBounds, bindBoardNavigation, lensFrame, renderZoomCluster } from "./zoom";
import { containerWidth, RATE_DETAILS_BREAKPOINT_PX, isPhoneWidth, PHONE_MAX_PX } from "./container";
import { liveAttr, liveSet } from "./live";
import {
  bindMutatorDrag,
  bindMutatorLayer,
  hexFromAttr,
  mutatorAskHtml,
  mutatorEffectText,
  mutGridDecorations,
  mutatorSlotPrice,
  mutatorTileInner,
  mutatorTileSvg,
  layerLegendHtml,
  mutatorLayerWanted,
  FAMILY_WORD,
  renderMutatorPill,
  renderMutatorTray,
  renderLayerLegend,
} from "./mutators";

// The adjacent-center distance the chord overlay's edge trace needs: on
// this pointy-top lattice every neighboring center sits exactly this far
// from its mate, whatever the direction.
const LATTICE_STEP = Math.sqrt(3) * SPACING;
const DRAG_THRESHOLD_PX = 6;
const boundCells = new WeakSet<SVGElement>();
// The Row unlock banners' one-binding ledger, the boundCells pattern: the
// svg persists across renders, so a surviving banner node must never
// re-bind.
const boundBanners = new WeakSet<SVGElement>();

const point = boardPoint;

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// The rate shown in the ledger, hexes, and rate details: live during flow,
// projected build rate while arranging in upgrade mode. Module panels preview
// charge separately via displayedRates(state, true). The authoritative
// gate (issue #258) is the display basis: uncapped ordinary production,
// selected whole chords in development play. Every readout uses the
// same model as the production tick.
function currentSnapshot(state: GameState): RateSnapshot {
  return displayedRates(state, state.mode === "flow");
}

export function render(app: App): void {
  // One rate computation per pass, both bases (§7): the display basis —
  // live during flow, projected build rate while arranging — and the
  // charge-projected basis the panels, bloom, and countdowns preview.
  // Every surface below reads the pass's snapshot; none recomputes.
  const live = currentSnapshot(app.state);
  const projected = displayedRates(app.state, true);
  // The chord work's one computation per pass (§6, issue #296): the grid's
  // seams draw it and the reserved readout's grammar — hover chips, the
  // Hex detail's chord row — reads the same marks, so a placement made
  // from the detail refreshes its relationship breakdown even while the
  // grid stands retired.
  const chordWork = refreshChordOverlay(app, live);
  renderConsoleSession(app, projected);
  renderConsoleApps(app);
  renderBoardLedger(app, live);
  renderTools(app, projected);
  // The Hex detail replaces the grid (issue #295): while it stands the
  // grid renders nothing — another Hex is unreachable until the return.
  if (!app.ui.detail) renderGrid(app, live, projected, chordWork);
  renderInventoryTray(app);
  renderUpgradeAll(app);
  renderCellArmPill(app);
  renderArcCard(app);
  // The Hex detail (issue #295): the bloom's successor — an owned cell's
  // cross-section standing where the grid stood, at every width. The
  // chord row is the readout's own grammar, computed here so the reserved
  // vocabulary never forks (render owns it, the detail mounts it).
  const detailChordRow = app.ui.detail
    ? detailChordRowHtml(app, app.state.mode === "upgrade" ? projected : live)
    : "";
  renderHexDetail(app, live, projected, detailChordRow);
  renderZoomCluster(app);
  renderHorizonBar(app);
  renderGameInfoStrip(app, live);
  // The Mutator Grid's furniture (issue #199): the vertical layer legend,
  // the pinned tray strip, the armed unlock's pill — each a no-op wherever
  // its moment isn't now.
  renderLayerLegend(app);
  renderMutatorTray(app);
  renderMutatorPill(app);
  renderModal(app, live, projected);
  renderDev(app);
  renderDevBoard(app);
}

/* ── Console (ADR-0012) ────────────────────────────── */

// The unplanned shape's two words (§6) live in focus.ts beside the plan
// patchers they share; the clock is itself the plan affordance (§7):
// clicking it opens the Focus sheet's PLAN face. Both console shapes wear
// the same wiring; the clock anchor counts as "inside" for the popover
// click-away closer (app.ts), so the click that opens the sheet never
// closes it in the same gesture.
function wireClockPlan(app: App): void {
  app.listen(byId("clock-plan"), "click", () => {
    app.openApp("time");
  });
}

// Session controls (issue #148) and the focus banner's reads (ADR-0050):
// the clock with its disclosure, then the Enter/Exit main switch — the
// console's visual center of gravity and its sole session gate — with
// pause beside it during flow, and the banner's reads closing the cluster:
// the active habit's name and the goal-progress bars, live during flow,
// mutating nothing. The switch's vermillion carries the session state: the
// switch itself, the progress strip along the header's bottom edge (issue
// #63), and the bars' open fills. The console is pure control (§7): the
// clock is itself the plan affordance — its disclosure opens the Focus
// control sheet (ADR-0050, the time app's PLAN face) — and no production
// readout lives here (the banner's focus reads name practice state, never
// production). The sheet itself anchors beneath the clock's own
// disclosure, whatever face it carries.
function renderConsoleSession(app: App, projected: RateSnapshot): void {
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

  // The Focus control sheet anchors beneath the clock's own disclosure
  // (ADR-0050): the habit and goals tiles walk here too — one frame, four
  // faces. Its signature rides the rebuild key; the body is only
  // string-built when that key changes (every flow tick takes the patch
  // path below). Notes keeps its own popover in the apps row (#277 moves it
  // into this frame).
  const sheetOpen = ui.app === "time" || ui.app === "habit" || ui.app === "goals";
  const popoverKey = sheetOpen ? `sheet|${focusSheetKey(app)}` : "shut";
  const bindSheet = (scrollTop: number): void => {
    if (!sheetOpen) return;
    bindFocusSheet(app, host);
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
    const key = `upgrade|${popoverKey}|${bannerReadsKey(app)}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      const scrollTop = popoverScroll(host);
      host.innerHTML = `
        <div class="clock-anchor">
          ${clockButton("Plan — opens the Focus sheet")}
          ${sheetOpen ? focusSheetHtml(app, projected) : ""}
        </div>
        <div class="session-actions">
          <button class="main-switch idle" id="flow-switch" title="Enter flow — the board locks and runs itself">
            ${switchSvg}<span>Enter flow</span><i class="switch-state" aria-hidden="true"></i>
          </button>
        </div>
        ${bannerReadsHtml(app)}`;
      wireClockPlan(app);
      app.listen(byId("flow-switch"), "click", () => app.startFlow());
      bindSheet(scrollTop);
    } else if (sheetOpen) {
      updateFocusSheetLive(app, host, projected);
    }
    refreshConsoleClockPlan(app);
    refreshBannerReads(app);
    renderSessionStrip(false);
    syncClockDisclosure(app);
    return;
  }

  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const reached = target !== null && elapsed >= target;

  const key = `flow:${state.mode}:${target === null ? "open" : reached ? "reached" : "timed"}|${popoverKey}|${bannerReadsKey(app)}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    const scrollTop = popoverScroll(host);
    host.innerHTML = `
      <div class="clock-anchor">
        ${clockButton("Session time — opens the Focus sheet", ' id="session-clock"', ' id="session-caption"')}
        <span class="clock-provisional" id="session-provisional" role="status"></span>
        ${sheetOpen ? focusSheetHtml(app, projected) : ""}
      </div>
      <div class="session-actions">
        <button id="pause-flow" aria-label="${paused ? "Resume" : "Pause"}" title="${paused ? "Resume the session" : "Pause the session"}">${paused ? resumeSvg : pauseSvg}<span aria-hidden="true">${paused ? "Resume" : "Pause"}</span></button>
        <button class="main-switch ${paused ? "held" : "live"}" id="flow-switch" title="Exit flow — end the session and bank its production">
          ${switchSvg}<span>Exit flow</span><i class="switch-state" aria-hidden="true"></i>
        </button>
      </div>
      ${bannerReadsHtml(app)}`;
    wireClockPlan(app);
    app.listen(byId("pause-flow"), "click", () => (state.mode === "paused" ? app.resume() : app.pause()));
    app.listen(byId("flow-switch"), "click", () => app.endFlow());
    bindSheet(scrollTop);
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
  refreshBannerReads(app);
  syncClockDisclosure(app);
  if (sheetOpen) updateFocusSheetLive(app, host, projected);
}

// The clock's disclosure state: expanded while the sheet stands under it —
// the frame anchors beneath the clock's own disclosure whatever face it
// carries, so the anchor reports the sheet, not just the PLAN face.
// Patched in place on the tick path, where the key is unchanged; opening
// and closing the sheet rebuilds the cluster with the sheet itself.
function syncClockDisclosure(app: App): void {
  const open = app.ui.app === "time" || app.ui.app === "habit" || app.ui.app === "goals";
  byId("clock-plan")?.setAttribute("aria-expanded", String(open));
}

// The focus banner's reads (ADR-0050): beside the switch, the session's
// focus state — the active habit's name and the goal-progress bars, biased
// in-progress first (nearest complete leading, completed occurrences
// closing), past the bar budget a +N count. Reads live during flow and
// mutate nothing: the derivation reads existing state alone, and the live
// patch below only ever touches text and fill widths. The phone banner
// drops the reads — its nav row is bare launchers (ADR-0050's phone line) —
// so the CSS docks the group out below the 600px line.
// The bars' one width spelling: the fill percentage both the markup and
// the in-place patch read, so the two can never drift.
function bannerBarWidth(bar: { fraction: number }): string {
  return `${(bar.fraction * 100).toFixed(1)}%`;
}

function bannerReadsHtml(app: App): string {
  const { bars, overflow } = goalBarsOf(app.state);
  const done = bars.filter((bar) => bar.done).length;
  const barsLabel = `Goal progress: ${bars.length - done} in progress, ${done} complete`;
  return `<div class="banner-reads" role="group" aria-label="Focus reads">
    <span class="bread" data-banner="habit"></span>
    ${
      bars.length > 0
        ? `<span class="gbars" role="img" aria-label="${barsLabel}">${bars
            .map((bar, i) => `<span class="gbar${bar.done ? " done" : ""}" data-banner-bar="${i}" aria-hidden="true"><i style="width:${bannerBarWidth(bar)}"></i></span>`)
            .join("")}</span>`
        : ""
    }
    ${overflow > 0 ? `<span class="gbar-overflow mono" data-banner="overflow">+${overflow}</span>` : ""}
  </div>`;
}

// The reads' rebuild signature: which bars stand (the bias order's
// done-marks), the overflow count, the habit — never the fill fractions or
// the name, which the patcher moves in place on every pass.
function bannerReadsKey(app: App): string {
  const { bars, overflow } = goalBarsOf(app.state);
  return `${activeHabit(app.state)?.id ?? "—"}|${bars.map((bar) => (bar.done ? 1 : 0)).join("")}|${overflow}`;
}

// The banner reads' in-place patch: the habit name and the bar fills move
// without a rebuild — the live clock's neighbor stays live during flow
// (ADR-0050), and a manual log's progress lands between renders too.
function refreshBannerReads(app: App): void {
  const host = document.querySelector("#console-session .banner-reads");
  if (!host) return;
  const habit = activeHabit(app.state);
  setText(host.querySelector('[data-banner="habit"]'), habit?.name ?? "");
  const { bars } = goalBarsOf(app.state);
  bars.forEach((bar, i) => {
    const fill = host.querySelector<HTMLElement>(`[data-banner-bar="${i}"]`)?.firstElementChild as HTMLElement | null;
    const width = bannerBarWidth(bar);
    if (fill && fill.style.width !== width) fill.style.width = width;
  });
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

// Focus-app access (ADR-0012, ADR-0050): bare uncarded icon doors. The wide
// console keeps one door per tile app — Habit, Notes, Goals (issue #148) —
// Habit and Goals walking into the Focus control sheet under the clock,
// Notes keeping its own popover beneath its door until #277 moves it into
// the frame. The phone banner trades the reads for its bare launchers: the
// Focus sheet's door and Notes (ADR-0050's amended phone line). Time wears
// no door at any width: the console clock's disclosure opens the sheet's
// PLAN face. The locked-door plumbing stays for a future ladder tenant;
// locked doors would open nothing, and the board never moves, reflows, or
// dims while the console is used. (Display names live in meta.ts's
// APP_LABELS.)

// A popover's scroll rides its host's rebuild (#115): captured before the
// innerHTML swap, restored once the fresh panel binds. Shared by the
// clock's sheet and the notes popover (issue #148, #149) — one shape, one
// spelling.
function popoverScroll(host: HTMLElement): number {
  return host.querySelector<HTMLElement>(".app-popover")?.scrollTop ?? 0;
}

function restorePopoverScroll(host: HTMLElement, scrollTop: number): void {
  const popover = host.querySelector<HTMLElement>(".app-popover");
  if (popover && scrollTop > 0) popover.scrollTo(0, scrollTop);
}

// The notes popover a tile anchors (issue #149): present only while notes
// stands open, its body built fresh with the host.
function notesPopoverHtml(app: App): string {
  return app.ui.app === "notes" ? `<div class="app-popover" id="app-popover">${notesPanelBody(app)}</div>` : "";
}

// The notes popover's rebuild signature: everything its body shows, hashed.
function notesPanelKey(app: App): string {
  return JSON.stringify([app.ui.app === "notes", app.state.notes.length]);
}

// The one focus-app glyph every tile wears — so the spelling can never
// drift between access points.
function appGlyphSvg(appKey: FocusApp): string {
  return `<svg viewBox="-12 -12 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${appIcon(appKey)}</svg>`;
}

// The facts every access point reads for a tile app: its display label,
// whether it's active, and its lock note. Tiles compose their names from
// this one shape. No state word rides the surface: the Goals-state read is
// desktop-only and lives in the Focus sheet's head (ADR-0033 amended), and
// the phone nav carries bare doors (ADR-0050's phone line).
interface AppEntryFacts {
  label: string;
  active: boolean;
  note: string | null;
}

function appEntryFacts(state: GameState, appKey: FocusApp): AppEntryFacts {
  return { label: APP_LABELS[appKey], active: appActive(state, appKey), note: appLockNote(state, appKey) };
}

function renderConsoleApps(app: App): void {
  const host = byId("console-apps");
  if (!host) return;
  const { state, ui } = app;
  const phone = isPhoneWidth();
  // The doors' pressed states ride the open app; the notes popover rides
  // its body. Everything else the sheet shows lives under the clock's own
  // key.
  const key = `${phone ? "phone" : "wide"}|${ui.app}|${notesPanelKey(app)}`;
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  // A newly captured note keeps the popover scrolled where the player is.
  const scrollTop = popoverScroll(host);
  // The wide console keeps the focus-app tiles; the phone banner drops the
  // reads for its bare launchers — the Focus sheet's door and Notes, with
  // Settings at the row's far end (ADR-0050's amended phone line). Notes
  // anchors its own popover beneath its door at every width; Habit and
  // Goals open the Focus sheet under the clock.
  const doorKeys: readonly DoorKey[] = phone ? PHONE_DOORS : TILE_APPS;
  const tiles = doorKeys
    .map((doorKey) => {
      if (doorKey === "focus") {
        // The Focus sheet's door: pressed while any face of the sheet
        // stands — the inset marker is the sheet-open state.
        const open = ui.app === "time" || ui.app === "habit" || ui.app === "goals";
        return `<div class="app-slot">
      <button class="app-tile${open ? " open" : ""}" id="app-tile-focus" aria-pressed="${open}" aria-label="Focus" title="Focus — plan, habit, goals, history">
        <span class="app-tile-glyph">
          ${FOCUS_DOOR_SVG}
        </span>
      </button>
    </div>`;
      }
      const appKey = doorKey as FocusApp;
      const facts = appEntryFacts(state, appKey);
      const open = ui.app === appKey;
      const title = facts.note ? `${facts.label} — locked: ${facts.note}` : `${facts.label} app`;
      return `<div class="app-slot">
      <button class="app-tile${facts.active ? "" : " locked"}${open ? " open" : ""}" id="app-tile-${appKey}" aria-pressed="${open}" aria-label="${facts.label}"${facts.active ? "" : ' aria-disabled="true"'} title="${title}">
        <span class="app-tile-glyph">
          ${appGlyphSvg(appKey)}
        </span>
      </button>
      ${appKey === "notes" ? notesPopoverHtml(app) : ""}
    </div>`;
    })
    .join("");
  host.innerHTML = `<div class="app-tiles">${tiles}</div>`;
  restorePopoverScroll(host, scrollTop);
  for (const doorKey of doorKeys) {
    app.listen(byId(`app-tile-${doorKey}`), "click", () => {
      if (doorKey === "focus") app.openApp("time");
      else app.openApp(doorKey);
    });
  }
  if (ui.app === "notes") bindAppPanel(app, host);
}

// The console doors' keys: every focus app plus the Focus sheet's own door
// — the one entry that is not an app but the frame's front.
type DoorKey = FocusApp | "focus";

// The Focus sheet's door mark (ADR-0050's phone line, the prototype's ◎):
// the circled dot — the focus figure, distinct from the clock's face.
const FOCUS_DOOR_SVG = `<svg viewBox="-12 -12 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle r="8"/><circle r="1.8"/></svg>`;

// The phone banner's door set (ADR-0050's amended phone line): the Focus
// sheet's door and Notes. Habit and Goals walk into the sheet's faces
// behind the focus door — the compact launcher they answered retires
// (ADR-0033 amended), and the clock and main switch keep their posts.
const PHONE_DOORS: readonly DoorKey[] = ["focus", "notes"];

// The feats page (ADR-0015 as amended): the always-visible full list — the
// milestone feats lead as their own group, then the five buckets the ADR
// names with their progress bars; none hidden. Spark's progress rides the
// charge preview; it reads zero between sessions, as charge does.
const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  practice: "Practice capstones",
  console: "Console encouragers",
  board: "Board & economy",
  formula: "Formula & horizon",
  ladder: "Counter ladder",
  milestone: "Milestones",
};

const ACHIEVEMENT_CATEGORY_ORDER: readonly AchievementCategory[] = ["practice", "console", "board", "formula", "ladder"];

// The one reward every feat shares (ADR-0015): the global boost leg, read
// here so the copy can never drift from the tuning constant.
const FEAT_EFFECT_READ = `+${Math.round(BALANCE.achievementBoostPerFeat * 100)}% ν`;

// The engraved done-mark, the state grammar's acquired voice — one mark
// for every crossed feat row, milestone or encourager.
const ACH_MARK = `<span class="ach-mark" role="img" aria-label="acquired">✓</span>`;

// A feat's crossed bit: the ledger is the truth, everywhere it's asked.
const crossedOf = (app: App, id: string): boolean => app.state.achievements[id] !== undefined;

function achievementContextOf(app: App, projected: RateSnapshot): AchievementContext {
  return { chargeDelivered: app.state.mode === "flow" && chargeDelivered(projected) };
}

// The open page's refresh signature: each feat's crossed bit plus its
// progress quantized to a percent, so a rebuild only happens when the page
// visibly changes.
function achProgressKey(app: App, projected: RateSnapshot): string {
  const ctx = achievementContextOf(app, projected);
  return ACHIEVEMENTS.map((def) => {
    const crossed = crossedOf(app, def.id) ? 1 : 0;
    const { current, goal } = def.progress(app.state, ctx);
    return `${crossed}:${Math.round((Math.min(1, goal > 0 ? current / goal : 1)) * 100)}`;
  }).join(",");
}

// The library sheet's refresh signature (issue #230): the discovery count
// plus every class's roots-heard figure — a hairline moving is a rebuild.
function discoveryKey(state: GameState): string {
  return `${discoveryCount(state)}|${NAMED_CHORDS.map((def) => rootsHeardOf(state, def.name)).join(",")}`;
}

function achRowHtml(app: App, def: AchievementDef, ctx: AchievementContext): string {
  const unlockedAt = app.state.achievements[def.id];
  const { current, goal } = def.progress(app.state, ctx);
  const fraction = Math.min(1, goal > 0 ? current / goal : 1);
  // The four facts (ADR-0015 amended, issue #269): the unique icon, the
  // name, the shared effect, and the state — the engraved done-mark
  // crossed, the progress figures uncrossed. The description carries the
  // concrete act; the progress bar restocks the state at a glance.
  const readout =
    unlockedAt !== undefined ? ACH_MARK : `<span class="ach-readout mono">${formatNumber(current)} / ${formatNumber(goal)}</span>`;
  return `<div class="ach-row${unlockedAt !== undefined ? " unlocked" : ""}">
    <span class="ach-icon" aria-hidden="true">${def.icon}</span>
    <div class="ach-body">
      <div class="ach-head">
        <span class="ach-name">${def.name}</span>
        <span class="ach-effect mono">${FEAT_EFFECT_READ}</span>
        ${readout}
      </div>
      <p class="ach-desc">${def.description}</p>
      <div class="ach-track" aria-hidden="true"><i style="width:${(fraction * 100).toFixed(1)}%"></i></div>
    </div>
  </div>`;
}

// A milestone's row (ADR-0015 amended): the four compact facts — icon,
// name, the beat's own existing unlock, the shared +2% ν effect — closing
// in the state: an engraved done-mark when crossed; muted with the gate
// named in the tooltip layer when not.
function milestoneRowHtml(app: App, def: AchievementDef): string {
  const crossed = crossedOf(app, def.id);
  const tipId = `ach-gate-${def.id}`;
  const gateTip =
    crossed || !def.gate
      ? ""
      : `<span class="inst-tip"><button class="inst-tip-trigger" type="button" aria-expanded="false" aria-describedby="${tipId}" aria-label="${def.name} — what stands before it">ⓘ</button><span class="inst-tip-body" id="${tipId}" role="tooltip">${def.gate}</span></span>`;
  const mark = crossed ? ACH_MARK : "";
  return `<div class="ach-milestone${crossed ? " crossed" : ""}">
    <span class="ach-icon" aria-hidden="true">${def.icon}</span>
    <span class="ach-read"><span class="ach-name">${def.name}</span><span class="ach-sep" aria-hidden="true"> · </span><span class="ach-unlock">${def.unlock ?? ""}</span><span class="ach-sep" aria-hidden="true"> · </span><span class="ach-effect mono">${FEAT_EFFECT_READ}</span></span>
    ${mark}${gateTip}
  </div>`;
}

function renderAchievementsModal(app: App, content: HTMLElement, projected: RateSnapshot): void {
  const ctx = achievementContextOf(app, projected);
  const count = Object.keys(app.state.achievements).length;
  const milestones = ACHIEVEMENTS.filter((def) => def.milestone);
  const milestoneSection =
    milestones.length === 0
      ? ""
      : `<section class="ach-section">
    <h3 class="catalog-section-title">${ACHIEVEMENT_CATEGORY_LABEL.milestone}</h3>
    <div class="ach-milestones">${milestones.map((def) => milestoneRowHtml(app, def)).join("")}</div>
  </section>`;
  const sections = ACHIEVEMENT_CATEGORY_ORDER.map((category) => {
    const feats = ACHIEVEMENTS.filter((def) => !def.milestone && def.category === category);
    if (feats.length === 0) return "";
    return `<section class="ach-section">
      <h3 class="catalog-section-title">${ACHIEVEMENT_CATEGORY_LABEL[category]}</h3>
      <div class="ach-grid">${feats.map((def) => achRowHtml(app, def, ctx)).join("")}</div>
    </section>`;
  }).join("");
  content.innerHTML = `
    ${modalTop("FEATS", undefined, isPhoneWidth() ? "Collection" : undefined)}
    <h2 id="modal-title">${count} of ${ACHIEVEMENTS.length} feats.</h2>
    <p class="lead">Every feat speeds the rate a little — they accelerate, never gate. Each one adds into the Achievements leg of every synth row in the rate details.</p>
    ${milestoneSection}${sections}`;
  const list = content.querySelector(".ach-milestones");
  if (list) wireTooltips(list, app.signal);
  wireCollectionBack(app);
  wireClose(app);
}

// The chord sheet (issue #230, reworked by #278): an index of the eleven
// classes beside a large selected-glyph stage. The header reads the
// ledger — `Chords (4/11) (+4% ν)`, no explanatory paragraph — and every
// deeper mechanic (the discovery bonus, the instance stacking, the roots
// history) lives in the tooltip layer. Selecting an index row puts that
// class on the stage; the selection is light furniture (ui.chordStage),
// falling back to the lead discovered row. The index lists discovered
// classes first; within each group the difficulty ladder's order stands.
function renderLibraryModal(app: App, content: HTMLElement, snapshot?: RateSnapshot): void {
  const { state } = app;
  const count = discoveryCount(state);
  // Standing instances per class, summed over the live rate pass's terms —
  // the stage's active read and the index's per-class counts share this
  // one map, so neither can drift from the allocation.
  const instances = instancesByClass(snapshot?.namedChords ?? []);
  const ringing = NAMED_CHORDS
    .filter((def) => (instances.get(def.name) ?? 0) > 0)
    .map((def) => ({ name: def.name, instances: instances.get(def.name)! }));
  const activeTotal = ringing.reduce((total, chord) => total + chord.instances, 0);
  const discovered = NAMED_CHORDS.filter((def) => state.chordDiscovery[def.name]?.formed === true);
  const locked = NAMED_CHORDS.filter((def) => state.chordDiscovery[def.name]?.formed !== true);
  const ordered = [...discovered, ...locked];
  const selected = ordered.some((def) => def.name === app.ui.chordStage)
    ? app.ui.chordStage!
    : (discovered[0] ?? locked[0]!).name;
  const rows = ordered
    .map((def) => libraryIndexRowHtml(def, state.chordDiscovery[def.name], instances.get(def.name) ?? 0, def.name === selected))
    .join("");
  const stageDef = NAMED_CHORDS.find((def) => def.name === selected)!;
  // On phone the sheet's one entry is Collection (issue #270): the back
  // control rides the head, returning to the launcher that opened it.
  const back = isPhoneWidth() ? "Collection" : undefined;
  content.innerHTML = `
    ${modalTop(null, undefined, back)}
    ${libraryHeaderHtml(count, NAMED_CHORDS.length, Math.round(BALANCE.discoveryBonusPerClass * 100), Math.round((discoveryBoostOf(state) - 1) * 100))}
    <div class="chord-sheet">
      <div class="chord-index">${rows}</div>
      ${libraryStageHtml(stageDef, state.chordDiscovery[selected], activeTotal, ringing)}
    </div>`;
  content.querySelectorAll<HTMLButtonElement>(".chord-row").forEach((row) => {
    app.listen(row, "click", () => {
      app.ui.chordStage = row.dataset.chord ?? null;
      app.render();
      // The rebuild replaces the row and initially focuses the modal's
      // first control. Keep selection in the index for the next keypress.
      content.querySelector<HTMLButtonElement>('.chord-row[aria-current="true"]')?.focus();
    });
  });
  wireTooltips(content, app.signal);
  wireCollectionBack(app);
  wireClose(app);
}

// The Collection launcher (issue #270): the phone thumb bar's fifth
// segment, holding the feats and chords entries the ledger chips carry at
// wider widths — one row per ledger, icon and count leading to its sheet.
// Its future scope — viewing all unlocked module and mutator types — is
// recorded as deferred, not built.
function renderCollectionModal(app: App, content: HTMLElement): void {
  const feats = unlockedCount(app.state);
  const chords = discoveryCount(app.state);
  content.innerHTML = `
    ${modalTop("COLLECTION", "modal-title")}
    <div class="collection-rows">
      <button class="collection-row" id="collection-feats" title="Feats — the full list, and how close the next one is">${FEATS_SVG}<span class="t-condensed">Feats</span><span class="mono">${feats}/${ACHIEVEMENTS.length}</span></button>
      <button class="collection-row" id="collection-chords" title="Chord library — the field guide of chord classes">${LIBRARY_SVG}<span class="t-condensed">Chords</span><span class="mono">${chords}/${NAMED_CHORDS.length}</span></button>
    </div>`;
  app.listen(byId("collection-feats"), "click", () => app.openModal("achievements"));
  app.listen(byId("collection-chords"), "click", () => app.openModal("library"));
  wireClose(app);
}

// The launcher's back control (#270): one binding for whichever sheet
// carries it — a tap returns to the launcher instead of putting the sheet
// away.
function wireCollectionBack(app: App): void {
  app.listen(byId("modal-back"), "click", () => app.openModal("collection"));
}

// ── The action row (§7): a left-edge icon dock ──────

const CELL_TOOL_SVG = `<svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M0-6v12M-6 0h12"/></svg>`;

const INVENTORY_TOOL_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>`;

// The action definitions the dock and the thumb bar are both built from:
// Catalog / Forge (count badge + charge pip) / Add everywhere, and
// Collection and Inventory folded into the phone's thumb bar (§7, issue
// #270). Arrange has no job anywhere — dragging is already live (§5) — and
// the canvas legend is gone: its encodings belong to the surfaces that use
// them. Inventory presents once: the wide-surface dock lost the icon when
// the tray column stopped collapsing (issue #272), so the thumb bar's
// segment taps the sheet — the phone face of the same tray.
interface ToolAction {
  op: string;
  svg: string;
  label: string;
  run: (app: App) => void;
  // The charge-projected snapshot rides along (§7's one-pass rule): the
  // meters' rates read it instead of recomputing.
  title: (app: App, projected: RateSnapshot) => string;
  // The count badge over the icon (forge's banked rolls, feats, tray).
  badge?: (app: App) => string;
  // A static node riding the icon (forge's charge pip).
  media?: string;
  disabled?: (app: App) => boolean;
  active?: (app: App) => boolean;
}

// The one meter detail (ADR-0041): every meter's progress, threshold, and
// rate, one line each — the dock pip's hover/focus read and the Forge
// modal's detail block share these builders, so neither can drift. The
// flow meter's fill is credited practice time, so its figures are
// durations and its rate reads as practice remaining; the charge branch's
// are Forge progress points and its rate the projected contribution.
function flowMeterLine(state: GameState): string {
  const threshold = flowThreshold(state.flow.earned);
  const remaining = Math.max(0, threshold - state.flow.progress);
  return `Flow meter ${formatCountdown(state.flow.progress)} / ${formatCountdown(threshold)} — next roll in ~${formatCountdown(remaining)} of practice`;
}

function forgeMeterLine(state: GameState, forgeRate: number): string {
  return `Forge progress ${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(forgeThreshold(state.forge.earned))}${
    forgeRate > 0 ? ` — ${formatNumber(forgeRate)}/s from charge` : " — charged by deployed Forges"
  }`;
}

// The Mutator Forge branch's line (ADR-0043): its own meter, its own
// figures — one line each, the same shape the other branches wear.
function mutatorForgeMeterLine(state: GameState, mutatorRate: number): string {
  return `Mutator Forge ${formatNumber(Math.max(0, state.mutatorForge.progress))} / ${formatNumber(mutatorForgeThreshold(state.mutatorForge.earned))}${
    mutatorRate > 0 ? ` — ${formatNumber(mutatorRate)}/s from charge` : " — charged by deployed Mutator Forges"
  }`;
}

function meterDetail(app: App, forgeRate: number, mutatorRate: number): string {
  const { state } = app;
  const banked = state.bankedRolls.length;
  const bankedNote = banked > 0 ? ` · ${banked} banked choice${banked === 1 ? "" : "s"}` : "";
  const mutBanked = state.bankedMutatorRolls.length;
  const mutNote = mutBanked > 0 ? ` · ${mutBanked} banked mutator choice${mutBanked === 1 ? "" : "s"}` : "";
  const mutLine = state.catalogEntryOwned ? ` · ${mutatorForgeMeterLine(state, mutatorRate)}${mutNote}` : "";
  return `${flowMeterLine(state)} · ${forgeMeterLine(state, forgeRate)}${bankedNote}${mutLine}`;
}

// Every meter bar's fill: the clamped progress share, one build for the
// dock pip and the modal's card-scale bars alike.
function meterPipWidth(progress: number, cap: number): string {
  return `${(Math.min(1, Math.max(0, progress / cap)) * 100).toFixed(1)}%`;
}

function toolActions(): ToolAction[] {
  return [
    {
      op: "catalog",
      svg: TOOL_CATALOG_SVG,
      label: "Catalog",
      run: (app) => app.openModal("catalog"),
      title: (app) => (app.state.mode === "upgrade" ? "Catalog — the nous shop and the Arete catalog" : "Catalog — purchases happen between sessions"),
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
      // The pip shows the flow meter (ADR-0041); hover, focus, or tap opens
      // the one detail — the live meter read, in flow suffixed with the lock
      // reason (#233): the sheet never expands during a session, and the
      // badge and pip stay as the visual indicator.
      disabled: (app) => app.state.mode !== "upgrade",
      title: (app, projected) => {
        const read = meterDetail(app, projected.forgeRate, projected.mutatorForgeRate);
        return app.state.mode !== "upgrade" ? `${read} — choices settle between sessions.` : read;
      },
    },
    {
      // Add, mode-directed (#246's contract, #273's lock): module mode arms
      // the next cell's purchase, mutator mode arms the slot unlock —
      // Arete slot unlocking lives in Add, never a tray card. Pre-entry a
      // mutator-mode Add cannot stand (the locked switch never flips the
      // mode) — but if one ever does, it walks to the ◇ entry screen like
      // every other locked Mutators control. Arming from the thumb bar puts
      // the tray sheet away, so the pulsing targets stand on a visible
      // board.
      op: "cell",
      svg: CELL_TOOL_SVG,
      label: "Add",
      run: (app) => {
        if (app.ui.modal === "inventory") app.closeModal();
        // Add expands the board — a grid gesture (#295): from the detail it
        // returns the grid first, then arms per the mode's own contract.
        if (app.ui.detail) app.closeDetail();
        if (app.state.mode === "upgrade" && app.ui.mutLayer === "mutators") {
          if (!app.state.catalogEntryOwned) {
            app.openMutatorEntry();
            return;
          }
          if (app.ui.mutUnlockArmed) app.mutCancelGestures();
          else app.mutArmUnlock();
          return;
        }
        if (app.ui.buyingCell) app.cancelCellPurchase();
        else app.armCellPurchase();
      },
      title: (app) =>
        app.state.mode !== "upgrade"
          ? "Add — purchases happen between sessions"
          : app.state.catalogEntryOwned && app.ui.mutLayer === "mutators"
            ? app.ui.mutUnlockArmed
              ? "Pick an eligible cell · Esc cancels"
              : `Unlock a Mutator slot — ${mutatorSlotPrice(app.state) === 0 ? "the first is free" : `${formatInt(mutatorSlotPrice(app.state))} Arete`}`
            : app.ui.buyingCell
              ? "Pick a frontier hex · Esc cancels"
              : "Add a cell",
      disabled: (app) => app.state.mode !== "upgrade",
      active: (app) => app.ui.buyingCell || app.ui.mutUnlockArmed,
    },
    {
      // The tray's phone face (issue #272): the wide-surface dock lost the
      // Inventory icon when the column stopped collapsing — the thumb bar's
      // segment toggles the tray sheet.
      op: "inventory",
      svg: INVENTORY_TOOL_SVG,
      label: "Inventory",
      run: (app) => {
        if (app.ui.modal === "inventory") app.closeModal();
        else app.openModal("inventory");
      },
      badge: (app) => {
        const trayCount = app.state.modules.filter((m) => m.pos === null).length;
        return trayCount > 0 ? `<b class="tool-badge mono">${trayCount}</b>` : "";
      },
      title: (app) =>
        app.state.mode !== "upgrade" ? "Inventory — the board is locked during flow" : "Inventory — the board-surface tray, tapped open",
      // Gated in flow like Catalog/Forge/Add (#193): the tray hides with
      // the board locked, so the button arms nothing a placement could
      // never land.
      disabled: (app) => app.state.mode !== "upgrade",
    },
    {
      // Collection rides the thumb bar as its fifth segment (issue #270):
      // the launcher absorbing the phone's feats and chords entries — the
      // ledger chips are wide-surface furniture, and the ledger dissolves
      // below the 600px line.
      op: "collection",
      svg: COLLECTION_TOOL_SVG,
      label: "Collection",
      run: (app) => app.openModal("collection"),
      title: () => "Collection — feats and the chord library",
    },
  ];
}

// The Collection mark (issue #270): two adjacent cells in the hex voice —
// the board's things, gathered.
const COLLECTION_TOOL_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M9 2.5 14.2 5.5v6L9 14.5 3.8 11.5v-6Z"/><path d="M15 9.5 20.2 12.5v6L15 21.5 9.8 18.5v-6Z"/></svg>`;

const TOOL_CATALOG_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/></svg>`;
const TOOL_FORGE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.8 3.2-3.2 4.6-3.2 8.4a3.2 3.2 0 0 0 6.4 0c0-1.4-.6-2.3-1.1-2.9 1.9.5 3.4 2 3.4 4.3a5.5 5.5 0 0 1-11 0C6.5 7.6 10.8 6.4 12 3Z"/></svg>`;

// The left-edge icon dock (§7): Catalog / Forge (count badge + charge pip)
// / Add, floating over the board's left edge (issue #272 — the Inventory
// icon left with the tray's collapse toggle). Hidden on portrait phone,
// where the same actions plus Inventory and Collection ride the bottom
// thumb bar.
function renderTools(app: App, projected: RateSnapshot): void {
  const { state, ui } = app;
  const host = byId("board-tools");
  const thumb = byId("thumb-bar");
  const actions = toolActions();
  // The dock carries the board actions; Inventory and Collection ride the
  // thumb bar alone on phone — Inventory taps the tray's sheet (the column
  // never collapses, so the dock needs no toggle), and Collection is the
  // feats/chords launcher where the ledger dissolves (issue #270).
  const dockActions = actions.filter((action) => action.op !== "collection" && action.op !== "inventory");
  const forgeCount = state.bankedRolls.length;
  const trayCount = state.modules.filter((m) => m.pos === null).length;
  const key = JSON.stringify(["dock", state.mode, ui.mutLayer, ui.mutUnlockArmed, forgeCount, ui.buyingCell, trayCount]);

  for (const [target, list] of [
    [host, dockActions],
    [thumb, actions],
  ] as const) {
    if (!target) continue;
    if (target.dataset.renderKey !== key) {
      target.dataset.renderKey = key;
      target.innerHTML = list
        .map((action) => {
          const detailId = `${target.id}-forge-detail`;
          const detail = action.op === "forge"
            ? `<span id="${detailId}" class="forge-detail" role="tooltip" hidden>${action.title(app, projected)}</span>`
            : "";
          const extra = (action.badge?.(app) ?? "") + (action.media ?? "") + detail;
          return `<button class="tool-icon${action.active?.(app) ? " active" : ""}" data-op="${action.op}" aria-label="${action.label}" ${action.op === "forge" ? `aria-describedby="${detailId}"` : `title="${action.title(app, projected)}"`}${action.disabled?.(app) ? " disabled" : ""} aria-pressed="${action.active?.(app) ?? false}">${action.svg}${extra}<small class="tool-word">${action.label}</small></button>`;
        })
        .join("");
      target.querySelectorAll<HTMLButtonElement>("[data-op]").forEach((button) => {
        if (button.dataset.op === "forge") {
          const detail = button.querySelector<HTMLElement>(".forge-detail")!;
          let hovered = false;
          app.listen(button, "mouseenter", () => { hovered = true; detail.hidden = false; });
          app.listen(button, "mouseleave", () => {
            hovered = false;
            detail.hidden = document.activeElement !== button;
          });
          app.listen(button, "focus", () => { detail.hidden = false; });
          app.listen(button, "blur", () => { detail.hidden = !hovered; });
          app.listen(button, "keydown", (event) => {
            if (event.key === "Escape" && !detail.hidden) {
              detail.hidden = true;
              event.stopPropagation();
            }
          });
        }
        app.listen(button, "click", () => {
          actions.find((action) => action.op === button.getAttribute("data-op"))!.run(app);
        });
      });
    }
  }

  // Live under the structural rebuild: the Forge pip tracks the flow meter
  // (ADR-0041) and its read stays the one meter detail, live during flow;
  // the cell icon wears the current price and affordability.
  const flowCap = flowThreshold(state.flow.earned);
  for (const target of [host, thumb]) {
    if (!target) continue;
    const pip = target.querySelector<HTMLElement>('[data-live="forge-pip"]');
    const pipWidth = meterPipWidth(state.flow.progress, flowCap);
    if (pip && pip.style.width !== pipWidth) pip.style.width = pipWidth;
    const forgeButton = target.querySelector<HTMLButtonElement>('[data-op="forge"]');
    if (forgeButton) {
      const action = actions.find((a) => a.op === "forge")!;
      const detail = forgeButton.querySelector<HTMLElement>(".forge-detail");
      if (detail) detail.textContent = action.title(app, projected);
      forgeButton.disabled = action.disabled?.(app) ?? false;
    }
    const cellButton = target.querySelector<HTMLButtonElement>('[data-op="cell"]');
    if (cellButton && state.mode === "upgrade") {
      const action = actions.find((a) => a.op === "cell")!;
      cellButton.title = action.title(app, projected);
      // The Add icon carries the mode's arm: the cell price in module
      // mode, the slot-unlock arm in mutator mode (issue #272 review).
      const mutatorArm = state.catalogEntryOwned && ui.mutLayer === "mutators";
      cellButton.classList.toggle("active", mutatorArm ? ui.mutUnlockArmed : ui.buyingCell);
      cellButton.setAttribute("aria-pressed", String(mutatorArm ? ui.mutUnlockArmed : ui.buyingCell));
      if (mutatorArm) {
        cellButton.disabled = false;
      } else if (ui.buyingCell) {
        cellButton.disabled = false;
      } else {
        const price = cellCost(state.cellsBought);
        const countdown = practiceCountdown(price, wholeNous(state), projected.rate);
        cellButton.title = `Add — ${formatInt(price)} ν${countdown ? ` · ${countdown}` : ""}`;
        cellButton.disabled = wholeNous(state) < price;
      }
    }
  }
}

/* ── The add-cell pill (#201): one cost spot, one obvious exit ── */

// While a cell purchase is armed, the pill rides the board's top edge as
// the mode's single cost spot — "Add · <price> ν — Cancel · Esc" —
// and the pill itself is the cancel: one click backs out, Esc backs it up.
// The board greys around it (the stylesheet reads body.cell-arming); no
// other mode ever dims. The price re-quotes as cells land, since the arm
// persists across buys.
const boundArmPills = new WeakSet<HTMLElement>();

function renderCellArmPill(app: App): void {
  const host = byId("cell-arm-pill");
  if (!host) return;
  if (!boundArmPills.has(host)) {
    boundArmPills.add(host);
    app.listen(host, "click", () => {
      if (app.ui.buyingCell) app.cancelCellPurchase();
    });
  }
  const arming = app.state.mode === "upgrade" && app.ui.buyingCell;
  host.hidden = !arming;
  if (!arming) return;
  const basePrice = cellCost(app.state.cellsBought);
  const premiums = app.frontierCells().map((pos) => cellPurchasePrice(app.state, pos) - basePrice);
  const maxPremium = Math.max(0, ...premiums);
  const premiumNote = maxPremium > 0 ? ` (+ up to ${formatInt(maxPremium)} ν row premium)` : "";
  const markup = `Add · <span class="mono">${formatInt(basePrice)} ν${premiumNote}</span><span class="pill-esc">Cancel · Esc</span>`;
  if (host.dataset.renderKey !== markup) {
    host.dataset.renderKey = markup;
    host.innerHTML = markup;
  }
}

/* ── Hex grid ──────────────────────────────────────── */

// The chord overlay's one computation (§6, ADR-0036), built from the live
// pass once per render: the grid's seams draw it, and the reserved
// readout's grammar — the hover chips and the Hex detail's chord row —
// reads the same marks through the cache, so the two surfaces can never
// disagree about what the board sings.
function refreshChordOverlay(app: App, live: RateSnapshot): ReturnType<typeof chordOverlay> {
  const { state } = app;
  const deployedById = new Map(state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m]));
  // The silent voices (ADR-0048): the chords they sing in draw muted.
  const silentIds = new Set(state.modules.filter((m) => CATEGORY_OF[m.type] === "silentVoice").map((m) => m.id));
  const overlay = chordOverlay({
    namedChords: live.namedChords,
    // The recognized-but-idle candidates (issue #258): the board sings
    // them, the allocation didn't select them — dimmer, dotted, never
    // pulsing. The active seams dominate. Absent an allocation read,
    // nothing is idle — the plain recognizer's every term is already in
    // namedChords.
    inactiveChords: live.allocation ? idleTermsOf(live.allocation) : [],
    posOf: (id) => deployedById.get(id)?.pos ?? null,
    point,
    radius: HEX_RADIUS,
    step: LATTICE_STEP,
    labelFor: chordTermLabel,
    focusIds: [],
    focusPoint: null,
    silentIds,
  });
  chordReadoutCache.set(app, { marks: overlay.marks, snapshot: live });
  return overlay;
}

function renderGrid(app: App, live: RateSnapshot, projected: RateSnapshot, overlay: ReturnType<typeof chordOverlay>): void {
  const { state, ui } = app;
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg) return;
  // The drop preview is session-bound light state: with no drag carried and
  // no placement armed, no hover can be live — stale state never survives a
  // render. The Mutator layer's preview obeys the same rule (issue #199).
  if (!app.dragging && !ui.placing) ui.dropHover = null;
  if (!app.ui.mutCarrying) ui.mutDropHover = null;
  // A state change always rides a render (act), so the placement
  // projection never outlives the pass that could stale it (#260) — the
  // hover refresh recomputes it on demand.
  dropProjectionCache.delete(app);
  const upgrade = state.mode === "upgrade";
  // The frontier stops at the finite octave-row band (ADR-0022): the
  // fifths axis runs free, the rows do not. The raw frontier also feeds the
  // Row unlock's shaded rows (issue #197): while add-cell mode stands, the
  // still-locked rows just past the launch band shade violet behind one
  // banner each — frontier-adjacent rows only, so at most one above and
  // one below can ever stand.
  const rawFrontier = upgrade && ui.buyingCell ? app.frontierCells() : [];
  const bands = upgrade && ui.buyingCell && catalogOpen(state) ? rowUnlockBands(state, rawFrontier) : [];
  const frontier = rawFrontier.filter((pos) => positionInRange(state, pos));
  const allCells = [...state.cells, ...frontier, ...bands.flatMap((band) => band.hexes)];
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
  // The chord annotation is always on (§6, #137): every formed chord wears
  // its colored work — no chord view, no toggle. The marks arrive from
  // refreshChordOverlay (render's one computation, issue #296) — the readout
  // shares them, so the seams and the asked chips never drift apart.
  // Emphasis rides hover and the Hex detail now (issue #295) — the grid
  // itself whispers its chords in the gaps, never over a face.

  // Charge leads (§8, #41): uniform green patch leads, center-to-center,
  // directional generator → receiver. Leads in live flow animate; everything
  // else — paused, upgrade mode (charge pauses between sessions, ADR-0001),
  // or a generator whose charge window is spent — sits dim and static as
  // wiring previews (ADR-0002).
  let html = `${CHARGE_LEAD_DEFS}${SPACER_WINDOW_DEFS}`;
  for (const { generator, receiver, emitting } of chargeLeads(state, flow)) {
    if (generator.pos === null || receiver.pos === null) continue;
    const [x1, y1] = point(generator.pos);
    const [x2, y2] = point(receiver.pos);
    const cls = emitting ? "charge-line" : "charge-preview-line";
    html += `<line data-key="charge-${generator.id}-${receiver.id}" class="${cls}" ${leadSegment(x1, y1, x2, y2)}/>`;
  }

  // The Row unlock's shaded rows (issue #197): background work, behind the
  // chord marks and the faces — the promise the banner carries is board
  // geometry, not chord content.
  html += `<g data-key="row-bands">${rowBandHtml(state, bands, point)}</g>`;

  // Named-chord marks (§6, #201): the chord work draws UNDER the modules —
  // visible in the gaps between the faces and past the poking corners,
  // whispering in the gaps; no chord ever crosses a face. In live sessions
  // the stylesheet pulses the marks quietly while the board stays locked.
  // The readout refreshes with the same marks: a hovered voice's chips ask
  // into the reserved spot.
  html += `<g data-key="chord-marks">${overlay.marks
    .map((mark) => chordMarkHtml(mark, "formed"))
    .join("")}</g>`;

  for (const pos of state.cells) {
    const [x, y] = point(pos);
    const module = deployedAt(state, pos);
    const drop = dropRegister(app, pos);
    const label = module ? `${META[module.type].name} at ${cellNoteOf(pos)}` : `Empty cell · ${cellNoteOf(pos)}`;
    // A cell under a Mutator slot face (issue #298): the stylesheet hides
    // the empty chassis and its note beneath the live layer's own face,
    // so nothing ghosts through the slot's words.
    const covered = state.mutatorSlots.some((slot) => sameHex(slot, pos)) ? " mut-covered" : "";
    if (module) {
      html += `<g class="cell-node${covered}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${label}">`;
      html += moduleNode(app, module, pos, { snapshot, drop });
      html += `</g>`;
      continue;
    }
    // An empty owned cell reads as owned space — the dashed outline and
    // its note, no add-button plus or EMPTY CELL prompt. Only armed-mode
    // hints remain (board-redesign spec §7, #151); New cells stay the
    // purchase entry point. The chassis is translucent (#201) so the chord
    // work shows through, and the note centers on the cell (#172).
    let classes = "hex empty";
    if (drop) classes += ` ${dropClass(drop)}`;
    if (isTargetCell(app)) classes += " target";
    html += `<g class="cell-node${covered}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${label}">
      <polygon class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>
      <text y="0" dominant-baseline="central" text-anchor="middle" class="hex-note">${cellNoteOf(pos)}</text></g>`;
  }

  if (frontier.length > 0) {
    // The octave-row gate rides the quoted price (ADR-0022): a frontier hex
    // in a row whose one-time gate is unpaid carries the premium — the
    // same cellPurchasePrice seam the buy action charges.
    for (const pos of frontier) {
      const [x, y] = point(pos);
      const total = cellPurchasePrice(state, pos);
      const affordable = wholeNous(state) >= total;
      if (ui.buyingCell) {
        // The purchase arm (#201): one cost spot — the pill over the
        // board's top edge carries the single price, so the hexes drop
        // their stamped figures and keep a firm accent outline. The buy
        // lands only where clicked (ADR-0013); the accessible name keeps
        // the hex's own figure.
        html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Buy cell here for ${formatInt(total)} nous">
          <polygon class="hex ${affordable ? "buy-here" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
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
  // chord — these stay OVER the modules (the promise reads on top). They
  // wear the same seam language as the formed chords (brackets, runs,
  // note-corner polygons — #201), promising in the vocabulary the chord
  // will land in.
  html += `<g data-key="ghost-chords">${ghostMarksHtml(app, projected)}</g>`;

  // The Mutator Grid's drawing (issue #199): the second layer's slot faces
  // while the Mutators tab stands, the presence outlines while Modules
  // does — drawn over the faces, beneath the ghosts' register.
  html += mutGridDecorations(app, projected);

  updateSvg(svg, html);
  bindGridEvents(app, svg);
  bindFaceBuys(app, svg);
  bindMutatorLayer(app, svg);
  updateChordReadout(app);
}

// The spacer's open-wire window def (#201): the clip is the hex minus the
// window (evenodd), in user space — every spacer's face lives in its own
// cell's translated space (origin = the cell center), so one shared def
// serves them all. The frame rect rides the face markup (face.ts), two
// units clear of this opening.
const SPACER_WINDOW_DEFS = `<defs data-key="spacer-window"><clipPath id="spacer-window" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="${spacerClipPath()}"/></clipPath></defs>`;

// The selection lift (#201): the focused chords' marks draw a second time
// over the faces — the one loud pass a selection earns (ADR-0025). At rest
// the group is empty: the chords whisper in the gaps, never over a face.
// The wash rides the stylesheet (the loop polygon's translucent fill).
// ── The Row unlock's shaded rows (issue #197, #174's approved surface) ──
// In add-cell mode, each still-locked octave row just past the launch band
// renders shaded violet behind a single "Unlock this octave row · ⟨Arete⟩"
// banner — the unlock is one unit per row, cost over the whole thing, one
// click buying outright in upgrade mode. Only frontier-adjacent rows
// render at all, and the ladder holds exactly one row per side, so at most
// one banner above and one below can ever stand; past the ladder the board
// is at its six-row cap and nothing renders. The banner is inert outside
// upgrade mode by the engine's own gate — and it never renders before the
// first prestige, because no Arete surface is reachable before it.
interface RowBand {
  row: number;
  cost: number;
  affordable: boolean;
  hexes: Hex[];
}

function rowUnlockBands(state: GameState, rawFrontier: Hex[]): RowBand[] {
  const cost = rowUnlockCost(state);
  if (cost === null) return [];
  const bands: RowBand[] = [];
  for (const row of unlockableRows(state)) {
    const hexes = rawFrontier.filter((pos) => octaveRowOf(pos) === row);
    if (hexes.length === 0) continue;
    bands.push({ row, cost, affordable: state.arete >= cost, hexes });
  }
  return bands;
}

// One band's markup: the shaded hexes (the frontier cells that touch the
// row) with the banner label clamped to the owned board's span and
// anchored away from it — the raw band can span far more columns than the
// player's board, and the label belongs over the board it extends.
function rowBandHtml(state: GameState, bands: RowBand[], point: (pos: Hex) => [number, number]): string {
  if (bands.length === 0) return "";
  const owned = state.cells.map(point);
  const minX = Math.min(...owned.map(([x]) => x));
  const maxX = Math.max(...owned.map(([x]) => x));
  const boardCy = owned.reduce((a, [, y]) => a + y, 0) / owned.length;
  return bands
    .map((band) => {
      const pts = band.hexes.map(point);
      const hexes = pts
        .map(
          ([x, y]) =>
            `<polygon class="row-band-hex" points="${hexPoints(HEX_RADIUS)}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})"/>`,
        )
        .join("");
      const cx = Math.min(maxX, Math.max(minX, pts.reduce((a, [x]) => a + x, 0) / pts.length));
      const cy = pts.reduce((a, [, y]) => a + y, 0) / pts.length;
      const dir = cy < boardCy ? -1 : 1;
      const label = `Unlock this octave row · ${band.cost} Arete`;
      return `<g class="row-band">${hexes}<g class="row-unlock${band.affordable ? "" : " locked"}" data-unlock-row="${band.row}" role="button" tabindex="0" aria-label="${label}"><text class="row-unlock-label mono" x="${cx.toFixed(2)}" y="${(cy + dir * (HEX_RADIUS + 20)).toFixed(2)}">${label}</text></g></g>`;
    })
    .join("");
}

// One chord mark's markup (§6, the dense-board language #201): a
// two-voice chord seals its shared edge with bracket twins; a collinear
// chord draws one continuous twin line first voice to last; a chord the
// lines can't carry draws the note-corner polygon — rendered behind the
// modules so the work lives in the gaps and past the poking corners. The
// mark's hue rides `--cc` and its pulse period `--seam-dur`. Ghost marks
// preview would-form chords in the same vocabulary and wear their chip at
// the anchor, since the promise belongs where the chord would land.
// `keyPrefix` keeps the two layers' DOM keys apart.
function chordMarkHtml(mark: ChordMark, keyPrefix: "formed" | "ghost"): string {
  const ghost = keyPrefix === "ghost";
  const emphasis = ghost ? " ghost-mark" : mark.focused ? " chord-focus" : " chord-fade";
  // The idle candidate's mark (issue #258): dimmed and dotted, never
  // pulsing — it earns nothing, so it isn't live activity.
  const idle = mark.inactive ? " chord-idle" : "";
  // The muted participant's mark (ADR-0048): a chord a silent voice sings
  // in draws dashed — the standing language for silent and promised work.
  const style = `--cc:var(--${mark.colorVar});--seam-dur:${mark.duration}s`;
  const lines = mark.outline
    ? `<polygon class="chord-seam chord-loop${mark.muted ? " chord-muted" : ""}" points="${mark.outline.map((p) => p.join(",")).join(" ")}"/>`
    : mark.seams
        .map(
          (s) =>
            `<line class="chord-seam${ghost ? " ghost-seam" : ""}${mark.muted ? " chord-muted" : ""}" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`,
        )
        .join("");
  const chip = ghost
    ? `<rect class="chord-chip" x="${(mark.chipX - chipWidth(mark.label) / 2).toFixed(2)}" y="${(mark.chipY - 11.5).toFixed(2)}" width="${chipWidth(mark.label).toFixed(2)}" height="15" rx="4"/><text class="chord-label mono" x="${mark.chipX}" y="${mark.chipY}">${escapeHtml(mark.label)}</text>`
    : "";
  return `<g data-key="${keyPrefix}-${escapeHtml(mark.key)}" class="chord-mark${emphasis}${idle}"${ghost ? "" : ` data-chord="${escapeHtml(mark.key)}" data-voices="${escapeHtml(mark.voices.join(" "))}"`} style="${style}">${lines}${chip}</g>`;
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


// The reserved readout (§6): the chips, in one place — what the pointer
// rests on (a seam names its chord; a module names every chord it sings
// in). While a placement gesture hovers a valid target, the projection
// owns the spot (#260). A hovered oscillator's final ν/s leads the row —
// live during flow, present with no chord at all (ADR-0036). Only
// producers carry the figure: nothing else produces nous, and the Forge's
// progress-per-second is not ν/s. Hidden when nothing asks. HTML beside
// the board, so the Hex detail can never cover it and it never moves.
function updateChordReadout(app: App): void {
  const host = byId("chord-readout");
  if (!host) return;
  wireTooltips(host, app.signal);
  const cache = chordReadoutCache.get(app);
  const snapshot = cache?.snapshot;
  const hover = app.ui.chordHover;
  // The Mutator layer's ask (issue #199): the hovered slot's full
  // declaration — or the vacant slot's inert-until-a-host promise — in the
  // arete register. One spot, never floating over the board.
  if (hover?.kind === "mutator") {
    host.hidden = false;
    setReadoutHtml(host, mutatorAskHtml(app.state, hover.pos, snapshot ?? displayedRates(app.state, true)));
    return;
  }
  // The placement projection (issue #260): while a drop hovers a valid
  // target — a cell the register would take, or the tray under a carried
  // module — the gesture owns the reserved spot. The row is transient by
  // construction: it renders only while the hover lives, so cancel
  // restores whatever was standing.
  const preview = dropProjection(app);
  if (preview) {
    host.hidden = false;
    setReadoutHtml(host, placementPreviewHtml(app, preview));
    return;
  }
  const hovered =
    hover?.kind === "module" ? (app.state.modules.find((m) => m.id === hover.moduleId) ?? null) : null;
  // Every chord the module earns its bonus from — not just the first; the
  // conducting spacer's own containment rule rides moduleChips (#201).
  const chosen = chordChipsForHover(app);
  const focus = hovered;
  const metrics = focus && snapshot ? voiceMetricsHtml(focus, snapshot) : "";
  if (!metrics && chosen.length === 0) {
    host.hidden = true;
    setReadoutHtml(host, "");
    return;
  }
  host.hidden = false;
  setReadoutHtml(host, metrics +
    chosen
      .map((mark) =>
        // The muted participant's mark (ADR-0048): a chord a silent voice
        // sings in wears the same dashed treatment its seams carry. The
        // idle candidate's chip (issue #258) reads its own style and the
        // "idle" word — recognized, earning nothing.
        `<span class="chord-readout-chip mono${mark.muted ? " chord-readout-muted" : ""}${mark.inactive ? " chord-readout-idle" : ""}" style="--cc:var(--${mark.colorVar})">${escapeHtml(mark.inactive ? `${mark.label} · idle` : mark.label)}</span>`,
      )
      .join(""));
}

// Preserve focused/pinned disclosures when an unchanged readout refreshes.
const readoutMarkup = new WeakMap<HTMLElement, string>();
function setReadoutHtml(host: HTMLElement, html: string): void {
  if (readoutMarkup.get(host) === html) return;
  closeTooltips(host);
  host.innerHTML = html;
  readoutMarkup.set(host, html);
}

// Selected and projected voices share one figure grammar and disclosure layer.
// `idKey` scopes the disclosure's id — a surface hosting two rows (the
// reserved readout and the Hex detail's chord row) must never mint the
// same id twice (the ledger's portal rule).
function readoutDisclosureHtml(idKey: string, content: string, mechanics: string): string {
  const id = `${idKey}-tip`;
  return `<span class="inst-tip readout-tip"><button class="inst-tip-trigger readout-tip-trigger" type="button" aria-expanded="false" aria-describedby="${id}"${idKey.endsWith("quality") ? ` aria-label="${escapeHtml(mechanics)}"` : ""}>${content}</button><span class="inst-tip-body" id="${id}" role="tooltip">${escapeHtml(mechanics)}</span></span>`;
}

function readoutFigureHtml(idKey: string, text: string, mechanics: string): string {
  return readoutDisclosureHtml(idKey, `<span class="chord-readout-chip chord-readout-${idKey.replace(/^.*-/, "")} mono">${escapeHtml(text)}</span>`, mechanics);
}

function voiceMetricsHtml(module: ModuleInstance, snapshot: RateSnapshot, current?: RateSnapshot, idScope = "readout", withValue = true): string {
  if (!isVoiceType(module.type)) return "";
  const after = snapshot.contributions.get(module.id);
  const before = current?.contributions.get(module.id);
  const allocation = snapshot.allocation;
  const was = (value: number | null | undefined, unit: string): string =>
    value == null ? "" : ` — was ${unit}${formatNumber(value)}`;
  const rows: string[] = [];
  if (withValue && isOscillatorType(module.type)) rows.push(readoutFigureHtml(`${idScope}-value`, `+${formatNumber(after?.value ?? 0)} ν/s`, `Final ν/s${was(before?.value, "+")}`));
  if (allocation) {
    const prior = current?.allocation;
    rows.push(readoutFigureHtml(`${idScope}-capacity`, `Capacity ${allocation.used.get(module.id) ?? 0}/${allocation.capacity}`, `Whole-chord budget${prior ? ` — was ${prior.used.get(module.id) ?? 0}/${prior.capacity}` : ""}`));
    if (!allocation.certified) rows.push(`<span class="chord-readout-chip chord-readout-uncertified mono">Allocation uncertified</span>`);
  }
  if (after) {
    if (isOscillatorType(module.type) && after.chordFactor !== null) rows.push(readoutFigureHtml(`${idScope}-factor`, `×${formatNumber(after.chordFactor)}`, `Total chord factor${was(before?.chordFactor, "×")}`));
    if (after.formationQ !== 1) rows.push(readoutFigureHtml(`${idScope}-formation`, `Formation ×${formatNumber(after.formationQ)}`, `Applied formation term${was(before?.formationQ, "×")}`));
    if (after.formationMeasuredQ !== 1 || after.formationQ !== 1) rows.push(qualityScaleHtml(after.formationMeasuredQ, allocation ? ALLOCATION_QUALITY_BOUNDS : { floor: BALANCE.qualityFloor, cap: BALANCE.qualityCap }, `${idScope}-quality`));
  }
  return rows.join("");
}

// The Hex detail's chord row (issue #295): the opened voice's chord facts
// in the reserved readout's own grammar — capacity, total chord factor,
// formation and its scale, every chord instance it sings in — with the
// ν/s figure left off (the enlarged face carries it). The conducting
// spacer asks by containment, the same rule its hover reads (#201).
function detailChordRowHtml(app: App, snapshot: RateSnapshot): string {
  const detail = app.ui.detail;
  if (!detail) return "";
  const module = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, detail.pos));
  if (!module) return "";
  const idScope = `detail-${module.id}`;
  const marks = chordReadoutCache.get(app)?.marks ?? [];
  const metrics = voiceMetricsHtml(module, snapshot, undefined, idScope, false);
  const chips = moduleChips(module, marks)
    .map((mark) =>
      `<span class="chord-readout-chip mono${mark.muted ? " chord-readout-muted" : ""}${mark.inactive ? " chord-readout-idle" : ""}" style="--cc:var(--${mark.colorVar})">${escapeHtml(mark.inactive ? `${mark.label} · idle` : mark.label)}</span>`,
    )
    .join("");
  return metrics + chips;
}

// The low-to-high quality scale (issue #260): where the formation's
// measured Q sits between the floor and the cap — the chromatic end and
// the organized end, a taller tick at neutral. The marker is a firm inset
// bar (the instrument grammar's selected register), so the read survives
// greyscale; the figures ride the Formation chip and the tooltip.
function qualityScaleHtml(measured: number, bounds: { floor: number; cap: number }, idKey = "readout-quality"): string {
  const span = bounds.cap - bounds.floor;
  const at = (q: number): number => 14 + Math.min(1, Math.max(0, (q - bounds.floor) / span)) * 72;
  const x = at(measured);
  const neutral = at(1);
  const label = `Formation quality — ×${formatNumber(bounds.floor)} chromatic to ×${formatNumber(bounds.cap)} organized, ×1 neutral; this formation measures ×${formatNumber(measured)}`;
  return readoutDisclosureHtml(idKey, `<span class="chord-readout-scale" data-q="${measured}"><svg viewBox="0 0 100 20" width="100" height="20" aria-hidden="true"><line class="scale-track" x1="14" y1="6" x2="86" y2="6"/><line class="scale-tick" x1="14" y1="3" x2="14" y2="9"/><line class="scale-tick scale-tick-neutral" x1="${neutral.toFixed(1)}" y1="1" x2="${neutral.toFixed(1)}" y2="11"/><line class="scale-tick" x1="86" y1="3" x2="86" y2="9"/><rect class="scale-marker" x="${(x - 1.5).toFixed(1)}" y="2.5" width="3" height="7"/><text class="scale-end mono" x="14" y="18" text-anchor="middle">${formatNumber(bounds.floor)}</text><text class="scale-end mono" x="86" y="18" text-anchor="middle">${formatNumber(bounds.cap)}</text></svg></span>`, label);
}

// A delta figure for the preview rows (#260): explicit sign, monospace,
// rounding at the readout's own precision so a projected +0.0124 doesn't
// read as noise. Zero reads as an exact ±0.
function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 100) / 100;
  if (Math.abs(rounded) < 0.005) return "±0";
  return rounded > 0 ? `+${formatNumber(rounded)}` : `-${formatNumber(Math.abs(rounded))}`;
}

// The placement projection's row (issue #260): the moved voice's resulting
// figures — final ν/s, total chord factor, applied formation term and its
// scale, used/available capacity, the chord terms it would earn — each
// from the projected board, with the change against the current board in
// the tooltip and the board's own rate delta said outright. The retrieval
// reads the departure the same way. Every figure commits with the drop:
// the projection is the same authoritative pass placeModule lands in.
function placementPreviewHtml(app: App, projection: PlacementProjection): string {
  const hover = app.ui.dropHover!;
  const module = app.state.modules.find((m) => m.id === hover.moduleId)!;
  const retrieving = hover.pos === null;
  const allocation = projection.projected.allocation;
  const rateDelta = projection.projected.rate - projection.current.rate;
  const rows = [readoutFigureHtml("preview", `Placement ${formatDelta(rateDelta)} ν/s`, `${retrieving ? "Retrieved" : "Placed"}: the board reads ${formatNumber(projection.projected.rate)} ν/s after, ${formatNumber(projection.current.rate)} ν/s now`), voiceMetricsHtml(module, projection.projected, projection.current)];
  if (isVoiceType(module.type)) {
    // The chord terms the projected voice would earn — the same per-entry
    // chips the live row carries, active first, idle candidates labeled.
    const active = projection.projected.namedChords.filter((term) => term.moduleIds.includes(module.id));
    const idle = allocation ? idleTermsOf(allocation).filter((term) => term.moduleIds.includes(module.id)) : [];
    for (const [terms, idleTerm] of [
      [active, false],
      [idle, true],
    ] as const) {
      for (const term of terms) {
        const muted = term.moduleIds.some((id) => app.state.modules.find((m) => m.id === id && CATEGORY_OF[m.type] === "silentVoice"));
        rows.push(
          `<span class="chord-readout-chip mono${muted ? " chord-readout-muted" : ""}${idleTerm ? " chord-readout-idle" : ""}" style="--cc:var(--${CHORD_HUES[term.name] ?? "chord-octave"})">${escapeHtml(chordTermLabel(term))}${idleTerm ? " · idle" : ""}</span>`,
        );
      }
    }
  }
  return rows.join("");
}

// Every chord the module earns its bonus from — not just the first. A
// spacer sings in none: the wire asks by containment, the same rule its
// hover reads (#201).
const moduleChips = (module: ModuleInstance, marks: ChordMark[]): ChordMark[] =>
  module.type === "spacer" && module.pos !== null
    ? marks.filter((m) => chordMarkCovers(m, point(module.pos as Hex)))
    : marks.filter((m) => m.voices.includes(module.id));

// The chips a hover asks for: a seam names its one chord, a module names
// every chord it sings in. A mutator slot's ask never lands here — it
// takes the readout's whole row for itself.
function chordChipsForHover(app: App): ChordMark[] {
  const hover = app.ui.chordHover;
  if (!hover || hover.kind === "mutator") return [];
  const marks = chordReadoutCache.get(app)?.marks ?? [];
  if (hover.kind === "chord") return marks.filter((m) => m.key === hover.key);
  const module = app.state.modules.find((m) => m.id === hover.moduleId);
  return module ? moduleChips(module, marks) : [];
}

// The hover question (§6): what the pointer rests on. Null clears. Never a
// re-render — the readout updates in place.
function setChordHover(app: App, hover: ChordHover | null): void {
  if (app.released) return;
  const next = hover ?? null;
  if (sameChordHover(app.ui.chordHover, next)) return;
  app.ui.chordHover = next;
  updateChordReadout(app);
}

function sameChordHover(a: ChordHover | null, b: ChordHover | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "chord" && b.kind === "chord") return a.key === b.key;
  if (a.kind === "module" && b.kind === "module") return a.moduleId === b.moduleId;
  if (a.kind === "mutator" && b.kind === "mutator") return sameHex(a.pos, b.pos);
  return false;
}

interface RenderContext {
  snapshot: ReturnType<typeof computeRates>;
  // The live drop register over this cell (§5): amber for occupied, green
  // for open. Null away from the hover.
  drop: DropRegister | null;
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

function moduleNode(app: App, module: ModuleInstance, pos: Hex, ctx: RenderContext): string {
  const { state } = app;
  // Charge is session-bound: the snapshot is flow-gated, so any strength it
  // reports is live. Receivers brighten with their received strength, and a
  // generator lights only while it actually emits (a spent charge window
  // emits nothing).
  const strength = ctx.snapshot.chargeStrength.get(module.id) ?? 0;
  const charged = strength > 0;
  const emittingNow = state.mode === "flow" && isSource(module) && emittedStrength(state, module, true) > 0;

  let hexClass = "";
  if (charged) hexClass += " charged";
  if (emittingNow) hexClass += " dispensing";
  if (ctx.drop) hexClass += ` ${dropClass(ctx.drop)}`;

  const { readout, readoutClass, note } = faceReadoutFor(state, module, pos, ctx.snapshot);

  // The threshold-crossing flash fires for a moment after a module roll is
  // minted (reportAdvance sets it from the module queue alone) — the Mutator
  // Forge branch's flash lands with its own surface (issue #199).
  const crossed = module.type === "forge" && app.rollFlashUntil > Date.now();

  // The face button (issue #195): one per closed, levelable face, in
  // upgrade mode only — in flow it vanishes with the purchase furniture.
  const faceBuy = state.mode === "upgrade" && !app.ui.buyingCell && levelable(module) ? faceBuyHtml(app, module) : "";

  return `<g class="module-node${crossed ? " forge-crossed" : ""}" data-type="${module.type}" data-rarity="${module.rarity}">
    ${moduleFace({
      type: module.type,
      rarity: module.rarity,
      readout,
      ...(readoutClass ? { readoutClass } : {}),
      ...(note ? { note } : {}),
      level: faceLevel(module),
      hexClass: hexClass.trim(),
      // The spacer's board face is the open wire (#201): cap and base only,
      // the window between lets the chord work read through.
      ...(module.type === "spacer" ? { openWire: true } : {}),
      under: (() => {
        const branch = forgeBranchOf(state, module.type);
        return branch ? waterFill(module.id, branch.progress / branch.threshold) : "";
      })(),
      ...(charged ? { chargeGlow: chargeGlow(strength) } : {}),
    })}${faceBuy}
    </g>`;
}

// The face button (issue #195): one button per closed face, covering the
// bottom corner — a trapezoid that follows the hexagon's own taper (top
// edge inside the chassis, bottom corners just past the tip), so it reads
// as face furniture rather than an overlay, and the pitch note above stays
// readable. Click buys +1; a shift-click buys every affordable level — the
// click's own shift state is the source of truth — while holding shift
// flips every button's label and tooltip to MAX board-wide (ui.faceMax,
// the Cookie Clicker pattern) so the mode is visible before the click.
// Spacers wear none: a level buys the silent wire nothing (#193).
const FACE_BUY_POINTS = "-25,46 25,46 7,58 -7,58";

// The zero-affordable reads (#233, ADR-0045): the face button and the
// bloom's dial share the zero-state labels and the shortfall-leading
// tooltips, so the two surfaces can never drift apart.
function faceBuyHtml(app: App, module: ModuleInstance): string {
  const max = app.ui.faceMax;
  const bank = wholeNous(app.state);
  const levels = max ? affordableLevels(bank, module.level) : 1;
  const cost = max ? levelsCost(module.level, levels) : levelCost(module.level);
  const broke = bank < cost;
  // Zero reads zero (#233, ADR-0045): when nothing is affordable the label
  // says so — "+0" / "MAX·0" — and every unaffordable tooltip leads with the
  // shortfall. Nothing disables; a click still buys what the bank covers.
  const zero = zeroBuyRead(bank, levelCost(module.level));
  const zeroBuy = max ? levels === 0 : cost > bank;
  const label = zeroBuy ? (max ? zero.maxLabel : zero.plusLabel) : max ? "MAX" : "+1";
  const title = zeroBuy
    ? max
      ? zero.maxTip
      : zero.plusTip
    : max
      ? `MAX · buy ${levels} level${levels === 1 ? "" : "s"} · ${formatInt(cost)} ν`
      : `+1 level · ${formatInt(cost)} ν`;
  return `<g class="face-buy" data-key="face-buy" data-module="${module.id}" role="button" tabindex="0" aria-label="${title}">
    <polygon class="face-buy-btn${broke ? " broke" : ""}" points="${FACE_BUY_POINTS}"><title>${title}</title></polygon>
    <text y="54" text-anchor="middle" class="face-buy-label">${label}</text>
  </g>`;
}

// The face buttons bind once per node (the grid's keyed sync keeps them
// across renders, #115's economy): the click's own shift state decides
// +1 or MAX, and the stopPropagation keeps the gesture off the cell's
// selection, drags, and placement.
const boundFaceBuys = new WeakSet<Element>();

function bindFaceBuys(app: App, svg: SVGSVGElement): void {
  svg.querySelectorAll<SVGGElement>(".face-buy").forEach((node) => {
    if (boundFaceBuys.has(node)) return;
    boundFaceBuys.add(node);
    app.listen(node, "pointerdown", (event) => event.stopPropagation());
    const buy = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
      const id = node.getAttribute("data-module");
      if (!id || app.state.mode !== "upgrade" || app.ui.buyingCell) return;
      app.upgradeLevels(id, (event as KeyboardEvent).shiftKey ? "max" : 1);
    };
    app.listen(node, "click", buy);
    app.listen(node, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") buy(event);
    });
  });
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

/* ── The Upgrade All cluster (§7, issue #195) ──────── */

// The cluster's ladder — the shared +1 / +5 / +10 / MAX steps (issue #173's
// approved contract). The ×5/×10 steps and sweep pacing are provisional
// tuning.
const SWEEP_STEPS = [1, 5, 10] as const;

// One plain bold UPGRADE ALL label beside the quick-buy chips, docked at
// the board's lower edge. +N buys up to N levels on every module, cheapest
// modules first; MAX sweeps the globally cheapest next level until the
// bank can't cover one. Tray modules ride the sweeps (their only bulk
// path); spacers are excluded everywhere. Upgrade-mode-only furniture: in
// flow the host hides with the rest of the purchase furniture. The chips
// never disable — partial by design — and their tooltips carry the full-N
// cost previews; the toast reports what actually landed. When nothing is
// affordable, every tooltip gains the zero-read suffix (#233, ADR-0045):
// the shortfall to the cheapest next level on the board.
function renderUpgradeAll(app: App): void {
  const host = byId("upgrade-all");
  if (!host) return;
  const { state } = app;
  const eligible = state.modules.filter(levelable);
  const active = state.mode === "upgrade" && eligible.length > 0;
  host.hidden = !active;
  if (!active) return;
  // Rebuild only when the quoted numbers move (#115's economy): the chips
  // carry live previews, so a roster, level, or bank change re-quotes them.
  const key = JSON.stringify([wholeNous(state), eligible.map((m) => `${m.id}:${m.level}`)]);
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  const bank = wholeNous(state);
  const cheapest = Math.min(...eligible.map((m) => levelCost(m.level)));
  const zeroSuffix = bank < cheapest ? ` — buys 0: need ${formatInt(cheapest - bank)} ν more` : "";
  const chips = SWEEP_STEPS.map((n) => {
    const total = eligible.reduce((sum, m) => sum + levelsCost(m.level, n), 0);
    return `<button class="sweep-chip" data-sweep="${n}" title="+${n} on all ${eligible.length} modules · ${formatNumber(total)} ν (buys cheapest-first if broke)${zeroSuffix}">+${n}</button>`;
  }).join("");
  const max = upgradeAllPreview(state, "max");
  host.innerHTML = `
    <span class="sweep-label">UPGRADE ALL</span>
    ${chips}
    <button class="sweep-chip" data-sweep="max" title="Sweep the whole bank into the cheapest next levels: ~${max.levels} levels across ${max.modules} modules · ${formatNumber(max.spent)} ν${zeroSuffix}">MAX</button>`;
  host.querySelectorAll<HTMLButtonElement>("[data-sweep]").forEach((button) => {
    app.listen(button, "click", () => {
      const step = button.getAttribute("data-sweep")!;
      app.upgradeAllAction(step === "max" ? "max" : Number(step));
    });
  });
}

/* ── Live drop preview (§5–§6, #260) ─────────────────────────────────────
   While a drag crosses the board, or an armed placement hovers a cell, the
   target wears its drop register — amber over an occupied cell (a swap is
   coming), green over an open one — and the would-form ghosts draw as
   dashed hulls, one per forming chord, classified by the projected
   allocation (a ghost the capacity can afford promises earnings; one it
   would leave idle says so). The reserved readout carries the placement
   projection: the moved voice's resulting figures and the board's rate
   delta, all from the same authoritative pass that commits the drop. The
   hover itself lives in UiState; only the class/layer/readout refresh
   happens here, never a re-render. */

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
// confirmation. Null away from the hover, over the tray (the retrieval
// preview owns that read), in flow, or onto the carried module's own cell.
function dropRegister(app: App, pos: Hex): DropRegister | null {
  const hover = app.ui.dropHover;
  if (!hover || hover.pos === null || app.state.mode !== "upgrade") return null;
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
// hex, the ghost layer, and the reserved readout — never a full render.
// A retrieval (`retrieval` true, pos null) is the tray's hover: the drop
// would take the module off the board (#260).
function setDropHover(app: App, moduleId: string | null, pos: Hex | null, retrieval = false): void {
  if (app.released) return;
  app.ui.dropHover = moduleId !== null && (pos !== null || retrieval) ? { moduleId, pos } : null;
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
  if (hover && hover.pos !== null) {
    const register = dropRegister(app, hover.pos);
    if (register) {
      svg.querySelector(`[data-cell="${hover.pos.q},${hover.pos.r}"] .hex`)?.classList.add(dropClass(register));
    }
  }
  const layer = svg.querySelector('[data-key="ghost-chords"]');
  if (layer) layer.innerHTML = ghostMarksHtml(app);
  // The reserved readout carries the projection while the gesture lives;
  // cancel restores whatever row was standing (#260).
  updateChordReadout(app);
}

// ── The placement projection (issue #260) ──────────────────────────────
// The drop hover's one computation: the authoritative pass over the
// hypothetical board (economy.projectPlacement — the same allocation and
// economy calculation that commits the move), cached per hover target. A
// render clears it (any state change rides a render); the hover refresh
// and the readout recompute it on demand.
interface DropProjectionCache {
  moduleId: string;
  posKey: string;
  result: PlacementProjection;
}
const dropProjectionCache = new WeakMap<App, DropProjectionCache>();

function dropProjection(app: App): PlacementProjection | null {
  const hover = app.ui.dropHover;
  if (!hover || app.state.mode !== "upgrade") return null;
  const module = app.state.modules.find((m) => m.id === hover.moduleId);
  if (!module) return null;
  // Valid targets only: the combine register previews nothing (the twin's
  // review owns its own terms), and the carried module's own cell is a
  // no-op. Over the tray, only a live drag reads the retrieval.
  if (hover.pos !== null) {
    const register = dropRegister(app, hover.pos);
    if (register === null || register === "combine") return null;
  } else if (app.dragging !== hover.moduleId) {
    return null;
  }
  const posKey = hover.pos ? `${hover.pos.q},${hover.pos.r}` : "tray";
  const cached = dropProjectionCache.get(app);
  if (cached && cached.moduleId === hover.moduleId && cached.posKey === posKey) return cached.result;
  // Placement is upgrade-mode-only (the board locks in flow), so the
  // projection always reads the arranging basis the readout shows.
  const result = projectPlacement(app.state, hover.moduleId, hover.pos, false);
  dropProjectionCache.set(app, { moduleId: hover.moduleId, posKey, result });
  return result;
}

// The would-form ghost markup (§6): dashed hulls with name chips, one per
// chord the drop would newly form, drawn over the voices' would-be
// positions. What breaks is expressed by what disappears — breaking is
// never previewed. The render pass hands its projected snapshot over; the
// drag-hover path (no pass in flight) computes its own. The projection
// classifies each promise (#260): a chord the projected allocation would
// activate previews as the earning promise it is; one the capacity would
// leave idle says so — the dotted quiet register, "· idle" on its chip —
// so a full budget never promises earnings it cannot afford.
function ghostMarksHtml(app: App, projected?: RateSnapshot): string {
  const hover = app.ui.dropHover;
  if (!hover || app.state.mode !== "upgrade") return "";
  // A retrieval hovers no cell: nothing would form, only leave.
  if (hover.pos === null) return "";
  const module = app.state.modules.find((m) => m.id === hover.moduleId);
  if (!module) return "";
  // Voices and spacers conduct (ADR-0048); nothing else previews chords.
  if (!isVoiceType(module.type) && module.type !== "spacer") return "";
  // A combine offer previews no swap: the drop won't rearrange voices, it
  // will consume the twin under the pointer (issue #152).
  if (hover.pos !== null && dropRegister(app, hover.pos) === "combine") return "";
  // The diff runs on recognition (issue #258): a ghost promises a chord
  // the board will sing, active or idle — and the placement projection
  // (#260) says which, from the same authoritative allocation the commit
  // runs.
  const basis = projected ?? displayedRates(app.state, true);
  const current = basis.allocation ? summaryTermsOf(basis.allocation) : basis.namedChords;
  const preview = wouldFormPreview(app.state, hover.moduleId, hover.pos, 1 + activeBuildFactors(app.state).namedChordBonus);
  const newcomers = newChordTerms(current, preview.chords);
  if (newcomers.length === 0) return "";
  const allocation = dropProjection(app)?.projected.allocation;
  // The promise's honesty is per instance (#260): a newcomer class counts
  // as earning only when the projected allocation activates one of the
  // instances the drop adds — a retained instance (the class merely
  // doubling) leaves the new copy an idle promise.
  const currentActive = basis.allocation?.activeKeys;
  const activates = (chord: NamedChordTerm): boolean =>
    !allocation ||
    allocation.recognized.some(
      (instance) =>
        instance.name === chord.name &&
        instance.root === chord.root &&
        allocation.activeKeys.has(instance.key) &&
        !(currentActive?.has(instance.key) ?? false),
    );
  const promised = newcomers.filter(activates);
  const idleNewcomers = newcomers.filter((chord) => !activates(chord));
  if (promised.length === 0 && idleNewcomers.length === 0) return "";
  const deployedById = new Map(app.state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m]));
  const posOf = (id: string): Hex | null => (id === hover.moduleId ? hover.pos : preview.positions.get(id) ?? deployedById.get(id)?.pos ?? null);
  // The ghost's silent set: the deployed silent voices plus the dragged
  // module when it is one — the promise must read muted before it lands.
  const silentIds = new Set(
    app.state.modules.filter((m) => CATEGORY_OF[m.type] === "silentVoice").map((m) => m.id),
  );
  if (CATEGORY_OF[module.type] === "silentVoice") silentIds.add(module.id);
  const idleIdentities = new Set(idleNewcomers.map((chord) => `${chord.name}|${chord.root}`));
  const overlay = chordOverlay({
    namedChords: promised,
    inactiveChords: idleNewcomers,
    posOf,
    point,
    radius: HEX_RADIUS,
    step: LATTICE_STEP,
    labelFor: (chord) => chordTermLabel(chord) + (idleIdentities.has(`${chord.name}|${chord.root}`) ? " · idle" : ""),
    silentIds,
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
    app.listen(node, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        app.pickCell(position());
      }
    });
    app.listen(node, "click", () => app.pickCell(position()));
    app.listen(node, "contextmenu", (event) => {
      event.preventDefault();
      app.rightClickCell(position());
    });
    // The hover question rides the svg-level delegation (bindSeamHover):
    // resting on a module or a seam asks that chord into the readout.
    // The armed placement previews on hover (§5–§6): ghosts over the
    // would-form chords, the drop register over the hovered cell.
    app.listen(node, "pointerenter", () => {
      if (app.dragging || app.state.mode !== "upgrade") return;
      setDropHover(app, app.ui.placing, position());
    });
    app.listen(node, "pointerleave", () => {
      if (app.dragging || app.state.mode !== "upgrade") return;
      if (app.ui.dropHover?.pos != null && sameHex(app.ui.dropHover.pos, position())) setDropHover(app, null, null);
    });
    // Placement rides the pointer too (§5–§6): a touch press has no hover
    // phase before its tap, so pressing an open cell while a placement is
    // armed previews live as the finger slides, and the release places. A
    // quick tap still places on the click — nothing here fires before the
    // drag threshold.
    app.listen(node, "pointerdown", (baseEvent: Event) => {
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
      let finished = false;
      let forget = () => {};
      const finish = (ev?: PointerEvent, apply = false) => {
        if (finished) return;
        finished = true;
        forget();
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", cancel);
        const pos = ev ? cellAt(ev) : null;
        setDropHover(app, null, null);
        if (app.released || !apply || !previewing) return;
        app.suppressClick();
        if (pos) app.pickCellThenPlace(id, pos);
      };
      const up = (ev: PointerEvent) => finish(ev, true);
      const cancel = (ev: PointerEvent) => finish(ev, false);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
      forget = app.ownCleanup(() => finish());
    });
    bindPointerDrag(app, node, () => deployedAt(app.state, position())?.id ?? null);
  });
  // The Row unlock's banner (issue #197): one click buys the row outright —
  // the engine owns the mode gate and the refusal wording, so an inert or
  // unaffordable banner answers plainly instead of looking dead.
  svg.querySelectorAll<SVGElement>("[data-unlock-row]").forEach((node) => {
    if (boundBanners.has(node)) return;
    boundBanners.add(node);
    const row = () => Number(node.getAttribute("data-unlock-row"));
    app.listen(node, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        app.buyRowUnlockAction(row());
      }
    });
    app.listen(node, "click", () => app.buyRowUnlockAction(row()));
  });
  bindSeamHover(app, svg);
}

// The grid never replaces its svg across renders, so the chord-hover
// question binds once, delegating: over a Mutator slot, that mutator's
// declaration (issue #199); over a chord's seam, that chord; over a module
// cell, every chord the module sings in; anywhere else, none. Ghost marks
// never answer — they promise chords that don't exist yet.
const boundGrids = new WeakSet<SVGSVGElement>();

function bindSeamHover(app: App, svg: SVGSVGElement): void {
  if (boundGrids.has(svg)) return;
  boundGrids.add(svg);
  app.listen(svg, "pointerover", (event) => {
    if (app.dragging || app.ui.mutCarrying) return;
    const target = event.target as Element;
    const slotNode = target.closest?.("[data-mut-slot]");
    if (slotNode) {
      const pos = hexFromAttr(slotNode.getAttribute("data-mut-slot"));
      if (pos) {
        setChordHover(app, { kind: "mutator", pos });
        return;
      }
    }
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
  app.listen(svg, "pointerleave", () => {
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
  app.listen(element, "pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || app.state.mode !== "upgrade" || app.ui.buyingCell) return;
    const id = typeof moduleId === "function" ? moduleId() : moduleId;
    if (!id) return;
    let hoverTarget: Element | null = null;
    const zone = document.getElementById("inventory-zone");
    // The phone tray sheet doubles as the drag target while it stands
    // (issue #272 review): dropping a board module onto the open sheet
    // retrieves, the same chord-breaking gesture the column takes.
    const overSheet = (ev: PointerEvent): Element | null => {
      if (app.ui.modal !== "inventory") return null;
      return document.elementFromPoint(ev.clientX, ev.clientY)?.closest("#modal-content") ?? null;
    };

    const setHoverTarget = (ev: PointerEvent) => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const cellNode = hit?.closest("[data-cell]") ?? null;
      const overZone = !!hit?.closest("#inventory-zone");
      const sheet = overSheet(ev);
      zone?.classList.toggle("drag-over", overZone);
      sheet?.classList.toggle("drag-over", !overZone);
      if (cellNode !== hoverTarget) {
        hoverTarget = cellNode;
        const [q, r] = (hoverTarget?.getAttribute("data-cell") ?? "").split(",").map(Number);
        const pos = Number.isFinite(q) && Number.isFinite(r) ? { q: q!, r: r! } : null;
        // Over the tray the drop retrieves (#260): the hover reads the
        // removal's projection instead of a cell's.
        setDropHover(app, id, pos, overZone);
      }
      if (!cellNode) setDropHover(app, id, null, overZone);
    };

    startPointerDrag(app, event, {
      start: () => {
        app.dragging = id;
        const module = app.state.modules.find((m) => m.id === id);
        const ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        if (module) ghost.dataset.rarity = module.rarity;
        ghost.innerHTML = module
          ? inventoryTileSvg(module)
          : `<svg viewBox="-75 -75 150 150" aria-hidden="true"><polygon class="hex" points="${hexPoints(HEX_RADIUS)}"/></svg>`;
        element.classList.add("dragging");
        return ghost;
      },
      move: setHoverTarget,
      cleanup: () => {
        app.dragging = null;
        element.classList.remove("dragging");
        hoverTarget = null;
        setDropHover(app, null, null);
        setChordHover(app, null);
        zone?.classList.remove("drag-over");
        document.getElementById("modal-content")?.classList.remove("drag-over");
      },
      drop: (ev) => {
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
          return;
        }
        if (overSheet(ev)) {
          app.returnToInventory(id);
        }
      },
    });
  });
}

/* ── Board tray (§5, ADR-0027 as amended) ──────────── */

// The tray column's Modules face (§5, ADR-0027 as amended, issue #272):
// the inventory as an always-open pinned column at the board's right edge —
// no collapse toggle, no gesture-reopen, no second switch (the board tabs
// drive the face), and the Mutators face swaps in while that layer stands.
// Flow hides the column with the locked board, and portrait phone replaces
// it with the tray sheet (the stylesheet unfolds the column there).
// Retrieve by dropping a module into the face, place by clicking an item
// then a cell (occupied placement swaps).
function renderInventoryTray(app: App): void {
  const tray = byId("inventory-zone");
  if (!tray) return;
  const { state, ui } = app;
  const open = state.mode === "upgrade" && ui.mutLayer === "modules";
  tray.classList.toggle("off", !open);
  const inventory = state.modules.filter((m) => m.pos === null);
  const key = JSON.stringify(inventory.map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}`));
  if (tray.dataset.renderKey === key) return;
  tray.dataset.renderKey = key;
  tray.innerHTML = `<div class="tray-items">${
    inventory
      .map(
        (m) =>
          `<button class="inventory-tile" data-inv="${m.id}" data-rarity="${m.rarity}" data-type="${m.type}" title="${META[m.type].name} · ${RARITY_LABEL[m.rarity]} — click, then a cell">${inventoryTileSvg(m)}</button>`,
      )
      .join("") || `<span class="tray-empty">drag a module here to store it</span>`
  }</div>`;
  tray.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach((button) => {
    const id = button.getAttribute("data-inv")!;
    app.listen(button, "click", () => app.beginPlacing(id));
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
  app.listen(document.getElementById("arc-card-dismiss"), "click", () => app.dismissArcCard());
}

/* ── The Notes popover (§9; the sheet's own frame is #277's) ── */

// The habit-keyed chip (§9): a tagged note wears its habit, resolved at
// render — renames and archiving never rewrite the stream. Untagged notes
// (unstructured, between sessions) wear none.
function habitChipHtml(state: GameState, note: NoteEntry): string {
  return note.habitId !== null ? `<span class="habit-chip">${escapeHtml(habitRecordName(state, note.habitId))}</span>` : "";
}

// The notes body (§9): the composer over the full stream — everything kept,
// newest first, no cap on what is shown, matching the engine's no-pruning
// rule. #277 resolves it into the Focus frame's tabbed sheet.
function notesPanelBody(app: App): string {
  const { state } = app;
  const stream = [...state.notes].reverse();
  return `<section class="focus-controls">
    <textarea class="note-composer" id="note-composer" placeholder="What are you noticing?" maxlength="2000" rows="3"></textarea>
    <div class="session-actions" style="margin:10px 0 0"><button class="primary" id="note-save">Capture note</button></div>
    ${stream.length > 0 ? `<div class="note-list">${stream.map((n) => `<div class="note-entry"><span class="note-when mono">${noteStampHtml(n)}</span>${habitChipHtml(state, n)}<p>${escapeHtml(n.text)}</p></div>`).join("")}</div>` : ""}
  </section>`;
}

// The notes popover's bindings: capture rides the button and ⌘/Ctrl+Enter,
// and a successful save refocuses the fresh composer.
function bindAppPanel(app: App, scope: HTMLElement): void {
  const composer = scope.querySelector("#note-composer") as HTMLTextAreaElement | null;
  const saveNote = () => {
    if (!composer) return;
    app.addNote(composer.value);
    // A successful save rebuilds the panel with a fresh composer; refocus it.
    const fresh = scope.querySelector("#note-composer") as HTMLTextAreaElement | null;
    if (fresh) fresh.focus();
  };
  app.listen(scope.querySelector("#note-save"), "click", saveNote);
  app.listen(composer, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter" && ((event as KeyboardEvent).metaKey || (event as KeyboardEvent).ctrlKey)) {
      event.preventDefault();
      saveNote();
    }
  });
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
  // inside itself. The mutator review obeys the same rule (issue #199).
  if (app.ui.modal === "combine" && combineOfferTerms(app) === null) {
    app.ui.modal = null;
    app.ui.combineOffer = null;
  }
  if (app.ui.modal === "mutcombine" && mutCombineOfferTerms(app) === null) {
    app.ui.modal = null;
    app.ui.mutCombineOffer = null;
  }
  const kind = app.ui.modal;
  if (!kind) {
    backdrop.hidden = true;
    backdrop.classList.remove("sheet");
    backdrop.classList.remove("peek");
    document.body.classList.remove("modal-sheet-open");
    delete content.dataset.renderKey;
    // A pinned tooltip's body lives at document body level (instrument.ts's
    // portal), so hiding the sheet would otherwise leave it floating over
    // the board — the close puts every tooltip of the sheet away with it.
    closeTooltips(content);
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
  backdrop.setAttribute("aria-modal", kind === "forge" || kind === "inventory" ? "false" : "true");
  document.body.classList.toggle("modal-sheet-open", sheet);
  const extra =
    kind === "forge"
      ? [app.state.bankedRolls.at(-1)?.id ?? null, app.state.bankedMutatorRolls.at(-1)?.id ?? null]
      : kind === "honesty"
        ? [app.exitPending, app.state.session?.accounting.poolSeconds ?? 0, app.state.session?.accounting.bucketNous ?? 0]
        : kind === "summary"
          // The summary's identity: a fresh session's summary must never
          // reuse the previous one's already-rendered content. The rolls
          // line's split rides along — it is captured at close with the rest.
          ? [app.state.summary?.sessionNumber ?? null, app.state.summary?.earned ?? null, app.state.summary?.rollsFlow ?? 0, app.state.summary?.rollsForge ?? 0, app.state.summary?.rollsMutator ?? 0]
            : kind === "catalog"
              ? [
                  // The tabbed shop's own identity (issue #271): the face,
                  // the balance, and every owned flag. The mode rides
                  // modalKey, so entering or leaving flow re-renders the
                  // muted button states.
                  app.ui.catalogFace,
                  app.ui.showAcquired,
                  wholeNous(app.state),
                  JSON.stringify(app.state.purchased),
                  app.state.cellsBought,
                  app.state.activatedApps.join("|"),
                  // The capacity ladder's owned state (issue #259): the row's
                  // figure, price, and capped word re-read with the ladder.
                  app.state.capacityBought,
                  app.state.capacityCeilings,
                  app.state.capacityDiscounts,
                  // Module-upgrade rows reprice with levels, moves, and the roster.
                  app.state.modules.map((m) => `${m.id}:${m.level}:${m.rarity}:${m.pos ? "d" : "i"}`).join("|"),
                  app.state.arete,
                  app.state.catalogEntryOwned,
                  app.state.rollPoolJoined,
                  app.state.horizonBroken,
                ]
              : kind === "achievements"
                // Quantized progress: an open page refreshes when a bar visibly
                // moves, not on every clock tick.
                ? achProgressKey(app, projected)
                // The library's own ledger signature (issue #230): a discovery
                // or a new root re-renders the sheet — as does the live
                // instance tally (#278): a class flipping active/idle or
                // stacking another instance rebuilds, and so does the stage
                // selection.
                : kind === "library"
                  ? [app.ui.chordStage, discoveryKey(app.state), instancesKeyOf(instancesByClass(live.namedChords))]
                // The launcher's rows read both ledgers' counts (issue #270).
                : kind === "collection"
                  ? [unlockedCount(app.state), discoveryCount(app.state)]
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
                  ? [deployedRosterKey(app.state), unlockedCount(app.state), discoveryCount(app.state)]
                : kind === "inventory"
                  ? [
                      app.state.modules.filter((m) => m.pos === null).map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}`),
                      // The tray sheet's face rides the global switch, and
                      // the Mutators face re-reads the tray (issue #272).
                      // The entry's ownership rides too: the purchase
                      // unlocks the switch's locked face (issue #273).
                      app.ui.mutLayer,
                      app.state.catalogEntryOwned,
                      app.state.mutators.filter((m) => m.pos === null).map((m) => `${m.id}:${m.family}:${m.rarity}`),
                    ]
                  // The combine review's identity: the offered pair (issue
                  // #152). The terms are read fresh on rebuild.
                  : kind === "combine"
                    ? [app.ui.combineOffer?.dragId ?? null, app.ui.combineOffer?.targetId ?? null]
                    : kind === "mutcombine"
                      ? [app.ui.mutCombineOffer?.dragId ?? null, app.ui.mutCombineOffer?.targetId ?? null]
                      : null;
  const renderKey = modalKey(app, kind, extra);
  // Clock ticks must not replace a save textarea or steal dialog focus.
  if (!backdrop.hidden && content.dataset.renderKey === renderKey) {
    // The rate sheet's figures ride the same live slots the popover fills:
    // the tick fills them in place on this no-rebuild path, so an expanded
    // row survives the clock (ADR-0037). The Forge meters do the same —
    // the detail stays live during flow (ADR-0041).
    if (kind === "rate") updateRateDetailsLive(content, app.state, live);
    if (kind === "forge") updateForgeMetersLive(content, app.state, projected.forgeRate, projected.mutatorForgeRate);
    return;
  }
  backdrop.hidden = false;
  content.dataset.renderKey = renderKey;
  // The catalog is the one fixed-frame sheet (issue #271): the class swaps
  // the free modal box for the 620×600 clipped panel (74vh phone sheet).
  content.classList.toggle("catalog-modal", kind === "catalog");
  // The tray sheet is the one scrimless modal (issue #272 review): the
  // board behind stays visible, clickable, and draggable-through — the
  // sheet is a docked panel, never a blocking dialog. The backdrop keeps
  // its class fresh so another kind's scrim returns.
  backdrop.classList.toggle("peek-tray", kind === "inventory");
  if (kind === "settings") renderSettingsModal(app, content);
  else if (kind === "catalog") renderCatalogModal(app, content);
  else if (kind === "forge") renderForgeModal(app, content, projected);
  else if (kind === "achievements") renderAchievementsModal(app, content, projected);
  else if (kind === "library") renderLibraryModal(app, content, live);
  else if (kind === "collection") renderCollectionModal(app, content);
  else if (kind === "export") renderExportModal(app, content);
  else if (kind === "import") renderImportModal(app, content);
  else if (kind === "reset") renderResetModal(app, content);
  else if (kind === "prestige") renderPrestigeModal(app, content);
  else if (kind === "honesty") renderHonestyModal(app, content);
  else if (kind === "enter") renderEnterModal(app, content);
  else if (kind === "summary") renderSummaryModal(app, content);
  else if (kind === "rate") renderRateModal(app, content, live);
  else if (kind === "inventory") renderInventorySheetModal(app, content);
  else if (kind === "combine") renderCombineModal(app, content);
  else if (kind === "mutcombine") renderMutCombineModal(app, content);
  const firstButton = content.querySelector("button:not([disabled])");
  (firstButton as HTMLElement | null)?.focus();
}

// The rate sheet (§7): the module-linked rate details — the total plus one
// row per synthesizer and the other modules' effects — as a modal sheet
// over a scrim below the 760px breakpoint, opened by tapping the Rate cell
// or the strip's rate read at every width. The same roster the Rate cell's
// hover popover owns above the breakpoint, built the same way: live slots
// the tick fills, so an expanded row survives the clock. The surface
// carries no header of its own — the eyebrow names it and the roster
// speaks (the instrument standards' identity rule) — and a synthesizer
// row's tap closes the sheet and selects the module, so the answer lands
// on the board it names.
function renderRateModal(app: App, content: HTMLElement, live: RateSnapshot): void {
  // The same basis every rate figure wears — live during flow, projected
  // while arranging — so the sheet can never disagree with the ledger it
  // discloses.
  const snapshot = live;
  content.innerHTML = `
    ${modalTop("RATE", "modal-title")}
    <div class="rate-details-sheet">${rateDetailsHtml(app.state, snapshot, true, "sheet")}</div>`;
  updateRateDetailsLive(content, app.state, snapshot);
  const sheet = content.querySelector(".rate-details-sheet");
  if (sheet) {
    wireSynthPicks(sheet, (id) => {
      app.closeModal();
      app.openModuleDetail(id);
    }, app);
    wireTooltips(sheet, app.signal);
  }
  wireClose(app);
}

// The tray sheet (§7, issue #272 review): the tray column, re-docked for
// touch on portrait phone where the thumb bar's Inventory segment taps it
// open. Dual-face under the same Modules / Mutators switch the board tabs
// carry — the sheet's toggle flips the global mode — wearing the
// minimal-mark tiles and the same gestures: tap a tile then a cell or
// slot places (the sheet puts away so the board is visible), a live drag
// carries between board and sheet in both directions, occupied targets
// swap. No how-to prose: the tiles and the gestures are the
// instructions. Gated with the dock (#193): in flow the board is locked,
// so the sheet reads but never arms.
// Disclosure has its own touch target so inspecting a tile never arms placement.
function trayTileDisclosure(id: string, name: string, mechanics: string): string {
  return `<button class="inst-tip-trigger" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="About ${escapeHtml(name)}">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${escapeHtml(name)} · ${escapeHtml(mechanics)}</span>`;
}

function renderInventorySheetModal(app: App, content: HTMLElement): void {
  const { state, ui } = app;
  const locked = state.mode !== "upgrade";
  const wanted = mutatorLayerWanted(app);
  const mutators = wanted && ui.mutLayer === "mutators";
  const inventory = state.modules.filter((m) => m.pos === null);
  const mutTray = wanted ? state.mutators.filter((m) => m.pos === null) : [];
  const face = mutators
    ? `<div class="inventory-sheet-grid tray-sheet-tiles">${
        mutTray
          .map(
            (item) =>
              `<span class="inst-tip tray-tile-detail"><button class="inventory-tile mut-tile" data-mut-tray="${item.id}" data-rarity="${item.rarity}"${locked ? " disabled" : ""} aria-label="${FAMILY_WORD[item.family]} · ${RARITY_LABEL[item.rarity]}" aria-describedby="tray-mut-${item.id}">${mutatorTileSvg(item)}</button>${trayTileDisclosure(`tray-mut-${item.id}`, FAMILY_WORD[item.family], `${RARITY_LABEL[item.rarity]} · ${mutatorEffectText(item.family, item.rarity)} — ${locked ? "locked during flow" : "tap, then a slot"}`)}</span>`,
          )
          .join("") || `<span class="tray-empty">minted mutators wait here</span>`
      }</div>`
    : `<div class="inventory-sheet-grid">${
        inventory
          .map(
            (m) =>
              `<span class="inst-tip tray-tile-detail"><button class="inventory-tile" data-inv="${m.id}" data-rarity="${m.rarity}" data-type="${m.type}"${locked ? " disabled" : ""} aria-label="${META[m.type].name} · ${RARITY_LABEL[m.rarity]}" aria-describedby="tray-module-${m.id}">${inventoryTileSvg(m)}</button>${trayTileDisclosure(`tray-module-${m.id}`, META[m.type].name, `${RARITY_LABEL[m.rarity]} — ${locked ? "locked during flow" : "tap, then a cell"}`)}</span>`,
          )
          .join("") || `<span class="tray-empty">drag a module here to store it</span>`
      }</div>`;
  content.innerHTML = `
    ${modalTop("INVENTORY", "modal-title")}
    ${state.mode === "upgrade" ? `<div class="layer-legend tray-switch" role="group" aria-label="Tray face">${layerLegendHtml(app, "sheet-mutator-entry")}</div>` : ""}
    ${face}`;
  content.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach((button) => {
    const id = button.getAttribute("data-inv")!;
    app.listen(button, "click", () => {
      if (app.state.mode !== "upgrade") return;
      app.closeModal();
      app.beginPlacing(id);
    });
    bindPointerDrag(app, button, id);
  });
  content.querySelectorAll<HTMLButtonElement>("[data-mut-tray]").forEach((button) => {
    const id = button.getAttribute("data-mut-tray")!;
    app.listen(button, "click", () => {
      if (app.state.mode !== "upgrade") return;
      app.closeModal();
      app.mutArmTray(id);
    });
    bindMutatorDrag(app, button, id, "tray");
  });
  content.querySelectorAll<HTMLButtonElement>("[data-legend-layer]").forEach((button) => {
    app.listen(button, "click", () => {
      const layer = button.getAttribute("data-legend-layer") as "modules" | "mutators";
      // The sheet can stand over the Hex detail; the switch reads which
      // surface it serves, exactly like the legend strip does.
      if (app.ui.detail) app.detailFace(layer);
      else app.mutSetLayer(layer);
    });
  });
  const grid = content.querySelector(".inventory-sheet-grid");
  if (grid) wireTooltips(grid, app.signal);
  const switchHost = content.querySelector(".tray-switch");
  if (switchHost) wireTooltips(switchHost, app.signal);
  wireClose(app);
}

// The modal head's one row: the eyebrow that names the surface and the ✕
// that puts it away. `titleId` hands the accessible name to the eyebrow
// for surfaces that carry no other heading — the backdrop's
// aria-labelledby points there. A null label skips the eyebrow: a surface
// whose readout is its header (the chord sheet's `Chords (4/11) (+4% ν)`,
// #278) carries no duplicated identity beside it. `backLabel` mounts the
// launcher's return control (issue #270) ahead of the eyebrow: on phone
// the feats and chords sheets sit behind a "‹ Collection" door, and the
// tap walks back one level instead of closing everything.
function modalTop(label: string | null, titleId?: string, backLabel?: string): string {
  const eyebrow = label ? `<span class="eyebrow"${titleId ? ` id="${titleId}"` : ""}>${label}</span>` : "";
  const lead = backLabel
    ? `<button class="modal-back" id="modal-back">‹ ${backLabel}</button>${eyebrow}`
    : eyebrow;
  return `<div class="modal-top"><span class="modal-lead">${lead}</span><button id="close-modal" aria-label="Close dialog">✕</button></div>`;
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
  app.listen(byId("combine-cancel"), "click", () => app.closeModal());
  app.listen(byId("combine-confirm"), "click", () => app.confirmCombine());
  wireClose(app);
}

function wireClose(app: App): void {
  app.listen(byId("close-modal"), "click", () => app.closeModal());
}

// The mutator combine review's terms (issue #199), read fresh: null
// whenever the offer is gone or its pair can no longer combine — mode
// flipped, a twin taken — so a dead offer can never reach the dialog's
// markup. Mutators carry no levels, so the terms are two rows.
function mutCombineOfferTerms(
  app: App,
): { drag: MutatorInstance; target: MutatorInstance; nextRarity: Rarity } | null {
  const offer = app.ui.mutCombineOffer;
  const drag = offer ? app.state.mutators.find((m) => m.id === offer.dragId) : undefined;
  const target = offer ? app.state.mutators.find((m) => m.id === offer.targetId) : undefined;
  if (!offer || !drag || !target) return null;
  const preview = combineMutatorsPreview(app.state, offer.dragId, offer.targetId);
  return preview ? { drag, target, nextRarity: preview.nextRarity } : null;
}

// The mutator combine review (issue #199): the drop-and-confirm gesture's
// second-layer voice — resulting rarity and family, the no-levels rule
// said plainly, and the destination. Cancel (button, ✕, backdrop, Esc)
// lands in closeModal and leaves both copies untouched; confirm performs
// the combine and the result lands where the drop target was.
function renderMutCombineModal(app: App, content: HTMLElement): void {
  const { drag, target, nextRarity } = mutCombineOfferTerms(app)!;
  const tile = (item: MutatorInstance): string =>
    `<span class="mut-combine-tile">${mutatorTileSvg(item)}<small>${FAMILY_WORD[item.family]} · ${RARITY_LABEL[item.rarity]}</small></span>`;
  const destination =
    target.pos === null ? "The combined mutator waits in the Mutator tray." : `The combined mutator holds the ${cellNoteOf(target.pos)} slot.`;
  content.innerHTML = `
    ${modalTop("COMBINE MUTATORS")}
    <h2 id="modal-title">Combine these two?</h2>
    <p class="lead mut-combine-pair">${tile(drag)} <b>+</b> ${tile(target)}</p>
    <div class="combine-terms">
      <div class="stat-row"><span>Resulting rarity</span><span class="mono">${RARITY_LABEL[nextRarity]}</span></div>
      <div class="stat-row"><span>Family</span><span class="mono">${FAMILY_WORD[drag.family]}</span></div>
    </div>
    <p class="lead muted">Mutators carry no levels — nothing is retained or refunded.</p>
    <p class="lead muted">${destination}</p>
    <div class="modal-actions">
      <button id="mut-combine-cancel">Keep both</button>
      <button id="mut-combine-confirm" class="primary">Combine</button>
    </div>`;
  app.listen(byId("mut-combine-cancel"), "click", () => app.closeModal());
  app.listen(byId("mut-combine-confirm"), "click", () => app.confirmMutCombine());
  wireClose(app);
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
  app.listen(byId("pref-mute"), "change", (event) => {
    app.setMuted((event.target as HTMLInputElement).checked);
  });
  for (const kind of ["export", "import", "reset"] as const) {
    app.listen(byId(`settings-${kind}`), "click", () => app.openModal(kind));
  }
  wireClose(app);
}

// The upgrade-mode countdown for a price on this board: phrased against the
// board's projected next-session rate (the charged preview, whatever the
// current mode); null (hidden) when affordable or rateless.
function upgradeCountdown(app: App, cost: number): string | null {
  return practiceCountdown(cost, wholeNous(app.state), displayedRates(app.state, true).rate);
}

// The harmonic-capacity row (issue #259, the confirmed design beside
// ADR-0050): the nous Catalog's global ladder, the game's production path
// since the release calibration (#262). Bought, unavailable and capped
// states ride the shop row's own grammar: the per-voice figure reads the
// ladder's progress, the disabled price carries the practice-minute
// estimate, and the capped word points at the Arete sheet while its
// ceiling unlocks remain.
function capacityShopHtml(app: App): string {
  const { state } = app;
  const capacity = voiceCapacityOf(state);
  const ceiling = capacityCeiling(state);
  const price = nextCapacityPrice(state);
  const discount = capacityDiscountShare(state);
  const upgrade = state.mode === "upgrade";
  const off = discount > 0 ? ` (${Math.round(discount * 100)}% off)` : "";
  const buy = price === null
    ? `<span class="shop-buy"><span class="st-acquired">${capacityCeilingsLeft(state) ? "capped" : "complete"}</span></span>`
    : catalogPriceHtml({
        attrs: `data-buy-capacity="1"`,
        price,
        affordable: wholeNous(state) >= price,
        hold: !upgrade,
        countdown: upgrade ? upgradeCountdown(app, price) : null,
      });
  const note = price === null
    ? capacityCeilingsLeft(state)
      ? `<small class="shop-countdown">The ceiling stands — the Arete Catalog sells the next rung.</small>`
      : ""
    : "";
  const mechanics = `Every current and future voice gains one whole-chord unit per purchase; levels and rarity stay distinct. Prestige returns capacity to one.${price === null ? "" : ` Spend ${formatInt(price)} ν${off}. Purchases happen between sessions.`}`;
  return `
    <section class="capacity-catalog">
      <div class="catalog-rows">
        <div class="catalog-row">
          <div><h3 class="t-condensed">Harmonic capacity <span class="mono">${capacity}/${ceiling}</span> ${capacityTooltipHtml("capacity-tip", "Harmonic capacity mechanics", mechanics)}</h3><small>+1 whole chord per voice</small>${note}</div>
          ${buy}
        </div>
      </div>
    </section>`;
}

// Independent disclosure stays reachable when the purchase is unavailable.
function capacityTooltipHtml(id: string, label: string, mechanics: string): string {
  return `<span class="inst-tip"><button class="inst-tip-trigger" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="${label}">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${mechanics}</span></span>`;
}

// Whether the Arete sheet can still raise the capacity ceiling: the shared
// read behind the capped row's pointer and the sheet's own rows.
function capacityCeilingsLeft(state: GameState): boolean {
  return nextCeilingPrice(state) !== null;
}

function capacityAreteHtml(app: App): string {
  const { state } = app;
  const ceilings = state.capacityCeilings;
  const discounts = state.capacityDiscounts;
  const offeringBuy = (id: string, price: number, owned: boolean, locked: boolean, ownedWord: string): string =>
    owned
      ? areteOwnedWord(ownedWord)
      : locked
        ? `<span class="shop-buy"><button class="primary arete" id="${id}" disabled>After the first</button></span>`
        : areteBuyButtonHtml(app, id, price);
  return `
    <section class="capacity-catalog"><h2 class="t-condensed">Harmonic capacity</h2>
    <div class="catalog-rows">
      <div class="catalog-row${ceilings > 0 ? " owned" : ""}">
        <div><h3 class="t-condensed">First ceiling <span class="kind">capacity four</span> ${capacityTooltipHtml("ceiling-1-tip", "First ceiling mechanics", "Permanently lets the nous ladder sell one rung further. Survives prestige.")}</h3><small>The nous ladder sells one rung further.</small></div>
        ${offeringBuy("buy-capacity-ceiling-1", BALANCE.capacityCeilingCosts[0]!, ceilings > 0, false, "raised")}
      </div>
      <div class="catalog-row${ceilings > 1 ? " owned" : ""}">
        <div><h3 class="t-condensed">Second ceiling <span class="kind">capacity five</span> ${capacityTooltipHtml("ceiling-2-tip", "Second ceiling mechanics", "Own the first ceiling first. Permanently adds one rung beyond the first unlock. Survives prestige.")}</h3><small>One rung past the first unlock.</small></div>
        ${offeringBuy("buy-capacity-ceiling-2", BALANCE.capacityCeilingCosts[1]!, ceilings > 1, ceilings === 0, "raised")}
      </div>
      <div class="catalog-row${discounts > 0 ? " owned" : ""}">
        <div><h3 class="t-condensed">First discount <span class="kind">20% off</span> ${capacityTooltipHtml("discount-1-tip", "First discount mechanics", "Permanently takes 20% off every original capacity price. Survives prestige.")}</h3><small>Every capacity rung costs a fifth less nous.</small></div>
        ${offeringBuy("buy-capacity-discount-1", BALANCE.capacityDiscountCosts[0]!, discounts > 0, false, "owned")}
      </div>
      <div class="catalog-row${discounts > 1 ? " owned" : ""}">
        <div><h3 class="t-condensed">Second discount <span class="kind">40% off in total</span> ${capacityTooltipHtml("discount-2-tip", "Second discount mechanics", "Own the first discount first. Permanently takes 40% in total off original capacity prices. Survives prestige.")}</h3><small>Every capacity rung costs its original price, less two fifths.</small></div>
        ${offeringBuy("buy-capacity-discount-2", BALANCE.capacityDiscountCosts[1]!, discounts > 1, discounts === 0, "owned")}
      </div>
    </div></section>`;
}

// The Arete sheet rows' shared purchase words (the sheet's own grammar):
// the engraved completion word and the Arete price button, mode-gated.
function areteOwnedWord(word: string): string {
  return `<span class="shop-buy"><span class="st-acquired">${word}</span></span>`;
}

function areteBuyButtonHtml(app: App, id: string, price: number): string {
  return catalogPriceHtml({ attrs: `id="${id}"`, price, affordable: app.state.arete >= price, hold: app.state.mode !== "upgrade", arete: true });
}

// ── The catalog (issue #271) ────────────────────────────────────────────
// The one tabbed shop behind the dock's (and thumb bar's) labeled Catalog
// door. The face switch reads `ν nous` / `◇ Arete` and is the sheet's only
// title — identity rides the active face's resource mark, and no balance
// repeats inside (the ledgers own the figures). The frame is fixed at
// every width — 620×600 on desktop, a 74%-height bottom sheet on phone —
// so a face switch never resizes it; the switch and identity stay pinned
// while the body scrolls. The arete face appears at the first banked
// Arete (the prestige-count lock, never the balance): before the Mutator
// entry it is the single centered unlock lock screen; the purchase
// reveals Upgrades (the entry's ACQUIRED rewards line, the inert
// Accelerator placeholder, the Horizon break) and Unlocks (the roll-pool
// join, empty once joined). Prices mute when unaffordable or in flow
// ("spent between sessions"). One feats surface per screen stands
// elsewhere (ADR-0030 unamended).
function renderCatalogModal(app: App, content: HTMLElement): void {
  const { ui } = app;
  const areteFace = ui.catalogFace === "arete";
  // The arete tab stands open from the start (issue #292 review): before
  // the first prestige its face is the entry purchase screen — the preview
  // of the future entry, price muted — never a locked tab.
  const faceTab = (face: "nous" | "arete", mark: string, word: string): string =>
    `<button class="catalog-face-tab" data-catalog-face="${face}" aria-pressed="${ui.catalogFace === face}" title="${
      face === "nous" ? "The nous shop" : "The Arete catalog"
    }">${mark}<span>${word}</span></button>`;
  const identity = areteFace
    ? `<span class="catalog-identity" aria-hidden="true">${ARETE_SVG}</span>`
    : `<span class="catalog-identity catalog-identity-nous" aria-hidden="true"><b class="mono">ν</b></span>`;
  content.innerHTML = `<div class="catalog-frame">
    <div class="catalog-top">
      <span class="catalog-face-switch" role="group" id="modal-title" aria-label="Catalog">${faceTab("nous", '<b class="mono">ν</b>', "nous")}${faceTab("arete", ARETE_SVG, "Arete")}</span>
      ${identity}
      <button id="close-modal" aria-label="Close dialog">✕</button>
    </div>
    <div class="catalog-body">${areteFace ? catalogAreteFaceHtml(app) : catalogNousFaceHtml(app)}</div>
  </div>`;
  content.querySelectorAll<HTMLButtonElement>("[data-catalog-face]").forEach((button) => {
    app.listen(button, "click", () => {
      app.ui.catalogFace = button.getAttribute("data-catalog-face") as "nous" | "arete";
      app.render();
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) => {
    app.listen(button, "click", () => {
      app.buyShelf(button.getAttribute("data-buy") as keyof typeof BALANCE.shelfPrices);
    });
  });
  app.listen(content.querySelector<HTMLButtonElement>("[data-buy-capacity]"), "click", () => app.buyCapacityAction());
  for (const id of ["buy-capacity-ceiling-1", "buy-capacity-ceiling-2"]) {
    app.listen(byId(id), "click", () => app.buyCapacityCeilingAction());
  }
  for (const id of ["buy-capacity-discount-1", "buy-capacity-discount-2"]) {
    app.listen(byId(id), "click", () => app.buyCapacityDiscountAction());
  }
  app.listen(byId("buy-arete-entry"), "click", () => app.buyCatalogEntryAction());
  app.listen(byId("buy-arete-pool"), "click", () => app.joinRollPoolAction());
  app.listen(byId("buy-arete-break"), "click", () => app.breakHorizonAction());
  app.listen(byId("catalog-show-acquired"), "change", (event) => {
    app.ui.showAcquired = (event.target as HTMLInputElement).checked;
    app.render();
  });
  // A face rebuild replaces this root, so disclosure listeners cannot
  // accumulate on the stable modal content and toggle a tap twice.
  wireTooltips(content.querySelector(".catalog-frame")!, app.signal);
  wireClose(app);
}

// The catalog's price affordance (issue #271): the outline price button in
// the register the row sells in — muted by the disabled state whenever the
// price is out of reach or flow holds the purse ("spent between sessions")
// — over its practice-minute countdown while arranging. The title reads the
// one state the button is in (spend / not enough / between sessions); a
// caller that needs its own words (the cell row's arm instruction) puts a
// title in attrs and the built one stands down.
function catalogPriceHtml(options: {
  attrs?: string;
  price: number;
  affordable: boolean;
  hold?: boolean;
  countdown?: string | null;
  arete?: boolean;
}): string {
  const unit = options.arete ? "Arete" : "ν";
  const disabled = options.hold || !options.affordable;
  const title = options.attrs?.includes("title=")
    ? ""
    : ` title="${options.hold ? "Purchases happen between sessions" : options.affordable ? `Spend ${formatInt(options.price)} ${unit}` : `Not enough ${unit === "ν" ? "nous" : "Arete"}`}"`;
  return `<span class="shop-buy"><button class="price${options.arete ? " arete" : ""}" ${options.attrs ?? ""}${title}${
    disabled ? " disabled" : ""
  }>${formatInt(options.price)} ${unit}</button>${
    options.countdown ? `<small class="shop-countdown mono">${options.countdown}</small>` : ""
  }</span>`;
}

// The nous face: the starter shelf while offers stand, and the acquired
// shelf behind its toggle. Cells are not a sheet row — the purchase arms
// from the dock's New cell and commits on the board's frontier, where the
// price lives.
function catalogNousFaceHtml(app: App): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  const shelfTypes = Object.keys(BALANCE.shelfPrices) as (keyof typeof BALANCE.shelfPrices)[];
  // One-time shelf offers on top; acquired items demote below the checkbox.
  const openShelf = shelfTypes.filter((type) => !state.purchased[type]);
  const ownedShelf = shelfTypes.filter((type) => state.purchased[type]);

  // The activation ladder (ADR-0013) rests empty at launch, so the catalog
  // omits its activation section entirely (ADR-0019): no telegraph row, no
  // pricing — after session one the hinted generator pull is the only spend
  // path. The section returns with the ladder's first tenant, priced by
  // that tenant's effort; the rung markup is not preserved here.

  const shelfRows = openShelf
    .map((type) => {
      const price = BALANCE.shelfPrices[type];
      const hint = SHELF_HINTS[type];
      const moduleMeta = META[SHELF_MODULE[type]];
      return `<article class="catalog-row">
        <div><h3 class="t-condensed">${moduleMeta.name}</h3><p class="t-note">${moduleMeta.role}</p>${
          hint ? `<p class="shop-hint t-note">${hint}</p>` : ""
        }</div>
        ${catalogPriceHtml({
          attrs: `data-buy="${type}"`,
          price,
          affordable: wholeNous(state) >= price,
          hold: !upgrade,
          countdown: upgrade ? upgradeCountdown(app, price) : null,
        })}
      </article>`;
    })
    .join("");
  return `<div class="catalog-sections">
    ${
      openShelf.length > 0
        ? `<section>
            <h2 class="t-condensed">Starter shelf</h2>
            <div class="catalog-rows">${shelfRows}</div>
          </section>`
        : `<p class="empty-copy">The shelf is empty.</p>`
    }
    ${capacityShopHtml(app)}
  </div>
  <label class="catalog-toggle"><input type="checkbox" id="catalog-show-acquired" ${ui.showAcquired ? "checked" : ""}/> Show acquired (${ownedShelf.length}/${shelfTypes.length})</label>
  ${
    ui.showAcquired && ownedShelf.length > 0
      ? `<div class="catalog-rows catalog-owned">${ownedShelf
          .map(
            (type) =>
              `<article class="catalog-row"><div><h3 class="t-condensed">${META[SHELF_MODULE[type]].name}</h3><p class="t-note">${META[SHELF_MODULE[type]].role}</p></div><span class="activation-owned mono">in inventory</span></article>`,
          )
          .join("")}</div>`
      : ""
  }
  <p class="catalog-note t-note">Shelf offers hide once acquired; roll copies stay, as combination material.</p>
  ${upgrade ? "" : `<p class="modal-note">Purchases happen between sessions — enter upgrade mode to buy.</p>`}`;
}

// The arete face's one engraved mark: the acquisition word in the state
// grammar's own class (the prototype's completion read).
function catalogOwnedHtml(word: string): string {
  return `<span class="shop-buy"><span class="st-acquired">${word}</span></span>`;
}

// The tooltip layer's one trigger beside a row name — deeper mechanics
// live here, never in an expandable section (the instrument standards).
function catalogTipHtml(id: string, name: string, text: string): string {
  return `${name}<span class="inst-tip"><button class="inst-tip-trigger" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="The mechanics of ${name}">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${text}</span></span>`;
}

// The Accelerator row's provisional figure (the prototype's): the row is
// an inert placeholder — the price never charges, the button never arms —
// so the number lives here alone, named for what it is.
const ACCELERATOR_PLACEHOLDER_PRICE = 3;

// The arete face: the single centered lock screen until the Mutator entry
// is bought, then the Upgrades and Unlocks sections. The lock screen is
// the face's one offer — the entry itself; the sections appear only once
// it stands acquired.
function catalogAreteFaceHtml(app: App): string {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  if (!state.catalogEntryOwned) {
    const affordable = state.arete >= BALANCE.catalogEntryCost;
    const entryTitle = upgrade ? (affordable ? `Spend ${BALANCE.catalogEntryCost} Arete` : "Not enough Arete") : "Arete is spent between sessions";
    return `<div class="entry-screen">
      <button class="entry-buy" id="buy-arete-entry"${upgrade && affordable ? "" : " disabled"} title="${entryTitle}"><span>Unlock Mutator Layer</span><span class="mono">${BALANCE.catalogEntryCost} Arete</span></button>
    </div>
    ${upgrade ? "" : `<p class="modal-note">Arete is spent between sessions — enter upgrade mode to buy.</p>`}`;
  }
  const areteBuy = (id: string, price: number): string =>
    catalogPriceHtml({
      attrs: `id="${id}"`,
      price,
      affordable: state.arete >= price,
      hold: !upgrade,
      arete: true,
    });
  const joined = state.rollPoolJoined;
  const broken = state.horizonBroken;
  return `<div class="catalog-sections">
    <section>
      <h2 class="t-condensed">Upgrades</h2>
      <div class="catalog-rows">
        <article class="catalog-row">
          <div><h3 class="t-condensed">Mutator layer</h3><p class="t-note">Unlocks: Mutator Grid · 1 Mutator slot · 1 Mutator roll · this catalog</p></div>
          ${catalogOwnedHtml("ACQUIRED")}
        </article>
        <article class="catalog-row">
          <div><h3 class="t-condensed">${catalogTipHtml("cat-accel-tip", "Arete Accelerator", "A placeholder — no offer stands behind it yet; each prestige's claim still grows only with prestiges performed.")} <span class="kind">(placeholder)</span></h3></div>
          ${catalogPriceHtml({ attrs: 'disabled title="A placeholder — no offer yet"', price: ACCELERATOR_PLACEHOLDER_PRICE, affordable: false, arete: true })}
        </article>
        <article class="catalog-row">
          <div><h3 class="t-condensed">${catalogTipHtml("cat-break-tip", "Horizon break", "Score past the horizon line raises each prestige's claim, up to a hard cap — still banked only on reset.")}</h3></div>
          ${broken ? catalogOwnedHtml("broken") : areteBuy("buy-arete-break", BALANCE.horizonBreakCost)}
        </article>
      </div>
    </section>
    <section>
      <h2 class="t-condensed">Unlocks</h2>
      <div class="catalog-rows">
        ${
          joined
            ? ""
            : `<article class="catalog-row">
                <div><h3 class="t-condensed">${catalogTipHtml("cat-pool-tip", "Mutator Forge", "Will appear in future rolls — the type joins the module roll pool as one uniform, unweighted entry.")} <span class="kind">(module type)</span></h3><p class="t-note">Fill with charge → Mutator draft</p></div>
                ${areteBuy("buy-arete-pool", BALANCE.rollPoolJoinCost)}
              </article>`
        }
        ${joined ? `<p class="empty-copy">Nothing waits — future objects appear in future rolls.</p>` : ""}
      </div>
    </section>
    ${capacityAreteHtml(app)}
  </div>
  ${upgrade ? "" : `<p class="modal-note">Arete is spent between sessions — enter upgrade mode to buy.</p>`}`;
}

function forgeEffect(type: ModuleInstance["type"], state: GameState): string {
  const charged = chargedFactor(1);
  switch (type) {
    case "additive": return `+${formatNumber(BALANCE.synthRate)} ν/s unified synth term<br>+${formatNumber(BALANCE.synthRate * charged)} ν/s at charge strength 1`;
    case "blaster": return `converts received charge into its synth term — ×${formatNumber(charged - 1)} at charge strength 1<br>sings and completes chords even uncharged, at zero output`;
    case "harmonizer": return `silent voice — sings its cell's pitch, produces nothing<br>+${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel)}%/LV to every chord instance it sings in`;
    case "echo": return `silent voice — sings an adjacent voice's pitch one octave down<br>+${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel)}%/LV to every chord instance it sings in`;
    case "bend": return `silent voice — sings its cell's pitch altered by its picked shift<br>+${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel)}%/LV to every chord instance it sings in`;
    case "amplifier": return `re-broadcasts received charge at +${formatNumber(100 * BALANCE.amplifierGainPerLevel)}%/LV<br>relayed charge counts fully at receivers; ${BALANCE.amplifierHopCap} hops deep at most`;
    case "ritual": return `amplifies the active habit's equipped build +${formatNumber(BALANCE.ritualAmpPerLevel * 100)}%/LV while receiving charge<br>charge never crosses to the console — the habit keys the module`;
    case "spacer": return `Silent wire — never sounds, never joins a pitch set<br>conducts chord adjacency through chains of wired cells`;
    case "focusKeyed": return `The generator — keyed to your focus<br>each session end banks a reserve (a tenth of its live practice time), spent as its output next session`;
    case "noteKeyed": return `The generator — keyed to your notes<br>every note written banks its reserve (${formatNumber(BALANCE.noteCreditPerChar)} s per character, ${formatNumber(BALANCE.noteCreditCapSeconds / 60)} min cap per note), spent as its output in flow`;
    case "goalKeyed": return `The generator — keyed to your goals<br>each completion banks its reserve (${formatNumber(BALANCE.goalReserveMultiple)}× the focus equivalent, by the goal's live share), spent as its output in flow`;
    case "infusor": return `+${formatNumber(BALANCE.infusorBonus * 100)}% to adjacent production contributions<br>+${formatNumber(BALANCE.infusorBonus * charged * 100)}% at charge strength 1`;
    case "forge": return `1 Forge progress per received charge strength<br>Next roll: ${formatNumber(forgeThreshold(state.forge.earned))} progress`;
    case "mutatorForge": return `1 Mutator Forge progress per received charge strength<br>Next roll: ${formatNumber(mutatorForgeThreshold(state.mutatorForge.earned))} progress`;
    default: return "Not yet active";
  }
}

function candidateReadout(type: ModuleInstance["type"]): string {
  switch (type) {
    case "additive":
    case "blaster":
      return `+${formatNumber(BALANCE.synthRate)}`;
    case "harmonizer":
    case "echo":
    case "bend":
      return "silent";
    case "amplifier":
      return "relay";
    case "ritual":
      return "amp";
    case "spacer":
      return "⌇";
    case "focusKeyed":
    case "noteKeyed":
    case "goalKeyed":
      return "⌁1";
    case "infusor":
      return `+${formatNumber(BALANCE.infusorBonus * 100)}%`;
    case "forge":
    case "mutatorForge":
      return "1/s";
  }
}

// The meter detail's live slots (ADR-0041): the figures move every tick a
// session runs, so the open modal fills them in place — the rebuild only
// fires when the pending offer changes, and the detail never flickers.
function forgeMeterHtml(state: GameState): string {
  return `<div class="forge-meters">
    <div class="forge-meter">
      <span class="meter-name">Flow meter</span>
      <span class="forge-pip" aria-hidden="true"><i data-live="modal-flow-pip"></i></span>
      <span class="meter-figures mono" data-live="modal-flow-line"></span>
    </div>
    <div class="forge-meter">
      <span class="meter-name">Forge progress</span>
      <span class="forge-pip" aria-hidden="true"><i data-live="modal-forge-pip"></i></span>
      <span class="meter-figures mono" data-live="modal-forge-line"></span>
    </div>
    ${state.catalogEntryOwned ? `
    <div class="forge-meter">
      <span class="meter-name">Mutator Forge</span>
      <span class="forge-pip" aria-hidden="true"><i data-live="modal-mutator-pip"></i></span>
      <span class="meter-figures mono" data-live="modal-mutator-line"></span>
    </div>` : ""}
  </div>`;
}

function updateForgeMetersLive(scope: ParentNode, state: GameState, forgeRate: number, mutatorRate: number): void {
  const flowCap = flowThreshold(state.flow.earned);
  const forgeCap = forgeThreshold(state.forge.earned);
  const mutatorCap = mutatorForgeThreshold(state.mutatorForge.earned);
  liveAttr(scope, "modal-flow-pip", "style", `width:${meterPipWidth(state.flow.progress, flowCap)}`);
  liveAttr(scope, "modal-forge-pip", "style", `width:${meterPipWidth(state.forge.progress, forgeCap)}`);
  liveSet(scope, "modal-flow-line", flowMeterLine(state));
  liveSet(scope, "modal-forge-line", forgeMeterLine(state, forgeRate));
// The Mutator Forge branch's row exists only once the tree is entered
// (issue #199): the live fills are no-ops while its nodes are absent.
  liveAttr(scope, "modal-mutator-pip", "style", `width:${meterPipWidth(state.mutatorForge.progress, mutatorCap)}`);
  liveSet(scope, "modal-mutator-line", mutatorForgeMeterLine(state, mutatorRate));
}

function renderForgeModal(app: App, content: HTMLElement, projected: RateSnapshot): void {
  const { state } = app;
  const offer = state.bankedRolls[state.bankedRolls.length - 1];
  const banked = state.bankedRolls.length;
  const mutOffer = state.bankedMutatorRolls[state.bankedMutatorRolls.length - 1];
  const mutBanked = state.bankedMutatorRolls.length;
  const mutatorSection = !mutOffer
    ? ""
    : `<div class="mutator-forge-block">
        <span class="eyebrow mut-eyebrow">MUTATOR FORGE · ${mutBanked} banked</span>
        <div class="candidates mut-candidates">
          ${mutOffer.candidates
            .map(
              (candidate) => `
            <button class="candidate-tile mut-candidate" data-mut-choice="${candidate.id}" data-mut-offer="${mutOffer.id}" data-rarity="${candidate.rarity}" title="Take the ${RARITY_LABEL[candidate.rarity]} ${FAMILY_WORD[candidate.family]} mutator">
              <svg viewBox="-70 -70 140 140" aria-hidden="true" style="color: var(--arete)">
                ${mutatorTileInner(candidate)}
              </svg>
              <span class="rarity">${RARITY_LABEL[candidate.rarity]}</span>
              <span class="candidate-effect">${mutatorEffectText(candidate.family, candidate.rarity)}</span>
            </button>`,
            )
            .join("")}
        </div>
        <p class="modal-note">Take one mutator — the other vanishes. It waits in the Mutator tray, on the Mutators layer.</p>
      </div>`;
  content.innerHTML = `
    ${modalTop(`FORGE · ${banked} banked`)}
    <h2 id="modal-title" class="sr-only">Forge choice</h2>
    ${forgeMeterHtml(state)}
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
    </div>` : `<p class="empty-copy">No choices banked yet — the meters above say how far.</p>`}
    ${mutatorSection}
    <p class="modal-note">The board stays live behind this card — inspect freely; click outside, ✕ or Esc puts the choice away.</p>`;
  updateForgeMetersLive(content, state, projected.forgeRate, projected.mutatorForgeRate);
  content.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((button) => {
    app.listen(button, "click", () => {
      app.chooseCandidate(button.getAttribute("data-offer")!, button.getAttribute("data-choice")!);
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-mut-choice]").forEach((button) => {
    app.listen(button, "click", () => {
      app.chooseMutatorCandidate(button.getAttribute("data-mut-offer")!, button.getAttribute("data-mut-choice")!);
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
  app.listen(byId("export-copy"), "click", async () => {
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
  app.listen(byId("export-download"), "click", () => {
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
  app.listen(byId("import-browse"), "click", () => file?.click());
  app.listen(file, "change", async () => {
    const fileItem = file?.files?.[0];
    if (!fileItem || !textarea) return;
    const text = await fileItem.text();
    if (!app.released) textarea.value = text;
  });
  app.listen(byId("import-apply"), "click", () => {
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
  app.listen(byId("reset-cancel"), "click", () => app.closeModal());
  app.listen(byId("reset-confirm"), "click", () => app.hardReset());
  wireClose(app);
}

// The prestige confirm (ADR-0039): the door's second press. The claim is
// stated live; the boundary's two sides are named plainly — what prestige
// takes (levels, nous, charge) and what survives it (the board, tray,
// rolls, achievements, life record, Arete). Copy is tuning, and the
// glossary's avoided-verb rule holds: prestige is the verb, never "reset".
function renderPrestigeModal(app: App, content: HTMLElement): void {
  const claim = claimOf(app.state);
  // The capacity clause (issue #259): purchased capacity is era progress,
  // so the modal names it among what prestige takes.
  const capacityClause = ", purchased capacity returns to one";
  content.innerHTML = `
    ${modalTop("PRESTIGE")}
    <h2 id="modal-title">Begin the next era?</h2>
    <p class="lead">Prestige banks <strong class="mono">${claim} Arete</strong> and starts the era over: module levels return to base${capacityClause}, and your nous and charge return to the opening.</p>
    <p class="lead muted">Your board and its placement, the tray, banked Forge rolls and progress, feats, your whole life record, your Arete, and lifetime nous all stay.</p>
    <div class="modal-actions">
      <button id="prestige-cancel">Not yet</button>
      <button id="prestige-confirm" class="primary">Prestige and claim ${claim} Arete</button>
    </div>`;
  app.listen(byId("prestige-cancel"), "click", () => app.closeModal());
  app.listen(byId("prestige-confirm"), "click", () => app.confirmPrestige());
  wireClose(app);
}

// The honesty report (focus-tool spec §2): the mandatory adjudication when
// a session returns with provisional time outstanding. One surface, both
// uses — mid-session and at exit (framing copy differs) — never merged into
// the dismissible summary. The ruled folio (#279): the readout leads —
// away time against the plan, the held bucket beside it — the one
// reassurance ("Nothing already banked is taken back.") stays visible, and
// each option is a full-width rule-line row carrying its consequence as a
// mono line: the whole adjudication readable without opening anything. The
// answer banks or drops the bucket in one move. Non-dismissible (ADR-0019):
// it settles, or the player leaves and the next return re-presents it,
// recalculated.
function renderHonestyModal(app: App, content: HTMLElement): void {
  const session = app.state.session;
  const pool = session?.accounting.poolSeconds ?? 0;
  const bucket = session?.accounting.bucketNous ?? 0;
  const target = session?.target ?? null;
  const planned = target !== null;
  const read = `${formatDuration(pool)} away${planned ? " · past your plan" : ""}`;
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
    <div class="folio-rows honesty-readout">
      <div class="folio-row"><span class="honesty-read mono">${read}</span><span class="honesty-held mono">${formatNumber(bucket)} ν held</span></div>
      <div class="folio-row"><span class="folio-line">Nothing already banked is taken back.</span></div>
    </div>
    <div class="honesty-choices">
      ${options
        .map(
          (option) => `<button class="honesty-choice" data-honesty="${option.outcome}">
        <span class="honesty-label">${option.label}</span>
        <small class="honesty-consequence mono">${option.consequence}</small>
      </button>`,
        )
        .join("")}
    </div>`;
  content.querySelectorAll<HTMLButtonElement>("[data-honesty]").forEach((button) => {
    app.listen(button, "click", () => {
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
    app.listen(button, "click", () => {
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
  app.listen(nameInput, "input", () => {
    if (!nameInput) return;
    app.ui.enter.newName = nameInput.value;
    refreshEnterFooter(app, content);
    stampEnterKey(app, content);
  });
  app.listen(nameInput, "keydown", (event) => {
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
        // Planning lives only in the Focus sheet's PLAN face (§7): the
        // prompt carries a pointer, not a second copy of the controls —
        // the console clock opens the sheet where the plan is set.
        `<p class="enter-plan-hint small muted">Planning lives in the Focus sheet — set it there (or tap the clock), or enter open-ended.</p>`
      }
    </div>
    <div class="footer-band">
      <button id="enter-cancel" class="small">Back</button>
      <span class="cta-summary"></span>
      <button id="enter-begin" class="primary"></button>
    </div>`;
  refreshEnterFooter(app, content);
  content.querySelectorAll<HTMLButtonElement>("[data-enter-kind]").forEach((button) => {
    app.listen(button, "click", () => {
      app.ui.enter.kind = button.getAttribute("data-enter-kind") as EnterKind;
      refreshEnterTabs(app, content);
      swapEnterPane(app, content);
    });
  });
  bindEnterPane(app, content);
  app.listen(byId("enter-begin"), "click", () => beginEnter(app));
  app.listen(byId("enter-cancel"), "click", () => app.closeModal());
  wireClose(app);
}

const kindTab = (kind: EnterKind, label: string, app: App): string =>
  `<button class="mode-tab${app.ui.enter.kind === kind ? " active" : ""}" data-enter-kind="${kind}" aria-pressed="${app.ui.enter.kind === kind}">${label}</button>`;

// The loud summary (§5.7, §8): shown once per session end, however the
// session ended — final numbers only. The ruled folio (#279): the banked
// nous headline — the figure IS the identity, no sentence restates it —
// over hairline-ruled readout rows (practice, rate, rolls, unlocks, the
// honesty events as neutral factual lines), the rate breakdown living in
// the RATE row's tooltip layer and every unlock wearing the NEW mark.
// Practice time shows credited minutes in the history list's format, and
// there is no raw wall-duration row. The reflection's reserved slot rides
// above dismissal: free text plus a continuous rough–great slider (the
// 1–5 range holds; #233), end labels only, middle neutral and the default.
// It records as either field is touched and stays absent otherwise, so
// every dismissal path — Continue, ✕, backdrop, Esc — logs the same.

// The ends' response (#233): each label's opacity rises as the thumb nears
// it — a continuous read with no bands and no numbers. Dim is the far-end
// floor and span the brightening range; at the neutral middle the formula
// reads 0.675, the stylesheet's resting 0.7 standing in only before the
// first paint.
const REFLECT_END_DIM = 0.35;
const REFLECT_END_SPAN = 0.65;

function reflectEndsOf(el: HTMLInputElement): void {
  const t = (el.valueAsNumber - REFLECTION_SLIDER_MIN) / (REFLECTION_SLIDER_POSITIONS - REFLECTION_SLIDER_MIN);
  const rough = el.previousElementSibling as HTMLElement | null;
  const great = el.nextElementSibling as HTMLElement | null;
  if (rough) rough.style.opacity = (REFLECT_END_DIM + REFLECT_END_SPAN * (1 - t)).toFixed(3);
  if (great) great.style.opacity = (REFLECT_END_DIM + REFLECT_END_SPAN * t).toFixed(3);
}

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
        ...(summary.infusors > 0 ? [`boosters +${formatNumber(summary.infusors)} ν/s`] : []),
        ...(summary.empowerment > 1 ? [`empowerment ×${formatNumber(summary.empowerment)}`] : []),
      ].join(" · ");
  // The unlock rows (ADR-0015): in-session unlocks queue here instead of
  // toasting, whatever the exit path — each wearing the engraved NEW mark.
  const unlocked = (summary.achievements ?? []).map(achievementName);
  const NEW_MARK = `<span class="folio-new" aria-label="new this session">NEW</span>`;
  const unlockRows = [
    ...(unlocked.length > 0
      ? [
          `<div class="folio-row folio-unlock"><span class="folio-key">Unlocked</span><span class="folio-main"><span class="folio-fig mono">${unlocked.join(" · ")}</span></span>${NEW_MARK}</div>`,
        ]
      : []),
    ...(summary.timeUnlocked
      ? [
          `<div class="folio-row folio-unlock"><span class="folio-key">Unlocked</span><span class="folio-main"><span class="folio-fig mono">Time your flow sessions</span></span>${NEW_MARK}</div>`,
        ]
      : []),
  ].join("");
  // The rolls line (ADR-0041): one source reads plainly, several split —
  // practice (flow meter), charge (Forge progress), and the Mutator
  // Forge's crossings (ADR-0043). The queues are their own; only the
  // attribution splits.
  const rollsFlow = summary.rollsFlow ?? 0;
  const rollsForge = summary.rollsForge ?? 0;
  const rollsMutator = summary.rollsMutator ?? 0;
  const rolls = rollsFlow + rollsForge + rollsMutator;
  const rollSources: string[] = [];
  if (rollsFlow > 0) rollSources.push(`${rollsFlow} from practice`);
  if (rollsForge > 0) rollSources.push(`${rollsForge} from charge`);
  if (rollsMutator > 0) rollSources.push(`${rollsMutator} from the Mutator Forge`);
  const rollsRow = rolls > 0
    ? `<div class="folio-row">
        <span class="folio-key">Rolls</span>
        <span class="folio-main"><span class="folio-fig mono">${rolls} ${rolls === 1 ? "roll" : "rolls"}</span>${
          rollSources.length > 0 ? `<span class="folio-sub mono">${rollSources.join(" · ")}</span>` : ""
        }</span>
      </div>`
    : "";
  const events = (summary.honestyEvents ?? [])
    .map((event) => `<div class="folio-row"><span class="folio-key">Honesty</span><span class="folio-line">${honestyEventLine(event)}</span></div>`)
    .join("");
  const reflection = summary.reflection;
  content.innerHTML = `
    ${modalTop(null)}
    <h2 id="modal-title" class="summary-head">
      <span class="summary-earned mono">${formatNumber(summary.earned)} ν</span>
      <span class="eyebrow">Banked · Session ${summary.sessionNumber}</span>
    </h2>
    <div class="folio-rows">
      <div class="folio-row"><span class="folio-key">Practice</span><span class="folio-main"><span class="folio-fig mono">${formatPracticeMinutes(summary.seconds, summary.plannedTarget ?? null)}</span></span></div>
      <div class="folio-row">
        <span class="folio-key inst-tip">
          <button class="inst-tip-trigger tip-figure folio-key-tip" type="button" aria-expanded="false" aria-describedby="summary-rate-tip" aria-label="Rate — the breakdown">Rate&nbsp;<span aria-hidden="true">ⓘ</span></button>
          <span class="inst-tip-body" id="summary-rate-tip" role="tooltip">${breakdown}</span>
        </span>
        <span class="folio-main"><span class="folio-fig mono">${formatNumber(summary.ratePerMinute)} ν/min</span></span>
      </div>
      ${rollsRow}
      ${unlockRows}
      ${events}
    </div>
    <div class="folio-rows folio-reflect">
      <div class="folio-row">
        <span class="folio-key">Reflect</span>
        <div class="folio-main">
          <input type="text" id="summary-reflection-text" placeholder="One line, optional" aria-label="Reflect on the session in words" value="${escapeHtml(reflection?.text ?? "")}" />
          <div class="reflection-slider">
            <span class="reflection-end">rough</span>
            <input type="range" id="summary-reflection-slider" min="1" max="${REFLECTION_SLIDER_POSITIONS}" step="any" value="${reflection?.slider ?? REFLECTION_SLIDER_NEUTRAL}" aria-label="How the session went, rough to great" />
            <span class="reflection-end">great</span>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-actions"><button id="summary-continue" class="primary">Continue</button></div>`;
  wireTooltips(content, app.signal);
  app.listen(byId("summary-reflection-text"), "input", (event) => {
    app.recordReflectionText((event.target as HTMLInputElement).value);
  });
  app.listen(byId("summary-reflection-slider"), "input", (event) => {
    const el = event.target as HTMLInputElement;
    app.recordReflectionSlider(el.valueAsNumber);
    // The ends respond (#233): each label brightens as the thumb nears it —
    // opacity alone, no bands, no numbers.
    reflectEndsOf(el);
  });
  // The ends always read the thumb — the formula governs from first paint;
  // a stored decimal re-opens with its own emphasis.
  const sliderEl = byId("summary-reflection-slider") as HTMLInputElement | null;
  if (sliderEl) reflectEndsOf(sliderEl);
  app.listen(byId("summary-continue"), "click", () => app.dismissSummary());
  wireClose(app);
}

/* ── Dev panel ─────────────────────────────────────── */

// The dev console's drag state (ADR-0050): the live gesture's origin —
// the panel's offset inside the stage and the drag's starting pointer —
// held across renders, since the tick rebuilds the panel's buttons
// mid-drag without moving the panel itself.
let devDrag: { ox: number; oy: number; sx: number; sy: number; pointerId: number } | null = null;

// The stage the grip clamps against: #app's own box — the console panel
// never leaves the instrument. #app spans the viewport, so its box is the
// fixed-position coordinate space (fallback: the viewport itself).
function devStageBox(): { left: number; top: number; width: number; height: number } {
  const rect = byId("app")?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) return rect;
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

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
    // The drag's continuation lives on the document, bound once for the
    // app's lifetime. Capture belongs to the persistent panel, so replacing
    // its buttons during a tick never interrupts the pointer stream.
    app.listen(document, "pointermove", (event) => {
      if (!devDrag || event.pointerId !== devDrag.pointerId) return;
      const box = devStageBox();
      const margin = 4;
      const nx = Math.max(margin, Math.min(devDrag.ox + event.clientX - devDrag.sx, box.width - panel!.offsetWidth - margin));
      const ny = Math.max(margin, Math.min(devDrag.oy + event.clientY - devDrag.sy, box.height - panel!.offsetHeight - margin));
      panel!.style.left = `${box.left + nx}px`;
      panel!.style.top = `${box.top + ny}px`;
      panel!.style.bottom = "auto";
    });
    const release = () => {
      devDrag = null;
    };
    app.listen(document, "pointerup", release);
    app.listen(document, "pointercancel", release);
    app.listen(panel, "lostpointercapture", release);
  }
  const stage = devStageBox();
  panel.style.maxWidth = `${Math.max(0, stage.width - 24)}px`;
  panel.style.maxHeight = `${Math.max(0, stage.height - 8)}px`;
  panel.innerHTML = `<button class="dev-grip" id="dev-grip" aria-label="Drag to move the dev console" title="Drag to move">⠿</button>
    <span>DEV</span>
    <button data-dev="60">+1m</button>
    <button data-dev="600">+10m</button>
    <button data-dev="target">→ target</button>
    <button data-dev="nous">+100ν</button>
    <button data-dev="synth">+synth</button>
    <button data-dev="mutera">mutator era</button>
    <button data-dev="board">${app.devBoard ? "close board" : "board"}</button>`;
  // The grip (ADR-0050): a pointer-capture drag — the press records the
  // panel's offset inside the stage, the moves carry it clamped within,
  // release ends the gesture. The persistent panel holds capture when the
  // pointer leaves it; touch rides the same events (touch-action:none).
  const grip = byId("dev-grip");
  if (grip) {
    app.listen(grip, "pointerdown", (event) => {
      const rect = panel!.getBoundingClientRect();
      const box = devStageBox();
      devDrag = { ox: rect.left - box.left, oy: rect.top - box.top, sx: event.clientX, sy: event.clientY, pointerId: event.pointerId };
      try {
        panel!.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic events may lack capture; document listeners still handle them.
      }
      event.preventDefault();
    });
  }
  panel.querySelectorAll<HTMLButtonElement>("[data-dev]").forEach((button) => {
    app.listen(button, "click", () => {
      const key = button.getAttribute("data-dev")!;
      if (key === "target") app.devToTarget();
      else if (key === "nous") app.devNous();
      else if (key === "synth") app.devSynth();
      else if (key === "mutera") app.devMutatorEra();
      else if (key === "board") app.devToggleBoard();
      else app.devAdvance(Number(key));
    });
  });
}

/* ── Dev allocation board (#257) ───────────────────── */

// The development board's panel: capacity one through five, the scenario
// board itself, and the reads — active instances, every voice's
// used/available budget, and final ν/s — all from the real rate path.
// Per the instrument standards: one flat panel, open divisions, compact
// name/state/effect readouts, no explanatory prose.
function renderDevBoard(app: App): void {
  let panel = byId("dev-board");
  if (!app.dev || !app.devBoard) {
    panel?.remove();
    return;
  }
  const board = app.devBoard;
  const { snapshot, read } = app.devBoardResult() ?? { snapshot: null, read: null };
  if (!snapshot || !read) {
    panel?.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "dev-board";
    panel.id = "dev-board";
    document.body.append(panel);
  }
  const scenario = board.scenario;
  const placed = scenario.modules.filter((m): m is DeployedModule => m.pos !== null);
  const voices = placed.filter((m) => isVoiceType(m.type));
  const noteOf = (id: string): string => {
    const module = scenario.modules.find((m) => m.id === id);
    return module?.pos ? cellNoteOf(module.pos) : "—";
  };
  const capacityButtons = DEV_BOARD_CAPACITIES.map(
    (n) => `<button data-devcap="${n}" class="${n === board.capacity ? "on" : ""}" aria-pressed="${n === board.capacity}" aria-label="Capacity ${n}">${n}</button>`,
  ).join("");
  const voiceRows = [...voices]
    .sort((a, b) => a.pos!.r - b.pos!.r || a.pos!.q - b.pos!.q || a.id.localeCompare(b.id))
    .map((module) => {
      const used = read.used.get(module.id) ?? 0;
      const silent = CATEGORY_OF[module.type] === "silentVoice";
      const contribution = snapshot.contributions.get(module.id);
      const factor = read.analysis.voiceMultiplier.get(module.id) ?? 1;
      const selected = board.selected === module.id ? " picked" : "";
      return `<button class="dev-voice${selected}" data-devvoice="${module.id}" aria-pressed="${board.selected === module.id}">
          <span class="dev-note">${module.pos ? cellNoteOf(module.pos) : "—"}</span>
          <span class="dev-type">${META[module.type].short}</span>
          <span class="dev-lvl">L${module.level}</span>
          <span class="dev-cap">${used}/${board.capacity}</span>
          <span class="dev-factor mono">×${factor.toFixed(2)}</span>
          <span class="dev-value mono">${silent ? "—" : `${formatNumber(contribution?.value ?? 0)} ν/s`}</span>
        </button>`;
    })
    .join("");
  const instanceChips = read.instances
    .map(
      (instance) =>
        `<span class="dev-instance">${instance.name} ×${(1 + instance.bonus).toFixed(2)} @${noteNameOf(
          60 + instance.root,
        )} · ${instance.memberIds.map(noteOf).join("·")}</span>`,
    )
    .join("");
  // The scenario grid over the board's own bounding box: every cell a
  // button — a click moves the selected voice to a free cell, or selects
  // the voice occupying it.
  const minQ = Math.min(...scenario.cells.map((c) => c.q));
  const maxQ = Math.max(...scenario.cells.map((c) => c.q));
  const minR = Math.min(...scenario.cells.map((c) => c.r));
  const maxR = Math.max(...scenario.cells.map((c) => c.r));
  const gridRows: string[] = [];
  for (let r = minR; r <= maxR; r++) {
    const cells: string[] = [];
    for (let q = minQ; q <= maxQ; q++) {
      const inScenario = scenario.cells.some((c) => c.q === q && c.r === r);
      const occupant = placed.find((m) => m.pos!.q === q && m.pos!.r === r);
      const owner = occupant ? (board.selected === occupant.id ? " sel" : occupant.type === "spacer" ? " wire" : " voice") : inScenario ? " free" : " off";
      const label = occupant
        ? `${inventoryTileSvg(occupant)}<span>${cellNoteOf(occupant.pos!)}</span>`
        : inScenario ? "+" : "";
      const accessibleName = occupant
        ? `${META[occupant.type].name} at ${cellNoteOf(occupant.pos!)}`
        : `Move selected module to ${cellNoteOf({ q, r })}`;
      cells.push(
        `<button class="dev-cell${owner}" data-devcell="${q},${r}" aria-label="${accessibleName}" ${occupant ? `aria-pressed="${board.selected === occupant.id}"` : ""} ${inScenario ? "" : "disabled"}>${label}</button>`,
      );
    }
    gridRows.push(`<div class="dev-row">${cells.join("")}</div>`);
  }
  const stressRows = board.stress
    ? board.stress
        .map(
          (row) =>
            `<div class="dev-stress-row${row.certified ? "" : " uncert"}">${row.fixture} · cap ${row.capacity} · ${row.candidates} cands · ${row.instances} inst · ${row.ms.toFixed(0)} ms · ${
              row.certified ? "certified" : "incumbent"
            }</div>`,
        )
        .join("")
    : "";
  const focused = document.activeElement;
  const focusKey = focused instanceof HTMLElement && panel.contains(focused)
    ? ["data-devcap", "data-devvoice", "data-devcell", "data-devboard"].find((attr) => focused.hasAttribute(attr))
    : undefined;
  const focusValue = focusKey ? focused!.getAttribute(focusKey) : null;
  const scrollTop = panel.scrollTop;
  panel.innerHTML = `
    <div class="dev-board-head">
      <span>ALLOCATION BOARD</span>
      <span class="mono" data-dev="rate">${formatNumber(snapshot.rate)} ν/s</span>
      <span class="mono" data-dev="solver">${read.instances.length} inst · ${read.recognized} cands · ${read.nodes} nodes · ${read.ms.toFixed(1)} ms · ${read.certified ? "certified" : "incumbent"}</span>
      <button data-devboard="close" aria-label="Close allocation board">✕</button>
    </div>
    <div class="dev-board-cap">
      <span>capacity</span>
      ${capacityButtons}
      <button data-devboard="reset">reset</button>
      <button data-devboard="stress">${board.stressRunning ? "cancel stress" : "stress"}</button>
    </div>
    <div class="dev-board-grid">${gridRows.join("")}</div>
    <div class="dev-board-instances">${instanceChips || '<span class="dev-empty">no active instances</span>'}</div>
    <div class="dev-board-voices">
      ${voiceRows}
      <div class="dev-power">
        <button data-devboard="power-down" ${board.selected ? "" : "disabled"}>− power</button>
        <button data-devboard="power-up" ${board.selected ? "" : "disabled"}>+ power</button>
      </div>
    </div>
    ${board.stress ? `<div class="dev-board-stress" aria-busy="${board.stressRunning}"><span role="status">${board.stressRunning ? "Running" : "Results"} · ${board.stress.length} solves</span>${stressRows}</div>` : ""}
    ${board.stressError ? `<p role="alert">${escapeHtml(board.stressError)}</p>` : ""}`;
  if (focusKey && focusValue !== null) {
    [...panel.querySelectorAll<HTMLButtonElement>(`[${focusKey}]`)]
      .find((button) => button.getAttribute(focusKey) === focusValue)?.focus({ preventScroll: true });
  }
  panel.scrollTop = scrollTop;
  panel.querySelectorAll<HTMLButtonElement>("[data-devcap]").forEach((button) => {
    app.listen(button, "click", () => app.devBoardSetCapacity(Number(button.getAttribute("data-devcap"))));
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-devvoice]").forEach((button) => {
    app.listen(button, "click", () => app.devBoardSelect(button.getAttribute("data-devvoice")));
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-devcell]").forEach((button) => {
    const [q, r] = button.getAttribute("data-devcell")!.split(",").map(Number);
    app.listen(button, "click", () => app.devBoardMoveTo(q!, r!));
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-devboard]").forEach((button) => {
    const key = button.getAttribute("data-devboard")!;
    if (key === "close") app.listen(button, "click", () => app.devToggleBoard());
    else if (key === "reset") app.listen(button, "click", () => app.devBoardReset());
    else if (key === "stress") app.listen(button, "click", () => app.devBoardStress());
    else if (key === "power-up") app.listen(button, "click", () => app.devBoardPower(1));
    else if (key === "power-down") app.listen(button, "click", () => app.devBoardPower(-1));
  });
}
