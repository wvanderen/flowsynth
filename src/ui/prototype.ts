// PROTOTYPE (issue #119) — throwaway. The floating switcher bar (variant
// cycle, half-width preview, demo board) and the demo board installer.
// Lives outside #app so container queries and the console layout never see
// it. Nothing here ships.
import { ACHIEVEMENTS } from "../engine/achievements";
import { fresh, give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { forgeThreshold } from "../engine/rolls";
import { STORAGE_KEY } from "../engine/save";
import type { GameState } from "../engine/types";
import type { App } from "./app";

const VARIANTS: { key: string; label: string }[] = [
  { key: "", label: "Current console" },
  { key: "a", label: "A · Ledger console" },
  { key: "b", label: "B · Production footer" },
  { key: "c", label: "C · Board ledger + dock" },
  { key: "d", label: "D · Header ledger + floating horizon" },
];

function currentKey(): string {
  return document.body.dataset.variant ?? "";
}

// Variants rebuild the chrome, so switching reloads the page; the param
// keeps the choice shareable and reload-stable.
function switchTo(key: string): void {
  const url = new URL(location.href);
  if (key) url.searchParams.set("variant", key);
  else url.searchParams.delete("variant");
  location.href = url.toString();
}

function cycle(dir: -1 | 1): void {
  const at = VARIANTS.findIndex((v) => v.key === currentKey());
  const next = VARIANTS[(at + dir + VARIANTS.length) % VARIANTS.length];
  if (next) switchTo(next.key);
}

export function initPrototypeSwitcher(app: App): void {
  const bar = document.createElement("div");
  bar.className = "prototype-bar";
  bar.innerHTML = `
    <button class="prototype-arrow" data-dir="-1" aria-label="Previous variant">←</button>
    <span class="prototype-label mono"></span>
    <button class="prototype-arrow" data-dir="1" aria-label="Next variant">→</button>
    <span class="prototype-sep" aria-hidden="true"></span>
    <button class="prototype-extra" id="prototype-demo">Demo board</button>
    <button class="prototype-extra" id="prototype-half">Half width</button>`;
  document.body.appendChild(bar);
  const label = bar.querySelector<HTMLElement>(".prototype-label");
  const halfButton = bar.querySelector<HTMLElement>("#prototype-half");
  const sync = () => {
    const current = VARIANTS.find((v) => v.key === currentKey());
    if (label) label.textContent = current?.label ?? currentKey();
    halfButton?.classList.toggle("on", document.body.classList.contains("half-preview"));
  };
  sync();
  bar.querySelectorAll<HTMLButtonElement>(".prototype-arrow").forEach((button) => {
    button.addEventListener("click", () => cycle(button.dataset.dir === "-1" ? -1 : 1));
  });
  halfButton?.addEventListener("click", () => {
    document.body.classList.toggle("half-preview");
    const url = new URL(location.href);
    if (document.body.classList.contains("half-preview")) url.searchParams.set("half", "1");
    else url.searchParams.delete("half");
    history.replaceState(null, "", url);
    sync();
  });
  let demoInstalled = false;
  bar.querySelector("#prototype-demo")?.addEventListener("click", () => {
    if (demoInstalled) return;
    installDemoBoard(app);
    demoInstalled = true;
    const demoButton = bar.querySelector<HTMLElement>("#prototype-demo");
    if (demoButton) demoButton.textContent = "Demo installed";
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    cycle(event.key === "ArrowLeft" ? -1 : 1);
  });
}

// A populated mid-opening board — one octave chord forming, generator
// charging, infusor uplifting, Forge part-charged, two feats unlocked — so
// the variants read against real density. Memory-only: the real save is
// never touched.
export function installDemoBoard(app: App): void {
  app.state = demoState();
  app.ui.chosenTarget = 25 * 60;
  app.save = () => {};
  // Belt and braces: even a writer that captured a bound save reference
  // before this point can't reach the real save — the boundary itself is
  // closed for the session's key.
  const setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key: string, value: string) => (key === STORAGE_KEY ? undefined : setItem(key, value));
  app.render();
}

function demoState(): GameState {
  const s = fresh();
  s.welcomeAcked = true;
  s.notificationAsked = true;
  s.purchased = { additive: true, generator: true, infusor: true, forge: true };
  s.nous = 2400;
  s.totalEarned = 8600;
  s.cells.push(hex(-1, 0), hex(-1, 1), hex(1, -1));
  s.cellsBought = 3;
  give(s, "additive", hex(1, 0), 3);
  give(s, "conditional", hex(0, 1), 2);
  give(s, "focusKeyed", hex(-1, 1), 2);
  give(s, "forge", hex(-1, 0), 1);
  give(s, "infusor", hex(1, -1), 2);
  s.forge = { progress: Math.round(forgeThreshold(20) * 0.45), earned: 20 };
  s.chargeWindow = 240;
  const now = Date.now();
  s.achievements[ACHIEVEMENTS[0].id] = now;
  s.achievements[ACHIEVEMENTS[1].id] = now;
  s.habits = [{ id: "h1", name: "Piano", seconds: 4260, archived: false }];
  s.activeHabitId = "h1";
  s.sessionsCompleted = 6;
  return s;
}
