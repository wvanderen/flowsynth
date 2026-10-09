// The Focus control sheet (ADR-0050, issues #249/#255): one frame behind the
// console's doors — the clock, the Habit and Goals tiles — carrying the
// PLAN / HABIT / GOALS / HISTORY faces in the ruled folio presentation.
// Clipped plate, hairline-rule rows, names lead, figures right-aligned mono,
// deeper mechanics in the tooltip layer, no expandable detail sections.
//
// The flow-mode rule: reads live, capture freely, mutate nothing. During a
// session the PLAN face becomes the running read (live elapsed, End flow
// mirroring the main switch, targets visibly disabled); habit add/log and
// goal create/delete lock — the engine's own upgrade-mode gates answer any
// stray landing, and the sheet stops drawing the controls at all.
//
// FocusApp ids keep their meaning (habit / time / notes / goals): the sheet
// is presentational, and `ui.app` still names which app's face stands —
// time → PLAN, habit → HABIT, goals → GOALS, and the time app's history
// surfaces are the HISTORY face. Notes wears the same frame as its own
// CAPTURE | LOGGED sheet (#277), sharing the helpers at the bottom of this
// file.

import type { App } from "./app";
import { displayedRates, longGoalCost, wholeNous } from "../engine/economy";
import { formatClock, formatDuration } from "../engine/clock";
import {
  habitPracticeSummary,
  habitRecordName,
  habitTaggedNotes,
  recordMissed,
  recordTargetHit,
  sessionRecordsNewestFirst,
} from "../engine/records";
import {
  buildNodeEffect,
  buildUnlocksFor,
  BUILD_NODES,
  BUILD_MILESTONE_SECONDS,
  equipSlotsFor,
  equippedNodes,
} from "../engine/builds";
import { activeHabit } from "../engine/habits";
import { isInFlowNote } from "../engine/notes";
import { achievementName } from "../engine/achievements";
import { goalCapacity, goalRequiredSeconds, goalSummary, goalTrackerState, type GoalTrackerState } from "../engine/goals";
import type { GameState, Goal, Habit, HonestyEvent, HonestyOutcome, NoteEntry } from "../engine/types";

// The tracker word set (issue #149): the Goals-state read's one vocabulary —
// the sheet head wears it, and nothing phone-side does (ADR-0033 amended).
const GOAL_TRACKER_WORDS: Record<GoalTrackerState, string> = {
  none: "none tracked",
  open: "in progress",
  complete: "all complete",
};
import {
  PLAN_MIN_MINUTES,
  PLAN_MAX_MINUTES,
  PLAN_PRESET_MINUTES,
  HISTORY_PAGE_ROWS,
} from "./meta";
import {
  formatDate,
  formatInt,
  formatNumber,
  formatPracticeMinutes,
  practiceCountdown,
  secondsToMinutes,
} from "./format";
import { REFLECTION_SLIDER_NEUTRAL } from "../engine/constants";
import { wireTooltips } from "./instrument";

// The sheet's faces. HISTORY is the time app's history surfaces lifted to a
// face of their own — the facetab is its affordance, the drill rides inside.
export type FocusFace = "plan" | "habit" | "goals" | "history";

// The face the sheet shows right now, derived from the open app — no second
// source of truth to drift.
export function focusFaceOf(app: App): FocusFace {
  const { ui } = app;
  if (ui.app === "habit") return "habit";
  if (ui.app === "goals") return "goals";
  if (ui.app === "time" && ui.historyOpen) return "history";
  return "plan";
}

/* ── Shared console-clock plan reads ───────────────── */

// The unplanned shape's two words (§6): the clock slot only ever holds clock
// text, so an unplanned plan wears a dash placeholder there, while captions
// name the mode itself.
export const CLOCK_PLACEHOLDER = "--:--";
export const OPEN_ENDED_WORD = "open-ended";

// The in-place patchers' one text write: touch the node only when its
// content actually changes (#115).
export function setText(node: Element | null | undefined, text: string): void {
  if (node && node.textContent !== text) node.textContent = text;
}

// The upgrade-mode console clock's plan texts (#114, #115): the slot only
// ever holds clock text, so a plan change swaps the two text nodes in place
// — the clock button itself never leaves the DOM.
export function refreshConsoleClockPlan(app: App): void {
  if (app.state.mode !== "upgrade") return;
  const chosen = app.ui.chosenTarget;
  const time = chosen !== null ? formatClock(chosen) : CLOCK_PLACEHOLDER;
  const word = chosen !== null ? "planned" : OPEN_ENDED_WORD;
  const clock = document.querySelector("#console-session .session-clock");
  setText(clock, time);
  const caption = document.querySelector("#console-session .clock-caption");
  setText(caption, word);
}

// The plan mode's caption word, shared by the planner markup and its
// in-place patcher so the two can never drift.
export function planCaptionWord(open: boolean): string {
  return open ? "Open-ended" : "Planned practice";
}

// The running-session caption shared by the console clock block and the
// sheet's running read (§2.2). Every running state names itself — paused,
// open-ended, the overrun it counts, or what remains of the plan.
export function sessionCaption(elapsed: number, target: number | null, paused: boolean): string {
  const reached = target !== null && elapsed >= target;
  return paused ? "paused" : target === null ? OPEN_ENDED_WORD : reached ? "overrun" : `of ${formatClock(target)}`;
}

/* ── The banner bars' derivation (edge states, ADR-0050) ── */

// The goal-progress bars the focus banner shows, derived entirely from
// existing state: in-progress goals first, nearest complete first, completed
// occurrences filling the remaining slots, with a +N count for the goals
// past the bar budget. Nothing here reads or writes a new persisted key —
// the derivation is the whole edge state.
export interface GoalBarRead {
  fraction: number;
  done: boolean;
}

export const BANNER_BARS = 3;

