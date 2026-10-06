import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../engine/achievements";
import type { ModuleType } from "../engine/types";
import type { FocusApp } from "../engine/apps";
import { appIcon, moduleIcon } from "./icons";

// The feat marks share the instrument's line language with the modules and
// the focus apps; the language is shared vocabulary, the glyphs are not —
// no feat mark reuses another surface's path (issue #269).
const MODULE_TYPES: readonly ModuleType[] = [
  "additive",
  "harmonizer",
  "echo",
  "bend",
  "amplifier",
  "ritual",
  "blaster",
  "spacer",
  "focusKeyed",
  "noteKeyed",
  "goalKeyed",
  "infusor",
  "forge",
  "mutatorForge",
];

const APPS: readonly FocusApp[] = ["habit", "time", "goals", "notes"];

describe("the feat marks' place in the glyph language", () => {
  it("no feat mark reuses a module's or a focus app's glyph (issue #269)", () => {
    for (const def of ACHIEVEMENTS) {
      for (const type of MODULE_TYPES) {
        expect(def.icon.includes(moduleIcon(type)), `${def.id} reuses the ${type} glyph`).toBe(false);
      }
      for (const app of APPS) {
        expect(def.icon.includes(appIcon(app)), `${def.id} reuses the ${app} glyph`).toBe(false);
      }
    }
  });
});
