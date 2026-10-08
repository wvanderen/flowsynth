// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSession } from "../engine/actions";
import { STORAGE_KEY } from "../engine/save";
import { give } from "../engine/fixtures";
import { createAppFixture } from "./testing/app-fixture";
import { browserChannels } from "./signals";
import { wireTooltips } from "./instrument";

const fixture = createAppFixture();
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { fixture.release(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function pointer(type: string, x = 0, y = 0): PointerEvent {
  return new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y });
}

describe("App lifetime", () => {
  it("release removes global activity and does not save, even when called twice", () => {
    const app = fixture.boot();
    app.state.sessionsCompleted = 1;
    startSession(app.state, null);
    const before = localStorage.getItem(STORAGE_KEY);
    const tick = vi.spyOn(app, "tick");
    vi.advanceTimersByTime(100);
    expect(tick).toHaveBeenCalledTimes(1);
    const render = vi.spyOn(app, "render");
    const save = vi.spyOn(app, "save");
    app.dispose();
    app.dispose();
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("beforeunload"));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(render).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(app.released).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("release cancels mode feedback and removes locked-symbol disclosure", () => {
    const app = fixture.boot();
    const tip = document.querySelector<HTMLButtonElement>("#layer-legend .inst-tip-trigger")!;
    tip.click();
    const body = document.getElementById(tip.getAttribute("aria-describedby")!)!;
    expect(body.parentElement).toBe(document.body);
    app.dispose();
    expect(body.isConnected).toBe(false);
    const current = fixture.boot();
    current.state.catalogEntryOwned = true;
    current.ui.buyingCell = true;
    current.mutSetLayer("mutators");
    const toast = document.getElementById("mode-toast")!;
    expect(toast.hidden).toBe(false);
    current.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(6000);
    expect(toast.hidden).toBe(false);
  });

  it("the fixture releases every boot, including instances replaced in the DOM", () => {
    const first = fixture.boot();
    const second = fixture.boot();
    fixture.release();
    expect(first.released).toBe(true);
    expect(second.released).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const next = fixture.boot();
    const tick = vi.spyOn(next, "tick");
    vi.advanceTimersByTime(100);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("a replaced instrument stays available for assertions but does not handle browser activity", () => {
    const old = fixture.boot();
    old.state.sessionsCompleted = 1;
    startSession(old.state, null);
    const current = fixture.boot();
    const oldTick = vi.spyOn(old, "tick");
    const oldSave = vi.spyOn(old, "save");
    const currentTick = vi.spyOn(current, "tick");
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("beforeunload"));
    vi.advanceTimersByTime(100);
    expect(old.released).toBe(false);
    expect(oldTick).not.toHaveBeenCalled();
    expect(oldSave).not.toHaveBeenCalled();
    expect(currentTick).toHaveBeenCalled();
  });

  it("cancels a carried module without dropping or swallowing the next instrument's click", () => {
    const app = fixture.boot();
    const module = app.state.modules.find((m) => m.pos !== null)!;
    const pos = { ...module.pos! };
    const node = document.querySelector(`[data-cell="${pos.q},${pos.r}"]`)!;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => node });
    node.dispatchEvent(pointer("pointerdown"));
    document.dispatchEvent(pointer("pointermove", 20, 20));
    expect(document.querySelector(".drag-ghost")).not.toBeNull();
    app.dispose();
    expect(document.querySelector(".drag-ghost")).toBeNull();
    const render = vi.spyOn(app, "render");
    document.dispatchEvent(pointer("pointerup", 20, 20));
    expect(module.pos).toEqual(pos);
    expect(render).not.toHaveBeenCalled();
    const next = fixture.boot();
    document.getElementById("console-settings")!.click();
    expect(next.ui.modal).toBe("settings");
  });

  it("cancels an armed placement without committing on a later pointer release", () => {
    const app = fixture.boot();
    const item = give(app.state, "additive", null);
    app.beginPlacing(item.id);
    const node = document.querySelector('[data-cell="1,0"]')!;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => node });
    node.dispatchEvent(pointer("pointerdown"));
    document.dispatchEvent(pointer("pointermove", 20, 20));
    expect(app.ui.dropHover).not.toBeNull();
    app.dispose();
    const render = vi.spyOn(app, "render");
    document.dispatchEvent(pointer("pointerup", 20, 20));
    expect(item.pos).toBeNull();
    expect(render).not.toHaveBeenCalled();
  });

  it("cancels board panning without repainting on a later pointer release", () => {
    const app = fixture.boot();
    app.ui.zoom = 2;
    app.render();
    const svg = document.getElementById("grid")!;
    Object.defineProperties(svg, { clientWidth: { value: 600 }, clientHeight: { value: 400 } });
    svg.dispatchEvent(pointer("pointerdown"));
    document.dispatchEvent(pointer("pointermove", 20, 20));
    expect(app.ui.pan).not.toBeNull();
    const pan = { ...app.ui.pan! };
    app.dispose();
    const render = vi.spyOn(app, "render");
    document.dispatchEvent(pointer("pointermove", 40, 40));
    document.dispatchEvent(pointer("pointerup", 40, 40));
    expect(app.ui.pan).toEqual(pan);
    expect(render).not.toHaveBeenCalled();
  });

  it("cancels a carried mutator without committing its later release", () => {
    const app = fixture.boot();
    app.state.catalogEntryOwned = true;
    app.state.mutatorSlots = [{ q: 0, r: 0 }];
    const item = { id: "owned-mutator", family: "power" as const, rarity: "common" as const, pos: { q: 0, r: 0 } };
    app.state.mutators = [item];
    app.ui.mutLayer = "mutators";
    app.render();
    const node = document.querySelector('[data-mut-slot="0,0"]')!;
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => node });
    node.dispatchEvent(pointer("pointerdown"));
    document.dispatchEvent(pointer("pointermove", 20, 20));
    expect(document.querySelector(".mut-ghost")).not.toBeNull();
    app.dispose();
    expect(document.querySelector(".mut-ghost")).toBeNull();
    expect(app.cancelMutDrag).toBeNull();
    document.dispatchEvent(pointer("pointerup", 20, 20));
    expect(item.pos).toEqual({ q: 0, r: 0 });
  });

  it("ignores file reads that complete after release", async () => {
    const app = fixture.boot();
    app.openModal("import");
    const input = document.getElementById("import-file")!;
    const textarea = document.getElementById("import-text") as HTMLTextAreaElement;
    let resolve!: (text: string) => void;
    const text = new Promise<string>((done) => { resolve = done; });
    Object.defineProperty(input, "files", { value: [{ text: () => text }] });
    input.dispatchEvent(new Event("change"));
    app.dispose();
    resolve("late save");
    await text;
    expect(textarea.value).toBe("");
  });

  it("release cancels a pending release-click suppressor", () => {
    const app = fixture.boot();
    app.suppressClick();
    app.dispose();
    const next = fixture.boot();
    document.getElementById("console-settings")!.click();
    expect(next.ui.modal).toBe("settings");
    expect(vi.getTimerCount()).toBe(1); // only the next App's recurring timer
  });

  it("removes handlers from surviving rendered nodes", () => {
    const app = fixture.boot();
    const button = document.getElementById("flow-switch")!;
    app.dispose();
    button.click();
    expect(app.ui.modal).toBeNull();
    expect(app.state.mode).toBe("upgrade");
  });

  it("released Apps cannot start sessions or reacquire browser audio", () => {
    const created = vi.fn();
    class Audio {
      state = "running";
      close = vi.fn(async () => {});
      constructor() { created(); }
    }
    vi.stubGlobal("AudioContext", Audio);
    const app = fixture.boot();
    app.dispose();
    app.startFlow();
    expect(app.ui.modal).toBeNull();
    app.beginFlow(null);
    app.dispose();
    expect(app.state.mode).toBe("upgrade");
    expect(app.audio).toBeNull();
    expect(created).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("closes browser-owned audio once and leaves borrowed audio alone", () => {
    const close = vi.fn(async () => {});
    class Audio {
      state = "running";
      close = close;
    }
    vi.stubGlobal("AudioContext", Audio);
    const browser = fixture.boot();
    browser.beginFlow(null);
    expect(browser.audio).toBeInstanceOf(Audio);
    browser.dispose();
    browser.dispose();
    expect(close).toHaveBeenCalledTimes(1);
    localStorage.clear();
    const borrowed = new Audio() as unknown as AudioContext;
    const app = fixture.boot({ ...browserChannels, unlockAudio: () => borrowed });
    app.beginFlow(null);
    app.dispose();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("terminates a stress worker and ignores messages delivered after release", () => {
    class WorkerStub {
      static latest: WorkerStub;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = vi.fn();
      postMessage = vi.fn();
      constructor() { WorkerStub.latest = this; }
    }
    vi.stubGlobal("Worker", WorkerStub);
    const app = fixture.boot(undefined, true);
    app.devToggleBoard();
    app.devBoardStress();
    const worker = WorkerStub.latest;
    app.dispose();
    const render = vi.spyOn(app, "render");
    worker.onmessage?.({ data: { error: "late" } } as MessageEvent);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(render).not.toHaveBeenCalled();
  });

  it("releases tooltip document listeners and the body's exact portal", () => {
    const owner = new AbortController();
    const host = document.createElement("div");
    host.innerHTML = '<span class="inst-tip"><button class="inst-tip-trigger" aria-describedby="owned-tip">info</button><span class="inst-tip-body" id="owned-tip">details</span></span>';
    document.body.append(host);
    wireTooltips(host, owner.signal);
    const trigger = host.querySelector<HTMLButtonElement>("button")!;
    trigger.click();
    expect(document.querySelector("#owned-tip")?.parentElement).toBe(document.body);
    owner.abort();
    expect(document.querySelector("#owned-tip")).toBeNull();
    const close = vi.fn();
    host.addEventListener("keydown", close);
    host.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
