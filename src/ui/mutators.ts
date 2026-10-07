// The Mutator Grid's UI (issue #199): the tabbed second layer over the
// board, built to the maintainer-approved prototype design
// (`prototype/mutator-grid-184`, iteration two at 57fb840). The Modules /
// Mutators tab pair stands at the board's top edge in upgrade mode; the
// Mutators tab renders one slot face per unlocked cell in words — family,
// glyph, rarity ticks, host, effect — while the module board rests greyed
// beneath, and the Modules tab marks a hosted mutator with a thin arete
// presence outline alone. Gestures mirror the board's: click-then-slot
// places (occupied slots swap), drag or right-click retrieves, and matching
// twins combine through the drop-and-confirm review. Every surface wears
// the --arete register, and every landing routes through the engine
// actions from #198, so the UI can never drift from the contracts those
// tests pin.
import { combineMutatorsPreview } from "../engine/actions";
import { deployedAt, mutatorAt, mutatorMagnitude, mutatorSlotCost } from "../engine/economy";
import { adjacent, sameHex } from "../engine/hex";
import { cellNoteOf } from "../engine/lattice";
import type { GameState, Hex, MutatorFamily, MutatorInstance, Rarity, RateSnapshot } from "../engine/types";
import type { App } from "./app";
import { startPointerDrag } from "./pointer-drag";
import { boardPoint, HEX_RADIUS, hexPoints } from "./face";
import { viewPoint, type ViewFrame } from "./bloom";
import { META, RARITY_LABEL } from "./meta";

// The families' words, one spelling everywhere — slot faces, the tray, the
// readout ask, the popover, the Forge modal, the toasts.
export const FAMILY_WORD: Record<MutatorFamily, string> = { power: "Power", resonance: "Resonance", charge: "Charge" };

const FAMILY_SHORT: Record<MutatorFamily, string> = { power: "PWR", resonance: "RES", charge: "CHG" };

// The slot face's radius — module-sized (the chassis is 61) — and the
// presence outline's, hugging the chassis edge clear of the engraved
// rarity rings (55/50/45).
const SLOT_FACE_R = 56;
const PRESENCE_R = 58;

/* ── The mutator's declaration ────────────────────────
   One effect phrasing per family, read off the engine's one magnitude
   rule (ADR-0043): never a ν/s figure, never a rate-details promise. */

export function mutatorEffectText(family: MutatorFamily, rarity: Rarity): string {
  const pct = `+${Math.round(mutatorMagnitude(family, rarity) * 100)}%`;
  if (family === "power") return `${pct} to this module's power`;
  if (family === "resonance") return `${pct} to this module's chord factor`;
  return `${pct} to the strength this module receives`;
}

function effectShort(family: MutatorFamily, rarity: Rarity): string {
  return `${FAMILY_SHORT[family]} ${mutatorEffectText(family, rarity).split(" ")[0]}`;
}

// The family glyph strokes, drawn centered on the origin like the module
// icons — the tray, slot faces, and the expanded face's line share them.
const FAMILY_GLYPH: Record<MutatorFamily, string> = {
  power: '<path d="M-9 9 0-11 9 9"/><path d="M-4.5 9h9"/>',
  resonance: '<path d="M-11 0q5.5-10 11 0t11 0"/><circle r="1.7" cx="-11" cy="0"/><circle r="1.7" cx="11" cy="0"/>',
  charge: '<path d="M3.5-12-7.5 2.5H-1L-3.5 12 7.5-2.5H1Z"/>',
};

function mutatorGlyph(family: MutatorFamily, scale = 1): string {
  return `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" transform="scale(${scale})">${FAMILY_GLYPH[family]}</g>`;
}

// Rarity = engraved ticks here, the module face's ring count in miniature.
function rarityTicks(rarity: Rarity): string {
  const n = { common: 1, uncommon: 2, rare: 3 }[rarity];
  return Array.from({ length: n }, (_, i) => `<circle r="1.6" cx="${((i - (n - 1) / 2) * 7).toFixed(1)}" cy="0"/>`).join("");
}

