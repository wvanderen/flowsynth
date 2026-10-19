import { tierPowerOf } from "../engine/module-strength";
// The Hex detail (issue #295): the module bloom's successor — an owned
// board coordinate's full-stack cross-section, standing where the grid
// stood, at every width. The presentation is the instrument metaphor, not
// a panel of cards: the cell's column lifted toward the camera, frameless
// at stage center. The composition (ADR-0072) has three posts. The stack:
// the Mutators face above the Modules face, both visible always, one
// layer in focus — the focused face full-size at full engraving, the
// other an identity thumbnail (chassis, rail, glyph, state marks; its
// text engraving yields, the words and figures riding tooltip and
// details column). The action rail: one row below the stack, its contents
// following the focused face — the upgrade dial and button under Modules,
// the slot unlock under Mutators. The details column: the standing facts
// in open sections — the context map heading it (the whole in-range board
// in miniature, the opened hex in the firm selected marker, its active
// chords in their hues), then profile grades, chord facts (issue #388:
// active chips inline, idle candidates behind one N idle disclosure), and
// the mutator line. The wave connections keep their posts (issue #297):
// the mutator's cross-layer effect between the faces, incoming charge and
// the chord bonus at the module face's vertices, their breakdowns riding
// their disclosures (hexflows.ts) — the column holds standing facts, not
// opened math. Global destinations (Catalog, Forge) belong to the
// surrounding navigation — the dock doors and the legend — never repeated
// buttons here; a compact floating Return control and the flow tag ride
// the corner. Nothing else: the deeper mechanics ride the tooltip layer
// (issue #267's inst-tip).
//
// The face selection emphasizes one section, focuses its control, and
// synchronizes the vertical layer legend without ever reordering.
// Editing lives in upgrade mode only: during flow the same cross-section
// opens read-only, its readouts live, its controls gone — the click still
// answers the lock.
import { affordableLevels, boosterBonusOf, boosterTermOf, deployed, deployedAt, displayedRates, flowLive, hostPower, levelCost, levelsCost, mutatorAt, mutatorMagnitude, wholeNous } from "../engine/economy";
import { BALANCE, isOscillatorType, typeRarityOf } from "../engine/constants";
import { adjacent, sameHex } from "../engine/hex";
import { cellNoteOf, noteNameOf, pitchOf } from "../engine/lattice";
import type { GameState, Hex, ModuleInstance, MutatorInstance, RateSnapshot } from "../engine/types";
import type { App, DetailFace } from "./app";
import { HEX_RADIUS, hexPoints, moduleFace, forgeBranchOf, faceLevel, faceReadoutFor, waterFill, zeroBuyRead, spotlightInactiveVerdict } from "./face";
import { chargeGlow } from "./leads";
import { formatInt, formatNumber } from "./format";
import { FAMILY_WORD, rarityTicks, mutatorEffectText, mutatorGlyph, mutatorInertVerdict, mutatorSlotPrice, mutatorUnlockTargets, bindMutatorDrag } from "./mutators";
import { META, RARITY_LABEL, tierWord } from "./meta";
import { isPhoneWidth, scrollTopOf } from "./container";
import { wireTooltips } from "./instrument";
import { profileGradesHtml } from "./profile";
import { moduleFlowsHtml, mutatorFlowHtml } from "./hexflows";
import { contextMapSvg } from "./contextmap";
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
  harmonizer: silentBenefit,
  echo: silentBenefit,
  bend: silentBenefit,
  amplifier: ({ levels, tierPower }) => `+${formatNumber(100 * BALANCE.amplifierGainPerLevel * levels * tierPower)}% relay gain`,
  ritual: ({ levels, tierPower }) => `+${formatNumber(100 * BALANCE.ritualAmpPerLevel * levels * tierPower)}% build amplification`,
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
  const snapshotFlow = upgrade || flowLive(state);
  const module = deployedAt(state, pos);
  const phone = isPhoneWidth();
  const mutItem = mutatorAt(state, pos);
  // The rebuild key's inputs (#349): every entry below is a raw input the
  // rendered stack derives its readouts from — module shape, the face's
  // power and the contribution's own figures, the charge register, the
  // mutator's identity, the tray's stock, the chord row's marks — never a
  // formatted string. The old key stringified computed prose (the face
  // readout, the chord row, the whole contribution object) every tick, so
  // the guard itself cost a large fraction of the rebuild it guarded.
  // Derivation notes: the face readout's relay, booster, and ritual
  // figures derive from hostPower, chargeStrength, and the level below;
  // the mutator slot's inert verdict derives from the module's presence,
  // the mutator's family, and the contribution's chord factor.
  const contribution = module ? snapshot.contributions.get(module.id) ?? null : null;
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
    mutItem ? `${mutItem.id}:${mutItem.rarity}:${mutItem.family}` : mutItem,
    state.mutatorSlots.length,
    state.catalogEntryOwned,
    // The context map's board (ADR-0072): a purchase or Row unlock moves
    // the in-range patch the miniature draws.
    state.cells.length,
    state.unlockedRows.join(","),
    // The open inventory (issue #296) and what waits in it: a placement
    // changes both, so the tray and its tiles can never show stale stock.
    state.modules.filter((m) => m.pos === null).map((m) => `${m.id}:${m.type}:${m.level}:${m.tier}`),
    state.mutators.filter((m) => m.pos === null).map((m) => `${m.id}:${m.family}:${m.rarity}`),
    upgrade ? Math.floor(state.arete) : 0,
    upgrade ? ui.bulkCount : 0,
    upgrade ? Math.floor(wholeNous(state)) : 0,
    chordRow.key,
    snapshot.achievementBoost,
    snapshot.discoveryBoost,
    snapshot.ritualAmplification,
    state.habits.find((habit) => habit.id === state.activeHabitId && !habit.archived)?.build,
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
          ${mutatorLayerHtml(app, pos, snapshot)}
          ${mutatorFlowHtml(state, pos, module, snapshot, snapshotFlow)}
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
  // The context map's navigation (ADR-0072): an owned cell — by click,
  // Enter, or Space — opens that coordinate's cross-section at the
  // current face. The opened cell renders as the marker, never a control.
  host.querySelectorAll<HTMLElement>("[data-ctx-cell]").forEach((node) => {
    const [q, r] = node.getAttribute("data-ctx-cell")!.split(",").map(Number);
    const open = (): void => {
      if (ui.detail && (ui.detail.pos.q !== q || ui.detail.pos.r !== r)) app.openDetail({ q, r }, ui.detail.face);
    };
    app.listen(node, "click", open);
    app.listen(node, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
  const navigation = host.querySelector<HTMLSelectElement>("[data-ctx-navigation]");
  app.listen(navigation, "change", () => {
    if (!navigation || !ui.detail) return;
    const [q, r] = navigation.value.split(",").map(Number);
    app.openDetail({ q, r }, ui.detail.face);
  });
  // The mutator actions and the buy column wire together — an empty
  // place's stack still carries the unlock control.
  if (module) wireDetailBuy(app, host, module.id);
  wireDetailMutatorActions(app, pos);
  if (upgrade) {
    const moduleFace = host.querySelector<HTMLElement>('[data-detail-face="modules"]');
    if (moduleFace) {
      moduleFace.dataset.cell = `${pos.q},${pos.r}`;
      if (module) bindPointerDrag(app, moduleFace, module.id);
    }
    const mutatorFace = host.querySelector<HTMLElement>('[data-detail-face="mutators"]');
    if (mutatorFace && state.mutatorSlots.some((slot) => sameHex(slot, pos))) {
      mutatorFace.dataset.mutSlot = `${pos.q},${pos.r}`;
      const item = mutatorAt(state, pos);
      if (item) bindMutatorDrag(app, mutatorFace, item.id, pos);
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

/* ── The Mutators face ──────────────────────────────── */
// The slot's own hex, above the module, in the arete register — the same
// chassis size, its state spoken in the instrument grammar and the slot
// face's own vocabulary (family word, glyph, rarity ticks, effect). The
// hosting relation is the stack itself: the module occupies the position
// directly below, so no face repeats "hosts".

function mutatorLayerHtml(app: App, pos: Hex, snapshot: RateSnapshot): string {
  const { state, ui } = app;
  const selected = ui.detail?.face === "mutators";
  const note = cellNoteOf(pos);
  const { chassis, tip } = mutatorChassisHtml(state, pos, snapshot);
  // The face's own post only — its one action (the priced unlock) rides
  // the action rail below the stack when the Mutators face holds focus
  // (ADR-0072). The Catalog entry walk belongs to the surrounding
  // navigation (the legend's locked symbol, the dock's Catalog door),
  // never a destination button in the detail (issue #388); retrieval uses
  // the shared inventory. Every refusal names its rule; no surface
  // promises a ν/s figure (issue #199's never-say rule).
  return `<section class="hex-detail-layer mutators${selected ? " selected" : ""}" data-detail-section="mutators" tabindex="-1" aria-label="Mutators — ${state.catalogEntryOwned ? "slot state" : "locked"} at ${note}">
    <span class="hex-orbit"><span class="inst-tip"><button class="hex-stack-chassis inst-tip-trigger" data-detail-face="mutators" aria-pressed="${selected}" aria-describedby="${tip.id}" aria-label="Emphasize the Mutators face">${chassis}</button>${tip.html}</span></span>
  </section>`;
}

// The mutator chassis per state (viewBox −70..70; the chassis polygon is
// the slot face's own radius). Locked wears the muted outline and the
// lock mark — pre-entry (the layer itself) and post-entry ineligible
// (the position the growth rule cannot reach yet) alike, the tooltip
// naming which rule holds; an eligible empty cell wears the clear
// outline; the open slot wears the dashed chassis and its inert promise;
// the occupied slot wears the family's declaration.
function mutatorChassisHtml(state: GameState, pos: Hex, snapshot: RateSnapshot): { chassis: string; tip: { id: string; html: string } } {
  const note = cellNoteOf(pos);
  if (!state.catalogEntryOwned) {
    const id = detailTipId();
    return {
      chassis: lockedChassisHtml(),
      tip: { id, html: `<span class="inst-tip-body" id="${id}" role="tooltip">Unlocks with the Mutator entry</span>` },
    };
  }
  const item = mutatorAt(state, pos);
  if (!item) {
    const slotted = state.mutatorSlots.some((slot) => sameHex(slot, pos));
    if (!slotted) {
      const eligible = mutatorUnlockTargets(state).some((target) => sameHex(target, pos));
      const id = detailTipId();
      if (!eligible) {
        // The locked state (issue #388): the position cannot host a slot
        // until the patch reaches an adjacent unlock — the same muted
        // face the board's Mutators layer draws (issue #386), its
        // accessible help naming the prerequisite concretely.
        return {
          chassis: lockedChassisHtml(),
          tip: { id, html: `<span class="inst-tip-body" id="${id}" role="tooltip">Unlock an adjacent Mutator slot first</span>` },
        };
      }
      return {
        chassis: `<svg class="hex-stack-mut" viewBox="-70 -70 140 140" aria-hidden="true">
          <polygon class="mut-slot-hex" points="${hexPoints(56)}"/>
          <text class="mut-slot-family" y="-4" text-anchor="middle">NO SLOT</text>
          <polygon class="hex-stack-marker" points="${hexPoints(53)}"/>
        </svg>`,
        tip: { id, html: `<span class="inst-tip-body" id="${id}" role="tooltip">A Mutator slot can attach here${state.mutatorSlots.length === 0 ? " — the first is free" : ""}</span>` },
      };
    }
    // The vacant slot: legal, and it speaks — inert until a host lands.
    const id = detailTipId();
    return {
      chassis: `<svg class="hex-stack-mut open" viewBox="-70 -70 140 140" aria-hidden="true">
        <polygon class="mut-slot-hex dashed" points="${hexPoints(56)}"/>
        <text class="mut-slot-family" y="-6" text-anchor="middle">OPEN SLOT</text>
        <text class="mut-slot-verdict" y="16" text-anchor="middle">inert · no host</text>
        <polygon class="hex-stack-marker" points="${hexPoints(53)}"/>
      </svg>`,
      tip: { id, html: `<span class="inst-tip-body" id="${id}" role="tooltip">Open slot at ${note} — a placed mutator modifies whatever module occupies this cell</span>` },
    };
  }
  const inert = mutatorInertVerdict(state, pos, item, snapshot);
  const id = detailTipId();
  // The engraving keeps every line inside the chassis taper: the family
  // word in the wide top band, the glyph at center, the rarity ticks and
  // the compact percentage beneath — the full sentence rides the tooltip.
  return {
    chassis: `<svg class="hex-stack-mut occupied${inert ? " mut-inert" : ""}" viewBox="-70 -70 140 140" aria-hidden="true">
      <polygon class="mut-slot-hex" points="${hexPoints(56)}"/>
      <text class="mut-slot-family" y="-26" text-anchor="middle">${FAMILY_WORD[item.family].toUpperCase()}</text>
      <g class="mut-slot-glyph" transform="translate(0 -2) scale(1.5)">${mutatorGlyph(item.family, 1)}</g>
      <g class="mut-slot-ticks" transform="translate(0 22) scale(2.2)">${rarityTicks(item.rarity)}</g>
      <text class="mut-slot-effect mono" y="44" text-anchor="middle">${inert ?? mutatorShortPercent(item.family, item.rarity)}</text>
      <polygon class="hex-stack-marker" points="${hexPoints(53)}"/>
    </svg>`,
    tip: {
      id,
      html: `<span class="inst-tip-body" id="${id}" role="tooltip">${FAMILY_WORD[item.family]} mutator · ${RARITY_LABEL[item.rarity]} — ${inert ?? mutatorEffectText(item.family, item.rarity)}</span>`,
    },
  };
}

// The locked face's drawing, shared by the layer lock (pre-entry) and the
// ineligible position (post-entry): the muted outline, the lock mark, the
// state in words — the tooltip names which rule holds.
function lockedChassisHtml(): string {
  return `<svg class="hex-stack-mut locked" viewBox="-70 -70 140 140" aria-hidden="true">
    <polygon class="mut-slot-hex muted" points="${hexPoints(56)}"/>
    <g class="hex-stack-lock" transform="translate(-13 -24) scale(2.2)"><rect x="2.7" y="5.4" width="6.6" height="4.9" rx="1.1"/><path d="M4.2 5.4V3.9a1.8 1.8 0 0 1 3.6 0v1.5"/></g>
    <text class="mut-slot-family" y="34" text-anchor="middle">LOCKED</text>
    <polygon class="hex-stack-marker" points="${hexPoints(53)}"/>
  </svg>`;
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
   column (pickers, dial, button); Mutators focus carries the priced
   slot unlock where a slot can attach. Flow leaves no rail at all. */

function actionRailHtml(app: App, pos: Hex, module: ModuleInstance | undefined): string {
  const { state, ui } = app;
  if (state.mode !== "upgrade") return "";
  if (ui.detail?.face === "mutators") {
    if (!state.catalogEntryOwned) return "";
    if (state.mutatorSlots.some((slot) => sameHex(slot, pos))) return "";
    const eligible = mutatorUnlockTargets(state).some((target) => sameHex(target, pos));
    if (!eligible) return "";
    const price = mutatorSlotPrice(state);
    const affordable = state.arete >= price;
    const note = cellNoteOf(pos);
    const id = detailTipId();
    return `<div class="hex-detail-actions"><span class="inst-tip"><button class="hex-action${affordable ? "" : " st-unavailable"}" id="detail-mutator-unlock" aria-disabled="${!affordable}" aria-describedby="${id}">${price === 0 ? "Unlock slot · free" : `Unlock slot · <span class="mono">${formatInt(price)} ◇</span>`}${affordable ? "" : " · need Arete"}</button><button class="inst-tip-trigger" aria-label="About slot unlock" aria-describedby="${id}" aria-expanded="false">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${affordable ? `Unlock a Mutator slot at ${note}` : `Not enough Arete · needs ${formatInt(price)} ◇, have ${formatInt(state.arete)} ◇`}</span></span></div>`;
  }
  return module ? `<div class="hex-detail-actions">${detailBuyHtml(app, module)}</div>` : "";
}

/* ── The details column (ADR-0072) ────────────────────
   The standing facts in open sections, headed by the context map: the
   whole in-range board in miniature — the opened hex in the firm
   selected marker, its active chords in their hues — then the profile
   grades, the chord facts in the reserved readout's grammar (issue
   #388), and the occupied mutator's line. Sections render only with
   content; the waves keep their breakdown disclosures. */

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
  const mutItem = mutatorAt(state, pos);
  if (mutItem) {
    const inert = mutatorInertVerdict(state, pos, mutItem, displayedRates(state, true));
    sections.push(`<section class="hex-detail-section"><span class="hex-detail-section-head">Mutator</span><p class="hex-detail-mutator-line">${FAMILY_WORD[mutItem.family]} · ${inert ?? mutatorEffectText(mutItem.family, mutItem.rarity)}</p></section>`);
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

// Slot unlock stays local to the opened coordinate.
function wireDetailMutatorActions(app: App, pos: Hex): void {
  app.listen(document.getElementById("detail-mutator-unlock"), "click", () => {
    app.mutUnlockAt(pos);
  });
}

/* ── The tooltip layer's ids ──────────────────────────
   A rebuilt stack must never reuse a portaled body's id (the ledger's
   rule): the seq scopes every rebuild's disclosures. */

let detailTipSeq = 0;
const detailTipId = (): string => `detail-tip-${++detailTipSeq}`;

// The face's compact percentage (the chassis taper fits little more):
// the concrete effect as its own figure — the family word above says
// what it modifies, the tooltip carries the full sentence.
function mutatorShortPercent(family: MutatorInstance["family"], rarity: MutatorInstance["rarity"]): string {
  return `+${Math.round(mutatorMagnitude(family, rarity) * 100)}%`;
}
