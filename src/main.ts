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