// The minimal mark (ADR-0027's shape, in the arete register): an arete
// hexagon outline, the family glyph, the rarity ticks, the effect short —
// what you carry is what you drop. The tray, the drag ghost, the combine
// review's pair, and the roll candidates all read this one builder.
export function mutatorTileInner(item: { family: MutatorFamily; rarity: Rarity }): string {
  return `<polygon class="mut-tile-hex" points="${hexPoints(HEX_RADIUS)}"/>
    <g class="mut-tile-glyph" transform="translate(0,-8)">${mutatorGlyph(item.family, 1.6)}</g>
    <g class="mut-tile-ticks" transform="translate(0,22)">${rarityTicks(item.rarity)}</g>
    <text class="mut-tile-effect mono" y="42" text-anchor="middle">${effectShort(item.family, item.rarity)}</text>`;
}

export function mutatorTileSvg(item: MutatorInstance): string {
  return `<svg viewBox="-70 -70 140 140" aria-hidden="true" style="color: var(--arete)">${mutatorTileInner(item)}</svg>`;
}

/* ── Slot and host facts ───────────────────────────── */

// The "q,r" attribute read the layer's bindings share with the board's
// hover delegation: one parse, one guard, one hex.
export function hexFromAttr(raw: string | null | undefined): Hex | null {
  const [q, r] = (raw ?? "").split(",").map(Number);
  return Number.isFinite(q) && Number.isFinite(r) ? { q: q!, r: r! } : null;
}

// The layer's full liveness (issue #199): upgrade mode, the entry owned,
// and the Mutators tab standing — one predicate for the body class, the
// tray strip, the pill, the popover, and the grid decorations.
export function mutatorLayerLive(app: App): boolean {
  return app.state.mode === "upgrade" && app.state.catalogEntryOwned && app.ui.mutLayer === "mutators";
}

// The host line's name: the module's own nameplate over the cell's note —
// "Oscillator · G4". Null on a hostless cell.
function hostName(state: GameState, pos: Hex): string | null {
  const module = deployedAt(state, pos);
  return module ? `${META[module.type].name} · ${cellNoteOf(pos)}` : null;
}

// The slot's inert verdicts (issue #199): a slot on a hostless cell is
// "inert · no host" — a vacant slot's own case, and a placed mutator's
// when no module occupies its cell; resonance on a chordless host is
// "inert · no chord" (chordFactor null: the category never chords; 1:
// sings no chord right now). Every other case is live.
export function mutatorInertVerdict(state: GameState, pos: Hex, item: MutatorInstance, snapshot: RateSnapshot): string | null {
  const module = deployedAt(state, pos);
  if (!module) return "inert · no host";
  if (item.family !== "resonance") return null;
  const factor = snapshot.contributions.get(module.id)?.chordFactor ?? null;
  return factor === null || factor === 1 ? "inert · no chord" : null;
}

// Whether this pair combines: same family and rarity, short of the highest
// tier — the one predicate both the land register and the release read
// (the preview can never disagree with the review it opens).
export function mutCombines(state: GameState, dragId: string, twinId: string | null | undefined): twinId is string {
  return twinId != null && twinId !== dragId && combineMutatorsPreview(state, dragId, twinId) !== null;
}

// The growth-constrained unlock surface (ADR-0043): the first slot may sit
// on any owned cell; every later unlock attaches adjacent to the patch.
export function mutatorUnlockTargets(state: GameState): Hex[] {
  return state.cells.filter((cell) => {
    if (state.mutatorSlots.some((s) => sameHex(s, cell))) return false;
    if (state.mutatorSlots.length === 0) return true;
    return state.mutatorSlots.some((slot) => adjacent(slot, cell));
  });
}

