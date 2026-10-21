// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { App } from "./app";
import { BALANCE } from "../engine/constants";
import { STORAGE_KEY } from "../engine/save";
import { cellCost } from "../engine/economy";
import { startSession } from "../engine/actions";
import { give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { formatInt } from "./format";
import { createAppFixture } from "./testing/app-fixture";

// catalog rendering and interaction on the production HTML skeleton.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

// Read surface copy without the hidden glossary bodies.
function surfaceText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll(".inst-tip-body").forEach((body) => body.remove());
  return copy.textContent!;
}

beforeEach(() => {
  localStorage.clear();
  app = boot();
});
afterEach(() => fixture.release());

describe("the catalog", () => {
  it("a shelf purchase stays in the catalog and lands in inventory", () => {
    app.state.nous = BALANCE.shelfPrices.generator;
    app.openModal("catalog");
    document.querySelector<HTMLButtonElement>('[data-buy="generator"]')!.click();
    expect(app.ui.modal).toBe("catalog");
    const generator = app.state.modules.find((m) => m.type === "focusKeyed")!;
    expect(generator.pos).toBeNull();
    expect(app.state.purchased.generator).toBe(true);
  });

  it("carries no cell row — cells arm from the dock's Add, never a sheet row", () => {
    app.openModal("catalog");
    const modal = document.getElementById("modal-content")!;
    expect(document.getElementById("buy-cell")).toBeNull();
    expect(modal.textContent).not.toContain("Board cell");
    expect(modal.textContent).not.toContain("Cells");
    expect(modal.textContent).not.toContain("Each purchase raises the next price.");
  });

  it("shelf rows carry the simplified module preview and one description line (issue #310 steering)", () => {
    app.openModal("catalog");
    const modal = document.getElementById("modal-content")!;
    const rows = [...modal.querySelectorAll<HTMLElement>(".catalog-row")].filter((r) => r.querySelector("[data-buy]"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.querySelector(".module-preview svg")).not.toBeNull();
    // The Flywheel's one line names what the purchase does.
    const generator = rows.find((r) => r.textContent!.includes("Flywheel"))!;
    expect(surfaceText(generator)).toContain("Banks focus into a charge reserve — modest note and goal credit");
    expect(generator.querySelector(".term-trigger")!.textContent).toBe("charge");
    // The trailing acquisition paragraph is gone, and no gloss rides the
    // toggle either — the face carries no furniture copy.
    expect(modal.querySelector(".catalog-note")).toBeNull();
    expect(modal.querySelector(".catalog-toggle .inst-tip")).toBeNull();
  });

  it("omits the activation section while the ladder rests empty — no telegraph, no pricing", () => {
    app.openModal("catalog");
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector(".catalog-activations")).toBeNull();
    expect(modal.textContent).not.toContain("Activations");
    expect(modal.querySelectorAll("[data-activate]")).toHaveLength(0);
    expect(modal.textContent).not.toContain("activate");
  });

  it("carries no balance and no second title — the ledgers own the figures (issue #271)", () => {
    app.state.nous = 1_234_567;
    app.openModal("catalog");
    const sheet = document.getElementById("modal-content")!;
    // The balance line is gone: the sheet repeats no figure the ledger reads.
    expect(sheet.querySelector("p.lead")).toBeNull();
    expect(sheet.textContent).not.toContain("available");
    // And the face switch is the sheet's only name — no CATALOG eyebrow.
    expect(sheet.querySelector(".eyebrow")).toBeNull();
    expect(sheet.textContent).not.toContain("CATALOG");
  });
});

