import { advance, earnNous } from "../engine/advance";
import type { AdvanceResult } from "../engine/types";
import {
  buyCatalogEntry,
  buyCell,
  buyGoalCapacity,
  buyRowUnlock,
  buyShelfModule,
  chooseMutatorRoll,
  chooseRoll,
  combine,
  combineMutators,
  combineMutatorsPreview,
  dismissArcCard as dismissArcCardAction,
  dismissSummary as dismissSessionSummary,
  endSession,
  joinRollPool,
  pauseSession,
  placeModule,
  placeMutator,
  prestige,
  recordSummaryReflection,
  resumeSession,
  returnModule,
  returnMutator,
  startSession,
  unlockMutatorSlot,
  upgradeAll,
  upgradeModuleLevels,
  type ActionResult,
  type BulkPurchase,
} from "../engine/actions";
import { ARETE_HORIZON, claimOf } from "../engine/accumulator";
import { neighbors, hex, sameHex } from "../engine/hex";
import { newChordTerms } from "../engine/chords";
import { computeRates, mutatorAt } from "../engine/economy";
import { deserialize, serialize, STORAGE_KEY } from "../engine/save";
import { formatClock } from "../engine/clock";
import { formatInt, formatNumber } from "./format";
import { applyGap, flushPendingAway, poolOutstanding, resolveHonestyReport, type HonestyOutcome } from "../engine/trust";
import { createInitialState, createModule } from "../engine/state";
import { appActive, type FocusApp } from "../engine/apps";
import { writeNote } from "../engine/notes";
import { achievementName } from "../engine/achievements";
import { CATEGORY_OF, SHELF_MODULE, CHIME } from "../engine/constants";
import { cellNoteOf } from "../engine/lattice";
import {
  activeHabit,
  addPracticeLog,
  archiveHabit,
  createHabit,
  renameHabit,
  selectHabit,
} from "../engine/habits";
import { createGoal, deleteGoal, rollGoalOccurrences } from "../engine/goals";
import type { GameState, Hex, ModuleInstance, MutatorFamily, MutatorInstance, NamedChordTerm, Rarity, ShelfType } from "../engine/types";
import { render } from "./render";
import { FAMILY_WORD, mutatorLayerLive, refreshMutPreview } from "./mutators";
import { HISTORY_PAGE_ROWS, META } from "./meta";
import { browserChannels, type SignalChannels } from "./signals";

// The session modal surfaces (§5.5, §5.7): the enter prompt precedes every
// session; the loud summary follows every one; the honesty report interrupts
// whenever provisional time waits (§1–2). The rate sheet is the Rate cell's
// tap-up disclosure below the 760px breakpoint (§7); the inventory sheet
// re-docks the board-surface tray for touch on portrait phone.
export type ModalKind =
  | "settings"
  | "catalog"
  | "arete"
  | "forge"
  | "achievements"
  | "export"
  | "import"
  | "reset"
  | "prestige"
  | "honesty"
  | "enter"
  | "summary"
  | "rate"
  | "inventory"
  | "combine"
  | "mutcombine"
  | null;

// The enter prompt's kind-first selection (issue #92's decided shape): the
// segmented control decides what kind of session this is before any
// specifics — pick from the habits you have, name a brand-new one, or run
// with no habit attached.
export type EnterKind = "habit" | "new" | "unstructured";

// The prompt's selection state, one clump: the kind tab that holds, the
// habit the habit tab has picked, and the new-habit name as typed.
export interface EnterSelection {
  kind: EnterKind;
  habitId: string | null;
  newName: string;
}

export const freshEnterSelection = (): EnterSelection => ({ kind: "habit", habitId: null, newName: "" });

// The chord-hover ask (§6): a seam hovered names its one chord; a module
// hovered names every chord it sings in; a Mutator slot hovered names its
// mutator's full declaration (issue #199). The reserved readout answers.
export type ChordHover =
  | { kind: "chord"; key: string }
  | { kind: "module"; moduleId: string }
  | { kind: "mutator"; pos: Hex };

// The combine offer's pair (issue #152): the module the player dropped and
// the matching twin that received the drop.
export interface CombineOffer {
  dragId: string;
  targetId: string;
}

// The mutator combine offer's pair (issue #199): the same gesture over the
// Mutator Grid — the mutator carried by the drop and the matching twin that
// received it. Mutators carry no levels, so the review's terms are shorter.
export interface MutCombineOffer {
  dragId: string;
  targetId: string;
}

