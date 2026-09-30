// PROTOTYPE — throwaway artifact for wayfinder ticket #184 (map #169).
// Never merge to main. Lives on the prototype/mutator-grid-184 branch.
//
// ITERATION TWO (maintainer reaction to the three-variant round): none of
// the ambient answers expressed the intent — the Mutator Grid is a SECOND
// GRID LAYER, viewed through a tab-like switch beside the board. Arete
// gets its own assigned color (`--arete`, provisional violet, continuity
// with #174's approved Arete banner — one token swap if the hue moves),
// and the module layer marks a hosted mutator with a thin arete outline
// on the module face. (The dot-indicator alternative is a one-mark swap.)
//
//   MODULES tab — the production board as-is; each module whose cell's
//     slot holds a mutator wears the arete outline. Nothing else changes:
//     chords, leads, selection, the expanded face (which still gains the
//     mutator line).
//   MUTATORS tab — the second grid layer: the module board rests (greyed,
//     untouched) and the grid renders as the foreground — one slot face
//     per cell, speaking in full words (family, glyph, rarity ticks,
//     host, effect; inert slots say so). The Mutator tray pins as a
//     strip; unlock, placement, retrieval, and combination live here.
//
// Shared rules: hover asks the reserved readout (never a ν/s claim); the
// combination gesture mirrors the module drop-and-confirm (review before
// anything is consumed; mutators carry no levels — nothing retained or
// refunded); slot unlock arms like a cell purchase (first slot any owned
// cell, later ones adjacent to the unlocked patch — ADR-0043) with the
// pill carrying the single price; mutator rolls offer two candidates.
// Inert cases speak — no effect claims on a chordless host, no promises
// from a vacant slot; the rate details grow no row (ADR-0037/0043).
//
// Run: `npm run dev`, open `/?variant=1` (any ?variant= value arms the
// prototype; `&layer=mutators` deep-links the second layer). The board
// seeds from the playtest save wearing the layer: nine slots — two
// same-family same-rarity pairs to combine, one resonance parked on the
// spacer (inert), one vacant — a two-item tray, and mock Arete (20) for
// the unlock ladder. Saving is disabled while the prototype runs. The
// bar bottom-center carries Unlock slot / Mutator roll as judging
// shortcuts; the real affordances are the tabs and the tray.
import { deserialize } from "../../engine/save";
import { computeRates, deployedAt } from "../../engine/economy";
import { adjacent, sameHex } from "../../engine/hex";
import { cellNoteOf } from "../../engine/lattice";
import type { GameState, Hex, ModuleInstance, Rarity } from "../../engine/types";
import { HEX_RADIUS, hexPoints } from "../face";
import type { App } from "../app";
import { viewPoint, type ViewFrame } from "../bloom";
import playtestSaveRaw from "./playtest-save.json?raw";

type Family = "power" | "resonance" | "charge";
type Layer = "modules" | "mutators";

interface MutItem {
  id: string;
  family: Family;
  rarity: Rarity;
}

interface MutSlot {
  pos: Hex;
  item: MutItem | null;
}

interface MutState {
  layer: Layer;
  slots: MutSlot[];
  tray: MutItem[];
  nextId: number;
  armingUnlock: boolean;
  armedTray: string | null;
  movingFrom: Hex | null;
  carrying: { item: MutItem; origin: Hex | "tray" } | null;
  popoverPos: Hex | null;
}

const mutStates = new WeakMap<App, MutState>();

function mut(app: App): MutState {
  let state = mutStates.get(app);
  if (!state) {
    state = {
      layer: "modules",
      slots: [],
      tray: [],
      nextId: 1,
      armingUnlock: false,
      armedTray: null,
      movingFrom: null,
      carrying: null,
      popoverPos: null,
    };
    mutStates.set(app, state);
  }
  return state;
}

/* ── Mock contracts (ADR-0043; magnitudes are tuning) ── */

const FAMILY_LABEL: Record<Family, string> = { power: "Power", resonance: "Resonance", charge: "Charge" };
const FAMILY_BASE: Record<Family, number> = { power: 0.25, resonance: 0.2, charge: 0.3 };
const RARITY_MULT: Record<Rarity, number> = { common: 1, uncommon: 2, rare: 4 };
// The slot ladder's shape from #183; figures are mock.
const SLOT_PRICES = [1, 2, 3, 5, 8, 12];

function magnitude(family: Family, rarity: Rarity): number {
  return FAMILY_BASE[family] * RARITY_MULT[rarity];
}

function effectText(family: Family, rarity: Rarity): string {
  const pct = `+${Math.round(magnitude(family, rarity) * 100)}%`;
  if (family === "power") return `${pct} to this module's power`;
  if (family === "resonance") return `${pct} to this module's chord factor`;
  return `${pct} to the strength this module receives`;
}

function effectShort(family: Family, rarity: Rarity): string {
  return `${FAMILY_LABEL[family].slice(0, 3).toUpperCase()} +${Math.round(magnitude(family, rarity) * 100)}%`;
}

const FAMILY_GLYPH: Record<Family, string> = {
  power: '<path d="M-9 9 0-11 9 9"/><path d="M-4.5 9h9"/>',
  resonance: '<path d="M-11 0q5.5-10 11 0t11 0"/><circle r="1.7" cx="-11" cy="0"/><circle r="1.7" cx="11" cy="0"/>',
  charge: '<path d="M3.5-12-7.5 2.5H-1L-3.5 12 7.5-2.5H1Z"/>',
};

function mutGlyph(family: Family, scale = 1): string {
  return `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="scale(${scale})">${FAMILY_GLYPH[family]}</g>`;
}

function rarityTicks(rarity: Rarity): string {
  const n = { common: 1, uncommon: 2, rare: 3 }[rarity];
  return Array.from({ length: n }, (_, i) => `<circle r="1.6" cx="${((i - (n - 1) / 2) * 7).toFixed(1)}" cy="0"/>`).join("");
}

/* ── Prototype plumbing ── */

export function prototypeWanted(): boolean {
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(location.search).has("variant");
}

function deepLinkedLayer(): Layer {
  return new URLSearchParams(location.search).get("layer") === "mutators" ? "mutators" : "modules";
}

// The prototype's own lattice projection — mirrors render.ts's `point`
// (SPACING 65) without importing it.
const SPACING = 65;
function protoPoint({ q, r }: Hex): [number, number] {
  return [Math.sqrt(3) * SPACING * (q + r / 2), SPACING * 1.5 * r];
}

/* ── Seed ──
   The playtest board (38 cells, 21 modules) wearing the mutator layer:
   nine unlocked slots — two same-family same-rarity pairs to combine,
   one resonance parked on the spacer (inert), one vacant — and a tray
   with two items. Mock Arete covers a few unlock rungs. */

