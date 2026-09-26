import { App } from "./ui/app";
import { initPrototypeSwitcher } from "./ui/prototype";

// PROTOTYPE (issue #119): the console-hierarchy variants ride ?variant=a|b|c;
// ?half restores the half-width preview. Absent params, the app is untouched.
const params = new URLSearchParams(location.search);
const variant = params.get("variant");
if (variant === "a" || variant === "b" || variant === "c") {
  document.body.dataset.variant = variant;
}
if (params.has("half")) {
  document.body.classList.add("half-preview");
}

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

const dev = params.has("dev");
const app = new App(els, dev);
// The switcher bar (and its arrow-key cycling, demo board) only exists when
// the prototype is opted into; absent variant/half params nothing installs.
if (variant !== null || params.has("half")) initPrototypeSwitcher(app);
if (dev) {
  (window as unknown as Record<string, unknown>).__flowsynth = app;
}

document.getElementById("modal")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) app.closeModal();
});
