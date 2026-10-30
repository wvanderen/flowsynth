import { tierPowerOf } from "../engine/module-strength";
// The Hex detail (issue #295): the module bloom's successor — an owned
// board coordinate's full-stack cross-section, standing where the grid
// stood, at every width. The presentation is the instrument metaphor, not
// a panel of cards: the cell's column lifted toward the camera, frameless
// at stage center. The composition (ADR-0072) has three posts. The stack:
// the World face above the Modules face, both visible always, one
// layer in focus — the focused face full-size at full engraving, the
// other an identity thumbnail (chassis, state marks; its text engraving
// yields, the words and figures riding tooltip and details column). The
// action rail: one row below the stack, its contents following the
// focused face — the upgrade dial and button under Modules, the occupant's
// retrieve and target priority under World. The details column: the
// standing facts in open sections — the context map heading it (the whole
// in-range board in miniature, the opened hex in the firm selected
// marker, its active chords in their hues), then profile grades, chord
// facts (issue #388: active chips inline, idle candidates behind one N
// idle disclosure), and the World line. The wave connections keep their
// posts (issue #297): the incoming charge and the chord bonus at the
// module face's vertices, their breakdowns riding their disclosures
// (hexflows.ts) — the column holds standing facts, not opened math.
// Global destinations (Catalog, Forge) belong to the surrounding
// navigation — the dock doors and the legend — never repeated buttons
// here; a compact floating Return control and the flow tag ride the
// corner. Nothing else: the deeper mechanics ride the tooltip layer
// (issue #267's inst-tip).
//
// The face selection emphasizes one section, focuses its control, and
// synchronizes the vertical layer legend without ever reordering.
// Editing lives in upgrade mode only: during flow the same cross-section
// opens read-only, its readouts live, its controls gone — the click still
// answers the lock.
import { affordableLevels, boosterBonusOf, boosterTermOf, deployed, deployedAt, displayedRates, flowLive, hostPower, isPriceableLevel, levelCost, levelsCost, wholeNous } from "../engine/economy";
import { BALANCE, isOscillatorType, typeRarityOf } from "../engine/constants";
import { adjacent, sameHex } from "../engine/hex";
import { cellNoteOf, noteNameOf, pitchOf } from "../engine/lattice";
import { enemyDefAt, worldOccupantAt } from "../engine/world";
import type { Hex, ModuleInstance, RateSnapshot } from "../engine/types";
import type { App, DetailFace } from "./app";
import { HEX_RADIUS, hexPoints, moduleFace, forgeBranchOf, faceLevel, faceReadoutFor, waterFill, zeroBuyRead, spotlightInactiveVerdict } from "./face";
import { chargeGlow } from "./leads";
import { formatInt, formatNumber } from "./format";
import { bindWorldDrag, targetPriorityHtml, worldChassisHtml } from "./world";
import { COLUMN_WORD, META, RARITY_LABEL, WORLD_META, tierWord } from "./meta";
import { isPhoneWidth, scrollTopOf } from "./container";
import { wireTooltips } from "./instrument";
import { profileGradesHtml } from "./profile";
import { moduleFlowsHtml } from "./hexflows";
import { contextMapSvg, openContextMap } from "./contextmap";
import { bindPointerDrag, type DetailChordRow } from "./render";

/* ── The upgrade benefit (§5) ─────────────────────────
   One entry per module type — the single place a type's benefit phrasing
   lives. The Upgrade button states what the dial's level count buys at
   that level's gain. Carried over from the retired bloom. */

export interface DetailEffectInput {
  gain: number;
  power: number;
  value: number;
  strength: number;
  // The module's own level (the relay read reads it).
  level: number;
  // The level count the benefit previews (1, or the dial's k).
  levels: number;
  tierPower: number;
}

// The synth benefit is exact at every local effect: value/power is the
// module's per-power ν/s (chord factor, booster uplift, charge, and
// achievements all in — ADR-0036), so one level's power gain scales it
// directly instead of quoting a bare-term figure chords would understate.
const synthBenefit = ({ gain, power, value }: DetailEffectInput): string | null =>
  `+${formatNumber((value / power) * gain)} ν/s`;

// The silent voices' benefit: the level buys the chord-instance uplift
// (ADR-0048), never production.
const silentBenefit = ({ levels, tierPower }: DetailEffectInput): string | null =>
  `+${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel * levels * tierPower)}% chord-instance uplift`;

