// The board's production surfaces (§7, issue #270): the ledger — one
// clipped instrument panel docked above the board (grouped resource reads
// left, the feats/chords chips right) — the module-linked rate details
// disclosed from its rate figure, the ambient horizon bar riding the
// board's lower edge, and the phone game-info strip carrying the same
// resource reads alone. The session read has left the ledger; the console
// carries no readouts.
import { accumulatorFill, claimOf, horizonReached } from "../engine/accumulator";
import { ACHIEVEMENTS } from "../engine/achievements";
import { catalogOpen } from "../engine/catalog";
import { BALANCE, CATEGORY_OF, isOscillatorType, NAMED_CHORDS } from "../engine/constants";
import { activeBuildGeneratorStrength, chargedFactor, hostPower } from "../engine/economy";
import { discoveryCount } from "../engine/library";
import { noteNameOf } from "../engine/lattice";
import type { Contribution, GameState, ModuleInstance, RateSnapshot } from "../engine/types";
import type { App } from "./app";
import { chordTermLabel, formatBalance, formatFixed, formatInt, formatNumber } from "./format";
import { tooltipBodies, wireTooltips } from "./instrument";
import { liveAttr, liveSet } from "./live";
import { META } from "./meta";

export function unlockedCount(state: GameState): number {
  return Object.keys(state.achievements).length;
}

// ── The module-linked rate details (§7) ────────────────────────────────
// The rate is a place, not a formula: one roster every disclosure channel
// shares — the Rate cell's hover/focus popover above the 760px breakpoint,
// and the sheet a tap opens at every width (the phone strip's read opens
// the same sheet). One row per oscillator carries its final ν/s; its leg
// decomposition — base term, local booster, formation quality, chord,
// charge, achievement and discovery effects — lives in the row's tooltip
// (the instrument standards' disclosure rule: deeper mechanics in the
// tooltip layer, never an expandable section). Nonproducing modules
// disclose what they do to others with no ν/s of their own to
// double-count. Both channels mount live slots the tick fills, so a clock
// tick never rebuilds (and never collapses) an open roster.
interface SynthLegs {
  base: number;
  formationQ: number;
  chordMult: number;
  chordLabel: string;
  infusorBonus: number;
  chargeFactor: number;
  chargeStrength: number;
  boost: number;
  discovery: number;
}

// One oscillator's decomposition, straight off its contribution: the legs
// multiply back to the final figure exactly —
// base × formationQ × chords × (1 + infusor) × chargeFactor × boost = value.
// The formation quality is its own named leg (ADR-0049: "Formation ×1.12"),
// the chord leg carries the named-instance product alone. The base and
// chord legs carry the mutators' folds (ADR-0043): the power mutator rides
// the host's power, the resonance mutator rides the chord factor the
// contribution already reports — the legs stay the engine's own, no
// mutator row joins the roster (ADR-0037).
function synthLegsOf(state: GameState, snapshot: RateSnapshot, contribution: Contribution, module: ModuleInstance): SynthLegs {
  const terms = snapshot.namedChords.filter((chord) => chord.moduleIds.includes(contribution.moduleId)).map(chordTermLabel);
  return {
    base: BALANCE.synthRate * hostPower(state, module),
    formationQ: contribution.formationQ,
    // The chord leg carries the named-instance product with the resonance
    // mutator's fold — the contribution's whole factor minus the formation
    // quality's own named leg, so the legs still multiply out exactly.
    chordMult: (contribution.chordFactor ?? 1) / contribution.formationQ,
    chordLabel: terms.length > 0 ? terms.join(" · ") : "none",
    infusorBonus: contribution.infusorBonus,
    chargeFactor: contribution.chargeFactor,
    chargeStrength: contribution.chargeStrength,
    boost: snapshot.achievementBoost,
    discovery: snapshot.discoveryBoost,
  };
}

