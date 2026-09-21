import { advance } from "../engine/advance";
import type { AdvanceResult } from "../engine/types";
import {
  acknowledgeHorizon,
  acknowledgeWelcome,
  buyCell,
  buyGoalCapacity,
  buyShelfModule,
  chooseRoll,
  combine,
  dismissSummary as dismissSessionSummary,
  endSession,
  pauseSession,
  placeModule,
  recordSummaryReflection,
  reshapeCells,
  resumeSession,
  returnModule,
  startSession,
  upgradeModule,
  type ActionResult,
} from "../engine/actions";
import { syncArete } from "../engine/accumulator";
import { adjacent, hexKey, neighbors, sameHex } from "../engine/hex";
import { deserialize, serialize, STORAGE_KEY } from "../engine/save";
import { formatClock } from "../engine/clock";
import { applyGap, flushPendingAway, poolOutstanding, resolveHonestyReport, type HonestyOutcome } from "../engine/trust";
import { createInitialState, isCarrier } from "../engine/state";
import { appActive, type FocusApp } from "../engine/apps";
import { writeNote } from "../engine/notes";
import { achievementName } from "../engine/achievements";
import { BALANCE, SHELF_MODULE, CHIME } from "../engine/constants";
import {
  activeHabit,
  addPracticeLog,
  archiveHabit,
  createHabit,
  renameHabit,
  selectHabit,
} from "../engine/habits";
import { createGoal, deleteGoal, rollGoalOccurrences } from "../engine/goals";
import type { GameState, Hex, ShelfType } from "../engine/types";
import { render } from "./render";
import { resetEnterDraft } from "./modals";
import { HISTORY_PAGE_ROWS, META } from "./meta";
import { browserChannels, type SignalChannels } from "./signals";

// The session modal surfaces (§5.5, §5.7): the enter prompt precedes every
// session; the loud summary follows every one; the honesty report interrupts
// whenever provisional time waits (§1–2).
export type ModalKind =
  | "settings"
  | "store"
  | "forge"
  | "achievements"
  | "export"
  | "import"
  | "reset"
  | "honesty"
  | "enter"
  | "summary"
  | null;

// The enter prompt's kind-first selection (issue #92's decided shape): the
// segmented control decides what kind of session this is before any
// specifics — pick from the habits you have, name a brand-new one, or run
// with no habit attached.
export interface UiState {
  selected: string | null;
  // The focus app whose console popover is open, if any (ADR-0012).
  app: FocusApp | null;
  placing: string | null;
  managing: boolean;
  reshape: { adds: Hex[]; removes: Hex[] } | null;
  // Cell purchase (ADR-0013): armed from the catalog, resolved by clicking a
  // frontier hex. The buy only lands when a frontier cell is clicked.
  buyingCell: boolean;
  modal: ModalKind;
  importError: string | null;
  // The plan the next session starts with (§6): null is open-ended — the
  // resting mode, nothing pushed. The launch apps are free (ADR-0019), so
  // even session one can be planned from here; the affordances stay
  // visible but unpushed. Cross-surface: the console's clock previews it
  // between sessions, so it lives here rather than in the enter modal.
  chosenTarget: number | null;
  editingHabitId: string | null;
  // The chord view (issue #62): display-only highlight of the board's chord
  // terms — chord voices stay lit, everything else dims, pair links and
  // named-chord hulls draw in the chord register. Never affects gameplay.
  showChords: boolean;
  // Session history (§9): the Time app's list view, its page size, and the
  // record drilled into. Light furniture — cleared with the popover.
  historyOpen: boolean;
  historyLimit: number;
  drillSession: number | null;
  // The Habit app's expanded development summary (§9): one habit at a time.
  summaryHabitId: string | null;
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

// The combine say-line: the refund, when the lower copy carried upgrades,
// rides on the plain success sentence.
function combineMessage(result: ActionResult): string {
  return result.refund && result.refund > 0
    ? `Combined into a stronger copy; ${result.refund} ν of the lower copy's upgrades refunded.`
    : "Combined into a stronger copy.";
}

type ParsedSave = LoadedSave | { error: string };

function parseSave(text: string): ParsedSave {
  const result = deserialize(text);
  if (result.error || !result.state) {
    return { error: result.error ?? "unknown error" };
  }
  let savedAt = Date.now();
  try {
    savedAt = (JSON.parse(text) as { savedAt?: number }).savedAt ?? savedAt;
  } catch {
    // keep fallback
  }
  return { state: result.state, savedAt };
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
    placing: null,
    managing: false,
    reshape: null,
    buyingCell: false,
    modal: null,
    importError: null,
    chosenTarget: null,
    editingHabitId: null,
    showChords: false,
    historyOpen: false,
    historyLimit: HISTORY_PAGE_ROWS,
    drillSession: null,
    summaryHabitId: null,
  };
  lastWall: number | null = null;
  // The dual-clock drift baseline at lastWall (§10): its positive steps
  // size slept gaps; a negative step credits its boundary zero.
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
  forgeFlashUntil = 0;
  // Set when the stored save was rejected (e.g. the ADR-0017 v5 clean cut):
  // the message must survive the constructor's greeting.
  private loadNotice: string | null = null;
  private els: Record<string, HTMLElement>;

