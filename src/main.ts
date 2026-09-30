import { App } from "./ui/app";
import { prototypeWanted, seedDenseBoard } from "./ui/prototype/dense";

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
// PROTOTYPE (ticket #174, throwaway branch): seed the dense playtest board.
if (prototypeWanted()) seedDenseBoard(app);
if (dev) {
  (window as unknown as Record<string, unknown>).__flowsynth = app;
}

document.getElementById("modal")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) app.closeModal();
});