export function mutatorSlotPrice(state: GameState): number {
  // The entry's own first slot never meets the ladder — it rides the entry
  // free, so an empty patch prices at zero (the pill says so).
  return state.mutatorSlots.length === 0 ? 0 : mutatorSlotCost(state.mutatorSlots.length);
}

/* ── The layer tabs ───────────────────────────────────
   The tab pair at the board's top edge (issue #199): the one Modules /
   Mutators switch — the tray column's faces and the phone tray sheet all
   read its state, and none carries a second one (issue #272 review).
   Upgrade-mode furniture; in flow neither tab nor layer exists. Pre-entry
   the pair stands locked-but-visible (issue #273). */

export function mutatorLayerWanted(app: App): boolean {
  return app.state.mode === "upgrade" && app.state.catalogEntryOwned;
}

// The tabs stand through upgrade mode — locked-but-visible before the
// entry purchase (issue #273), live beside it after; flow shows neither
// tab nor layer.
export function mutatorTabsWanted(app: App): boolean {
  return app.state.mode === "upgrade";
}

// The pair's one markup, shared by the board tabs and the phone tray
// sheet's switch — the same two buttons wherever the switch stands.
// Pre-entry the Mutators face is locked-but-visible (issue #273): a muted
// outline and the arete ◇ telegraph the entry, and the click — resolved by
// mutSetLayer — walks to the Catalog's entry screen instead of flipping
// the mode.
export function mutTabPairHtml(app: App): string {
  const { ui, state } = app;
  const locked = !state.catalogEntryOwned;
  return `<button class="mut-tab${ui.mutLayer === "modules" ? " active" : ""}" data-mut-layer="modules" aria-pressed="${ui.mutLayer === "modules"}">Modules</button>
    <button class="mut-tab${ui.mutLayer === "mutators" ? " active" : ""}${locked ? " locked" : ""}" data-mut-layer="mutators" aria-pressed="${ui.mutLayer === "mutators"}"${locked ? ' title="Unlocks with the Mutator entry"' : ""}>${locked ? "◇ " : ""}Mutators</button>`;
}

export function renderMutatorTabs(app: App): void {
  const host = document.getElementById("mut-tabs");
  if (!host) return;
  if (!mutatorTabsWanted(app)) {
    host.hidden = true;
    host.innerHTML = "";
    delete host.dataset.renderKey;
    return;
  }
  // The face and the entry's ownership both shape the pair — the purchase
  // unlocks the locked face in place.
  const key = `${app.ui.mutLayer}:${app.state.catalogEntryOwned}`;
  if (host.dataset.renderKey === key) {
    host.hidden = false;
    return;
  }
  host.dataset.renderKey = key;
  host.hidden = false;
  host.innerHTML = mutTabPairHtml(app);
  host.querySelectorAll<HTMLButtonElement>("[data-mut-layer]").forEach((button) => {
    button.addEventListener("click", () => app.mutSetLayer(button.getAttribute("data-mut-layer") as "modules" | "mutators"));
  });
}

/* ── The grid decorations ─────────────────────────────
   The layer's own drawing inside the board svg: on the Mutators tab, one
   slot face per unlocked cell with the unlock pulse over eligible cells;
   on the Modules tab, the presence outlines alone. */

