// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { App } from "./app";
import { clickCell, createAppFixture } from "./testing/app-fixture";
import { profileGradesHtml } from "./profile";

const fixture = createAppFixture();
let app: App;
beforeEach(() => {
  app = fixture.boot();
  app.state.bankedRolls = [{ id: "module-roll", candidates: [
    { id: "c-square", type: "square", tier: 0 },
    { id: "c-blaster", type: "blaster", tier: 0 },
    { id: "c-spacer", type: "spacer", tier: 0 },
  ] }];
});
afterEach(() => fixture.release());
const panel = () => document.getElementById("modal-content")!;

// The profile-grades line (issue #370): the authored aptitudes as fixed
// letter grades on the draft's candidate tiles and the Hex detail's module
// face — the exact coefficients ride the tooltip layer, and actual live
// output stays in the existing readouts.

describe("grade chips on the Forge candidate tiles", () => {
  it("a waveform candidate wears its fixed grade signature", () => {
    app.openModal("forge");
    const tile = panel().querySelector('[data-choice="c-square"]')!.closest(".candidate-tile")!;
    const grades = tile.querySelector(".profile-grades")!;
    const chips = [...grades.querySelectorAll<HTMLButtonElement>(".profile-grade")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["base B", "boost S", "chord C", "charge B"]);
    // The letter is the state, spoken in the accessible name — never
    // color alone.
    expect(chips[1]!.getAttribute("aria-label")).toBe("Booster response: S, exceptional");
    expect(chips[2]!.getAttribute("aria-label")).toBe("Chord response: C, reduced");
  });

  it("the absent mark reads where an axis has no comparable coefficient", () => {
    app.openModal("forge");
    const tile = panel().querySelector('[data-choice="c-blaster"]')!.closest(".candidate-tile")!;
    const chips = [...tile.querySelectorAll<HTMLButtonElement>(".profile-grade")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["base A", "boost B", "chord B", "charge —"]);
    expect(chips[3]!.getAttribute("aria-label")).toBe("Charge response: —, absent effect");
  });

  it("keyboard focus opens the exact coefficient; Escape dismisses the disclosure alone", () => {
    app.openModal("forge");
    const chip = panel().querySelector<HTMLButtonElement>('[data-choice="c-square"] ~ * .profile-grade, .candidate-tile .profile-grade')!;
    chip.focus();
    const body = document.getElementById(chip.getAttribute("aria-describedby")!)!;
    expect(body.classList.contains("inst-show")).toBe(true);
    // The exact coefficient, in the established disclosure language.
    expect(body.textContent).toBe("Base production ×0.9 · standard");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(body.classList.contains("inst-show")).toBe(false);
    expect(app.ui.modal).toBe("forge");
  });

  it("a tap pins the disclosure and tapping elsewhere dismisses it", () => {
    app.openModal("forge");
    const chip = panel().querySelector<HTMLButtonElement>(".candidate-tile .profile-grade")!;
    chip.click();
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    panel().querySelector<HTMLElement>(".forge-choice-cue")!.click();
    expect(chip.getAttribute("aria-expanded")).toBe("false");
  });

  it("types without authored profiles carry no grade line at all", () => {
    app.openModal("forge");
    const tile = panel().querySelector('[data-choice="c-spacer"]')!.closest(".candidate-tile")!;
    expect(tile.querySelector(".profile-grades")).toBeNull();
  });
});

describe("grade chips on the Hex detail's module face", () => {
  it("the placed module's grades render beside its face and hold under progression", () => {
    app.render();
    clickCell(0, 0);
    const layer = document.querySelector(".hex-detail-layer.modules")!;
    const letters = () => [...layer.querySelectorAll(".profile-grade")].map((chip) => chip.textContent);
    expect(letters()).toEqual(["base A", "boost C", "chord B", "charge B"]);
    // Level and tier change output — never the grades.
    app.state.modules[0]!.level = 5;
    app.state.modules[0]!.tier = 2;
    app.render();
    clickCell(0, 0);
    expect(letters()).toEqual(["base A", "boost C", "chord B", "charge B"]);
  });
});

describe("the reusable presentation contract", () => {
  it("renders nothing for types without authored profile axes", () => {
    expect(profileGradesHtml("infusor")).toBe("");
    expect(profileGradesHtml("focusKeyed")).toBe("");
    expect(profileGradesHtml("harmonizer")).toBe("");
  });
});
