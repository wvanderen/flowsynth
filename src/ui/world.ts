import { BALANCE, WORLD_ENEMIES } from "../engine/constants";
// The World layer's UI (issue #426, ADR-0074): the board's second face,
// built to the design round's approved presentation language
// (`world-faces.prototype.html` at c32438a, variant A — recorded on the
// issue). The layer legend's World face leads the pair; the layer renders
// one square-cut plate per coordinate — the reserved enemy positions with
// their identity concealed, the discovered enemies' HP and penalty, the
// cleared plates' engraved era bonus, the occupants' own figures, and the
// quiet open cells — while the module layer never enters the drawing at
// all (the issue #298/#386 discipline the Mutator Grid established).
// Placement and relocation are free between sessions through the board's
// gesture families — drag, arm-and-place, and the Hex detail — and every
// placement preview reads the engine's one lift function
// (columnLiftsOf), never a UI-side re-derivation. Combat never demands
// attention: the faces carry their own figures, a fed weapon's fill
// breathes at low amplitude, and reduced motion stands fully static.
import { enemyDefAt, enemyDefeated, enemyStateOf, attackPowerOf, columnLiftsOf, eligibleTargetsOf, worldOccupantAt } from "../engine/world";
import { adjacent, sameHex } from "../engine/hex";
import { cellNoteOf } from "../engine/lattice";
import { displayedRates } from "../engine/economy";
import type { GameState, Hex, RateSnapshot, WeaponCopy, WorldColumn } from "../engine/types";
import type { App } from "./app";
import { startPointerDrag } from "./pointer-drag";
import { HEX_RADIUS, boardPoint, hexPoints } from "./face";
import { COLUMN_SHORT, COLUMN_WORD, WORLD_META } from "./meta";
import { formatInt, formatNumber } from "./format";
import { wireTooltips } from "./instrument";
import { lockMarkSvg } from "./icons";
import { termTipHtml } from "./terms";

/* ── The layer's liveness ───────────────────────────── */

// Whether the World layer has arrived in this era: the entry is the 1T
// era-earned reveal — the first enemy's discovery threshold — never a
// purchase. The layer re-locks each prestige until the era climbs back.
export function worldEntered(state: GameState): boolean {
  return state.eraEarned >= BALANCE.world.entryNous;
}

// The layer standing on the board: entered and selected — whatever the
// session mode. Flow reads it read-only; upgrade alone edits it. While it
// stands the renderer draws the layer's plates alone.
export function worldBoardLive(app: App): boolean {
  return worldEntered(app.state) && app.ui.boardLayer === "world";
}

// The editing liveness: upgrade mode on the standing layer — the tray
// strip, the arm pill, the target controls. The board may show the layer
// during a session; the edit furniture never rides along.
export function worldLayerLive(app: App): boolean {
  return app.state.mode === "upgrade" && worldBoardLive(app);
}

/* ── The vertical layer legend ────────────────────────
   The one World / Modules switch: a vertical strip of layer symbols shared
   by the grid and the Hex detail — the grid reads ui.boardLayer, the
   detail reads ui.detail.face, and one builder renders both so the
   vocabulary can never drift. World leads the pair (the co-listing order:
   World leads, as Mutators led). Every mode's furniture: the legend stands
   through flow and pause. Pre-entry the World face stands locked-but-
   visible — muted outline, the lock mark — and its click previews what is
   coming (the reveal threshold, in figures) rather than flipping anything;
   in flow the preview stands too, the reveal being no spending surface. */

export function layerLegendActiveFace(app: App): "modules" | "world" {
  return app.ui.detail ? app.ui.detail.face : app.ui.boardLayer;
}

// The layers' symbols: the square-cut plate for the World — the second
// face's own silhouette from the design round — and the hex chassis for
// modules, the board's module voice. One spelling shared with the Hex
// detail's section heads.
export const LAYER_WORLD_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16"/><path d="M8.5 15.5v-4.2l3.5-3.3 3.5 3.3v4.2z"/></svg>`;
export const LAYER_MODULES_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.6 20.2 7.3v9.4L12 21.4 3.8 16.7V7.3Z"/><path d="M12 8.2v7.6M8.4 10.1l7.2 3.8M15.6 10.1l-7.2 3.8"/></svg>`;

export function layerLegendHtml(app: App): string {
  const { state } = app;
  const active = layerLegendActiveFace(app);
  const locked = !worldEntered(state);
  const worldSelected = active === "world";
  // One mark per state: the padlock stands for the locked layer, the plate
  // register for the arrived one — never both at once. World leads the
  // pair. The locked click previews the reveal in figures; the click never
  // flips and never opens a sheet — the World arrives, it is not bought.
  const preview = worldRevealPreview();
  return `<button class="legend-symbol${worldSelected ? " active" : ""}${locked ? " locked" : ""}" data-legend-layer="world" aria-pressed="${worldSelected}" aria-label="${locked ? `World layer — locked; reveals at ${preview}` : "World layer"}" title="${locked ? `World — reveals at ${preview}` : "World — enemies, weapons, Columns"}">${locked ? LOCK_MARK : LAYER_WORLD_SVG}</button>
    <button class="legend-symbol${active === "modules" ? " active" : ""}" data-legend-layer="modules" aria-pressed="${active === "modules"}" aria-label="Modules layer" title="Modules — the production grid">${LAYER_MODULES_SVG}</button>`;
}

// The locked face's one mark: the shared padlock in the instrument's
// stroke language — the layer is locked, not merely elsewhere.
const LOCK_MARK = lockMarkSvg("world-tab-lock");

// The locked World face's preview line: the reveal's threshold in figures
// — the click's whole answer, in flow as in upgrade.
export function worldRevealPreview(): string {
  return `${formatNumber(BALANCE.world.entryNous)} era-earned`;
}

