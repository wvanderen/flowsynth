// The status monitor (ADR-0015, §6.2): the full-width horizon rail beneath
// the board — the live formula chip docked on its top edge, the Arete
// accumulator spanning beneath (the Forge meter lives on the toolbar's
// Forge tool). The accumulator is the monitor: a log-scale fill on lifetime
// total nous earned toward the horizon line, with inert decade
// graduations, a practice-relative beat readout riding the fill head, and
// the reserved prestige button beneath.
import { ARETE_GRADUATIONS, ARETE_HORIZON, accumulatorFill, nextAccumulatorMark } from "../engine/accumulator";
import { achievementBoostOf } from "../engine/achievements";
import { BALANCE } from "../engine/constants";
import { computeRates } from "../engine/economy";
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

function termIcon(type: "carrier" | "additive" | "infusor"): string {
  return `<svg viewBox="-18 -18 36 36" aria-hidden="true" fill="none" stroke-width="1.6">${moduleIcon(type)}</svg>`;
}

// The chip's amplitude legs (ADR-0020): one record per leg renders both the
// equation term and the breakdown row, so a future leg lands in one place.
// Conditional legs join only once their term is nonzero — the infusor leg
// appears with the first uplift that reaches a synth.
const AMP_LEGS = [
  { key: "carrier", icon: "carrier", name: "Carrier", note: "the origin synth's fundamental", always: true },
  { key: "harmonics", icon: "additive", name: "Harmonics", note: "every other synth on the board", always: true },
  { key: "inf", icon: "infusor", name: "Infusors", note: "adjacent uplift on the synths", always: false },
] as const;

function ampEquationHtml(infused: boolean): string {
  return AMP_LEGS.filter((leg) => leg.always || infused)
    .map(
      (leg, i) =>
        `${i > 0 ? '<span class="op">+</span>' : ""}<span class="monitor-term" title="${leg.name} — ${leg.note}">${termIcon(leg.icon)}<span data-live="m-${leg.key}"></span></span>`,
    )
    .join("");
}

function ampBreakdownHtml(infused: boolean): string {
  return AMP_LEGS.filter((leg) => leg.always || infused)
    .map(
      (leg) =>
        `<div class="monitor-breakdown-row"><span class="bk-name">${leg.name}</span><span class="mono" data-live="b-${leg.key}"></span><span class="bk-note">${leg.note}</span></div>`,
    )
    .join("");
}

