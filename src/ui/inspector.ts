// The inspector region: the rail beside the board — the module panel for
// the selected module, its dissolved overview when nothing is selected,
// and the values that move with ticks without rebuilding. Renders from the
// RenderContext; every write is an intent. The arrange-mode manage view
// also renders into this rail, but its drag wiring belongs to the grid —
// the dispatcher passes it in until the grid region extracts.
import { chargedFactor, deployed, isSource, levelCost, modulePower, nominalContribution, wholeNous } from "../engine/economy";
import { BALANCE } from "../engine/constants";
import { forgeThreshold } from "../engine/rolls";
import { isCarrier } from "../engine/state";
import { adjacent } from "../engine/hex";
import type { GameState, ModuleInstance } from "../engine/types";
import { formatClock, formatDuration } from "../engine/clock";
import { formatInt, formatNumber } from "./format";
import { META, RARITY_LABEL } from "./meta";
import { effectLine, typeProse, upgradeGain } from "./lexicon";
import { byId, stat, statLive } from "./dom";
import { keyedRegion, liveText } from "./region";
import { projectedCountdown, type RenderContext } from "./context";
import { PINNED_SENTENCE } from "./lexicon";

// The focus-keyed generator's remaining window (§2.3), in the same
// remaining-duration vocabulary the generator spends it in.
function chargeWindowText(state: GameState): string {
  return formatDuration(Math.max(0, state.chargeWindow));
}