export function goalBarsOf(state: GameState, max: number = BANNER_BARS): { bars: GoalBarRead[]; overflow: number } {
  const reads = state.goals.map((goal) => {
    const required = goalRequiredSeconds(goal);
    return {
      fraction: required > 0 ? Math.min(1, goal.progressSeconds / required) : 1,
      done: goal.completed,
    };
  });
  // In-progress goals lead, nearest completion first; completed occurrences
  // fill whatever slots remain, creation order kept.
  const open = reads.filter((read) => !read.done).sort((a, b) => b.fraction - a.fraction);
  const done = reads.filter((read) => read.done);
  const ordered = [...open, ...done];
  return {
    bars: ordered.slice(0, max).map(({ fraction, done: isDone }) => ({ fraction, done: isDone })),
    overflow: Math.max(0, ordered.length - max),
  };
}

/* ── The sheet's rebuild signature ─────────────────── */

// Everything the sheet shows, hashed. The chosen plan is deliberately
// absent (#115): a plan pick patches state in place instead of rebuilding —
// the open sheet, its focus, and its scroll all survive. Live figures
// (elapsed, habit seconds, goal progress) ride the patcher below, never the
// key.
export function focusSheetKey(app: App): string {
  const { state, ui } = app;
  return JSON.stringify([
    ui.app,
    ui.focusForm,
    state.mode,
    ui.historyOpen,
    ui.drillSession,
    ui.historyLimit,
    ui.detailHabitId,
    ui.editingHabitId,
    state.activeHabitId,
    state.habits.map((h) => `${h.archived ? "·" : ""}${h.name}:${buildUnlocksFor(h.seconds)}:${h.build.join(",")}`).join("|"),
    state.goals
      .map((g) => `${g.completed ? 1 : 0}${g.condition.minutes}${g.condition.habitId ?? ""}${g.schedule.kind}${g.completedCount}`)
      .join("|"),
    state.goalCapacityBought,
    state.sessionRecords.length,
  ]);
}

/* ── Markup helpers ────────────────────────────────── */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function stat(label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono">${value}</span></div>`;
}

// The tooltip layer's one shape: the ⓘ trigger carries the deeper mechanics,
// hover / focus / touch each open it, Escape or a tap-away dismisses.
function tipHtml(id: string, label: string, body: string): string {
  return `<span class="inst-tip"><button class="inst-tip-trigger" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="${escapeHtml(label)}">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${body}</span></span>`;
}

// The folio key as its own tooltip trigger (the RATE row's shape): the
// condensed key opens the mechanics, chrome reset.
function keyTip(id: string, label: string, key: string, body: string): string {
  return `<span class="folio-key inst-tip"><button class="folio-key-tip inst-tip-trigger" type="button" aria-expanded="false" aria-describedby="${id}" aria-label="${escapeHtml(label)}">${escapeHtml(key)}&nbsp;<span aria-hidden="true">ⓘ</span></button><span class="inst-tip-body" id="${id}" role="tooltip">${body}</span></span>`;
}

// The note stamp both note surfaces share (§9): the date where known, then
// the in-session mark — or the between-sessions marker when the note was
// written outside any session.
export function noteStampHtml(note: NoteEntry): string {
  return `${note.at > 0 ? `${formatDate(note.at)} · ` : ""}${
    isInFlowNote(note) ? `S${note.sessionId} · ${formatClock(note.atElapsed)}` : "between sessions"
  }`;
}

// One voice for both honesty surfaces (§2, §8–9): the report's option
// labels and the summary's factual event lines phrase each outcome the same
// way, so the report's promise and the summary's record can never drift.
export const OUTCOME_PHRASES: Record<HonestyOutcome, string> = {
  missed: "didn't practice",
  planned: "did what I planned",
  full: "practiced the whole time away",
};

