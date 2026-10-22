import { termTipHtml, type CatalogTerm } from "./terms";
import { tierPowerOf } from "../engine/module-strength";
import { cellCost, cellPurchasePrice, chargeDelivered, computeRates, displayedRates, emittedStrength, affordableLevels, flowLive, levelCost, levelsCost, projectPlacement, voiceCapacityOf, wholeNous, type PlacementProjection } from "../engine/economy";
import { ALLOCATION_QUALITY_BOUNDS, idleTermsOf, summaryTermsOf } from "../engine/allocation";
import { ARETE_HORIZON, bankableClaimOf, horizonReached } from "../engine/accumulator";
import { newChordTerms, wouldFormPreview } from "../engine/chords";
import { combinePreview, levelable, type CombinePreview, upgradeAllPreview } from "../engine/actions";
import { skipPayoutOf } from "../engine/scrap";
import { deployedAt } from "../engine/economy";
import { sameHex } from "../engine/hex";
import { draftTierChanceOf, forgeThreshold, mutatorForgeThreshold, nextDraftUpgradePrice } from "../engine/rolls";
import { BALANCE, CATEGORY_OF, isOscillatorType, isVoiceType, NAMED_CHORDS, REFLECTION_SLIDER_MIN, REFLECTION_SLIDER_NEUTRAL, REFLECTION_SLIDER_POSITIONS, SHELF_MODULE } from "../engine/constants";
import { goalCompletionBase } from "../engine/reserves";
import { baseTermOf, generatorProfileOf } from "../engine/profiles";
import { catalogOpen, mergeCapIncreaseCost, rowUnlockCost, unlockedMergeCap, unlockableRows } from "../engine/catalog";
import { capacityCeiling, nextCapacityPrice, nextCeilingPrice, nextDiscountPrice } from "../engine/capacity";
import { formatClock, formatDuration } from "../engine/clock";
import { cellNoteOf, noteNameOf, octaveRowOf, positionInRange } from "../engine/lattice";
import { TILE_APPS, type FocusApp } from "../engine/apps";
import { poolOutstanding } from "../engine/trust";
import { arcCardDue } from "../engine/arc";
import { ACHIEVEMENTS, achievementName, type AchievementCategory, type AchievementContext, type AchievementDef } from "../engine/achievements";
import type { Category, DeployedModule, GameState, Hex, ModuleInstance, ModuleType, NamedChordTerm, RateSnapshot, SpecialDraftKind, WeaponType } from "../engine/types";
import { DEV_BOARD_CAPACITIES, type App, type ChordHover, type ModalKind } from "./app";
import {
  bindFocusSheet,
  bindNotesModal,
  escapeHtml,
  focusSheetHtml,
  focusSheetKey,
  goalMeterOf,
  GOAL_METER_SEGMENTS,
  honestyEventLine,
  notesModalBodyHtml,
  notesModalKey,
  notesModalTabsHtml,
  outcomeLabel,
  refreshConsoleClockPlan,
  sessionCaption,
  setText,
  updateFocusSheetLive,
} from "./focus";
import { activeHabit } from "../engine/habits";
import { startPointerDrag } from "./pointer-drag";
import { appIcon, lockMarkSvg } from "./icons";
import { HEX_RADIUS, hexApothem, hexPoints, moduleFace, boardPoint, SPACING, spacerClipPath, forgeBranchOf, faceReadoutFor, faceLevel, waterFill, zeroBuyRead, isSource, inventoryTileSvg, HUE_TOKEN_OF } from "./face";
import { renderHexDetail } from "./hexdetail";
import { renderInventoryContent, openInventoryForDrag } from "./inventory";
import { chargeGlow, chargeLeads } from "./leads";
import { chordOverlay, chordMarkCovers, chipWidth, CHORD_HUES, type ChordMark } from "./chordlayer";
import { updateSvg } from "./svg";
import { APP_LABELS, CATEGORY_WORD, META, RARITY_LABEL, SHELF_DESCRIPTIONS, SPECIAL_DRAFT_NAME, WORLD_META, rarityMark, tierNumeral, tierWord } from "./meta";
import { columnCost, honeCostOf } from "../engine/world";
import { typeRarityOf } from "../engine/constants";
import { formatBalance, formatInt, formatNumber, formatPracticeMinutes, chordTermLabel, practiceCountdown } from "./format";
import { renderBoardLedger, renderGameInfoStrip, rateDetailsHtml, updateRateDetailsLive, deployedRosterKey, unlockedCount, wireSynthPicks, FEATS_SVG, LIBRARY_SVG, ARETE_SVG, CAPACITY_SVG, SCRAP_SVG } from "./ledger";
import { closeTooltips, wireTooltips } from "./instrument";
import { instancesByClass, instancesKeyOf, libraryHeaderHtml, libraryIndexRowHtml, libraryStageHtml } from "./library";
import { profileGradesHtml } from "./profile";
import { discoveryCount, discoveryBoostOf, rootsHeardOf } from "../engine/library";
import { boardBounds, bindBoardNavigation, lensFrame, renderZoomCluster, syncGlowLens } from "./zoom";
import { beginLayoutPass, containerWidth, endLayoutPass, RATE_DETAILS_BREAKPOINT_PX, isPhoneWidth, PHONE_MAX_PX, viewportWidth, scrollTopOf } from "./container";
import { liveAttr, liveSet } from "./live";
import {
  mutatorTileInner,
  mutatorEffectText,
  FAMILY_WORD,
} from "./mutators";
import { hexFromAttr } from "./world";
import {
  bindWorldLayer,
  worldBoardLive,
  worldGridDecorations,
  worldLensCoordinates,
  worldAskHtml,
  worldPlacementPreview,
  worldPreviewHtml,
  worldCountBadge,
  worldTileSvg,
  renderWorldPill,
  renderWorldTrayContent,
  bindWorldDrag,
  layerLegendHtml,
  renderLayerLegend,
} from "./world";

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
  return displayedRates(state, flowLive(state));
}

export function render(app: App): void {
  // The pass's layout reads land first, in one batch (#349): the #app
  // inline size and the viewport read once here, before any board write —
  // every gate below reads the batch, so the pass never interleaves a
  // layout read between writes.
  const devStage = app.dev ? devStageBox() : null;
  beginLayoutPass();
  try {
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
    renderConsoleSession(app);
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
    // cross-section standing where the grid stood, at every width. The chord
    // row is the readout's own grammar, computed here so the reserved
    // vocabulary never forks (render owns it, the detail mounts it). The
    // row's rebuild key rides beside it (#349).
    const detailChord = app.ui.detail
      ? detailChordRow(app, app.state.mode === "upgrade" ? projected : live)
      : { html: "", key: "", marks: [] };
    renderHexDetail(app, live, projected, detailChord);
    renderZoomCluster(app);
    renderGameInfoStrip(app, live);
    // The second face's furniture (issue #426): the vertical layer legend
    // and the armed placement's pill — each a no-op wherever its moment
    // isn't now.
    renderLayerLegend(app);

    renderWorldPill(app);
    renderModal(app, live, projected);
    renderDev(app, devStage);
    renderDevBoard(app);
  } finally {
    endLayoutPass();
  }
}

/* ── Console (ADR-0012) ────────────────────────────── */

// One native Focus door owns logo, habit, clock, and the gaps between them.
function wireClockPlan(app: App): void {
  app.listen(byId("clock-plan"), "click", () => app.showFocusFace("plan"));
}

// Session controls (issue #148, grouped by #331) and the display panel
// (the header-status brief): the door recomposed as a synth display — the
// hypercube badge on the chassis, the display well carrying the full-height
// clock leading its program block (habit over caption, the provisional line
// when the honesty pool holds), and the selected habit's goal meter closing
// the well at its right edge. Then the Enter/Exit main switch — the
// console's visual center of gravity and its sole session gate — with pause
// beside it during flow. The switch's vermillion carries the session state:
// the switch itself and the progress strip along the header's bottom edge
// (issue #63); the meter wears its goal's own palette token. The console is
// pure control (§7): the clock is itself the plan affordance — its
// disclosure opens the Focus control sheet (ADR-0050, the time app's PLAN
// face) — and no production readout lives here. The sheet itself anchors
// beneath the clock's own disclosure, whatever face it carries.
// The unified Focus door includes the logo, selected habit, clock, and goal
// meter. All four are reads inside one button; the sheet owns editing.
const UNSTRUCTURED_WORD = "none selected";

// The device mark (the header-status brief, provisional): the inventory
// hypercube with its filled core — the collapsed inventory's symbol adopted
// as the app badge until a round names a permanent one.
const BRAND_MARK = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m12 7 4.5 2.5v5L12 17l-4.5-2.5v-5ZM3 7l4.5 2.5M21 7l-4.5 2.5M3 17l4.5-2.5M21 17l-4.5-2.5M12 2v5m0 10v5"/><path class="brand-core" d="m12 9.8 1.9 1.1v2.2L12 14.2l-1.9-1.1v-2.2Z" fill="currentColor" stroke="none"/></svg>`;

// Completion's engraved check rides the practice name (the header-status
// brief, amended): the meter column stays flush at the well's right edge,
// so the done mark lives with the read it completes — never color alone
// (the meter's aria read carries "complete" beside it).
const HABIT_DONE_MARK = `<svg class="habit-done" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 5.5 4 8l4.5-6"/></svg>`;

// The group's one habit-read source: the chosen habit's name, or null for
// the unstructured choice — the builder escapes it, the patcher writes it
// as text, and both fall back to the one word.
function chosenHabitName(state: GameState): string | null {
  return activeHabit(state)?.name ?? null;
}

// The session group's habit read: the name, with the displayed goal's done
// mark riding it (the header-status brief, amended).
function sessionHabitHtml(app: App): string {
  const name = chosenHabitName(app.state);
  const done = goalMeterOf(app.state)?.done ?? false;
  return `<span class="session-habit" id="session-habit"><span class="bread${name ? "" : " unselected"}" data-session="habit">${name ? escapeHtml(name) : UNSTRUCTURED_WORD}</span>${done ? HABIT_DONE_MARK : ""}</span>`;
}

function renderConsoleSession(app: App): void {
  const { state, ui } = app;
  const phone = isPhoneWidth();
  const host = byId("console-session");
  if (!host) return;

  const logo = byId("console-logo");
  if (logo && !logo.firstChild) logo.innerHTML = BRAND_MARK;
  // The console's mode attribute (the header-status iteration): the brand
  // mark's core is the mode lamp and the session strip wears the state
  // color — both keyed off this one attribute, so the lamp, the strip,
  // and the switch's own state can never disagree.
  const consoleEl = host.closest<HTMLElement>(".console");
  if (consoleEl) consoleEl.dataset.mode = state.mode;
  const preserveNotes = () => {
    const apps = byId("console-apps");
    if (apps && host.contains(apps)) host.parentElement?.append(apps);
  };
  // One visible action name, inside its native button at every width.
  const enterFlowWord = "Enter flow";
  const endFlowWord = "Finish flow";
  const statusWords = { upgrade: "Upgrade mode", flow: "Flow active", paused: "Flow paused", breather: "Breather active" };
  let identity = byId("console-identity");
  if (!identity && logo) {
    identity = document.createElement("div");
    identity.id = "console-identity";
    identity.innerHTML = '<span class="console-wordmark">FlowSynth</span><span id="console-status" role="status"></span>';
    logo.after(identity);
  }
  const status = byId("console-status");
  if (status && status.textContent !== statusWords[state.mode]) status.textContent = statusWords[state.mode];
  const pauseSvg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5v14M15 5v14"/></svg>`;
  const resumeSvg = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5.5v13l10.5-6.5Z"/></svg>`;
  const discloseSvg = `<svg class="clock-disclose" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 4.5 3.5 3.5 3.5-3.5"/></svg>`;

  // The display panel: digits lead — the full-height clock with its small
  // disclosure chevron — and the program block follows: the habit name, the
  // caption beneath, the provisional line when the honesty pool holds. The
  // goal meter closes the well at its right edge. One stable composition in
  // both modes, so the live clock never shifts vertically; the meter's slot
  // closes entirely when nothing qualifies (the header-status brief's empty
  // state). The id attributes ride in only on the flow side, where the tick
  // patcher addresses the nodes directly.
  const focusButton = (title: string, clockAttrs = "", captionAttrs = ""): string => `
      <button class="session-focus" id="clock-plan" aria-label="Focus controls" title="${title}">
        <span class="display-well">
          <span class="clock-row">
            <span class="session-clock mono"${clockAttrs}></span>
            ${phone ? "" : discloseSvg}
          </span>
          <span class="program-block">
            ${sessionHabitHtml(app)}
            <span class="clock-caption"${captionAttrs}></span>
            ${state.mode !== "upgrade" ? '<span class="clock-provisional" id="session-provisional" role="status"></span>' : ""}
          </span>
          ${goalMeterHtml(app)}
        </span>
      </button>`;

  // The Focus control sheet anchors beneath the clock's own disclosure
  // (ADR-0050): the phone Focus door walks here too — one frame, four
  // faces. Its signature rides the rebuild key; the body is only
  // string-built when that key changes (every flow tick takes the patch
  // path below). Notes left the frame for its own centered modal
  // (issue #332) — the modal layer owns it.
  const sheetOpen = ui.app !== null;
  const popoverKey = sheetOpen ? `sheet|${focusSheetKey(app)}` : "shut";
  const sheetHtml = () => focusSheetHtml(app);
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
    const key = `upgrade|${phone ? "phone" : "wide"}|${popoverKey}|${sessionReadsKey(app)}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      const scrollTop = popoverScroll(host);
      preserveNotes();
      host.innerHTML = `
        <div class="session-group" role="group" aria-label="Session">
          <button id="pause-flow" aria-label="Pause" disabled>${pauseSvg}</button>
          <div class="clock-anchor">
            ${focusButton("Opens the Focus sheet")}
            ${sheetOpen ? sheetHtml() : ""}
          </div>
          <div class="session-actions">

            <button class="main-switch idle" id="flow-switch" aria-label="${enterFlowWord}" title="The board locks and runs itself">${enterFlowWord}</button>

          </div>
        </div>
      `;
      wireClockPlan(app);
      app.listen(byId("flow-switch"), "click", () => app.startFlow());
      bindSheet(scrollTop);
    } else if (sheetOpen) {
      updateFocusSheetLive(app, host);
    }
    refreshConsoleClockPlan(app);
    refreshSessionReads(app);
    renderSessionStrip(false);
    syncClockDisclosure(app);
    return;
  }

  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const reached = target !== null && elapsed >= target;

  // The breather's console (docs/breather-spec.md §5): the board reads
  // exactly as in flow, no pause exists, and the main switch — the one
  // session gate — is the early exit. The clock reads the remaining
  // allowance; the strip fills toward it; the provisional line never
  // stands (breather time is pre-trusted).
  if (state.mode === "breather" && state.breather) {
    const breather = state.breather;
    const key = `breather:${phone ? "phone" : "wide"}`;
    if (host.dataset.renderKey !== key) {
      host.dataset.renderKey = key;
      const scrollTop = popoverScroll(host);
      preserveNotes();
      host.innerHTML = `
        <div class="session-group" role="group" aria-label="Session">
          <button id="pause-flow" aria-label="Pause" disabled>${pauseSvg}</button>
          <div class="clock-anchor">
            ${focusButton("Opens the Focus sheet", ' id="session-clock"', ' id="session-caption"')}
            ${sheetOpen ? sheetHtml() : ""}
          </div>
          <div class="session-actions">

            <button class="main-switch live" id="flow-switch" aria-label="End breather" title="Ends the breather and returns to upgrade mode">End breather</button>

          </div>
        </div>
      `;
      wireClockPlan(app);
      app.listen(byId("flow-switch"), "click", () => app.endBreather());
      bindSheet(scrollTop);
    }
    const setBreather = (id: string, text: string) => {
      const node = byId(id);
      if (node && node.textContent !== text) node.textContent = text;
    };
    setBreather("session-clock", formatClock(Math.max(0, breather.allowanceSeconds - breather.elapsed)));
    setBreather("session-caption", "Breather");
    setBreather("session-provisional", "");
    renderSessionStrip(true, breather.elapsed, breather.allowanceSeconds, false);
    refreshSessionReads(app);
    syncClockDisclosure(app);
    if (sheetOpen) updateFocusSheetLive(app, host);
    return;
  }

  const key = `flow:${phone ? "phone" : "wide"}:${state.mode}:${target === null ? "open" : reached ? "reached" : "timed"}|${popoverKey}|${sessionReadsKey(app)}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    const scrollTop = popoverScroll(host);
    preserveNotes();
    host.innerHTML = `
      <div class="session-group" role="group" aria-label="Session">
          <button id="pause-flow" aria-label="${paused ? "Resume" : "Pause"}" title="${paused ? "Resume the session" : "Pause the session"}">${paused ? resumeSvg : pauseSvg}</button>
        <div class="clock-anchor">
          ${focusButton("Opens the Focus sheet", ' id="session-clock"', ' id="session-caption"')}
          ${sheetOpen ? sheetHtml() : ""}
        </div>
        <div class="session-actions">

          <button class="main-switch ${paused ? "held" : "live"}" id="flow-switch" aria-label="${endFlowWord}" title="Ends the session and banks its production">${endFlowWord}</button>

          </div>
        </div>
      `;
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
  refreshSessionReads(app);
  syncClockDisclosure(app);
  if (sheetOpen) updateFocusSheetLive(app, host);
}

