// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { computeRates } from "../engine/economy";
import { syncChordDiscoveries } from "../engine/library";
import { fresh, give, sumSynthValues } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { formatNumber } from "./format";
import { libraryChipHtml, rateDetailsHtml, updateRateDetailsLive } from "./ledger";

describe("silent voices' formation quality in rate details", () => {
  it.each(["harmonizer", "echo", "bend"] as const)("shows %s quality in both sheet and live rows", (type) => {
    const state = fresh();
    const voice = give(state, type, type === "bend" ? hex(-1, 0) : hex(1, 0));
    if (type === "bend") {
      voice.shift = -1;
      give(state, "additive", hex(1, 0));
    }
    if (type === "echo") give(state, "additive", hex(-1, 0));
    const snapshot = computeRates(state, false);
    const quality = snapshot.contributions.get(voice.id)!.formationQ;
    expect(quality).toBeGreaterThan(1);
    const formation = `Formation ×${formatNumber(quality)}`;
    const sheet = document.createElement("div");
    sheet.innerHTML = rateDetailsHtml(state, snapshot, false);
    expect(sheet.querySelector(".rd-other-row")!.textContent).toContain(formation);

    const live = document.createElement("div");
    live.innerHTML = rateDetailsHtml(state, snapshot, true);
    updateRateDetailsLive(live, state, snapshot);
    const row = live.querySelector(`[data-live="n-${voice.id}"]`)!;
    expect(row.textContent).toContain(formation);

    // An isolated voice is chordless: the existing live row follows the
    // new snapshot rather than keeping its previous formation quality.
    voice.pos = hex(10, 0);
    updateRateDetailsLive(live, state, computeRates(state, false));
    expect(row.textContent).toContain(`Formation ×${formatNumber(1)}`);
  });
});

describe("the discovery bonus in the rate details (issue #230)", () => {
  it("every synth row carries the Discoveries leg the rate multiplies out with", () => {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    syncChordDiscoveries(state, { now: 100 });
    const snapshot = computeRates(state, false);
    expect(snapshot.discoveryBoost).toBeCloseTo(1.01, 10);
    const sheet = document.createElement("div");
    sheet.innerHTML = rateDetailsHtml(state, snapshot, false);
    const legs = [...sheet.querySelectorAll(".rd-leg")].map((leg) => leg.textContent);
    expect(legs.filter((text) => text!.includes("Discoveries"))).toHaveLength(2);
    for (const synth of sheet.querySelectorAll(".rd-synth")) {
      const leg = [...synth.querySelectorAll(".rd-leg")].find((row) => row.textContent!.includes("Discoveries"));
      expect(leg!.textContent).toContain("+1%");
    }
    // The legs multiply back to the final figure exactly, discovery leg
    // included.
    expect(sumSynthValues(snapshot)).toBeCloseTo(snapshot.rate, 6);
  });

  it("the library chip reads the ledger's count", () => {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    syncChordDiscoveries(state, { now: 100 });
    const chip = document.createElement("div");
    chip.innerHTML = libraryChipHtml(state);
    expect(chip.querySelector(".library-chip")!.textContent).toContain("1/11 chords");
  });
});

describe("the RITUAL row (ADR-0046, wave 4)", () => {
  it("names its amplification of the active build, charged or not", () => {
    const state = fresh();
    const ritual = give(state, "ritual", hex(1, 0));
    const generator = give(state, "focusKeyed", hex(2, 0));
    ritual.level = 1;
    generator.reserve = 600;
    const snapshot = computeRates(state, true);
    const sheet = document.createElement("div");
    sheet.innerHTML = rateDetailsHtml(state, snapshot, false);
    const row = [...sheet.querySelectorAll(".rd-other-row")].find((el) => el.textContent!.includes("RITUAL"))!;
    expect(row.textContent).toContain(`amplifies the active habit's build ×${formatNumber(1 + snapshot.ritualAmplification)} while charged`);
    // Uncharged, the factor sits at its floor.
    generator.reserve = 0;
    const cold = computeRates(state, true);
    expect(cold.ritualAmplification).toBe(0);
    const coldSheet = document.createElement("div");
    coldSheet.innerHTML = rateDetailsHtml(state, cold, false);
    const coldRow = [...coldSheet.querySelectorAll(".rd-other-row")].find((el) => el.textContent!.includes("RITUAL"))!;
    expect(coldRow.textContent).toContain(`×${formatNumber(1)} while charged`);
  });
});
