// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { computeRates } from "../engine/economy";
import { fresh, give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { formatNumber } from "./format";
import { rateDetailsHtml, updateRateDetailsLive } from "./ledger";

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