// The clock's disclosure state: expanded while the sheet stands under it —
// the frame anchors beneath the clock's own disclosure whatever face it
// carries, so the anchor reports the sheet, not just the PLAN face.
// Patched in place on the tick path, where the key is unchanged; opening
// and closing the sheet rebuilds the cluster with the sheet itself.
function syncClockDisclosure(app: App): void {
  const open = app.ui.app !== null;
  byId("clock-plan")?.setAttribute("aria-expanded", String(open));
  byId("clock-plan")?.classList.toggle("open", open);
  const door = byId("clock-plan");
  if (door) door.setAttribute("aria-label", `Focus controls, ${chosenHabitName(app.state) ?? UNSTRUCTURED_WORD}, ${door.querySelector(".session-clock")?.textContent ?? ""} ${door.querySelector(".clock-caption")?.textContent ?? ""}`);
}

// The display well's goal meter (the header-status brief): the selected
// habit's progress as a vertical LED column at the well's right edge — the
// nearest-to-completion qualifying goal lighting it bottom-up and the
// count mark answering for the rest still in play. Completion's engraved
// check rides the practice name in the program block; the column itself
// never leaves the edge — never color alone. Reads live during flow and
// mutate nothing: the derivation reads existing state alone, and the live
// patch below only ever touches segment classes and text. Nothing
// qualifies, the meter does not stand — the well closes over its slot.
// The column's one lit spelling: the lit count both the markup and the
// in-place patch read, so the two can never drift.
function meterLitCount(fraction: number): number {
  return Math.min(GOAL_METER_SEGMENTS, Math.floor(fraction * GOAL_METER_SEGMENTS + 1e-9));
}

// A display-only tooltip trigger: the meter speaks its gloss on hover,
// keyboard focus (its own tab stop inside the door). Activation, including
// touch, opens PLAN with the rest of the door.
let meterTipSequence = 0;

function goalMeterHtml(app: App): string {
  const read = goalMeterOf(app.state);
  if (!read) return "";
  const tip = `goal-meter-tip-${++meterTipSequence}`;
  const lit = meterLitCount(read.fraction);
  const segs = Array.from({ length: GOAL_METER_SEGMENTS }, (_, i) => `<i class="gm-seg${i < lit ? " lit" : ""}"></i>`).join("");
  return `<span class="goal-meter inst-tip" id="goal-meter" role="img" tabindex="0" aria-label="${escapeHtml(read.aria)}" aria-describedby="${tip}" style="--gm-color:var(--habit-${read.color})">
          <span class="gm-row" aria-hidden="true">
            <span class="gm-track">${segs}</span>
          </span>
          <span class="inst-tip-body" id="${tip}" role="tooltip">${escapeHtml(read.label)}</span>
        </span>`;
}

// The reads' rebuild signature: which meter stands (its palette key and
// done mark — a re-pick or completion must rebuild), and the habit —
// the session group's own read rides the same cluster key, so a selection
// change lands in one rebuild. The fraction deliberately stays out: the
// live patch moves it without a rebuild.
function sessionReadsKey(app: App): string {
  const read = goalMeterOf(app.state);
  return `${activeHabit(app.state)?.id ?? "—"}|${read ? `${read.color}${read.done ? 1 : 0}` : "—"}`;
}

// The reads' in-place patch: the habit name and the meter's lit steps move
// without a rebuild — the live clock's neighbor stays live during flow
// (ADR-0050), and a manual log's progress lands between renders too.
function refreshSessionReads(app: App): void {
  setText(document.querySelector('#console-session [data-session="habit"]'), chosenHabitName(app.state) ?? UNSTRUCTURED_WORD);
  const meter = byId("goal-meter");
  if (!meter) return;
  const read = goalMeterOf(app.state);
  if (!read) return;
  const lit = meterLitCount(read.fraction);
  meter.querySelectorAll<HTMLElement>(".gm-seg").forEach((seg, i) => seg.classList.toggle("lit", i < lit));
  meter.setAttribute("aria-label", read.aria);
  const tipId = meter.getAttribute("aria-describedby");
  const tip = tipId ? document.getElementById(tipId) : null;
  if (tip) setText(tip, read.label);
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

// Focus-app access (ADR-0012, ADR-0050; #313): bare uncarded icon doors.
// The clock block is the Focus sheet's one wide entry — its faces switch
// inside the sheet — and Notes keeps its own door, capture being a distinct
// action; the door opens the Notes modal (issue #332), not a frame here.
// The phone banner carries the same pair it always did: the Focus
// sheet's door and Notes (ADR-0050's amended phone line). Time wears no
// door at any width: the console clock's disclosure opens the sheet's PLAN
// face. (Display names live in meta.ts's APP_LABELS.)

// A popover's scroll rides its host's rebuild (#115): captured before the
// innerHTML swap, restored once the fresh sheet binds — one shape, one
// spelling, shared by every face the clock's frame carries.
function popoverScroll(host: HTMLElement): number {
  return scrollTopOf(host.querySelector<HTMLElement>(".app-popover"));
}

function restorePopoverScroll(host: HTMLElement, scrollTop: number): void {
  const popover = host.querySelector<HTMLElement>(".app-popover");
  if (popover && scrollTop > 0) popover.scrollTo(0, scrollTop);
}

// The one focus-app glyph every door-wearing tile wears — so the spelling
// can never drift between access points.
function appGlyphSvg(appKey: Exclude<FocusApp, "time">): string {
  return `<svg viewBox="-12 -12 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${appIcon(appKey)}</svg>`;
}

// Notes keeps its separate capture door; Focus opens from the session
// surface itself at every width. Tracker state stays inside the sheet.

function renderConsoleApps(app: App): void {
  const host = byId("console-apps");
  if (!host) return;
  const { ui } = app;
  const anchor = document.querySelector(".clock-anchor");
  if (anchor && host.parentElement !== anchor) anchor.insertBefore(host, anchor.querySelector(".app-popover"));
  const phone = isPhoneWidth();
  // The doors' pressed states ride the open app; everything the sheets
  // show lives under the clock's own key.
  const key = `${phone ? "phone" : "wide"}|${ui.app}`;
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  // The Focus sheet anchors beneath the session clock; the Notes door
  // opens its centered modal instead (issue #332), so no tile wears an
  // open marker for it.
  const doorKeys = TILE_APPS;
  const tiles = doorKeys
    .map((doorKey) => {
      const appKey = doorKey as Exclude<FocusApp, "time">;
      const label = APP_LABELS[appKey];
      const open = ui.app === appKey;
      return `<div class="app-slot">
      <button class="app-tile${open ? " open" : ""}" id="app-tile-${appKey}" aria-pressed="${open}" aria-label="${label}" title="${label} app">
        <span class="app-tile-glyph">
          ${appGlyphSvg(appKey)}
        </span>
      </button>
    </div>`;
    })
    .join("");
  host.innerHTML = `<div class="app-tiles">${tiles}</div>`;
  for (const doorKey of doorKeys) {
    app.listen(byId(`app-tile-${doorKey}`), "click", () => {
      // The Notes door toggles (issue #332): a press on the standing
      // modal's own door puts it away; the Focus door keeps openApp's
      // toggle.
      if (doorKey === "notes" && app.ui.modal === "notes") app.closeModal();
      else app.openApp(doorKey);
    });
  }
}

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
  return { chargeDelivered: flowLive(app.state) && chargeDelivered(projected) };
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
    <span class="gbar" aria-hidden="true"><i style="height:${(fraction * 100).toFixed(1)}%"></i></span>
    <span class="ach-icon" aria-hidden="true">${def.icon}</span>
    <div class="ach-body">
      <div class="ach-head">
        <span class="ach-name">${def.name}</span>
        <span class="ach-effect mono">${FEAT_EFFECT_READ}</span>
        ${readout}
      </div>
      <p class="ach-desc">${def.description}</p>
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
    <p class="lead">Every feat speeds the rate a little — they accelerate, never gate. Each one adds into the Feats factor of the rate details, already included in the board's rate.</p>
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
      <button class="collection-row" id="collection-feats">${FEATS_SVG}<span class="t-condensed">Feats</span><span class="mono">${feats}/${ACHIEVEMENTS.length}</span></button>
      <button class="collection-row" id="collection-chords">${LIBRARY_SVG}<span class="t-condensed">Chords</span><span class="mono">${chords}/${NAMED_CHORDS.length}</span></button>
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
// charge branch's figures are Forge progress points and its rate the
// projected contribution. The practice-roll meter (issue #423) reads only
// where its meter renders — the Focus sheet's habit/class face — so the
// dock detail carries the shared queue's counts alone.
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
  const bankedNote = banked > 0 ? ` · ${banked} banked module roll${banked === 1 ? "" : "s"}` : "";
  const mutBanked = state.bankedMutatorRolls.length;
  const mutNote = mutBanked > 0 ? ` · ${mutBanked} banked mutator roll${mutBanked === 1 ? "" : "s"}` : "";
  const mutLine = state.catalogEntryOwned ? ` · ${mutatorForgeMeterLine(state, mutatorRate)}${mutNote}` : "";
  return `${forgeMeterLine(state, forgeRate)}${bankedNote}${mutLine}`;
}

// Every meter bar's fill: the clamped progress share, one build for the
// dock pip and the modal's card-scale bars alike — the shared column
// fills by height.
function meterPipFill(progress: number, cap: number): string {
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
        app.state.bankedRolls.length + app.state.bankedMutatorRolls.length > 0 ? `<b class="tool-badge mono">${app.state.bankedRolls.length + app.state.bankedMutatorRolls.length}</b>` : "",
      // The pip retired with the player-wide flow meter (issue #423): the
      // practice-roll meter is pair-owned and renders only on the Focus
      // sheet's habit/class face; the switch keeps the shared queue's
      // badge, where banked-roll counts have always read.
      // Hover, focus, or tap opens the one detail — the meter read. In
      // flow it is suffixed with the lock reason (#233): the sheet never
      // expands during a session, and the badge stays as the visual
      // indicator.
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
        // On the World face the purchase's frontier lives on Modules, so
        // the Add walks there first (issue #426).
        if (app.ui.detail) app.closeDetail();
        if (app.state.mode === "upgrade" && app.ui.boardLayer === "world") {
          app.setBoardLayer("modules");
        }
        if (app.ui.buyingCell) app.cancelCellPurchase();
        else app.armCellPurchase();
      },
      // The resting read quotes the next cell's price against the board's
      // pace — the figure a player weighs before arming (#272 review, one
      // detail writer under #354's live pass).
      title: (app, projected) => {
        if (app.state.mode !== "upgrade") return "Add — purchases happen between sessions";
        if (app.ui.boardLayer === "world") return "Add — cell purchases live on the Modules face";
        if (app.ui.buyingCell) return "Pick a frontier hex · Esc cancels";
        const price = cellCost(app.state.cellsBought);
        const countdown = practiceCountdown(price, wholeNous(app.state), projected.rate);
        return `Add — ${formatInt(price)} ν${countdown ? ` · ${countdown}` : ""}`;
      },
      disabled: (app) => app.state.mode !== "upgrade",
      active: (app) => app.ui.buyingCell,
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
        app.state.mode !== "upgrade" ? "Inventory — the board is locked between sessions" : "Inventory — the board-surface tray, tapped open",
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

// The Catalog door's mark (issue #336): the square-cut rack carrying the
// upward arrow — board upgrades and unlocks rising out of the rack. One
// glyph family away from the layer legend's symbols, and a replacement for
// the retired stacked-layer glyph those symbols read against.
const TOOL_CATALOG_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="11" width="15" height="9.5"/><path d="M4.5 15.75h15"/><path d="M12 11V4M8.5 7.5 12 4l3.5 3.5"/></svg>`;
const TOOL_FORGE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.8 3.2-3.2 4.6-3.2 8.4a3.2 3.2 0 0 0 6.4 0c0-1.4-.6-2.3-1.1-2.9 1.9.5 3.4 2 3.4 4.3a5.5 5.5 0 0 1-11 0C6.5 7.6 10.8 6.4 12 3Z"/></svg>`;

// The left-edge icon dock (§7): Catalog / Forge (count badge + charge pip)
// / Add, floating over the board's left edge (issue #272 — the Inventory
// icon left with the tray's collapse toggle). Hidden on portrait phone,
// where the same actions plus Inventory and Collection ride the bottom
// thumb bar. Every icon's extended description lives in the tooltip layer
// (issue #354) — hover, focus, and touch open it, Escape dismisses it.
const toolDisclosureApps = new WeakSet<App>();