export function seedMutatorBoard(app: App): void {
  const result = deserialize(playtestSaveRaw);
  if (result.error || !result.state) {
    app.say(`Prototype board failed to load: ${result.error ?? "unknown"}`);
    return;
  }
  app.state = result.state;
  app.state.mode = "upgrade";
  app.state.session = null;
  app.ui.selected = null;
  app.save = () => {};
  const state = mut(app);
  state.layer = deepLinkedLayer();
  const item = (family: Family, rarity: Rarity): MutItem => ({ id: `m${state.nextId++}`, family, rarity });
  const slot = (q: number, r: number, i: MutItem | null): void => {
    state.slots.push({ pos: { q, r }, item: i });
  };
  slot(1, 0, item("power", "rare"));
  slot(3, 0, item("resonance", "uncommon"));
  slot(-1, 1, item("charge", "common"));
  slot(0, -1, item("resonance", "common"));
  slot(2, -1, item("resonance", "common"));
  slot(4, -1, item("power", "common"));
  slot(4, 0, item("power", "common"));
  slot(1, 1, item("resonance", "common")); // the spacer — inert
  // One vacant slot: the first empty owned cell beside the patch.
  const empty = ownedEmptyBesidePatch(app.state, state.slots);
  if (empty) slot(empty.q, empty.r, null);
  state.tray.push(item("power", "common"), item("charge", "uncommon"));
  app.state.arete = Math.max(app.state.arete, 20);
  app.render();
}

function ownedEmptyBesidePatch(state: GameState, slots: MutSlot[]): Hex | null {
  const taken = new Set(slots.map((s) => `${s.pos.q},${s.pos.r}`));
  for (const cell of state.cells) {
    if (taken.has(`${cell.q},${cell.r}`)) continue;
    if (deployedAt(state, cell)) continue;
    if (slots.some((s) => adjacent(s.pos, cell))) return cell;
  }
  return null;
}

/* ── Host facts ── */

function moduleAt(app: App, pos: Hex): ModuleInstance | null {
  return deployedAt(app.state, pos) ?? null;
}

function slotAt(app: App, pos: Hex): MutSlot | null {
  return mut(app).slots.find((s) => sameHex(s.pos, pos)) ?? null;
}

const TYPE_NAMES: Record<ModuleInstance["type"], string> = {
  additive: "Additive Synth",
  conditional: "Conditional Synth",
  spacer: "Spacer",
  focusKeyed: "Focus-Keyed Generator",
  infusor: "Infusor",
  forge: "Forge",
};

// Resonance is inert on a chordless host (ADR-0043): chordFactor null
// (never chords) or 1 (sings no chord).
function hostLine(app: App, slot: MutSlot): { host: string | null; inert: string | null } {
  const module = moduleAt(app, slot.pos);
  if (!module) return { host: null, inert: "vacant — inert until a host lands" };
  const name = `${TYPE_NAMES[module.type]} · ${cellNoteOf(slot.pos)}`;
  if (slot.item?.family === "resonance") {
    const factor = computeRates(app.state, true).contributions.get(module.id)?.chordFactor ?? null;
    if (factor === null || factor === 1) return { host: name, inert: "inert — its host sings no chord" };
  }
  return { host: name, inert: null };
}

/* ── Per-frame entry ── */

export function renderMutatorPrototype(app: App): void {
  if (!prototypeWanted()) return;
  ensureStyle();
  ensureBar(app);
  ensureGestureBindings(app);
  const state = mut(app);
  currentState = state;
  const upgrade = app.state.mode === "upgrade";
  const gridActive = upgrade && state.layer === "mutators";
  document.body.classList.toggle("proto-mut-live", gridActive);
  renderTabs(app, upgrade);
  renderGridLayer(app, gridActive);
  renderUnlockPill(app);
  renderTray(app, gridActive);
  renderPopover(app, gridActive);
  renderBloomLine(app);
  renderOverlays(app);
}

/* ── The layer tabs ──
   The tab-like switch between the board's two layers: Modules (the
   production board) and Mutators (the second grid). Upgrade-mode
   furniture at the board's top edge, beside the dock. */

function renderTabs(app: App, upgrade: boolean): void {
  const state = mut(app);
  let host = document.getElementById("proto-mut-tabs");
  if (!upgrade) {
    host?.remove();
    return;
  }
  if (!host) {
    host = document.createElement("div");
    host.id = "proto-mut-tabs";
    host.innerHTML = `<button class="proto-tab" data-layer="modules">Modules</button><button class="proto-tab" data-layer="mutators">Mutators</button>`;
    host.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
      button.addEventListener("click", () => {
        const m = mut(app);
        if (m.layer === button.getAttribute("data-layer")) return;
        m.layer = button.getAttribute("data-layer") as Layer;
        disarmAll(app);
        app.render();
      });
    });
    document.querySelector(".board-space")?.append(host);
  }
  host.classList.toggle("on-mutators", state.layer === "mutators");
  host.querySelectorAll<HTMLButtonElement>("[data-layer]").forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-layer") === state.layer);
  });
}

/* ── The grid layer ──
   Modules tab: presence outlines only — a thin arete outline inset on
   the face of every hosted mutator's module. Mutators tab: the second
   grid as the foreground — one slot face per cell, full words. */

// Full slot-face hex (the mutators layer): module-sized.
const SLOT_FACE_R = 56;
// The presence outline's inset — hugging the chassis edge, clear of the
// rarity rings (55/50/45).
const PRESENCE_R = 58;

