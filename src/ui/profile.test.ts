// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { App } from "./app";
import { clickCell, createAppFixture } from "./testing/app-fixture";
import { profileGradesHtml } from "./profile";
import { OSCILLATOR_PROFILES } from "../engine/profiles";

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

  it("the Sideband's absent charge mark rides the replacement stated in words (issue #375)", () => {
    app.state.bankedRolls = [{ id: "chord-roll", candidates: [
      { id: "c-side", type: "sideband", tier: 0 },
      { id: "c-chorus", type: "chorus", tier: 0 },
      { id: "c-spacer", type: "spacer", tier: 0 },
    ] }];
    app.openModal("forge");
    const side = panel().querySelector('[data-choice="c-side"]')!.closest(".candidate-tile")!;
    const chips = [...side.querySelectorAll<HTMLButtonElement>(".profile-grade")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["base D", "boost B", "chord S", "charge —"]);
    // The exact coefficients stay in the disclosure bodies; the effect
    // line states where the charge goes instead (the term-tip markup
    // rides inside it).
    const charge = chips[3]!;
    charge.focus();
    const body = document.getElementById(charge.getAttribute("aria-describedby")!)!;
    expect(body.textContent).toBe("Charge response · absent effect");
    const effect = side.querySelector(".candidate-effect")!.textContent!;
    expect(effect).toContain("→ chord response");
    expect(effect).toContain("weak standalone term");
    // The Chorus is a booster: no grade chips, its own term named.
    const chorus = panel().querySelector('[data-choice="c-chorus"]')!.closest(".candidate-tile")!;
    expect(chorus.querySelector(".profile-grades")).toBeNull();
    expect(chorus.querySelector(".candidate-effect")!.textContent).toContain("chord response");
  });

  it("the Exciter's tile names its single term and its condition — no grade line (issue #376)", () => {
    app.state.bankedRolls = [{ id: "charge-roll", candidates: [
      { id: "c-exciter", type: "exciter", tier: 0 },
      { id: "c-chorus", type: "chorus", tier: 0 },
      { id: "c-spacer", type: "spacer", tier: 0 },
    ] }];
    app.openModal("forge");
    const tile = panel().querySelector('[data-choice="c-exciter"]')!.closest(".candidate-tile")!;
    expect(tile.querySelector(".profile-grades")).toBeNull();
    // The "charge" term rides the hoverable word layer, so the rendered
    // text reads around it.
    const effect = tile.querySelector(".candidate-effect")!.textContent!;
    expect(effect).toContain("response +50%");
    expect(effect).toContain("needs charged recipients");
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

  it("distinguishes a weak response from an absent effect through disclosure", () => {
    // Exercise a future authored weak coefficient without changing the roster's tuning.
    const original = OSCILLATOR_PROFILES.square.booster;
    try {
      OSCILLATOR_PROFILES.square.booster = 0.25;
      app.openModal("forge");
      const weak = panel().querySelector<HTMLButtonElement>('[data-choice="c-square"]')!
        .closest(".candidate-tile")!.querySelector<HTMLButtonElement>('[data-grade="D"]')!;
      const absent = panel().querySelector<HTMLButtonElement>('[data-choice="c-blaster"]')!
        .closest(".candidate-tile")!.querySelector<HTMLButtonElement>('[data-grade="—"]')!;
      expect(weak.textContent).toBe("boost D");
      expect(absent.textContent).toBe("charge —");
      weak.focus();
      const weakTip = document.getElementById(weak.getAttribute("aria-describedby")!)!;
      expect(weakTip.classList.contains("inst-show")).toBe(true);
      expect(weakTip.textContent).toBe("Booster response ×0.25 · weak");
      absent.click();
      const absentTip = document.getElementById(absent.getAttribute("aria-describedby")!)!;
      expect(absentTip.classList.contains("inst-show")).toBe(true);
      expect(absentTip.textContent).toBe("Charge response · absent effect");
      expect(app.state.bankedRolls[0]!.candidates).toHaveLength(3);
      expect(app.ui.modal).toBe("forge");
    } finally {
      OSCILLATOR_PROFILES.square.booster = original;
    }
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

describe("the temporal profiles' timing line (issue #372)", () => {
  it("the Afterglow's grade chips ride beside the warmup said directly", () => {
    const html = profileGradesHtml("afterglow");
    const host = document.createElement("div");
    host.innerHTML = html;
    const timing = host.querySelector(".profile-timing")!;
    expect(timing.textContent).toBe("×0.3 open · ×0.8 from 2 min · ×1.25 sustained from 5 min");
    // The curve takes no letter: its words live outside the chips.
    expect(timing.querySelectorAll(".profile-grade")).toHaveLength(0);
    expect(host.querySelectorAll(".profile-grade")).toHaveLength(4);
  });

  it("the Pulsewell carries the timing line alone — generators have no grade chips yet", () => {
    const html = profileGradesHtml("pulsewell");
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(host.querySelector(".profile-timing")!.textContent).toBe("×0.5 steady · ×2.5 burst, 30 s every 2 min");
    expect(host.querySelector(".profile-grades")).toBeNull();
  });

  it("a temporal candidate tile wears the timing line on the draft", () => {
    app.state.bankedRolls = [{ id: "temporal-roll", candidates: [
      { id: "c-glow", type: "afterglow", tier: 0 },
      { id: "c-well", type: "pulsewell", tier: 0 },
      { id: "c-spacer", type: "spacer", tier: 0 },
    ] }];
    app.openModal("forge");
    const glow = panel().querySelector('[data-choice="c-glow"]')!.closest(".candidate-tile")!;
    expect(glow.querySelector(".profile-timing")!.textContent).toContain("×1.25 sustained");
    const well = panel().querySelector('[data-choice="c-well"]')!.closest(".candidate-tile")!;
    expect(well.querySelector(".profile-timing")!.textContent).toContain("×2.5 burst");
  });
});
