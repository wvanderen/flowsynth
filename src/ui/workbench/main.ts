/// <reference types="vite/client" />
import skeleton from "../../../index.html?raw";
import { App } from "../app";
import { previewSave, previewState, silentChannels } from "./fixtures";
import { defaultTheme } from "../theme";
import { moduleFace, hexPoints, HEX_RADIUS, faceReadoutFor, faceLevel, waterFill } from "../face";
import { displayedRates } from "../../engine/economy";
import { wireTooltips } from "../instrument";
import { META } from "../meta";

const params = new URLSearchParams(location.search);
const preview = params.get("preview");

// This HTML entry is a Vite development workbench, not a production route.
if (!import.meta.env.DEV) {
  document.body.textContent = "Run npm run dev to open the design workbench.";
} else if (preview) {
  bootPreview(preview);
} else {
  bootWorkbench();
}

function bootPreview(surface: string): void {
  document.body.innerHTML = skeleton.slice(skeleton.indexOf("<body>") + 6, skeleton.lastIndexOf("</body>"))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  if (params.has("static")) document.documentElement.classList.add("workbench-static");
  const els: Record<string, HTMLElement> = {};
  for (const id of ["console-session", "console-apps", "board-tools", "thumb-bar", "grid", "status", "modal", "modal-content"]) {
    const element = document.getElementById(id);
    if (element) els[id] = element;
  }
  const app = new App(els, false, silentChannels, previewSave());
  app.state = previewState(surface);
  app.ui.chosenTarget = 1500;
  app.render();
  if (surface === "catalog") app.openModal("catalog");
  if (surface === "forge") {
    app.state.bankedRolls.push({ id: "wb-roll", candidates: [{ id: "wb-sine", type: "additive", tier: 0 }, { id: "wb-triangle", type: "triangle", tier: 0 }, { id: "wb-saw", type: "saw", tier: 0 }] });
    app.openModal("forge");
  }
  if (surface === "plan") app.openApp("time");
  if (surface === "habits") app.openApp("habit");
  if (surface === "goals") app.openApp("goals");
  if (surface === "notes") app.openModal("notes");
  if (surface === "detail") {
    app.ui.detail = { pos: { q: 0, r: 0 }, face: "modules" };
    app.render();
  }
  app.listen(document.getElementById("modal"), "click", (event) => {
    if (event.target === event.currentTarget) app.closeModal();
  });
  window.addEventListener("pagehide", () => app.dispose(), { once: true });
}