function renderGridLayer(app: App, gridActive: boolean): void {
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg) return;
  svg.querySelector("#proto-mut-grid")?.remove();
  if (app.state.mode !== "upgrade") return;
  const state = mut(app);
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.id = "proto-mut-grid";
  const parts: string[] = [];

  const at = (pos: Hex): string => {
    const [x, y] = protoPoint(pos);
    return `transform="translate(${x.toFixed(2)},${y.toFixed(2)})"`;
  };

  if (!gridActive) {
    // The module layer's presence marks: the outline alone. Presence is
    // all it says — family, effect, and words live one tab away.
    for (const slot of state.slots) {
      if (!slot.item) continue;
      parts.push(`<g ${at(slot.pos)}><polygon class="proto-presence" points="${hexPoints(PRESENCE_R)}"/></g>`);
    }
    g.innerHTML = parts.join("");
    svg.append(g);
    return;
  }

  const slotFace = (slot: MutSlot): string => {
    const key = `data-mut-slot="${slot.pos.q},${slot.pos.r}"`;
    if (slot.item) {
      const item = slot.item;
      const { host, inert } = hostLine(app, slot);
      // The verdict rides the host line — compact here; the full words
      // live in the hover ask and the popover.
      const verdict = inert ? (inert.startsWith("vacant") ? "inert · no host" : "inert · no chord") : (host ?? "");
      return `<g ${key} ${at(slot.pos)} class="proto-slot-face${inert ? " proto-inert" : ""}">
        <polygon class="proto-slot-hex" points="${hexPoints(SLOT_FACE_R)}"/>
        <text class="proto-slot-family" y="-32" text-anchor="middle">${FAMILY_LABEL[item.family].toUpperCase()}</text>
        <g class="proto-slot-glyph">${mutGlyph(item.family, 1.15)}</g>
        <g class="proto-slot-ticks" transform="translate(0 10)">${rarityTicks(item.rarity)}</g>
        <text class="proto-slot-host" y="26" text-anchor="middle">${verdict}</text>
        <text class="proto-slot-effect mono" y="42" text-anchor="middle">${effectShort(item.family, item.rarity)}</text>
        <polygon class="proto-hit wide" data-mut-hit="${slot.pos.q},${slot.pos.r}" points="${hexPoints(SLOT_FACE_R)}"/>
      </g>`;
    }
    return `<g ${key} ${at(slot.pos)} class="proto-slot-open">
      <polygon class="proto-slot-hex dashed" points="${hexPoints(SLOT_FACE_R)}"/>
      <text class="proto-slot-open-label" y="6" text-anchor="middle">OPEN SLOT</text>
      <polygon class="proto-hit wide" data-mut-hit="${slot.pos.q},${slot.pos.r}" points="${hexPoints(SLOT_FACE_R)}"/>
    </g>`;
  };

  parts.push(...state.slots.map(slotFace));

  // The unlock advertisement: eligible cells while the gesture is armed.
  // One cost spot — the pill carries the price (#174's rule).
  if (state.armingUnlock) {
    for (const pos of unlockTargets(app)) {
      parts.push(
        `<g class="proto-unlock-target" data-mut-unlock="${pos.q},${pos.r}" ${at(pos)}>
          <polygon class="proto-slot-hex dashed proto-pulse" points="${hexPoints(SLOT_FACE_R)}"/>
        </g>`,
      );
    }
  }

  g.innerHTML = parts.join("");
  svg.append(g);
  refreshMutRegisters();
}

// The growth-constrained unlock surface (ADR-0043): the first slot may sit
// on any owned cell; every later unlock attaches adjacent to the patch.
function unlockTargets(app: App): Hex[] {
  const state = mut(app);
  const taken = new Set(state.slots.map((s) => `${s.pos.q},${s.pos.r}`));
  return app.state.cells.filter((cell) => {
    if (taken.has(`${cell.q},${cell.r}`)) return false;
    if (state.slots.length === 0) return true;
    return state.slots.some((s) => adjacent(s.pos, cell));
  });
}

function slotPrice(app: App): number {
  const n = mut(app).slots.length;
  return SLOT_PRICES[Math.min(n, SLOT_PRICES.length - 1)]!;
}

/* ── Drop registers (the land tints on slot faces) ── */

let mutHoverPos: Hex | null = null;

function refreshMutRegisters(): void {
  const layer = document.getElementById("proto-mut-grid");
  if (!layer) return;
  layer.querySelectorAll(".proto-land-open, .proto-land-combine, .proto-land-swap").forEach((n) =>
    n.classList.remove("proto-land-open", "proto-land-combine", "proto-land-swap"),
  );
  const carrying = currentState?.carrying;
  if (!mutHoverPos || !carrying) return;
  const node = layer.querySelector(`[data-mut-slot="${mutHoverPos.q},${mutHoverPos.r}"]`);
  if (!node) return;
  if (node.classList.contains("proto-slot-open")) {
    node.classList.add("proto-land-open");
    return;
  }
  // Occupied: combine or swap — decided by the carried item.
  const [q, r] = (node.getAttribute("data-mut-slot") ?? "").split(",").map(Number);
  const target = currentState?.slots.find((s) => s.pos.q === q && s.pos.r === r);
  if (target?.item && combines(target.item, carrying.item)) node.classList.add("proto-land-combine");
  else node.classList.add("proto-land-swap");
}

function combines(a: MutItem, b: MutItem): boolean {
  return a.family === b.family && a.rarity === b.rarity && a.rarity !== "rare";
}

/* ── The unlock pill ── */

function renderUnlockPill(app: App): void {
  const state = mut(app);
  let pill = document.getElementById("proto-mut-pill");
  if (!state.armingUnlock || state.layer !== "mutators" || app.state.mode !== "upgrade") {
    pill?.remove();
    return;
  }
  if (!pill) {
    pill = document.createElement("button");
    pill.id = "proto-mut-pill";
    pill.addEventListener("click", () => {
      disarmAll(app);
      app.render();
    });
    document.querySelector(".board-space")?.append(pill);
  }
  pill.innerHTML = `Unlock Mutator slot · <span class="mono">${slotPrice(app)} Arete</span><span class="proto-esc">Cancel · Esc</span>`;
}

function disarmAll(app: App): void {
  const state = mut(app);
  state.armingUnlock = false;
  state.armedTray = null;
  state.movingFrom = null;
  state.carrying = null;
  mutHoverPos = null;
}

/* ── The Mutator tray ──
   The second layer's inventory: a strip pinned at the board's lower edge
   while the Mutators tab stands (every width — phone included). */

function trayTileSvg(item: MutItem): string {
  return `<svg viewBox="-70 -70 140 140" aria-hidden="true" style="color: var(--arete)">
    <polygon class="proto-tile-hex" points="${hexPoints(HEX_RADIUS)}"/>
    <g class="proto-tile-glyph">${mutGlyph(item.family, 1.6)}</g>
    <g class="proto-tile-ticks" transform="translate(0 34)">${rarityTicks(item.rarity)}</g>
    <text class="proto-tile-effect mono" y="52" text-anchor="middle">${effectShort(item.family, item.rarity)}</text>
  </svg>`;
}