const boundLegends = new WeakSet<HTMLElement>();

export function renderLayerLegend(app: App): void {
  const host = document.getElementById("layer-legend");
  if (!host) return;
  wireTooltips(host, app.signal);
  // Every mode's furniture: the strip stands through flow and pause,
  // switching grid layers and emphasizing detail faces read-only.
  const key = `${layerLegendActiveFace(app)}:${worldEntered(app.state)}:${app.state.mode === "upgrade"}`;
  if (host.dataset.renderKey === key) {
    host.hidden = false;
    return;
  }
  host.dataset.renderKey = key;
  host.hidden = false;
  host.innerHTML = layerLegendHtml(app);
  // The rebuild replaces the buttons, so the switch re-binds with it; the
  // WeakSet only keeps a stale test document from doubling the binding.
  if (boundLegends.has(host)) return;
  boundLegends.add(host);
  host.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest?.("[data-legend-layer]");
    if (!button) return;
    const layer = button.getAttribute("data-legend-layer") as "modules" | "world";
    if (app.ui.detail && !app.released) app.detailFace(layer);
    else if (!app.released) app.setBoardLayer(layer);
  });
}

/* ── The World faces ──────────────────────────────────
   The layer's drawing inside the board svg: one square-cut plate per
   coordinate — the authored enemy positions (reserved, discovered,
   cleared) wherever they sit, and every owned cell's occupant or open
   face. The plate is the design round's own silhouette: 74 units inscribed
   in the hex cell, square-cut, in the layer's steel register. */

const PLATE_HALF = 37;

// The plates' content rhythm (the design round's): the nameplate in the
// top band, the glyph or bar at center, the figures beneath, the verdict
// (when a face has one) in the bottom band.
const NAME_Y = -PLATE_HALF + 13;
const VERDICT_Y = PLATE_HALF - 6;

// The occupants' and enemies' stroke glyphs, drawn centered on the origin
// in the layer's register — the tray tiles, the drag ghost, and the Hex
// detail's chassis share them.
export const WORLD_GLYPH = {
  enemy: '<path d="M-11-7 0 3 11-7"/><path d="M-11 1 0 11 11 1"/>',
  weapon: '<path d="M-3-13 5-9 3 9-5 13-3-9Z"/><path d="M-8 13h10"/>',
  column: '<rect x="-7" y="-12" width="14" height="24"/><path d="M-11-12h22M-11 12h22"/>',
};

function worldGlyph(kind: "enemy" | "weapon" | "column", dimmed: boolean, scale = 1): string {
  return `<g class="world-glyph${dimmed ? " dimmed" : ""}" transform="scale(${scale})">${WORLD_GLYPH[kind]}</g>`;
}

// The coordinate's World verdict: why the cell takes no placement, in the
// face's own words. Null on an open cell.
export function worldPlacementVerdict(state: GameState, pos: Hex): string | null {
  if (enemyDefAt(pos)) return enemyDefeated(state, enemyDefAt(pos)!.key) ? "cleared" : "reserved";
  const occupant = worldOccupantAt(state, pos);
  if (occupant) return "occupied";
  return null;
}

// The plate's polygon, shared by every face variant; the Hex detail's
// enlarged chassis takes the bigger cut (the mutator chassis's own scale).
function plate(cls: string, half: number = PLATE_HALF): string {
  return `<rect class="world-plate ${cls}" x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}"/>`;
}

// The weapon's charge bar: the stored charge against capacity, the fill in
// the charge register. A fed weapon's fill breathes at low amplitude; an
// unfed or full one stands still. Reduced motion renders static (CSS).
function chargeBar(store: number, live: boolean, width = 52): string {
  const cap = BALANCE.world.storageCap;
  const fill = Math.max(0, Math.min(1, store / cap)) * width;
  return `<rect class="world-bar" x="${-width / 2}" y="0" width="${width}" height="5"/><rect class="world-bar-fill${live ? " live" : ""}" x="${-width / 2}" y="0" width="${fill.toFixed(2)}" height="5"/>`;
}

// The weapons' face: nameplate, glyph, the stored charge against capacity,
// the attack power — and the unfed verdict on the plate itself when no
// Column routes supply to it (the mechanic the board shows, never a
// tooltip apology).
function weaponFaceHtml(state: GameState, weapon: WeaponCopy, lift: number, pos: Hex): string {
  const fed = lift > 0;
  const short = WORLD_META[weapon.type].short;
  return `${plate("firm")}
    <text class="world-word" y="${NAME_Y}" text-anchor="middle">${short}</text>
    <g transform="translate(0,-11)">${worldGlyph("weapon", !fed, 0.7)}</g>
    <g transform="translate(0,4)">${chargeBar(weapon.store, fed)}</g>
    <text class="world-fig${fed ? " charge" : " dim"}" y="22" text-anchor="middle">⌁${formatInt(Math.floor(weapon.store))}/${BALANCE.world.storageCap}</text>
    ${fed
      ? `<text class="world-fig" y="${VERDICT_Y}" text-anchor="middle">ATK ${formatInt(attackPowerOf(state, weapon.type))}</text>`
      : `<text class="world-word" y="${VERDICT_Y}" text-anchor="middle">UNFED</text>`}
    <polygon class="world-hit" data-world-cell="${pos.q},${pos.r}" points="${hexPoints(HEX_RADIUS)}" fill="none" stroke="none"/>`;
}

