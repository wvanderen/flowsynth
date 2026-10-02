// PROTOTYPE — throwaway artifact for wayfinder ticket #220 (map #212).
// Never merge to main. Lives on the prototype/playtest-polish-220 branch.
//
// Question: what precise interaction contracts should the backlog implement
// for the four playtest pain points, and what does an enforceable UI-copy
// policy look like? Each surface carries its own control plus two variants,
// switchable independently via URL params on the live route (dev builds
// only; the floating bar bottom-center cycles each row, ←/→ cycles the row
// you last touched, reset returns every surface to its control):
//
//   face=0|1|2    Unaffordable face upgrades (ADR-0045 keeps every control
//                 enabled and partial by design; the complaint is the
//                 misleading read when ZERO levels are affordable).
//     0 current   "+1"/"MAX" label, broke tint, cost-only tooltip.
//     1 shortfall — labels unchanged; every unaffordable tooltip/button
//                 title leads with the need ("+1 level · 12,400 ν —
//                 1,240 ν short"; dial MAX·0; sweep chips "buys 0: need X ν").
//     2 zero reads zero — variant 1 plus the zero-state label swap:
//                 "+1"→"+0", "MAX"→"MAX·0" on faces, so the nothing-to-buy
//                 state is unmistakable at a glance without disabling.
//
//   rate=0|1|2    The rate-hover overlay's size (350px × min(60vh, 420px)
//                 today; a grown roster scrolls in a thin column).
//     0 current   350px wide, 420px tall cap.
//     1 roomy     460px wide, min(76vh, 640px) tall.
//     2 ledger-wide — the popover spans the board ledger's own width
//                 (min(560px, ledger width)), same taller cap.
//
//   forge=0|1|2   Forge choices locked during flow (today the modal opens
//                 in flow — the peek — and a Take click dies on an engine
//                 toast: "Forge choices belong to upgrade mode.").
//     0 current   Active tiles; the click refuses via toast.
//     1 inline lock — in flow the tiles render disabled and the modal's
//                 note carries the lock reason ("Forge choices settle
//                 between sessions."). No toast surprise.
//     2 take during flow — the gate lifts: a click takes the candidate
//                 mid-session; the module/mutator waits in its tray until
//                 the session ends (placement stays flow-locked). The note
//                 states that consequence.
//
//   reflect=0|1|2 The reflection slider (five positions today; the map asks
//                 for continuous, minding existing 1–5 save values — the
//                 prototype keeps the 1–5 range and drops the step, so old
//                 ints stay valid points and nothing migrates).
//     0 current   min=1 max=5 step=1, neutral 3.
//     1 continuous — step=any, a small neutral tick at center.
//     2 ends respond — variant 1 plus the rough/great end labels brighten
//                 as the thumb approaches them (no bands, no numbers).
//
// The board seeds in code (no save file): a representative mid-game blob —
// some faces affordable, several expensive veterans broke, tray module,
// banked module and mutator rolls — so every surface is judged against the
// state that produced the complaints. Saving is disabled while it runs.
import { generateMutatorOffer, generateOffer } from "../../engine/rolls";
import { createInitialState, createModule } from "../../engine/state";
import { hex } from "../../engine/hex";
import { levelCost } from "../../engine/economy";
import { formatInt } from "../format";
import type { GameState, Hex, ModuleInstance, ModuleType, Rarity } from "../../engine/types";
import type { App } from "../app";

type Surface = "face" | "rate" | "forge" | "reflect";

const SURFACES: { key: Surface; label: string; variants: string[] }[] = [
  { key: "face", label: "Face", variants: ["current", "shortfall tooltips", "zero reads zero"] },
  { key: "rate", label: "Rate hover", variants: ["current 350px", "roomy 460px", "ledger-wide"] },
  { key: "forge", label: "Forge in flow", variants: ["current: toast refusal", "inline lock", "take during flow"] },
  { key: "reflect", label: "Reflection", variants: ["five positions", "continuous", "continuous, ends respond"] },
];

