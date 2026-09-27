// The board's production surfaces (§7): the ledger strip docked above the
// board, the formula disclosed only from its Rate cell, the Arete pill
// floating over the board's bottom edge, and the phone's game-info strip.
// The status monitor dissolved into these; the console carries no readouts.
import { ARETE_GRADUATIONS, ARETE_HORIZON, accumulatorFill, nextAccumulatorMark } from "../engine/accumulator";
import { ACHIEVEMENTS, achievementBoostOf } from "../engine/achievements";
import { computeRates } from "../engine/economy";
import type { GameState, RateSnapshot } from "../engine/types";
import type { App } from "./app";
import { FORMULA_BREAKPOINT_PX, containerWidth } from "./container";
import { moduleIcon } from "./icons";
import { chordTermLabel, formatCountdown, formatInt, formatNumber } from "./format";
import { liveSet } from "./live";

// Compact axis vocabulary for the graduation marks and the beat's mark name.
function markLabel(mark: number): string {
  return mark >= 1000 ? `${mark / 1000}k` : String(mark);
}

export function unlockedCount(state: GameState): number {
  return Object.keys(state.achievements).length;
}

// ── The formula: one record per leg ─────────────────────────────────────
// The chip's amplitude legs (ADR-0020 as amended by ADR-0022): one record
// per leg renders both the equation term and the breakdown row, so a future
// leg lands in one place. The synths leg is every synthesizer's unified
// base term; the infusor leg joins only once uplift reaches a synth.
const AMP_LEGS = [
  { key: "synths", icon: "additive", name: "Synths", note: "every synthesizer's base term", always: true },
  { key: "inf", icon: "infusor", name: "Infusors", note: "adjacent uplift on the synths", always: false },
] as const;

function termIcon(type: "additive" | "infusor"): string {
  return `<svg viewBox="-18 -18 36 36" aria-hidden="true" fill="none" stroke-width="1.6">${moduleIcon(type)}</svg>`;
}

function ampEquationHtml(infused: boolean): string {
  return AMP_LEGS.filter((leg) => leg.always || infused)
    .map(
      (leg, i) =>
        `${i > 0 ? '<span class="op">+</span>' : ""}<span class="rate-term" title="${leg.name} — ${leg.note}">${termIcon(leg.icon)}<span data-live="m-${leg.key}"></span></span>`,
    )
    .join("");
}

export function ampBreakdownHtml(infused: boolean): string {
  return AMP_LEGS.filter((leg) => leg.always || infused)
    .map(
      (leg) =>
        `<div class="rate-breakdown-row"><span class="bk-name">${leg.name}</span><span class="mono" data-live="b-${leg.key}"></span><span class="bk-note">${leg.note}</span></div>`,
    )
    .join("");
}

// The breakdown's legs below the amp legs — one record per row, the
// AMP_LEGS pattern extended across the roster. The Rate cell's hover
// popover and the formula sheet both render it, so the wording lands in
// one place: the popover mounts live slots the tick fills (the chords note
// moves as chords form), the sheet prints the snapshot outright.
interface RateRow {
  key: string;
  name: string;
  note: string | ((snapshot: RateSnapshot) => string);
  liveNote?: boolean;
  total?: boolean;
}

const RATE_ROWS: RateRow[] = [
  { key: "chords", name: "Chords", note: (snapshot) => chordSummary(snapshot), liveNote: true },
  { key: "emp", name: "Empowerment", note: "charge uplift on charged modules" },
  { key: "ach", name: "Achievements", note: "each feat adds into the boost" },
  { key: "rate", name: "Rate", note: "composite × empowerment × achievements", total: true },
];

function rowNote(row: RateRow, snapshot: RateSnapshot): string {
  return typeof row.note === "function" ? row.note(snapshot) : row.note;
}

