// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { isLayerShortcut, SHORTCUTS } from "./shortcuts";

describe("layer shortcut", () => {
  it("uses the reference binding and rejects modifiers, composition and repeats", () => {
    expect(isLayerShortcut(new KeyboardEvent("keydown", { key: SHORTCUTS.layer.key }))).toBe(true);
    for (const flag of ["ctrlKey", "altKey", "metaKey", "shiftKey", "repeat", "isComposing"]) {
      expect(isLayerShortcut(new KeyboardEvent("keydown", { key: "l", [flag]: true }))).toBe(false);
    }
  });
  it("does not intercept typing, including nested editable content", () => {
    for (const html of ['<input>', '<textarea></textarea>', '<select></select>', '<div contenteditable="true"><span>text</span></div>', '<div role="textbox"></div>']) {
      const host = document.createElement("div");
      host.innerHTML = html;
      const target = host.querySelector("span") ?? host.firstElementChild!;
      let matched = true;
      target.addEventListener("keydown", event => { matched = isLayerShortcut(event as KeyboardEvent); });
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "l", bubbles: true }));
      expect(matched).toBe(false);
    }
  });
});
