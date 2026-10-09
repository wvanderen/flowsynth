// The Hex detail (issue #295): the module bloom's successor — an owned
// board coordinate's full-stack cross-section, standing where the grid
// stood, at every width. The presentation is the instrument metaphor, not
// a panel of cards: the cell's column lifted toward the camera, frameless
// at stage center — the module face below at bloom scale (the face itself
// is the plate: level, nameplate, signature, rarity rings, live readout,
// pitch), the Mutators face above it in the arete register, same chassis,
// its state spoken in the four-state grammar (muted outline = locked or
// ineligible, clear outline = eligible, dashed = open slot, occupied =
// the family's own declaration). The faces carry the information; the
// composition adds only what faces cannot say — the action rail beside
// the stack (upgrade dial, unlock / retrieve / entry), one chord row in
// the reserved readout's grammar, a compact Return control, and the flow
// tag. Nothing else: the deeper mechanics ride the tooltip layer (issue
// #267's inst-tip).
//
// The fixed stack shows both layers, Mutators above Modules, in that
// order always; a face selection emphasizes one section, focuses its
// control, and synchronizes the vertical layer legend without ever
// reordering. Editing lives in upgrade mode only: during flow the same
// cross-section opens read-only, its readouts live, its controls gone —
// the click still answers the lock.
import { affordableLevels, deployedAt, displayedRates, hostPower, levelCost, levelsCost, mutatorAt, mutatorMagnitude, wholeNous } from "../engine/economy";
import { BALANCE } from "../engine/constants";
import { sameHex } from "../engine/hex";
import { cellNoteOf, noteNameOf, pitchOf } from "../engine/lattice";
import type { GameState, Hex, ModuleInstance, MutatorInstance, RateSnapshot } from "../engine/types";
import type { App, DetailFace } from "./app";
import { HEX_RADIUS, hexPoints, moduleFace, forgeBranchOf, faceLevel, faceReadoutFor, waterFill, zeroBuyRead } from "./face";
import { chargeGlow } from "./leads";
import { formatInt, formatNumber } from "./format";
import { FAMILY_WORD, rarityTicks, mutatorEffectText, mutatorGlyph, mutatorInertVerdict, mutatorSlotPrice, mutatorUnlockTargets, mutatorTileSvg } from "./mutators";
import { META, RARITY_LABEL } from "./meta";
import { isPhoneWidth } from "./container";
import { wireTooltips } from "./instrument";

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
}

// The synth benefit is exact at every local effect: value/power is the
// module's per-power ν/s (chord factor, booster uplift, charge, and
// achievements all in — ADR-0036), so one level's power gain scales it
// directly instead of quoting a bare-term figure chords would understate.
const synthBenefit = ({ gain, power, value }: DetailEffectInput): string | null =>
  `+${formatNumber((value / power) * gain)} ν/s`;

// The silent voices' benefit: the level buys the chord-instance uplift
// (ADR-0048), never production.
const silentBenefit = ({ levels }: DetailEffectInput): string | null =>
  `+${formatNumber(100 * BALANCE.silentVoiceUpliftPerLevel * levels)}% chord-instance uplift`;

// The generators' benefit (ADR-0047): level scales output strength only,
// never the banked duration.
const generatorBenefit = ({ gain }: DetailEffectInput): string | null => `+${formatNumber(gain)} strength`;

const DETAIL_BENEFITS: Record<ModuleInstance["type"], (input: DetailEffectInput) => string | null> = {
  additive: synthBenefit,
  // The Blaster's charge conversion replaces the charge factor: one level
  // scales its whole charge-sourced term (ADR-0048).
  blaster: synthBenefit,
  harmonizer: silentBenefit,
  echo: silentBenefit,
  bend: silentBenefit,
  amplifier: ({ levels }) => `+${formatNumber(100 * BALANCE.amplifierGainPerLevel * levels)}% relay gain`,
  ritual: ({ levels }) => `+${formatNumber(100 * BALANCE.ritualAmpPerLevel * levels)}% build amplification`,
  // The silent wire buys nothing with a level, so it wears no button at all.
  spacer: () => null,
  focusKeyed: generatorBenefit,
  noteKeyed: generatorBenefit,
  goalKeyed: generatorBenefit,
  infusor: ({ gain }) => `+${formatNumber(100 * BALANCE.infusorBonus * gain)}% uplift`,
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
  });
}