// The generators' benefit (ADR-0047): level scales output strength only,
// never the banked duration.
const generatorBenefit = ({ gain }: DetailEffectInput): string | null => `+${formatNumber(gain)} strength`;

const DETAIL_BENEFITS: Record<ModuleInstance["type"], (input: DetailEffectInput) => string | null> = {
  additive: synthBenefit,
  // The Blaster's charge conversion replaces the charge factor: one level
  // scales its whole charge-sourced term (ADR-0048).
  blaster: synthBenefit,
  // The waveform profiles (issue #369) scale the same shared leg — a
  // level buys the type's whole term at once, profile included.
  triangle: synthBenefit,
  square: synthBenefit,
  saw: synthBenefit,
  // The Afterglow's level scales the whole warm term — the warmup curve's
  // timing is untouched by it (issue #372).
  afterglow: synthBenefit,
  // The Sideband's level scales the whole term — the charge conversion's
  // curve and condition are untouched by it (issue #375).
  sideband: synthBenefit,
  // The breather specialists (issue #416): a level scales the whole term
  // — the authored breather figures and the fact-keyed rules are untouched
  // by it, exactly as progression never moves a temporal timing.
  release: synthBenefit,
  standby: synthBenefit,
  tail: synthBenefit,
  harmonizer: silentBenefit,
  echo: silentBenefit,
  bend: silentBenefit,
  amplifier: ({ levels, tierPower }) => `+${formatNumber(100 * BALANCE.amplifierGainPerLevel * levels * tierPower)}% relay gain`,
  // The legacy build amplification retired with the builds (ADR-0076): a
  // level buys the RITUAL nothing, so like the silent wire it wears no
  // upgrade button.
  ritual: () => null,
  // The silent wire buys nothing with a level, so it wears no button at all.
  spacer: () => null,
  focusKeyed: generatorBenefit,
  noteKeyed: generatorBenefit,
  goalKeyed: generatorBenefit,
  // The Pulsewell's level scales earning and delivery together — bursts
  // included, their cycle timing untouched (issue #372).
  pulsewell: generatorBenefit,
  infusor: ({ gain }) => `+${formatNumber(100 * boosterBonusOf("infusor") * gain)}% uplift`,
  // The booster wave's authored shares (issue #374): the pass's one table
  // quoted, never a second coefficient home. The line names the design's
  // authored term (issue #375).
  field: ({ gain }) => `+${formatNumber(100 * boosterBonusOf("field") * gain)}% uplift`,
  spotlight: ({ gain }) => `+${formatNumber(100 * boosterBonusOf("spotlight") * gain)}% uplift`,
  chorus: ({ gain }) => `+${formatNumber(100 * boosterBonusOf("chorus") * gain)}% ${boosterTermOf("chorus")}`,
  exciter: ({ gain }) => `+${formatNumber(100 * boosterBonusOf("exciter") * gain)}% ${boosterTermOf("exciter")}`,
  forge: ({ gain }) => `+${formatNumber(gain)} progress/s`,
  mutatorForge: ({ gain }) => `+${formatNumber(gain)} progress/s`,
};

function benefitOf(app: App, module: ModuleInstance, snapshot: RateSnapshot, levels: number, rarityPower: number): string | null {
  const power = hostPower(app.state, module);
  return DETAIL_BENEFITS[module.type]({
    power,
    value: snapshot.contributions.get(module.id)?.value ?? 0,
    strength: snapshot.chargeStrength.get(module.id) ?? 0,
    level: module.level,
    gain: power * (rarityPower - 1),
    levels,
    tierPower: tierPowerOf(module.tier),
  });
}

/* ── The stage ──────────────────────────────────────── */