// A row's printed value: the multiplier, the uplift percent, or the total.
function breakdownValue(key: string, snapshot: RateSnapshot): string {
  if (key === "chords") return `×${formatNumber(snapshot.chordMultiplier)}`;
  if (key === "emp") return `×${formatNumber(snapshot.empowerment)}`;
  if (key === "ach") return `+${Math.round((snapshot.achievementBoost - 1) * 100)}%`;
  return `${formatNumber(snapshot.rate)} ν/s`;
}

// The sheet's breakdown roster, snapshot printed (the amp legs render
// ahead of it via ampBreakdownHtml).
export function breakdownRowsHtml(snapshot: RateSnapshot): string {
  return RATE_ROWS.map(
    (row) =>
      `<div class="rate-breakdown-row${row.total ? " total" : ""}"><span class="bk-name">${row.name}</span><span class="mono">${breakdownValue(row.key, snapshot)}</span><span class="bk-note">${rowNote(row, snapshot)}</span></div>`,
  ).join("");
}

export function chordSummary(snapshot: RateSnapshot): string {
  const lines = snapshot.namedChords.map(chordTermLabel);
  return lines.length > 0 ? lines.join(" · ") : "no chords yet — chords are named pitch sets over connected synths";
}

// The Rate cell: the operand chain ending in the live total. Above the 760px
// breakpoint this collapsed equation IS the rate display — no separate ν/s
// figure — and hover or focus discloses the value breakdown. Below it the
// equation hides, the bare total stands alone, and a tap opens the full
// formula as a modal sheet over a scrim.
function rateCellHtml(achieving: boolean, infused: boolean): string {
  return `<button class="prod-cell prod-cell-rate" id="rate-cell" title="Rate — the live formula; hover for the breakdown">
    <span class="prod-label">Rate</span>
    <span class="rate-equation mono" aria-label="Live rate formula">
      <span class="op">(</span>${ampEquationHtml(infused)}
      <span class="op">)</span>
      <span class="op">×</span><span class="rate-term" title="Chord terms — hover for the breakdown"><span class="term-glyph">χ</span><span data-live="m-chi"></span></span>
      <span class="op">×</span><span class="rate-term" title="Charge empowerment — continuous while modules receive charge"><span class="term-glyph">emp</span><span data-live="m-emp"></span></span>
      ${achieving ? `<span class="op">×</span><span class="rate-term" title="Achievements — each feat adds into the boost"><span class="term-glyph">ach</span><span data-live="m-ach"></span></span>` : ""}
      <span class="op">=</span><strong data-live="m-rate"></strong>
    </span>
    <strong class="mono rate-total" data-live="rate"></strong>
    <span class="rate-hint" aria-hidden="true">ⓘ</span>
    <span class="rate-breakdown" role="tooltip">
      ${ampBreakdownHtml(infused)}
      ${RATE_ROWS.map(
        (row) =>
          `<div class="rate-breakdown-row${row.total ? " total" : ""}"><span class="bk-name">${row.name}</span><span class="mono" data-live="b-${row.key}"></span><span class="bk-note"${row.liveNote ? ' data-live="b-chord-note"' : ""}>${typeof row.note === "string" ? row.note : ""}</span></div>`,
      ).join("")}
    </span>
  </button>`;
}

export const FEATS_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
  <path d="M4 22h16"/>
  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
