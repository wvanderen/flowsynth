import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, recordSummaryReflection, startSession } from "./actions";
import { fresh, give, stubRng } from "./fixtures";
import { SAVE_VERSION } from "./constants";
import { deserialize, serialize } from "./save";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import { generateOffer } from "./rolls";
import { hex } from "./hex";

describe("persistence", () => {
  it("round-trips the full game state", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "forge", hex(0, 1));
    s.nous = 123.456;
    s.forge.progress = 42.5;
    startSession(s, 600);
    advance(s, 123, stubRng(new Array(6).fill(0.4)));
    const text = serialize(s, 1_000);
    const loaded = deserialize(text);
    expect(loaded.error).toBeUndefined();
    expect(serialize(loaded.state!, 1_000)).toBe(text);
  });

  it("saves carry the current version", () => {
    const parsed = JSON.parse(serialize(fresh()));
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.version).toBe(5);
  });

  it("v5 saves from before cell purchases default cellsBought to zero", () => {
    const file = JSON.parse(serialize(fresh()));
    delete file.state.cellsBought;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.cellsBought).toBe(0);
  });

  it("v5 saves from before the activation ladder default the ladder state", () => {
    const file = JSON.parse(serialize(fresh()));
    delete file.state.activatedApps;
    delete file.state.goalCapacityBought;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.activatedApps).toEqual([]);
    expect(loaded.state!.goalCapacityBought).toBe(0);
  });

  it("remaps the retired generator type to the focus-keyed generator (ADR-0018)", () => {
    const s = fresh();
    give(s, "focusKeyed", hex(1, 0));
    const legacy = serialize(s, 1_000).replaceAll('"type": "focusKeyed"', '"type": "generator"');
    const loaded = deserialize(legacy);
    expect(loaded.error).toBeUndefined();
    const types = loaded.state!.modules.map((m) => m.type as string);
    expect(types).not.toContain("generator");
    expect(types.filter((t) => t === "focusKeyed")).toHaveLength(1);
  });

  it("remaps retired generator roll candidates waiting in the bank", () => {
    const s = fresh();
    s.forge.earned = 1;
    s.bankedRolls.push(generateOffer(s, stubRng(new Array(6).fill(0.5))));
    const legacy = serialize(s, 1_000).replaceAll('"type": "focusKeyed"', '"type": "generator"');
    const loaded = deserialize(legacy);
    expect(loaded.error).toBeUndefined();
    for (const offer of loaded.state!.bankedRolls) {
      for (const candidate of offer.candidates) {
        expect(candidate.type as string).not.toBe("generator");
      }
    }
  });

  it("shelf keys added after a save default to unpurchased", () => {
    const file = JSON.parse(serialize(fresh()));
    delete file.state.purchased.additive;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.purchased.additive).toBe(false);
  });

  it("resuming from a mid-flow save does not duplicate rewards", () => {
    const build = () => {
      const s = fresh();
      give(s, "forge", hex(1, 0));
      give(s, "focusKeyed", hex(2, 0));
      s.chargeWindow = 600;
      startSession(s, 600);
      return s;
    };

    const straight = build();
    advance(straight, 400);

    const split = build();
    advance(split, 150);
    const reloaded = deserialize(serialize(split))!;
    const restored = reloaded.state!;
    advance(restored, 250);

    expect(restored.nous).toBeCloseTo(straight.nous, 6);
    expect(restored.forge.progress).toBeCloseTo(straight.forge.progress, 6);
  });

  it("rejects v4 saves at the v5 boundary with a clear message (ADR-0017)", () => {
    const s = fresh();
    const v4 = serialize(s).replace(`"version": ${SAVE_VERSION}`, '"version": 4');
    const result = deserialize(v4);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/older version/i);
    expect(result.state).toBeUndefined();
  });

  it("rejects every older version; there is no migrate chain", () => {
    for (const version of [1, 2, 3, 4]) {
      const text = serialize(fresh()).replace(`"version": ${SAVE_VERSION}`, `"version": ${version}`);
      const result = deserialize(text);
      expect(result.error, `v${version}`).toBeDefined();
      expect(result.state, `v${version}`).toBeUndefined();
    }
  });

  it("rejects corrupt, foreign, and future-version saves", () => {
    expect(deserialize("{nope").error).toBeDefined();
    expect(deserialize('{"app":"other","version":5}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":99,"state":{}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":5,"state":{"mode":"weird"}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":5}').error).toBeDefined();
  });

  it("v5 saves from before trust accounting default the session ledger (ADR-0019)", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 30);
    const file = JSON.parse(serialize(s, 1_000));
    delete file.state.session.accounting;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.session!.accounting.creditedSeconds).toBe(0);
    expect(loaded.state!.session!.accounting.poolSeconds).toBe(0);
    expect(loaded.state!.session!.accounting.bucketNous).toBe(0);
    expect(loaded.state!.session!.accounting.pendingAwaySeconds).toBe(0);
    expect(loaded.state!.session!.accounting.events).toEqual([]);
  });

  it("saves from before the signals and preferences default leniently (§4–5)", () => {
    const s = fresh();
    startSession(s, 600);
    const file = JSON.parse(serialize(s, 1_000));
    delete file.state.muted;
    delete file.state.notificationAsked;
    delete file.state.session.targetSignaled;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.muted).toBe(false);
    expect(loaded.state!.notificationAsked).toBe(false);
    expect(loaded.state!.session!.targetSignaled).toBe(false);
  });

  it("the retired reconcile dialog's frozen gap is dropped at load (ADR-0019)", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 30);
    const file = JSON.parse(serialize(s, 1_000));
    file.state.pendingGap = { seconds: 600, detectedAt: 1_000 };
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect((loaded.state as unknown as Record<string, unknown>).pendingGap).toBeUndefined();
  });

  it("summaries from before the close-out numbers default leniently (§8)", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 60);
    endSession(s, 5_000);
    const file = JSON.parse(serialize(s, 1_000));
    delete file.state.summary.plannedTarget;
    delete file.state.summary.honestyEvents;
    delete file.state.summary.reflection;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.summary!.plannedTarget).toBeNull();
    expect(loaded.state!.summary!.honestyEvents).toEqual([]);
    expect(loaded.state!.summary!.reflection).toBeNull();
  });

  it("a malformed reflection field loads absent rather than half-shaped", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 60);
    endSession(s, 5_000);
    recordSummaryReflection(s, { slider: 4 });
    const file = JSON.parse(serialize(s, 1_000));
    file.state.summary.reflection = { text: 7 };
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.summary!.reflection).toBeNull();
  });

  it("an unseen summary, its events, and its reflection survive a reload together (§8)", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    applyGap(s, 300, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "missed");
    endSession(s, 5_000);
    recordSummaryReflection(s, { text: "drifted" });
    expect(s.summary!.seen).toBe(false);
    const loaded = deserialize(serialize(s, 1_000));
    expect(loaded.error).toBeUndefined();
    const summary = loaded.state!.summary!;
    expect(summary.seen).toBe(false);
    expect(summary.honestyEvents).toEqual([{ awaySeconds: 300, outcome: "missed" }]);
    expect(summary.reflection).toEqual({ text: "drifted", slider: 3 });
  });
});