export function polishActive(): boolean {
  return import.meta.env.DEV;
}

function variantOf(surface: Surface): number {
  const raw = Number(new URLSearchParams(location.search).get(surface));
  return raw >= 1 && raw <= 2 ? raw : 0;
}

function setVariant(surface: Surface, value: number): void {
  const params = new URLSearchParams(location.search);
  params.set(surface, String(value));
  location.href = `?${params.toString()}`;
}

/* ── Seeding ── */

// Ring-one and a few ring-two axial steps from the origin cell.
const RING: Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  { q: 2, r: -1 }, { q: 2, r: -2 }, { q: 0, r: -2 }, { q: -2, r: 1 }, { q: 1, r: 1 }, { q: -1, r: 2 }, { q: 0, r: 2 },
];

function place(app: App, type: ModuleType, rarity: Rarity, level: number, pos: Hex | null): ModuleInstance {
  const module = createModule(app.state, type, rarity);
  module.level = level;
  module.invested = levelCost(0) * level;
  module.pos = pos;
  app.state.modules.push(module);
  return module;
}

function seedPrototypeBoard(app: App): void {
  // A fresh board, not whatever save this browser profile holds.
  app.state = createInitialState();
  const state = app.state;
  // Build first with a fat bank (cells charge the geometric scaler), then
  // set the real playtest bank: enough for cheap faces, broke against the
  // veterans — the exact texture the complaints came from.
  state.nous = 1e12;
  for (const c of RING) state.cells.push(hex(c.q, c.r));
  place(app, "additive", "rare", 66, { q: 0, r: 0 });
  place(app, "additive", "rare", 61, { q: 1, r: 0 });
  place(app, "additive", "rare", 55, { q: 0, r: -1 });
  place(app, "additive", "uncommon", 41, { q: -1, r: 0 });
  place(app, "conditional", "uncommon", 33, { q: 1, r: -1 });
  place(app, "conditional", "common", 19, { q: -1, r: 1 });
  place(app, "focusKeyed", "rare", 57, { q: 0, r: 1 });
  place(app, "infusor", "rare", 52, { q: -1, r: -1 });
  place(app, "forge", "rare", 48, { q: 2, r: -2 });
  place(app, "spacer", "common", 0, { q: 2, r: -1 });
  place(app, "additive", "rare", 70, null); // tray: the sweeps' extra path
  state.bankedRolls.push(generateOffer(state, Math.random), generateOffer(state, Math.random));
  state.bankedMutatorRolls.push(generateMutatorOffer(state, Math.random));
  state.nous = 3_200_000;
  state.mode = "upgrade";
  app.save = () => {};
}

/* ── Style ── */

const STYLE = `
#proto-polish-bar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%);
  z-index: 9999; background: #101418; color: #dfe7ee; border: 1px solid #3a4652; border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,.5); padding: 8px 10px; font: 12px/1.7 ui-monospace, monospace;
  display: flex; flex-direction: column; gap: 2px; min-width: 340px; }
#proto-polish-bar .proto-head { display: flex; align-items: baseline; gap: 8px; color: #8fa3b5; }
#proto-polish-bar .proto-head b { color: #ffd27d; font-size: 11px; letter-spacing: .08em; }
#proto-polish-bar .proto-row { display: flex; align-items: center; gap: 6px; }
#proto-polish-bar .proto-row.focused .proto-name { color: #fff; }
#proto-polish-bar .proto-key { width: 74px; color: #8fa3b5; }
#proto-polish-bar .proto-name { flex: 1; color: #c8d4de; }
#proto-polish-bar button { all: unset; cursor: pointer; padding: 0 7px; border-radius: 6px; color: #ffd27d; }
#proto-polish-bar button:hover { background: #22303c; }
#proto-polish-bar .proto-reset { color: #8fa3b5; font-size: 11px; align-self: flex-end; }

/* rate=1 roomy */
body.proto-rate-1 .rate-breakdown { width: 460px; max-height: min(76vh, 640px); }
/* rate=2 ledger-wide: the popover drops from the ledger itself */
body.proto-rate-2 .prod-ledger { position: relative; }
body.proto-rate-2 .rate-slot { position: static; }
body.proto-rate-2 .rate-breakdown { left: 0; width: min(560px, 100%); max-height: min(76vh, 640px); }

/* forge=1 inline lock */
body.proto-forge-1 .candidate-tile[disabled] { opacity: .45; cursor: default; }

/* reflect=1 neutral tick; reflect=2 shares it */
body.proto-reflect-1 .reflection-slider, body.proto-reflect-2 .reflection-slider { position: relative; }
body.proto-reflect-1 .reflection-slider::after, body.proto-reflect-2 .reflection-slider::after {
  content: ""; position: absolute; left: 50%; top: 50%; width: 2px; height: 11px;
  transform: translate(-50%, -50%); background: currentColor; opacity: .35; pointer-events: none; }
body.proto-reflect-2 .reflection-end { opacity: .7; transition: opacity .12s; }
`;

