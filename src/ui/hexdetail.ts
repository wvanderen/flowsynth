// The Hex detail (issue #295): the module bloom's successor — an owned
// board coordinate's full-stack cross-section, standing where the grid
// stood, at every width. The fixed stack shows both layers, Mutators above
// Modules, in that order always; a face selection emphasizes one section,
// focuses its controls, and synchronizes the vertical layer legend without
// ever reordering. Each face reads name + state + concrete effect (the
// instrument standards' compact readout), with action costs visible and
// deeper mechanics in the tooltip layer. Editing lives in upgrade mode
// only: during flow the same cross-section opens read-only, its readouts
// live, its controls gone — the click still answers the lock.
import { affordableLevels, chargedFactor, deployedAt, displayedRates, hostPower, levelCost, levelsCost, mutatorAt, ritualAmpOf, wholeNous } from "../engine/economy";
import { BALANCE } from "../engine/constants";
import { sameHex } from "../engine/hex";
import { cellNoteOf, noteNameOf, pitchOf } from "../engine/lattice";
import type { GameState, Hex, ModuleInstance, RateSnapshot } from "../engine/types";
import type { App, DetailFace } from "./app";
import { HEX_RADIUS, hexPoints, moduleFace, forgeBranchOf, faceLevel, faceReadoutFor, zeroBuyRead } from "./face";
import { formatInt, formatNumber } from "./format";
import { FAMILY_WORD, hostName, LAYER_MODULES_SVG, LAYER_MUTATORS_SVG, mutatorEffectText, mutatorGlyph, mutatorInertVerdict, mutatorSlotPrice, mutatorUnlockTargets } from "./mutators";
import { META, RARITY_LABEL } from "./meta";
import { isPhoneWidth } from "./container";

/* ── The module face's effect lines (§5) ─────────────
   One entry per module type — the single place a type's effect phrasing
   lives. The Upgrade button's benefit states what one level buys at that
   level's gain; the contribution states what the compact face doesn't say,
   at live values. The silent wire buys nothing with a level, so its
   benefit is null and it wears no button at all. Carried over from the
   retired bloom. */

export interface DetailEffectInput {
  gain: number;
  power: number;
  value: number;
  strength: number;
  // The module's own level (the relay read reads it).
  level: number;
  // The level count the benefit previews (1, or the dial's k).
  levels: number;
}

// The synth benefit is exact at every local effect: value/power is the
// module's per-power ν/s (chord factor, booster uplift, charge, and
// achievements all in — ADR-0036), so one level's power gain scales it
// directly instead of quoting a bare-term figure chords would understate.
const synthEffectLines = ({ gain, power, value }: DetailEffectInput): { benefit: string | null; contribution: string } => ({
  benefit: `+${formatNumber((value / power) * gain)} ν/s`,
  contribution: `+${formatNumber(value)} ν/s`,
});

// The silent voices' effect lines: the level buys the chord-instance
// uplift (ADR-0048), never production — the contribution names the uplift
// the module stands for.
const silentEffectLines = ({ levels }: DetailEffectInput): { benefit: string | null; contribution: string } => ({
  benefit: `+${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel * levels)}% chord-instance uplift`,
  contribution: `+${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel)}%/LV to chord instances`,
});

// The generators' effect lines (ADR-0047): delivery is one shared shape —
// level scales output strength only, never the banked duration.
const generatorEffectLines = ({ gain, power }: DetailEffectInput): { benefit: string | null; contribution: string } => ({
  benefit: `+${formatNumber(gain)} strength`,
  contribution: `${formatNumber(power)} charge strength while its reserve lasts`,
});