export const outcomeLabel = (outcome: HonestyOutcome): string => {
  const phrase = OUTCOME_PHRASES[outcome];
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

// The honesty event's neutral factual line (§8–9), the history list's
// format: accounting, not judgment — "22 min away · didn't practice".
export function honestyEventLine(event: HonestyEvent): string {
  return `${secondsToMinutes(event.awaySeconds)} min away · ${OUTCOME_PHRASES[event.outcome]}`;
}

/* ── The PLAN face ─────────────────────────────────── */

// The plan read shared by the ready line and its patcher: what the next
// session would run to — `20:00 planned` or `open-ended` — derived from
// `chosenTarget` alone, so the open-ended fallback needs no key of its own.
function planReadWord(chosen: number | null): string {
  return chosen !== null ? `${formatClock(chosen)} planned` : "open-ended";
}

function goalsTrackedRead(state: GameState): string {
  const count = state.goals.length;
  return count === 1 ? "1 goal tracked" : `${count} goals tracked`;
}

// The planned-target affordances (§6) as ruled folio rows: preset chips,
// free 1–90 minute entry in one-minute steps — and open-ended as its own
// mode, never a duration choice. They ride the very first start (ADR-0019),
// visible but unpushed: the resting plan is open-ended, and only a picked
// plan ever arms the target signals (§4).
function planRowsHtml(app: App, live: boolean): string {
  const open = app.ui.chosenTarget === null;
  const chosen = app.ui.chosenTarget;
  const minutes = chosen === null ? null : Math.round(chosen / 60);
  return `<div class="folio-rows focus-plan" role="group" aria-label="Planned session length">
    <div class="folio-row focus-plan-chips">
      ${PLAN_PRESET_MINUTES.map(
        (option) =>
          `<button class="plan-chip${minutes === option ? " active" : ""}" data-plan="${option}" aria-pressed="${minutes === option}"${live ? " disabled" : ""}>${option}</button>`,
      ).join("")}
    </div>
    <div class="folio-row">
      <span class="folio-key">Custom</span>
      <span class="folio-main focus-plan-free">
        <span class="plan-free">
          <input type="number" id="plan-minutes" min="${PLAN_MIN_MINUTES}" max="${PLAN_MAX_MINUTES}" step="1" placeholder="1–90"
            value="${minutes ?? ""}" ${open || live ? "disabled" : ""} aria-label="Custom session length, 1 to 90 minutes" />
          <span class="plan-unit">min</span>
        </span>
        <button id="plan-open" class="plan-open${open ? " active" : ""}" aria-pressed="${open}"${live ? " disabled" : ""}>Open-ended</button>
      </span>
    </div>
    <div class="folio-row">
      ${keyTip(
        "focus-plan-tip",
        "Planned practice — what the target arms",
        "Planned practice",
        "The chime, a notification and the tab title fire at the target. Past it, presence keeps banking and away time turns provisional.",
      )}
      <span class="folio-main"><span class="folio-fig mono" id="focus-plan-figure">${chosen !== null ? formatClock(chosen) : "—"}</span><span class="folio-sub" id="focus-plan-word">${open ? planCaptionWord(true) : ""}</span></span>
    </div>
  </div>`;
}

// The habits' shared option run — the plan's session-habit select and the
// goal create form pick from the same roster, so one spelling serves both.
function habitChoices(state: GameState): string {
  return state.habits
    .filter((h) => !h.archived)
    .map((h) => `<option value="${h.id}">${escapeHtml(h.name)}</option>`)
    .join("");
}

// The PLAN face. Upgrade mode: the ready readout, the session habit, and
// the plan affordances — the enter confirmation's home (#280, the main
// switch's confirmation path). Flow: the running read — live elapsed, End
// flow mirroring the main switch, targets visibly disabled.
function planFaceHtml(app: App): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  if (upgrade) {
    const habit = activeHabit(state);
    const habitOptions = habitChoices(state);
    return `<div class="focus-enter">
      <span class="focus-enter-read">
        <span class="focus-ready t-condensed">${habit ? `Ready · ${escapeHtml(habit.name)}` : "Ready"}</span>
        <span class="focus-enter-sub mono" id="focus-plan-read">${planReadWord(ui.chosenTarget)} · ${goalsTrackedRead(state)}</span>
      </span>
      <button class="switch-in" id="focus-enter">Enter flow</button>
    </div>
    <div class="folio-rows">
      <div class="folio-row">
        ${keyTip("focus-habit-tip", "Session habit", "Session habit", "The practice this session credits — or none for unstructured practice.")}
        <span class="folio-main"><select id="focus-habit-select" aria-label="Session habit"><option value="">none selected</option>${habitOptions}</select></span>
      </div>
    </div>
    ${planRowsHtml(app, false)}`;
  }
  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const target = session?.target ?? null;
  const paused = state.mode === "paused";
  const habit = activeHabit(state);
  return `<div class="focus-enter">
    <span class="focus-enter-read">
      <span class="focus-ready t-condensed">${habit ? escapeHtml(habit.name) : "Unstructured practice"}</span>
      <span class="focus-enter-sub mono">session ${state.sessionsCompleted + 1}</span>
    </span>
    <button class="switch-in" id="focus-end">End flow</button>  </div>
    <div class="folio-rows">
      <div class="folio-row">
        <span class="folio-key">Session</span>
        <span class="folio-main"><span class="folio-fig mono" data-live="focus-elapsed">${formatClock(elapsed)}</span><span class="folio-sub" data-live="focus-caption">${sessionCaption(elapsed, target, paused)}</span></span>
      </div>
    </div>
  ${planRowsHtml(app, true)}`;
}

/* ── The HABIT face ────────────────────────────────── */

// The figure-led habit list (§9, #255): each row leads with its figures —
// lifetime practice, sessions — then the name, wearing the active dot, and
// drills into the development detail. Rename and archive live in the detail
// head, not the rows.
function habitLedgerRowHtml(app: App, habit: Habit): string {
  const { state } = app;
  const { sessions } = habitPracticeSummary(state, habit.id);
  const active = state.activeHabitId === habit.id;
  return `<button class="folio-row habit-ledger-row" data-drill-habit="${habit.id}" title="Open ${escapeHtml(habit.name)}">
    <span class="folio-fig mono" data-habit-seconds="${habit.id}">${formatDuration(habit.seconds)}</span>
    <span class="folio-fig mono folio-dim">${sessions}×</span>
    <span class="habit-ledger-name">${escapeHtml(habit.name)}</span>
    <span class="habit-dot${active ? " on" : ""}" role="img" aria-label="${active ? "active habit" : "not active"}"></span>
    <span class="habit-ledger-arrow mono" aria-hidden="true">→</span>
  </button>`;
}

// The habit build (ADR-0046): the shared catalog read against the habit's
// own practice time — equipped nodes first (a click unequips; the respec is
// free), then the unlocked-unequipped, then the locked rungs with the
// milestone each still owes. Equipping is upgrade-mode only and counts
// against the slot ladder; the effects apply only while this habit is the
// session's active habit.
function habitBuildHtml(app: App, habit: Habit): string {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  const slots = equipSlotsFor(habit.seconds);
  const equipped = equippedNodes(habit);
  const rows = BUILD_NODES.map((node) => {
    const milestoneSeconds = BUILD_MILESTONE_SECONDS[node.milestone]!;
    const equippedIndex = habit.build.indexOf(node.id);
    const stackNote = node.stacking ? " · stacks" : "";
    if (habit.seconds >= milestoneSeconds) {
      const isEquipped = equippedIndex >= 0;
      const title = isEquipped
        ? `Unequip ${node.name} — respec is free`
        : upgrade
          ? equipped.length < slots
            ? `Equip ${node.name} — respec is free`
            : `No slot free — ${slots} equipped; unequip one first`
          : "The build is read-only during flow";
      return `<button class="build-node${isEquipped ? " equipped" : ""}" data-${isEquipped ? "unequip" : "equip"}="${node.id}" data-habit="${habit.id}" title="${title}">
          <span class="build-node-mark mono" aria-hidden="true">${isEquipped ? equippedIndex + 1 : "+"}</span>
          <span class="build-node-name">${escapeHtml(node.name)}<small>${escapeHtml(buildNodeEffect(node))}${stackNote}</small></span>
        </button>`;
    }
    return `<div class="build-node locked" title="Unlocks at ${formatDuration(milestoneSeconds)} of practice on this habit">
        <span class="build-node-mark mono" aria-hidden="true">·</span>
        <span class="build-node-name">${escapeHtml(node.name)}<small>unlocks at ${formatDuration(milestoneSeconds)} · ${escapeHtml(buildNodeEffect(node))}</small></span>
      </div>`;
  }).join("");
  return `<div class="habit-build">
    <span class="eyebrow">BUILD</span>
    <p class="small muted mono">${equipped.length}/${slots} slots · effects only while this habit is active</p>
    <div class="build-nodes">${rows}</div>
  </div>`;
}

