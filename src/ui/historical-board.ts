import { WORLD_ENEMIES, typeRarityOf } from "../engine/constants";
import { sameHex } from "../engine/hex";
import { cellNoteOf } from "../engine/lattice";
import type { Hex } from "../engine/types";
import type { PlaythroughInspection } from "../engine/playthrough";
import { boardPoint, HEX_RADIUS, hexPoints, moduleFace } from "./face";
import { escapeHtml } from "./focus";
import { formatNumber } from "./format";
import { META, WORLD_META } from "./meta";
import { mutatorTileInner } from "./mutators";
import { termTipHtml } from "./terms";

// A pure drawing of the selected record's frozen state. No App, live-board
// handlers, or placement controls: all three layers share the same projection.
export function historicalBoardHtml(inspection: PlaythroughInspection): string {
  const { state } = inspection;
  const positions = [...state.cells, ...WORLD_ENEMIES.map((enemy) => enemy.pos)];
  const cell = (pos: { q: number; r: number }, label: string, inner: string, kind: string): string => {
    const [x, y] = boardPoint(pos);
    return `<g data-history-${kind}="${pos.q},${pos.r}" transform="translate(${x},${y})"><title>${escapeHtml(`${cellNoteOf(pos)} · ${label}`)}</title>${inner}</g>`;
  };
  const empty = (note: string) => `<polygon class="dev-history-empty" points="${hexPoints(HEX_RADIUS)}"/><text class="dev-history-note" text-anchor="middle" y="4">${escapeHtml(note)}</text>`;
  const modules = state.cells.map(pos => {
    const module = state.modules.find(item => item.pos && sameHex(item.pos, pos));
    if (!module) return cell(pos, "empty module cell", empty(cellNoteOf(pos)), "module");
    const voice = inspection.voices.find(item => item.note === cellNoteOf(pos));
    const readout = voice?.nuPerSecond == null ? "" : `${formatNumber(voice.nuPerSecond)} ν/s`;
    return cell(pos, `${META[module.type].name} · Lv. ${module.level} · ${readout}`, `<g class="module-node" data-type="${module.type}" data-rarity="${typeRarityOf(module.type)}">${moduleFace({ type: module.type, tier: module.tier, level: module.level, note: cellNoteOf(pos), readout })}</g>`, "module");
  }).join("");
  const mutators = state.cells.map(pos => {
    const mutator = state.mutators.find(item => item.pos && sameHex(item.pos, pos));
    const slot = state.mutatorSlots.some(item => sameHex(item, pos));
    return cell(pos, mutator ? `${mutator.rarity} ${mutator.family} mutator` : slot ? "empty mutator slot" : "locked mutator slot", mutator ? `${mutatorTileInner(mutator)}<text class="dev-history-note" text-anchor="middle" y="-44">${escapeHtml(cellNoteOf(pos))}</text>` : empty(`${cellNoteOf(pos)} · ${slot ? "OPEN" : "LOCKED"}`), "mutator");
  }).join("");
  const world = positions.filter((pos, index) => positions.findIndex(other => sameHex(pos, other)) === index).map(pos => {
    const enemy = WORLD_ENEMIES.find(item => sameHex(item.pos, pos));
    const live = enemy ? state.world.enemies[enemy.key] : undefined;
    const weapon = state.world.weapons.find(item => item.pos && sameHex(item.pos, pos));
    const column = state.world.columns.find(item => item.pos && sameHex(item.pos, pos));
    const name = enemy ? (live?.discovered ? (live.hp <= 0 ? "CLEARED" : "ENEMY") : "RESERVED") : weapon ? WORLD_META[weapon.type].short : column ? "COLUMN" : "OPEN";
    const value = live?.discovered ? `HP ${formatNumber(live.hp)}` : weapon ? `⌁ ${formatNumber(weapon.store)}` : "";
    return cell(pos, `${name} ${value}`, `<rect class="dev-history-plate" x="-45" y="-45" width="90" height="90"/><text class="dev-history-note" text-anchor="middle" y="-20">${name}</text><text class="dev-history-note" text-anchor="middle" y="4">${escapeHtml(value)}</text><text class="dev-history-note" text-anchor="middle" y="30">${escapeHtml(cellNoteOf(pos))}</text>`, "world");
  }).join("");
  const layer = (name: string, drawing: string, cells: readonly Hex[], tray: string[], label = name): string => {
    const centers = (cells.length ? cells : [{ q: 0, r: 0 }]).map(boardPoint);
    const left = Math.min(...centers.map(([x]) => x)) - HEX_RADIUS - 8;
    const top = Math.min(...centers.map(([, y]) => y)) - HEX_RADIUS - 8;
    const width = Math.max(...centers.map(([x]) => x)) + HEX_RADIUS + 8 - left;
    const height = Math.max(...centers.map(([, y]) => y)) + HEX_RADIUS + 8 - top;
    return `<section class="dev-history-layer"><h3>${label}</h3><div class="dev-history-scroll" tabindex="0" role="region" aria-label="${name} board scroll area"><svg viewBox="${left} ${top} ${width} ${height}" width="${Math.max(320, width)}" height="${height}" role="img" aria-label="Historical ${name} board">${drawing}</svg></div>${tray.length ? `<div class="dev-history-tray mono">tray · ${tray.map(escapeHtml).join(" · ")}</div>` : ""}</section>`;
  };
  const mutatorTray = state.mutators.filter(item => item.pos === null).map(item => `${item.rarity} ${item.family}`);
  const moduleTray = state.modules.filter(item => item.pos === null).map(item => `${META[item.type].name} Lv. ${item.level}`);
  const worldTray = [...state.world.columns.filter(item => item.pos === null).map(() => "Column"), ...state.world.weapons.filter(item => item.pos === null).map(item => WORLD_META[item.type].name)];
  return `<div class="dev-history-board">${layer("Mutators", mutators, state.cells, mutatorTray)}${layer("Modules", modules, state.cells, moduleTray)}${layer("World", world, positions, worldTray, termTipHtml("World layer", "World"))}</div>`;
}