function renderTray(app: App, gridActive: boolean): void {
  const state = mut(app);
  let host = document.getElementById("proto-mut-tray");
  if (!gridActive || app.state.mode !== "upgrade") {
    host?.remove();
    return;
  }
  if (!host) {
    host = document.createElement("div");
    host.id = "proto-mut-tray";
    host.classList.add("proto-mut-strip");
    document.querySelector(".board-space")?.append(host);
  }
  const key = JSON.stringify([state.tray.map((i) => `${i.id}:${i.rarity}`), state.armedTray]);
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  host.innerHTML = `<span class="tray-label">MUTATORS</span>
    <div class="tray-items proto-strip-items">${
      state.tray
        .map(
          (item) =>
            `<button class="inventory-tile proto-mut-tile${state.armedTray === item.id ? " armed" : ""}" data-mut-tray="${item.id}" data-rarity="${item.rarity}" title="${FAMILY_LABEL[item.family]} · ${effectText(item.family, item.rarity)} — click, then an open slot">${trayTileSvg(item)}</button>`,
        )
        .join("") || `<span class="tray-empty">minted mutators wait here</span>`
    }</div>
    <button class="proto-mut-unlock" id="proto-mut-unlock">Unlock slot · <span class="mono">${slotPrice(app)} Arete</span></button>`;
  host.querySelectorAll<HTMLButtonElement>("[data-mut-tray]").forEach((button) => {
    const id = button.getAttribute("data-mut-tray")!;
    button.addEventListener("click", () => {
      const m = mut(app);
      m.armedTray = m.armedTray === id ? null : id;
      m.popoverPos = null;
      if (m.armedTray) app.say("Choose an open Mutator slot.");
      app.render();
    });
    bindMutDrag(app, button, id);
  });
  byId("proto-mut-unlock")?.addEventListener("click", () => {
    mut(app).armingUnlock = true;
    app.render();
  });
}

/* ── The declaration popover ── */

function renderPopover(app: App, gridActive: boolean): void {
  const state = mut(app);
  let host = document.getElementById("proto-mut-pop");
  const slot = state.popoverPos ? slotAt(app, state.popoverPos) : null;
  if (!gridActive || !slot || !slot.item || app.state.mode !== "upgrade") {
    host?.remove();
    return;
  }
  if (!host) {
    host = document.createElement("div");
    host.id = "proto-mut-pop";
    document.querySelector(".board-space")?.append(host);
  }
  const item = slot.item;
  const { host: hostName, inert } = hostLine(app, slot);
  host.innerHTML = `
    <div class="proto-pop-head"><span class="proto-pop-family">${FAMILY_LABEL[item.family]}</span><span class="proto-pop-rarity">${item.rarity}</span></div>
    <p class="proto-pop-effect mono">${effectText(item.family, item.rarity)}</p>
    <p class="proto-pop-host">${hostName ? `Hosts <b>${hostName}</b>` : "No host"}</p>
    ${inert ? `<p class="proto-pop-inert">${inert}</p>` : ""}
    <div class="proto-pop-actions">
      <button id="proto-pop-retrieve">Retrieve</button>
      <button id="proto-pop-move">Move</button>
      <button id="proto-pop-close" aria-label="Close">✕</button>
    </div>`;
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (svg) {
    const viewBox = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    const frame: ViewFrame = {
      view: { x: viewBox[0] ?? 0, y: viewBox[1] ?? 0, width: viewBox[2] ?? 0, height: viewBox[3] ?? 0 },
      box: { width: svg.clientWidth, height: svg.clientHeight },
    };
    const [cx, cy] = viewPoint(protoPoint(slot.pos), frame);
    host.style.left = `${Math.round(cx)}px`;
    host.style.top = `${Math.round(cy)}px`;
  }
  byId("proto-pop-retrieve")?.addEventListener("click", () => {
    retrieveFromSlot(app, slot.pos);
  });
  byId("proto-pop-move")?.addEventListener("click", () => {
    mut(app).movingFrom = slot.pos;
    mut(app).popoverPos = null;
    app.say("Choose an open Mutator slot.");
    app.render();
  });
  byId("proto-pop-close")?.addEventListener("click", () => {
    mut(app).popoverPos = null;
    app.render();
  });
}

/* ── The expanded face's mutator line ── */

function renderBloomLine(app: App): void {
  document.querySelectorAll(".proto-mut-bloom-line").forEach((n) => n.remove());
  const module = app.state.modules.find((m) => m.id === app.ui.selected && m.pos !== null);
  if (!module || !module.pos) return;
  const slot = slotAt(app, module.pos);
  if (!slot?.item) return;
  const item = slot.item;
  const { inert } = hostLine(app, slot);
  const line = document.createElement("div");
  line.className = "proto-mut-bloom-line";
  line.innerHTML = `<span class="proto-bloom-glyph">${mutGlyph(item.family, 0.8)}</span>
    <b>Mutator · ${FAMILY_LABEL[item.family]}</b>
    <span class="mono">${effectText(item.family, item.rarity)}</span>
    ${inert ? `<i>${inert}</i>` : ""}`;
  const readouts = document.querySelector("#module-bloom .bloom-readouts");
  const sheet = document.querySelector("#module-bloom .bloom-sheet-col");
  (readouts ?? sheet)?.prepend(line);
}

/* ── Overlays: combine review + mutator roll ── */

interface CombineOffer {
  drag: MutItem;
  dragOrigin: Hex | "tray";
  target: MutItem;
  targetSlot: Hex;
}

let combineOffer: CombineOffer | null = null;
let rollOffer: { candidates: MutItem[] } | null = null;

function ensureOverlayHost(): HTMLElement {
  let host = document.getElementById("proto-mut-overlay");
  if (!host) {
    host = document.createElement("div");
    host.id = "proto-mut-overlay";
    host.className = "proto-mut-overlay";
    host.addEventListener("click", (event) => {
      if (event.target === host) closeOverlays();
    });
    document.body.append(host);
  }
  return host;
}

function closeOverlays(): void {
  combineOffer = null;
  rollOffer = null;
  document.getElementById("proto-mut-overlay")?.remove();
}

function renderOverlays(app: App): void {
  if (combineOffer) renderCombineOverlay(app);
  else if (rollOffer) renderRollOverlay(app);
  else document.getElementById("proto-mut-overlay")?.remove();
}

function renderCombineOverlay(app: App): void {
  const offer = combineOffer!;
  const host = ensureOverlayHost();
  const destination = `The combined mutator holds the ${cellNoteOf(offer.targetSlot)} slot.`;
  const nextRarity: Rarity = offer.drag.rarity === "common" ? "uncommon" : "rare";
  const tile = (item: MutItem): string =>
    `<span class="proto-combine-tile">${trayTileSvg(item)}<small>${FAMILY_LABEL[item.family]} · ${item.rarity}</small></span>`;
  host.innerHTML = `
    <div class="modal proto-combine-modal" role="dialog" aria-modal="true">
      <div class="modal-top"><span class="eyebrow">COMBINE MUTATORS</span><button id="proto-combine-x" aria-label="Close">✕</button></div>
      <h2 id="modal-title">Combine these two?</h2>
      <p class="lead proto-combine-pair">${tile(offer.drag)} <b>+</b> ${tile(offer.target)}</p>
      <div class="combine-terms">
        <div class="stat-row"><span>Resulting rarity</span><span class="mono">${nextRarity}</span></div>
        <div class="stat-row"><span>Family</span><span class="mono">${FAMILY_LABEL[offer.drag.family]}</span></div>
      </div>
      <p class="lead muted">Mutators carry no levels — nothing is retained or refunded.</p>
      <p class="lead muted">${destination}</p>
      <div class="modal-actions">
        <button id="proto-combine-cancel">Keep both</button>
        <button id="proto-combine-confirm" class="primary">Combine</button>
      </div>
    </div>`;
  const cancel = (): void => {
    closeOverlays();
    app.render();
  };
  byId("proto-combine-cancel")?.addEventListener("click", cancel);
  byId("proto-combine-x")?.addEventListener("click", cancel);
  byId("proto-combine-confirm")?.addEventListener("click", () => {
    performCombine(app, offer);
    closeOverlays();
    app.render();
  });
}