// The development detail (§9): lifetime practice (the development total),
// sessions practiced and last practiced — aggregates off the practice log,
// live sessions and manual logs together — the habit's build (ADR-0046),
// and the habit's tagged notes beneath, newest first, each with its date
// and in-session stamp.
function habitDetailBodyHtml(app: App, habit: Habit): string {
  const { state } = app;
  const { sessions, lastPracticed } = habitPracticeSummary(state, habit.id);
  const notes = habitTaggedNotes(state, habit.id);
  const noteRows = notes
    .map((note) => `<div class="note-entry"><span class="note-when mono">${noteStampHtml(note)}</span><p>${escapeHtml(note.text)}</p></div>`)
    .join("");
  return `${stat("Lifetime practice", formatDuration(habit.seconds))}
    ${stat("Sessions practiced", String(sessions))}
    ${stat("Last practiced", lastPracticed !== null && lastPracticed > 0 ? formatDate(lastPracticed, true) : "—")}
    ${habit.seconds > 0 ? habitBuildHtml(app, habit) : `<p class="small muted">Build nodes unlock with practice time — 1h for the first.</p>`}
    ${noteRows ? `<div class="note-list">${noteRows}</div>` : `<p class="small muted">No tagged notes yet.</p>`}`;
}

// The HABIT face. Flow: the running active read — selection locked. Upgrade:
// the figure-led list with add and log as on-demand action-button forms, or
// the drilled habit's detail with rename and archive in its head.
function habitFaceHtml(app: App): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  if (!upgrade) {
    const active = activeHabit(state);
    return `<div class="folio-rows">
      <div class="folio-row">
        <span class="folio-key">Active</span>
        <span class="folio-main"><span class="folio-fig">${active ? escapeHtml(active.name) : "Unstructured practice"}</span><span class="folio-sub">selection is locked during flow</span></span>
      </div>
      <div class="folio-row">
        <span class="folio-key">This session</span>
        <span class="folio-main"><span class="folio-fig mono" data-live="focus-habit-session">${formatClock(state.session?.elapsed ?? 0)} of practice</span></span>
      </div>
    </div>`;
  }

  // The drilled habit's detail: back, the head with select / rename /
  // archive, then the development read.
  const drilled = ui.detailHabitId !== null ? state.habits.find((h) => h.id === ui.detailHabitId) : undefined;
  if (drilled) {
    const editing = ui.editingHabitId === drilled.id;
    const active = state.activeHabitId === drilled.id && !drilled.archived;
    const head = editing
      ? `<input type="text" class="habit-rename-input" id="habit-rename-input" value="${escapeHtml(drilled.name)}" maxlength="40" aria-label="Habit name" />
         <button class="primary small" id="habit-rename-save">Save</button>`
      : `<span class="focus-detail-name">${escapeHtml(drilled.name)}</span>
         ${drilled.archived ? `<span class="st-acquired">ARCHIVED</span>` : active ? `<span class="st-acquired">SELECTED</span>` : `<button class="primary small" data-pick="${drilled.id}">Select</button>`}
         ${drilled.archived ? "" : `<button class="quiet small" data-rename="${drilled.id}" title="Rename">✎</button>
         <button class="quiet small icon-btn" data-archive="${drilled.id}" title="Archive (keeps its development)"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M-7-6h14v3H-7Z"/><path d="M-5-3v8h10v-8"/><path d="M0 0v4"/><path d="m-2 2 2 2 2-2"/></svg></button>`}`;
    return `<button class="focus-back" id="habit-detail-back">← Habits</button>
      <div class="focus-detail-head">${head}</div>
      <div class="folio-rows habit-detail-read">${habitDetailBodyHtml(app, drilled)}</div>`;
  }

  const habits = state.habits.filter((h) => !h.archived);
  const archived = state.habits.filter((h) => h.archived);
  const addForm = ui.focusForm === "habit-add";
  const logForm = ui.focusForm === "habit-log";
  const canLog = state.activeHabitId !== null;
  return `<div class="folio-rows habit-ledger">${habits.map((habit) => habitLedgerRowHtml(app, habit)).join("")}</div>
    <div class="folio-rows focus-actions">
      <div class="folio-row">
        ${addForm
          ? `<span class="focus-form-row"><input type="text" id="habit-name-input" placeholder="Name a practice" maxlength="40" aria-label="New habit name" /><button class="primary small" id="habit-create">Add</button></span>`
          : `<button class="focus-action" id="habit-add-open">+ Add habit</button>`}
      </div>
      <div class="folio-row">
        ${canLog
          ? logForm
            ? `<span class="focus-form-row">${tipHtml("focus-log-tip", "Manual logs — the boundary", "Credits practice without a session. Manual logs never produce nous or charge.")}<input type="number" id="habit-log-minutes" min="1" placeholder="minutes" aria-label="Minutes to log" /><button class="primary small" id="habit-log-add">Log</button></span>`
            : `<button class="focus-action" id="habit-log-open">Log practice</button>${tipHtml("focus-log-tip", "Manual logs — the boundary", "Credits practice without a session. Manual logs never produce nous or charge.")}`
          : `<span class="folio-line">Select a habit to log practice.</span>`}
      </div>
    </div>
    ${archived.length > 0 ? `<div class="folio-rows habit-ledger habit-archived"><span class="eyebrow">ARCHIVED</span>${archived.map((habit) => habitLedgerRowHtml(app, habit)).join("")}</div>` : ""}`;
}

