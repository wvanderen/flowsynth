// Shared resource and production ledger. One resource-area button opens the
// ledger; Arete owns prestige, while Catalog owns spending.
import { ACHIEVEMENTS } from "../engine/achievements";
import { capacityCeiling } from "../engine/capacity";
import { catalogOpen } from "../engine/catalog";
import { isOscillatorType, NAMED_CHORDS } from "../engine/constants";
import { deployedAt, voiceCapacityOf } from "../engine/economy";
import { discoveryCount } from "../engine/library";
import { noteNameOf } from "../engine/lattice";
import type { GameState, RateSnapshot } from "../engine/types";
import type { App } from "./app";
import { formatBalance, formatFixed, formatInt, formatNumber } from "./format";
import { tooltipBodies, wireTooltips } from "./instrument";
import { liveAttr, liveSet } from "./live";
import { META } from "./meta";

export function unlockedCount(state: GameState): number {
  return Object.keys(state.achievements).length;
}

// ── The module-linked rate details (§7, amended by issue #334) ─────────
// The rate is a place, not a formula: one roster every disclosure channel
// shares — the Rate cell's hover/focus popover above the 760px breakpoint,
// and the sheet a tap opens at every width (the phone strip's read opens
// the same sheet). The roster answers what the board earns and nothing
// else: the final total, the global Feats and Discoveries factors once —
// already included in every figure — and one row per oscillator leading
// with its final ν/s. The supporting modules' roster is gone entirely,
// and the per-row leg decomposition is dropped for now (the 2026-10-14
// amendment: an expansion control reads as hover affordance, not an
// accessible door) — the chord facts stay with the reserved readout, the
// Hex detail, and the session summary. Both channels mount live slots the
// tick fills, so a clock tick never rebuilds an open roster.

// The global factors' one wording (issue #334), shared by the roster
// builder's prefill and the tick's fill alike — one spelling, never two.
function globalFactorsText(snapshot: RateSnapshot): string {
  return `+${Math.round((snapshot.achievementBoost - 1) * 100)}% · +${Math.round((snapshot.discoveryBoost - 1) * 100)}% — already included`;
}

// The live-slot key scheme, one place: the roster builder and the tick's
// filler read the same spellings, so a rename can never land in one and
// not the other. Synth rows key their final figure (`s-<id>-v`), and
// `b-rate` is the total, `b-global` the one Feats · Discoveries line.
const RATE_TOTAL_SLOT = "b-rate";
const RATE_GLOBAL_SLOT = "b-global";
const synthSlot = (id: string): string => `s-${id}-v`;

// The deployed roster's identity — id, kind, level, tier, cell — the
// structural key both the ledger strip and the rate sheet rebuild on (a
// move changes a note name, an upgrade a base figure). The placed
// mutators ride in the key too (issue #198): a mutator placed onto or
// retrieved from a host's cell folds into that host's legs, so the same
// roster must rebuild when the layer changes under it.
export function deployedRosterKey(state: GameState): string {
  const modules = state.modules
    .filter((m) => m.pos !== null)
    .map((m) => `${m.id}:${m.type}:${m.level}:${m.tier}:${m.pos!.q},${m.pos!.r}`)
    .join("|");
  const mutators = state.mutators
    .filter((m) => m.pos !== null)
    .map((m) => `${m.id}:${m.family}:${m.rarity}:${m.pos!.q},${m.pos!.r}`)
    .join("|");
  return `${modules}#${mutators}`;
}

// The active build's signature (ADR-0046): which habit is selected and
// what it has equipped — the build's effects fold into the roster's legs
// and the RITUAL row, so an equip or a habit switch must rebuild the strip.
export function activeBuildKey(state: GameState): string {
  const habit = state.habits.find((h) => h.id === state.activeHabitId);
  return `${state.activeHabitId ?? "-"}:${habit ? habit.build.join(",") : ""}`;
}

// Tooltip ids must never repeat across rebuilds: a replaced roster's
// portaled tooltip body outlives it at document body level (instrument.ts),
// and a reused id would alias the old body to the new trigger. One
// sequence token per build keeps every roster instance's ids its own, so
// the wiring's sweep can tell an orphan from a living body.
let rosterSeq = 0;

