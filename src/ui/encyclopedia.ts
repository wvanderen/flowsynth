import { availableEntries, type EntryId } from "../engine/encyclopedia";
import type { App } from "./app";

export function chargeHelpHtml(app: App, id = "about-charge"): string {
  return availableEntries(app.state).some(entry => entry.id === "charge")
    ? `<button id="${id}" data-charge-help class="encyclopedia-context">About charge</button>` : "";
}
export function bindChargeHelp(app: App, host: HTMLElement): void {
  app.listen(host.querySelector("[data-charge-help]"), "click", () => app.openEncyclopedia("charge"));
}
export function renderEncyclopedia(app: App, content: HTMLElement): void {
  const entries = availableEntries(app.state);
  const entry = entries.find(item => item.id === app.encyclopediaEntry);
  content.innerHTML = `<div class="modal-top"><span id="modal-title" class="eyebrow">Encyclopedia</span><button id="close-modal" aria-label="Close Encyclopedia">Close <kbd>Esc</kbd></button></div>
    ${entry ? `<button id="encyclopedia-back">‹ Topics</button><article class="encyclopedia-entry"><h2>${entry.title}</h2>${entry.content}<nav aria-label="Related entries">${entry.related.filter(id => entries.some(e => e.id === id)).map(id => `<button data-entry="${id}">${entries.find(e => e.id === id)!.title}</button>`).join("")}</nav></article>` : `<label class="encyclopedia-search">Search titles and keywords<input id="encyclopedia-search" type="search" autocomplete="off"></label><div id="encyclopedia-results"></div>`}`;
  const navigation = content.querySelector<HTMLElement>("#encyclopedia-results, .encyclopedia-entry")!;
  app.listen(navigation, "click", event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-entry]") : null;
    if (button && navigation.contains(button)) app.openEncyclopedia(button.dataset.entry as EntryId);
  });
  const results = content.querySelector<HTMLElement>("#encyclopedia-results");
  const search = content.querySelector<HTMLInputElement>("#encyclopedia-search");
  if (results && search) {
    const update = () => {
      const matches = availableEntries(app.state, app.encyclopediaQuery);
      results.innerHTML = [...new Set(matches.map(item => item.group))].map(group => `<section><h2>${group}</h2>${matches.filter(item => item.group === group).map(item => `<button class="encyclopedia-row" data-entry="${item.id}">${item.title}${app.state.encyclopedia[item.id] === "available" ? " · Unseen" : ""}</button>`).join("")}</section>`).join("") || `<p>${entries.length ? "No matching entries" : "No entries available yet. Explore the board and Catalog; explanations appear as mechanics become relevant."}</p>`;
    };
    search.value = app.encyclopediaQuery;
    update();
    app.listen(search, "input", () => { app.encyclopediaQuery = search.value; update(); });
  }
  app.listen(content.querySelector("#encyclopedia-back"), "click", () => app.openEncyclopedia());
  app.listen(content.querySelector("#close-modal"), "click", () => app.closeModal());
}