/* ── The stage ──────────────────────────────────────── */

// The detail's host: hidden until an owned cell's click opens it. The
// class flip (body.hex-detail-open) retires the grid's pointer surface
// while the stack stands — the grid, tray, and zoom cluster come back
// exactly as they left; the open itself is the display transition, so its
// one-time lift needs no markup (a rebuild never re-triggers it).
// `chordRow` arrives from the readout's own module (render.ts owns the
// reserved grammar); the row mounts beside the module face and rides the
// rebuild key so a live read never shows stale chips.
export function renderHexDetail(app: App, live: RateSnapshot, projected: RateSnapshot, chordRow: string): void {
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
    module ? forgeBranchOf(state, module.type) : null,
    module ? faceReadoutFor(state, module, pos, snapshot, true) : null,
    module ? snapshot.chargeStrength.get(module.id) ?? 0 : 0,
    mutItem ? mutatorInertVerdict(state, pos, mutItem, snapshot) : null,
    mutItem ? `${mutItem.id}:${mutItem.rarity}:${mutItem.family}` : mutItem,
    state.mutatorSlots.length,
    state.catalogEntryOwned,
    // The open inventory (issue #296) and what waits in it: a placement
    // changes both, so the tray and its tiles can never show stale stock.
    ui.detailTray,
    state.modules.filter((m) => m.pos === null).map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}`),
    state.mutators.filter((m) => m.pos === null).map((m) => `${m.id}:${m.family}:${m.rarity}`),
    upgrade ? Math.floor(state.arete) : 0,
    upgrade ? ui.bulkCount : 0,
    upgrade ? Math.floor(wholeNous(state)) : 0,
    chordRow,
  ]);
  if (host.dataset.renderKey === key) {
    host.hidden = false;
    return;
  }
  // A changed read rebuilds the stack. Preserve the focused control and
  // scroll, and retire portaled tooltips before reusing chord disclosure IDs.
  const focused = document.activeElement;
  const focusAttribute = focused instanceof HTMLElement && host.contains(focused)
    ? ["id", "data-detail-face", "data-bulk", "data-shift", "aria-describedby"]
        .find((attribute) => focused.hasAttribute(attribute))
    : undefined;
  const focusValue = focusAttribute ? focused!.getAttribute(focusAttribute) : null;
  releaseTooltips();
  const grid = host.querySelector<HTMLElement>(".hex-detail-grid");
  const scrollTop = grid?.scrollTop ?? 0;
  host.dataset.renderKey = key;
  host.classList.toggle("sheet", phone);
  host.innerHTML = `
    <div class="hex-detail-scene${flow ? " readonly" : ""}" data-face="${detail.face}">
      <div class="hex-detail-corner">
        <button class="hex-detail-return" id="hex-detail-return" title="Return to the grid">Return</button>
        ${flow ? `<span class="hex-detail-readonly">flow live · read-only</span>` : ""}
      </div>
      <div class="hex-detail-grid">
        ${mutatorLayerHtml(app, pos, snapshot)}
        ${moduleLayerHtml(app, pos, module, snapshot, chordRow)}
      </div>
      ${detailTrayHtml(app, "modules")}
      ${detailTrayHtml(app, "mutators")}
    </div>`;
  app.listen(document.getElementById("hex-detail-return"), "click", () => app.closeDetail());
  // The faces are the sections: clicking a face's chassis emphasizes it
  // (the legend and the state grammar follow; no menu tabs on the content).
  host.querySelectorAll<HTMLElement>("[data-detail-face]").forEach((chassis) => {
    const face = chassis.getAttribute("data-detail-face") as DetailFace;
    app.listen(chassis, "click", () => app.detailFace(face));
  });
  // The mutator actions and the buy column wire together — an empty
  // place's stack still carries the unlock and entry controls.
  if (module) wireDetailBuy(app, host, module.id);
  else wireModuleRail(app, null);
  wireDetailMutatorActions(app, pos);
  wireDetailTray(app, "modules");
  wireDetailTray(app, "mutators");
  const freshGrid = host.querySelector<HTMLElement>(".hex-detail-grid");
  if (freshGrid && scrollTop > 0) freshGrid.scrollTo(0, scrollTop);
  host.hidden = false;
  wireTooltips(host, app.signal);
  if (focusAttribute && focusValue !== null) {
    [...host.querySelectorAll<HTMLElement>(`[${focusAttribute}]`)]
      .find((control) => control.getAttribute(focusAttribute) === focusValue)
      ?.focus({ preventScroll: true });
  }
}

/* ── The orbital controls (issue #296 review) ─────────
   Swap and Retrieve are gestures on the cell itself, so they ride as icon
   controls orbiting the emphasized chassis — top-right and bottom-right of
   the face's bounding box, in the empty space the hexagon's taper leaves —
   not as text rows in the rail. The rail keeps the state actions (Add, the
   unlock ladder, the upgrade band); the orbit keeps the inventory
   gestures. */

const ORBIT_SWAP_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5"/><path d="M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5"/></svg>`;
const ORBIT_RETRIEVE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9m0 0 3.5-3.5M12 12 8.5 8.5"/><path d="M4 14v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"/></svg>`;

