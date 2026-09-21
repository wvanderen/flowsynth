// The planned-target affordances (§6): preset chips, free 1–90 minute
// entry, and the open-ended toggle — shared by the enter modal and the Time
// app's popover. Writes go through the planTarget intent; the chosen target
// itself is cross-surface state (the console's clock previews it between
// sessions), so it lives on UiState.
import { PLAN_MAX_MINUTES, PLAN_MIN_MINUTES, PLAN_PRESET_MINUTES } from "./meta";
import type { RenderContext } from "./context";

export function planControlsHtml(ctx: RenderContext): string {
  const open = ctx.ui.chosenTarget === null;
  const chosen = ctx.ui.chosenTarget;
  const minutes = chosen === null ? null : Math.round(chosen / 60);
  return `<div class="time-plan">
    <div class="plan-chips" role="group" aria-label="Planned session length in minutes">
      ${PLAN_PRESET_MINUTES.map(
        (option) =>
          `<button class="plan-chip${minutes === option ? " active" : ""}" data-plan="${option}" aria-pressed="${minutes === option}">${option}</button>`,
      ).join("")}
    </div>
    <div class="plan-free">
      <input type="number" id="plan-minutes" min="${PLAN_MIN_MINUTES}" max="${PLAN_MAX_MINUTES}" step="1" placeholder="1–90"
        value="${minutes ?? ""}" ${open ? "disabled" : ""} aria-label="Custom session length, 1 to 90 minutes" />
      <span class="plan-unit">min</span>
    </div>
    <button id="plan-open" class="plan-open${open ? " active" : ""}" aria-pressed="${open}">Open-ended</button>
    <p class="clock-caption">${open ? "Open-ended" : "Planned practice"}</p>
  </div>`;
}

// The plan affordances' binding within any scope (the Time popover or the
// enter modal): chips pick a preset, the free entry takes any whole minute
// from 1 to 90 (clamped, one-minute steps), and open-ended is its own mode
// toggle.
export function bindPlanControls(ctx: RenderContext, scope: HTMLElement): void {
  scope.querySelectorAll<HTMLButtonElement>("[data-plan]").forEach((chip) => {
    chip.addEventListener("click", () => {
      ctx.intents.planTarget(Number(chip.getAttribute("data-plan")) * 60);
    });
  });
  const planInput = scope.querySelector("#plan-minutes") as HTMLInputElement | null;
  planInput?.addEventListener("change", () => {
    const minutes = Math.round(Number(planInput.value));
    if (Number.isFinite(minutes) && planInput.value !== "") {
      ctx.intents.planTarget(Math.min(PLAN_MAX_MINUTES, Math.max(PLAN_MIN_MINUTES, minutes)) * 60);
    }
  });
  scope.querySelector("#plan-open")?.addEventListener("click", () => {
    ctx.intents.planTarget(null);
  });
}