// The Column's face: its lifted supply figure alone — the one figure the
// glossary grants it. A hostless cell wears the inert verdict; a fed one
// shows the copy rate in the charge register.
function columnFaceHtml(state: GameState, lift: number, pos: Hex): string {
  const hostless = !state.modules.some((m) => m.pos !== null && sameHex(m.pos, pos));
  return `${plate("firm")}
    <text class="world-word" y="${NAME_Y}" text-anchor="middle">${COLUMN_SHORT}</text>
    ${worldGlyph("column", hostless || lift <= 0, 0.8)}
    ${hostless
      ? `<text class="world-word" y="22" text-anchor="middle">inert · no host</text>`
      : `<text class="world-fig${lift > 0 ? " charge" : " dim"}" y="22" text-anchor="middle">⌁${formatNumber(lift)}/s</text>`}
    <polygon class="world-hit" data-world-cell="${pos.q},${pos.r}" points="${hexPoints(HEX_RADIUS)}" fill="none" stroke="none"/>`;
}

// The reserved cell's face: claimed-but-unknown — the hatch says the
// position stands set aside, and no identity renders. Never confusable
// with a discovered enemy's firm plate.
function reservedFaceHtml(pos: Hex): string {
  return `${plate("reserved")}
    <rect class="world-hatch" x="${-PLATE_HALF}" y="${-PLATE_HALF}" width="${PLATE_HALF * 2}" height="${PLATE_HALF * 2}"/>
    <text class="world-word" y="-6" text-anchor="middle">RESERVED</text>
    <polygon class="world-hit" data-world-cell="${pos.q},${pos.r}" points="${hexPoints(HEX_RADIUS)}" fill="none" stroke="none"/>`;
}

// The discovered enemy's face: the firm plate, the hostile glyph, the
// remaining HP, the penalty figure.
function enemyFaceHtml(state: GameState, pos: Hex, key: string): string {
  const def = enemyDefAt(pos)!;
  const live = enemyStateOf(state, key);
  return `${plate("firm")}
    <text class="world-word" y="${NAME_Y}" text-anchor="middle">ENEMY</text>
    ${worldGlyph("enemy", false, 0.85)}
    <text class="world-fig" y="16" text-anchor="middle">HP ${formatInt(Math.max(0, Math.ceil(live.hp)))}/${formatInt(Math.ceil(def.maxHp))}</text>
    <text class="world-fig penalty" y="${VERDICT_Y}" text-anchor="middle">−${Math.round(def.penalty * 100)}% ν</text>
    <polygon class="world-hit" data-world-cell="${pos.q},${pos.r}" points="${hexPoints(HEX_RADIUS)}" fill="none" stroke="none"/>`;
}

// The cleared plate: the encounter retained, the era bonus engraved — the
// completion read in the state grammar, quiet in the register.
function clearedFaceHtml(pos: Hex): string {
  return `${plate("engraved")}
    <text class="world-word" y="${NAME_Y}" text-anchor="middle">CLEARED</text>
    ${worldGlyph("enemy", true, 0.7)}
    <text class="world-fig dim engraved-fig" y="20" text-anchor="middle">+${Math.round(enemyDefAt(pos)!.bonus * 100)}% ν</text>
    <polygon class="world-hit" data-world-cell="${pos.q},${pos.r}" points="${hexPoints(HEX_RADIUS)}" fill="none" stroke="none"/>`;
}

// The open cell's face: quiet dashed hairline — owned space a placement
// can take. While an arm stands, the eligible faces pulse (the arm's pick
// targets, the Mutator Grid's own pattern).
function openFaceHtml(pos: Hex, armed: boolean): string {
  return `${plate(armed ? "open pulse" : "open")}
    <polygon class="world-hit" data-world-cell="${pos.q},${pos.r}" points="${hexPoints(HEX_RADIUS)}" fill="none" stroke="none"/>`;
}

/* ── The grid decorations ───────────────────────────── */

// The layer's one drawing pass, the Mutator Grid's discipline: while the
// World layer stands, this is all the board renders. Every authored enemy
// position wears its state face; every owned cell wears its occupant or
// open face. The lift read arrives from the render's snapshot — the same
// pass the rate ledger shows, never a second derivation.
export function worldGridDecorations(app: App, snapshot: RateSnapshot): string {
  const { state, ui } = app;
  if (!worldBoardLive(app)) return "";
  const lift = columnLiftsOf(state, snapshot);
  const armed = worldLayerLive(app) && ui.worldArmed !== null;
  const parts: string[] = [];
  for (const def of WORLD_ENEMIES) {
    const [x, y] = boardPoint(def.pos);
    const live = state.world.enemies[def.key];
    const face = !live?.discovered
      ? reservedFaceHtml(def.pos)
      : enemyDefeated(state, def.key)
        ? clearedFaceHtml(def.pos)
        : enemyFaceHtml(state, def.pos, def.key);
    parts.push(`<g data-key="world-${def.key}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})">${face}</g>`);
  }
  for (const pos of state.cells) {
    if (enemyDefAt(pos)) continue;
    const [x, y] = boardPoint(pos);
    const occupant = worldOccupantAt(state, pos);
    if (!occupant) {
      parts.push(`<g data-key="world-open-${pos.q},${pos.r}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})">${openFaceHtml(pos, armed)}</g>`);
      continue;
    }
    const inner =
      occupant.kind === "weapon"
        ? weaponFaceHtml(state, state.world.weapons.find((w) => w.id === occupant.id)!, lift.byWeapon.get(occupant.id) ?? 0, pos)
        : columnFaceHtml(state, lift.byColumn.get(occupant.id) ?? 0, pos);
    parts.push(`<g data-key="world-occ-${pos.q},${pos.r}" class="world-occupant" transform="translate(${x.toFixed(2)},${y.toFixed(2)})">${inner}</g>`);
  }
  return `<g data-key="world-grid">${parts.join("")}</g>`;
}

// The lens's World extent: the authored positions sit on coordinates the
// owned patch may not cover, so the board's bounds read includes them
// while the layer stands — zoom and pan hold the whole face.
export function worldLensCoordinates(): Hex[] {
  return WORLD_ENEMIES.map((def) => def.pos);
}

/* ── The reserved readout's ask ─────────────────────── */