// The two inventory gestures around one chassis: Swap opens the layer's
// tray (choosing swaps the resident out), Retrieve returns it outright.
function orbitHtml(face: DetailFace, resident: string): string {
  const retrieveTitle = face === "modules"
    ? `Retrieve ${resident} to the tray`
    : `Retrieve to the Mutator tray`;
  return ([
    ["swap", "Swap — pick one from the tray", `Swap — pick a ${face === "modules" ? "module" : "mutator"} from the tray; the resident waits in the tray`, ORBIT_SWAP_SVG],
    ["retrieve", retrieveTitle, retrieveTitle, ORBIT_RETRIEVE_SVG],
  ] as const).map(([action, label, explanation, icon]) => {
    const id = detailTipId();
    return `<span class="inst-tip hex-orbit-control orbit-${action}"><button class="hex-orbit-btn inst-tip-trigger" id="detail-${face === "modules" ? "module" : "mutator"}-${action}" aria-label="${label}" aria-describedby="${id}" aria-expanded="false">${icon}</button><span class="inst-tip-body" id="${id}" role="tooltip">${explanation}</span></span>`;
  }).join("");
}

/* ── The Mutators face ──────────────────────────────── */
// The slot's own hex, above the module, in the arete register — the same
// chassis size, its state spoken in the instrument grammar and the slot
// face's own vocabulary (family word, glyph, rarity ticks, effect). The
// hosting relation is the stack itself: the module occupies the position
// directly below, so no face repeats "hosts".