  // Management mode counts only while the grid is unlocked: entering flow or
  // importing a save clears the flag, but stale values must never linger.
  get managing(): boolean {
    return this.ui.managing && this.state.mode === "upgrade";
  }

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
    this.bindGlobalEvents();
    document.getElementById("manage-banner-done")?.addEventListener("click", () => this.stopManaging());
    document.getElementById("buy-banner-cancel")?.addEventListener("click", () => this.cancelCellPurchase());
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
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // Resumes an in-flow session from a save. One reconcile path (§1): the
  // gap since the last hidden-transition save classifies as away through
  // the trust rules — sleep, tab discard, mid-session reload, and
  // save-import all flow through it; the confirm-or-discard dialog is gone
  // (ADR-0019).
  private resumeFromSave(loaded: LoadedSave): void {
    this.state = loaded.state;
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

  save(now: number = Date.now()): void {
    try {
      localStorage.setItem(STORAGE_KEY, serialize(this.state, now));
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
    this.ui.placing = null;
    this.ui.managing = false;
    this.ui.reshape = null;
    this.ui.buyingCell = false;
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
    this.save();
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
    this.say("A fresh instrument. The Carrier is yours.");
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
      this.say("Welcome. Upgrade the Carrier, then enter flow.");
    } else if (this.state.mode === "flow") {
      this.say("Flow is live.");
    } else {
      this.say("Ready. Arrange, upgrade, enter flow.");
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
        this.processReturn(Date.now());
      }
    });
    // A bfcache restore is a return: the frozen stretch classifies as away.
    window.addEventListener("pageshow", (event) => {
      if (!(event as PageTransitionEvent).persisted) return;
      this.presence = document.visibilityState === "visible";
      this.processReturn(Date.now());
    });
    // Focus loss alone is not away, but focus is a boundary: a stalled or
    // throttled clock catches up here with presence unchanged.
    window.addEventListener("focus", () => this.processReturn(Date.now()));
    window.addEventListener("beforeunload", () => this.save());
    window.setInterval(() => this.tick(), 100);
    // Escape runs one state machine (see escape()); the modal backdrop is
    // the shell's other dismissal gesture. Both absorbed from main.ts so
    // nothing outside App writes UI state.
    document.getElementById("modal")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) this.closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.escape();
    });
    // A popover is light furniture: clicking anywhere outside the console's
    // app section dismisses it. The board never dims beneath it (ADR-0012).
    // The dismissal intent is captured on the section itself — the one node
    // no re-render replaces — because a click that re-renders its own
    // target (a chip pick, a tile toggle) detaches that target before this
    // document-level listener reads anything.
    let clickInsideApps = false;
    this.els["console-apps"]?.addEventListener("click", () => {
      clickInsideApps = true;
    }, { capture: true });
    document.addEventListener("click", () => {
      const inside = clickInsideApps;
      clickInsideApps = false;
      if (this.ui.app === null || inside) return;
      this.closeApp();
    });
    // The chord view's keyboard beat (issue #62): C toggles the highlight.
    // Display only, so it works in every mode — but never while typing.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "c" && event.key !== "C") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      this.toggleChords();
    });
  }

  // The chord view is a reading aid, not a session artifact: it neither
  // clears with the transient interaction modes nor reaches the save.
  toggleChords(): void {
    this.ui.showChords = !this.ui.showChords;
    this.render();
  }

  tick(): void {
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

  private reportAdvance(result: AdvanceResult): void {
    const notes: string[] = [];
    if (result.rollsBanked > 0) {
      notes.push(`${result.rollsBanked} forge ${result.rollsBanked === 1 ? "roll" : "rolls"} banked.`);
      this.forgeFlashUntil = Date.now() + 900;
    }
    if (result.goalsCompleted > 0) notes.push(`${result.goalsCompleted} goal${result.goalsCompleted === 1 ? "" : "s"} completed.`);
    if (result.areteMinted > 0) notes.push("Arete minted.");
    if (notes.length > 0) this.say(notes.join(" "));
  }

  // The action tail: every engine action funnels through here — run the
  // call, speak success or failure, save on success, render, return ok.
  // Guards and UI mutations stay in the owning action method (or its thunk);
  // the engine's ActionResult remains facts-only, so this module owns the
  // say-line's copy.
  private perform<T extends ActionResult>(
    run: () => T,
    message: string | ((result: T) => string),
    fallback = "That action is not available.",
  ): boolean {
    const result = run();
    if (result.ok) {
      const text = typeof message === "function" ? message(result) : message;
      this.announceUnlocks(result.unlocked, text);
      this.save();
    } else {
      this.say(result.reason ?? fallback);
    }
    this.render();
    return result.ok;
  }

  // The upgrade-mode toast (ADR-0015): newly unlocked feats add onto the
  // action's own message, and point at the trophy list's home. In-session
  // unlocks never reach here — they queue into the session's summary row
  // instead, so the filter below is a belt-and-braces.
  private announceUnlocks(ids: string[] | undefined, otherwise: string): void {
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
    resetEnterDraft();
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
    if (this.perform(() => pauseSession(this.state), "Paused.")) {
      this.lastWall = null;
      // Pausing silences the overrun chime immediately (§4); it never
      // un-silences, since a visible resume acknowledges anyway.
      this.signals.acknowledged = true;
    }
  }

  resume(): void {
    if (this.perform(() => resumeSession(this.state), "Flow resumed.")) {
      this.syncBoundaryClock(Date.now());
    }
  }

  // The reserved prestige button (ADR-0015): inert at launch — pressing
  // only acknowledges the horizon, and the flag stays detectable.
  acknowledgeHorizon(): void {
    this.perform(() => acknowledgeHorizon(this.state), "Horizon acknowledged.");
  }

  // The one-time welcome card (§5.1): acknowledging it — via its CTA or the
  // dismiss — is one-time; the save keeps the flag. The CTA is the Carrier's
  // upgrade button for beat one: it spends the grant on the spot, so the
  // carrier term bumps and the balance returns to zero in one click. If the
  // upgrade cannot go through (an older save's balance, say), the Carrier is
  // still selected so the player lands on its upgrade panel.
  ackWelcomeToCarrier(): void {
    acknowledgeWelcome(this.state);
    const carrier = this.state.modules.find(isCarrier);
    this.save(); // the ack is one-time whether or not the upgrade lands
    if (!carrier) {
      this.render();
      return;
    }
    this.ui.selected = carrier.id;
    this.ui.app = null;
    this.ui.placing = null;
    this.upgrade(carrier.id);
  }

  dismissWelcome(): void {
    acknowledgeWelcome(this.state);
    this.say("Welcome dismissed.");
    this.save();
    this.render();
  }

  buyShelf(type: ShelfType): void {
    // The purchase stays in the catalog: the module lands in inventory and
    // placement happens from Grid & inventory, on the player's beat.
    this.perform(() => buyShelfModule(this.state, type), `${META[SHELF_MODULE[type]].name} purchased — it's in your inventory.`);
  }

  // The first console long goal (ADR-0012): goal capacity, one beat at a
  // time from the Goals panel's dashed strip.
  buyGoalCapacityAction(): void {
    this.perform(() => buyGoalCapacity(this.state), `Goal capacity +${BALANCE.goalSlotsPerLongGoal} slots.`);
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

  upgrade(id: string): void {
    const module = this.state.modules.find((m) => m.id === id);
    if (!module) return;
    const nextLevel = module.level + 1;
    this.perform(() => upgradeModule(this.state, id), `${META[module.type].name} upgraded to level ${nextLevel}.`);
  }

  combinePair(id: string): void {
    this.perform(() => combine(this.state, id), combineMessage, "Cannot combine.");
  }

  // Drag-to-combine: dropping a module onto a same-type, same-rarity twin.
  // The survivor lands on the drop cell so the merge reads physically.
  dropCombine(id: string, partnerId: string, pos: Hex): void {
    const a = this.state.modules.find((m) => m.id === id);
    const b = this.state.modules.find((m) => m.id === partnerId);
    if (!a || !b) return;
    this.perform(
      () => {
        const result = combine(this.state, id, partnerId);
        if (result.ok) {
          // combine() keeps the higher-level input (ties keep `id`); land it
          // here.
          const keeperId = b.level > a.level ? b.id : a.id;
          const keeper = this.state.modules.find((m) => m.id === keeperId);
          if (keeper) keeper.pos = pos;
        }
        return result;
      },
      combineMessage,
      "Cannot combine.",
    );
  }

  select(id: string | null): void {
    this.ui.selected = this.ui.selected === id ? null : id;
    this.ui.app = null;
    this.ui.placing = null;
    this.render();
  }

  openApp(app: FocusApp): void {
    // Locked tiles open nothing (ADR-0012): the tile is inert, greyed, and
    // carries its locknote; no panel, no message. The launch four never
    // lock (ADR-0019), so every launch tile opens from session one — the
    // guard stays for a future ladder tenant.
    if (!appActive(this.state, app)) return;
    this.ui.app = this.ui.app === app ? null : app;
    this.ui.selected = null;
    this.ui.placing = null;
    this.resetHistorySurfaces();
    this.render();
  }

  closeApp(): void {
    this.ui.app = null;
    this.ui.editingHabitId = null;
    this.resetHistorySurfaces();
    this.render();
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
      const occupant = state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
      if (occupant) this.select(occupant.id);
      return;
    }
    if (ui.reshape) {
      this.stageReshape(pos);
      return;
    }
    if (ui.buyingCell) {
      // The arm persists across buys: sweep several cells, then back out
      // yourself via the banner's Cancel (or Esc). perform() re-renders each
      // time, so the banner hint and hex prices step to the next scaler rung.
      this.perform(() => buyCell(state, pos), "Cell bought.");
      return;
    }
    if (ui.placing) {
      const module = state.modules.find((m) => m.id === ui.placing);
      if (!module) return;
      const result = placeModule(state, module.id, pos);
      if (this.perform(() => result, `${META[module.type].name} placed.`)) {
        ui.placing = null;
      }
      return;
    }
    const occupant = state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
    if (occupant) this.select(occupant.id);
  }

  pickCellThenPlace(id: string, pos: Hex): void {
    const { state } = this;
    if (state.mode !== "upgrade" || this.ui.reshape || this.ui.buyingCell) return;
    const module = state.modules.find((m) => m.id === id);
    if (!module) return;
    this.ui.placing = null;
    this.perform(() => placeModule(state, id, pos), `${META[module.type].name} placed.`);
  }

  returnToInventory(id: string): void {
    this.perform(() => returnModule(this.state, id), "Returned to inventory.");
  }

  addNote(text: string): void {
    this.perform(() => writeNote(this.state, text, Date.now()), "Noted.", "Cannot capture a note right now.");
  }

  // ── Habits (#5) ─────────────────────────────────────────────────────────

  createHabitAction(name: string): void {
    this.perform(() => createHabit(this.state, name), `${name.trim()} added to your habits.`, "That habit action is unavailable.");
  }

  renameHabitAction(id: string, name: string): void {
    this.ui.editingHabitId = null;
    this.perform(() => renameHabit(this.state, id, name), "Habit renamed.", "That habit action is unavailable.");
  }

  archiveHabitAction(id: string): void {
    const habit = this.state.habits.find((h) => h.id === id);
    this.perform(() => archiveHabit(this.state, id), `${habit?.name ?? "Habit"} archived.`, "That habit action is unavailable.");
  }

  selectHabitAction(id: string | null): void {
    // Clicking the already-active habit clears the selection, so unstructured
    // practice is always one click away.
    const togglingOff = id !== null && this.state.activeHabitId === id;
    const target = togglingOff ? null : id;
    const habit = this.state.habits.find((h) => h.id === target);
    this.perform(
      () => selectHabit(this.state, target),
      togglingOff ? "No habit selected." : habit ? `${habit.name} selected.` : "No habit selected.",
      "That habit action is unavailable.",
    );
  }

  logPracticeAction(minutes: number): void {
    const habit = activeHabit(this.state);
    if (!habit) {
      this.say("Select a habit first; logs apply to the active habit.");
      this.render();
      return;
    }
    this.perform(
      () => addPracticeLog(this.state, habit.id, minutes, Date.now()),
      (result) => {
        const goalNote =
          result.completions && result.completions > 0
            ? ` A goal completed.`
            : "";
        return `Logged ${minutes} min of ${habit.name}.${goalNote}`;
      },
      "Could not log practice.",
    );
  }

  // ── Goals (#6) ──────────────────────────────────────────────────────────

  createGoalAction(habitId: string | null, minutes: number, schedule: "once" | "daily" | "weekly"): void {
    this.perform(() => createGoal(this.state, { habitId, minutes, schedule, now: Date.now() }), "Goal added.", "Could not create the goal.");
  }

  deleteGoalAction(id: string): void {
    this.perform(() => deleteGoal(this.state, id), "Goal removed.", "Could not remove the goal.");
  }

  chooseCandidate(offerId: string, candidateId: string): void {
    const offer = this.state.bankedRolls.find((o) => o.id === offerId);
    const candidate = offer?.candidates.find((c) => c.id === candidateId);
    if (!candidate) return;
    this.perform(
      () => {
        const result = chooseRoll(this.state, offerId, candidateId);
        if (result.ok) {
          const added = this.state.modules[this.state.modules.length - 1]!;
          this.ui.modal = null;
          this.ui.managing = true;
          this.ui.reshape = null;
          this.ui.selected = added.id;
          this.ui.placing = added.id;
        }
        return result;
      },
      () => {
        const rolls = this.state.bankedRolls.length;
        const more = rolls > 0 ? ` ${rolls} more choice${rolls === 1 ? "" : "s"} wait in the Forge.` : "";
        return `${META[candidate.type].name} added — pick a cell.${more}`;
      },
      "That roll cannot be taken.",
    );
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
    if (this.ui.reshape) return;
    if (this.ui.buyingCell) {
      this.cancelCellPurchase();
      return;
    }
    if (this.ui.placing) {
      this.cancelPlacing();
      return;
    }
    if (this.ui.managing) {
      const occupant = this.state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
      if (occupant) this.returnToInventory(occupant.id);
    }
  }

  startManaging(): void {
    this.clearTransientUi();
    this.ui.managing = true;
    this.say("Arranging — drag tiles. Esc or Done finishes.");
    this.render();
  }

  stopManaging(): void {
    this.ui.managing = false;
    this.ui.placing = null;
    this.ui.reshape = null;
    this.render();
  }

  startReshape(): void {
    this.ui.reshape = { adds: [], removes: [] };
    this.ui.placing = null;
    this.ui.buyingCell = false;
    this.say("Reshape — removals and additions must balance.");
    this.render();
  }

  stageReshape(pos: Hex): void {
    const stage = this.ui.reshape;
    if (!stage) return;
    const inAdds = stage.adds.findIndex((c) => sameHex(c, pos));
    const inRemoves = stage.removes.findIndex((c) => sameHex(c, pos));
    if (inAdds !== -1) {
      stage.adds.splice(inAdds, 1);
    } else if (inRemoves !== -1) {
      stage.removes.splice(inRemoves, 1);
    } else if (this.state.cells.some((c) => sameHex(c, pos))) {
      const occupied = this.state.modules.some((m) => m.pos !== null && sameHex(m.pos, pos));
      if (occupied) {
        this.say("Only empty cells can be removed.");
        return;
      }
      stage.removes.push(pos);
    } else if (this.state.cells.some((c) => adjacent(c, pos)) || stage.adds.some((c) => adjacent(c, pos))) {
      stage.adds.push(pos);
    }
    this.render();
  }

  private stagedCells(): Hex[] | null {
    const stage = this.ui.reshape;
    if (!stage) return null;
    return this.state.cells
      .filter((c) => !stage.removes.some((r) => sameHex(r, c)))
      .concat(stage.adds);
  }

  reshapeValidity(): { ok: boolean; message: string } {
    const stage = this.ui.reshape;
    if (!stage) return { ok: false, message: "" };
    if (stage.adds.length === 0 && stage.removes.length === 0) {
      return { ok: false, message: "Click cells to stage removals and additions." };
    }
    if (stage.adds.length !== stage.removes.length) {
      return { ok: false, message: `Unbalanced: −${stage.removes.length} removed, +${stage.adds.length} added.` };
    }
    const next = this.stagedCells();
    if (!next) return { ok: false, message: "" };
    const keys = new Set(next.map(hexKey));
    if (keys.size !== next.length) return { ok: false, message: "Duplicate cells staged." };
    const probe = structuredClone(this.state);
    const result = reshapeCells(probe, next);
    if (!result.ok) return { ok: false, message: result.reason ?? "Invalid shape." };
    return { ok: true, message: "Shape is valid and connected." };
  }

  applyReshape(): void {
    const next = this.stagedCells();
    if (!next) return;
    if (this.perform(() => reshapeCells(this.state, next), "Board reshaped. Modules keep their positions.")) {
      this.ui.reshape = null;
    }
  }

  cancelReshape(): void {
    this.ui.reshape = null;
    this.render();
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
    this.say(
      (outcome === "missed"
        ? "Report settled — the held nous dropped."
        : "Report settled — the held nous banked.") + goalNote,
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

  openModal(kind: ModalKind): void {
    this.ui.modal = kind;
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
    this.ui.importError = null;
    this.render();
  }

  // The plan the next session starts with (§6): the one write gate for the
  // chosen target — the enter modal's and the Time popover's affordances
  // both fire it. Null is open-ended.
  planTarget(target: number | null): void {
    this.ui.chosenTarget = target;
    this.render();
  }

  // Region-local view state changed (the enter draft, the catalog toggle):
  // the one legitimate ask for a fresh render pass without a state write.
  refreshView(): void {
    this.render();
  }

  // One Escape state machine (absorbed from main.ts): modal → placing →
  // armed cell buy → arranging → app popover → selection.
  escape(): void {
    if (this.ui.modal) {
      this.closeModal();
      return;
    }
    if (this.ui.placing) {
      this.cancelPlacing();
    } else if (this.ui.buyingCell) {
      this.cancelCellPurchase();
    } else if (this.managing) {
      this.stopManaging();
    } else if (this.ui.app) {
      this.closeApp();
    } else if (this.ui.selected) {
      this.ui.selected = null;
      this.render();
    }
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
    this.state.nous += 100;
    this.state.totalEarned += 100;
    const minted = syncArete(this.state);
    this.say(minted > 0 ? "Dev: +100 ν. The accumulator filled — Arete minted." : "Dev: +100 ν.");
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
  // app sound, including the chime's hidden re-fires.
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
    // Arranging is unmistakable: the body-level class drives the banner,
    // dimmed cells, and raised tiles. It can only be on while the grid is
    // unlocked.
    document.body.classList.toggle("managing", this.managing);
  }
}