const DETAIL_EFFECTS: Record<ModuleInstance["type"], (input: DetailEffectInput) => { benefit: string | null; contribution: string }> = {
  additive: synthEffectLines,
  // The Blaster's charge conversion replaces the charge factor: one level
  // scales its whole charge-sourced term (ADR-0048).
  blaster: synthEffectLines,
  harmonizer: silentEffectLines,
  echo: silentEffectLines,
  bend: silentEffectLines,
  amplifier: ({ strength, level, levels }) => ({
    benefit: `+${formatNumber(100 * BALANCE.amplifierGainPerLevel * levels)}% relay gain`,
    contribution: `relays ⌁${formatNumber(strength)} received × +${Math.round(100 * BALANCE.amplifierGainPerLevel * level)}%`,
  }),
  ritual: ({ strength, level, levels }) => ({
    benefit: `+${formatNumber(100 * BALANCE.ritualAmpPerLevel * levels)}% build amplification`,
    contribution: `amplifies the active habit's build ×${formatNumber(1 + ritualAmpOf(level, strength))} while charged`,
  }),
  spacer: () => ({ benefit: null, contribution: "silent — conducts chords, produces nothing" }),
  focusKeyed: generatorEffectLines,
  noteKeyed: generatorEffectLines,
  goalKeyed: generatorEffectLines,
  infusor: ({ gain, power, strength }) => ({
    benefit: `+${formatNumber(100 * BALANCE.infusorBonus * gain)}% uplift`,
    contribution: `+${formatNumber(100 * BALANCE.infusorBonus * power * chargedFactor(strength))}% to adjacent`,
  }),
  forge: ({ gain, value }) => ({
    benefit: `+${formatNumber(gain)} progress/s`,
    contribution: `${formatNumber(value)} progress/s while charged`,
  }),
  mutatorForge: ({ gain, value }) => ({
    benefit: `+${formatNumber(gain)} progress/s`,
    contribution: `${formatNumber(value)} progress/s while charged`,
  }),
};

/* ── The panel ──────────────────────────────────────── */
// The legend's symbols ride each section head too — the cross-section
// reads in the legend's own vocabulary, one spelling (issue #295).

// The detail's host: hidden until an owned cell's click opens it. The
// class flip (body.hex-detail-open) retires the grid's pointer surface
// while the panel stands — the grid, tray, and zoom cluster come back
// exactly as they left.
export function renderHexDetail(app: App, live: RateSnapshot, projected: RateSnapshot): void {
  const host = document.getElementById("hex-detail");
  if (!host) return;
  const { state, ui } = app;
  const detail = ui.detail;
  const open = detail !== null;
  document.body.classList.toggle("hex-detail-open", open);
  if (!detail) {
    if (!host.hidden) {
      host.hidden = true;
      host.innerHTML = "";
      delete host.dataset.renderKey;
    }
    return;
  }
  const pos = detail.pos;
  const upgrade = state.mode === "upgrade";
  const flow = !upgrade;
  // In flow the readouts run live; arranging previews the charge-projected
  // basis (§7's one-pass rule — the callers computed both).
  const snapshot = upgrade ? projected : live;
  const module = deployedAt(state, pos);
  const phone = isPhoneWidth();
  const mutItem = mutatorAt(state, pos);
  const key = JSON.stringify([
    phone,
    flow,
    pos.q,
    pos.r,
    detail.face,
    module ? `${module.id}:${module.type}:${module.level}:${module.rarity}:${module.shift}` : "empty",
    module ? effectLines(app, module, snapshot).contribution : "",
    module ? Math.floor(forgeBranchOf(state, module.type)?.progress ?? 0) : 0,
    mutItem ? `${mutItem.id}:${mutItem.rarity}:${mutItem.family}` : mutItem,
    state.mutatorSlots.length,
    state.catalogEntryOwned,
    upgrade ? Math.floor(state.arete) : 0,
    upgrade ? ui.bulkCount : 0,
    upgrade ? Math.floor(wholeNous(state)) : 0,
  ]);
  if (host.dataset.renderKey === key) {
    host.hidden = false;
    return;
  }
  // The live readouts rebuild the panel on every flow tick; the scroll
  // rides the rebuild (the app-popover pattern) so a read never loses its
  // place.
  const face = host.querySelector<HTMLElement>(".hex-detail-face");
  const scrollTop = face?.scrollTop ?? 0;
  host.dataset.renderKey = key;
  host.classList.toggle("sheet", phone);
  host.innerHTML = `
    <div class="hex-detail-panel" data-face="${detail.face}">
      <div class="hex-detail-head">
        <span class="hex-detail-place"><b class="mono">${cellNoteOf(pos)}</b><span class="hex-detail-coords mono">${pos.q},${pos.r}</span></span>
        ${flow ? `<span class="hex-detail-readonly">flow live · read-only</span>` : ""}
        <button class="hex-detail-return" id="hex-detail-return" title="Return to the grid">Return</button>
      </div>
      <div class="hex-detail-face">
        ${mutatorSectionHtml(app, pos, snapshot)}
        ${moduleSectionHtml(app, pos, module, snapshot)}
      </div>
    </div>`;
  app.listen(document.getElementById("hex-detail-return"), "click", () => app.closeDetail());
  host.querySelectorAll<HTMLElement>("[data-detail-face]").forEach((head) => {
    const face = head.getAttribute("data-detail-face") as DetailFace;
    app.listen(head, "click", () => app.detailFace(face));
  });
  // The mutator actions and the buy column wire together — an empty
  // place's panel still carries the unlock and entry controls.
  if (module) wireDetailBuy(app, host, module.id, pos);
  else wireDetailMutatorActions(app, pos);
  const freshFace = host.querySelector<HTMLElement>(".hex-detail-face");
  if (freshFace && scrollTop > 0) freshFace.scrollTo(0, scrollTop);
  host.hidden = false;
}