describe("the catalog door (issue #271)", () => {
  const switchFace = (face: "nous" | "arete"): void =>
    document.querySelector<HTMLButtonElement>(`[data-catalog-face="${face}"]`)!.click();

  function bankFirstArete(): void {
    // The first World-eligible claim (issue #425): the entry's two Arete.
    app.state.eraEarned = BALANCE.world.entryNous;
    app.render();
    app.openLedger("arete");
    document.getElementById("prestige-door")!.click();
    document.getElementById("prestige-confirm")!.click();
    expect(app.state.arete).toBe(2);
  }

  it("the face switch reads ν nous / ◇ Arete / scrap mark, and names the dialog without a duplicated title", () => {
    app.openModal("catalog");
    const sheet = document.getElementById("modal-content")!;
    const tabs = [...sheet.querySelectorAll<HTMLButtonElement>(".catalog-face-tab")];
    expect(tabs).toHaveLength(3);
    expect(tabs[0]!.getAttribute("data-catalog-face")).toBe("nous");
    expect(tabs[0]!.textContent).toContain("nous");
    expect(tabs[0]!.querySelector(".mono")!.textContent).toBe("ν");
    expect(tabs[1]!.getAttribute("data-catalog-face")).toBe("arete");
    expect(tabs[1]!.textContent).toContain("Arete");
    expect(tabs[1]!.querySelector("svg")).not.toBeNull();
    expect(tabs[2]!.getAttribute("data-catalog-face")).toBe("scrap");
    expect(tabs[2]!.textContent).toContain("scrap");
    expect(tabs[2]!.querySelector("svg")).not.toBeNull();
    // The switch carries the dialog's accessible name — the door's word.
    expect(document.getElementById("modal-title")!.getAttribute("aria-label")).toBe("Catalog");
  });

  it("the scrap face sells the Draft Loom and the special drafts; the door never lands on it", () => {
    // The mode-wins door names nous or arete only — the scrap face is a
    // switch-reachable stop (2026-10-18 feedback).
    app.state.mode = "upgrade";
    app.openModal("catalog");
    expect(app.ui.catalogFace).toBe("nous");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="scrap"]')!.click();
    expect(app.ui.catalogFace).toBe("scrap");
    const sheet = document.getElementById("modal-content")!;
    const heads = [...sheet.querySelectorAll(".catalog-sections h2")].map((n) => n.textContent);
    expect(heads).toEqual(["Forge Upgrades", "Special Drafts"]);
    const names = [...sheet.querySelectorAll(".catalog-row h3")].map((n) => n.textContent);
    expect(names).toEqual(["Draft Loom", "Jacquard Card", "Silk Warp", "Plied Weft"]);
    // The rows sell in the shared grammar: note text left, price right.
    expect(sheet.querySelector(".catalog-row .price.scrap")).not.toBeNull();
    // No info icons: the rows carry name, note, and price alone.
    expect(sheet.querySelectorAll(".loom-tip")).toHaveLength(0);
    for (const trigger of sheet.querySelectorAll(".inst-tip-trigger")) {
      expect(trigger.classList.contains("term-trigger")).toBe(true);
    }
    // The scrap identity wears the scrap register, like ν and Arete wear theirs.
    expect(sheet.querySelector(".catalog-identity-scrap")).not.toBeNull();
  });

  it("the frame is fixed: a 620×600 clipped panel on desktop, a 74%-height bottom sheet on phone, body scrolls", () => {
    app.openModal("catalog");
    expect(document.getElementById("modal-content")!.classList.contains("catalog-modal")).toBe(true);
    const css = readFileSync("src/ui/style.css", "utf8");
    const frame = css.slice(css.indexOf(".modal.catalog-modal"), css.indexOf(".catalog-frame"));
    expect(frame).toContain("width: min(620px, 100%)");
    expect(frame).toContain("height: min(600px, 88vh)");
    expect(frame).toContain("overflow: hidden");
    expect(frame).toContain("clip-path: var(--inst-clip)");
    const phone = css.slice(css.indexOf("@media (max-width: 600px) {\n  .modal.catalog-modal"));
    expect(phone).toContain("height: 74vh");
    const body = css.slice(css.indexOf(".catalog-body"), css.indexOf(".catalog-sections"));
    expect(body).toContain("overflow-y: auto");
  });

  it("the arete tab stands open from the start: pre-prestige its face is the entry purchase screen (#292 review)", () => {
    // The door itself still follows the mode — module mode lands on ν.
    app.state.prestiges = 0;
    app.ui.catalogFace = "arete";
    app.openModal("catalog");
    expect(app.ui.catalogFace).toBe("nous");
    expect(document.querySelector('[data-buy="generator"]')).not.toBeNull();
    // The tab is live, not locked: switching shows the entry purchase
    // screen, its price muted — Arete cannot exist before the first reset.
    const areteTab = document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!;
    expect(areteTab.disabled).toBe(false);
    areteTab.click();
    expect(app.ui.catalogFace).toBe("arete");
    expect(document.querySelector(".entry-screen")).not.toBeNull();
    expect((document.getElementById("buy-arete-entry") as HTMLButtonElement).disabled).toBe(true);
    // And back — both faces answer at every progression state.
    switchFace("nous");
    expect(app.ui.catalogFace).toBe("nous");
    expect(document.querySelector('[data-buy="generator"]')).not.toBeNull();
  });

  it("pre-reveal the locked World face previews in figures; the entry screen stays on the arete face (#273)", () => {
    app.state.prestiges = 1;
    app.state.arete = 1;
    app.render();
    // The board legend's locked face previews, never flipping, never opening a sheet.
    const tab = document.querySelector<HTMLButtonElement>('#layer-legend [data-legend-layer="world"]')!;
    expect(tab.classList.contains("locked")).toBe(true);
    expect(tab.querySelector(".world-tab-lock")).not.toBeNull();
    tab.click();
    expect(app.ui.boardLayer).toBe("modules");
    expect(app.ui.modal).toBeNull();
    expect(document.getElementById("status")!.textContent).toContain("era-earned");
    // The tray sheet's switch wears the same locked face.
    app.openModal("inventory");
    const sheetTab = document.querySelector<HTMLButtonElement>('#modal-content [data-legend-layer="world"]')!;
    expect(sheetTab.classList.contains("locked")).toBe(true);
    expect(sheetTab.querySelector(".world-tab-lock")).not.toBeNull();
    app.closeModal();
    // The entry purchase screen itself stands on the arete face, reachable
    // through the door's face switch.
    app.openModal("catalog");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
    expect(document.querySelector(".entry-screen")).not.toBeNull();
  });

  it("a layer change cancels the armed actions with a toast; the Esc walk stays Esc (issue #426)", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.arete = 20;
    s.eraEarned = BALANCE.world.entryNous * 1.5;
    s.world.weapons.push({ id: "wp1", type: "chargeBlade", pos: null, store: 0, cooldown: 0, targetPriority: [] });
    app.render();
    // The cell arm dies at the layer change, named by the toast.
    app.armCellPurchase();
    expect(app.ui.buyingCell).toBe(true);
    app.setBoardLayer("world");
    expect(app.ui.buyingCell).toBe(false);
    expect(document.getElementById("status")!.textContent).toContain("cell purchase cancelled");
    const toast = document.getElementById("mode-toast")!;
    expect(toast.hidden).toBe(false);
    expect(toast.textContent).toContain("cell purchase cancelled");
    // A World placement arm dies the same way, walking back.
    app.worldArmTray("wp1");
    expect(app.ui.worldArmed).toBe("wp1");
    app.setBoardLayer("modules");
    expect(app.ui.worldArmed).toBeNull();
    expect(document.getElementById("status")!.textContent).toContain("World placement cancelled");
    expect(toast.textContent).toContain("World placement cancelled");
    // A module placement too — the tray-tile arm rides the same rule.
    const trayId = give(s, "additive", null).id;
    app.beginPlacing(trayId);
    expect(app.ui.placing).toBe(trayId);
    app.setBoardLayer("world");
    expect(app.ui.placing).toBeNull();
    expect(document.getElementById("status")!.textContent).toContain("placement cancelled");
    // A clean switch is silent — the toast stands still, no phantom
    // cancellations.
    const quiet = document.getElementById("status")!.textContent;
    app.setBoardLayer("modules");
    expect(document.getElementById("status")!.textContent).toBe(quiet);
    expect(toast.textContent).toBe(quiet);
    // The Esc walk is unchanged: Esc unwinds the World placement arm
    // before it ever touches the layer.
    app.setBoardLayer("world");
    app.worldArmTray("wp1");
    expect(app.ui.worldArmed).toBe("wp1");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.worldArmed).toBeNull();
    expect(app.ui.boardLayer).toBe("world");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.boardLayer).toBe("modules");
  });

  it("cancellation feedback expires and a later cancellation gets its full display time", () => {
    vi.useFakeTimers();
    try {
      const s = app.state;
      s.catalogEntryOwned = true;
      s.eraEarned = BALANCE.world.entryNous * 1.5;
      s.world.weapons.push({ id: "wp1", type: "chargeBlade", pos: null, store: 0, cooldown: 0, targetPriority: [] });
      app.armCellPurchase();
      app.setBoardLayer("world");
      const toast = document.getElementById("mode-toast")!;
      expect(toast.hidden).toBe(false);
      vi.advanceTimersByTime(5000);
      app.worldArmTray("wp1");
      app.setBoardLayer("modules");
      expect(toast.textContent).toContain("World placement cancelled");
      vi.advanceTimersByTime(1000);
      expect(toast.hidden).toBe(false);
      vi.advanceTimersByTime(5000);
      expect(toast.hidden).toBe(true);
      expect(document.getElementById("status")!.textContent).toContain("World placement cancelled");
    } finally {
      vi.useRealTimers();
    }
  });

  it("the door opens on the mode's face — mode wins over the last-face memory (issue #273)", () => {
    bankFirstArete();
    // Module mode: the door lands on ν, whatever the memory says — a face
    // switched to arete and left there does not survive the trip.
    app.openModal("catalog");
    expect(document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.disabled).toBe(false);
    switchFace("arete");
    expect(app.ui.catalogFace).toBe("arete");
    app.closeModal();
    app.openModal("catalog");
    expect(app.ui.catalogFace).toBe("nous");
    expect(document.querySelector('[data-buy="generator"]')).not.toBeNull();
    app.closeModal();
    // The World layer: the door lands on ◇ — the face the layer directs,
    // the in-sheet memory never overriding it.
    app.state.catalogEntryOwned = true;
    app.state.arete = 5;
    app.state.eraEarned = BALANCE.world.entryNous * 1.5;
    app.render();
    app.setBoardLayer("world");
    app.ui.catalogFace = "nous";
    app.openModal("catalog");
    expect(app.ui.catalogFace).toBe("arete");
    expect(document.querySelector(".entry-screen")).toBeNull();
    app.setBoardLayer("modules");
  });

  it("the dev era grant keeps the arete tab standing — the prestige lock agrees with the owned entry", () => {
    // The grant owns the entry, so the first prestige rode along: the
    // prestige-count lock must not dead-end the Catalog's arete tab.
    app.devWorldEra();
    app.openModal("catalog");
    expect(app.ui.catalogFace).toBe("arete"); // mutator mode directs the face
    const areteTab = document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!;
    expect(areteTab.disabled).toBe(false);
    expect(document.querySelector(".entry-screen")).toBeNull();
    // The face answers: switch away and back, still live.
    switchFace("nous");
    expect(app.ui.catalogFace).toBe("nous");
    switchFace("arete");
    expect(app.ui.catalogFace).toBe("arete");
    app.closeModal();
  });

  it("pre-entry the arete face is the single centered lock screen; the purchase lands the sequence and reveals the shop", () => {
    app.state.prestiges = 1;
    app.state.arete = BALANCE.catalogEntryCost;
    app.openModal("catalog");
    switchFace("arete");
    let sheet = document.getElementById("modal-content")!;
    const lock = sheet.querySelector(".entry-screen")!;
    expect(lock.textContent).toContain("Unlock Mutator Layer");
    expect(lock.textContent).toContain(`${BALANCE.catalogEntryCost} Arete`);
    expect(sheet.textContent).not.toContain("Upgrades");
    expect(sheet.textContent).not.toContain("Unlocks");
    // The lock screen's price mutes when the Arete is spent elsewhere — the
    // board's Row unlock can spend the bank before the entry is bought.
    app.state.arete = 0;
    app.render();
    expect((document.getElementById("buy-arete-entry") as HTMLButtonElement).disabled).toBe(true);
    app.state.arete = BALANCE.catalogEntryCost;
    app.render();
    document.getElementById("buy-arete-entry")!.click();
    expect(app.state.catalogEntryOwned).toBe(true);
    // The purchase's landing is the entry sequence (issue #274): the sheet
    // closes, the board flips to the Mutators layer, and the performed
    // roll waits banked in the Forge.
    expect(app.ui.modal).toBeNull();
    expect(app.ui.boardLayer).toBe("modules");
    expect(app.ui.entryRollPending).toBe(true);
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    // Reopened — layer wins, so the door lands on ν — and the arete face
    // restructures around the World section without the retired entry row
    // (issue #426): World leads, then Upgrades, then Module Types.
    app.openModal("catalog");
    expect(app.ui.catalogFace).toBe("nous");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
    sheet = document.getElementById("modal-content")!;
    expect(sheet.querySelector(".entry-screen")).toBeNull();
    const headings = [...sheet.querySelectorAll(".catalog-sections h2")].map((h) => h.textContent);
    expect(headings[0]).toBe("World");
    expect(headings[1]).toBe("Upgrades");
    expect(headings[2]).toContain("Module Types");
    expect(sheet.textContent).not.toContain("Mutator layer");
    expect(sheet.textContent).toContain("Charge Column");
    expect(sheet.textContent).toContain("Hone");
    app.closeModal();
  });

  it("the Accelerator stands as an inert placeholder — priced, never buyable, no tooltip", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = 100;
    app.openModal("catalog");
    switchFace("arete");
    const sheet = document.getElementById("modal-content")!;
    const accel = [...sheet.querySelectorAll(".catalog-row")].find((r) => r.textContent!.includes("Accelerator"))!;
    expect(accel.textContent).toContain("placeholder");
    const button = accel.querySelector<HTMLButtonElement>("button.price")!;
    expect(button.disabled).toBe(true);
    button.click();
    expect(app.state.arete).toBe(100);
    // The visible kind carries the placeholder state; the disclosure
    // doctrine cuts the tooltip that would restate it (issue #310).
    expect(accel.querySelector(".inst-tip")).toBeNull();
  });

  it("the roll-pool join carries the future-rolls tooltip; joining empties the section", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = BALANCE.rollPoolJoinCost;
    app.openModal("catalog");
    switchFace("arete");
    const sheet = document.getElementById("modal-content")!;
    // The pool join's tooltip holds the gloss standard; joining empties
    // the section.
    const tip = [...sheet.querySelectorAll(".inst-tip-body")].find((t) => t.textContent!.includes("unweighted"))!;
    expect(tip).not.toBeNull();
    document.getElementById("buy-arete-pool")!.click();
    expect(app.state.rollPoolJoined).toBe(true);
    expect(sheet.textContent).toContain("future objects appear in future rolls");
    expect(document.getElementById("buy-arete-pool")).toBeNull();
  });

  it("prices mute when unaffordable: an Arete row's price and a shelf offer stand inert without the resource", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = 0;
    app.state.nous = 0;
    app.openModal("catalog");
    switchFace("arete");
    expect((document.getElementById("buy-capacity-ceiling") as HTMLButtonElement).disabled).toBe(true);
    switchFace("nous");
    const shelfButton = document.querySelector<HTMLButtonElement>('[data-buy="generator"]')!;
    expect(shelfButton.disabled).toBe(true);
  });

  it("prices mute in flow: the lock screen's entry stands inert with the between-sessions note", () => {
    app.state.prestiges = 1;
    app.state.arete = 3;
    startSession(app.state, null);
    app.openModal("catalog");
    switchFace("arete");
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.querySelector(".modal-note")!.textContent).toContain("between sessions");
    expect((document.getElementById("buy-arete-entry") as HTMLButtonElement).disabled).toBe(true);
    expect(app.state.catalogEntryOwned).toBe(false);
  });

  it("in flow the revealed shop mutes too: every Arete row's price stands inert", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = BALANCE.capacityCeilingCosts[0]!;
    startSession(app.state, null);
    app.openModal("catalog");
    switchFace("arete");
    expect((document.getElementById("buy-capacity-ceiling") as HTMLButtonElement).disabled).toBe(true);
    expect(app.state.capacityCeilings).toBe(0);
  });
});