/* ── The GOALS face ────────────────────────────────── */

// Slot order (issue #150): incomplete goals first, completed occurrences
// next; stable within each band, so creation order holds.
function openGoalsFirst(a: Goal, b: Goal): number {
  return Number(a.completed) - Number(b.completed);
}

// The one purchase affordance every buy row wears (§7, issue #150): the
// price button — disabled until affordable — over its practice-minute
// countdown. `live` keeps an empty countdown slot standing for the
// control-driven patchers to fill; `note` swaps the countdown for static
// copy (the flow-side "between sessions").
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

// The GOALS face: the slots read over the ruled goal rows — live progress at
// every width — with create and delete as upgrade-mode controls and the
// capacity purchase trailing. Flow reads live and mutates nothing.
function goalsFaceHtml(app: App, projected: ReturnType<typeof displayedRates>): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  const capacity = goalCapacity(state);
  const goalRow = (goal: Goal) => {
    const required = goalRequiredSeconds(goal);
    const fraction = Math.min(1, goal.progressSeconds / required);
    const status = goal.completed
      ? `<span class="goal-status done">complete${goal.schedule.kind === "once" ? "" : ` · resets ${goal.schedule.kind === "daily" ? "tomorrow" : "Monday"}`}</span>`
      : `<span class="goal-status">${formatClock(Math.max(0, required - goal.progressSeconds))} to go</span>`;
    return `<div class="folio-row goal-row ${goal.completed ? "done" : ""}" data-goal="${goal.id}">
      <div class="goal-ledger">
        <div class="goal-ledger-head">
          <span class="goal-ledger-name">${escapeHtml(goalSummary(state, goal))}</span>
          ${status}
          ${upgrade ? `<button class="quiet small icon-btn" data-goal-delete="${goal.id}" title="Remove goal"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M-6-6 6 6M6-6-6 6"/></svg></button>` : ""}
        </div>
        <div class="goal-track"><span data-goal-progress="${goal.id}" style="width:${fraction * 100}%"></span></div>
        <small class="mono" data-goal-minutes="${goal.id}">${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · ×${goal.completedCount} completed` : ""}</small>
      </div>
    </div>`;
  };
  const orderedGoals = [...state.goals].sort(openGoalsFirst);
  const createForm = ui.focusForm === "goal-create";
  const habitOptions = habitChoices(state);
  // The first console long goal (ADR-0012 as amended by ADR-0034, issue
  // #150): goal capacity sold as one compact row — one more slot per
  // purchase, every price far past the last. Read-only in flow.
  const longGoalPrice = longGoalCost(state.goalCapacityBought);
  const longGoalAffordable = wholeNous(state) >= longGoalPrice;
  const longGoalCountdown = upgrade ? practiceCountdown(longGoalPrice, wholeNous(state), projected.rate) : null;
  const longGoalRow = `
    <div class="folio-row long-goal-row">
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
  return `<div class="folio-rows">
    <div class="folio-row">
      ${keyTip(
        "focus-slots-tip",
        "Goal slots — the tracking",
        "Goal slots",
        "Available slots limit tracked goals. Completion is the tracking — each completion credits a Goal Generator's reserve.",
      )}
      <span class="folio-main"><span class="folio-fig mono" id="focus-slots-read">${state.goals.length}/${capacity} slots</span>${upgrade ? "" : `<span class="folio-sub">locked for this session</span>`}</span>
    </div>
    ${orderedGoals.map(goalRow).join("")}
  </div>
  ${
    upgrade && state.goals.length < capacity
      ? `<div class="folio-rows focus-actions"><div class="folio-row">${
          createForm
            ? `<span class="focus-form-row goal-create"><select id="goal-habit" aria-label="Habit"><option value="">Any habit</option>${habitOptions}</select><input type="number" id="goal-minutes" min="1" max="1440" placeholder="min" aria-label="Minutes" /><select id="goal-schedule" aria-label="Schedule"><option value="daily">daily</option><option value="weekly">weekly</option><option value="once">once</option></select><button class="primary small" id="goal-add">Add</button></span>`
            : `<button class="focus-action" id="goal-create-open">+ New goal</button>`
        }</div></div>`
      : ""
  }
  <div class="folio-rows">${longGoalRow}</div>`;
}

/* ── The HISTORY face ──────────────────────────────── */

// The reflection's valence tail: the untouched neutral field reads as
// nothing at all.
function reflectionValence(slider: number): string {
  if (slider === REFLECTION_SLIDER_NEUTRAL) return "";
  return ` · felt ${slider < REFLECTION_SLIDER_NEUTRAL ? "rough" : "great"}`;
}

// The history list (§9): flat, newest first, ~20 rows with a show-more tail
// — date · habit (or "unstructured") · credited minutes · a hit chip or the
// muted miss marker. No day grouping, charts, or calendars; a row drills
// into the full record. One chip per row, the miss marker winning when both
// derive: the "X / Y min" figure already shows the hit.
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
  return `<div class="focus-history">${rows || `<p class="small muted">No sessions yet.</p>`}
    ${
      records.length > shown.length
        ? `<button class="quiet small show-more" id="history-more">Show ${Math.min(HISTORY_PAGE_ROWS, records.length - shown.length)} more</button>`
        : ""
    }
  </div>`;
}

// The drill-down (§9): the full record — when, mode and target, credited
// vs planned, earned nous, each honesty event as a factual line, the
// reflection if present, goals advanced, achievements unlocked. Notes and
// the rate breakdown stay out: this is about practice, not economy replay.
function historyDrillHtml(app: App): string {
  const { state } = app;
  const record = state.sessionRecords.find((r) => r.sessionNumber === app.ui.drillSession);
  if (!record) {
    return `<div class="focus-history">
      <button class="quiet small" id="history-back">← History</button>
      <p class="small muted">That session record is gone.</p>
    </div>`;
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
  return `<div class="focus-history">
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
  </div>`;
}

/* ── The notes sheet (#277) ────────────────────────── */

// The notes sheet's faces: CAPTURE leads — the sheet opens on it — and
// LOGGED carries the stream. Radio-like, like the Focus sheet's facetabs.
export type NotesFace = "capture" | "logged";

const NOTES_TABS: readonly [NotesFace, string][] = [
  ["capture", "CAPTURE"],
  ["logged", "LOGGED"],
];

// The head's state word (the prototype's spelling): the session a flow
// capture tags to, or the stream itself between sessions.
function notesStateWord(app: App): string {
  const { state } = app;
  return state.session !== null ? `session ${state.sessionsCompleted + 1}` : "stream";
}

// The sheet's rebuild signature: everything its body shows, hashed. The
// composer's draft is deliberately absent — a tab switch may drop it, but
// a tick never rebuilds the sheet out from under the typing.
export function notesSheetKey(app: App): string {
  const { state, ui } = app;
  return JSON.stringify([
    ui.app === "notes",
    ui.notesFace,
    state.session !== null,
    state.sessionsCompleted,
    state.activeHabitId,
    state.notes.length,
    state.habits.map((h) => `${h.archived ? "·" : ""}${h.name}`).join("|"),
  ]);
}

// The habit-keyed chip (§9): a tagged note wears its habit, resolved at
// render — renames and archiving never rewrite the stream. Untagged notes
// (unstructured, between sessions) wear none.
function habitChipHtml(state: GameState, note: NoteEntry): string {
  return note.habitId !== null ? `<span class="habit-chip">${escapeHtml(habitRecordName(state, note.habitId))}</span>` : "";
}

// The capture face: the composer over its action row — the live tag chip
// rides it during flow (the session's habit, where the note will tag;
// upgrade-mode notes go untagged) and the capture button takes the note.
// The Note Generator's mechanic is documented on the module itself (the
// forge readout), never as sheet furniture.
function notesCaptureHtml(app: App): string {
  const { state } = app;
  const habit = activeHabit(state);
  const liveTag = state.session !== null && habit ? `<span class="habit-chip note-live-tag">· ${escapeHtml(habit.name.toUpperCase())}</span>` : "";
  return `<section class="notes-capture">
    <textarea class="note-composer" id="note-composer" placeholder="What are you noticing?" maxlength="2000" rows="3"></textarea>
    <div class="session-actions note-capture-row">${liveTag}<button class="primary" id="note-save">Capture note</button></div>
  </section>`;
}

// The logged face: everything kept, newest first, no cap on what is shown,
// matching the engine's no-pruning rule. Rows lead with the mono stamp and
// the habit chip. No empty-state furniture: an empty stream reads as none.
function notesLoggedHtml(app: App): string {
  const { state } = app;
  const stream = [...state.notes].reverse();
  if (stream.length === 0) return "";
  const rows = stream
    .map(
      (note) =>
        `<div class="note-entry"><span class="note-when mono">${noteStampHtml(note)}</span>${habitChipHtml(state, note)}<p>${escapeHtml(note.text)}</p></div>`,
    )
    .join("");
  return `<div class="note-list">${rows}</div>`;
}

// The notes sheet in the Focus frame (ADR-0050, #277): the same clipped
// plate as the control sheet — head, facetabs, close — wearing its own
// NOTES name and its two faces.
export function notesSheetHtml(app: App): string {
  const face = app.ui.notesFace;
  const body = face === "capture" ? notesCaptureHtml(app) : notesLoggedHtml(app);
  const tabs = NOTES_TABS.map(
    ([key, label]) =>
      `<button class="ftab${key === face ? " active" : ""}" data-notes-face="${key}" aria-pressed="${key === face}">${label}</button>`,
  ).join("");
  return sheetFrameHtml("Notes sheet", "NOTES", notesStateWord(app), tabs, body);
}

// The notes sheet's wiring: the facetabs, the close, and the composer —
// capture rides the button and ⌘/Ctrl+Enter, and a successful save
// refocuses the fresh composer. No tooltip layer here: the sheet carries
// no deeper mechanics.
export function bindNotesSheet(app: App, scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>("[data-notes-face]").forEach((button) => {
    app.listen(button, "click", () => {
      const face = button.getAttribute("data-notes-face") as NotesFace | null;
      if (face) app.showNotesFace(face);
    });
  });
  app.listen(scope.querySelector("#focus-close"), "click", () => app.closeApp());
  const composer = scope.querySelector("#note-composer") as HTMLTextAreaElement | null;
  const saveNote = () => {
    if (!composer) return;
    app.addNote(composer.value);
    // A successful save rebuilds the sheet with a fresh composer; refocus it.
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

/* ── The sheet ─────────────────────────────────────── */

const FACE_TABS: readonly [FocusFace, string][] = [
  ["plan", "PLAN"],
  ["habit", "HABIT"],
  ["goals", "GOALS"],
  ["history", "HISTORY"],
];

// The head's state word: what this face holds, at a glance — a fact the
// rows below don't already restate. PLAN names the readiness; HABIT names
// the practice a session would start; GOALS wears the tracker's rolled-up
// state (the one Goals-state read, desktop-only per ADR-0033 amended);
// HISTORY counts the records.
function sheetStateWord(app: App): string {
  const { state } = app;
  const face = focusFaceOf(app);
  if (state.mode !== "upgrade") return "in flow";
  switch (face) {
    case "plan":
      // The figures live in the ready row below — the head names the state,
      // never the same figure twice.
      return "ready";
    case "habit":
      return activeHabit(state)?.name ?? "none selected";
    case "goals":
      return GOAL_TRACKER_WORDS[goalTrackerState(state)];
    case "history":
      return `${state.sessionRecords.length} sessions`;
  }
}

// The one sheet frame both console sheets wear (ADR-0050): the clipped
// plate anchored beneath the clock — head with the name and state word,
// the facetab row, the close — over the standing face's body. One spelling,
// so the Focus and Notes sheets can never drift apart.
function sheetFrameHtml(label: string, name: string, stateWord: string, tabs: string, body: string): string {
  return `<div class="app-popover focus-sheet" id="app-popover"><section class="inst-panel" aria-label="${label}"><div class="inst-panel-face focus-sheet-face">
    <div class="focus-head">
      <span class="focus-name t-condensed">${name}</span>
      <span class="eyebrow focus-state">${stateWord}</span>
      <button class="quiet small icon-btn focus-close" id="focus-close" aria-label="Close the ${label}" title="Close"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M-6-6 6 6M6-6-6 6"/></svg></button>
    </div>
    <div class="facetabs" role="group" aria-label="${label} faces">${tabs}</div>
    ${body}
  </div></section></div>`;
}

export function focusSheetHtml(app: App, projected: ReturnType<typeof displayedRates>): string {
  const face = focusFaceOf(app);
  let body: string;
  if (face === "plan") body = planFaceHtml(app);
  else if (face === "habit") body = habitFaceHtml(app);
  else if (face === "goals") body = goalsFaceHtml(app, projected);
  else body = app.ui.drillSession !== null ? historyDrillHtml(app) : historyListHtml(app);
  const tabs = FACE_TABS.map(
    ([key, label]) =>
      `<button class="ftab${key === face ? " active" : ""}" data-face="${key}" aria-pressed="${key === face}">${label}</button>`,
  ).join("");
  return sheetFrameHtml("Focus control sheet", "FOCUS", sheetStateWord(app), tabs, body);
}

/* ── The plan surfaces' in-place patchers ──────────── */

// The plan surfaces a control-driven change must reach without a render
// (#115): the sheet's own controls, the ready read, and the console clock.
// Every patch is an in-place text/class/attribute swap on surviving nodes,
// so focus, open dropdowns, and scroll all ride through untouched.
export function refreshPlanState(app: App): void {
  refreshPlanControls(app);
  refreshConsoleClockPlan(app);
  const chosen = app.ui.chosenTarget;
  setText(document.getElementById("focus-plan-read"), `${planReadWord(chosen)} · ${goalsTrackedRead(app.state)}`);
  setText(document.getElementById("focus-plan-figure"), chosen !== null ? formatClock(chosen) : "—");
  setText(document.getElementById("focus-plan-word"), chosen === null ? planCaptionWord(true) : "");
  const headState = document.querySelector("#app-popover .focus-state");
  if (headState) setText(headState, sheetStateWord(app));
}

// The plan controls' pressed/disabled/value state, patched in place within
// whatever scope carries them (the sheet's own rows).
function refreshPlanControls(app: App): void {
  const chosen = app.ui.chosenTarget;
  const open = chosen === null;
  const minutes = chosen === null ? null : Math.round(chosen / 60);
  for (const chip of document.querySelectorAll<HTMLButtonElement>("[data-plan]")) {
    const active = minutes !== null && minutes === Number(chip.getAttribute("data-plan"));
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", String(active));
  }
  const input = document.getElementById("plan-minutes") as HTMLInputElement | null;
  if (input) {
    const value = minutes !== null ? String(minutes) : "";
    if (input.value !== value) input.value = value;
    input.disabled = open || app.state.mode !== "upgrade";
  }
  const openButton = document.getElementById("plan-open");
  openButton?.classList.toggle("active", open);
  openButton?.setAttribute("aria-pressed", String(open));
}

/* ── The live patcher ──────────────────────────────── */

// Values that move during flow without rebuilding the sheet: the session
// read, practice tallies, and goal progress.
export function updateFocusSheetLive(app: App, scope: ParentNode, projected: ReturnType<typeof displayedRates>): void {
  const { state } = app;
  if (state.mode !== "upgrade") {
    const session = state.session;
    const elapsed = session?.elapsed ?? 0;
    setText(scope.querySelector('[data-live="focus-elapsed"]'), formatClock(elapsed));
    setText(scope.querySelector('[data-live="focus-caption"]'), sessionCaption(elapsed, session?.target ?? null, state.mode === "paused"));
    setText(scope.querySelector('[data-live="focus-habit-session"]'), `${formatClock(elapsed)} of practice`);
  }
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
    setText(
      scope.querySelector(`[data-goal-minutes="${goal.id}"]`),
      `${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · ×${goal.completedCount} completed` : ""}`,
    );
  }
  // The long-goal row's affordability moves with the balance between
  // rebuilds: the buy button and its practice-minute countdown keep
  // themselves current, like the module upgrade CTA (§7).
  const longGoalBuy = scope.querySelector("#long-goal-buy") as HTMLButtonElement | null;
  if (longGoalBuy) {
    const price = longGoalCost(state.goalCapacityBought);
    longGoalBuy.disabled = !(state.mode === "upgrade" && wholeNous(state) >= price);
    setText(scope.querySelector('[data-live="long-goal-countdown"]'), practiceCountdown(price, wholeNous(state), projected.rate) ?? "");
  }
}

