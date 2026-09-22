// The dispatcher: one render pass over the regions, in order, against a
// single RenderContext — the per-pass memo means every region reads the
// same projected-rate and flow-snapshot derivations, computed at most once.
// The regions (console, panels, inspector, grid, modals, monitor, dev) each
// own their markup, their keyed rebuild, and their live pass; every write
// crosses back through the UiIntents App implements.
import type { App } from "./app";
import { contextFor } from "./context";
import { renderConsoleApps, renderConsoleReadout, renderConsoleSession, renderTools, renderWelcome } from "./console";
import { renderGrid, renderManageView } from "./grid";
import { renderInspector } from "./inspector";
import { renderStatusMonitor } from "./monitor";
import { renderModals } from "./modals";
import { renderDev } from "./dev";

export function render(app: App): void {
  const ctx = contextFor(app);
  renderConsoleSession(ctx);
  renderConsoleApps(ctx);
  renderConsoleReadout(ctx);
  renderTools(ctx);
  renderGrid(ctx);
  renderStatusMonitor(ctx);
  // The arrange-mode manage view renders into the inspector's rail, but its
  // drag wiring belongs to the grid — the dispatcher owns the composition.
  renderInspector(ctx, (host) => renderManageView(ctx, host));
  renderWelcome(ctx);
  renderModals(ctx);
  renderDev(ctx);
}
