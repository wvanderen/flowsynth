// The status monitor (ADR-0015, §6.2): the full-width horizon rail beneath
// the board, carrying exactly three elements — the live formula chip and the
// Forge progress meter docked as chips on its top edge, the Arete
// accumulator spanning beneath. The accumulator is the monitor: a log-scale
// fill on lifetime total nous earned toward the horizon line, with inert
// decade graduations, a practice-relative beat readout riding the fill head,
// and the reserved prestige button beneath. The grid overview panel and the
// static formula explainer this rail replaces are dissolved (issue #38).
import { ARETE_GRADUATIONS, ARETE_HORIZON, accumulatorFill, nextAccumulatorMark } from "../engine/accumulator";
import { achievementBoostOf } from "../engine/achievements";
import { BALANCE } from "../engine/constants";
import { computeRates } from "../engine/economy";
import { forgeThreshold } from "../engine/rolls";
import type { GameState, RateSnapshot } from "../engine/types";
import type { App } from "./app";
import { moduleIcon } from "./icons";
import { formatCountdown, formatNumber } from "./format";

// Past this fill fraction the beat readout flips to right-anchoring so it
// never clips at the rail's right edge (prototype tuning).
const HEAD_FLIP_AT = 0.68;

// Compact axis vocabulary for the graduation marks and the beat's mark name.
function markLabel(mark: number): string {
  return mark >= 1000 ? `${mark / 1000}k` : String(mark);
}

// The practice-relative beat: what the next mark is and how much practice
// reaches it at the current rate. The rate basis is the board's projected
// charged rate (§7's countdown basis) — the live rate during flow.
function beatReadout(totalEarned: number, rate: number): string {
  const mark = nextAccumulatorMark(totalEarned);
  const label = mark === ARETE_HORIZON ? "the horizon" : markLabel(mark);
  if (!(rate > 0)) return `next mark ${label} · waits for practice`;
  return `next mark ${label} · ≈${formatCountdown((mark - totalEarned) / rate)} of practice at this rate`;
}

function chordSummary(snapshot: RateSnapshot): string {
  const lines = [
    ...snapshot.namedChords.map((c) => `${c.name} ×${formatNumber(1 + c.bonus)}`),
    ...(snapshot.pairs.length > 0 ? [`${snapshot.pairs.length} chord pair${snapshot.pairs.length === 1 ? "" : "s"} ×${formatNumber(1 + BALANCE.pairBonus)} each`] : []),
  ];
  return lines.length > 0 ? lines.join(" · ") : "no chords yet — adjacent synthesizers one pitch apart chord";
}

function termIcon(type: "carrier" | "additive"): string {
  return `<svg viewBox="-18 -18 36 36" aria-hidden="true" fill="none" stroke-width="1.6">${moduleIcon(type)}</svg>`;
}

function formulaChipHtml(boosted: boolean): string {
  return `
    <div class="monitor-chip monitor-formula" tabindex="0" aria-label="Live nous formula — focus for the breakdown">
      <span class="monitor-equation mono">
        <span class="op">(</span><span class="monitor-term" title="Carrier — the origin synth's fundamental">${termIcon("carrier")}<span data-live="m-carrier"></span></span>
        <span class="op">+</span><span class="monitor-term" title="Harmonics — every other synth on the board">${termIcon("additive")}<span data-live="m-harmonics"></span></span>
        <span class="op">)</span>
        <span class="op">×</span><span class="monitor-term" title="Chord terms — hover for the breakdown"><span class="term-glyph">χ</span><span data-live="m-chi"></span></span>
        <span class="op">×</span><span class="monitor-term" title="Charge empowerment — continuous while modules receive charge"><span class="term-glyph">emp</span><span data-live="m-emp"></span></span>
        ${boosted ? `<span class="op">×</span><span class="monitor-term" title="Achievements — each feat adds into the boost"><span class="term-glyph">ach</span><span data-live="m-ach"></span></span>` : ""}
        <span class="op">=</span><strong data-live="m-rate"></strong>
      </span>
      <span class="monitor-hint" aria-hidden="true">ⓘ</span>
      <div class="monitor-breakdown" role="tooltip">
        <div class="monitor-breakdown-row"><span class="bk-name">Carrier</span><span class="mono" data-live="b-carrier"></span><span class="bk-note">the origin synth's fundamental</span></div>
        <div class="monitor-breakdown-row"><span class="bk-name">Harmonics</span><span class="mono" data-live="b-harmonics"></span><span class="bk-note">every other synth on the board</span></div>
        <div class="monitor-breakdown-row"><span class="bk-name">Chords</span><span class="mono" data-live="b-chords"></span><span class="bk-note" data-live="b-chord-note"></span></div>
        <div class="monitor-breakdown-row"><span class="bk-name">Empowerment</span><span class="mono" data-live="b-emp"></span><span class="bk-note">charge uplift on charged modules</span></div>
        <div class="monitor-breakdown-row"><span class="bk-name">Achievements</span><span class="mono" data-live="b-ach"></span><span class="bk-note">each feat adds into the boost</span></div>
        <div class="monitor-breakdown-row total"><span class="bk-name">Rate</span><span class="mono" data-live="b-rate"></span><span class="bk-note">composite × empowerment × achievements</span></div>
      </div>
    </div>`;
}

function forgeChipHtml(): string {
  return `
    <div class="monitor-chip monitor-forge" title="All deployed Forges feed one shared meter — banked rolls wait on the Forge surface">
      <span class="monitor-chip-label">Forge</span>
      <span class="monitor-forge-track"><i data-live="m-forge-fill"></i></span>
      <span class="monitor-forge-val mono"><span data-live="m-forge-progress"></span> / <span data-live="m-forge-cap"></span></span>
    </div>`;
}

