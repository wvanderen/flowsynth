import { describe, expect, it } from "vitest";
import { endSession, startSession } from "./actions";
import { appActive, appLockNote, FOCUS_APPS } from "./apps";
import { fresh } from "./fixtures";

describe("app activation (ADR-0012 §2.3)", () => {
  it("keeps Habit free and always on", () => {
    const s = fresh();
    expect(appActive(s, "habit")).toBe(true);
    expect(appLockNote(s, "habit")).toBeNull();
  });

  it("auto-activates Time after the first session", () => {
    const s = fresh();
    expect(appActive(s, "time")).toBe(false);
    expect(appLockNote(s, "time")).toBe("after your first session");

    startSession(s, null);
    expect(appActive(s, "time")).toBe(false);
    endSession(s, Date.now());
    expect(appActive(s, "time")).toBe(true);
    expect(appLockNote(s, "time")).toBeNull();
  });

  it("holds Notes and Goals locked until the activation ladder flips them", () => {
    const s = fresh();
    for (const app of ["notes", "goals"] as const) {
      expect(appActive(s, app)).toBe(false);
      expect(appLockNote(s, app)).toBe("activate with nous");
    }
  });

  it("exposes the launch app inventory in tile order", () => {
    expect(FOCUS_APPS).toEqual(["habit", "time", "notes", "goals"]);
  });
});