</svg>`;

export function featsChipHtml(count: number): string {
  return `<button class="feats-chip" id="feats-chip" title="Achievements — every feat, and how close the next one is">${FEATS_SVG}<span class="mono">${count}/${ACHIEVEMENTS.length} feats</span></button>`;
}

// ── The board ledger strip (§7) ─────────────────────────────────────────
// Nous / Rate / Session as one bordered instrument, the feats chip beside
// it, docked directly above the board. The console's readout end is gone.
// The 760px container breakpoint (§7): below it the Rate cell's equation
// hides and its tap opens the full formula as a modal sheet over a scrim.
// Above it the collapsed operand chain is ambient and hover discloses.
// The gate reads the container's own inline size — the number the
// stylesheet's @container rules respond to (container.ts holds it).
export function renderBoardLedger(app: App): void {
  const host = document.getElementById("board-ledger");
  if (!host) return;
  const { state } = app;
  const snapshot = computeRates(state, app.state.mode === "flow");
  const achieving = achievementBoostOf(state) > 1;
  const infused = snapshot.infusors > 0;
  const feats = unlockedCount(state);
  const key = `${achieving ? "ach" : "plain"}:${infused ? "inf" : "plain"}:${feats}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `<div class="prod-ledger" role="group" aria-label="Production">
        <div class="prod-cell"><span class="prod-label">Nous</span><strong class="mono" data-live="nous"></strong></div>
        ${rateCellHtml(achieving, infused)}
        <div class="prod-cell"><span class="prod-label">Session</span><strong class="mono" data-live="session"></strong></div>
      </div>
      ${featsChipHtml(feats)}`;
    document.getElementById("feats-chip")?.addEventListener("click", () => app.openModal("achievements"));
    document.getElementById("rate-cell")?.addEventListener("click", () => {
      if (containerWidth() < FORMULA_BREAKPOINT_PX) app.openModal("formula");
    });
  }
  updateLedgerLive(host, state, snapshot.rate, snapshot);
}

export function updateLedgerLive(scope: ParentNode, state: GameState, rate: number, snapshot?: RateSnapshot): void {
  const set = (live: string, text: string) => liveSet(scope, live, text);
  set("nous", `${formatInt(state.nous)} ν`);
  set("rate", `${formatNumber(rate)} ν/s`);
  set("session", state.session ? `${formatNumber(state.session.earned)} ν` : "—");
  if (!snapshot) return;
  // The equation's operand chain (§7): it ends in the live total, and that
  // collapsed equation is the rate display above the 760px breakpoint.
  set("m-synths", formatNumber(snapshot.synths));
  set("m-inf", formatNumber(snapshot.infusors));
  set("m-chi", formatNumber(snapshot.chordMultiplier));
  set("m-emp", formatNumber(snapshot.empowerment));
  set("m-ach", `+${Math.round((snapshot.achievementBoost - 1) * 100)}%`);
  set("m-rate", `${formatNumber(snapshot.rate)} ν/s`);
  set("b-synths", `+${formatNumber(snapshot.synths)} ν/s`);
  set("b-inf", `+${formatNumber(snapshot.infusors)} ν/s`);
  for (const row of RATE_ROWS) set(`b-${row.key}`, breakdownValue(row.key, snapshot));
  set("b-chord-note", chordSummary(snapshot));
}

// ── The phone game-info strip (§7) ──────────────────────────────────────
// Production reads on the board surface, where the tutorial helptext used
// to sit: ν, rate, session. Feats appears once on phone — riding the thumb
// bar — and the rate read is the strip's one tap: it opens the formula
// sheet, the door the ledger's Rate cell provides at every other width.
// The chain itself never goes ambient here — a 390px board has no room.
// Displayed only below the 600px breakpoint; values update every render.
export function renderGameInfoStrip(app: App): void {
  const host = document.getElementById("game-info-strip");
  if (!host) return;
  const { state } = app;
  if (!host.dataset.renderKey) {
    host.dataset.renderKey = "strip";
    host.innerHTML = `<span class="info-read"><small>ν</small> <strong class="mono" data-live="i-nous"></strong></span>
      <button class="info-read info-rate" id="info-rate" title="Rate — tap for the full formula"><strong class="mono" data-live="i-rate"></strong> <small>ν/s</small><span class="info-hint" aria-hidden="true">ⓘ</span></button>
      <span class="info-read"><small>session</small> <strong class="mono" data-live="i-session"></strong></span>`;
    document.getElementById("info-rate")?.addEventListener("click", () => app.openModal("formula"));
  }
  const set = (live: string, text: string) => liveSet(host, live, text);
  set("i-nous", formatInt(state.nous));
  set("i-rate", formatNumber(computeRates(state, state.mode === "flow").rate));
  set("i-session", state.session ? formatNumber(state.session.earned) : "—");
}