function mutatorLayerHtml(app: App, pos: Hex, snapshot: RateSnapshot): string {
  const { state, ui } = app;
  const upgrade = state.mode === "upgrade";
  const selected = ui.detail?.face === "mutators";
  const note = cellNoteOf(pos);
  const item = mutatorAt(state, pos);
  const { chassis, tip } = mutatorChassisHtml(state, pos, snapshot);
  // The rail's one action per state — the Catalog entry walk while the
  // layer stands locked, the priced unlock where a slot can attach, Add
  // mutator at a vacant slot. Swap and Retrieve orbit the chassis instead
  // (issue #296 review). Every refusal names its rule; no surface
  // promises a ν/s figure (issue #199's never-say rule).
  let rail = "";
  if (upgrade) {
    if (!state.catalogEntryOwned) {
      rail = `<button class="hex-action" id="detail-mutator-entry" title="Open the Catalog's Mutator entry screen">Catalog entry</button>`;
    } else if (!state.mutatorSlots.some((slot) => sameHex(slot, pos))) {
      const eligible = mutatorUnlockTargets(state).some((target) => sameHex(target, pos));
      if (eligible) {
        const price = mutatorSlotPrice(state);
        const affordable = state.arete >= price;
        const id = detailTipId();
        rail = `<span class="inst-tip"><button class="hex-action${affordable ? "" : " st-unavailable"}" id="detail-mutator-unlock" aria-disabled="${!affordable}" aria-describedby="${id}">${price === 0 ? "Unlock slot · free" : `Unlock slot · <span class="mono">${formatInt(price)} ◇</span>`}${affordable ? "" : " · need Arete"}</button><button class="inst-tip-trigger" aria-label="About slot unlock" aria-describedby="${id}" aria-expanded="false">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${affordable ? `Unlock a Mutator slot at ${note}` : `Not enough Arete — requires ${formatInt(price)} ◇; available ${formatInt(state.arete)} ◇`}</span></span>`;
      } else {
        rail = `<span class="hex-detail-noslot" title="Slot unlocks attach beside the Mutator patch — each new slot neighbors an unlocked one">beside the patch only</span>`;
      }
    } else if (!item) {
      rail = `<button class="hex-action" id="detail-mutator-add" title="Open the Mutator tray — choosing a mutator places it in this slot">Add mutator</button>`;
    }
  }
  const orbit = upgrade && item ? orbitHtml("mutators", FAMILY_WORD[item.family]) : "";
  return `<section class="hex-detail-layer mutators${selected ? " selected" : ""}" data-detail-section="mutators" tabindex="-1" aria-label="Mutators — ${state.catalogEntryOwned ? "slot state" : "locked"} at ${note}">
    <span class="hex-orbit"><span class="inst-tip"><button class="hex-stack-chassis inst-tip-trigger" data-detail-face="mutators" aria-pressed="${selected}" aria-describedby="${tip.id}" aria-label="Emphasize the Mutators face">${chassis}</button>${tip.html}</span>${orbit}</span>
  </section>
  <aside class="hex-rail-row mutators${selected ? " selected" : ""}">${rail}</aside>`;
}