export interface UiState {
  selected: string | null;
  // The focus app whose console popover is open, if any (ADR-0012).
  app: FocusApp | null;
  // The phone launcher's menu (issue #149): the one compact entry point
  // keeping Habit, Notes, and Goals reachable below the 600px line. Light
  // furniture — never saved; cleared with the transient modes.
  launcherOpen: boolean;
  placing: string | null;
  // The live drop preview (§5–§6): the module a drag or armed placement is
  // pointing at, and the cell it hovers. Null whenever nothing hovers.
  dropHover: { moduleId: string; pos: Hex } | null;
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
  importText: string;
  importError: string | null;
  // The plan the next session starts with (§6): null is open-ended — the
  // resting mode, nothing pushed. The launch apps are free (ADR-0019), so
  // even session one can be planned from here; the affordances stay
  // visible but unpushed.
  chosenTarget: number | null;
  // The enter prompt's kind-first selection (issue #95). Light furniture —
  // reset every time the prompt opens.
  enter: EnterSelection;
  showAcquired: boolean;
  editingHabitId: string | null;
  // Session history (§9): the Time app's list view, its page size, and the
  // record drilled into. Light furniture — cleared with the popover.
  historyOpen: boolean;
  historyLimit: number;
  drillSession: number | null;
  // The Habit app's expanded development summary (§9): one habit at a time.
  summaryHabitId: string | null;
  // Board navigation (§7): the zoom level and the world point the wrap
  // holds at its center — null means fitted. Light furniture — never
  // saved; fit resets zoom to 1 and the pan to null.
  zoom: number;
  pan: { x: number; y: number } | null;
  // The tray column's explicit state (§5): toggled from the dock's
  // Inventory icon; drags and placements open it temporarily whatever this
  // says. Light furniture — never saved.
  trayOpen: boolean;
  // The bulk-upgrade surfaces (issue #195): the expanded face's dial count,
  // held per module so a new selection starts at ×1, and the shift-held
  // MAX mode every face button's label flips into board-wide (Cookie
  // Clicker pattern). Light furniture — never saved.
  bulkCount: 1 | 5 | 10 | "max";
  bulkModuleId: string | null;
  faceMax: boolean;
  // The Mutator Grid's layer tab (issue #199): which grid the board shows —
  // the modules (production) or the Mutators (the second layer). Upgrade-mode
  // furniture beside the entry purchase; flow shows neither tab nor layer.
  // Light furniture — never saved.
  mutLayer: "modules" | "mutators";
  // The Mutator tray item armed for click-then-slot placement (issue #199,
  // mirroring ui.placing). Light furniture — never saved.
  mutArmedTray: string | null;
  // The slot-unlock arm (issue #199): armed from the Mutator tray's unlock
  // button, resolved by clicking an eligible cell — the entry's first slot
  // free on any owned cell, later ones adjacent to the patch, priced. Light
  // furniture — never saved.
  mutUnlockArmed: boolean;
  // The popover's armed move (issue #199): the placed mutator waiting for a
  // vacant slot to move to. Light furniture — never saved.
  mutMoving: string | null;
  // The declaration popover's mutator (issue #199): the placed mutator whose
  // Retrieve / Move popover stands. Light furniture — never saved.
  mutPopover: string | null;
  // The mutator combine offer (issue #199): the pair a matching drop put up
  // for review. Cancel clears it and both copies stay untouched. Light
  // furniture — never saved.
  mutCombineOffer: MutCombineOffer | null;
  // The mutator a pointer drag is carrying (issue #199) and the slot its
  // ghost hovers — the live drop preview over the second layer. Ephemeral:
  // lives exactly as long as one drag gesture.
  mutCarrying: string | null;
  mutDropHover: { mutatorId: string; pos: Hex } | null;
}

interface LoadedSave {
  state: GameState;
  savedAt: number;
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

type ParsedSave = LoadedSave | { error: string };

// The save file's wall-clock stamp, or null when the file carries none a
// guard can trust — a broken stamp must never block a legitimate write
// (#128).
function savedAtOf(raw: string): number | null {
  try {
    const savedAt = (JSON.parse(raw) as { savedAt?: unknown }).savedAt;
    return typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : null;
  } catch {
    return null;
  }
}

function parseSave(text: string): ParsedSave {
  const result = deserialize(text);
  if (result.error || !result.state) {
    return { error: result.error ?? "unknown error" };
  }
  return { state: result.state, savedAt: savedAtOf(text) ?? Date.now() };
}

// The dual clock (focus-tool spec §1, §10): drift between the wall clock
// and the monotonic one. performance.now() does not advance while the
// machine sleeps; Date.now() does — so a positive step in this drift across
// a boundary sizes a slept gap, even while the tab stayed "visible".
function dualDriftMs(): number {
  return Date.now() - (performance.timeOrigin + performance.now());
}

export class App {
  state: GameState = createInitialState();
  ui: UiState = {
    selected: null,
    app: null,
    launcherOpen: false,
    placing: null,
    dropHover: null,
    chordHover: null,
    buyingCell: false,
    combineOffer: null,
    modal: null,
    importText: "",
    importError: null,
    chosenTarget: null,
    enter: freshEnterSelection(),
    showAcquired: false,
    editingHabitId: null,
    historyOpen: false,
    historyLimit: HISTORY_PAGE_ROWS,
    drillSession: null,
    summaryHabitId: null,
    zoom: 1,
    pan: null,
    trayOpen: false,
    bulkCount: 1,
    bulkModuleId: null,
    faceMax: false,
    mutLayer: "modules",
    mutArmedTray: null,
    mutUnlockArmed: false,
    mutMoving: null,
    mutPopover: null,
    mutCombineOffer: null,
    mutCarrying: null,
    mutDropHover: null,
  };
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
  // The newest stored save this tab has incorporated — by loading at boot,
  // writing, or adopting (#128). A slot entry newer than this was written
  // by another tab: this tab's memory predates it, so writing would
  // silently discard that tab's progress and save() refuses instead.
  private knownSavedAt = 0;
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
  // The Forge's threshold-crossing flash: a roll was minted, so its face
  // flashes until this wall-clock moment.
  rollFlashUntil = 0;
  // Set when the stored save was rejected (e.g. the ADR-0017 v5 clean cut):
  // the message must survive the constructor's greeting.
  private loadNotice: string | null = null;
  // The expanded face's outside-click ledger (§5): one one-shot token
  // count with two writers. The click that opens the bloom bubbles to the
  // document after select() has dropped a token, and clicks inside the
  // bloom — the Upgrade button included, whose re-render detaches it before
  // the document listener reads anything — are captured on the bloom host,
  // the one node no re-render replaces. The document-level closer consumes
  // one token per click instead of closing what the click opened or stands
  // in; a click with no token is outside, and dismisses.
  private bloomClickTokens = 0;
  // The module a pointer drag is carrying, if any — pointerleave must not
  // clear a drag's hover preview just because the ghost crosses a cell
  // boundary. Ephemeral: lives exactly as long as one drag gesture.
  dragging: string | null = null;
  // The board's world bounds, recomputed every render from the owned and
  // frontier cells (§7): the lens the zoom and pan clamp against.
  boardBounds = { x: -100, y: -100, width: 200, height: 200 };
  private els: Record<string, HTMLElement>;