// A nonproducing module's effect on the board, in the bloom's own
// vocabulary — never ν/s, so nothing here reads as a second producer.
function effectText(state: GameState, contribution: Contribution, module: ModuleInstance, snapshot: RateSnapshot): string {
  const category = CATEGORY_OF[contribution.type];
  if (category === "generator") {
    // The steady-conduit node (ADR-0046) rides the emitted strength — the
    // +1 is part of the charge the module delivers.
    return `⌁${formatNumber(hostPower(state, module) + activeBuildGeneratorStrength(state))} charge`;
  }
  if (category === "booster") {
    const strength = snapshot.chargeStrength.get(contribution.moduleId) ?? 0;
    return `+${formatNumber(100 * BALANCE.infusorBonus * hostPower(state, module) * chargedFactor(strength))}% to adjacent`;
  }
  if (category === "silentVoice") {
    const uplift = BALANCE.silentVoiceUpliftPerLevel * module.level;
    const pitch = contribution.pitch !== null ? noteNameOf(contribution.pitch) : "mute";
    return `sings ${pitch} · Formation ×${formatNumber(contribution.formationQ)} · +${Math.round(uplift * 100)}% per level to chord instances`;
  }
  if (category === "conduit") {
    const strength = snapshot.chargeStrength.get(contribution.moduleId) ?? 0;
    return `relays ⌁${formatNumber(strength)} × +${Math.round(BALANCE.amplifierGainPerLevel * module.level * 100)}%`;
  }
  if (category === "ritual") {
    const amp = snapshot.ritualAmplification;
    const strength = snapshot.chargeStrength.get(contribution.moduleId) ?? 0;
    return `amplifies the active habit's build ×${formatNumber(1 + amp)} while charged · ⌁${formatNumber(strength)} received`;
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
// base/fmt/chd/inf/chg legs, `chgn` the charge note, `n` a nonproducer's
// effect.
function rowSlotTexts(state: GameState, snapshot: RateSnapshot, contribution: Contribution, module: ModuleInstance): Record<string, string> {
  if (isOscillatorType(contribution.type)) {
    const legs = synthLegsOf(state, snapshot, contribution, module);
    return {
      v: `+${formatNumber(contribution.value)} ν/s`,
      base: `${formatNumber(legs.base)} ν/s`,
      fmt: `×${formatNumber(legs.formationQ)}`,
      chd: `×${formatNumber(legs.chordMult)}`,
      inf: `+${Math.round(legs.infusorBonus * 100)}%`,
      chg: `×${formatNumber(legs.chargeFactor)}`,
      chgn: legs.chargeStrength > 0 ? `⌁${formatNumber(legs.chargeStrength)} charge` : "",
    };
  }
  return { n: effectText(state, contribution, module, snapshot) };
}

// The deployed roster's identity — id, kind, level, rarity, cell — the
// structural key both the ledger strip and the rate sheet rebuild on (a
// move changes a note name, an upgrade a base figure). The placed
// mutators ride in the key too (issue #198): a mutator placed onto or
// retrieved from a host's cell folds into that host's legs, so the same
// roster must rebuild when the layer changes under it.
export function deployedRosterKey(state: GameState): string {
  const modules = state.modules
    .filter((m) => m.pos !== null)
    .map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}:${m.pos!.q},${m.pos!.r}`)
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
// mono figure — and a synthesizer's deeper mechanics (its leg
// decomposition) live only in the tooltip layer, never an expandable
// <details>. `live` mounts data-live slots the tick fills
// (updateRateDetailsLive); the sheet passes false and prints the snapshot
// outright. `ns` namespaces the tooltip ids: the popover and the sheet can
// stand in the DOM at the same time, and an id may repeat for no one.
export function rateDetailsHtml(state: GameState, snapshot: RateSnapshot, live: boolean, ns = "pop"): string {
  const seq = ++rosterSeq;
  const val = (slot: string, content: string): string =>
    live ? `<span class="rd-val mono" data-live="${slot}"></span>` : `<span class="rd-val mono">${content}</span>`;
  const note = (slot: string, content: string): string =>
    live ? `<span class="rd-note" data-live="${slot}">${content}</span>` : `<span class="rd-note">${content}</span>`;

  const synths: string[] = [];
  const others: string[] = [];
  for (const contribution of snapshot.contributions.values()) {
    const module = state.modules.find((m) => m.id === contribution.moduleId);
    if (!module) continue;
    const slots = rowSlotTexts(state, snapshot, contribution, module);
    const id = contribution.moduleId;
    if (isOscillatorType(contribution.type)) {
      const cellNote = contribution.pitch !== null ? noteNameOf(contribution.pitch) : "";
      const name = META[contribution.type].name;
      const tipId = `rd-tip-${ns}-${seq}-${id}`;
      synths.push(
        `<div class="rd-row rd-synth" data-module-id="${id}">` +
          `<button class="rd-pick" type="button" title="${name} — show it on the board">` +
          `<span class="rd-name t-condensed">${name}</span>` +
          `<span class="rd-note mono">${cellNote}</span>` +
          `</button>` +
          `<span class="inst-tip">` +
          `<button class="inst-tip-trigger" type="button" aria-expanded="false" aria-describedby="${tipId}" aria-label="The legs of the ${name}'s rate">ⓘ</button>` +
          `<span class="inst-tip-body" id="${tipId}" role="tooltip">` +
          `<div class="rd-legs">` +
          `<div class="rd-leg"><span class="rd-leg-name">Base</span>` +
          val(synthSlot(id, "base"), slots.base!) +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Formation</span>` +
          val(synthSlot(id, "fmt"), slots.fmt!) +
          `<span class="rd-note">${synthChordNote(state, snapshot, contribution, module)}</span>` +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Chords</span>` +
          val(synthSlot(id, "chd"), slots.chd!) +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Booster</span>` +
          val(synthSlot(id, "inf"), slots.inf!) +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Charge</span>` +
          val(synthSlot(id, "chg"), slots.chg!) +
          note(synthSlot(id, "chgn"), slots.chgn!) +
          `</div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Achievements</span>` +
          `<span class="rd-val mono">+${Math.round((snapshot.achievementBoost - 1) * 100)}%</span></div>` +
          `<div class="rd-leg"><span class="rd-leg-name">Discoveries</span>` +
          `<span class="rd-val mono">+${Math.round((snapshot.discoveryBoost - 1) * 100)}%</span></div>` +
          `</div></span></span>` +
          val(synthSlot(id, "v"), slots.v!) +
          `</div>`,
      );
    } else {
      others.push(
        `<div class="rd-row rd-other-row"><span class="rd-name t-condensed">${META[contribution.type].name}</span>` +
          val(otherSlot(id), slots.n!) +
          `</div>`,
      );
    }
  }

  return (
    `<div class="rd-row rd-total"><span class="rd-name t-condensed">Rate</span>` +
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
function synthChordNote(state: GameState, snapshot: RateSnapshot, contribution: Contribution, module: ModuleInstance): string {
  return synthLegsOf(state, snapshot, contribution, module).chordLabel;
}

// The details' live slots: one fill per render, keyed per module, from the
// same record the builder printed — the tick never rewords a leg.
export function updateRateDetailsLive(scope: ParentNode, state: GameState, snapshot: RateSnapshot): void {
  const roots = [scope, ...tooltipBodies(scope)];
  const set = (live: string, content: string) => {
    for (const root of roots) liveSet(root, live, content);
  };
  set(RATE_TOTAL_SLOT, `${formatNumber(snapshot.rate)} ν/s`);
  for (const contribution of snapshot.contributions.values()) {
    const module = state.modules.find((m) => m.id === contribution.moduleId);
    if (!module) continue;
    const id = contribution.moduleId;
    const slots = rowSlotTexts(state, snapshot, contribution, module);
    if (isOscillatorType(contribution.type)) {
      set(synthSlot(id, "v"), slots.v!);
      set(synthSlot(id, "base"), slots.base!);
      set(synthSlot(id, "fmt"), slots.fmt!);
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
// tooltip layer reads as reading, never as a pick — pinning a tooltip or
// copying a leg figure must not select a module or close the sheet.
export function wireSynthPicks(host: ParentNode, pick: (id: string) => void): void {
  host.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".inst-tip")) return;
    const row = (event.target as HTMLElement).closest("[data-module-id]");
    if (row) pick(row.getAttribute("data-module-id")!);
  });
}

// The rate figure: the grouped read's middle term — the final total and
// the door to the module-linked details. Hover or focus discloses the
// popover above the 760px breakpoint; a tap opens the same roster as a
// sheet at every width — hover alone can't serve a touch surface above
// the line, so the figure keeps a door everywhere. The breakdown mounts
// beside the clipped panel, not inside it — a clip-path ancestor cuts a
// floating child's paint, and the popover hangs below the panel's edge.
function rateCellHtml(): string {
  return `<button class="ledger-fig-btn" id="rate-cell" aria-label="Rate details" title="Rate — the board's live total; hover or tap for the module details">
    <b class="mono" data-live="rate"></b><small aria-hidden="true">ν/s</small>
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
// The ledger's third grouped resource: the banked Arete in its color, the
// canonical mark at 15px. The telegraph slot is unconditional: before the
// first Arete the read is a dim `— ◇` — the lock itself teaches that
// prestige will bank here. The read is a read, never a door (issue #271):
// the labeled Catalog door owns the shop, and the balance spends through
// the catalog's arete face.
export const ARETE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
  <path d="M12 2.5 20 8l-3.2 13H7.2L4 8l8-5.5Z"/>
  <path d="M12 2.5 9.4 21M12 2.5l2.6 18.5M4.6 8.4h14.8"/>
</svg>`;

// The telegraph slot's one markup, both faces of the ledger: a dim `— ◇`
// until the first prestige banks the first Arete.
function areteTelegraphHtml(): string {
  return `<b class="mono">—</b><small class="arete-mark" aria-hidden="true">${ARETE_SVG}</small>`;
}

export function areteLedgerHtml(state: GameState): string {
  if (!catalogOpen(state)) {
    return `<span class="ledger-fig ledger-arete arete-dim" title="Unlocks at first Arete Reset">${areteTelegraphHtml()}</span>`;
  }
  return `<span class="ledger-fig ledger-arete" title="Arete — banked by prestige; spent in the catalog"><b class="mono" data-live="arete"></b><small class="arete-mark" aria-hidden="true">${ARETE_SVG}</small></span>`;
}

// ── The board ledger (§7, issue #270) ───────────────────────────────────
// One clipped instrument panel docked above the board: the resources group
// left — `1.24k ν · 18.6 ν/s · 6 ◇`, the arete read in its color with the
// canonical mark at 15px — then a hairline, then the feats and chords
// chips right-aligned as paired icon + count chips. The session read has
// left; bonuses live in the sheets and the rate details' legs, never here.
// The 760px container breakpoint (§7): above it hover or focus anywhere on
// the strip discloses the module-linked details, and a tap on the rate
// figure opens the same roster as a sheet at every width — a touch surface
// above the line has no hover, so the figure's tap is its door everywhere.
// The gate reads the container's own inline size — the number the
// stylesheet's @container rules respond to (container.ts holds it).
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
  // rate details' static boost legs read; every tick-moving value updates
  // in place through the live slots, so an open popover or an expanded row
  // survives the clock.
  const key = `${banked ? state.arete : "pre"}:${feats}:${discoveries}:${activeBuildKey(state)}:${deployedRosterKey(state)}`;
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.innerHTML = `<div class="inst-panel ledger-panel"><div class="inst-panel-face ledger-face" role="group" aria-label="Production">
        <span class="ledger-fig" title="Nous — the board's banked resource"><b class="mono" data-live="nous"></b><small class="nous-unit" aria-hidden="true">ν</small></span>
        <span class="ledger-fig ledger-rate" id="rate-slot">
          ${rateCellHtml()}
        </span>
        ${areteLedgerHtml(state)}
        <span class="ledger-rule" aria-hidden="true"></span>
        <span class="ledger-chips">
          ${featsChipHtml(feats)}
          ${libraryChipHtml(state)}
        </span>
      </div></div>
      <div class="rate-breakdown" role="group" aria-label="Module-linked rate details"><span class="inst-panel"><span class="inst-panel-face">${rateDetailsHtml(state, snapshot, true, "pop")}</span></span></div>`;
    document.getElementById("feats-chip")?.addEventListener("click", () => app.openModal("achievements"));
    document.getElementById("rate-cell")?.addEventListener("click", () => app.openModal("rate"));
    document.getElementById("library-chip")?.addEventListener("click", () => app.openModal("library"));
    // A synth row's tap selects its module: the hex wears the selected
    // stroke and the bloom opens over it — the row names the place,
    // the board shows it. The tooltip layer pins and dismisses beside it.
    wireSynthPicks(host.querySelector(".rate-breakdown")!, (id) => app.select(id));
    wireTooltips(host.querySelector(".rate-breakdown")!);
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
  // The balance compresses past the exact range (issue #187); the exact
  // comma-grouped value rides the read as its native tooltip, kept fresh
  // by the same guard the text swap uses. The unit rides the figure's own
  // small — the slot carries the number alone.
  set("nous", formatBalance(state.nous));
  liveAttr(scope, "nous", "title", formatInt(state.nous));
  set("rate", formatNumber(snapshot.rate));
  if (catalogOpen(state)) set("arete", formatInt(state.arete));
  updateRateDetailsLive(scope, state, snapshot);
  // A row answers for the module it names: the selected module's row wears
  // the state grammar's firm inset marker (`.st-selected`) — readable
  // without color — refreshed in place, never a rebuild.
  for (const row of scope.querySelectorAll<HTMLElement>(".rd-synth[data-module-id]")) {
    row.classList.toggle("st-selected", row.dataset.moduleId === selectedId);
  }
}

// ── The phone game-info strip (§7, issue #270) ──────────────────────────
// The ledger's phone face: the same grouped resource reads on the board
// surface — ν, rate, arete — and nothing else. No session read, no
// feats/chords chips: Collection owns both entries from the thumb bar
// (issue #270). The rate read stays the strip's one tap: it opens the
// module-linked rate details as a sheet, the same door the ledger's rate
// figure provides at every other width (the ledger itself dissolves below
// the 600px breakpoint). The arete read is a read, never a door (issue
// #271) — the thumb bar's Catalog segment owns the shop — and the
// telegraph slot stands dim before the first prestige. Displayed only
// below the 600px breakpoint; values update every render.
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
    host.innerHTML = `<div class="inst-panel-face game-info-face"><span class="info-read" title="Nous — the board's banked resource"><b class="mono" data-live="i-nous"></b><small aria-hidden="true">ν</small></span>
      <button class="info-read info-rate" id="info-rate" aria-label="Rate details" title="Rate — tap for the module details"><b class="mono" data-live="i-rate"></b><small aria-hidden="true">ν/s</small><span class="info-hint" aria-hidden="true">ⓘ</span></button>
      ${
        catalogOpen(state)
          ? `<span class="info-read info-arete" title="Arete — banked by prestige; spent in the catalog"><b class="mono" data-live="i-arete"></b><small class="arete-mark" aria-hidden="true">${ARETE_SVG}</small></span>`
          : `<span class="info-read info-arete arete-dim" title="Unlocks at first Arete Reset">${areteTelegraphHtml()}</span>`
      }</div>`;
    document.getElementById("info-rate")?.addEventListener("click", () => app.openModal("rate"));
  }
  const set = (live: string, text: string) => liveSet(host, live, text);
  // Same compression as the ledger's read, same exact tooltip (issue #187).
  set("i-nous", formatBalance(state.nous));
  liveAttr(host, "i-nous", "title", formatInt(state.nous));
  // A tight live surface (ADR-0031 as applied here): fixed decimals, so
  // the centered pill never breathes with the rate's trailing digits.
  set("i-rate", formatFixed(snapshot.rate));
  if (catalogOpen(state)) set("i-arete", formatInt(state.arete));
}

// ── The ambient horizon bar (§7, issue #156, ADR-0038, ADR-0039) ───────
// One wide curved-scale fill — the current era's log scale drawn as a
// shallow arc — riding the board's lower edge at every width. Pointer-
// transparent everywhere except the one door: when the era's fill reaches
// the horizon, the percentage readout gives way to "Prestige and Claim X
// Arete" (ADR-0039) — a live button in upgrade mode, a locked "prestige
// available — enter upgrade mode" readout during a session.
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
          <stop offset="0" style="stop-color: color-mix(in srgb, var(--arete) 45%, var(--panel))"></stop>
          <stop offset="1" style="stop-color: var(--arete)"></stop>
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
  const { state } = app;
  const reached = horizonReached(state);
  // Structural key: the era flip rebuilds the bar — under, the open door
  // (its claim lives in the label), or the locked readout during a session.
  // The fill's clip width and the label's percentage patch in place every
  // tick, so nothing here ever churns.
  const key = reached ? `door:${state.mode}:${claimOf(state)}` : "under";
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.classList.toggle("reached", reached);
    if (reached) {
      // The door states carry live controls and text; a figure role would
      // flatten them for assistive tech, so only the ambient bar wears it.
      host.removeAttribute("role");
      host.removeAttribute("aria-label");
    } else {
      host.setAttribute("role", "img");
      host.setAttribute("aria-label", "The Arete horizon: this era's progress toward prestige");
    }
    host.innerHTML = `${horizonSvg()}${
      reached
        ? state.mode === "upgrade"
          ? `<button class="prestige-door" id="prestige-door" title="Prestige — bank the era's Arete and begin the next era">Prestige and Claim <b class="mono">${claimOf(state)}</b> Arete</button>`
          : `<span class="horizon-state locked">prestige available — enter upgrade mode</span>`
        : `<span class="horizon-word">Arete <b data-live="h-word"></b></span>`
    }`;
    document.getElementById("prestige-door")?.addEventListener("click", () => app.openPrestigeConfirm());
  }
  // The break beat (ADR-0042, issue #200): the purchase's one visual, a
  // flare on the bar it plays once and only once. Evaluated every render so
  // the class drops when the window closes; a class that outlives the
  // animation is inert.
  host.classList.toggle("break-beat", app.breakBeatUntil > Date.now());
  const fill = accumulatorFill(state.eraEarned);
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
  if (!reached) liveSet(host, "h-word", `${Math.round(fill * 100)}%`);
}