export function mutGridDecorations(app: App, snapshot: RateSnapshot): string {
  const { state, ui } = app;
  if (state.mode !== "upgrade" || !state.catalogEntryOwned) return "";
  if (ui.mutLayer !== "mutators") {
    // Presence is all the module layer says — family, effect, and words
    // live one tab away. The outline takes no pointers and never speaks.
    const parts = state.mutatorSlots
      .map((pos) => {
        const item = mutatorAt(state, pos);
        if (!item) return "";
        const [x, y] = boardPoint(pos);
        return `<g data-key="mut-presence-${pos.q},${pos.r}" class="mut-presence" transform="translate(${x.toFixed(2)},${y.toFixed(2)})"><polygon points="${hexPoints(PRESENCE_R)}"/></g>`;
      })
      .join("");
    return parts ? `<g data-key="mut-grid">${parts}</g>` : "";
  }
  const parts: string[] = state.mutatorSlots.map((pos) => mutSlotFaceHtml(app, pos, snapshot));
  if (ui.mutUnlockArmed) {
    for (const pos of mutatorUnlockTargets(state)) {
      const [x, y] = boardPoint(pos);
      parts.push(
        `<g data-key="mut-unlock-${pos.q},${pos.r}" class="mut-unlock-target" data-mut-unlock="${pos.q},${pos.r}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})" tabindex="0" role="button" aria-label="Unlock a Mutator slot at ${cellNoteOf(pos)}">
          <polygon class="mut-slot-hex dashed mut-pulse" points="${hexPoints(SLOT_FACE_R)}"/>
        </g>`,
      );
    }
  }
  return `<g data-key="mut-grid">${parts.join("")}</g>`;
}

function mutSlotFaceHtml(app: App, pos: Hex, snapshot: RateSnapshot): string {
  const { state } = app;
  const item = mutatorAt(state, pos);
  const [x, y] = boardPoint(pos);
  const key = `mut-slot-${pos.q},${pos.r}`;
  if (item) {
    const host = hostName(state, pos);
    const inert = mutatorInertVerdict(state, pos, item, snapshot);
    const verdict = inert ?? host ?? "";
    // The never-say rule (issue #199): an inert case promises no effect —
    // the verdict is the face's last word; the declaration lives in the
    // hover ask, the popover, and the expanded face.
    return `<g data-key="${key}" class="mut-slot-face${inert ? " mut-inert" : ""}" data-mut-slot="${pos.q},${pos.r}" tabindex="0" role="button" transform="translate(${x.toFixed(2)},${y.toFixed(2)})" aria-label="${FAMILY_WORD[item.family]} mutator, ${RARITY_LABEL[item.rarity]}, in the slot at ${cellNoteOf(pos)}${inert ? `, ${inert}` : ""}${host ? `, hosts ${host}` : ""}">
      <polygon class="mut-slot-hex" points="${hexPoints(SLOT_FACE_R)}"/>
      <text class="mut-slot-family" y="-30" text-anchor="middle">${FAMILY_WORD[item.family].toUpperCase()}</text>
      <g class="mut-slot-glyph" transform="translate(0,-8)">${mutatorGlyph(item.family, 1.15)}</g>
      <g class="mut-slot-ticks" transform="translate(0,12)">${rarityTicks(item.rarity)}</g>
      <text class="mut-slot-host" y="34" text-anchor="middle">${verdict}</text>
      ${inert ? "" : `<text class="mut-slot-effect mono" y="48" text-anchor="middle">${effectShort(item.family, item.rarity)}</text>`}
      <polygon class="mut-hit" data-mut-hit="${pos.q},${pos.r}" points="${hexPoints(SLOT_FACE_R)}"/>
    </g>`;
  }
  // Vacant: legal, and it speaks — inert · no host, until a host lands.
  return `<g data-key="${key}" class="mut-slot-open" data-mut-slot="${pos.q},${pos.r}" tabindex="0" role="button" transform="translate(${x.toFixed(2)},${y.toFixed(2)})" aria-label="Open Mutator slot at ${cellNoteOf(pos)} — inert until a host lands">
    <polygon class="mut-slot-hex dashed" points="${hexPoints(SLOT_FACE_R)}"/>
    <text class="mut-slot-family" y="-6" text-anchor="middle">OPEN SLOT</text>
    <text class="mut-slot-host" y="12" text-anchor="middle">inert · no host</text>
    <polygon class="mut-hit" data-mut-hit="${pos.q},${pos.r}" points="${hexPoints(SLOT_FACE_R)}"/>
  </g>`;
}