// The two section builders share one head shape; the stack order below is
// the contract — Mutators render before Modules, always (issue #295).
function sectionHead(face: DetailFace, label: string, selected: boolean): string {
  const symbol = face === "modules" ? LAYER_MODULES_SVG : LAYER_MUTATORS_SVG;
  return `<button class="hex-detail-layer-head${selected ? " selected" : ""}" data-detail-face="${face}" aria-pressed="${selected}">
    <span class="hex-detail-layer-symbol" aria-hidden="true">${symbol}</span>
    <span class="hex-detail-layer-word">${label}</span>
  </button>`;
}

function moduleSectionHtml(app: App, pos: Hex, module: ModuleInstance | undefined, snapshot: RateSnapshot): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  const selected = ui.detail?.face === "modules";
  const head = sectionHead("modules", "Modules", selected);
  if (!module) {
    // The empty place (issue #295): owned space, ready for a module — the
    // state and its note, with the placement action arriving with the
    // detail inventory ticket (#296).
    return `<section class="hex-detail-layer modules${selected ? " selected" : ""}" data-detail-section="modules" tabindex="-1" aria-label="Modules — empty place at ${cellNoteOf(pos)}">
      ${head}
      <div class="hex-detail-body">
        <div class="hex-detail-module">
          <svg class="hex-detail-tile" viewBox="-70 -70 140 140" aria-hidden="true"><polygon class="hex empty" points="${hexPoints(HEX_RADIUS)}"/><text y="0" dominant-baseline="central" text-anchor="middle" class="hex-note">${cellNoteOf(pos)}</text></svg>
          <div class="hex-detail-col">
            <span class="hex-detail-name">Empty place</span>
            <small class="hex-detail-note mono">${cellNoteOf(pos)}</small>
          </div>
        </div>
      </div>
    </section>`;
  }
  const lines = effectLines(app, module, snapshot);
  const mutLine = mutLineHtml(state, pos, snapshot);
  const mutUpgrade = upgrade ? detailBuyHtml(app, module) : "";
  return `<section class="hex-detail-layer modules${selected ? " selected" : ""}" data-detail-section="modules" tabindex="-1" aria-label="Modules — ${META[module.type].name} at ${cellNoteOf(pos)}">
    ${head}
    <div class="hex-detail-body">
      <div class="hex-detail-module">
        <svg class="hex-detail-tile" viewBox="-70 -70 140 140" aria-hidden="true">${moduleFace({
          type: module.type,
          rarity: module.rarity,
          readout: faceReadoutFor(state, module, pos, snapshot, true).readout,
          level: faceLevel(module),
        })}</svg>
        <div class="hex-detail-col">
          <span class="hex-detail-name">${faceLevel(module) !== undefined ? `${META[module.type].name} · LV ${module.level}` : META[module.type].name}<small class="hex-detail-rarity"> · ${RARITY_LABEL[module.rarity]}</small></span>
          <small class="hex-detail-note mono">${cellNoteOf(pos)}</small>
          <small class="hex-detail-contrib mono">${lines.contribution}</small>
          ${mutLine}
        </div>
        ${mutUpgrade ? `<div class="hex-detail-buy">${mutUpgrade}</div>` : ""}
      </div>
    </div>
  </section>`;
}

