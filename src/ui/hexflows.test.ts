// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import type { App } from "./app";
import { createAppFixture, clickCell } from "./testing/app-fixture";
import { give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { endSession, startSession } from "../engine/actions";
import { displayedRates } from "../engine/economy";
import type { MutatorFamily, MutatorInstance, Rarity } from "../engine/types";
import { renderHexDetail } from "./hexdetail";
import { formatNumber } from "./format";

// The Hex detail's wave connections (issue #297): directional waves in
// semantic registers — the mutator's cross-layer effect pointing at the
// layer it lands on, incoming charge and the chord bonus entering the
// module face's vertices — with the relationship calculations living in
// the disclosures. Solid waves are live relationships; quiet dashed ones
// inert, the meaning preserved without color. Empty and locked places
// imply nothing; the breakdowns multiply out in the engine's own terms
// and state the module's outcome once.

const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(() => fixture.release());

const detail = () => document.getElementById("hex-detail")!;
const trigger = (kind: "mutator" | "charge" | "chord") =>
  detail().querySelector<HTMLButtonElement>(`#detail-flow-${kind}`)!;
const breakdownOf = (node: HTMLButtonElement) =>
  document.getElementById(node.getAttribute("aria-describedby")!)!;

function mut(id: string, family: MutatorFamily, rarity: Rarity, pos: { q: number; r: number } | null): MutatorInstance {
  return { id, family, rarity, pos };
}

// An era past the entry: one slot hosting the opening synth, Arete for
// the ladder, the tray twin waiting.
function seedEra(): void {
  const s = app.state;
  s.mode = "upgrade";
  s.catalogEntryOwned = true;
  s.arete = 20;
  s.mutatorSlots = [hex(0, 0)];
  s.mutators = [mut("mu1", "power", "common", hex(0, 0)), mut("mu2", "power", "common", null)];
  app.render();
}

describe("the mutator's cross-layer wave (issue #297)", () => {
  it("a live mutator draws the solid wave toward the module layer, breakdown folding it into power", () => {
    seedEra();
    clickCell(0, 0);
    const node = trigger("mutator");
    expect(node).not.toBeNull();
    expect(node.classList.contains("flow-active")).toBe(true);
    expect(node.getAttribute("aria-label")).toContain("Power mutator effect");
    // The wave itself: svg, no figures at a glance (the numbers ride the
    // disclosure), and the arrow points at the affected layer below.
    expect(node.querySelector("svg")).not.toBeNull();
    expect(node.textContent ?? "").not.toMatch(/[0-9]/);
    const snap = displayedRates(app.state, true);
    const body = breakdownOf(node);
    // The contribution: the mutator's magnitude and the power term it
    // folds into — the engine's own figures, never a second source.
    expect(body.textContent).toContain("Power mutator · common");
    expect(body.textContent).toContain("+50%");
    expect(body.textContent).toContain("Folded into power");
    expect(body.textContent).toContain(`${formatNumber(1)} → ${formatNumber(1.5)}`);
    // The outcome stated once, as the module's actual ν/s.
    const value = snap.contributions.get("m1")!.value;
    expect(value).toBeCloseTo(0.15, 5);
    expect(body.textContent).toContain("Final output");
    expect(body.textContent).toContain(`+${formatNumber(value)} ν/s`);
  });

  it("a hostless mutator draws the quiet dashed wave and promises no outcome", () => {
    seedEra();
    app.state.mutatorSlots.push(hex(0, 1));
    app.state.mutators[1]!.pos = hex(0, 1);
    app.render();
    clickCell(0, 1);
    const node = trigger("mutator");
    expect(node.classList.contains("flow-inert")).toBe(true);
    expect(node.getAttribute("aria-label")).toContain("inert · no host");
    const body = breakdownOf(node);
    expect(body.textContent).toContain("inert · no host");
    // No module, no outcome row: the empty place implies nothing.
    expect(body.textContent).not.toContain("Final output");
    // No incoming connections stand on an empty place.
    expect(trigger("charge")).toBeNull();
    expect(trigger("chord")).toBeNull();
  });

  it("resonance on a chordless host draws the dashed wave beside the module's own outcome", () => {
    seedEra();
    app.state.mutators[0]!.family = "resonance";
    app.render();
    clickCell(0, 0);
    const node = trigger("mutator");
    expect(node.classList.contains("flow-inert")).toBe(true);
    expect(breakdownOf(node).textContent).toContain("inert · no chord");
    // The host still speaks its outcome — the verdict is the mutator's,
    // not the module's.
    expect(breakdownOf(node).textContent).toContain("Final output");
  });

  it("no mutator, no wave: the stack carries no cross-layer connection", () => {
    app.render();
    clickCell(0, 0);
    expect(trigger("mutator")).toBeNull();
  });
});

describe("the incoming charge wave (issue #297)", () => {
  it("an uncharged receiver draws the quiet dashed wave", () => {
    app.render();
    clickCell(0, 0);
    const node = trigger("charge");
    expect(node.classList.contains("flow-inert")).toBe(true);
    expect(node.getAttribute("aria-label")).toContain("none now");
    const body = breakdownOf(node);
    expect(body.textContent).toContain("Incoming charge");
    expect(body.textContent).toContain("⌁0");
    expect(body.textContent).toContain(`+${formatNumber(0.1)} ν/s`);
  });

  it("charged, the wave runs solid and the breakdown matches the authoritative pass", () => {
    give(app.state, "focusKeyed", hex(1, 0)).reserve = 100;
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(0, 0);
    const node = trigger("charge");
    expect(node.classList.contains("flow-active")).toBe(true);
    const snap = displayedRates(app.state, true);
    const strength = snap.chargeStrength.get("m1")!;
    expect(strength).toBe(1);
    const body = breakdownOf(node);
    expect(body.textContent).toContain(`⌁${formatNumber(strength)}`);
    expect(body.textContent).toContain("Charged empowerment");
    expect(body.textContent).toContain(`×${formatNumber(1.5)}`);
    // Calculation consistency: the result multiplies out exactly — base
    // term × the charge factor × the global boost legs the pass carries.
    const value = snap.contributions.get("m1")!.value;
    expect(value).toBeCloseTo(0.1 * 1.5 * snap.achievementBoost * snap.discoveryBoost, 9);
    expect(body.textContent).toContain(`+${formatNumber(value)} ν/s`);
    endSession(app.state);
  });

  it("the Blaster's breakdown names the conversion that replaces the charge factor", () => {
    give(app.state, "blaster", hex(0, 1));
    give(app.state, "focusKeyed", hex(1, 0)).reserve = 100;
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(0, 1);
    const body = breakdownOf(trigger("charge"));
    expect(body.textContent).toContain("⌁1");
    expect(body.textContent).toContain("Charge conversion");
    expect(body.textContent).toContain(`×${formatNumber(0.5)}`);
    endSession(app.state);
  });

  it("a generator is a source, not a receiver: no charge wave stands on it", () => {
    give(app.state, "focusKeyed", hex(1, 0)).reserve = 100;
    app.render();
    clickCell(1, 0);
    expect(trigger("charge")).toBeNull();
    // The wire never chords either: no chord wave on the source.
    expect(trigger("chord")).toBeNull();
  });
});

describe("the chord bonus wave (issue #297)", () => {
  it("a voice singing no chord draws the quiet dashed wave", () => {
    app.render();
    clickCell(0, 0);
    const node = trigger("chord");
    expect(node.classList.contains("flow-inert")).toBe(true);
    const body = breakdownOf(node);
    expect(body.textContent).toContain("inert · no chord");
    expect(body.textContent).toContain(`+${formatNumber(0.1)} ν/s`);
  });

  it("an octave sings a solid wave in the chord's own hue, broken down in the reserved terms", () => {
    give(app.state, "additive", hex(0, 1));
    app.render();
    clickCell(0, 0);
    const node = trigger("chord");
    expect(node.classList.contains("flow-active")).toBe(true);
    // The hue is the named chord's own — the chord row's grammar.
    expect(node.querySelector("svg")!.getAttribute("style")).toContain("--chord-octave");
    const snap = displayedRates(app.state, true);
    const contribution = snap.contributions.get("m1")!;
    expect(contribution.chordFactor).toBeGreaterThan(1);
    const body = breakdownOf(node);
    expect(body.textContent).toContain("Chord factor");
    expect(body.textContent).toContain(`×${formatNumber(contribution.chordFactor!)}`);
    if (contribution.formationQ !== 1) {
      expect(body.textContent).toContain("Formation");
      expect(body.textContent).toContain(`×${formatNumber(contribution.formationQ)}`);
    }
    expect(body.textContent).toContain("Octave");
    expect(body.textContent).toContain(`×${formatNumber(1.15)}`);
    expect(body.textContent).toContain(`+${formatNumber(contribution.value)} ν/s`);
  });

  it("a silent voice's chord breakdown states its factor once — it is the relationship", () => {
    give(app.state, "harmonizer", hex(0, 1));
    app.render();
    clickCell(0, 1);
    const snap = displayedRates(app.state, true);
    const body = breakdownOf(trigger("chord"));
    expect(trigger("chord").classList.contains("flow-active")).toBe(true);
    const harmonizer = app.state.modules.find((m) => m.type === "harmonizer")!;
    const factor = snap.contributions.get(harmonizer.id)!.chordFactor!;
    expect(factor).toBeGreaterThan(1);
    expect(body.textContent).toContain(`×${formatNumber(factor)}`);
    // The voice's factor IS the relationship here: the outcome row would
    // say it twice, so no second line stands in.
    expect(body.textContent).not.toContain("Chord voice");
    // A silent voice produces nothing of its own: no ν/s row stands in.
    expect(body.textContent).not.toContain("ν/s");
  });

  it("a charge mutator's fold reads beside the incoming charge it scales", () => {
    seedEra();
    app.state.mutators[0]!.family = "charge";
    give(app.state, "focusKeyed", hex(1, 0)).reserve = 100;
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(0, 0);
    const body = breakdownOf(trigger("charge"));
    expect(body.textContent).toContain("Charge mutator folded in");
    expect(body.textContent).toContain(`×${formatNumber(1.5)}`);
    // The mutator stays folded: the strength arrives already multiplied.
    const snap = displayedRates(app.state, true);
    expect(snap.chargeStrength.get("m1")).toBeCloseTo(1.5, 5);
    endSession(app.state);
  });
});

describe("the disclosures (issue #297)", () => {
  it("focus and tap open the full breakdown; Escape and tap-away dismiss it", () => {
    app.render();
    clickCell(0, 0);
    const node = trigger("charge");
    const body = breakdownOf(node);
    // Keyboard focus discloses…
    node.focus();
    expect(body.classList.contains("inst-show")).toBe(true);
    // …Escape dismisses without leaving the detail…
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(body.classList.contains("inst-show")).toBe(false);
    expect(app.ui.detail).not.toBeNull();
    // …a tap pins it open…
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(node.getAttribute("aria-expanded")).toBe("true");
    expect(body.classList.contains("inst-show")).toBe(true);
    // …and a tap anywhere else puts it away.
    detail().querySelector(".hex-detail-corner")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(node.getAttribute("aria-expanded")).toBe("false");
    expect(body.classList.contains("inst-show")).toBe(false);
  });

  it("every connection carries a named disclosure and generous hit-area rules", () => {
    give(app.state, "additive", hex(0, 1));
    seedEra();
    clickCell(0, 0);
    for (const kind of ["mutator", "charge", "chord"] as const) {
      const node = trigger(kind);
      expect(node.getAttribute("aria-describedby")).toBeTruthy();
      expect(breakdownOf(node).getAttribute("role")).toBe("tooltip");
      expect(node.getAttribute("aria-expanded")).toBe("false");
    }
    const css = readFileSync("src/ui/style.css", "utf8");
    expect(css).toMatch(/\.hex-flow-trigger\s*\{[^}]*min-height:\s*44px/);
    // The hit area's width: padding plus the wave's own box.
    expect(css).toMatch(/\.hex-flow-trigger\s*\{[^}]*padding:\s*2px 14px/);
    expect(css).toMatch(/\.hex-flow-trigger svg\s*\{[^}]*width:\s*60px/);
  });
});

describe("the states that imply nothing (issue #297)", () => {
  it("an empty owned place draws no connection at all", () => {
    app.render();
    clickCell(0, 1);
    expect(detail().querySelector("[data-flow]")).toBeNull();
    expect(detail().querySelector(".hex-flow-side")).toBeNull();
  });

  it("a locked Mutators layer never promises an effect", () => {
    app.render();
    expect(app.state.catalogEntryOwned).toBe(false);
    clickCell(0, 0);
    expect(trigger("mutator")).toBeNull();
    // The module's own incoming relationships still read.
    expect(trigger("charge")).not.toBeNull();
  });

  it("the spacer stays silent wire: no incoming waves", () => {
    give(app.state, "spacer", hex(0, 1));
    app.render();
    clickCell(0, 1);
    expect(trigger("charge")).toBeNull();
    expect(trigger("chord")).toBeNull();
    expect(trigger("mutator")).toBeNull();
  });
});

describe("wave motion and stillness (issue #297)", () => {
  it("the pulse rides live flow only, and reduced motion keeps the static wave", () => {
    const css = readFileSync("src/ui/style.css", "utf8");
    // The pulse path exists on every wave but paints nothing by default…
    give(app.state, "additive", hex(0, 1));
    app.render();
    clickCell(0, 0);
    expect(trigger("chord").querySelector(".flow-pulse")).not.toBeNull();
    // …motion keys to the readonly scene's active waves…
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*\.hex-detail-scene\.readonly \.flow-active \.flow-pulse\s*\{[^}]*animation:\s*flow-dash/,
    );
    // …and stays hidden outside it, so upgrade's projected waves stand still.
    expect(css).toMatch(/\.flow-pulse\s*\{[^}]*opacity:\s*0/);
  });

  it("a flow-arranged board's projected charge runs static solid — the same wave, no motion", () => {
    give(app.state, "focusKeyed", hex(1, 0)).reserve = 100;
    app.render();
    expect(app.state.mode).toBe("upgrade");
    clickCell(0, 0);
    // The projected basis carries the charge the faces preview; the wave
    // is solid, and the pulse's visibility rules stay keyed to flow.
    expect(trigger("charge").classList.contains("flow-active")).toBe(true);
  });
});

describe("live rebuild (issue #297)", () => {
  it("the chord wave flips with the factor even when the face readout holds still", () => {
    give(app.state, "harmonizer", hex(0, 1));
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(0, 1);
    const node = trigger("chord");
    expect(node.classList.contains("flow-active")).toBe(true);
    node.focus();
    // The harmonizer's face readout is its pitch — unchanged when the
    // chord factor drops — so the render key must carry the factor itself.
    const snap = displayedRates(app.state, true);
    const harmonizer = app.state.modules.find((m) => m.type === "harmonizer")!;
    snap.contributions.get(harmonizer.id)!.chordFactor = 1;
    renderHexDetail(app, snap, snap, "");
    const rebuilt = trigger("chord");
    expect(rebuilt.classList.contains("flow-inert")).toBe(true);
    expect(breakdownOf(rebuilt).textContent).toContain("inert · no chord");
    // The keyboard stayed with the connection through the rebuild.
    expect(document.activeElement).toBe(rebuilt);
    endSession(app.state);
  });
});