// The roster both channels render, through the instrument primitives
// (issue #267): every row is a flat rule-line readout — condensed name,
// mono figure — and the supporting modules have no rows at all (issue
// #334): what the board earns is the whole story. No expansion, no leg
// chain: the amendment drops the per-row details and their arrow for now.
// `live` mounts data-live slots the tick fills (updateRateDetailsLive);
// the sheet passes false and prints the snapshot outright. `ns`
// namespaces the allocation tooltip's id: the popover and the sheet can
// stand in the DOM at the same time, and an id may repeat for no one.
export function rateDetailsHtml(state: GameState, snapshot: RateSnapshot, live: boolean, ns = "pop"): string {
  const seq = ++rosterSeq;
  const val = (slot: string, content: string): string =>
    live ? `<span class="rd-val mono" data-live="${slot}"></span>` : `<span class="rd-val mono">${content}</span>`;

  const rows: string[] = [];
  for (const contribution of snapshot.contributions.values()) {
    if (!isOscillatorType(contribution.type)) continue;
    const module = state.modules.find((m) => m.id === contribution.moduleId);
    if (!module) continue;
    const id = contribution.moduleId;
    const cellNote = contribution.pitch !== null ? noteNameOf(contribution.pitch) : "";
    const name = META[contribution.type].name;
    rows.push(
      `<div class="rd-row rd-synth" data-module-id="${id}">` +
        `<button class="rd-pick" type="button" title="Show it on the board">` +
        `<span class="rd-name t-condensed">${name}</span>` +
        `<span class="rd-note mono">${cellNote}</span>` +
        `</button>` +
        val(synthSlot(id), `+${formatNumber(contribution.value)} ν/s`) +
        `</div>`,
    );
  }

  // The global factors, shown once (issue #334): a property of the whole
  // board, never a per-row payout — the wording says included outright.
  return (
    `<div class="rd-row rd-total"><span class="rd-name t-condensed">Rate</span>` +
    val(RATE_TOTAL_SLOT, `${formatNumber(snapshot.rate)} ν/s`) +
    `</div>` +
    (snapshot.allocation ?
      `<div class="rd-row rd-allocation-state"${snapshot.allocation.certified ? " hidden" : ""}>` +
      `<span class="rd-name t-condensed">Allocation uncertified</span>` +
      `<span class="inst-tip"><button class="inst-tip-trigger" type="button" aria-expanded="false" aria-label="Why allocation is uncertified" aria-describedby="allocation-tip-${ns}-${seq}">ⓘ</button>` +
      `<span class="inst-tip-body" id="allocation-tip-${ns}-${seq}" role="tooltip">Search budget reached. This development allocation is the best result found; maximum production is unproven.</span></span></div>` : "") +
    `<div class="rd-row rd-global"><span class="rd-name t-condensed">Feats · Discoveries</span>` +
    `<span class="rd-val mono" data-live="${RATE_GLOBAL_SLOT}">${globalFactorsText(snapshot)}</span></div>` +
    rows.join("")
  );
}

// The details' live slots: one fill per render, keyed per module — the
// tick never rewords a row.
export function updateRateDetailsLive(scope: ParentNode, state: GameState, snapshot: RateSnapshot): void {
  const roots = [scope, ...tooltipBodies(scope)];
  const set = (live: string, content: string) => {
    for (const root of roots) liveSet(root, live, content);
  };
  set(RATE_TOTAL_SLOT, `${formatNumber(snapshot.rate)} ν/s`);
  set(RATE_GLOBAL_SLOT, globalFactorsText(snapshot));
  for (const status of scope.querySelectorAll<HTMLElement>(".rd-allocation-state")) {
    status.hidden = snapshot.allocation?.certified !== false;
  }
  for (const contribution of snapshot.contributions.values()) {
    const module = state.modules.find((m) => m.id === contribution.moduleId);
    if (!module || !isOscillatorType(contribution.type)) continue;
    set(synthSlot(contribution.moduleId), `+${formatNumber(contribution.value)} ν/s`);
  }
}