// The Mutators face (issue #295): the cell's slot state with its relevant
// action — the Catalog entry walk while the layer stands locked, the
// priced unlock where a slot can attach, the declaration and Retrieve
// where one stands. Every refusal names its rule; no surface promises a
// ν/s figure (issue #199's never-say rule).
function mutatorSectionHtml(app: App, pos: Hex, snapshot: RateSnapshot): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  const selected = ui.detail?.face === "mutators";
  const head = sectionHead("mutators", "Mutators", selected);
  const note = cellNoteOf(pos);
  const label = `Mutators — ${state.catalogEntryOwned ? "slot state" : "locked"} at ${note}`;
  let body: string;
  if (!state.catalogEntryOwned) {
    // The locked place (issue #295): state and the one action that exists
    // — the Catalog's ◇ entry screen, the walk every locked Mutators
    // control takes.
    body = `<div class="hex-detail-module mut-locked">
      <span class="hex-detail-lock" aria-hidden="true">${LAYER_MUTATORS_SVG}</span>
      <div class="hex-detail-col">
        <span class="hex-detail-name">Locked</span>
        <small class="hex-detail-note">Unlocks with the Mutator entry</small>
      </div>
      ${upgrade ? `<div class="hex-detail-buy"><button class="hex-action" id="detail-mutator-entry" title="Open the Catalog's Mutator entry screen">Catalog entry</button></div>` : ""}
    </div>`;
  } else {
    const slotted = state.mutatorSlots.some((slot) => sameHex(slot, pos));
    if (!slotted) {
      // No slot here: the priced unlock when the cell is eligible —
      // the first slot free on any owned cell, later ones beside the
      // patch — and the adjacency rule named where it is not.
      const eligible = mutatorUnlockTargets(state).some((target) => sameHex(target, pos));
      const price = mutatorSlotPrice(state);
      const action =
        upgrade && eligible
          ? `<div class="hex-detail-buy"><button class="hex-action" id="detail-mutator-unlock" title="Unlock a Mutator slot at ${note}">${price === 0 ? "Unlock slot · free" : `Unlock slot · <span class="mono">${formatInt(price)} ◇</span>`}</button></div>`
          : upgrade
            ? `<div class="hex-detail-buy"><span class="hex-detail-noslot" title="Unlocks attach beside the Mutator patch">beside the patch</span></div>`
            : "";
      body = `<div class="hex-detail-module">
        <span class="hex-detail-lock" aria-hidden="true">${LAYER_MUTATORS_SVG}</span>
        <div class="hex-detail-col">
          <span class="hex-detail-name">No slot</span>
          <small class="hex-detail-note mono">${note}</small>
        </div>
        ${action}
      </div>`;
    } else {
      const item = mutatorAt(state, pos);
      if (!item) {
        // The vacant slot: legal, and it speaks — inert until a host lands.
        body = `<div class="hex-detail-module">
          <span class="hex-detail-lock" aria-hidden="true">${LAYER_MUTATORS_SVG}</span>
          <div class="hex-detail-col">
            <span class="hex-detail-name">Open slot</span>
            <small class="hex-detail-note mono">${note}</small>
            <small class="hex-detail-contrib">inert · no host</small>
          </div>
        </div>`;
      } else {
        const host = hostName(state, pos);
        const inert = mutatorInertVerdict(state, pos, item, snapshot);
        body = `<div class="hex-detail-module${inert ? " mut-inert" : ""}">
          <span class="hex-detail-glyph" aria-hidden="true"><svg viewBox="-14 -14 28 28" style="color: var(--arete)">${mutatorGlyph(item.family, 0.9)}</svg></span>
          <div class="hex-detail-col">
            <span class="hex-detail-name">${FAMILY_WORD[item.family]}<small class="hex-detail-rarity"> · ${RARITY_LABEL[item.rarity]}</small></span>
            ${inert ? "" : `<small class="hex-detail-contrib">${mutatorEffectText(item.family, item.rarity)}</small>`}
            ${inert ? `<small class="hex-detail-contrib">${inert}</small>` : ""}
            ${host ? `<small class="hex-detail-note">hosts ${host}</small>` : ""}
          </div>
          ${upgrade ? `<div class="hex-detail-buy"><button class="hex-action" id="detail-mutator-retrieve" title="Retrieve to the Mutator tray">Retrieve</button></div>` : ""}
        </div>`;
      }
    }
  }
  return `<section class="hex-detail-layer mutators${selected ? " selected" : ""}" data-detail-section="mutators" tabindex="-1" aria-label="${label}">
    ${head}
    <div class="hex-detail-body">${body}</div>
  </section>`;
}