function bootWorkbench(): void {
  document.body.className = "workbench";
  document.body.innerHTML = `<header class="wb-header">
    <div><h1>FlowSynth <span>Workbench</span></h1><p>Production surfaces · disposable fixtures · no player save access</p></div>
    <a href="/" target="_blank" rel="noopener">Open instrument ↗</a>
  </header>
  <nav class="facetabs wb-tabs" aria-label="Workbench views">
    <button class="ftab active" aria-pressed="true" data-view="instrument">Instrument</button>
    <button class="ftab" aria-pressed="false" data-view="components">Components</button>
  </nav>
  <main>
    <section id="wb-instrument">
      <div class="wb-controls">
        <label>Surface <select id="wb-surface">
          <optgroup label="Board"><option value="opening">Opening</option><option value="populated" selected>Populated</option><option value="flow">Live flow</option><option value="paused">Paused</option><option value="detail">Hex detail</option></optgroup>
          <optgroup label="Panels"><option value="catalog">Catalog</option><option value="forge">Forge</option><option value="plan">Focus · Plan</option><option value="habits">Focus · Habit</option><option value="goals">Focus · Goals</option><option value="notes">Notes</option></optgroup>
        </select></label>
        <label>Viewport <select id="wb-size"><option value="desktop">Desktop</option><option value="phone">Phone · 390 px</option></select></label>
        <label class="wb-toggle"><input type="checkbox" id="wb-compare"> Compare desktop + phone</label>
        <label class="wb-toggle"><input type="checkbox" id="wb-static"> Static preview</label>
        <button id="wb-reset">Reset fixture</button>
      </div>
      <p class="wb-note">Interact with the real instrument below. Static preview stops CSS motion; verify the operating system’s reduced-motion preference separately.</p>
      <div id="wb-stages"></div>
    </section>
    <section id="wb-components" hidden>${componentsHtml()}</section>
  </main>`;
  const stages = document.getElementById("wb-stages")!;
  const surface = document.getElementById("wb-surface") as HTMLSelectElement;
  const size = document.getElementById("wb-size") as HTMLSelectElement;
  const compare = document.getElementById("wb-compare") as HTMLInputElement;
  const still = document.getElementById("wb-static") as HTMLInputElement;
  const mount = () => {
    stages.className = compare.checked ? "wb-compare" : "";
    stages.innerHTML = (compare.checked ? ["desktop", "phone"] : [size.value]).map((viewport) =>
      `<figure class="wb-stage ${viewport}"><figcaption>${viewport === "phone" ? "Phone · 390 × 844" : "Desktop · responsive width × 760"}</figcaption><iframe title="${viewport} ${surface.selectedOptions[0]!.textContent}" src="/workbench.html?preview=${surface.value}${still.checked ? "&static=1" : ""}"></iframe></figure>`,
    ).join("");
  };
  for (const control of [surface, size, compare, still]) control.addEventListener("change", mount);
  document.getElementById("wb-reset")!.addEventListener("click", mount);
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((tab) => tab.addEventListener("click", () => {
    const instrument = tab.dataset.view === "instrument";
    document.getElementById("wb-instrument")!.hidden = !instrument;
    document.getElementById("wb-components")!.hidden = instrument;
    for (const button of document.querySelectorAll("[data-view]")) {
      const selected = button === tab;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    // Hidden instruments do not run behind the component sheet.
    if (instrument) mount(); else stages.replaceChildren();
  }));
  wireTooltips(document.getElementById("wb-components")!);
  mount();
}

function componentsHtml(): string {
  const state = previewState("flow");
  const rates = displayedRates(state, true);
  const faces = state.modules.filter((m) => ["additive", "focusKeyed", "harmonizer", "infusor", "forge"].includes(m.type))
    .filter((m, i, all) => all.findIndex((other) => other.type === m.type) === i);
  const swatches = ["bg", "panel-deep", "panel-soft", "panel", "line-soft", "line", "line-strong", "muted", "ink", "charge", "nous", "arete", "switch"];
  return `<div class="wb-specimen">
    <section><h2>Materials</h2><div class="wb-swatches">${swatches.map((key) => `<div><i style="background:var(--${key})"></i><span>${key}</span><code>${defaultTheme.tokens[key]}</code></div>`).join("")}</div></section>
    <section><h2>Control states</h2><div class="wb-row">
      <button disabled>Unavailable</button><button class="st-available">Available</button><button class="st-selected" aria-pressed="true">Selected</button><span class="st-acquired">✓ Acquired</span><button class="primary">Purchase</button><button class="danger">Confirm reset</button>
    </div><p class="wb-note">Outlines, the inset marker, and the engraved check carry state without hue.</p></section>
    <section><h2>Floating panel · content switching · disclosure</h2>
      <div class="inst-panel wb-panel"><div class="inst-panel-face"><div class="facetabs" role="group" aria-label="Specimen faces"><button class="ftab active" aria-pressed="true" data-specimen-face="modules">Modules</button><button class="ftab" aria-pressed="false" data-specimen-face="mutators">Mutators</button></div>
      <div class="folio-row"><span class="folio-key">Memorized</span><span class="inst-tip"><button class="inst-tip-trigger" aria-describedby="wb-term" aria-expanded="false" aria-label="Meaning of memorized">ⓘ</button><span class="inst-tip-body" id="wb-term" role="tooltip">Persists through arete reset</span></span></div></div></div>
      <p class="wb-note">Top-right / bottom-left cuts. Focus, hover, or tap the term; Escape dismisses.</p>
    </section>
    <section><h2>Module face specimens · charge register</h2><div class="wb-faces">${faces.map((m) => `<figure><svg viewBox="-72 -72 144 144" role="img" aria-label="${META[m.type].name}"><g class="module-node" data-type="${m.type}"><polygon class="hex-glow" points="${hexPoints(HEX_RADIUS)}"/>${moduleFace({ type: m.type, tier: m.tier, level: faceLevel(m), ...faceReadoutFor(state, m, m.pos, rates), hexClass: "charged", chargeGlow: 0.65, ...(m.type === "forge" ? { under: waterFill(m.id, 0.65) } : {}) })}</g></svg><figcaption>${META[m.type].name}</figcaption></figure>`).join("")}</div>
      <p class="wb-note">Specimen illumination is held on for comparison. Instrument previews use engine-driven charge states.</p><button id="wb-threshold">Preview threshold crossing</button><label class="wb-toggle"><input type="checkbox" id="wb-components-static"> Static specimens</label>
    </section>
  </div>`;
}

// Specimen interactions only change the specimen's presentation.
document.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-specimen-face]");
  if (button) for (const tab of document.querySelectorAll("[data-specimen-face]")) {
    tab.classList.toggle("active", tab === button);
    tab.setAttribute("aria-pressed", String(tab === button));
  }
  if ((event.target as Element).closest("#wb-threshold")) {
    const forge = document.querySelector<SVGElement>('.wb-faces [data-type="forge"]');
    if (!forge) return;
    forge.classList.remove("forge-crossed");
    // Restart the production one-shot animation after a deliberate preview.
    void forge.getBoundingClientRect();
    forge.classList.add("forge-crossed");
  }
});
document.addEventListener("change", (event) => {
  if ((event.target as Element).id === "wb-components-static") {
    document.getElementById("wb-components")!.classList.toggle("workbench-static", (event.target as HTMLInputElement).checked);
  }
});