function times(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function renderInspector(ctx: RenderContext, renderManageView: (host: HTMLElement) => void): void {
  const host = byId("inspector");
  if (!host) return;
  const { state, ui } = ctx;
  const module = state.modules.find((m) => m.id === ui.selected);
  // Rebuild only when the panel's structure changes; per-tick values update
  // in place below so buttons and scroll position survive flow ticks.
  // Focus apps render in console popovers, never here.
  const key = JSON.stringify([
    state.mode,
    ui.managing,
    ui.selected,
    ui.placing,
    ui.reshape,
    state.bankedRolls.length,
    module?.level ?? null,
    module?.rarity ?? null,
    // Module moves (drag, place, return, combine) must refresh the manage
    // panel's hex inventory even when the selection itself never changes.
    state.modules.map((m) => `${m.id}:${m.type}:${m.level}:${m.rarity}:${m.pos ? `${m.pos.q},${m.pos.r}` : "-"}`).join("|"),
  ]);
  keyedRegion(host, key, () => {
    if (ui.managing && state.mode === "upgrade") {
      renderManageView(host);
    } else if (module) {
      renderModulePanel(ctx, host, module);
    } else {
      renderDissolvedOverview(host);
    }
  });
  updateInspectorLive(ctx, host);
}

// Values that move during flow without rebuilding the panel.
function updateInspectorLive(ctx: RenderContext, host: HTMLElement): void {
  const { state, ui } = ctx;
  liveText(host, "forge", `${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(forgeThreshold(state.forge.earned))}`);
  liveText(host, "elapsed", state.session ? formatClock(state.session.elapsed) : "—");
  liveText(host, "window", chargeWindowText(state));
  // The upgrade CTA and its practice-minute countdown keep themselves current
  // between rebuilds: the projected rate moves with the board, the balance
  // with purchases, so affordability can flip while the panel stands.
  const selected = state.modules.find((m) => m.id === ui.selected);
  if (selected) {
    const cost = levelCost(selected.level);
    const countdownNode = host.querySelector('[data-live="countdown"]');
    if (countdownNode) {
      const text = projectedCountdown(ctx, cost) ?? "";
      if (countdownNode.textContent !== text) countdownNode.textContent = text;
    }
    const cta = byId("upgrade-module") as HTMLButtonElement | null;
    if (cta) cta.disabled = !(state.mode === "upgrade" && wholeNous(state) >= cost);
  }
}

// The grid overview dissolved into the status monitor (issue #38): the
// expansion meter and cell tokens retired, banked rolls moved to the Forge
// surface, charge info to board and module surfaces, counts to the views
// that describe them, and the static formula explainer to the monitor's
// formula chip. When nothing is selected the inspector only points.
function renderDissolvedOverview(host: HTMLElement): void {
  host.innerHTML = `
    <div class="inspector-empty">
      <div class="eyebrow">INSPECTOR</div>
      <p class="small muted" style="margin-top:10px">Select a module to inspect or tune it.</p>
    </div>`;
}

function renderModulePanel(ctx: RenderContext, host: HTMLElement, module: ModuleInstance): void {
  const { state } = ctx;
  const upgrade = state.mode === "upgrade";
  const meta = META[module.type];
  const preview = ctx.memo.projected();
  const contribution = module.pos !== null ? preview.contributions.get(module.id) : null;
  const deployedHere = module.pos !== null;
  const chargeStrength = preview.chargeStrength.get(module.id) ?? 0;
  const effectText =
    deployedHere && contribution && contribution.value !== 0
      ? effectLine(module, { value: contribution.value, strength: chargeStrength })
      : effectLine(module, null, upgrade);
  const growth = BALANCE.rarityPower[module.rarity];
  const cost = levelCost(module.level);
  const affordable = wholeNous(state) >= cost;
  const partner = state.modules.find((m) => m.id !== module.id && m.type === module.type && m.rarity === module.rarity);
  const carrier = isCarrier(module);

  const focus = `<section class="focus-controls">
    <span class="eyebrow">${upgrade ? "NEXT SESSION PREVIEW" : "LIVE GRID"}</span>
    ${statLive("elapsed", "Session", state.session ? formatClock(state.session.elapsed) : "—")}
  </section>`;

  let chargeStats = "";
  if (module.type === "forge") {
    chargeStats = `
      ${statLive("forge", "Shared progress", `${formatNumber(Math.max(0, state.forge.progress))} / ${formatNumber(forgeThreshold(state.forge.earned))}`)}
      ${stat("Rolls earned", String(state.forge.earned))}
      ${stat("Charge source", deployedHere && chargeStrength > 0 ? "adjacent generator" : "no adjacent generator")}
      ${stat("Progress rate", `${formatNumber(contribution?.value ?? 0)} /s while charged`)}`;
  } else if (isSource(module)) {
    chargeStats = `
      ${stat("Output strength", `${formatNumber(modulePower(module))} per second of flow`)}
      ${statLive("window", "Charge window", chargeWindowText(state))}
      ${stat("Receivers", deployedHere ? String(deployed(state).filter((m) => m.id !== module.id && m.pos !== null && module.pos !== null && adjacent(m.pos, module.pos)).length) : "—")}`;
  } else if (module.type === "infusor") {
    chargeStats = `
      ${stat("Bonus to adjacent", `+${formatNumber(100 * nominalContribution(module, chargeStrength))}%`)}
      ${stat("Charge", chargeStrength > 0 ? `strength ${formatNumber(chargeStrength)}` : "none")}`;
  } else {
    const named = preview.namedChords.filter((c) => c.moduleIds.includes(module.id)).map((c) => c.name);
    const pairCount = preview.pairs.filter((p) => p.a === module.id || p.b === module.id).length;
    const chordSummary =
      named.length > 0
        ? `${named.join(" + ")}${pairCount > 0 ? ` + ${times(pairCount, "pair")}` : ""}`
        : pairCount > 0
          ? times(pairCount, "chord pair")
          : "chordless";
    const pitch = contribution?.pitch ?? null;
    chargeStats = `
      ${stat("Pitch", pitch !== null ? `P${pitch} — ${pitch - 1} hex${pitch === 2 ? "" : "es"} from the Carrier` : "—")}
      ${stat("Chords", chordSummary)}
      ${stat("Charge", chargeStrength > 0 ? `strength ${formatNumber(chargeStrength)} (×${formatNumber(chargedFactor(chargeStrength))})` : "none")}`;
  }

  host.innerHTML = `
    <div class="module-heading">
      <button class="quiet small" id="back-overview">← Back</button>
      <h1>${meta.name}</h1>
      <span class="rarity-chip ${module.rarity}">${RARITY_LABEL[module.rarity]}${carrier ? " · pinned" : ""}</span>
    </div>
    ${focus}
    <section>
      <div class="eyebrow">MODULE POWER</div>
      <div class="level-heading">Level <strong>${module.level}</strong><span class="level-effect">${effectText}</span></div>
      <p class="small muted" style="margin:6px 0 0">${typeProse(module.type)}</p>
      <button class="primary upgrade-cta" id="upgrade-module" ${upgrade && affordable ? "" : "disabled"}>
        <span>Upgrade
          <small class="upgrade-gain">+${formatNumber((growth - 1) * 100)}% → ${upgradeGain(module)}</small>
        </span>
        <strong>${formatInt(cost)} ν</strong>
      </button>
      ${upgrade ? `<p class="countdown mono" data-live="countdown">${projectedCountdown(ctx, cost) ?? ""}</p>` : ""}
      ${!upgrade ? `<p class="small muted">Upgrades happen between sessions.</p>` : ""}
      ${carrier ? `<p class="small muted">${PINNED_SENTENCE}</p>` : ""}
      ${upgrade && !carrier && partner && module.rarity !== "rare"
        ? `<button id="combine-pair">Combine with its ${RARITY_LABEL[module.rarity]} pair</button>`
        : ""}
    </section>
    <section>
      <div class="eyebrow">${upgrade ? "NEXT SESSION PREVIEW" : "LIVE GRID"}</div>
      ${stat("Position", module.pos ? `${module.pos.q}, ${module.pos.r}` : "inventory")}
      ${chargeStats}
    </section>`;

  byId("back-overview")?.addEventListener("click", () => ctx.intents.select(null));
  byId("upgrade-module")?.addEventListener("click", () => ctx.intents.upgrade(module.id));
  byId("combine-pair")?.addEventListener("click", () => ctx.intents.combinePair(module.id));
}
