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

// The profile-grades line (issue #370, re-spoken by ADR-0072): the authored
// aptitudes as multiplier-and-grade chips on the draft's candidate tiles and
// the Hex detail's module face — plain, self-contained text (the tooltip
// disclosure retired 2026-10-18: it restated the visible figure), with
// actual live output staying in the existing readouts.

describe("grade chips on the Forge candidate tiles", () => {
  it("a waveform candidate wears its fixed grade signature", () => {
    app.openModal("forge");
    const tile = panel().querySelector('[data-choice="c-square"]')!.closest(".candidate-tile")!;
    const grades = tile.querySelector(".profile-grades")!;
    const chips = [...grades.querySelectorAll<HTMLElement>(".profile-grade")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["base ×0.9 (B)", "boost ×2 (S)", "chord ×0.6 (C)", "charge ×1 (B)", "breath ×1.1 (A)"]);
    // Plain text: no disclosure wrapper, nothing hidden behind a trigger.
    expect(chips.every((chip) => chip.tagName === "SPAN")).toBe(true);
    expect(grades.querySelectorAll(".inst-tip-body")).toHaveLength(0);
  });

  it("the absent mark reads where an axis has no comparable coefficient", () => {
    app.openModal("forge");
    const tile = panel().querySelector('[data-choice="c-blaster"]')!.closest(".candidate-tile")!;
    const chips = [...tile.querySelectorAll<HTMLElement>(".profile-grade")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["base ×1 (A)", "boost ×1 (B)", "chord ×1 (B)", "charge —", "breath —"]);
    expect(chips[3]!.dataset.grade).toBe("—");
  });

  it("the Sideband's absent charge mark rides the replacement stated in words (issue #375)", () => {
    app.state.bankedRolls = [{ id: "chord-roll", candidates: [
      { id: "c-side", type: "sideband", tier: 0 },
      { id: "c-chorus", type: "chorus", tier: 0 },
      { id: "c-spacer", type: "spacer", tier: 0 },
    ] }];
    app.openModal("forge");
    const side = panel().querySelector('[data-choice="c-side"]')!.closest(".candidate-tile")!;
    const chips = [...side.querySelectorAll<HTMLElement>(".profile-grade")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["base ×0.5 (D)", "boost ×1 (B)", "chord ×2 (S)", "charge —", "breath ×1.2 (A)"]);
    // The effect line states where the charge goes instead (the term-tip
    // markup rides inside it).
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

  it("distinguishes a weak response from an absent effect on the chip itself", () => {
    // Exercise a future authored weak coefficient without changing the roster's tuning.
    const original = OSCILLATOR_PROFILES.square.booster;
    try {
      OSCILLATOR_PROFILES.square.booster = 0.25;
      app.openModal("forge");
      const weak = panel().querySelector<HTMLElement>('[data-choice="c-square"]')!
        .closest(".candidate-tile")!.querySelector<HTMLElement>('[data-grade="D"]')!;
      const absent = panel().querySelector<HTMLElement>('[data-choice="c-blaster"]')!
        .closest(".candidate-tile")!.querySelector<HTMLElement>('[data-grade="—"]')!;
      // The band letter rides the visible figure — no disclosure needed
      // to tell weak from absent.
      expect(weak.textContent).toBe("boost ×0.25 (D)");
      expect(absent.textContent).toBe("charge —");
      expect(app.state.bankedRolls[0]!.candidates).toHaveLength(3);
      expect(app.ui.modal).toBe("forge");
    } finally {
      OSCILLATOR_PROFILES.square.booster = original;
    }
  });

  it("types without authored profiles carry no grade line at all", () => {
    app.openModal("forge");
    const tile = panel().querySelector('[data-choice="c-spacer"]')!.closest(".candidate-tile")!;
    expect(tile.querySelector(".profile-grades")).toBeNull();
  });
});

describe("grade chips on the Hex detail's module face", () => {
  it("the placed module's grades render in the details column and hold under progression", () => {
    app.render();
    clickCell(0, 0);
    const side = document.querySelector(".hex-detail-side")!;
    const letters = () => [...side.querySelectorAll(".profile-grade")].map((chip) => chip.textContent);
    expect(letters()).toEqual(["base ×1 (A)", "boost ×0.5 (C)", "chord ×1 (B)", "charge ×1 (B)", "breath —"]);
    // Level and tier change output — never the grades.
    app.state.modules[0]!.level = 5;
    app.state.modules[0]!.tier = 2;
    app.render();
    clickCell(0, 0);
    expect(letters()).toEqual(["base ×1 (A)", "boost ×0.5 (C)", "chord ×1 (B)", "charge ×1 (B)", "breath —"]);
  });
});

describe("the breather specialists' fact rules (issue #416)", () => {
  it("the specialists' chips lead with the S-band breather figure; the fact rules ride beside as plain lines", () => {
    app.state.bankedRolls = [{ id: "breather-roll", candidates: [
      { id: "c-release", type: "release", tier: 0 },
      { id: "c-standby", type: "standby", tier: 0 },
      { id: "c-tail", type: "tail", tier: 0 },
    ] }];
    app.openModal("forge");
    const chipsOf = (id: string): (string | null)[] =>
      [...panel().querySelector(`[data-choice="${id}"]`)!.closest(".candidate-tile")!.querySelectorAll<HTMLElement>(".profile-grade")].map((chip) => chip.textContent);
    expect(chipsOf("c-release")).toEqual(["base ×0.7 (C)", "boost ×1 (B)", "chord ×1 (B)", "charge ×1 (B)", "breath ×1.6 (S)"]);
    expect(chipsOf("c-standby")).toEqual(["base ×0.85 (B)", "boost ×1 (B)", "chord ×1 (B)", "charge ×1 (B)", "breath ×1.4 (S)"]);
    expect(chipsOf("c-tail")).toEqual(["base ×0.5 (D)", "boost ×1 (B)", "chord ×1 (B)", "charge ×1 (B)", "breath ×1.5 (S)"]);
    // The rule line sits beside the chips, letter-free: a fact-keyed
    // growth is described directly, never graded.
    const standby = panel().querySelector('[data-choice="c-standby"]')!.closest(".candidate-tile")!;
    const standbyRule = standby.querySelector(".profile-timing")!;
    expect(standbyRule.textContent).toContain("×0.1 per completed breather");
    expect(standbyRule.querySelectorAll(".profile-grade")).toHaveLength(0);
    const tail = panel().querySelector('[data-choice="c-tail"]')!.closest(".candidate-tile")!;
    expect(tail.querySelector(".profile-timing")!.textContent).toContain("30 lifetime breather min");
    // The Release authors no fact rule: its chip is the whole story.
    const release = panel().querySelector('[data-choice="c-release"]')!.closest(".candidate-tile")!;
    expect(release.querySelector(".profile-timing")).toBeNull();
    // Every effect line names the rest keying — the specialists read as
    // rest-keyed before any chip is parsed.
    for (const id of ["c-release", "c-standby", "c-tail"]) {
      expect(panel().querySelector(`[data-choice="${id}"]`)!.closest(".candidate-tile")!
        .querySelector(".candidate-effect")!.textContent).toContain("Breather-fed term");
    }
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
    expect(host.querySelectorAll(".profile-grade")).toHaveLength(5);
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