// Hovering a plate asks the face's full declaration into the reserved
// readout — one spot, never floating over the board. The weapons carry
// their routing (fed, by whom); the enemies their threat; the reserved
// cells their silence.
export function worldAskHtml(app: App, pos: Hex, snapshot: RateSnapshot): string {
  const { state } = app;
  const def = enemyDefAt(pos);
  if (def) {
    const live = state.world.enemies[def.key];
    if (!live?.discovered) {
      return `<span class="chord-readout-chip mono" style="--cc:var(--world)">Reserved cell · ${cellNoteOf(pos)} — the World holds this position</span>`;
    }
    if (enemyDefeated(state, def.key)) {
      return `<span class="chord-readout-chip mono" style="--cc:var(--world)">Cleared · era bonus +${Math.round(def.bonus * 100)}% ν — returns at prestige</span>`;
    }
    return `<span class="chord-readout-chip mono" style="--cc:var(--world)">Enemy · HP ${formatInt(Math.max(0, Math.ceil(live.hp)))}/${formatInt(Math.ceil(def.maxHp))} · −${Math.round(def.penalty * 100)}% ν</span>`;
  }
  const occupant = worldOccupantAt(state, pos);
  if (!occupant) return `<span class="chord-readout-chip mono" style="--cc:var(--world)">Open World cell · ${cellNoteOf(pos)}</span>`;
  if (occupant.kind === "column") {
    const lift = columnLiftsOf(state, snapshot);
    const rate = lift.byColumn.get(occupant.id) ?? 0;
    const hostless = !state.modules.some((m) => m.pos !== null && sameHex(m.pos, pos));
    const fed = state.world.weapons
      .filter((w) => w.pos !== null && adjacent(w.pos, pos) && (lift.byWeapon.get(w.id) ?? 0) > 0)
      .map((w) => WORLD_META[w.type].short);
    return `<span class="chord-readout-chip mono" style="--cc:var(--world)">${COLUMN_WORD} · ${hostless ? "inert · no host" : `lifts ⌁${formatNumber(rate)}/s${fed.length ? ` → ${fed.join(", ")}` : " · no adjacent weapon"}`}</span>`;
  }
  const weapon = state.world.weapons.find((w) => w.id === occupant.id)!;
  const lift = columnLiftsOf(state, snapshot).byWeapon.get(weapon.id) ?? 0;
  const targets = eligibleTargetsOf(state, weapon);
  const targetWords = targets.map((key) => `at ${cellNoteOf(WORLD_ENEMIES.find((d) => d.key === key)!.pos)}`);
  return `<span class="chord-readout-chip mono" style="--cc:var(--world)">${WORLD_META[weapon.type].name} · ⌁${formatInt(Math.floor(weapon.store))}/${BALANCE.world.storageCap}${lift > 0 ? ` · fed ⌁${formatNumber(lift)}/s` : " · unfed"} · ATK ${formatInt(attackPowerOf(state, weapon.type))}${targetWords.length ? ` · engages ${targetWords.join(", ")}` : " · no target in reach"}</span>`;
}

/* ── The placement preview ────────────────────────────
    The one-authoritative-pass rule (ADR-0054): the preview asks the
    engine's lift function with the move applied — the same conservation
    split the walk runs — and reports what changes for the moved occupant
    and its neighbors. It never recomputes splits. */

export interface WorldPreview {
  moved: string;
  rows: string[];
}

// The preview for hovering `pos` with `id` carried — a placement the
// engine would take. Null off valid targets (the register shows nothing).
export function worldPlacementPreview(state: GameState, id: string, pos: Hex | null): WorldPreview | null {
  if (pos === null || state.mode !== "upgrade") return null;
  const isColumn = state.world.columns.some((c) => c.id === id);
  const isWeapon = state.world.weapons.some((w) => w.id === id);
  if (!isColumn && !isWeapon) return null;
  if (enemyDefAt(pos)) return null;
  const occupant = worldOccupantAt(state, pos);
  if (occupant && occupant.id !== id) return null;
  const snapshot = displayedRates(state, true);
  const before = columnLiftsOf(state, snapshot);
  const after = columnLiftsOf(state, snapshot, { id, pos });
  const rows: string[] = [];
  const share = (lift: { byWeapon: Map<string, number> }, weaponId: string): number => lift.byWeapon.get(weaponId) ?? 0;
  const routeWord = (rate: number): string => (rate > 0 ? `⌁${formatNumber(rate)}/s` : "unfed");
  if (isWeapon) {
    const was = share(before, id);
    const now = share(after, id);
    rows.push(`this ${WORLD_META[state.world.weapons.find((w) => w.id === id)!.type].short}: ${routeWord(was)} → ${routeWord(now)}`);
  }
  if (isColumn) {
    const was = before.byColumn.get(id) ?? 0;
    const now = after.byColumn.get(id) ?? 0;
    rows.push(`${COLUMN_SHORT}: ⌁${formatNumber(was)}/s → ⌁${formatNumber(now)}/s`);
  }
  // The neighbors: every other weapon whose routing share the move changes.
  for (const weapon of state.world.weapons) {
    if (weapon.id === id || weapon.pos === null) continue;
    const was = share(before, weapon.id);
    const now = share(after, weapon.id);
    if (Math.abs(was - now) < 1e-9) continue;
    rows.push(`${WORLD_META[weapon.type].short}: ${routeWord(was)} → ${routeWord(now)}`);
  }
  return { moved: id, rows };
}

export function worldPreviewHtml(preview: WorldPreview): string {
  return preview.rows
    .map((row) => `<span class="chord-readout-chip mono" style="--cc:var(--world)">${row}</span>`)
    .join("");
}