describe("the Arete Catalog (issue #197)", () => {
  const UNLOCK_ABOVE = BALANCE.launchRowsAbove + 1;
  const UNLOCK_BELOW = -BALANCE.launchRowsBelow - 1;

  function bankFirstArete(): void {
    // The World entry sits eleven decades above the horizon line, so the
    // door needs a past-entry era for a nonzero claim (issue #425): jump
    // the era to the entry, whose grant banks 2 and lands the starter
    // weapon.
    app.state.eraEarned = BALANCE.world.entryNous;
    app.render();
    app.openLedger("arete");
    document.getElementById("prestige-door")!.click();
    document.getElementById("prestige-confirm")!.click();
    expect(app.state.arete).toBe(2);
  }

  it("discloses Hone in the prestige confirmation and dismisses it with Escape", () => {
    app.state.eraEarned = BALANCE.world.entryNous;
    app.render();
    app.openLedger("arete");
    document.getElementById("prestige-door")!.click();
    const hone = document.querySelector<HTMLButtonElement>('[aria-label="Hone — what it means"]')!;
    hone.focus();
    expect(hone.getAttribute("aria-expanded")).toBe("true");
    const tip = document.getElementById(hone.getAttribute("aria-describedby")!)!;
    expect(tip.classList.contains("inst-show")).toBe(true);
    hone.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(hone.getAttribute("aria-expanded")).toBe("false");
    expect(tip.classList.contains("inst-show")).toBe(false);
  });

  it("before the first prestige the ledger and strip carry the dim telegraph slot (issue #270)", () => {
    app.render();
    // No live arete read and no door anywhere — the dim slot is the surface.
    expect(document.getElementById("arete-read")).toBeNull();
    expect(document.querySelector('#board-ledger [data-live="arete"]')).toBeNull();
    expect(document.getElementById("info-arete")).toBeNull();
    // The slot is unconditional: `— ◇`, dim, on both faces of the ledger,
    // and its tooltip names the lock it teaches.
    const ledgerSlot = document.querySelector("#board-ledger .ledger-arete")!;
    expect(ledgerSlot.classList.contains("arete-dim")).toBe(true);
    expect(ledgerSlot.closest("button")!.getAttribute("aria-label")).toBe("Open ledger");
    expect(ledgerSlot.querySelector("b")!.textContent).toBe("—");
    expect(ledgerSlot.querySelector(".arete-mark svg")).not.toBeNull();
    const stripSlot = document.querySelector("#game-info-strip .info-arete")!;
    expect(stripSlot.classList.contains("arete-dim")).toBe(true);
    expect(stripSlot.closest("button")!.getAttribute("aria-label")).toBe("Open ledger");
    expect(stripSlot.querySelector("b")!.textContent).toBe("—");
    // Even with the board grown to the unlock boundary and add-cell mode
    // armed, the banner never renders — the lock is the prestige count
    // (the first Arete reset), and nothing has reset yet.
    app.state.cells.push(hex(0, 2), hex(0, -1));
    app.armCellPurchase();
    app.render();
    expect(document.querySelector("[data-unlock-row]")).toBeNull();
  });

  it("banked Arete opens the ledger while Catalog retains purchasing", () => {
    bankFirstArete();
    app.render();
    // The old tap-through door is gone; the read is the surface.
    expect(document.getElementById("arete-read")).toBeNull();
    const figure = document.querySelector("#board-ledger .ledger-arete")!;
    expect(figure.classList.contains("arete-dim")).toBe(false);
    expect(figure.querySelector(".arete-mark svg")).not.toBeNull();
    expect(figure.querySelector('[data-live="arete"]')!.textContent).toBe("2");
    // The rig's era crosses the World entry, so the banking landed the
    // starter grant's one presentation; dismiss it once.
    if (app.ui.modal === "grant") { document.getElementById("grant-close")!.click(); }
    figure.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    app.closeModal();
    // The tabbed shop rides the Catalog door instead.
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="catalog"]')!.click();
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("nous");
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.querySelector('[data-catalog-face="arete"]')).not.toBeNull();
  });

  it("the arete face's purchases debit Arete: the lock screen's entry, then the pool join behind it", () => {
    app.state.prestiges = 1;
    app.state.arete = BALANCE.catalogEntryCost + BALANCE.rollPoolJoinCost;
    app.openModal("catalog");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
    // The join sits behind the entry: pre-entry the face is the lock screen.
    expect(document.getElementById("buy-arete-pool")).toBeNull();
    document.getElementById("buy-arete-entry")!.click();
    expect(app.state.catalogEntryOwned).toBe(true);
    expect(app.state.arete).toBe(BALANCE.rollPoolJoinCost);
    // The entry's landing closes the sheet (issue #274); the reopened door
    // lands on the layer's face — the arete face one switch away — with
    // the join live.
    expect(app.ui.modal).toBeNull();
    app.openModal("catalog");
    expect(app.ui.catalogFace).toBe("nous");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
    const join = document.getElementById("buy-arete-pool") as HTMLButtonElement;
    expect(join).not.toBeNull();
    expect(join.disabled).toBe(false);
    join.click();
    expect(app.state.rollPoolJoined).toBe(true);
    expect(app.state.arete).toBe(0);
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.textContent).toContain("future objects appear in future rolls");
  });

  it("the face's buttons stand inert outside upgrade mode", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = 3;
    startSession(app.state, null);
    app.openModal("catalog");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.querySelector(".modal-note")!.textContent).toContain("between sessions");
    expect((document.getElementById("buy-arete-pool") as HTMLButtonElement).disabled).toBe(true);
    expect(app.state.rollPoolJoined).toBe(false);
  });

  // Headroom retired with the frontier claim curve (issue #425): the
  // Upgrades section carries the capacity ladders and the placeholder
  // alone, and no break button exists anywhere on the face.
  it("the Upgrades section carries no Headroom row and no break button", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = 30;
    app.openModal("catalog");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.textContent).not.toContain("Headroom");
    expect(document.getElementById("buy-arete-break")).toBeNull();
  });

  it("the banner buys the row in one click; cells inside then buy with nous", () => {
    bankFirstArete();
    // Grow to the unlock boundary: rows 2 and −1 owned, so each frontier
    // touches its side's unlock row.
    app.state.cells.push(hex(0, 2), hex(0, -1));
    app.armCellPurchase();
    app.render();
    const banners = document.querySelectorAll("[data-unlock-row]");
    expect(banners).toHaveLength(2);
    expect(banners[0]!.getAttribute("data-unlock-row")).toBe(String(UNLOCK_ABOVE));
    const label = banners[0]!.textContent!;
    expect(label).toContain("Rack Extenders");
    expect(label).toContain("unlock this octave row");
    expect(label).toContain("1 Arete");
    // One click, outright: the row opens and its gate stands paid.
    (banners[0] as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.unlockedRows).toEqual([UNLOCK_ABOVE]);
    expect(app.state.arete).toBe(1);
    app.render();
    // The bought row's band is gone; the other side's banner escalates to 2.
    expect(document.querySelector(`[data-unlock-row="${UNLOCK_ABOVE}"]`)).toBeNull();
    expect(document.querySelector(`[data-unlock-row="${UNLOCK_BELOW}"]`)!.textContent).toContain("2 Arete");
    // Cells inside the unlocked row buy with nous as usual — no gate
    // premium, in range for the frontier.
    const price = cellCost(app.state.cellsBought);
    app.state.nous = price;
    app.render();
    const frontierInRow = document.querySelector(`[data-cell="0,${UNLOCK_ABOVE}"]`);
    expect(frontierInRow).not.toBeNull();
    frontierInRow!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.cells.some((c) => c.q === 0 && c.r === UNLOCK_ABOVE)).toBe(true);
    expect(app.state.nous).toBe(0);
  });

  it("a row beyond the cap never renders a banner and refuses the buy", () => {
    app.state.arete = 10;
    app.state.unlockedRows = [UNLOCK_ABOVE, UNLOCK_BELOW];
    app.state.cells.push(hex(0, 2), hex(0, -1));
    app.armCellPurchase();
    app.render();
    expect(document.querySelectorAll("[data-unlock-row]")).toHaveLength(0);
    app.buyRowUnlockAction(UNLOCK_ABOVE + 1);
    expect(app.state.unlockedRows).toEqual([UNLOCK_ABOVE, UNLOCK_BELOW]);
    expect(app.state.arete).toBe(10);
  });
});