// The detail's host: hidden until an owned cell's click opens it. The
// class flip (body.hex-detail-open) retires the grid's pointer surface
// while the stack stands — the grid, tray, and zoom cluster come back
// exactly as they left; the open itself is the display transition, so its
// one-time lift needs no markup (a rebuild never re-triggers it).
// `chordRow` arrives from the readout's own module (render.ts owns the
// reserved grammar) — html plus `key`, its inputs rather than its
// formatted string (#349). The row mounts in its own column beside the
// module face (issue #388) and the key rides the rebuild guard so a live
// read never shows stale chips.
export function renderHexDetail(app: App, live: RateSnapshot, projected: RateSnapshot, chordRow: DetailChordRow): void {
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
  const releaseTooltips = wireTooltips(host, app.signal);
  const pos = detail.pos;
  const upgrade = state.mode === "upgrade";
  const flow = !upgrade;
  // In flow the readouts run live; arranging previews the charge-projected
  // basis (§7's one-pass rule — the callers computed both). The wave
  // connections read the same basis as the faces (issue #297): the
  // snapshot's own flow flag, charge-projected while arranging.
  const snapshot = upgrade ? projected : live;
  const module = deployedAt(state, pos);
  const phone = isPhoneWidth();
  // The rebuild key's inputs (#349): every entry below is a raw input the
  // rendered stack derives its readouts from — module shape, the face's
  // power and the contribution's own figures, the charge register, the
  // World occupant's identity and stores, the tray's stock, the chord
  // row's marks — never a formatted string. Derivation notes: the face
  // readout's relay and booster figures derive from hostPower,
  // chargeStrength, and the level below; the World chassis' figures derive
  // from the occupant's store and the lift read.
  const contribution = module ? snapshot.contributions.get(module.id) ?? null : null;
  const worldOccupant = worldOccupantAt(state, pos);
  const key = JSON.stringify([
    phone,
    state.mode,
    pos.q,
    pos.r,
    detail.face,
    module ? `${module.id}:${module.type}:${module.level}:${module.tier}:${module.shift}:${module.target}` : "empty",
    module ? forgeBranchOf(state, module.type) : null,
    module ? hostPower(state, module) : 0,
    contribution
      ? [
          contribution.value,
          contribution.pitch,
          contribution.amplitude,
          contribution.chordTerms,
          contribution.chordFactor,
          contribution.formationQ,
          contribution.formationMeasuredQ,
          contribution.infusorBonus,
          contribution.chargeFactor,
          contribution.chargeStrength,
        ]
      : null,
    module ? snapshot.chargeStrength.get(module.id) ?? 0 : 0,
    worldOccupant
      ? worldOccupant.kind === "weapon"
        ? (() => {
            const weapon = state.world.weapons.find((w) => w.id === worldOccupant.id)!;
            return `w:${weapon.store}:${weapon.targetPriority.join(">")}`;
          })()
        : `c:${worldOccupant.id}`
      : null,
    enemyDefAt(pos) ? `${state.world.enemies[enemyDefAt(pos)!.key]?.discovered}:${state.world.enemies[enemyDefAt(pos)!.key]?.hp}` : null,
    state.cells.length,
    state.unlockedRows.join(","),
    // The open inventory (issue #296) and what waits in it: a placement
    // changes both, so the tray and its tiles can never show stale stock.
    state.modules.filter((m) => m.pos === null).map((m) => `${m.id}:${m.type}:${m.level}:${m.tier}`),
    state.world.weapons.map((w) => `${w.id}:${w.pos}`),
    state.world.columns.map((c) => `${c.id}:${c.pos}`),
    upgrade ? Math.floor(state.arete) : 0,
    upgrade ? ui.bulkCount : 0,
    upgrade ? Math.floor(wholeNous(state)) : 0,
    chordRow.key,
    snapshot.achievementBoost,
    snapshot.discoveryBoost,
    state.activeHabitId,
  ]);
  if (host.dataset.renderKey === key) {
    host.hidden = false;
    return;
  }
  // A changed read rebuilds the stack. Preserve the focused control and
  // scroll, and retire portaled tooltips before reusing chord disclosure IDs.
  // Scroll comes from the initial layout batch, before other surfaces
  // write; the new stack restores that captured position.
  const focused = document.activeElement;
  const focusAttribute = focused instanceof Element && host.contains(focused)
    ? ["id", "data-ctx-cell", "data-ctx-navigation", "data-detail-face", "data-bulk", "data-shift", "data-target", "aria-describedby"]
        .find((attribute) => focused.hasAttribute(attribute))
    : undefined;
  const focusValue = focusAttribute ? focused!.getAttribute(focusAttribute) : null;
  releaseTooltips();
  const grid = host.querySelector<HTMLElement>(".hex-detail-grid");
  const scrollTop = scrollTopOf(grid);
  host.dataset.renderKey = key;
  host.classList.toggle("sheet", phone);
  host.innerHTML = `
    <div class="hex-detail-scene${flow ? " readonly" : ""}${state.mode === "flow" || state.mode === "breather" ? " flow-live" : ""}" data-face="${detail.face}">
      <div class="hex-detail-corner">
        <button class="hex-detail-return" id="hex-detail-return">Return</button>
        ${flow ? `<span class="hex-detail-readonly">${state.mode === "flow" ? "flow live" : state.mode === "breather" ? "breathing" : "paused"} · read-only</span>` : ""}
      </div>
      <div class="hex-detail-grid">
        <div class="hex-detail-stack">
          ${worldLayerHtml(app, pos, snapshot)}
          ${moduleLayerHtml(app, pos, module, snapshot)}
          ${actionRailHtml(app, pos, module)}
        </div>
        ${detailColumnHtml(app, pos, module, chordRow)}
      </div>

    </div>`;
  app.listen(document.getElementById("hex-detail-return"), "click", () => app.closeDetail());
  // The faces are the sections: clicking a face's chassis emphasizes it
  // (the legend and the state grammar follow; no menu tabs on the content).
  host.querySelectorAll<HTMLElement>("[data-detail-face]").forEach((chassis) => {
    const face = chassis.getAttribute("data-detail-face") as DetailFace;
    app.listen(chassis, "click", () => app.detailFace(face));
  });
  app.listen(host.querySelector("[data-context-expand]"), "click", () => {
    openContextMap(app, chordRow.marks);
  });
  // The World actions and the buy column wire together — an occupied
  // place's stack still carries its controls.
  if (module) wireDetailBuy(app, host, module.id);
  wireDetailWorldActions(app, host, pos);
  if (upgrade) {
    const moduleFace = host.querySelector<HTMLElement>('[data-detail-face="modules"]');
    if (moduleFace) {
      moduleFace.dataset.cell = `${pos.q},${pos.r}`;
      if (module) bindPointerDrag(app, moduleFace, module.id);
    }
    const worldFace = host.querySelector<HTMLElement>('[data-detail-face="world"]');
    if (worldFace) {
      worldFace.dataset.worldCell = `${pos.q},${pos.r}`;
      const occupant = worldOccupantAt(state, pos);
      if (occupant) bindWorldDrag(app, worldFace, occupant.id, pos);
    }
  }
  const freshGrid = host.querySelector<HTMLElement>(".hex-detail-grid");
  if (freshGrid && scrollTop > 0) freshGrid.scrollTo(0, scrollTop);
  host.hidden = false;
  wireTooltips(host, app.signal);
  if (focusAttribute && focusValue !== null) {
    [...host.querySelectorAll<HTMLElement | SVGElement>(`[${focusAttribute}]`)]
      .find((control) => control.getAttribute(focusAttribute) === focusValue)
      ?.focus({ preventScroll: true });
  }
}