function renderTools(app: App, projected: RateSnapshot): void {
  if (!toolDisclosureApps.has(app)) {
    toolDisclosureApps.add(app);
    app.listen(document, "pointerdown", (event) => {
      const trigger = event.target instanceof Element ? event.target.closest(".tool-icon") : null;
      document.querySelectorAll<HTMLElement>(".tool-detail").forEach((detail) => {
        if (detail.parentElement !== trigger) {
          detail.hidden = true;
          detail.parentElement?.setAttribute("aria-expanded", "false");
        }
      });
    });
  }
  const { state, ui } = app;
  const host = byId("board-tools");
  const thumb = byId("thumb-bar");
  const actions = toolActions();
  // The dock carries the board actions; Inventory and Collection ride the
  // thumb bar alone on phone — Inventory taps the tray's sheet (the column
  // never collapses, so the dock needs no toggle), and Collection is the
  // feats/chords launcher where the ledger dissolves (issue #270).
  const dockActions = actions.filter((action) => action.op !== "collection" && action.op !== "inventory");
  const forgeCount = state.bankedRolls.length + state.bankedMutatorRolls.length;
  const trayCount = state.modules.filter((m) => m.pos === null).length;
  const key = JSON.stringify(["dock", state.mode, ui.boardLayer, ui.worldArmed, forgeCount, ui.buyingCell, trayCount, worldCountBadge(app)]);

  for (const [target, list] of [
    [host, dockActions],
    [thumb, actions],
  ] as const) {
    if (!target) continue;
    if (target.dataset.renderKey !== key) {
      target.dataset.renderKey = key;
      target.innerHTML = list
        .map((action) => {
          // Every icon's extended description rides the tooltip layer
          // (issue #354, the forge pattern generalized): a role=tooltip
          // span described-by the trigger, opened by hover, focus, and
          // touch, dismissed by Escape — title= is no channel at all.
          const detailId = `${target.id}-${action.op}-detail`;
          const detail = `<span id="${detailId}" class="tool-detail" role="tooltip" hidden>${action.title(app, projected)}</span>`;
          // The flow lock (#336): in flow the actions the mode gates wear
          // the shared padlock chip — the non-color unavailability mark, on
          // top of the dimmed content. The chip keys to the gate the action
          // itself declares, so a control the mode never closes (Collection)
          // stands bare beside the locked row; in upgrade mode nothing wears
          // it and an affordability mute stays a mute, never a lock.
          // aria-disabled keeps disclosure focusable; the click guard blocks actions.
          const lock = state.mode !== "upgrade" && action.disabled?.(app) ? `<span class="tool-lock" aria-hidden="true">${lockMarkSvg()}</span>` : "";
          const extra = (action.badge?.(app) ?? "") + (action.media ?? "") + detail + lock;
          return `<button class="tool-icon${action.active?.(app) ? " active" : ""}" id="${target.id}-tool-${action.op}" data-op="${action.op}" aria-label="${action.label}" aria-describedby="${detailId}" aria-expanded="false" aria-disabled="${action.disabled?.(app) ?? false}" aria-pressed="${action.active?.(app) ?? false}">${action.svg}${extra}<small class="tool-word">${action.label}</small></button>`;
        })
        .join("");
      target.querySelectorAll<HTMLButtonElement>("[data-op]").forEach((button) => {
        const detail = button.querySelector<HTMLElement>(".tool-detail")!;
        let hovered = false;
        // First tap inspects; a second tap on the open read activates.
        let inspectTouch = false;
        let touching = false;
        app.listen(button, "pointerdown", (event) => {
          touching = event.pointerType === "touch";
          inspectTouch = touching && detail.hidden;
          if (touching) hovered = false;
          if (event.pointerType === "touch") {
            detail.hidden = false;
            button.setAttribute("aria-expanded", "true");
          }
        });
        // The detail's hidden flag is the one state; aria-expanded mirrors
        // it on every access path — hover, keyboard focus, Escape — so the
        // trigger never announces "collapsed" while the read stands open.
        const report = () => button.setAttribute("aria-expanded", String(!detail.hidden));
        app.listen(button, "mouseenter", () => { if (touching) return; hovered = true; detail.hidden = false; report(); });
        app.listen(button, "mouseleave", () => {
          hovered = false;
          detail.hidden = document.activeElement !== button;
          report();
        });
        app.listen(button, "focus", () => { detail.hidden = false; report(); });
        app.listen(button, "blur", () => { detail.hidden = !hovered; report(); });
        app.listen(button, "keydown", (event) => {
          if (event.key === "Escape" && !detail.hidden) {
            // The tip goes alone; focus stays on the trigger.
            detail.hidden = true;
            report();
            event.stopPropagation();
          }
        });
        app.listen(button, "click", () => {
          if (inspectTouch) { inspectTouch = false; return; }
          if (button.getAttribute("aria-disabled") === "true") return;
          actions.find((action) => action.op === button.getAttribute("data-op"))!.run(app);
        });
      });
    }
  }

  // Live under the structural rebuild: every icon's detail read patches in
  // place (#354), and the cell icon wears the current price and
  // affordability. The practice-roll meter's fill reads on the Focus sheet
  // (issue #423), so no dock pip tracks it.
  for (const target of [host, thumb]) {
    if (!target) continue;
    for (const action of actions) {
      const button = target.querySelector<HTMLButtonElement>(`[data-op="${action.op}"]`);
      const detail = button?.querySelector<HTMLElement>(".tool-detail");
      if (detail) detail.textContent = action.title(app, projected);
    }
    const forgeButton = target.querySelector<HTMLButtonElement>('[data-op="forge"]');
    if (forgeButton) forgeButton.setAttribute("aria-disabled", String(actions.find((a) => a.op === "forge")!.disabled?.(app) ?? false));
    const cellButton = target.querySelector<HTMLButtonElement>('[data-op="cell"]');
    if (cellButton && state.mode === "upgrade") {
      // The Add icon carries the cell arm (issue #426: the World face has
      // no Add arm — the walk to Modules is the gesture). The detail text
      // is the generic pass's write — the title closure owns the read.
      cellButton.classList.toggle("active", ui.buyingCell);
      cellButton.setAttribute("aria-pressed", String(ui.buyingCell));
      if (ui.buyingCell) {
        cellButton.setAttribute("aria-disabled", "false");
      } else {
        cellButton.setAttribute("aria-disabled", String(wholeNous(state) < cellCost(state.cellsBought)));
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
  const overlay = chordOverlay({
    namedChords: live.namedChords,
    // The recognized-but-idle candidates (issue #258): the board sings
    // them, the allocation didn't select them. They stay in the mark list
    // — the readout's "N idle" count and the Hex detail's chord row read
    // them here — but the grid never draws their geometry. Absent
    // an allocation read, nothing is idle — the plain recognizer's every
    // term is already in namedChords.
    inactiveChords: live.allocation ? idleTermsOf(live.allocation) : [],
    posOf: (id) => deployedById.get(id)?.pos ?? null,
    point,
    radius: HEX_RADIUS,
    step: LATTICE_STEP,
    labelFor: chordTermLabel,
    focusIds: [],
    focusPoint: null,
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
  if (!ui.worldCarrying && !ui.worldArmed) ui.worldDropHover = null;
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
  // The World face's authored positions join the bounds while the layer
  // stands (issue #426): enemies sit on coordinates the owned patch may
  // not cover, and the lens holds the whole face.
  const worldLive = worldBoardLive(app);
  const worldCoords = worldLive ? worldLensCoordinates() : [];
  const allCells = [...state.cells, ...frontier, ...worldCoords, ...bands.flatMap((band) => band.hexes)];
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

  const flow = flowLive(state);
  const snapshot = live;
  // The World layer owns the board's drawing (issue #426, the Mutator
  // Grid's discipline, issues #298 and #386): while it stands — flow
  // reading it now too — the renderer emits the layer's plates alone:
  // module faces, the empty-cell artwork, chord marks, charge leads, and
  // the would-form ghosts never enter the svg, so nothing can leak beneath
  // and no module gesture surface survives to collide with the layer's.
  // The lens still reads the owned lattice and the authored positions, so
  // zoom and pan hold still across the switch.
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
  if (!worldLive) {
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
    // whispering in the gaps; no chord ever crosses a face. The idle
    // candidates remain readout facts only; inspection emphasizes active marks.
    html += `<g data-key="chord-marks">${overlay.marks
      .filter((mark) => !mark.inactive)
      .map((mark) => chordMarkHtml(mark, "formed"))
      .join("")}</g>`;
  }

  if (!worldLive) {
    for (const pos of state.cells) {
      const [x, y] = point(pos);
      const module = deployedAt(state, pos);
      const drop = dropRegister(app, pos);
      const label = module ? `${META[module.type].name} at ${cellNoteOf(pos)}` : `Empty cell · ${cellNoteOf(pos)}`;
      if (module) {
        html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${label}">`;
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
      html += `<g class="cell-node" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${label}">
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
  }

  // The would-form ghosts (§5–§6): dashed seams and outlines over the
  // chords the hovered drop or placement would form, one per forming
  // chord — these stay OVER the modules (the promise reads on top). They
  // wear the same seam language as the formed chords (brackets, runs,
  // note-corner polygons — #201), promising in the vocabulary the chord
  // will land in. No module gesture can stand on the Mutators layer, so
  // the group never draws there (issue #386).
  if (!worldLive) html += `<g data-key="ghost-chords">${ghostMarksHtml(app, projected)}</g>`;

  // The Mutator Grid's drawing (issue #199): the second layer's faces — one
  // per owned coordinate while the Mutators tab stands (issue #386), the
  // presence outlines while Modules does.
  html += worldGridDecorations(app, projected);

  updateSvg(svg, html);
  // The breathe rides the lens (issue #348): hexes the current view can't
  // see rest their glow, here and on every pan the lens takes.
  syncGlowLens(svg, lens.view);
  bindGridEvents(app, svg);
  bindFaceBuys(app, svg);
  bindWorldLayer(app, svg);
  updateChordReadout(app);
  updateChordEmphasis(app);
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
// ── Rack Extenders' shaded rows (issue #197, #174's approved surface; the
// product name, 2026-10-10 steering) ──
// In add-cell mode, each still-locked octave row just past the launch band
// renders shaded violet behind a single
// "Rack Extenders · unlock this octave row · ⟨Arete⟩" banner — the unlock
// is one unit per row, cost over the whole thing, one
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
      const label = `Rack Extenders · unlock this octave row · ${band.cost} Arete`;
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
  const emphasis = ghost ? " ghost-mark" : "";
  // Idle geometry is reserved for placement ghosts, never the formed layer.
  const idle = mark.inactive ? " chord-idle" : "";
  const style = `--cc:var(--${mark.colorVar});--seam-dur:${mark.duration}s`;
  const lines = mark.outline
    ? `<polygon class="chord-seam chord-loop" points="${mark.outline.map((p) => p.join(",")).join(" ")}"/>`
    : mark.seams
        .map(
          (s) =>
            `<line class="chord-seam${ghost ? " ghost-seam" : ""}" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`,
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
export function updateChordReadout(app: App): void {
  const host = byId("chord-readout");
  if (!host) return;
  wireTooltips(host, app.signal);
  const cache = chordReadoutCache.get(app);
  const snapshot = cache?.snapshot;
  const hover = app.ui.chordHover;
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
  // The World placement's lift preview (issue #426): the moved occupant's
  // and its neighbors' routing before → after, from the engine's one lift
  // function — the gesture owns the same reserved spot.
  const worldHover = app.ui.worldDropHover;
  if (worldHover) {
    const worldPreview = worldPlacementPreview(app.state, worldHover.id, worldHover.pos);
    if (worldPreview) {
      host.hidden = false;
      setReadoutHtml(host, worldPreviewHtml(worldPreview));
      return;
    }
  }
  // The World layer's ask (issue #426): the hovered plate's full
  // declaration in the World register. One spot, never floating over the
  // board.
  if (!worldHover && hover?.kind === "world") {
    host.hidden = false;
    setReadoutHtml(host, worldAskHtml(app, hover.pos, snapshot ?? displayedRates(app.state, true)));
    return;
  }
  const hovered =
    hover?.kind === "module" ? (app.state.modules.find((m) => m.id === hover.moduleId) ?? null) : null;
  // Every chord the module earns its bonus from — not just the first; the
  // conducting spacer's own containment rule rides moduleChips (#201).
  const chosen = marksForAsk(app);
  const focus = hovered;
  const active = chosen.filter((mark) => !mark.inactive);
  const idleCount = chosen.length - active.length;
  const rows: string[] = [];
  const contribution = focus && snapshot?.contributions.get(focus.id);
  const headline: string[] = [];
  if (focus && isOscillatorType(focus.type) && snapshot) {
    headline.push(compactReadoutRow(`+${formatNumber(contribution?.value ?? 0)} ν/s`, "value"));
  }
  if (focus && isVoiceType(focus.type) && snapshot?.allocation) {
    const used = snapshot.allocation.used.get(focus.id) ?? 0;
    const capacity = voiceBudgetOf(snapshot.allocation, focus.id);
    // A plain chip (issue #334): the transient readout carries no
    // interactive terms — the budget's deeper facts stay with the
    // click-open Hex detail.
    headline.push(`<span class="chord-readout-chip chord-readout-capacity mono">(${used}/${capacity}) ${CAPACITY_SVG.replace(/>\s+</g, "><")}</span>`);
  }
  if (headline.length) rows.push(`<div class="chord-readout-headline">${headline.join("")}</div>`);
  const marks = focus ? active : chosen;
  rows.push(...marks.map((mark) => compactReadoutRow(
    mark.inactive ? `${mark.label} · idle` : mark.label,
    `chord${mark.inactive ? " chord-readout-idle" : ""}`,
    mark.colorVar,
  )));
  if (contribution && contribution.formationQ !== 1) {
    rows.push(compactReadoutRow(`Formation ×${formatNumber(contribution.formationQ)}`, "formation"));
  }
  if (focus && idleCount) rows.push(compactReadoutRow(`${idleCount} idle`, "idle"));
  if (focus && isVoiceType(focus.type) && snapshot?.allocation && !snapshot.allocation.certified) {
    rows.push(compactReadoutRow("Allocation uncertified", "uncertified"));
  }
  host.hidden = rows.length === 0;
  setReadoutHtml(host, rows.length ? `<div class="chord-readout-summary">${rows.join("")}</div>` : "");
}

// One voice's own whole-chord budget from an allocation read (issue
// #373): the per-voice figure the pass spent against — a profile's
// intrinsic seats ride above the board's standard scalar, which stands
// only when the read carries no entry for the voice.
function voiceBudgetOf(allocation: NonNullable<RateSnapshot["allocation"]>, moduleId: string): number {
  return allocation.capacities.get(moduleId) ?? allocation.capacity;
}

// Compact figures, plain (issue #334): names and multipliers only — no
// disclosure buttons, no dotted underlines. The full breakdown stays in
// Hex detail.
function compactReadoutRow(text: string, kind: string, colorVar?: string): string {
  const split = text.indexOf(" ×");
  const capacity = kind === "capacity" ? text.lastIndexOf(" ") : -1;
  const at = split >= 0 ? split : capacity;
  const content = at >= 0
    ? `<span class="chord-readout-name">${escapeHtml(text.slice(0, at))} </span><span class="chord-readout-number mono">${escapeHtml(text.slice(at + 1))}</span>`
    : escapeHtml(text);
  return `<span class="chord-readout-chip chord-readout-${kind}${kind === "value" ? " mono" : ""}"${colorVar ? ` style="--cc:var(--${colorVar})"` : ""}>${content}</span>`;
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
// same id twice (the ledger's portal rule). The transient readout itself
// carries no disclosures (issue #334): its chips are plain, and the
// deeper facts live in the click-open Hex detail.
function readoutDisclosureHtml(idKey: string, content: string, mechanics: string, label?: string): string {
  const id = `${idKey}-tip`;
  return `<span class="inst-tip readout-tip"><button class="inst-tip-trigger readout-tip-trigger" type="button" aria-expanded="false" aria-describedby="${id}"${label || idKey.endsWith("quality") ? ` aria-label="${escapeHtml(label ?? mechanics)}"` : ""}>${content}</button><span class="inst-tip-body" id="${id}" role="tooltip">${escapeHtml(mechanics)}</span></span>`;
}

function readoutFigureHtml(idKey: string, text: string, mechanics: string): string {
  return readoutDisclosureHtml(idKey, `<span class="chord-readout-chip chord-readout-${idKey.replace(/^.*-/, "")} mono">${escapeHtml(text)}</span>`, mechanics);
}

function plainFigureHtml(kind: string, text: string): string {
  return `<span class="chord-readout-chip chord-readout-${kind} mono">${escapeHtml(text)}</span>`;
}

// `disclose` splits the two hosts: the click-open Hex detail keeps the
// disclosure layer (the instrument standards' tooltip doctrine), while
// the transient placement preview renders the same figures plain (issue
// #334 — no interactive terms in the reserved readout).
function voiceMetricsHtml(module: ModuleInstance, snapshot: RateSnapshot, current?: RateSnapshot, idScope = "readout", withValue = true, disclose = true): string {
  if (!isVoiceType(module.type)) return "";
  const after = snapshot.contributions.get(module.id);
  const before = current?.contributions.get(module.id);
  const allocation = snapshot.allocation;
  const was = (value: number | null | undefined, unit: string): string =>
    value == null ? "" : ` — was ${unit}${formatNumber(value)}`;
  const figure = (kind: string, text: string, mechanics: string): string =>
    disclose ? readoutFigureHtml(`${idScope}-${kind}`, text, mechanics) : plainFigureHtml(kind, text);
  const rows: string[] = [];
  if (withValue && isOscillatorType(module.type)) rows.push(figure("value", `+${formatNumber(after?.value ?? 0)} ν/s`, `Final ν/s${was(before?.value, "+")}`));
  if (allocation) {
    const prior = current?.allocation;
    const capacity = voiceBudgetOf(allocation, module.id);
    const priorCapacity = prior ? voiceBudgetOf(prior, module.id) : null;
    rows.push(figure("capacity", `Capacity ${allocation.used.get(module.id) ?? 0}/${capacity}`, `Whole-chord budget${prior ? ` — was ${prior.used.get(module.id) ?? 0}/${priorCapacity}` : ""}`));
    if (!allocation.certified) rows.push(`<span class="chord-readout-chip chord-readout-uncertified mono">Allocation uncertified</span>`);
  }
  if (after) {
    if (isOscillatorType(module.type) && after.chordFactor !== null) rows.push(figure("factor", `×${formatNumber(after.chordFactor)}`, `Total chord factor${was(before?.chordFactor, "×")}`));
    if (after.formationQ !== 1) rows.push(figure("formation", `Formation ×${formatNumber(after.formationQ)}`, `Applied formation term${was(before?.formationQ, "×")}`));
    if (after.formationMeasuredQ !== 1 || after.formationQ !== 1) rows.push(qualityScaleHtml(after.formationMeasuredQ, allocation ? ALLOCATION_QUALITY_BOUNDS : { floor: BALANCE.qualityFloor, cap: BALANCE.qualityCap }, `${idScope}-quality`, disclose));
  }
  return rows.join("");
}

// The Hex detail's chord facts (issue #295, in the details column since
// #388; re-spoken as ruled rows by the 2026-10-18 review): the opened
// voice's standing facts in the breakdown's own grammar — the capacity
// with its canonical mark, the total chord factor, the applied formation
// term with its quality scale drawn at column width — then the named
// instances as the readout's chips, with the idle candidates behind one
// "N idle" disclosure. The ν/s figure stays off it (the enlarged face
// carries it); the row labels make tooltips redundant, so the facts
// carry none. The rebuild key rides beside the html (#349): the guard
// decides on the marks' identities and the snapshot's raw figures —
// inputs, never the formatted row.
export interface DetailChordRow {
  html: string;
  key: string;
  // The voice's active marks, shared with the details column's context map
  // (ADR-0072) — the same geometry the board draws, so the miniature can
  // never disagree with the seams.
  marks: ChordMark[];
}

// One ruled fact row: the label carrying the meaning, the tabular figure
// carrying the value — the breakdown row's grammar at section scale.
function detailChordFact(name: string, figure: string): string {
  return `<span class="hex-chord-fact"><span class="hex-chord-fact-name">${name}</span><b class="mono">${figure}</b></span>`;
}

// The formation's quality scale, drawn for the details column's width:
// the full track with its chromatic and organized ends, the neutral
// taller tick, and the firm inset marker at the measured value — the
// state readable without color, the exact read in the accessible name.
function detailQualityScale(measured: number, bounds: { floor: number; cap: number }): string {
  const W = 264;
  const x0 = 6;
  const x1 = W - 6;
  const at = (q: number): number => x0 + Math.min(1, Math.max(0, (q - bounds.floor) / (bounds.cap - bounds.floor))) * (x1 - x0);
  const x = at(measured);
  const neutral = at(1);
  const label = `Formation quality — ×${formatNumber(bounds.floor)} chromatic to ×${formatNumber(bounds.cap)} organized, ×1 neutral; this formation measures ×${formatNumber(measured)}`;
  return `<span class="chord-scale-wide" data-q="${measured}" role="img" aria-label="${escapeHtml(label)}"><svg viewBox="0 0 ${W} 34" aria-hidden="true"><line class="scale-track" x1="${x0}" y1="12" x2="${x1}" y2="12"/><line class="scale-tick" x1="${x0}" y1="8" x2="${x0}" y2="16"/><line class="scale-tick scale-tick-neutral" x1="${neutral.toFixed(1)}" y1="5" x2="${neutral.toFixed(1)}" y2="19"/><line class="scale-tick" x1="${x1}" y1="8" x2="${x1}" y2="16"/><rect class="scale-marker" x="${(x - 2).toFixed(1)}" y="7" width="4" height="10"/><text class="scale-end mono" x="${x0}" y="31" text-anchor="start">${formatNumber(bounds.floor)}</text><text class="scale-end mono" x="${((x0 + x1) / 2).toFixed(1)}" y="31" text-anchor="middle">×1</text><text class="scale-end mono" x="${x1}" y="31" text-anchor="end">${formatNumber(bounds.cap)}</text></svg></span>`;
}

// One instance row of the details column's list: a hue tick naming the
// seam, the chord's name in ink, its multiplier beside it — the reserved
// chip's panel backing belongs to the readout's density, not to the
// ruled column.
function detailChordInstance(mark: ChordMark): string {
  const at = mark.label.lastIndexOf(" ×");
  const name = at > 0 ? mark.label.slice(0, at) : mark.label;
  const figure = at > 0 ? mark.label.slice(at + 1) : "";
  return `<span class="hex-chord-instance" style="--cc:var(--${mark.colorVar})"><span class="chord-tick" aria-hidden="true"></span><span class="hex-chord-instance-name">${escapeHtml(name)}</span>${figure ? `<b class="mono">${escapeHtml(figure)}</b>` : ""}</span>`;
}

export function detailChordRow(app: App, snapshot: RateSnapshot): DetailChordRow {
  const detail = app.ui.detail;
  if (!detail) return { html: "", key: "", marks: [] };
  const module = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, detail.pos));
  if (!module) return { html: "", key: "", marks: [] };
  const chips = moduleChips(module, chordReadoutCache.get(app)?.marks ?? []);
  const active = chips.filter((mark) => !mark.inactive);
  const idle = chips.filter((mark) => mark.inactive);
  const contribution = snapshot.contributions.get(module.id);
  const allocation = snapshot.allocation;
  // The voice's own budget (issue #373), not the board scalar.
  const voiceCapacity = allocation ? voiceBudgetOf(allocation, module.id) : null;
  const facts: string[] = [];
  if (isVoiceType(module.type) && allocation) {
    facts.push(detailChordFact(`<small class="capacity-mark" aria-hidden="true">${CAPACITY_SVG}</small><span class="sr-only">Harmonic capacity</span>`, `${allocation.used.get(module.id) ?? 0}/${voiceCapacity}`));
    if (!allocation.certified) facts.push(`<span class="hex-chord-fact st-inactive"><span class="hex-chord-fact-name">Allocation</span><b class="mono">uncertified</b></span>`);
    if (isOscillatorType(module.type) && contribution && contribution.chordFactor !== null) {
      facts.push(detailChordFact("Factor", `×${formatNumber(contribution.chordFactor)}`));
    }
    if (contribution && contribution.formationQ !== 1) {
      facts.push(detailChordFact("Formation", `×${formatNumber(contribution.formationQ)}`));
    }
  }
  const scale = isVoiceType(module.type) && contribution && (contribution.formationMeasuredQ !== 1 || contribution.formationQ !== 1)
    ? detailQualityScale(contribution.formationMeasuredQ, allocation ? ALLOCATION_QUALITY_BOUNDS : { floor: BALANCE.qualityFloor, cap: BALANCE.qualityCap })
    : "";
  const instances = active.length + idle.length > 0
    ? `<div class="hex-chord-list">${active.map((mark) => detailChordInstance(mark)).join("")}${idle.length > 0 ? detailIdleDisclosureHtml(`detail-${module.id}`, idle) : ""}</div>`
    : "";
  const html = `${facts.length + (scale ? 1 : 0) > 0 ? `<div class="hex-chord-facts">${facts.join("")}${scale}</div>` : ""}${instances}`;
  return {
    html,
    marks: active,
    key: JSON.stringify([
      chips.map((mark) => [mark.key, mark.inactive, mark.label, mark.colorVar]),
      allocation ? [allocation.used.get(module.id) ?? 0, voiceCapacity, allocation.certified] : null,
      contribution ? [contribution.chordFactor, contribution.formationQ, contribution.formationMeasuredQ] : null,
    ]),
  };
}

// The one idle disclosure (issue #388): a dashed quiet trigger carrying
// the count, its body in the shared tooltip layer listing every
// candidate's name and factor — the per-instance facts the old inline
// idle chips carried, one opening away. Hover, focus, and tap open it;
// Escape and tap-away dismiss it; the portaled body shifts no layout.
function detailIdleDisclosureHtml(idScope: string, idle: ChordMark[]): string {
  const id = `${idScope}-idle-tip`;
  const listing = idle
    .map((mark) => `<span class="detail-idle-row mono">${escapeHtml(mark.label)}</span>`)
    .join("");
  // The idle row is the list's last line: the same row grammar, its tick
  // dashed — recognized, earning nothing (the readout's side of the
  // board's dotted seams).
  return `<span class="inst-tip"><button class="inst-tip-trigger detail-idle-trigger hex-chord-instance hex-chord-instance-idle mono" type="button" aria-expanded="false" aria-describedby="${id}"><span class="chord-tick chord-tick-idle" aria-hidden="true"></span>${idle.length} idle</button><span class="inst-tip-body inst-tip-scroll" id="${id}" role="tooltip">${listing}</span></span>`;
}

// The low-to-high quality scale (issue #260): where the formation's
// measured Q sits between the floor and the cap — the chromatic end and
// the organized end, a taller tick at neutral. The marker is a firm inset
// bar (the instrument grammar's selected register), so the read survives
// greyscale; the figures ride the Formation chip and the tooltip. Plain
// in the transient readout (issue #334), disclosed in the Hex detail.
function qualityScaleHtml(measured: number, bounds: { floor: number; cap: number }, idKey = "readout-quality", disclose = true): string {
  const span = bounds.cap - bounds.floor;
  const at = (q: number): number => 14 + Math.min(1, Math.max(0, (q - bounds.floor) / span)) * 72;
  const x = at(measured);
  const neutral = at(1);
  const label = `Formation quality — ×${formatNumber(bounds.floor)} chromatic to ×${formatNumber(bounds.cap)} organized, ×1 neutral; this formation measures ×${formatNumber(measured)}`;
  const scale = `<span class="chord-readout-scale" data-q="${measured}"${disclose ? "" : ` role="img" aria-label="${escapeHtml(label)}"`}><svg viewBox="0 0 100 20" width="100" height="20" aria-hidden="true"><line class="scale-track" x1="14" y1="6" x2="86" y2="6"/><line class="scale-tick" x1="14" y1="3" x2="14" y2="9"/><line class="scale-tick scale-tick-neutral" x1="${neutral.toFixed(1)}" y1="1" x2="${neutral.toFixed(1)}" y2="11"/><line class="scale-tick" x1="86" y1="3" x2="86" y2="9"/><rect class="scale-marker" x="${(x - 1.5).toFixed(1)}" y="2.5" width="3" height="7"/><text class="scale-end mono" x="14" y="18" text-anchor="middle">${formatNumber(bounds.floor)}</text><text class="scale-end mono" x="86" y="18" text-anchor="middle">${formatNumber(bounds.cap)}</text></svg></span>`;
  return disclose ? readoutDisclosureHtml(idKey, scale, label) : scale;
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
// from the projected board, with the board's own rate delta said outright
// and every chip plain (issue #334). The retrieval reads the departure the
// same way. Every figure commits with the drop: the projection is the
// same authoritative pass placeModule lands in.
function placementPreviewHtml(app: App, projection: PlacementProjection): string {
  const hover = app.ui.dropHover!;
  const module = app.state.modules.find((m) => m.id === hover.moduleId)!;
  const allocation = projection.projected.allocation;
  const rateDelta = projection.projected.rate - projection.current.rate;
  // Plain chips throughout (issue #334): the transient readout carries no
  // interactive terms — the delta and the resulting figures say what a
  // hand needs mid-gesture, and the click-open Hex detail keeps the deep
  // facts.
  const rows = [plainFigureHtml("preview", `Placement ${formatDelta(rateDelta)} ν/s`), voiceMetricsHtml(module, projection.projected, projection.current, "readout", true, false)];
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
        rows.push(
          `<span class="chord-readout-chip mono${idleTerm ? " chord-readout-idle" : ""}" style="--cc:var(--${CHORD_HUES[term.name] ?? "chord-octave"})">${escapeHtml(chordTermLabel(term))}${idleTerm ? " · idle" : ""}</span>`,
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

// The marks the current ask names (§6): a seam names its one chord, a
// module names every chord it sings in — the conducting spacer by
// containment, the same rule its readout reads (#201). A World plate's
// ask names no marks — it takes the readout's whole row for itself. One
// resolution serves every ask consumer: the reserved readout's chips, the
// Hex detail's chord row, and active-chord inspection.
function marksForAsk(app: App): ChordMark[] {
  const hover = app.ui.chordHover;
  if (!hover || hover.kind === "world") return [];
  const marks = chordReadoutCache.get(app)?.marks ?? [];
  if (hover.kind === "chord") return marks.filter((m) => m.key === hover.key && !m.inactive);
  const module = app.state.modules.find((m) => m.id === hover.moduleId);
  return module ? moduleChips(module, marks) : [];
}

// Inspection changes only active geometry; idle facts remain in the cache.
function updateChordEmphasis(app: App): void {
  const group = document.querySelector('#grid [data-key="chord-marks"]');
  if (!group) return;
  const inspecting = app.ui.chordHover !== null && app.ui.chordHover?.kind !== "world";
  const related = new Set(marksForAsk(app).filter((mark) => !mark.inactive).map((mark) => mark.key));
  for (const node of group.querySelectorAll(".chord-mark")) {
    const focused = inspecting && related.has(node.getAttribute("data-chord") ?? "");
    node.classList.toggle("chord-focused", focused);
    node.classList.toggle("chord-fade", inspecting && !focused);
  }
}

// The hover question (§6): what the pointer rests on. Null clears. Never a
// re-render — the readout and active-chord emphasis update in place.
function setChordHover(app: App, hover: ChordHover | null): void {
  if (app.released) return;
  const next = hover ?? null;
  if (app.ui.worldArmed && !app.ui.worldCarrying) {
    app.setWorldDropHover(app.ui.worldArmed, next?.kind === "world" ? next.pos : null);
  }
  if (sameChordHover(app.ui.chordHover, next)) return;
  app.ui.chordHover = next;
  updateChordReadout(app);
  updateChordEmphasis(app);
}

function sameChordHover(a: ChordHover | null, b: ChordHover | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === "chord" && b.kind === "chord") return a.key === b.key;
  if (a.kind === "module" && b.kind === "module") return a.moduleId === b.moduleId;
  if (a.kind === "world" && b.kind === "world") return sameHex(a.pos, b.pos);
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
  const emittingNow = flowLive(state) && isSource(module) && emittedStrength(state, module, true) > 0;

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

  return `<g class="module-node${crossed ? " forge-crossed" : ""}" data-type="${module.type}" data-rarity="${typeRarityOf(module.type)}">

    ${moduleFace({
      type: module.type,
      tier: module.tier,
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
    <span class="sweep-label"><span class="sweep-label-full">UPGRADE </span>ALL</span>
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
  document.querySelectorAll("#grid .hex.drop-open, #grid .hex.drop-occupied, #grid .hex.drop-combine, #hex-detail .hex.drop-open, #hex-detail .hex.drop-occupied, #hex-detail .hex.drop-combine").forEach((node) =>
    node.classList.remove("drop-open", "drop-occupied", "drop-combine"),
  );
  const hover = app.ui.dropHover;
  if (hover && hover.pos !== null) {
    const register = dropRegister(app, hover.pos);
    if (register) {
      document.querySelectorAll(`[data-cell="${hover.pos.q},${hover.pos.r}"] .hex`).forEach(node => node.classList.add(dropClass(register)));
    }
  }
  const layer = svg.querySelector('[data-key="ghost-chords"]');
  if (layer) layer.innerHTML = ghostMarksHtml(app);
  // The reserved readout carries the projection while the gesture lives;
  // cancel restores whatever row was standing (#260).
  updateChordReadout(app);
  updateChordEmphasis(app);
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
  const preview = wouldFormPreview(app.state, hover.moduleId, hover.pos);
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
  const idleIdentities = new Set(idleNewcomers.map((chord) => `${chord.name}|${chord.root}`));
  const overlay = chordOverlay({
    namedChords: promised,
    inactiveChords: idleNewcomers,
    posOf,
    point,
    radius: HEX_RADIUS,
    step: LATTICE_STEP,
    labelFor: (chord) => chordTermLabel(chord) + (idleIdentities.has(`${chord.name}|${chord.root}`) ? " · idle" : ""),
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
// question binds once, delegating: over a World plate, that face's
// declaration (issue #426); over a chord's seam, that chord; over a module
// cell, every chord the module sings in; anywhere else, none. Ghost marks
// never answer — they promise chords that don't exist yet.
const boundGrids = new WeakSet<SVGSVGElement>();

function bindSeamHover(app: App, svg: SVGSVGElement): void {
  if (boundGrids.has(svg)) return;
  boundGrids.add(svg);
  const ask = (event: Event) => {
    if (app.dragging || app.ui.worldCarrying) return;
    const target = event.target as Element;
    const plateNode = target.closest?.("[data-world-cell]");
    if (plateNode) {
      const pos = hexFromAttr(plateNode.getAttribute("data-world-cell"));
      if (pos) {
        setChordHover(app, { kind: "world", pos });
        return;
      }
    }
    const mark = target.closest?.(".chord-mark:not(.ghost-mark)");
    const key = mark?.getAttribute("data-chord");
    if (mark && key) {
      setChordHover(app, mark.classList.contains("chord-idle") ? null : { kind: "chord", key });
      return;
    }
    const cellNode = target.closest?.("[data-cell]");
    const [q, r] = (cellNode?.getAttribute("data-cell") ?? "").split(",").map(Number);
    const id = cellNode && Number.isFinite(q) ? deployedAt(app.state, { q: q!, r: r! })?.id ?? null : null;
    setChordHover(app, id ? { kind: "module", moduleId: id } : null);
  };
  app.listen(svg, "pointerover", ask);
  app.listen(svg, "focusin", ask);
  app.listen(svg, "focusout", (event) => {
    const next = (event as FocusEvent).relatedTarget;
    if (!(next instanceof Node) || !svg.contains(next)) setChordHover(app, null);
  });
  app.listen(byId("chord-readout"), "pointerleave", (event) => {
    const next = (event as PointerEvent).relatedTarget;
    if (next instanceof Node && svg.contains(next)) return;
    if (!byId("chord-readout")?.contains(document.activeElement)) setChordHover(app, null);
  });
  app.listen(svg, "pointerleave", (event) => {
    if (app.dragging) return;
    const next = (event as PointerEvent).relatedTarget;
    if (next instanceof Node && byId("chord-readout")?.contains(next)) return;
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
export function bindPointerDrag(app: App, element: Element, moduleId: string | (() => string | null)): void {
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
      openInventoryForDrag(app, hit);
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
        if (module) ghost.dataset.rarity = typeRarityOf(module.type);
        ghost.innerHTML = module
          ? inventoryTileSvg(module)
          : `<svg viewBox="-75 -75 150 150" aria-hidden="true"><polygon class="hex" points="${hexPoints(HEX_RADIUS)}"/></svg>`;
        element.classList.add("dragging");
        return ghost;
      },
      move: setHoverTarget,
      cleanup: () => {
        app.dragging = null;
        if (app.ui.inventory.dragOpen) {
          app.ui.inventory.dragOpen = false;
          queueMicrotask(() => { if (!app.released) app.render(); });
        }
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

// The whole roster's merge-relevant shape, hashed: a copy's eligible mark
// and the control's count change with any twin's tier, level, investment,
// or placement, wherever it sits — one builder serves both library
// surfaces' rebuild guards (issue #368).
function rosterMergeKey(state: GameState): string {
  return JSON.stringify(state.modules.map((m) => `${m.id}:${m.type}:${m.tier}:${m.level}:${m.invested}:${m.pos === null ? "i" : "d"}`));
}

// One visit-local browser serves both layers and the phone sheet.
function renderInventoryTray(app: App): void {
  const moduleTray = byId("inventory-zone");
  const worldTray = byId("world-tray");
  if (!moduleTray || !worldTray) return;
  const modules = app.ui.boardLayer === "modules";
  moduleTray.classList.toggle("off", app.state.mode !== "upgrade" || !modules);
  worldTray.hidden = app.state.mode !== "upgrade" || modules;
  const tray = modules ? moduleTray : worldTray;
  tray.closest<HTMLElement>(".tray-column")?.classList.toggle("collapsed", app.ui.inventory.collapsed && !app.ui.inventory.dragOpen);
  if (modules) renderInventoryContent(app, tray, false, (element, id) => bindPointerDrag(app, element, id));
  else renderWorldTrayContent(app, tray, false, (element, id) => bindWorldDrag(app, element, id, "tray"));
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

/* ── Modals ────────────────────────────────────────── */

// The modal content's rebuild key: what a modal shows, hashed. The
// control-driven in-place patchers (the enter prompt's, issue #115) re-stamp
// it after patching, so the patched DOM and the guard stay in agreement and
// a later render never rebuilds what a patch already brought current.
function modalKey(app: App, kind: ModalKind, extra: unknown): string {
  return JSON.stringify([kind, app.ui.importError, app.state.session?.accounting.poolSeconds ?? 0, app.state.mode, extra]);
}

function renderModal(app: App, live: RateSnapshot, projected: RateSnapshot): void {
  const backdrop = byId("modal");
  const content = byId("modal-content");
  if (!backdrop || !content) return;
  // A dead combine offer — the pair dissolved under the review (mode
  // flipped, a twin gone) — drops before the dispatch, so the dialog always
  // has terms to present and no render pass ever nests a closeModal render
  // inside itself. The mutator review obeys the same rule (issue #199).
  // The drop is the round trip's end (issue #346): the return address is
  // honored before the pass continues.
  if (app.ui.modal === "combine" && combineOfferTerms(app) === null) {
    app.ui.combineOffer = null;
    app.abandonModal();
  }
  const kind = app.ui.modal;
  if (!kind) {
    backdrop.hidden = true;
    backdrop.classList.remove("sheet");
    backdrop.classList.remove("peek");
    backdrop.classList.remove("notes-modal");
    document.body.classList.remove("modal-sheet-open");
    // The dismissal leaves nothing standing in the layer: a wiped sheet
    // holds no ghost of the dialog it served, and nothing inside it can
    // keep hold of focus (issue #346).
    delete content.dataset.renderKey;
    // A pinned tooltip's body lives at document body level (instrument.ts's
    // portal), so hiding the sheet would otherwise leave it floating over
    // the board — the close puts every tooltip of the sheet away with it.
    closeTooltips(content);
    content.replaceChildren();
    return;
  }
  // The rate sheet's own gate (§7): below the 760px container breakpoint
  // it presents as a sheet over the scrim. The modal layer is body-level —
  // outside the #app container — so the gate's decision arrives as a class
  // the stylesheet can act on, not a container rule. On portrait phone the
  // viewport media query sheets other modals, so the cluster's rise reads
  // the wider of the two (§7, ADR-0029: the cluster alone reacts to open
  // sheets, and inspection never buries it).
  const sheet = kind !== "notes" && ((kind === "rate" && containerWidth() < RATE_DETAILS_BREAKPOINT_PX) || viewportWidth() < PHONE_MAX_PX);
  backdrop.classList.toggle("notes-modal", kind === "notes");
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
      ? [app.ui.forgeFace, app.state.catalogEntryOwned, app.state.bankedRolls.length, app.state.bankedMutatorRolls.length, app.state.bankedRolls.at(-1)?.id ?? null, app.state.bankedMutatorRolls.at(-1)?.id ?? null]
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
                  // The capacity ladder's owned state (issue #259): the row's
                  // figure, price, and capped word re-read with the ladder.
                  app.state.capacityBought,
                  app.state.capacityCeilings,
                  app.state.capacityDiscounts,
                  // The Warp Beam's owned rungs (issue #380): the row's
                  // figure, price, and cap delta re-read with the ladder.
                  app.state.mergeCapPurchases,
                  // Module-upgrade rows reprice with levels, moves, and the roster.
                  app.state.modules.map((m) => `${m.id}:${m.level}:${m.tier}:${m.pos ? "d" : "i"}`).join("|"),
                  app.state.arete,
                  app.state.catalogEntryOwned,
                  app.state.rollPoolJoined,
                  app.state.world.frontier,
                  // The scrap face's rows (issues #378, #379, #380): the
                  // owned rungs and the balance re-read with every purchase,
                  // so the loom's chance, price, and muted state never stand
                  // stale in an open sheet; the special drafts' held
                  // entitlements ride beside them, and the unlocked cap
                  // carries the Plied Weft's availability.
                  app.state.draftTierBonus,
                  app.state.scrap,
                  JSON.stringify(app.state.specialDrafts),
                  unlockedMergeCap(app.state),
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
                // The rate sheet reprices only when its roster or feats
                // count changes — the figures themselves ride live slots
                // the tick fills in place, so clock ticks never rebuild
                // (and collapse) an expanded row.
                : kind === "rate"
                  ? [deployedRosterKey(app.state), unlockedCount(app.state), discoveryCount(app.state), app.ledgerSection]
                : kind === "inventory"
                  ? [
                      // The whole roster's merge-relevant shape (issue #368):
                      // the control's count and the tiles' eligible marks
                      // change with any twin's tier or investment, wherever
                      // it sits, so a sweep from the sheet re-renders it.
                      rosterMergeKey(app.state), app.ui.inventory, app.ui.worldTray,
                      // The tray sheet's face rides the global switch, and
                      // the World face re-reads the tray (issue #426).
                      app.ui.boardLayer,
                      app.state.world.weapons.map((w) => `${w.id}:${w.pos}:${w.store}:${w.targetPriority}`),
                      app.state.world.columns.map((c) => `${c.id}:${c.pos}`),
                    ]
                  // The combine review's identity: the offered pair (issue
                  // #152). The terms are read fresh on rebuild.
                  : kind === "combine"
                    ? [app.ui.combineOffer?.dragId ?? null, app.ui.combineOffer?.targetId ?? null]
                    : null;
  // The Notes modal's key (issue #332) is its own shape: face, session
  // presence, and the stream — never the mode or the pool. A pause or
  // resume, a boundary, an overrun must never rebuild the dialog out from
  // under a standing draft; only a capture or a tab switch does.
  const renderKey = kind === "notes" ? `notes|${notesModalKey(app)}` : modalKey(app, kind, extra);
  // Clock ticks must not replace a save textarea or steal dialog focus.
  if (!backdrop.hidden && content.dataset.renderKey === renderKey) {
    // The rate sheet's figures ride the same live slots the popover fills:
    // the tick fills them in place on this no-rebuild path, so an expanded
    // row survives the clock (ADR-0037). The Forge meters do the same —
    // the detail stays live during flow (ADR-0041).
    if (kind === "rate") { updateRateDetailsLive(content, app.state, live); updateLedgerModal(app, content); }
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
  else if (kind === "grant") renderGrantModal(app, content);
  else if (kind === "honesty") renderHonestyModal(app, content);
  else if (kind === "summary") renderSummaryModal(app, content);
  else if (kind === "rate") renderRateModal(app, content, live);
  else if (kind === "notes") renderNotesModal(app, content);
  else if (kind === "inventory") renderInventorySheetModal(app, content);
  else if (kind === "combine") renderCombineModal(app, content);
  // Shared clipped rim and scrolling face: the hairline follows both cuts.
  const framed = kind !== "catalog" && kind !== "forge" && kind !== "inventory";
  content.classList.toggle("framed-modal", framed);
  if (framed) {
    const focused = content.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
    const face = document.createElement("div");
    face.className = "modal-face";
    face.append(...content.childNodes);
    content.append(face);
    focused?.focus({ preventScroll: true });
  }
  // The Notes modal lands focus itself (issue #332): the composer on
  // CAPTURE, the standing tab on LOGGED — never the generic first button.
  // Every other dialog lands on its first control (issue #346), the open
  // never scrolling the page out from under the reader.
  if (kind !== "notes" && (kind !== "inventory" || !content.contains(document.activeElement))) {
    const firstButton = content.querySelector("button:not([disabled])");
    (firstButton as HTMLElement | null)?.focus({ preventScroll: true });
  }
}

// The Notes modal (issue #332, amending ADR-0050's shared anchored frame):
// the composer sheet as a centered modal composition at every width,
// independent of the clock or launcher location. The eyebrow names it, the
// state word rides the tab row, and the faces are the same builders the
// anchored sheet wore — CAPTURE leads, LOGGED carries the stream.
function renderNotesModal(app: App, content: HTMLElement): void {
  content.innerHTML = `
    ${modalTop("NOTES", "modal-title")}
    ${notesModalTabsHtml(app)}
    ${notesModalBodyHtml(app)}`;
  bindNotesModal(app, content);
  wireClose(app);
  const landing = app.ui.notesFace === "capture"
    ? content.querySelector<HTMLElement>("#note-composer")
    : content.querySelector<HTMLElement>('[data-notes-face="logged"]');
  landing?.focus({ preventScroll: true });
}

// The rate sheet (§7, amended by issue #334): the rate details — the
// total, the global Feats · Discoveries factors once as already included,
// and one final-ν/s row per oscillator — as a modal sheet over a scrim
// below the 760px breakpoint, opened by tapping the Rate cell or the
// strip's rate read at every width. The same roster the Rate cell's hover
// popover owns above the breakpoint, built the same way: live slots the
// tick fills. No expansion and no per-row details — the 2026-10-14
// amendment drops the inline calculation and its arrow for now. The
// surface carries no header of its own — the eyebrow names it and the
// roster speaks (the instrument standards' identity rule) — and a
// synthesizer row's tap closes the sheet and selects the module, so the
// answer lands on the board it names.
function renderRateModal(app: App, content: HTMLElement, live: RateSnapshot): void {
  // The same basis every rate figure wears — live during flow, projected
  // while arranging — so the sheet can never disagree with the ledger it
  // discloses.
  const snapshot = live;
  content.innerHTML = `
    ${modalTop("LEDGER", "modal-title")}
    <section id="ledger-nous" class="ledger-section" tabindex="-1"><h3>Nous</h3><div class="ledger-detail-row"><span>Balance</span><b class="mono" data-live="ledger-nous"></b></div><div id="ledger-production" class="rate-details-sheet" tabindex="-1">${rateDetailsHtml(app.state, snapshot, true, "sheet")}</div></section>
    <section id="ledger-arete" class="ledger-section" tabindex="-1"><h3>Arete</h3><div class="ledger-detail-row"><span>Banked</span><b class="mono" data-live="ledger-arete"></b></div><button id="prestige-door" class="prestige-door"></button><small class="prestige-availability" data-live="prestige-availability"></small></section>
    <section id="ledger-scrap" class="ledger-section" tabindex="-1"><h3>Scrap</h3><div class="ledger-detail-row"><span>Recovered from modules and skipped drafts</span><b class="mono" data-live="ledger-scrap"></b></div></section>
    <section id="ledger-capacity" class="ledger-section" tabindex="-1"><h3>Harmonic capacity</h3><div class="ledger-detail-row"><span>Whole-chord budget per standard voice</span><b class="mono" data-live="ledger-capacity"></b></div></section>
    <nav class="ledger-destinations"><button id="ledger-feats">${FEATS_SVG}<span>Feats</span><span class="mono">${unlockedCount(app.state)}/${ACHIEVEMENTS.length}</span></button><button id="ledger-chords">${LIBRARY_SVG}<span>Chords</span><span class="mono">${discoveryCount(app.state)}/${NAMED_CHORDS.length}</span></button></nav>`;
  updateRateDetailsLive(content, app.state, snapshot);
  updateLedgerModal(app, content);
  app.listen(byId("prestige-door"), "click", () => app.openPrestigeConfirm());
  app.listen(byId("ledger-feats"), "click", () => app.openModal("achievements"));
  app.listen(byId("ledger-chords"), "click", () => app.openModal("library"));
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

function updateLedgerModal(app: App, content: HTMLElement): void {
  liveSet(content, "ledger-nous", `${formatBalance(app.state.nous)} ν`);
  liveSet(content, "ledger-arete", `${formatInt(app.state.arete)} Arete`);
  liveSet(content, "ledger-scrap", formatInt(app.state.scrap));
  liveSet(content, "ledger-capacity", `${voiceCapacityOf(app.state)} / ${capacityCeiling(app.state)}`);
  const door = content.querySelector<HTMLButtonElement>("#prestige-door");
  if (door) {
    const label = `Prestige now for ${bankableClaimOf(app.state)} Arete`;
    if (door.textContent !== label) door.textContent = label;
    door.disabled = app.state.mode !== "upgrade" || !horizonReached(app.state);
  }
  liveSet(content, "prestige-availability", app.state.mode !== "upgrade" ? "Available between sessions" : !horizonReached(app.state) ? `Requires ${formatBalance(ARETE_HORIZON)} era nous` : "");
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
function renderInventorySheetModal(app: App, content: HTMLElement): void {
  if (!content.querySelector(".inventory-sheet-browser")) content.innerHTML = `<div class="inventory-sheet-frame inst-panel-face">${modalTop("INVENTORY", "modal-title")}
    ${app.state.mode === "upgrade" ? `<div class="layer-legend tray-switch" role="group" aria-label="Tray face">${layerLegendHtml(app)}</div>` : ""}
    <div class="inventory-sheet-browser"></div></div>`;
  const host = content.querySelector<HTMLElement>(".inventory-sheet-browser")!;
  const modules = app.ui.boardLayer === "modules";
  if (modules) renderInventoryContent(app, host, true, (element, id) => bindPointerDrag(app, element, id));
  else renderWorldTrayContent(app, host, true, (element, id) => bindWorldDrag(app, element, id, "tray"));
  content.querySelectorAll<HTMLButtonElement>("[data-legend-layer]").forEach((button) => {
    const selected = button.dataset.legendLayer === app.ui.boardLayer;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
    if (button.dataset.inventoryBound) return;
    button.dataset.inventoryBound = "true";
    app.listen(button, "click", () => {
      const layer = button.dataset.legendLayer as "modules" | "world";
      app.ui.inventory.inspect = null; app.ui.inventory.merge = null; app.ui.worldTray.inspect = null;
      if (app.ui.detail) app.detailFace(layer); else app.setBoardLayer(layer);
    });
  });
  const close = content.querySelector<HTMLElement>("#close-modal");
  if (close && !close.dataset.inventoryBound) { close.dataset.inventoryBound = "true"; wireClose(app); }
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

// The combine review (issue #152, reworded by ADR-0058): the drop's terms —
// the resulting merge tier, the retained higher level, the refund — laid
// out before either copy is consumed. The named type and its fixed rarity
// never change here, so they identify the pair and nothing more. Cancel
// (button, ✕, backdrop, Esc) lands in closeModal and leaves both modules
// exactly as they were; confirm performs the combine and the result lands
// where the drop target was.
function renderCombineModal(app: App, content: HTMLElement): void {
  // renderModal drops a dead offer before the dispatch, so the terms are
  // always readable here — the render pass stays free of a nested
  // closeModal render.
  const { drag, target, preview } = combineOfferTerms(app)!;
  const pairLine = (module: ModuleInstance) => `${rarityMark(typeRarityOf(module.type))} ${META[module.type].name} · ${tierWord(module.tier)}${faceLevel(module) === undefined ? "" : ` · Lv. ${module.level}`}`;
  const destination = target.pos === null ? "The combined copy waits in the tray." : `The combined copy holds ${cellNoteOf(target.pos)}.`;
  content.innerHTML = `
    ${modalTop("COMBINE")}
    <h2 id="modal-title">Combine these two?</h2>
    <p class="lead">${pairLine(drag)}<br />+ ${pairLine(target)}</p>
    <div class="combine-terms">
      <div class="stat-row"><span>Resulting tier</span><span class="mono">${tierWord(preview.nextTier)}</span></div>
      ${faceLevel(target) === undefined ? "" : `<div class="stat-row"><span>Retained level</span><span class="mono">Lv. ${preview.level}</span></div>`}
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

// The starter-weapon grant's one presentation (issue #426, priority 5):
// the first World-eligible claim lands the Charge Blade at the moment it
// banks, and this modal is where the player meets it — the plate, the
// name, the one line that says where it waits. Once, ever: the granted
// flag keeps the engine from minting a second, and the modal only ever
// opens on the landing that set it.
function renderGrantModal(app: App, content: HTMLElement): void {
  content.innerHTML = `
    ${modalTop("GRANTED")}
    <h2 id="modal-title">The Charge Blade is yours</h2>
    <div class="grant-face" aria-hidden="true">${worldTileSvg("weapon")}</div>
    <p class="lead">A ${termTipHtml("Charge Blade")} waits in the ${termTipHtml("World tray")} — place it over an owned cell, feed it from a ${termTipHtml("Charge Column")}, and it engages the adjacent enemies on its own cadence.</p>
    <p class="lead muted">The World face stands with the era: it reopens at ${formatNumber(BALANCE.world.entryNous)} era-earned.</p>
    <div class="modal-actions">
      <button id="grant-close" class="primary">Continue</button>
    </div>`;
  app.listen(byId("grant-close"), "click", () => app.closeModal());
  wireClose(app);
}

// Settings as a readout stack (§5, #249's resolution, issue #280): the
// eyebrow is the identity — no title beside it — over hairline-ruled
// preference rows. The session-start preference selects instant flow vs
// PLAN confirmation; the mute row's scope lives in the tooltip layer;
// "saves automatically on this device" is the one quiet line; reset wears
// the switch color.
function renderSettingsModal(app: App, content: HTMLElement): void {
  content.innerHTML = `
    ${modalTop("SETTINGS", "modal-title")}
    <div class="folio-rows settings-rows">
      <div class="folio-row">
        <span class="folio-key">Session start</span>
        <span class="folio-main">
          <span class="pref-control">
            <label for="pref-confirm">confirm each entry</label>
            <input type="checkbox" id="pref-confirm" ${app.ui.confirmEntry ? "checked" : ""} aria-label="Confirm each session start on the PLAN face" />
          </span>
        </span>
        ${infoTipHtml(
          "settings-session-tip",
          "Session start — the confirmation",
          `On opens PLAN first, off starts flow immediately`,
        )}
      </div>
      <div class="folio-row">
        <span class="folio-key">Sound</span>
        <span class="folio-main">
          <span class="pref-control">
            <label for="pref-mute">mute all sound</label>
            <input type="checkbox" id="pref-mute" ${app.state.muted ? "checked" : ""} aria-label="Mute all sound" />
          </span>
        </span>
        ${infoTipHtml("settings-mute-tip", "Mute — the scope", "Silences every sound, the target chime included.")}
      </div>
      <div class="folio-row">
        <span class="folio-key">Save data</span>
        <span class="folio-main"><span class="folio-sub">saves automatically on this device</span></span>
      </div>
    </div>
    <div class="modal-actions">
      <button id="settings-export">Export save</button><button id="settings-import">Import save</button><button id="settings-reset" class="settings-reset">Reset progress</button>
    </div>`;
  wireTooltips(content, app.signal);
  app.listen(byId("pref-confirm"), "change", (event) => {
    app.ui.confirmEntry = (event.target as HTMLInputElement).checked;
  });
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
//
// The row sells the product, not the mechanic (issue #310): it is headed
// Poly Expander, the effect line carries the hoverable term, and the mono
// delta reads the before → after the buy lands. The section's own h2 keeps
// the heading outline whole (#354): the shelf section above it can retire,
// and the row's h3 must never stand beneath nothing.
function capacityShopHtml(app: App): string {
  const { state } = app;
  const capacity = voiceCapacityOf(state);
  const ceiling = capacityCeiling(state);
  const price = nextCapacityPrice(state);
  const upgrade = state.mode === "upgrade";
  const buy = price === null
    ? `<span class="shop-buy"><span class="st-acquired">${capacityCeilingsLeft(state) ? "capped" : "complete"}</span></span>`
    : catalogPriceHtml({
        attrs: `data-buy-capacity="1"`,
        price,
        affordable: wholeNous(state) >= price,
        hold: !upgrade,
        countdown: upgrade ? upgradeCountdown(app, price) : null,
      });
  const note = price === null && capacityCeilingsLeft(state)
    ? `<small class="shop-countdown">The ceiling stands — ${termTipHtml("Expansion Bays")} sell the next rung.</small>`
    : "";
  // Sold out, the lone figure is all that is left to read.
  const figure = price === null
    ? `<p class="t-note mono">${capacity}/${ceiling}</p>`
    : `<p class="t-note mono">${capacity}/${ceiling} → ${capacity + 1}/${ceiling}</p>`;
  return `
    <section class="capacity-catalog">
      <h2 class="t-condensed">${termTipHtml("Harmonic capacity")}</h2>
      <div class="catalog-rows">
        <article class="catalog-row">
          <div><h3 class="t-condensed">${termTipHtml("Poly Expander")}</h3><p class="t-note">Raises ${termTipHtml("Harmonic capacity")} by one for all voices</p>${figure}${note}</div>
          ${buy}
        </article>
      </div>
    </section>`;
}

// Independent disclosure stays reachable when the purchase is unavailable.
// The one ⓘ-trigger shape every modal's tooltip layer wears.
function infoTipHtml(id: string, label: string, mechanics: string): string {
  return `<span class="inst-tip"><button class="inst-tip-trigger" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="${label}">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${mechanics}</span></span>`;
}

// Whether the Arete sheet can still raise the capacity ceiling: the shared
// read behind the capped row's pointer and the sheet's own rows.
function capacityCeilingsLeft(state: GameState): boolean {
  return nextCeilingPrice(state) !== null;
}

// The Arete ladder products as one entry each, bought at a rising price
// (issue #310): the owned figure is the only purchase-count read, the mono
// delta reads what the next buy changes, the buy button carries the next
// price, and the engraved owned-word lands when the ladder is sold out.
// No row-info tooltip and no lock state — hoverable product names and
// effect terms carry what the surface cannot show.
const ARETE_LADDER_PRODUCTS: Record<"extenders" | "catalysts" | "beam", {
  name: CatalogTerm;
  id: string;
  ownedWord: string;
  ownedOf(state: GameState): number;
  nextPrice(state: GameState): number | null;
  rungs: number;
  delta(state: GameState): string;
  effect(): string;
}> = {
  extenders: {
    name: "Expansion Bays",
    id: "buy-capacity-ceiling",
    ownedWord: "raised",
    ownedOf: (state) => state.capacityCeilings,
    nextPrice: nextCeilingPrice,
    rungs: BALANCE.capacityCeilingCosts.length,
    delta: (state) => `ceiling ${capacityCeiling(state)} → ${capacityCeiling(state) + 1}`,
    effect: () => `Raises the ${termTipHtml("Harmonic capacity")} ceiling one rung each · ${termTipHtml("memorized")}`,
  },
  catalysts: {
    name: "Chord Catalysts",
    id: "buy-capacity-discount",
    ownedWord: "catalyzed",
    ownedOf: (state) => state.capacityDiscounts,
    nextPrice: nextDiscountPrice,
    rungs: BALANCE.capacityDiscountCosts.length,
    delta: (state) => {
      const owned = state.capacityDiscounts;
      const now = Math.round((BALANCE.capacityDiscountShares[owned - 1] ?? 0) * 100);
      return `prices −${now}% → −${Math.round(BALANCE.capacityDiscountShares[owned]! * 100)}%`;
    },
    effect: () => `Each takes 20% off every ${termTipHtml("Poly Expander")} price · ${termTipHtml("memorized")}`,
  },
  beam: {
    name: "Warp Beam",
    id: "buy-arete-beam",
    ownedWord: "extended",
    ownedOf: (state) => state.mergeCapPurchases,
    nextPrice: mergeCapIncreaseCost,
    rungs: BALANCE.mergeCapCosts.length,
    delta: (state) => `${tierWord(unlockedMergeCap(state))} → ${tierWord(unlockedMergeCap(state) + 1)}`,
    effect: () => `Raises the ${termTipHtml("merge tier")} cap one tier each · ${termTipHtml("memorized")}`,
  },
};

function areteLadderRowHtml(app: App, key: "extenders" | "catalysts" | "beam"): string {
  const product = ARETE_LADDER_PRODUCTS[key];
  const owned = product.ownedOf(app.state);
  const price = product.nextPrice(app.state);
  return `<article class="catalog-row">
    <div><h3 class="t-condensed">${termTipHtml(product.name)} <span class="mono">${owned}/${product.rungs}</span></h3><p class="t-note">${product.effect()}</p>${
      price === null ? "" : `<p class="t-note mono">${product.delta(app.state)}</p>`
    }</div>
    ${price === null ? catalogOwnedHtml(product.ownedWord) : areteBuyButtonHtml(app, product.id, price)}
  </article>`;
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
// reveals two sections (issue #310 steering) — Upgrades (the entry's
// ACQUIRED rewards line, Expansion Bays, Chord Catalysts, Headroom, the
// inert Accelerator placeholder) and Module Types (the roll-pool join,
// empty once joined). Prices mute when unaffordable or in flow
// ("spent between sessions"). One feats surface per screen stands
// elsewhere (ADR-0030 unamended).
function renderCatalogModal(app: App, content: HTMLElement): void {
  const { ui } = app;
  const face = ui.catalogFace;
  // The arete tab stands open from the start (issue #292 review): before
  // the first prestige its face is the entry purchase screen — the preview
  // of the future entry, price muted — never a locked tab. The scrap face
  // (2026-10-18 feedback) is a switch-reachable stop: the mode-wins door
  // never lands on it, and it carries the shop's scrap-priced rows.
  const faceTab = (f: "nous" | "arete" | "scrap", mark: string, word: string): string =>
    `<button class="catalog-face-tab" data-catalog-face="${f}" aria-pressed="${face === f}">${mark}<span>${word}</span></button>`;
  const identity = face === "arete"
    ? `<span class="catalog-identity" aria-hidden="true">${ARETE_SVG}</span>`
    : face === "scrap"
      ? `<span class="catalog-identity catalog-identity-scrap" aria-hidden="true">${SCRAP_SVG}</span>`
      : `<span class="catalog-identity catalog-identity-nous" aria-hidden="true"><b class="mono">ν</b></span>`;
  const body = face === "arete" ? catalogAreteFaceHtml(app) : face === "scrap" ? catalogScrapFaceHtml(app) : catalogNousFaceHtml(app);
  content.innerHTML = `<div class="catalog-frame">
    <div class="catalog-top">
      <span class="catalog-face-switch" role="group" id="modal-title" aria-label="Catalog">${faceTab("nous", '<b class="mono">ν</b>', "nous")}${faceTab("arete", ARETE_SVG, "Arete")}${faceTab("scrap", SCRAP_SVG, "scrap")}</span>
      ${identity}
      <button id="close-modal" aria-label="Close dialog">✕</button>
    </div>
    <div class="catalog-body">${body}</div>
  </div>`;
  content.querySelectorAll<HTMLButtonElement>("[data-catalog-face]").forEach((button) => {
    app.listen(button, "click", () => {
      app.ui.catalogFace = button.getAttribute("data-catalog-face") as typeof face;
      app.render();
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((button) => {
    app.listen(button, "click", () => {
      app.buyShelf(button.getAttribute("data-buy") as keyof typeof BALANCE.shelfPrices);
    });
  });
  app.listen(content.querySelector<HTMLButtonElement>("[data-buy-capacity]"), "click", () => app.buyCapacityAction());
  app.listen(byId("buy-capacity-ceiling"), "click", () => app.buyCapacityCeilingAction());
  app.listen(byId("buy-capacity-discount"), "click", () => app.buyCapacityDiscountAction());
  app.listen(byId("buy-arete-beam"), "click", () => app.buyMergeCapAction());
  app.listen(byId("buy-arete-entry"), "click", () => app.buyCatalogEntryAction());
  app.listen(byId("buy-arete-pool"), "click", () => app.joinRollPoolAction());
  app.listen(byId("buy-world-column"), "click", () => app.buyChargeColumnAction());
  app.listen(byId("buy-world-hone"), "click", () => app.buyHoneRankAction("chargeBlade"));
  // The scrap face's purchases and rolls (issues #378, #379): the same
  // handlers the rows carried on the Forge, one sheet home now.
  app.listen(content.querySelector<HTMLButtonElement>("[data-buy-draft-upgrade]"), "click", () => app.buyDraftUpgradeAction());
  content.querySelectorAll<HTMLButtonElement>("[data-buy-special]").forEach((button) => {
    app.listen(button, "click", () => app.buySpecialDraftAction(button.dataset.buySpecial as SpecialDraftKind));
  });
  content.querySelectorAll<HTMLButtonElement>("[data-roll-special]").forEach((button) => {
    app.listen(button, "click", () =>
      app.rollSpecialDraftAction(button.dataset.rollSpecial as SpecialDraftKind, (button.dataset.specialCategory ?? "oscillator") as Category),
    );
  });
  app.listen(byId("catalog-show-acquired"), "change", (event) => {
    app.ui.showAcquired = (event.target as HTMLInputElement).checked;
    app.render();
  });
  // A face rebuild replaces this root, so disclosure listeners cannot
  // accumulate on the stable modal content and toggle a tap twice.
  wireTooltips(content.querySelector(".catalog-frame")!, app.signal);
  wireClose(app);
}

// The scrap face (2026-10-18 feedback): the shop's scrap-priced drafts in
// the catalog-row grammar the other faces sell through — name and note
// left, the price affordance right, rule-separated rows. Two sections:
// the Forge Upgrades' permanent rungs, then the Special Drafts' one-time
// products (the section name carries "one draft", so the notes don't). No
// info icons (the effect lines and the muted states say enough).
// Purchases act in upgrade mode only, like every catalog face.
function catalogScrapFaceHtml(app: App): string {
  const upgrade = app.state.mode === "upgrade";
  return `<div class="catalog-sections">
    <section>
      <h2 class="t-condensed">Forge Upgrades</h2>
      <div class="catalog-rows">${draftLoomRowHtml(app.state)}</div>
    </section>
    <section>
      <h2 class="t-condensed">Special Drafts</h2>
      <div class="catalog-rows">${specialDraftRowsHtml(app.state)}</div>
    </section>
  </div>
  ${upgrade ? "" : `<p class="modal-note">Purchases happen between sessions — enter upgrade mode to buy.</p>`}`;
}

// The Draft Loom row (issue #378, parent #366): the Forge Upgrades
// section's permanent purchase — scrap buys rungs, each raising the
// chance every fresh candidate mints one merge tier higher (offered tiers
// never pass the unlocked cap). The row reads its owned level like the
// inventory's notation, then the chance and next price. The flow lock and
// an empty scrap balance mute the buy; the tuned ladder retires it for
// the engraved word.
function draftLoomRowHtml(state: GameState): string {
  const chance = draftTierChanceOf(state.draftTierBonus);
  const price = nextDraftUpgradePrice(state.draftTierBonus);
  const nextChance = Math.round(draftTierChanceOf(state.draftTierBonus + 1) * 100);
  const chanceReadout = `${Math.round(chance * 100)}%${price === null ? "" : ` → ${nextChance}%`}`;
  const locked = state.mode !== "upgrade";
  const buy = price === null
    ? `<span class="shop-buy"><span class="st-acquired">Tuned</span></span>`
    : `<span class="shop-buy"><button class="price scrap" data-buy-draft-upgrade aria-label="Improve the Draft Loom to ${nextChance}% tier bonus · ${formatInt(price)} scrap"${
        locked || state.scrap < price ? " disabled" : ""
      }>${formatInt(price)} <small class="scrap-mark" aria-hidden="true">${SCRAP_SVG}</small></button></span>`;
  return `<article class="catalog-row">
    <div><h3 class="t-condensed">Draft Loom</h3><p class="t-note"><span class="mono">Lv. ${state.draftTierBonus}</span> · ${termTipHtml("merge tier")} bonus <span class="mono">${chanceReadout}</span> · ${termTipHtml("memorized")}</p></div>
    ${buy}
  </article>`;
}

// A special draft's guarantee in words: the scrap rows' trimmed notes and
// the Forge's rolled-offer note read this one builder.
function specialDraftEffect(kind: SpecialDraftKind, category?: Category): string {
  return kind === "category"
    ? `${categoryTermHtml(category ?? "oscillator")} draft`
    : kind === "rare"
      ? "Every candidate rare"
      : `Every candidate one ${termTipHtml("merge tier")} up`;
}

function categoryTermHtml(category: Category): string {
  return termTipHtml(category === "conduit" ? "Charge conduit" : category === "ritual" ? "RITUAL" : CATEGORY_WORD[category] as CatalogTerm, CATEGORY_WORD[category]);
}

// Each pool category's symbol rides the representative launch design's
// glyph in the category hue — the same hex the inventory carries for that
// category's flagship, so the Jacquard previews read as the categories
// they roll.
const CATEGORY_SYMBOL_TYPE: Record<Category, ModuleType> = {
  oscillator: "additive",
  generator: "focusKeyed",
  booster: "blaster",
  silentVoice: "harmonizer",
  spacer: "spacer",
  forge: "forge",
  conduit: "amplifier",
  ritual: "ritual",
};

// The special drafts' rows (issue #379, parent #366): the Special Drafts
// section's one-time products, the same row grammar — proper name, one
// trimmed effect line, the scrap price on the buy beside its Roll control.
// The Roll button stands on every row in the unavailable state until an
// entitlement is held (2026-10-18 feedback); rolling banks an ordinary
// guaranteed offer — the Forge's candidates resolve it with the same
// choose and skip, under the product's own name (the offer carries its
// special tag). The Jacquard Card rolls from the category symbols beneath
// its row — shown once a Card is held (they read too bulky otherwise),
// live only then. The flow lock mutes everything; an unaffordable price
// mutes the buy; a Plied Weft the unlocked cap cannot honor stands muted
// with its siblings — the one unavailable state the grammar has.
function specialDraftRowsHtml(state: GameState): string {
  const locked = state.mode !== "upgrade";
  const held = (kind: SpecialDraftKind) => state.specialDrafts[kind] ?? 0;
  const buyButton = (kind: SpecialDraftKind, available: boolean) => {
    const price = BALANCE.specialDraftCosts[kind];
    const name = SPECIAL_DRAFT_NAME[kind];
    return `<button class="price scrap" data-buy-special="${kind}" aria-label="Buy a ${name} · ${formatInt(price)} scrap"${
      locked || !available || state.scrap < price ? " disabled" : ""
    }>${formatInt(price)} <small class="scrap-mark" aria-hidden="true">${SCRAP_SVG}</small></button>`;
  };
  const rollButton = (kind: SpecialDraftKind) =>
    `<button class="price scrap" data-roll-special="${kind}" aria-label="Roll the held ${SPECIAL_DRAFT_NAME[kind]}"${
      locked || held(kind) < 1 ? " disabled" : ""
    }>Roll</button>`;
  const priceCell = (kind: SpecialDraftKind, available: boolean, withRoll: boolean) =>
    `<span class="shop-buy"><span class="special-controls">${withRoll ? rollButton(kind) : ""}${buyButton(kind, available)}</span><small class="shop-countdown mono">${held(kind)} held</small></span>`;
  const jacquardSymbols = held("category") > 0
    ? `<div class="special-rolls" role="group" aria-label="Roll the held Jacquard Card — pick the category">${
        (Object.keys(CATEGORY_WORD) as Category[])
          .map(
            (category) =>
              `<div class="special-category-choice"><button class="special-roll-pick" data-roll-special="category" data-special-category="${category}" style="--category-hue: var(--${HUE_TOKEN_OF[CATEGORY_SYMBOL_TYPE[category]]})" aria-label="Roll the held Jacquard Card · ${CATEGORY_WORD[category]} draft"${
                locked ? " disabled" : ""
              }><span class="special-roll-symbol">${inventoryTileSvg({ type: CATEGORY_SYMBOL_TYPE[category] })}</span></button><span class="special-roll-word mono">${categoryTermHtml(category)}</span></div>`,
          )
          .join("")
      }</div>`
    : "";
  const tierAvailable = unlockedMergeCap(state) >= 1;
  return `<article class="catalog-row">
      <div><h3 class="t-condensed">Jacquard Card</h3><p class="t-note">Your chosen category · ${termTipHtml("memorized")}</p></div>
      ${priceCell("category", true, false)}
    </article>
    ${jacquardSymbols}
    <article class="catalog-row">
      <div><h3 class="t-condensed">Silk Warp</h3><p class="t-note">Every candidate rare · ${termTipHtml("memorized")}</p></div>
      ${priceCell("rare", true, true)}
    </article>
    <article class="catalog-row">
      <div><h3 class="t-condensed">Plied Weft</h3><p class="t-note">Every candidate one ${termTipHtml("merge tier")} up · ${termTipHtml("memorized")}</p></div>
      ${priceCell("tier", tierAvailable, true)}
    </article>`;
}

// The catalog's price affordance (issue #271): the outline price button in
// the register the row sells in — muted by the disabled state whenever the
// price is out of reach or flow holds the purse ("spent between sessions")
// — over its practice-minute countdown while arranging. The visible price,
// state and between-session note need no native tooltip.
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
  return `<span class="shop-buy"><button class="price${options.arete ? " arete" : ""}" ${options.attrs ?? ""}${
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
      const description = shelfDescriptionHtml(type);
      const moduleMeta = META[SHELF_MODULE[type]];
      return `<article class="catalog-row">
        <div class="with-preview">${modulePreviewSvg(SHELF_MODULE[type])}<div><h3 class="t-condensed">${moduleMeta.name}</h3><p class="t-note">${description}</p></div></div>
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
              `<article class="catalog-row"><div><h3 class="t-condensed">${META[SHELF_MODULE[type]].name}</h3><p class="t-note">${shelfDescriptionHtml(type)}</p></div><span class="activation-owned mono">in inventory</span></article>`,
          )
          .join("")}</div>`
      : ""
  }
  ${upgrade ? "" : `<p class="modal-note">Purchases happen between sessions — enter upgrade mode to buy.</p>`}`;
}

function shelfDescriptionHtml(type: keyof typeof SHELF_DESCRIPTIONS): string {
  return (SHELF_DESCRIPTIONS[type] ?? META[SHELF_MODULE[type]].role)
    .replace(/\bcharge\b/gi, () => termTipHtml("charge"));
}

// The simplified module mark (the tray tile's own): the category-hued hex
// outline over the signature glyph — the little preview a catalog row
// carries where the full face would be noise.
function modulePreviewSvg(type: ModuleType): string {
  return `<span class="module-preview">${inventoryTileSvg({ type })}</span>`;
}

// The arete face's one engraved mark: the acquisition word in the state
// grammar's own class (the prototype's completion read).
function catalogOwnedHtml(word: string): string {
  return `<span class="shop-buy"><span class="st-acquired">${word}</span></span>`;
}

// The Accelerator row's provisional figure (the prototype's): the row is
// an inert placeholder — the price never charges, the button never arms —
// so the number lives here alone, named for what it is.
const ACCELERATOR_PLACEHOLDER_PRICE = 3;

// The arete face: the single centered lock screen until the Mutator entry
// is bought, then its sections (issue #310 steering) — World first (the
// co-listing order: World leads, issue #426), then Upgrades (the capacity
// products, the inert Accelerator placeholder) and Module Types (the roll
// pool join, previewed by the module's own face). The Mutator tree's own
// entry retired with the Mutator Grid's surfaces (issue #426); the face
// restructures around what remains without orphaned placeholders. Prices
// mute when unaffordable or in flow ("spent between sessions").
function catalogAreteFaceHtml(app: App): string {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  if (!state.catalogEntryOwned) {
    const affordable = state.arete >= BALANCE.catalogEntryCost;
    return `<div class="entry-screen">
      <button class="entry-buy" id="buy-arete-entry"${upgrade && affordable ? "" : " disabled"}><span>Unlock Mutator Layer</span><span class="mono">${BALANCE.catalogEntryCost} Arete</span></button>
    </div>
    ${upgrade ? "" : `<p class="modal-note">Arete is spent between sessions — enter upgrade mode to buy.</p>`}`;
  }
  const joined = state.rollPoolJoined;
  return `<div class="catalog-sections">
    <section>
      <h2 class="t-condensed">World</h2>
      <div class="catalog-rows">
        ${catalogColumnRowHtml(app)}
        ${catalogHoneRowHtml(app, "chargeBlade")}
      </div>
    </section>
    <section>
      <h2 class="t-condensed">Upgrades</h2>
      <div class="catalog-rows">
        ${areteLadderRowHtml(app, "extenders")}
        ${areteLadderRowHtml(app, "catalysts")}
        ${areteLadderRowHtml(app, "beam")}
        <article class="catalog-row">
          <div><h3 class="t-condensed">Arete Accelerator <span class="kind">(placeholder)</span></h3></div>
          ${catalogPriceHtml({ attrs: 'disabled', price: ACCELERATOR_PLACEHOLDER_PRICE, affordable: false, arete: true })}
        </article>
      </div>
    </section>
    <section>
      <h2 class="t-condensed">Module Types ${infoTipHtml("module-types-tip", "About module types", "Rolled module types appear here unweighted")}</h2>
      <div class="catalog-rows">
        ${
          joined
            ? `<p class="empty-copy">Nothing waits — future objects appear in future rolls.</p>`
            : `<article class="catalog-row">
                <div class="with-preview">${modulePreviewSvg("mutatorForge")}<div><h3 class="t-condensed">Mutator Forge</h3><p class="t-note">Fill with ${termTipHtml("charge")} → Mutator draft</p></div></div>
                ${areteBuyButtonHtml(app, "buy-arete-pool", BALANCE.rollPoolJoinCost)}
              </article>`
        }
      </div>
    </section>
  </div>
  ${upgrade ? "" : `<p class="modal-note">Arete is spent between sessions — enter upgrade mode to buy.</p>`}`;
}

// The Charge Column's ladder row (issue #426, priority 6): the entry is
// the Column itself — never a per-copy upsell and never `memorized`
// (persistence rides the reset contract, not the memorized family). The
// owned count reads beside the name; the price rides the authored
// escalation.
function catalogColumnRowHtml(app: App): string {
  const { state } = app;
  const owned = state.world.columns.length;
  const price = columnCost(owned);
  return `<article class="catalog-row">
    <div class="with-preview"><span class="module-preview world-preview">${worldTileSvg("column")}</span><div><h3 class="t-condensed">${termTipHtml("Charge Column")} <span class="mono">${owned}</span></h3><p class="t-note">Copies its cell's received ${termTipHtml("charge")} to adjacent weapons · placed free</p></div></div>
    ${areteBuyButtonHtml(app, "buy-world-column", price)}
  </article>`;
}

// The Hone row (issue #426, priority 6): one entry per weapon type, each
// rank persistently raising the type's attack power for every copy — the
// type's power owned, never a per-copy purchase. The authored ladder's end
// lands the engraved word; weapons appear nowhere as purchases.
function catalogHoneRowHtml(app: App, type: WeaponType): string {
  const { state } = app;
  const rank = state.world.hone[type];
  const price = honeCostOf(state, type);
  const perRank = BALANCE.world.honeAttackPerRank;
  const name = WORLD_META[type].name;
  const ladderLength = BALANCE.world.honeCosts.length;
  return `<article class="catalog-row">
    <div><h3 class="t-condensed">${termTipHtml("Hone")} <span class="mono">${rank}/${ladderLength}</span></h3><p class="t-note">+${perRank} attack per rank · every ${termTipHtml(name as CatalogTerm)} · ${termTipHtml("memorized")}</p>${
      price === null ? "" : `<p class="t-note mono">ATK ${BALANCE.world.attackBase + rank * perRank} → ${BALANCE.world.attackBase + (rank + 1) * perRank}</p>`
    }</div>
    ${price === null ? catalogOwnedHtml("honed") : areteBuyButtonHtml(app, "buy-world-hone", price)}
  </article>`;
}

function forgeEffect(type: ModuleInstance["type"], tier: number): string {
  const power = tierPowerOf(tier);
  switch (type) {
    // The waveform profiles (issue #369, ADR-0059): the effect line names
    // the niche in words; the grade chips beside it carry the fixed
    // shorthand, their disclosures the exact coefficients.
    case "additive": return `+${formatNumber(baseTermOf(type, power))} ν/s base · reduced booster response`;
    case "triangle": return "Chord-fed term · reduced base";
    case "square": return "Booster-fed term · reduced chord response";
    case "saw": return "Charge-fed term · reduced base";
    case "blaster": return "Received charge → ν/s · sings even uncharged";
    // The temporal profiles (issue #372): the effect line names the niche;
    // the timing line beside it spells the curve out — never a grade.
    case "afterglow": return "Session-clocked term · weak open, strong sustained";
    // The alternative-charge wave's oscillator (issue #375): the effect
    // line states the replacement — charge lands in the chord response.
    case "sideband": return "Received charge → chord response · weak standalone term";
    // The breather specialists (issue #416): the lines name the rest
    // keying; the chip carries the authored figure and the rule line
    // beside it spells the fact-keyed growth out — never a grade.
    case "release": return "Breather-fed term · reduced base";
    case "standby": return "Breather-fed term · deepens with completed breathers · reduced base";
    case "tail": return "Breather-fed term · lifetime rest warms the weak base";
    case "harmonizer": return `Cell pitch · +${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel * power)}%/level to its chords`;
    case "echo": return `Adjacent pitch, octave down · +${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel * power)}%/level to its chords`;
    case "bend": return `Shifted cell pitch · +${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel * power)}%/level to its chords`;
    case "amplifier": return `Relay charge ×${formatNumber(power)} · +${formatNumber(100 * BALANCE.amplifierGainPerLevel * power)}%/level · ${BALANCE.amplifierHopCap} hops`;
    case "ritual": return `Receives charge continuously · habit-keyed`;
    case "spacer": return "Silent wire · connects chord adjacency";
    // The generator profiles (issue #371): the effect line names the niche
    // in words with its leading exact figure — the profile table is the
    // one source, so the quote cannot drift from the credit seam's own.
    case "focusKeyed":
    case "noteKeyed":
    case "goalKeyed": {
      const profile = generatorProfileOf(type)!;
      if (type === "focusKeyed") return `+${formatNumber(profile.focus * power)} charge/s of practice · modest note and goal credit`;
      if (type === "noteKeyed") return `+${formatNumber(profile.noteCreate * power)} charge/new note ≥${BALANCE.noteCreationMinChars} chars · +${formatNumber(profile.noteChar * power)}/char (${formatNumber(BALANCE.noteCharCreditCap * power)} max/note) · modest practice credit`;
      return `+${formatNumber(profile.goal * goalCompletionBase(60, 1) * power)} charge/live goal minute at completion · modest practice and note credit`;
    }
    case "pulsewell": return "Mixed-fed reserve · timed delivery bursts";
    case "infusor": return `Adjacent production +${formatNumber(BALANCE.infusorBonus * 100 * power)}% · charge boosts uplift`;
    // The booster wave's niches (issue #374): coverage against strength.
    case "field": return `Every adjacent oscillator +${formatNumber(BALANCE.fieldBonus * 100 * power)}% · charge boosts uplift`;
    case "spotlight": return `One recipient +${formatNumber(BALANCE.spotlightBonus * 100 * power)}% · charge boosts uplift`;
    // The chord-response booster (issue #375): the term it lifts named in
    // the line — never read as amplitude.
    case "chorus": return `Neighbors' chord response +${formatNumber(BALANCE.chorusBonus * 100 * power)}% · charge boosts share · needs a chord`;
    // The charge-response booster (issue #376): the term named and the
    // condition stated — the grant reads only on charged recipients.
    case "exciter": return `Neighbors' charge response +${formatNumber(BALANCE.exciterBonus * 100 * power)}% · charge boosts share · needs charged recipients`;
    case "forge": return "Received charge → module rolls";
    case "mutatorForge": return "Received charge → mutator rolls";
    default: return "Not yet active";
  }
}

// Match the visible copy once so generated tooltip markup is never reprocessed.
function forgeEffectHtml(effect: string): string {
  let breatherDisclosed = false;
  return effect.replace(/\b(module rolls|mutator rolls|chords|pitch|charge|goals|breathers?)\b/gi, label => {
    if (/^breathers?$/i.test(label)) {
      if (breatherDisclosed) return label;
      breatherDisclosed = true;
      return termTipHtml("Breather", label);
    }
    return termTipHtml(label.toLowerCase() as CatalogTerm, label);
  });
}

// The meter detail's live slots (ADR-0041): the figures move every tick a
// session runs, so the open modal fills them in place — the rebuild only
// fires when the pending offer changes, and the detail never flickers.
// Each track carries the same progressbar semantics its fill and figures
// show (#351): valuenow and valuetext mirror the visible read, so AT
// queries exactly what the eye reads beside it. The zero placeholders
// stand only until the same-pass live patch fills them — never painted.
function forgeMeterHtml(face: App["ui"]["forgeFace"]): string {
  const meter = (name: string, key: string) => `<div class="forge-meter">
    <span class="meter-name">${name}</span><span class="meter-figures mono" data-live="modal-${key}-line"></span>
    <span class="forge-track" data-live="modal-${key}-track" role="progressbar" aria-label="${name}" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"><i data-live="modal-${key}-pip"></i></span>
  </div>`;
  // The practice-roll meter left the Forge modal with the flow meter's
  // retirement (issue #423): it renders only on the Focus sheet's
  // habit/class face. The modal's block stays the charge branches'.
  return `<div class="forge-meters">${face === "mutators"
    ? meter("Mutator Forge", "mutator")
    : meter("Module Forge", "forge")}</div>`;
}

function updateForgeMetersLive(scope: ParentNode, state: GameState, forgeRate: number, mutatorRate: number): void {
  const forgeCap = forgeThreshold(state.forge.earned);
  const mutatorCap = mutatorForgeThreshold(state.mutatorForge.earned);
  for (const [key, progress, cap] of [["forge", state.forge.progress, forgeCap], ["mutator", state.mutatorForge.progress, mutatorCap]] as const) {
    liveAttr(scope, `modal-${key}-pip`, "style", `width:${meterPipFill(progress, cap)}`);
    liveAttr(scope, `modal-${key}-track`, "aria-valuenow", String(Math.max(0, progress)));
    liveAttr(scope, `modal-${key}-track`, "aria-valuemax", String(cap));
  }
  const forgeLine = `${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(forgeCap)}${forgeRate > 0 ? ` · ${formatNumber(forgeRate)}/s` : ""}`;
  liveSet(scope, "modal-forge-line", forgeLine);
  liveAttr(scope, "modal-forge-track", "aria-valuetext", forgeLine);
  const mutatorLine = `${formatNumber(Math.max(0, state.mutatorForge.progress))} / ${formatNumber(mutatorCap)}${mutatorRate > 0 ? ` · ${formatNumber(mutatorRate)}/s` : ""}`;
  liveSet(scope, "modal-mutator-line", mutatorLine);
  liveAttr(scope, "modal-mutator-track", "aria-valuetext", mutatorLine);
}

function renderForgeModal(app: App, content: HTMLElement, projected: RateSnapshot): void {
  const { state, ui } = app;
  const face = ui.forgeFace;
  const offer = state.bankedRolls.at(-1);
  const mutOffer = state.bankedMutatorRolls.at(-1);
  const hasOffer = face === "modules" ? !!offer : !!mutOffer;
  // The skip stands centered beneath the draft (2026-10-18 feedback) —
  // the whole offer resolves before the payout question asks itself.
  const skip = face === "modules" && offer
    ? `<div class="forge-skip-row"><button class="forge-skip" data-skip-offer="${offer.id}" aria-label="Skip draft · +${formatInt(skipPayoutOf(offer))} scrap">Skip <span class="mono">+${formatInt(skipPayoutOf(offer))}</span><small class="scrap-mark" aria-hidden="true">${SCRAP_SVG}</small></button></div>`
    : "";
  content.innerHTML = `<div class="forge-frame">
    <h2 id="modal-title" class="sr-only">Forge choice</h2>
    <div class="forge-top">
      <div class="forge-switch" role="group" aria-label="Forge drafts">
        ${state.catalogEntryOwned ? `<button data-forge-face="mutators" aria-pressed="${face === "mutators"}" aria-label="Mutators, ${state.bankedMutatorRolls.length} banked ${state.bankedMutatorRolls.length === 1 ? "roll" : "rolls"}">Mutators <span class="mono">${state.bankedMutatorRolls.length}</span></button>` : ""}
        <button data-forge-face="modules" aria-pressed="${face === "modules"}" aria-label="Modules, ${state.bankedRolls.length} banked ${state.bankedRolls.length === 1 ? "roll" : "rolls"}">Modules <span class="mono">${state.bankedRolls.length}</span></button>
      </div>
      <button id="close-modal" aria-label="Close Forge">Close <kbd>Esc</kbd></button>
    </div>
    ${hasOffer ? `<p class="forge-choice-cue">Choose a new ${face === "modules" ? "module" : "mutator"}</p>${
      face === "modules" && offer?.special
        ? `<p class="forge-offer-note"><span class="t-condensed">${SPECIAL_DRAFT_NAME[offer.special.kind]}</span> · ${specialDraftEffect(offer.special.kind, offer.special.category)}</p>`
        : ""
    }
    <div class="candidates ${face === "mutators" ? "mut-candidates" : ""}">
      ${face === "modules" && offer ? offer.candidates.map(candidate => `
        <div class="candidate-tile" data-rarity="${typeRarityOf(candidate.type)}" data-type="${candidate.type}"><button class="candidate-pick" data-choice="${candidate.id}" data-offer="${offer.id}" data-rarity="${typeRarityOf(candidate.type)}" data-type="${candidate.type}" aria-label="Take ${RARITY_LABEL[typeRarityOf(candidate.type)]} ${META[candidate.type].name} · ${tierWord(candidate.tier)}" aria-describedby="forge-effect-${candidate.id}"></button>
          <span class="module-preview">${inventoryTileSvg(candidate)}</span>
          <span class="candidate-readout"><span class="candidate-name">${rarityMark(typeRarityOf(candidate.type))} ${META[candidate.type].name} <span class="mono">${tierNumeral(candidate.tier)}</span></span>
          <span id="forge-effect-${candidate.id}" class="candidate-effect">${forgeEffectHtml(forgeEffect(candidate.type, candidate.tier))}</span>
          ${profileGradesHtml(candidate.type, { breatherDisclosed: true })}
          ${candidate.type !== "spacer" && !["harmonizer", "echo", "bend", "amplifier", "ritual"].includes(candidate.type) ? `<span class="candidate-scaling">+${formatNumber((BALANCE.rarityPower[typeRarityOf(candidate.type)] - 1) * 100)}% / level</span>` : ""}</span>
        </div>`).join("") : mutOffer ? mutOffer.candidates.map(candidate => `
        <div class="candidate-tile mut-candidate" data-rarity="${candidate.rarity}"><button class="candidate-pick" data-mut-choice="${candidate.id}" data-mut-offer="${mutOffer.id}" data-rarity="${candidate.rarity}" aria-label="Take ${RARITY_LABEL[candidate.rarity]} ${FAMILY_WORD[candidate.family]} mutator" aria-describedby="forge-effect-${candidate.id}"></button>
          <span class="module-preview"><svg viewBox="-70 -70 140 140" aria-hidden="true" style="color:var(--arete)">${mutatorTileInner(candidate)}</svg></span>
          <span class="candidate-readout"><span class="candidate-name">${rarityMark(candidate.rarity)} ${FAMILY_WORD[candidate.family]}</span>
          <span id="forge-effect-${candidate.id}" class="candidate-effect">${forgeEffectHtml(mutatorEffectText(candidate.family, candidate.rarity))}</span></span>
        </div>`).join("") : ""}
    </div>${skip}` : `<p class="empty-copy">No ${face === "mutators" ? "mutator" : "module"} rolls banked.</p>`}
    ${forgeMeterHtml(face)}</div>`;
  wireTooltips(content, app.signal);
  updateForgeMetersLive(content, state, projected.forgeRate, projected.mutatorForgeRate);
  content.querySelectorAll<HTMLButtonElement>("[data-forge-face]").forEach(button => {
    app.listen(button, "click", () => {
      ui.forgeFace = button.dataset.forgeFace as typeof face;
      app.render();
      content.querySelector<HTMLButtonElement>(`[data-forge-face="${ui.forgeFace}"]`)?.focus();
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach(button => {
    app.listen(button.parentElement!, "click", (event) => {
      if (event.target instanceof Element && event.target.closest(".inst-tip")) return;
      app.chooseCandidate(button.dataset.offer!, button.dataset.choice!);
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-skip-offer]").forEach(button => {
    app.listen(button, "click", () => app.skipDraftAction(button.dataset.skipOffer!));
  });
  content.querySelectorAll<HTMLButtonElement>("[data-mut-choice]").forEach(button => {
    app.listen(button.parentElement!, "click", (event) => {
      if (event.target instanceof Element && event.target.closest(".inst-tip")) return;
      app.chooseMutatorCandidate(button.dataset.mutOffer!, button.dataset.mutChoice!);
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
      <button id="reset-confirm" class="primary danger">Erase everything</button>
    </div>`;
  app.listen(byId("reset-cancel"), "click", () => app.closeModal());
  app.listen(byId("reset-confirm"), "click", () => app.hardReset());
  wireClose(app);
}

// The prestige confirm (ADR-0039): the door's second press. The claim is
// stated live; the boundary's two sides are named plainly — what prestige
// takes (levels, nous, charge) and what survives it (the board, tray,
// rolls, achievements, life record, Arete, and the World's purchases —
// issue #425). Copy is tuning, and the glossary's avoided-verb rule holds:
// prestige is the verb, never "reset". The zero-claim case (issue #425):
// a reset at or below the claimed frontier banks nothing — valid, and
// said outright before the confirm, so a mis-spent stretch reads as a
// lesson the player can choose to end.
function renderPrestigeModal(app: App, content: HTMLElement): void {
  const claim = bankableClaimOf(app.state);
  // The capacity clause (issue #259): purchased capacity is era progress,
  // so the modal names it among what prestige takes.
  const capacityClause = ", purchased capacity returns to one";
  const zero = claim === 0;
  content.innerHTML = `
    ${modalTop("PRESTIGE")}
    <h2 id="modal-title">Begin the next era?</h2>
    <p class="lead">${zero
      ? `This prestige banks <strong>no Arete</strong> — the frontier already covers how far this era climbed.`
      : `Prestige banks <strong class="mono">${claim} Arete</strong>`} and starts the era over: module levels return to base${capacityClause}, and your nous and charge return to the opening.</p>
    <p class="lead muted">Your board and its placement, the tray, banked Forge rolls and progress, feats, your whole life record, your Arete, your scrap, and lifetime nous all stay — as do your World columns, weapons, and ${termTipHtml("Hone")} ranks.</p>
    <div class="modal-actions">
      <button id="prestige-cancel">Not yet</button>
      <button id="prestige-confirm" class="primary">${zero ? "Prestige anyway" : `Prestige and claim ${claim} Arete`}</button>
    </div>`;
  app.listen(byId("prestige-cancel"), "click", () => app.closeModal());
  wireTooltips(content, app.signal);
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
  // The breather offer (docs/breather-spec.md §2, §5): one control beside
  // dismissal whenever the session minted an allowance — name + state +
  // effect, the concrete minutes; declining (Continue, ✕, backdrop, Esc)
  // expires it.
  const allowance = summary.breatherAllowance ?? 0;
  const breatherOffer = allowance > 0
    ? `<button id="summary-breather" class="primary">Take a ${formatDuration(allowance)} breather</button>`
    : "";
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
    <div class="modal-actions">${breatherOffer}<button id="summary-continue" class="${allowance > 0 ? "" : "primary"}">Continue</button></div>`;
  wireTooltips(content, app.signal);
  if (allowance > 0) app.listen(byId("summary-breather"), "click", () => app.takeBreather());
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

function renderDev(app: App, stage: ReturnType<typeof devStageBox> | null): void {
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
  if (!stage) return;
  panel.style.maxWidth = `${Math.max(0, stage.width - 24)}px`;
  panel.style.maxHeight = `${Math.max(0, stage.height - 8)}px`;
  panel.innerHTML = `<button class="dev-grip" id="dev-grip" aria-label="Drag to move the dev console" title="Drag to move">⠿</button>
    <span>DEV</span>
    <button data-dev="60">+1m</button>
    <button data-dev="600">+10m</button>
    <button data-dev="target">→ target</button>
    <button data-dev="nous">+100ν</button>
    <button data-dev="synth">+synth</button>
    <button data-dev="worldera">World era</button>
    <button data-dev="focus">Focus setup</button>
    <button data-dev="board">${app.devBoard ? "close board" : "board"}</button>
    ${app.devFocusScenarioNote ? `<span class="dev-note" id="dev-focus-note"></span>` : ""}`;
  // The scenario's assertion readout (issue #456): the setup's ✓ line or
  // the named ✗ failure, set as text — the message is state-derived, so
  // it never rides the template.
  const focusNote = byId("dev-focus-note");
  if (focusNote) focusNote.textContent = app.devFocusScenarioNote;
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
      else if (key === "worldera") app.devWorldEra();
      else if (key === "focus") app.devFocusScenario();
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
          <span class="dev-lvl">Lv. ${module.level}</span>
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
  const scrollTop = scrollTopOf(panel);
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