function performCombine(app: App, offer: CombineOffer): void {
  const state = mut(app);
  const combined: MutItem = {
    id: `m${state.nextId++}`,
    family: offer.drag.family,
    rarity: offer.drag.rarity === "common" ? "uncommon" : "rare",
  };
  removeItem(app, offer.drag.id, offer.dragOrigin);
  removeItem(app, offer.target.id, offer.targetSlot);
  const slot = slotAt(app, offer.targetSlot);
  if (slot) slot.item = combined;
  app.say(`${FAMILY_LABEL[combined.family]} mutator raised to ${combined.rarity}.`);
}

function removeItem(app: App, id: string, origin: Hex | "tray"): void {
  const state = mut(app);
  if (origin === "tray") {
    const i = state.tray.findIndex((t) => t.id === id);
    if (i >= 0) state.tray.splice(i, 1);
    return;
  }
  const slot = slotAt(app, origin);
  if (slot?.item?.id === id) slot.item = null;
}

function renderRollOverlay(app: App): void {
  const offer = rollOffer!;
  const host = ensureOverlayHost();
  host.innerHTML = `
    <div class="modal proto-roll-modal" role="dialog" aria-modal="true">
      <div class="modal-top"><span class="eyebrow">MUTATOR FORGE</span><button id="proto-roll-x" aria-label="Close">✕</button></div>
      <h2 id="modal-title">Take one mutator — the other vanishes.</h2>
      <div class="candidates proto-mut-candidates">
        ${offer.candidates
          .map(
            (candidate, i) => `
          <button class="candidate-tile proto-mut-candidate" data-i="${i}" data-rarity="${candidate.rarity}" title="Take the ${candidate.rarity} ${FAMILY_LABEL[candidate.family]} mutator">
            ${trayTileSvg(candidate)}
            <span class="rarity">${candidate.rarity}</span>
            <span class="candidate-effect">${effectText(candidate.family, candidate.rarity)}</span>
          </button>`,
          )
          .join("")}
      </div>
      <p class="lead muted">Two candidates — three families cannot fill three meaningful slots.</p>
    </div>`;
  host.querySelectorAll<HTMLButtonElement>("[data-i]").forEach((button) => {
    button.addEventListener("click", () => {
      const candidate = offer.candidates[Number(button.getAttribute("data-i"))];
      if (candidate) {
        mut(app).tray.push(candidate);
        app.say(`${FAMILY_LABEL[candidate.family]} mutator minted to the tray.`);
      }
      closeOverlays();
      app.render();
    });
  });
  byId("proto-roll-x")?.addEventListener("click", () => {
    closeOverlays();
    app.render();
  });
}

/* ── Gestures ──
   The layer's own capture-phase handlers on the grid svg: a mutator
   gesture (armed placement, armed move, armed unlock, or a live carry)
   resolves on the slot faces and never reaches the app's cell handlers.
   All of them live on the Mutators tab; the Modules tab's outline is
   pure read. */

const boundGrids = new WeakSet<SVGSVGElement>();
const DRAG_THRESHOLD = 8;
let currentState: MutState | null = null;

function busy(app: App): boolean {
  const state = mut(app);
  return state.armingUnlock || state.armedTray !== null || state.movingFrom !== null || state.carrying !== null;
}

