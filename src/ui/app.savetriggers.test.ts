// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "./app";
import { STORAGE_KEY, serialize } from "../engine/save";
import { startSession } from "../engine/actions";

// Issue #128's positive trigger coverage: each of the three save triggers
// writes through when the tab holds the newest state. These tests live in
// their own file because they dispatch real window events, which reach
// every App instance still bound to the window; a file that never forges
// the suite's future-stamped test saves (Date.now() + 60_000) keeps every
// earlier tab's guard knowledge in the real past, so the tab under test —
// the slot's latest writer — is the only one whose save can land.

function boot(): App {
  const html = readFileSync("index.html", "utf8");
  const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  document.body.innerHTML = body;
  const els: Record<string, HTMLElement> = {};
  for (const id of ["console-session", "console-apps", "board-tools", "thumb-bar", "grid", "status", "modal", "modal-content"]) {
    const element = document.getElementById(id);
    if (element) els[id] = element;
  }
  return new App(els, false, undefined);
}

// happy-dom exposes visibilityState as a prototype getter; an own
// property override flips it per test (restored after each).
function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
}

let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(async () => {
  setVisibility("visible");
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const storedNous = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.nous as number;

// The slot is set back by one minute, then the tab's own write re-arms it:
// from here the tab holds the newest state, and each trigger's save must
// land — the single-tab case the guard exists to leave unchanged (#128).
function armNewestTab(nous: number): void {
  localStorage.setItem(STORAGE_KEY, serialize({ ...app.state, nous: 1 }, Date.now() - 60_000));
  app.save();
  app.state.nous = nous;
}

describe("cross-tab save triggers write through (#128)", () => {
  it("the hidden-transition save lands when this tab holds the newest state", () => {
    armNewestTab(999);
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(storedNous()).toBe(999);
  });

  it("the boundary throttle's save lands when this tab holds the newest state", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.tick();
    armNewestTab(999);
    // A real 10 s boundary gap guarantees applyGap runs and the throttle
    // fires, whatever the runner's clock resolution.
    app.lastWall = Date.now() - 10_000;
    app.lastSaveWall = 0;
    app.tick();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).savedAt).toBeGreaterThan(Date.now() - 60_000);
    expect(storedNous()).not.toBe(1);
  });

  it("the unload save lands when this tab holds the newest state", () => {
    armNewestTab(999);
    window.dispatchEvent(new Event("beforeunload"));
    expect(storedNous()).toBe(999);
  });
});