/* ── The sheet's wiring ────────────────────────────── */

// The plan affordances' binding within the sheet: chips pick a preset, the
// free entry takes any whole minute from 1 to 90 (clamped, one-minute
// steps), and open-ended is its own mode toggle. Each acceptance patches the
// affected surfaces in place (#115) — never a render.
function bindPlanControls(app: App, scope: HTMLElement): void {
  scope.querySelectorAll<HTMLButtonElement>("[data-plan]").forEach((chip) => {
    app.listen(chip, "click", () => {
      app.ui.chosenTarget = Number(chip.getAttribute("data-plan")) * 60;
      refreshPlanState(app);
    });
  });
  const planInput = scope.querySelector("#plan-minutes") as HTMLInputElement | null;
  app.listen(planInput, "change", () => {
    if (!planInput) return;
    const minutes = Math.round(Number(planInput.value));
    if (Number.isFinite(minutes) && planInput.value !== "") {
      app.ui.chosenTarget = Math.min(PLAN_MAX_MINUTES, Math.max(PLAN_MIN_MINUTES, minutes)) * 60;
      refreshPlanState(app);
    }
  });
  app.listen(scope.querySelector("#plan-open"), "click", () => {
    app.ui.chosenTarget = null;
    refreshPlanState(app);
  });
}

