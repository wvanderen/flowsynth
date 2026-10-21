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
// surfaces are the HISTORY face. Notes left the frame for its own centered
// modal composition (issue #332, amending ADR-0050's shared anchored
// frame); its helpers live at the bottom of this file.

import type { App } from "./app";
import { formatClock, formatDuration } from "../engine/clock";
import {
  habitPracticeSummary,
  habitRecordName,
  habitTaggedNotes,
  recordMissed,
  recordTargetHit,
  sessionRecordsNewestFirst,
} from "../engine/records";
import { activeHabit } from "../engine/habits";
import { CLASSES, nodeAvailable, pairDef, pairOf, practiceRollThreshold, rankOf } from "../engine/classes";
import type { ClassId } from "../engine/types";
import { isInFlowNote } from "../engine/notes";
import { achievementName } from "../engine/achievements";
import { activeGoals, goalCapacity, goalRequiredSeconds, goalSummary, goalTrackerState, GOAL_COLORS, type GoalTrackerState } from "../engine/goals";
import type { ClassPairState, GameState, Goal, GoalColor, Habit, HonestyEvent, HonestyOutcome, NoteEntry } from "../engine/types";

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
  formatCountdown,
  formatNumber,
  formatPracticeMinutes,
  secondsToMinutes,
} from "./format";
import { REFLECTION_SLIDER_NEUTRAL } from "../engine/constants";
import { termTipHtml, type CatalogTerm } from "./terms";
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

// The running-session caption shared by the console clock block and the
// sheet's running read (§2.2). Every running state names itself — paused,
// open-ended, the overrun it counts — and a planned session rides the bare
// target: the display clock is the session's remainder, so the figure
// beneath it reads as the plan without a joining word.
export function sessionCaption(elapsed: number, target: number | null, paused: boolean): string {
  const reached = target !== null && elapsed >= target;
  return paused ? "paused" : target === null ? OPEN_ENDED_WORD : reached ? "overrun" : formatClock(target);
}

/* ── The goal meter's derivation (the display panel; header-status brief) ── */

// The display well's one goal read, derived entirely from existing state:
// the goals qualifying the selected habit — its own plus the habit-agnostic
// ones — with the nearest-to-completion open goal lighting the column and a
// count mark answering for the rest still in play. All done reads done; no
// habit or no qualifying goal reads nothing, and the well closes over the
// meter's slot. Each column wears its goal's chosen palette color; the lit
// segments carry progress and the done column's engraved mark carries
// completion — never color alone. Nothing here reads or writes a new
// persisted key — the derivation is the whole edge state.
export interface GoalMeterRead {
  fraction: number;
  done: boolean;
  color: GoalColor;
  // Open qualifying goals still in play past the shown one.
  extra: number;
  // The tooltip gloss: which goal, what remains — the one fact the surface
  // cannot show. The habit name stays off it; the display already reads it.
  label: string;
  aria: string;
}

// The meter's segment budget: seven steps, the LED ladder the display
// column lights bottom-up.
export const GOAL_METER_SEGMENTS = 7;

const GOAL_SCHEDULE_WORD = { once: "", daily: "Daily", weekly: "Weekly" } as const;