/* ── The Mutator tray ─────────────────────────────────
   The second layer's inventory (issue #272): the tray column's Mutators
   face at every wide width — minted mutators wait here, and the
   placement, combine, and retrieval gestures live here. The slot unlock
   is Add's arm, not a tray card (the #272 review); on portrait phone the
   face hides with the column — the tray sheet's Mutators face carries
   the same tiles there. */

export function renderMutatorTray(app: App): void {
  const host = document.getElementById("mutator-tray");
  if (!host) return;
  const { state, ui } = app;
  if (!mutatorLayerLive(app)) {
    host.hidden = true;
    host.innerHTML = "";
    delete host.dataset.renderKey;
    return;
  }
  const tray = state.mutators.filter((m) => m.pos === null);
  const key = JSON.stringify([tray.map((m) => `${m.id}:${m.rarity}:${m.family}`), ui.mutArmedTray]);
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  host.hidden = false;
  host.innerHTML = `<div class="tray-items mut-strip-items">${
      tray
        .map(
          (item) =>
            `<button class="inventory-tile mut-tile${ui.mutArmedTray === item.id ? " armed" : ""}" data-mut-tray="${item.id}" data-rarity="${item.rarity}" title="${FAMILY_WORD[item.family]} · ${RARITY_LABEL[item.rarity]} · ${mutatorEffectText(item.family, item.rarity)} — tap, then a slot">${mutatorTileSvg(item)}</button>`,
        )
        .join("") || `<span class="tray-empty">minted mutators wait here</span>`
    }</div>`;
  host.querySelectorAll<HTMLButtonElement>("[data-mut-tray]").forEach((button) => {
    const id = button.getAttribute("data-mut-tray")!;
    button.addEventListener("click", () => app.mutArmTray(id));
    bindMutatorDrag(app, button, id, "tray");
  });
}

/* ── The unlock pill ──────────────────────────────────
   The armed unlock's one cost spot (issue #199), mirroring the board's
   armed-purchase pattern: the pill carries the price, the eligible cells
   pulse, Esc or the pill cancels. */

// The armed unlock's one cost spot (issue #199), mirroring the board's
// armed-purchase pattern: the pill carries the price, the eligible cells
// pulse, Esc or the pill cancels.
const boundPills = new WeakSet<HTMLElement>();

export function renderMutatorPill(app: App): void {
  const host = document.getElementById("mut-unlock-pill");
  if (!host) return;
  if (!mutatorLayerLive(app) || !app.ui.mutUnlockArmed) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  const free = app.state.mutatorSlots.length === 0;
  host.hidden = false;
  host.innerHTML = `Unlock Mutator slot · <span class="mono">${free ? "free" : `${mutatorSlotPrice(app.state)} Arete`}</span><span class="mut-esc">Cancel · Esc</span>`;
  // The host never leaves the DOM, so the cancel binding is once-ever (the
  // WeakSet keeps a stale test document from doubling it).
  if (boundPills.has(host)) return;
  boundPills.add(host);
  host.addEventListener("click", () => app.mutCancelGestures());
}

/* ── The declaration popover ──────────────────────────
   An idle click on a placed mutator asks its full declaration — family,
   rarity, effect, host — with Retrieve / Move riding beneath (issue
   #199). Anchored over its slot, zoom-agnostic through the lens frame. */