export function bindFocusSheet(app: App, scope: HTMLElement): void {
  wireTooltips(scope, app.signal);
  bindPlanControls(app, scope);
  // The sheet's own doors.
  scope.querySelectorAll<HTMLElement>("[data-face]").forEach((button) => {
    app.listen(button, "click", () => {
      const face = button.getAttribute("data-face") as FocusFace | null;
      if (face) app.showFocusFace(face);
    });
  });
  app.listen(scope.querySelector("#focus-close"), "click", () => app.closeApp());
  // The PLAN face's Enter flow control commits the face's own read — it
  // never re-enters the confirmation it stands in (#280).
  app.listen(scope.querySelector("#focus-enter"), "click", () => app.beginFlowFromPlan());
  app.listen(scope.querySelector("#focus-end"), "click", () => app.endFlow());
  // The session habit's select (the confirmation path's shape): one landing.
  app.listen(scope.querySelector("#focus-habit-select"), "change", (event) => {
    const value = (event.target as HTMLSelectElement).value;
    app.selectHabitAction(value === "" ? null : value);
  });
  // Habits: the list rows drill; the detail head selects, renames, archives;
  // add and log are on-demand forms.
  scope.querySelectorAll<HTMLElement>("[data-drill-habit]").forEach((row) => {
    app.listen(row, "click", () => {
      const id = row.getAttribute("data-drill-habit");
      if (id) app.openHabitDetail(id);
    });
  });
  app.listen(scope.querySelector("#habit-detail-back"), "click", () => app.closeHabitDetail());
  app.listen(scope.querySelector("#habit-add-open"), "click", () => app.setFocusForm("habit-add"));
  app.listen(scope.querySelector("#habit-log-open"), "click", () => app.setFocusForm("habit-log"));
  app.listen(scope.querySelector("#habit-create"), "click", () => {
    const input = scope.querySelector("#habit-name-input") as HTMLInputElement | null;
    if (input) app.createHabitAction(input.value);
  });
  const nameInput = scope.querySelector("#habit-name-input");
  app.listen(nameInput, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      app.createHabitAction(input.value);
    }
    if ((event as KeyboardEvent).key === "Escape") {
      event.stopPropagation();
      app.setFocusForm(null);
    }
  });
  scope.querySelectorAll<HTMLElement>("[data-pick]").forEach((button) => {
    app.listen(button, "click", () => app.selectHabitAction(button.getAttribute("data-pick")));
  });
  scope.querySelectorAll<HTMLElement>("[data-rename]").forEach((button) => {
    app.listen(button, "click", () => {
      app.ui.editingHabitId = button.getAttribute("data-rename");
      app.render();
      const input = scope.querySelector("#habit-rename-input") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-archive]").forEach((button) => {
    app.listen(button, "click", () => {
      const id = button.getAttribute("data-archive");
      if (id) app.archiveHabitAction(id);
    });
  });
  const renameInput = scope.querySelector("#habit-rename-input");
  app.listen(renameInput, "keydown", (event) => {
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
  app.listen(scope.querySelector("#habit-rename-save"), "click", () => {
    const id = app.ui.editingHabitId;
    const input = scope.querySelector("#habit-rename-input") as HTMLInputElement | null;
    if (id && input) app.renameHabitAction(id, input.value);
  });
  app.listen(scope.querySelector("#habit-log-add"), "click", () => {
    const input = scope.querySelector("#habit-log-minutes") as HTMLInputElement | null;
    if (input && input.value) app.logPracticeAction(Number(input.value));
  });
  const logInput = scope.querySelector("#habit-log-minutes");
  app.listen(logInput, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      if (input.value) app.logPracticeAction(Number(input.value));
    }
    if ((event as KeyboardEvent).key === "Escape") {
      event.stopPropagation();
      app.setFocusForm(null);
    }
  });
  // The habit build (ADR-0046): equip and unequip are free respecs in
  // upgrade mode — the engine answers for the slot and unlock rules.
  scope.querySelectorAll<HTMLElement>("[data-equip]").forEach((button) => {
    app.listen(button, "click", () => {
      const nodeId = button.getAttribute("data-equip");
      const habitId = button.getAttribute("data-habit");
      if (nodeId && habitId) app.equipBuildNodeAction(habitId, nodeId);
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-unequip]").forEach((button) => {
    app.listen(button, "click", () => {
      const nodeId = button.getAttribute("data-unequip");
      const habitId = button.getAttribute("data-habit");
      if (nodeId && habitId) app.unequipBuildNodeAction(habitId, nodeId);
    });
  });
  // Goals: delete rides the rows, create is an on-demand form, the capacity
  // purchase trails.
  scope.querySelectorAll<HTMLElement>("[data-goal-delete]").forEach((button) => {
    app.listen(button, "click", () => {
      const id = button.getAttribute("data-goal-delete");
      if (id) app.deleteGoalAction(id);
    });
  });
  app.listen(scope.querySelector("#goal-create-open"), "click", () => app.setFocusForm("goal-create"));
  app.listen(scope.querySelector("#goal-add"), "click", () => {
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
  app.listen(scope.querySelector("#long-goal-buy"), "click", () => app.buyGoalCapacityAction());
  // The history surfaces (§9): rows drill in; the tail pages; back unwinds
  // the drill to the list — the facetab is the list's own parent.
  app.listen(scope.querySelector("#history-more"), "click", () => app.moreHistory());
  app.listen(scope.querySelector("#history-back"), "click", () => {
    if (app.ui.drillSession !== null) app.closeDrill();
  });
  scope.querySelectorAll<HTMLElement>("[data-drill]").forEach((row) => {
    app.listen(row, "click", () => {
      const number = Number(row.getAttribute("data-drill"));
      if (Number.isFinite(number)) app.openDrill(number);
    });
  });
}