// A synthesizer row's tap identifies its module on the board; each channel
// decides what a pick means (the popover selects in place, the sheet closes
// first so the answer lands on the board it names). A click inside the
// allocation note's tooltip reads as reading, never as a pick.
export function wireSynthPicks(host: ParentNode, pick: (id: string) => void, owner?: App): void {
  const listener = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".inst-tip")) return;
    const row = target.closest("[data-module-id]");
    if (row) pick(row.getAttribute("data-module-id")!);
  };
  if (owner) owner.listen(host, "click", listener);
  else host.addEventListener("click", listener);
}

// The rate figure: the grouped read's middle term — the final total and
// the door to the module-linked details. Hover or focus discloses the
// popover above the 760px breakpoint; a tap opens the same roster as a
// sheet at every width — hover alone can't serve a touch surface above
// the line, so the figure keeps a door everywhere. The breakdown mounts
// beside the clipped panel, not inside it — a clip-path ancestor cuts a
// floating child's paint, and the popover hangs below the panel's edge.
export const FEATS_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
  <path d="M4 22h16"/>
  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
</svg>`;

export function featsChipHtml(count: number): string {
  return `<button class="ledger-chip" id="feats-chip" aria-label="Feats" title="Feats — the full list, and how close the next one is">${FEATS_SVG}<span class="mono">${count}/${ACHIEVEMENTS.length}</span></button>`;
}

// ── The chord library chip (§7, issue #230) ─────────────────────────────
// The ledger strip's neighbor beside the feats chip, opening the chord
// library's field guide — the discovery ledger's one door. Exact control
// shape is implementation detail; this rides the feats chip's own pattern.
export const LIBRARY_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
  <path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5Z"/>
  <path d="M12 7.2 16.2 9.6v4.8L12 16.8l-4.2-2.4V9.6Z"/>
</svg>`;

export function libraryChipHtml(state: GameState): string {
  const count = discoveryCount(state);
  return `<button class="ledger-chip" id="library-chip" aria-label="Chords" title="Chord library — the field guide of chord classes">${LIBRARY_SVG}<span class="mono">${count}/${NAMED_CHORDS.length}</span></button>`;
}

// ── The arete read (§7, issue #197 → #270 → #271) ───────────────────────
// Banked Arete keeps its canonical mark and the pre-prestige telegraph.
// Both states open the Arete section, including its gated prestige action.
export const ARETE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
  <path d="M12 2.5 20 8l-3.2 13H7.2L4 8l8-5.5Z"/>
  <path d="M12 2.5 9.4 21M12 2.5l2.6 18.5M4.6 8.4h14.8"/>
</svg>`;

// The read's meter semantics (issue #351): the visible figure is the
// value — role="meter" names it queryable within the ladder's ceiling, so
// AT reads the same scalar the button announces, under its own name. The
// live patchers keep valuenow and valuemax honest as the ladder moves.
function capacityMeterAttrs(state: GameState): string {
  return ` role="meter" aria-label="Harmonic capacity" aria-valuemin="0" aria-valuemax="${capacityCeiling(state)}" aria-valuenow="${voiceCapacityOf(state)}"`;
}

// ── The harmonic-capacity read (§7, issue #333) ─────────────────────────
// The board ledger's fourth grouped resource: the per-voice whole-chord
// allowance — the standard figure every voice's budget is built on (the
// shared purchased rungs plus intrinsic one; issue #373), which the rate
// pass spends (`voiceCapacityOf`) and which is also every board's floor,
// since no profile authors fewer seats. One ambient read at the canvas
// edge, never a board-wide pool meter: a profile's higher intrinsic seats
// and the selected voice's used/available stay local (the reserved
// readout, the Hex detail, the rate details' Capacity leg). The canonical
// mark speaks the board's own chord language — the hex chassis sealed by
// a chord's twin lines.
export const CAPACITY_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5Z"/>
  <path d="M8 10.2h8"/>
  <path d="M8 13.8h8"/>
</svg>`;

// ── The scrap read (§7, issue #377) ─────────────────────────────────────
// The board ledger's scrap balance — the collection value recovered from
// scrapped modules and skipped drafts (ADR-0066), sitting with the
// currencies between the arete read and the capacity read. One ambient
// figure in the resource group, its own register; payouts and spends
// never read anywhere else. The canonical mark speaks the board's own
// language: the hex chassis, chipped by the scrap it came from.
export const SCRAP_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5Z"/>
  <path d="M12 2.5 9.6 9.4l3.1 2.1-2.4 4.2 2.9 5.8"/>
  <path d="M9.6 9.4 3.8 7.25M12.7 11.5l7.5-1.3"/>
