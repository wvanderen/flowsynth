// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAppFixture, clickCell } from "./testing/app-fixture";
import type { App } from "./app";
import { SHORTCUTS } from "./shortcuts";

const fixture = createAppFixture();
let app: App;
const press = (options: KeyboardEventInit = {}) => document.dispatchEvent(new KeyboardEvent("keydown", { key: "l", bubbles: true, ...options }));
beforeEach(() => { localStorage.clear(); app = fixture.boot(); });
afterEach(() => fixture.release());

describe("layer navigation and discovery (#539)", () => {
  it("gates the shortcut before World discovery and cycles board and detail after discovery", () => {
    press();
    expect(app.ui.boardLayer).toBe("modules");
    app.state.world.unlocked = true;
    app.render();
    press();
    expect(app.ui.boardLayer).toBe("world");
    press();
    expect(app.ui.boardLayer).toBe("modules");
    clickCell(0, 0);
    press();
    expect(app.ui.detail?.face).toBe("world");
    expect(document.querySelectorAll("#hex-detail .hex-detail-layer")).toHaveLength(1);
    expect(document.getElementById("layer-legend")!.hidden).toBe(true);
    press();
    expect(app.ui.detail?.face).toBe("modules");
  });
  it("does not change layers under Settings and renders every shared binding there", () => {
    app.state.world.unlocked = true;
    app.openModal("settings");
    press();
    expect(app.ui.boardLayer).toBe("modules");
    const reference = document.querySelector('[aria-labelledby="settings-shortcuts-title"]')!;
    for (const shortcut of Object.values(SHORTCUTS)) {
      expect(reference.textContent).toContain(shortcut.label);
      expect(reference.textContent).toContain(shortcut.description);
    }
  });
  it("navigates directly from miniature cells with click and keyboard without opening a dialog", () => {
    clickCell(0, 0);
    const cell = document.querySelector<SVGElement>('#hex-detail [data-ctx-cell]')!;
    expect(cell).not.toBeNull();
    const [q, r] = cell.dataset.ctxCell!.split(",").map(Number);
    cell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(app.ui.detail?.pos).toEqual({ q, r });
    expect(document.querySelector(".context-overview")).toBeNull();
    const next = document.querySelector<SVGElement>('#hex-detail [data-ctx-cell]')!;
    const [nq, nr] = next.dataset.ctxCell!.split(",").map(Number);
    next.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.detail?.pos).toEqual({ q: nq, r: nr });
    expect(document.querySelector("#hex-detail .map-zoom")).toBeNull();
    expect(document.querySelector("#hex-detail .context-destinations")).toBeNull();
  });
});