/* ── The World tray ───────────────────────────────────
    The unplaced occupants' browser, sharing the tray column's switch like
    the Mutator tray it replaces: click inspects, Place arms, drag places,
    drag out retrieves; collapsed, it keeps the symbol and stored count —
    the inventory's own grammar, one count, nowhere doubled. */

export function worldTrayOccupants(state: GameState): { weapons: WeaponCopy[]; columns: WorldColumn[] } {
  return {
    weapons: state.world.weapons.filter((w) => w.pos === null),
    columns: state.world.columns.filter((c) => c.pos === null),
  };
}

// The minimal tray mark (the mutator tile's pattern): the square-cut plate
// outline in the layer's register over the occupant's glyph — what you
// carry is what you drop.
export function worldTileInner(kind: "weapon" | "column"): string {
  return `<rect class="world-tile-plate" x="-46" y="-46" width="92" height="92"/>
    ${worldGlyph(kind === "weapon" ? "weapon" : "column", false, 1.9)}`;
}

export function worldTileSvg(kind: "weapon" | "column"): string {
  return `<svg viewBox="-70 -70 140 140" aria-hidden="true" style="color: var(--world)">${worldTileInner(kind)}</svg>`;
}

// The collapsed tray's one mark: the plate symbol + the stored count — the
// inventory's own collapsed grammar.
const WORLD_TRAY_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" style="width:17px;height:17px"><rect x="4" y="4" width="16" height="16"/><path d="M8.5 15.5v-4.2l3.5-3.3 3.5 3.3v4.2z"/></svg>`;

function weaponTrayRead(state: GameState, weapon: WeaponCopy): string {
  return `⌁${formatInt(Math.floor(weapon.store))}/${BALANCE.world.storageCap} · ATK ${formatInt(attackPowerOf(state, weapon.type))}`;
}

