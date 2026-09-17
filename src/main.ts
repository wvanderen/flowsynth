import { App } from "./ui/app";

const els: Record<string, HTMLElement> = {};
for (const id of [
  "console-session",
  "console-apps",
  "console-status",
  "nous-balance",
  "board-tools",
  "grid",
  "status-monitor",
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
    app.cancelPlacing();
  } else if (app.ui.buyingCell) {
    app.cancelCellPurchase();
  } else if (app.managing) {
    app.stopManaging();
  } else if (app.ui.app) {
    app.closeApp();
  } else if (app.ui.selected) {
    app.ui.selected = null;
    app.render();
  }
});
