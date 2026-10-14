// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { computeRates } from "../engine/economy";
import { syncChordDiscoveries } from "../engine/library";
import { fresh, give, sumSynthValues } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { formatNumber } from "./format";
import { libraryChipHtml, rateDetailsHtml, updateRateDetailsLive, wireSynthPicks } from "./ledger";

describe("what the board earns in the rate details (issue #334)", () => {
  it("lists the total, the global factors once, and one final row per oscillator — nothing else", () => {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    give(state, "infusor", hex(0, 1));
    give(state, "focusKeyed", hex(0, -1));
    give(state, "harmonizer", hex(1, 1));
    const snapshot = computeRates(state, false);
    const sheet = document.createElement("div");
    sheet.innerHTML = rateDetailsHtml(state, snapshot, false);
    // The total leads.
    expect(sheet.querySelector(".rd-total .rd-val")!.textContent).toBe(`${formatNumber(snapshot.rate)} ν/s`);
    // The global factors appear exactly once, already included — never as
    // a per-row leg.
    const global = sheet.querySelectorAll(".rd-global .rd-val");
    expect(global).toHaveLength(1);
    expect(global[0]!.textContent).toContain("already included");
    expect(sheet.textContent).not.toContain("Achievements");
    // One row per oscillator only: the infusor, the generator, and the
    // silent voice disclose nowhere in the roster.
    const oscs = [...snapshot.contributions.values()].filter((c) => c.type === "additive");
    expect(sheet.querySelectorAll(".rd-synth")).toHaveLength(oscs.length);
    expect(sheet.textContent).not.toContain("to adjacent");
    expect(sheet.textContent).not.toContain("charge");
    expect(sheet.querySelector(".rd-other-row")).toBeNull();
    // No expansion, no arrow: the amendment drops the per-row details —
    // the row is its name and its final figure, the pick the one control.
    expect(sheet.querySelector(".rd-calc, .rd-calc-toggle, [aria-controls]")).toBeNull();
    for (const button of sheet.querySelectorAll("button")) {
      expect(button.classList.contains("rd-pick")).toBe(true);
    }
    // The displayed oscillator totals sum to the board's rate within
    // rounding — the details can never disagree with the total above them.
    expect(sumSynthValues(snapshot)).toBeCloseTo(snapshot.rate, 6);
  });

  it("a zero-output oscillator reads like any other row", () => {
    const state = fresh();
    // An uncharged Blaster converts no charge: zero output, same grammar —
    // no special casing, no omission.
    const blaster = give(state, "blaster", hex(1, 0));
    const snapshot = computeRates(state, false);
    const value = snapshot.contributions.get(blaster.id)!.value;
    expect(value).toBe(0);
    const sheet = document.createElement("div");
    sheet.innerHTML = rateDetailsHtml(state, snapshot, false);
    const row = sheet.querySelector(`[data-module-id="${blaster.id}"]`)!;
    expect(row).not.toBeNull();
    expect(row.querySelector(".rd-val")!.textContent).toBe("+0 ν/s");
  });
});

describe("the discovery bonus in the rate details (issue #230)", () => {
  it("the global line carries the Discoveries factor the rate multiplies out with", () => {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    syncChordDiscoveries(state, { now: 100 });
    const snapshot = computeRates(state, false);
    expect(snapshot.discoveryBoost).toBeCloseTo(1.01, 10);
    const sheet = document.createElement("div");
    sheet.innerHTML = rateDetailsHtml(state, snapshot, false);
    expect(sheet.querySelector(".rd-global .rd-val")!.textContent).toContain("+1%");
    // The figures still multiply back to the final rate, global legs
    // included.
    expect(sumSynthValues(snapshot)).toBeCloseTo(snapshot.rate, 6);
  });

  it("the library chip reads the ledger's count", () => {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    syncChordDiscoveries(state, { now: 100 });
    const chip = document.createElement("div");
    chip.innerHTML = libraryChipHtml(state);
    expect(chip.querySelector(".ledger-chip")!.textContent).toContain("1/11");
  });
});

describe("the roster's rows and live slots", () => {
  function build(live = false) {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    give(state, "additive", hex(1, 1));
    const snapshot = computeRates(state, false);
    const host = document.createElement("div");
    host.innerHTML = rateDetailsHtml(state, snapshot, live);
    document.body.appendChild(host);
    return { state, snapshot, host };
  }

  it("a row's tap picks its module; the figure renders outside any disclosure", () => {
    const { host } = build();
    const picked: string[] = [];
    wireSynthPicks(host, (id) => picked.push(id));
    const row = host.querySelector(".rd-synth")!;
    row.querySelector(".rd-pick")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(picked).toEqual([row.getAttribute("data-module-id")]);
  });

  it("the live slots fill both channels without crossing", () => {
    const { state, host } = build(true);
    const snapshot = computeRates(state, false);
    const pop = document.createElement("div");
    pop.innerHTML = rateDetailsHtml(state, snapshot, true, "pop");
    document.body.appendChild(pop);
    updateRateDetailsLive(host, state, snapshot);
    updateRateDetailsLive(pop, state, snapshot);
    const id = host.querySelector(".rd-synth")!.getAttribute("data-module-id")!;
    // An upgrade lands: each roster's own slots move with its own fill.
    state.modules.find((m) => m.id === id)!.level += 2;
    const changed = computeRates(state, false);
    updateRateDetailsLive(host, state, changed);
    expect(host.querySelector(`[data-live="s-${id}-v"]`)!.textContent).toBe(
      `+${formatNumber(changed.contributions.get(id)!.value)} ν/s`,
    );
    expect(pop.querySelector(`[data-live="s-${id}-v"]`)!.textContent).toBe(
      `+${formatNumber(snapshot.contributions.get(id)!.value)} ν/s`,
    );
    updateRateDetailsLive(pop, state, changed);
    expect(pop.querySelector(`[data-live="s-${id}-v"]`)!.textContent).toBe(
      host.querySelector(`[data-live="s-${id}-v"]`)!.textContent,
    );
  });
});
