import { advance, earnNous } from "../engine/advance";
import type { AdvanceResult } from "../engine/types";
import {
  buyCapacity,
  buyCapacityCeiling,
  buyCapacityDiscount,
  buyCatalogEntry,
  buyCell,
  buyDraftUpgrade,
  buyMergeCapIncrease,
  buyRowUnlock,
  buyShelfModule,
  buySpecialDraft,
  buyChargeColumn,
  buyHoneRank,
  chooseMutatorRoll,
  chooseRoll,
  combine,
  combineInventory,
  scrapInventoryBatch,
  dismissArcCard as dismissArcCardAction,
  dismissSummary as dismissSessionSummary,
  endBreather as endBreatherAction,
  endSession,
  joinRollPool,
  mergeAll,
  pauseSession,
  placeModule,
  placeWorldOccupant,
  prestige,
  recordSummaryReflection,
  resumeSession,
  returnModule,
  retrieveWorldOccupant,
  scrapModule,
  setBendShift,
  setBoosterTarget,
  setWeaponTargetPriority,
  skipRoll,
  startBreather as startBreatherAction,
  startSession,
  upgradeAll,
  upgradeModuleLevels,
  useSpecialDraft,
  type ActionResult,
  type BulkPurchase,
} from "../engine/actions";
import { ARETE_HORIZON, bankableClaimOf, frontierEntitlement } from "../engine/accumulator";
import { columnCost, worldOccupantAt } from "../engine/world";
import type { WeaponType } from "../engine/types";
import { neighbors, hex, sameHex } from "../engine/hex";
import { preferredChordCue } from "../engine/chords";
import { displayedRates, flowLive, deployedAt } from "../engine/economy";
import { worldEntered, refreshWorldPreview, worldRevealPreview, worldBoardLive } from "./world";
import { WORLD_ENEMIES } from "../engine/constants";
import { newlyActiveTermsOf, type AllocatedInstance } from "../engine/allocation";
import { serialize, STORAGE_KEY } from "../engine/save";
import { SharedSave, browserSaveStorage, memorySaveStorage, type LoadedSave } from "./shared-save";
import { formatClock } from "../engine/clock";
import { draftTierChanceOf } from "../engine/rolls";
import { wireTooltips } from "./instrument";
import { unlockedMergeCap } from "../engine/catalog";
import { formatInt, formatNumber } from "./format";
import { applyBreatherGap, applyGap, flushPendingAway, poolOutstanding, resolveHonestyReport, type HonestyOutcome } from "../engine/trust";
import { createInitialState, createModule, createWeapon, createWorldColumn } from "../engine/state";
import { SCENARIOS, scenarioOf, type ScenarioDescriptor } from "../engine/scenarios";
import {
  composePlaythroughRecipe,
  defaultPlaythroughRecipe,
  playthroughInspection,
  PLAYTHROUGH_POLICIES,
  playthroughNote,
  runPlaythrough,
  type PlaythroughInspection,
  type PlaythroughPolicy,
  type PlaythroughRecipe,
  type PlaythroughRecipeInput,
  type PlaythroughRecord,
} from "../engine/playthrough";
import { BALANCE } from "../engine/constants";
import type { FocusApp } from "../engine/apps";
import { writeNote } from "../engine/notes";
import { achievementName, syncAchievements } from "../engine/achievements";
import { CATEGORY_OF, SHELF_MODULE, CHIME } from "../engine/constants";
import { cellNoteOf } from "../engine/lattice";
import {
  activeHabit,
  addPracticeLog,
  archiveHabit,
  createHabit,
  renameHabit,
  selectHabit,
  setHabitColor,
} from "../engine/habits";
import { allocateClassNode, applyClassPreset, classDefOf, respecClassTree, selectHabitClass } from "../engine/classes";
import { createGoal, deleteGoal, editGoal, retainGoalChoice, rollGoalOccurrences } from "../engine/goals";
import { allocatedDevScenarioRates, createDevScenario, type DevBoardResult } from "../engine/dev-scenario";
import type { StressProgress, StressRow } from "../engine/allocation-stress";
import type { Category, ClassId, GameState, HabitColor, Hex, ModuleInstance, ShelfType, SpecialDraftKind } from "../engine/types";
import type { FocusFace, NotesFace } from "./focus";
import { render, updateChordReadout } from "./render";
import { FAMILY_WORD } from "./mutators";
import { HISTORY_PAGE_ROWS, META, CATEGORY_WORD, SPECIAL_DRAFT_NAME, tierWord, WORLD_META, COLUMN_WORD } from "./meta";
import { browserChannels, type SignalChannels } from "./signals";
import { suppressNextClick } from "./click";
import { createInventoryState, type InventoryState } from "./inventory";

// The session modal surfaces (§5.5, §5.7): the session starts through the
// Focus sheet's PLAN face (or instantly, per the session-start preference);
// the loud summary follows every session; the honesty report interrupts
// whenever provisional time waits (§1–2). The rate sheet is the Rate cell's
// tap-up disclosure below the 760px breakpoint (§7); the inventory sheet
// re-docks the board-surface tray for touch on portrait phone.
export type ModalKind =
  | "settings"
  | "catalog"
  | "forge"
  | "achievements"
  | "library"
  | "collection"
  | "export"
  | "import"
  | "reset"
  | "prestige"
  | "grant"
  | "honesty"
  | "summary"
  | "rate"
  | "inventory"
  | "combine"
  | "notes"
  | null;

// The detail's keyboard landing (issue #296): the emphasized face's own
// chassis takes focus — where a tray's consumed tile used to stand, the
// keyboard follows the face the action served. No-op outside the detail.
function focusDetailFace(face: DetailFace): void {
  (
    document.querySelector<HTMLElement>(`[data-detail-section="${face}"] [data-detail-face]`) ??
    document.querySelector<HTMLElement>(`[data-detail-section="${face}"]`)
  )?.focus({ preventScroll: true });
}

// The chord-hover ask (§6): a seam hovered names its one chord; a module
// hovered names every chord it sings in; a World plate hovered names its
// face's full declaration (issue #426). The reserved readout answers.
export type ChordHover =
  | { kind: "chord"; key: string }
  | { kind: "module"; moduleId: string }
  | { kind: "world"; pos: Hex };

// The combine offer's pair (issue #152): the module the player dropped and
// the matching twin that received the drop.
export interface CombineOffer {
  dragId: string;
  targetId: string;
}

// The development allocation board's whole state (#257): the deterministic
// scenario board, the selected whole-chord capacity, the selected voice,
// the previous answer's keys (the retention hint — advanced at each
// mutation, so equal-output allocations hold their active set across
// changes), and the in-browser stress rows when run. Light furniture —
// never saved.
export interface DevBoardState {
  scenario: GameState;
  capacity: number;
  selected: string | null;
  keep: ReadonlySet<string> | null;
  stress: StressRow[] | null;
  stressRunning: boolean;
  stressError: string | null;
}

// The configurable capacities (issue #257): one through five — one the
// shipped start, three the first-era ceiling, four and five the Arete
// ceiling unlocks.
export const DEV_BOARD_CAPACITIES = [1, 2, 3, 4, 5] as const;

export type DetailFace = "modules" | "world";

// The Focus sheet's on-demand forms (ADR-0050, issue #275): add and log on
// the HABIT face, the goal's create and edit in the habit detail, stand as
// action buttons until pressed, then reveal their input row. Light
// furniture — never saved; closed by Escape, a landing, and every sheet
// teardown.
export type FocusForm = "habit-add" | "habit-log" | "goal-create" | "goal-edit";

// The Hex detail's standing state (issue #295): the owned board coordinate
// whose cross-section replaces the grid, and which layer's face is
// emphasized — the fixed stack shows both, Mutators above Modules. Light
// furniture — never saved.
export interface HexDetail {
  pos: Hex;
  face: DetailFace;
}

export interface UiState {
  inventory: InventoryState;
  // The focus app whose console popover is open, if any (ADR-0012).
  app: FocusApp | null;
  placing: string | null;
  // The live drop preview (§5–§6, #260): the module a drag or armed
  // placement is pointing at, and the cell it hovers — null pos while the
  // carried module hovers the inventory zone, the retrieval preview. Null
  // whenever nothing hovers.
  dropHover: { moduleId: string; pos: Hex | null } | null;
  // The chord the pointer rests on (§6): a hovered seam's chord or a
  // hovered module's chords, asked into the reserved readout. Light
  // furniture — never saved, cleared with the transient modes.
  chordHover: ChordHover | null;
  // Cell purchase (ADR-0013): armed from the catalog, resolved by clicking a
  // frontier hex. The buy only lands when a frontier cell is clicked.
  buyingCell: boolean;
  // The combine offer (issue #152): the pair a matching drop put up for
  // review, held while the confirmation dialog stands. Cancel clears it
  // and both copies stay untouched. Light furniture — never saved.
  combineOffer: CombineOffer | null;
  modal: ModalKind;
  forgeFace: "modules" | "mutators";
  importText: string;
  importError: string | null;
  // The plan the next session starts with (§6): null is open-ended — the
  // resting mode, nothing pushed. The launch apps are free (ADR-0019), so
  // even session one can be planned from here; the affordances stay
  // visible but unpushed.
  chosenTarget: number | null;
  // The session-start preference (issue #280): on, the main switch opens
  // the Focus sheet's PLAN face — the enter confirmation's home, with the
  // ready readout, the habit select (none selected is unstructured), the
  // planned target, and the Enter flow control. Off, the switch starts flow
  // at once from the last plan and active habit. Light furniture — never
  // saved: the refit iteration adds no persisted key.
  confirmEntry: boolean;
  showAcquired: boolean;
  // The catalog's standing face — which tab shows and what the in-sheet
  // switch flips. The door itself no longer reads a memory here: mode wins
  // at open (issue #273), and the locked MUTATORS controls name the entry
  // face themselves. The door only ever names nous or arete; the scrap
  // face is a switch-reachable stop, never a landing. Light furniture —
  // never saved.
  catalogFace: "nous" | "arete" | "scrap";
  editingHabitId: string | null;
  // The Focus sheet's revealed form (ADR-0050, issue #275): which on-demand
  // action-button form stands, if any. Light furniture — cleared with the
  // transient modes.
  focusForm: FocusForm | null;
  // The notes modal's standing face (issue #277): CAPTURE leads — the
  // modal opens on it, and any departure (close, another surface) puts the
  // tab back. Light furniture — never saved.
  notesFace: NotesFace;
  // Session history (§9): the sheet's HISTORY face, its page size, and the
  // record drilled into. Light furniture — cleared with the sheet.
  historyOpen: boolean;
  historyLimit: number;
  drillSession: number | null;
  // The HABIT face's drilled habit (§9): the development detail one at a
  // time, reached from the figure-led list's rows. Light furniture — never
  // saved.
  detailHabitId: string | null;
  // The drilled habit's Develop view (issue #446): the class tree one at a
  // time, opened by the summary's Develop action. Light furniture — never
  // saved; cleared with the detail it lives inside.
  developHabitId: string | null;
  // Board navigation (§7): the zoom level and the world point the wrap
  // holds at its center — null means fitted. Light furniture — never
  // saved; fit resets zoom to 1 and the pan to null.
  zoom: number;
  pan: { x: number; y: number } | null;
  // The bulk-upgrade surfaces (issue #195): the expanded face's dial count,
  // held per module so a new selection starts at ×1, and the shift-held
  // MAX mode every face button's label flips into board-wide (Cookie
  // Clicker pattern). Light furniture — never saved.
  bulkCount: 1 | 5 | 10 | "max";
  bulkModuleId: string | null;
  faceMax: boolean;
  // The board's layer (issue #426, the Mutator Grid's tab's successor):
  // which grid the board shows — the modules (production) or the World
  // (the second face). Every mode reads it: the legend switches it through
  // flow too, the session's board read-only. Flow entry still lands the
  // board at rest on Modules. Light furniture — never saved.
  boardLayer: "modules" | "world";
  // The Hex detail (issue #295): the owned cell whose cross-section stands
  // in the grid's place, and the face emphasized inside it. Null rests the
  // grid. Light furniture — never saved; cleared with the transient modes.
  detail: HexDetail | null;
  // The World tray item armed for click-then-cell placement (issue #426,
  // mirroring ui.placing), with the kind the pill names. Light furniture —
  // never saved.
  worldArmed: string | null;
  worldArmedKind: "weapon" | "column" | null;
  // The entry sequence's pending automation (issue #274): set when the
  // entry purchase lands, spent when the entry roll's choice is taken or
  // the Forge modal closes. The choice itself mints to the roster like
  // any pick. Light furniture — never saved: a reload mid-sequence lands
  // on the standard surfaces, and nothing replays.
  entryRollPending: boolean;
  // The World tray's inspected occupant (issue #426): the inspection
  // subview one at a time. Light furniture — never saved.
  worldTray: { inspect: string | null };
  // The World occupant a pointer drag is carrying (issue #426) and the
  // cell its ghost hovers — the live drop preview over the second face.
  // Ephemeral: lives exactly as long as one drag gesture.
  worldCarrying: string | null;
  worldDropHover: { id: string; pos: Hex | null } | null;
  // The chord sheet's selected class (issue #278): the name on the stage.
  // Light furniture — never saved; a null falls back to the first
  // discovered class when the sheet renders.
  chordStage: string | null;
}

// The chime's re-fire ledger for the running overrun (§4): how many chimes
// have sounded, when the last one did, and whether a visible return or a
// pause has acknowledged and silenced the rest. Ephemeral — never saved.
interface ChimeState {
  chimes: number;
  lastChimeAt: number;
  acknowledged: boolean;
}

const freshChimeState = (): ChimeState => ({ chimes: 0, lastChimeAt: 0, acknowledged: false });

// The dual clock (focus-tool spec §1, §10): drift between the wall clock
// and the monotonic one. performance.now() does not advance while the
// machine sleeps; Date.now() does — so a positive step in this drift across
// a boundary sizes a slept gap, even while the tab stayed "visible".
function dualDriftMs(): number {
  return Date.now() - (performance.timeOrigin + performance.now());
}

export class App {
  private readonly lifetime = new AbortController();
  private readonly cleanups = new Set<() => void>();
  // The control the standing dialog opened from (issue #346): focus
  // returns there on dismissal, whatever closed it. Ephemeral — one
  // open/close round trip; a dialog opened over another dialog keeps the
  // first round trip's address.
  private modalInvoker: HTMLElement | null = null;
  // Weak references let replaced render descendants be collected while
  // still allowing release to remove handlers from any surviving node.
  private readonly listeners = new Set<{
    target: WeakRef<EventTarget>;
    handler: WeakRef<EventListener>;
    type: string;
    capture: boolean;
  }>();
  get released(): boolean { return this.lifetime.signal.aborted; }
  get signal(): AbortSignal { return this.lifetime.signal; }

  // Temporary resources unregister on completion, so renders and gestures
  // cannot grow the lifetime ledger indefinitely.
  ownCleanup(cleanup: () => void): () => void {
    if (this.released) { cleanup(); return () => {}; }
    this.cleanups.add(cleanup);
    return () => { this.cleanups.delete(cleanup); };
  }