// The Arete accumulator: the rail with its fill, inert decade graduations,
// the horizon cap, the riding beat head, and the reserved prestige button.
function accumulatorHtml(state: GameState, past: boolean): string {
  const graduations = ARETE_GRADUATIONS.map(
    (mark) => `<i class="monitor-grad" style="left:${(accumulatorFill(mark) * 100).toFixed(2)}%"><b>${markLabel(mark)}</b></i>`,
  ).join("");
  const prestige = state.horizonAcknowledged
    ? `<button class="monitor-prestige" id="prestige-button" disabled title="The horizon is acknowledged. Prestige itself waits beyond it.">Acknowledged</button>`
    : `<button class="monitor-prestige" id="prestige-button" title="Reserved for prestige — arriving beyond the horizon. Pressing acknowledges the horizon.">Prestige</button>`;
  return `
    <div class="monitor-rail" role="img">
      <i class="monitor-fill" data-live="m-fill"></i>
      ${graduations}
      <i class="monitor-horizon" title="The horizon · ${markLabel(ARETE_HORIZON)} lifetime ν"></i>
      ${past ? "" : `<span class="monitor-head mono" data-live="m-head"></span>`}
    </div>
    <div class="monitor-under">
      ${prestige}
      <span class="monitor-beat${past ? " minted" : ""}" data-live="m-beat"></span>
      <span class="monitor-secondary mono" data-live="m-secondary"></span>
    </div>`;
}

export function renderStatusMonitor(app: App): void {
  const host = document.getElementById("status-monitor");
  if (!host) return;
  const { state } = app;
  const past = state.totalEarned >= ARETE_HORIZON;
  // Structural key: the era flip, the prestige acknowledgment, and the
  // achievement term joining the chip equation (first feat) rebuild the
  // rail; every tick-moving value updates in place below so hover popovers
  // and buttons survive clock ticks.
  const achieving = achievementBoostOf(state) > 1;
  const key = `${past ? "past" : "under"}:${state.horizonAcknowledged ? "acked" : "open"}:${achieving ? "ach" : "plain"}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `
      <div class="monitor-top">${formulaChipHtml(achieving)}${forgeChipHtml()}</div>
      ${accumulatorHtml(state, past)}`;
    byId("prestige-button")?.addEventListener("click", () => app.acknowledgeHorizon());
  }
  updateMonitorLive(app, past);
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function updateMonitorLive(app: App, past: boolean): void {
  const host = byId("status-monitor");
  if (!host) return;
  const { state } = app;
  const snapshot = computeRates(state, true);
  const set = (id: string, text: string) => {
    const node = host.querySelector(`[data-live="${id}"]`);
    if (node && node.textContent !== text) node.textContent = text;
  };

  // The formula chip: (carrier + harmonics) × chords × empowerment → rate.
  set("m-carrier", formatNumber(snapshot.carrier));
  set("m-harmonics", formatNumber(snapshot.harmonics));
  set("m-chi", formatNumber(snapshot.chordMultiplier));
  set("m-emp", formatNumber(snapshot.empowerment));
  set("m-ach", `+${Math.round((snapshot.achievementBoost - 1) * 100)}%`);
  set("m-rate", `${formatNumber(snapshot.rate)} ν/s`);
  set("b-carrier", `+${formatNumber(snapshot.carrier)} ν/s`);
  set("b-harmonics", `+${formatNumber(snapshot.harmonics)} ν/s`);
  set("b-chords", `×${formatNumber(snapshot.chordMultiplier)}`);
  set("b-chord-note", chordSummary(snapshot));
  set("b-emp", `×${formatNumber(snapshot.empowerment)}`);
  // The single legible achievements line (§6.3): "Achievements +26%".
  set("b-ach", `+${Math.round((snapshot.achievementBoost - 1) * 100)}%`);
  set("b-rate", `${formatNumber(snapshot.rate)} ν/s`);

  // The Forge chip: the shared meter's progress toward the next roll.
  const cap = forgeThreshold(state.forge.earned);
  const forgeFill = host.querySelector<HTMLElement>('[data-live="m-forge-fill"]');
  const forgeWidth = `${(Math.min(1, Math.max(0, state.forge.progress / cap)) * 100).toFixed(1)}%`;
  if (forgeFill && forgeFill.style.width !== forgeWidth) forgeFill.style.width = forgeWidth;
  set("m-forge-progress", formatNumber(Math.max(0, state.forge.progress)));
  set("m-forge-cap", formatNumber(cap));

  // The accumulator: log-scale fill, riding beat head, secondaries.
  const pos = accumulatorFill(state.totalEarned);
  const fill = host.querySelector<HTMLElement>('[data-live="m-fill"]');
  const fillWidth = `${(pos * 100).toFixed(2)}%`;
  if (fill && fill.style.width !== fillWidth) fill.style.width = fillWidth;
  host.querySelector(".monitor-rail")?.setAttribute(
    "aria-label",
    `Arete accumulator: ${formatNumber(state.totalEarned)} of ${markLabel(ARETE_HORIZON)} lifetime ν, log scale`,
  );
  const beat = beatReadout(state.totalEarned, snapshot.rate);
  const head = host.querySelector<HTMLElement>('[data-live="m-head"]');
  if (head) {
    const left = `${Math.min(96, Math.max(3, pos * 100)).toFixed(2)}%`;
    if (head.style.left !== left) head.style.left = left;
    head.classList.toggle("flip", pos > HEAD_FLIP_AT);
    if (head.textContent !== beat) head.textContent = beat;
  }
  set("m-beat", past ? "Arete minted — the horizon is behind you" : "");
  set("m-secondary", `${state.sessionsCompleted} sessions · Arete ${state.arete}`);
}