function ensureGestureBindings(app: App): void {
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg || boundGrids.has(svg)) return;
  boundGrids.add(svg);

  const hexOf = (raw: string | null): Hex | null => {
    const [q, r] = (raw ?? "").split(",").map(Number);
    return Number.isFinite(q) && Number.isFinite(r) ? { q: q!, r: r! } : null;
  };
  const slotAtEvent = (event: { clientX: number; clientY: number }): Hex | null => {
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-mut-slot]");
    return hit ? hexOf(hit.getAttribute("data-mut-slot")) : null;
  };

  // Resolve a click while a mutator gesture is live. Capture phase runs
  // before the app's own cell listeners.
  svg.addEventListener(
    "click",
    (event) => {
      if (mut(app).layer !== "mutators" || !currentState) {
        // The Modules tab: no mutator gestures. (Presence marks don't
        // even take hits.)
        return;
      }
      // An idle click on a placed mutator opens its declaration popover.
      const hitTarget = (event.target as Element).closest("[data-mut-hit]");
      if (!busy(app) && hitTarget) {
        event.stopPropagation();
        const pos = hexOf(hitTarget.getAttribute("data-mut-hit"));
        if (!pos) return;
        currentState.popoverPos = currentState.popoverPos && sameHex(currentState.popoverPos, pos) ? null : pos;
        app.render();
        return;
      }
      if (!busy(app)) return;
      const state = currentState;
      const pos = slotAtEvent(event);
      if (state.armingUnlock) {
        event.stopPropagation();
        event.preventDefault();
        if (!pos) return;
        if (!unlockTargets(app).some((t) => sameHex(t, pos))) {
          app.say(state.slots.length === 0 ? "Any owned cell can take the first slot." : "Slots expand from the unlocked patch.");
          return;
        }
        const price = slotPrice(app);
        if (app.state.arete < price) {
          app.say("Not enough Arete for the next slot.");
          return;
        }
        app.state.arete -= price;
        state.slots.push({ pos, item: null });
        state.armingUnlock = false;
        app.say(`Mutator slot unlocked at ${cellNoteOf(pos)} — ${app.state.arete} Arete left.`);
        app.render();
        return;
      }
      if (state.armedTray !== null || state.movingFrom !== null) {
        event.stopPropagation();
        event.preventDefault();
        if (!pos) {
          disarmAll(app);
          app.say("Move cancelled.");
          app.render();
          return;
        }
        const target = slotAt(app, pos);
        const moving = state.movingFrom;
        if (target && !target.item) {
          if (moving && sameHex(moving, pos)) return;
          if (moving) moveToSlot(app, moving, pos);
          else placeFromTray(app, state.armedTray!, pos);
        } else {
          app.say(target ? "That slot is held — drag the carried mutator onto it to swap or combine." : "No Mutator slot there.");
        }
      }
    },
    true,
  );

  // The layer's own hover question: ask the reserved readout.
  svg.addEventListener("pointerover", (event) => {
    if (mut(app).layer !== "mutators" || busy(app)) return;
    const hit = (event.target as Element).closest("[data-mut-slot]");
    const host = document.getElementById("chord-readout");
    if (!hit || !host) return;
    const pos = hexOf(hit.getAttribute("data-mut-slot"));
    if (!pos) return;
    const slot = slotAt(app, pos);
    if (!slot) return;
    if (!slot.item) {
      host.hidden = false;
      host.innerHTML = `<span class="chord-readout-chip mono" style="--cc:var(--arete)">Open Mutator slot · ${cellNoteOf(slot.pos)} — inert until a host lands</span>`;
      return;
    }
    const item = slot.item;
    const { host: hostName, inert } = hostLine(app, slot);
    host.hidden = false;
    host.innerHTML = `<span class="chord-readout-chip mono" style="--cc:var(--arete)">${FAMILY_LABEL[item.family]} · ${effectText(item.family, item.rarity)}${hostName ? ` — hosts ${hostName}` : ""}${inert ? ` · ${inert}` : ""}</span>`;
  });

  // Retrieve by right-click on a placed mutator.
  svg.addEventListener(
    "contextmenu",
    (event) => {
      if (mut(app).layer !== "mutators") return;
      const hit = (event.target as Element).closest("[data-mut-hit]");
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      const pos = hexOf(hit.getAttribute("data-mut-hit"));
      if (pos) retrieveFromSlot(app, pos);
    },
    true,
  );

  // Carry: press a placed mutator's face and drag.
  svg.addEventListener(
    "pointerdown",
    (baseEvent: Event) => {
      const event = baseEvent as PointerEvent;
      if (event.button !== 0 || app.state.mode !== "upgrade" || busy(app) || !currentState) return;
      if (currentState.layer !== "mutators") return;
      const hit = (event.target as Element).closest("[data-mut-hit]");
      if (!hit) return;
      const origin = hexOf(hit.getAttribute("data-mut-hit"));
      const slot = origin ? slotAt(app, origin) : null;
      if (!origin || !slot?.item) return;
      const item = slot.item;
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;
      let ghost: HTMLDivElement | null = null;
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD) {
          moved = true;
          if (currentState) {
            currentState.carrying = { item, origin };
            currentState.popoverPos = null;
          }
          ghost = document.createElement("div");
          ghost.className = "drag-ghost proto-mut-ghost";
          ghost.innerHTML = trayTileSvg(item);
          document.body.append(ghost);
        }
        if (ghost) {
          ghost.style.left = `${ev.clientX}px`;
          ghost.style.top = `${ev.clientY}px`;
          mutHoverPos = slotAtEvent(ev);
          if (overTray(ev)) mutHoverPos = null;
          refreshMutRegisters();
          document.getElementById("proto-mut-tray")?.classList.toggle("drag-over", overTray(ev));
        }
      };
      const finish = (ev: PointerEvent, apply: boolean) => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", cancel);
        ghost?.remove();
        document.getElementById("proto-mut-tray")?.classList.remove("drag-over");
        if (apply && moved && currentState?.carrying) {
          const target = overTray(ev) ? "tray" : slotAtEvent(ev);
          finishCarry(app, target);
        } else if (currentState) currentState.carrying = null;
        mutHoverPos = null;
        refreshMutRegisters();
        app.render();
      };
      const up = (ev: PointerEvent) => finish(ev, true);
      const cancel = () => finish(new PointerEvent("pointerup"), false);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", cancel);
    },
    true,
  );

  // Esc cancels whatever mutator gesture stands, then the layer itself.
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    if (event.key !== "Escape") return;
    const state = mut(app);
    if (combineOffer || rollOffer) {
      closeOverlays();
      app.render();
      return;
    }
    if (state.layer === "mutators") {
      if (busy(app)) {
        disarmAll(app);
        app.say("Mutator gesture cancelled.");
        app.render();
        return;
      }
      if (state.popoverPos) {
        state.popoverPos = null;
        app.render();
        return;
      }
      state.layer = "modules";
      app.render();
    }
  });
}

function overTray(event: { clientX: number; clientY: number }): boolean {
  return !!document.elementFromPoint(event.clientX, event.clientY)?.closest("#proto-mut-tray");
}

// Tray-tile drag binding (mirrors the app's): press a tile, drag to a slot.
function bindMutDrag(app: App, element: Element, id: string): void {
  element.addEventListener("pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || app.state.mode !== "upgrade" || currentState?.carrying) return;
    const item = currentState?.tray.find((t) => t.id === id);
    if (!item) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let ghost: HTMLDivElement | null = null;
    const slotAtEvent = (ev: PointerEvent): Hex | null => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-mut-slot]");
      const [q, r] = (hit?.getAttribute("data-mut-slot") ?? "").split(",").map(Number);
      return Number.isFinite(q) && Number.isFinite(r) ? { q: q!, r: r! } : null;
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD) {
        moved = true;
        if (currentState) {
          currentState.carrying = { item, origin: "tray" };
          currentState.armedTray = null;
        }
        ghost = document.createElement("div");
        ghost.className = "drag-ghost proto-mut-ghost";
        ghost.innerHTML = trayTileSvg(item);
        document.body.append(ghost);
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        mutHoverPos = slotAtEvent(ev);
        refreshMutRegisters();
        document.getElementById("proto-mut-tray")?.classList.toggle("drag-over", overTray(ev));
      }
    };
    const finish = (ev: PointerEvent, apply: boolean) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      ghost?.remove();
      document.getElementById("proto-mut-tray")?.classList.remove("drag-over");
      if (apply && moved && currentState?.carrying) {
        const target = overTray(ev) ? "tray" : slotAtEvent(ev);
        finishCarry(app, target);
      } else if (currentState) currentState.carrying = null;
      mutHoverPos = null;
      refreshMutRegisters();
      app.render();
    };
    const up = (ev: PointerEvent) => finish(ev, true);
    const cancel = () => finish(new PointerEvent("pointerup"), false);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
  });
}

