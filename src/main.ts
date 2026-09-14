import { App } from "./ui/app";

const prototypeRequested = new URLSearchParams(location.search).get("prototype") === "console";
if ((import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV && prototypeRequested) {
  void import("./ui/console-prototype").then(({ mountConsolePrototype }) => mountConsolePrototype());
} else {
  mountApp();
}

function mountApp() {
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
    app.cancelPlacing();
  } else if (app.managing) {
    app.stopManaging();
  } else if (app.ui.selected) {
    app.ui.selected = null;
    app.render();
  }
});
}
