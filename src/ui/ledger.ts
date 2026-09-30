// The board's production surfaces (§7): the ledger strip docked above the
// board, the module-linked rate details disclosed from its Rate cell, the
// ambient horizon bar riding the board's lower edge, and the phone's
// game-info strip. The status monitor dissolved into these; the console
// carries no readouts.
import { ARETE_HORIZON, accumulatorFill } from "../engine/accumulator";
import { ACHIEVEMENTS } from "../engine/achievements";
import { BALANCE, CATEGORY_OF, isSynthesizerType } from "../engine/constants";
import { chargedFactor, modulePower } from "../engine/economy";
import { noteNameOf } from "../engine/lattice";
import type { Contribution, GameState, ModuleInstance, RateSnapshot } from "../engine/types";
import type { App } from "./app";
import { chordTermLabel, formatBalance, formatFixed, formatInt, formatNumber } from "./format";
import { liveAttr, liveSet } from "./live";
import { META } from "./meta";

export function unlockedCount(state: GameState): number {
  return Object.keys(state.achievements).length;
}

// ── The module-linked rate details (§7) ────────────────────────────────
// The rate is a place, not a formula: one roster every disclosure channel
// shares — the Rate cell's hover/focus popover above the 760px breakpoint,
// and the sheet a tap opens at every width (the phone strip's read opens
// the same sheet). One row per synthesizer carries its final ν/s and
// expands into the base term with the local infusor, charge, chord, and
// achievement effects; nonproducing modules disclose what they do to
// others with no ν/s of their own to double-count. Both channels mount
// live slots the tick fills, so a clock tick never rebuilds (and never
// collapses) an open roster.
interface SynthLegs {
  base: number;
  chordMult: number;
  chordLabel: string;
  infusorBonus: number;
  chargeFactor: number;
  chargeStrength: number;
  boost: number;
}

// One synthesizer's decomposition, straight off its contribution: the
// legs multiply back to the final figure exactly —
// base × chordMult × (1 + infusor) × chargeFactor × boost = value.
function synthLegsOf(snapshot: RateSnapshot, contribution: Contribution, module: ModuleInstance): SynthLegs {
  const chordAmp = module.type === "conditional" ? 1 + BALANCE.conditionalChordBonus * contribution.chordTerms : 1;
  const terms = snapshot.namedChords.filter((chord) => chord.moduleIds.includes(contribution.moduleId)).map(chordTermLabel);
  return {
    base: BALANCE.synthRate * modulePower(module),
    // Synthesizers always chord: the engine sets a number here — null is
    // the non-chorders' mark, never a synth's.
    chordMult: chordAmp * (contribution.chordFactor ?? 1),
    chordLabel: terms.length > 0 ? terms.join(" · ") : "none",
    infusorBonus: contribution.infusorBonus,
    chargeFactor: contribution.chargeFactor,
    chargeStrength: contribution.chargeStrength,
    boost: snapshot.achievementBoost,
  };
}

// A nonproducing module's effect on the board, in the bloom's own
// vocabulary — never ν/s, so nothing here reads as a second producer.
function effectText(contribution: Contribution, module: ModuleInstance, snapshot: RateSnapshot): string {
  const category = CATEGORY_OF[contribution.type];
  if (category === "generator") return `⌁${formatNumber(modulePower(module))} charge`;
  if (category === "infusor") {
    const strength = snapshot.chargeStrength.get(contribution.moduleId) ?? 0;
    return `+${formatNumber(100 * BALANCE.infusorBonus * modulePower(module) * chargedFactor(strength))}% to adjacent`;
  }
  if (category === "forge") return `${formatNumber(contribution.value)} progress/s`;
  return "silent — conducts chords";
}