export function renderMutatorPopover(app: App, snapshot: RateSnapshot): void {
  const host = document.getElementById("mut-popover");
  if (!host) return;
  const { state, ui } = app;
  const item = ui.mutPopover ? state.mutators.find((m) => m.id === ui.mutPopover && m.pos !== null) : null;
  if (!item || item.pos === null || !mutatorLayerLive(app)) {
    host.hidden = true;
    host.innerHTML = "";
    delete host.dataset.renderKey;
    return;
  }
  const pos = item.pos;
  const hostNameLine = hostName(state, pos);
  const inert = mutatorInertVerdict(state, pos, item, snapshot);
  const key = JSON.stringify([item.id, item.rarity, hostNameLine, inert]);
  if (host.dataset.renderKey !== key) {
    host.dataset.renderKey = key;
    host.hidden = false;
    host.innerHTML = `
      <div class="mut-pop-head"><span class="mut-pop-family">${FAMILY_WORD[item.family]}</span><span class="mut-pop-rarity">${RARITY_LABEL[item.rarity]}</span></div>
      ${inert ? "" : `<p class="mut-pop-effect mono">${mutatorEffectText(item.family, item.rarity)}</p>`}
      ${hostNameLine ? `<p class="mut-pop-host">Hosts <b>${hostNameLine}</b></p>` : ""}
      ${inert ? `<p class="mut-pop-inert">${inert}</p>` : ""}
      <div class="mut-pop-actions">
        <button id="mut-pop-retrieve">Retrieve</button>
        <button id="mut-pop-move">Move</button>
        <button id="mut-pop-close" aria-label="Close">✕</button>
      </div>`;
    document.getElementById("mut-pop-retrieve")?.addEventListener("click", () => app.mutPopoverRetrieve());
    document.getElementById("mut-pop-move")?.addEventListener("click", () => app.mutPopoverMove());
    document.getElementById("mut-pop-close")?.addEventListener("click", () => app.mutClosePopover());
  }
  // Position over the slot on every pass — the lens may have moved.
  const svg = document.getElementById("grid");
  const viewBox = (svg?.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const frame: ViewFrame = {
    view: { x: viewBox[0] ?? 0, y: viewBox[1] ?? 0, width: viewBox[2] ?? 0, height: viewBox[3] ?? 0 },
    box: { width: svg?.clientWidth ?? 0, height: svg?.clientHeight ?? 0 },
  };
  const [cx, cy] = viewPoint(boardPoint(pos), frame);
  host.style.left = `${Math.round(cx)}px`;
  host.style.top = `${Math.round(cy)}px`;
  host.hidden = false;
}

/* ── The reserved readout's ask ───────────────────────
   Hovering a slot asks the full declaration into the reserved readout
   (issue #199): "Power · +50% to this module's power — hosts Oscillator
   · G4"; a vacant slot asks "inert until a host lands". */

export function mutatorAskHtml(state: GameState, pos: Hex, snapshot: RateSnapshot): string {
  const item = mutatorAt(state, pos);
  if (!item) {
    return `<span class="chord-readout-chip mono" style="--cc:var(--arete)">Open Mutator slot · ${cellNoteOf(pos)} — inert until a host lands</span>`;
  }
  const host = hostName(state, pos);
  const inert = mutatorInertVerdict(state, pos, item, snapshot);
  return `<span class="chord-readout-chip mono" style="--cc:var(--arete)">${FAMILY_WORD[item.family]}${inert ? "" : ` · ${mutatorEffectText(item.family, item.rarity)}`}${host ? ` — hosts ${host}` : ""}${inert ? ` · ${inert}` : ""}</span>`;
}

/* ── The expanded face's mutator line ─────────────────
   The module's own face gains the mutator line when its cell's slot holds
   one — the declaration plus the inert verdict when it stands idle. */

export function bloomMutatorKey(state: GameState, pos: Hex | null): string {
  if (!pos) return "";
  const item = mutatorAt(state, pos);
  return item ? `${item.id}:${item.rarity}` : "";
}

export function mutatorBloomLineHtml(state: GameState, pos: Hex | null, snapshot: RateSnapshot): string {
  if (!pos) return "";
  const item = mutatorAt(state, pos);
  if (!item) return "";
  const inert = mutatorInertVerdict(state, pos, item, snapshot);
  return `<div class="mut-bloom-line">
    <span class="mut-bloom-glyph" aria-hidden="true"><svg viewBox="-14 -14 28 28">${mutatorGlyph(item.family, 0.8)}</svg></span>
    <b>Mutator · ${FAMILY_WORD[item.family]}</b>
    ${inert ? "" : `<span class="mono">${mutatorEffectText(item.family, item.rarity)}</span>`}
    ${inert ? `<i>${inert}</i>` : ""}
  </div>`;
}

/* ── The live drop preview ────────────────────────────
   While a mutator drag crosses the second layer, the hovered slot wears
   its land register — green for open, the combine tint for a matching
   twin, the swap tint otherwise — refreshed in place, never a render. */

function refreshMutPreviewIn(scope: ParentNode, app: App): void {
  scope.querySelectorAll(".mut-land-open, .mut-land-combine, .mut-land-swap").forEach((node) =>
    node.classList.remove("mut-land-open", "mut-land-combine", "mut-land-swap"),
  );
  const hover = app.ui.mutDropHover;
  if (!hover) return;
  const node = scope.querySelector(`[data-mut-slot="${hover.pos.q},${hover.pos.r}"]`);
  if (!node) return;
  const occupant = mutatorAt(app.state, hover.pos);
  if (!occupant) {
    node.classList.add("mut-land-open");
    return;
  }
  node.classList.add(mutCombines(app.state, hover.mutatorId, occupant.id) ? "mut-land-combine" : "mut-land-swap");
}

// The app's one entry to the in-place refresh (app.setMutDropHover calls
// this; the drag handlers never touch the DOM preview directly).
export function refreshMutPreview(app: App): void {
  const grid = document.querySelector('[data-key="mut-grid"]');
  if (grid) refreshMutPreviewIn(grid, app);
}

/* ── Gestures ─────────────────────────────────────────
   The layer's own bindings on the board svg: clicks resolve through
   app.mutPickSlot, right-click retrieves, and a held placed mutator (or
   tray tile) starts a live drag whose release lands as place, swap,
   combine offer, or retrieval. The module board's cells are pointer-dead
   beneath the layer (the stylesheet greys them), so the two gestures
   never collide. */

const boundMutNodes = new WeakSet<Element>();


export function bindMutatorLayer(app: App, svg: SVGSVGElement): void {
  svg.querySelectorAll<SVGGElement>("[data-mut-slot], [data-mut-unlock]").forEach((node) => {
    if (boundMutNodes.has(node)) return;
    boundMutNodes.add(node);
    const position = (): Hex => {
      return hexFromAttr(node.getAttribute("data-mut-slot") ?? node.getAttribute("data-mut-unlock"))!;
    };
    node.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
        event.preventDefault();
        app.mutPickSlot(position());
      }
    });
    node.addEventListener("click", () => app.mutPickSlot(position()));
    node.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      app.mutRightClickSlot(position());
    });
    node.addEventListener("pointerdown", (baseEvent: Event) => {
      const event = baseEvent as PointerEvent;
      if (event.button !== 0) return;
      const pos = position();
      const item = mutatorAt(app.state, pos);
      if (!item) return;
      startMutDrag(app, event, item.id, pos);
    });
  });
}

