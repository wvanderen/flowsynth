// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAppFixture } from "./testing/app-fixture";
import { previewSave, previewState, silentChannels } from "./workbench/fixtures";
import { serialize, STORAGE_KEY } from "../engine/save";
import { createInitialState } from "../engine/state";

const fixture = createAppFixture();
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { fixture.release(); vi.useRealTimers(); });

it("interactive workbench sessions never read, adopt, or overwrite the player's save", () => {
  const player = createInitialState();
  player.nous = 987654;
  const original = serialize(player, Date.now());
  localStorage.setItem(STORAGE_KEY, original);
  const app = fixture.boot(silentChannels, false, previewSave());
  expect(app.state.nous).not.toBe(player.nous);
  app.state = previewState("flow");
  app.render();
  vi.advanceTimersByTime(6000);
  app.save(Date.now(), true);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(original);

  const updated = serialize({ ...player, nous: 123456 }, Date.now() + 10000);
  localStorage.setItem(STORAGE_KEY, updated);
  app.state.mode = "upgrade";
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: updated }));
  expect(app.state.nous).not.toBe(123456);
  window.dispatchEvent(new Event("beforeunload"));
  expect(localStorage.getItem(STORAGE_KEY)).toBe(updated);
  app.dispose();
  const freshPreview = fixture.boot(silentChannels, false, previewSave());
  expect(freshPreview.state.nous).toBe(createInitialState().nous);
});

it("live and paused fixtures render charge through the real production state", () => {
  const app = fixture.boot(silentChannels, false, previewSave());
  app.state = previewState("flow");
  app.render();
  expect(document.querySelectorAll(".charge-line").length).toBeGreaterThan(0);
  expect(document.querySelectorAll(".hex.charged").length).toBeGreaterThan(0);
  expect(document.querySelector(".hex-glow")).toBeNull();
  app.state = previewState("paused");
  app.render();
  expect(app.state.mode).toBe("paused");
  expect(document.querySelectorAll(".charge-line")).toHaveLength(0);
});