function worldInspectHtml(app: App): string {
  const { state } = app;
  const id = app.ui.worldTray.inspect!;
  const weapon = state.world.weapons.find((w) => w.id === id && w.pos === null);
  const column = state.world.columns.find((c) => c.id === id && c.pos === null);
  if (!weapon && !column) return `<button data-world-back>Back to tray</button><p class="inventory-empty">This occupant is no longer in the tray.</p>`;
  const locked = state.mode !== "upgrade";
  const kind = weapon ? "weapon" : "column";
  return `<button data-world-back>Back to tray</button>
    <div class="inventory-inspection">
      <div class="inventory-detail-face">${worldTileSvg(kind)}</div>
      <h3 class="inventory-detail-name">${weapon ? WORLD_META[weapon.type].name : COLUMN_WORD}</h3>
      <p>${weapon ? `Stores charge to ⌁${BALANCE.world.storageCap} · attacks adjacent enemies · ${weaponTrayRead(state, weapon)}` : `Lifts its module cell's received charge to adjacent weapons`}</p>
      ${weapon ? targetPriorityHtml(state, weapon) : ""}
      <button class="primary" data-world-place="${id}"${locked ? " disabled" : ""}>Place</button>
    </div>`;
}

// The weapon's target priority control (the face's own, between sessions
// only): the effective order — stored preference first, authored roster
// behind it — one row per authored enemy, the raise and lower controls
// moving preference. Locks with everything else in flow.
export function targetPriorityHtml(state: GameState, weapon: WeaponCopy): string {
  const locked = state.mode !== "upgrade";
  const stored = weapon.targetPriority;
  const effective: string[] = [];
  for (const key of [...stored, ...WORLD_ENEMIES.map((def) => def.key)]) {
    if (!effective.includes(key)) effective.push(key);
  }
  const rows = effective.map((key, index) => {
    const def = WORLD_ENEMIES.find((entry) => entry.key === key)!;
    const live = state.world.enemies[key];
    const eligible = !!live?.discovered && !enemyDefeated(state, key);
    const inPreference = index < stored.length;
    return `<div class="world-priority-row${eligible ? "" : " dim"}">
      <span class="world-priority-order mono">${index + 1}</span>
      <span class="world-priority-name">Enemy at ${cellNoteOf(def.pos)}${inPreference ? "" : " · roster default"}</span>
      <span class="world-priority-controls">
        <button class="world-priority-move" data-world-priority="${key}" data-dir="-1" aria-label="Raise Enemy at ${cellNoteOf(def.pos)} in target priority"${locked || index === 0 ? " disabled" : ""}>↑</button>
        <button class="world-priority-move" data-world-priority="${key}" data-dir="1" aria-label="Lower Enemy at ${cellNoteOf(def.pos)} in target priority"${locked || index === effective.length - 1 ? " disabled" : ""}>↓</button>
      </span>
    </div>`;
  });
  return `<div class="world-priority" role="group" aria-label="Target priority">
    <span class="world-priority-head">${termTipHtml("Target priority")}${stored.length === 0 ? " · roster default" : ""}${locked ? " · locked in flow" : ""}
      ${stored.length > 0 && !locked ? `<button data-world-priority-reset aria-label="Reset to the roster's default order">Reset</button>` : ""}
    </span>
    ${rows.join("")}
  </div>`;
}

// The tray content's rebuild key inputs — the occupants' placement and
// stores, the priority order, the inspect and arm state.
function trayKey(app: App): string {
  const { state, ui } = app;
  return JSON.stringify([
    state.mode,
    ui.worldTray.inspect,
    ui.worldArmed,
    state.world.weapons.map((w) => [w.id, w.pos, w.store, w.targetPriority]),
    state.world.columns.map((c) => [c.id, c.pos]),
  ]);
}

// The tray column and phone sheet share every content builder.
export function renderWorldTrayContent(app: App, host: HTMLElement, sheet: boolean, bindDrag: (element: Element, id: string) => void): void {
  const { state, ui } = app;
  const locked = state.mode !== "upgrade";
  const collapsed = !sheet && ui.inventory.collapsed && !ui.inventory.dragOpen;
  const count = state.world.weapons.filter((w) => w.pos === null).length + state.world.columns.filter((c) => c.pos === null).length;
  const key = trayKey(app) + JSON.stringify([sheet, collapsed, count]);
  if (host.dataset.worldKey === key) return;
  const active = document.activeElement;
  const focusKey = active instanceof HTMLElement && host.contains(active) ? active.dataset.worldFocus : undefined;
  host.dataset.worldKey = key;
  host.classList.toggle("inventory-collapsed", collapsed);
  host.classList.add("inventory-browser", ...(sheet ? [] : ["inst-panel"]));
  host.classList.toggle("inventory-subview", ui.worldTray.inspect !== null);
  const { weapons, columns } = worldTrayOccupants(state);
  const row = (id: string, kind: "weapon" | "column", name: string, read: string): string =>
    `<div class="inventory-row"><button class="inventory-copy world-tile" data-world-tray="${id}" aria-label="Inspect ${name}${read ? ` · ${read}` : ""}">
      <span class="inventory-mark">${worldTileSvg(kind)}</span><span class="inventory-copy-read"><strong>${name}</strong>${read ? `<span class="inventory-level mono">${read}</span>` : ""}</span>
    </button></div>`;
  const browse = `<div class="inventory-list" data-world-scroll>${
    [...weapons.map((w) => row(w.id, "weapon", WORLD_META[w.type].name, weaponTrayRead(state, w))), ...columns.map((c) => row(c.id, "column", COLUMN_WORD, ""))].join("")
    || `<p class="inventory-empty">No stored World occupants.</p>`
  }</div>`;
  const subview = ui.worldTray.inspect !== null ? worldInspectHtml(app) : browse;
  host.innerHTML = `${sheet ? "" : '<div class="inventory-frame inst-panel-face">'}<div class="inventory-head"><button data-world-collapse aria-expanded="${!collapsed}" aria-label="${sheet ? "Close tray" : collapsed ? "Expand tray" : "Collapse tray"}, ${count} stored">${collapsed ? WORLD_TRAY_ICON : "World tray"}&nbsp;<span class="mono">${count}</span>${collapsed ? "" : `<span aria-hidden="true">${sheet ? "×" : "−"}</span>`}</button></div>${collapsed ? "" : `<div class="inventory-body">${subview}</div>`}${sheet ? "" : "</div>"}`;
  host.querySelectorAll<HTMLElement>("button").forEach((node) => {
    const attr = node.getAttributeNames().find((name) => name.startsWith("data-"));
    node.dataset.worldFocus = attr ? `${attr}:${node.getAttribute(attr)}` : node.getAttribute("aria-label") ?? "";
  });
  const on = (selector: string, fn: (el: HTMLElement) => void) => host.querySelectorAll<HTMLElement>(selector).forEach((el) => app.listen(el, "click", () => fn(el)));
  on("[data-world-collapse]", () => {
    if (sheet) app.closeModal();
    else { ui.inventory.collapsed = !ui.inventory.collapsed; app.render(); }
  });
  on("[data-world-back]", () => { ui.worldTray.inspect = null; app.render(); });
  on("[data-world-tray]", (el) => { ui.worldTray.inspect = el.dataset.worldTray!; app.render(); });
  on("[data-world-place]", (el) => {
    if (locked) return;
    const id = el.dataset.worldPlace!;
    ui.worldTray.inspect = null;
    if (app.ui.detail) {
      if (sheet) app.closeModal();
      app.detailPlaceWorld(id);
      return;
    }
    if (sheet) app.closeModal();
    app.worldArmTray(id);
  });
  on("[data-world-priority]", (el) => {
    if (locked || !ui.worldTray.inspect) return;
    app.worldMovePriority(ui.worldTray.inspect, el.dataset.worldPriority!, Number(el.dataset.dir));
  });
  on("[data-world-priority-reset]", () => {
    if (locked || !ui.worldTray.inspect) return;
    app.setWeaponPriority(ui.worldTray.inspect, []);
  });
  if (!locked) host.querySelectorAll<HTMLElement>("[data-world-tray]").forEach((el) => bindDrag(el, el.dataset.worldTray!));
  if (locked) host.querySelectorAll<HTMLButtonElement>("[data-world-place]").forEach((el) => { el.disabled = true; });
  wireTooltips(host, app.signal);
  if (focusKey !== undefined) {
    const target = [...host.querySelectorAll<HTMLElement>("[data-world-focus]")].find((el) => el.dataset.worldFocus === focusKey);
    (target ?? host.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
  }
}

// The armed tray tile's pill (the Mutator Grid's own pattern): the arm is
// the click-shaped placement's cost spot — World placement is free, so the
// pill only carries the cancel.
export function renderWorldPill(app: App): void {
  const host = document.getElementById("world-place-pill");
  if (!host) return;
  if (!worldLayerLive(app) || app.ui.worldArmed === null) {
    host.hidden = true;
    host.innerHTML = "";
    return;
  }
  host.hidden = false;
  host.innerHTML = `Place ${app.ui.worldArmedKind === "column" ? COLUMN_WORD : WORLD_META.chargeBlade.name} · free<span class="pill-esc">Cancel · Esc</span>`;
  if (host.dataset.bound) return;
  host.dataset.bound = "true";
  app.listen(host, "click", () => app.worldCancelGestures());
}

/* ── Gestures ─────────────────────────────────────────
    The layer's own bindings on the board svg: clicks resolve through
    app.worldPickCell, right-click retrieves, and a held occupant (or tray
    tile) starts a live drag whose release lands as place or retrieval.
    The module board's cells never enter the svg while the layer stands,
    so the two gesture families never collide. */

const boundWorldNodes = new WeakSet<Element>();

export function bindWorldLayer(app: App, svg: SVGSVGElement): void {
  svg.querySelectorAll<SVGGElement>("[data-world-cell], [data-world-arm]").forEach((node) => {
    if (boundWorldNodes.has(node)) return;
    boundWorldNodes.add(node);
    const position = (): Hex => hexFromAttr(node.getAttribute("data-world-cell") ?? node.getAttribute("data-world-arm"))!;
    app.listen(node, "keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
        event.preventDefault();
        app.worldPickCell(position());
      }
    });
    app.listen(node, "click", () => app.worldPickCell(position()));
    app.listen(node, "contextmenu", (event) => {
      event.preventDefault();
      app.worldRightClickCell(position());
    });
    app.listen(node, "pointerdown", (baseEvent: Event) => {
      const event = baseEvent as PointerEvent;
      if (event.button !== 0) return;
      const pos = position();
      const occupant = worldOccupantAt(app.state, pos);
      if (!occupant) return;
      startWorldDrag(app, event, occupant.id, pos);
    });
  });
}

export function hexFromAttr(raw: string | null | undefined): Hex | null {
  const [q, r] = (raw ?? "").split(",").map(Number);
  return Number.isFinite(q) && Number.isFinite(r) ? { q: q!, r: r! } : null;
}

// Drag binding: press a tile (tray origin) or a placed occupant's face
// (its own cell), drag it to an open face or back to the tray.
export function bindWorldDrag(app: App, element: Element, id: string, origin: "tray" | Hex): void {
  app.listen(element, "pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0) return;
    startWorldDrag(app, event, id, origin);
  });
}

function startWorldDrag(app: App, event: PointerEvent, id: string, origin: Hex | "tray"): void {
  // The drag is an edit's first half: a session's board reads, it never
  // carries — the guard sits here where both drag entries land.
  if (app.state.mode !== "upgrade") return;
  if (app.ui.worldArmed !== null) return;
  app.cancelWorldDrag?.();
  const cellAt = (ev: PointerEvent): Hex | null => {
    const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-world-cell]");
    return hexFromAttr(hit?.getAttribute("data-world-cell"));
  };
  const trayHitAt = (ev: PointerEvent): Element | null => {
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    return hit?.closest("#world-tray, #inventory-zone") ?? (app.ui.modal === "inventory" ? hit?.closest("#modal-content") ?? null : null);
  };
  const overTray = (ev: PointerEvent): boolean => trayHitAt(ev) !== null;
  const tray = document.getElementById("world-tray");
  const sheet = () => (app.ui.modal === "inventory" ? document.getElementById("modal-content") : null);
  const kind = app.state.world.columns.some((c) => c.id === id) ? "column" : "weapon";
  app.cancelWorldDrag = startPointerDrag(app, event, {
    start: () => {
      app.ui.worldCarrying = id;
      const ghost = document.createElement("div");
      ghost.className = "drag-ghost world-ghost";
      ghost.innerHTML = worldTileSvg(kind as "weapon" | "column");
      return ghost;
    },
    move: (ev) => {
      const pos = cellAt(ev);
      app.setWorldDropHover(id, pos);
      const over = overTray(ev);
      tray?.classList.toggle("drag-over", over);
      sheet()?.classList.toggle("drag-over", over && !tray?.classList.contains("drag-over"));
    },
    cleanup: () => {
      app.cancelWorldDrag = null;
      if (app.ui.inventory.dragOpen) {
        app.ui.inventory.dragOpen = false;
        queueMicrotask(() => { if (!app.released) app.render(); });
      }
      tray?.classList.remove("drag-over");
      sheet()?.classList.remove("drag-over");
      app.ui.worldCarrying = null;
      app.setWorldDropHover(null, null);
    },
    drop: (ev) => {
      const pos = cellAt(ev);
      if (pos) {
        if (origin !== "tray" && sameHex(origin as Hex, pos)) return;
        app.worldPlace(id, pos);
        return;
      }
      if (overTray(ev) && origin !== "tray") {
        app.worldRetrieve(id);
      }
    },
  });
}

// The live drop preview: the hovered face wears its land register — clear
// for open, the muted refusal otherwise — refreshed in place, never a
// render; the reserved readout carries the lift preview.
function refreshWorldPreviewIn(scope: ParentNode, app: App): void {
  scope.querySelectorAll(".world-land-open, .world-land-blocked").forEach((node) =>
    node.classList.remove("world-land-open", "world-land-blocked"),
  );
  const hover = app.ui.worldDropHover;
  if (!hover || hover.pos === null) return;
  const face = scope.querySelector(`[data-world-cell="${hover.pos.q},${hover.pos.r}"]`)?.closest("g");
  if (!face) return;
  const plateNode = face.querySelector(".world-plate") ?? face.firstElementChild;
  if (!plateNode) return;
  if (worldPlacementPreview(app.state, hover.id, hover.pos)) plateNode.classList.add("world-land-open");
  else plateNode.classList.add("world-land-blocked");
}

// The app's one entry to the in-place refresh (app.setWorldDropHover
// calls this; the drag handlers never touch the DOM preview directly).
export function refreshWorldPreview(app: App): void {
  const grid = document.querySelector('[data-key="world-grid"]');
  if (grid) refreshWorldPreviewIn(grid, app);
  const detail = document.getElementById("hex-detail");
  if (detail) refreshWorldPreviewIn(detail, app);
}

export function worldCountBadge(app: App): number {
  const { state } = app;
  return state.world.weapons.filter((w) => w.pos === null).length + state.world.columns.filter((c) => c.pos === null).length;
}

export function deployedWeaponAt(state: GameState, pos: Hex): WeaponCopy | undefined {
  const occupant = worldOccupantAt(state, pos);
  return occupant?.kind === "weapon" ? state.world.weapons.find((w) => w.id === occupant.id) : undefined;
}

// The Hex detail's World chassis: the coordinate's plate at readable
// scale, its state spoken once in the tooltip. Pre-reveal the plate is
// the locked one — the layer has not arrived, whatever the coordinate.
export function worldChassisHtml(state: GameState, pos: Hex, snapshot: RateSnapshot): { chassis: string; tip: string } {
  if (!worldEntered(state)) {
    return {
      chassis: `<svg class="world-stack locked" viewBox="-70 -70 140 140" aria-hidden="true">${plate("locked")}<g class="world-glyph dimmed" transform="translate(0,-6) scale(1.6)"><rect x="-4.5" y="-1" width="9" height="7"/><path d="M-2.6-1v-2.2a2.6 2.6 0 0 1 5.2 0V-1"/></g><text class="world-word" y="22" text-anchor="middle">LOCKED</text><polygon class="hex-stack-marker" points="${hexPoints(53)}"/></svg>`,
      tip: `The World reveals at ${worldRevealPreview()}`,
    };
  }
  const def = enemyDefAt(pos);
  if (def) {
    const live = state.world.enemies[def.key];
    if (!live?.discovered) {
      return {
        chassis: `<svg class="world-stack" viewBox="-70 -70 140 140" aria-hidden="true">${plate("reserved", 52)}<rect class="world-hatch" x="-52" y="-52" width="104" height="104"/><text class="world-word" y="4" text-anchor="middle">RESERVED</text><polygon class="hex-stack-marker" points="${hexPoints(53)}"/></svg>`,
        tip: `Reserved cell · silent until its reveal`,
      };
    }
    if (enemyDefeated(state, def.key)) {
      return {
        chassis: `<svg class="world-stack" viewBox="-70 -70 140 140" aria-hidden="true">${plate("engraved", 52)}<text class="world-word" y="-38" text-anchor="middle">CLEARED</text><g transform="translate(0,-12)">${worldGlyph("enemy", true, 1)}</g><text class="world-fig dim" y="30" text-anchor="middle">+${Math.round(def.bonus * 100)}% ν</text><polygon class="hex-stack-marker" points="${hexPoints(53)}"/></svg>`,
        tip: `Cleared · the enemy returns at prestige`,
      };
    }
    return {
      chassis: `<svg class="world-stack" viewBox="-70 -70 140 140" aria-hidden="true">${plate("firm", 52)}<text class="world-word" y="-38" text-anchor="middle">ENEMY</text><g transform="translate(0,-14)">${worldGlyph("enemy", false, 1.2)}</g><text class="world-fig" y="24" text-anchor="middle">HP ${formatInt(Math.max(0, Math.ceil(live.hp)))}/${formatInt(Math.ceil(def.maxHp))}</text><text class="world-fig penalty" y="44" text-anchor="middle">−${Math.round(def.penalty * 100)}% ν</text><polygon class="hex-stack-marker" points="${hexPoints(53)}"/></svg>`,
      tip: `Enemy · attacked by adjacent weapons on their cadence`,
    };
  }
  const occupant = worldOccupantAt(state, pos);
  if (!occupant) {
    return {
      chassis: `<svg class="world-stack" viewBox="-70 -70 140 140" aria-hidden="true">${plate("open", 52)}<polygon class="hex-stack-marker" points="${hexPoints(53)}"/></svg>`,
      tip: `Open World cell · an occupant places free`,
    };
  }
  const lift = columnLiftsOf(state, snapshot);
  if (occupant.kind === "weapon") {
    const weapon = state.world.weapons.find((w) => w.id === occupant.id)!;
    const rate = lift.byWeapon.get(weapon.id) ?? 0;
    const fed = rate > 0;
    return {
      chassis: `<svg class="world-stack" viewBox="-70 -70 140 140" aria-hidden="true">${plate("firm", 52)}<text class="world-word" y="-38" text-anchor="middle">${WORLD_META[weapon.type].short}</text><g transform="translate(0,-16)">${worldGlyph("weapon", !fed, 1)}</g><g transform="translate(0,4)">${chargeBar(weapon.store, fed, 72)}</g><text class="world-fig${fed ? " charge" : " dim"}" y="26" text-anchor="middle">⌁${formatInt(Math.floor(weapon.store))}/${BALANCE.world.storageCap}</text><text class="${fed ? "world-fig" : "world-word"}" y="44" text-anchor="middle">${fed ? `ATK ${formatInt(attackPowerOf(state, weapon.type))}${rate ? ` · ⌁${formatNumber(rate)}/s` : ""}` : "UNFED"}</text><polygon class="hex-stack-marker" points="${hexPoints(53)}"/></svg>`,
      tip: fed ? `${WORLD_META[weapon.type].name} · attacks its top target every ${BALANCE.world.attackCadenceSeconds} s` : `${WORLD_META[weapon.type].name} · place beside a Column to feed`,
    };
  }
  const column = state.world.columns.find((c) => c.id === occupant.id)!;
  const rate = lift.byColumn.get(column.id) ?? 0;
  const hostless = !state.modules.some((m) => m.pos !== null && sameHex(m.pos, pos));
  return {
    chassis: `<svg class="world-stack" viewBox="-70 -70 140 140" aria-hidden="true">${plate("firm", 52)}<text class="world-word" y="-38" text-anchor="middle">${COLUMN_SHORT}</text><g transform="translate(0,-10)">${worldGlyph("column", hostless || rate <= 0, 1.3)}</g><text class="world-fig${rate > 0 ? " charge" : " dim"}" y="32" text-anchor="middle">${hostless ? "inert · no host" : `⌁${formatNumber(rate)}/s`}</text><polygon class="hex-stack-marker" points="${hexPoints(53)}"/></svg>`,
    tip: hostless ? `${COLUMN_WORD} · place over a module cell to lift` : `${COLUMN_WORD} · lifts ⌁${formatNumber(rate)}/s from the module beneath`,
  };
}