// ── The Arete pill (§7) ─────────────────────────────────────────────────
// The status monitor dissolved: the accumulator — log-scale rail,
// graduations, horizon cap, riding beat head, reserved prestige button —
// floats free as a translucent pill over the board's bottom edge at every
// width. Forge progress keeps riding the dock's Forge pip.
const HEAD_FLIP_AT = 0.68;

// The practice-relative beat: what the next mark is and how much practice
// reaches it at the current rate. The rate basis is the board's projected
// charged rate — the live rate during flow.
function beatReadout(totalEarned: number, rate: number): string {
  const mark = nextAccumulatorMark(totalEarned);
  const label = mark === ARETE_HORIZON ? "the horizon" : markLabel(mark);
  if (!(rate > 0)) return `next mark ${label} · waits for practice`;
  return `next mark ${label} · ≈${formatCountdown((mark - totalEarned) / rate)} of practice at this rate`;
}

export function renderAretePill(app: App): void {
  const host = document.getElementById("arete-pill");
  if (!host) return;
  const { state } = app;
  const past = state.totalEarned >= ARETE_HORIZON;
  const snapshot = computeRates(state, state.mode === "flow");
  // Structural key: the era flip, the prestige acknowledgment, and the
  // graduation roster rebuild the pill; every tick-moving value updates in
  // place so the reserved button survives clock ticks.
  const key = `${past ? "past" : "under"}:${state.horizonAcknowledged ? "acked" : "open"}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    const graduations = ARETE_GRADUATIONS.map(
      (mark) => `<i class="pill-grad" style="left:${(accumulatorFill(mark) * 100).toFixed(2)}%"><b>${markLabel(mark)}</b></i>`,
    ).join("");
    const prestige = state.horizonAcknowledged
      ? `<button class="pill-prestige" id="prestige-button" disabled title="The horizon is acknowledged. Prestige itself waits beyond it.">Acknowledged</button>`
      : `<button class="pill-prestige" id="prestige-button" title="Reserved for prestige — arriving beyond the horizon. Pressing acknowledges the horizon.">Prestige</button>`;
    host.innerHTML = `<div class="pill-row"><span class="pill-name">ARETE</span><b class="mono" data-live="p-total"></b>${prestige}</div>
      <div class="pill-rail" role="img">
        <i class="pill-fill" data-live="p-fill"></i>
        ${graduations}
        <i class="pill-horizon" title="The horizon · ${markLabel(ARETE_HORIZON)} lifetime ν"></i>
        ${past ? "" : `<span class="pill-head mono" data-live="p-beat"></span>`}
      </div>`;
    document.getElementById("prestige-button")?.addEventListener("click", () => app.acknowledgeHorizon());
  }
  const set = (live: string, text: string) => liveSet(host, live, text);
  set("p-total", `${formatNumber(state.totalEarned)} / ${markLabel(ARETE_HORIZON)} ν lifetime`);
  const pos = accumulatorFill(state.totalEarned);
  const fill = host.querySelector<HTMLElement>('[data-live="p-fill"]');
  const fillWidth = `${(pos * 100).toFixed(2)}%`;
  if (fill && fill.style.width !== fillWidth) fill.style.width = fillWidth;
  host.querySelector(".pill-rail")?.setAttribute(
    "aria-label",
    `Arete accumulator: ${formatNumber(state.totalEarned)} of ${markLabel(ARETE_HORIZON)} lifetime ν, log scale`,
  );
  const beat = past ? "Arete minted — the horizon is behind you" : beatReadout(state.totalEarned, snapshot.rate);
  const head = host.querySelector<HTMLElement>('[data-live="p-beat"]');
  if (head) {
    if (head.textContent !== beat) head.textContent = beat;
    head.classList.toggle("flip", pos > HEAD_FLIP_AT);
    // The beat rides the fill head but must stay on the rail: clamp the
    // anchor so the readout never hangs off either edge.
    const rail = host.querySelector<HTMLElement>(".pill-rail");
    if (rail) {
      const railWidth = rail.clientWidth;
      if (railWidth > 0) {
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
  }
}