function finishCarry(app: App, target: Hex | "tray" | null): void {
  const state = currentState;
  const carrying = state?.carrying;
  if (state) state.carrying = null;
  if (!state || !carrying) return;
  if (target === "tray" || target === null) {
    if (target === "tray" && carrying.origin !== "tray") {
      state.tray.push(carrying.item);
      const slot = slotAt(app, carrying.origin);
      if (slot && sameHex(slot.pos, carrying.origin)) slot.item = null;
      app.say(`${FAMILY_LABEL[carrying.item.family]} mutator retrieved to the tray.`);
    }
    return;
  }
  const targetSlot = slotAt(app, target);
  if (!targetSlot) return;
  if (!targetSlot.item) {
    if (carrying.origin !== "tray" && sameHex(carrying.origin, target)) return;
    if (carrying.origin === "tray") removeFromTray(app, carrying.item.id);
    else {
      const from = slotAt(app, carrying.origin);
      if (from) from.item = null;
    }
    targetSlot.item = carrying.item;
    app.say(`${FAMILY_LABEL[carrying.item.family]} mutator placed at ${cellNoteOf(target)}.`);
    return;
  }
  if (combines(targetSlot.item, carrying.item)) {
    combineOffer = {
      drag: carrying.item,
      dragOrigin: carrying.origin,
      target: targetSlot.item,
      targetSlot: target,
    };
    return;
  }
  // Swap: the carried mutator takes the slot; the occupant waits in the tray.
  const occupant = targetSlot.item;
  if (carrying.origin === "tray") removeFromTray(app, carrying.item.id);
  else {
    const from = slotAt(app, carrying.origin);
    if (from) from.item = null;
  }
  targetSlot.item = carrying.item;
  state.tray.push(occupant);
  app.say("Slots swapped — the previous mutator waits in the tray.");
}

function placeFromTray(app: App, id: string, pos: Hex): void {
  const state = mut(app);
  const item = state.tray.find((t) => t.id === id);
  const slot = slotAt(app, pos);
  if (!item || !slot || slot.item) return;
  removeFromTray(app, id);
  slot.item = item;
  state.armedTray = null;
  app.say(`${FAMILY_LABEL[item.family]} mutator placed at ${cellNoteOf(pos)}.`);
  app.render();
}

function moveToSlot(app: App, from: Hex, to: Hex): void {
  const state = mut(app);
  const origin = slotAt(app, from);
  const target = slotAt(app, to);
  state.movingFrom = null;
  if (!origin?.item || !target || target.item) return;
  target.item = origin.item;
  origin.item = null;
  app.say(`${FAMILY_LABEL[target.item.family]} mutator moved to ${cellNoteOf(to)}.`);
  app.render();
}

function retrieveFromSlot(app: App, pos: Hex): void {
  const slot = slotAt(app, pos);
  if (!slot?.item) return;
  mut(app).tray.push(slot.item);
  mut(app).popoverPos = null;
  const family = slot.item.family;
  slot.item = null;
  app.say(`${FAMILY_LABEL[family]} mutator retrieved to the tray.`);
  app.render();
}

function removeFromTray(app: App, id: string): void {
  const tray = mut(app).tray;
  const i = tray.findIndex((t) => t.id === id);
  if (i >= 0) tray.splice(i, 1);
}

/* ── The judging bar (shortcuts; the tabs are the real affordance) ── */

function ensureBar(app: App): void {
  if (document.getElementById("proto-mut-bar")) return;
  const bar = document.createElement("div");
  bar.id = "proto-mut-bar";
  bar.innerHTML = `<button class="proto-action" data-act="unlock">Unlock slot</button><button class="proto-action" data-act="roll">Mutator roll</button>`;
  document.body.append(bar);
  bar.querySelector<HTMLButtonElement>('[data-act="unlock"]')?.addEventListener("click", () => {
    const state = mut(app);
    state.layer = "mutators";
    state.armingUnlock = !state.armingUnlock;
    app.render();
  });
  bar.querySelector<HTMLButtonElement>('[data-act="roll"]')?.addEventListener("click", () => {
    mintRoll(app);
  });
}

function mintRoll(app: App): void {
  const state = mut(app);
  const families: Family[] = ["power", "resonance", "charge"];
  const rollRarity = (): Rarity => {
    const roll = Math.random();
    return roll < 0.6 ? "common" : roll < 0.9 ? "uncommon" : "rare";
  };
  rollOffer = {
    candidates: [
      { id: `m${state.nextId++}`, family: families[Math.floor(Math.random() * 3)]!, rarity: rollRarity() },
      { id: `m${state.nextId++}`, family: families[Math.floor(Math.random() * 3)]!, rarity: rollRarity() },
    ],
  };
  renderOverlays(app);
}

/* ── Styles ── */