  listen<K extends keyof GlobalEventHandlersEventMap>(
    target: EventTarget | null | undefined,
    type: K,
    handler: (event: GlobalEventHandlersEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!target || this.released) return;
    const guarded: EventListener = (event) => {
      if (!this.released) handler(event as GlobalEventHandlersEventMap[K]);
    };
    target.addEventListener(type, guarded, options);
    this.listeners.add({ target: new WeakRef(target), handler: new WeakRef(guarded), type,
      capture: typeof options === "boolean" ? options : !!options?.capture });
  }

  private sweepListeners(): void {
    for (const listener of this.listeners) {
      const target = listener.target.deref();
      const handler = listener.handler.deref();
      if (!target || !handler || (target instanceof Node && !target.isConnected)) {
        if (target && handler) target.removeEventListener(listener.type, handler, listener.capture);
        this.listeners.delete(listener);
      }
    }
  }

  suppressClick(): void {
    if (this.released) return;
    let forget = () => {};
    const cancel = suppressNextClick(() => forget());
    forget = this.ownCleanup(cancel);
  }

  // Release is terminal, idempotent, and deliberately never saves.
  dispose(): void {
    if (this.released) return;
    this.lifetime.abort();
    window.clearTimeout(this.modeToastTimer);
    for (const listener of this.listeners) {
      listener.target.deref()?.removeEventListener(listener.type, listener.handler.deref() ?? null, listener.capture);
    }
    this.listeners.clear();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear();
    this.dragging = null;
    this.cancelWorldDrag = null;
    this.ui.dropHover = null;
    this.ui.worldCarrying = null;
    this.ui.worldDropHover = null;
    this.devBoardCancelStress();
    const audio = this.ownedAudio;
    this.audio = null;
    this.ownedAudio = null;
    if (audio) void audio.close().catch(() => {});
  }

  private currentState: GameState = createInitialState();
  get state(): GameState { return this.currentState; }
  set state(state: GameState) {
    // The allocation economy is the game's production path since the
    // harmonic-capacity release (#262): every state — new, loaded, or
    // reset — rides the whole-chord selector with no opt-in anywhere.
    // The `dev` flag gates only the development surfaces (the dev panel
    // and the stress board), never the economy.
    this.currentState = state;
  }
  ui: UiState = {
    app: null,
    placing: null,
    dropHover: null,
    chordHover: null,
    buyingCell: false,
    combineOffer: null,
    modal: null,
    forgeFace: "modules",
    importText: "",
    importError: null,
    chosenTarget: null,
    confirmEntry: true,
    showAcquired: false,
    catalogFace: "nous",
    editingHabitId: null,
    focusForm: null,
    notesFace: "capture",
    historyOpen: false,
    historyLimit: HISTORY_PAGE_ROWS,
    drillSession: null,
    detailHabitId: null,
    developHabitId: null,
    zoom: 1,
    pan: null,
    bulkCount: 1,
    bulkModuleId: null,
    faceMax: false,
    boardLayer: "modules",
    inventory: createInventoryState(),
    detail: null,
    worldArmed: null,
    worldArmedKind: null,
    entryRollPending: false,
    worldTray: { inspect: null },
    worldCarrying: null,
    worldDropHover: null,
    chordStage: null,
  };
  cancelWorldDrag: (() => void) | null = null;
  lastWall: number | null = null;
  // The dual-clock drift baseline at lastWall (§10): a positive step past
  // the noise floor sizes slept gaps; a negative one past it credits the
  // boundary zero — sub-floor steps are jitter, not drift.
  lastDrift = 0;
  // The presence state that held since the last boundary (§1): presence is
  // visibility — focus loss alone is not away.
  presence = true;
  // Set when exit was requested while the honesty report still waits: the
  // answer is mandatory and final before the session ends (§2).
  exitPending = false;
  // Set at load when document.wasDiscarded marks a Memory-Saver discard
  // (§10): the reconcile path treats it exactly like any other away gap,
  // and greet() passes the observation on.
  private resumedFromDiscard = false;
  lastSaveWall = 0;
  private sharedSave: SharedSave;
  dev: boolean;
  // The session's AudioContext (§4): created or resumed inside the start
  // gesture, kept for the target chime. Null where Web Audio is
  // unavailable — the title and notification then carry the signal alone.
  audio: AudioContext | null = null;
  // The chime's ephemeral re-fire state (§4). Never saved — a reload
  // mid-overrun stays silent, the persisted targetSignaled flag sees to
  // that.
  signals: ChimeState = freshChimeState();
  private channels: SignalChannels;
  private ownedAudio: AudioContext | null = null;
  // The Forge's threshold-crossing flash: a roll was minted, so its face
  // flashes until this wall-clock moment.
  rollFlashUntil = 0;
  // Set when the stored save was rejected (e.g. the ADR-0017 v5 clean cut):
  // the message must survive the constructor's greeting.
  private loadNotice: string | null = null;
  // The module a pointer drag is carrying, if any — pointerleave must not
  // clear a drag's hover preview just because the ghost crosses a cell
  // boundary. Ephemeral: lives exactly as long as one drag gesture.
  dragging: string | null = null;
  // The board's world bounds, recomputed every render from the owned and
  // frontier cells (§7): the lens the zoom and pan clamp against.
  boardBounds = { x: -100, y: -100, width: 200, height: 200 };
  private els: Record<string, HTMLElement>;
  private modeToastTimer: number | undefined;

  constructor(els: Record<string, HTMLElement>, dev: boolean, channels: SignalChannels = browserChannels, save = new SharedSave(browserSaveStorage)) {
    this.sharedSave = save;
    this.els = els;
    this.dev = dev;
    this.channels = channels;
    const loaded = this.load();
    const resumingBreather = loaded?.state.mode === "breather";
    if (loaded) {
      this.resumeFromSave(loaded);
    } else {
      this.state = createInitialState();
    }
    rollGoalOccurrences(this.state, Date.now());
    this.ensureBoardOverlays();
    this.bindGlobalEvents();
    document.getElementById("console-settings")?.addEventListener("click", () => this.openModal("settings"), { signal: this.signal });
    // The display panel's goal meter is a permanent header resident (the
    // header-status brief): its tooltip layer wires at mount on the stable
    // session host, sheet open or not. bindFocusSheet's later attach on the
    // same host and signal is idempotent.
    wireTooltips(document.getElementById("console-session") ?? document.body, this.signal);
    if (!resumingBreather || this.state.mode === "breather") this.greet();
    this.render();
    this.save();
  }

  private load(): LoadedSave | null {
    const parsed = this.sharedSave.load();
    if (parsed && "error" in parsed) {
      this.loadNotice = `Could not load the local save: ${parsed.error}`;
      return null;
    }
    return parsed;
  }

  // The board-surface overlays (§5): the Hex detail panel and the Upgrade
  // All cluster live over the board's own space, so their hosts are created
  // once here — no render ever has to bootstrap one. The tray column's
  // hosts are index.html's own (the always-open column never bootstraps).
  private ensureBoardOverlays(): void {
    const space = document.querySelector(".board-space");
    if (!space) return;
    if (!document.getElementById("hex-detail")) {
      const detail = document.createElement("div");
      detail.id = "hex-detail";
      detail.className = "hex-detail";
      detail.hidden = true;
      space.append(detail);
    }
    if (!document.getElementById("upgrade-all")) {
      const cluster = document.createElement("div");
      cluster.id = "upgrade-all";
      cluster.className = "upgrade-all";
      cluster.hidden = true;
      space.append(cluster);
    }
  }

