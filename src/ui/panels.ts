// The focus-app panels region (ADR-0012): the popover bodies for Habit,
// Time (with the history list and drill-down), Notes, and Goals. Renders
// from the RenderContext; every write is an intent. The panels' own view
// state — the habit being renamed, the expanded development summary, the
// history view and its page — is region-local scratch, cleared where its
// surface closes (App calls the reset exports).
import { activeHabit } from "../engine/habits";
import { goalCapacity, goalRequiredSeconds, goalSummary } from "../engine/goals";
import { longGoalCost, wholeNous } from "../engine/economy";
import { BALANCE, REFLECTION_SLIDER_NEUTRAL } from "../engine/constants";
import { isInFlowNote } from "../engine/notes";
import {
  habitRecordName,
  habitPracticeSummary,
  habitTaggedNotes,
  recordMissed,
  recordTargetHit,
  sessionRecordsNewestFirst,
} from "../engine/records";
import { achievementName } from "../engine/achievements";
import type { FocusApp } from "../engine/apps";
import type { GameState, Goal, Habit, NoteEntry } from "../engine/types";
import { formatClock, formatDuration } from "../engine/clock";
import { formatDate, formatInt, formatNumber, formatPracticeMinutes, secondsToMinutes } from "./format";
import { HISTORY_PAGE_ROWS } from "./meta";
import { stat } from "./dom";
import { escapeHtml } from "./dom";
import { liveText } from "./region";
import { sessionCaption, sessionTrackWidth } from "./clockface";
import { bindPlanControls, planControlsHtml } from "./plan";
import { projectedCountdown, type RenderContext } from "./context";
import { honestyEventLine } from "./honesty";

/* ── Region-local view state ────────────────────────── */

// The habit whose rename input is open.
let editingHabitId: string | null = null;
// The Habit app's expanded development summary (§9): one habit at a time.
let summaryHabitId: string | null = null;
// The Time app's history surfaces (§9): the list view, its page size, and
// the record drilled into. Cleared with the popover.
let historyOpen = false;
let historyLimit = HISTORY_PAGE_ROWS;
let drillSession: number | null = null;

/** The rename scratch clears when the popover closes or a rename commits. */
export function clearEditingHabit(): void {
  editingHabitId = null;
}

/** Both history surfaces and the development summary clear with the popover. */
export function resetPanelSurfaces(): void {
  historyOpen = false;
  historyLimit = HISTORY_PAGE_ROWS;
  drillSession = null;
  summaryHabitId = null;
}

/** Facts about this region's scratch that gate the popover's structural rebuild. */
export function panelKeyFacts(): unknown[] {
  return [editingHabitId, historyOpen, drillSession, historyLimit, summaryHabitId];
}

/** Opens a session's drill-down directly (App re-renders around it). */
export function panelOpenDrill(sessionNumber: number): void {
  drillSession = sessionNumber;
  historyOpen = true;
}

/* ── Panel bodies ───────────────────────────────────── */