/* ── The World face ─────────────────────────────────── */
// The coordinate's World plate, above the module, in the layer's steel
// register — the same square-cut silhouette the board's second face
// draws, at readable scale. The tooltip carries the state's one line.

function worldLayerHtml(app: App, pos: Hex, snapshot: RateSnapshot): string {
  const { ui } = app;
  const selected = ui.detail?.face === "world";
  const note = cellNoteOf(pos);
  const { chassis, tip } = worldChassisHtml(app.state, pos, snapshot);
  const id = detailTipId();
  // The face's own post — its actions (retrieve, target priority) ride
  // the action rail below the stack when the World face holds focus.
  return `<section class="hex-detail-layer world${selected ? " selected" : ""}" data-detail-section="world" tabindex="-1" aria-label="World — ${app.state.cells.some((cell) => sameHex(cell, pos)) || enemyDefAt(pos) ? "face state" : "locked"} at ${note}">
    <span class="hex-orbit"><span class="inst-tip"><button class="hex-stack-chassis inst-tip-trigger" data-detail-face="world" aria-pressed="${selected}" aria-describedby="${id}" aria-label="Emphasize the World face">${chassis}</button><span class="inst-tip-body" id="${id}" role="tooltip">${tip}</span></span></span>
  </section>`;
}

/* ── The Modules face ───────────────────────────────── */