</svg>`;

// ── The board ledger (§7, issue #270) ───────────────────────────────────
// Nous pool and production share a column; other resources align alongside.
// Feats and Chords retain their destinations. Live lanes update in place.
export function renderBoardLedger(app: App, snapshot: RateSnapshot): void {
  const host = document.getElementById("board-ledger");
  if (!host) return;
  const { state } = app;
  const feats = unlockedCount(state);
  const discoveries = discoveryCount(state);
  // The arete read's flip (dim slot ↔ banked read) joins the structural
  // key with the balance, so a purchase or a prestige rebuilds the strip
  // the moment the figure moves.
  const banked = catalogOpen(state);
  // Structural key: the deployed roster (deployedRosterKey — a move changes
  // a note name, an upgrade a base figure), the active build (an equip or
  // habit switch folds into the legs), plus the counts the chips and the
  // rate details' static boost legs read, and the allocation gate's flip
  // (issue #258) rebuilds the strip; every tick-moving value updates in
  // place through the live slots, so an open popover or an expanded row
  // survives the clock.
  const key = `${banked ? state.arete : "pre"}:${feats}:${discoveries}:${!!snapshot.allocation}:${activeBuildKey(state)}:${deployedRosterKey(state)}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `<div class="inst-panel ledger-panel"><div class="inst-panel-face ledger-face">
        <button class="ledger-overview" id="ledger-overview" aria-label="Open ledger">
          <span class="ledger-resource ledger-nous" data-ledger="nous"><span class="ledger-resource-name">Nous</span><span class="ledger-resource-value"><b class="mono" data-live="nous"></b><small>ν</small></span><span class="ledger-production" id="rate-cell"><b class="mono" data-live="rate"></b> ν/s</span></span>
          <span class="ledger-resource ledger-arete${banked ? "" : " arete-dim"}" data-ledger="arete"><span class="ledger-resource-name">Arete</span><span class="ledger-resource-value"><b class="mono"${banked ? ' data-live="arete"' : ""}>—</b><small class="arete-mark">${ARETE_SVG}</small></span></span>
          <span class="ledger-resource ledger-scrap" data-ledger="scrap"><span class="ledger-resource-name">Scrap</span><span class="ledger-resource-value"><b class="mono" data-live="scrap"></b><small class="scrap-mark">${SCRAP_SVG}</small></span></span>
          <span class="ledger-resource ledger-capacity" data-ledger="capacity"><span class="ledger-resource-name">Harmonic capacity</span><span class="ledger-resource-value"><b class="mono" data-live="capacity"${capacityMeterAttrs(state)}></b><small class="capacity-mark">${CAPACITY_SVG}</small></span></span>
        </button>
        <span class="ledger-chips">${featsChipHtml(feats)}${libraryChipHtml(state)}</span>
      </div></div><div class="rate-breakdown" role="group" aria-label="Module-linked rate details"><span class="inst-panel"><span class="inst-panel-face">${rateDetailsHtml(state, snapshot, true, "pop")}</span></span></div>`;
    app.listen(document.getElementById("feats-chip"), "click", () => app.openModal("achievements"));
    app.listen(document.getElementById("ledger-overview"), "click", () => app.openLedger("nous"));
    app.listen(document.getElementById("library-chip"), "click", () => app.openModal("library"));
    wireSynthPicks(host.querySelector(".rate-breakdown")!, (id) => app.openModuleDetail(id), app);
    // A synth row's tap names its module's place (§7, issue #295): the
    // tap opens the module's Hex detail — the row names the place, the
    // cross-section shows it.

    wireTooltips(host, app.signal);
  }
  const detailModule = app.ui.detail ? deployedAt(state, app.ui.detail.pos) : undefined;
  updateLedgerLive(host, state, snapshot, detailModule?.id ?? null);
}

