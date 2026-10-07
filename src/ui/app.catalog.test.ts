// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { App } from "./app";
import { BALANCE } from "../engine/constants";
import { ARETE_HORIZON } from "../engine/accumulator";
import { STORAGE_KEY } from "../engine/save";
import { cellCost } from "../engine/economy";
import { startSession } from "../engine/actions";
import { give } from "../engine/fixtures";
import { hex, sameHex } from "../engine/hex";
import { formatInt } from "./format";
import { createAppFixture } from "./testing/app-fixture";

// catalog rendering and interaction on the production HTML skeleton.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

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
    app.state.eraEarned = ARETE_HORIZON;
    app.render();
    document.getElementById("prestige-door")!.click();
    document.getElementById("prestige-confirm")!.click();
    expect(app.state.arete).toBe(1);
  }

  it("the face switch reads ν nous / ◇ Arete, and names the dialog without a duplicated title", () => {
    app.openModal("catalog");
    const sheet = document.getElementById("modal-content")!;
    const tabs = [...sheet.querySelectorAll<HTMLButtonElement>(".catalog-face-tab")];
    expect(tabs).toHaveLength(2);
    expect(tabs[0]!.getAttribute("data-catalog-face")).toBe("nous");
    expect(tabs[0]!.textContent).toContain("nous");
    expect(tabs[0]!.querySelector(".mono")!.textContent).toBe("ν");
    expect(tabs[1]!.getAttribute("data-catalog-face")).toBe("arete");
    expect(tabs[1]!.textContent).toContain("Arete");
    expect(tabs[1]!.querySelector("svg")).not.toBeNull();
    // The switch carries the dialog's accessible name — the door's word.
    expect(document.getElementById("modal-title")!.getAttribute("aria-label")).toBe("Catalog");
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

  it("pre-entry the locked Mutators controls walk to the ◇ entry screen (#273)", () => {
    // Short of the entry: the entry screen is the arete face's one offer,
    // and every locked control lands on it — pre-prestige included, where
    // the walk is the preview of the future entry (the price mutes).
    app.state.prestiges = 0;
    app.state.arete = 0;
    app.render();
    // The board tab: locked, muted, lock-marked — its click never flips
    // the mode.
    const tab = document.querySelector<HTMLButtonElement>('#mut-tabs [data-mut-layer="mutators"]')!;
    expect(tab.classList.contains("locked")).toBe(true);
    expect(tab.querySelector(".mut-tab-lock")).not.toBeNull();
    tab.click();
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
    expect(document.querySelector(".entry-screen")).not.toBeNull();
    expect((document.getElementById("buy-arete-entry") as HTMLButtonElement).disabled).toBe(true);
    app.closeModal();
    // The tray sheet's switch wears the same locked face, landing the same.
    app.openModal("inventory");
    const sheetTab = document.querySelector<HTMLButtonElement>('#modal-content [data-mut-layer="mutators"]')!;
    expect(sheetTab.classList.contains("locked")).toBe(true);
    expect(sheetTab.querySelector(".mut-tab-lock")).not.toBeNull();
    sheetTab.click();
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
    expect(document.querySelector(".entry-screen")).not.toBeNull();
    app.closeModal();
    // A mutator-mode Add without the entry walks there too — the one Add
    // shape that never arms (defensive: the locked switch never leaves the
    // mode at mutators pre-entry, so the state is staged here). The grant
    // keeps the cell-priced icon affordably armed, so the click lands.
    app.state.nous = BALANCE.cellFirstCost;
    app.ui.mutLayer = "mutators";
    app.render();
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!.click();
    expect(app.ui.mutUnlockArmed).toBe(false);
    expect(app.ui.buyingCell).toBe(false);
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
    expect(app.ui.mutLayer).toBe("mutators"); // the mode never flipped
    app.closeModal();
  });

  it("a mode change cancels the armed actions with a toast; the Esc walk stays Esc (#273)", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.arete = 20;
    s.mutatorSlots = [hex(0, 0)];
    s.mutators = [
      { id: "mu1", family: "power", rarity: "common", pos: hex(0, 0) },
      { id: "mu2", family: "charge", rarity: "uncommon", pos: null },
    ];
    app.render();
    // The cell arm dies at the mode change, named by the toast.
    app.armCellPurchase();
    expect(app.ui.buyingCell).toBe(true);
    app.mutSetLayer("mutators");
    expect(app.ui.buyingCell).toBe(false);
    expect(document.getElementById("status")!.textContent).toContain("cell purchase cancelled");
    const toast = document.getElementById("mode-toast")!;
    expect(toast.hidden).toBe(false);
    expect(toast.textContent).toContain("cell purchase cancelled");
    // A tray placement dies the same way, walking back.
    app.mutArmTray("mu2");
    expect(app.ui.mutArmedTray).toBe("mu2");
    app.mutSetLayer("modules");
    expect(app.ui.mutArmedTray).toBeNull();
    expect(document.getElementById("status")!.textContent).toContain("mutator placement cancelled");
    expect(toast.textContent).toContain("mutator placement cancelled");
    // A module placement too — the tray-tile arm rides the same rule.
    const trayId = give(s, "additive", null).id;
    app.beginPlacing(trayId);
    expect(app.ui.placing).toBe(trayId);
    app.mutSetLayer("mutators");
    expect(app.ui.placing).toBeNull();
    expect(document.getElementById("status")!.textContent).toContain("placement cancelled");
    // A clean switch is silent — the toast stands still, no phantom
    // cancellations.
    const quiet = document.getElementById("status")!.textContent;
    app.mutSetLayer("modules");
    expect(document.getElementById("status")!.textContent).toBe(quiet);
    expect(toast.textContent).toBe(quiet);
    // The Esc walk is unchanged: Esc unwinds the slot-unlock arm before it
    // ever touches the mode.
    app.mutSetLayer("mutators");
    app.mutArmUnlock();
    expect(app.ui.mutUnlockArmed).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.mutUnlockArmed).toBe(false);
    expect(app.ui.mutLayer).toBe("mutators");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.mutLayer).toBe("modules");
  });

  it("cancellation feedback expires and a later cancellation gets its full display time", () => {
    vi.useFakeTimers();
    try {
      app.state.catalogEntryOwned = true;
      app.armCellPurchase();
      app.mutSetLayer("mutators");
      const toast = document.getElementById("mode-toast")!;
      expect(toast.hidden).toBe(false);
      vi.advanceTimersByTime(5000);
      app.mutArmUnlock();
      app.mutSetLayer("modules");
      expect(toast.textContent).toContain("slot unlock cancelled");
      vi.advanceTimersByTime(1000);
      expect(toast.hidden).toBe(false);
      vi.advanceTimersByTime(5000);
      expect(toast.hidden).toBe(true);
      expect(document.getElementById("status")!.textContent).toContain("slot unlock cancelled");
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
    // Mutator mode: the door lands on ◇ — the face the mode directs, the
    // in-sheet memory never overriding it.
    app.state.catalogEntryOwned = true;
    app.state.arete = 5;
    app.render();
    app.mutSetLayer("mutators");
    app.ui.catalogFace = "nous";
    app.openModal("catalog");
    expect(app.ui.catalogFace).toBe("arete");
    expect(document.querySelector(".entry-screen")).toBeNull();
    app.mutSetLayer("modules");
  });

  it("the dev era grant keeps the arete tab standing — the prestige lock agrees with the owned entry", () => {
    // The grant owns the entry, so the first prestige rode along: the
    // prestige-count lock must not dead-end the Catalog's arete tab.
    app.devMutatorEra();
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

  it("pre-entry the arete face is the single centered lock screen; the purchase reveals Upgrades and Unlocks", () => {
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
    sheet = document.getElementById("modal-content")!;
    expect(sheet.querySelector(".entry-screen")).toBeNull();
    const headings = [...sheet.querySelectorAll(".catalog-sections h2")].map((h) => h.textContent);
    expect(headings).toEqual(["Upgrades", "Unlocks"]);
    // The entry's row reads ACQUIRED with its rewards line.
    const entryRow = [...sheet.querySelectorAll(".catalog-row")].find((r) => r.textContent!.includes("Mutator layer"))!;
    expect(entryRow.textContent).toContain("ACQUIRED");
    expect(entryRow.textContent).toContain("Mutator Grid");
    expect(entryRow.textContent).toContain("1 Mutator roll");
    expect(entryRow.querySelector(".st-acquired")).not.toBeNull();
  });

  it("the Accelerator stands as an inert placeholder — priced, never buyable", () => {
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
    // The tooltip layer carries the placeholder's mechanics.
    const tip = accel.querySelector(".inst-tip-body")!;
    expect(tip.textContent).toContain("placeholder");
    const trigger = accel.querySelector<HTMLElement>(".inst-tip-trigger")!;
    trigger.focus();
    expect(tip.classList.contains("inst-show")).toBe(true);
    trigger.blur();
    expect(tip.classList.contains("inst-show")).toBe(false);
  });

  it("the roll-pool join carries the future-rolls tooltip; joining empties the section", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = BALANCE.rollPoolJoinCost;
    app.openModal("catalog");
    switchFace("arete");
    const sheet = document.getElementById("modal-content")!;
    const tip = [...sheet.querySelectorAll(".inst-tip-body")].find((t) => t.textContent!.includes("future rolls"))!;
    expect(tip).not.toBeNull();
    document.getElementById("buy-arete-pool")!.click();
    expect(app.state.rollPoolJoined).toBe(true);
    expect(sheet.textContent).toContain("future objects appear in future rolls");
    expect(document.getElementById("buy-arete-pool")).toBeNull();
  });

  it("prices mute when unaffordable: the break's price and a shelf offer stand inert without the resource", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = 0;
    app.state.nous = 0;
    app.openModal("catalog");
    switchFace("arete");
    expect((document.getElementById("buy-arete-break") as HTMLButtonElement).disabled).toBe(true);
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

  it("in flow the revealed shop mutes too: the break's price stands inert", () => {
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = BALANCE.horizonBreakCost;
    startSession(app.state, null);
    app.openModal("catalog");
    switchFace("arete");
    expect((document.getElementById("buy-arete-break") as HTMLButtonElement).disabled).toBe(true);
    expect(app.state.horizonBroken).toBe(false);
  });
});

describe("the Arete Catalog (issue #197)", () => {
  const UNLOCK_ABOVE = BALANCE.launchRowsAbove + 1;
  const UNLOCK_BELOW = -BALANCE.launchRowsBelow - 1;

  function bankFirstArete(): void {
    app.state.eraEarned = ARETE_HORIZON;
    app.render();
    document.getElementById("prestige-door")!.click();
    document.getElementById("prestige-confirm")!.click();
    expect(app.state.arete).toBe(1);
  }

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
    expect(ledgerSlot.getAttribute("title")).toBe("Unlocks at first Arete Reset");
    expect(ledgerSlot.querySelector("b")!.textContent).toBe("—");
    expect(ledgerSlot.querySelector(".arete-mark svg")).not.toBeNull();
    const stripSlot = document.querySelector("#game-info-strip .info-arete")!;
    expect(stripSlot.classList.contains("arete-dim")).toBe(true);
    expect(stripSlot.getAttribute("title")).toBe("Unlocks at first Arete Reset");
    expect(stripSlot.querySelector("b")!.textContent).toBe("—");
    // Even with the board grown to the unlock boundary and add-cell mode
    // armed, the banner never renders — the lock is the prestige count
    // (the first Arete reset), and nothing has reset yet.
    app.state.cells.push(hex(0, 2), hex(0, -1));
    app.armCellPurchase();
    app.render();
    expect(document.querySelector("[data-unlock-row]")).toBeNull();
  });

  it("the first banked Arete raises the read on the ledger — a read, never a door (issue #271)", () => {
    bankFirstArete();
    app.render();
    // The old tap-through door is gone; the read is the surface.
    expect(document.getElementById("arete-read")).toBeNull();
    const figure = document.querySelector("#board-ledger .ledger-arete")!;
    expect(figure.classList.contains("arete-dim")).toBe(false);
    expect(figure.querySelector(".arete-mark svg")).not.toBeNull();
    expect(figure.querySelector('[data-live="arete"]')!.textContent).toBe("1");
    figure.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBeNull();
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
    const join = document.getElementById("buy-arete-pool") as HTMLButtonElement;
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
    expect((document.getElementById("buy-arete-break") as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById("buy-arete-pool") as HTMLButtonElement).disabled).toBe(true);
    expect(app.state.horizonBroken).toBe(false);
    expect(app.state.rollPoolJoined).toBe(false);
  });

  it("the Horizon break buys outright: one click debits ten Arete and reads as broken (issue #200)", () => {
    app.state.sessionsCompleted = 1;
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.state.arete = BALANCE.horizonBreakCost;
    app.openModal("catalog");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
    const button = document.getElementById("buy-arete-break") as HTMLButtonElement;
    expect(button.textContent).toContain(`${BALANCE.horizonBreakCost} Arete`);
    button.click();
    expect(app.state.horizonBroken).toBe(true);
    expect(app.state.arete).toBe(0);
    expect(app.state.achievements["breaking-the-horizon"]).toBeGreaterThan(0);
    // The toast carries both the beat's words and the feat's unlock.
    expect(document.getElementById("status")!.textContent).toContain("The horizon breaks");
    expect(document.getElementById("status")!.textContent).toContain("Breaking the horizon");
    // The beat's one visual rides the bar.
    expect(app.breakBeatUntil).toBeGreaterThan(Date.now());
    app.render();
    expect(document.getElementById("horizon-bar")!.classList.contains("break-beat")).toBe(true);
    app.render();
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.textContent).toContain("broken");
    // One-time: the button is gone, nothing re-charges it.
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
    expect(label).toContain("Unlock this octave row");
    expect(label).toContain("1 Arete");
    // One click, outright: the row opens and its gate stands paid.
    (banners[0] as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.unlockedRows).toEqual([UNLOCK_ABOVE]);
    expect(app.state.arete).toBe(0);
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

  it("ordinary play shows no capacity surfaces in either catalog", () => {
    app = boot();
    app.state.arete = 5;
    app.openModal("catalog");
    expect(document.getElementById("modal-content")!.textContent).not.toContain("Harmonic capacity");
    app.closeModal();
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    // Mutator mode directs the door to the arete face (issue #273); the
    // dev capacity offerings ride both faces, and ordinary play shows none.
    app.ui.mutLayer = "mutators";
    app.openModal("catalog");
    expect(document.getElementById("modal-content")!.textContent).not.toContain("Harmonic capacity");
  });

  it("the catalog row quotes the rung's price and benefit, and the purchase lands", () => {
    app.state.nous = 1_000;
    app.openModal("catalog");
    const modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("Harmonic capacity");
    expect(modal.textContent).toContain("1/3");
    const button = document.querySelector<HTMLButtonElement>("[data-buy-capacity]")!;
    expect(button.textContent!.trim()).toBe(`${formatInt(BALANCE.capacityPrices[0]!)} ν`);
    expect(button.disabled).toBe(false);
    button.click();
    expect(app.state.capacityBought).toBe(1);
    // The modal re-rendered onto the next rung: figure, price, and the
    // remaining headroom all moved.
    const next = document.querySelector<HTMLButtonElement>("[data-buy-capacity]")!;
    expect(next.textContent!.trim()).toBe(`${formatInt(BALANCE.capacityPrices[1]!)} ν`);
    expect(document.getElementById("modal-content")!.textContent).toContain("2/3");
  });

  it("the unaffordable rung reads as disabled with its practice-minute estimate", () => {
    app.state.nous = 0;
    app.openModal("catalog");
    const button = document.querySelector<HTMLButtonElement>("[data-buy-capacity]")!;
    expect(button.disabled).toBe(true);
    const countdown = button.closest(".shop-buy")!.querySelector(".shop-countdown")!;
    expect(countdown.textContent).toContain("of practice");
  });

  it("capacity disclosure stays reachable with unavailable purchases and dismisses before the sheet", () => {
    app.state.nous = 0;
    app.openModal("catalog");
    const trigger = document.querySelector<HTMLButtonElement>(".capacity-catalog .inst-tip-trigger")!;
    expect(document.querySelector<HTMLButtonElement>("[data-buy-capacity]")!.disabled).toBe(true);
    trigger.focus();
    const body = document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    expect(body.classList.contains("inst-show")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(body.classList.contains("inst-show")).toBe(false);
    expect(document.querySelector("[data-buy-capacity]")).not.toBeNull();
    trigger.click();
    expect(body.classList.contains("inst-show")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    document.getElementById("modal-title")!.click();
    expect(body.classList.contains("inst-show")).toBe(false);
    app.closeModal();
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    // The mode directs the face (issue #273): mutator mode is how the door
    // lands on the arete sheet now.
    app.ui.mutLayer = "mutators";
    app.openModal("catalog");
    const locked = document.getElementById("buy-capacity-ceiling-2")!.closest(".catalog-row")!;
    const lockedTrigger = locked.querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
    lockedTrigger.focus();
    const lockedBody = document.getElementById(lockedTrigger.getAttribute("aria-describedby")!)!;
    expect(lockedBody.classList.contains("inst-show")).toBe(true);
    expect(lockedBody.textContent).toContain("Own the first ceiling first");
    lockedTrigger.click();
    expect(lockedBody.classList.contains("inst-show")).toBe(true);
    expect(lockedTrigger.getAttribute("aria-expanded")).toBe("true");
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

  it("the capped row names the ceiling and points at the Arete sheet; the sold-out ladder reads complete", () => {
    app.state.capacityBought = 2;
    app.openModal("catalog");
    let modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("3/3");
    expect(modal.textContent).toContain("capped");
    expect(modal.textContent).toContain("Arete Catalog");
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
    const c4 = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(0, 0)))!;
    app.select(c4.id);
    expect(readoutText()).toContain("Capacity 1/1");
    app.state.nous = 1_000;
    app.buyCapacityAction();
    expect(readoutText()).toContain("Capacity 1/2");
  });

  it("the Arete sheet sells the two ceilings and two discounts, each pair in order", () => {
    app.state.arete = 100;
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    // Mutator mode directs the door to the arete face (issue #273).
    app.ui.mutLayer = "mutators";
    app.openModal("catalog");
    const sheet = () => document.getElementById("modal-content")!;
    expect(sheet().textContent).toContain("Harmonic capacity");
    expect(sheet().textContent).toContain("capacity four");
    expect(sheet().textContent).toContain("capacity five");
    const secondCeiling = document.getElementById("buy-capacity-ceiling-2") as HTMLButtonElement;
    const secondDiscount = document.getElementById("buy-capacity-discount-2") as HTMLButtonElement;
    expect(secondCeiling.disabled).toBe(true);
    expect(secondDiscount.disabled).toBe(true);
    document.getElementById("buy-capacity-ceiling-1")!.click();
    expect(app.state.capacityCeilings).toBe(1);
    app.render();
    expect(sheet().textContent).toContain("raised");
    const nextCeiling = document.getElementById("buy-capacity-ceiling-2") as HTMLButtonElement;
    expect(nextCeiling.disabled).toBe(false);
    expect(nextCeiling.textContent).toContain(`${BALANCE.capacityCeilingCosts[1]} Arete`);
    nextCeiling.click();
    expect(app.state.capacityCeilings).toBe(2);
    app.render();
    expect(document.getElementById("buy-capacity-ceiling-1")).toBeNull();
    document.getElementById("buy-capacity-discount-1")!.click();
    document.getElementById("buy-capacity-discount-2")!.click();
    expect(app.state.capacityDiscounts).toBe(2);
    app.render();
    expect(sheet().textContent).toContain("owned");
    expect(document.getElementById("buy-capacity-discount-1")).toBeNull();
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
    for (const id of ["buy-capacity-ceiling-1", "buy-capacity-discount-1"]) {
      expect((document.getElementById(id) as HTMLButtonElement).disabled).toBe(true);
    }
    document.getElementById("buy-capacity-ceiling-1")!.click();
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
