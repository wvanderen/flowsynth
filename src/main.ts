import { App } from "./ui/app";

const els: Record<string, HTMLElement> = {};
for (const id of [
  "session-toolbar",
  "accounting",
  "board-tools",
  "grid",
  "rate-formula",
  "inspector",
  "status",
  "modal",
  "modal-content",
]) {
  const element = document.getElementById(id);
  if (element) els[id] = element;
}

const dev = new URLSearchParams(location.search).has("dev");
const app = new App(els, dev);
if (dev) {
  (window as unknown as Record<string, unknown>).__flowsynth = app;
}

document.getElementById("modal")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) app.closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (app.ui.modal) {
    app.closeModal();
    return;
  }
  if (app.ui.placing) {
    app.ui.placing = null;
    app.render();
  } else if (app.ui.selected) {
    app.ui.selected = null;
    app.render();
  }
});