// The live-slot key scheme, one place: the roster builder and the tick's
// filler read the same spellings, so a rename can never land in one and
// not the other. Synth rows key per leg (`s-<id>-<leg>`), nonproducer rows
// carry their one effect (`n-<id>`), and `b-rate` is the total.
const RATE_TOTAL_SLOT = "b-rate";
const synthSlot = (id: string, leg: string): string => `s-${id}-${leg}`;
const otherSlot = (id: string): string => `n-${id}`;

// One record per row: the slot texts both the roster builder and the tick
// fill read, so a leg's wording lands in one place (the house pattern the
// old AMP_LEGS held). Keyed by slot suffix — `v` the final figure, the
// base/chd/inf/chg legs, `chgn` the charge note, `n` a nonproducer's
// effect.
function rowSlotTexts(snapshot: RateSnapshot, contribution: Contribution, module: ModuleInstance): Record<string, string> {
  if (isSynthesizerType(contribution.type)) {
    const legs = synthLegsOf(snapshot, contribution, module);
    return {
      v: `+${formatNumber(contribution.value)} ν/s`,
      base: `${formatNumber(legs.base)} ν/s`,
      chd: `×${formatNumber(legs.chordMult)}`,
      inf: `+${Math.round(legs.infusorBonus * 100)}%`,
      chg: `×${formatNumber(legs.chargeFactor)}`,
      chgn: legs.chargeStrength > 0 ? `⌁${formatNumber(legs.chargeStrength)} charge` : "",
    };
  }
  return { n: effectText(contribution, module, snapshot) };
}

