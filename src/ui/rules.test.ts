// @vitest-environment happy-dom
// The module rules surface's content (issue #155): every launch module type
// carries its full effect rules and conditions, and the current values read
// straight off the engine — the same decomposition the rate details use, so
// the two surfaces can never disagree.
import { describe, expect, it } from "vitest";
import { MODULE_RULES, moduleValuesHtml, moduleValueRows, updateModuleRulesLive } from "./rules";
import { MODULE_TYPES } from "../engine/constants";
import { computeRates, modulePower } from "../engine/economy";
import { forgeThreshold } from "../engine/rolls";
import { cellNoteOf } from "../engine/lattice";
import { formatDuration } from "../engine/clock";
import { formatNumber } from "./format";
import { give, fresh } from "../engine/fixtures";
import { hex } from "../engine/hex";

describe("module rules prose", () => {
  it("every launch module type has rules and conditions", () => {
    for (const type of MODULE_TYPES) {
      const { rule, conditions } = MODULE_RULES[type];
      expect(rule.length, type).toBeGreaterThan(20);
      expect(conditions.length, type).toBeGreaterThan(0);
      for (const condition of conditions) {
        expect(condition.length, type).toBeGreaterThan(0);
      }
    }
  });

  it("the numbers in the prose read off BALANCE, not hardcodes", () => {
    expect(MODULE_RULES.infusor.rule).toContain("+20%");
    expect(MODULE_RULES.conditional.rule).toContain("+10% per chord instance");
    expect(MODULE_RULES.focusKeyed.rule).toContain("10% of that session's credited practice");
  });
});

describe("module current values", () => {
  it("a synthesizer's rows carry the rate details' legs, multiplying out to the final figure", () => {
    const state = fresh();
    give(state, "conditional", hex(1, 0)); // a Fifth with the opening synth
    give(state, "infusor", hex(-1, 0));
    give(state, "focusKeyed", hex(0, 1));
    state.chargeWindow = 300;
    const snapshot = computeRates(state, true);
    const m1 = state.modules[0]!;
    const rows = moduleValueRows(state, m1, snapshot);
    const value = (label: string): string => rows.find((row) => row.label === label)!.value;
    const contribution = snapshot.contributions.get(m1.id)!;
    expect(value("Final")).toBe(`+${formatNumber(contribution.value)} ν/s`);
    // The legs multiply back to the final figure exactly (ADR-0036's shape):
    // the displayed infusor and achievement figures are percents, so their
    // factors read 1 + percent.
    const raw = (label: string): number => Number.parseFloat(value(label).replace(/[^0-9.]/g, ""));
    const [base, chd, inf, chg, achPct] = ["Base", "Chords", "Infusor", "Charge", "Achievements"].map(raw);
    const product = base * chd * (1 + inf / 100) * chg * (1 + achPct / 100);
    expect(Math.abs(product - contribution.value)).toBeLessThan(0.02);
    // Every leg mounts a live slot the tick fills.
    for (const label of ["Final", "Base", "Chords", "Infusor", "Charge", "Achievements"]) {
      expect(rows.find((row) => row.label === label)!.slot, label).toMatch(/^mr-/);
    }
  });

  it("the generator's rows read its output strength and its banked window", () => {
    const state = fresh();
    const gen = give(state, "focusKeyed", hex(0, 1));
    state.chargeWindow = 300;
    const rows = moduleValueRows(state, gen, computeRates(state, false));
    expect(rows.find((row) => row.label === "Output strength")!.value).toBe(`⌁${modulePower(gen)}`);
    const win = rows.find((row) => row.label === "Charge window")!;
    expect(win.value).toBe("5 min banked");
    expect(win.slot).toBe("mr-win");
  });

  it("the forge's rows read the player-wide meter, never ν/s", () => {
    const state = fresh();
    const forge = give(state, "forge", hex(0, 1));
    state.forge.progress = 24.4;
    const rows = moduleValueRows(state, forge, computeRates(state, false));
    const progress = rows.find((row) => row.label === "Progress")!;
    expect(progress.value).toBe(`24 / ${Math.round(forgeThreshold(state.forge.earned))}`);
    expect(progress.slot).toBe("mr-prog");
    expect(rows.find((row) => row.label === "Fill rate")!.value).toBe("waits for charge");
  });

  it("the infusor's rows read its live uplift and the spacer's rows read its wire", () => {
    const state = fresh();
    const infusor = give(state, "infusor", hex(-1, 0));
    const spacer = give(state, "spacer", hex(5, 0));
    const snapshot = computeRates(state, false);
    const infusorRows = moduleValueRows(state, infusor, snapshot);
    expect(infusorRows.find((row) => row.label === "Uplift now")!.value).toBe("+20% to adjacent");
    expect(infusorRows.find((row) => row.label === "Received charge")!.value).toBe("none");
    const spacerRows = moduleValueRows(state, spacer, snapshot);
    expect(spacerRows.find((row) => row.label === "Wires")!.value).toBe(cellNoteOf(spacer.pos!));
  });

  it("every note slot has its note — the tick's writer can fill a mounted slot, never a missing one", () => {
    for (const type of MODULE_TYPES) {
      const state = fresh();
      const module = give(state, type, hex(0, 1));
      const rows = moduleValueRows(state, module, computeRates(state, true));
      for (const row of rows) {
        if (row.noteSlot) expect(row.note, `${type}:${row.label}`).toBeDefined();
      }
    }
  });

  it("the mounted markup fills through the tick's in-place writer", () => {
    const state = fresh();
    const gen = give(state, "focusKeyed", hex(0, 1));
    state.chargeWindow = 130;
    const snapshot = computeRates(state, false);
    const scope = document.createElement("div");
    scope.innerHTML = moduleValuesHtml(state, gen, snapshot);
    updateModuleRulesLive(scope, state, gen, snapshot);
    expect(scope.querySelector('[data-live="mr-win"]')!.textContent).toBe(`${formatDuration(130)} banked`);
    expect(scope.querySelector('[data-live="mr-out"]')!.textContent).toBe(`⌁${modulePower(gen)}`);
    // Rows without a slot print statically — nothing fills them.
    expect(scope.querySelectorAll("[data-live]").length).toBe(2);
  });
});