  // Resumes an in-flow session from a save. One reconcile path (§1): the
  // gap since the last hidden-transition save classifies as away through
  // the trust rules — sleep, tab discard, mid-session reload, and
  // save-import all flow through it; the confirm-or-discard dialog is gone
  // (ADR-0019).
  private resumeFromSave(loaded: LoadedSave): void {
    this.state = loaded.state;
    // The eager achievement sync (ADR-0015 amended): a pre-existing save's
    // already-satisfied milestones grant silently on load — `unlockedAt`
    // stamps here, with no toast and nothing joining a live session's
    // "unlocked this session" row. The session-one guard stands.
    syncAchievements(this.state, { silent: true });
    this.sharedSave.incorporate(loaded.savedAt);
    this.lastWall = null;
    this.presence = document.visibilityState === "visible";
    this.exitPending = false;
    // An unseen loud summary (§5.7) survives a reload: the modal re-opens
    // until the player dismisses it.
    if (this.state.mode === "upgrade" && this.state.summary && !this.state.summary.seen) {
      this.ui.modal = "summary";
    }
    if (this.state.mode === "breather" && this.state.breather) {
      // The breather reconciles on the wall clock (docs/breather-spec.md
      // §4): the gap since the last save was breather time up to the
      // deadline; past it the phase completed itself and the return finds
      // upgrade mode with the completion read.
      const gapSeconds = Math.max(0, (Date.now() - loaded.savedAt) / 1000);
      const { result, completed } = applyBreatherGap(this.state, gapSeconds);
      this.reportAdvance(result);
      this.syncBoundaryClock(Date.now());
      if (completed) {
        this.completeBreather();
        this.save();
      }
      return;
    }
    if (this.state.mode !== "flow") return;
    // A discarded tab (Memory Saver, §10) lands here exactly like a plain
    // reload: the gap since the last hidden-transition save is away, and
    // document.wasDiscarded only records that it happened.
    this.resumedFromDiscard = (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
    const gapSeconds = Math.max(0, (Date.now() - loaded.savedAt) / 1000);
    applyGap(this.state, gapSeconds, "away", 0);
    this.reportAdvance(flushPendingAway(this.state));
    this.syncBoundaryClock(Date.now());
    // The report fires at this return when the pool is outstanding, and
    // re-presents, recalculated, at each next return until settled (§1).
    if (poolOutstanding(this.state)) this.ui.modal = "honesty";
  }

  // Whether this instance's board is still the document's board: document-
  // level listeners outlive the DOM they were bound in (a re-boot replaces
  // the body), and a stale instance must never act on — or re-render — a
  // newer instance's board.
  private ownsBoard(): boolean {
    return !this.released && this.els["grid"]?.isConnected === true;
  }

  // The boundary clock's baseline: wall moment and dual-clock drift move
  // together, never one without the other.
  private syncBoundaryClock(now: number): void {
    this.lastWall = now;
    this.lastDrift = dualDriftMs();
  }

  // One boundary (§1): the wall-clock gap since the last boundary is
  // classified by the presence that held during it and the whole simulation
  // advances by it — never by tick count, which throttling falsifies. The
  // breather runs its own boundary (docs/breather-spec.md §4): pre-trusted,
  // presence classifies nothing, and the deadline completes the phase.
  private applyBoundary(now: number): void {
    if (this.state.mode === "breather") {
      if (this.lastWall === null) {
        this.syncBoundaryClock(now);
        return;
      }
      const gapSeconds = (now - this.lastWall) / 1000;
      this.syncBoundaryClock(now);
      if (gapSeconds <= 0) return;
      const { result, completed } = applyBreatherGap(this.state, gapSeconds);
      this.reportAdvance(result);
      if (completed) {
        this.completeBreather();
        // The completion facts (count, seconds, record line) persist now —
        // an idempotent re-reconcile after a reload can never re-bank them.
        this.save(now);
        this.render();
      } else if (now - this.lastSaveWall > 5000) this.save(now);
      return;
    }
    if (this.state.mode !== "flow") {
      this.lastWall = null;
      return;
    }
    if (this.lastWall === null) {
      this.syncBoundaryClock(now);
      return;
    }
    const gapSeconds = (now - this.lastWall) / 1000;
    const driftStepSeconds = (dualDriftMs() - this.lastDrift) / 1000;
    this.syncBoundaryClock(now);
    if (gapSeconds <= 0 && driftStepSeconds <= 0) return;
    rollGoalOccurrences(this.state, now);
    const result = applyGap(this.state, gapSeconds, this.presence ? "visible" : "away", driftStepSeconds);
    this.reportAdvance(result);
    if (now - this.lastSaveWall > 5000) this.save(now);
  }

  // A return (§1): the buffered absence — the hidden stretch, reconciled
  // whole — classifies once, then live presence resumes banking behind it.
  private processReturn(now: number): void {
    this.applyBoundary(now);
    if (document.visibilityState === "visible") {
      this.reportAdvance(flushPendingAway(this.state));
    }
    this.tick();
  }

  // Converges onto a newer stored save through the one resume/reconcile
  // path (§1): the adopted save is treated exactly like a reload — a live
  // session resumes with its absence reconciled as away. False when the
  // slot holds nothing newer than this tab has incorporated: an unreadable
  // slot never blocks, and another tab's forced older-stamped write (an
  // import, a reset) must never revert this tab's fresher memory (#128).
  private adoptNewerSave(): boolean {
    if (!this.sharedSave.isNewer()) return false;
    const loaded = this.load();
    if (!loaded) return false;
    this.clearTransientUi();
    this.resumeFromSave(loaded);
    this.say("Caught up to the newer save from another tab.");
    this.render();
    return true;
  }

  // Session timing owns the throttle: a refused write is not an attempt,
  // while a failed storage write still advances the attempt's wall clock.
  save(now: number = Date.now(), force = false): void {
    if (this.released) return;
    if (this.sharedSave.write(this.state, now, force) !== "refused") this.lastSaveWall = now;
  }

  exportText(): string {
    return serialize(this.state);
  }

  // The transient interaction modes are mutually exclusive: every exit path
  // (import, reset, session start, arming another mode) clears them together.
  private clearTransientUi(): void {
    const inv = this.ui.inventory;
    inv.inspect = null; inv.merge = null; inv.menu = false;
    inv.scrapMode = false; inv.scrapReview = false; inv.selected = []; inv.dragOpen = false;
    this.ui.app = null;
    this.ui.focusForm = null;
    this.ui.placing = null;
    this.ui.dropHover = null;
    this.ui.chordHover = null;
    this.ui.buyingCell = false;
    this.ui.combineOffer = null;
    // The bulk surfaces are upgrade-mode furniture (issue #195): entering
    // flow drops them with the rest, the shift mode included — a shift
    // held through the start gesture never leaks into the locked board.
    this.ui.bulkCount = 1;
    this.ui.bulkModuleId = null;
    this.ui.faceMax = false;
    // The Hex detail is transient furniture too (issue #295): the board
    // under it re-enters at rest — grid showing, layer reset, the detail's
    // inventory closed with it (issue #296).
    this.ui.detail = null;
    // The armed World gestures unwind with the rest (issue #426), and the
    // board re-enters flow at rest on Modules — the legend stands by to
    // switch again, but a session never inherits upgrade's arrangement.
    // The entry sequence's automation is armed furniture by the same rule
    // (issue #274): a session break, an import, or an adopted save lands
    // on the standard surfaces — the banked roll waits in the Forge modal —
    // and nothing replays.
    this.ui.boardLayer = "modules";
    this.ui.entryRollPending = false;
    this.worldDisarm();
  }

  importText(text: string): boolean {
    if (this.released) return false;
    const parsed = this.sharedSave.parse(text);
    if ("error" in parsed) {
      this.ui.importError = parsed.error;
      this.render();
      return false;
    }
    this.clearTransientUi();
    this.ui.modal = null;
    this.ui.importError = null;
    this.resumeFromSave(parsed);
    this.say(
      poolOutstanding(this.state)
        ? "Save imported while a session was running — the honesty report is waiting."
        : "Save imported.",
    );
    this.save(Date.now(), true);
    this.render();
    // The import's dismissal returns focus to the walk's opener — unless
    // the imported save arrived with a report or summary standing; those
    // own the screen the moment they present (§1, §5.7).
    if (this.ui.modal === null) this.restoreModalInvoker();
    return true;
  }

  hardReset(): void {
    this.state = createInitialState();
    this.clearTransientUi();
    this.ui.modal = null;
    this.ui.importError = null;
    this.ui.chosenTarget = null;
    this.lastWall = null;
    this.exitPending = false;
    this.say("A fresh instrument. One synth is yours.");
    this.save(Date.now(), true);
    this.render();
    this.restoreModalInvoker();
  }

  // The prestige door (ADR-0039): the completed era bar's press opens the
  // confirm; only upgrade mode's press opens anything at all — the locked
  // readout the bar shows during a session is not a button, so this guard
  // is belt-and-braces for keyboard foci that outlived a mode flip.
  openPrestigeConfirm(): void {
    if (this.state.mode !== "upgrade") {
      this.say("Prestige happens between sessions.");
      return;
    }
    if (this.state.eraEarned < ARETE_HORIZON) return;
    this.clearTransientUi();
    this.captureModalInvoker();
    this.ui.modal = "prestige";
    this.render();
  }

  // The confirm's answer: banks the live claim and begins the next era —
  // levels to base, nous to a fresh grant, charge and the era bar reset;
  // the board, tray, rolls, achievements, life record, and Arete persist.
  // The first World-eligible claim's starter weapon (issue #426, priority
  // 5) presents at the moment it lands, once — the grant modal opens on
  // the same landing that minted it, and the granted flag keeps every
  // later claim silent.
  confirmPrestige(): void {
    const claim = bankableClaimOf(this.state);
    const grantsStarter = !this.state.world.starterWeaponGranted && frontierEntitlement(this.state.eraEarned) >= columnCost(0);
    const result = prestige(this.state);
    if (!result.ok) {
      this.say(result.reason ?? "The door is not open.");
      this.render();
      return;
    }
    this.ui.modal = grantsStarter ? "grant" : null;
    this.announceUnlocks(result.unlocked, `Banked ${claim} Arete — the next era begins.`);
    this.save();
    this.render();
    if (!grantsStarter) this.restoreModalInvoker();
  }

  say(text: string): void {
    if (this.released) return;
    const el = this.els["status"];
    if (el) el.textContent = text;
  }

  greet(): void {
    if (this.loadNotice) {
      this.say(`${this.loadNotice} A fresh instrument was created.`);
      this.loadNotice = null;
      return;
    }
    if (this.resumedFromDiscard && this.state.mode === "flow") {
      this.say("The tab was discarded while away — the gap counted as away time.");
      this.resumedFromDiscard = false;
      return;
    }
    if (this.state.sessionsCompleted === 0 && this.state.mode === "upgrade") {
      this.say("Welcome. Upgrade the synth, then enter flow.");
    } else if (this.state.mode === "flow") {
      this.say("Flow is live.");
    } else {
      this.say("Ready. Drag, upgrade, enter flow.");
    }
  }

  private bindGlobalEvents(): void {
    document.addEventListener("visibilitychange", () => {
      if (!this.ownsBoard()) return;
      if (document.visibilityState === "hidden") {
        // The gap that just ended was present: classify it, then persist —
        // the transition to hidden is the last reliably observable save
        // point (§10), carrying the session, the bucket, and the absence
        // buffer.
        this.applyBoundary(Date.now());
        this.presence = false;
        this.save();
      } else {
        this.presence = true;
        // The return catch-up (#128): a save another tab wrote while we
        // were hidden is adopted before this tab's own reconcile runs, so
        // the stale in-memory copy never clobbers what the slot gained.
        this.adoptNewerSave();
        this.processReturn(Date.now());
      }
    }, { signal: this.signal });
    // A bfcache restore is a return: the frozen stretch classifies as away,
    // and a save another tab wrote while this page sat frozen is adopted
    // through the same reconcile path (#128).
    window.addEventListener("pageshow", (event) => {
      if (!this.ownsBoard() || !(event as PageTransitionEvent).persisted) return;
      this.presence = document.visibilityState === "visible";
      this.adoptNewerSave();
      this.processReturn(Date.now());
    }, { signal: this.signal });
    // Another tab's save, announced here in every tab but the writer
    // (#128): outside a live session the tab adopts a save newer than
    // anything it has incorporated — a cheap, invisible catch-up; another
    // tab's forced older-stamped import or reset is left standing. Mid-flow
    // the write guard refuses stale writes and the next visible return
    // adopts through the reconcile path.
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !this.ownsBoard()) return;
      if (this.state.mode !== "flow") this.adoptNewerSave();
    }, { signal: this.signal });
    // Focus loss alone is not away, but focus is a boundary: a stalled or
    // throttled clock catches up here with presence unchanged.
    window.addEventListener("focus", () => {
      if (this.ownsBoard()) this.processReturn(Date.now());
    }, { signal: this.signal });
    window.addEventListener("beforeunload", () => {
      if (this.ownsBoard()) this.save();
    }, { signal: this.signal });
    // The tick timer can outlive its document (a discarded environment, a
    // torn-down test): a dead document is simply not ours to tick.
    const timer = window.setInterval(() => {
      if (typeof document === "undefined" || !this.ownsBoard()) return;
      this.tick();
    }, 100);
    this.ownCleanup(() => window.clearInterval(timer));
    // A popover is light furniture: clicking anywhere outside the console's
    // app section dismisses it. The board never dims beneath it (ADR-0012).
    // The dismissal intent is captured on the section itself — the one node
    // no re-render replaces — because a click that re-renders its own
    // target (a chip pick, a tile toggle) detaches that target before this
    // document-level listener reads anything. The clock's Time popover
    // (issue #148) anchors in the session cluster, so clicks inside its
    // clock anchor count as inside too — as does the main switch, whose
    // confirmation path (#280) opens the sheet: the opening click must
    // never close it in the same gesture.
    let clickInsideApps = false;
    this.els["console-apps"]?.addEventListener("click", () => {
      clickInsideApps = true;
    }, { capture: true, signal: this.signal });
    this.els["console-session"]?.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      // The session habit's door (#331) joins the set: its click opens the
      // Focus sheet on the HABIT face — and the opening click, like the
      // switch's, must never close it in the same gesture.
      if (target?.closest(".session-group")) clickInsideApps = true;
    }, { capture: true, signal: this.signal });
    document.addEventListener("click", () => {
      // A stale instance's closer must never close — or re-render — a newer
      // instance's board (§1's ownership rule, as the bloom closer below
      // already reads it).
      if (!this.ownsBoard()) return;
      const inside = clickInsideApps;
      clickInsideApps = false;
      if (inside) return;
      if (this.ui.app !== null) this.closeApp();
    }, { signal: this.signal });
    // The Forge peek passes pointers to the board, so its dismissal is
    // captured outside the card before a board action can replace the
    // clicked DOM node. The Notes modal (issue #332) joins the outside-
    // click dismissal as a plain blocking dialog: any click off the dialog
    // — the backdrop — puts it away, except the door's own press, whose
    // toggle must not be closed-and-reopened in one gesture.
    document.addEventListener("click", (event) => {
      if (!this.ownsBoard()) return;
      if (this.ui.modal !== "forge" && this.ui.modal !== "notes") return;
      if (event.composedPath().includes(this.els["modal-content"]!)) return;
      if (this.ui.modal === "notes" && (event.target as Element | null)?.closest?.("#app-tile-notes")) return;
      this.closeModal();
    }, { capture: true, signal: this.signal });
    // Every blocking dialog's focus ring (issue #346, generalizing #332's
    // Notes ring): Tab and Shift+Tab cycle within the dialog, so keyboard
    // focus stays managed inside whatever claims the screen — however the
    // tab order reaches its edges. One binding — the dialog container is
    // the layer's permanent node. The scrimless surfaces stand outside
    // the ring: the Forge peek and the tray sheet declare the background
    // interactive (aria-modal="false") and their Tab walks the board the
    // way the pointer does.
    const modalContent = this.els["modal-content"];
    const modalLayer = this.els["modal"];
    this.listen(modalContent, "keydown", (event) => {
      if (event.key !== "Tab" || !this.ui.modal || !modalContent || !modalLayer) return;
      if (modalLayer.getAttribute("aria-modal") !== "true") return;
      const focusables = [...modalContent.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )].filter((el) => !el.closest("[hidden]"));
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && modalContent.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    });
    // The Esc chain (§5, issue #295): the modal eats it first; then the
    // armed transient modes unwind — an armed placement cancels before the
    // Hex detail closes; then the detail itself returns the grid with its
    // layer, position, and zoom intact; then the Mutators layer; then the
    // console furniture. Outside a dialog, typing keeps its own Escape.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.ownsBoard()) return;
      const inv = this.ui.inventory;
      const inventoryActive = this.state.mode === "upgrade" && (this.ui.modal === "inventory" || (!this.ui.modal && (!inv.collapsed || inv.dragOpen)));
      if (inventoryActive && (inv.inspect || inv.merge || inv.scrapReview || inv.scrapMode || inv.menu)) {
        event.preventDefault();
        if (inv.scrapReview) inv.scrapReview = false;
        else if (inv.inspect || inv.merge) { inv.inspect = null; inv.merge = null; }
        else if (inv.menu) inv.menu = false;
        else { inv.scrapMode = false; inv.selected = []; }
        this.render(); return;
      }
      if (this.ui.modal) {
        event.preventDefault();
        this.closeModal();
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      if (this.ui.placing) {
        this.cancelPlacing();
        return;
      }
      if (this.ui.buyingCell) {
        this.cancelCellPurchase();
        return;
      }
      // The World layer's Esc walk (issue #426): gesture first.
      if (this.cancelWorldDrag || this.ui.worldArmed !== null) {
        this.worldCancelGestures();
        return;
      }
      if (this.ui.detail) {
        this.closeDetail();
        return;
      }
      if (this.ui.boardLayer === "world") {
        this.setBoardLayer("modules");
        return;
      }
      if (this.ui.app) {
        this.closeApp();
      }
    }, { signal: this.signal });
    // The face buttons' shift mode (issue #195): holding shift flips every
    // face button's label and tooltip to MAX board-wide — the Cookie
    // Clicker pattern, visible before the click. The click's own shift
    // state remains the source of truth for what buys; this flip only
    // shows the mode. Never while typing.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Shift" || event.repeat || !this.ownsBoard()) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      if (this.state.mode === "upgrade" && !this.ui.faceMax) {
        this.ui.faceMax = true;
        this.render();
      }
    }, { signal: this.signal });
    document.addEventListener("keyup", (event) => {
      if (event.key !== "Shift" || !this.ownsBoard()) return;
      if (this.ui.faceMax) {
        this.ui.faceMax = false;
        this.render();
      }
    }, { signal: this.signal });
    // A shift released while the window lacks focus never fires keyup here:
    // the blur drops the mode so the labels can't stick MAX (issue #195).
    window.addEventListener("blur", () => {
      if (this.ownsBoard() && this.ui.faceMax) {
        this.ui.faceMax = false;
        this.render();
      }
    }, { signal: this.signal });
  }

  tick(): void {
    if (this.released) return;
    // Recurring goals roll on every tick, not only across flow boundaries:
    // a tab resting in upgrade mode must read the new day's state too —
    // the Focus sheet's GOALS face with it. Idempotent with the
    // boundary roll below.
    rollGoalOccurrences(this.state, Date.now());
    this.applyBoundary(Date.now());
    if (this.state.mode === "breather") {
      // The breather's live cadence (docs/breather-spec.md §5): the
      // boundary above advanced it — the tick keeps the countdown, the
      // strip, and the title exact while visible.
      this.render();
      return;
    }
    if (this.state.mode !== "flow") {
      this.lastWall = null;
      return;
    }
    // A return with the pool outstanding presents the mandatory honesty
    // report; presence keeps banking behind it until it settles (§1).
    if (poolOutstanding(this.state) && this.ui.modal !== "honesty") {
      this.ui.modal = "honesty";
    }
    this.fireTargetSignals();
    this.render();
  }

  // The target-hit signals (§4): one event — the first boundary or timer
  // wake-up whose wall clock sees elapsed ≥ target — enters overrun and
  // fires chime, silent notification, and the title flip together. While
  // the tab stays hidden the chime re-fires at most once per wall-clock
  // minute, capped at three total; a visible return or a pause silences
  // it. Open-ended and paused sessions fire nothing, ever.
  private fireTargetSignals(): void {
    const session = this.state.session;
    if (this.state.mode !== "flow" || !session || session.target === null) return;
    if (session.elapsed < session.target) return;
    const now = Date.now();
    if (!session.targetSignaled) {
      session.targetSignaled = true;
      this.signals = { chimes: 1, lastChimeAt: now, acknowledged: document.visibilityState === "visible" };
      this.playChime();
      this.channels.showTargetNotification(() => window.focus());
      return;
    }
    // Re-fires ride the wall clock, never the throttled wake-up cadence,
    // and only while the tab stays hidden — a visible return acknowledges
    // the overrun for good.
    if (document.visibilityState === "visible") {
      this.signals.acknowledged = true;
      return;
    }
    if (this.signals.acknowledged) return;
    if (this.signals.chimes === 0 || this.signals.chimes >= CHIME.maxChimes) return;
    if (now - this.signals.lastChimeAt < CHIME.refireSeconds * 1000) return;
    this.signals.chimes++;
    this.signals.lastChimeAt = now;
    this.playChime();
  }

  // The global mute (§5) gates every app sound, including the chime's
  // hidden re-fires. No volume slider, no per-sound mix.
  private unlockAudio(): void {
    if (this.released) return;
    const existing = this.audio;
    this.audio = this.channels.unlockAudio(existing);
    if (!existing && this.channels === browserChannels) this.ownedAudio = this.audio;
  }

  private playChime(): void {
    if (this.state.muted) return;
    this.channels.playChime(this.audio);
  }

  // Cue eligibility reads authoritative instance keys, including voice
  // membership. Recognition totals cannot distinguish a replaced voice.
  private activeInstancesOf(snapshot: ReturnType<typeof displayedRates>): readonly AllocatedInstance[] {
    return snapshot.allocation?.active ?? [];
  }

  // The formation cue (§6, issue #390): an action whose authoritative
  // allocation newly activates a chord sings one of them — at most one
  // chord, preferring one that contains the placed or changed voice.
  // Idle candidates never sound, and an idle-only change is silent: the
  // discovery moment stays on the recognized basis (the action
  // boundary's sync), while the cue is feedback about earning. The seams
  // already said it; this is garnish, not information. The read rides
  // the state's stored hint, writing nothing — the action boundary
  // already synced it.
  private strumFormedChords(before: readonly AllocatedInstance[], changedVoiceId?: string): void {
    if (this.state.muted) return;
    // Same snapshot basis as the caller's `before`, so the diff can't lie
    // if the two calls ever drift apart.
    const after = displayedRates(this.state, flowLive(this.state));
    const cue = preferredChordCue(newlyActiveTermsOf(before, this.activeInstancesOf(after)), changedVoiceId);
    if (!cue) return;
    this.unlockAudio();
    this.channels.playStrum(this.audio, cue);
  }

  private reportAdvance(result: AdvanceResult): void {
    const notes: string[] = [];
    if (result.rollsBanked > 0) {
      notes.push(`${result.rollsBanked} module ${result.rollsBanked === 1 ? "roll" : "rolls"} banked.`);
      this.rollFlashUntil = Date.now() + 900;
    }
    if (result.goalsCompleted > 0) notes.push(`${result.goalsCompleted} goal${result.goalsCompleted === 1 ? "" : "s"} completed.`);
    if (notes.length > 0) this.say(notes.join(" "));
  }

  private act(result: ActionResult, success: string): boolean {
    if (!result.ok) {
      this.say(result.reason ?? "That action is not available.");
    } else {
      this.announceUnlocks(result.unlocked, success);
    }
    if (result.ok) this.save();
    this.render();
    return result.ok;
  }

  // The upgrade-mode toast (ADR-0015): newly unlocked feats add onto the
  // action's own message, and point at the trophy list's home. In-session
  // unlocks never reach here — they queue into the session's summary row
  // instead, so the filter below is a belt-and-braces.
  announceUnlocks(ids: string[] | undefined, otherwise: string): void {
    const names = (ids ?? [])
      .filter((id) => !this.state.session?.unlocked.includes(id))
      .map(achievementName);
    this.say(
      names.length > 0
        ? `${otherwise}${otherwise ? " " : ""}Feat unlocked — ${names.join(", ")}.`
        : otherwise,
    );
  }

  // The Enter switch (issue #280, re-clicked by #311): the session-start
  // preference picks the path. Confirmation off commits the PLAN read at
  // once — the fallback chain is the read's own, so no plan ever set is
  // open-ended and no habit selected is unstructured. Confirmation on opens
  // the Focus sheet's PLAN face, the enter confirmation's home — and while
  // that face stands, the next press commits it, the same gesture its Enter
  // flow control makes, never a toggle that only re-opens the sheet. Zero
  // habits never blocks either path. The session group's own read (issue
  // #331) overrules the preference: with the habit chosen and a plan armed
  // — both locks set, the group reads exactly what would run — one
  // activation starts it; every other shape keeps the preference's path.
  startFlow(): void {
    if (this.released) return;
    if (this.state.mode !== "upgrade") return;
    const planStanding = this.ui.app === "time" && !this.ui.historyOpen;
    const sessionLocked = this.state.activeHabitId !== null && this.ui.chosenTarget !== null;
    if (!this.ui.confirmEntry || planStanding || sessionLocked) {
      this.beginFlowFromPlan();
      return;
    }
    this.clearTransientUi();
    this.openApp("time");
  }

  // The PLAN face's read, committed (#280): the selected habit rides in —
  // none selected is unstructured — and the last plan arms the session.
  // One resolution for both entry paths, so they can never drift.
  beginFlowFromPlan(): void {
    this.beginFlow(activeHabit(this.state)?.id ?? null);
  }

  beginFlow(habitId: string | null): void {
    if (this.released) return;
    selectHabit(this.state, habitId);
    // Time is free from the very first session (ADR-0019), so session one
    // can be planned; the enter prompt's duration affordances stay visible
    // but unpushed — the resting plan is open-ended, and only this choice
    // ever arms the chime, the permission ask, and the title flip (§4).
    const started = startSession(this.state, this.ui.chosenTarget, Date.now());
    if (!started.ok) {
      this.ui.modal = null;
      this.say(started.reason ?? "Cannot enter flow right now.");
      this.render();
      this.restoreModalInvoker();
      return;
    }
    this.ui.modal = null;
    this.exitPending = false;
    this.syncBoundaryClock(Date.now());
    this.clearTransientUi();
    // The start gesture is the audio unlock (§4, §10): the session's
    // context is created or resumed here, so the chime can sound later.
    this.unlockAudio();
    this.signals = freshChimeState();
    this.askNotificationPermissionOnce(this.ui.chosenTarget);
    this.say(
      this.ui.chosenTarget === null
        ? "Flow is live."
        : `Flow is live for ${Math.round(this.ui.chosenTarget / 60)} minutes — the board is locked.`,
    );
    this.save();
    this.render();
    this.restoreModalInvoker();
  }

  // The one notification permission ask ever (§4): it rides the first
  // planned-session start, from this gesture on a visible page. The ask-slot
  // is spent by that start whatever the browser's current permission state —
  // a pre-decided state needs no prompt — and open-ended starts never ask.
  // Denial or dismissal degrades silently and nothing re-prompts later.
  private askNotificationPermissionOnce(target: number | null): void {
    if (target === null || this.state.notificationAsked) return;
    if (document.visibilityState !== "visible") return;
    this.state.notificationAsked = true;
    if (this.channels.notificationPermission() === "default") {
      this.channels.requestNotificationPermission();
    }
  }

  endFlow(): void {
    // The exit runs report-first (§8): with the pool outstanding, the
    // honesty report's answer is mandatory and final — the bucket must
    // bank or drop before the summary shows.
    if (this.state.mode !== "upgrade" && poolOutstanding(this.state)) {
      this.captureModalInvoker();
      this.exitPending = true;
      this.ui.modal = "honesty";
      this.render();
      return;
    }
    const result = endSession(this.state, Date.now());
    if (!result.ok) {
      this.say(result.reason ?? "No session is running.");
      this.render();
      return;
    }
    this.lastWall = null;
    this.say("Session banked.");
    // Preserve the exit switch through an honesty → summary sequence.
    this.captureModalInvoker();
    // The loud summary (§5.7) opens however the session ended.
    this.ui.modal = "summary";
    this.save();
    this.render();
  }

  pause(): void {
    if (this.act(pauseSession(this.state), "Paused.")) {
      this.lastWall = null;
      // Pausing silences the overrun chime immediately (§4); it never
      // un-silences, since a visible resume acknowledges anyway.
      this.signals.acknowledged = true;
    }
  }

  resume(): void {
    if (this.act(resumeSession(this.state), "Flow resumed.")) {
      this.syncBoundaryClock(Date.now());
    }
  }

  // The breather's start (docs/breather-spec.md §1–2): the summary's offer
  // committed. The gesture unlocks audio — the deadline's chime needs the
  // context (§10) — and the boundary clock starts here.
  takeBreather(): void {
    if (this.released) return;
    const result = startBreatherAction(this.state, Date.now());
    if (!result.ok) {
      this.say(result.reason ?? "Cannot take a breather right now.");
      this.render();
      return;
    }
    this.ui.modal = null;
    this.exitPending = false;
    this.syncBoundaryClock(Date.now());
    this.unlockAudio();
    const minutes = Math.round((this.state.breather?.allowanceSeconds ?? 0) / 60);
    this.say(`Breather is live for ${minutes} minutes — the board runs while you rest.`);
    this.save();
    this.render();
    this.restoreModalInvoker();
  }

  // The breather's one end (docs/breather-spec.md §4): the early exit's
  // gesture and the deadline's auto-complete land together — no penalty,
  // nothing prorated.
  endBreather(): void {
    if (this.released) return;
    this.applyBoundary(Date.now());
    if (this.state.mode === "breather") this.finishBreather();
  }

  private finishBreather(): void {
    const breather = this.state.breather;
    const completed = !!breather && breather.elapsed >= breather.allowanceSeconds - 1e-9;
    const result = endBreatherAction(this.state);
    if (!result.ok) {
      this.say(result.reason ?? "No breather is running.");
      this.render();
      return;
    }
    this.lastWall = null;
    this.signals.acknowledged = true;
    this.say(completed ? "Breather complete — welcome back." : "Breather ended early — the board rests.");
    this.save();
    this.render();
  }

  // The deadline's auto-complete (docs/breather-spec.md §4): chime and
  // notification fire the one completion signal — the target-hit channels'
  // analog — then the phase ends. A return from away lands here too: the
  // reconcile that discovers completion fires it.
  private completeBreather(): void {
    this.playChime();
    this.channels.showTargetNotification(() => window.focus(), "Breather complete — welcome back.");
    this.finishBreather();
  }

  buyShelf(type: ShelfType): void {
    // The purchase stays in the catalog: the module lands in inventory and
    // placement happens from Grid & inventory, on the player's beat.
    this.act(buyShelfModule(this.state, type), `${META[SHELF_MODULE[type]].name} purchased — it's in your inventory.`);
  }

  // ── The Arete Catalog (issue #197) ──────────────────────────────────────
  // The catalog's arete-face purchases (issue #271) and the board-side Row
  // unlock. Every landing goes through the shared act() shape — refusal
  // says why, success saves and re-renders — and every engine action
  // already gates on upgrade mode, so the face's buttons and the banner
  // are inert outside it by the same rule.

  // The entry purchase's landing (issue #274): the sheet closes and the
  // board flips to the Mutators layer — the tray face follows — with the
  // free first slot auto-armed from Add (every owned cell pulses, the pill
  // reads "free"). The purchase's performed roll waits banked; it
  // auto-opens when the first slot lands.
  buyCatalogEntryAction(): void {
    const result = buyCatalogEntry(this.state);
    if (result.ok) {
      this.ui.modal = null;
      this.ui.detail = null;
      this.worldDisarm();
      this.ui.entryRollPending = true;
    }
    this.act(result, "Mutator tree entered.");
    // The purchase's dismissal (issue #346): the sheet closed, focus
    // returns to the walk's opener. A refusal leaves the sheet standing.
    if (result.ok) this.restoreModalInvoker();
  }

  joinRollPoolAction(): void {
    this.act(joinRollPool(this.state), "The Mutator Forge joined the module roll pool.");
  }

  buyRowUnlockAction(row: number): void {
    this.act(buyRowUnlock(this.state, row), "Octave row unlocked — its cells now buy with nous.");
  }

  // The harmonic-capacity ladder's landings (issue #259): the nous rung
  // and the two Arete offerings, each through the shared act() shape.
  buyCapacityAction(): void {
    this.act(buyCapacity(this.state), "Harmonic capacity raised — every voice carries one more chord.");
  }

  buyCapacityCeilingAction(): void {
    this.act(buyCapacityCeiling(this.state), "The capacity ceiling rises — the nous ladder sells one rung further.");
  }

  buyCapacityDiscountAction(): void {
    this.act(buyCapacityDiscount(this.state), "Capacity rungs cost less nous.");
  }

  // The merge cap's landing (issue #380): the toast names the beat —
  // pairs now combine one tier past where they stopped.
  buyMergeCapAction(): void {
    this.act(buyMergeCapIncrease(this.state), `Merge cap raised — copies now combine to ${tierWord(unlockedMergeCap(this.state))}.`);
  }

  // ── The World layer's gestures (issue #426) ─────────────────────────────
  // The second face over the board: every landing routes through the engine
  // actions from #425 — placeWorldOccupant, retrieveWorldOccupant,
  // setWeaponTargetPriority — so the UI can never drift from the contracts
  // those tests pin. Upgrade-mode-only: each engine gate owns its refusal,
  // and the renderers simply stop drawing.

  // The layer switch — the one World / Modules switch's landing. Two rules
  // ride it:
  // · Pre-reveal the World face is locked-but-visible: requesting it never
  //   flips the mode — it previews the reveal's threshold in figures, in
  //   flow as in upgrade (the World arrives, it is not bought).
  // · A real layer change cancels the armed actions with a toast (the cell
  //   arm, a module placement, a World placement arm — #246's contract);
  //   the Esc walk stays Esc.
  setBoardLayer(layer: "modules" | "world"): void {
    if (this.ui.boardLayer === layer) return;
    if (layer === "world" && !worldEntered(this.state)) {
      this.say(`The World layer reveals at ${worldRevealPreview()}.`);
      return;
    }
    const cancelled: string[] = [];
    if (this.ui.buyingCell) {
      this.ui.buyingCell = false;
      cancelled.push("cell purchase");
    }
    if (this.ui.placing) {
      this.ui.placing = null;
      cancelled.push("placement");
    }
    if (this.ui.worldArmed !== null) cancelled.push("World placement");
    this.worldDisarm();
    this.ui.boardLayer = layer;
    if (cancelled.length > 0) {
      const message = `Mode changed — ${cancelled.join(" and ")} cancelled.`;
      this.say(message);
      const toast = document.getElementById("mode-toast");
      if (toast) {
        window.clearTimeout(this.modeToastTimer);
        toast.textContent = message;
        toast.hidden = false;
        this.modeToastTimer = window.setTimeout(() => { toast.hidden = true; }, 6000);
      }
    }
    this.render();
  }

  // The transient World furniture's one teardown. clearTransientUi reads
  // this shape too.
  private worldDisarm(): void {
    this.cancelWorldDrag?.();
    this.ui.worldArmed = null;
    this.ui.worldArmedKind = null;
    this.ui.worldCarrying = null;
    this.ui.worldDropHover = null;
  }

  worldCancelGestures(): void {
    this.worldDisarm();
    this.say("World gesture cancelled.");
    this.render();
  }

  // The World tray's click-then-cell arm (issue #426): the tap-shaped
  // placement — tap a tray tile, tap an open face.
  worldArmTray(id: string): void {
    if (this.state.mode !== "upgrade") {
      this.say("The board is locked between sessions.");
      return;
    }
    const kind = this.state.world.columns.some((c) => c.id === id)
      ? "column"
      : this.state.world.weapons.some((w) => w.id === id)
        ? "weapon"
        : null;
    if (!kind) return;
    this.worldDisarm();
    this.ui.worldArmed = this.ui.worldArmed === id ? null : id;
    this.ui.worldArmedKind = this.ui.worldArmed ? kind : null;
    if (this.ui.worldArmed) this.say("Choose an open World cell.");
    this.render();
  }

  // The cell click's one resolution (issue #426, detail by #295): the
  // armed tray item places — and an idle click opens the cell's Hex detail
  // on the World face, the declaration having moved there. In flow the
  // idle click is the only resolution: the detail opens read-only, and no
  // arm can stand to place through it.
  worldPickCell(pos: Hex): void {
    const { state, ui } = this;
    if (!worldEntered(state)) return;
    if (state.mode !== "upgrade") {
      this.openDetail(pos, "world");
      return;
    }
    if (ui.worldArmed !== null) {
      const id = ui.worldArmed;
      ui.worldArmed = null;
      ui.worldArmedKind = null;
      this.worldPlace(id, pos);
      return;
    }
    this.openDetail(pos, "world");
  }

  // Right-click retrieve (issue #426): the same chord-breaking gesture as
  // the board's, over the second face.
  worldRightClickCell(pos: Hex): void {
    if (this.state.mode !== "upgrade") return;
    const occupant = worldOccupantAt(this.state, pos);
    if (occupant) this.worldRetrieve(occupant.id);
  }

  // The placement landing shared by the click path and the drag release.
  // Occupied cells refuse (the engine owns the rule); relocation is free.
  worldPlace(id: string, pos: Hex): void {
    this.worldDisarm();
    this.act(
      placeWorldOccupant(this.state, id, pos),
      `${this.worldOccupantName(id)} placed at ${cellNoteOf(pos)}.`,
    );
  }

  worldRetrieve(id: string): void {
    this.act(retrieveWorldOccupant(this.state, id), `${this.worldOccupantName(id)} retrieved to the World tray.`);
  }

  private worldOccupantName(id: string): string {
    const column = this.state.world.columns.find((c) => c.id === id);
    if (column) return COLUMN_WORD;
    const weapon = this.state.world.weapons.find((w) => w.id === id);
    return weapon ? WORLD_META[weapon.type].name : "Occupant";
  }

  // The weapon's between-session target priority (issue #426): the rail's
  // and tray's controls land here, the engine deduplicating and dropping
  // unknown keys. The move walks the effective order — stored preference
  // first, authored roster behind.
  setWeaponPriority(id: string, keys: string[]): void {
    this.act(setWeaponTargetPriority(this.state, id, keys), "Target priority set.");
  }

  worldMovePriority(id: string, key: string, dir: number): void {
    const weapon = this.state.world.weapons.find((w) => w.id === id);
    if (!weapon) return;
    const order = [...weapon.targetPriority, ...WORLD_ENEMIES.map((def) => def.key)].filter((entry, index, all) => all.indexOf(entry) === index);
    const from = order.indexOf(key);
    const to = Math.max(0, Math.min(order.length - 1, from + dir));
    if (from === to) return;
    order.splice(to, 0, ...order.splice(from, 1));
    this.setWeaponPriority(id, order);
  }

  // The Arete Catalog's World purchases (issue #426): the Column ladder and
  // the Hone ranks, each through the shared act() shape.
  buyChargeColumnAction(): void {
    this.act(buyChargeColumn(this.state), "Charge Column purchased — it waits in the World tray.");
  }

  buyHoneRankAction(type: WeaponType): void {
    this.act(buyHoneRank(this.state, type), `${WORLD_META[type].name} attack power honed.`);
  }

  // The live drop preview over the second face (issue #426): hover state
  // changes refresh the land registers in place — never a render.
  setWorldDropHover(id: string | null, pos: Hex | null): void {
    if (this.released) return;
    this.ui.worldDropHover = id && pos ? { id, pos } : null;
    refreshWorldPreview(this);
    updateChordReadout(this);
  }

  // The mutator roll's choice (issue #199): the chosen candidate mints into
  // the Mutator tray, the unchosen vanishes. The tray lives on the Mutators
  // layer, so the landing says where to find it. Every pick keeps the
  // standing landing — the peek stays, the next banked offer presents
  // (2026-10-18 feedback; the entry sequence's auto-arm is retired with
  // the rest of pick-and-place), and the entry flag is spent either way:
  // its remaining work, the first slot's landing auto-opening the roll
  // choice, is done once a choice stands.
  chooseMutatorCandidate(offerId: string, candidateId: string): void {
    const offer = this.state.bankedMutatorRolls.find((o) => o.id === offerId);
    const candidate = offer?.candidates.find((c) => c.id === candidateId);
    if (!candidate) return;
    const result = chooseMutatorRoll(this.state, offerId, candidateId);
    if (!result.ok) {
      this.say(result.reason ?? "That roll cannot be taken.");
      this.render();
      return;
    }
    this.ui.entryRollPending = false;
    const more = this.state.bankedMutatorRolls.length > 0 ? ` ${this.state.bankedMutatorRolls.length} more ${this.state.bankedMutatorRolls.length === 1 ? "choice" : "choices"} wait in the Mutator Forge.` : "";
    this.say(`${FAMILY_WORD[candidate.family]} mutator minted to the roster.${more}`);
    this.forgeAfterConsume();
    this.save();
    this.render();
    // The batch's final landing is a dismissal (issue #346); a standing
    // Forge keeps its peek — no return.
    if (this.ui.modal === null) this.restoreModalInvoker();
  }

  // Cell purchase (ADR-0013): armed from the toolbar's cell icon (or the
  // catalog row), resolved by clicking a frontier hex. The buy only lands
  // when a frontier cell is clicked; the icon toggles, Esc and right-click
  // cancel. On the World face the Add walks to Modules first — the
  // purchase's pulsing frontier lives there.
  armCellPurchase(): void {
    if (this.state.mode !== "upgrade") {
      this.say("Purchases happen between sessions.");
      return;
    }
    this.clearTransientUi();
    this.ui.modal = null;
    this.ui.buyingCell = true;
    this.render();
    this.restoreModalInvoker();
  }

  cancelCellPurchase(): void {
    this.ui.buyingCell = false;
    this.say("Cell purchase cancelled.");
    this.render();
  }

  // The bulk ladder on one module (issue #195): the expanded face's button
  // and the face button. One level keeps the familiar line; a multi-level
  // landing reports what it bought, not what it wanted.
  upgradeLevels(id: string, want: number | "max"): void {
    const module = this.state.modules.find((m) => m.id === id);
    if (!module) return;
    this.landBulk(upgradeModuleLevels(this.state, id, want), (bulk) =>
      bulk.levels === 1
        ? `${META[module.type].name} upgraded to level ${module.level}.`
        : `${META[module.type].name} +${bulk.levels} levels · ${formatInt(bulk.spent)} ν`,
    );
  }

  // The Bend's player-picked shift (ADR-0048): one chip per selectable
  // step on the expanded face. The pick re-pitches the module's voice —
  // the chords move the moment it lands.
  setBendShift(id: string, shift: number): void {
    const before = this.activeInstancesOf(displayedRates(this.state, flowLive(this.state)));
    if (this.act(setBendShift(this.state, id, shift), `Bend re-pitched ${shift > 0 ? "sharp" : "flat"} ${Math.abs(shift)}.`)) {
      this.strumFormedChords(before, id);
    }
  }

  // The Spotlight's player-selected recipient (issue #374): one chip per
  // adjacent oscillator on the expanded face. The pick re-aims the
  // booster's support the moment it lands.
  setBoosterTarget(id: string, targetId: string | null): void {
    const recipient = targetId === null ? null : this.state.modules.find((m) => m.id === targetId);
    this.act(
      setBoosterTarget(this.state, id, targetId),
      recipient && recipient.pos ? `Spotlight focused on ${cellNoteOf(recipient.pos)}.` : "Spotlight support cleared.",
    );
  }

  // The Upgrade All cluster (issue #195): the board-wide sweep — every
  // levelable module, deployed and tray alike, spacers never. The toast
  // reports what landed, whatever the chip promised.
  upgradeAllAction(want: number | "max"): void {
    this.landBulk(upgradeAll(this.state, want), (bulk) =>
      want === "max"
        ? `UPGRADE ALL MAX: ${bulk.levels} levels across ${bulk.modules} modules · ${formatNumber(bulk.spent)} ν`
        : `UPGRADE ALL +${want}: ${bulk.levels} level${bulk.levels === 1 ? "" : "s"} across the board · ${formatNumber(bulk.spent)} ν`,
    );
  }

  // The bulk actions' shared landing (issue #195): the refusal says why, a
  // landing announces what it bought (feats riding the toast), then save
  // and render — the act() shape with a message read off the bulk payload.
  private landBulk(result: ActionResult, message: (bulk: BulkPurchase) => string): void {
    if (!result.ok) {
      this.say(result.reason ?? "That upgrade is not available.");
      this.render();
      return;
    }
    this.announceUnlocks(result.unlocked, message(result.bulk!));
    this.save();
    this.render();
  }

  // The combine offer (issue #152): a matching module-on-module drop opens
  // the review before either copy is consumed. Confirm performs the
  // combine; every cancel path (button, ✕, backdrop, Esc) lands in
  // closeModal, which drops the offer and leaves both copies untouched.
  offerCombine(dragId: string, targetId: string): void {
    this.captureModalInvoker();
    this.ui.combineOffer = { dragId, targetId };
    this.ui.modal = "combine";
    this.render();
  }

  confirmCombine(): void {
    const offer = this.ui.combineOffer;
    this.ui.combineOffer = null;
    this.ui.modal = null;
    if (!offer) {
      this.render();
      this.restoreModalInvoker();
      return;
    }
    this.reportCombine(combine(this.state, offer.dragId, offer.targetId));
    this.restoreModalInvoker();
  }

  private reportCombine(result: ActionResult): void {
    if (result.ok) {
      this.announceUnlocks(
        result.unlocked,
        result.refund && result.refund > 0
          ? `Combined into a stronger copy; ${result.refund} ν of the lower copy's upgrades refunded.`
          : "Combined into a stronger copy.",
      );
      this.save();
    } else {
      this.say(result.reason ?? "Cannot combine.");
    }
    this.render();
  }

  // The library's batch combine (issue #368): the tray's MERGE ALL control
  // — every eligible exact-copy pair, chained until no legal pair remains
  // or the unlocked cap ends the ladder. The refusal says why (no eligible
  // pairs, the flow lock); a landing reports the sweep like the bulk
  // purchases report their buy.
  mergeAllAction(): void {
    const result = mergeAll(this.state);
    if (!result.ok) {
      this.say(result.reason ?? "Nothing to combine.");
      this.render();
      return;
    }
    const sweep = result.merge!;
    const refund = sweep.refund > 0 ? ` · ${formatInt(sweep.refund)} ν refunded` : "";
    this.announceUnlocks(
      result.unlocked,
      `MERGE ALL: ${sweep.combines} combine${sweep.combines === 1 ? "" : "s"}${refund}.`,
    );
    this.save();
    this.render();
  }

  // The tray tile's scrap action (issue #377): the module leaves the
  // roster once, its recovery value banks once, and the toast names both.
  // A copy mid-placement is put down first — the gesture never chases a
  // ghost id.
  scrapModuleAction(id: string): void {
    if (this.ui.placing === id) this.ui.placing = null;
    const module = this.state.modules.find((m) => m.id === id);
    const result = scrapModule(this.state, id);
    if (!result.ok) {
      this.say(result.reason ?? "This module cannot be scrapped.");
      this.render();
      return;
    }
    this.announceUnlocks(
      result.unlocked,
      `${module ? META[module.type].name : "Module"} scrapped · +${formatInt(result.scrap ?? 0)} scrap.`,
    );
    this.save();
    this.render();
  }

  confirmInventoryMerge(): void {
    const offer = this.ui.inventory.merge;
    if (!offer?.partner || this.ui.inventory.scrapMode) return;
    const result = combineInventory(this.state, offer.id, offer.partner);
    if (result.ok) this.ui.inventory.merge = null;
    this.reportCombine(result);
  }

  confirmInventoryScrap(): void {
    const inv = this.ui.inventory;
    if (!inv.scrapMode || !inv.scrapReview) return;
    const count = inv.selected.length;
    const result = scrapInventoryBatch(this.state, inv.selected);
    if (!result.ok) { this.say(result.reason ?? "Selection changed."); this.render(); return; }
    inv.selected = []; inv.scrapMode = false; inv.scrapReview = false;
    this.ui.placing = null;
    this.announceUnlocks(result.unlocked, `${count} module${count === 1 ? "" : "s"} scrapped · +${formatInt(result.scrap ?? 0)} scrap.`);
    this.save(); this.render();
  }

  // The draft's skip action (issue #377): the offer is consumed once and
  // its payout — the best candidate's scrap value — banks to the balance.
  // The Forge modal stays open on the next banked roll — switching faces
  // when the branch empties, closing when both run dry — so a sweep of
  // skips and picks is one panel visit (2026-10-18 feedback).
  skipDraftAction(offerId: string): void {
    const result = skipRoll(this.state, offerId);
    if (!result.ok) {
      this.say(result.reason ?? "That roll cannot be skipped.");
      this.render();
      return;
    }
    this.say(`Roll skipped · +${formatInt(result.scrap ?? 0)} scrap.`);
    this.forgeAfterConsume();
    this.save();
    this.render();
    if (this.ui.modal === null) this.restoreModalInvoker();
  }

  // The scrap face's loom purchase (issue #378): scrap buys the next
  // permanent rung and the toast names the new chance. A refusal — flow
  // lock, empty bank, tuned ladder — says so and touches nothing.
  buyDraftUpgradeAction(): void {
    const result = buyDraftUpgrade(this.state);
    if (!result.ok) {
      this.say(result.reason ?? "The Draft Loom cannot be improved.");
      this.render();
      return;
    }
    const chance = Math.round(draftTierChanceOf(this.state.draftTierBonus) * 100);
    this.say(`Draft Loom improved · tier bonus ${chance}%.`);
    this.save();
    this.render();
  }

  // The special drafts' purchase (issue #379): scrap buys one unused
  // entitlement and the toast names the held count. A refusal — flow
  // lock, empty bank, or a tier product the unlocked cap cannot honor —
  // says so and touches nothing.
  buySpecialDraftAction(kind: SpecialDraftKind): void {
    const result = buySpecialDraft(this.state, kind);
    if (!result.ok) {
      this.say(result.reason ?? "That special draft cannot be bought.");
      this.render();
      return;
    }
    this.say(`${SPECIAL_DRAFT_NAME[kind]} bought · ${this.state.specialDrafts[kind]} held.`);
    this.save();
    this.render();
  }

  // The special drafts' roll (issue #379): one held entitlement becomes
  // one guaranteed offer in the ordinary queue — the Forge's candidates
  // resolve it with the same choose and skip. The toast names the
  // guarantee so the banked draft reads in the ledger line.
  rollSpecialDraftAction(kind: SpecialDraftKind, category: Category): void {
    const result = useSpecialDraft(this.state, kind, category);
    if (!result.ok) {
      this.say(result.reason ?? "That special draft cannot be rolled.");
      this.render();
      return;
    }
    const guarantee = kind === "category" ? `${CATEGORY_WORD[category]} draft` : kind === "rare" ? "rare draft" : "tiered draft";
    this.say(`${SPECIAL_DRAFT_NAME[kind]} rolled · ${guarantee} banked.`);
    this.save();
    this.render();
  }

  // ── The Hex detail (issue #295) ──────────────────────────────────────────
  // The module bloom's successor: an owned cell's full-stack cross-section,
  // standing where the grid stood — the World above Modules in a fixed
  // stack, both visible, the vertical legend synchronized beside them.
  // The grid's placement/drag gestures keep the grid; the detail's own
  // editing surface is read-only during flow.

  // The one opener: any owned cell's idle click lands here, whichever
  // layer stood — the armed gestures resolve before this is ever reached
  // (pickCell and worldPickCell own their branches). The face defaults to
  // the layer the click arrived on — never a locked layer (pre-reveal the
  // World face cannot be emphasized, in the detail or anywhere); in
  // flow the cross-section opens read-only.
  openDetail(pos: Hex, face: DetailFace = "modules"): void {
    const owned = this.state.cells.some((cell) => sameHex(cell, pos));
    if (!owned) return;
    if (face === "world" && !worldEntered(this.state)) face = "modules";
    this.ui.detail = { pos: { q: pos.q, r: pos.r }, face };
    this.ui.chordHover = null;
    this.render();
  }

  // A rate-roster row's tap names its module's place (§7): the same door
  // as the cell click, one hop removed.
  openModuleDetail(id: string): void {
    const module = this.state.modules.find((m) => m.id === id);
    if (!module || module.pos === null) return;
    this.openDetail(module.pos, "modules");
  }

  // The explicit return (issue #295): the grid comes back showing the
  // layer it keeps — position and zoom never moved, so they restore by
  // standing still. Shared inventory browsing state survives the return.
  closeDetail(): void {
    if (!this.ui.detail) return;
    this.ui.detail = null;
    this.render();
  }

  // A face selection inside the detail (issue #295): emphasis moves, the
  // section's controls take focus, and the vertical legend synchronizes —
  // the stack order never changes. A layer that has not arrived is
  // never selectable: pre-reveal the detail stays on Modules, whatever
  // clicks the locked face or its legend symbol. The grid's layer follows
  // the selection in every mode (flow included, its sync as read-only as
  // the switch itself), so the return lands on the face the player last
  // read. The shared tray follows the selected layer, retaining each
  // layer's browsing choices.
  detailFace(face: DetailFace): void {
    if (!this.ui.detail || this.ui.detail.face === face) return;
    if (face === "world" && !worldEntered(this.state)) return;
    this.ui.detail = { ...this.ui.detail, face };
    if (worldEntered(this.state)) this.ui.boardLayer = face;
    this.render();
    // The emphasis lands with the rebuild; the face's chassis takes focus
    // so the keyboard follows the selection.
    focusDetailFace(face);
  }

  // The tray tile's one landing (issue #296): the chosen module places
  // straight into the detail's place — an occupied place swaps, the
  // displaced module to the tray, never an implicit combine (that stays
  // the drop gesture's explicit review). Success keeps
  // the selected Hex and layer standing, and the rebuild refreshes the
  // readouts and the chord row; a chord the placement newly activates
  // cues (issue #390), preferring one carrying the placed voice.
  detailPlaceModule(id: string): void {
    const detail = this.ui.detail;
    if (!detail || this.state.mode !== "upgrade") return;
    const module = this.state.modules.find((m) => m.id === id);
    if (!module || module.pos !== null) return;
    const before = this.activeInstancesOf(displayedRates(this.state, true));
    const swap = deployedAt(this.state, detail.pos) !== undefined;
    if (
      this.act(
        placeModule(this.state, id, detail.pos),
        swap ? `${META[module.type].name} swapped in — the displaced module waits in the tray.` : `${META[module.type].name} placed at ${cellNoteOf(detail.pos)}.`,
      )
    ) {
      this.strumFormedChords(before, module.id);
      focusDetailFace(this.ui.detail!.face);
    }
  }

  // The World tray's landing (issue #426): the chosen occupant places into
  // the detail's cell — occupied cells refuse (the engine owns the rule),
  // and retrieval uses the shared gestures.
  detailPlaceWorld(id: string): void {
    const detail = this.ui.detail;
    if (!detail || this.state.mode !== "upgrade") return;
    if (!this.state.world.weapons.some((w) => w.id === id && w.pos === null) && !this.state.world.columns.some((c) => c.id === id && c.pos === null)) return;
    if (this.act(placeWorldOccupant(this.state, id, detail.pos), `${this.worldOccupantName(id)} placed at ${cellNoteOf(detail.pos)}.`)) {
      focusDetailFace(this.ui.detail!.face);
    }
  }

  openApp(app: FocusApp): void {
    // The Notes door's opener (issue #332): Notes presents as a centered
    // modal — never the clock-anchored frame — whatever surface stood
    // before. The door itself carries the toggle (render.ts).
    if (app === "notes") {
      this.openNotes();
      return;
    }
    this.ui.app = this.ui.app === app ? null : app;
    this.ui.placing = null;
    this.resetHistorySurfaces();
    this.render();
  }

  // The Notes modal's one opener (issue #332): any departure from CAPTURE
  // puts the tab back, the invoking control is remembered for the return,
  // and the Focus sheet stands down — one console surface at a time.
  private openNotes(): void {
    this.dismissAppPanel();
    this.ui.notesFace = "capture";
    this.openModalDirect("notes");
    // The door is Notes' canonical return address (issue #332): an open
    // that began with no focused control — a pointer press on browsers
    // that focus nothing — still returns to the door.
    if (!this.modalInvoker) this.modalInvoker = document.getElementById("app-tile-notes");
  }

  // The Focus sheet's facetab landing (ADR-0050, issue #275): tabs select a
  // face — they are radio-like, never toggles — so a tab for the standing
  // app unwinds that face's inner surfaces to its root instead of closing.
  showFocusFace(face: FocusFace): void {
    const { ui } = this;
    if (face === "history") {
      // HISTORY is the time app's own face: crossing from another face
      // swaps the app first — openApp toggles, so only cross, never
      // re-press — then the body swaps to the list.
      if (ui.app !== "time") this.openApp("time");
      this.openHistory();
      return;
    }
    const host: FocusApp = face === "plan" ? "time" : face;
    if (ui.app !== host) {
      this.openApp(host);
      return;
    }
    // Already the right app: unwind to the face's root in place.
    if (face === "plan" && ui.historyOpen) {
      this.closeHistory();
      return;
    }
    if (face === "habit" && ui.detailHabitId !== null) {
      ui.detailHabitId = null;
      ui.developHabitId = null;
    }
    ui.focusForm = null;
    this.render();
  }

  // The notes modal's tab landing (issue #277): CAPTURE and LOGGED are
  // radio-like, like the Focus sheet's facetabs — a re-press of the
  // standing face does nothing.
  showNotesFace(face: NotesFace): void {
    if (this.ui.modal !== "notes" || this.ui.notesFace === face) return;
    this.ui.notesFace = face;
    this.render();
  }

  closeApp(): void {
    this.dismissAppPanel();
    this.render();
  }

  // The app popover's teardown without the render: the panel itself plus
  // the panel-internal surfaces a habit edit, a drill, or a revealed form
  // leaves behind. Every path that takes the sheet away (closeApp, Escape,
  // the click-away closer) reads this one shape.
  private dismissAppPanel(): void {
    this.ui.app = null;
    this.ui.editingHabitId = null;
    this.ui.focusForm = null;
    this.resetHistorySurfaces();
  }

  // ── Session history (§9) ────────────────────────────────────────────────

  private resetHistoryUi(): void {
    this.ui.historyOpen = false;
    this.ui.historyLimit = HISTORY_PAGE_ROWS;
    this.ui.drillSession = null;
  }

  // The history surfaces clear together when the sheet swaps faces or
  // closes: the HISTORY face's list and drill, and the HABIT face's drilled
  // detail.
  private resetHistorySurfaces(): void {
    this.resetHistoryUi();
    this.ui.detailHabitId = null;
    this.ui.developHabitId = null;
  }

  // The HISTORY facetab's body: the newest-first record list. One-way in —
  // only the facetabs leave it.
  openHistory(): void {
    this.resetHistoryUi();
    this.ui.historyOpen = true;
    this.render();
  }

  // Back to the PLAN face: the facetab, not a control inside the body.
  closeHistory(): void {
    this.resetHistoryUi();
    this.render();
  }

  // The list's show-more tail: one more page of rows.
  moreHistory(): void {
    this.ui.historyLimit += HISTORY_PAGE_ROWS;
    this.render();
  }

  openDrill(sessionNumber: number): void {
    this.ui.drillSession = sessionNumber;
    this.render();
  }

  closeDrill(): void {
    this.ui.drillSession = null;
    this.render();
  }

  // The HABIT face's drill (§9, #255): a list row — or preparation's Edit
  // habit move (issue #447) — opens the habit's development detail, one at
  // a time; the back control returns to the list. Landing on the HABIT
  // face is the drill's own act, so the move works from the PLAN face too.
  // A revealed form collapses with the drill — the detail is its own
  // surface, not a form holder.
  openHabitDetail(id: string): void {
    this.drillHabit(id, false);
  }

  closeHabitDetail(): void {
    this.ui.detailHabitId = null;
    this.ui.developHabitId = null;
    this.render();
  }

  // The summary's Develop action (issue #446, composed into preparation by
  // #447): the habit's class tree stands in for its development read — one
  // deliberate move out of session preparation, landing on the HABIT face
  // the tree lives in. A revealed form collapses with it.
  openHabitDevelop(id: string): void {
    this.drillHabit(id, true);
  }

  // The two drills' one landing: the HABIT face stands with the habit
  // drilled, the tree open only when asked for.
  private drillHabit(id: string, develop: boolean): void {
    this.ui.app = "habit";
    this.resetHistoryUi();
    this.ui.detailHabitId = id;
    this.ui.developHabitId = develop ? id : null;
    this.ui.focusForm = null;
    this.render();
  }

  closeHabitDevelop(): void {
    this.ui.developHabitId = null;
    this.render();
  }

  // The on-demand forms (ADR-0050, issue #275): pressing an action button
  // reveals its input row; a second press, a landing, or Escape collapses
  // it. The keyboard lands in the input it asked for.
  // Each revealed form's landing control — the input the keyboard asks for.
  static readonly FOCUS_FORM_FOCUS: Record<FocusForm, string> = {
    "habit-add": "habit-name-input",
    "habit-log": "habit-log-minutes",
    "goal-create": "goal-minutes",
    "goal-edit": "goal-minutes",
  };

  setFocusForm(form: FocusForm | null): void {
    this.ui.focusForm = this.ui.focusForm === form ? null : form;
    this.render();
    if (this.ui.focusForm) document.getElementById(App.FOCUS_FORM_FOCUS[this.ui.focusForm])?.focus();
  }

  beginPlacing(id: string): void {
    this.ui.app = null;
    this.ui.placing = id;
    this.say("Choose a cell. Occupied modules swap positions.");
    this.render();
  }

  pickCell(pos: Hex): void {
    const { state, ui } = this;
    // The World face owns the board's clicks while it stands (issue #426,
    // flow included): the module board rests hidden and pointer-dead
    // beneath it (issue #298), and a focused cell's Enter must not reach
    // past it either. The face only stands past the reveal (setBoardLayer
    // and flow entry keep the invariant), so the selection alone is the
    // test.
    if (ui.boardLayer === "world") return;
    if (ui.buyingCell) {
      if (state.mode !== "upgrade") return;
      // The arm persists across buys: sweep several cells, then back out
      // yourself via the banner's Cancel (or Esc). act() re-renders each
      // time, so the banner hint and hex prices step to the next scaler rung.
      this.act(buyCell(state, pos), "Cell bought.");
      return;
    }
    if (ui.placing) {
      if (state.mode !== "upgrade") return;
      const module = state.modules.find((m) => m.id === ui.placing);
      if (!module) return;
      this.placeAndStrum(module, pos);
      return;
    }
    // The Hex detail's one door (issue #295): any owned cell's idle click —
    // a module's, or an empty place's — opens the cross-section. In flow
    // the board is locked (§5) and the detail opens read-only: the click
    // still answers the lock, with live readouts and no editing.
    this.openDetail(pos, "modules");
  }

  pickCellThenPlace(id: string, pos: Hex): void {
    const { state } = this;
    if (state.mode !== "upgrade" || this.ui.buyingCell) return;
    const module = state.modules.find((m) => m.id === id);
    if (!module) return;
    this.ui.placing = null;
    this.placeAndStrum(module, pos);
  }

  // The one placement landing (§5–§6), shared by the click path and the
  // drag/touch release. A drop never opens the detail — a placement keeps
  // its gesture. A chord the drop newly activates cues (issue #390),
  // preferring one carrying the placed voice.
  private placeAndStrum(module: ModuleInstance, pos: Hex): void {
    const before = this.activeInstancesOf(displayedRates(this.state, flowLive(this.state)));
    if (this.act(placeModule(this.state, module.id, pos), `${META[module.type].name} placed.`)) {
      this.ui.placing = null;
      this.strumFormedChords(before, module.id);
    }
  }

  returnToInventory(id: string): void {
    this.act(returnModule(this.state, id), "Returned to inventory.");
  }

  addNote(text: string): void {
    const result = writeNote(this.state, text, Date.now());
    if (result.ok) {
      this.say("Noted.");
      this.save();
    } else {
      this.say(result.reason ?? "Cannot capture a note right now.");
    }
    this.render();
  }

  // ── Habits (#5) ─────────────────────────────────────────────────────────

  habitAction(
    run: () => { ok: boolean; reason?: string },
    success: string,
    onSuccess?: () => void,
  ): void {
    const result = run();
    if (result.ok) {
      onSuccess?.();
      this.say(success);
      this.save();
    } else {
      this.say(result.reason ?? "That habit action is unavailable.");
    }
    this.render();
  }

  createHabitAction(name: string): void {
    // A landing collapses the revealed form; a refusal keeps it standing.
    this.habitAction(() => createHabit(this.state, name), `${name.trim()} added to your habits.`, () => {
      this.ui.focusForm = null;
    });
  }

  renameHabitAction(id: string, name: string): void {
    this.ui.editingHabitId = null;
    this.habitAction(() => renameHabit(this.state, id, name), "Habit renamed.");
  }

  archiveHabitAction(id: string): void {
    const habit = this.state.habits.find((h) => h.id === id);
    this.habitAction(() => archiveHabit(this.state, id), `${habit?.name ?? "Habit"} archived.`);
  }

  selectHabitAction(id: string | null): void {
    // Clicking the already-active habit clears the selection, so unstructured
    // practice is always one click away.
    const togglingOff = id !== null && this.state.activeHabitId === id;
    const target = togglingOff ? null : id;
    const habit = this.state.habits.find((h) => h.id === target);
    this.habitAction(
      () => selectHabit(this.state, target),
      togglingOff ? "No habit selected." : habit ? `${habit.name} selected.` : "No habit selected.",
    );
  }

  logPracticeAction(minutes: number): void {
    const habit = activeHabit(this.state);
    if (!habit) {
      this.say("Select a habit first; logs apply to the active habit.");
      this.render();
      return;
    }
    const result = addPracticeLog(this.state, habit.id, minutes, Date.now());
    if (result.ok) {
      this.ui.focusForm = null;
      const goalNote =
        result.completions && result.completions > 0
          ? ` A goal completed.`
          : "";
      this.announceUnlocks(result.unlocked, `Logged ${minutes} min of ${habit.name}.${goalNote}`);
      this.save();
    } else {
      this.say(result.reason ?? "Could not log practice.");
    }
    this.render();
  }

  // ── The habit-class layer (issue #423) ─────────────────────────────

  selectHabitClassAction(habitId: string, classId: ClassId): void {
    const def = classDefOf(classId);
    this.habitAction(() => selectHabitClass(this.state, habitId, classId), `${def.name} selected.`);
  }

  allocateClassNodeAction(habitId: string, nodeId: string): void {
    this.habitAction(() => allocateClassNode(this.state, habitId, nodeId), "Point allocated — respec is free.");
  }

  respecClassTreeAction(habitId: string): void {
    this.habitAction(() => respecClassTree(this.state, habitId), "All tree points returned.");
  }

  applyClassPresetAction(habitId: string, presetId: string): void {
    this.habitAction(() => applyClassPreset(this.state, habitId, presetId), "Preset applied — the points stay freely adjustable.");
  }

  // ── The habit editor's goal and color (issue #445) ──────────────────────

  createGoalAction(habitId: string, minutes: number, schedule: "once" | "daily" | "weekly"): void {
    const result = createGoal(this.state, { habitId, minutes, schedule, now: Date.now() });
    if (result.ok) {
      this.ui.focusForm = null;
      this.save();
      this.say("Goal added.");
    } else {
      this.say(result.reason ?? "Could not create the goal.");
    }
    this.render();
  }

  editGoalAction(goalId: string, minutes: number, schedule: "once" | "daily" | "weekly"): void {
    const result = editGoal(this.state, goalId, { minutes, schedule }, Date.now());
    if (result.ok) {
      this.ui.focusForm = null;
      this.save();
      this.say("Goal updated.");
    } else {
      this.say(result.reason ?? "Could not edit the goal.");
    }
    this.render();
  }

  deleteGoalAction(id: string): void {
    const result = deleteGoal(this.state, id);
    this.say(result.ok ? "Goal removed." : result.reason ?? "Could not remove the goal.");
    if (result.ok) {
      if (this.ui.focusForm === "goal-edit") this.ui.focusForm = null;
      this.save();
    }
    this.render();
  }

  // The migration choice's landing: one carried-over row kept, its pending
  // siblings retired to history.
  retainGoalChoiceAction(id: string): void {
    const result = retainGoalChoice(this.state, id);
    this.say(result.ok ? "Goal kept." : result.reason ?? "Could not keep the goal.");
    if (result.ok) this.save();
    this.render();
  }

  // The habit's palette pick: identity alone, and every goal read inherits
  // it.
  setHabitColorAction(habitId: string, color: HabitColor): void {
    const result = setHabitColor(this.state, habitId, color);
    if (result.ok) this.save();
    else this.say(result.reason ?? "Could not set the color.");
    this.render();
  }

  // The batch Forge (2026-10-18 feedback): every choice — module or
  // mutator — mints unplaced and the sheet stays open while any queue
  // holds rolls. After a pick or a skip consumes an offer, the next one
  // presents; when the consumed face empties, the standing face switches
  // to the branch that still has rolls (entry owned — pre-entry the
  // Mutators face does not exist); when both queues run dry the visit is
  // done and the Forge closes itself, a dismissal like any completed
  // dialog. A manual open on empty queues still shows the standing empty
  // state — only a consuming action can close the sheet.
  private forgeAfterConsume(): void {
    const face = this.ui.forgeFace;
    const faceEmpty = face === "modules" ? this.state.bankedRolls.length === 0 : this.state.bankedMutatorRolls.length === 0;
    if (!faceEmpty) return;
    const other = face === "modules" ? "mutators" : "modules";
    const otherPending = other === "modules" ? this.state.bankedRolls.length : this.state.bankedMutatorRolls.length;
    if (this.state.catalogEntryOwned && otherPending > 0) {
      this.ui.forgeFace = other;
      return;
    }
    this.ui.modal = null;
  }

  chooseCandidate(offerId: string, candidateId: string): void {
    const offer = this.state.bankedRolls.find((o) => o.id === offerId);
    const candidate = offer?.candidates.find((c) => c.id === candidateId);
    if (!candidate) return;
    const result = chooseRoll(this.state, offerId, candidateId);
    if (!result.ok) {
      this.say(result.reason ?? "That roll cannot be taken.");
      this.render();
      return;
    }
    const more = this.state.bankedRolls.length > 0 ? ` ${this.state.bankedRolls.length} more choice${this.state.bankedRolls.length === 1 ? "" : "s"} wait in the Forge.` : "";
    this.announceUnlocks(result.unlocked, `${META[candidate.type].name} added to inventory.${more}`);
    this.forgeAfterConsume();
    this.save();
    this.render();
    // The batch's final landing is a dismissal (issue #346); a standing
    // Forge keeps its peek — no return.
    if (this.ui.modal === null) this.restoreModalInvoker();
  }
  cancelPlacing(): void {
    const id = this.ui.placing;
    this.ui.placing = null;
    if (id) {
      const module = this.state.modules.find((m) => m.id === id);
      if (module) {
        this.say(module.pos === null ? `${META[module.type].name} kept in inventory.` : "Move cancelled.");
      }
    }
    this.render();
  }

  rightClickCell(pos: Hex): void {
    if (this.state.mode !== "upgrade") return;
    if (this.ui.boardLayer === "world") {
      // The second face owns the gesture: its own retrieve lives on the
      // plates (issue #426).
      this.worldRightClickCell(pos);
      return;
    }
    if (this.ui.buyingCell) {
      this.cancelCellPurchase();
      return;
    }
    if (this.ui.placing) {
      this.cancelPlacing();
      return;
    }
    // Right-click retrieves: the same chord-breaking gesture as dragging
    // into the tray, for the hand that prefers a context menu.
    const occupant = this.state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
    if (occupant) this.returnToInventory(occupant.id);
  }

  // The honesty report's answer (§2): banks or drops the bucket in one
  // move and credits the pool accordingly. Non-dismissible mid-session —
  // leaving it unanswered means leaving, and the next return re-presents
  // the pool recalculated. When exit is pending, the session ends straight
  // after the settle, so the report precedes the summary.
  resolveHonesty(outcome: HonestyOutcome): void {
    const resolution = resolveHonestyReport(this.state, outcome);
    if (!resolution.ok) {
      this.say(resolution.reason ?? "The report cannot settle right now.");
      this.render();
      return;
    }
    this.ui.modal = null;
    const wasExiting = this.exitPending;
    this.exitPending = false;
    const goalNote = resolution.completions && resolution.completions > 0 ? " A goal completed." : "";
    const rollNote = resolution.rollsBanked ? ` A module roll banked.` : "";
    this.say(
      (outcome === "missed"
        ? "Report settled — the held nous dropped."
        : "Report settled — the held nous banked.") + goalNote + rollNote,
    );
    if (wasExiting) {
      this.endFlow();
      return;
    }
    this.save();
    this.render();
    this.restoreModalInvoker();
  }

  // The summary's reflection fields (§8): each touch records immediately —
  // the engine keeps the untouched field at its neutral default — and no
  // re-render follows, so the caret and the slider drag never lose their
  // place. Persistence rides the ordinary save points (hidden transition,
  // beforeunload, dismissal), so an unseen summary's half-entered
  // reflection survives a reload alongside the summary itself.
  recordReflectionText(text: string): void {
    recordSummaryReflection(this.state, { text });
  }

  recordReflectionSlider(slider: number): void {
    recordSummaryReflection(this.state, { slider });
  }

  // The loud summary's dismissal (§5.7, §8): the post-session choice that
  // follows is deliberately unguided — no pointing, just the surfaces.
  // All four paths — Continue, ✕, backdrop, Esc — land here and log the
  // same thing: the reflection recorded as its fields were touched, or
  // absent. No distinct skip state exists.
  dismissSummary(): void {
    dismissSessionSummary(this.state);
    this.ui.modal = null;
    this.say("Session banked.");
    this.save();
    this.render();
    this.restoreModalInvoker();
  }

  // The opening arc's one pop-up (§8): dismissal is once, ever — the flag
  // persists, so the card never re-fires, this session or any later one.
  dismissArcCard(): void {
    const result = dismissArcCardAction(this.state);
    if (!result.ok) return;
    this.save();
    this.render();
  }

  openLedger(section: "nous" | "production" | "arete" | "scrap" | "capacity" = "production"): void {
    this.ledgerSection = section;
    this.openModal("rate");
    const target = document.getElementById(`ledger-${section}`);
    target?.scrollIntoView?.({ block: "nearest" });
    target?.focus({ preventScroll: true });
  }

  ledgerSection: "nous" | "production" | "arete" | "scrap" | "capacity" = "production";

  openModal(kind: ModalKind): void {
    // The catalog door opens on the layer's face — layer wins (issue #426,
    // the mode-wins rule's successor): the World face lands on the ◇ face
    // its section lives on, module mode on ν, and no last-face memory
    // outlives the trip.
    if (kind === "catalog") {
      this.openCatalogOnFace(this.ui.boardLayer === "world" ? "arete" : "nous");
      return;
    }
    this.openModalDirect(kind);
  }

  // The catalog's one opener, face named: the mode-wins door and the entry
  // landing both arrive here — the face is decided before the sheet stands.
  private openCatalogOnFace(face: "nous" | "arete"): void {
    this.ui.catalogFace = face;
    this.openModalDirect("catalog");
  }

  private openModalDirect(kind: ModalKind): void {
    this.captureModalInvoker();
    if (kind === "forge") {
      const preferred = this.state.catalogEntryOwned && this.ui.boardLayer === "world" ? "mutators" : "modules";
      const pending = preferred === "modules" ? this.state.bankedRolls.length : this.state.bankedMutatorRolls.length;
      const otherPending = preferred === "modules" ? this.state.bankedMutatorRolls.length : this.state.bankedRolls.length;
      this.ui.forgeFace = !pending && otherPending && this.state.catalogEntryOwned
        ? (preferred === "modules" ? "mutators" : "modules") : preferred;
    }
    this.ui.modal = kind;
    if (kind === "import") this.ui.importText = "";
    this.render();
  }

  closeModal(): void {
    // The honesty report is non-dismissible (ADR-0019): it settles, or the
    // player leaves and the next return re-presents it, recalculated.
    if (this.ui.modal === "honesty") return;
    // Backdrop click or Esc on the loud summary counts as its dismissal, so
    // an unseen summary never silently stays unseen.
    if (this.ui.modal === "summary") {
      this.dismissSummary();
      return;
    }
    // Putting the auto-opened entry roll's choice away banks the roll like
    // any banked roll and retires the sequence's automation (issue #274):
    // nothing re-fires — the roll waits in the Forge, the free slot stays
    // reachable through Add's normal arm, and a later choice keeps the
    // standing landing.
    if (this.ui.modal === "forge") this.ui.entryRollPending = false;
    if (this.ui.modal === "inventory") {
      const inv = this.ui.inventory;
      inv.inspect = null; inv.merge = null; inv.menu = false;
      inv.scrapMode = false; inv.scrapReview = false; inv.selected = [];
      this.ui.worldTray.inspect = null;
    }
    this.ui.modal = null;
    this.ui.combineOffer = null;
    this.ui.importError = null;
    this.render();
    // Every dialog hands focus back to the control that opened it
    // (issue #346, generalizing #332's Notes return), after the render
    // has settled the layer.
    this.restoreModalInvoker();
  }

  // The dialog focus round trip (issue #346, generalizing #332's Notes
  // return). The opener records the focused control; the dismissal —
  // Escape, the close control, a completed action — records it back onto
  // the board. A standing dialog's own controls never take the address:
  // stepping from Settings to Import must return to the walk's opener,
  // not to a control the step replaced.
  private captureModalInvoker(): void {
    if (this.ui.modal || this.modalInvoker) return;
    const active = document.activeElement;
    this.modalInvoker = active instanceof HTMLElement && active !== document.body ? active : null;
  }

  // The focus return (issue #346): the invoking control takes focus again
  // once the render has settled the layer; a control the render replaced
  // falls back to the fresh control with the same id. A programmatic open
  // — the honesty report, the summary, the entry roll's Forge — has no
  // return address and restores nothing.
  private restoreModalInvoker(): void {
    const stored = this.modalInvoker;
    this.modalInvoker = null;
    if (!stored || stored === document.body) return;
    const invoker = stored.isConnected ? stored : stored.id ? document.getElementById(stored.id) : null;
    invoker?.focus({ preventScroll: true });
  }

  // A review whose terms dissolved under it (render.ts's dead-offer drop):
  // the dialog never presents, so the round trip ends where it began — the
  // layer drops and the return address is honored at once; the render pass
  // that dropped it carries on.
  abandonModal(): void {
    this.ui.modal = null;
    this.restoreModalInvoker();
  }

  // Dev helpers (?dev=1): time-warp and fixtures for hands-on verification only.
  // Every helper is dev-gated at the method itself — the panel's absence is
  // the only ordinary-boot door, and the gate makes the "dev boots only"
  // contract true of the family, not just of its surfaces (#466 audit).

  // The dev clock's one prerequisite: flow, live and unpaused. Both clock
  // entries refuse through this guard so their message can never drift.
  private devClockReady(): boolean {
    if (this.state.mode === "flow") return true;
    this.say("Dev clock only works during flow.");
    return false;
  }

  devAdvance(seconds: number): void {
    if (!this.dev || !this.devClockReady()) return;
    const result = advance(this.state, seconds);
    this.reportAdvance(result);
    this.say(`Dev clock +${seconds}s.`);
    this.render();
  }

  devToTarget(): void {
    if (!this.dev || !this.devClockReady()) return;
    const session = this.state.session;
    if (!session || session.target === null) {
      this.say("No timed target running.");
      return;
    }
    this.devAdvance(Math.max(0, session.target - session.elapsed));
  }

  devNous(): void {
    if (!this.dev) return;
    // The dev grant produces like flow does, through the one credit seam.
    // It mints nothing — the door opens on the crossing, and Arete still
    // waits for the prestige action. The grant saves at once: the quick
    // grants' tier is the live save (ADR-0077), so a reload keeps what it
    // gave, exactly like the synth and World era grants beside it.
    earnNous(this.state, 100);
    this.save();
    this.say("Dev: +100 ν.");
    this.render();
  }

  // Dev grant of an additive synthesizer (#137 hands-on): it lands on the
  // first free cell that chords with a deployed synth — a fifth beside the
  // opening board, usually — so seams and the readout read at once. In
  // flow the board stays locked per the standing constraints, so there it
  // lands in the tray to drag into place between sessions.
  devSynth(): void {
    if (!this.dev) return;
    const module = createModule(this.state, "additive");
    this.state.modules.push(module);
    if (this.state.mode !== "upgrade") {
      module.pos = null;
      this.say("Dev: additive synth in your inventory — the board is locked during flow.");
      this.save();
      this.render();
      return;
    }
    const occupied = new Set(this.state.modules.filter((m) => m.pos !== null).map((m) => `${m.pos!.q},${m.pos!.r}`));
    const chordsWith = this.state.modules.filter((m) => m.pos !== null && CATEGORY_OF[m.type] === "oscillator");
    const cell =
      this.state.cells.find(
        (cell) =>
          !occupied.has(`${cell.q},${cell.r}`) &&
          chordsWith.some((synth) => neighbors(synth.pos!).some((n) => sameHex(n, cell))),
      ) ?? null;
    module.pos = cell;
    this.say(
      cell
        ? `Dev: additive synth placed at ${cellNoteOf(cell)}.`
        : "Dev: additive synth in your inventory — no free cell chords with a synth.",
    );
    this.save();
    this.render();
  }

  // Dev grant of the World era (issue #426 hands-on): the reveal past the
  // 1T entry, a granted weapon and a purchased Column on the board, a tray
  // twin, and Arete for the World section. The retired mutator-era grant's
  // slot/mutator rig retired with the Mutator Grid's surfaces; the
  // development board keeps a hand onto the second face.
  // Upgrade mode is the grant's prerequisite (#466 audit): forcing the mode
  // switch over a live session or breather used to strand that phase — an
  // orphaned session or breather serialized into the save, a state shape
  // ordinary play can never produce. The grant now refuses and leaves the
  // running phase untouched.
  devWorldEra(): void {
    if (!this.dev) return;
    if (this.state.mode !== "upgrade") {
      this.say("World era needs upgrade mode — end the running session or breather first.");
      return;
    }
    const s = this.state;
    s.prestiges = Math.max(s.prestiges, 1);
    s.catalogEntryOwned = true;
    s.arete = Math.max(s.arete, 20);
    s.eraEarned = Math.max(s.eraEarned, BALANCE.world.entryNous * 1.5);
    if (!s.world.weapons.some((w) => w.pos !== null)) {
      const weapon = createWeapon(s, "chargeBlade");
      weapon.pos = hex(1, 0);
      s.world.weapons.push(weapon);
    }
    if (!s.world.weapons.some((w) => w.pos === null)) {
      s.world.weapons.push(createWeapon(s, "chargeBlade"));
    }
    if (!s.world.columns.some((c) => c.pos !== null)) {
      const column = createWorldColumn(s);
      column.pos = hex(0, 1);
      s.world.columns.push(column);
    }
    if (!s.world.columns.some((c) => c.pos === null)) {
      s.world.columns.push(createWorldColumn(s));
    }
    this.ui.boardLayer = "world";
    this.say("Dev: World era granted — the second face stands.");
    this.save();
    this.render();
  }

  // The playtesting suite's launch boundary (issue #467, parent #465): one
  // application-facing command set shared by the dev panel's suite entry
  // and agent access (window.__flowsynth) — the same methods either way.
  // A launch builds its scenario's candidate, asserts it before anything
  // changes, detaches the tab onto a private in-memory slot before any
  // write (ADR-0077), installs, and saves — shared-save recovery can
  // never resurrect unrelated state into it, and the ordinary save is
  // never read or overwritten. Repeating a launch rebuilds the state from
  // nothing — no accumulation. The active scenario's assertion re-runs on
  // demand; a failed check is a thrown, named error and a ✗ line in the
  // dev panel. A reload drops the scenario and returns to the ordinary
  // save.

  devScenarioId: string | null = null;
  devScenarioNote: string | null = null;

  // The catalog read: the launchable scenarios with their intended
  // situations and origins — the suite entry's data and the agent
  // discovery read in one.
  devScenarios(): readonly ScenarioDescriptor[] {
    return SCENARIOS;
  }

  // The launch's standing declaration (issue #467): the setup's figures,
  // its intended situation, its origin, and the isolation — the ✓ line
  // every launch and passed assertion writes, the ✗ line replacing on a
  // named failure.
  private scenarioNote(scenario: ScenarioDescriptor, ok: boolean): string {
    return ok
      ? `${scenario.name} ✓ ${scenario.summary()} · ${scenario.situation} · ${scenario.origin} · isolated save`
      : `${scenario.name} ✗`;
  }

  devLaunchScenario(id: string, now: number = Date.now()): void {
    if (!this.dev) return;
    const scenario = scenarioOf(id);
    if (!scenario) {
      this.say(`Dev: no scenario "${id}" — the suite offers ${SCENARIOS.map((s) => s.id).join(", ")}.`);
      return;
    }
    let candidate: GameState;
    try {
      candidate = scenario.build(now);
      scenario.assert(candidate, now);
    } catch (error) {
      // The candidate never installed: whatever scenario the state still
      // carries stays the active one, and the ✗ line names the refused
      // candidate.
      this.devScenarioNote = `${this.scenarioNote(scenario, false)} ${(error as Error).message}`;
      this.say(`Dev scenario failed: ${(error as Error).message}`);
      this.render();
      throw error;
    }
    this.sharedSave = new SharedSave(memorySaveStorage());
    this.clearTransientUi();
    this.ui.modal = null;
    this.ui.importError = null;
    this.devScenarioId = scenario.id;
    this.state = candidate;
    this.lastWall = null;
    this.exitPending = false;
    this.save(now, true);
    this.devScenarioNote = this.scenarioNote(scenario, true);
    this.say(`Dev: ${scenario.name} installed in an isolated save — ${scenario.situation}.`);
    this.render();
  }

  // The capture pass's re-check: confirms the live state still carries the
  // active scenario's intended setup and updates the dev panel's note
  // either way. Throws the named failure — a capture recording its
  // assertions cannot miss one.
  devScenarioAssert(now: number = Date.now()): void {
    if (!this.dev) return;
    const scenario = this.devScenarioId ? scenarioOf(this.devScenarioId) : null;
    if (!scenario) {
      this.say("Dev: no scenario installed — launch one from the suite first.");
      return;
    }
    try {
      scenario.assert(this.state, now);
    } catch (error) {
      this.devScenarioNote = `${this.scenarioNote(scenario, false)} ${(error as Error).message}`;
      this.render();
      throw error;
    }
    this.devScenarioNote = this.scenarioNote(scenario, true);
    this.say(`Dev: ${scenario.name} assertions passed.`);
    this.render();
  }

  // The playthrough boundary (issue #468): one command set shared by the
  // dev panel's run control and agent access — the same composition, run,
  // and result either way. The runner is a pure engine walk on its own
  // candidate state: it never touches the live state, the save, or the
  // scenario installation, so a run cannot contaminate anything. The
  // recipe composes from the default by an explicit, validated input;
  // a bad input is a thrown, named error and a ✗ line in the panel.
  // The result stands in the panel's note — measurements and explicit
  // outcomes, never a pacing verdict (story 37).

  devPlaythrough: PlaythroughRecord | null = null;
  devPlaythroughNote: string | null = null;
  // The historical selection (issue #470): the one field owning which
  // recorded snapshot is inspected. The inspected board/state is always
  // the record's own frozen snapshot behind this index — never a copy on
  // a second store — and inspection writes nothing but this selection.
  devInspected: number | null = null;
  // The curves surface (issue #470): open state and its x clock —
  // simulated elapsed or credited practice, both recorded per sample.
  devCurvesOpen = false;
  devCurvesAxis: "elapsed" | "credited" = "elapsed";

  // The declared recipe: the default, so configuration reads what a run
  // would carry before running it.
  devPlaythroughRecipe(): PlaythroughRecipe {
    return defaultPlaythroughRecipe();
  }

  // The declared policies: the same descriptors the select offers and the
  // recipe validates against — one catalog, every reader.
  devPlaythroughPolicies(): readonly PlaythroughPolicy[] {
    return PLAYTHROUGH_POLICIES;
  }

  devRunPlaythrough(input: PlaythroughRecipeInput = {}): PlaythroughRecord {
    if (!this.dev) {
      throw new Error("The playthrough commands are development commands.");
    }
    let record: PlaythroughRecord;
    try {
      record = runPlaythrough(composePlaythroughRecipe(input));
    } catch (error) {
      this.devPlaythroughNote = `Playthrough ✗ ${(error as Error).message}`;
      this.say(`Dev playthrough failed: ${(error as Error).message}`);
      this.render();
      throw error;
    }
    this.devPlaythrough = record;
    this.devPlaythroughNote = playthroughNote(record);
    // A new run replaces the record: the old selection's indexes mean
    // nothing on it, so the selection clears with the record it pointed at.
    this.devInspected = null;
    this.say(
      record.complete
        ? `Dev: playthrough ${record.runId} complete — ${record.days} days, ${Math.round(record.creditedSeconds / 60)}m credited, claims ${record.claims.join(", ") || "none"} Arete.`
        : `Dev: playthrough ${record.runId} incomplete after ${record.days} days — see the dev panel.`,
    );
    this.render();
    return record;
  }

  // The historical inspection boundary (issue #470): one command set
  // shared by the curves surface and agent access — the same selection,
  // the same read-only recorded state either way. The selection is this
  // one field; the inspected board/state is the record's own frozen
  // snapshot behind it, assembled for reading by the engine's pure
  // inspector. Nothing here touches the live state, the save, or the
  // run: a snapshot clone reads, the original never does. A bad index is
  // a thrown, named error.
  devInspectPlaythrough(index: number | null): PlaythroughInspection | null {
    if (!this.dev) {
      throw new Error("The inspection commands are development commands.");
    }
    if (index === null || this.devPlaythrough === null) {
      this.devInspected = null;
      this.render();
      return null;
    }
    const inspection = playthroughInspection(this.devPlaythrough, index);
    this.devInspected = index;
    this.render();
    return inspection;
  }

  devToggleCurves(): void {
    if (!this.dev) return;
    this.devCurvesOpen = !this.devCurvesOpen;
    this.render();
  }

  // The plot's clock: simulated elapsed or credited practice — the two
  // recorded x values per sample, so schedule effects stay readable
  // (story 26).
  devSetCurvesAxis(axis: "elapsed" | "credited"): void {
    if (!this.dev || this.devCurvesAxis === axis) return;
    this.devCurvesAxis = axis;
    this.render();
  }

  // The step control's shared walk (story 28): the previous/next recorded
  // snapshot around the selection, wrapping at the ends — the same
  // selection the plot's points and markers write.
  devStepCurves(step: number): void {
    if (!this.dev || this.devPlaythrough === null || this.devPlaythrough.snapshots.length === 0) return;
    const count = this.devPlaythrough.snapshots.length;
    const from = this.devInspected ?? (step > 0 ? -1 : 0);
    this.devInspectPlaythrough(((from + step) % count + count) % count);
  }

  // The development allocation board (#257 hands-on): a deterministic
  // scenario board solved through the real rate path at a configurable
  // whole-chord capacity. Capacity, voice power, and placement are the
  // levers; active instances, per-voice budget, and final ν/s are the
  // reads. Never saved — the scenario rebuilds identically on every boot.

  devBoard: DevBoardState | null = null;
  private devStressWorker: Worker | null = null;

  devToggleBoard(): void {
    if (!this.dev) return;
    this.devBoardCancelStress();
    this.devBoard = this.devBoard
      ? null
      : { scenario: createDevScenario(), capacity: 1, selected: null, keep: null, stress: null, stressRunning: false, stressError: null };
    this.render();
  }

  devBoardSetCapacity(capacity: number): void {
    if (!this.devBoard || !(DEV_BOARD_CAPACITIES as readonly number[]).includes(capacity)) return;
    this.devBoardAdvanceKeep();
    this.devBoard.capacity = capacity;
    this.render();
  }

  devBoardSelect(id: string | null): void {
    if (!this.devBoard) return;
    this.devBoard.selected = this.devBoard.selected === id ? null : id;
    this.render();
  }

  // Placement: a selected voice moves to the clicked free scenario cell;
  // a clicked occupied cell selects its voice instead.
  devBoardMoveTo(q: number, r: number): void {
    if (!this.devBoard) return;
    const occupant = this.devBoard.scenario.modules.find((m) => m.pos !== null && m.pos.q === q && m.pos.r === r);
    if (occupant) {
      this.devBoard.selected = occupant.id;
      this.render();
      return;
    }
    if (!this.devBoard.selected) return;
    if (!this.devBoard.scenario.cells.some((c) => c.q === q && c.r === r)) return;
    const moving = this.devBoard.scenario.modules.find((m) => m.id === this.devBoard!.selected);
    if (!moving || moving.pos === null) return;
    this.devBoardAdvanceKeep();
    moving.pos = { q, r };
    this.render();
  }

  devBoardPower(delta: number): void {
    if (!this.devBoard || !this.devBoard.selected) return;
    const module = this.devBoard.scenario.modules.find((m) => m.id === this.devBoard!.selected);
    if (!module) return;
    this.devBoardAdvanceKeep();
    module.level = Math.max(0, Math.min(24, module.level + delta));
    this.render();
  }

  devBoardReset(): void {
    if (!this.devBoard) return;
    this.devBoardCancelStress();
    this.devBoard.stress = null;
    this.devBoard.stressError = null;
    this.devBoard.scenario = createDevScenario();
    this.devBoard.capacity = 1;
    this.devBoard.selected = null;
    this.devBoard.keep = null;
    this.render();
  }

  // The retention hint advances at each board mutation — the answer the
  // player was just shown is the active set the next solve retains on
  // equal output.
  private devBoardAdvanceKeep(): void {
    if (!this.devBoard) return;
    const { read } = allocatedDevScenarioRates(this.devBoard.scenario, this.devBoard.capacity, this.devBoard.keep);
    this.devBoard.keep = new Set(read.instances.map((instance) => instance.key));
  }

  // The repeatable stress ladder, in the browser: the same rows the
  // engine suite prints, through the same allocator.
  devBoardStress(): void {
    if (this.released) return;
    if (!this.devBoard) return;
    if (this.devBoard.stressRunning) {
      this.devBoardCancelStress();
      this.render();
      return;
    }
    const board = this.devBoard;
    board.stress = [];
    board.stressError = null;
    board.stressRunning = true;
    this.render();
    try {
      const worker = new Worker(new URL("../engine/allocation-stress.worker.ts", import.meta.url), { type: "module" });
      this.devStressWorker = worker;
      worker.onmessage = ({ data }: MessageEvent<StressProgress>) => {
        if (this.devBoard !== board || this.devStressWorker !== worker) return;
        if ("row" in data) board.stress!.push(data.row);
        else {
          if ("error" in data) board.stressError = data.error;
          this.devBoardCancelStress();
        }
        this.render();
      };
      worker.onerror = () => {
        if (this.devBoard !== board || this.devStressWorker !== worker) return;
        board.stressError = "Stress run failed. Try again.";
        this.devBoardCancelStress();
        this.render();
      };
      worker.postMessage(null);
    } catch {
      board.stressError = "Stress worker unavailable. Try again.";
      this.devBoardCancelStress();
      this.render();
    }
  }

  private devBoardCancelStress(): void {
    this.devStressWorker?.terminate();
    this.devStressWorker = null;
    if (this.devBoard) this.devBoard.stressRunning = false;
  }

  // The board's one computation — pure, re-derived on demand by its
  // renderer; the retention hint advances only at mutations.
  devBoardResult(): DevBoardResult | null {
    if (!this.devBoard) return null;
    return allocatedDevScenarioRates(this.devBoard.scenario, this.devBoard.capacity, this.devBoard.keep);
  }

  frontierCells(): Hex[] {
    const { state } = this;
    const out: Hex[] = [];
    const seen = (h: Hex) => state.cells.some((c) => sameHex(c, h)) || out.some((c) => sameHex(c, h));
    for (const cell of state.cells) {
      for (const n of neighbors(cell)) {
        if (!seen(n)) out.push(n);
      }
    }
    return out;
  }

  // The global mute toggle (§5): one switch in PREFERENCES gating every
  // app sound — the chime's re-fires included.
  setMuted(muted: boolean): void {
    this.state.muted = muted;
    this.save();
    this.render();
  }

  // The tab title (§4): the live clock while a session runs — remaining on
  // planned, elapsed on open-ended — a static "done" past the target,
  // "paused" overriding during overrun, plain FlowSynth with no session.
  // Ticks keep it exact whenever visible; while hidden it lands at
  // wake-ups.
  private syncTitle(): void {
    let title = "FlowSynth";
    const session = this.state.session;
    if (this.state.mode === "paused") {
      title = "paused · FlowSynth";
    } else if (this.state.mode === "breather" && this.state.breather) {
      // The breather's remaining allowance (docs/breather-spec.md §5).
      const remaining = Math.max(0, this.state.breather.allowanceSeconds - this.state.breather.elapsed);
      title = `breather ${formatClock(remaining)} · FlowSynth`;
    } else if (this.state.mode === "flow" && session) {
      if (session.target === null) {
        title = `${formatClock(session.elapsed)} · FlowSynth`;
      } else if (session.elapsed >= session.target) {
        title = "done · FlowSynth";
      } else {
        title = `${formatClock(Math.max(0, session.target - session.elapsed))} · FlowSynth`;
      }
    }
    if (document.title !== title) document.title = title;
  }

  render(): void {
    if (this.released) return;
    render(this);
    this.sweepListeners();
    this.syncTitle();
    document.body.classList.toggle("live", flowLive(this.state));
    // The second layer's grey (issue #199): while the Mutators layer
    // stands — flow reading it now too (issue #387) — the stylesheet greys
    // the module board and silences its pointers, the grid rendering as
    // the foreground.
    document.body.classList.toggle("world-layer-live", worldBoardLive(this));
    // Add-cell mode's rest (#201): the one mode that dims the board — the
    // owned modules rest greyed and pointer-dead behind the pill.
    document.body.classList.toggle("cell-arming", this.state.mode === "upgrade" && this.ui.buyingCell);
  }
}