// The deployed roster's identity — id, kind, level, rarity, cell — the
// structural key both the ledger strip and the rate sheet rebuild on (a
// move changes a note name, an upgrade a base figure).
export function deployedRosterKey(state: GameState): string {
  return state.modules
    .filter((m) => m.pos !== null)
    .map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}:${m.pos!.q},${m.pos!.r}`)
    .join("|");
}

// The roster both channels render. `live` mounts data-live slots the tick
// fills (updateRateDetailsLive); the sheet passes false and prints the
// snapshot outright.
export function rateDetailsHtml(state: GameState, snapshot: RateSnapshot, live: boolean): string {
  const val = (slot: string, content: string): string =>
    live ? `<span class="rd-val mono" data-live="${slot}"></span>` : `<span class="rd-val mono">${content}</span>`;
  const note = (slot: string, content: string): string =>
    live ? `<span class="rd-note" data-live="${slot}">${content}</span>` : `<span class="rd-note">${content}</span>`;

  const synths: string[] = [];
  const others: string[] = [];
  for (const contribution of snapshot.contributions.values()) {
    const module = state.modules.find((m) => m.id === contribution.moduleId);
    if (!module) continue;
    const slots = rowSlotTexts(snapshot, contribution, module);
    const id = contribution.moduleId;
    if (isSynthesizerType(contribution.type)) {
      const cellNote = contribution.pitch !== null ? noteNameOf(contribution.pitch) : "";
      synths.push(
        `<details class="rd-row rd-synth" data-module-id="${id}">` +
          `<summary><span class="rd-name">${META[contribution.type].name}</span>` +
          `<span class="rd-note mono">${cellNote}</span>` +
          val(synthSlot(id, "v"), slots.v!) +
          `</summary>` +
          `<div class="rd-legs">` +
          `<div class="rd-leg"><span class="rd-leg-name">Base</span>` +
          val(synthSlot(id, "base"), slots.base!) +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Chords</span>` +
          val(synthSlot(id, "chd"), slots.chd!) +
          `<span class="rd-note">${synthChordNote(snapshot, contribution, module)}</span>` +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Infusor</span>` +
          val(synthSlot(id, "inf"), slots.inf!) +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Charge</span>` +
          val(synthSlot(id, "chg"), slots.chg!) +
          note(synthSlot(id, "chgn"), slots.chgn!) +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Achievements</span>` +
          `<span class="rd-val mono">+${Math.round((snapshot.achievementBoost - 1) * 100)}%</span></div>` +
          `</div></details>`,
      );
    } else {
      others.push(
        `<div class="rd-row rd-other-row"><span class="rd-name">${META[contribution.type].name}</span>` +
          val(otherSlot(id), slots.n!) +
          `</div>`,
      );
    }
  }

  return (
    `<div class="rd-row rd-total"><span class="rd-name">Rate</span>` +
    val(RATE_TOTAL_SLOT, `${formatNumber(snapshot.rate)} ν/s`) +
    `</div>` +
    synths.join("") +
    (others.length > 0
      ? `<div class="rd-heading">Other modules — effects, no ν/s</div>${others.join("")}`
      : "")
  );
}

// The chords leg's named terms — they change only with the roster, so the
// note prints once at build time and never needs a slot of its own. The
// caller already holds the module; none is re-found here.
function synthChordNote(snapshot: RateSnapshot, contribution: Contribution, module: ModuleInstance): string {
  return synthLegsOf(snapshot, contribution, module).chordLabel;
}

// The details' live slots: one fill per render, keyed per module, from the
// same record the builder printed — the tick never rewords a leg.
export function updateRateDetailsLive(scope: ParentNode, state: GameState, snapshot: RateSnapshot): void {
  const set = (live: string, content: string) => liveSet(scope, live, content);
  set(RATE_TOTAL_SLOT, `${formatNumber(snapshot.rate)} ν/s`);
  for (const contribution of snapshot.contributions.values()) {
    const module = state.modules.find((m) => m.id === contribution.moduleId);
    if (!module) continue;
    const id = contribution.moduleId;
    const slots = rowSlotTexts(snapshot, contribution, module);
    if (isSynthesizerType(contribution.type)) {
      set(synthSlot(id, "v"), slots.v!);
      set(synthSlot(id, "base"), slots.base!);
      set(synthSlot(id, "chd"), slots.chd!);
      set(synthSlot(id, "inf"), slots.inf!);
      set(synthSlot(id, "chg"), slots.chg!);
      set(synthSlot(id, "chgn"), slots.chgn!);
    } else {
      set(otherSlot(id), slots.n!);
    }
  }
}

// A synthesizer row's tap identifies its module on the board; each channel
// decides what a pick means (the popover selects in place, the sheet closes
// first so the answer lands on the board it names). A click inside the
// expanded legs reads as text, never as a pick — copying a figure or
// scrolling the roster must not select a module or close the sheet.
export function wireSynthPicks(host: ParentNode, pick: (id: string) => void): void {
  host.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".rd-legs")) return;
    const row = (event.target as HTMLElement).closest("[data-module-id]");
    if (row) pick(row.getAttribute("data-module-id")!);
  });
}

// The Rate cell: the final total, and the door to the module-linked
// details. Hover or focus discloses the popover above the 760px
// breakpoint; a tap opens the same roster as a sheet at every width —
// hover alone can't serve a touch surface above the line, so the cell
// keeps a door everywhere. The breakdown sits beside the button, not
// inside it — its rows are interactive (a synth row selects its module on
// the board), and a button may carry none.
function rateCellHtml(): string {
  return `<button class="prod-cell prod-cell-rate" id="rate-cell" title="Rate — the board's live total; hover or tap for the module details">
    <span class="prod-label">Rate</span>
    <strong class="mono rate-total" data-live="rate"></strong>
    <span class="rate-hint" aria-hidden="true">ⓘ</span>
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
// The 760px container breakpoint (§7): above it hover or focus discloses
// the module-linked details from the Rate cell, and a tap opens the same
// roster as a sheet at every width — a touch surface above the line has
// no hover, so the cell's tap is its door everywhere. The gate reads the
// container's own inline size — the number the stylesheet's @container
// rules respond to (container.ts holds it).
export function renderBoardLedger(app: App, snapshot: RateSnapshot): void {
  const host = document.getElementById("board-ledger");
  if (!host) return;
  const { state } = app;
  const feats = unlockedCount(state);
  // Structural key: the deployed roster (deployedRosterKey — a move changes
  // a note name, an upgrade a base figure) plus the feats count rebuilds
  // the strip; every tick-moving value updates in place through the live
  // slots, so an open popover or an expanded row survives the clock.
  const key = `${feats}:${deployedRosterKey(state)}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `<div class="prod-ledger" role="group" aria-label="Production">
        <div class="prod-cell"><span class="prod-label">Nous</span><strong class="mono" data-live="nous"></strong></div>
        <div class="prod-cell rate-slot" id="rate-slot">
          ${rateCellHtml()}
          <span class="rate-breakdown" role="group" aria-label="Module-linked rate details">${rateDetailsHtml(state, snapshot, true)}</span>
        </div>
        <div class="prod-cell prod-cell-session"><span class="prod-label">Session</span><strong class="mono" data-live="session"></strong></div>
      </div>
      ${featsChipHtml(feats)}`;
    document.getElementById("feats-chip")?.addEventListener("click", () => app.openModal("achievements"));
    document.getElementById("rate-cell")?.addEventListener("click", () => app.openModal("rate"));
    // A synth row's tap selects its module: the hex wears the selected
    // stroke and the bloom opens over it — the details name the place,
    // the board shows it.
    wireSynthPicks(document.querySelector("#rate-slot .rate-breakdown")!, (id) => app.select(id));
  }
  updateLedgerLive(host, state, snapshot, app.ui.selected);
}

export function updateLedgerLive(
  scope: ParentNode,
  state: GameState,
  snapshot: RateSnapshot,
  selectedId: string | null = null,
): void {
  const set = (live: string, text: string) => liveSet(scope, live, text);
  set("nous", `${formatBalance(state.nous)} ν`);
  // The balance compresses past the exact range (issue #187); the exact
  // comma-grouped value rides the read as its native tooltip, kept fresh
  // by the same guard the text swap uses.
  liveAttr(scope, "nous", "title", formatInt(state.nous));
  set("rate", `${formatNumber(snapshot.rate)} ν/s`);
  // The session read is a tight live surface (ADR-0031 as applied here):
  // fixed decimals so the trailing zero never comes and goes, and the
  // cell reserves its lane in the stylesheet.
  set("session", state.session ? `${formatFixed(state.session.earned)} ν` : "—");
  updateRateDetailsLive(scope, state, snapshot);
  // A row answers for the module it names: the selected module's row
  // wears the picked mark, refreshed in place — never a rebuild.
  for (const row of scope.querySelectorAll<HTMLElement>(".rd-synth[data-module-id]")) {
    row.classList.toggle("picked", row.dataset.moduleId === selectedId);
  }
}

// ── The phone game-info strip (§7) ──────────────────────────────────────
// Production reads on the board surface, where the tutorial helptext used
// to sit: ν, rate, session. Feats appears once on phone — riding the thumb
// bar — and the rate read is the strip's one tap: it opens the module-
// linked rate details as a sheet, the same door the ledger's Rate cell
// provides at every other width (the ledger itself dissolves below the
// 600px breakpoint). Displayed only below the 600px breakpoint; values
// update every render.
export function renderGameInfoStrip(app: App, snapshot: RateSnapshot): void {
  const host = document.getElementById("game-info-strip");
  if (!host) return;
  const { state } = app;
  if (!host.dataset.renderKey) {
    host.dataset.renderKey = "strip";
    host.innerHTML = `<span class="info-read"><small>ν</small> <strong class="mono" data-live="i-nous"></strong></span>
      <button class="info-read info-rate" id="info-rate" title="Rate — tap for the module details"><strong class="mono" data-live="i-rate"></strong> <small>ν/s</small><span class="info-hint" aria-hidden="true">ⓘ</span></button>
      <span class="info-read"><small>session</small> <strong class="mono" data-live="i-session"></strong></span>`;
    document.getElementById("info-rate")?.addEventListener("click", () => app.openModal("rate"));
  }
  const set = (live: string, text: string) => liveSet(host, live, text);
  // Same compression as the ledger's read, same exact tooltip (issue #187).
  set("i-nous", formatBalance(state.nous));
  liveAttr(host, "i-nous", "title", formatInt(state.nous));
  set("i-rate", formatFixed(snapshot.rate));
  set("i-session", state.session ? formatFixed(state.session.earned) : "—");
}

// ── The ambient horizon bar (§7, issue #156, ADR-0038) ─────────────────
// The Arete pill dissolved into ambience: one wide curved-scale fill —
// the accumulator's log scale drawn as a shallow arc — riding the board's
// lower edge at every width. No decade marks, no practice countdown, no
// Prestige button: the bar is pointer-transparent and carries exactly one
// figure — its own log-scale percentage, centered beneath the arc beside
// the Arete name — until the crossing makes it say the era.
const HORIZON_VIEW_WIDTH = 600;

// The curved rail and its log-scale fill. The fill is the same path
// revealed by a clip rect whose width the tick patches in place — the
// accumulator's 0–1 fill position maps to the clip's 0–600 user units,
// dodging dash-and-pathLength quirks under a squashed viewBox. The
// shallow symmetric arc keeps x-position monotonic in path progress, so
// a horizontal reveal reads exactly as the fill's head.
function horizonSvg(): string {
  const path = "M8 42 Q 300 8 592 42";
  return `<svg class="horizon-svg" viewBox="0 0 ${HORIZON_VIEW_WIDTH} 52" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="horizon-fill-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style="stop-color: color-mix(in srgb, var(--hue-synthesizer) 45%, var(--panel))"></stop>
          <stop offset="1" style="stop-color: var(--nous)"></stop>
        </linearGradient>
        <clipPath id="horizon-fill-clip" clipPathUnits="userSpaceOnUse">
          <rect class="horizon-clip" data-live="h-clip" x="0" y="0" width="0" height="52"></rect>
        </clipPath>
      </defs>
      <path class="horizon-track" d="${path}" pathLength="100"></path>
      <path class="horizon-fill" d="${path}" clip-path="url(#horizon-fill-clip)"></path>
    </svg>`;
}

export function renderHorizonBar(app: App): void {
  const host = document.getElementById("horizon-bar");
  if (!host) return;
  const reached = app.state.totalEarned >= ARETE_HORIZON;
  // Structural key: only the era flip rebuilds the bar; the fill's clip
  // width and the label's percentage patch in place every tick, so
  // nothing here ever churns.
  const key = reached ? "reached" : "under";
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.classList.toggle("reached", reached);
    host.setAttribute("role", "img");
    host.setAttribute(
      "aria-label",
      reached
        ? "First Arete reached — the horizon lies behind you"
        : "The Arete horizon: lifetime progress toward the first Arete",
    );
    host.innerHTML = `${horizonSvg()}${
      reached
        ? `<span class="horizon-state">First Arete reached</span>`
        : `<span class="horizon-word">Arete <b data-live="h-word"></b></span>`
    }`;
  }
  const fill = accumulatorFill(app.state.totalEarned);
  const clip = host.querySelector<SVGRectElement>('[data-live="h-clip"]');
  if (clip) {
    // Numeric compare: style serializers may renormalize the stored value,
    // and re-writing it every tick would churn the transition.
    const width = fill * HORIZON_VIEW_WIDTH;
    const current = Number.parseFloat(clip.style.getPropertyValue("width"));
    if (!Number.isFinite(current) || Math.abs(current - width) >= 0.005) {
      clip.style.setProperty("width", `${width.toFixed(2)}px`);
    }
  }
  liveSet(host, "h-word", `${Math.round(fill * 100)}%`);
}
