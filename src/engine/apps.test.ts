import { describe, expect, it } from "vitest";
import { FOCUS_APPS, TILE_APPS } from "./apps";

describe("the free opening (ADR-0019, issue #83)", () => {
  it("exposes the launch app inventory in FOCUS_APPS order", () => {
    expect(FOCUS_APPS).toEqual(["habit", "time", "notes", "goals"]);
  });

  it("Notes alone wears a door tile (#313); Time never wore one (#148)", () => {
    // Capture is a distinct action, so Notes keeps its door. The clock block
    // is the Focus sheet's one wide entry and the focus door its phone
    // entry, so Habit and Goals wear no tile — their faces live inside the
    // sheet. Time's affordance is the console clock itself.
    expect(TILE_APPS).toEqual(["notes"]);
  });
});
