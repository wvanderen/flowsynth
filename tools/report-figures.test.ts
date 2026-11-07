import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CENTURY_BLOCK_ID,
  EvidenceError,
  LATER_ERA_BLOCK_ID,
  centuryFigures,
  figuresCurrent,
  generatedBlock,
  laterEraFigures,
  renderCenturyBlock,
  renderLaterEraBlock,
  spliceGeneratedBlock,
  validateCenturyEvidence,
  validateLaterEraEvidence,
  type CenturyInputs,
  type CenturyReportJson,
  type LaterEraInputs,
  type LaterEraReportJson,
} from "./report-figures";

// Issue #512: the later-era and century numerical report summaries are
// generated from their recorded JSON — never hand-copied, never
// simulated — so tables, counts, and mechanical verdicts cannot drift
// from the evidence after a rerun. The recorded JSON in docs/ is the
// source of numerical truth; every literal below was read off that
// evidence independently of the generator.

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../docs/${name}.json`, import.meta.url), "utf8"));
const readDoc = (name: string) =>
  readFileSync(new URL(`../docs/${name}`, import.meta.url), "utf8");

const laterEraInputs = (): LaterEraInputs => ({
  slices: (["25-support", "25-combat", "25-ignoring", "60-support", "60-combat", "60-ignoring"] as const).map(
    (suffix) => read(`later-era-slice-${suffix}`),
  ),
  probe: read("later-era-probe"),
});
const laterEraReport = (): LaterEraReportJson => read("later-era-results");

const centuryInputs = (): CenturyInputs => ({
  slices: (["25-prompt", "25-pushing", "25-support", "25-combat", "25-ignoring", "60-prompt", "60-pushing", "60-support", "60-combat", "60-ignoring"] as const).map(
    (suffix) => read(`century-slice-${suffix}`),
  ),
  fixtures: { raw: read("century-fixture-raw"), collectionReset: read("century-fixture-collection-reset") },
});
const centuryReport = (): CenturyReportJson => read("century-calibration-results");

describe("later-era figures from recorded evidence", () => {
  it("validates the committed report and its six slices plus the probe as one consistent artifact set", () => {
    expect(() => validateLaterEraEvidence(laterEraReport(), laterEraInputs())).not.toThrow();
  });

  it("derives the recorded distribution, totals, and mechanical reads exactly", () => {
    const figures = laterEraFigures(laterEraReport(), laterEraInputs());
    expect(figures.walks).toBe(48);
    expect(figures.slices).toHaveLength(6);
    expect(figures.totals).toEqual({ inWindow: 64, under: 7, over: 48, open: 12 });
    expect(figures.closedEras).toBe(119);
    expect(figures.completeWalks).toBe(35);
    expect(figures.budgetWalks).toBe(13);
    expect(figures.fasterReturn).toEqual({ faster: 104, notFaster: 15 });
    expect(figures.rebuilding).toEqual({ withinHalf: 12, overHalf: 107 });
    expect(figures.newTerritoryMajorities).toBe(0);
    expect(figures.noGrantWalks).toBe(48);
    expect(figures.routes).toEqual({
      frontiers: [2, 6, 9, 11],
      orders: 20,
      advanced: 20,
      demonstratedFrontiers: 4,
    });
  });

  it("renders the committed generated block byte-for-byte from the evidence alone", () => {
    const doc = readDoc("later-era-productivity.md");
    const rendered = renderLaterEraBlock(laterEraFigures(laterEraReport(), laterEraInputs()));
    expect(figuresCurrent(doc, LATER_ERA_BLOCK_ID, rendered)).toBe(true);
    expect(doc).toContain(generatedBlock(LATER_ERA_BLOCK_ID, rendered));
  });

  it("names the unmet criteria and never promotes a documented miss to an approved exception", () => {
    const rendered = renderLaterEraBlock(laterEraFigures(laterEraReport(), laterEraInputs()));
    expect(rendered).toContain("New-territory majority");
    expect(rendered).toContain("0 of 119");
    expect(rendered).toContain("UNMET");
    expect(rendered).toContain("Rebuilding");
    expect(rendered).toContain("107 of 119");
    expect(rendered).toContain("never an approved exception");
    expect(rendered).toContain("no simulation");
  });
});

describe("century figures from recorded evidence", () => {
  it("validates the committed legacy report, its ten slices, and both fixture continuations", () => {
    expect(() => validateCenturyEvidence(centuryReport(), centuryInputs())).not.toThrow();
  });

  it("derives the recorded distribution with per-slice banks and frontiers exactly", () => {
    const figures = centuryFigures(centuryReport(), centuryInputs());
    expect(figures.walks).toBe(80);
    expect(figures.slices).toHaveLength(10);
    expect(figures.totals).toEqual({ inWindow: 256, under: 203, over: 256, open: 78, banks: 715 });
    expect(figures.promptBanks).toEqual({ banks: 289, nonzeroClaims: 3, maxFrontier: 3 });
    expect(figures.claimPushingBanks.nonzeroClaims).toBe(426);
    expect(figures.claimPushingBanks.banks).toBe(426);
    expect(figures.walkBanksMin).toBe(2);
    expect(figures.walkBanksMax).toBe(14);
  });

  it("renders the committed generated block byte-for-byte from the evidence alone", () => {
    const doc = readDoc("century-calibration.md");
    const rendered = renderCenturyBlock(centuryFigures(centuryReport(), centuryInputs()));
    expect(figuresCurrent(doc, CENTURY_BLOCK_ID, rendered)).toBe(true);
    expect(doc).toContain(generatedBlock(CENTURY_BLOCK_ID, rendered));
  });

  it("records legacy absence as absence and keeps the boundary-aware gap verdict incomplete", () => {
    const rendered = renderCenturyBlock(centuryFigures(centuryReport(), centuryInputs()));
    expect(rendered).toContain("8790c6cb");
    expect(rendered).toContain("no runtime or timezone metadata");
    expect(rendered).toContain("no per-unit provenance");
    expect(rendered).toContain("no measurementVersion");
    expect(rendered).toContain("incomplete");
    expect(rendered).toContain("start and terminal waits were not measured");
    expect(rendered).toContain("never an approved exception");
    expect(rendered).toContain("no simulation");
    // The sparse seeds ride the matrix rows; the continuations stay outside them.
    expect(rendered).toContain("11, 42");
    expect(rendered).toContain("outside the 80 matrix rows");
    // The representative 60-minute support walks, seed by seed.
    expect(rendered).toContain("0:8/in");
  });

  it("reads the representative support walks the recorded rows carry", () => {
    const figures = centuryFigures(centuryReport(), centuryInputs());
    const seed23 = figures.representativeSupport60.find((row) => row.seed === 23);
    expect(seed23?.banks).toBe(9);
    expect(seed23?.frontier).toBe(25);
    expect(seed23?.spans).toBe(
      "0:8/in · 1:5/in · 2:6/in · 3:8/in · 4:10/in · 5:11/over · 6:10/in · 7:11/over · 8:14/over · open",
    );
  });
});

describe("cheap validation rejects corrupted evidence", () => {
  it("rejects a duplicate matrix row", () => {
    // Deliberate in-memory corruption of a parsed copy; `any` keeps the
    // corruption itself typeless so the validator is what judges it.
    const report: any = laterEraReport();
    report.runs.push(report.runs[0]);
    expect(() => validateLaterEraEvidence(report, laterEraInputs())).toThrow(EvidenceError);
    let message = "";
    try {
      validateLaterEraEvidence(report, laterEraInputs());
    } catch (error) {
      message = (error as EvidenceError).message;
    }
    expect(message).toMatch(/duplicate/i);
  });

  it("rejects an incomplete matrix missing a declared walk", () => {
    const report: any = laterEraReport();
    report.runs.splice(3, 1);
    expect(() => validateLaterEraEvidence(report, laterEraInputs())).toThrow(/expected 48 recorded walks|missing/);
  });

  it("rejects distribution totals inconsistent with the recorded eras", () => {
    const report: any = laterEraReport();
    report.distributions[0].counts.inWindow += 1;
    expect(() => validateLaterEraEvidence(report, laterEraInputs())).toThrow(/inconsistent/i);
  });

  it("rejects a slice whose provenance disagrees with the composed report", () => {
    const inputs: any = laterEraInputs();
    inputs.slices[2].source.engineSource = "deadbeef";
    expect(() => validateLaterEraEvidence(laterEraReport(), inputs)).toThrow(/provenance|fingerprint/i);
  });

  it("rejects a report whose composed fingerprint disagrees with its own inputs", () => {
    const report: any = laterEraReport();
    report.source.engineSource = "00000000";
    expect(() => validateLaterEraEvidence(report, laterEraInputs())).toThrow(/provenance|fingerprint/i);
  });

  it("rejects a route flag the recorded forwards contradict", () => {
    const inputs: any = laterEraInputs();
    inputs.probe.banks[0].routeDemonstrated = false;
    expect(() => validateLaterEraEvidence(laterEraReport(), inputs)).toThrow(/route/i);
  });

  it("rejects a century matrix with a duplicated walk", () => {
    const report: any = centuryReport();
    report.runs.push(report.runs[1]);
    expect(() => validateCenturyEvidence(report, centuryInputs())).toThrow(/duplicate/i);
  });

  it("rejects a century matrix missing a declared walk", () => {
    const report: any = centuryReport();
    report.runs.splice(7, 1);
    expect(() => validateCenturyEvidence(report, centuryInputs())).toThrow(/expected 80 recorded walks|missing/);
  });

  it("rejects century distribution totals inconsistent with the recorded eras", () => {
    const report: any = centuryReport();
    report.distributions[4].counts.over += 1;
    expect(() => validateCenturyEvidence(report, centuryInputs())).toThrow(/inconsistent/i);
  });

  it("rejects a supplied-board continuation pooled into the matrix", () => {
    const report: any = centuryReport();
    report.runs.push({ ...centuryInputs().fixtures.raw.row, kind: "continuation" });
    expect(() => validateCenturyEvidence(report, centuryInputs())).toThrow(/continuation|pooled/i);
  });

  it("rejects century provenance disagreement between report and slice", () => {
    const inputs: any = centuryInputs();
    inputs.slices[6].source.engineSource = "12345678";
    expect(() => validateCenturyEvidence(centuryReport(), inputs)).toThrow(/provenance|fingerprint/i);
  });
});

describe("stale generated figures and splice integrity", () => {
  it("flags a committed block that no longer matches the regenerated figures", () => {
    const doc = readDoc("later-era-productivity.md");
    const rendered = renderLaterEraBlock(laterEraFigures(laterEraReport(), laterEraInputs()));
    const tampered = doc.replace("104 re-walk", "999 re-walk");
    expect(tampered).not.toBe(doc);
    expect(figuresCurrent(tampered, LATER_ERA_BLOCK_ID, rendered)).toBe(false);
  });

  it("replaces only the fenced region and preserves the handwritten interpretation around it", () => {
    const doc = readDoc("later-era-productivity.md");
    const rendered = renderLaterEraBlock(laterEraFigures(laterEraReport(), laterEraInputs()));
    const spliced = spliceGeneratedBlock(doc, LATER_ERA_BLOCK_ID, rendered);
    expect(spliced).toBe(doc); // regenerating the current block is a no-op
    const altered = spliceGeneratedBlock(doc, LATER_ERA_BLOCK_ID, rendered + "\n regenerated at a later commit.");
    expect(altered).toContain("regenerated at a later commit.");
    expect(altered.replace(generatedBlock(LATER_ERA_BLOCK_ID, rendered + "\n regenerated at a later commit."), ""))
      .toBe(doc.replace(generatedBlock(LATER_ERA_BLOCK_ID, rendered), ""));
    // The handwritten paragraphs outside the block survive untouched.
    expect(altered).toContain("These results do not satisfy the new-frontier-effort requirement.");
  });

  it("refuses to splice when the markers are missing or duplicated", () => {
    const doc = readDoc("later-era-productivity.md");
    expect(() => spliceGeneratedBlock("no markers here", LATER_ERA_BLOCK_ID, "x")).toThrow(/marker/i);
    const doubled = doc + generatedBlock(LATER_ERA_BLOCK_ID, "x");
    expect(() => spliceGeneratedBlock(doubled, LATER_ERA_BLOCK_ID, "x")).toThrow(/marker/i);
  });
});

describe("generation performs no simulation", () => {
  it("imports no engine module — the generator cannot run a walk", async () => {
    const source = readFileSync(new URL("./report-figures.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "\.\.\/src\/engine\//);
    expect(source).not.toMatch(/from "\.\/(first-prestige|later-eras|century)"/);
    expect(source).not.toMatch(/runPlaythrough|continuePlaythrough|runCenturyWalk/);
  });
});