  constructor(els: Record<string, HTMLElement>, dev: boolean, channels: SignalChannels = browserChannels) {
    this.els = els;
    this.dev = dev;
    this.channels = channels;
    const loaded = this.load();
    if (loaded) {
      this.resumeFromSave(loaded);
    } else {
      this.state = createInitialState();
    }
    rollGoalOccurrences(this.state, Date.now());
    this.ensureBoardOverlays();
    this.bindGlobalEvents();
    document.getElementById("console-settings")?.addEventListener("click", () => this.openModal("settings"));
    this.greet();
    this.render();
    this.save();
  }

  private load(): LoadedSave | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = parseSave(raw);
      if ("error" in parsed) {
        this.loadNotice = `Could not load the local save: ${parsed.error}`;
        // A rejected file (an unknown version, say) is ours to overwrite:
        // record its stamp so the fresh save this boot is about to write is
        // never blocked by the very file that was refused (#128).
        this.knownSavedAt = savedAtOf(raw) ?? this.knownSavedAt;
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // The board-surface overlays (§5): the expanded-face bloom and the
  // inventory tray live over the board's own space, so their hosts are
  // created once here — the bloom's outside-click ledger binds against a
  // node that never moves, and no render ever has to bootstrap one.
  private ensureBoardOverlays(): void {
    const space = document.querySelector(".board-space");
    if (!space) return;
    if (!document.getElementById("module-bloom")) {
      const bloom = document.createElement("div");
      bloom.id = "module-bloom";
      bloom.className = "module-bloom";
      bloom.hidden = true;
      space.append(bloom);
    }
    if (!document.getElementById("inventory-zone")) {
      const tray = document.createElement("div");
      tray.id = "inventory-zone";
      tray.className = "inventory-tray";
      space.append(tray);
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
    this.knownSavedAt = loaded.savedAt;
    this.lastWall = null;
    this.presence = document.visibilityState === "visible";
    this.exitPending = false;
    // An unseen loud summary (§5.7) survives a reload: the modal re-opens
    // until the player dismisses it.
    if (this.state.mode === "upgrade" && this.state.summary && !this.state.summary.seen) {
      this.ui.modal = "summary";
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
    return this.els["grid"]?.isConnected === true;
  }

  // The boundary clock's baseline: wall moment and dual-clock drift move
  // together, never one without the other.
  private syncBoundaryClock(now: number): void {
    this.lastWall = now;
    this.lastDrift = dualDriftMs();
  }

  // One boundary (§1): the wall-clock gap since the last boundary is
  // classified by the presence that held during it and the whole simulation
  // advances by it — never by tick count, which throttling falsifies.
  private applyBoundary(now: number): void {
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

  // The stored save's stamp, read fresh at every check: the slot is shared,
  // so any read may observe another tab's write (#128). Null when absent or
  // unreadable — a broken stamp never counts as newer, never blocks.
  private storedSavedAt(): number | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw === null ? null : savedAtOf(raw);
    } catch {
      return null;
    }
  }

  // Whether the slot holds a save this tab never loaded, wrote, or adopted —
  // another tab's write, which this tab's memory predates (#128).
  private externalNewerSave(): boolean {
    const stored = this.storedSavedAt();
    return stored !== null && stored > this.knownSavedAt;
  }

  // Converges onto a newer stored save through the one resume/reconcile
  // path (§1): the adopted save is treated exactly like a reload — a live
  // session resumes with its absence reconciled as away. False when the
  // slot holds nothing newer than this tab has incorporated: an unreadable
  // slot never blocks, and another tab's forced older-stamped write (an
  // import, a reset) must never revert this tab's fresher memory (#128).
  private adoptNewerSave(): boolean {
    if (!this.externalNewerSave()) return false;
    const loaded = this.load();
    if (!loaded) return false;
    this.clearTransientUi();
    this.resumeFromSave(loaded);
    this.say("Caught up to the newer save from another tab.");
    this.render();
    return true;
  }

  // The one writer (§10). A shared slot means the write can race another
  // tab's (#128): when the slot holds a save newer than anything this tab
  // has incorporated, the write would silently discard that tab's progress,
  // so it is refused — the tab stays on its own copy until a storage event
  // (outside flow) or a return adopts the newer save. A tab whose own write
  // is the newest thing in the slot — the single-tab case — saves through
  // unchanged. Explicit import and reset force their write: a deliberate
  // choice outranks the stamp. The stamp is claimed only after the slot
  // accepted the write: a failed write (private browsing, full storage)
  // must never read as incorporated.
  save(now: number = Date.now(), force = false): void {
    if (!force && this.externalNewerSave()) return;
    try {
      localStorage.setItem(STORAGE_KEY, serialize(this.state, now));
      this.knownSavedAt = now;
    } catch {
      // Private browsing or full storage: the session continues without durable saves.
    }
    this.lastSaveWall = now;
  }

  exportText(): string {
    return serialize(this.state);
  }

  // The transient interaction modes are mutually exclusive: every exit path
  // (import, reset, session start, arming another mode) clears them together.
  private clearTransientUi(): void {
    this.ui.selected = null;
    this.ui.app = null;
    this.ui.launcherOpen = false;
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
    // The Mutator Grid's layer and gestures are upgrade-mode furniture too
    // (issue #199): flow shows neither tab nor layer, and every armed
    // gesture unwinds with the rest.
    this.ui.mutLayer = "modules";
    this.mutDisarm();
  }

  importText(text: string): boolean {
    const parsed = parseSave(text);
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
    this.ui.modal = "prestige";
    this.render();
  }

  // The confirm's answer: banks the live claim and begins the next era —
  // levels to base, nous to a fresh grant, charge and the era bar reset;
  // the board, tray, rolls, achievements, life record, and Arete persist.
  confirmPrestige(): void {
    const claim = claimOf(this.state);
    const result = prestige(this.state);
    if (!result.ok) {
      this.say(result.reason ?? "The door is not open.");
      this.render();
      return;
    }
    this.ui.modal = null;
    this.say(`Banked ${claim} Arete — the next era begins.`);
    this.save();
    this.render();
  }

  say(text: string): void {
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
    });
    // A bfcache restore is a return: the frozen stretch classifies as away,
    // and a save another tab wrote while this page sat frozen is adopted
    // through the same reconcile path (#128).
    window.addEventListener("pageshow", (event) => {
      if (!(event as PageTransitionEvent).persisted) return;
      this.presence = document.visibilityState === "visible";
      this.adoptNewerSave();
      this.processReturn(Date.now());
    });
    // Another tab's save, announced here in every tab but the writer
    // (#128): outside a live session the tab adopts a save newer than
    // anything it has incorporated — a cheap, invisible catch-up; another
    // tab's forced older-stamped import or reset is left standing. Mid-flow
    // the write guard refuses stale writes and the next visible return
    // adopts through the reconcile path.
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !this.ownsBoard()) return;
      if (this.state.mode !== "flow") this.adoptNewerSave();
    });
    // Focus loss alone is not away, but focus is a boundary: a stalled or
    // throttled clock catches up here with presence unchanged.
    window.addEventListener("focus", () => this.processReturn(Date.now()));
    window.addEventListener("beforeunload", () => this.save());
    // The tick timer can outlive its document (a discarded environment, a
    // torn-down test): a dead document is simply not ours to tick.
    window.setInterval(() => {
      if (typeof document === "undefined") return;
      this.tick();
    }, 100);
    // A popover is light furniture: clicking anywhere outside the console's
    // app section dismisses it. The board never dims beneath it (ADR-0012).
    // The dismissal intent is captured on the section itself — the one node
    // no re-render replaces — because a click that re-renders its own
    // target (a chip pick, a tile toggle) detaches that target before this
    // document-level listener reads anything. The clock's Time popover
    // (issue #148) anchors in the session cluster, so clicks inside its
    // clock anchor count as inside too.
    let clickInsideApps = false;
    this.els["console-apps"]?.addEventListener("click", () => {
      clickInsideApps = true;
    }, { capture: true });
    this.els["console-session"]?.addEventListener("click", (event) => {
      if ((event.target as Element | null)?.closest(".clock-anchor")) clickInsideApps = true;
    }, { capture: true });
    document.addEventListener("click", () => {
      // A stale instance's closer must never close — or re-render — a newer
      // instance's board (§1's ownership rule, as the bloom closer below
      // already reads it).
      if (!this.ownsBoard()) return;
      const inside = clickInsideApps;
      clickInsideApps = false;
      if (inside) return;
      if (this.ui.app !== null) this.closeApp();
      else if (this.ui.launcherOpen) this.closeLauncher();
    });
    // The expanded face closes on outside click (§5): the bloom host's
    // capture-phase click drops a token (see the ledger above), and the
    // document-level closer consumes tokens before dismissing anything.
    document.getElementById("module-bloom")?.addEventListener("click", () => {
      this.bloomClickTokens++;
    }, { capture: true });
    document.addEventListener("click", () => {
      if (!this.ownsBoard()) return;
      if (this.bloomClickTokens > 0) {
        this.bloomClickTokens--;
        return;
      }
      // A tray selection (an inventory module) wears no bloom: outside
      // clicks must not fight the armed placement.
      const selected = this.state.modules.find((m) => m.id === this.ui.selected);
      if (this.ui.selected !== null && selected?.pos !== null) {
        this.ui.selected = null;
        this.render();
      }
    });
    // The Forge peek passes pointers to the board. Dismiss outside the card
    // in capture, before a board action can replace the clicked DOM node;
    // the same click still reaches the board for selection or other actions.
    document.addEventListener("click", (event) => {
      if (!this.ownsBoard() || this.ui.modal !== "forge") return;
      if (event.composedPath().includes(this.els["modal-content"]!)) return;
      this.closeModal();
    }, { capture: true });
    // The Esc chain (§5): the modal eats it first; then the armed transient
    // modes unwind; then the expanded face — the selection is its open
    // state. Never while typing.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.ownsBoard()) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      if (this.ui.modal) {
        this.closeModal();
        return;
      }
      if (this.ui.placing) {
        this.cancelPlacing();
        return;
      }
      if (this.ui.buyingCell) {
        this.cancelCellPurchase();
        return;
      }
      // The Mutator layer's Esc walk (issue #199): gesture, then popover,
      // then the layer itself — the tab switch is the walk's last step.
      if (this.ui.mutUnlockArmed || this.ui.mutArmedTray !== null || this.ui.mutMoving !== null) {
        this.mutCancelGestures();
        return;
      }
      if (this.ui.mutPopover) {
        this.ui.mutPopover = null;
        this.render();
        return;
      }
      if (this.ui.mutLayer === "mutators") {
        this.mutSetLayer("modules");
        return;
      }
      if (this.ui.app) {
        this.closeApp();
        return;
      }
      if (this.ui.launcherOpen) {
        this.closeLauncher();
        return;
      }
      if (this.ui.selected) {
        this.ui.selected = null;
        this.render();
      }
    });
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
    });
    document.addEventListener("keyup", (event) => {
      if (event.key !== "Shift" || !this.ownsBoard()) return;
      if (this.ui.faceMax) {
        this.ui.faceMax = false;
        this.render();
      }
    });
    // A shift released while the window lacks focus never fires keyup here:
    // the blur drops the mode so the labels can't stick MAX (issue #195).
    window.addEventListener("blur", () => {
      if (this.ownsBoard() && this.ui.faceMax) {
        this.ui.faceMax = false;
        this.render();
      }
    });
  }

  tick(): void {
    // Recurring goals roll on every tick, not only across flow boundaries:
    // a tab resting in upgrade mode must read the new day's state too —
    // the launcher's Goals entry with it (issue #149). Idempotent with the
    // boundary roll below.
    rollGoalOccurrences(this.state, Date.now());
    this.applyBoundary(Date.now());
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
  private playChime(): void {
    if (this.state.muted) return;
    this.channels.playChime(this.audio);
  }

  // The formation strum (§6): a placement that forms a chord strums it —
  // the drop gesture is the audio unlock, and the global mute silences it.
  // The seams already said it; this is garnish, not information.
  private strumFormedChords(before: readonly NamedChordTerm[]): void {
    if (this.state.muted) return;
    // Same snapshot basis as the caller's `before`, so the diff can't lie
    // if the two calls ever drift apart.
    const newcomers = newChordTerms(before, computeRates(this.state).namedChords);
    if (newcomers.length === 0) return;
    this.audio = this.channels.unlockAudio(this.audio);
    this.channels.playStrum(this.audio, newcomers);
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
        ? `${otherwise}${otherwise ? " " : ""}Achievement unlocked — ${names.join(", ")}.`
        : otherwise,
    );
  }

  // The Enter switch: with a habit selected the session starts directly —
  // the Habit app already made the choice, so the prompt never asks twice.
  // The prompt only opens when no habit is selected (or on a fresh save).
  startFlow(): void {
    if (this.state.mode !== "upgrade") return;
    const habit = activeHabit(this.state);
    if (habit) {
      this.beginFlow(habit.id);
      return;
    }
    this.clearTransientUi();
    // The kind-first selection starts fresh every time the prompt opens.
    this.ui.enter = freshEnterSelection();
    this.ui.modal = "enter";
    this.render();
  }

  beginFlow(habitId: string | null): void {
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
      return;
    }
    this.ui.modal = null;
    this.exitPending = false;
    this.syncBoundaryClock(Date.now());
    this.clearTransientUi();
    // The start gesture is the audio unlock (§4, §10): the session's
    // context is created or resumed here, so the chime can sound later.
    this.audio = this.channels.unlockAudio(this.audio);
    this.signals = freshChimeState();
    this.askNotificationPermissionOnce(this.ui.chosenTarget);
    this.say(
      this.ui.chosenTarget === null
        ? "Flow is live."
        : `Flow is live for ${Math.round(this.ui.chosenTarget / 60)} minutes — the board is locked.`,
    );
    this.save();
    this.render();
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

  // The prompt's create field (§5.5): naming a new practice adds the habit
  // to the Habit app — the first, on a fresh instrument — and starts the
  // session with it selected, so its development accrues from this session.
  beginFlowNewHabit(name: string): void {
    const result = createHabit(this.state, name);
    if (!result.ok || !result.habit) {
      this.say(result.reason ?? "Could not add the habit.");
      this.render();
      return;
    }
    this.beginFlow(result.habit.id);
  }

  endFlow(): void {
    // The exit runs report-first (§8): with the pool outstanding, the
    // honesty report's answer is mandatory and final — the bucket must
    // bank or drop before the summary shows.
    if (this.state.mode !== "upgrade" && poolOutstanding(this.state)) {
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

  buyShelf(type: ShelfType): void {
    // The purchase stays in the catalog: the module lands in inventory and
    // placement happens from Grid & inventory, on the player's beat.
    this.act(buyShelfModule(this.state, type), `${META[SHELF_MODULE[type]].name} purchased — it's in your inventory.`);
  }

  // ── The Arete Catalog (issue #197) ──────────────────────────────────────
  // The sheet purchases and the board-side Row unlock. Every landing goes
  // through the shared act() shape — refusal says why, success saves and
  // re-renders — and every engine action already gates on upgrade mode, so
  // the sheet's buttons and the banner are inert outside it by the same
  // rule.

  buyCatalogEntryAction(): void {
    this.act(buyCatalogEntry(this.state), "Mutator tree entered.");
  }

  joinRollPoolAction(): void {
    this.act(joinRollPool(this.state), "The Mutator Forge joined the module roll pool.");
  }

  buyRowUnlockAction(row: number): void {
    this.act(buyRowUnlock(this.state, row), "Octave row unlocked — its cells now buy with nous.");
  }

  // The first console long goal (ADR-0012 as amended by ADR-0034): goal
  // capacity, one slot per purchase from the Goals panel's compact row.
  buyGoalCapacityAction(): void {
    this.act(buyGoalCapacity(this.state), "One more goal slot.");
  }

  // ── The Mutator layer's gestures (issue #199) ───────────────────────────
  // The tabbed second grid over the board: every landing routes through the
  // engine actions from #198 — unlockMutatorSlot, placeMutator,
  // returnMutator, combineMutators, chooseMutatorRoll — so the UI can never
  // drift from the contracts those tests pin. Upgrade-mode-only: each
  // engine gate owns its refusal, and the renderers simply stop drawing.

  // The tab switch. Switching layers drops every mutator transient together
  // — the gestures are the layer's, they never survive the walk-away.
  mutSetLayer(layer: "modules" | "mutators"): void {
    if (this.ui.mutLayer === layer) return;
    this.mutDisarm();
    this.ui.mutLayer = layer;
    this.render();
  }

  // The transient mutator furniture's one teardown: armed gestures, the
  // popover, and the combine review's leftover offer (the modal itself
  // closes through closeModal). clearTransientUi reads this shape too.
  private mutDisarm(): void {
    this.ui.mutArmedTray = null;
    this.ui.mutUnlockArmed = false;
    this.ui.mutMoving = null;
    this.ui.mutPopover = null;
    this.ui.mutCarrying = null;
    this.ui.mutDropHover = null;
  }

  mutCancelGestures(): void {
    this.mutDisarm();
    this.say("Mutator gesture cancelled.");
    this.render();
  }

  // The Mutator tray's click-then-slot arm (issue #199): the tap-shaped
  // placement — tap a tray tile, tap a slot.
  mutArmTray(id: string): void {
    this.ui.mutPopover = null;
    this.ui.mutUnlockArmed = false;
    this.ui.mutArmedTray = this.ui.mutArmedTray === id ? null : id;
    if (this.ui.mutArmedTray) this.say("Choose a Mutator slot.");
    this.render();
  }

  // The slot unlock's arm (issue #199): one pill carries the price and
  // eligible cells pulse; the click resolution lands in mutPickSlot. The
  // gesture lives on the Mutators layer, so arming walks there first.
  mutArmUnlock(): void {
    if (this.state.mode !== "upgrade") {
      this.say("Arete is spent between sessions.");
      return;
    }
    if (!this.state.catalogEntryOwned) {
      this.say("Enter the Mutator tree first.");
      return;
    }
    this.mutDisarm();
    this.ui.mutLayer = "mutators";
    this.ui.mutUnlockArmed = true;
    this.render();
  }

  // The slot click's one resolution (issue #199): the armed unlock buys,
  // the armed tray item places (an occupied slot swaps, occupant to the
  // tray), the armed move lands on a vacant slot, and an idle click asks
  // the placed mutator's declaration popover.
  mutPickSlot(pos: Hex): void {
    const { state, ui } = this;
    if (state.mode !== "upgrade" || !state.catalogEntryOwned) return;
    const slotted = this.state.mutatorSlots.some((s) => sameHex(s, pos));
    if (!slotted && !ui.mutUnlockArmed) {
      this.say("No Mutator slot there.");
      return;
    }
    if (ui.mutUnlockArmed) {
      const first = state.mutatorSlots.length === 0;
      const result = unlockMutatorSlot(state, pos);
      if (!result.ok) {
        this.say(result.reason ?? "That cell cannot take a Mutator slot.");
        this.render();
        return;
      }
      ui.mutUnlockArmed = false;
      this.say(`Mutator slot unlocked at ${cellNoteOf(pos)}${first ? "" : ` — ${formatInt(state.arete)} Arete left`}.`);
      this.save();
      this.render();
      return;
    }
    if (ui.mutArmedTray !== null) {
      const id = ui.mutArmedTray;
      ui.mutArmedTray = null;
      this.mutPlace(id, pos);
      return;
    }
    if (ui.mutMoving !== null) {
      const id = ui.mutMoving;
      const occupied = mutatorAt(state, pos) !== undefined;
      if (occupied) {
        this.say("That slot is held — drag the mutator onto it to swap or combine.");
        this.render();
        return;
      }
      ui.mutMoving = null;
      this.act(placeMutator(state, id, pos), `Mutator moved to ${cellNoteOf(pos)}.`);
      return;
    }
    const occupant = mutatorAt(state, pos);
    if (occupant) {
      ui.mutPopover = ui.mutPopover === occupant.id ? null : occupant.id;
      this.render();
    }
  }

  // Right-click retrieve (issue #199): the same chord-breaking gesture as
  // the board's, over the second layer.
  mutRightClickSlot(pos: Hex): void {
    if (this.state.mode !== "upgrade") return;
    const occupant = mutatorAt(this.state, pos);
    if (occupant) this.mutRetrieve(occupant.id);
  }

  // The placement landing shared by the click path and the drag release:
  // an occupied slot swaps, the occupant waiting in the Mutator tray (the
  // engine's free-swap rule, mirroring the board's).
  mutPlace(id: string, pos: Hex): void {
    const swap = mutatorAt(this.state, pos) !== undefined;
    this.act(
      placeMutator(this.state, id, pos),
      swap ? `Mutator placed at ${cellNoteOf(pos)} — the previous one waits in the Mutator tray.` : `Mutator placed at ${cellNoteOf(pos)}.`,
    );
  }

  mutRetrieve(id: string): void {
    const family = this.state.mutators.find((m) => m.id === id)?.family;
    this.ui.mutPopover = null;
    this.act(returnMutator(this.state, id), `${family ? FAMILY_WORD[family] : "Mutator"} retrieved to the Mutator tray.`);
  }

  // The popover's two actions (issue #199): retrieve in place, or arm the
  // move that ends on a vacant slot's click.
  mutPopoverRetrieve(): void {
    const id = this.ui.mutPopover;
    if (id) this.mutRetrieve(id);
  }

  mutPopoverMove(): void {
    const id = this.ui.mutPopover;
    this.ui.mutPopover = null;
    if (!id) {
      this.render();
      return;
    }
    this.ui.mutMoving = id;
    this.say("Choose an open Mutator slot.");
    this.render();
  }

  mutClosePopover(): void {
    if (!this.ui.mutPopover) return;
    this.ui.mutPopover = null;
    this.render();
  }

  // The mutator combine offer (issue #199): a matching twin under the drop
  // opens the review before either copy is consumed. Confirm performs the
  // combine; every cancel path lands in closeModal, which drops the offer
  // and leaves both copies untouched.
  mutOfferCombine(dragId: string, targetId: string): void {
    this.ui.mutCombineOffer = { dragId, targetId };
    this.ui.modal = "mutcombine";
    this.render();
  }

  confirmMutCombine(): void {
    const offer = this.ui.mutCombineOffer;
    this.ui.mutCombineOffer = null;
    this.ui.modal = null;
    if (!offer) {
      this.render();
      return;
    }
    const preview = combineMutatorsPreview(this.state, offer.dragId, offer.targetId);
    const result = combineMutators(this.state, offer.dragId, offer.targetId);
    if (!result.ok) {
      this.say(result.reason ?? "Those mutators cannot be combined.");
      this.render();
      return;
    }
    const family = this.state.mutators.find((m) => m.id === preview?.keepId)?.family;
    this.say(`${family ? FAMILY_WORD[family] : "Mutator"} mutator raised to ${preview?.nextRarity ?? "the next rarity"}.`);
    this.save();
    this.render();
  }

  // The mutator roll's choice (issue #199): the chosen candidate mints into
  // the Mutator tray, the unchosen vanishes. The tray lives on the Mutators
  // layer, so the landing says where to find it.
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
    const more = this.state.bankedMutatorRolls.length > 0 ? ` ${this.state.bankedMutatorRolls.length} more ${this.state.bankedMutatorRolls.length === 1 ? "choice" : "choices"} wait in the Mutator Forge.` : "";
    this.say(`${FAMILY_WORD[candidate.family]} mutator minted to the Mutator tray — the Mutators layer holds it.${more}`);
    this.save();
    this.render();
  }

  // The live drop preview over the second layer (issue #199): hover state
  // changes refresh the land registers in place — never a render.
  setMutDropHover(mutatorId: string | null, pos: Hex | null): void {
    this.ui.mutDropHover = mutatorId && pos ? { mutatorId, pos } : null;
    refreshMutPreview(this);
  }

  // Cell purchase (ADR-0013): armed from the toolbar's cell icon (or the
  // catalog row), resolved by clicking a frontier hex. The buy only lands
  // when a frontier cell is clicked; the icon toggles, Esc and right-click
  // cancel.
  armCellPurchase(): void {
    if (this.state.mode !== "upgrade") {
      this.say("Purchases happen between sessions.");
      return;
    }
    this.clearTransientUi();
    this.ui.modal = null;
    this.ui.buyingCell = true;
    this.render();
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
      return;
    }
    this.reportCombine(combine(this.state, offer.dragId, offer.targetId));
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

  select(id: string | null): void {
    const opening = id !== null && this.ui.selected !== id;
    this.ui.selected = this.ui.selected === id ? null : id;
    this.ui.app = null;
    this.ui.placing = null;
    // The click that opens the bloom bubbles to the document-level closer;
    // it drops a token so the same click never closes what it opened (§5).
    if (opening && this.ui.selected !== null) this.bloomClickTokens++;
    this.render();
  }

  openApp(app: FocusApp): void {
    // Locked tiles open nothing (ADR-0012): the tile is inert, greyed, and
    // carries its locknote; no panel, no message. The launch four never
    // lock (ADR-0019), so every launch tile opens from session one — the
    // guard stays for a future ladder tenant.
    if (!appActive(this.state, app)) return;
    this.ui.app = this.ui.app === app ? null : app;
    // One popover at a time (issue #149): opening an app — from a tile, a
    // launcher entry, or the clock — always dismisses the launcher's menu.
    this.ui.launcherOpen = false;
    this.ui.selected = null;
    this.ui.placing = null;
    this.resetHistorySurfaces();
    this.render();
  }

  // The phone launcher (issue #149): one compact control that keeps Habit,
  // Notes, and Goals reachable below the 600px line. Pressing it always
  // means "my menu": any open app popover gives way, and a second press
  // closes. An entry press swaps the menu for that app's panel, anchored
  // beneath the launcher itself.
  launcherActivate(): void {
    // The panel rides closeApp's full teardown — not just the app nulling —
    // so a habit edit or drilled history can't survive the swap into the
    // menu and leak into the panel a later press reopens.
    this.dismissAppPanel();
    this.ui.launcherOpen = !this.ui.launcherOpen;
    this.render();
    // Keyboard callers land inside the menu they asked for; touch callers
    // are unaffected — the first entry is the next tap's neighbor anyway.
    if (this.ui.launcherOpen) document.getElementById("app-launcher-habit")?.focus();
  }

  closeLauncher(): void {
    if (!this.ui.launcherOpen) return;
    this.ui.launcherOpen = false;
    this.render();
  }

  closeApp(): void {
    this.dismissAppPanel();
    this.render();
  }

  // The app popover's teardown without the render: the panel itself plus
  // the panel-internal surfaces a habit edit or history drill leaves
  // behind. Every path that takes the popover away (closeApp, Escape, the
  // click-away closer, the launcher's menu swap) reads this one shape.
  private dismissAppPanel(): void {
    this.ui.app = null;
    this.ui.editingHabitId = null;
    this.resetHistorySurfaces();
  }

  // ── Session history (§9) ────────────────────────────────────────────────

  private resetHistoryUi(): void {
    this.ui.historyOpen = false;
    this.ui.historyLimit = HISTORY_PAGE_ROWS;
    this.ui.drillSession = null;
  }

  // Both history surfaces clear together when the popover swaps apps or
  // closes: the Time list view and the Habit development summary.
  private resetHistorySurfaces(): void {
    this.resetHistoryUi();
    this.ui.summaryHabitId = null;
  }

  // The Time app's history affordance: the panel body swaps to the
  // newest-first record list. One-way in — only the back control leaves it.
  openHistory(): void {
    this.resetHistoryUi();
    this.ui.historyOpen = true;
    this.render();
  }

  // Back past the list itself: the Time panel body returns.
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

  // The Habit app's per-habit development summary: one expanded at a time.
  toggleHabitSummary(id: string): void {
    this.ui.summaryHabitId = this.ui.summaryHabitId === id ? null : id;
    this.render();
  }

  beginPlacing(id: string): void {
    this.ui.selected = id;
    this.ui.app = null;
    this.ui.placing = id;
    this.say("Choose a cell. Occupied modules swap positions.");
    this.render();
  }

  pickCell(pos: Hex): void {
    const { state, ui } = this;
    if (state.mode !== "upgrade") {
      // The board is locked through a session (§5): modules neither expand
      // nor select mid-session — the click answers plainly instead of
      // looking dead. Selection returns between sessions.
      this.say("The board is locked during flow.");
      return;
    }
    // The Mutators layer owns the board's clicks while it stands (issue
    // #199): the module board rests greyed and pointer-dead, and a focused
    // cell's Enter must not reach past it either.
    if (ui.mutLayer === "mutators") return;
    if (ui.buyingCell) {
      // The arm persists across buys: sweep several cells, then back out
      // yourself via the banner's Cancel (or Esc). act() re-renders each
      // time, so the banner hint and hex prices step to the next scaler rung.
      this.act(buyCell(state, pos), "Cell bought.");
      return;
    }
    if (ui.placing) {
      const module = state.modules.find((m) => m.id === ui.placing);
      if (!module) return;
      this.placeAndStrum(module, pos);
      return;
    }
    const occupant = state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
    if (occupant && occupant.id !== ui.selected) {
      this.select(occupant.id);
    } else if (ui.selected !== null) {
      // Outside the bloom (§5) — the vacated cell included: with the bloom
      // standing for the selected module, its own cell renders empty, and
      // clicking it is a dismissal, never a second toggle.
      this.ui.selected = null;
      this.render();
    }
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
  // drag/touch release. A drop never opens the expanded face — and the
  // armed placement carries its module as the selection, so the selection
  // is dropped before the landing renders, never after: the module
  // presents closed. A chord the drop newly forms strums (§6).
  private placeAndStrum(module: ModuleInstance, pos: Hex): void {
    const before = computeRates(this.state).namedChords;
    this.ui.selected = null;
    if (this.act(placeModule(this.state, module.id, pos), `${META[module.type].name} placed.`)) {
      this.ui.placing = null;
      this.strumFormedChords(before);
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
  ): void {
    const result = run();
    if (result.ok) {
      this.say(success);
      this.save();
    } else {
      this.say(result.reason ?? "That habit action is unavailable.");
    }
    this.render();
  }

  createHabitAction(name: string): void {
    this.habitAction(() => createHabit(this.state, name), `${name.trim()} added to your habits.`);
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

  // ── Goals (#6) ──────────────────────────────────────────────────────────

  createGoalAction(habitId: string | null, minutes: number, schedule: "once" | "daily" | "weekly"): void {
    const result = createGoal(this.state, { habitId, minutes, schedule, now: Date.now() });
    if (result.ok) {
      this.save();
      this.say("Goal added.");
    } else {
      this.say(result.reason ?? "Could not create the goal.");
    }
    this.render();
  }

  deleteGoalAction(id: string): void {
    const result = deleteGoal(this.state, id);
    this.say(result.ok ? "Goal removed." : result.reason ?? "Could not remove the goal.");
    if (result.ok) this.save();
    this.render();
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
    const added = this.state.modules[this.state.modules.length - 1]!;
    this.ui.modal = null;
    this.ui.selected = added.id;
    this.ui.placing = added.id;
    const more = this.state.bankedRolls.length > 0 ? ` ${this.state.bankedRolls.length} more choice${this.state.bankedRolls.length === 1 ? "" : "s"} wait in the Forge.` : "";
    this.announceUnlocks(
      result.unlocked,
      `${META[candidate.type].name} added — pick a cell.${more}`,
    );
    this.save();
    this.render();
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
    if (this.ui.mutLayer === "mutators") {
      // The second layer owns the gesture: its own retrieve lives on the
      // slot faces (issue #199).
      this.mutRightClickSlot(pos);
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
  }

  // The opening arc's one pop-up (§8): dismissal is once, ever — the flag
  // persists, so the card never re-fires, this session or any later one.
  dismissArcCard(): void {
    const result = dismissArcCardAction(this.state);
    if (!result.ok) return;
    this.save();
    this.render();
  }

  openModal(kind: ModalKind): void {
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
    this.ui.modal = null;
    this.ui.combineOffer = null;
    this.ui.mutCombineOffer = null;
    this.ui.importError = null;
    this.render();
  }

  // Dev helpers (?dev=1): time-warp and fixtures for hands-on verification only.

  devAdvance(seconds: number): void {
    if (this.state.mode !== "flow") {
      this.say("Dev clock only works during flow.");
      return;
    }
    const result = advance(this.state, seconds);
    this.reportAdvance(result);
    this.say(`Dev clock +${seconds}s.`);
    this.render();
  }

  devToTarget(): void {
    const session = this.state.session;
    if (this.state.mode !== "flow" || !session || session.target === null) {
      this.say("No timed target running.");
      return;
    }
    this.devAdvance(Math.max(0, session.target - session.elapsed));
  }

  devNous(): void {
    // The dev grant produces like flow does, through the one credit seam.
    // It mints nothing — the door opens on the crossing, and Arete still
    // waits for the prestige action.
    earnNous(this.state, 100);
    this.say("Dev: +100 ν.");
    this.render();
  }

  // Dev grant of an additive synthesizer (#137 hands-on): it lands on the
  // first free cell that chords with a deployed synth — a fifth beside the
  // opening board, usually — so seams and the readout read at once. In
  // flow the board stays locked per the standing constraints, so there it
  // lands in the tray to drag into place between sessions.
  devSynth(): void {
    const module = createModule(this.state, "additive", "common");
    this.state.modules.push(module);
    if (this.state.mode !== "upgrade") {
      module.pos = null;
      this.say("Dev: additive synth in your inventory — the board is locked during flow.");
      this.save();
      this.render();
      return;
    }
    const occupied = new Set(this.state.modules.filter((m) => m.pos !== null).map((m) => `${m.pos!.q},${m.pos!.r}`));
    const chordsWith = this.state.modules.filter((m) => m.pos !== null && CATEGORY_OF[m.type] === "synthesizer");
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

  // Dev grant of the whole mutator era (#199 hands-on): the entry, the
  // Mutator Forge in the tray, two slots wearing a combine pair, an inert
  // resonance, a vacant slot, a tray item, and Arete for the ladder.
  devMutatorEra(): void {
    const s = this.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.arete = Math.max(s.arete, 20);
    if (!s.modules.some((m) => m.type === "mutatorForge")) {
      s.modules.push(createModule(s, "mutatorForge", "common"));
    }
    s.mutatorSlots = [hex(0, 0), hex(1, 0), hex(0, 1), hex(1, 1)];
    const item = (family: MutatorFamily, rarity: Rarity, pos: Hex | null): MutatorInstance => ({
      id: `mu-dev-${s.nextId++}`,
      family,
      rarity,
      pos,
    });
    s.mutators = [
      item("power", "common", hex(0, 0)),
      item("power", "common", null),
      item("resonance", "common", hex(1, 1)),
      item("charge", "uncommon", hex(0, 1)),
    ];
    this.ui.mutLayer = "mutators";
    this.say("Dev: mutator era granted — the Mutators layer stands.");
    this.save();
    this.render();
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
    render(this);
    this.syncTitle();
    document.body.classList.toggle("live", this.state.mode === "flow");
    // The second layer's grey (issue #199): while the Mutators tab stands,
    // the stylesheet greys the module board and silences its pointers —
    // the grid renders as the foreground.
    document.body.classList.toggle("mut-layer-live", mutatorLayerLive(this));
  }
}