/* ── Switcher bar ── */

let lastSurface: Surface = "face";

function mountBar(): void {
  if (document.getElementById("proto-polish-bar")) return;
  const bar = document.createElement("div");
  bar.id = "proto-polish-bar";
  bar.innerHTML = `
    <span class="proto-head"><b>PROTOTYPE · #220</b><span>playtest polish contracts</span></span>
    ${SURFACES.map(
      (s) => `
    <div class="proto-row" data-surface="${s.key}">
      <span class="proto-key">${s.label}</span>
      <button data-dir="-1" aria-label="previous">‹</button>
      <span class="proto-name">${s.variants[variantOf(s.key)]}</span>
      <button data-dir="1" aria-label="next">›</button>
    </div>`,
    ).join("")}
    <button class="proto-reset">reset all to controls</button>`;
  document.body.appendChild(bar);
  bar.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLElement>(".proto-row");
    if (row) {
      const surface = row.dataset.surface as Surface;
      lastSurface = surface;
      const dir = Number((target.closest("button") as HTMLElement)?.dataset.dir ?? 0);
      if (dir) setVariant(surface, (variantOf(surface) + dir + 3) % 3);
      return;
    }
    if (target.classList.contains("proto-reset")) {
      const params = new URLSearchParams(location.search);
      for (const s of SURFACES) params.delete(s.key);
      location.href = `?${params.toString()}`;
    }
  });
  document.addEventListener("keydown", (event) => {
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (event.target as HTMLElement)?.isContentEditable) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    setVariant(lastSurface, (variantOf(lastSurface) + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3);
  });
}

/* ── Mount ── */

export function mountPolishPrototype(app: App): void {
  if (!polishActive()) return;
  const style = document.createElement("style");
  style.id = "proto-polish-style";
  style.textContent = STYLE;
  document.head.appendChild(style);
  const classes = [
    variantOf("rate") === 1 && "proto-rate-1",
    variantOf("rate") === 2 && "proto-rate-2",
    variantOf("forge") === 1 && "proto-forge-1",
    variantOf("reflect") >= 1 && `proto-reflect-${variantOf("reflect")}`,
  ].filter(Boolean) as string[];
  document.body.classList.add(...classes);
  seedPrototypeBoard(app);
  // forge=2 lifts the take gate by flashing upgrade mode around the real
  // action — the engine keeps its own seam; the prototype just unlocks the
  // door for the feel test.
  if (variantOf("forge") === 2) {
    const take = <A extends unknown[]>(bound: (...args: A) => void) => (...args: A): void => {
      const mode = app.state.mode;
      app.state.mode = "upgrade";
      bound(...args);
      app.state.mode = mode;
    };
    const candidate = app.chooseCandidate.bind(app);
    const mutator = app.chooseMutatorCandidate.bind(app);
    app.chooseCandidate = take(candidate);
    app.chooseMutatorCandidate = take(mutator);
  }
  // reflect=2: the end labels respond to the thumb (no bands, no numbers).
  if (variantOf("reflect") === 2) {
    document.addEventListener("input", (event) => {
      const el = event.target as HTMLInputElement;
      if (el.id !== "summary-reflection-slider") return;
      const t = (el.valueAsNumber - 1) / 4;
      const rough = el.previousElementSibling as HTMLElement | null;
      const great = el.nextElementSibling as HTMLElement | null;
      if (rough) rough.style.opacity = String(0.35 + 0.65 * (1 - t));
      if (great) great.style.opacity = String(0.35 + 0.65 * t);
    });
  }
  mountBar();
  app.render();
}