function moduleLayerHtml(app: App, pos: Hex, module: ModuleInstance | undefined, snapshot: RateSnapshot): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  const selected = ui.detail?.face === "modules";
  const note = cellNoteOf(pos);
  let chassis: string;
  let tip: { id: string; html: string };
  if (!module) {
    // The empty place (issue #295): owned space, ready for a module — the
    // dashed chassis and the cell's own pitch, the place's identity. The
    // rail's Add module opens the tray beside the stack (issue #296).
    const id = detailTipId();
    chassis = `<svg class="hex-stack-face empty" viewBox="-70 -70 140 140" aria-hidden="true">
      <polygon class="hex empty" points="${hexPoints(HEX_RADIUS)}"/>
      <text class="face-note" y="4" text-anchor="middle">${note}</text>
      <polygon class="hex-stack-marker" points="${hexPoints(58)}"/>
    </svg>`;
    tip = { id, html: `<span class="inst-tip-body" id="${id}" role="tooltip">Owned place at ${note} — no module stands here yet</span>` };
  } else {
    // The face itself is the plate: the module's own engraving at readable
    // scale — the compact rhythm, since the upgrade band lives in the rail
    // now, not on the face — with the charge light live and the Forge's
    // threshold fill riding the chassis. The face says everything the
    // board hex says — no text column re-speaks it.
    const strength = snapshot.chargeStrength.get(module.id) ?? 0;
    const charged = strength > 0;
    const branch = forgeBranchOf(state, module.type);
    const read = faceReadoutFor(state, module, pos, snapshot, true);
    const id = detailTipId();
    chassis = `<svg class="hex-stack-face" viewBox="-70 -70 140 140" data-type="${module.type}" data-rarity="${typeRarityOf(module.type)}" aria-hidden="true">${moduleFace({
      type: module.type,
      tier: module.tier,
      readout: read.readout,
      ...(read.readoutClass ? { readoutClass: read.readoutClass } : {}),
      ...(read.note ? { note: read.note } : {}),
      level: faceLevel(module),
      ...(charged ? { hexClass: "charged", chargeGlow: chargeGlow(strength) } : {}),
      ...(branch ? { under: waterFill(module.id, branch.progress / branch.threshold) } : {}),
    })}<polygon class="hex-stack-marker" points="${hexPoints(58)}"/></svg>`;
    tip = {
      id,
      html: `<span class="inst-tip-body" id="${id}" role="tooltip">${META[module.type].name} · ${RARITY_LABEL[typeRarityOf(module.type)]} · ${tierWord(module.tier)}${faceLevel(module) !== undefined ? ` · level ${module.level}` : ""} · ${read.readout}${read.note ? ` · sings ${read.note}` : ""}${charged ? " · charged" : ""}</span>`,
    };
  }
  // Upgrade actions ride the action rail below the stack (ADR-0072);
  // placement and retrieval use the shared inventory.
  const flows = module ? moduleFlowsHtml(state, module, snapshot, upgrade || flowLive(state)) : "";
  return `<section class="hex-detail-layer modules${selected ? " selected" : ""}" data-detail-section="modules" tabindex="-1" aria-label="Modules — ${module ? `${META[module.type].name} at ${note}` : `empty place at ${note}`}">
    <span class="hex-orbit"><span class="inst-tip"><button class="hex-stack-chassis inst-tip-trigger" data-detail-face="modules" aria-pressed="${selected}" aria-describedby="${tip.id}" aria-label="Emphasize the Modules face">${chassis}</button>${tip.html}</span>${flows}</span>
  </section>`;
}

/* ── The action rail (ADR-0072) ───────────────────────
   One row below the stack, its contents following the focused face —
   the eye lands here after the face. Modules focus carries the upgrade
   column (pickers, dial, button); World focus carries the occupant's
   retrieve and, for a weapon, its target priority — between sessions
   only. Flow leaves no rail at all. */