export function updateLedgerLive(
  scope: ParentNode,
  state: GameState,
  snapshot: RateSnapshot,
  selectedId: string | null = null,
): void {
  const set = (live: string, text: string) => liveSet(scope, live, text);
  // The balance compresses past the exact range (issue #187); the exact
  // comma-grouped value rides the read as its native tooltip, kept fresh
  // by the same guard the text swap uses. The unit rides the figure's own
  // small — the slot carries the number alone.
  set("nous", formatBalance(state.nous));
  liveAttr(scope, "nous", "title", formatInt(state.nous));
  set("rate", formatFixed(snapshot.rate));
  if (catalogOpen(state)) set("arete", formatInt(state.arete));
  // The scrap balance (issue #377): one figure, patched in place like the
  // other resources — a scrap or skip on any surface moves this read.
  set("scrap", formatInt(state.scrap));
  // The ambient allowance (#333): one figure, the economy's own — the
  // standard voice's whole-chord budget, every board's floor (#373). A
  // purchase moves it on the next render, and the meter's values ride the
  // same patch (#351).
  set("capacity", `${voiceCapacityOf(state)} / ${capacityCeiling(state)}`);
  liveAttr(scope, "capacity", "aria-valuenow", String(voiceCapacityOf(state)));
  liveAttr(scope, "capacity", "aria-valuemax", String(capacityCeiling(state)));
  updateRateDetailsLive(scope, state, snapshot);
  // A row answers for the module it names: the selected module's row wears
  // the state grammar's firm inset marker (`.st-selected`) — readable
  // without color — refreshed in place, never a rebuild.
  for (const row of scope.querySelectorAll<HTMLElement>(".rd-synth[data-module-id]")) {
    row.classList.toggle("st-selected", row.dataset.moduleId === selectedId);
  }
}

// ── The phone game-info strip (§7, issue #270) ──────────────────────────
// Phone pairs nous and rate alongside Arete and scrap in one ledger door.
// Capacity and Feats/Chords remain reachable in the shared disclosure.
export function renderGameInfoStrip(app: App, snapshot: RateSnapshot): void {
  const host = document.getElementById("game-info-strip");
  if (!host) return;
  const { state } = app;
  // The read's flip (dim slot ↔ banked read) is the strip's one structural
  // boundary: the rebuild happens once at the prestige that banks the
  // first Arete, and every tick-moving value updates through live slots.
  const key = catalogOpen(state) ? "strip-banked" : "strip-pre";
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `<button class="inst-panel-face game-info-face ledger-overview" id="phone-ledger-overview" aria-label="Open ledger">
      <span class="phone-nous"><span class="ledger-resource-name">Nous</span><span><b class="mono" data-live="i-nous"></b><small>ν</small></span><span class="ledger-production" id="info-rate"><b class="mono" data-live="i-rate"></b> ν/s</span></span>
      <span class="info-arete${catalogOpen(state) ? "" : " arete-dim"}"><span class="ledger-resource-name">Arete</span><span><b class="mono"${catalogOpen(state) ? ' data-live="i-arete"' : ""}>—</b><small class="arete-mark">${ARETE_SVG}</small></span></span>
      <span class="info-scrap"><span class="ledger-resource-name">Scrap</span><span><b class="mono" data-live="i-scrap"></b><small class="scrap-mark">${SCRAP_SVG}</small></span></span>
      </button>`;
    app.listen(document.getElementById("phone-ledger-overview"), "click", () => app.openLedger("nous"));
    wireTooltips(host, app.signal);
  }
  const set = (live: string, text: string) => liveSet(host, live, text);
  // Same compression as the ledger's read, same exact tooltip (issue #187).
  set("i-nous", formatBalance(state.nous));
  liveAttr(host, "i-nous", "title", formatInt(state.nous));
  // A tight live surface (ADR-0031 as applied here): fixed decimals, so
  // the centered pill never breathes with the rate's trailing digits.
  set("i-rate", formatFixed(snapshot.rate));
  if (catalogOpen(state)) set("i-arete", formatInt(state.arete));
  // The scrap balance's phone face (issue #377), patched like the rest.
  set("i-scrap", formatInt(state.scrap));
  // The ambient allowance (#333): the phone face of the ledger's read,
  // meter values riding the same patch (#351).
  set("i-capacity", String(voiceCapacityOf(state)));
  liveAttr(host, "i-capacity", "aria-valuenow", String(voiceCapacityOf(state)));
  liveAttr(host, "i-capacity", "aria-valuemax", String(capacityCeiling(state)));
}
