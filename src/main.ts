import { App } from "./ui/app";

const els: Record<string, HTMLElement> = {};
for (const id of [
  "console-session",
  "console-apps",
  "board-tools",
  "thumb-bar",
  "grid",
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

app.listen(document.getElementById("modal"), "click", (event) => {
  if (event.target === event.currentTarget) app.closeModal();
});