function actionRailHtml(app: App, pos: Hex, module: ModuleInstance | undefined): string {
  const { state, ui } = app;
  if (state.mode !== "upgrade") return "";
  if (ui.detail?.face === "world") {
    const occupant = worldOccupantAt(state, pos);
    if (!occupant) return "";
    const name = occupant.kind === "column" ? COLUMN_WORD : WORLD_META[state.world.weapons.find((w) => w.id === occupant.id)!.type].name;
    const priority = occupant.kind === "weapon" ? targetPriorityHtml(state, state.world.weapons.find((w) => w.id === occupant.id)!) : "";
    return `<div class="hex-detail-actions"><button class="hex-action" id="detail-world-retrieve" aria-label="Retrieve the ${name} to the World tray">Retrieve to World tray</button>${priority}</div>`;
  }
  return module ? `<div class="hex-detail-actions">${detailBuyHtml(app, module)}</div>` : "";
}

/* ── The details column (ADR-0072) ────────────────────
   The standing facts in open sections, headed by the context map: the
   whole in-range board in miniature — the opened hex in the firm
   selected marker, its active chords in their hues — then the profile
   grades, the chord facts in the reserved readout's grammar (issue
   #388), and the World face's line. Sections render only with content;
   the waves keep their breakdown disclosures. */

function detailColumnHtml(app: App, pos: Hex, module: ModuleInstance | undefined, chordRow: DetailChordRow): string {
  const { state } = app;
  const note = cellNoteOf(pos);
  const sections: string[] = [];
  const map = contextMapSvg(state, pos, module, chordRow.marks);
  if (map) sections.push(`<section class="hex-detail-section hex-detail-ctx">${map}</section>`);
  if (module) {
    const grades = profileGradesHtml(module.type);
    if (grades) sections.push(`<section class="hex-detail-section"><span class="hex-detail-section-head">Profile</span>${grades}</section>`);
    if (chordRow.html) sections.push(`<section class="hex-detail-section"><span class="hex-detail-section-head">Chord facts</span>${chordRow.html}</section>`);
  }
  // The World line (issue #426): the enemy threat or the cleared bonus —
  // the same read the plate's tooltip carries, stated once in the column.
  const enemyDef = enemyDefAt(pos);
  if (enemyDef) {
    const live = state.world.enemies[enemyDef.key];
    const line = !live?.discovered
      ? "Reserved cell — the World holds this position"
      : live.hp <= 0
        ? `Cleared · era bonus +${Math.round(enemyDef.bonus * 100)}% ν`
        : `Enemy · −${Math.round(enemyDef.penalty * 100)}% ν while it stands`;
    sections.push(`<section class="hex-detail-section"><span class="hex-detail-section-head">World</span><p class="hex-detail-world-line">${line}</p></section>`);
  }
  if (sections.length === 0) return "";
  return `<aside class="hex-detail-side" aria-label="Details at ${note}">${sections.join("")}</aside>`;
}