describe("the opening arc's one pop-up (§8, issue #138)", () => {
  function arcCard(): HTMLElement {
    return document.getElementById("arc-card")!;
  }

  it("stays hidden through the single-synth opening", () => {
    app.render();
    expect(arcCard().hidden).toBe(true);
  });

  it("fires after the second synthesizer is acquired, leans on the ghost and the ×, and dismisses once, ever", () => {
    give(app.state, "additive", null); // the tray holds the new arrival
    app.render();
    expect(arcCard().hidden).toBe(false);
    expect(arcCard().textContent).toContain("Place it beside your first");
    expect(arcCard().textContent).toContain("dashed");
    expect(arcCard().textContent).toContain("×");
    document.getElementById("arc-card-dismiss")!.click();
    expect(arcCard().hidden).toBe(true);
    // A third synth, a re-render, a reload: it never fires again.
    give(app.state, "additive", null);
    app.render();
    expect(arcCard().hidden).toBe(true);
    const reloaded = boot();
    reloaded.render();
    expect(document.getElementById("arc-card")!.hidden).toBe(true);
  });

  it("never fires for non-synthesizer acquisitions", () => {
    give(app.state, "infusor", null);
    give(app.state, "forge", null);
    app.render();
    expect(arcCard().hidden).toBe(true);
  });
});

