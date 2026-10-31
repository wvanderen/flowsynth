// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { startSession } from "../engine/actions";
import { ORIGINAL_SAVE_KEY, STORAGE_KEY, serialize } from "../engine/save";
import { createInitialState } from "../engine/state";
import { SharedSave, memorySaveStorage } from "./shared-save";
import { createAppFixture } from "./testing/app-fixture";

// The failure path's copy (issue #486): an unsuccessful save or import
// exposes the failure plainly, never claims a recovery that did not
// happen, and leaves the last valid save and the retained source bytes
// untouched.

const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot(undefined, false, new SharedSave(memorySaveStorage()));
});
afterEach(() => fixture.release());

const SAVE_FAILED = "Saving failed — your last valid save stands untouched.";

function statusText(): string {
  return document.getElementById("status")?.textContent ?? "";
}

describe("the save failure path (issue #486)", () => {
  it("a refused write says so, and never claims a recovery", () => {
    app.state.nous = Infinity; // serialize refuses: JSON would write null
    app.save();
    expect(statusText()).toBe(SAVE_FAILED);
    // The line stands while writes keep failing.
    app.save();
    expect(statusText()).toBe(SAVE_FAILED);
  });

  it("a landing write ends the failure streak, and a later failure says again", () => {
    app.state.nous = Infinity;
    app.save();
    expect(statusText()).toBe(SAVE_FAILED);
    app.state.nous = 12;
    app.save();
    app.say("checkpoint");
    expect(statusText()).toBe("checkpoint");
    // The flag re-armed: a second refusal is announced again, not swallowed.
    app.state.nous = Infinity;
    app.save();
    expect(statusText()).toBe(SAVE_FAILED);
  });

  it("an economy update that refuses names the refusal through the live region", () => {
    const owner = boot(undefined, true, new SharedSave(memorySaveStorage()));
    startSession(owner.state, null);
    owner.state.modules[0]!.level = 5000; // 1.2^5000 leaves the double range
    const result = owner.devAdvance(60);
    expect(result.fault).toBeTruthy();
    expect(statusText()).toBe("The board's figures outran the instrument's range — the refused update left nothing behind.");
  });
});

describe("the export refusal (issue #486)", () => {
  it("an unrepresentable state refuses the export without offering a file", () => {
    app.state.nous = Infinity;
    app.openModal("export");
    const content = document.getElementById("modal-content")!;
    expect(content.textContent).toContain("These figures exceed what a save can hold — nothing was exported.");
    expect(document.getElementById("export-text")).toBeNull();
    expect(document.getElementById("export-download")).toBeNull();
  });

  it("a representable state exports as before", () => {
    app.openModal("export");
    expect(document.getElementById("export-text")).not.toBeNull();
    expect(document.getElementById("export-download")).not.toBeNull();
  });
});

describe("the import path's retained bytes (issue #486)", () => {
  it("an applied import retains its source bytes", () => {
    const source = serialize({ ...createInitialState(), nous: 9 }, 750);
    const owner = boot(undefined, false, new SharedSave(localStorage));
    expect(owner.importText(source)).toBe(true);
    expect(localStorage.getItem(ORIGINAL_SAVE_KEY)).toBe(source);
  });

  it("a refused import replaces neither the stored save nor its retained original", () => {
    const stored = serialize(createInitialState(), 500);
    localStorage.setItem(STORAGE_KEY, stored);
    const owner = boot();
    const mainAfterBoot = localStorage.getItem(STORAGE_KEY);
    expect(localStorage.getItem(ORIGINAL_SAVE_KEY)).toBe(stored);
    expect(owner.importText("{not a save")).toBe(false);
    expect(owner.ui.importError).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(mainAfterBoot);
    expect(localStorage.getItem(ORIGINAL_SAVE_KEY)).toBe(stored);
  });
});