/* ── The upgrade column ─────────────────────────────── */

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
  const benefit = benefitOf(app, module, snapshot, 1, BALANCE.rarityPower[typeRarityOf(module.type)]);
  // Purchase integrity (issue #485): a level the ladder cannot price
  // quotes no buy column — the action would refuse it, so the detail
  // never meets the pricing curve with a corrupted level.
  if (!benefit || !isPriceableLevel(module.level)) return "";
  const maxLevels = affordableLevels(wholeNous(state), module.level);
  const want = ui.bulkCount === "max" ? maxLevels : ui.bulkCount;
  const bulkCost = levelsCost(module.level, want);
  const bulkBenefit = benefitOf(app, module, snapshot, want, BALANCE.rarityPower[typeRarityOf(module.type)] ** want);
  // Partial by design: the button stays enabled whatever the bank says —
  // a short purchase buys what it covers and says so.
  const bank = wholeNous(state);
  const affordable = bank >= bulkCost;
  const zero = zeroBuyRead(bank, levelCost(module.level));
  const zeroBuy = maxLevels === 0;
  const maxRead = zeroBuy ? zero.maxLabel : `MAX·${maxLevels}`;
  const maxTip = zeroBuy ? zero.maxTip : `Buy every affordable level (${maxLevels})`;
  const dial = benefit
    ? `<div class="hex-dial" role="group" aria-label="Upgrade count">${([1, 5, 10, "max"] as const)
        .map((option) => {
          const active = option === ui.bulkCount;
          return `<button class="hex-dial-chip${active ? " active" : ""}" data-bulk="${option}" aria-pressed="${active}" title="${option === "max" ? maxTip : `Buy ${option} levels`}">${option === "max" ? maxRead : `×${option}`}</button>`;
        })
        .join("")}</div>`
    : "";
  const upgradeButton = benefit
    ? `<button class="hex-upgrade" id="detail-upgrade" title="${zeroBuy ? zero.plusTip : affordable ? `Buy ${want} level${want === 1 ? "" : "s"}` : `Not enough for all ${want} — buys what it can`}">
        <span class="hex-upgrade-title">Upgrade ×${want} · <strong class="mono">${formatInt(bulkCost)} ν</strong></span>
        <small class="hex-upgrade-benefit mono">${bulkBenefit ?? ""}</small>
      </button>`
    : "";
  // The Bend's player-picked shift (ADR-0048): the rarity's selectable
  // ♯/♭ steps, one chip each.
  const shiftPicker =
    module.type === "bend" && module.pos
      ? `<div class="hex-shift" role="group" aria-label="Pitch shift">${BALANCE.bendShifts[typeRarityOf(module.type)]
          .map((shift) => {
            const active = (module.shift ?? 1) === shift;
            const label = `${shift > 0 ? "♯" : "♭"}${Math.abs(shift)}`;
            return `<button class="hex-shift-chip${active ? " active" : ""}" data-shift="${shift}" aria-pressed="${active}" title="${shift > 0 ? "Sharp" : "Flat"} ${Math.abs(shift)} — sings ${noteNameOf(pitchOf(module.pos!) + shift)}">${label}</button>`;
          })
          .join("")}</div>`
      : "";
  // The Spotlight's player-selected recipient (issue #374): one chip per
  // adjacent oscillator — the targeting follows the player's pick, never
  // an output ranking. An inactive booster names why beside the same chips
  // (the recovery control), the verdict shared with the face readout.
  const targetPicker =
    module.type === "spotlight" && module.pos
      ? (() => {
          const verdict = spotlightInactiveVerdict(state, module);
          const recipients = deployed(state).filter((other) => isOscillatorType(other.type) && adjacent(other.pos!, module.pos!));
          return `<div class="hex-shift hex-target${verdict ? " st-inactive" : ""}" role="group" aria-label="Recipient">${
            verdict ? `<span class="hex-target-verdict">${verdict}</span>` : ""
          }${recipients
            .map((other) => {
              const active = module.target === other.id;
              const note = cellNoteOf(other.pos!);
              return `<button class="hex-shift-chip${active ? " active" : ""}" data-target="${other.id}" aria-pressed="${active}">${note}</button>`;
            })
            .join("")}</div>`;
        })()
      : "";
  return `${shiftPicker}${targetPicker}${dial}${upgradeButton}`;
}

// The buy column's wiring (issue #195 shape, #295 surface): the button
// buys the dial's selected count — partial by design — and a chip pick
// re-renders so cost, benefit, and MAX·k follow.
function wireDetailBuy(app: App, host: HTMLElement, moduleId: string): void {
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
  host.querySelectorAll<HTMLButtonElement>("[data-target]").forEach((chip) => {
    app.listen(chip, "click", () => {
      app.setBoosterTarget(moduleId, chip.getAttribute("data-target"));
    });
  });
}

// The World rail's controls stay local to the opened coordinate.
function wireDetailWorldActions(app: App, host: HTMLElement, pos: Hex): void {
  app.listen(document.getElementById("detail-world-retrieve"), "click", () => {
    const occupant = worldOccupantAt(app.state, pos);
    if (occupant) app.worldRetrieve(occupant.id);
  });
  host.querySelectorAll<HTMLButtonElement>("[data-world-priority]").forEach((el) => {
    app.listen(el, "click", () => {
      const occupant = worldOccupantAt(app.state, pos);
      if (occupant?.kind !== "weapon") return;
      app.worldMovePriority(occupant.id, el.dataset.worldPriority!, Number(el.dataset.dir));
    });
  });
  app.listen(host.querySelector<HTMLButtonElement>("[data-world-priority-reset]"), "click", () => {
    const occupant = worldOccupantAt(app.state, pos);
    if (occupant?.kind === "weapon") app.setWeaponPriority(occupant.id, []);
  });
}

/* ── The tooltip layer's ids ──────────────────────────
   A rebuilt stack must never reuse a portaled body's id (the ledger's
   rule): the seq scopes every rebuild's disclosures. */

let detailTipSeq = 0;
const detailTipId = (): string => `detail-tip-${++detailTipSeq}`;