// One habit row (§9): the pick/rename/archive controls plus the development
// summary toggle. An archived habit loses the selection controls but keeps
// its summary — archiving hides a habit from selection only.
function habitRowHtml(ctx: RenderContext, habit: Habit, selectable: boolean): string {
  const { state } = ctx;
  const editing = selectable && editingHabitId === habit.id;
  const expanded = summaryHabitId === habit.id;
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
  return `<div class="habit-row${selected}" data-habit="${habit.id}">${controls}</div>${expanded ? habitSummaryHtml(ctx, habit) : ""}`;
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
function habitSummaryHtml(ctx: RenderContext, habit: Habit): string {
  const { state } = ctx;
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
function historyListHtml(ctx: RenderContext): string {
  const { state } = ctx;
  const records = sessionRecordsNewestFirst(state);
  const shown = records.slice(0, historyLimit);
  const rows = shown
    .map((record) => {
      const habit = record.habitId === null ? "unstructured" : escapeHtml(habitRecordName(state, record.habitId));
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
function historyDrillHtml(ctx: RenderContext): string {
  const { state } = ctx;
  const record = state.sessionRecords.find((r) => r.sessionNumber === drillSession);
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

export function appPanelBody(ctx: RenderContext, panel: FocusApp): string {
  const { state } = ctx;
  const upgrade = state.mode === "upgrade";

  if (panel === "habit") {
    const active = activeHabit(state);
    const live = !upgrade;
    const habits = state.habits.filter((h) => !h.archived);
    const rows = habits.map((habit) => habitRowHtml(ctx, habit, true)).join("");
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
          ? `<div class="habit-archived"><span class="eyebrow">ARCHIVED</span>${archived.map((habit) => habitRowHtml(ctx, habit, false)).join("")}</div>`
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
    if (historyOpen) {
      return drillSession !== null ? historyDrillHtml(ctx) : historyListHtml(ctx);
    }
    if (upgrade) {
      return `<section class="focus-controls">
        ${planControlsHtml(ctx)}
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
  const longGoalCountdown = upgrade ? projectedCountdown(ctx, longGoalPrice) : null;
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

/* ── Binding and the live pass ──────────────────────── */

export function bindAppPanel(ctx: RenderContext, scope: HTMLElement): void {
  const { intents } = ctx;
  bindPlanControls(ctx, scope);
  scope.querySelector("#habit-create")?.addEventListener("click", () => {
    const input = scope.querySelector("#habit-name-input") as HTMLInputElement | null;
    if (input) intents.createHabitAction(input.value);
  });
  const nameInput = scope.querySelector("#habit-name-input");
  nameInput?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      intents.createHabitAction(input.value);
    }
  });
  scope.querySelectorAll<HTMLElement>("[data-pick]").forEach((button) => {
    button.addEventListener("click", () => intents.selectHabitAction(button.getAttribute("data-pick")));
  });
  scope.querySelectorAll<HTMLElement>("[data-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      editingHabitId = button.getAttribute("data-rename");
      intents.refreshView();
      const input = scope.querySelector("#habit-rename-input") as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-archive]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-archive");
      if (id) intents.archiveHabitAction(id);
    });
  });
  // The development summary toggle (§9): one habit expanded at a time.
  scope.querySelectorAll<HTMLElement>("[data-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-summary");
      if (id) {
        summaryHabitId = summaryHabitId === id ? null : id;
        intents.refreshView();
      }
    });
  });
  // The history surfaces (§9): the affordance swaps the Time panel body to
  // the list; rows drill in; the tail pages; back unwinds one level — out of
  // the drill-down to the list, out of the list to the Time panel itself.
  scope.querySelector("#time-history")?.addEventListener("click", () => {
    historyOpen = true;
    historyLimit = HISTORY_PAGE_ROWS;
    drillSession = null;
    intents.refreshView();
  });
  scope.querySelector("#history-back")?.addEventListener("click", () => {
    if (drillSession !== null) {
      drillSession = null;
    } else {
      historyOpen = false;
      historyLimit = HISTORY_PAGE_ROWS;
      drillSession = null;
    }
    intents.refreshView();
  });
  scope.querySelector("#history-more")?.addEventListener("click", () => {
    historyLimit += HISTORY_PAGE_ROWS;
    intents.refreshView();
  });
  scope.querySelectorAll<HTMLElement>("[data-drill]").forEach((row) => {
    row.addEventListener("click", () => {
      const number = Number(row.getAttribute("data-drill"));
      if (Number.isFinite(number)) {
        drillSession = number;
        intents.refreshView();
      }
    });
  });
  const renameInput = scope.querySelector("#habit-rename-input");
  renameInput?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      const id = editingHabitId;
      if (id) intents.renameHabitAction(id, (event.target as HTMLInputElement).value);
    }
    if ((event as KeyboardEvent).key === "Escape") {
      event.stopPropagation();
      editingHabitId = null;
      intents.refreshView();
    }
  });
  scope.querySelector("#habit-rename-save")?.addEventListener("click", () => {
    const id = editingHabitId;
    const input = scope.querySelector("#habit-rename-input") as HTMLInputElement | null;
    if (id && input) intents.renameHabitAction(id, input.value);
  });
  scope.querySelector("#habit-log-add")?.addEventListener("click", () => {
    const input = scope.querySelector("#habit-log-minutes") as HTMLInputElement | null;
    if (input && input.value) intents.logPracticeAction(Number(input.value));
  });
  scope.querySelector("#goal-add")?.addEventListener("click", () => {
    const habitSelect = scope.querySelector("#goal-habit") as HTMLSelectElement | null;
    const minutesInput = scope.querySelector("#goal-minutes") as HTMLInputElement | null;
    const scheduleSelect = scope.querySelector("#goal-schedule") as HTMLSelectElement | null;
    if (!habitSelect || !minutesInput || !scheduleSelect || !minutesInput.value) return;
    intents.createGoalAction(
      habitSelect.value === "" ? null : habitSelect.value,
      Number(minutesInput.value),
      scheduleSelect.value as "once" | "daily" | "weekly",
    );
  });
  scope.querySelector("#long-goal-buy")?.addEventListener("click", () => intents.buyGoalCapacityAction());
  scope.querySelectorAll<HTMLElement>("[data-goal-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-goal-delete");
      if (id) intents.deleteGoalAction(id);
    });
  });
  const composer = scope.querySelector("#note-composer") as HTMLTextAreaElement | null;
  const saveNote = () => {
    if (!composer) return;
    intents.addNote(composer.value);
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
export function updateAppPanelLive(ctx: RenderContext, scope: ParentNode): void {
  const { state } = ctx;
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
    const countdown = projectedCountdown(ctx, price) ?? "";
    liveText(scope, "long-goal-countdown", countdown);
  }
}