// Tray-tile drag binding: press a tile, drag it to a slot (or onto a
// matching twin waiting in the tray).
export function bindMutatorDrag(app: App, element: Element, id: string, origin: Hex | "tray"): void {
  element.addEventListener("pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || app.state.mode !== "upgrade") return;
    startMutDrag(app, event, id, origin);
  });
}

function startMutDrag(app: App, event: PointerEvent, id: string, origin: Hex | "tray"): void {
  if (app.ui.mutUnlockArmed || app.ui.mutArmedTray !== null || app.ui.mutMoving !== null || app.ui.mutCarrying) return;
  const item = app.state.mutators.find((m) => m.id === id);
  if (!item) return;
  app.cancelMutDrag?.();
  const slotAt = (ev: PointerEvent): Hex | null => {
    const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-mut-slot]");
    return hexFromAttr(hit?.getAttribute("data-mut-slot"));
  };
  const trayTwinAt = (ev: PointerEvent): string | null => {
    // A tray-tile combine target only exists for a placed mutator dragged
    // onto a matching twin waiting in the tray.
    if (origin === "tray") return null;
    const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-mut-tray]");
    return hit?.getAttribute("data-mut-tray") ?? null;
  };
  const trayHitAt = (ev: PointerEvent): Element | null => {
    // The phone tray sheet counts as the tray while it stands (issue #272
    // review): dropping a placed mutator onto the open sheet retrieves.
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    return hit?.closest("#mutator-tray") ?? (app.ui.modal === "inventory" ? hit?.closest("#modal-content") ?? null : null);
  };
  const overTray = (ev: PointerEvent): boolean => trayHitAt(ev) !== null;
  const tray = document.getElementById("mutator-tray");
  const sheet = () => (app.ui.modal === "inventory" ? document.getElementById("modal-content") : null);
  app.cancelMutDrag = startPointerDrag(event, {
    start: () => {
      app.ui.mutCarrying = id;
      app.ui.mutPopover = null;
      const ghost = document.createElement("div");
      ghost.className = "drag-ghost mut-ghost";
      ghost.innerHTML = mutatorTileSvg(item);
      return ghost;
    },
    move: (ev) => {
      const pos = slotAt(ev);
      const twin = pos ? null : trayTwinAt(ev);
      app.setMutDropHover(id, pos);
      const sheetNode = sheet();
      const over = overTray(ev);
      tray?.classList.toggle("drag-over", over);
      sheetNode?.classList.toggle("drag-over", over && !tray?.classList.contains("drag-over"));
      const tileScope = sheetNode ?? tray;
      tileScope?.querySelectorAll(".mut-tile").forEach((tile) => {
        tile.classList.toggle("mut-land-combine", twin !== null && tile.getAttribute("data-mut-tray") === twin);
      });
    },
    cleanup: () => {
      app.cancelMutDrag = null;
      tray?.classList.remove("drag-over");
      sheet()?.classList.remove("drag-over");
      for (const scope of [tray, sheet()]) {
        scope?.querySelectorAll(".mut-tile.mut-land-combine").forEach((tile) => tile.classList.remove("mut-land-combine"));
      }
      app.ui.mutCarrying = null;
      app.setMutDropHover(null, null);
    },
    drop: (ev) => resolveMutDrop(app, id, origin, ev, slotAt, trayTwinAt, overTray),
  });
}

// The release's one landing (issue #199): a matching twin under the drop
// opens the combine review — slot or tray — every other landing keeps its
// gesture (occupied slots swap, the tray retrieves, nowhere is a no-op).
function resolveMutDrop(
  app: App,
  id: string,
  origin: Hex | "tray",
  ev: PointerEvent,
  slotAt: (ev: PointerEvent) => Hex | null,
  trayTwinAt: (ev: PointerEvent) => string | null,
  overTray: (ev: PointerEvent) => boolean,
): void {
  const state = app.state;
  if (!state.mutators.some((m) => m.id === id)) return;
  const pos = slotAt(ev);
  if (pos) {
    if (origin !== "tray" && sameHex(origin as Hex, pos)) return;
    const occupant = mutatorAt(state, pos);
    if (occupant && mutCombines(state, id, occupant.id)) {
      app.mutOfferCombine(id, occupant.id);
      return;
    }
    app.mutPlace(id, pos);
    return;
  }
  const twinId = trayTwinAt(ev);
  if (twinId && origin !== "tray" && mutCombines(state, id, twinId)) {
    app.mutOfferCombine(id, twinId);
    return;
  }
  if (overTray(ev) && origin !== "tray") {
    app.mutRetrieve(id);
  }
}
