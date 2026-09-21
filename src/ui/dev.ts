// The dev panel (?dev=1): time-warp and fixture buttons for hands-on
// verification only — never part of the player-facing surface.
import { byId } from "./dom";
import type { RenderContext } from "./context";

export function renderDev(ctx: RenderContext): void {
  let panel = byId("dev-panel");
  if (!ctx.dev) {
    panel?.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement("div");
    panel.className = "dev-panel";
    panel.id = "dev-panel";
    document.body.append(panel);
  }
  panel.innerHTML = `<span>DEV</span>
    <button data-dev="60">+1m</button>
    <button data-dev="600">+10m</button>
    <button data-dev="target">→ target</button>
    <button data-dev="nous">+100ν</button>`;
  panel.querySelectorAll<HTMLButtonElement>("[data-dev]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-dev")!;
      if (key === "target") ctx.intents.devToTarget();
      else if (key === "nous") ctx.intents.devNous();
      else ctx.intents.devAdvance(Number(key));
    });
  });
}