/* ── The upgrade column ─────────────────────────────── */

function effectLines(app: App, module: ModuleInstance, snapshot: RateSnapshot): { benefit: string | null; contribution: string } {
  const power = hostPower(app.state, module);
  return DETAIL_EFFECTS[module.type]({
    power,
    value: snapshot.contributions.get(module.id)?.value ?? 0,
    strength: snapshot.chargeStrength.get(module.id) ?? 0,
    level: module.level,
    gain: power * (BALANCE.rarityPower[module.rarity] - 1),
    levels: 1,
  });
}

// The dial (issue #195, re-docked by #295): the Upgrade button keeps the
// shared ladder — ×1 / ×5 / ×10 / MAX·k — with the total cost and the
// k-level benefit. The count holds per module: a new detail starts at ×1.
function detailBuyHtml(app: App, module: ModuleInstance): string {
  const { state, ui } = app;
  if (ui.bulkModuleId !== module.id) {
    ui.bulkModuleId = module.id;
    ui.bulkCount = 1;
  }
  // The dial's basis (§7): the charge-projected pass, whatever the clock
  // is doing — purchases preview what the module makes while charged.
  const snapshot = displayedRates(state, true);
  const power = hostPower(state, module);
  const value = snapshot.contributions.get(module.id)?.value ?? 0;
  const strength = snapshot.chargeStrength.get(module.id) ?? 0;
  const lines = DETAIL_EFFECTS[module.type]({
    power,
    value,
    strength,
    level: module.level,
    gain: power * (BALANCE.rarityPower[module.rarity] - 1),
    levels: 1,
  });
  const maxLevels = affordableLevels(wholeNous(state), module.level);
  const want = ui.bulkCount === "max" ? maxLevels : ui.bulkCount;
  const bulkCost = levelsCost(module.level, want);
  const bulkBenefit = DETAIL_EFFECTS[module.type]({
    power,
    value,
    strength,
    level: module.level,
    gain: power * (BALANCE.rarityPower[module.rarity] ** want - 1),
    levels: want,
  }).benefit;
  // Partial by design: the button stays enabled whatever the bank says —
  // a short purchase buys what it covers and says so.
  const bank = wholeNous(state);
  const affordable = bank >= bulkCost;
  const zero = zeroBuyRead(bank, levelCost(module.level));
  const zeroBuy = maxLevels === 0;
  const benefit = lines.benefit;
  const maxRead = zeroBuy ? zero.maxLabel : `MAX·${maxLevels}`;
  const maxTip = zeroBuy ? zero.maxTip : `Buy every affordable level (${maxLevels})`;
  const dial = benefit
    ? `<div class="bloom-dial" role="group" aria-label="Upgrade count">${([1, 5, 10, "max"] as const)
        .map((option) => {
          const active = option === ui.bulkCount;
          return `<button class="bloom-dial-chip${active ? " active" : ""}" data-bulk="${option}" aria-pressed="${active}" title="${option === "max" ? maxTip : `Buy ${option} levels`}">${option === "max" ? maxRead : `×${option}`}</button>`;
        })
        .join("")}</div>`
    : "";
  const upgradeButton = benefit
    ? `<button class="bloom-upgrade" id="detail-upgrade" title="${zeroBuy ? zero.plusTip : affordable ? `Buy ${want} level${want === 1 ? "" : "s"}` : `Not enough for all ${want} — buys what it can`}">
        <span class="bloom-upgrade-title">Upgrade ×${want} · <strong class="mono">${formatInt(bulkCost)} ν</strong></span>
        <small class="bloom-upgrade-benefit mono">${bulkBenefit ?? ""}</small>
      </button>`
    : "";
  // The Bend's player-picked shift (ADR-0048): the rarity's selectable
  // ♯/♭ steps, one chip each.
  const shiftPicker =
    module.type === "bend" && module.pos
      ? `<div class="bloom-shift" role="group" aria-label="Pitch shift">${BALANCE.bendShifts[module.rarity]
          .map((shift) => {
            const active = (module.shift ?? 1) === shift;
            const label = `${shift > 0 ? "♯" : "♭"}${Math.abs(shift)}`;
            return `<button class="bloom-shift-chip${active ? " active" : ""}" data-shift="${shift}" aria-pressed="${active}" title="${shift > 0 ? "Sharp" : "Flat"} ${Math.abs(shift)} — sings ${noteNameOf(pitchOf(module.pos!) + shift)}">${label}</button>`;
          })
          .join("")}</div>`
      : "";
  return `${shiftPicker}${dial}${upgradeButton}`;
}