export function goalMeterOf(state: GameState): GoalMeterRead | null {
  const habit = activeHabit(state);
  if (!habit) return null;
  // Goals are habit-owned (issue #423): only the selected habit's own
  // goals qualify the display well.
  const qualifying = activeGoals(state).filter(
    (goal) => goal.condition.kind === "habit-minutes" && goal.condition.habitId === habit.id,
  );
  if (qualifying.length === 0) return null;
  const reads = qualifying.map((goal) => {
    const required = goalRequiredSeconds(goal);
    return { goal, fraction: required > 0 ? Math.min(1, goal.progressSeconds / required) : 1, done: goal.completed };
  });
  // The nearest-to-completion open goal leads; a fully completed candidate
  // set closes the meter on its done mark rather than vanishing.
  const open = reads.filter((read) => !read.done).sort((a, b) => b.fraction - a.fraction);
  const chosen = open[0] ?? reads[0]!;
  const done = chosen.done;
  const extra = done ? 0 : open.length - 1;
  const minutes = Math.round(goalRequiredSeconds(chosen.goal) / 60);
  const scheduleWord = GOAL_SCHEDULE_WORD[chosen.goal.schedule.kind];
  const target = `${scheduleWord ? scheduleWord + " " : ""}${minutes} min`;
  const remaining = Math.max(0, Math.ceil((goalRequiredSeconds(chosen.goal) - chosen.goal.progressSeconds) / 60));
  const tail = done ? "complete" : `${remaining} min to go`;
  const label = `${target} · ${tail}`;
  const more = extra > 0 ? `, ${extra} more goal${extra === 1 ? "" : "s"} in play` : "";
  const aria = `Goal progress: ${target.toLowerCase()}, ${done ? "complete" : `${remaining} minute${remaining === 1 ? "" : "s"} to go`}${more}`;
  return { fraction: chosen.fraction, done, color: chosen.goal.color, extra, label, aria };
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
    state.habits.map((h) => `${h.archived ? "·" : ""}${h.name}`).join("|"),
    // The class layer (issue #423): the wear and each pair's level, free
    // points, and allocation hash into the key, so tree moves rebuild the
    // sheet. The meters ride the live patchers, never the key.
    state.habits
      .map((h) => `${h.classId}:` + Object.values(h.classes ?? {}).map((p) => `${p.level}.${p.points}.${Object.entries(p.spent ?? {}).map(([id, r]) => `${id}${r}`).join(",")}`).join(";"))
      .join("|"),
    state.goals
      .map((g) => `${g.completed ? 1 : 0}${g.condition.minutes}${g.condition.habitId ?? ""}${g.schedule.kind}${g.completedCount}${g.color}`)
      .join("|"),
    state.sessionRecords.length,
    ui.goalRecolorId,
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

// The planned duration reads in exactly one place — the console clock
// (#311's one-place rule) — so the sheet's own surfaces never repeat it.

function goalsTrackedRead(state: GameState): string {
  const count = activeGoals(state).length;
  return count === 1 ? "1 goal tracked" : `${count} goals tracked`;
}

// The habit chip row (#311): one tap switches the session habit, the
// selected chip wears the state grammar's firm inset marker, and the
// unstructured choice keeps its UI word — "none selected" — as its own
// chip. Create and edit live behind the add chip (the HABIT face), never
// a detail drill-down from here. Upgrade mode only — a running session
// narrates its habit in the row above and changes nothing.
function habitChipsHtml(app: App): string {
  const { state } = app;
  const chips = state.habits
    .filter((h) => !h.archived)
    .map((h) => {
      const selected = state.activeHabitId === h.id;
      return `<button class="plan-habit-chip${selected ? " st-selected" : ""}" data-habit-pick="${h.id}" aria-pressed="${selected}">${escapeHtml(h.name)}</button>`;
    })
    .join("");
  const none = state.activeHabitId === null;
  return `<div class="folio-row focus-habit-chips" role="group" aria-label="Session habit">
    ${chips}<button class="plan-habit-chip plan-habit-chip-none${none ? " st-selected" : ""}" data-habit-pick="" aria-pressed="${none}">none selected</button>
    <button class="plan-habit-chip plan-habit-chip-add" id="habit-add-chip">+ Add habit</button>
  </div>`;
}

// The planned-target affordances (§6) as one compact control row (#311):
// preset chips, the free 1–90 minute entry inline among them, and
// open-ended as its own mode — never a duration choice. Active states ride
// the state grammar. They ride the very first start (ADR-0019), visible but
// unpushed: the resting plan is open-ended, and only a picked plan ever
// arms the target signals (§4). Upgrade mode only — a running session
// shows no time selection.
function planRowsHtml(app: App): string {
  const open = app.ui.chosenTarget === null;
  const chosen = app.ui.chosenTarget;
  const minutes = chosen === null ? null : Math.round(chosen / 60);
  return `<div class="folio-rows focus-plan" role="group" aria-label="Planned session length">
    <div class="folio-row focus-plan-controls">
      ${PLAN_PRESET_MINUTES.map(
        (option) =>
          `<button class="plan-chip${minutes === option ? " active" : ""}" data-plan="${option}" aria-pressed="${minutes === option}">${option}</button>`,
      ).join("")}
      <span class="plan-free">
        <input type="number" id="plan-minutes" min="${PLAN_MIN_MINUTES}" max="${PLAN_MAX_MINUTES}" step="1" placeholder="1–90"
          value="${minutes ?? ""}" ${open ? "disabled" : ""} aria-label="Custom session length, 1 to 90 minutes" />
        <span class="plan-unit">min</span>
      </span>
      <button id="plan-open" class="plan-open${open ? " active" : ""}" aria-pressed="${open}">Open-ended</button>
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

// The PLAN face (#311). The console header is authoritative for starting
// and ending flow and for time — the sheet adds neither a start/end control
// nor a clock of its own. Both modes show the plan read: the session's
// habit and the goals tracked. Upgrade mode alone carries the controls —
// the habit chip row and the time selection; a running session shows none,
// narrating its habit in the row above.
function planFaceHtml(app: App): string {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  const habit = activeHabit(state);
  return `<div class="focus-enter">
      <span class="focus-enter-read">
        ${habit ? `<span class="focus-ready t-condensed">${escapeHtml(habit.name)}</span>` : ""}
        <span class="focus-enter-sub mono" id="focus-plan-read">${goalsTrackedRead(state)}</span>
      </span>
    </div>
    ${upgrade ? `${habitChipsHtml(app)}
    ${planRowsHtml(app)}` : ""}`;
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
  return `<button class="folio-row habit-ledger-row" data-drill-habit="${habit.id}">
    <span class="folio-fig mono" data-habit-seconds="${habit.id}">${formatDuration(habit.seconds)}</span>
    <span class="folio-fig mono folio-dim">${sessions}×</span>
    <span class="habit-ledger-name">${escapeHtml(habit.name)}</span>
    <span class="habit-dot${active ? " on" : ""}" role="img" aria-label="${active ? "active habit" : "not active"}"></span>
    <span class="habit-ledger-arrow mono" aria-hidden="true">→</span>
  </button>`;
}

// The practice-roll meter's one-line read (issue #423): progress and
// threshold as durations, and the practice remaining to the next roll —
// the same figures the retired flow meter spoke, now the pair's own.
export function practiceMeterLine(pair: ClassPairState): string {
  const threshold = practiceRollThreshold(pair, pair.rollMeter.earned);
  const remaining = Math.max(0, threshold - pair.rollMeter.progress);
  return `${formatCountdown(pair.rollMeter.progress)} / ${formatCountdown(threshold)} — next roll in ~${formatCountdown(remaining)} of practice`;
}

// The pair's meter read, one builder for the row's markup and its live
// patcher alike: threshold, fill share, and the spoken line (#351's
// no-drift rule, issue #423).
function classMeterRead(habit: Habit): { threshold: number; fill: string; line: string } {
  const pair = pairOf(habit);
  const threshold = practiceRollThreshold(pair, pair.rollMeter.earned);
  const fill = `${(Math.min(1, Math.max(0, pair.rollMeter.progress / threshold)) * 100).toFixed(1)}%`;
  return { threshold, fill, line: practiceMeterLine(pair) };
}

// The meter's live row (issue #423): the track carries the same
// progressbar semantics its fill shows (#351) — valuenow and valuetext
// mirror the visible read. Rendered in the flow-mode active read and the
// habit/class detail; the live patcher fills both.
function classMeterRowHtml(habit: Habit): string {
  const { threshold, fill, line } = classMeterRead(habit);
  return `<div class="folio-row class-meter-row">
    <span class="folio-key">${termTipHtml("practice-roll meter", "Practice-roll meter")}</span>
    <span class="folio-main class-meter">
      <span class="class-meter-track" data-live="class-meter-track" data-habit="${habit.id}" role="progressbar" aria-label="Practice-roll meter" aria-valuemin="0" aria-valuemax="${threshold}" aria-valuenow="${pairOf(habit).rollMeter.progress}" aria-valuetext="${escapeHtml(line)}"><i data-live="class-meter-pip" style="width:${fill}"></i></span>
      <small class="mono" data-live="class-meter-line" data-habit="${habit.id}">${escapeHtml(line)}</small>
    </span>
  </div>`;
}

// The habit's class face (issue #423, ADR-0074): the wear chips, the
// pair's development read — class, level, the unspent point balance, the
// next threshold — the practice-roll meter, the tree's bounded-rank nodes
// with their explicit prerequisites, and the respec/preset moves. This
// detail is the one surface class experience, level, and the point
// balance read on; the pair's meter renders here and in the flow-mode
// active read, nowhere else.
function habitClassHtml(app: App, habit: Habit): string {
  const { state } = app;
  const upgrade = state.mode === "upgrade";
  const def = pairDef(habit);
  const pair = pairOf(habit);
  const chips = CLASSES.map((cls) => {
    const selected = habit.classId === cls.id;
    return upgrade
      ? `<button class="class-chip${selected ? " st-selected" : ""}" data-class-pick="${cls.id}" data-habit="${habit.id}" aria-pressed="${selected}"${selected ? " disabled" : ""}>${cls.name}</button>`
      : `<span class="class-chip${selected ? " st-selected" : ""}">${cls.name}</span>`;
  }).join("");
  const atCap = pair.level >= def.levelThresholds.length;
  const nextAt = atCap ? null : def.levelThresholds[pair.level]!;
  const nextRead = atCap ? "max level" : `${formatCountdown(Math.max(0, nextAt! - pair.experience))} of practice to level ${pair.level + 1}`;
  const nodeTerms: Record<string, CatalogTerm> = { governor: "Governor", reed: "Reed", "punch-card": "Punch card" };
  const rows = def.nodes.map((node) => {
    const term = nodeTerms[node.id];
    const name = term ? termTipHtml(term, escapeHtml(node.name)) : escapeHtml(node.name);
    const rank = rankOf(pair, node);
    const available = nodeAvailable(pair, node);
    if (!available) {
      return `<div class="build-node locked">
        <span class="build-node-mark mono" aria-hidden="true">·</span>
        <span class="build-node-name">${name}<small>unlocks at class level ${node.requiredLevel} · ${escapeHtml(node.effect)}</small></span>
      </div>`;
    }
    const full = rank >= node.maxRank;
    const mark = `${rank}/${node.maxRank}`;
    const title = upgrade
      ? full
        ? "Fully ranked"
        : pair.points < 1
          ? "No point free — level up through practice"
          : "Allocate a point"
      : "The tree is read-only during flow";
    return full
      ? `<div class="build-node equipped">
          <span class="build-node-mark mono">${mark}</span>
          <span class="build-node-name">${name}<small>${escapeHtml(node.effect)}</small></span>
        </div>`
      : `<div class="build-node">
          <button class="class-rank-action mono" data-class-allocate="${node.id}" data-habit="${habit.id}" ${!upgrade || pair.points < 1 ? "disabled" : ""} aria-label="Allocate ${escapeHtml(node.name)}, rank ${rank} of ${node.maxRank}" title="${title}">+${mark}</button>
          <span class="build-node-name">${name}<small>${escapeHtml(node.effect)}</small></span>
        </div>`;
  }).join("");
  const spentTotal = def.nodes.reduce((sum, node) => sum + rankOf(pair, node), 0);
  const presets = def.presets
    .map((preset) => {
      const cost = Object.values(preset.spent).reduce((sum, rank) => sum + rank, 0);
      const affordable = upgrade && cost <= pair.points + spentTotal;
      // A momentary action, never a toggle: no pressed state — the engine
      // answers for the budget and the prerequisites either way.
      return `<button class="plan-chip" data-class-preset="${preset.id}" data-habit="${habit.id}" ${affordable ? "" : "disabled"} title="Applies as an ordinary allocation">${escapeHtml(preset.name)}</button>`;
    })
    .join("");
  return `<div class="habit-class">
    ${CLASSES.length > 1 ? `<div class="class-chips" role="group" aria-label="Class">${chips}</div>` : ""}
    <div class="stat-row"><span class="mono">${termTipHtml(def.id === "engineer" ? "Engineer" : "Habit class", def.name)} · Level ${pair.level} · ${pair.points} ${termTipHtml("tree point", pair.points === 1 ? "tree point" : "tree points")} free</span></div>
    <div class="stat-row"><span>Next level</span><span class="mono">${nextRead}</span></div>
    ${classMeterRowHtml(habit)}
    <div class="class-tree">
      <span class="eyebrow">TREE</span>
      <p class="small muted mono">${spentTotal} spent · ${termTipHtml("Respec", "respec")} is free</p>
      <div class="build-nodes">${rows}</div>
      <div class="class-tree-actions">
        ${upgrade ? `<button class="quiet small" data-class-respec="${habit.id}" ${spentTotal > 0 ? "" : "disabled"} title="Returns every spent point — experience and level stay">Respec</button>` : ""}
        ${upgrade ? `<span class="class-presets" role="group" aria-label="Presets">${presets}</span>` : ""}
      </div>
    </div>
  </div>`;
}

// The development detail (§9): lifetime practice (the development total),
// sessions practiced and last practiced — aggregates off the practice log,
// live sessions and manual logs together — the habit's class (issue #423),
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
    ${habitClassHtml(app, habit)}
    ${noteRows ? `<div class="note-list">${noteRows}</div>` : `<p class="small muted">No tagged notes yet.</p>`}`;
}

// The HABIT face. Flow: the running active read — selection locked — with
// the active pair's practice-roll meter live beneath it (issue #423): the
// one place the meter's fill reads during a session. Upgrade: the
// figure-led list with add and log as on-demand action-button forms, or
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
      ${active ? classMeterRowHtml(active) : ""}
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

// The six-swatch picker's one spelling (issue #312): exactly the palette's
// six, the standing pick wearing the selected state — the same row serves
// the create form and a goal row's re-pick, so there is no second picker
// shape to drift. `attr` names the binding (`data-goal-draft-color` on the
// create form, `data-goal-set-color` on a row), the background rides the
// palette token, and the key names the swatch for every access path.
function goalSwatchesHtml(attr: string, selected: GoalColor): string {
  return `<span class="goal-swatches" role="group" aria-label="Goal color">${GOAL_COLORS.map(
    (key) =>
      `<button class="goal-swatch${key === selected ? " selected" : ""}" type="button" ${attr}="${key}" aria-pressed="${key === selected}" aria-label="${key}"><span aria-hidden="true" style="background:var(--goal-${key})"></span></button>`,
  ).join("")}</span>`;
}

// The goal bar's fill height, one build for the row's markup and its live
// patcher alike: the shared column fills by height, and a completed goal's
// bar holds full height under the engraved check.
function goalBarHeight(goal: Goal): string {
  if (goal.completed) return "100%";
  return `${Math.min(100, (goal.progressSeconds / goalRequiredSeconds(goal)) * 100)}%`;
}

// The GOALS face: the selected habit's own slots read over the ruled goal
// rows (issue #423 — goals are habit-owned; only the selected habit's
// goals display, and no habit selected reads none), live progress at
// every width, each track wearing its goal's chosen color — with create
// and delete as upgrade-mode controls, the palette picked at creation and
// re-pickable on the row. Capacity is the habit's own fixed count, never
// purchasable. Flow reads live and mutates nothing.
function goalsFaceHtml(app: App): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  const habit = activeHabit(state);
  const capacity = goalCapacity();
  const ownGoals = habit ? activeGoals(state).filter((g) => g.condition.habitId === habit.id) : [];
  const goalRow = (goal: Goal) => {
    const required = goalRequiredSeconds(goal);
    const status = goal.completed
      ? `<span class="goal-status done">complete${goal.schedule.kind === "once" ? "" : ` · resets ${goal.schedule.kind === "daily" ? "tomorrow" : "Monday"}`}</span>`
      : `<span class="goal-status">${formatClock(Math.max(0, required - goal.progressSeconds))} to go</span>`;
    const recoloring = upgrade && ui.goalRecolorId === goal.id;
    return `<div class="folio-row goal-row ${goal.completed ? "done" : ""}" data-goal="${goal.id}">
      <div class="goal-ledger">
        <div class="goal-ledger-head">
          <span class="goal-ledger-name">${escapeHtml(goalSummary(state, goal))}</span>
          ${status}
          ${
            upgrade
              ? `<button class="quiet small goal-recolor" data-goal-recolor="${goal.id}" aria-pressed="${recoloring}" title="Change color" aria-label="Change color"><span class="goal-recolor-dot" style="background:var(--goal-${goal.color})"></span></button>
          <button class="quiet small icon-btn" data-goal-delete="${goal.id}" title="Remove goal"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M-6-6 6 6M6-6-6 6"/></svg></button>`
              : ""
          }
        </div>
        <span class="gbar${goal.completed ? " done" : ""}" aria-hidden="true"><i data-goal-progress="${goal.id}" style="height:${goalBarHeight(goal)};background:var(--goal-${goal.color})"></i></span>
        <small class="mono" data-goal-minutes="${goal.id}">${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · ×${goal.completedCount} completed` : ""}</small>
        ${recoloring ? goalSwatchesHtml("data-goal-set-color", goal.color) : ""}
      </div>
    </div>`;
  };
  const orderedGoals = [...ownGoals].sort(openGoalsFirst);
  const createForm = ui.focusForm === "goal-create";
  const habitOptions = habitChoices(state);
  return `<div class="folio-rows">
    <div class="folio-row">
      <span class="folio-main"><span class="folio-fig mono" id="focus-slots-read">${habit ? `${ownGoals.length}/${capacity} slots` : "no habit selected"}</span>${upgrade ? "" : `<span class="folio-sub">locked for this session</span>`}</span>
    </div>
    ${habit && orderedGoals.length === 0 ? `<div class="folio-row"><span class="folio-line muted">${escapeHtml(habit.name)} tracks no goals yet.</span></div>` : ""}
    ${orderedGoals.map(goalRow).join("")}
  </div>
  ${
    upgrade && (!habit || ownGoals.length < capacity)
      ? `<div class="folio-rows focus-actions"><div class="folio-row">${
          createForm
            ? `<span class="focus-form-row goal-create"><select id="goal-habit" aria-label="Habit">${habitOptions}</select><input type="number" id="goal-minutes" min="1" max="1440" placeholder="min" aria-label="Minutes" /><select id="goal-schedule" aria-label="Schedule"><option value="daily">daily</option><option value="weekly">weekly</option><option value="once">once</option></select><button class="primary small" id="goal-add">Add</button></span>${goalSwatchesHtml("data-goal-draft-color", ui.goalColor)}`
            : `<button class="focus-action" id="goal-create-open">+ New goal</button>`
        }</div></div>`
      : ""
  }`;
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
// Its title is the sheet's one heading, an h2 beneath the document's h1
// (issue #354) — outline traversal lands on the record by level.
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
    <h2 class="history-title">Session ${record.sessionNumber} · ${habit}</h2>
    <div class="stat-row"><span>When</span><span class="mono">${formatDate(record.startedAt, true)} – ${formatDate(record.endedAt, true)}</span></div>
    <div class="stat-row"><span>Plan</span><span class="mono">${plan}</span></div>
    <div class="stat-row"><span>Practice time</span><span class="mono">${formatPracticeMinutes(record.creditedSeconds, record.plannedTarget)}</span></div>
    <div class="stat-row"><span>Earned</span><span class="mono">${formatNumber(record.earned)} ν</span></div>
    ${record.breather ? `<div class="history-section">Breather</div>
    <p class="history-line">${formatClock(record.breather.seconds)} · ${record.breather.completed ? "completed" : "ended early"}</p>` : ""}
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

/* ── The notes modal (#277, #332) ──────────────────── */

// The notes modal's faces: CAPTURE leads — the modal opens on it — and
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

// The modal's rebuild signature: everything its body shows, hashed. The
// composer's draft is deliberately absent — a tab switch may drop it, but
// a tick never rebuilds the dialog out from under the typing. The mode is
// absent by the modal key's own shape (render.ts): pause and resume must
// never touch a standing draft.
export function notesModalKey(app: App): string {
  const { state, ui } = app;
  return JSON.stringify([
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
// The Scribe's mechanic is documented on the module itself (the
// forge readout), never as modal furniture.
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

// The modal's facetab row (#332): the two radio tabs, the state word
// closing the line — what a capture here would tag to.
export function notesModalTabsHtml(app: App): string {
  const face = app.ui.notesFace;
  const tabs = NOTES_TABS.map(
    ([key, label]) =>
      `<button class="ftab${key === face ? " active" : ""}" data-notes-face="${key}" aria-pressed="${key === face}">${label}</button>`,
  ).join("");
  return `<div class="facetabs notes-modal-tabs" role="group" aria-label="Notes faces">${tabs}<span class="notes-modal-state mono">${notesStateWord(app)}</span></div>`;
}

// The standing face's body: the composer on CAPTURE, the stream on LOGGED.
export function notesModalBodyHtml(app: App): string {
  return app.ui.notesFace === "capture" ? notesCaptureHtml(app) : notesLoggedHtml(app);
}

// The notes modal's wiring (issue #332): the facetabs, and the composer —
// capture rides the button and ⌘/Ctrl+Enter, a successful save refocuses
// the fresh composer, and Escape dismisses the dialog even from the
// composer (modality demands a keyboard exit; a dismissal drops the draft
// as every departure always has). The close rides the modal layer's own
// ✕ (render.ts's wireClose), and the focus ring rides app.ts's dialog
// binding. No tooltip layer here: the modal carries no deeper mechanics.
export function bindNotesModal(app: App, scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>("[data-notes-face]").forEach((button) => {
    app.listen(button, "click", () => {
      const face = button.getAttribute("data-notes-face") as NotesFace | null;
      if (!face) return;
      app.showNotesFace(face);
      // The rebuild replaces the tab row; keep the press on the fresh tab.
      scope.querySelector<HTMLElement>(`[data-notes-face="${face}"]`)?.focus();
    });
  });
  const composer = scope.querySelector("#note-composer") as HTMLTextAreaElement | null;
  const saveNote = () => {
    if (!composer) return;
    app.addNote(composer.value);
    // A successful save rebuilds the dialog with a fresh composer; refocus it.
    const fresh = scope.querySelector("#note-composer") as HTMLTextAreaElement | null;
    if (fresh) fresh.focus();
  };
  app.listen(scope.querySelector("#note-save"), "click", saveNote);
  app.listen(composer, "keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter" && ((event as KeyboardEvent).metaKey || (event as KeyboardEvent).ctrlKey)) {
      event.preventDefault();
      saveNote();
    }
    if ((event as KeyboardEvent).key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      app.closeModal();
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
// HISTORY counts the records. During a session the head names the mode —
// running, or paused — the panel's own read beside its name.
function sheetStateWord(app: App): string {
  const { state } = app;
  const face = focusFaceOf(app);
  if (state.mode === "paused") return "paused";
  if (state.mode === "breather") return "breathing";
  if (state.mode !== "upgrade") return "running";
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

// The one sheet frame the Focus control sheet wears (ADR-0050; Notes left
// for its own modal, #332): the clipped plate anchored beneath the clock —
// head with the name and the prominent state read beside it, the facetab
// row, the close — over the standing face's body.
function sheetFrameHtml(label: string, name: string, stateWord: string, tabs: string, body: string): string {
  return `<div class="app-popover focus-sheet" id="app-popover"><section class="inst-panel" aria-label="${label}"><div class="inst-panel-face focus-sheet-face">
    <div class="focus-head">
      <span class="focus-name t-condensed">${name}</span>
      <span class="focus-state t-condensed">${stateWord}</span>
      <button class="quiet small icon-btn focus-close" id="focus-close" aria-label="Close the ${label}" title="Close"><svg viewBox="-10 -10 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M-6-6 6 6M6-6-6 6"/></svg></button>
    </div>
    <div class="facetabs" role="group" aria-label="${label} faces">${tabs}</div>
    ${body}
  </div></section></div>`;
}

export function focusSheetHtml(app: App): string {
  const face = focusFaceOf(app);
  let body: string;
  if (face === "plan") body = planFaceHtml(app);
  else if (face === "habit") body = habitFaceHtml(app);
  else if (face === "goals") body = goalsFaceHtml(app);
  else body = app.ui.drillSession !== null ? historyDrillHtml(app) : historyListHtml(app);
  const tabs = FACE_TABS.map(
    ([key, label]) =>
      `<button class="ftab${key === face ? " active" : ""}" data-face="${key}" aria-pressed="${key === face}">${label}</button>`,
  ).join("");
  return sheetFrameHtml("Focus control sheet", "FOCUS", sheetStateWord(app), tabs, body);
}

/* ── The plan surfaces' in-place patchers ──────────── */

// The plan surfaces a control-driven change must reach without a render
// (#115): the sheet's own controls, the ready read's goals count, and the
// console clock — the planned duration's one readout. Every patch is an
// in-place text/class/attribute swap on surviving nodes, so focus, open
// dropdowns, and scroll all ride through untouched.
export function refreshPlanState(app: App): void {
  refreshPlanControls(app);
  refreshConsoleClockPlan(app);
  setText(document.getElementById("focus-plan-read"), goalsTrackedRead(app.state));
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
    input.disabled = open;
  }
  const openButton = document.getElementById("plan-open");
  openButton?.classList.toggle("active", open);
  openButton?.setAttribute("aria-pressed", String(open));
}

/* ── The live patcher ──────────────────────────────── */

// Values that move during flow without rebuilding the sheet: the HABIT
// face's live session read, the active pair's practice-roll meter, the
// practice tallies, and goal progress. The PLAN face carries no live
// figures — the console clock owns time.
export function updateFocusSheetLive(app: App, scope: ParentNode): void {
  const { state } = app;
  // Palette changes patch the standing pick, keeping form values and focus.
  for (const swatch of scope.querySelectorAll<HTMLElement>("[data-goal-draft-color]")) {
    const selected = swatch.getAttribute("data-goal-draft-color") === app.ui.goalColor;
    swatch.classList.toggle("selected", selected);
    swatch.setAttribute("aria-pressed", String(selected));
  }
  if (state.mode !== "upgrade") {
    const elapsed = state.session?.elapsed ?? 0;
    setText(scope.querySelector('[data-live="focus-habit-session"]'), `${formatClock(elapsed)} of practice`);
  }
  // The practice-roll meters (issue #423): every rendered pair's track and
  // line patch in place — the active one moves during flow, the frozen
  // pairs never do, and both read through the one builder.
  const habitById = new Map(state.habits.map((habit) => [habit.id, habit] as const));
  for (const track of scope.querySelectorAll<HTMLElement>('[data-live="class-meter-track"]')) {
    const habit = habitById.get(track.getAttribute("data-habit") ?? "");
    if (!habit) continue;
    const { threshold, fill, line } = classMeterRead(habit);
    const pip = track.querySelector<HTMLElement>('[data-live="class-meter-pip"]');
    if (pip && pip.style.width !== fill) pip.style.width = fill;
    track.setAttribute("aria-valuemax", String(threshold));
    track.setAttribute("aria-valuenow", String(Math.max(0, pairOf(habit).rollMeter.progress)));
    track.setAttribute("aria-valuetext", line);
  }
  for (const line of scope.querySelectorAll<HTMLElement>('[data-live="class-meter-line"]')) {
    const habit = habitById.get(line.getAttribute("data-habit") ?? "");
    if (!habit) continue;
    setText(line, classMeterRead(habit).line);
  }
  for (const habit of state.habits) {
    const node = scope.querySelector(`[data-habit-seconds="${habit.id}"]`);
    const display = formatDuration(habit.seconds);
    if (node && node.textContent !== display) node.textContent = display;
  }
  for (const goal of activeGoals(state)) {
    const required = goalRequiredSeconds(goal);
    const bar = scope.querySelector(`[data-goal-progress="${goal.id}"]`) as HTMLElement | null;
    const barHeight = goalBarHeight(goal);
    if (bar && bar.style.height !== barHeight) bar.style.height = barHeight;
    setText(
      scope.querySelector(`[data-goal-minutes="${goal.id}"]`),
      `${formatDuration(goal.progressSeconds)} / ${formatDuration(required)}${goal.completedCount > 0 ? ` · ×${goal.completedCount} completed` : ""}`,
    );
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
  // The console header is authoritative for flow: the sheet adds no
  // start/end control — the main switch enters from the standing PLAN face
  // (#280, re-clicked by #311) and ends the session.
  // The PLAN face's habit chips (#311): one tap switches the session
  // habit — "none selected" runs unstructured — and the add chip walks to
  // the HABIT face, where create and edit live.
  scope.querySelectorAll<HTMLElement>("[data-habit-pick]").forEach((chip) => {
    app.listen(chip, "click", () => {
      const id = chip.getAttribute("data-habit-pick");
      app.selectHabitAction(id === "" ? null : id);
    });
  });
  app.listen(scope.querySelector("#habit-add-chip"), "click", () => app.showFocusFace("habit"));
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
  // The class layer (issue #423): the wear chips select between classes,
  // the tree nodes take points, respec returns them, presets apply as
  // ordinary allocations — every engine gate answers for mode and budget.
  scope.querySelectorAll<HTMLElement>("[data-class-pick]").forEach((button) => {
    app.listen(button, "click", () => {
      const classId = button.getAttribute("data-class-pick");
      const habitId = button.getAttribute("data-habit");
      if (classId && habitId) app.selectHabitClassAction(habitId, classId as ClassId);
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-class-allocate]").forEach((button) => {
    app.listen(button, "click", () => {
      const nodeId = button.getAttribute("data-class-allocate");
      const habitId = button.getAttribute("data-habit");
      if (nodeId && habitId) app.allocateClassNodeAction(habitId, nodeId);
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-class-respec]").forEach((button) => {
    app.listen(button, "click", () => {
      const habitId = button.getAttribute("data-class-respec");
      if (habitId) app.respecClassTreeAction(habitId);
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-class-preset]").forEach((button) => {
    app.listen(button, "click", () => {
      const presetId = button.getAttribute("data-class-preset");
      const habitId = button.getAttribute("data-habit");
      if (presetId && habitId) app.applyClassPresetAction(habitId, presetId);
    });
  });
  // Goals: delete rides the rows, create is an on-demand form with the
  // palette picked on it. Goals are habit-owned (issue #423): the form's
  // select carries the roster with no any-habit escape, and the engine
  // answers for the habit's own slot capacity.
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
      app.ui.goalColor,
    );
  });
  // The palette (issue #312): the create form's draft pick stands until a
  // goal lands; a row's re-pick opens the same six and lands through the
  // engine's gate.
  scope.querySelectorAll<HTMLElement>("[data-goal-draft-color]").forEach((button) => {
    app.listen(button, "click", () => {
      const key = button.getAttribute("data-goal-draft-color") as GoalColor | null;
      if (key) app.pickGoalColor(key);
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-goal-recolor]").forEach((button) => {
    app.listen(button, "click", () => {
      const id = button.getAttribute("data-goal-recolor");
      if (id) app.toggleGoalRecolor(id);
    });
  });
  scope.querySelectorAll<HTMLElement>("[data-goal-set-color]").forEach((button) => {
    app.listen(button, "click", () => {
      const id = button.closest("[data-goal]")?.getAttribute("data-goal") ?? null;
      const key = button.getAttribute("data-goal-set-color") as GoalColor | null;
      if (id && key) app.setGoalColorAction(id, key);
    });
  });
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