function ensureStyle(): void {
  if (document.getElementById("proto-mut-style")) return;
  const style = document.createElement("style");
  style.id = "proto-mut-style";
  style.textContent = `
/* Arete's own register (provisional violet — continuity with #174's
   approved Arete banner; one token swap if the hue moves. Distinct from
   nous's pale indigo). */
:root { --arete: #b994f5; }

#proto-mut-bar {
  position: fixed; left: 50%; bottom: 10px; transform: translateX(-50%);
  z-index: 90; display: flex; align-items: center; gap: 8px;
  background: #101018; color: #e8e8f0; border: 1px solid #3a3a55; border-radius: 999px;
  padding: 6px 10px; font: 12px/1.2 system-ui, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.5);
}
#proto-mut-bar button { all: unset; cursor: pointer; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
#proto-mut-bar button:hover { background: #26263a; }

/* ── The layer tabs ── */
#proto-mut-tabs {
  position: absolute; top: 10px; left: 66px; z-index: 22;
  display: inline-flex; padding: 3px; gap: 2px;
  background: var(--panel-veil); border: 1px solid var(--line-strong);
  border-radius: 9px; backdrop-filter: blur(3px);
}
.proto-tab {
  all: unset; cursor: pointer; padding: 5px 14px; border-radius: 6px;
  font: 600 10.5px var(--mono, monospace); letter-spacing: .12em;
  text-transform: uppercase; color: var(--muted);
}
.proto-tab:hover { color: var(--ink); background: var(--hover-bg); }
.proto-tab.active { color: var(--ink); background: var(--hover-bg); }
#proto-mut-tabs.on-mutators .proto-tab[data-layer="mutators"].active {
  color: var(--arete); background: color-mix(in srgb, var(--arete) 13%, transparent);
}

/* ── The module layer: the presence outline ── */
.proto-presence {
  fill: none; stroke: var(--arete); stroke-width: 2; opacity: .9;
  pointer-events: none;
}

/* ── The mutators layer: the second grid ── */
body.proto-mut-live #grid .module-node,
body.proto-mut-live #grid .cell-node { filter: grayscale(.85); opacity: .32; pointer-events: none; }
body.proto-mut-live #grid .chord-mark:not(.ghost-mark) { opacity: .5; }
.proto-slot-hex {
  fill: color-mix(in srgb, var(--arete) 9%, transparent);
  stroke: var(--arete); stroke-width: 2;
}
.proto-slot-hex.dashed { fill: color-mix(in srgb, var(--arete) 3%, transparent); stroke-dasharray: 7 6; stroke-width: 1.8; }
.proto-slot-face .proto-slot-glyph { transform: translate(0 -10px); color: var(--arete); pointer-events: none; }
.proto-slot-family { font: 600 11px var(--mono, monospace); fill: var(--arete); letter-spacing: .12em; pointer-events: none; }
.proto-slot-effect { font-size: 12.5px; fill: var(--ink); pointer-events: none; }
.proto-slot-host { font-size: 10px; fill: var(--muted); pointer-events: none; }
.proto-slot-ticks { fill: var(--arete); pointer-events: none; }
.proto-slot-face.proto-inert .proto-slot-effect { fill: var(--muted); }
.proto-slot-open-label { font: 600 11px var(--mono, monospace); fill: var(--arete); opacity: .8; letter-spacing: .14em; pointer-events: none; }
.proto-pulse { animation: proto-mut-pulse 1.4s ease-in-out infinite; }
@keyframes proto-mut-pulse { 50% { stroke-width: 3.6; } }

/* The invisible grab surfaces over the slot faces. */
.proto-hit { fill: none; stroke: transparent; pointer-events: all; cursor: grab; }

/* The land registers on slot faces. */
.proto-land-open .proto-slot-hex { stroke: var(--charge); fill: color-mix(in srgb, var(--charge) 14%, transparent); }
.proto-land-combine .proto-slot-hex { stroke: var(--switch); stroke-width: 3.4; fill: color-mix(in srgb, var(--switch) 18%, transparent); }
.proto-land-swap .proto-slot-hex { stroke: var(--switch); fill: color-mix(in srgb, var(--switch) 9%, transparent); }

/* ── The Mutator tray strip (Mutators tab, every width) ── */
#proto-mut-tray {
  position: absolute; left: 50%; transform: translateX(-50%);
  bottom: 64px; z-index: 22;
  display: flex; align-items: center; gap: 8px;
  width: max-content; max-width: calc(100% - 16px); padding: 8px 12px;
  background: var(--panel-veil); border: 1px dashed var(--arete);
  border-radius: 12px; backdrop-filter: blur(3px);
}
#proto-mut-tray .tray-label { color: var(--arete); }
#proto-mut-tray .tray-items { flex-direction: row !important; min-width: 60px; }
#proto-mut-tray.drag-over { border-color: var(--charge); background: var(--charge-tint); }
.proto-mut-tile { all: unset; cursor: pointer; border-radius: 10px; width: 54px; }
.proto-mut-tile:hover { background: var(--hover-bg); transform: translateY(-2px); }
.proto-mut-tile.armed { outline: 2px solid var(--arete); }
.proto-mut-tile .proto-tile-hex { fill: none; stroke: var(--arete); stroke-width: 4.5; }
.proto-mut-tile .proto-tile-glyph { transform: translate(0 -6px); }
.proto-mut-tile .proto-tile-ticks { fill: var(--arete); }
.proto-mut-tile .proto-tile-effect { font-size: 11.5px; fill: var(--muted); }
.proto-mut-unlock {
  all: unset; cursor: pointer; padding: 6px 10px; border-radius: 8px;
  border: 1px solid var(--arete); color: var(--arete);
  font: 600 10.5px var(--mono, monospace); white-space: nowrap;
}
.proto-mut-unlock:hover { background: color-mix(in srgb, var(--arete) 14%, transparent); }

/* The unlock pill (mirrors the add-cell pill). */
#proto-mut-pill {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  z-index: 22; display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 999px; cursor: pointer;
  background: rgba(20, 20, 31, 0.94); border: 1px solid var(--arete);
  color: #f0f0f6; font: 600 11px/1 system-ui, sans-serif; letter-spacing: .04em;
}
#proto-mut-pill:hover { background: color-mix(in srgb, var(--arete) 18%, rgba(20,20,31,.94)); }
#proto-mut-pill .proto-esc {
  padding: 2px 6px; border: 1px solid #55556a; border-radius: 4px;
  font: 600 9px/1 system-ui, sans-serif; color: #a0a0b8;
}

/* The declaration popover. */
#proto-mut-pop {
  position: absolute; transform: translate(-50%, calc(-100% - 70px));
  z-index: 24; width: 232px; padding: 12px 14px;
  background: var(--panel); border: 1px solid var(--arete); border-radius: 10px;
  box-shadow: 0 10px 30px var(--shadow); font: 12px/1.45 system-ui, sans-serif; color: var(--ink);
}
.proto-pop-head { display: flex; justify-content: space-between; align-items: baseline; }
.proto-pop-family { font: 700 12px var(--mono, monospace); letter-spacing: .1em; color: var(--arete); text-transform: uppercase; }
.proto-pop-rarity { font-size: 10.5px; color: var(--muted); text-transform: capitalize; }
.proto-pop-effect { margin: 6px 0 2px; color: var(--ink); }
.proto-pop-host { margin: 2px 0; color: var(--muted); font-size: 11.5px; }
.proto-pop-host b { color: var(--ink); font-weight: 600; }
.proto-pop-inert { margin: 4px 0 0; color: var(--muted); font-style: italic; font-size: 11.5px; }
.proto-pop-actions { display: flex; gap: 6px; margin-top: 9px; }
.proto-pop-actions button {
  all: unset; cursor: pointer; padding: 4px 10px; border-radius: 7px;
  border: 1px solid var(--line-strong); font: 600 11px system-ui, sans-serif;
}
.proto-pop-actions button:hover { background: var(--hover-bg); border-color: var(--arete); }
.proto-pop-actions #proto-pop-close { margin-left: auto; padding: 4px 8px; }

/* The expanded face's mutator line. */
.proto-mut-bloom-line {
  display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
  margin: 0 0 8px; padding: 7px 10px; border-radius: 9px;
  border: 1px dashed var(--arete);
  color: var(--arete); font-size: 12px;
}
.proto-mut-bloom-line b { font-weight: 650; }
.proto-mut-bloom-line .mono { color: var(--ink); font-size: 11.5px; }
.proto-mut-bloom-line i { color: var(--muted); font-size: 11px; }
.proto-bloom-glyph { display: inline-flex; }

/* The overlays (combine review, mutator roll) — prototype-local scrims. */
.proto-mut-overlay {
  position: fixed; inset: 0; z-index: 60; background: var(--scrim);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.proto-combine-pair { display: flex; align-items: center; gap: 12px; }
.proto-combine-tile { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
.proto-combine-tile svg { width: 76px; }
.proto-combine-tile small { font-size: 10.5px; color: var(--muted); }
.proto-mut-candidates { display: flex; gap: 14px; justify-content: center; }
.proto-mut-candidate svg { color: var(--arete); }
.proto-mut-ghost { color: var(--arete); }

@media (max-width: 600px) {
  #proto-mut-tabs { left: 8px; }
  #proto-mut-pop { width: 200px; }
}`;
  document.head.append(style);
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}
