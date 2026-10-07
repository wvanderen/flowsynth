// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createAppFixture } from "./testing/app-fixture";
import { STORAGE_KEY, serialize } from "../engine/save";
import { startSession } from "../engine/actions";

// Real browser-event coverage for the shared save slot. Every instance
// belongs to the fixture and is released after its scenario.
const fixture = createAppFixture();
const boot = fixture.boot;

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

afterEach(() => fixture.release());

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
