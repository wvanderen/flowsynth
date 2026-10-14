// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { allocateRates, computeRates } from "../engine/economy";
import { syncChordDiscoveries } from "../engine/library";
import { fresh, give, sumSynthValues } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { formatNumber } from "./format";
import { libraryChipHtml, rateDetailsHtml, updateRateDetailsLive, wireRateCalcs, wireSynthPicks } from "./ledger";

describe("what the board earns in the rate details (issue #334)", () => {
  it("lists the total, the global factors once, and one final row per oscillator — no supporting roster", () => {
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
    expect(sheet.textContent).not.toContain("Discoveries leg");
    // One row per oscillator only: the infusor, the generator, and the
    // silent voice disclose nowhere in the roster.
    const oscs = [...snapshot.contributions.values()].filter((c) => c.type === "additive");
    expect(sheet.querySelectorAll(".rd-synth")).toHaveLength(oscs.length);
    expect(sheet.textContent).not.toContain("to adjacent");
    expect(sheet.textContent).not.toContain("charge");
    expect(sheet.querySelector(".rd-other-row")).toBeNull();
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

describe("the inline calculation (issue #334)", () => {
  function build(live = false) {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    give(state, "additive", hex(1, 1));
    const snapshot = allocateRates(state, false).snapshot;
    const host = document.createElement("div");
    host.innerHTML = rateDetailsHtml(state, snapshot, live);
    // The accordion resolves ids through the document: mounted, always.
    document.body.appendChild(host);
    return { state, snapshot, host };
  }

  it("stays closed until its own control opens it, and opens inline in the roster", () => {
    const { snapshot, host } = build();
    // The standards' expandable-section ban holds: no <details> — the
    // reveal is an explicit control, not a browser default.
    expect(host.querySelector("details")).toBeNull();
    expect(host.querySelector("summary")).toBeNull();
    const row = host.querySelector(".rd-synth")!;
    const calc = host.querySelector<HTMLElement>(".rd-calc")!;
    // The figure renders outside the calculation: critical state stays
    // visible without opening anything.
    expect(calc.hidden).toBe(true);
    expect(row.querySelector(".rd-val")!.textContent).toMatch(/^\+/);
    // The control is a real button naming what it opens.
    const toggle = row.querySelector<HTMLButtonElement>(".rd-calc-toggle")!;
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(calc.id);
    wireRateCalcs(host);
    toggle.click();
    expect(calc.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    // The legs are the honest chain: every local leg, the global factors
    // once as the closing leg, and the product back at the row's figure.
    const legs = [...calc.querySelectorAll(".rd-leg")].map((leg) => leg.textContent!);
    expect(legs.some((text) => text.includes("Base"))).toBe(true);
    expect(legs.some((text) => text.includes("Formation"))).toBe(true);
    expect(legs.some((text) => text.includes("Chords"))).toBe(true);
    expect(legs.some((text) => text.includes("Capacity"))).toBe(true);
    expect(legs.some((text) => text.includes("Booster"))).toBe(true);
    expect(legs.some((text) => text.includes("Charge"))).toBe(true);
    expect(legs.filter((text) => text.includes("Feats · Discoveries"))).toHaveLength(1);
    const product = calc.querySelector(".rd-leg-product .rd-val")!.textContent!;
    expect(product).toBe(`+${formatNumber(snapshot.contributions.get(row.getAttribute("data-module-id")!)!.value)} ν/s`);
    // A second activation closes it again.
    toggle.click();
    expect((calc as HTMLElement).hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("opening another oscillator closes the one standing — one calculation at a time", () => {
    const { host } = build();
    wireRateCalcs(host);
    const [first, second] = [...host.querySelectorAll(".rd-synth")];
    first!.querySelector<HTMLButtonElement>(".rd-calc-toggle")!.click();
    expect(first!.parentElement!.querySelector<HTMLElement>(".rd-calc")!.hidden).toBe(false);
    second!.querySelector<HTMLButtonElement>(".rd-calc-toggle")!.click();
    expect(host.querySelector<HTMLElement>(`#${first!.querySelector(".rd-calc-toggle")!.getAttribute("aria-controls")}`)!.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>(`#${second!.querySelector(".rd-calc-toggle")!.getAttribute("aria-controls")}`)!.hidden).toBe(false);
    expect(second!.querySelector(".rd-calc-toggle")!.getAttribute("aria-expanded")).toBe("true");
  });

  it("a calculation's click reads as reading — never a module pick", () => {
    const { state, host } = build();
    const picked: string[] = [];
    wireSynthPicks(host, (id) => picked.push(id));
    const row = host.querySelector(".rd-synth")!;
    const id = row.getAttribute("data-module-id")!;
    wireRateCalcs(host);
    // Activating the calculation doesn't pick…
    row.querySelector<HTMLButtonElement>(".rd-calc-toggle")!.click();
    expect(picked).toEqual([]);
    // …and neither does a click inside the opened legs.
    host.querySelector(".rd-calc")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(picked).toEqual([]);
    // The row's own name still picks.
    row.querySelector(".rd-pick")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(picked).toEqual([id]);
    expect(state).toBeDefined();
  });

  it("the live slots fill both channels without crossing, and an open reading survives the fill", () => {
    const { state, snapshot, host } = build(true);
    const pop = document.createElement("div");
    pop.innerHTML = rateDetailsHtml(state, snapshot, true, "pop");
    document.body.append(host, pop);
    updateRateDetailsLive(host, state, snapshot);
    updateRateDetailsLive(pop, state, snapshot);
    wireRateCalcs(host);
    const toggle = host.querySelector<HTMLButtonElement>(".rd-calc-toggle")!;
    toggle.click();
    const id = host.querySelector(".rd-synth")!.getAttribute("data-module-id")!;
    const product = host.querySelector(".rd-leg-product .rd-val")!;
    // An upgrade lands: the open calculation's own slots move with it.
    state.modules.find((m) => m.id === id)!.level += 2;
    const changed = computeRates(state, false);
    updateRateDetailsLive(host, state, changed);
    expect(product.textContent).toBe(`+${formatNumber(changed.contributions.get(id)!.value)} ν/s`);
    // The open state rode the fill in place: the calc never closed.
    expect(host.querySelector<HTMLElement>(".rd-calc")!.hidden).toBe(false);
    // The other roster stands untouched until its own fill.
    expect(pop.querySelector(".rd-leg-product .rd-val")!.textContent).toBe(
      `+${formatNumber(snapshot.contributions.get(id)!.value)} ν/s`,
    );
    updateRateDetailsLive(pop, state, changed);
    expect(pop.querySelector(".rd-leg-product .rd-val")!.textContent).toBe(product.textContent);
  });
});

describe("the capacity read in the rate details (issue #258)", () => {
  function allocated(state: Parameters<typeof allocateRates>[0]) {
    return allocateRates(state, false).snapshot;
  }

  it("every synth calculation carries the Capacity leg and names its idle candidates", () => {
    const state = fresh();
    // C4 with a doubled G: one Fifth earns, the other stays a recognized
    // idle — the calc reads 1/1 and names the idle candidate without
    // implying a production gain.
    give(state, "additive", hex(1, 0));
    give(state, "additive", hex(1, 1));
    const snapshot = allocated(state);
    expect(snapshot.allocation).toBeDefined();
    const sheet = document.createElement("div");
    sheet.innerHTML = rateDetailsHtml(state, snapshot, false);
    wireRateCalcs(sheet);
    for (const toggle of sheet.querySelectorAll<HTMLButtonElement>(".rd-calc-toggle")) toggle.click();
    for (const synth of sheet.querySelectorAll(".rd-synth")) {
      const cap = [...synth.parentElement!.querySelectorAll(".rd-leg")].find((row) => row.textContent!.includes("Capacity"));
      expect(cap!.querySelector(".rd-val")!.textContent).toMatch(/^\d\/1$/);
    }
    const busy = snapshot.allocation!.active.flatMap((instance) => instance.memberIds);
    for (const id of busy) {
      const row = sheet.querySelector(`[data-module-id="${id}"]`)!;
      expect(row.parentElement!.textContent).toContain("idle — earns nothing:");
      expect(row.parentElement!.textContent).toContain("Fifth ×1.3");
    }
    // The live slots fill with the same wording.
    const live = document.createElement("div");
    live.innerHTML = rateDetailsHtml(state, snapshot, true);
    updateRateDetailsLive(live, state, snapshot);
    for (const id of busy) {
      expect(live.querySelector(`[data-live="s-${id}-cap"]`)!.textContent).toBe("1/1");
      expect(live.querySelector(`[data-live="s-${id}-idl"]`)!.textContent).toContain("idle — earns nothing");
    }
  });

  it("a chordless row reads 0/1 with no idle note", () => {
    const state = fresh();
    const island = give(state, "additive", hex(5, 0));
    const snapshot = allocated(state);
    const sheet = document.createElement("div");
    sheet.innerHTML = rateDetailsHtml(state, snapshot, false);
    const row = sheet.querySelector(`[data-module-id="${island.id}"]`)!;
    const cap = [...row.parentElement!.querySelectorAll(".rd-leg")].find((leg) => leg.textContent!.includes("Capacity"));
    expect(cap!.querySelector(".rd-val")!.textContent).toBe("0/1");
    expect(row.parentElement!.textContent).not.toContain("idle — earns nothing");
  });
});