function formulaChipHtml(boosted: boolean, infused: boolean): string {
  return `
    <div class="monitor-chip monitor-formula" tabindex="0" aria-label="Live nous formula — focus for the breakdown">
      <span class="monitor-equation mono">
        <span class="op">(</span>${ampEquationHtml(infused)}
        <span class="op">)</span>
        <span class="op">×</span><span class="monitor-term" title="Chord terms — hover for the breakdown"><span class="term-glyph">χ</span><span data-live="m-chi"></span></span>
        <span class="op">×</span><span class="monitor-term" title="Charge empowerment — continuous while modules receive charge"><span class="term-glyph">emp</span><span data-live="m-emp"></span></span>
        ${boosted ? `<span class="op">×</span><span class="monitor-term" title="Achievements — each feat adds into the boost"><span class="term-glyph">ach</span><span data-live="m-ach"></span></span>` : ""}
        <span class="op">=</span><strong data-live="m-rate"></strong>
      </span>
      <span class="monitor-hint" aria-hidden="true">ⓘ</span>
      <div class="monitor-breakdown" role="tooltip">
        ${ampBreakdownHtml(infused)}
        <div class="monitor-breakdown-row"><span class="bk-name">Chords</span><span class="mono" data-live="b-chords"></span><span class="bk-note" data-live="b-chord-note"></span></div>
        <div class="monitor-breakdown-row"><span class="bk-name">Empowerment</span><span class="mono" data-live="b-emp"></span><span class="bk-note">charge uplift on charged modules</span></div>
        <div class="monitor-breakdown-row"><span class="bk-name">Achievements</span><span class="mono" data-live="b-ach"></span><span class="bk-note">each feat adds into the boost</span></div>
        <div class="monitor-breakdown-row total"><span class="bk-name">Rate</span><span class="mono" data-live="b-rate"></span><span class="bk-note">composite × empowerment × achievements</span></div>
      </div>
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
  const snapshot = computeRates(state, true);
  // Structural key: the era flip, the prestige acknowledgment, the
  // achievement term joining the chip equation (first feat), and the
  // infusor term joining it (first adjacent uplift) rebuild the rail; every
  // tick-moving value updates in place below so hover popovers and buttons
  // survive clock ticks.
  const achieving = achievementBoostOf(state) > 1;
  const infused = snapshot.infusors > 0;
  const key = `${past ? "past" : "under"}:${state.horizonAcknowledged ? "acked" : "open"}:${achieving ? "ach" : "plain"}:${infused ? "inf" : "plain"}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `
      <div class="monitor-top">${formulaChipHtml(achieving, infused)}</div>
      ${accumulatorHtml(state, past)}`;
    byId("prestige-button")?.addEventListener("click", () => app.acknowledgeHorizon());
  }
  updateMonitorLive(app, past, snapshot);
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function updateMonitorLive(app: App, past: boolean, snapshot: RateSnapshot): void {
  const host = byId("status-monitor");
  if (!host) return;
  const { state } = app;
  const set = (id: string, text: string) => {
    const node = host.querySelector(`[data-live="${id}"]`);
    if (node && node.textContent !== text) node.textContent = text;
  };

  // The formula chip: (carrier + harmonics [+ infusors]) × chords ×
  // empowerment × achievements → rate.
  set("m-carrier", formatNumber(snapshot.carrier));
  set("m-harmonics", formatNumber(snapshot.harmonics));
  set("m-inf", formatNumber(snapshot.infusors));
  set("m-chi", formatNumber(snapshot.chordMultiplier));
  set("m-emp", formatNumber(snapshot.empowerment));
  set("m-ach", `+${Math.round((snapshot.achievementBoost - 1) * 100)}%`);
  set("m-rate", `${formatNumber(snapshot.rate)} ν/s`);
  set("b-carrier", `+${formatNumber(snapshot.carrier)} ν/s`);
  set("b-harmonics", `+${formatNumber(snapshot.harmonics)} ν/s`);
  set("b-inf", `+${formatNumber(snapshot.infusors)} ν/s`);
  set("b-chords", `×${formatNumber(snapshot.chordMultiplier)}`);
  set("b-chord-note", chordSummary(snapshot));
  set("b-emp", `×${formatNumber(snapshot.empowerment)}`);
  // The single legible achievements line (§6.3): "Achievements +26%".
  set("b-ach", `+${Math.round((snapshot.achievementBoost - 1) * 100)}%`);
  set("b-rate", `${formatNumber(snapshot.rate)} ν/s`);

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
    if (head.textContent !== beat) head.textContent = beat;
    head.classList.toggle("flip", pos > HEAD_FLIP_AT);
    // The pill rides the fill head but must stay on the rail: clamp the
    // anchor so the readout never hangs off either edge, whatever its text
    // width and whatever fill fraction the log scale reports.
    const rail = host.querySelector<HTMLElement>(".monitor-rail");
    if (rail) {
      const railWidth = rail.clientWidth;
      const margin = 4;
      let anchorPx = pos * railWidth;
      if (pos > HEAD_FLIP_AT) {
        anchorPx = Math.min(anchorPx, railWidth - head.offsetWidth - margin);
      } else {
        anchorPx = Math.max(anchorPx, head.offsetWidth / 2 + margin);
      }
      const left = `${((anchorPx / railWidth) * 100).toFixed(2)}%`;
      if (head.style.left !== left) head.style.left = left;
    }
  }
  set("m-beat", past ? "Arete minted — the horizon is behind you" : "");
  set("m-secondary", `${state.sessionsCompleted} sessions · Arete ${state.arete}`);
}