// The mutator chassis per state (viewBox −70..70; the chassis polygon is
// the slot face's own radius). Locked wears the muted outline and the
// lock mark; an eligible empty cell wears the clear outline; the open
// slot wears the dashed chassis and its inert promise; the occupied slot
// wears the family's declaration.
function mutatorChassisHtml(state: GameState, pos: Hex, snapshot: RateSnapshot): { chassis: string; tip: { id: string; html: string } } {
  const note = cellNoteOf(pos);
  if (!state.catalogEntryOwned) {
    const id = detailTipId();
    return {
      chassis: `<svg class="hex-stack-mut locked" viewBox="-70 -70 140 140" aria-hidden="true">
        <polygon class="mut-slot-hex muted" points="${hexPoints(56)}"/>
        <g class="hex-stack-lock" transform="translate(-13 -24) scale(2.2)"><rect x="2.7" y="5.4" width="6.6" height="4.9" rx="1.1"/><path d="M4.2 5.4V3.9a1.8 1.8 0 0 1 3.6 0v1.5"/></g>
        <text class="mut-slot-family" y="34" text-anchor="middle">LOCKED</text>
        <polygon class="hex-stack-marker" points="${hexPoints(53)}"/>
      </svg>`,
      tip: { id, html: `<span class="inst-tip-body" id="${id}" role="tooltip">Unlocks with the Mutator entry</span>` },
    };
  }
  const item = mutatorAt(state, pos);
  if (!item) {
    const slotted = state.mutatorSlots.some((slot) => sameHex(slot, pos));
    if (!slotted) {
      const eligible = mutatorUnlockTargets(state).some((target) => sameHex(target, pos));
      const id = detailTipId();
      return {
        chassis: `<svg class="hex-stack-mut" viewBox="-70 -70 140 140" aria-hidden="true">
          <polygon class="mut-slot-hex${eligible ? "" : " muted"}" points="${hexPoints(56)}"/>
          <text class="mut-slot-family" y="-4" text-anchor="middle">NO SLOT</text>
          <polygon class="hex-stack-marker" points="${hexPoints(53)}"/>
        </svg>`,
        tip: { id, html: `<span class="inst-tip-body" id="${id}" role="tooltip">${eligible ? `A Mutator slot can attach here${state.mutatorSlots.length === 0 ? " — the first is free" : ""}` : "Unlocks attach beside the Mutator patch"}</span>` },
      };
    }
    // The vacant slot: legal, and it speaks — inert until a host lands.
    const id = detailTipId();
    return {
      chassis: `<svg class="hex-stack-mut open" viewBox="-70 -70 140 140" aria-hidden="true">
        <polygon class="mut-slot-hex dashed" points="${hexPoints(56)}"/>
        <text class="mut-slot-family" y="-6" text-anchor="middle">OPEN SLOT</text>
        <text class="mut-slot-host" y="16" text-anchor="middle">inert · no host</text>
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

/* ── The Modules face ───────────────────────────────── */

function moduleLayerHtml(app: App, pos: Hex, module: ModuleInstance | undefined, snapshot: RateSnapshot, chordRow: string): string {
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
    chassis = `<svg class="hex-stack-face" viewBox="-70 -70 140 140" data-type="${module.type}" data-rarity="${module.rarity}" aria-hidden="true">${moduleFace({
      type: module.type,
      rarity: module.rarity,
      readout: read.readout,
      ...(read.readoutClass ? { readoutClass: read.readoutClass } : {}),
      ...(read.note ? { note: read.note } : {}),
      level: faceLevel(module),
      ...(charged ? { hexClass: "charged", chargeGlow: chargeGlow(strength) } : {}),
      ...(branch ? { under: waterFill(module.id, branch.progress / branch.threshold) } : {}),
    })}<polygon class="hex-stack-marker" points="${hexPoints(58)}"/></svg>`;
    tip = {
      id,
      html: `<span class="inst-tip-body" id="${id}" role="tooltip">${META[module.type].name} · ${RARITY_LABEL[module.rarity]}${faceLevel(module) !== undefined ? ` · level ${module.level}` : ""} · ${read.readout}${read.note ? ` · sings ${read.note}` : ""}${charged ? " · charged" : ""}</span>`,
    };
  }
  // The rail's affordances (issue #296): an empty place opens the tray
  // with Add module; a standing module's Swap and Retrieve orbit the
  // chassis instead, and the upgrade band rides the rail beneath. Flow
  // wears none of it.
  let rail = "";
  if (module && upgrade) {
    rail = detailBuyHtml(app, module);
  } else if (upgrade) {
    rail = `<button class="hex-action" id="detail-module-add" title="Open the tray — choosing a module places it here">Add module</button>`;
  }
  const orbit = module && upgrade ? orbitHtml("modules", META[module.type].name) : "";
  const row = chordRow ? `<div class="hex-chord-row">${chordRow}</div>` : "";
  return `<section class="hex-detail-layer modules${selected ? " selected" : ""}" data-detail-section="modules" tabindex="-1" aria-label="Modules — ${module ? `${META[module.type].name} at ${note}` : `empty place at ${note}`}">
    <span class="hex-orbit"><span class="inst-tip"><button class="hex-stack-chassis inst-tip-trigger" data-detail-face="modules" aria-pressed="${selected}" aria-describedby="${tip.id}" aria-label="Emphasize the Modules face">${chassis}</button>${tip.html}</span>${orbit}</span>
    ${row}
  </section>
  <aside class="hex-rail-row modules${selected ? " selected" : ""}">${rail}</aside>`;
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
  const benefit = benefitOf(app, module, snapshot, 1, BALANCE.rarityPower[module.rarity]);
  const maxLevels = affordableLevels(wholeNous(state), module.level);
  const want = ui.bulkCount === "max" ? maxLevels : ui.bulkCount;
  const bulkCost = levelsCost(module.level, want);
  const bulkBenefit = benefitOf(app, module, snapshot, want, BALANCE.rarityPower[module.rarity] ** want);
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
      ? `<div class="hex-shift" role="group" aria-label="Pitch shift">${BALANCE.bendShifts[module.rarity]
          .map((shift) => {
            const active = (module.shift ?? 1) === shift;
            const label = `${shift > 0 ? "♯" : "♭"}${Math.abs(shift)}`;
            return `<button class="hex-shift-chip${active ? " active" : ""}" data-shift="${shift}" aria-pressed="${active}" title="${shift > 0 ? "Sharp" : "Flat"} ${Math.abs(shift)} — sings ${noteNameOf(pitchOf(module.pos!) + shift)}">${label}</button>`;
          })
          .join("")}</div>`
      : "";
  return `${shiftPicker}${dial}${upgradeButton}`;
}

// The buy column's wiring (issue #195 shape, #295 surface): the button
// buys the dial's selected count — partial by design — and a chip pick
// re-renders so cost, benefit, and MAX·k follow. The unlock and retrieve
// land through the same app actions the grid gestures use.
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
  wireModuleRail(app, moduleId);
}

// Hover and focus disclose on the action itself. A first touch pins the
// explanation; a second touch activates. Mouse and keyboard activate directly.
function wireOrbitAction(app: App, id: string, action: () => void): void {
  const button = document.getElementById(id);
  let touch = false;
  app.listen(button, "pointerdown", (event) => {
    touch = (event as PointerEvent).pointerType === "touch";
  });
  app.listen(button, "click", (event) => {
    const touchClick = touch || (event as PointerEvent).pointerType === "touch";
    touch = false;
    if (touchClick && !button?.closest(".inst-tip")?.classList.contains("show")) return;
    action();
  });
}

// The Modules face's rail wiring (issue #296): Add and Swap open the
// detail's module tray, Retrieve returns the resident straight to the
// tray — the detail manages its own Hex, no grid trip needed.
function wireModuleRail(app: App, moduleId: string | null): void {
  app.listen(document.getElementById("detail-module-add"), "click", () => app.openDetailTray("modules"));
  wireOrbitAction(app, "detail-module-swap", () => app.openDetailTray("modules"));
  wireOrbitAction(app, "detail-module-retrieve", () => {
    if (moduleId) app.returnToInventory(moduleId);
  });
}

// The Mutators face's action wiring — present on every stack, module or
// empty: Add and Swap open the detail's Mutator tray, retrieve, the priced
// unlock, and the locked layer's entry walk.
function wireDetailMutatorActions(app: App, pos: Hex): void {
  app.listen(document.getElementById("detail-mutator-add"), "click", () => app.openDetailTray("mutators"));
  wireOrbitAction(app, "detail-mutator-swap", () => app.openDetailTray("mutators"));
  wireOrbitAction(app, "detail-mutator-retrieve", () => {
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

/* ── The detail's inventory (issue #296) ──────────────
   The tray re-docked beside the stack: hidden until a layer's Add or Swap
   opens it, its tiles placing straight into the detail's place — no
   second destination click, no destination the player can misread. The
   tray belongs to one face; a layer switch closes it. Cancel closes it
   without changes. The minimal tile mark is the tray's own language; the
   tooltip layer carries what the mark leaves off. */

function detailTrayHtml(app: App, face: DetailFace): string {
  const { state, ui } = app;
  if (ui.detailTray !== face) return "";
  const detail = ui.detail!;
  const swap = face === "modules"
    ? deployedAt(state, detail.pos) !== undefined
    : mutatorAt(state, detail.pos) !== undefined;
  const destination = face === "modules"
    ? `choosing places it here${swap ? ", the resident to the tray" : ""}`
    : `choosing places it in the slot${swap ? ", the resident to the Mutator tray" : ""}`;
  // The larger cell preview (issue #296 review): the module's own face at
  // tray scale — nameplate, rarity rings, level — not the board column's
  // minimal mark. The readout stays off the preview: an undeployed module
  // has no contribution to show, and a tray figure that says "+0" would
  // misread the swap; the tooltip carries the rarity words.
  const tiles = face === "modules"
    ? state.modules
        .filter((m) => m.pos === null)
        .map((m) => {
          const id = detailTipId();
          return `<span class="inst-tip tray-tile-detail"><button class="inventory-tile tray-face-tile" data-detail-place="${m.id}" data-rarity="${m.rarity}" data-type="${m.type}" aria-label="${META[m.type].name} · ${RARITY_LABEL[m.rarity]}" aria-describedby="${id}"><svg class="tray-face" viewBox="-70 -70 140 140" data-type="${m.type}" data-rarity="${m.rarity}" aria-hidden="true">${moduleFace({
            type: m.type,
            rarity: m.rarity,
            readout: "",
            level: faceLevel(m),
          })}</svg></button><button class="inst-tip-trigger" aria-label="About ${META[m.type].name}" aria-describedby="${id}" aria-expanded="false">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${META[m.type].name} · ${RARITY_LABEL[m.rarity]} — ${destination}</span></span>`;
        })
        .join("") || `<span class="tray-empty">no modules wait in the tray</span>`
    : state.mutators
        .filter((m) => m.pos === null)
        .map((item) => {
          const id = detailTipId();
          return `<span class="inst-tip tray-tile-detail"><button class="inventory-tile mut-tile" data-detail-place-mut="${item.id}" data-rarity="${item.rarity}" aria-label="${FAMILY_WORD[item.family]} · ${RARITY_LABEL[item.rarity]}" aria-describedby="${id}">${mutatorTileSvg(item)}</button><button class="inst-tip-trigger" aria-label="About ${FAMILY_WORD[item.family]} mutator" aria-describedby="${id}" aria-expanded="false">ⓘ</button><span class="inst-tip-body" id="${id}" role="tooltip">${FAMILY_WORD[item.family]} mutator · ${RARITY_LABEL[item.rarity]} · ${mutatorEffectText(item.family, item.rarity)} — ${destination}</span></span>`;
        })
        .join("") || `<span class="tray-empty">no mutators wait in the Mutator tray</span>`;
  return `<aside class="hex-detail-tray" data-detail-tray="${face}" aria-label="${face === "modules" ? "Tray — the inventory beside the stack" : "Mutator tray"}">
    <div class="hex-detail-tray-head">
      <span class="eyebrow">${face === "modules" ? "TRAY" : "MUTATOR TRAY"}</span>
      <button class="hex-detail-tray-cancel" id="detail-tray-cancel" title="Close the tray — nothing changes">Cancel</button>
    </div>
    <div class="hex-detail-tray-items">${tiles}</div>
  </aside>`;
}

// The tray's wiring (issue #296): Cancel closes without changes; a tile's
// click is the placement itself, landing straight at the detail's place.
function wireDetailTray(app: App, face: DetailFace): void {
  if (app.ui.detailTray !== face) return;
  app.listen(document.getElementById("detail-tray-cancel"), "click", () => app.closeDetailTray());
  const host = document.querySelector(".hex-detail-tray");
  host?.querySelectorAll<HTMLButtonElement>("[data-detail-place]").forEach((button) => {
    app.listen(button, "click", () => app.detailPlaceModule(button.getAttribute("data-detail-place")!));
  });
  host?.querySelectorAll<HTMLButtonElement>("[data-detail-place-mut]").forEach((button) => {
    app.listen(button, "click", () => app.detailPlaceMutator(button.getAttribute("data-detail-place-mut")!));
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
