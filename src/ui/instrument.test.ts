// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { closeTooltips, wireTooltips } from "./instrument";

// The tooltip layer's wiring (issue #267): hover and focus, the touch pin,
// the dismissal walk, and the portal that lifts the body out of the
// clipped, scrolling surface it belongs to.
describe("the tooltip layer's pinning and dismissal", () => {
  function tipHost(): { host: HTMLElement; first: HTMLElement; second: HTMLElement } {
    document.body.innerHTML = "";
    const host = document.createElement("div");
    host.innerHTML = `
      <span class="inst-tip" id="tip-a"><button class="inst-tip-trigger" aria-describedby="body-a" aria-expanded="false">ⓘ</button><span class="inst-tip-body" id="body-a" role="tooltip">A legs</span></span>
      <span class="inst-tip" id="tip-b"><button class="inst-tip-trigger" aria-describedby="body-b" aria-expanded="false">ⓘ</button><span class="inst-tip-body" id="body-b" role="tooltip">B legs</span></span>`;
    document.body.appendChild(host);
    wireTooltips(host);
    const first = host.querySelector<HTMLElement>("#tip-a .inst-tip-trigger")!;
    const second = host.querySelector<HTMLElement>("#tip-b .inst-tip-trigger")!;
    return { host, first, second };
  }

  it("a trigger's tap pins its tooltip and reports the state", () => {
    const { host, first } = tipHost();
    first.click();
    expect(host.querySelector("#tip-a")!.classList.contains("show")).toBe(true);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(true);
    // A second tap unpins — the pin is a toggle for the touch surface.
    first.click();
    expect(host.querySelector("#tip-a")!.classList.contains("show")).toBe(false);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(false);
  });

  it("showing lifts the body out of the surface — the portal escapes clip and scroll", () => {
    const { first } = tipHost();
    first.click();
    // The body answers to aria-describedby from document.body now: the
    // clipped plate it rendered in can no longer cut its paint.
    expect(document.getElementById("body-a")!.parentElement).toBe(document.body);
    first.click();
  });

  it("hover and keyboard focus open through the wiring's own states", () => {
    const { first } = tipHost();
    first.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(true);
    first.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(false);
    first.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(true);
    first.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(false);
  });

  it("pinning elsewhere puts the last pinned tooltip away — one at a time", () => {
    const { host, first, second } = tipHost();
    first.click();
    second.click();
    expect(host.querySelector("#tip-a")!.classList.contains("show")).toBe(false);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector("#tip-b")!.classList.contains("show")).toBe(true);
    expect(document.getElementById("body-b")!.classList.contains("inst-show")).toBe(true);
  });

  it("a tap anywhere else in the surface dismisses the pin", () => {
    const { host, first } = tipHost();
    first.click();
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(true);
    host.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(host.querySelector("#tip-a")!.classList.contains("show")).toBe(false);
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(false);
  });

  it("Escape unpins and the dismissal never reaches the surface beneath", () => {
    const { host, first } = tipHost();
    first.click();
    first.focus();
    let escaped = 0;
    document.addEventListener("keydown", () => { escaped += 1; });
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(host.querySelector("#tip-a")!.classList.contains("show")).toBe(false);
    // The dismissal is the tooltip's own: the sheet beneath keeps its Esc
    // walk for the next press.
    expect(escaped).toBe(0);
  });

  it("Escape with nothing pinned passes through untouched", () => {
    tipHost();
    let escaped = 0;
    document.addEventListener("keydown", () => { escaped += 1; });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(escaped).toBe(1);
  });

  it("a trigger's tap never reads as the row's pick — the event stops at the tooltip", () => {
    const { first } = tipHost();
    let rowPicks = 0;
    document.body.addEventListener("click", () => { rowPicks += 1; });
    first.click();
    expect(rowPicks).toBe(0);
  });

  it("closeTooltips is the one teardown every path shares", () => {
    const { host, first, second } = tipHost();
    first.click();
    second.click();
    closeTooltips(host);
    expect(host.querySelectorAll(".inst-tip.show")).toHaveLength(0);
  });

  it("a tap that never enters the surface dismisses the pin and reaps orphans", () => {
    const { host, first } = tipHost();
    first.click();
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(true);
    // A click elsewhere in the document — never through the surface.
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(host.querySelector("#tip-a")!.classList.contains("show")).toBe(false);
    expect(document.getElementById("body-a")!.classList.contains("inst-show")).toBe(false);
  });

  it("the attach sweep reaps a body whose surface was rebuilt without it", () => {
    const { first } = tipHost();
    first.click();
    expect(document.getElementById("body-a")).not.toBeNull();
    // The surface rebuilds: tip and trigger are gone from the document,
    // the portaled body would be an orphan.
    document.querySelector("#tip-a")!.remove();
    wireTooltips(document.body);
    expect(document.getElementById("body-a")).toBeNull();
  });
});

// The primitives' stylesheet contract: the classes exist and carry the
// decisions the standards pin (issue #267). Detector-style greps back the
// review; they never replace it.
describe("the instrument primitives' stylesheet contract", () => {
  const css = readFileSync("src/ui/style.css", "utf8");

  it("the panel silhouette is the clipped plate with open divisions, never a rounded card", () => {
    expect(css).toMatch(/--inst-clip: polygon\(/);
    const panel = css.slice(css.indexOf(".inst-panel {"), css.indexOf(".inst-panel-face"));
    expect(panel).toContain("clip-path: var(--inst-clip)");
    expect(panel).not.toContain("border-radius");
    const face = css.slice(css.indexOf(".inst-panel-face {"), css.indexOf("/* Type roles"));
    expect(face).toContain("clip-path: var(--inst-clip)");
    expect(face).not.toContain("border-radius");
  });

  it("the state grammar carries all four states and the marker is an inset, not a color", () => {
    for (const state of [".st-unavailable", ".st-available", ".st-selected", ".st-acquired"]) {
      expect(css).toContain(`${state} {`);
    }
    expect(css).toMatch(/\.st-selected \{ box-shadow: inset /);
  });

  it("the tooltip opens by hover, by keyboard focus, and by the touch pin alike", () => {
    const block = css.slice(css.indexOf(".inst-tip {"), css.indexOf("── The console"));
    expect(block).toContain(".inst-tip-body.inst-show { display: block; }");
  });

  it("the roster's selected state rides the shared marker, and motion dies under reduced-motion", () => {
    expect(css).toContain(".rd-synth.st-selected .rd-name");
    expect(css).toMatch(/\.st-selected \{ box-shadow: inset /);
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduce).toContain("animation: none !important");
    expect(reduce).toContain("transition: none !important");
  });

  it("closing a surface puts its pinned tooltips away — the modal teardown reads closeTooltips", () => {
    // render.ts's modal teardown (the backdrop-hidden path) calls
    // closeTooltips: a portaled body must never float over a closed sheet.
    const render = readFileSync("src/ui/render.ts", "utf8");
    expect(render).toContain('import { closeTooltips, wireTooltips } from "./instrument"');
    const teardown = render.slice(render.indexOf("backdrop.hidden = true"));
    expect(teardown.slice(0, teardown.indexOf("return;"))).toContain("closeTooltips(content)");
  });
});