/* ── Render hooks (one call site per surface in render.ts) ── */

// The face button's label/title override, or null to keep the current read.
// `cost` is the quoted price for the click (0 when MAX has nothing to buy);
// `nextCost` is always the next single level's price.
export function protoFaceBuy(
  max: boolean,
  levels: number,
  cost: number,
  nextCost: number,
  bank: number,
): { label: string; title: string } | null {
  const v = variantOf("face");
  const zeroBuy = max ? levels === 0 : cost > bank;
  if (v === 0 || !zeroBuy) return null;
  const short = formatInt(nextCost - bank);
  if (v === 1) {
    return {
      label: max ? "MAX" : "+1",
      title: max ? `MAX · buys 0 — ${short} ν short of the next level` : `+1 level · ${formatInt(nextCost)} ν — ${short} ν short`,
    };
  }
  return {
    label: max ? "MAX·0" : "+0",
    title: max ? `MAX · buys 0 — ${short} ν short` : `+0 — ${short} ν short of one level`,
  };
}

// The bloom's buy column override (MAX chip + upgrade button title), or null.
export function protoBloom(
  maxLevels: number,
  nextCost: number,
  bank: number,
  want: number,
): { maxLabel: string; maxTitle: string; buttonTitle: string } | null {
  const v = variantOf("face");
  if (v === 0) return null;
  const zero = maxLevels === 0 && nextCost > bank;
  const short = formatInt(nextCost - bank);
  if (v === 1) {
    return {
      maxLabel: `MAX·${maxLevels}`,
      maxTitle: zero ? `MAX · buys 0 — ${short} ν short` : `Buy every affordable level (${maxLevels})`,
      buttonTitle: zero
        ? `Nothing affordable — ${short} ν short of one level`
        : `Not enough for all ${want} — buys what it can`,
    };
  }
  return {
    maxLabel: zero ? "MAX·0" : `MAX·${maxLevels}`,
    maxTitle: zero ? `MAX · buys 0 — ${short} ν short` : `Buy every affordable level (${maxLevels})`,
    buttonTitle: zero
      ? `+0 — ${short} ν short of one level`
      : `Not enough for all ${want} — buys what it can`,
  };
}

// The Upgrade All chips' zero-buy suffix, or "" for the current read.
export function protoSweepSuffix(state: GameState): string {
  if (variantOf("face") === 0) return "";
  const cheapest = Math.min(...state.modules.filter((m) => m.type !== "spacer").map((m) => levelCost(m.level)));
  const bank = Math.floor(state.nous);
  return bank < cheapest ? ` — buys 0: need ${formatInt(cheapest - bank)} ν more` : "";
}

// The Forge modal's note override in flow, or null for the current copy.
export function protoForgeNote(state: GameState): string | null {
  if (state.mode === "upgrade") return null;
  const v = variantOf("forge");
  if (v === 1) return "Forge choices settle between sessions.";
  if (v === 2) return "Taken mid-session, the module waits in its tray until the session ends.";
  return null;
}

// Whether the Forge tiles render disabled (forge=1 in flow).
export function protoForgeLockButtons(state: GameState): boolean {
  return variantOf("forge") === 1 && state.mode !== "upgrade";
}

// The reflection slider's step and emphasis class, or the current read.
export function protoReflect(): { step: string; cls: string } {
  const v = variantOf("reflect");
  if (v === 0) return { step: "1", cls: "" };
  return { step: "any", cls: "proto-reflect-open" };
}