describe("the harmonic-capacity ladder (#259)", () => {
  beforeEach(() => { app = boot(undefined, true); });
  const readoutText = (): string => (document.getElementById("chord-readout") as HTMLElement).textContent ?? "";

  it("ordinary play sees the capacity surfaces in both catalog faces", () => {
    app = boot();
    app.state.arete = 5;
    app.openModal("catalog");
    expect(document.getElementById("modal-content")!.textContent).toContain("Poly Expander");
    app.closeModal();
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    // The World layer directs the door to the arete face (issue #426); the
    // released capacity offerings (issue #262) ride both faces — as the
    // collapsed products (issue #310).
    app.state.eraEarned = BALANCE.world.entryNous * 1.5;
    app.ui.boardLayer = "world";
    app.openModal("catalog");
    const sheet = document.getElementById("modal-content")!.textContent!;
    expect(sheet).toContain("Expansion Bays");
    expect(sheet).toContain("Chord Catalysts");
  });

  it("the catalog row quotes the rung's price and benefit, and the purchase lands", () => {
    app.state.nous = 1_000;
    app.openModal("catalog");
    const modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("Poly Expander");
    // The effect line carries the hoverable term; no ⓘ, no preview hex.
    const section = modal.querySelector<HTMLElement>(".capacity-catalog")!;
    const description = section.querySelector(".t-note")!.textContent!;
    expect(description).toContain("Raises");
    expect(description).toContain("by one for all voices");
    expect(section.querySelector("h3 .term-trigger")!.textContent).toBe("Poly Expander");
    expect(section.querySelector("svg")).toBeNull();
    // The mono delta reads the before → after on its own line.
    expect(section.querySelector(".t-note.mono")!.textContent).toBe("1/3 → 2/3");
    const button = document.querySelector<HTMLButtonElement>("[data-buy-capacity]")!;
    expect(button.textContent!.trim()).toBe(`${formatInt(BALANCE.capacityPrices[0]!)} ν`);
    expect(button.disabled).toBe(false);
    // The price lives only on the button.
    expect(modal.textContent).not.toContain("Spend");
    button.click();
    expect(app.state.capacityBought).toBe(1);
    // The modal re-rendered onto the next rung: delta and price moved.
    const next = document.querySelector<HTMLButtonElement>("[data-buy-capacity]")!;
    expect(next.textContent!.trim()).toBe(`${formatInt(BALANCE.capacityPrices[1]!)} ν`);
    expect(document.querySelector(".capacity-catalog .t-note.mono")!.textContent).toBe("2/3 → 3/3");
  });

  it("the unaffordable rung reads as disabled with its practice-minute estimate", () => {
    app.state.nous = 0;
    app.openModal("catalog");
    const button = document.querySelector<HTMLButtonElement>("[data-buy-capacity]")!;
    expect(button.disabled).toBe(true);
    const countdown = button.closest(".shop-buy")!.querySelector(".shop-countdown")!;
    expect(countdown.textContent).toContain("of practice");
  });

  it("the section's gloss stays reachable and dismissible; the rows speak for themselves (issue #310 steering)", () => {
    app.state.nous = 0;
    app.openModal("catalog");
    // The product name carries its reset mechanic through term disclosure.
    const product = document.querySelector<HTMLButtonElement>(".capacity-catalog h3 .term-trigger")!;
    product.focus();
    const productBody = document.getElementById(product.getAttribute("aria-describedby")!)!;
    expect(productBody.textContent).toBe("Re-earned after arete reset");
    expect(productBody.classList.contains("inst-show")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(productBody.classList.contains("inst-show")).toBe(false);
    app.closeModal();
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.eraEarned = BALANCE.world.entryNous * 1.5;
    app.ui.boardLayer = "world";
    app.openModal("catalog");
    // The one disclosure is the Module Types section's own gloss.
    const trigger = document.querySelector<HTMLButtonElement>(".catalog-sections h2 .inst-tip-trigger")!;
    trigger.focus();
    const body = document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    expect(body.classList.contains("inst-show")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(body.classList.contains("inst-show")).toBe(false);
    trigger.click();
    expect(body.classList.contains("inst-show")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("the rung is inert in flow mode — the purchase is upgrade-mode-only on the surface too", () => {
    app.state.nous = 1_000;
    startSession(app.state, null);
    app.openModal("catalog");
    const button = document.querySelector<HTMLButtonElement>("[data-buy-capacity]")!;
    expect(button.disabled).toBe(true);
    button.click();
    expect(app.state.capacityBought).toBe(0);
  });

  it("the capped row names the product that sells the next rung; the sold-out ladder reads complete", () => {
    app.state.capacityBought = 2;
    app.openModal("catalog");
    let modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("3/3");
    expect(modal.textContent).toContain("capped");
    expect(modal.textContent).toContain("Expansion Bays");
    expect(document.querySelector("[data-buy-capacity]")).toBeNull();
    // With both ceiling unlocks owned and every rung sold, the pointer
    // goes too — nothing is left to sell.
    app.state.capacityCeilings = 2;
    app.state.capacityBought = 4;
    app.render();
    modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("complete");
    expect(modal.textContent).not.toContain("capped");
  });

  it("a purchase immediately re-runs the allocation and the board's readouts", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    document.querySelector('[data-cell="0,0"]')!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readoutText()).toContain("(1/1)");
    app.state.nous = 1_000;
    app.buyCapacityAction();
    expect(readoutText()).toContain("(1/2)");
  });

  it("each two-rung ladder is one product bought twice at a rising price (issue #310)", () => {
    app.state.arete = 100;
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    // The World layer directs the door to the arete face (issue #426).
    app.state.eraEarned = BALANCE.world.entryNous * 1.5;
    app.ui.boardLayer = "world";
    app.openModal("catalog");
    const sheet = () => document.getElementById("modal-content")!;
    const rowOf = (name: string): HTMLElement =>
      [...sheet().querySelectorAll<HTMLElement>(".catalog-row")].find((r) => r.textContent!.includes(name))!;
    // One entry per product, owned figure and the before → after delta on
    // the row, next price on the button — no second rung, no lock state.
    for (const [name, firstPrice] of [["Expansion Bays", BALANCE.capacityCeilingCosts[0]], ["Chord Catalysts", BALANCE.capacityDiscountCosts[0]]] as const) {
      const row = rowOf(name);
      const term = row.querySelector<HTMLButtonElement>("h3 .term-trigger")!;
      expect(term.textContent).toBe(name);
      term.click();
      const gloss = document.getElementById(term.getAttribute("aria-describedby")!)!;
      expect(gloss.classList.contains("inst-show")).toBe(true);
      expect(gloss.textContent).toContain("persist through arete reset");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(gloss.classList.contains("inst-show")).toBe(false);
      expect(row.querySelector(".mono")!.textContent).toBe("0/2");
      expect(row.querySelector("button.price")!.textContent).toContain(`${firstPrice} Arete`);
      expect(row.textContent).not.toContain("After the first");
      expect(row.textContent).toContain("memorized");
    }
    expect(rowOf("Expansion Bays").textContent).toContain("ceiling 3 → 4");
    expect(rowOf("Chord Catalysts").textContent).toContain("prices −0% → −20%");
    // Six entries on the whole face: the layer's five upgrades (the
    // Warp Beam's cap row included, issue #380) and the pool join — no
    // second rungs. Headroom retired with the frontier claim (issue #425).
    // The World section's two products (issue #426) join the set: the
    // Column's ladder and the Hone entry.
    expect(sheet().querySelectorAll(".catalog-row")).toHaveLength(7);
    // The ceiling purchase lands and the same entry walks its ladder:
    // owned figure, delta, then the rising next price.
    rowOf("Expansion Bays").querySelector<HTMLButtonElement>("button.price")!.click();
    expect(app.state.capacityCeilings).toBe(1);
    app.render();
    const mid = rowOf("Expansion Bays");
    expect(mid.querySelector(".mono")!.textContent).toBe("1/2");
    expect(mid.textContent).toContain("ceiling 4 → 5");
    expect(mid.querySelector("button.price")!.textContent).toContain(`${BALANCE.capacityCeilingCosts[1]} Arete`);
    mid.querySelector<HTMLButtonElement>("button.price")!.click();
    expect(app.state.capacityCeilings).toBe(2);
    app.render();
    // Complete: the engraved owned-word replaces the button and the delta.
    const done = rowOf("Expansion Bays");
    expect(done.querySelector(".mono")!.textContent).toBe("2/2");
    expect(done.textContent).not.toContain("ceiling 4 → 5");
    expect(done.querySelector("button.price")).toBeNull();
    expect(done.querySelector(".st-acquired")!.textContent).toBe("raised");
    // The discounts collapse to the same shape.
    rowOf("Chord Catalysts").querySelector<HTMLButtonElement>("button.price")!.click();
    app.render();
    expect(rowOf("Chord Catalysts").textContent).toContain("prices −20% → −40%");
    rowOf("Chord Catalysts").querySelector<HTMLButtonElement>("button.price")!.click();
    expect(app.state.capacityDiscounts).toBe(2);
    app.render();
    const catalyzed = rowOf("Chord Catalysts");
    expect(catalyzed.querySelector("button.price")).toBeNull();
    expect(catalyzed.querySelector(".st-acquired")!.textContent).toBe("catalyzed");
  });

  it("the effect lines' domain terms hover to their glossary meanings, never spelled out", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.eraEarned = BALANCE.world.entryNous * 1.5;
    app.ui.boardLayer = "world";
    app.openModal("catalog");
    const row = [...document.querySelectorAll<HTMLElement>(".catalog-row")].find((r) => r.textContent!.includes("Expansion Bays"))!;
    const term = row.querySelector<HTMLButtonElement>(".t-note .term-trigger")!;
    expect(term.textContent).toBe("Harmonic capacity");
    term.focus();
    const body = document.getElementById(term.getAttribute("aria-describedby")!)!;
    expect(body.classList.contains("inst-show")).toBe(true);
    expect(body.textContent).toContain("Whole-chord budget per voice");
    // The one-place rule: persistence is never spelled out — the word
    // rides the effect line, the hover carries the meaning (issue #310).
    expect(row.textContent).not.toContain("Survives prestige");
    const memorized = [...row.querySelectorAll<HTMLButtonElement>(".term-trigger")].find((t) => t.textContent === "memorized")!;
    memorized.focus();
    expect(document.getElementById(memorized.getAttribute("aria-describedby")!)!.textContent).toContain("Persists through arete reset");
  });

  it("every rendered tooltip holds the gloss standard — one short line, no clause punctuation (issue #310 steering)", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = 20;
    app.state.eraEarned = BALANCE.world.entryNous * 1.5;
    app.ui.boardLayer = "world";
    app.openModal("catalog");
    const read = (): string[] =>
      [...document.querySelectorAll<HTMLElement>("#modal-content .inst-tip-body")].map((b) => b.textContent!.trim());
    // The arete face: the effect lines' term bodies (the Warp Beam's row
    // included, issue #380), the World section's terms (issue #426), and
    // the Module Types section's gloss.
    let texts = read();
    expect(texts.length).toBe(16);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(60);
      expect(text).not.toMatch(/[—;:]/);
    }
    expect(texts).toContain("Rolled module types appear here unweighted");
    expect(texts).toContain("Re-earned after arete reset");
    expect(texts).toContain("Lifts its module cell’s received charge to adjacent weapons");
    expect(texts).toContain("Arete’s persistent attack-power ranks for a weapon type");
    // The nous face: generator charge and Harmonic capacity glosses.
    document.querySelector<HTMLButtonElement>('[data-catalog-face="nous"]')!.click();
    texts = read();
    expect(texts).toEqual(["Generator output that powers other modules", "Whole-chord budget per voice", "Re-earned after arete reset", "Whole-chord budget per voice"]);
  });

  it("the sheet's capacity offerings stand inert outside upgrade mode", () => {
    app.state.arete = 100;
    startSession(app.state, null);
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    // Flow keeps the mode furniture off (clearTransientUi), so the door's
    // mode-wins lands on ν — stage the arete face the way the in-sheet
    // switch would.
    app.openModal("catalog");
    app.ui.catalogFace = "arete";
    app.render();
    for (const id of ["buy-capacity-ceiling", "buy-capacity-discount"]) {
      expect((document.getElementById(id) as HTMLButtonElement).disabled).toBe(true);
    }
    document.getElementById("buy-capacity-ceiling")!.click();
    expect(app.state.capacityCeilings).toBe(0);
  });

  it("ladder ownership rides the real save/reload path through the app", () => {
    app.state.nous = 1_000;
    app.buyCapacityAction();
    const saved = localStorage.getItem(STORAGE_KEY)!;
    expect(saved).toContain("capacityBought");
    const rebooted = boot(undefined, true);
    expect(rebooted.state.capacityBought).toBe(1);
    expect(rebooted.state.nous).toBe(app.state.nous);
  });
});