// The buy column's wiring (issue #195 shape, #295 surface): the button
// buys the dial's selected count — partial by design — and a chip pick
// re-renders so cost, benefit, and MAX·k follow. The unlock and retrieve
// land through the same app actions the grid gestures use.
function wireDetailBuy(app: App, host: HTMLElement, moduleId: string, pos: Hex): void {
  const { ui } = app;
  app.listen(document.getElementById("detail-upgrade"), "click", () => {
    app.upgradeLevels(moduleId, ui.bulkCount);
  });
  host.querySelectorAll<HTMLButtonElement>("[data-bulk]").forEach((chip) => {
    app.listen(chip, "click", () => {
      const raw = chip.getAttribute("data-bulk")!;
      ui.bulkCount = raw === "max" ? "max" : (Number(raw) as 1 | 5 | 10);
      app.render();
    });
  });
  host.querySelectorAll<HTMLButtonElement>("[data-shift]").forEach((chip) => {
    app.listen(chip, "click", () => {
      app.setBendShift(moduleId, Number(chip.getAttribute("data-shift")));
    });
  });
  wireDetailMutatorActions(app, pos);
}

// The Mutators face's action wiring — present on every panel, module or
// empty: retrieve, the priced unlock, and the locked layer's entry walk.
function wireDetailMutatorActions(app: App, pos: Hex): void {
  app.listen(document.getElementById("detail-mutator-retrieve"), "click", () => {
    const item = mutatorAt(app.state, pos);
    if (item) app.mutRetrieve(item.id);
  });
  app.listen(document.getElementById("detail-mutator-unlock"), "click", () => {
    app.mutUnlockAt(pos);
  });
  app.listen(document.getElementById("detail-mutator-entry"), "click", () => {
    app.openMutatorEntry();
  });
}

/* ── The module face's mutator line ───────────────────
   The module's tile column gains the mutator line when its cell's slot
   holds one — the declaration plus the inert verdict when it stands idle
   (issue #199's shape, #295's surface). */

function mutLineHtml(state: GameState, pos: Hex, snapshot: RateSnapshot): string {
  const item = mutatorAt(state, pos);
  if (!item) return "";
  const inert = mutatorInertVerdict(state, pos, item, snapshot);
  return `<div class="hex-detail-mutline">
    <span class="hex-detail-mutglyph" aria-hidden="true"><svg viewBox="-14 -14 28 28" style="color: var(--arete)">${mutatorGlyph(item.family, 0.8)}</svg></span>
    <b>Mutator · ${FAMILY_WORD[item.family]}</b>
    ${inert ? "" : `<span class="mono">${mutatorEffectText(item.family, item.rarity)}</span>`}
    ${inert ? `<span class="hex-detail-mutinert">${inert}</span>` : ""}
  </div>`;
}
